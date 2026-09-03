"""PackPal browser regression checks (Tier 1 + Tier 2 audit fixes).

Drives the production build in LOCAL_MODE (no Firebase env, pure localStorage)
with Playwright + Chromium and asserts each audit fix from a real browser:
B1 genList gating, B2 template mirror, B3 refill gradient, B4 Firebase copy,
B5 per-trip collapse, B7 dupTrip reset, B8 outfit celebration, B9 emoji input,
plus Tier 3: the activeTrip derivation (synced outfit items persist when packed)
and the checkout->OTD migration running once the store is ready (B6).

How to run (any machine with Node + Python 3 + Playwright's Chromium):
    npm ci && npx vite build
    npx vite preview --port 4173 --strictPort &      # serves dist/ in LOCAL_MODE
    pip install playwright && python -m playwright install chromium   # once
    python3 scripts/browser-checks.py                 # 36 checks, screenshots in ./shots

It never touches Firebase: the served build has no VITE_FIREBASE_* vars, so the
app runs offline and all state lives in the headless browser's localStorage.
Last full pass: 2026-09-03 (36/36) against the Tier 3 build; the T3 "packing a synced outfit item is persisted" check FAILS on 4c5708e and earlier, by design — it reproduces the dual-state bug the activeTrip refactor fixed.
"""
import json, re, sys, os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("PP_BASE", "http://localhost:4173")   # override when the preview runs elsewhere
SHOTS = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(SHOTS, exist_ok=True)
results = []
def ok(cond, msg):
    results.append((bool(cond), msg)); print(("PASS  " if cond else "FAIL  ") + msg)

def trips(page):
    return json.loads(page.evaluate("localStorage.getItem('pp2_trips') || '[]'"))

def create_trip(page, dest, type_labels):
    page.get_by_role("button", name="New Trip").click()
    page.get_by_placeholder("e.g. Tokyo, Tulum, 90210...").fill(dest)
    page.get_by_role("button", name="Continue").click()
    for t in type_labels:
        page.get_by_role("button", name=t).click()
    page.get_by_role("button", name="Continue").click()   # details
    page.get_by_role("button", name="Continue").click()   # weather
    page.get_by_role("button", name="Continue").click()   # review
    page.get_by_role("button", name="Generate my list").click()
    page.get_by_role("button", name="Focus Pack").wait_for()

def go_home(page):
    # First button in the trip header is the back arrow
    page.locator("button:has(svg.lucide-arrow-left)").first.click()
    page.get_by_role("button", name="New Trip").wait_for()

def open_trip(page, dest):
    page.locator("button", has_text=dest).filter(has_not_text="(copy)").first.click() if "(copy)" not in dest \
        else page.locator("button", has_text=dest).first.click()
    page.get_by_role("button", name="Focus Pack").wait_for()

