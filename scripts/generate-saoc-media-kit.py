#!/usr/bin/env python3
"""
SAOC media kit generator (mission media-kit-complete, F1).

Builds every download the /media-kit page offers, plus the manifest the page reads:

  - 9 transparent marks (1254x1254)          saoc/mark/
  - 16 ground-filled chips (512x512)          saoc/chip/
  - 32 lockups (horizontal/vertical x 8 renditions x on-light/on-dark)   saoc/lockup/
  - 5 SAOC zips and the National Show zip     saoc/zip/, nos/
  - the approved National Show 2027 PNGs and the Disa graminifolia emblem   nos/
  - 4 usage illustrations (public/images/media-kit/usage-*.png, not downloads)
  - lib/data/media-kit-manifest.json

Source system: the council's "SA Orchid Council Logo Presentation.pdf" (read only; nothing is ever
written under branding/). The emblem is read from public/images/Eulophia-speciosa-emblem.png so a
clean checkout builds. Recolouring reproduces the approved duotone mapping of
scripts/generate-saoc-emblem-web-assets.py (luminance weights 0.3/0.59/0.11, contrast stretch
1.35 / -0.2, per-channel lerp from the shadow colour to the highlight colour) with the shadow and
highlight colours taken from the presentation. The wordmark and tagline are typeset by
scripts/render-media-kit-text.mjs (Crimson Pro / JetBrains Mono, per presentation p.10).

The output is deterministic: sorted traversal, fixed zip timestamps, ZIP_STORED, no PNG metadata.

Usage: python3 scripts/generate-saoc-media-kit.py [--out DIR]
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
EMBLEM_SOURCE = REPO / "public/images/Eulophia-speciosa-emblem.png"
NOS_LOGO_DIR = REPO / "branding/National Show 2027/Logo"
NOS_EMBLEM_DIR = REPO / "branding/National Show 2027/emblem"
TEXT_RENDERER = REPO / "scripts/render-media-kit-text.mjs"
DEFAULT_OUT = REPO / "public/downloads/media-kit"
DEFAULT_MANIFEST = REPO / "lib/data/media-kit-manifest.json"
DEFAULT_USAGE_DIR = REPO / "public/images/media-kit"
SANDBOX_ROOT = REPO / ".tmp/sandbox"
HREF_PREFIX = "/downloads/media-kit/"

# Approved recolour constants (generate-saoc-emblem-web-assets.py: LUMINANCE_*, CONTRAST_*).
LUMINANCE_WEIGHTS = np.array([0.3, 0.59, 0.11])
CONTRAST_SCALE, CONTRAST_OFFSET = 1.35, -0.2
CONTENT_ALPHA_THRESHOLD = 10  # source "dust" alpha sits at or below this

# Presentation p.7 inks and their ground tints (light half of each swatch bar).
INKS = {
    "indigo": ("01 Indigo", "#232A5E", "#ECEDF4"),
    "prussian": ("02 Prussian", "#1D3557", "#E9F0F4"),
    "viridian": ("03 Viridian", "#14503F", "#E8F1EC"),
    "violet": ("04 Violet", "#3A2560", "#F0ECF5"),
    "teal": ("05 Teal", "#123F4A", "#E7F0F1"),
    "plum": ("06 Plum", "#4A1F45", "#F1ECF1"),
}
# Presentation p.3-4 greyscale marks: (shadow, highlight). The sampled tones (#212121 / #E3E2DF on
# light, #4A4C47 / #F5F5F5 reversed on sage) are reduced to the neutral grey of equal luminance so
# the greyscale files carry no hue at all.
GREYSCALE = ("#212121", "#E2E2E2")
GREYSCALE_REVERSED = ("#4B4B4B", "#F5F5F5")
PARCHMENT, SAGE, INK_TEXT, MUTED_TEXT = "#F4F3EC", "#384138", "#171917", "#636660"
TAGLINE_ON_DARK = "rgba(244,243,236,0.65)"  # presentation p.10: tagline 65% parchment
WORDMARK = "South African Orchid Council"
TAGLINE = "MAKING A DIFFERENCE SINCE 1968"

MARK_SIZE, CHIP_SIZE, CHIP_MARK_RATIO = 1254, 512, 1.5
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)

# Presentation p.10 wordmark specification, in presentation px. Horizontal sizes follow the emblem
# height h: wordmark max(19, 0.48h), tagline max(9.5, 0.195h). Vertical sizes follow the wordmark.
H_REF_EMBLEM_PX, H_EXPORT_SCALE, H_GAP_PX = 52, 10, 14
H_WORDMARK_TRACK, H_TAGLINE_TRACK = 0.002, 0.22
V_REF_WORDMARK_PX, V_EXPORT_SCALE, V_GAP_PX, V_TAG_GAP_PX = 26, 6, 16, 8
V_WORDMARK_TRACK, V_TAGLINE_TRACK = 0.005, 0.22
V_TAGLINE_WIDTH_RATIO = 0.96  # tagline width / wordmark width, measured on presentation p.12
WORDMARK_LINE, TAGLINE_LINE = 1.02, 1.3  # line-height multiples
TAGLINE_GAP_RATIO = 0.196  # tagline gap below the wordmark / wordmark size (export harness 9:46)
# The inventory's vertical aspect rule (height/width >= 0.9) exceeds what the spec's geometry gives
# for the full-name wordmark, so the vertical lockup carries a transparent margin top and bottom.
V_MARGIN_RATIO = 0.06  # per side, as a fraction of the lockup width

# Usage illustrations: the Don'ts, magnitudes measured from the presentation (p.11-12, 144dpi).
DONT_H_EMBLEM_SCALE = 0.713  # emblem 82px vs 115px
DONT_H_GAP_FACTOR = 2.86  # emblem-to-wordmark gap 60px vs 21px
DONT_H_EXTRA_TRACK = 0.077  # wordmark 302px vs 259px over 16 letter gaps at 35px
DONT_V_EMBLEM_SCALE = 0.617  # emblem 116px vs 188px tall
USAGE_MARGIN_RATIO = 0.08
USAGE_WIDTH_PX = 1400


def hex_rgb(value: str) -> np.ndarray:
    return np.array([int(value[i : i + 2], 16) for i in (1, 3, 5)], dtype=float)


def recolour(rgba: np.ndarray, lo_hex: str, hi_hex: str) -> Image.Image:
    """Duotone from lo (shadows) to hi (highlights), driven by each pixel's luminance after the
    approved contrast stretch. Alpha is untouched; fully transparent pixels become (0, 0, 0, 0)."""
    lo, hi = hex_rgb(lo_hex), hex_rgb(hi_hex)
    lum = (rgba[..., :3].astype(float) @ LUMINANCE_WEIGHTS) / 255
    stretched = np.clip(CONTRAST_SCALE * lum + CONTRAST_OFFSET, 0.0, 1.0)[..., None]
    out = np.empty_like(rgba)
    out[..., :3] = np.rint(lo + (hi - lo) * stretched).astype(np.uint8)
    out[..., 3] = rgba[..., 3]
    out[rgba[..., 3] == 0] = 0
    return Image.fromarray(out, "RGBA")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")


def scale_rgba(image: Image.Image, width: int, height: int) -> Image.Image:
    """Lanczos resize; Pillow premultiplies RGBA internally, so edges carry no dark fringe."""
    return image.resize((width, height), Image.LANCZOS)


class Emblems:
    """The source emblem and its recoloured variants, as full 1254x1254 images."""

    def __init__(self) -> None:
        source = Image.open(EMBLEM_SOURCE).convert("RGBA")
        if source.size != (MARK_SIZE, MARK_SIZE):
            raise ValueError(f"{EMBLEM_SOURCE} is {source.size}, expected {MARK_SIZE}x{MARK_SIZE}")
        alpha = np.array(source.split()[3])
        ys, xs = np.where(alpha > CONTENT_ALPHA_THRESHOLD)
        self.bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        array = np.array(source)
        self.variants: dict[str, Image.Image] = {
            "colour": source,
            "greyscale": recolour(array, *GREYSCALE),
            "greyscale-reversed": recolour(array, *GREYSCALE_REVERSED),
        }
        for ink, (_, ink_hex, tint_hex) in INKS.items():
            self.variants[f"duotone-{ink}"] = recolour(array, ink_hex, tint_hex)

    def trimmed(self, rendition: str) -> Image.Image:
        return self.variants[rendition].crop(self.bbox)


def lockup_renditions() -> list[str]:
    return ["colour", "greyscale"] + [f"duotone-{ink}" for ink in INKS]


def mark_for_ground(rendition: str, ground: str) -> str:
    """The emblem variant used on a ground: greyscale reverses on dark."""
    return "greyscale-reversed" if rendition == "greyscale" and ground == "dark" else rendition


def make_marks(emblems: Emblems, out: Path) -> list[Path]:
    paths = []
    for rendition in ["colour", "greyscale", "greyscale-reversed"] + [f"duotone-{i}" for i in INKS]:
        path = out / f"saoc/mark/saoc-mark-{rendition}.png"
        if rendition == "colour":
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(EMBLEM_SOURCE, path)
        else:
            save_png(emblems.variants[rendition], path)
        paths.append(path)
    return paths


def make_chips(emblems: Emblems, out: Path) -> list[Path]:
    paths = []
    chip_mark_width = round(CHIP_SIZE / CHIP_MARK_RATIO)
    plan = [("light", PARCHMENT, ["colour", "greyscale"]), ("dark", SAGE, ["colour", "greyscale-reversed"])]
    for ground, ground_hex, base in plan:
        for rendition in base + [f"duotone-{i}" for i in INKS]:
            trimmed = emblems.trimmed(rendition)
            height = round(chip_mark_width * trimmed.height / trimmed.width)
            mark = scale_rgba(trimmed, chip_mark_width, height)
            chip = Image.new("RGBA", (CHIP_SIZE, CHIP_SIZE), (*hex_rgb(ground_hex).astype(int), 255))
            chip.alpha_composite(mark, ((CHIP_SIZE - chip_mark_width) // 2, (CHIP_SIZE - height) // 2))
            path = out / f"saoc/chip/saoc-mark-{rendition}-on-{ground}.png"
            save_png(chip, path)
            paths.append(path)
    return paths


def run_text_renderer(mode: str, runs: list[dict], out_dir: Path) -> dict[str, dict]:
    job = out_dir / f"{mode}-job.json"
    job.write_text(json.dumps({"mode": mode, "outDir": str(out_dir), "runs": runs}))
    result = subprocess.run(["node", str(TEXT_RENDERER), str(job)], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"text renderer failed ({mode}): {result.stderr[-800:]}")
    return {item["id"]: item for item in json.loads(result.stdout)}


def text_run(run_id: str, text: str, family: str, weight: int, size: float, track: float,
             line: float, color: str) -> dict:
    return {"id": run_id, "text": text, "family": family, "weight": weight, "sizePx": round(size, 2),
            "letterSpacingPx": round(track * size, 3), "lineHeight": line, "color": color}


class TypeSizes:
    """Typeset sizes for both orientations, from the presentation's wordmark specification."""

    def __init__(self, scratch: Path) -> None:
        h_ref_word = max(19.0, 0.48 * H_REF_EMBLEM_PX)
        h_ref_tag = max(9.5, 0.195 * H_REF_EMBLEM_PX)
        self.h_emblem_height = H_REF_EMBLEM_PX * H_EXPORT_SCALE
        self.h_word, self.h_tag = h_ref_word * H_EXPORT_SCALE, h_ref_tag * H_EXPORT_SCALE
        self.h_gap = H_GAP_PX * H_EXPORT_SCALE
        self.v_word = V_REF_WORDMARK_PX * V_EXPORT_SCALE
        self.v_gap, self.v_tag_gap = V_GAP_PX * V_EXPORT_SCALE, V_TAG_GAP_PX * V_EXPORT_SCALE
        probe = run_text_renderer("measure", [
            text_run("word", WORDMARK, "Crimson Pro", 600, self.v_word, V_WORDMARK_TRACK,
                     WORDMARK_LINE, INK_TEXT),
            text_run("tag", TAGLINE, "JetBrains Mono", 400, 100, V_TAGLINE_TRACK,
                     TAGLINE_LINE, INK_TEXT),
        ], scratch)
        self.v_word_width = probe["word"]["width"]
        tag_width_per_px = probe["tag"]["width"] / 100
        self.v_tag = V_TAGLINE_WIDTH_RATIO * self.v_word_width / tag_width_per_px


