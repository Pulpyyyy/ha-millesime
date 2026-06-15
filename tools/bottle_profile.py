#!/usr/bin/env python3
"""
bottle_profile.py — génère un profil [rayon, hauteur] pour BOTTLE_PROFILES
(millesime-card.js) à partir d'une PHOTO de bouteille, 100 % automatiquement.

Principe : la bouteille est suppposée debout (goulot en haut), à peu près centrée,
sur un fond uni (studio) OU fournie en PNG détouré (canal alpha). Le script :
  1. segmente la bouteille (alpha si présent, sinon fond uni détecté aux 4 coins
     + seuil d'Otsu sur la distance couleur) ;
  2. relève, ligne par ligne, l'étendue gauche/droite de la silhouette en partant
     de l'axe (tolère les trous : reflets, étiquette) → demi-rayon r(y) ;
  3. lisse, met à l'échelle (hauteur ≈ 3.72, ratio préservé — convention du fichier) ;
  4. simplifie en ~N points caractéristiques (Ramer–Douglas–Peucker) → épaule,
     col et bague restent nets avec peu de points ;
  5. synthétise la piqûre (cul, invisible de face) et le centre du goulot ;
  6. imprime le tableau JS prêt à coller + écrit une image d'aperçu (contour
     reprojeté sur la photo) pour vérifier la précision.

Usage :
  python tools/bottle_profile.py photo.png --name alsace --points 18
  python tools/bottle_profile.py photo.jpg --flip          # si goulot en bas
  python tools/bottle_profile.py photo.png --out apercu.png

Dépendance : Pillow uniquement.
"""
import argparse, math, sys
from PIL import Image, ImageDraw

# ── Segmentation ────────────────────────────────────────────────────────────
def _otsu(hist):
    total = sum(hist)
    if total == 0:
        return 0
    sum_all = sum(i * h for i, h in enumerate(hist))
    wB = 0; sumB = 0.0; best = 0.0; thr = 0
    for i, h in enumerate(hist):
        wB += h
        if wB == 0:
            continue
        wF = total - wB
        if wF == 0:
            break
        sumB += i * h
        mB = sumB / wB
        mF = (sum_all - sumB) / wF
        var = wB * wF * (mB - mF) ** 2
        if var > best:
            best = var; thr = i
    return thr

