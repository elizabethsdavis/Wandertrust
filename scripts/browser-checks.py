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

    ok(not errors, f"No JS/page errors during the run ({len(errors)} captured)" + ("" if not errors else ": " + errors[0][:160]))
    print("Network failures (sandbox proxy, external resources only?):", *net, sep="\n  ")
    browser.close()

passed = sum(1 for r in results if r[0]); total = len(results)
print(f"\n{passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
