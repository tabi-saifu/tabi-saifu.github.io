"""PDF用の日本語フォントとアプリのアイコン画像を作る。

フォントは Noto Sans JP（SIL OFL）を JIS 第1・第2水準の漢字などに絞って軽くする。
生成物は public/ に置き、リポジトリには含めない（npm run assets で作り直せる）。
必要なもの: pip install fonttools pymupdf
"""
import shutil
import subprocess
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules' / '@expo-google-fonts' / 'noto-sans-jp'
OUT = ROOT / 'public'


def unicodes():
    cps = set(range(0x20, 0x7f)) | set(range(0xa0, 0x180)) | set(range(0x20a0, 0x20c1))
    cps |= set(range(0x3000, 0x3100)) | set(range(0xff00, 0xffef))
    cps |= {0x2014, 0x2015, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2212, 0x2248, 0xd7}
    for row in range(0x21, 0x75):
        for cell in range(0x21, 0x7f):
            try:
                cps.add(ord(bytes([row + 0x80, cell + 0x80]).decode('euc_jp')))
            except UnicodeDecodeError:
                pass
    return ','.join('%04X' % c for c in sorted(cps))


def fonts():
    (OUT / 'fonts').mkdir(exist_ok=True)
    codes = unicodes()
    for weight, name in (('400Regular', 'Regular'), ('700Bold', 'Bold')):
        subprocess.run([
            sys.executable, '-m', 'fontTools.subset', str(SRC / weight / f'NotoSansJP_{weight}.ttf'),
            f'--unicodes={codes}', '--layout-features=', '--no-hinting', '--desubroutinize',
            f'--output-file={OUT / "fonts" / f"NotoSansJP-{name}.ttf"}',
        ], check=True)
    shutil.copy(SRC / 'LICENSE_FONT', OUT / 'fonts' / 'OFL.txt')


def icons():
    for size in (192, 512):
        page = fitz.open(OUT / 'icon.svg')[0]
        zoom = size / page.rect.width
        page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True).save(OUT / f'icon-{size}.png')


if __name__ == '__main__':
    fonts()
    icons()
    print('assets ready')
