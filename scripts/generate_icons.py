"""
Generates Parsely's app icons: a simple two-leaf sprout mark on a solid
brand-green field, matching the 🌿 used throughout the app's own UI.

Draws everything at 4x scale and downsamples with LANCZOS for clean
anti-aliased edges, since PIL's primitive drawing has none on its own.

Outputs (all in public/icons/):
  icon-512.png            full-bleed, for the manifest's "any" purpose
  icon-192.png            same mark, smaller
  icon-512-maskable.png   mark inset to the ~80% safe zone, for Android's
                          "maskable" purpose (OS may crop to a circle/squircle)
  apple-touch-icon.png    180x180, iOS home screen
  favicon-32.png          browser tab
"""

from PIL import Image, ImageDraw
import math
import os

SCALE = 4
BASE = 512 * SCALE

BG = (21, 128, 61, 255)       # brand-700, same deep green used across the app
MARK = (240, 253, 244, 255)   # brand-50, near-white with a warm green cast

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)


def lerp(a, b, t):
    return a + (b - a) * t


def quad_bezier(p0, p1, p2, t):
    x = lerp(lerp(p0[0], p1[0], t), lerp(p1[0], p2[0], t), t)
    y = lerp(lerp(p0[1], p1[1], t), lerp(p1[1], p2[1], t), t)
    return x, y


def draw_stroke_along_curve(draw, p0, p1, p2, width, color, steps=200):
    """Approximates a smooth rounded stroke by stamping circles along a
    quadratic bezier — avoids needing a vector/stroking library."""
    r = width / 2
    for i in range(steps + 1):
        t = i / steps
        x, y = quad_bezier(p0, p1, p2, t)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def draw_leaf(canvas, center, length, width, angle_deg, color):
    """Draws a leaf as a rotated ellipse (pointed via a lens shape: two
    overlapping arcs would be nicer, but a stretched ellipse reads cleanly
    as a leaf at icon sizes and stays legible when small)."""
    leaf = Image.new("RGBA", (length, width), (0, 0, 0, 0))
    d = ImageDraw.Draw(leaf)
    d.ellipse([0, 0, length, width], fill=color)
    rotated = leaf.rotate(angle_deg, expand=True, resample=Image.BICUBIC)
    cx, cy = center
    canvas.alpha_composite(
        rotated, (int(cx - rotated.width / 2), int(cy - rotated.height / 2))
    )


def build_sprout(canvas_size, scale_factor=1.0, offset=(0, 0)):
    """Draws the full sprout mark onto a transparent RGBA layer, scaled
    and offset so it can be reused at full-bleed or inset (maskable)."""
    layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    s = canvas_size * scale_factor
    ox, oy = offset

    stem_bottom = (canvas_size / 2 + ox, canvas_size * 0.82 * scale_factor + oy + canvas_size * (1 - scale_factor) / 2)
    stem_top = (canvas_size / 2 + ox, canvas_size * 0.30 * scale_factor + oy + canvas_size * (1 - scale_factor) / 2)
    stem_ctrl = (canvas_size / 2 + ox - s * 0.04, canvas_size * 0.55 * scale_factor + oy + canvas_size * (1 - scale_factor) / 2)

    stem_width = s * 0.045
    draw = ImageDraw.Draw(layer)
    draw_stroke_along_curve(draw, stem_bottom, stem_ctrl, stem_top, stem_width, MARK)

    leaf_len = s * 0.40
    leaf_wid = s * 0.14
    leaf_y = canvas_size * 0.44 * scale_factor + oy + canvas_size * (1 - scale_factor) / 2
    leaf_x_offset = s * 0.185

    draw_leaf(layer, (canvas_size / 2 + ox - leaf_x_offset, leaf_y), int(leaf_len), int(leaf_wid), 52, MARK)
    draw_leaf(layer, (canvas_size / 2 + ox + leaf_x_offset, leaf_y), int(leaf_len), int(leaf_wid), -52, MARK)

    return layer


def render(path, size, maskable=False):
    canvas = Image.new("RGBA", (BASE, BASE), BG)
    if maskable:
        # Android may crop up to the edge in a circle/squircle; keep the
        # mark inside the ~80% "safe zone" so nothing gets clipped.
        mark = build_sprout(BASE, scale_factor=0.62, offset=(0, BASE * 0.02))
    else:
        mark = build_sprout(BASE, scale_factor=0.86, offset=(0, 0))
    canvas.alpha_composite(mark)
    final = canvas.resize((size, size), Image.LANCZOS)
    final.save(path)
    print(f"wrote {path} ({size}x{size})")


render(os.path.join(OUT_DIR, "icon-512.png"), 512)
render(os.path.join(OUT_DIR, "icon-192.png"), 192)
render(os.path.join(OUT_DIR, "icon-512-maskable.png"), 512, maskable=True)
render(os.path.join(OUT_DIR, "apple-touch-icon.png"), 180)
render(os.path.join(OUT_DIR, "favicon-32.png"), 32)