def render_text_layers(sizes: TypeSizes, scratch: Path) -> dict[str, Image.Image]:
    """Transparent single-line layers: {h,v}-{light,dark}-{word,tag} plus the Don't wordmark."""
    runs = []
    grounds = {"light": (INK_TEXT, MUTED_TEXT), "dark": (PARCHMENT, TAGLINE_ON_DARK)}
    for ground, (word_colour, tag_colour) in grounds.items():
        runs.append(text_run(f"h-{ground}-word", WORDMARK, "Crimson Pro", 600, sizes.h_word,
                             H_WORDMARK_TRACK, WORDMARK_LINE, word_colour))
        runs.append(text_run(f"h-{ground}-tag", TAGLINE, "JetBrains Mono", 400, sizes.h_tag,
                             H_TAGLINE_TRACK, TAGLINE_LINE, tag_colour))
        runs.append(text_run(f"v-{ground}-word", WORDMARK, "Crimson Pro", 600, sizes.v_word,
                             V_WORDMARK_TRACK, WORDMARK_LINE, word_colour))
        runs.append(text_run(f"v-{ground}-tag", TAGLINE, "JetBrains Mono", 400, sizes.v_tag,
                             V_TAGLINE_TRACK, TAGLINE_LINE, tag_colour))
    runs.append(text_run("h-dont-word", WORDMARK, "Crimson Pro", 600, sizes.h_word,
                         H_WORDMARK_TRACK + DONT_H_EXTRA_TRACK, WORDMARK_LINE, INK_TEXT))
    run_text_renderer("render", runs, scratch)
    return {r["id"]: Image.open(scratch / f"{r['id']}.png").convert("RGBA") for r in runs}


