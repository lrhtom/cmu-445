/* #12 连接算法：块嵌套循环 / 排序归并（含回溯）/ 哈希连接 build + probe / Grace 哈希连接
 * 场景 1、3、4 的页数、键值、哈希函数是为了画得下而取的示意值；场景 2 用的是笔记第 5 节「完整演练」的原例。 */
(function () {
var C = Viz.C, KEY = '#2b4172', DONE = '#1d6b57';
function mk(S, type, id, base, o) { for (var k in o) base[k] = o[k]; S[type](id, base); }
function key(S, id, x, y, label, o) {
  mk(S, 'box', id, { x: x, y: y, w: 42, h: 34, rx: 6, fill: KEY, stroke: 'none', sw: 0, label: String(label), size: 16 }, o);
}
function page(S, id, x, y, o) {
  mk(S, 'box', id, { x: x, y: y, w: 108, h: 52, rx: 9, fill: C.panel, stroke: C.line, sw: 2 }, o);
}
function lab(S, id, x, y, text, o) {
  mk(S, 'text', id, { x: x, y: y, text: text, anchor: 'start', color: C.mute, size: 15 }, o);
}

Viz.register('joins', {
  title: '连接算法：嵌套循环 · 排序归并 · 哈希',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #12 连接算法（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/12-joins.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #12 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/12-joins.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Project #3 查询执行', u: 'https://15445.courses.cs.cmu.edu/fall2025/project3/' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：块嵌套循环 ───────────────────────── */
  {
    name: '块嵌套循环',
    moving: '蓝色游标在磁盘页之间滑动；页里的键飞进缓冲池；比较线在两页的元组之间逐对划过；匹配的结果飞进输出；I/O 次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 块嵌套循环：循环单位从“元组”变成“页”',
      'for (Page& P : R)            // outer：M 页',
      '  for (Page& Q : S)          // inner：N 页',
      '    for (Tuple& r : P)       // 以下全在内存',
      '      for (Tuple& s : Q)',
      '        if (r.key == s.key)',
      '          Emit(r, s);',
      '// 成本 = M + (M × N)',
      '// 朴素版：每个元组扫一遍 S',
      '// 成本 = M + (m × N)',
      '// 用满缓冲池（B-2 页装 outer）：',
      '// 成本 = M + ⌈M / (B-2)⌉ × N'
    ].join('\n'),
    build: function (S) {
      var RXp = [96, 230], SXp = [96, 230, 364], yR = 114, yS = 476, KY = [252, 312], FO = 150, FI = 390, OY = [124, 182, 240, 298, 356];
      var R = [[1, 3], [5, 6]], Q = [[3, 7], [1, 5], [6, 3]], io = 0, nOut = 0, curR = null, curS = null, tag = 0;
      S.text('note', { x: 20, y: 24, text: 'R：M = 2 页、m = 4 条；S：N = 3 页；每页 2 条、B = 3 —— 示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: 'I/O 次数 ', color: C.amber, size: 16 });
      lab(S, 'lR', 42, 68, 'R（outer）· 磁盘上 M = 2 页');
      lab(S, 'lS', 42, 430, 'S（inner）· 磁盘上 N = 3 页');
      S.box('mem', { x: 270, y: 278, w: 480, h: 212, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      lab(S, 'lMem', 46, 192, '内存 · 缓冲池（B = 3 页）');
      page(S, 'fo', FO, 282, { w: 88, h: 128 }); page(S, 'fi', FI, 282, { w: 88, h: 128 });
      S.text('lfo', { x: FO, y: 364, text: 'outer 页', color: C.mute, size: 14 });
      S.text('lfi', { x: FI, y: 364, text: 'inner 页', color: C.mute, size: 14 });
      S.text('cmpT', { x: 270, y: 222, text: '', size: 17, weight: 700, color: C.mute });
      S.line('cl', { x1: 200, y1: KY[0], x2: 340, y2: KY[0], stroke: C.blue, sw: 3, opacity: 0, draw: 0 });
      S.box('out', { x: 700, y: 240, w: 240, h: 310, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      lab(S, 'lOut', 592, 68, '输出页 → 结果');
      RXp.forEach(function (x, p) { page(S, 'dR' + p, x, yR); R[p].forEach(function (v, k) { key(S, 'kr' + p + k, x + (k ? 26 : -26), yR, v); }); });
      SXp.forEach(function (x, p) { page(S, 'dS' + p, x, yS); Q[p].forEach(function (v, k) { key(S, 'ks' + p + k, x + (k ? 26 : -26), yS, v); }); });
      S.box('cR', { x: RXp[0], y: yR, w: 124, h: 68, rx: 14, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      S.box('cS', { x: SXp[0], y: yS, w: 124, h: 68, rx: 14, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      lab(S, 'fm1', 446, 452, '块嵌套循环：M + (M × N) = 2 + 2 × 3 = 8 次 I/O', { color: C.amber, size: 16, opacity: 0 });
      lab(S, 'fm2', 446, 486, '朴素版：M + (m × N) = 2 + 4 × 3 = 14 次 I/O', { color: C.red, size: 16, opacity: 0 });
      lab(S, 'fm3', 446, 520, '用满缓冲池：M + ⌈M / (B−2)⌉ × N', { color: C.ink, size: 16, opacity: 0 });
      S.data({ 'outer 页': '—', 'inner 页': '—', 'I/O 次数': 0, '输出条数': 0 });

      function load(t, side, p) {          /* 把磁盘上的一页读进缓冲池（side: R → outer 页，S → inner 页） */
        var isR = side === 'R', vals = isR ? R[p] : Q[p], px = isR ? RXp[p] : SXp[p], py = isR ? yR : yS, fx = isR ? FO : FI, prev = isR ? curR : curS, id = 'b' + (tag++);
        if (prev) [0, 1].forEach(function (k) { S.to(prev + k, { scale: .2, opacity: 0 }, { delay: t, dur: 300, ease: 'in' }); });
        S.flash('d' + side + p, C.blue, { prop: 'stroke', delay: t, hold: 260, dur: 280 });
        [0, 1].forEach(function (k) {
          S.fly([px + (k ? 26 : -26), py], [fx, KY[k]], { id: id + k, label: String(vals[k]), w: 42, h: 34, size: 16, color: C.cyan, keep: true, delay: t + 150 + k * 100, dur: 720 });
          S.to(id + k, { fill: KEY, color: C.ink }, { delay: t + 900 + k * 100, dur: 250 });
        });
        S.count('tIO', ++io, { delay: t + 870, dur: 300 });
        var d = { 'I/O 次数': io }; d[isR ? 'outer 页' : 'inner 页'] = side + ' 第 ' + (p + 1) + ' 页 [' + vals.join(', ') + ']';
        S.data(d, { delay: t + 870 }); S.log('读 ' + side + ' 第 ' + (p + 1) + ' 页', { delay: t, kind: 'io' });
        if (isR) curR = id; else curS = id;
        return t + 1250;
      }
      function pairs(t, rp, sp, step) {    /* 两页都在内存里：页内元组两两比较 */
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var hit = R[rp][i] === Q[sp][j];
          S.set('cl', { y1: KY[i], y2: KY[j], draw: 0, opacity: 1, stroke: C.blue }, { delay: t });
          S.to('cl', { draw: 1 }, { delay: t, dur: step * .4, ease: 'out' });
          S.set('cmpT', { text: R[rp][i] + (hit ? ' = ' : ' ≠ ') + Q[sp][j], color: hit ? C.green : C.mute }, { delay: t + step * .4 });
          if (hit) {
            S.set('cl', { stroke: C.green }, { delay: t + step * .4 });
            S.pulse(curR + i, { delay: t + step * .4 }); S.pulse(curS + j, { delay: t + step * .4 });
            S.fly([270, (KY[i] + KY[j]) / 2], [700, OY[nOut]], { id: 'o' + nOut, label: '(' + R[rp][i] + ', ' + Q[sp][j] + ')', w: 150, h: 38, size: 16, color: C.green, keep: true, delay: t + step * .45, dur: 720 });
            S.data({ '输出条数': ++nOut }, { delay: t + step * .45 + 720 });
            S.log('匹配 ' + R[rp][i] + ' = ' + Q[sp][j] + ' → 输出', { delay: t + step * .45, kind: 'ok' });
          }
          S.to('cl', { opacity: 0 }, { delay: t + step * .75, dur: step * .2 });
          t += step;
        }
        return t;
      }

      S.step('把 R（outer）的第 1 页读进缓冲池 —— 1 次 I/O', function () {
        S.code(2); S.pop('cR'); load(350, 'R', 0);
      });
      S.step('再读 S（inner）的第 1 页。两页都在内存里 → 页内元组两两比较，不再碰磁盘', function () {
        S.code(3); S.pop('cS');
        var t = load(300, 'S', 0); S.code([4, 7], { delay: t });
        pairs(t, 0, 0, 620);
      });
      S.step('outer 页原地不动，只换 inner 页：读 S 的第 2 页，再比一轮', function () {
        S.code(3); S.move('cS', SXp[1], yS, { dur: 500 });
        var t = load(350, 'S', 1); S.code([4, 7], { delay: t });
        pairs(t, 0, 1, 520);
      });
      S.step('S 的第 3 页：3 = 3，又出一条', function () {
        S.code(3); S.move('cS', SXp[2], yS, { dur: 500 });
        var t = load(350, 'S', 2); S.code([4, 7], { delay: t });
        pairs(t, 0, 2, 520);
      });
      S.step('R 的这一页把能做的事全做完了，才换 R 的下一页；S 得从头再扫一遍', function () {
        S.code(2); S.move('cR', RXp[1], yR, { dur: 500 });
        var t = load(350, 'R', 1);
        S.to(curS + '0', { scale: .2, opacity: 0 }, { delay: t - 400, dur: 300, ease: 'in' }); S.to(curS + '1', { scale: .2, opacity: 0 }, { delay: t - 400, dur: 300, ease: 'in' });
        curS = null; S.set('cmpT', { text: '' }, { delay: 300 });
        S.move('cS', SXp[0], yS, { delay: t - 300, dur: 750 });
        S.data({ 'inner 页': '—' }, { delay: t - 400 });
      });
      S.step('R 的第 2 页同样和 S 的 3 页各比一轮：5 = 5、6 = 6', function () {
        S.code(3);
        var t = load(0, 'S', 0); t = pairs(t, 1, 0, 380);
        S.move('cS', SXp[1], yS, { delay: t, dur: 400 }); t = load(t + 250, 'S', 1); t = pairs(t, 1, 1, 420);
        S.move('cS', SXp[2], yS, { delay: t, dur: 400 }); t = load(t + 250, 'S', 2); t = pairs(t, 1, 2, 420);
        S.hide('cR', { delay: t }); S.hide('cS', { delay: t }); S.set('cmpT', { text: '' }, { delay: t });
      });
      S.step('总账：R 的 M 页各读一次，每页配一遍 S 的 N 页 → M + (M × N) = 8 次 I/O', function () {
        S.code(8); S.pop('fm1'); S.pulse('tIO', { delay: 350 });
        S.flash('dR0', C.amber, { prop: 'stroke', delay: 300 }); S.flash('dR1', C.amber, { prop: 'stroke', delay: 450 });
        [0, 1, 2].forEach(function (p) { S.flash('dS' + p, C.amber, { prop: 'stroke', delay: 700 + p * 150 }); });
        S.log('块嵌套循环：8 次 I/O，输出 5 条', { delay: 400, kind: 'ok' });
      }, { hold: 1600 });
      S.step('朴素版每来一个【元组】就把 S 扫一遍：M + (m × N) = 14 次 —— 常数差很多', function () {
        S.code([9, 10]); S.pop('fm2');
        ['kr00', 'kr01', 'kr10', 'kr11'].forEach(function (id, i) { S.flash(id, C.red, { delay: 300 + i * 180 }); S.pulse(id, { delay: 300 + i * 180 }); });
        S.log('朴素嵌套循环：14 次 I/O', { delay: 400, kind: 'warn' });
      }, { hold: 1600 });
      S.step('缓冲池更大时：B−2 页装 outer、1 页读 inner、1 页写输出 → S 只扫 ⌈M/(B−2)⌉ 遍', function () {
        S.code([11, 12]); S.pop('fm3');
        S.to('fo', { w: 150 }, { delay: 200, dur: 600 }); S.to('lfo', { text: 'outer：B−2 页' }, { delay: 500 });
        S.flash('fo', C.green, { prop: 'stroke', delay: 800 });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 2：排序归并连接 ───────────────────────── */
  {
    name: '排序归并：双游标与回溯',
    moving: 'R、S 两个游标各自向下滑；连线跟着游标摆动并显示比较结果；匹配的一对飞进输出；回溯时 S 游标向上退回；last_value 更新时闪一下',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 归并阶段：R、S 已按连接键排好序',
      'while (r.Valid()) {',
      '  if (s.Valid() && s.key < r.key) {',
      '    s.Next();                 // inner 追上来',
      '  } else if (s.Valid() && s.key == r.key) {',
      '    Emit(r, s); s.Next();     // 只挪 inner',
      '  } else {                    // s 更大或到底',
      '    r.Next();                 // outer 下移',
      '    if (r.Valid() && r.key == last_value)',
      '      s.BackTo(last_value);   // 回溯 inner',
      '    else if (!s.Valid()) break;  // 短路',
      '  }',
      '}',
      '// last_value：inner 游标上一个不同的值',
      '// （s.Next() 发现值变了就更新它）'
    ].join('\n'),
    build: function (S) {
      var Rv = [100, 200, 200, 300, 500, 600], Sv = [100, 100, 200, 400, 500], XR = 250, XS = 470, r = 0, s = 0, nOut = 0;
      function yy(i) { return 108 + i * 62; }
      S.text('note', { x: 20, y: 24, text: '两边已按连接键排好序 —— 数据是笔记第 5 节「完整演练」的原例', anchor: 'start', size: 14, color: C.mute });
      S.text('hR', { x: XR, y: 66, text: 'R（outer）', color: C.mute }); S.text('hS', { x: XS, y: 66, text: 'S（inner）', color: C.mute });
      S.text('hO', { x: 760, y: 66, text: '输出', color: C.mute });
      S.box('out', { x: 760, y: 250, w: 164, h: 330, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      Rv.forEach(function (v, i) { S.box('R' + i, { x: XR, y: yy(i), w: 120, h: 46, rx: 8, label: String(v), size: 17 }); });
      Sv.forEach(function (v, i) { S.box('S' + i, { x: XS, y: yy(i), w: 120, h: 46, rx: 8, label: String(v), size: 17 }); });
      S.line('lk', { x1: 314, y1: yy(0), x2: 406, y2: yy(0), stroke: C.blue, sw: 3, opacity: 0 });
      S.text('op', { x: 360, y: yy(0) - 18, text: '=', size: 24, weight: 700, color: C.green, opacity: 0 });
      S.box('pR', { x: 118, y: yy(0), w: 116, h: 38, rx: 19, fill: C.blue, stroke: 'none', sw: 0, label: 'R 游标 ▶', color: C.bg, size: 15, opacity: 0, trail: 3 });
      S.box('pS', { x: 602, y: yy(0), w: 116, h: 38, rx: 19, fill: C.purple, stroke: 'none', sw: 0, label: '◀ S 游标', color: C.bg, size: 15, opacity: 0, trail: 3 });
      S.box('lv', { x: XS, y: 478, w: 230, h: 44, rx: 10, fill: C.panel, stroke: C.purple, sw: 2, label: 'last_value = —', color: C.purple, size: 16 });
      S.text('tip', { x: 250, y: 520, text: '只回溯 inner（S），永远不回溯 outer（R）', color: C.amber, size: 15, opacity: 0 });
      S.data({ 'R 游标': '—', 'S 游标': '—', last_value: '—', '输出条数': 0 });

      function midY() { return (yy(r) + yy(s)) / 2 - 18; }
      function show(t, sym, col) {         /* 在连线上显示本次比较的结果 */
        S.set('op', { text: sym, color: col }, { delay: t }); S.to('op', { opacity: 1 }, { delay: t, dur: 200 });
        S.to('lk', { stroke: col }, { delay: t, dur: 200 });
        S.flash('R' + r, col, { prop: 'stroke', delay: t }); S.flash('S' + Math.min(s, 4), col, { prop: 'stroke', delay: t + 100 });
        return t + 550;
      }
      function emit(t) {
        var v = Rv[r];
        S.fly([360, (yy(r) + yy(s)) / 2], [760, 118 + nOut * 60], { id: 'o' + nOut, label: '(' + v + ', ' + v + ')', w: 136, h: 38, size: 15, color: C.green, keep: true, delay: t, dur: 760 });
        S.data({ '输出条数': ++nOut }, { delay: t + 760 }); S.log('输出 (' + v + ', ' + v + ')', { delay: t, kind: 'ok' });
        return t + 800;
      }
      function mvR(t, to) {
        S.to('R' + r, { opacity: .5 }, { delay: t, dur: 300 });
        r = to; S.hide('op', { delay: t, dur: 150 });
        S.move('pR', 118, yy(r), { delay: t, dur: 600 }); S.to('lk', { y1: yy(r), stroke: C.blue }, { delay: t, dur: 600 });
        S.set('op', { y: midY() }, { delay: t + 200 });
        S.data({ 'R 游标': Rv[r] }, { delay: t + 600 });
        return t + 700;
      }
      function mvS(t, to, col) {
        s = to; S.hide('op', { delay: t, dur: 150 });
        S.move('pS', 602, yy(s), { delay: t, dur: 600 }); S.to('lk', { y2: yy(s), stroke: col || C.blue }, { delay: t, dur: 600 });
        S.set('op', { y: midY() }, { delay: t + 200 });
        S.data({ 'S 游标': s < 5 ? Sv[s] : '到底' }, { delay: t + 600 });
        return t + 700;
      }
      function setLv(t, v) {
        S.set('lv', { label: 'last_value = ' + v }, { delay: t }); S.flash('lv', C.purple, { delay: t }); S.pulse('lv', { delay: t, scale: 1.08 });
        S.data({ last_value: v }, { delay: t }); S.log('值变了 → last_value = ' + v, { delay: t });
      }

      S.step('R、S 的游标都从头开始：100 = 100 → 输出，S 游标下移', function () {
        S.code([5, 6]); S.log('开始归并'); S.data({ 'R 游标': 100, 'S 游标': 100 });
        S.pop('pR'); S.pop('pS', { delay: 150 }); S.to('lk', { opacity: 1 }, { delay: 400, dur: 300 });
        var t = show(700, '=', C.green); t = emit(t - 200); mvS(t, 1);
      });
      S.step('又是 100 = 100 → 输出；S 下移到 200，值变了 → 记下 last_value = 100', function () {
        S.code([5, 6]);
        var t = show(0, '=', C.green); t = emit(t - 200); t = mvS(t, 2); setLv(t, 100);
      });
      S.step('S 的 200 > R 的 100 → R 下移（S 是有序的，后面不可能再有 100）', function () {
        S.code([7, 8]);
        var t = show(0, '<', C.amber); S.log('100 < 200 → R 下移', { delay: 100 }); mvR(t + 300, 1);
      });
      S.step('200 = 200 → 输出，S 下移到 400；值变了 → last_value = 200', function () {
        S.code([5, 6]);
        var t = show(0, '=', C.green); t = emit(t - 200); t = mvS(t, 3); setLv(t, 200);
      });
      S.step('S 的 400 > R 的 200 → R 下移，新的 R 还是 200', function () {
        S.code([7, 8]);
        var t = show(0, '<', C.amber); S.log('200 < 400 → R 下移', { delay: 100 }); mvR(t + 300, 2);
      });
      S.step('R 的新值 200 等于 last_value → 回溯：把 S 游标退回第一个 200', function () {
        S.code([9, 10]); S.log('R = last_value → 回溯 S', { kind: 'warn' });
        S.flash('R2', C.amber); S.pulse('R2'); S.flash('lv', C.amber, { delay: 300 }); S.pulse('lv', { delay: 300, scale: 1.08 });
        S.to('pS', { fill: C.amber }, { delay: 700, dur: 250 });
        var t = mvS(800, 2, C.amber);
        S.to('pS', { fill: C.purple }, { delay: t, dur: 300 }); S.ripple(XS, yy(2), { delay: t - 100, color: C.amber });
        S.pop('tip', { delay: t });
      });
      S.step('200 = 200 → 输出；S 再次下移到 400', function () {
        S.code([5, 6]);
        var t = show(0, '=', C.green); t = emit(t - 200); mvS(t, 3);
      });
      S.step('400 > 200 → R 下移到 300；300 < 400 → R 再下移（S 里绝不会再出现 300）', function () {
        S.code([7, 8]); S.hide('tip');
        var t = show(0, '<', C.amber); t = mvR(t + 200, 3);
        t = show(t, '<', C.amber); S.log('300 < 400 → R 下移', { delay: t - 500 }); mvR(t + 200, 4);
      });
      S.step('R 的 500 > S 的 400 → 这回轮到 S 下移；500 = 500 → 输出，S 走到底', function () {
        S.code([3, 4]);
        var t = show(0, '>', C.amber); t = mvS(t + 200, 4);
        S.code([5, 6], { delay: t });
        t = show(t, '=', C.green); t = emit(t - 200);
        S.hide('op', { delay: t, dur: 150 }); S.to('lk', { opacity: 0 }, { delay: t, dur: 300 });
        s = 5; S.move('pS', 602, yy(5), { delay: t, dur: 600 }); S.set('pS', { label: 'S 到底了' }, { delay: t + 600 });
        setLv(t + 600, 500); S.data({ 'S 游标': '到底' }, { delay: t + 600 });
      });
      S.step('R 下移到 600：不等于 last_value，而 S 已经到底 → 后面不可能再有匹配，短路结束', function () {
        S.code([8, 11]);
        S.to('R4', { opacity: .5 }, { dur: 300 }); S.move('pR', 118, yy(5), { dur: 600 }); r = 5;
        S.flash('R5', C.red, { prop: 'stroke', delay: 700 }); S.flash('lv', C.red, { prop: 'stroke', delay: 900 });
        S.to('pR', { fill: C.mute }, { delay: 1300, dur: 300 }); S.to('pS', { fill: C.mute }, { delay: 1300, dur: 300 });
        S.flash('out', C.green, { prop: 'stroke', delay: 1500 });
        S.data({ 'R 游标': 600 }, { delay: 600 }); S.log('短路结束：共输出 5 条', { delay: 1400, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 3：哈希连接 ───────────────────────── */
  {
    name: '哈希连接：Build 与 Probe',
    moving: '元组穿过哈希函数飞向槽位；撞上别的键时沿表向下滑一格；探测时两个键并排比较，命中变绿并飞进输出，落空变红消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 阶段 1：Build —— 扫 outer 表 R',
      'HashTable ht;',
      'for (Tuple& r : R)',
      '  ht.Insert(h(r.key), r);      // 存键和元组',
      '// 阶段 2：Probe —— 扫 inner 表 S',
      'for (Tuple& s : S) {',
      '  auto it = ht.Slot(h(s.key));',
      '  for (; !it.Empty(); it.Next())  // 线性探测',
      '    if (it.key == s.key)       // 必须真比 key',
      '      Emit(it.tuple, s);',
      '}',
      '// 两个循环先后执行，不再嵌套'
    ].join('\n'),
    build: function (S) {
      var Rk = [8, 14, 11, 6], Sk = [6, 14, 20, 8], HY = 200, table = [], nOut = 0, nIns = 0, nPr = 0;
      function sy(i) { return 118 + i * 56; }
      function cy(i) { return 112 + i * 60; }
      S.text('note', { x: 20, y: 24, text: 'h(key) = key mod 6、6 个槽的线性探测哈希表 —— 示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('ph', { x: 840, y: 24, text: '阶段 1 · Build', anchor: 'end', color: C.amber, size: 16 });
      S.text('lR', { x: 80, y: 66, text: 'R（build 侧）', color: C.mute }); S.text('lS', { x: 780, y: 66, text: 'S（probe 侧）', color: C.mute });
      S.text('lH', { x: 430, y: 66, text: '内存 · 哈希表（用完就扔）', color: C.mute });
      S.box('ht', { x: 430, y: 258, w: 224, h: 352, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      for (var i = 0; i < 6; i++) {
        S.box('sl' + i, { x: 430, y: sy(i), w: 196, h: 46, rx: 8, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('si' + i, { x: 350, y: sy(i), text: String(i), color: C.mute, size: 14 });
      }
      S.dot('hL', { x: 215, y: HY, r: 26, fill: C.purple, label: 'h', size: 18 }); S.dot('hR', { x: 645, y: HY, r: 26, fill: C.purple, label: 'h', size: 18 });
      S.text('hTL', { x: 215, y: HY + 50, text: '', color: C.purple, size: 16 }); S.text('hTR', { x: 645, y: HY + 50, text: '', color: C.purple, size: 16 });
      S.text('tIns', { x: 80, y: 372, val: 0, pre: '已插入 ', suf: ' 条', color: C.amber, size: 15 });
      S.text('tPr', { x: 780, y: 372, val: 0, pre: '已探测 ', suf: ' 条', color: C.amber, size: 15 });
      lab(S, 'lO', 40, 502, '输出');
      S.box('out', { x: 470, y: 502, w: 700, h: 58, rx: 12, fill: C.panel, stroke: C.line, sw: 2, dash: '6 5' });
      [0, 1, 2, 3].forEach(function (i) { [80, 780].forEach(function (x, n) { S.box('gh' + n + i, { x: x, y: cy(i), w: 84, h: 40, rx: 7, fill: 'none', stroke: C.line, sw: 1.5, dash: '4 4', opacity: .6 }); }); });
      Rk.forEach(function (k, i) { S.box('r' + i, { x: 80, y: cy(i), w: 84, h: 40, rx: 7, fill: KEY, stroke: 'none', sw: 0, label: String(k), size: 17, trail: 3 }); });
      Sk.forEach(function (k, i) { S.box('s' + i, { x: 780, y: cy(i), w: 84, h: 40, rx: 7, fill: KEY, stroke: 'none', sw: 0, label: String(k), size: 17, trail: 3 }); });
      S.data({ '阶段': 'Build', '当前 key': '—', 'h(key)': '—', '已插入': 0, '已探测': 0, '输出条数': 0 });

      function toHash(t, id, k, left) {     /* 元组飞到哈希函数，算出槽号，再飞到那个槽旁边悬停 */
        var h = k % 6;
        S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 200 });
        S.move(id, left ? 215 : 645, HY, { delay: t + 100, dur: 500, ease: 'in' });
        S.pulse(left ? 'hL' : 'hR', { delay: t + 600 });
        S.set(left ? 'hTL' : 'hTR', { text: 'h(' + k + ') = ' + h }, { delay: t + 600 });
        S.to(id, { x: 488, y: sy(h), w: 60, h: 34 }, { delay: t + 700, dur: 520, ease: 'out' });
        S.data({ '当前 key': k, 'h(key)': h }, { delay: t + 600 });
        return t + 1250;
      }
      function insert(t, i) {
        var id = 'r' + i, k = Rk[i], h = k % 6;
        t = toHash(t, id, k, true);
        while (table[h] != null) {          /* 槽被占 → 线性探测 */
          S.flash('sl' + h, C.red, { prop: 'stroke', delay: t }); S.pulse('r' + table[h].i, { delay: t });
          S.log('槽 ' + h + ' 已被 ' + table[h].k + ' 占用 → 往下探测', { delay: t, kind: 'warn' });
          h = (h + 1) % 6;
          S.move(id, 488, sy(h), { delay: t + 400, dur: 420 });
          t += 850;
        }
        table[h] = { k: k, i: i };
        S.to(id, { x: 410, w: 72, fill: KEY, color: C.ink }, { delay: t, dur: 320 });
        S.ripple(410, sy(h), { delay: t + 320, color: C.green }); S.flash('sl' + h, C.green, { prop: 'stroke', delay: t + 320 });
        S.count('tIns', ++nIns, { delay: t + 320, dur: 250 });
        S.data({ '已插入': nIns }, { delay: t + 320 }); S.log('Insert(' + k + ') → 槽 ' + h, { delay: t + 320 });
        return t + 700;
      }
      function probe(t, i) {
        var id = 's' + i, k = Sk[i], h = k % 6;
        t = toHash(t, id, k, false);
        while (table[h] != null && table[h].k !== k) {   /* 槽里有东西但 key 不同 → 冲突，继续往下 */
          S.flash('r' + table[h].i, C.blue, { delay: t, hold: 260, dur: 280 }); S.flash(id, C.blue, { delay: t, hold: 260, dur: 280 });
          S.flash('sl' + h, C.red, { prop: 'stroke', delay: t + 350 });
          S.log(table[h].k + ' ≠ ' + k + '（冲突）→ 往下探测', { delay: t + 350, kind: 'warn' });
          h = (h + 1) % 6;
          S.move(id, 488, sy(h), { delay: t + 650, dur: 420 });
          t += 1150;
        }
        S.count('tPr', ++nPr, { delay: t, dur: 250 }); S.data({ '已探测': nPr }, { delay: t });
        if (table[h] != null) {
          var st = 'r' + table[h].i;
          S.flash(st, C.green, { delay: t, hold: 500, dur: 400 }); S.pulse(st, { delay: t });
          S.to(id, { fill: C.green }, { delay: t, dur: 200 }); S.pulse(id, { delay: t });
          S.fly([450, sy(h)], [190 + nOut * 160, 502], { id: 'o' + nOut, label: '(' + k + ', ' + k + ')', w: 130, h: 38, size: 16, color: C.green, keep: true, delay: t + 300, dur: 760 });
          S.to(id, { opacity: 0 }, { delay: t + 500, dur: 300 });
          S.data({ '输出条数': ++nOut }, { delay: t + 1060 }); S.log('Probe(' + k + ') 命中 → 输出', { delay: t + 300, kind: 'ok' });
          return t + 1150;
        }
        S.flash('sl' + h, C.red, { prop: 'stroke', delay: t }); S.to(id, { fill: C.red }, { delay: t, dur: 250 });
        S.to(id, { scale: .2, opacity: 0 }, { delay: t + 500, dur: 400, ease: 'in' });
        S.log('Probe(' + k + ')：槽 ' + h + ' 是空的 → 无匹配', { delay: t, kind: 'err' });
        return t + 950;
      }

      S.step('阶段 1 · Build：扫 R，对每个元组算 h(key)，放进哈希表对应的槽', function () {
        S.code([1, 4]); S.log('Build：扫 R'); insert(200, 0);
      });
      S.step('14 也 hash 到槽 2，可那里已经有 8 了 → 线性探测，往下找到空槽 3', function () {
        S.code(4); insert(0, 1);
      });
      S.step('11 和 6 各就各位。槽里至少要存连接键本身，探测时才有东西可比', function () {
        S.code(4); var t = insert(0, 2); insert(t - 300, 3);
      });
      S.step('R 扫完，哈希表建好了 —— 没建完之前不能探测，否则会漏掉匹配', function () {
        S.code([5, 6]); S.set('hTL', { text: '' });
        S.flash('ht', C.green, { prop: 'stroke' }); S.pulse('ht', { scale: 1.03 });
        for (var i = 0; i < 6; i++) if (table[i]) S.pulse('r' + table[i].i, { delay: 200 + i * 110 });
        S.set('ph', { text: '阶段 2 · Probe' }, { delay: 700 }); S.pulse('ph', { delay: 700 });
        S.data({ '阶段': 'Probe', '当前 key': '—', 'h(key)': '—' }, { delay: 700 }); S.log('Build 完成：4 条', { delay: 300, kind: 'ok' });
      });
      S.step('阶段 2 · Probe：扫 S，用同一个 h。6 落到槽 0，再真的比一次 key：6 = 6 → 输出', function () {
        S.code([6, 10]); S.log('Probe：扫 S'); probe(200, 0);
      });
      S.step('14 落到槽 2，里面是 8 ≠ 14（哈希冲突）→ 继续往下探测；槽 3 是 14 → 命中', function () {
        S.code([8, 10]); probe(0, 1);
      });
      S.step('20 也落到槽 2：8 ≠ 20、14 ≠ 20，再往下是空槽 → R 里没有 20，丢弃', function () {
        S.code([8, 9]); probe(0, 2);
      });
      S.step('8 落到槽 2，8 = 8 → 命中输出', function () {
        S.code([8, 10]); probe(0, 3);
      });
      S.step('两个 for 循环先后各跑一遍，不再嵌套：R、S 的每个元组都只碰一次', function () {
        S.code(12); S.set('hTR', { text: '' });
        S.flash('out', C.green, { prop: 'stroke' }); S.pulse('tIns', { delay: 300 }); S.pulse('tPr', { delay: 500 });
        S.to('ht', { opacity: .45 }, { delay: 800, dur: 500 });
        for (var i = 0; i < 6; i++) { S.to('sl' + i, { opacity: .45 }, { delay: 800, dur: 500 }); if (table[i]) S.to('r' + table[i].i, { opacity: .45 }, { delay: 800, dur: 500 }); }
        S.data({ '阶段': '完成', '当前 key': '—', 'h(key)': '—' }); S.log('连接完成：输出 3 条', { delay: 400, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 4：Grace 哈希连接 ───────────────────────── */
  {
    name: 'Grace 哈希连接',
    moving: 'R、S 的元组穿过同一个 h₁ 飞进各自那一层的桶；每层的 R 桶飞进内存建表、S 桶飞来探测；命中的飞进输出；用完的哈希表缩小消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 阶段 1：分区（R、S 用同一个 h1）',
      'for (Tuple& r : R)',
      '  Rpart[h1(r.key) % k].Append(r);',
      'for (Tuple& s : S)',
      '  Spart[h1(s.key) % k].Append(s);',
      '// 阶段 2：逐层连接',
      'for (int i = 0; i < k; i++) {',
      '  HashTable ht;               // 装得下内存',
      '  for (Tuple& r : Rpart[i]) ht.Insert(r);',
      '  for (Tuple& s : Spart[i])',
      '    if (ht.Probe(s.key)) Emit(s);',
      '}                             // ht 用完就扔',
      '// 成本 = 3 × (M + N)'
    ].join('\n'),
    build: function (S) {
      var Rk = [6, 4, 8, 3, 7, 5], Sk = [4, 9, 8, 6, 4, 2], LY = [150, 290, 430], H1 = [182, 290], TY = [142, 198], OY = [358, 400, 442, 484];
      var bR = [[], [], []], bS = [[], [], []], pR = [], pS = [], nOut = 0, i;
      Rk.forEach(function (k, i) { var b = k % 3, n = bR[b].length; bR[b].push(i); pR[i] = { x: 300 + (n ? 28 : -28), y: LY[b] + 10 }; });
      Sk.forEach(function (k, i) { var b = k % 3, n = bS[b].length; bS[b].push(i); pS[i] = { x: 446 + (n ? 28 : -28), y: LY[b] + 10 }; });
      S.text('note', { x: 20, y: 24, text: 'k = 3 个分区、h₁(key) = key mod 3、每张表 6 条 —— 示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('lR', { x: 76, y: 66, text: 'R', color: C.mute, size: 16 }); S.text('lS', { x: 76, y: 362, text: 'S', color: C.mute, size: 16 });
      S.text('lP', { x: 373, y: 66, text: '磁盘 · 两张表各分成 3 个桶', color: C.mute });
      [0, 1, 2].forEach(function (b) {
        S.box('ln' + b, { x: 373, y: LY[b], w: 296, h: 114, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
        S.box('bR' + b, { x: 300, y: LY[b], w: 126, h: 92, rx: 10, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.box('bS' + b, { x: 446, y: LY[b], w: 126, h: 92, rx: 10, fill: C.panel, stroke: C.line, sw: 1.5 });
        lab(S, 'tR' + b, 248, LY[b] - 28, 'R' + '₀₁₂'.charAt(b), { size: 15 });
        lab(S, 'tS' + b, 394, LY[b] - 28, 'S' + '₀₁₂'.charAt(b), { size: 15 });
      });
      S.box('ht', { x: 710, y: 172, w: 224, h: 180, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      lab(S, 'lH', 606, 66, '内存 · 哈希表（装 Rᵢ）');
      TY.forEach(function (y, n) { S.box('sl' + n, { x: 710, y: y, w: 196, h: 44, rx: 8, fill: C.panel, stroke: C.line, sw: 1.5 }); });
      S.text('miss', { x: 782, y: 240, text: '', color: C.red, size: 15 });
      S.box('out', { x: 710, y: 418, w: 224, h: 210, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      lab(S, 'lO', 606, 300, '输出');
      S.dot('h1', { x: H1[0], y: H1[1], r: 24, fill: C.purple, label: 'h₁', size: 17 });
      for (i = 0; i < 6; i++) [104, 400].forEach(function (y0, n) { S.box('gh' + n + i, { x: i & 1 ? 104 : 48, y: y0 + (i >> 1) * 42, w: 50, h: 32, rx: 6, fill: 'none', stroke: C.line, sw: 1.5, dash: '4 4', opacity: .6 }); });
      Rk.forEach(function (k, i) { S.box('R' + i, { x: i & 1 ? 104 : 48, y: 104 + (i >> 1) * 42, w: 50, h: 32, rx: 6, fill: KEY, stroke: 'none', sw: 0, label: String(k), size: 16, trail: 3 }); });
      Sk.forEach(function (k, i) { S.box('Q' + i, { x: i & 1 ? 104 : 48, y: 400 + (i >> 1) * 42, w: 50, h: 32, rx: 6, fill: '#3d3672', stroke: 'none', sw: 0, label: String(k), size: 16, trail: 3 }); });
      lab(S, 'fm', 40, 536, '成本 = 3 × (M + N)：分区时读一遍、写一遍，探测时再读一遍', { color: C.amber, size: 16, opacity: 0 });
      S.data({ '阶段': '—', '当前层': '—', '哈希表': '空', '输出条数': 0 });

      function part(t, id, p, fill) {       /* 一条元组 → h₁ → 它那一层的桶 */
        S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 180 });
        S.move(id, H1[0], H1[1], { delay: t + 80, dur: 460, ease: 'in' });
        S.pulse('h1', { delay: t + 520 });
        S.move(id, p.x, p.y, { delay: t + 540, dur: 520, ease: 'out' });
        S.to(id, { fill: fill, color: C.ink }, { delay: t + 1060, dur: 220 });
        S.ripple(p.x, p.y, { delay: t + 1060, color: C.cyan });
        return t + 1100;
      }
      function level(b, t) {                /* 第 b 层：R 桶建表 → S 桶探测 → 扔掉哈希表 */
        var keys = [];
        S.to('ln' + b, { stroke: C.blue }, { delay: t, dur: 300 }); S.data({ '当前层': b }, { delay: t });
        bR[b].forEach(function (i, n) {
          var d = t + 200 + n * 420;
          S.to('R' + i, { x: 680, y: TY[n], w: 64, h: 34 }, { delay: d, dur: 720 });
          S.ripple(680, TY[n], { delay: d + 720, color: C.blue }); S.flash('sl' + n, C.blue, { prop: 'stroke', delay: d + 720 });
          keys.push(Rk[i]);
        });
        t += 200 + 420 + 900;
        S.data({ '哈希表': 'R' + '₀₁₂'.charAt(b) + ' = {' + keys.join(', ') + '}' }, { delay: t - 200 }); S.log('第 ' + b + ' 层：R 桶 {' + keys.join(', ') + '} 建表', { delay: t - 900 });
        bS[b].forEach(function (i) {
          var id = 'Q' + i, k = Sk[i], n = keys.indexOf(k);
          if (n >= 0) {
            S.to(id, { x: 756, y: TY[n], w: 64, h: 34 }, { delay: t, dur: 700 });
            S.flash('R' + bR[b][n], C.green, { delay: t + 700, hold: 400, dur: 350 }); S.pulse('R' + bR[b][n], { delay: t + 700 });
            S.to(id, { fill: C.green, color: C.bg }, { delay: t + 700, dur: 200 });
            S.fly([718, TY[n]], [710, OY[nOut]], { id: 'o' + nOut, label: '(' + k + ', ' + k + ')', w: 150, h: 34, size: 15, color: C.green, keep: true, delay: t + 950, dur: 700 });
            S.to(id, { opacity: 0 }, { delay: t + 1100, dur: 300 });
            S.data({ '输出条数': ++nOut }, { delay: t + 1650 }); S.log('Probe(' + k + ') 命中 → 输出', { delay: t + 700, kind: 'ok' });
            t += 1500;
          } else {
            S.to(id, { x: 710, y: 240, w: 64, h: 34 }, { delay: t, dur: 700 });
            S.to(id, { fill: C.red }, { delay: t + 700, dur: 200 });
            S.set('miss', { text: '没有匹配' }, { delay: t + 700 });
            S.to(id, { scale: .2, opacity: 0 }, { delay: t + 1150, dur: 350, ease: 'in' });
            S.set('miss', { text: '' }, { delay: t + 1500 });
            S.log('Probe(' + k + ') 没有匹配', { delay: t + 700, kind: 'err' });
            t += 1500;
          }
        });
        bR[b].forEach(function (i) { S.to('R' + i, { scale: .2, opacity: 0 }, { delay: t, dur: 400, ease: 'in' }); });
        ['ln', 'bR', 'bS', 'tR', 'tS'].forEach(function (p) { S.to(p + b, { opacity: .4 }, { delay: t, dur: 400 }); });
        S.set('ln' + b, { stroke: C.line }, { delay: t + 400 });
        S.data({ '哈希表': '空（已扔掉）' }, { delay: t + 400 });
        return t + 450;
      }

      S.step('阶段 1 · 分区：用 h₁ 扫 R，把每条元组分到 k = 3 个桶之一', function () {
        S.code([1, 3]); S.log('分区 R（h₁）'); S.data({ '阶段': '1 · 分区' });
        Rk.forEach(function (k, i) { part(i * 330, 'R' + i, pR[i], KEY); });
      });
      S.step('用【同一个】h₁ 扫 S，也分成 3 个桶；桶页写满了就写盘、开新页', function () {
        S.code([4, 5]); S.log('分区 S（同一个 h₁）');
        Sk.forEach(function (k, i) { part(i * 330, 'Q' + i, pS[i], '#3d3672'); });
      });
      S.step('哈希函数是确定性的：相同的 key 一定落在同一层 → 只需要 R₀ 对 S₀、R₁ 对 S₁、R₂ 对 S₂', function () {
        S.code([6, 7]);
        [0, 1, 2].forEach(function (b) { S.flash('ln' + b, C.green, { prop: 'stroke', delay: b * 450 }); S.pulse('ln' + b, { delay: b * 450, scale: 1.03 }); });
        [['R0', 'Q3'], ['R1', 'Q0'], ['R2', 'Q2']].forEach(function (p, b) { S.pulse(p[0], { delay: b * 450 + 150 }); S.pulse(p[1], { delay: b * 450 + 250 }); });
        S.log('同层才可能匹配', { delay: 300, kind: 'ok' });
      });
      S.step('阶段 2 · 第 0 层：把 R₀ 读进内存建哈希表；再读 S₀ 逐条探测 —— 9 没有匹配，6 命中', function () {
        S.code([8, 11]); S.data({ '阶段': '2 · 逐层连接' }); level(0, 0);
      });
      S.step('扔掉哈希表，换下一层：R₁ 建表，S₁ 探测 —— 两个 4 都命中', function () {
        S.code([7, 11]); level(1, 0);
      });
      S.step('第 2 层：R₂ 建表，S₂ 探测 —— 8 命中，2 落空', function () {
        S.code([7, 11]); level(2, 0);
      });
      S.step('成本 = 3 × (M + N)：分区阶段把两张表读一遍、写一遍，探测阶段再读一遍', function () {
        S.code(13); S.data({ '阶段': '完成', '当前层': '—' });
        S.pop('fm'); S.flash('out', C.green, { prop: 'stroke', delay: 300 });
        S.log('连接完成：输出 4 条', { delay: 400, kind: 'ok' });
      }, { hold: 1800 });
    }
  }
  ]
});
})();
