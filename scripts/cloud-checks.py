"""PackPal CLOUD-MODE browser checks, against an in-memory Firebase stand-in.

Covers the code paths scripts/browser-checks.py can't reach in LOCAL_MODE:
StoreProvider load / debounced save / flush, the Firestore 1 MiB size guard and
the "full" state, write-failure surfacing + Retry + auto-retry when back online,
the missing-doc clobber guard, sign-out flush-then-clear (B10), and the
uid-owned localStorage mirror when a different account signs in.

How to run:
    npm ci
    VITE_FIREBASE_API_KEY=fake VITE_FIREBASE_PROJECT_ID=fake \
      npx vite build -c scripts/cloud-sim/vite.config.js
    npx vite preview -c scripts/cloud-sim/vite.config.js --port 4174 --strictPort &
    python3 scripts/cloud-checks.py        # needs: pip install playwright; python -m playwright install chromium

The fake (scripts/cloud-sim/fake-firebase.js) keeps its "Firestore" in
localStorage under __fake* keys, so the harness seeds and inspects it directly.
No real Firebase project is touched.
"""
import json, os, re, sys, time, traceback
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174"
results = []
os.makedirs("shots", exist_ok=True)


def ok(cond, msg):
    results.append((bool(cond), msg))
    print(("PASS  " if cond else "FAIL  ") + msg)


COLORS = {"rgb(139, 168, 136)": "sage", "rgb(193, 127, 89)": "copper", "rgb(212, 160, 74)": "amber",
          "rgb(199, 91, 91)": "danger", "rgb(155, 148, 144)": "grey"}


def item(iid, name, packed=False):
    return {"id": iid, "name": name, "category": "necessities", "section": "Docs", "packed": packed,
            "essential": False, "ff": False, "freq": 1, "needsRefill": False, "needsCharge": False}


TRIP = {"id": "cloud1", "destination": "Cloudville", "tripType": ["city"], "days": 3, "weather": "warm", "startDate": "",
        "tempRange": "warm", "items": [item("i1", "Alpha item"), item("i2", "Beta item"), item("i3", "Gamma item"), item("i4", "Delta item")], "otdItems": [], "otdChecked": {},
        # Delta is never packed, so the section/category never auto-collapse (B5) and the others stay clickable.
        "createdAt": "2026-08-01T00:00:00.000Z", "icon": "🏙️"}


def ls_get(page, k): return page.evaluate("k => localStorage.getItem(k)", k)
def ls_set(page, k, v): page.evaluate("([k, v]) => localStorage.setItem(k, v)", [k, v])
def ls_del(page, k): page.evaluate("k => localStorage.removeItem(k)", k)
def docs(page): return json.loads(ls_get(page, "__fakeDocs") or "{}")
def set_docs(page, d): ls_set(page, "__fakeDocs", json.dumps(d))


def cloud_state(page):
    d = docs(page).get("state/userA")
    return json.loads(d["state"]) if d else None


def cloud_trip(page, tid="cloud1"):
    st = cloud_state(page)
    return next((t for t in (st or {}).get("trips", []) if t["id"] == tid), None)


def cloud_item(page, iid):
    t = cloud_trip(page)
    return next((i for i in t["items"] if i["id"] == iid), None) if t else None


def cloud_item_in(page, tid, iid):
    t = cloud_trip(page, tid)
    return next((i for i in t["items"] if i["id"] == iid), None) if t else None


def mirror_keys(page):
    return page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('pp2_')).sort()")


def dot(page):   # the Account badge (and its dot) only exists on the Home screen
    return COLORS.get(page.evaluate(
        "() => { const s = document.querySelector('button[aria-label=\"Account\"] > span'); return s ? getComputedStyle(s).backgroundColor : 'none'; }"), "?")


def wait_for(fn, timeout=4000):
    """Poll a Python callable until truthy (used for cloud-side conditions)."""
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


def wait_dot(page, color, timeout=4000):
    return wait_for(lambda: dot(page) == color, timeout)


def home(page): page.get_by_role("button", name="New Trip").wait_for()


def open_trip(page, dest="Cloudville"):
    page.locator("button", has_text=dest).first.click()
    page.get_by_role("button", name="Focus Pack").wait_for()


def go_home(page):
    page.locator("button:has(svg.lucide-arrow-left)").first.click()
    home(page)


def tap_item(page, name):
    """Toggle an item inside the open trip, then return Home (where the sync dot lives)."""
    page.get_by_text(name, exact=True).click()
    page.wait_for_timeout(150)
    go_home(page)


def open_account(page):
    page.get_by_role("button", name="Account").click()
    page.get_by_role("heading", name="Account").wait_for()


def close_account(page):
    page.locator("button:has(svg.lucide-x)").first.click()
    page.wait_for_timeout(150)


