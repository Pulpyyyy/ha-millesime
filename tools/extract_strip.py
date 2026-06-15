#!/usr/bin/env python3
"""
extract_strip.py — extrait plusieurs profils depuis UNE planche alignant des
bouteilles côte à côte, puis génère le bloc BOTTLE_PROFILES.

Segmente les colonnes (bouteilles) en comptant l'encre sur la seule ZONE CORPS
(5–62 % de hauteur) : les gouttières y sont nettes, alors que les LABELS sous les
bouteilles combleraient les gouttières si on comptait sur toute la hauteur. Chaque
découpe est ensuite passée à bottle_profile.py (qui isole la bande verticale =
bouteille, donc ignore le label).

Usage :
  python tools/extract_strip.py tools/ref/bottles.png \
      --names alsace,bordeaux,bourgogne,champagne,porto,provence,rhone,jura --points 18
"""
import argparse, os, sys
from PIL import Image
import bottle_profile as bp

def _col_ink(mask, W, y0, y1):
    return [sum(1 for y in range(y0, y1) if mask[y][x]) for x in range(W)]

def _segments(colink, W, min_w):
    """Runs de colonnes encrées (>0), séparés par les gouttières (encre nulle)."""
    segs = []; ins = False; s = 0
    for x in range(W):
        on = colink[x] > 0
        if on and not ins:
            ins = True; s = x
        elif not on and ins:
            ins = False
            if x - s >= min_w:
                segs.append((s, x))
    if ins and W - s >= min_w:
        segs.append((s, W))
    return segs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--names", required=True, help="clés séparées par des virgules")
    ap.add_argument("--points", type=int, default=18)
    ap.add_argument("--outdir", default=None)
    ap.add_argument("--pad", type=int, default=4, help="marge px autour de chaque découpe")
    ap.add_argument("--body", default="0.05,0.62", help="bande verticale (frac) pour la segmentation")
    ap.add_argument("--graft", action="store_true", help="régénère un col canonique (si coiffe dessinée)")
    a = ap.parse_args()
    names = [n.strip() for n in a.names.split(",") if n.strip()]

    img = Image.open(a.image)
    mask, W, H = bp._foreground_mask(img)
    y0f, y1f = (float(v) for v in a.body.split(","))
    ink = _col_ink(mask, W, int(y0f * H), int(y1f * H))
    segs = _segments(ink, W, max(8, W // 50))
    if len(segs) != len(names):
        print(f"⚠ {len(segs)} segments détectés pour {len(names)} noms : {segs}\n"
              f"  Ajuste --body ou --names.", file=sys.stderr)

    outdir = a.outdir or (os.path.dirname(a.image) or ".")
    os.makedirs(outdir, exist_ok=True)

    blocks = []
    for (s, e), name in zip(segs, names):
        x0 = max(0, s - a.pad); x1 = min(W, e + a.pad)
        crop = img.crop((x0, 0, x1, H))
        crop.save(os.path.join(outdir, f"{name}.png"))
        m2, w2, h2 = bp._foreground_mask(crop)
        try:
            rows, axis, punt = bp._extract(m2, w2, h2)
            profile, sc, axis, ybot = bp.build_profile(rows, axis, a.points, punt=punt, graft=a.graft)
        except SystemExit as ex:
            print(f"# {name}: ÉCHEC ({ex})", file=sys.stderr); continue
        bp.save_preview(crop, profile, sc, axis, ybot, os.path.join(outdir, f"{name}.profile.png"))
        rmax = max(r for r, _ in profile)
        blocks.append(bp.to_js(name, profile))
        print(f"# {name:10} crop x[{x0}:{x1}] | {len(profile)} pts | rmax {rmax:.3f}", file=sys.stderr)

    print("const BOTTLE_PROFILES = {")
    print("\n".join(blocks))
    print("};")

if __name__ == "__main__":
    main()