# JS helpers scoped to a category block (header span text -> block element)
CAT_ITEMS_JS = """(label) => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent === label);
  if (!s) return null;
  const block = s.parentElement.parentElement;
  return [...block.querySelectorAll('span')].filter(x => x.style.fontSize === '14.5px').map(x => x.textContent);
}"""
CAT_CLICK_ALL_JS = """(label) => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent === label);
  const block = s.parentElement.parentElement;
  const spans = [...block.querySelectorAll('span')].filter(x => x.style.fontSize === '14.5px');
  spans.forEach(x => x.click());
  return spans.length;
}"""
CAT_HEADER_CLICK_JS = """(label) => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent === label);
  s.parentElement.click();
  return s.parentElement.textContent;
}"""
CAT_OPEN_JS = """(label) => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent === label);
  const block = s.parentElement.parentElement;
  return block.children.length === 2;   // header only (1) = collapsed; header + card (2) = expanded
}"""
CAT_HEADER_TEXT_JS = """(label) => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent === label);
  return s ? s.parentElement.textContent : null;
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 430, "height": 900}, device_scale_factor=2)
    page = ctx.new_page()
    page.set_default_timeout(8000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    net = []
    page.on("console", lambda m: (net if "Failed to load resource" in m.text else errors).append(m.text) if m.type == "error" else None)
    page.on("requestfailed", lambda r: net.append(f"{r.url} → {r.failure}"))

    page.goto(BASE + "/")
    page.get_by_role("button", name="New Trip").wait_for()
    ok(True, "LOCAL_MODE: app opens straight to Home with no login")
    page.screenshot(path=f"{SHOTS}/01-home.png")

    # ── B4: offline explainer copy ──
    page.get_by_role("button", name="Account").click()
    sheet = page.get_by_text("You're in offline mode", exact=False)
    sheet.wait_for()
    txt = sheet.text_content()
    ok("Firebase" in txt and "Supabase" not in txt, f"B4 account sheet says Firebase, not Supabase: {txt.strip()[:90]!r}")
    page.screenshot(path=f"{SHOTS}/02-account-sheet-B4.png")
    page.locator("button:has(svg.lucide-x)").first.click()   # close sheet

    # ── B1: conditional items gated on trip type ──
    create_trip(page, "Tokyo", ["City Trip"])
    t = trips(page)[0]
    names = [i["name"] for i in t["items"]]
    ok("Passport" not in names, f"B1 city trip (Tokyo): no Passport  ({len(names)} items)")
    ok("Corporate badge" not in names, "B1 city trip: no Corporate badge")
    ok("Boarding Passes" in names, "B1 city trip: Boarding Passes (no cond) still present")
    ok(page.get_by_text("Passport", exact=True).count() == 0, "B1 city trip: 'Passport' not rendered anywhere in the list")
    page.screenshot(path=f"{SHOTS}/03-tokyo-trip-B1.png", full_page=False)
    go_home(page)
    create_trip(page, "Lisbon", ["International"])
    names = [i["name"] for i in trips(page)[0]["items"]]
    ok("Passport" in names and "Corporate badge" not in names, "B1 international trip (Lisbon): Passport present, Corporate badge absent")
    go_home(page)
    create_trip(page, "Denver", ["Business / Offsite"])
    names = [i["name"] for i in trips(page)[0]["items"]]
    ok("Corporate badge" in names and "Passport" not in names, "B1 business trip (Denver): Corporate badge present, Passport absent")
    go_home(page)

    # ── B5: category collapse is per-trip ──
    open_trip(page, "Tokyo")
    n = page.evaluate(CAT_CLICK_ALL_JS, "Active & Chill")
    page.wait_for_timeout(400)
    hdr = page.evaluate(CAT_HEADER_TEXT_JS, "Active & Chill")
    ok(n == 2 and "Complete" in hdr and page.evaluate(CAT_ITEMS_JS, "Active & Chill") == [], f"B5 Tokyo: packed all {n} 'Active & Chill' items → category auto-collapsed ({hdr.strip()!r})")
    page.evaluate(CAT_HEADER_CLICK_JS, "Active & Chill")
    page.wait_for_timeout(200)
    ok(page.evaluate(CAT_OPEN_JS, "Active & Chill"), "B5 Tokyo: tapping the header re-expands the category (override set; its one completed section stays folded by design)")
    go_home(page)
    open_trip(page, "Denver")
    page.evaluate(CAT_CLICK_ALL_JS, "Active & Chill")
    page.wait_for_timeout(400)
    ok(not page.evaluate(CAT_OPEN_JS, "Active & Chill") and "Complete" in page.evaluate(CAT_HEADER_TEXT_JS, "Active & Chill"),
       "B5 Denver: same category completed → starts COLLAPSED (Tokyo's expand did not leak)")
    page.screenshot(path=f"{SHOTS}/04-denver-collapsed-B5.png")
    go_home(page)
    open_trip(page, "Tokyo")
    ok(page.evaluate(CAT_OPEN_JS, "Active & Chill"), "B5 Tokyo: still expanded when reopened (per-trip memory for the session)")
    go_home(page)

    # ── B3: refilled checkbox gradient in Focus Refill ──
    open_trip(page, "Denver")
    page.get_by_role("button", name="Mark Refills").click()
    page.get_by_text("Luggage scale", exact=True).click()
    page.get_by_text("Skincare Masks", exact=True).click()
    page.get_by_role("button", name=re.compile(r"^Done \(2\)")).click()
    page.get_by_role("button", name=re.compile(r"^Focus \(\d+\)$")).click()
    page.get_by_role("button", name=re.compile(r"View all refills")).click()
    page.wait_for_timeout(200)
    bg_before = page.evaluate("""() => { const b=[...document.querySelectorAll('button')].filter(x=>x.style.width==='28px'&&x.style.height==='28px')[0]; return getComputedStyle(b).backgroundImage; }""")
    page.evaluate("""() => { [...document.querySelectorAll('button')].filter(x=>x.style.width==='28px'&&x.style.height==='28px')[0].click(); }""")
    page.wait_for_timeout(300)
    bg_after = page.evaluate("""() => { const b=[...document.querySelectorAll('button')].filter(x=>x.style.width==='28px'&&x.style.height==='28px')[0]; return getComputedStyle(b).backgroundImage; }""")
    ok(bg_before == "none" and "linear-gradient" in bg_after and "rgb(107, 139, 104)" in bg_after,
       f"B3 refilled checkbox renders the sage gradient (before={bg_before!r}, after={bg_after[:60]!r}…)")
    page.screenshot(path=f"{SHOTS}/05-focus-refill-B3.png")
    page.get_by_role("button", name="Exit").click()   # exit Focus Refill
    page.get_by_role("button", name="Focus Pack").wait_for()

    # ── B7 setup: OTD progress + a collapsed section, then Duplicate ──
    page.get_by_role("button", name="Out the Door").click()
    page.get_by_role("button", name="Got it").click()
    page.wait_for_timeout(200)
    page.locator("button:has(svg.lucide-arrow-left)").first.click()   # OTD header back arrow
    page.get_by_role("button", name="Focus Pack").wait_for()
    before = [t for t in trips(page) if t["destination"] == "Denver"][0]
    # collapse the "Luggage" section (incomplete) by tapping its header
    page.evaluate("""() => { const s=[...document.querySelectorAll('span')].find(x=>x.textContent==='Luggage'); s.parentElement.click(); }""")
    page.wait_for_timeout(200)
    ok(page.get_by_text("Away Everywhere Bag", exact=True).count() == 0, "B5 Denver: 'Luggage' section manually collapsed (setup)")
    page.locator("button:has(svg.lucide-copy)").first.click()
    page.wait_for_timeout(400)
    ok(page.get_by_role("heading", name=re.compile(r"Denver \(copy\)")).count() == 1, "B7 duplicate opened: 'Denver (copy)'")
    ok(page.get_by_text("Away Everywhere Bag", exact=True).count() == 1, "B5 copy: 'Luggage' section is OPEN again (section state didn't carry over)")
    ts = trips(page)
    copy, orig = ts[0], [t for t in ts if t["destination"] == "Denver"][0]
    ok(copy["destination"] == "Denver (copy)" and copy["otdChecked"] == {} and orig["otdChecked"] != {},
       f"B7 copy.otdChecked == {{}} while original keeps {orig['otdChecked']}")
    ok(all(not i["packed"] and not i.get("refilled") and not i.get("needsRefill") for i in copy["items"]),
       "B7 copy: every item unpacked, no refill flags")
    ok(sum(i["packed"] for i in orig["items"]) == 2 and sum(bool(i.get("refilled")) for i in orig["items"]) == 1,
       f"B7 original untouched: {sum(i['packed'] for i in orig['items'])} packed, 1 refilled")
    ok(len({i["id"] for i in copy["items"]} & {i["id"] for i in orig["items"]}) == 0, "B7 copy has all-new item ids")
    page.screenshot(path=f"{SHOTS}/06-denver-copy-B7.png")

    # ── B9 + B8: outfit builder ──
    page.get_by_role("button", name="Build Outfits").click()
    page.get_by_text("Your outfits").wait_for()
    page.get_by_title("Tap to change emoji").first.click()
    emo = page.locator("input[style*='width: 36px']").first
    emo.fill("🇺🇸")
    ok(emo.input_value() == "🇺🇸", f"B9 flag emoji survives the input intact: {emo.input_value()!r} (old code would keep '🇸')")
    emo.fill("👩🏾‍💻")
    ok(emo.input_value() == "👩🏾‍💻", f"B9 skin-tone + ZWJ emoji intact: {emo.input_value()!r}")
    emo.fill("🎉🎪")
    ok(emo.input_value() == "🎪", "B9 typing a second emoji keeps only the last one")
    emo.press("Enter")
    page.wait_for_timeout(200)
    ok(page.get_by_title("Tap to change emoji").first.text_content().strip() == "🎪", "B9 saved emoji shows on the day header")
    page.screenshot(path=f"{SHOTS}/07-outfit-hub-emoji-B9.png")

    # B8: fill top + two accessory (multi) slots → 3 real slots → celebration.
    # With the old phantom-slot shadow only 'top' would have counted (1 < 3) → no toast.
    page.locator("button", has_text="Tap to start building this outfit").first.click()   # Travel Day's outfit card
    page.get_by_role("button", name=re.compile(r"^Add new top")).wait_for()
    def add_in_current_slot(val):
        page.get_by_role("button", name=re.compile(r"^Add (new|another) ")).click()
        inp = page.locator("input[placeholder^='e.g. ']").first
        inp.fill(val); inp.press("Enter")
        page.wait_for_timeout(500)
    add_in_current_slot("Cream cashmere top")          # single slot → auto-advances to Bottoms
    page.evaluate("""() => { [...document.querySelectorAll('button')].filter(b=>b.style.height==='10px')[5].click(); }""")  # Necklace(s)
    page.wait_for_timeout(200)
    add_in_current_slot("Gold layered necklace")
    page.evaluate("""() => { [...document.querySelectorAll('button')].filter(b=>b.style.height==='10px')[6].click(); }""")  # Bracelet(s)
    page.wait_for_timeout(200)
    add_in_current_slot("Gold cuff bracelet")
    page.get_by_role("button", name="Done").first.click()
    toast = page.get_by_text(re.compile(r"Outfit complete!|Styled & sorted!|Looking good!"))
    try:
        toast.first.wait_for(timeout=2000); seen = True; msg = toast.first.text_content()
    except Exception:
        seen = False; msg = "(no toast)"
    ok(seen, f"B8 celebration fires for top + necklace + bracelet (3 real slots): {msg!r}")
    page.screenshot(path=f"{SHOTS}/08-outfit-celebration-B8.png")
    plan = [t for t in trips(page) if t["destination"] == "Denver (copy)"][0]["outfitPlan"]
    # ── Tier 3 (activeTrip derivation): outfit items synced into the list must persist when packed ──
    page.get_by_role("button", name=re.compile(r"^Done — sync to packing list")).click()
    page.get_by_role("button", name="Focus Pack").wait_for()
    ok(page.get_by_text("Cream cashmere top", exact=True).count() == 1, "T3 outfit item synced into the packing list")
    page.get_by_text("Cream cashmere top", exact=True).click()
    page.wait_for_timeout(300)
    copy_items = [t for t in trips(page) if t["destination"] == "Denver (copy)"][0]["items"]
    top = [i for i in copy_items if i["name"] == "Cream cashmere top"]
    ok(len(top) == 1 and top[0]["packed"] is True, "T3 packing a synced outfit item is persisted (old dual-state code minted mismatched ids → never saved)")
    ok(len([i for i in copy_items if i["category"] == "outfits"]) == 3, "T3 exactly the 3 outfit items were added, once")

    slots = plan[0][0]["slots"]
    ok(slots.get("top") == "Cream cashmere top" and slots.get("necklace") == ["Gold layered necklace"] and slots.get("bracelet") == ["Gold cuff bracelet"],
       f"B8 plan persisted with real slot ids: {json.dumps(slots, ensure_ascii=False)}")

    # ── Tier 3 (B6): legacy trip with a `checkout` item + no otdItems is migrated on load ──
    page.evaluate("""() => {
      const ts = JSON.parse(localStorage.getItem('pp2_trips') || '[]');
      ts.push({ id: 'legacy1', destination: 'Legacy', tripType: ['city'], days: 2, weather: 'warm', startDate: '', tempRange: '',
        items: [{ id: 'l1', name: 'Phone', category: 'checkout', section: 'Out the Door', packed: false, essential: true, ff: false, freq: 1, needsRefill: false, needsCharge: false },
                { id: 'l2', name: 'Socks', category: 'activewear', section: 'Basics', packed: false, essential: false, ff: false, freq: 1, needsRefill: false, needsCharge: false }],
        createdAt: '2026-01-01T00:00:00.000Z', icon: '🏙️' });
      localStorage.setItem('pp2_trips', JSON.stringify(ts));
    }""")
    page.goto(BASE + "/")
    page.get_by_role("button", name="New Trip").wait_for()
    page.wait_for_timeout(500)
    legacy = [t for t in trips(page) if t["id"] == "legacy1"][0]
    ok(all(i["category"] != "checkout" for i in legacy["items"]) and isinstance(legacy.get("otdItems"), list) and legacy.get("otdChecked") == {},
       f"B6 migration ran after the store was ready: checkout item moved out, otdItems seeded ({len(legacy.get('otdItems', []))} items), otdChecked {{}}")
    ok(any(o["name"] == "Phone" for o in legacy["otdItems"]) and any(i["name"] == "Socks" for i in legacy["items"]), "B6 migrated item landed in otdItems; non-checkout item untouched")

    # ── B2: template survives reload in local mode ──
    page.goto(BASE + "/")
    page.get_by_role("button", name="New Trip").wait_for()
    ok(page.get_by_text("Default items", exact=True).count() == 1, "B2 setup: template card reads 'Default items'")
    page.get_by_role("button", name="Packing Template").click()
    first_add = page.locator("input[placeholder^='Add to ']").first
    first_add.fill("Playwright test item"); first_add.press("Enter")
    page.get_by_role("button", name="Save template").click()
    page.get_by_role("button", name=re.compile(r"Saved")).wait_for()
    page.locator("button:has(svg.lucide-arrow-left)").first.click()
    page.get_by_text("Customized").wait_for()
    page.reload()
    page.get_by_role("button", name="New Trip").wait_for()
    ok(page.get_by_text("Customized").count() == 1, "B2 after reload: template card still reads 'Customized'")
    raw = page.evaluate("localStorage.getItem('pp2_catalogTemplate')")
    ok(raw is not None and "Playwright test item" in raw, "B2 localStorage pp2_catalogTemplate holds the edited template")
    page.screenshot(path=f"{SHOTS}/09-template-customized-B2.png", full_page=True)
    create_trip(page, "Paris", ["City Trip"])
    names = [i["name"] for i in trips(page)[0]["items"]]
    ok("Playwright test item" in names and "Passport" not in names, "B2+B1: new trip generated from the edited template (and B1 gating still applies through it)")

    # ══════════════════════════════════════════════════════════════════════
    # UX batch (2026-09-03): health category + migrations, laundry mode, collapse
    # all, share, brand/colour + fix-it, tops/bottoms, save-to-template, arrange.
    # ══════════════════════════════════════════════════════════════════════
    page.evaluate("() => localStorage.clear()")
    page.reload(); page.get_by_role("button", name="New Trip").wait_for()

    # ── U1: Health & Wellness on new trips + migration of legacy trips ──
    create_trip(page, "Lisbon", ["City Trip"])
    t = trips(page)[0]
    health = [i for i in t["items"] if i["category"] == "health"]
    ok(len(health) >= 10 and any(i["name"] == "Advil" for i in health) and not any(i["category"] == "necessities" and i["section"] == "Pain & Sickness" for i in t["items"]),
       f"U1 new trip: {len(health)} Health & Wellness items, none left under Necessities")
    ok(page.get_by_text("Health & Wellness", exact=True).count() >= 1, "U1 'Health & Wellness' category header renders")
    page.evaluate("""() => {
      const ts = JSON.parse(localStorage.getItem('pp2_trips') || '[]');
      const it = (id, n, c, s) => ({ id, name: n, category: c, section: s, packed: false, essential: false, ff: false, freq: 1, needsRefill: false, needsCharge: false });
      ts.push({ id: 'legacy2', destination: 'Legacy Two', tripType: ['city'], days: 3, weather: 'warm', startDate: '', tempRange: '',
        items: [it('m1', 'Advil', 'necessities', 'Pain & Sickness'), it('m2', 'Keys', 'necessities', 'Important Documents'),
                it('m3', 'Cream top', 'outfits', 'Clothing'), it('m4', 'Blue jeans', 'outfits', 'Clothing')],
        otdItems: [], otdChecked: {}, createdAt: '2026-01-01T00:00:00.000Z', icon: '🏙️',
        outfitPlan: [[{ id: 'oc', type: 'daytime', label: 'Day', slots: { top: 'Cream top', bottom: 'Blue jeans' } }]] });
      localStorage.setItem('pp2_trips', JSON.stringify(ts));
    }""")
    page.goto(BASE + "/"); page.get_by_role("button", name="New Trip").wait_for(); page.wait_for_timeout(500)
    lg = [t for t in trips(page) if t["id"] == "legacy2"][0]
    by = {i["id"]: i for i in lg["items"]}
    ok(by["m1"]["category"] == "health" and by["m2"]["category"] == "necessities", "U1 migration: legacy Pain & Sickness item → Health & Wellness; Keys stays")
    ok(by["m3"]["section"] == "Tops" and by["m4"]["section"] == "Bottoms", "U6 migration: legacy 'Clothing' items split into Tops / Bottoms using the outfit plan")

    # ── U2: Laundry mode ──
    open_trip(page, "Lisbon")
    page.get_by_role("button", name="Mark Laundry").click()
    ok(page.get_by_text("Tap clothes that need a wash before you pack them").count() == 1, "U2 laundry banner")
    page.get_by_text("Underwear", exact=True).click()
    page.get_by_text("Socks", exact=True).click()
    page.get_by_role("button", name=re.compile(r"^Done \(2\)")).click()
    ok(page.get_by_role("button", name="Laundry 0/2").count() == 1, "U2 'Laundry 0/2' after marking two items")
    page.get_by_role("button", name=re.compile(r"^Focus \(2\)$")).click()
    page.get_by_text("Needs wash", exact=True).first.wait_for()
    page.get_by_role("button", name="Clean").first.click()
    page.wait_for_timeout(300)
    ok(page.get_by_text(re.compile(r"1 of 1 remaining")).count() == 1, "U2 Focus Laundry: one marked clean, one remaining")
    page.get_by_role("button", name="Exit").click()
    page.get_by_role("button", name="Focus Pack").wait_for()
    li = [i for i in trips(page)[0]["items"] if i.get("needsWash")]
    ok(len(li) == 2 and sum(1 for i in li if i.get("washed")) == 1, "U2 persisted: needsWash on 2 items, washed on 1")
    ok(page.get_by_role("button", name="Laundry 1/2").count() == 1 and page.get_by_text("Clean", exact=True).count() >= 1, "U2 trip view shows Laundry 1/2 and a 'Clean' chip")

    # ── U3: Collapse all / Expand all (sections only) ──
    before = page.evaluate(CAT_ITEMS_JS, "Travel Necessities")
    page.get_by_role("button", name="Collapse").click(); page.wait_for_timeout(200)
    ok(len(before) > 0 and page.evaluate(CAT_ITEMS_JS, "Travel Necessities") == [] and page.evaluate(CAT_OPEN_JS, "Travel Necessities"),
       "U3 Collapse: every section folded, the category itself stays open")
    page.get_by_role("button", name="Expand").click(); page.wait_for_timeout(200)
    ok(len(page.evaluate(CAT_ITEMS_JS, "Travel Necessities")) == len(before), "U3 Expand: sections open again")

    # ── U4: Share as Markdown ──
    page.get_by_role("button", name="Share", exact=True).click()
    page.get_by_role("heading", name="Share list").wait_for()
    md = page.locator("textarea[aria-label='Markdown preview']").input_value()
    open(f"{SHOTS}/lisbon-export.md", "w", encoding="utf-8").write(md)
    laundry_lines = [l for l in md.splitlines() if l.startswith("- [ ] ") and " — " in l and ("needs wash" in l or "clean" in l)]
    ok(md.startswith("# 🏙️ Lisbon") and "## 💊 Health & Wellness" in md and len(laundry_lines) == 2 and "## 🚪 Out the Door" in md,
       f"U4 Markdown preview: title, categories, laundry flags ({laundry_lines}), OTD list" + ("" if md.startswith("# 🏙️ Lisbon") else f" — got {md[:80]!r}"))
    with page.expect_download() as dl:
        page.get_by_role("button", name=re.compile(r"^Download packpal-lisbon-")).click()
    d = dl.value; path = d.path(); content = open(path, encoding="utf-8").read()
    ok(d.suggested_filename.startswith("packpal-lisbon-") and d.suggested_filename.endswith(".md") and content == md, f"U4 download: {d.suggested_filename}, contents match the preview")
    page.locator("button[aria-label='Close']").first.click()

    # ── U5 + U6: brand/colour parsing, fix-it sheet, Tops/Bottoms sections on sync ──
    page.get_by_role("button", name="Build Outfits").click()
    page.get_by_text("Your outfits").wait_for()
    page.locator("button", has_text="Tap to start building this outfit").first.click()
    page.get_by_role("button", name=re.compile(r"^Add new top")).wait_for()
    add_in_current_slot("Cream cashmere top")            # → Bottoms
    add_in_current_slot("Blue Zevelyn jeans")            # → Layer
    page.evaluate("""() => { [...document.querySelectorAll('button')].filter(b=>b.style.height==='10px')[1].click(); }""")  # back to Bottoms
    page.wait_for_timeout(300)
    ok(page.get_by_text("Zevelyn", exact=True).count() == 1, "U5 wardrobe card shows the capitalized brand 'Zevelyn'")
    SWATCH_JS = """(brand) => { const row=[...document.querySelectorAll("[title='Tap to fix the colour or brand']")].find(r=>r.textContent===brand); return row ? getComputedStyle(row.firstElementChild).backgroundColor : null; }"""
    sw = page.evaluate(SWATCH_JS, "Zevelyn")
    ok(sw == "rgb(123, 163, 201)", f"U5 swatch is the blue family ({sw})")
    page.get_by_title("Tap to fix the colour or brand").first.click()
    page.get_by_role("heading", name="Fix details").wait_for()
    page.get_by_role("button", name="Colour Black").click()
    page.get_by_label("Brand").fill("Levi's")
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(300)
    sw2 = page.evaluate(SWATCH_JS, "Levi's")
    meta = json.loads(page.evaluate("localStorage.getItem('pp2_wardrobeMeta') || '{}'"))
    ok(sw2 == "rgb(45, 41, 38)" and meta.get("Blue Zevelyn jeans") == {"color": "black", "brand": "Levi's"}, f"U5 fix-it: swatch black, brand Levi's, stored in wardrobeMeta ({meta})")
    page.get_by_role("button", name="Done").first.click()
    page.get_by_role("button", name=re.compile(r"^Done — sync to packing list")).click()
    page.get_by_role("button", name="Focus Pack").wait_for()
    secs = {(i["section"]) for i in trips(page)[0]["items"] if i["category"] == "outfits"}
    ok(secs == {"Tops", "Bottoms"}, f"U6 synced outfit items land in 'Tops' and 'Bottoms' ({sorted(secs)})")

    # ── U7: Save to template (added item + flag) and the editor toggles ──
    # "Add section" inside Travel Necessities (the first one on the page belongs to Outfits, which the template diff ignores)
    page.locator("span", has_text=re.compile(r"^Travel Necessities$")).locator("xpath=../..").get_by_text("Add section", exact=True).click()
    page.get_by_placeholder("New section name...").fill("Gadgets"); page.get_by_placeholder("New section name...").press("Enter")
    page.wait_for_timeout(200)
    page.get_by_role("button", name="Mark Refills").click()
    page.get_by_text("Advil", exact=True).click()
    page.get_by_role("button", name=re.compile(r"^Done \(1\)")).click()
    page.get_by_role("button", name="Save to template").click()
    page.get_by_role("heading", name="From Lisbon").wait_for()
    ok(page.get_by_text("New item", exact=True).count() == 1 and page.get_by_text("Added here").count() == 1, "U7 diff: the new section's placeholder item shows under 'Added here'")
    ok(page.get_by_text("Advil", exact=True).count() == 1 and page.get_by_text("Flagged here").count() == 1, "U7 diff: Advil's refill flag shows under 'Flagged here'")
    # 1 added (New item) + 3 flagged (Advil refill, Underwear + Socks laundry from U2) = 4 pre-ticked changes
    ok(page.get_by_role("button", name="Apply 4 changes to template").count() == 1, "U7 footer counts the 4 pre-ticked changes (added + flagged; removals stay opt-in)")
    page.get_by_role("button", name="Apply 4 changes to template").click()
    page.get_by_role("heading", name="Template updated").wait_for()
    tpl = json.loads(page.evaluate("localStorage.getItem('pp2_catalogTemplate') || 'null'"))
    tpl_advil = next((i for i in (tpl or {}).get("health", {}).get("Pain & Sickness", []) if i["name"] == "Advil"), None)
    ok(tpl_advil is not None and tpl_advil.get("needsRefill") is True and any(i["name"] == "New item" for i in (tpl or {}).get("necessities", {}).get("Gadgets", [])),
       "U7 template stored: Advil flagged for refill, 'Gadgets' section (with its placeholder) added under Necessities")
    page.get_by_role("button", name="Back to trip").click(); go_home(page)
    create_trip(page, "Porto", ["City Trip"])
    porto = trips(page)[0]
    adv = next(i for i in porto["items"] if i["name"] == "Advil")
    ok(adv["needsRefill"] is True and any(i["section"] == "Gadgets" for i in porto["items"]), "U7 next trip starts with Advil flagged for refill and the Gadgets section")
    go_home(page)
    page.get_by_role("button", name="Packing Template").click()
    ok(page.locator("button[aria-pressed='true'][aria-label='Needs refill before each trip']").count() == 1, "U7 template editor shows the refill toggle pressed on Advil")
    page.locator("button:has(svg.lucide-arrow-left)").first.click(); page.get_by_role("button", name="New Trip").wait_for()

    # ── U8: Arrange mode — drag a section, then an item ──
    open_trip(page, "Porto")
    page.get_by_role("button", name="Arrange", exact=True).click()
    page.get_by_text("Drag the grip to reorder sections").wait_for()
    def sections_of(cat):
        return [s for s in ([sec for sec in dict.fromkeys(i["section"] for i in trips(page)[0]["items"] if i["category"] == cat)])]
    before_secs = sections_of("necessities")
    h1 = page.get_by_label("Drag section " + before_secs[0], exact=True).first
    h2 = page.get_by_label("Drag section " + before_secs[1], exact=True).first
    b1, b2 = h1.bounding_box(), h2.bounding_box()
    page.mouse.move(b1["x"] + b1["width"] / 2, b1["y"] + b1["height"] / 2); page.mouse.down()
    for k in range(1, 11):
        page.mouse.move(b1["x"] + b1["width"] / 2, b1["y"] + (b2["y"] + b2["height"] / 2 + 10 - b1["y"]) * k / 10); page.wait_for_timeout(30)
    page.mouse.up(); page.wait_for_timeout(400)
    after_secs = sections_of("necessities")
    ok(after_secs[0] == before_secs[1] and after_secs[1] == before_secs[0] and len(after_secs) == len(before_secs), f"U8 dragged section '{before_secs[0]}' below '{before_secs[1]}' → persisted order {after_secs[:3]}")
    page.get_by_role("button", name=re.compile(r"^" + re.escape(after_secs[0]) + r"\s")).first.click()   # open the (now first) section
    page.wait_for_timeout(200)
    items_in = [i for i in trips(page)[0]["items"] if i["category"] == "necessities" and i["section"] == after_secs[0]]
    i1 = page.get_by_label("Drag " + items_in[0]["name"], exact=True).first   # names may contain quotes (Driver's License)
    i2 = page.get_by_label("Drag " + items_in[1]["name"], exact=True).first
    c1, c2 = i1.bounding_box(), i2.bounding_box()
    page.mouse.move(c1["x"] + c1["width"] / 2, c1["y"] + c1["height"] / 2); page.mouse.down()
    for k in range(1, 11):
        page.mouse.move(c1["x"] + c1["width"] / 2, c1["y"] + (c2["y"] + c2["height"] / 2 + 6 - c1["y"]) * k / 10); page.wait_for_timeout(30)
    page.mouse.up(); page.wait_for_timeout(400)
    now = [i["name"] for i in trips(page)[0]["items"] if i["category"] == "necessities" and i["section"] == after_secs[0]]
    ok(now[0] == items_in[1]["name"] and now[1] == items_in[0]["name"], f"U8 dragged item '{items_in[0]['name']}' below '{items_in[1]['name']}' → persisted")
    page.get_by_role("button", name="Done", exact=True).first.click()
    page.get_by_role("button", name="Focus Pack").wait_for()
    page.screenshot(path=f"{SHOTS}/10-ux-trip-view.png")

    # ══════════════════════════════════════════════════════════════════════
    # Home Screen batch (2026-09-03): app icon + manifest, reload button, update
    # banner, template editor drag-and-drop + add-ins, past-trip lock.
    # ══════════════════════════════════════════════════════════════════════
    page.evaluate("() => localStorage.clear()")
    page.reload(); page.get_by_role("button", name="New Trip").wait_for()

    # ── P1: icons + manifest are linked and served ──
    r = page.request.get(BASE + "/apple-touch-icon.png"); man = page.request.get(BASE + "/manifest.webmanifest")
    html = page.content()
    ok(r.status == 200 and r.headers.get("content-type", "").startswith("image/png") and len(r.body()) > 1000, "P1 /apple-touch-icon.png is served as a PNG")
    mj = man.json() if man.status == 200 else {}
    ok(man.status == 200 and mj.get("display") == "standalone" and any(i.get("sizes") == "512x512" for i in mj.get("icons", [])), "P1 manifest: standalone display, 512px icon")
    ok('rel="apple-touch-icon"' in html and 'rel="manifest"' in html and 'apple-mobile-web-app-title' in html, "P1 index.html links the touch icon, manifest and app title")
    ok(re.search(r'rel="apple-touch-icon"[^>]*href="/apple-touch-icon\.png\?v=\d+"', html) is not None and 'image/svg+xml' not in html,
       "P1 touch icon URL is cache-busted and there is no SVG favicon for iOS to prefer over it")
    served = {f: page.request.get(BASE + f).status for f in ["/icon-192.png", "/icon-512.png", "/favicon-32.png", "/version.json"]}
    ok(all(v == 200 for v in served.values()), f"P1 favicon / manifest icons / version.json all served ({served})")
    ver = page.request.get(BASE + "/version.json").json()
    ok(page.get_by_role("button", name="Account").click() is None and page.get_by_text(f"Version {ver['version']}").count() == 1, f"P3 Account sheet shows the build version ({ver['version']})")
    ok(page.get_by_role("button", name="Reload app").count() == 2, "P3 'Reload app' in the Account sheet (plus the Home header button)")
    page.mouse.click(10, 10); page.wait_for_timeout(300)   # backdrop closes the sheet
    ok(page.get_by_role("button", name="Reload app").count() == 1, "P3 sheet closed")

    # ── P2: header reload really reloads ──
    page.evaluate("() => { window.__pp_marker = 1; }")
    page.get_by_role("button", name="Reload app").click()
    page.get_by_role("button", name="New Trip").wait_for(); page.wait_for_timeout(300)
    ok(page.evaluate("() => window.__pp_marker") is None, "P2 Home header 'Reload app' reloads the page")

    # ── P4: a newer deploy shows the banner; Reload / Not now ──
    page.route("**/version.json*", lambda route: route.fulfill(status=200, content_type="application/json", body='{"version":"deadbee","builtAt":"2030-01-01T00:00:00.000Z"}'))
    page.reload(); page.get_by_role("button", name="New Trip").wait_for()
    page.get_by_text("A newer version of PackPal is ready.").wait_for(timeout=9000)
    ok(True, "P4 update banner appears once version.json reports a newer build (checked ~4 s after load)")
    page.get_by_role("button", name="Not now").click(); page.wait_for_timeout(200)
    ok(page.get_by_text("A newer version of PackPal is ready.").count() == 0, "P4 'Not now' hides the banner")
    page.evaluate("() => { window.__pp_marker = 1; }")
    page.reload(); page.get_by_text("A newer version of PackPal is ready.").wait_for(timeout=9000)
    page.get_by_role("button", name="Reload", exact=True).click()
    page.get_by_role("button", name="New Trip").wait_for(); page.wait_for_timeout(300)
    ok(page.evaluate("() => window.__pp_marker") is None, "P4 banner's Reload reloads the page")
    page.unroute("**/version.json*")
    page.reload(); page.get_by_role("button", name="New Trip").wait_for(); page.wait_for_timeout(5000)
    ok(page.get_by_text("A newer version of PackPal is ready.").count() == 0, "P4 no banner when the deployed version matches")

    # ── E1 + E2: template editor drag-and-drop (sections, then items) ──
    def drag(handle_from, handle_to, extra=8):
        # Scroll the source grip near the top of the viewport (the editor is long), start the drag,
        # then re-measure the target: sections collapse while one is being dragged, so it moves.
        page.evaluate("el => el.scrollIntoView({ block: 'center' })", handle_from.element_handle()); page.wait_for_timeout(200)
        b1 = handle_from.bounding_box()
        x = b1["x"] + b1["width"] / 2; y0 = b1["y"] + b1["height"] / 2
        page.mouse.move(x, y0); page.mouse.down(); page.mouse.move(x, y0 + 10); page.wait_for_timeout(250)
        b2 = handle_to.bounding_box()
        y1 = b2["y"] + b2["height"] / 2 + extra
        for k in range(1, 11):
            page.mouse.move(x, y0 + 10 + (y1 - y0 - 10) * k / 10); page.wait_for_timeout(25)
        page.mouse.up(); page.wait_for_timeout(300)
    page.get_by_role("button", name="Packing Template").click()
    page.get_by_role("heading", name="Your default items").wait_for()
    drag(page.get_by_label("Drag section Luggage", exact=True), page.get_by_label("Drag section Important Documents", exact=True))
    drag(page.get_by_label("Drag Chase Credit Card", exact=True), page.get_by_label("Drag Keys", exact=True))
    page.get_by_role("button", name="Save template").click(); page.get_by_role("button", name=re.compile(r"Saved")).wait_for()
    tpl = json.loads(page.evaluate("localStorage.getItem('pp2_catalogTemplate') || 'null'"))
    nec = list(tpl["necessities"].keys())
    ok(nec[0] == "Important Documents" and nec[1] == "Luggage", f"E1 editor: dragged Luggage below Important Documents → saved section order {nec[:3]}")
    docs = [i["name"] for i in tpl["necessities"]["Important Documents"]]
    ok(docs.index("Keys") < docs.index("Chase Credit Card") and docs[0] == "Driver's License", f"E2 editor: dragged Chase Credit Card below Keys → {docs[:4]}")

    # ── E3: add-ins tab — edit a ski add-in, add a rain add-in ──
    page.get_by_role("button", name="Add-ins").click()
    page.get_by_role("heading", name="Add-ins").wait_for()
    ok(page.get_by_text("Ski / Snow", exact=True).count() >= 1 and page.get_by_text("Rain expected", exact=True).count() == 1 and page.get_by_text("Freezing", exact=True).count() == 1,
       "E3 add-ins tab lists trip types and weather keys (bands + rain / snow)")
    goggles = page.locator("input[value='Ski Goggles']").first
    goggles.fill("Ski Goggles (Oakley)")
    rain_card = page.locator("span", has_text=re.compile(r"^Rain expected$")).locator("xpath=../..")
    rain_card.get_by_placeholder("New section name…").fill("Rain Gear"); rain_card.get_by_placeholder("New section name…").press("Enter")
    rain_card.get_by_placeholder("Add to Rain Gear…").fill("Umbrella"); rain_card.get_by_placeholder("Add to Rain Gear…").press("Enter")
    page.get_by_role("button", name="Save template").click(); page.get_by_role("button", name=re.compile(r"Saved")).wait_for()
    ad = json.loads(page.evaluate("localStorage.getItem('pp2_addins') || 'null'"))
    ok(ad and ad["weather"]["rain"]["Rain Gear"][0]["name"] == "Umbrella" and any(i["name"] == "Ski Goggles (Oakley)" for i in ad["types"]["ski"]["Ski Accessories"]),
       "E3 add-ins persisted under pp2_addins (ski rename + new rain section)")
    page.locator("button:has(svg.lucide-arrow-left)").first.click(); page.get_by_role("button", name="New Trip").wait_for()
    ok(page.get_by_text("Customized").count() == 1, "E3 Home card reads 'Customized'")
    # a ski trip with rain ticked on the weather step gets both add-ins
    page.get_by_role("button", name="New Trip").click()
    page.get_by_placeholder("e.g. Tokyo, Tulum, 90210...").fill("Whistler"); page.get_by_role("button", name="Continue").click()
    page.get_by_role("button", name="Ski / Snow").click(); page.get_by_role("button", name="Continue").click()
    page.get_by_role("button", name="Continue").click()          # details → weather
    page.get_by_role("button", name="Freezing").click()
    page.get_by_role("button", name="Rain expected").click()
    page.get_by_role("button", name="Continue").click()          # → review
    ok(page.get_by_text(re.compile(r"Freezing · 🌧️ Rain")).count() == 1, "E3 review step lists the band and the ticked condition")
    page.get_by_role("button", name="Generate my list").click(); page.get_by_role("button", name="Focus Pack").wait_for()
    wt = trips(page)[0]
    umb = next((i for i in wt["items"] if i["name"] == "Umbrella"), None)
    ok(wt["conditions"] == ["rain"] and umb and umb["section"] == "Rain Gear" and umb["category"] == "activewear", "E3 generated trip: conditions persisted, rain add-in under Rain Gear (Active & Chill)")
    ok(any(i["name"] == "Ski Goggles (Oakley)" and i["category"] == "activewear" for i in wt["items"]) and not any(i["name"] == "Ski Goggles" for i in wt["items"]), "E3 generated trip: edited ski add-in replaces the built-in one")
    go_home(page)

    # ── L1–L3: trips over for a week+ open read-only ──
    page.evaluate("""() => {
      const ts = JSON.parse(localStorage.getItem('pp2_trips') || '[]');
      const it = (id, n, c, s) => ({ id, name: n, category: c, section: s, packed: false, essential: false, ff: false, freq: 1, needsRefill: false, needsCharge: false });
      ts.push({ id: 'old1', destination: 'Old Rome', tripType: ['city'], days: 3, weather: 'warm', startDate: '2026-01-05', tempRange: 'cool',
        items: [it('o1', 'Passport', 'necessities', 'Important Documents'), it('o2', 'Charger', 'tech', 'Cables')],
        otdItems: [], otdChecked: {}, createdAt: '2025-12-20T00:00:00.000Z', icon: '🏙️' });
      localStorage.setItem('pp2_trips', JSON.stringify(ts));
    }""")
    page.reload(); page.get_by_role("button", name="New Trip").wait_for()
    ok(page.get_by_text("Past trips", exact=True).count() == 1 and page.get_by_text("Ended Jan 7 · 0/2 packed").count() == 1 and page.get_by_text("Your trips", exact=True).count() == 1,
       "L1 Home groups the January trip under 'Past trips' with its end date; current trips stay under 'Your trips'")
    open_trip_locked = lambda: (page.locator("button", has_text="Old Rome").first.click(), page.get_by_text("this list is read-only now").wait_for())
    open_trip_locked()
    ok(page.get_by_text("Ended Jan 7").count() >= 1 and page.get_by_role("button", name="Focus Pack").count() == 0 and page.get_by_role("button", name="Mark Refills").count() == 0
       and page.get_by_role("button", name="Arrange", exact=True).count() == 0 and page.get_by_role("button", name="Share", exact=True).count() == 1
       and page.get_by_role("button", name="Save to template").count() == 1 and page.get_by_text("Add section").count() == 0,
       "L2 locked trip: no Focus Pack / Trip Prep / Arrange / Add section; Share + Save to template remain")
    page.get_by_text("Passport", exact=True).click(); page.wait_for_timeout(300)
    ok(not any(i["packed"] for i in [t for t in trips(page) if t["id"] == "old1"][0]["items"]), "L2 tapping an item on a locked trip does not pack it")
    page.get_by_role("button", name="Unlock").click(); page.wait_for_timeout(200)
    ok(page.get_by_role("button", name="Focus Pack").count() == 1 and page.get_by_text("this list is read-only now").count() == 0, "L3 Unlock restores the editing controls")
    page.get_by_text("Passport", exact=True).click(); page.wait_for_timeout(300)
    ok(any(i["packed"] for i in [t for t in trips(page) if t["id"] == "old1"][0]["items"]), "L3 after Unlock, packing works again")
    page.screenshot(path=f"{SHOTS}/11-past-trip-unlocked.png")
    go_home(page)

    # ── R1–R3: rename a section, rename a category + its emoji, change a trip's emoji ──
    page.evaluate("() => localStorage.clear()"); page.reload(); page.get_by_role("button", name="New Trip").wait_for()
    page.get_by_role("button", name="Packing Template").click(); page.get_by_role("heading", name="Your default items").wait_for()
    sec = page.get_by_label("Section name Luggage", exact=True); sec.fill("Bags"); sec.press("Enter"); page.wait_for_timeout(200)
    ok(page.get_by_label("Section name Bags", exact=True).count() == 1 and page.get_by_label("Drag section Bags", exact=True).count() == 1, "R1 section renamed in place (Luggage → Bags)")
    cat = page.get_by_label("Category name Travel Necessities", exact=True); cat.fill("Essentials"); cat.press("Enter"); page.wait_for_timeout(200)
    page.get_by_label("Change emoji for Essentials", exact=True).click()
    page.get_by_role("dialog", name="Category emoji").wait_for()
    page.get_by_label("Pick 🧭", exact=True).click(); page.wait_for_timeout(200)
    ok(page.get_by_label("Change emoji for Essentials", exact=True).inner_text().strip() == "🧭" and page.get_by_label("Reset Travel Necessities name and emoji", exact=True).count() == 1,
       "R2 category renamed + emoji picked; 'default' reset offered")
    page.get_by_role("button", name="Save template").click(); page.get_by_role("button", name=re.compile(r"Saved")).wait_for()
    tpl = json.loads(page.evaluate("localStorage.getItem('pp2_catalogTemplate') || 'null'")); cm = json.loads(page.evaluate("localStorage.getItem('pp2_categoryMeta') || '{}'"))
    nec = list(tpl["necessities"].keys())
    ok(nec[0] == "Bags" and "Luggage" not in nec and cm == {"necessities": {"label": "Essentials", "icon": "🧭"}}, f"R1/R2 persisted: sections {nec[:2]}, pp2_categoryMeta {cm}")
    page.locator("button:has(svg.lucide-arrow-left)").first.click(); page.get_by_role("button", name="New Trip").wait_for()
    create_trip(page, "Bologna", ["City Trip"])
    bt = trips(page)[0]
    ok(any(i["section"] == "Bags" for i in bt["items"]) and not any(i["section"] == "Luggage" for i in bt["items"]), "R1 new trip uses the renamed section")
    ok(page.get_by_text("Essentials", exact=True).count() >= 1 and page.get_by_text("Travel Necessities", exact=True).count() == 0, "R2 trip view shows the renamed category")
    page.get_by_role("button", name="Share", exact=True).click(); page.get_by_role("heading", name="Share list").wait_for()
    md2 = page.locator("textarea[aria-label='Markdown preview']").input_value()
    ok("## 🧭 Essentials" in md2, "R2 Markdown export uses the renamed category + emoji")
    page.locator("button[aria-label='Close']").first.click()
    page.get_by_role("button", name="Change trip emoji").click(); page.get_by_role("dialog", name="Trip emoji").wait_for()
    page.get_by_label("Emoji", exact=True).fill("🍝"); page.get_by_role("button", name=re.compile(r"^Use ")).click(); page.wait_for_timeout(300)
    ok(trips(page)[0]["icon"] == "🍝" and page.get_by_role("button", name="Change trip emoji").inner_text().strip() == "🍝", "R3 trip emoji changed from the header and persisted")
    go_home(page)
    ok("🍝" in page.locator("button", has_text="Bologna").first.inner_text(), "R3 Home card shows the new trip emoji")

    ok(not errors, f"No JS/page errors during the run ({len(errors)} captured)" + ("" if not errors else ": " + errors[0][:160]))
    print("Network failures (sandbox proxy, external resources only?):", *net, sep="\n  ")
    browser.close()

passed = sum(1 for r in results if r[0]); total = len(results)
print(f"\n{passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
