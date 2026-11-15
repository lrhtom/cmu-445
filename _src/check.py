#!/usr/bin/env python3
"""整站自检（需要 playwright）：  python _src/check.py [目录，默认 html/]

对每个页面、每一讲，在 1280 和 400 两种宽度下检查：
  - 有没有 JS 报错
  - 页面有没有横向滚动条（400px 下也不许有）
  - 图表 / 可视化有没有渲染失败
  - 每个可视化的每个场景：跳到任意一步再接着播，画面和从头播到同一时刻是否一致（seek 不穿帮）
另外在一个页面上实测「编辑 → 刷新 → 内容还在 → 还原」和「小节 / 讲 / 章打勾、目录收起，刷新后都还在」。
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
pages = sorted(p for p in root.glob('*.html'))
bad = 0

SEEK_TEST = """() => {
  var out = [];
  Viz.players.forEach(function (p) {
    p.def.scenes.forEach(function (sd, i) {
      p.load(i);
      var st = p.sc.steps, snap = function () { return p.layer.innerHTML; };
      for (var k = 0; k < st.length; k++) {
        var t = st[k].t0 + (st[k].t1 - st[k].t0) * 0.4;
        p.seek(t); var a = snap();                 /* 直接跳到这一步的中间 */
        p.seek(0); p.seek(st[k].t0); p.seek(t);    /* 回到开头，再跳到步首，再走到同一时刻 */
        if (snap() !== a) out.push(p.def.id + ' 场景' + (i + 1) + ' 第' + (k + 1) + '步');
      }
      p.seek(p.sc.total); var end = snap(); p.seek(0); p.seek(p.sc.total);
      if (snap() !== end) out.push(p.def.id + ' 场景' + (i + 1) + ' 结尾');
    });
    p.load(0);
  });
  return out;
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for width in (1280, 400):
        ctx = b.new_context(viewport={'width': width, 'height': 900})
        for f in pages:
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f.as_uri())
            lecs = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.lec'), function (l) { return l.id; })") or ['']
            wide = []
            for lec in lecs:
                if lec:
                    pg.evaluate("id => { location.hash = id; }", lec)
                    pg.wait_for_timeout(60)
                sw = pg.evaluate('document.documentElement.scrollWidth')
                if sw > width:
                    culprit = pg.evaluate("""w => { var worst = null, max = w; document.querySelectorAll('main *, .home *').forEach(function (e) {
                        var r = e.getBoundingClientRect(); if (r.width && r.right > max + 1 && !e.closest('.tbl, pre, .viz-code, .viz-log, .viz-data')) { max = r.right; worst = e.tagName + '.' + e.className + ' → ' + Math.round(r.right); } }); return worst; }""", width)
                    wide.append('%s 内容宽 %d（%s）' % (lec or f.name, sw, culprit))
            fails = pg.evaluate("Array.prototype.filter.call(document.querySelectorAll('[data-viz], .dg-body'), function (e) { return /失败|未找到/.test(e.textContent) && !e.querySelector('svg, .dg-layers'); }).map(function (e) { return e.textContent.slice(0, 80); })")
            seek = pg.evaluate(SEEK_TEST) if width == 1280 and pg.evaluate("typeof Viz !== 'undefined' && Viz.players.length > 0") else []
            n = pg.evaluate("[document.querySelectorAll('.viz').length, document.querySelectorAll('figure.dg').length]")
            ok = not (errs or wide or fails or seek)
            bad += 0 if ok else 1
            print('%s %-24s @%4d  可视化 %2d  图表 %2d' % ('✓' if ok else '✗', f.name, width, n[0], n[1]))
            for m in errs: print('    JS 报错: ' + m)
            for m in wide: print('    横向滚动: ' + m)
            for m in fails: print('    渲染失败: ' + m)
            for m in seek: print('    seek 不一致: ' + m)
            pg.close()
        ctx.close()

    # 编辑 → 刷新 → 还在 → 还原
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    target = next((p for p in pages if p.name.startswith('ch03')), pages[0])
    pg.goto(target.as_uri())
    pg.click('#editBtn')
    sel = '.lec.on .md p[data-b]'
    before = pg.locator(sel).first.inner_text()
    pg.locator(sel).first.click()
    pg.keyboard.press('End'); pg.keyboard.type(' 【我加的批注】')
    pg.wait_for_timeout(700)
    pg.reload()
    after = pg.locator(sel).first.inner_text()
    kept = '【我加的批注】' in after
    pg.once('dialog', lambda d: d.accept())
    pg.click('#moreBtn'); pg.click('[data-act="resetLec"]')
    pg.wait_for_timeout(200)
    restored = pg.locator(sel).first.inner_text() == before
    print('%s 编辑后刷新仍在：%s；还原后恢复原文：%s' % ('✓' if kept and restored else '✗', kept, restored))
    bad += 0 if kept and restored else 1

    # 术语卡片：悬停能弹出；进编辑模式后标记去掉，改动里不混进标记
    pg.goto(target.as_uri())
    if pg.evaluate("document.body.classList.contains('editing')"):     # 上一项测试留下的编辑模式
        pg.click('#editBtn')
    pg.wait_for_timeout(200)
    pg.locator('.lec.on .md p .gl').first.hover()
    pg.wait_for_timeout(300)
    shown = pg.evaluate("(function () { var c = document.querySelector('.glcard.on'); return c ? c.textContent : ''; })()")
    pg.mouse.move(0, 0)
    pg.click('#editBtn')
    clean = pg.evaluate("document.querySelectorAll('.lec .gl').length") == 0
    pg.locator(sel).first.click()
    pg.keyboard.press('End'); pg.keyboard.type('x')
    pg.wait_for_timeout(600)
    leaked = 'class=\\"gl' in (pg.evaluate("localStorage.getItem('cmu445:' + document.body.getAttribute('data-page'))") or '')
    pg.once('dialog', lambda d: d.accept())
    pg.click('#moreBtn'); pg.click('[data-act="resetLec"]')
    pg.click('#editBtn')
    pg.wait_for_timeout(200)
    back = pg.evaluate("document.querySelectorAll('.lec.on .gl').length") > 0
    ok = bool(shown) and clean and not leaked and back
    print('%s 术语卡片：悬停弹出：%s；编辑时去掉标记：%s；保存内容干净：%s；退出编辑恢复：%s' % ('✓' if ok else '✗', bool(shown), clean, not leaked, back))
    bad += 0 if ok else 1

    # 打勾（小节 → 讲 → 章）→ 刷新还在；目录收起 → 刷新还在
    pg.goto(target.as_uri())
    subs = pg.locator('.lecs > li.on .sub [data-ck]')
    for i in range(subs.count()):
        subs.nth(i).click()
    lec = pg.locator('.lecs > li.on').get_attribute('data-lec')
    lec_done = pg.locator('.lecs > li.on .lr .ck').get_attribute('aria-pressed') == 'true'
    pg.click('[data-call]')
    pg.reload()
    chap = pg.locator('.cprog .txt').inner_text().startswith('✓') and 'done' in (pg.locator('.tabs a.on').get_attribute('class') or '')
    pg.keyboard.press('[')
    pg.wait_for_timeout(350)
    pg.reload()
    col = pg.evaluate("document.body.classList.contains('side-collapsed') && document.querySelector('.side-rail').offsetWidth > 0")
    pg.click('.side-rail [data-side-tg]')
    pg.once('dialog', lambda d: d.accept())
    pg.click('[data-call]')
    cleared = pg.locator('.cprog .txt').inner_text().startswith('完成 0')
    ok = lec_done and chap and col and cleared
    print('%s 小节全勾 → %s 整讲完成：%s；全部打勾刷新后整章 ✓：%s；目录收起刷新后仍收起：%s；全部取消：%s' % ('✓' if ok else '✗', lec, lec_done, chap, col, cleared))
    bad += 0 if ok else 1
    b.close()

print('\n' + ('全部通过' if not bad else '有 %d 项不通过' % bad))
sys.exit(1 if bad else 0)
