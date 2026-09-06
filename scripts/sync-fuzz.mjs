#!/usr/bin/env node
// Fuzz the cloud sync engine (src/lib/syncEngine.js) against a simulated
// Firestore: several devices editing the same account with random network
// latency, contention, suspends (iOS backgrounding), kills / reloads and
// outages. After every run all devices and the cloud must agree, and no outfit
// anyone added (and nobody deleted) may be missing — the "7th outfit
// disappears" class of bug (Sync Fix batch).
//
//   node scripts/sync-fuzz.mjs            # 300 runs, random seeds
//   node scripts/sync-fuzz.mjs 2000       # more runs
//   node scripts/sync-fuzz.mjs 1 12345    # one run, fixed seed, verbose trace
//
// Pure node, no Firebase, no React. Runs in a few seconds.
import { createSyncEngine } from "../src/lib/syncEngine.js";
import { mergeState } from "../src/lib/merge.js";

// ── deterministic RNG ──
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0;
    return (a >>> 0) / 4294967296;
  };
}

// ── virtual clock: every timer / RPC / listener delivery is an event ──
class Clock {
  constructor() { this.t = 0; this.q = []; this.seq = 0; this.held = new Map(); }
  at(delay, owner, fn) { const ev = { t: this.t + delay, seq: this.seq++, owner, fn, dead: false }; this.q.push(ev); return ev; }
  cancel(ev) { if (ev) ev.dead = true; }
  hold(owner) { if (!this.held.has(owner)) this.held.set(owner, []); }
  release(owner) {
    const list = this.held.get(owner) || [];
    this.held.delete(owner);
    for (const ev of list) { ev.t = this.t; ev.seq = this.seq++; this.q.push(ev); }
  }
  drop(owner) { this.held.delete(owner); for (const ev of this.q) if (ev.owner === owner) ev.dead = true; }
  next() {
    this.q.sort((a, b) => a.t - b.t || a.seq - b.seq);
    while (this.q.length) {
      const ev = this.q.shift();
      if (ev.dead) continue;
      if (this.held.has(ev.owner)) { this.held.get(ev.owner).push(ev); continue; }
      this.t = ev.t;
      return ev;
    }
    return null;
  }
  pending() { return this.q.some((e) => !e.dead && !this.held.has(e.owner)); }
}
const tick = () => new Promise((r) => setImmediate(r)); // drain microtasks between events

// ── the fake cloud: one versioned doc, transactions with contention, listeners ──
class Cloud {
  constructor(clock, rand, opts) {
    this.clock = clock; this.rand = rand; this.opts = opts;
    this.raw = null; this.version = 0; this.exists = false;
    this.listeners = new Map(); // id → { owner, cb, lastSent }
    this.commits = 0; this.reads = 0; this.log = [];
  }
  lat(owner) { const { minLat, maxLat } = this.opts; return minLat + this.rand() * (maxLat - minLat) * (this.opts.slow?.has(owner) ? 4 : 1); }
  down(owner) { return this.opts.netDown.has(owner); }
  backendFor(owner) {
    const c = this;
    return {
      get: () => new Promise((res, rej) => {
        c.clock.at(c.lat(owner), owner, () => {
          if (c.down(owner)) return rej(new Error("unavailable"));
          c.reads++;
          const snap = { exists: c.exists, raw: c.raw };
          c.clock.at(c.lat(owner), owner, () => res(snap));
        });
      }),
      subscribe: (onRaw) => {
        const id = Symbol("l");
        const l = { owner, cb: onRaw, lastSent: undefined };
        c.listeners.set(id, l);
        c.clock.at(c.lat(owner), owner, () => c.deliver(l));
        return () => c.listeners.delete(id);
      },
      transact: (fn) => new Promise((res, rej) => {
        let attempts = 0;
        const attempt = () => {
          attempts++;
          c.clock.at(c.lat(owner), owner, () => {
            if (c.down(owner)) return rej(new Error("unavailable"));
            c.reads++;
            const readV = c.version, readRaw = c.raw;
            c.clock.at(c.lat(owner), owner, () => {
              let json;
              try { json = fn(readRaw); } catch (e) { return rej(e); }
              if (json == null) return res();
              // commit travels to the server
              c.clock.at(c.lat(owner), owner, () => {
                if (c.down(owner)) return rej(new Error("unavailable"));
                if (c.version !== readV) {
                  if (attempts >= 5) return c.clock.at(c.lat(owner), owner, () => rej(new Error("aborted: too much contention")));
                  return c.clock.at(c.lat(owner), owner, attempt);
                }
                c.raw = json; c.version++; c.exists = true; c.commits++;
                c.log.push({ t: c.clock.t, owner, v: c.version, outfits: (JSON.parse(json).savedOutfits || []).map((o) => o.id) });
                for (const l of c.listeners.values()) c.clock.at(c.lat(l.owner), l.owner, () => c.deliver(l));
                // the ack may be lost (e.g. the tab was frozen) — the write still landed
                if (c.opts.loseAck && c.rand() < c.opts.loseAck) return rej(new Error("unavailable"));
                c.clock.at(c.lat(owner), owner, () => res());
              });
            });
          });
        };
        attempt();
      }),
    };
  }
  // the watch stream reconnects once the network is back and delivers the current doc
  reconnect(owner) { for (const l of this.listeners.values()) if (l.owner === owner) this.clock.at(this.lat(owner), owner, () => this.deliver(l)); }
  deliver(l) {
    if (this.down(l.owner)) return;
    const raw = this.exists ? this.raw : null;
    if (l.lastSent === raw) return; // Firestore coalesces: only the current state gets delivered
    l.lastSent = raw;
    l.cb(raw, { pending: false });
  }
}

