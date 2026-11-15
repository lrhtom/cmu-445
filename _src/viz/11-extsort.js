/* #11 外部归并排序：Pass 0 生成 run / 两路归并 / K 路归并的趟数 / 外部哈希聚合
 * 场景 1、2、4 里的页数、键值、哈希值是为了画得下而取的示意值；场景 3 用的是笔记 6.3 的官方算例（N=108, B=5）。 */
(function () {
var C = Viz.C, KEY = '#2b4172', DONE = '#1d6b57';
function mk(S, type, id, base, o) { for (var k in o) base[k] = o[k]; S[type](id, base); }
function key(S, id, x, y, label, o) {
  mk(S, 'box', id, { x: x, y: y, w: 42, h: 34, rx: 6, fill: KEY, stroke: 'none', sw: 0, label: String(label), size: 16, trail: 3 }, o);
}
function page(S, id, x, y, o) {
  mk(S, 'box', id, { x: x, y: y, w: 108, h: 52, rx: 9, fill: C.panel, stroke: C.line, sw: 2 }, o);
}
function lab(S, id, x, y, text, o) {
  mk(S, 'text', id, { x: x, y: y, text: text, anchor: 'start', color: C.mute, size: 15 }, o);
}

Viz.register('extsort', {
  title: '外部归并排序与外部哈希聚合',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #11 排序与聚合（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/11-sorting.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #11 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/11-sorting.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Project #3 查询执行', u: 'https://15445.courses.cs.cmu.edu/fall2025/project3/' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：Pass 0 ───────────────────────── */
  {
    name: 'Pass 0：切成有序 run',
    moving: '键从磁盘页飞进缓冲页；在内存里滑到排好序的位置；再飞回磁盘组成 run；读/写页数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// Pass 0（排序趟）：把输入切成有序 run',
      'void Pass0(File& in, int B) {',
      '  while (!in.Eof()) {',
      '    // B 个缓冲页全部用来读',
      '    Page* buf = in.ReadPages(B);',
      '    SortInMemory(buf, B);   // 快排等',
      '    runs.push_back(WriteRun(buf, B));',
      '  }',
      '}',
      '// 产出 ⌈N/B⌉ 个 run，每个 B 页',
      '// 本趟 I/O = 读 N 页 + 写 N 页 = 2N'
    ].join('\n'),
    build: function (S) {
      var PX = [95, 229, 363, 497, 631, 765], MX = [270, 430, 590], RX = [[95, 215, 335], [525, 645, 765]];
      var yIn = 114, yM = 280, yOut = 470;
      var data = [[7, 2], [9, 4], [1, 8], [6, 3], [11, 5], [10, 12]];
      function ms(j) { return MX[j >> 1] + (j & 1 ? 28 : -28); }
      S.text('note', { x: 20, y: 24, text: 'N = 6 页、每页 2 个键、B = 3 个缓冲页 —— 示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tRd', { x: 716, y: 24, anchor: 'end', val: 0, pre: '读 ', suf: ' 页', color: C.amber, size: 16 });
      S.text('tWr', { x: 840, y: 24, anchor: 'end', val: 0, pre: '写 ', suf: ' 页', color: C.amber, size: 16 });
      lab(S, 'lIn', 41, 66, '磁盘 · 未排序的输入（N = 6 页）');
      lab(S, 'lMem', 150, 204, '内存 · 缓冲池（B = 3 页）');
      lab(S, 'lOut', 41, 398, '磁盘 · 排好序的 run');
      S.box('mem', { x: 430, y: yM, w: 560, h: 116, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      MX.forEach(function (x, i) { page(S, 'mf' + i, x, yM, { w: 124, h: 62 }); });
      [0, 1].forEach(function (b) {
        S.box('run' + b, { x: RX[b][1], y: yOut, w: 370, h: 84, rx: 14, fill: 'none', stroke: C.green, sw: 2, opacity: 0 });
        RX[b].forEach(function (x, p) { page(S, 'rp' + b + p, x, yOut, { opacity: 0 }); });
        S.text('rl' + b, { x: RX[b][1], y: yOut + 60, text: 'run ' + (b + 1) + '（3 页）', color: C.green, size: 15, opacity: 0 });
      });
      PX.forEach(function (x, p) {
        page(S, 'pg' + p, x, yIn);
        data[p].forEach(function (v, k) { key(S, 'k' + p + k, x + (k ? 26 : -26), yIn, v); });
      });
      S.text('sum', { x: 430, y: 366, text: '⌈N/B⌉ = ⌈6/3⌉ = 2 个 run，每个 B = 3 页；本趟 I/O = 2N = 12', color: C.amber, size: 16, opacity: 0 });
      S.data({ N: 6, B: 3, '已读页': 0, '已写页': 0, 'run 数': 0 });

      S.step('磁盘上有 N = 6 页未排序的数据，内存里只有 B = 3 个缓冲页 —— 装不下', function () {
        S.code([1, 2]); S.log('ExternalSort：N = 6，B = 3');
        PX.forEach(function (x, p) { S.flash('pg' + p, C.amber, { prop: 'stroke', delay: p * 110 }); });
        MX.forEach(function (x, i) { S.pulse('mf' + i, { delay: 800 + i * 160, scale: 1.08 }); S.flash('mf' + i, C.blue, { prop: 'stroke', delay: 800 + i * 160 }); });
      });

      function batch(b) {
        var ids = [], vals = [], p, k;
        for (p = 0; p < 3; p++) for (k = 0; k < 2; k++) { ids.push('k' + (b * 3 + p) + k); vals.push(data[b * 3 + p][k]); }
        var rank = vals.map(function (v) { return vals.filter(function (w) { return w < v; }).length; });
        var sorted = vals.slice().sort(function (x, y) { return x - y; });
        S.step(b ? '再读入后 3 页，同样占满全部缓冲页' : '读入前 3 页：Pass 0 里 B 个缓冲页全部用来装输入', function () {
          S.code([4, 5]); S.log('读入第 ' + (b * 3 + 1) + '–' + (b * 3 + 3) + ' 页', { kind: 'io' });
          for (var p = 0; p < 3; p++) {
            var d = p * 380, pg = 'pg' + (b * 3 + p);
            S.flash(pg, C.blue, { prop: 'stroke', delay: d, hold: 260, dur: 280 });
            S.move('k' + (b * 3 + p) + '0', ms(p * 2), yM, { delay: d + 150, dur: 780 });
            S.move('k' + (b * 3 + p) + '1', ms(p * 2 + 1), yM, { delay: d + 240, dur: 780 });
            S.to(pg, { opacity: .35 }, { delay: d + 600, dur: 400 });
            S.count('tRd', b * 3 + p + 1, { delay: d + 930, dur: 300 });
            S.pulse('mf' + p, { delay: d + 1020, scale: 1.06 });
          }
          S.data({ '已读页': b * 3 + 3 }, { delay: 1800 });
        }, { hold: 1400 });
        S.step('在内存里把这 3 页的键排好（用你喜欢的内存排序算法）', function () {
          S.code(6); S.log('内存排序 → ' + sorted.join(' '));
          ids.forEach(function (id, i) {
            var d = i * 100;
            S.to(id, { fill: C.amber, color: C.bg }, { delay: d, dur: 200 });
            S.move(id, ms(rank[i]), yM, { delay: d + 150, dur: 820 });
            S.to(id, { fill: DONE, color: C.ink }, { delay: d + 1000, dur: 300 });
          });
          MX.forEach(function (x, i) { S.flash('mf' + i, C.green, { prop: 'stroke', delay: 1700 + i * 100 }); });
        }, { hold: 1400 });
        S.step('写回磁盘 → 得到第 ' + (b + 1) + ' 个有序 run（3 页）', function () {
          S.code(7); S.log('写出 run ' + (b + 1) + '（3 页）', { kind: 'io' });
          S.pop('run' + b);
          for (var p = 0; p < 3; p++) {
            var d = 150 + p * 330;
            S.pop('rp' + b + p, { delay: d });
            ids.forEach(function (id, i) {
              var r = rank[i];
              if ((r >> 1) !== p) return;
              var tx = RX[b][p] + (r & 1 ? 26 : -26);
              S.move(id, tx, yOut, { delay: d + 150 + (r & 1) * 90, dur: 820 });
              S.ripple(tx, yOut, { delay: d + 970 + (r & 1) * 90, color: C.green });
            });
            S.count('tWr', b * 3 + p + 1, { delay: d + 1000, dur: 300 });
          }
          S.pop('rl' + b, { delay: 1700 });
          S.data({ '已写页': b * 3 + 3, 'run 数': b + 1 }, { delay: 1800 });
        }, { hold: 1400 });
      }
      batch(0); batch(1);

      S.step('Pass 0 结束：得到 ⌈N/B⌉ 个 run，每个 B 页；这一趟把 N 页读一遍、写一遍', function () {
        S.code([10, 11]);
        S.flash('run0', C.amber, { prop: 'stroke' }); S.pulse('rl0');
        S.flash('run1', C.amber, { prop: 'stroke', delay: 300 }); S.pulse('rl1', { delay: 300 });
        S.pop('sum', { delay: 600 });
        S.pulse('tRd', { delay: 900 }); S.pulse('tWr', { delay: 1050 });
        S.log('Pass 0 完成：2 个 run，I/O = 6 读 + 6 写', { delay: 700, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 2：两路归并 ───────────────────────── */
  {
    name: '两路归并（B = 3）',
    moving: '两个迭代器框在输入页里逐格前进；较小的键变绿飞进输出页；输出页满了整页飞回磁盘；读完的输入页换上下一页',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 两路归并：2 页输入 + 1 页输出 = 3 页',
      'Run Merge(Run& A, Run& B) {',
      '  Page a = A.NextPage(), b = B.NextPage();',
      '  while (a.Valid() && b.Valid()) {',
      '    if (a.Cur() <= b.Cur()) out.Add(a.Pop());',
      '    else                    out.Add(b.Pop());',
      '    if (out.Full()) Flush(out);  // 写盘并清空',
      '    if (a.Empty()) a = A.NextPage();',
      '    if (b.Empty()) b = B.NextPage();',
      '  }',
      '  CopyRest(a.Valid() ? A : B);  // 剩下的照抄',
      '}'
    ].join('\n'),
    build: function (S) {
      var yA = 165, yB = 400, yO = 282, DX = [84, 200], IX = [362, 418], OX = [517, 573], OPX = 745, OPY = [125, 220, 315, 410];
      var A = [2, 5, 8, 9], B = [3, 4, 6, 7], rd = 0, wr = 0;
      S.text('note', { x: 20, y: 24, text: '两个 2 页的 run、每页 2 个键 —— 示意值；B = 3 是二路归并的最低要求', anchor: 'start', size: 14, color: C.mute });
      S.text('tRd', { x: 716, y: 24, anchor: 'end', val: 0, pre: '读 ', suf: ' 页', color: C.amber, size: 16 });
      S.text('tWr', { x: 840, y: 24, anchor: 'end', val: 0, pre: '写 ', suf: ' 页', color: C.amber, size: 16 });
      lab(S, 'lDisk', 30, 66, '磁盘 · 上一趟的 run');
      lab(S, 'lA', 30, yA - 44, 'run A（有序）'); lab(S, 'lB', 30, yB - 44, 'run B（有序）');
      S.text('lMem', { x: 468, y: 94, text: '内存 · 缓冲池（B = 3 页）', color: C.mute });
      S.text('lO', { x: OPX, y: 66, text: '磁盘 · 归并出的 run', color: C.mute });
      S.box('mem', { x: 468, y: 282, w: 350, h: 420, rx: 14, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      page(S, 'fa', 390, yA, { w: 124, h: 62 }); page(S, 'fb', 390, yB, { w: 124, h: 62 }); page(S, 'fo', 545, yO, { w: 124, h: 62 });
      S.text('la', { x: 390, y: yA + 48, text: '输入页 · 读 A', color: C.mute, size: 14 });
      S.text('lb', { x: 390, y: yB + 48, text: '输入页 · 读 B', color: C.mute, size: 14 });
      S.text('lo', { x: 545, y: yO + 48, text: '输出页', color: C.mute, size: 14 });
      S.line('ea', { x1: 258, y1: yA, x2: 322, y2: yA, arrow: true }); S.line('eb', { x1: 258, y1: yB, x2: 322, y2: yB, arrow: true });
      S.line('eo', { x1: 612, y1: yO, x2: 684, y2: yO, arrow: true });
      OPY.forEach(function (y, k) { page(S, 'op' + k, OPX, y, { opacity: .4, dash: '6 5' }); });
      [0, 1].forEach(function (p) {
        page(S, 'dA' + p, DX[p], yA); page(S, 'dB' + p, DX[p], yB);
        [0, 1].forEach(function (k) {
          key(S, 'a' + (p * 2 + k), DX[p] + (k ? 26 : -26), yA, A[p * 2 + k]);
          key(S, 'b' + (p * 2 + k), DX[p] + (k ? 26 : -26), yB, B[p * 2 + k]);
        });
      });
      S.box('cA', { x: IX[0], y: yA, w: 52, h: 44, rx: 9, fill: 'none', stroke: C.purple, sw: 3, opacity: 0 });
      S.box('cB', { x: IX[0], y: yB, w: 52, h: 44, rx: 9, fill: 'none', stroke: C.purple, sw: 3, opacity: 0 });
      S.text('sum', { x: 468, y: 520, text: '2 个 2 页的 run → 1 个 4 页的 run；任何时刻内存里只有 3 页', color: C.amber, size: 16, opacity: 0 });
      S.data({ 'A 迭代器': '—', 'B 迭代器': '—', '输出页': '[ ]', '已读页': 0, '已写页': 0 });

      function load(t, side, p) {           /* 把 run 的第 p 页读进输入页 */
        var y = side === 'a' ? yA : yB, pg = 'd' + side.toUpperCase() + p;
        S.flash(pg, C.blue, { prop: 'stroke', delay: t, hold: 260, dur: 280 });
        S.flash('e' + side, C.blue, { prop: 'stroke', delay: t + 100 });
        S.move(side + (p * 2), IX[0], y, { delay: t + 150, dur: 760 });
        S.move(side + (p * 2 + 1), IX[1], y, { delay: t + 240, dur: 760 });
        S.to(pg, { opacity: .35 }, { delay: t + 600, dur: 400 });
        S.count('tRd', ++rd, { delay: t + 900, dur: 300 });
        S.pulse('f' + side, { delay: t + 1000, scale: 1.06 });
        S.data({ '已读页': rd }, { delay: t + 900 });
        return t + 1100;
      }
      function cmp(t, x, y) {
        S.flash(x, C.blue, { delay: t, hold: 260, dur: 280 }); S.pulse(x, { delay: t });
        S.flash(y, C.blue, { delay: t + 120, hold: 260, dur: 280 }); S.pulse(y, { delay: t + 120 });
        return t + 720;
      }
      function win(t, id, slot) {
        S.to(id, { fill: C.green, color: C.bg }, { delay: t, dur: 250 });
        S.move(id, OX[slot], yO, { delay: t + 220, dur: 720 });
        S.ripple(OX[slot], yO, { delay: t + 940, color: C.green });
        return t + 1000;
      }
      function flush(t, ids) {
        var k = wr, y = OPY[k];
        S.flash('fo', C.amber, { prop: 'stroke', delay: t, hold: 300, dur: 300 });
        S.flash('eo', C.amber, { prop: 'stroke', delay: t + 150 });
        S.to('op' + k, { opacity: 1 }, { delay: t + 250, dur: 300 }); S.set('op' + k, { dash: '' }, { delay: t + 250 });
        ids.forEach(function (id, i) {
          S.move(id, OPX + (i ? 26 : -26), y, { delay: t + 250 + i * 90, dur: 800 });
          S.to(id, { fill: DONE, color: C.ink }, { delay: t + 1100 + i * 90, dur: 300 });
        });
        S.ripple(OPX, y, { delay: t + 1100, color: C.green });
        S.count('tWr', ++wr, { delay: t + 1100, dur: 300 });
        S.data({ '输出页': '[ ]（已写盘）', '已写页': wr }, { delay: t + 1100 });
        S.log('输出页满 → 写盘（第 ' + wr + ' 页）', { delay: t + 250, kind: 'io' });
        return t + 1400;
      }

      S.step('归并 run A 和 run B：先把两边各自的第 1 页读进输入页', function () {
        S.code(3); S.log('Merge(A, B)');
        load(0, 'a', 0); var t = load(550, 'b', 0);
        S.pop('cA', { delay: t }); S.pop('cB', { delay: t + 150 });
        S.data({ 'A 迭代器': 2, 'B 迭代器': 3 }, { delay: t });
      });
      S.step('比较两个迭代器指向的键：2 < 3 → 小的写进输出页，A 的迭代器前进一格', function () {
        S.code(4);
        var t = cmp(0, 'a0', 'b0'); S.code(5, { delay: t });
        t = win(t, 'a0', 0);
        S.move('cA', IX[1], yA, { delay: t - 200, dur: 450 });
        S.data({ 'A 迭代器': 5, '输出页': '[2]' }, { delay: t }); S.log('2 < 3 → 输出 2', { delay: t - 60 });
      });
      S.step('5 > 3 → 3 进输出页，B 的迭代器前进；输出页满了', function () {
        S.code(4);
        var t = cmp(0, 'a1', 'b0'); S.code(6, { delay: t });
        t = win(t, 'b0', 1);
        S.move('cB', IX[1], yB, { delay: t - 200, dur: 450 });
        S.to('fo', { stroke: C.amber }, { delay: t, dur: 300 }); S.pulse('fo', { delay: t, scale: 1.06 });
        S.data({ 'B 迭代器': 4, '输出页': '[2, 3] 满' }, { delay: t }); S.log('5 > 3 → 输出 3', { delay: t - 60 });
      });
      S.step('输出页满 → 写盘、清空，然后复用同一页', function () {
        S.code(7); S.to('fo', { stroke: C.line }, { delay: 1300, dur: 300 });
        flush(0, ['a0', 'b0']);
      });
      S.step('5 > 4 → 4 进输出页；B 的这一页读完了 → 换上 run B 的下一页', function () {
        S.code(4);
        var t = cmp(0, 'a1', 'b1'); S.code(6, { delay: t });
        t = win(t, 'b1', 0); S.log('5 > 4 → 输出 4', { delay: t - 60 });
        S.code(9, { delay: t + 100 });
        S.move('cB', IX[0], yB, { delay: t + 300, dur: 500 });
        load(t + 100, 'b', 1);
        S.data({ 'B 迭代器': 6, '输出页': '[4]' }, { delay: t + 1000 });
      });
      S.step('5 < 6 → 5 进输出页，页满写盘；A 的这一页也读完了 → 换上 run A 的下一页', function () {
        S.code(4);
        var t = cmp(0, 'a1', 'b2'); S.code(5, { delay: t });
        t = win(t, 'a1', 1); S.log('5 < 6 → 输出 5', { delay: t - 60 });
        S.code(7, { delay: t + 100 });
        var t2 = flush(t + 100, ['b1', 'a1']);
        S.code(8, { delay: t2 - 300 });
        S.move('cA', IX[0], yA, { delay: t2 - 100, dur: 500 });
        load(t2 - 300, 'a', 1);
        S.data({ 'A 迭代器': 8 }, { delay: t2 + 600 });
      });
      S.step('8 > 6、8 > 7 → 6 和 7 依次进输出页，写盘；run B 走完了', function () {
        S.code(4);
        var t = cmp(0, 'a2', 'b2'); S.code(6, { delay: t });
        t = win(t, 'b2', 0);
        S.move('cB', IX[1], yB, { delay: t - 200, dur: 450 }); S.data({ 'B 迭代器': 7, '输出页': '[6]' }, { delay: t });
        t = cmp(t + 100, 'a2', 'b3');
        t = win(t, 'b3', 1); S.log('输出 6、7', { delay: t - 60 });
        S.code(7, { delay: t + 100 });
        t = flush(t + 100, ['b2', 'b3']);
        S.hide('cB', { delay: t - 600 }); S.data({ 'B 迭代器': '走完了' }, { delay: t - 600 });
        S.log('run B 已耗尽', { delay: t - 500, kind: 'warn' });
      });
      S.step('一边先走完 → 把另一边剩下的整个抄过去（run 内部本来就有序）', function () {
        S.code(11);
        var t = win(0, 'a2', 0);
        S.move('cA', IX[1], yA, { delay: 500, dur: 400 });
        t = win(500, 'a3', 1);
        S.hide('cA', { delay: t });
        t = flush(t + 100, ['a2', 'a3']);
        S.data({ 'A 迭代器': '走完了' }, { delay: t - 600 }); S.log('照抄 A 剩下的 8、9', { delay: 300 });
      });
      S.step('归并完成：读 4 页 + 写 4 页；每个 run 只需要留当前那一页在内存里，永远不用回头', function () {
        S.code([1, 2]);
        OPY.forEach(function (y, k) { S.flash('op' + k, C.green, { prop: 'stroke', delay: 150 + k * 220 }); });
        S.fly([OPX + 70, OPY[0]], [OPX + 70, OPY[3]], { color: C.green, delay: 150, dur: 900, ease: 'linear' });
        S.pop('sum', { delay: 900 });
        S.log('得到 1 个 4 页的 run：2 3 4 5 6 7 8 9', { delay: 1000, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 3：K 路归并与趟数 ───────────────────────── */
  {
    name: 'K 路归并与趟数',
    moving: '22 个 run 小块每趟向下滑一行并按 4 个一组靠拢成更大的 run；原位置留下虚线轮廓；趟数和累计 I/O 滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 一般形式：N 页数据，B 个缓冲页',
      'int ExternalSort(int N, int B) {',
      '  // Pass 0：读满 B 页 → 排序 → 写回',
      '  int runs = ceil(1.0 * N / B), passes = 1;',
      '  // Pass 1..n：B-1 页读输入，1 页写输出',
      '  while (runs > 1) {',
      '    runs = ceil(1.0 * runs / (B - 1));',
      '    passes++;      // 每趟读 N 页 + 写 N 页',
      '  }',
      '  return passes;',
      '}',
      '// 趟数   = 1 + ⌈log_(B-1) ⌈N/B⌉⌉',
      '// 总 I/O = 2N × 趟数'
    ].join('\n'),
    build: function (S) {
      var Y = [148, 250, 356, 462], i, g;
      function x0(i) { return 52 + 36 * i; }
      function gc(g) { return g < 5 ? 106 + 144 * g : 790; }
      function x1(i) { var g = i >> 2, n = g < 5 ? 4 : 2; return gc(g) + ((i & 3) - (n - 1) / 2) * 31; }
      function x2(i) { return i < 16 ? 307 + (i - 7.5) * 31 : 708 + (i - 16 - 2.5) * 31; }
      function x3(i) { return 430 + (i - 10.5) * 31; }
      S.text('note', { x: 20, y: 24, text: 'N = 108 页、B = 5 页 —— 笔记 6.3 的官方算例；每个小块代表 Pass 0 产出的 1 个 run', anchor: 'start', size: 14, color: C.mute });
      lab(S, 'tBuf', 37, 68, '缓冲池 B = 5：');
      for (i = 0; i < 5; i++) S.box('bf' + i, { x: 172 + i * 38 + (i === 4 ? 14 : 0), y: 68, w: 32, h: 28, rx: 6, fill: C.panel, stroke: i === 4 ? C.green : C.blue, sw: 2, label: i === 4 ? '出' : '入', size: 14 });
      S.text('tPass', { x: 620, y: 68, anchor: 'end', val: 0, pre: '已跑趟数 ', color: C.amber, size: 16 });
      S.text('tIO', { x: 823, y: 68, anchor: 'end', val: 0, pre: '累计 I/O ', color: C.amber, size: 16 });
      lab(S, 'l0', 37, Y[0] - 38, 'Pass 0 → ⌈108/5⌉ = 22 个 run，每个 5 页（最后一个 3 页）', { opacity: 0, color: C.ink });
      lab(S, 'l1', 37, Y[1] - 40, 'Pass 1 → ⌈22/4⌉ = 6 个 run，每个 20 页（最后一个 8 页）', { opacity: 0, color: C.ink });
      lab(S, 'l2', 37, Y[2] - 40, 'Pass 2 → ⌈6/4⌉ = 2 个 run：80 页 + 28 页', { opacity: 0, color: C.ink });
      lab(S, 'l3', 37, Y[3] - 40, 'Pass 3 → 1 个 run，108 页全部有序', { opacity: 0, color: C.ink });
      for (i = 0; i < 22; i++) S.box('g' + i, { x: x0(i), y: Y[0], w: 30, h: 34, rx: 5, fill: 'none', stroke: C.line, sw: 1.5, dash: '4 4', opacity: 0 });
      for (g = 0; g < 6; g++) {
        S.box('f1' + g, { x: gc(g), y: Y[1], w: (g < 5 ? 4 : 2) * 31 + 10, h: 46, rx: 9, fill: 'none', stroke: C.amber, sw: 2, opacity: 0 });
        S.text('s1' + g, { x: gc(g), y: Y[1] + 37, text: g < 5 ? '20 页' : '8 页', size: 14, color: C.mute, opacity: 0 });
      }
      S.box('f20', { x: 307, y: Y[2], w: 506, h: 46, rx: 9, fill: 'none', stroke: C.amber, sw: 2, opacity: 0 });
      S.box('f21', { x: 708, y: Y[2], w: 196, h: 46, rx: 9, fill: 'none', stroke: C.amber, sw: 2, opacity: 0 });
      S.text('s20', { x: 307, y: Y[2] + 37, text: '80 页', size: 14, color: C.mute, opacity: 0 });
      S.text('s21', { x: 708, y: Y[2] + 37, text: '28 页', size: 14, color: C.mute, opacity: 0 });
      S.box('f3', { x: 430, y: Y[3], w: 692, h: 46, rx: 9, fill: 'none', stroke: C.green, sw: 2.5, opacity: 0 });
      S.box('raw', { x: 430, y: Y[0], w: 786, h: 38, rx: 8, fill: C.panel, stroke: C.line, sw: 2, dash: '6 5', label: '108 页未排序的数据', color: C.mute, size: 15 });
      for (i = 0; i < 22; i++) S.box('b' + i, { x: x0(i), y: Y[0], w: 30, h: 34, rx: 5, fill: KEY, stroke: 'none', sw: 0, opacity: 0, trail: 2 });
      S.text('fm1', { x: 37, y: 512, text: '趟数 = 1 + ⌈log₄ 22⌉ = 1 + 3 = 4', anchor: 'start', color: C.amber, size: 16, opacity: 0 });
      S.text('fm2', { x: 823, y: 512, text: '总 I/O = 2N × 趟数 = 2 × 108 × 4 = 864', anchor: 'end', color: C.amber, size: 16, opacity: 0 });
      S.text('fm3', { x: 430, y: 540, text: '每一趟的 I/O 恒定为 2N = 216；多给缓冲页，减少的是趟数', color: C.mute, size: 15, opacity: 0 });
      S.data({ N: 108, B: 5, 'run 数': '—', '趟数': 0, '累计 I/O': 0 });

      S.step('Pass 0：每次读满 B = 5 页、排好、写回 → ⌈108/5⌉ = 22 个 run', function () {
        S.code([3, 4]); S.log('Pass 0：读 108 页 + 写 108 页', { kind: 'io' });
        for (var i = 0; i < 5; i++) S.flash('bf' + i, C.amber, { delay: i * 90 });
        S.to('raw', { opacity: 0 }, { delay: 500, dur: 500 });
        for (i = 0; i < 22; i++) S.pop('b' + i, { delay: 500 + i * 45 });
        S.pop('l0', { delay: 600 });
        S.count('tPass', 1, { delay: 1500 }); S.count('tIO', 216, { delay: 1500, dur: 700 });
        S.data({ 'run 数': 22, '趟数': 1, '累计 I/O': 216 }, { delay: 1600 });
      }, { hold: 1500 });
      S.step('之后每一趟：B−1 = 4 页读输入、留 1 页写输出 → 一次归并 4 个 run', function () {
        S.code([5, 6]);
        for (var i = 0; i < 4; i++) { S.flash('bf' + i, C.blue, { delay: i * 180 }); S.pulse('bf' + i, { delay: i * 180 }); S.pulse('b' + i, { delay: i * 180 + 80 }); S.flash('b' + i, C.blue, { delay: i * 180 + 80 }); }
        S.flash('bf4', C.green, { delay: 900 }); S.pulse('bf4', { delay: 900 });
        S.log('4 路归并：4 页输入 + 1 页输出');
      }, { hold: 1500 });
      S.step('Pass 1：每 4 个 run 归并成 1 个 → ⌈22/4⌉ = 6 个 run，每个 20 页', function () {
        S.code([7, 8]); S.log('Pass 1：22 → 6 个 run', { kind: 'io' });
        for (var i = 0; i < 22; i++) {
          var g = i >> 2, d = g * 190;
          S.to('g' + i, { opacity: .55 }, { delay: d + 200, dur: 400 });
          S.move('b' + i, x1(i), Y[1], { delay: d + (i & 3) * 40, dur: 800 });
        }
        for (g = 0; g < 6; g++) {
          S.pop('f1' + g, { delay: g * 190 + 850 }); S.pop('s1' + g, { delay: g * 190 + 950 });
          S.ripple(gc(g), Y[1], { delay: g * 190 + 880, color: C.amber });
        }
        S.pop('l1', { delay: 300 });
        S.count('tPass', 2, { delay: 1900 }); S.count('tIO', 432, { delay: 1900, dur: 700 });
        S.data({ 'run 数': 6, '趟数': 2, '累计 I/O': 432 }, { delay: 2000 });
      }, { hold: 1500 });
      S.step('Pass 2：6 个 run 再做 4 路归并 → ⌈6/4⌉ = 2 个 run（80 页和 28 页）', function () {
        S.code([7, 8]); S.log('Pass 2：6 → 2 个 run', { kind: 'io' });
        for (var i = 0; i < 22; i++) S.move('b' + i, x2(i), Y[2], { delay: (i < 16 ? 0 : 700) + (i >> 2) * 70, dur: 850 });
        for (g = 0; g < 6; g++) { S.to('f1' + g, { stroke: C.line, opacity: .6 }, { delay: (g < 4 ? 0 : 700) + 200, dur: 400 }); S.set('f1' + g, { dash: '4 4' }, { delay: (g < 4 ? 0 : 700) + 200 }); }
        S.pop('f20', { delay: 1100 }); S.pop('s20', { delay: 1200 }); S.ripple(307, Y[2], { delay: 1100, color: C.amber });
        S.pop('f21', { delay: 1750 }); S.pop('s21', { delay: 1850 }); S.ripple(708, Y[2], { delay: 1750, color: C.amber });
        S.pop('l2', { delay: 300 });
        S.count('tPass', 3, { delay: 2000 }); S.count('tIO', 648, { delay: 2000, dur: 700 });
        S.data({ 'run 数': 2, '趟数': 3, '累计 I/O': 648 }, { delay: 2100 });
      }, { hold: 1500 });
      S.step('Pass 3：只剩 2 个 run，归并成 1 个 108 页的有序 run', function () {
        S.code([6, 8]); S.log('Pass 3：2 → 1 个 run', { kind: 'io' });
        for (var i = 0; i < 22; i++) {
          S.move('b' + i, x3(i), Y[3], { delay: i * 18, dur: 850 });
          S.to('b' + i, { fill: DONE }, { delay: 1300 + i * 25, dur: 300 });
        }
        ['f20', 'f21'].forEach(function (id) { S.to(id, { stroke: C.line, opacity: .6 }, { delay: 200, dur: 400 }); S.set(id, { dash: '4 4' }, { delay: 200 }); });
        S.pop('f3', { delay: 1250 }); S.ripple(430, Y[3], { delay: 1250, color: C.green, r: 60 });
        S.pop('l3', { delay: 300 });
        S.count('tPass', 4, { delay: 1500 }); S.count('tIO', 864, { delay: 1500, dur: 700 });
        S.data({ 'run 数': 1, '趟数': 4, '累计 I/O': 864 }, { delay: 1600 });
        S.log('排序完成：1 个 run，108 页', { delay: 1700, kind: 'ok' });
      }, { hold: 1500 });
      S.step('用公式验算：趟数 = 1 + ⌈log₄ 22⌉ = 4；总 I/O = 2 × 108 × 4 = 864 次页读写', function () {
        S.code([12, 13]);
        S.pop('fm1'); S.pulse('tPass', { delay: 350 });
        S.pop('fm2', { delay: 600 }); S.pulse('tIO', { delay: 950 });
        S.log('公式验算 ✓ 4 趟，864 次 I/O', { delay: 700, kind: 'ok' });
      }, { hold: 1700 });
      S.step('每一趟都要把 N 页完整读一遍、写一遍；多给缓冲页不减少单趟 I/O，减少的是趟数', function () {
        S.code(8);
        ['l0', 'l1', 'l2', 'l3'].forEach(function (id, k) { S.pulse(id, { delay: k * 220, scale: 1.04 }); S.fly([823, Y[k] - 38], [823, 68], { color: C.amber, delay: k * 220, dur: 600, label: '216', w: 46, h: 24 }); });
        S.pop('fm3', { delay: 900 });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 4：外部哈希聚合 ───────────────────────── */
  {
    name: '外部哈希聚合',
    moving: '记录穿过 h₁ 飞进各自的分区；分区里的记录再穿过 h₂ 飞进哈希表槽位，计数滚动；槽里的条目飞进结果缓冲区',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 阶段 1：分区（1 页读输入，B-1 个分区）',
      'for (Tuple& t : input)',
      '  part[h1(t.key) % (B - 1)].Append(t);',
      '// 阶段 2：逐个分区 ReHash',
      'for (Partition& p : part) {',
      '  HashTable ht;              // 在内存里',
      '  for (Tuple& t : p)',
      '    ht[h2(t.key)].count++;   // h2 ≠ h1',
      '  result.Append(ht);         // 写到结果',
      '  ht.Clear();                // 清空，换下一个',
      '}'
    ].join('\n'),
    build: function (S) {
      var recs = ['15-445', '15-826', '15-721', '15-445', '15-826', '15-445', '15-721', '15-415'];
      var part = { '15-445': 0, '15-826': 0, '15-721': 1, '15-415': 2 }, slot = { '15-445': 2, '15-826': 0, '15-721': 1, '15-415': 3 };
      var LY = [142, 290, 438], CX = [276, 345, 414], H1 = [176, 290], H2 = [520, 200], SY = [130, 174, 218, 262], RY = [396, 434, 472, 510];
      var cnt = [0, 0, 0], pos = [], members = [[], [], []], done = 0, rows = 0;
      recs.forEach(function (k, i) { var p = part[k], n = cnt[p]++; pos[i] = { x: CX[n % 3], y: LY[p] + (n < 3 ? -4 : 30) }; members[p].push(i); });
      S.text('note', { x: 20, y: 24, text: 'B = 4 → 3 个分区；8 条记录和哈希值都是示意', anchor: 'start', size: 14, color: C.mute });
      S.text('tQ', { x: 840, y: 24, text: 'SELECT cid, COUNT(*) … GROUP BY cid', anchor: 'end', size: 14, color: C.mute });
      S.text('lIn', { x: 68, y: 62, text: '输入', color: C.mute });
      S.text('lPart', { x: 345, y: 62, text: '磁盘 · B−1 = 3 个分区', color: C.mute });
      [0, 1, 2].forEach(function (p) {
        S.box('pt' + p, { x: 345, y: LY[p] + 2, w: 232, h: 112, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
        lab(S, 'pl' + p, 242, LY[p] - 38, '分区 ' + p, { size: 14 });
      });
      S.box('ht', { x: 705, y: 186, w: 250, h: 222, rx: 12, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
      lab(S, 'lHt', 592, 94, '内存 · 哈希表');
      SY.forEach(function (y, s) {
        S.box('sl' + s, { x: 705, y: y, w: 226, h: 36, rx: 7, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('si' + s, { x: 608, y: y, text: String(s), color: C.mute, size: 14 });
        S.text('c' + s, { x: 728, y: y, anchor: 'start', val: 0, pre: 'COUNT = ', color: C.amber, size: 15, opacity: 0 });
      });
      S.box('res', { x: 705, y: 440, w: 250, h: 196, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
      lab(S, 'lRes', 592, 362, '结果缓冲区');
      S.dot('h1', { x: H1[0], y: H1[1], r: 24, fill: C.purple, label: 'h₁', size: 17 });
      S.dot('h2', { x: H2[0], y: H2[1], r: 24, fill: C.purple, label: 'h₂', size: 17 });
      recs.forEach(function (k, i) { S.box('gi' + i, { x: 68, y: 96 + i * 56, w: 88, h: 36, rx: 7, fill: 'none', stroke: C.line, sw: 1.5, dash: '4 4', opacity: .6 }); });
      recs.forEach(function (k, i) { S.box('r' + i, { x: 68, y: 96 + i * 56, w: 88, h: 36, rx: 7, fill: KEY, stroke: 'none', sw: 0, label: k, size: 15, trail: 3 }); });
      S.data({ '阶段': '—', '已分区': 0, '当前分区': '—', '结果行数': 0 });

      function send(i, t) {                 /* 阶段 1：一条记录 → h₁ → 分区 */
        var id = 'r' + i, p = pos[i];
        S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 200 });
        S.move(id, H1[0], H1[1], { delay: t + 100, dur: 480, ease: 'in' });
        S.pulse('h1', { delay: t + 560 });
        S.to(id, { x: p.x, y: p.y, w: 64, h: 30, size: 14 }, { delay: t + 580, dur: 560, ease: 'out' });
        S.to(id, { fill: KEY, color: C.ink }, { delay: t + 1140, dur: 250 });
        S.ripple(p.x, p.y, { delay: t + 1140, color: C.cyan });
        S.flash('pt' + part[recs[i]], C.cyan, { prop: 'stroke', delay: t + 1140, hold: 200, dur: 300 });
        S.data({ '已分区': ++done }, { delay: t + 1140 });
        return t + 1200;
      }
      function rehash(p, t0) {              /* 阶段 2：分区 p → h₂ → 哈希表；返回 [结束时间, 各槽条目] */
        var seen = {}, entries = [];
        members[p].forEach(function (i, n) {
          var id = 'r' + i, k = recs[i], s = slot[k], t = t0 + n * 560;
          S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 200 });
          S.move(id, H2[0], H2[1], { delay: t + 100, dur: 460, ease: 'in' });
          S.pulse('h2', { delay: t + 540 });
          S.to(id, { x: 672, y: SY[s], w: 84 }, { delay: t + 560, dur: 520, ease: 'out' });
          S.ripple(672, SY[s], { delay: t + 1080, color: C.cyan });
          if (!seen[k]) {
            seen[k] = { id: id, n: 1, s: s }; entries.push(seen[k]);
            S.to(id, { fill: KEY, color: C.ink }, { delay: t + 1080, dur: 250 });
            S.pop('c' + s, { delay: t + 1080 }); S.count('c' + s, 1, { delay: t + 1080, dur: 200 });
          } else {
            seen[k].n++;
            S.to(id, { opacity: 0 }, { delay: t + 1080, dur: 200 });
            S.count('c' + s, seen[k].n, { delay: t + 1080, dur: 300 }); S.pulse('c' + s, { delay: t + 1080 });
            S.pulse(seen[k].id, { delay: t + 1080 });
          }
        });
        entries.sort(function (a, b) { return a.s - b.s; });
        return [t0 + (members[p].length - 1) * 560 + 1400, entries];
      }
      function emit(entries, t0) {          /* 把哈希表内容写到结果缓冲区并清空 */
        entries.forEach(function (e, n) {
          var t = t0 + n * 380, y = RY[rows++], k = recs[+e.id.slice(1)];
          S.hide('c' + e.s, { delay: t });
          S.set(e.id, { label: '(' + k + ', ' + e.n + ')' }, { delay: t });
          S.to(e.id, { x: 705, y: y, w: 170, h: 30, fill: DONE }, { delay: t, dur: 720 });
          S.ripple(705, y, { delay: t + 720, color: C.green });
          S.flash('sl' + e.s, C.red, { prop: 'stroke', delay: t + 100 });
          S.data({ '结果行数': rows }, { delay: t + 720 });
        });
        return t0 + (entries.length - 1) * 380 + 800;
      }

      S.step('阶段 1 · 分区：扫描输入，用哈希函数 h₁ 把每条记录扔进 B−1 = 3 个分区之一', function () {
        S.code([1, 3]); S.log('阶段 1：Partition（h₁）'); S.data({ '阶段': '1 · 分区' });
        send(0, 0); send(1, 560); send(2, 1120);
      });
      S.step('同一个 key 一定 hash 到同一个分区；分区页写满了就写盘、开新页', function () {
        S.code(3);
        send(3, 0); send(4, 560); send(5, 1120);
      });
      S.step('输入扫完。1 个输入 → 多个输出，和归并排序（多个输入 → 1 个输出）正好相反', function () {
        S.code(3);
        send(6, 0); var t = send(7, 560);
        [0, 1, 2].forEach(function (p) { S.flash('pt' + p, C.green, { prop: 'stroke', delay: t + p * 150 }); });
        S.log('分区完成：5 / 2 / 1 条', { delay: t, kind: 'ok' });
      });
      var e0;
      S.step('阶段 2 · ReHash：把分区 0 读进内存，用另一个哈希函数 h₂ 建哈希表，边建边累加', function () {
        S.code([5, 8]); S.log('阶段 2：ReHash 分区 0（h₂）'); S.data({ '阶段': '2 · ReHash', '当前分区': 0 });
        S.to('pt0', { stroke: C.blue }, { dur: 300 });
        e0 = rehash(0, 200)[1];
      });
      S.step('h₁ 已经把这两个 key 聚到了同一个分区；h₂ 必须和 h₁ 不同，才能把它们重新摊开到不同槽位', function () {
        S.code(8);
        S.pulse('h1'); S.flash('h1', C.red);
        S.pulse('h2', { delay: 500 }); S.flash('h2', C.green, { delay: 500 });
        S.flash('sl0', C.green, { prop: 'stroke', delay: 900 }); S.pulse(e0[0].id, { delay: 900 });
        S.flash('sl2', C.green, { prop: 'stroke', delay: 1150 }); S.pulse(e0[1].id, { delay: 1150 });
        S.log('15-826 → 槽 0，15-445 → 槽 2', { delay: 900 });
      });
      S.step('分区 0 处理完 → 把哈希表内容写到结果缓冲区，然后清空哈希表', function () {
        S.code([9, 10]);
        var t = emit(e0, 100);
        S.to('pt0', { stroke: C.line, opacity: .45 }, { delay: t - 300, dur: 400 }); S.to('pl0', { opacity: .45 }, { delay: t - 300, dur: 400 });
        S.log('输出 2 组，清空哈希表', { delay: t - 200, kind: 'ok' });
      });
      S.step('分区 1：15-721 绝不可能出现在别的分区里 —— 所以刚才才敢放心清空哈希表', function () {
        S.code([5, 8]); S.log('ReHash 分区 1'); S.data({ '当前分区': 1 });
        S.to('pt1', { stroke: C.blue }, { dur: 300 });
        var r = rehash(1, 200);
        S.code([9, 10], { delay: r[0] });
        var t = emit(r[1], r[0]);
        S.to('pt1', { stroke: C.line, opacity: .45 }, { delay: t - 300, dur: 400 }); S.to('pl1', { opacity: .45 }, { delay: t - 300, dur: 400 });
      });
      S.step('分区 2 同理：读进来 → 建表 → 写结果 → 清空', function () {
        S.code([5, 8]); S.log('ReHash 分区 2'); S.data({ '当前分区': 2 });
        S.to('pt2', { stroke: C.blue }, { dur: 300 });
        var r = rehash(2, 200);
        S.code([9, 10], { delay: r[0] });
        var t = emit(r[1], r[0]);
        S.to('pt2', { stroke: C.line, opacity: .45 }, { delay: t - 300, dur: 400 }); S.to('pl2', { opacity: .45 }, { delay: t - 300, dur: 400 });
      });
      S.step('所有分区处理完：4 个组的 COUNT 都齐了，哈希表从头到尾只装一个分区的内容', function () {
        S.code(11); S.data({ '阶段': '完成', '当前分区': '—' });
        S.flash('res', C.green, { prop: 'stroke' }); S.pulse('res', { scale: 1.04 });
        S.fly([600, RY[0]], [600, RY[3]], { color: C.green, delay: 200, dur: 800, ease: 'linear' });
        S.log('聚合完成：4 组', { delay: 600, kind: 'ok' });
      }, { hold: 1800 });
    }
  }
  ]
});
})();
