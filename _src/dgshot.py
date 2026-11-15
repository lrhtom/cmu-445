#!/usr/bin/env python3
"""给某一讲里的静态图表（figure.dg）逐张截图：  python _src/dgshot.py <页面.html> <讲次id，如 L21> <输出目录>"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

page, lec, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(Path(page).resolve().as_uri() + '#' + lec)
    figs = pg.locator('#' + lec + ' figure.dg')
    for i in range(figs.count()):
        f = out / ('dg-%s-%d.png' % (lec, i))
        figs.nth(i).screenshot(path=str(f))
        print(f)
    print('JS 报错:', errs or '无')
    b.close()