def run(page, dialog, ctx):
    # ── 1. Seed the "cloud" for a returning user, then load ──
    page.goto(BASE + "/__seed__")          # same origin, no app yet
    ls_set(page, "__fakeUid", "userA")
    set_docs(page, {"users/userA": {"onboarded": True, "phone": "+15555550100"}, "state/userA": {"state": json.dumps({"trips": [TRIP]})}})
    page.goto(BASE + "/"); home(page)
    ok(page.get_by_text("Cloudville").count() == 1, "load: returning user's trip rendered from the cloud doc")
    ok(ls_get(page, "pp2_owner") == "userA" and json.loads(ls_get(page, "pp2_trips"))[0]["id"] == "cloud1", "load: mirror written and owned by userA")
    ok(wait_dot(page, "sage"), "load: sync dot is sage (idle)")

    # ── 2. Edits reach the cloud (debounced) ──
    open_trip(page); tap_item(page, "Alpha item")
    ok(wait_for(lambda: cloud_item(page, "i1")["packed"] is True) and wait_dot(page, "sage", 3000),
       "save: packing an item lands in the cloud doc within the debounce window")
    n_writes = len(json.loads(ls_get(page, "__fakeWrites") or "[]"))
    ok(n_writes >= 1, f"save: {n_writes} setDoc call(s) recorded")

    # ── 3. A failed write is visible and retryable ──
    ls_set(page, "__fakeFailWrites", "1")
    open_trip(page); tap_item(page, "Beta item")
    ok(wait_dot(page, "amber", 4000), "failure: sync dot turns AMBER (was grey = indistinguishable from offline)")
    ok(cloud_item(page, "i2")["packed"] is False and json.loads(ls_get(page, "pp2_trips"))[0]["items"][1]["packed"] is True,
       "failure: cloud untouched, local mirror has the change")
    open_account(page)
    ok(page.get_by_text("Not synced — changes are only on this device").count() == 1, "failure: Account sheet says 'Not synced'")
    ok(page.get_by_role("button", name="Retry").count() == 1, "failure: Retry button offered")
    page.screenshot(path="shots/cloud-01-not-synced.png")
    ls_del(page, "__fakeFailWrites")
    page.get_by_role("button", name="Retry").click()
    ok(wait_for(lambda: cloud_item(page, "i2")["packed"] is True) and wait_for(lambda: page.get_by_text("Synced to cloud").count() == 1),
       "retry: pushes the pending state, label back to 'Synced to cloud'")
    close_account(page)

    # ── 4. Auto-retry when the browser comes back online ──
    ls_set(page, "__fakeFailWrites", "1")
    open_trip(page); tap_item(page, "Alpha item")   # unpack
    ok(wait_dot(page, "amber", 4000), "online-retry: failed save flagged")
    ls_del(page, "__fakeFailWrites")
    page.evaluate("() => window.dispatchEvent(new Event('online'))")
    ok(wait_for(lambda: cloud_item(page, "i1")["packed"] is False) and wait_dot(page, "sage", 3000),
       "online-retry: 'online' event flushes the unsynced change")

    # ── 5. Size guard: over the 1 MiB document limit ──
    big = dict(TRIP); big.update({"id": "big1", "destination": "Bigtown", "items": [item("b1", "Big item")], "weatherData": {"blob": "x" * 1_100_000}})
    d = docs(page); st = json.loads(d["state/userA"]["state"]); st["trips"].append(big); d["state/userA"]["state"] = json.dumps(st); set_docs(page, d)
    page.reload(); home(page)
    open_account(page)
    ok(page.get_by_text(re.compile(r"Cloud storage \d+% used")).count() == 1, "size: Account shows the storage line once the blob is large")
    close_account(page)
    writes_before = len(json.loads(ls_get(page, "__fakeWrites") or "[]"))
    open_trip(page, "Bigtown"); tap_item(page, "Big item")
    ok(wait_dot(page, "danger", 4000), "size: an edit that would exceed the limit turns the dot RED instead of failing silently")
    open_account(page)
    ok(page.get_by_text("Cloud sync is paused").count() == 1 and page.get_by_text(re.compile(r"\(1,0\d\d KB\) is over the 1,024 KB limit")).count() == 1,
       "size: sheet explains the limit with real numbers")
    page.screenshot(path="shots/cloud-02-full.png")
    close_account(page)
    ok(len(json.loads(ls_get(page, "__fakeWrites"))) == writes_before and cloud_item_in(page, "big1", "b1")["packed"] is False,
       "size: the over-limit write was never attempted (no setDoc; cloud copy of the big trip unchanged)")
    open_trip(page, "Bigtown")
    page.locator("button:has(svg.lucide-trash2)").first.click()   # delete Bigtown (confirm auto-accepted)
    home(page)
    ok(wait_for(lambda: "big1" not in [t["id"] for t in cloud_state(page)["trips"]]) and wait_dot(page, "sage", 4000),
       "size: deleting the big trip lets sync resume — cloud doc updated, dot back to sage")

    # ── 6. Missing-doc guard: cloud doc vanishes for a returning user ──
    d = docs(page); del d["state/userA"]; set_docs(page, d)
    page.reload(); home(page)
    ok(page.get_by_text("Cloudville").count() == 1, "missing-doc: trips restored from this device's mirror instead of an empty account")
    ok(wait_dot(page, "amber", 3000), "missing-doc: flagged as not-synced until re-uploaded")
    open_trip(page); tap_item(page, "Beta item")
    ok(wait_for(lambda: cloud_trip(page) is not None and cloud_item(page, "i2")["packed"] is False) and wait_dot(page, "sage", 4000),
       "missing-doc: next edit re-creates the cloud doc from the mirror")

    # ── 7. B10: sign-out flushes the pending save, then clears the mirror ──
    open_trip(page); tap_item(page, "Alpha item")   # pack — still inside the 800 ms debounce when we sign out
    open_account(page)
    page.get_by_role("button", name="Sign out").click()
    page.get_by_text("Welcome in.").wait_for()
    ok(True, "sign-out: back on the sign-in screen")
    ok(cloud_item(page, "i1")["packed"] is True, "sign-out: the edit made moments before signing out reached the cloud (flush)")
    ok(mirror_keys(page) == [], f"sign-out: no pp2_* keys left in localStorage ({mirror_keys(page)})")

    # ── 8. Sign-out when the cloud can't be reached → confirm; dismiss keeps you in ──
    ls_set(page, "__fakeUid", "userA"); page.reload(); home(page)
    ls_set(page, "__fakeFailWrites", "1")
    open_trip(page); tap_item(page, "Beta item"); page.wait_for_timeout(1200)
    dialog["accept"] = False; dialog["seen"].clear()
    open_account(page); page.get_by_role("button", name="Sign out").click(); page.wait_for_timeout(800)
    ok(len(dialog["seen"]) == 1 and "haven't synced" in dialog["seen"][0] and page.get_by_role("heading", name="Account").count() == 1,
       f"sign-out offline: confirm shown ({dialog['seen'][0][:60]!r}…), dismissing keeps you signed in")
    dialog["accept"] = True
    page.get_by_role("button", name="Sign out").click()
    page.get_by_text("Welcome in.").wait_for()
    ok(mirror_keys(page) == [], "sign-out offline: accepting signs out and clears the mirror")
    ls_del(page, "__fakeFailWrites")

    # ── 9. A different account on the same device never sees the previous mirror ──
    # Simulate a session that ended WITHOUT sign-out: userA's mirror is still on disk.
    ls_set(page, "pp2_owner", "userA"); ls_set(page, "pp2_trips", json.dumps([TRIP]))
    d = docs(page); d["users/userB"] = {"onboarded": False, "phone": "+15555550199"}; set_docs(page, d)
    ls_set(page, "__fakeUid", "userB"); page.reload()
    page.get_by_text("Start with a clean slate", exact=False).wait_for()
    ok(page.get_by_text(re.compile(r"Bring my \d+ trips? from this device")).count() == 0, "owner switch: userB's onboarding does NOT offer userA's trips")
    ok(ls_get(page, "pp2_trips") is None and ls_get(page, "pp2_owner") == "userB", "owner switch: userA's mirror wiped, owner now userB")
    # Contrast: genuine pre-cloud local data (no owner tag) IS offered to a brand-new account.
    ls_set(page, "__fakeUid", ""); page.goto(BASE + "/__seed__")
    page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('pp2_')).forEach(k => localStorage.removeItem(k))")
    ls_set(page, "pp2_trips", json.dumps([TRIP]))
    d = docs(page); d["users/userC"] = {"onboarded": False, "phone": "+15555550177"}; set_docs(page, d)
    ls_set(page, "__fakeUid", "userC"); page.goto(BASE + "/")
    page.get_by_text("Start with a clean slate", exact=False).wait_for()
    ok(page.get_by_text("Bring my 1 trip from this device").count() == 1, "pre-cloud data (no owner) is still offered to a new account")

    # ── 10. Multi-device: live updates, merges, transactional conflicts, two tabs ──
    page.goto(BASE + "/__seed__")
    page.evaluate("() => localStorage.clear()")
    ls_set(page, "__fakeUid", "userA")
    set_docs(page, {"users/userA": {"onboarded": True, "phone": "+15555550100"}, "state/userA": {"state": json.dumps({"trips": [TRIP]})}})
    page.goto(BASE + "/"); home(page)

    def remote_edit(fn):
        """Mutate the cloud doc the way another device would (the fake's poll delivers it to listeners)."""
        d = docs(page); st = json.loads(d["state/userA"]["state"]); fn(st); d["state/userA"]["state"] = json.dumps(st); set_docs(page, d)

    # 10a. remote change while this tab is clean → applied live, no reload
    remote_edit(lambda st: st["trips"][0]["items"][0].__setitem__("packed", True))
    ok(wait_for(lambda: json.loads(ls_get(page, "pp2_trips"))[0]["items"][0]["packed"] is True), "live: a change made on another device reaches this tab without a reload")
    ok(wait_for(lambda: "1/4" in page.locator("button", has_text="Cloudville").first.text_content()), "live: the Home card re-renders (1/4 packed)")
    open_account(page)
    ok(page.get_by_text("Updated from another device").count() == 1, "live: Account notes the update from another device")
    close_account(page)

    # 10b. remote change while this tab holds an unsaved edit → three-way merge, both survive
    open_trip(page)
    page.get_by_text("Beta item", exact=True).click()                                   # local: pack Beta (debounce running)
    remote_edit(lambda st: st["trips"][0]["items"][2].__setitem__("packed", True))     # elsewhere: pack Gamma
    page.wait_for_timeout(150); go_home(page)
    ok(wait_for(lambda: cloud_trip(page)["items"][1]["packed"] and cloud_trip(page)["items"][2]["packed"], 5000),
       "merge: local Beta + remote Gamma are BOTH packed in the cloud (old code: last write wins, one lost)")
    mt = json.loads(ls_get(page, "pp2_trips"))[0]["items"]
    ok(mt[1]["packed"] and mt[2]["packed"], "merge: this tab's state has both too")

    # 10c. write-side conflict: listener stalled, another device writes between our edit and our push → the transaction merges
    ls_set(page, "__fakePausePush", "1")
    open_trip(page)
    page.get_by_text("Alpha item", exact=True).click()                                  # local: unpack Alpha
    remote_edit(lambda st: st["trips"][0].__setitem__("destination", "Cloudville ✨"))  # elsewhere: rename the trip
    page.wait_for_timeout(150); go_home(page)
    ok(wait_for(lambda: cloud_trip(page)["destination"] == "Cloudville ✨" and cloud_trip(page)["items"][0]["packed"] is False, 5000),
       "conflict: transaction merged the remote rename with the local unpack instead of clobbering it")
    ls_del(page, "__fakePausePush")
    ok(wait_for(lambda: page.get_by_text("Cloudville ✨").count() == 1, 3000), "conflict: merged result shown locally")

    # 10d. two tabs editing the same trip at the same time → both converge on the union
    page2 = ctx.new_page(); page2.set_default_timeout(8000)
    page2.goto(BASE + "/"); home(page2)
    open_trip(page, "Cloudville"); open_trip(page2, "Cloudville")
    page.get_by_text("Alpha item", exact=True).click()    # tab 1: pack Alpha
    page2.get_by_text("Beta item", exact=True).click()    # tab 2: unpack Beta (was packed)
    ok(wait_for(lambda: (lambda t: t["items"][0]["packed"] is True and t["items"][1]["packed"] is False and t["items"][2]["packed"] is True)(cloud_trip(page)), 6000),
       "two tabs: cloud ends with tab 1's AND tab 2's edits (Alpha ✓, Beta ✗, Gamma ✓, Delta ✗)")
    ok(wait_for(lambda: page.get_by_text("2 of 4 packed").count() == 1 and page2.get_by_text("2 of 4 packed").count() == 1, 6000),
       "two tabs: both tabs render the same converged state (2 of 4 packed)")

    # 10e. the trip open in this tab is deleted on another device → this tab returns Home
    go_home(page2)
    remote_edit(lambda st: st.__setitem__("trips", []))
    ok(wait_for(lambda: page.get_by_role("button", name="New Trip").count() == 1, 4000), "remote delete: the open trip vanishes → this tab returns Home")
    ok(wait_for(lambda: page.get_by_text("Cloudville").count() == 0 and page2.get_by_text("Cloudville").count() == 0, 4000), "remote delete: gone from both tabs")
    page2.close()


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 430, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(8000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    dialog = {"accept": True, "seen": []}
    page.on("dialog", lambda d: (dialog["seen"].append(d.message), d.accept() if dialog["accept"] else d.dismiss()))
    try:
        run(page, dialog, ctx)
        ok(not errors, f"no JS/page errors ({len(errors)})" + ("" if not errors else ": " + errors[0][:160]))
    except Exception:
        traceback.print_exc()
        page.screenshot(path="cloud-fail.png")
        print("URL:", page.url)
        print("BUTTONS AT FAILURE:", page.evaluate("() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 30)"))
        results.append((False, "harness aborted — see traceback"))
    finally:
        browser.close()

passed = sum(1 for r in results if r[0]); total = len(results)
print(f"\n{passed}/{total} cloud checks passed")
sys.exit(0 if passed == total else 1)
