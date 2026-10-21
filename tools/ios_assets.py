"""Render the Ironverse App Store icon + launch splash at full resolution.

The PWA icon (public/icon-512.png) is a simple geometric mark: a barbell with
two yellow plates a side on the Ironverse navy. Upscaling the 512 px PNG would
blur it, so the same shapes (measured from that file) are redrawn here at any
size with 4x supersampling. Output:
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   1024x1024, no alpha
  ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png    2732x2732
  store/icon-1024.png                                                   copy for App Store Connect
Run: python tools/ios_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NAVY = (12, 17, 28)
YELLOW = (251, 191, 36)
STEEL = (180, 190, 205)

# shapes measured on the 512 px icon (x0, y0, x1, y1)
PLATES = [(107, 155, 140, 357), (148, 182, 177, 330), (335, 182, 364, 330), (372, 155, 405, 357)]
BAR = (141, 242, 371, 270)


def draw_mark(size: int, scale_in_canvas: float = 1.0) -> Image.Image:
    ss = 4
    S = size * ss
    im = Image.new('RGB', (S, S), NAVY)
    d = ImageDraw.Draw(im)
    k = S / 512 * scale_in_canvas
    off = (S - 512 * k) / 2

    def box(b):
        return [off + b[0] * k, off + b[1] * k, off + (b[2] + 1) * k, off + (b[3] + 1) * k]

    d.rectangle(box(BAR), fill=STEEL)
    for p in PLATES:
        bb = box(p)
        d.rounded_rectangle(bb, radius=(bb[2] - bb[0]) / 2, fill=YELLOW)
    return im.resize((size, size), Image.LANCZOS)


def main() -> None:
    assets = ROOT / 'ios' / 'App' / 'App' / 'Assets.xcassets'
    icon = draw_mark(1024)
    icon.save(assets / 'AppIcon.appiconset' / 'AppIcon-512@2x.png')
    (ROOT / 'store').mkdir(exist_ok=True)
    icon.save(ROOT / 'store' / 'icon-1024.png')
    splash = draw_mark(2732, scale_in_canvas=0.32)
    for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        splash.save(assets / 'Splash.imageset' / name)
    print('icon 1024 + splash 2732 written')


if __name__ == '__main__':
    main()
