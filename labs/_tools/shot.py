#!/usr/bin/env python3
"""给复原笔记的页面截图，检查排版（需要 playwright + chromium）。

  python _tools/shot.py <index.html 路径> <输出目录> <页面>[@动作,…] …

页面写法：  intro:P1   prereq:P1   phases:P1:B   files:P1   viz:P1   steps:P1
动作（逗号分隔，只对 viz 页有效，scroll 对所有页有效）：
  view=class|api|call|code   sub=<接口 id 或演示 id>   next=<点几次「下一步」>   scroll=<像素>   wait=<毫秒>
例：  python _tools/shot.py _preview/P1/index.html _preview/P1/shots intro:P1 "viz:P1@view=code,sub=p1-fetch,next=5" "phases:P1:B@scroll=1800"
同时报告 JS 报错。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

if len(sys.argv) < 4:
    sys.exit(__doc__)
page, out, shots = Path(sys.argv[1]).resolve(), Path(sys.argv[2]), sys.argv[3:]
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    for s in shots:
        name, _, act = s.partition('@')
        pg.goto(page.as_uri() + '#' + name)
        pg.wait_for_timeout(500)
        for a in filter(None, act.split(',')):
            k, _, v = a.partition('=')
            if k == 'view':
                pg.select_option('#pg-viz .v-view', v); pg.wait_for_timeout(300)
            elif k == 'sub':
                pg.select_option('#pg-viz .v-sub', v); pg.wait_for_timeout(300)
            elif k == 'next':
                for _ in range(int(v)):
                    pg.click('#pg-viz .v-next'); pg.wait_for_timeout(250)
            elif k == 'scroll':
                pg.evaluate('y => document.querySelector(".page.active").scrollTop = y', int(v)); pg.wait_for_timeout(200)
            elif k == 'wait':
                pg.wait_for_timeout(int(v))
        pg.wait_for_timeout(1000)
        f = out / (s.replace(':', '_').replace('@', '-').replace(',', '-').replace('=', '') + '.png')
        pg.screenshot(path=str(f))
        print(f)
    print('JS 报错：', errs or '无')
    b.close()