def compose_horizontal(emblem: Image.Image, word: Image.Image, tag: Image.Image, sizes: TypeSizes,
                       emblem_scale: float = 1.0, gap_factor: float = 1.0) -> Image.Image:
    """Emblem left, wordmark and tagline right, the text block vertically centred on the emblem."""
    full_height = round(sizes.h_emblem_height)
    emb_h = round(full_height * emblem_scale)
    emb_w = round(emb_h * emblem.width / emblem.height)
    gap = round(sizes.h_gap * gap_factor)
    tag_gap = round(TAGLINE_GAP_RATIO * sizes.h_word)
    text_h = word.height + tag_gap + tag.height
    canvas = Image.new("RGBA", (emb_w + gap + max(word.width, tag.width), max(full_height, text_h)))
    canvas.alpha_composite(scale_rgba(emblem, emb_w, emb_h), (0, (canvas.height - emb_h) // 2))
    top = (canvas.height - text_h) // 2
    canvas.alpha_composite(word, (emb_w + gap, top))
    canvas.alpha_composite(tag, (emb_w + gap, top + word.height + tag_gap))
    return canvas


def compose_vertical(emblem: Image.Image, word: Image.Image, tag: Image.Image, sizes: TypeSizes,
                     emblem_scale: float = 1.0, margin: bool = True) -> Image.Image:
    """Emblem above the centred wordmark and tagline; emblem width equals the wordmark's width."""
    width = word.width
    emb_w = round(width * emblem_scale)
    emb_h = round(emb_w * emblem.height / emblem.width)
    full_h = round(width * emblem.height / emblem.width)
    gap, tag_gap = round(sizes.v_gap), round(sizes.v_tag_gap)
    margin_px = round(V_MARGIN_RATIO * width) if margin else 0
    height = margin_px + full_h + gap + word.height + tag_gap + tag.height + margin_px
    canvas = Image.new("RGBA", (width, height))
    y = margin_px + (full_h - emb_h)
    canvas.alpha_composite(scale_rgba(emblem, emb_w, emb_h), ((width - emb_w) // 2, y))
    y = margin_px + full_h + gap
    canvas.alpha_composite(word, (0, y))
    canvas.alpha_composite(tag, ((width - tag.width) // 2, y + word.height + tag_gap))
    return canvas


def make_lockups(emblems: Emblems, layers: dict[str, Image.Image], sizes: TypeSizes,
                 out: Path) -> list[Path]:
    paths = []
    for orient in ("horizontal", "vertical"):
        for ground in ("light", "dark"):
            for rendition in lockup_renditions():
                emblem = emblems.trimmed(mark_for_ground(rendition, ground))
                key = f"{orient[0]}-{ground}"
                if orient == "horizontal":
                    image = compose_horizontal(emblem, layers[f"{key}-word"], layers[f"{key}-tag"], sizes)
                else:
                    image = compose_vertical(emblem, layers[f"{key}-word"], layers[f"{key}-tag"], sizes)
                name = f"saoc-lockup-south-african-orchid-council-{orient}-{rendition}-on-{ground}.png"
                paths.append(out / "saoc/lockup" / name)
                save_png(image, paths[-1])
    return paths


def usage_frame(content: Image.Image, canvas_size: tuple[int, int]) -> Image.Image:
    """The content centred on a parchment ground, then reduced to a web-sized illustration."""
    frame = Image.new("RGBA", canvas_size, (*hex_rgb(PARCHMENT).astype(int), 255))
    frame.alpha_composite(content, ((canvas_size[0] - content.width) // 2,
                                    (canvas_size[1] - content.height) // 2))
    height = round(USAGE_WIDTH_PX * canvas_size[1] / canvas_size[0])
    return scale_rgba(frame, USAGE_WIDTH_PX, height)


def make_usage(emblems: Emblems, layers: dict[str, Image.Image], sizes: TypeSizes,
               usage_dir: Path) -> list[Path]:
    """Presentation p.11-12: horizontal duotone Indigo and vertical duotone Viridian, Do and Don't."""
    h_emblem, v_emblem = emblems.trimmed("duotone-indigo"), emblems.trimmed("duotone-viridian")
    h_word, h_tag = layers["h-light-word"], layers["h-light-tag"]
    v_word, v_tag = layers["v-light-word"], layers["v-light-tag"]
    h_do = compose_horizontal(h_emblem, h_word, h_tag, sizes)
    h_dont = compose_horizontal(h_emblem, layers["h-dont-word"], h_tag, sizes,
                                DONT_H_EMBLEM_SCALE, DONT_H_GAP_FACTOR)
    v_do = compose_vertical(v_emblem, v_word, v_tag, sizes, margin=False)
    v_dont = compose_vertical(v_emblem, v_word, v_tag, sizes, DONT_V_EMBLEM_SCALE, margin=False)
    pairs = {"horizontal": (h_do, h_dont), "vertical": (v_do, v_dont)}
    paths = []
    for orient, images in pairs.items():
        pad = round(USAGE_MARGIN_RATIO * max(img.width for img in images))
        size = (max(img.width for img in images) + 2 * pad, max(img.height for img in images) + 2 * pad)
        for kind, image in zip(("do", "dont"), images):
            path = usage_dir / f"usage-{kind}-{orient}.png"
            save_png(usage_frame(image, size), path)
            paths.append(path)
    return paths


def make_nos(out: Path) -> tuple[list[Path], list[Path]]:
    logos, emblem = [], []
    for source in sorted(NOS_LOGO_DIR.glob("NOS-2027-logo-*.png")):
        target = out / "nos" / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        logos.append(target)
    for suffix in ("svg", "png"):
        target = out / "nos" / f"nos-disa-graminifolia-emblem.{suffix}"
        shutil.copyfile(NOS_EMBLEM_DIR / f"Disa graminifolia.{suffix}", target)
        emblem.append(target)
    return logos, emblem


def write_zip(path: Path, members: list[Path]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as archive:
        for member in members:
            info = zipfile.ZipInfo(member.name, ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o644 << 16
            archive.writestr(info, member.read_bytes())
    return path


def make_zips(out: Path, marks: list[Path], chips: list[Path], lockups: list[Path],
              nos_logos: list[Path]) -> dict[str, Path]:
    def lockups_with(token: str) -> list[Path]:
        return [p for p in lockups if f"-{token}-on-" in p.name]

    sections = {
        "everything": marks + chips + lockups,
        "full-colour": lockups_with("colour"),
        "greyscale": lockups_with("greyscale"),
        "duotone": [p for p in lockups if "-duotone-" in p.name],
        "mark-only": marks + chips,
    }
    zips = {name: write_zip(out / f"saoc/zip/saoc-{name}.zip", members)
            for name, members in sections.items()}
    zips["national-show"] = write_zip(out / "nos/nos-all-logos.zip", nos_logos)
    return zips


def png_size(path: Path) -> tuple[int | None, int | None]:
    if path.suffix != ".png":
        return None, None
    with Image.open(path) as image:
        return image.size


def rendition_fields(rendition: str) -> dict:
    if rendition.startswith("duotone-"):
        return {"rendition_label": "Duotone", "ink_label": INKS[rendition[8:]][0]}
    return {"rendition_label": "Greyscale" if rendition.startswith("greyscale") else "Full colour"}


def section_for(rendition: str) -> str:
    if rendition.startswith("duotone-"):
        return "duotone"
    return "greyscale" if rendition.startswith("greyscale") else "full-colour"


def describe_saoc(path: Path) -> dict:
    stem = path.stem
    if stem.startswith("saoc-mark-"):
        body = stem[len("saoc-mark-"):]
        ground = next((g for g in ("-on-light", "-on-dark") if body.endswith(g)), None)
        rendition = body[: -len(ground)] if ground else body
        fields = rendition_fields(rendition)
        mark = {"-on-light": "Mark only — light chip", "-on-dark": "Mark only — dark chip"}.get(
            ground or "", "Mark only")
        fields.update(mark_label=mark, section="mark-only")
        reversed_note = " reversed" if rendition == "greyscale-reversed" else ""
        ink = f" {fields['ink_label']}" if "ink_label" in fields else ""
        fields["label"] = f"{fields['rendition_label']}{reversed_note}{ink} — {mark}"
        return fields
    orient = "horizontal" if "-horizontal-" in stem else "vertical"
    ground = stem.rsplit("-", 1)[1]
    rendition = stem.split(f"{orient}-")[1].rsplit("-on-", 1)[0]
    lockup = (f"{orient.capitalize()} — {'dark type on light' if ground == 'light' else 'light type on dark'}")
    fields = rendition_fields(rendition)
    ink = f" {fields['ink_label']}" if "ink_label" in fields else ""
    fields.update(lockup_label=lockup, wordmark_label=WORDMARK, orientation_label=orient.capitalize(),
                  section=section_for(rendition),
                  label=f"{fields['rendition_label']}{ink} — {lockup}")
    return fields


NOS_VARIANTS = {
    "full-colour": "Full colour", "full-colour-reversed": "Full colour reversed",
    "grayscale": "Grayscale", "ink-olive": "Ink olive", "ink-purple": "Ink purple",
    "ink-violet": "Ink violet", "reversed-gold": "Reversed gold", "reversed-white": "Reversed white",
}


def describe_nos(path: Path) -> dict:
    if path.name.startswith("nos-disa"):
        return {"section": "national-show", "variant_label": "Disa graminifolia emblem",
                "label": "Disa graminifolia emblem"}
    body = path.stem[len("NOS-2027-logo-"):]
    variant, orient = body.rsplit("-", 1)
    return {"section": "national-show", "variant_label": NOS_VARIANTS[variant],
            "orientation_label": orient.capitalize(),
            "label": f"{NOS_VARIANTS[variant]} — {orient.capitalize()}"}


def manifest_entry(out: Path, path: Path, extra: dict) -> dict:
    width, height = png_size(path)
    relative = path.relative_to(out).as_posix()
    return {"path": relative, "href": HREF_PREFIX + relative, "format": path.suffix[1:].upper(),
            "width": width, "height": height, "bytes": path.stat().st_size, **extra}


def build_manifest(out: Path, groups: dict[str, list[Path]], zips: dict[str, Path]) -> list[dict]:
    items = []
    for path in groups["saoc"]:
        items.append(manifest_entry(out, path, describe_saoc(path)))
    for path in groups["nos"]:
        items.append(manifest_entry(out, path, describe_nos(path)))
    for name, path in zips.items():
        everything = name == "everything"
        bundle = "Download everything (zip)" if everything else "Download this section (zip)"
        items.append(manifest_entry(out, path, {
            "section": "bundles" if everything else name, "label": bundle, "bundle_label": bundle,
            "bundle_for": name}))
    return items


def usage_entries(usage_paths: list[Path]) -> list[dict]:
    """The usage illustrations are page images, not downloads: the manifest records their size."""
    entries = []
    for path in sorted(usage_paths):
        width, height = png_size(path)
        entries.append({"file": path.name, "src": f"/images/media-kit/{path.name}",
                        "width": width, "height": height})
    return entries


def generate(out: Path, manifest_path: Path, usage_dir: Path) -> None:
    SANDBOX_ROOT.mkdir(parents=True, exist_ok=True)
    emblems = Emblems()
    marks = make_marks(emblems, out)
    chips = make_chips(emblems, out)
    with tempfile.TemporaryDirectory(dir=SANDBOX_ROOT, prefix="media-kit-text-") as scratch_name:
        scratch = Path(scratch_name)
        sizes = TypeSizes(scratch)
        layers = render_text_layers(sizes, scratch)
        lockups = make_lockups(emblems, layers, sizes, out)
        usage = make_usage(emblems, layers, sizes, usage_dir)
    nos_logos, nos_emblem = make_nos(out)
    zips = make_zips(out, marks, chips, lockups, nos_logos)
    groups = {"saoc": marks + chips + lockups, "nos": nos_logos + nos_emblem}
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"items": build_manifest(out, groups, zips), "usage": usage_entries(usage)}
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the SAOC media kit downloads and manifest.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out = args.out.resolve()
    if out == DEFAULT_OUT.resolve():
        manifest_path, usage_dir = DEFAULT_MANIFEST, DEFAULT_USAGE_DIR
    else:
        manifest_path, usage_dir = out / "_aux/manifest.json", out / "_aux/usage"
    generate(out, manifest_path, usage_dir)
    print(f"wrote media kit to {out}; manifest {manifest_path}; usage {usage_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
