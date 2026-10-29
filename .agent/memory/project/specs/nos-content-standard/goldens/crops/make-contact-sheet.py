#!/usr/bin/env python3
"""Builds the in-situ crop contact sheet under NOS Design ruling (c) and the crops-c verdict (V1, V3, P1 FAIL and retired; PK1 and PK2 are ONE crop), at the PG-1 hero heights, in the in-project Fraunces Light / Karla. Run from the repo root:
python3 .agent/memory/project/specs/nos-content-standard/goldens/crops/make-contact-sheet.py <out_dir under .tmp/sandbox>
Writes contact-sheet.html, crop-proposals.json and the composites into <out_dir>. Mock copy and facts only; no real fact is typed."""
import json, math, os, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS = None
OUT = sys.argv[1].rstrip('/') + '/'
os.makedirs(OUT, exist_ok=True)
SRC = {n: Image.open(f"public/images/orchid-{n}.jpg") for n in ['dark', 'pink', 'yellow']}
P76 = ".tmp/sandbox/nos-content-standard/p76/"  # #76 crops, extracted with `git show feat/nos-pagehero:public/images/nos-hero-<code>.jpg`; they stay live until the .ihero PR
# id: (source, rect, note, object-position x%); the pool is NOS Design's: D1, PK1 (= PK2), PK3, Y1 plus the #76 crops that meet need (>= 2550 wide) at the new height
CROPS = {
 "D1": ("dark", (0, 800, 2600, 2200), "left speckled petals only", 0),
 "PK1": ("pink", (700, 800, 3300, 2100), "top bloom band (PK2 is the same crop for the no-repeat rule)", 50),
 "PK3": ("pink", (0, 3600, 2600, 4900), "bottom-left bloom band", 50),
 "Y1": ("yellow", (0, 700, 2600, 2000), "left red-centred flower", 50),
}
for _c in ("S1b", "S2c", "S3a", "S3b", "S2a", "H4a"):
    _im = Image.open(f"{P76}{_c}.jpg"); SRC[_c] = _im; CROPS[_c] = (_c, (0, 0, _im.width, _im.height), "#76 crop, sharpness judged by eye on this sheet", 50)
ROUTES = [  # path, group, title, crop, reuse-of (cross-group, logged)
 ("/about", "visit", "About the Show", "S3a", None), ("/what-to-expect", "visit", "What to Expect", "PK1", None),
 ("/plan-your-visit", "visit", "Plan your visit", "S1b", None), ("/faq", "visit", "Frequently asked questions", "H4a", None),
 ("/programme", "programme", "Programme", "S3b", None), ("/workshops", "programme", "Workshops & Field Trips", "S2c", None),
 ("/symposium", "programme", "Symposium", "D1", None), ("/wosa-conference", "programme", "WOSA Conference", "PK3", None),
 ("/conferences", "programme", "Conferences", "S2a", None),
 ("/international-guests", "exhibit", "International Guests and Exhibitors", "Y1", None),
 ("/exhibitors", "exhibit", "Exhibitors", "D1", "/symposium (programme)"),
 ("/sa-exhibitors", "exhibit", "South African Exhibitors", "PK1", "/what-to-expect (visit)"),
 ("/vendors", "exhibit", "Vendors", "S1b", "/plan-your-visit (visit)"),
 ("/sponsors", "header", "Sponsors", "PK3", "/wosa-conference (programme)"),
 ("/archive", "header", "Archive", "S3a", "/about (visit)"),
 ("/contact", "header", "Contact", "H4a", "/faq (visit)"),
 ("/privacy", "legal", "Privacy", "S3b", "/programme (programme)"),
 ("/terms", "legal", "Terms", "S2a", "/conferences (programme)"),
 ("/refunds", "legal", "Refunds", "Y1", "/international-guests (exhibit)"),
]
groups = defaultdict(list)
for p, g, t, c, r in ROUTES: groups[g].append(c)
for g, cs in groups.items(): assert len(cs) == len(set(cs)), f"a crop repeats inside group {g}: {cs}"

FD = "app/(marketing)/national-show/og/fonts/"
def font(sz, serif=True):
    return ImageFont.truetype(FD + ("Fraunces-Light.ttf" if serif else "Karla-Bold.ttf"), sz)  # the in-project files; Karla Regular is not vendored, Bold is the nearest
STOPS = [(0, .92), (.28, .78), (.52, .42), (.75, .20), (1, .06)]  # the v4 .ihero scrim, remapped across the photo box
def scrim(t):
    for (a, x), (b, y) in zip(STOPS, STOPS[1:]):
        if t <= b: return x + (y - x) * (t - a) / (b - a)
    return STOPS[-1][1]
BLACK, GOLD, LILAC = (11, 10, 20), (251, 250, 240), (210, 203, 232)
crop_of = lambda cid: SRC[CROPS[cid][0]].crop(CROPS[cid][1])
def cover(im, w, h, px):
    s = max(w / im.width, h / im.height); nw, nh = int(im.width * s + .5), int(im.height * s + .5)
    r = im.resize((nw, nh), Image.LANCZOS); x = int((nw - w) * px / 100); y = (nh - h) // 2
    return r.crop((x, y, x + w, y + h))
