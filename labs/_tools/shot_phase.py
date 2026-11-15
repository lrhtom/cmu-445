#!/usr/bin/env python3
"""给第 3 页的两个组件截图：「核心原理 · 翻页图解」和「逐步走读 · 先写，后跑」（需要 playwright + chromium）。

  python _tools/shot_phase.py <index.html 路径> <输出目录> <Pn> [宽度]

对这个 Project 的每个阶段：图解每一节的每一页各截一张，走读的每一大步截「写」和「跑」的第一格。
同时报告 JS 报错和页面横向溢出。宽度默认 1440，可以给 400 查手机排版。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

if len(sys.argv) < 4:
    sys.exit(__doc__)
page, out, pid = Path(sys.argv[1]).resolve(), Path(sys.argv[2]), sys.argv[3]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1440
out.mkdir(parents=True, exist_ok=True)
errs, n = [], 0


def snap(el, path):
    """单张截图超时不中断整轮，记一条错误继续"""
    global n
    try:
        el.screenshot(path=str(path), timeout=15000); n += 1
    except Exception as e:  # noqa: BLE001
        errs.append('截图失败 %s：%s' % (path.name, str(e).splitlines()[0]))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(page.as_uri() + '#phases:' + pid)
    pg.wait_for_timeout(400)
    phases = pg.evaluate('id => LAB.projects.find(p => p.id === id).phases.map(ph => ph.id)', pid)
    for ph in phases:
        pg.goto(page.as_uri() + '#phases:%s:%s' % (pid, ph))
        pg.wait_for_timeout(400)
        pg.add_style_tag(content='.nav { visibility: hidden; }')   # 元素比视口高时，顶栏会盖在截图上
        ov = pg.evaluate('() => { const a = document.querySelector(".page.active"); return a.scrollWidth - a.clientWidth; }')
        if ov > 0:
            errs.append('%s 阶段 %s：页面横向溢出 %dpx' % (pid, ph, ov))
        cpt = pg.query_selector('[data-cpt] .cpt')
        if cpt:
            nsec = pg.evaluate('el => el.querySelectorAll(".c-sel option").length', cpt)
            for si in range(nsec):
                pg.select_option('[data-cpt] .c-sel', str(si)); pg.wait_for_timeout(800)
                npg = pg.evaluate('el => el.querySelectorAll(".c-pl li").length', cpt)
                for pi in range(npg):
                    if pi:
                        pg.click('[data-cpt] .c-np'); pg.wait_for_timeout(700)
                    cpt.scroll_into_view_if_needed()
                    snap(cpt, out / ('%s-%s-c%d-%d.png' % (pid, ph, si + 1, pi + 1)))
        wk = pg.query_selector('[data-walk] .walk')
        if wk:
            nb = pg.evaluate('el => el.querySelectorAll(".w-sel option").length', wk)
            for bi in range(nb):
                pg.select_option('[data-walk] .w-sel', str(bi)); pg.wait_for_timeout(900)
                wk.scroll_into_view_if_needed()
                snap(wk, out / ('%s-%s-w%02d-a.png' % (pid, ph, bi)))
                has_run = pg.evaluate('el => +el.querySelector(".w-rng").max', wk) > 0
                if has_run and bi:
                    pg.click('[data-walk] .w-ns'); pg.wait_for_timeout(700)
                    snap(wk, out / ('%s-%s-w%02d-b.png' % (pid, ph, bi)))
    b.close()
print('截图 %d 张 → %s' % (n, out))
for e in errs:
    print('  ✗ ' + e)
sys.exit(1 if errs else 0)