// ── a device: mirror + engine + lifecycle ──
class Device {
  constructor(id, sim, mirror) {
    this.id = id; this.sim = sim; this.mirror = mirror || Device.newMirror();
    this.engine = null; this.suspended = false; this.data = {};
  }
  // localStorage stand-in: the cache + base are shared by every tab that holds the
  // same store object; a tab's pending entry is keyed by its id (a fresh id per start, like a reload).
  static newMirror() {
    const store = { data: {}, base: null, owner: null, pendings: new Map(), gen: 0 };
    return { _store: store, forTab: (tab) => {
      const id = () => `${tab}#${store.gen}`;
      return {
        read: () => JSON.parse(JSON.stringify(store.data)),
        write: (d) => { store.data = JSON.parse(JSON.stringify(d)); },
        readBase: () => store.base,
        writeBase: (b) => { store.base = b; },
        readPendings: () => [...store.pendings.entries()].map(([k, v]) => ({ id: k, base: v.base, data: JSON.parse(JSON.stringify(v.data)) })),
        writePending: ({ base, data }) => { store.pendings.set(id(), { base, data: JSON.parse(JSON.stringify(data)) }); },
        clearPending: (pid = id()) => { store.pendings.delete(pid); },
        owner: () => store.owner,
        setOwner: (u) => { store.owner = u; },
        clear: () => { store.data = {}; store.base = null; store.owner = null; store.pendings.clear(); },
      };
    } };
  }
  start() {
    const { clock, cloud } = this.sim;
    const owner = this.id;
    const raw = cloud.backendFor(owner);
    const dbg = (m) => { if (this.sim.verbose) console.log(`t=${clock.t.toFixed(0).padStart(7)} ${owner} ${m}`); };
    const backend = {
      get: () => { dbg("get →"); return raw.get().then((r) => { dbg(`get ← exists=${r.exists}`); return r; }, (e) => { dbg(`get ✗ ${e.message}`); throw e; }); },
      subscribe: (cb, err) => raw.subscribe((r, m) => { dbg(`listener ← ${r ? "v" + JSON.parse(r).savedOutfits?.length : null}`); cb(r, m); }, err),
      transact: (fn) => { dbg("transact →"); return raw.transact((cur) => { const j = fn(cur); dbg(`  fn(cur outfits=${cur ? JSON.parse(cur).savedOutfits.map((o) => o.id).join(",") : null}) → ${j == null ? "nothing" : JSON.parse(j).savedOutfits.map((o) => o.id).join(",")}`); return j; }).then((r) => { dbg("transact ← ok"); return r; }, (e) => { dbg(`transact ✗ ${e.message}`); throw e; }); },
    };
    this.mirror._store.gen += 1; // a new page life gets a new pending id (the old entry is adopted by load)
    const tabMirror = this.mirror.forTab(this.id);
    const mirror = this.sim.verbose ? { ...tabMirror,
      write: (d) => { dbg(`mirror.write outfits=${(d.savedOutfits || []).map((o) => o.id).join(",")}`); tabMirror.write(d); },
      writePending: (m) => { dbg(`mirror.writePending outfits=${(m.data.savedOutfits || []).map((o) => o.id).join(",")}`); tabMirror.writePending(m); },
      clearPending: (pid) => { dbg(`mirror.clearPending ${pid || "(own)"}`); tabMirror.clearPending(pid); } } : tabMirror;
    this.engine = createSyncEngine({
      backend, mirror, uid: "u1",
      onData: (d) => { this.data = d; },
      warn: (...a) => { if (this.sim.verbose) console.log(`t=${clock.t.toFixed(0).padStart(7)} ${owner} warn:`, ...a.map((x) => (x instanceof Error ? x.message : x))); },
      setTimeout: (fn, ms) => clock.at(ms, owner, fn),
      clearTimeout: (ev) => clock.cancel(ev),
      now: () => clock.t,
      trace: (ev, info) => dbg(`engine ${ev} ${JSON.stringify(info)} outfitIds=${JSON.stringify(this.engine?._state.data.trips?.[0]?.outfitIds)}`),
    });
    this.engine.load();
  }
  suspend() { this.suspended = true; this.sim.clock.hold(this.id); }
  resume() { this.suspended = false; this.sim.clock.release(this.id); }
  kill() {
    this.engine.stop(); this.sim.clock.drop(this.id); this.suspended = false; this.engine = null;
    if (this.sim.verbose) { const st = this.mirror._store; console.log(`t=${this.sim.clock.t.toFixed(0).padStart(7)} ${this.id} mirror at kill: cache outfits=${(st.data.savedOutfits || []).map((o) => o.id).join(",")} pendings=${[...st.pendings.entries()].map(([k, v]) => `${k}:${(v.data.savedOutfits || []).map((o) => o.id).join(",")}`).join(" | ")}`); }
  }
  reload() { this.kill(); this.start(); }
}