def hero(cid, title, W):
    px = CROPS[cid][3]
    if W >= 1024:
        H = 380 if W >= 2000 else 330; bx = int(W * .38); bw = W - bx
        ph = cover(crop_of(cid), bw, H, px)
        m = Image.new("L", (bw, H)); mp = m.load()
        for x in range(bw):
            a = int(255 * scrim(x / (bw - 1)))
            for y in range(H): mp[x, y] = a
        ph = Image.composite(Image.new("RGB", (bw, H), BLACK), ph, m)
        im = Image.new("RGB", (W, H), BLACK); im.paste(ph, (bx, 0)); d = ImageDraw.Draw(im); pad = max(16, int(W * .04))
        d.text((pad, 64), title[:22], font=font(54), fill=GOLD)
        d.text((pad, 140), "Lede in the page's own words, two to three", font=font(17, False), fill=LILAC)
        d.text((pad, 162), "lines long at thirty-four characters.", font=font(17, False), fill=LILAC)
        for i in range(3):
            x = pad + i * 210; d.text((x, 260), "Fact value", font=font(30), fill=GOLD); d.text((x, 300), "label", font=font(15, False), fill=LILAC)
        return im
    ph = cover(crop_of(cid), W, int(W / 2), px); im = Image.new("RGB", (W, 300 + ph.height), BLACK); d = ImageDraw.Draw(im)
    d.text((16, 40), title[:20], font=font(40), fill=GOLD); d.text((16, 110), "Lede in the page's own words.", font=font(15, False), fill=LILAC)
    for i in range(2):
        x = 16 + i * 184; d.text((x, 170), "Fact value", font=font(26), fill=GOLD); d.text((x, 204), "label", font=font(14, False), fill=LILAC)
    im.paste(ph, (0, 300)); return im
def need(cid, vp, dpr):
    w, h = crop_of(cid).size; a = w / h
    if vp >= 1024: return [math.ceil(max(vp * .62, bh * a) * dpr) for bh in (330, 380)]  # photo box is 62% wide; PG-1: hero 330px at 1440 and 380px at 2056
    return [math.ceil(max(vp, vp / 2 * a) * dpr)]  # stacked, full width, 4:3
rows, html = [], ["<!doctype html><meta charset=utf-8><title>NOS hero crops in situ, ruling (c)</title><style>body{font:14px system-ui;background:#fbfaf0;margin:24px;color:#3a3654}table{border-collapse:collapse;margin-bottom:18px}td,th{border:1px solid #dad7c8;padding:4px 8px;text-align:left}figure{margin:0 0 22px}img{max-width:100%;display:block;margin-bottom:6px}.bad{color:#b00020;font-weight:700}</style><h1>NOS hero crops, in situ under ruling (c)</h1><p>Mock composites: the real crop in the real box (38%-100% of the hero at 1024+), the v4 scrim remapped across it, placeholder copy and facts (no real fact is typed), at 1440 and 390; each crop once at 2056. Served = crop native width. Need is shown width-driven and height-driven (hero 460px and a 640px worst case).</p><h2>Crops</h2><table><tr><th>crop</th><th>source</th><th>rect</th><th>size</th><th>object-position x</th><th>note</th><th>need 2056@2 (h460/h640)</th><th>1440@2</th><th>1024@2</th><th>768@2</th><th>390@3</th><th>result</th></tr>"]
for cid, (s, r, note, px) in CROPS.items():
    w, h = crop_of(cid).size; n = {"2056@2": need(cid, 2056, 2), "1440@2": need(cid, 1440, 2), "1024@2": need(cid, 1024, 2), "768@2": need(cid, 768, 2), "390@3": need(cid, 390, 3)}
    ok = all(x <= w for v in n.values() for x in v)
    rows.append(dict(crop=cid, source=f"/images/orchid-{s}.jpg", sourceSize=list(SRC[s].size), rect=list(r), width=w, height=h, aspect=round(w / h, 3), objectPositionX=px, note=note, need=n, passes=ok))
    html.append(f"<tr><td>{cid}</td><td>{s}</td><td>{r}</td><td>{w}x{h}</td><td>{px}%</td><td>{note}</td>" + "".join(f"<td>{'/'.join(map(str, v))}</td>" for v in n.values()) + f"<td class={'' if ok else 'bad'}>{'ok' if ok else 'CLAMPED'}</td></tr>")
html.append("</table><h2>Routes</h2><table><tr><th>route</th><th>group</th><th>crop</th><th>reuse (cross-group, logged)</th></tr>" + "".join(f"<tr><td>{p}</td><td>{g}</td><td>{c}</td><td>{r or 'first use'}</td></tr>" for p, g, t, c, r in ROUTES) + "</table><p>Eight crops for 19 routes: 11 routes reuse a crop from a different nav group (never twice inside one group, asserted by the generator) until Brad supplies photography. /tickets keeps its fan masthead (#76) and media-kit/unsubscribe have no route-table row.</p>")
for p, g, t, c, r in ROUTES:
    html.append(f"<figure><b>{p}</b> ({g}) crop {c}{' (reuse of ' + r + ')' if r else ''}")
    for W in (1440, 390):
        fn = f"{p.strip('/').replace('/', '-')}-{W}.jpg"; hero(c, t, W).save(OUT + fn, quality=88)
        html.append(f"<img src='{fn}' style='width:{int(W * .55) if W > 600 else W}px'>")
    html.append("</figure>")
for c in CROPS:
    fn = f"crop-{c}-2056.jpg"; hero(c, "2056 wide", 2056).save(OUT + fn, quality=88); html.append(f"<figure><b>crop {c} at 2056</b><img src='{fn}' style='width:1000px'></figure>")
open(OUT + "contact-sheet.html", "w").write("".join(html))
json.dump({"basis": "ruling (c): photo box 38%-100% at >=1024 (62% wide), width-driven and height-driven need, stacked 2:1 band below 768 (PG-1), full width", "crops": rows, "routes": [dict(route=p, group=g, crop=c, reuseOf=r) for p, g, t, c, r in ROUTES]}, open(OUT + "crop-proposals.json", "w"), indent=1)
for r in rows: print(r['crop'], r['width'], r['height'], r['aspect'], r['need']['2056@2'], r['passes'])
