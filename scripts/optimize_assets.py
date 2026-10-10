"""Build web-sized copies without altering the original photos.
Run: python -m pip install -r scripts/asset-requirements.txt
     python scripts/optimize_assets.py
Run again after adding photos or changing page text; commit generated assets too.
"""
from pathlib import Path
from html import escape
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import re

from PIL import Image, ImageOps
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/optimized'
OUT.mkdir(parents=True, exist_ok=True)
PAGE = ROOT / 'index.html'
html = PAGE.read_text()
SIZES = '(max-width: 640px) calc(100vw - 24px), (max-width: 1600px) 30vw, 470px'

class ImageTag(HTMLParser):
    def handle_starttag(self, tag, attrs):
        self.attrs = dict(attrs)

matches = list(re.finditer(r'<img\b[^>]*>', html))
sources = {}
for m in matches:
    parser = ImageTag(); parser.feed(m.group())
    attrs = parser.attrs
    src = attrs.get('data-original-src') or attrs.get('src')
    if src and (ROOT / src).is_file():
        sources[src] = attrs

def build(src):
    photo = src.startswith(('二人照片/', '家人合影/'))
    raw = (ROOT / src).read_bytes()
    key = hashlib.sha256(raw + b'webp-q84-widths640-960-1600-v1').hexdigest()[:16]
    variants = []
    with Image.open(ROOT / src) as original:
        img = ImageOps.exif_transpose(original)
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')
        width, height = img.size
        widths = sorted(set(min(width, n) for n in (640, 960, 1600))) if photo else [width]
        for w in widths:
            target = OUT / f'{key}-{w}.webp'
            if not target.exists():
                resized = img.resize((w, round(height*w/width)), Image.Resampling.LANCZOS) if w != width else img
                # Preserve embedded colour profiles; transpose orientation before dropping EXIF.
                resized.save(target, 'WEBP', quality=84, method=6,
                             icc_profile=original.info.get('icc_profile', b''))
            variants.append({'src':str(target.relative_to(ROOT)), 'width':w, 'bytes':target.stat().st_size})
    return src, {'width':width, 'height':height, 'original_bytes':len(raw), 'photo':photo, 'variants':variants}

with ThreadPoolExecutor(max_workers=4) as pool:
    manifest = dict(pool.map(build, sources))

def replace(m):
    parser = ImageTag(); parser.feed(m.group()); attrs = parser.attrs
    src = attrs.get('data-original-src') or attrs.get('src')
    if src not in manifest: return m.group()
    item = manifest[src]; variants = item['variants']
    attrs['data-original-src'] = src
    attrs['width'], attrs['height'] = str(item['width']), str(item['height'])
    attrs.pop('srcset', None); attrs.pop('data-src', None); attrs.pop('data-srcset', None)
    if item['photo']:
        back = '-back.' in src
        attrs.pop('src', None)
        attrs['loading'] = 'lazy'
        attrs['sizes'] = SIZES
        attrs['data-src' if back else 'src'] = variants[-1]['src']
        attrs['data-srcset' if back else 'srcset'] = ', '.join(f"{v['src']} {v['width']}w" for v in variants)
    else:
        attrs['src'] = variants[-1]['src']
    return '<img ' + ' '.join(f'{k}="{escape(v, quote=True)}"' for k,v in attrs.items()) + '>'
html = re.sub(r'<img\b[^>]*>', replace, html)
html = html.replace('baosen.css?v=phone-smaller-105', 'baosen.css?v=optimized-assets-106')
html = re.sub(r'couple-photos\.js\?v=[^"\s]+', 'couple-photos.js?v=on-demand-6', html)
html = html.replace('couple-photos.css?v=phone-natural-ratio-10', 'couple-photos.css?v=on-demand-11')
font_link = '<link rel="preload" href="assets/optimized/libian-page.woff2" as="font" type="font/woff2" crossorigin>'
if font_link not in html: html = html.replace('</title>', '</title>'+font_link, 1)
PAGE.write_text(html)
css = ROOT / 'baosen.css'
css.write_text(css.read_text().replace('assets/libian-sc.woff2', 'assets/optimized/libian-page.woff2'))

# Include all page text, accessibility labels and labels set by scripts.
text = ''.join(p.read_text() for pattern in ('*.html', '*.js') for p in ROOT.glob(pattern))
options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
font = TTFont(ROOT / 'assets/libian-sc.woff2')
original_cmap = font.getBestCmap()
needed = {ord(c) for c in text} | set(range(32,127))
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=needed)
subsetter.subset(font)
font.flavor = 'woff2'
font_path = OUT / 'libian-page.woff2'
font.save(font_path)
assert needed.intersection(original_cmap).issubset(TTFont(font_path).getBestCmap())
(OUT / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
photos = [v for v in manifest.values() if v['photo']]
print(json.dumps({'photos':len(photos),'original_MB':sum(v['original_bytes'] for v in photos)/1e6,
 'small_MB':sum(v['variants'][0]['bytes'] for v in photos)/1e6,
 'large_MB':sum(v['variants'][-1]['bytes'] for v in photos)/1e6,
 'font_bytes':font_path.stat().st_size},indent=2))