// ── one run ──
async function runOnce(seed, verbose = false) {
  const rand = rng(seed);
  const clock = new Clock();
  const opts = { minLat: 20 + rand() * 200, maxLat: 300 + rand() * 2500, netDown: new Set(), slow: new Set(), loseAck: rand() < 0.3 ? 0.15 : 0 };
  const cloud = new Cloud(clock, rand, opts);
  const sim = { clock, cloud, verbose };
  const nDev = 2 + (rand() < 0.4 ? 1 : 0);
  const sharedMirror = rand() < 0.3 ? Device.newMirror() : null; // two Safari tabs share localStorage
  const devices = [];
  for (let i = 0; i < nDev; i++) devices.push(new Device(`d${i}`, sim, sharedMirror && i < 2 ? sharedMirror : null));

  // seed the cloud like a returning user
  const seedState = { trips: [{ id: "t1", destination: "Bay Area", items: [], outfitIds: [] }], savedOutfits: [{ id: "o0", name: "Seed", slots: { top: "Tee" } }], wardrobe: { top: ["Tee"] } };
  cloud.raw = JSON.stringify(seedState); cloud.exists = true; cloud.version = 1;
  for (const d of devices) { const m = d.mirror.forTab("seed"); m.setOwner("u1"); m.write(seedState); m.writeBase(cloud.raw); }
  for (const d of devices) d.start();

  const added = new Map(); // outfit id → device
  const deleted = new Set();
  let n = 0;
  const trace = [];
  const log = (m) => { if (verbose) console.log(`t=${clock.t.toFixed(0).padStart(7)} ${m}`); trace.push(m); };

  const steps = 8 + Math.floor(rand() * 30);
  const doStep = () => {
    const d = devices[Math.floor(rand() * devices.length)];
    if (!d.engine) { d.start(); log(`${d.id} start`); return; }
    if (!d.engine._state.loaded) { log(`${d.id} (still loading)`); return; } // the UI is gated on load: no edits before it
    const r = rand();
    if (r < 0.34 && !d.suspended) {
      const id = `o${++n}-${d.id}`;
      d.engine.edit("savedOutfits", (prev) => [...(prev || []), { id, name: `Outfit ${n}`, slots: { top: "Tee", bottom: `Pants ${n}` } }], []);
      d.engine.edit("trips", (prev) => (prev || []).map((t) => (t.id === "t1" ? { ...t, outfitIds: [...(t.outfitIds || []), id] } : t)), []);
      added.set(id, d.id); log(`${d.id} add ${id}`);
    } else if (r < 0.42 && !d.suspended) {
      const list = (d.data.savedOutfits || []).filter((o) => !deleted.has(o.id));
      if (list.length) {
        const victim = list[Math.floor(rand() * list.length)].id;
        d.engine.edit("savedOutfits", (prev) => (prev || []).filter((o) => o.id !== victim), []);
        deleted.add(victim); log(`${d.id} delete ${victim}`);
      }
    } else if (r < 0.52 && !d.suspended) {
      d.engine.edit("wardrobe", (prev) => ({ ...(prev || {}), top: [...new Set([...((prev || {}).top || []), `Top ${n}-${d.id}`])] }), {});
      log(`${d.id} wardrobe`);
    } else if (r < 0.62 && !d.suspended) {
      d.engine.flush(); log(`${d.id} flush (hidden)`);
    } else if (r < 0.74) {
      if (d.suspended) { d.resume(); log(`${d.id} resume`); } else { d.engine.flush(); d.suspend(); log(`${d.id} suspend`); }
    } else if (r < 0.82) {
      d.reload(); log(`${d.id} reload`);
    } else if (r < 0.88) {
      if (opts.netDown.has(d.id)) { opts.netDown.delete(d.id); log(`${d.id} online`); cloud.reconnect(d.id); d.engine.flush(); } else { opts.netDown.add(d.id); log(`${d.id} offline`); }
    } else if (r < 0.94) {
      if (opts.slow.has(d.id)) opts.slow.delete(d.id); else opts.slow.add(d.id);
      log(`${d.id} ${opts.slow.has(d.id) ? "slow" : "fast"} network`);
    } else {
      d.kill(); log(`${d.id} killed`);
    }
  };

  // interleave steps with simulated time
  for (let i = 0; i < steps; i++) {
    doStep();
    const gap = rand() < 0.5 ? rand() * 300 : rand() * 4000;
    const until = clock.t + gap;
    for (;;) {
      const ev = clock.next();
      if (!ev) break;
      if (ev.t > until) { clock.q.push(ev); break; }
      ev.fn(); await tick();
    }
  }
  // quiesce: everyone back, network up, drain everything
  for (const d of devices) { if (!d.engine) d.start(); if (d.suspended) d.resume(); }
  for (const id of [...opts.netDown]) { opts.netDown.delete(id); cloud.reconnect(id); }
  for (const d of devices) d.engine.flush();
  let guard = 0;
  for (;;) {
    const ev = clock.next();
    if (!ev) break;
    ev.fn(); await tick();
    if (++guard > 20000) throw new Error("did not quiesce");
  }
  // one more flush round (a retry timer may have been the last event)
  for (const d of devices) await d.engine.flush();
  for (;;) { const ev = clock.next(); if (!ev) break; ev.fn(); await tick(); }

  // ── invariants ──
  const canon = (o) => JSON.stringify(sortKeys(o));
  const cloudState = JSON.parse(cloud.raw);
  const problems = [];
  for (const d of devices) {
    const st = d.engine._state;
    if (verbose) console.log(`${d.id} final: engine outfitIds=${JSON.stringify(st.data.trips?.[0]?.outfitIds)} onData outfitIds=${JSON.stringify(d.data.trips?.[0]?.outfitIds)} dirty=${st.dirty} status=${st.status}`);
    if (st.dirty) problems.push(`${d.id} still dirty`);
    if (canon(d.data) !== canon(cloudState)) {
      const diff = Object.keys({ ...d.data, ...cloudState }).filter((k) => canon(d.data[k]) !== canon(cloudState[k]));
      problems.push(`${d.id} differs from the cloud in ${diff.join(",")}: device=${JSON.stringify(sortKeys(d.data[diff[0]])).slice(0, 300)} cloud=${JSON.stringify(sortKeys(cloudState[diff[0]])).slice(0, 300)}`);
    }
  }
  const cloudIds = new Set((cloudState.savedOutfits || []).map((o) => o.id));
  for (const [id, by] of added) if (!deleted.has(id) && !cloudIds.has(id)) problems.push(`outfit ${id} (added on ${by}) is missing from the cloud`);
  for (const id of deleted) if (cloudIds.has(id) && !added.has(id) && id !== "o0") problems.push(`deleted outfit ${id} came back`);
  const bay = (cloudState.trips || []).find((t) => t.id === "t1");
  for (const id of cloudIds) if (id !== "o0" && !(bay?.outfitIds || []).includes(id)) problems.push(`outfit ${id} is in the closet but not shortlisted on the trip`);
  if (verbose) for (const e of cloud.log) console.log(`  commit t=${e.t.toFixed(0)} by ${e.owner} v${e.v} outfits=${e.outfits.join(',')}`);
  return { problems, trace, commits: cloud.commits, reads: cloud.reads, devices: devices.length, steps, opts };
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// ── main ──
const runs = parseInt(process.argv[2] || "300", 10);
const fixed = process.argv[3] ? parseInt(process.argv[3], 10) : null;
let failed = 0, commits = 0, reads = 0;
for (let i = 0; i < runs; i++) {
  const seed = fixed ?? Math.floor(Math.random() * 2 ** 31);
  const r = await runOnce(seed, !!fixed);
  commits += r.commits; reads += r.reads;
  if (r.problems.length) {
    failed++;
    console.log(`FAIL seed=${seed} devices=${r.devices} steps=${r.steps} latency=${r.opts.minLat.toFixed(0)}–${r.opts.maxLat.toFixed(0)}ms loseAck=${r.opts.loseAck}`);
    for (const p of r.problems) console.log("   ", p);
    if (failed <= 3) for (const m of r.trace) console.log("      ", m);
  } else if (fixed) {
    console.log(`ok seed=${seed} commits=${r.commits} reads=${r.reads}`);
  }
}
console.log(`${runs - failed}/${runs} fuzz runs converged with nothing lost (${commits} commits, ${reads} reads)`);
process.exit(failed ? 1 : 0);
