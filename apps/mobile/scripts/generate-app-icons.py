"""Generate Android/iOS launcher icons and splash art from the master logo.

Usage (from repo root):  python -I apps/mobile/scripts/generate-app-icons.py

Source: logonew.png (1472x1284, flat brand-orange background #FCB042).
Outputs in apps/mobile/assets/app-icon/:
  icon-1024.png                 full-bleed square icon (iOS, Expo default icon)
  adaptive-foreground-1024.png  transparent mark inside the 66/108 safe circle
  adaptive-monochrome-1024.png  white silhouette for Android 13+ themed icons
  splash-mark-1024.png          transparent mark for expo-splash-screen
  play-store-512.png            512x512 hi-res icon for the Play Console listing
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "logonew.png"
OUT = ROOT / "apps" / "mobile" / "assets" / "app-icon"

BG = (252, 176, 66)  # #FCB042, sampled from the source corners
MARK_BOX = (505, 310, 970, 676)  # mark bbox (521,326)-(953,660) plus padding
CANVAS = 1024
# Android adaptive icons: 108dp canvas, 66dp guaranteed-visible circle.
SAFE_DIAMETER = CANVAS * 66 / 108
# Spread (sum of channel distances) under which a pixel is pure background.
KEY_INNER, KEY_OUTER = 40, 140


def keyed_mark() -> Image.Image:
    """Crop the mark and turn the orange background transparent (soft edges)."""
    crop = Image.open(SOURCE).convert("RGB").crop(MARK_BOX)
    rgba = Image.new("RGBA", crop.size)
    src, dst = crop.load(), rgba.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b = src[x, y]
            dist = abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2])
            if dist <= KEY_INNER:
                alpha = 0
            elif dist >= KEY_OUTER:
                alpha = 255
            else:
                alpha = round(255 * (dist - KEY_INNER) / (KEY_OUTER - KEY_INNER))
            dst[x, y] = (r, g, b, alpha)
    return rgba.crop(rgba.getbbox())


def fit_in_circle(mark: Image.Image, diameter: float) -> Image.Image:
    """Scale the mark so its bounding-box diagonal fits inside the circle."""
    diagonal = (mark.width ** 2 + mark.height ** 2) ** 0.5
    scale = diameter / diagonal
    size = (round(mark.width * scale), round(mark.height * scale))
    return mark.resize(size, Image.LANCZOS)


def centered(mark: Image.Image, background) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), background)
    offset = ((CANVAS - mark.width) // 2, (CANVAS - mark.height) // 2)
    canvas.alpha_composite(mark, offset)
    return canvas


def silhouette(mark: Image.Image) -> Image.Image:
    white = Image.new("RGBA", mark.size, (255, 255, 255, 0))
    white.putalpha(mark.getchannel("A"))
    return white


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mark = keyed_mark()

    # Foreground: 92% of the safe circle leaves a small breathing margin.
    adaptive_mark = fit_in_circle(mark, SAFE_DIAMETER * 0.92)
    centered(adaptive_mark, (0, 0, 0, 0)).save(OUT / "adaptive-foreground-1024.png")
    centered(silhouette(adaptive_mark), (0, 0, 0, 0)).save(OUT / "adaptive-monochrome-1024.png")

    # Square icon (iOS masks corners itself; keep the mark well inside).
    icon = centered(fit_in_circle(mark, CANVAS * 0.70), BG + (255,)).convert("RGB")
    icon.save(OUT / "icon-1024.png")
    icon.resize((512, 512), Image.LANCZOS).save(OUT / "play-store-512.png")

    centered(fit_in_circle(mark, CANVAS * 0.80), (0, 0, 0, 0)).save(OUT / "splash-mark-1024.png")
    print("background", "#%02X%02X%02X" % BG, "written to", OUT)


if __name__ == "__main__":
    main()