def _foreground_mask(img):
    """Retourne (mask 2D bool [y][x], W, H). True = bouteille."""
    W, H = img.size
    # 1) Canal alpha exploitable ?
    if img.mode in ("RGBA", "LA"):
        a = img.getchannel("A").load()
        amin = min(img.getchannel("A").getdata())
        if amin < 200:  # vraie transparence → détourage déjà fait
            return [[a[x, y] > 128 for x in range(W)] for y in range(H)], W, H
    rgb = img.convert("RGB").load()
    # 2) Couleur de fond = médiane des 4 coins (patchs 10×10)
    def corner(cx, cy):
        cols = [rgb[min(W - 1, max(0, cx + dx)), min(H - 1, max(0, cy + dy))]
                for dx in range(10) for dy in range(10)]
        return tuple(sorted(c[k] for c in cols)[len(cols) // 2] for k in range(3))
    corners = [corner(0, 0), corner(W - 10, 0), corner(0, H - 10), corner(W - 10, H - 10)]
    bg = tuple(sorted(c[k] for c in corners)[len(corners) // 2] for k in range(3))
    # distance couleur au fond, histogramme → Otsu
    dist = [[0] * W for _ in range(H)]
    hist = [0] * 442
    for y in range(H):
        row = dist[y]
        for x in range(W):
            r, g, b = rgb[x, y]
            d = int(math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2))
            row[x] = d; hist[d] += 1
    thr = max(18, _otsu(hist))   # plancher anti-bruit
    return [[dist[y][x] > thr for x in range(W)] for y in range(H)], W, H

# ── Relevé du demi-rayon par ligne ──────────────────────────────────────────
# Pour chaque ligne, on prend le bord d'encre le plus à GAUCHE et le plus à DROITE
# = la silhouette extérieure. Marche aussi bien pour une silhouette pleine que pour
# un dessin au TRAIT (bouteille creuse) — c'est le cas des planches de référence.
def _row_minmax(row, W):
    left = -1
    for x in range(W):
        if row[x]:
            left = x; break
    if left < 0:
        return None
    right = left
    for x in range(W - 1, left - 1, -1):
        if row[x]:
            right = x; break
    return left, right

def _extract(mask, W, H):
    raw = []  # (y, left, right, fill)  — fill = taux d'encre entre les bords
    for y in range(H):
        ext = _row_minmax(mask[y], W)
        if ext and ext[1] - ext[0] >= 1:
            l, r = ext
            fill = sum(1 for x in range(l, r + 1) if mask[y][x]) / (r - l + 1)
            raw.append((y, l, r, fill))
    if len(raw) < 10:
        sys.exit("Erreur : silhouette non détectée (premier plan trop petit).")
    # Regroupe les lignes en BANDES verticales (trous tolérés) ; la bouteille est la
    # bande la plus haute → exclut le LABEL sous la bouteille et la ligne de sol.
    gap = max(6, H // 40)
    bands = [[raw[0]]]
    for prev, cur in zip(raw, raw[1:]):
        if cur[0] - prev[0] <= gap:
            bands[-1].append(cur)
        else:
            bands.append([cur])
    band = max(bands, key=len)
    rows = [(y, (r - l) / 2.0, (l + r) / 2.0, fill) for (y, l, r, fill) in band]
    if len(rows) < 10:
        sys.exit("Erreur : silhouette trop courte/instable.")
    axis = sorted(t[2] for t in rows)[len(rows) // 2]   # axe = médiane des centres

    # ── Trace de la PIQÛRE (cul) ──────────────────────────────────────────────
    # Par colonne, l'encre la plus BASSE dans la zone du fond = l'arche dessinée
    # (le dôme qui monte au centre). min/max ne la voit pas (elle est intérieure au
    # contour). On échantillonne quelques rayons de l'axe vers le talon.
    ys = [t[0] for t in rows]
    y_base = max(ys); bh = max(1, y_base - min(ys))
    rad_base = max((t[1] for t in rows if t[0] >= y_base - 3), default=0) or max(t[1] for t in rows)
    ax = int(round(axis)); scan_top = y_base - max(2, int(0.25 * bh))
    def _low(x):
        if x < 0 or x >= W:
            return None
        for y in range(y_base, scan_top - 1, -1):
            if mask[y][x]:
                return y
        return None
    punt = []
    for fr in (0.0, 0.34, 0.62, 0.84, 1.0):
        x = int(round(ax + fr * rad_base))
        cand = [c for c in (_low(x - 1), _low(x), _low(x + 1)) if c is not None]
        if cand:
            punt.append((fr * rad_base, sum(cand) / len(cand)))
    return rows, axis, (punt if len(punt) >= 4 else None)

# ── Lissage + simplification ────────────────────────────────────────────────
def _smooth(vals, win):
    if win < 2:
        return vals[:]
    n = len(vals); out = [0.0] * n
    for i in range(n):
        a = max(0, i - win); b = min(n, i + win + 1)
        out[i] = sum(vals[a:b]) / (b - a)
    return out

def _rdp(pts, eps):
    """Ramer–Douglas–Peucker sur une polyligne [(y,r), ...]."""
    if len(pts) < 3:
        return pts[:]
    y0, r0 = pts[0]; y1, r1 = pts[-1]
    dy, dr = y1 - y0, r1 - r0
    nrm = math.hypot(dy, dr) or 1.0
    dmax = idx = 0
    for i in range(1, len(pts) - 1):
        y, r = pts[i]
        d = abs(dr * (y - y0) - dy * (r - r0)) / nrm
        if d > dmax:
            dmax = d; idx = i
    if dmax > eps:
        left = _rdp(pts[:idx + 1], eps)
        right = _rdp(pts[idx:], eps)
        return left[:-1] + right
    return [pts[0], pts[-1]]

def _simplify_to(pts, target):
    """Ajuste epsilon (dichotomie) pour viser ~target points."""
    rmax = max(r for _, r in pts) or 1.0
    lo, hi = rmax * 0.0008, rmax * 0.25
    best = pts
    for _ in range(28):
        mid = (lo + hi) / 2
        s = _rdp(pts, mid)
        if len(s) > target:
            lo = mid
        else:
            hi = mid; best = s
        if abs(len(s) - target) <= 1:
            best = s; break
    return best

# ── Assemblage du profil au format BOTTLE_PROFILES ──────────────────────────
def build_profile(rows, axis, target_pts, scale_h=3.72, punt=None, graft=False):
    rows.sort(key=lambda t: t[0])              # haut→bas en y_image (haut = goulot)
    # Rogne la COIFFE/capsule (région PLEINE en haut) si présente (cf. _extract).
    lim = max(1, len(rows) // 5)
    i0 = 0
    while i0 < lim and len(rows[i0]) > 3 and rows[i0][3] > 0.6:
        i0 += 1
    rows = rows[i0:]
    y_top_px, y_bot_px = rows[0][0], rows[-1][0]
    s = scale_h / ((y_bot_px - y_top_px) or 1)  # échelle unique (ratio préservé)
    radii = _smooth([t[1] for t in rows], max(1, len(rows) // 90))
    prof = [((y_bot_px - t[0]) * s, r * s) for t, r in zip(rows, radii)]  # (y,r)
    prof.reverse()                              # bas → haut
    rmax = max(r for _, r in prof)

    # ── Cul (piqûre) : tracé réel si dispo, sinon gabarit synthétique ─────────
    # La trace `punt` (r_px, y_image) va de l'apex (centre, r=0) au talon (r=rad).
    # Le talon = encre la plus basse → repère du bas (y=0).
    if punt:
        foot_yimg = max(yi for _, yi in punt)
        foot_yp = (y_bot_px - foot_yimg) * s
        cap = [(r * s, (foot_yimg - yi) * s) for (r, yi) in sorted(punt)]  # (r,y) apex→talon
    else:
        foot_yp = 0.0
        cap = [(0.0, 0.27), (rmax * 0.43, 0.10), (rmax * 0.74, 0.045)]

    # Corps = points STRICTEMENT au-dessus du talon (la base est couverte par le cul,
    # qui fournit le vrai contour ; éviter le doublon min/max → zigzag). Rebasé talon→0.
    body = [(yp - foot_yp, r) for (yp, r) in prof if yp - foot_yp > 0.04 * scale_h]
    if len(body) < 3:
        body = [(0.0, rmax), (scale_h, rmax * 0.3)]
    simp = _simplify_to(body, max(5, target_pts - 4))
    rmax = max(r for _, r in simp)
    ymax = simp[-1][0]

    # ── Col propre greffé (OPTIONNEL, --graft) — seulement si coiffe dessinée ──
    if graft:
        neck_det = min((r for y, r in simp if y > 0.62 * ymax), default=0.28 * rmax)
        neck_r = max(0.20 * rmax, min(0.34 * rmax, neck_det))
        kbase = 0
        for i, (y, r) in enumerate(simp):
            if r >= 0.50 * rmax:
                kbase = i
        y_nb = simp[kbase][0]
        Ln = max(1e-3, ymax - y_nb)
        NECK_TPL = [(0.14, 1.04), (0.24, 1.00), (0.90, 1.00),
                    (0.945, 1.16), (0.985, 1.16), (1.00, 0.95)]
        simp = simp[:kbase + 1] + [(y_nb + f * Ln, neck_r * k) for f, k in NECK_TPL]
        ymax = simp[-1][0]

    # ── Assemblage bas→haut : cul (apex→talon) + corps + centre du goulot ─────
    pts = [(round(r, 3), round(y, 2)) for r, y in cap]
    for y, r in simp:
        pts.append((round(r, 3), round(y, 2)))
    pts.append((0.0, round(ymax, 2)))
    out = []
    for r, y in pts:
        if out and abs(out[-1][1] - y) < 0.012 and abs(out[-1][0] - r) < 0.004:
            continue
        out.append((r, y))
    # Hauteur conventionnelle : rescale à scale_h (rayon ET hauteur ×f → aspect préservé)
    ymx = max(y for _, y in out) or 1.0
    f = scale_h / ymx
    out = [(round(r * f, 3), round(y * f, 2)) for r, y in out]
    foot_ref = (max(yi for _, yi in punt) if punt else y_bot_px)
    return out, s * f, axis, foot_ref          # échelle/repère pour l'aperçu

# ── Aperçu ──────────────────────────────────────────────────────────────────
def save_preview(img, profile, s, axis, y_bot_px, path):
    im = img.convert("RGB").copy()
    # assombrir pour faire ressortir le tracé
    im = Image.blend(im, Image.new("RGB", im.size, (0, 0, 0)), 0.45)
    d = ImageDraw.Draw(im)
    def to_px(r, y):
        return (axis + r / s, y_bot_px - y / s)
    left = [to_px(-r, y) for r, y in profile]
    right = [to_px(r, y) for r, y in profile]
    poly = left + right[::-1]
    d.line(poly + [poly[0]], fill=(255, 60, 60), width=2)
    for r, y in profile:
        x, yy = to_px(r, y)
        d.ellipse([x - 3, yy - 3, x + 3, yy + 3], fill=(80, 200, 255))
        x2, yy2 = to_px(-r, y)
        d.ellipse([x2 - 3, yy2 - 3, x2 + 3, yy2 + 3], fill=(80, 200, 255))
    d.line([(axis, 0), (axis, im.size[1])], fill=(120, 120, 120), width=1)
    im.save(path)

# ── Format de sortie JS ─────────────────────────────────────────────────────
def to_js(name, profile):
    chunks = []
    line = "    "
    for i, (r, y) in enumerate(profile):
        line += f"[{r:g}, {y:.2f}], "        # rayon compact, hauteur sur 2 décimales
        if (i + 1) % 6 == 0:
            chunks.append(line.rstrip()); line = "    "
    if line.strip():
        chunks.append(line.rstrip())
    body = "\n".join(chunks)
    return f"  {name}: [\n{body}\n  ],"

def main():
    ap = argparse.ArgumentParser(description="Génère un profil BOTTLE_PROFILES depuis une photo.")
    ap.add_argument("image")
    ap.add_argument("--name", default="custom", help="clé du profil (ex. alsace)")
    ap.add_argument("--points", type=int, default=18, help="nb de points visé (def. 18)")
    ap.add_argument("--flip", action="store_true", help="photo goulot en bas")
    ap.add_argument("--graft", action="store_true", help="régénère un col canonique (si coiffe dessinée)")
    ap.add_argument("--out", default=None, help="chemin de l'aperçu PNG (def. <image>.profile.png)")
    a = ap.parse_args()

    img = Image.open(a.image)
    if a.flip:
        img = img.transpose(Image.ROTATE_180)
    mask, W, H = _foreground_mask(img)
    rows, axis, punt = _extract(mask, W, H)
    profile, s, axis, y_bot_px = build_profile(rows, axis, a.points, punt=punt, graft=a.graft)

    print(to_js(a.name, profile))
    print(f"\n# {len(profile)} points | rayon max {max(r for r,_ in profile):.3f} "
          f"| hauteur {max(y for _,y in profile):.2f}", file=sys.stderr)

    out = a.out or (a.image.rsplit(".", 1)[0] + ".profile.png")
    save_preview(img, profile, s, axis, y_bot_px, out)
    print(f"# aperçu → {out}", file=sys.stderr)

if __name__ == "__main__":
    main()
