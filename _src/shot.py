#!/usr/bin/env python3
"""给可视化截图，用来肉眼检查画面（需要 playwright + chromium）。

  python _src/shot.py <页面.html> <可视化id> <场景序号(从0起)> <时刻> [--width 1280] [--out 目录] [--full]

时刻：逗号分隔。 s3 = 第 3 步刚结束时（步号从 1 起）； s3m = 第 3 步播到一半； 1500 = 第 1500ms； all = 每一步的中间和结束
--full 截整个演示（含右侧代码/控制台/数据面板和播放条），默认只截舞台
同时会报告：页面有没有 JS 报错、在该宽度下页面有没有横向滚动条。
"""
import argparse, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('viz'); ap.add_argument('scene', type=int); ap.add_argument('times')
ap.add_argument('--width', type=int, default=1280); ap.add_argument('--out', default='_shots'); ap.add_argument('--full', action='store_true')
a = ap.parse_args()
root = Path(__file__).resolve().parent.parent
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': a.width, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / a.page).as_uri())
    ok = pg.evaluate("""([id, scene]) => {
        var p = Viz.players.filter(function (x) { return x.def.id === id; })[0];
        if (!p) return null;
        var lec = p.el.closest('.lec'); if (lec) location.hash = lec.id;
        window.__p = p; p.load(scene); p.el.scrollIntoView();
        return p.sc.steps.map(function (s) { return [s.t0, s.t1, s.end]; });
    }""", [a.viz, a.scene])
    if ok is None:
        sys.exit('页面里没有可视化 ' + a.viz + ('；JS 报错：' + '; '.join(errs) if errs else ''))
    times = []
    for tok in a.times.split(','):
        if tok == 'all':
            for i, (t0, t1, end) in enumerate(ok):
                times += [('s%dm' % (i + 1), t0 + min(end, t1 - t0) * .5), ('s%d' % (i + 1), t1)]
        elif tok.startswith('s'):
            mid = tok.endswith('m'); i = int(tok[1:-1] if mid else tok[1:]) - 1
            t0, t1, end = ok[i]
            times.append((tok, t0 + min(end, t1 - t0) * .5 if mid else t1))
        else:
            times.append(('t' + tok, float(tok)))
    sel = '#viz-%s .viz' % a.viz if a.full else '#viz-%s .viz-stage' % a.viz
    for name, t in times:
        pg.evaluate('t => { __p.seek(t); }', t)
        f = out / ('%s-%d-%s.png' % (a.viz, a.scene, name))
        pg.locator(sel).screenshot(path=str(f))
        print(f)
    sw = pg.evaluate('document.documentElement.scrollWidth')
    print('页面宽 %d，内容宽 %d → %s' % (a.width, sw, '有横向滚动 ✗' if sw > a.width else '无横向滚动 ✓'))
    print('JS 报错：' + ('; '.join(errs) if errs else '无'))
    b.close()
