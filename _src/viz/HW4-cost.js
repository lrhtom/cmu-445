/* HW4 执行与计划：块嵌套循环计数 / 外部排序遍数 / 归并阶段的最好与最坏 / Grace 哈希连接 / 基数估算
 * 表 R、S、T 的页数（600、200、1,500）、B = 22、以及 Course 和 A–D 四张表的统计量都是讲义里自编的示意数据。 */
(function () {
var C = Viz.C, PG = '#22325a', HIT = '#2c5f9e';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #4（题目 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw4-clean.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Homework #4（官方答案 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw4-sols.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #12 Join Algorithms（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/12-joins.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #12 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/12-joins.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #11 Sorting & Aggregations（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/11-sorting.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #16 Query Optimization II（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/16-optimization2.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #16 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/16-optimization2.pdf' }
];
function note(S, t) { S.text('note', { x: 20, y: 24, text: t, anchor: 'start', size: 14, color: C.mute }); }
function title(S, id, x, y, text, o) {
  var p = { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}
function io(S, pre) { S.text('io', { x: 840, y: 24, anchor: 'end', val: 0, pre: pre || 'I/O：', size: 17, weight: 700, color: C.amber }); }
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function roll(S, id, pre, from, to, o) {
  o = o || {}; var d = o.delay || 0, dur = o.dur || 600;
  S.set(id, { val: from }, { delay: d });
  S.count(id, to, { delay: d, dur: dur });
  S.set(id, { val: null, text: pre + fmt(to) + (o.suf || '') }, { delay: d + dur + 20 });
}
function big(S, id, x, y, t, o) {
  var p = { x: x, y: y, text: t, size: 17, weight: 700, color: C.cyan, opacity: 0 };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}

Viz.register('hw4-cost', {
  title: 'HW4：连接成本怎么数 · 排序遍数 · 基数估算',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：块嵌套循环 ───────────── */
  {
    name: '块嵌套循环：数 I/O',
    moving: '外表的块一块块飞进缓冲池；内表的页段从左到右依次点亮、扫描遍数滚动；I/O 计数滚动；最后两种外表选择的成本并排比较',
    lang: '计算过程',
    code: [
      'S 外（N = 200 页），T 内（O = 1,500 页）',
      'B = 22 → 外表每块 B − 2 = 20 页',
      '',
      'for 每一块 S_blk（20 页）：   // +20',
      '  for T 的每一页：            // +1,500',
      '    块内元组 × 这一页比较',
      '',
      '块数 = ⌈200 / 20⌉ = 10',
      'I/O = 200 + 10 × 1,500 = 15,200',
      '',
      '换成 T 在外：',
      '块数 = ⌈1,500 / 20⌉ = 75',
      'I/O = 1,500 + 75 × 200 = 16,500'
    ].join('\n'),
    build: function (S) {
      function sx(i) { return 190 + i * 62; }
      function tx(j) { return 150 + j * 44; }
      note(S, '页数与缓冲池大小为示意');
      io(S);
      title(S, 'tS', 40, 70, 'S（外表）200 页');
      for (var i = 0; i < 10; i++) S.box('s' + i, { x: 205 + i * 56, y: 108, w: 56, h: 40, rx: 0, fill: PG, stroke: C.line, sw: 1, label: '', size: 14 });
      S.box('bp', { x: 430, y: 236, w: 720, h: 104, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('bpT', { x: 84, y: 196, text: '缓冲池 B = 22 页', anchor: 'start', size: 15, color: C.mute });
      S.box('bo', { x: 300, y: 246, w: 380, h: 56, rx: 8, fill: 'none', stroke: C.blue, sw: 2, dash: '6 4', label: '20 页：外表的一块', size: 15, color: C.blue, opacity: 0 });
      S.box('bi', { x: 600, y: 246, w: 120, h: 56, rx: 8, fill: 'none', stroke: C.purple, sw: 2, dash: '6 4', label: '1 页：读 T', size: 15, color: C.purple, opacity: 0 });
      S.box('bout', { x: 730, y: 246, w: 110, h: 56, rx: 8, fill: 'none', stroke: C.green, sw: 2, dash: '6 4', label: '1 页：输出', size: 15, color: C.green, opacity: 0 });
      title(S, 'tT', 40, 352, 'T（内表）1,500 页（每格 100 页）');
      for (var j = 0; j < 15; j++) S.box('t' + j, { x: tx(j), y: 392, w: 40, h: 44, rx: 4, fill: PG, stroke: 'none', sw: 0 });
      S.text('scan', { x: 430, y: 448, val: 0, pre: 'T 被完整扫过：', suf: ' 遍', size: 16, weight: 700, color: C.purple });
      big(S, 'f1', 430, 492, 'S 在外：200 + ⌈200/20⌉ × 1,500 = 15,200');
      big(S, 'f2', 430, 524, 'T 在外：1,500 + ⌈1,500/20⌉ × 200 = 16,500', { color: C.amber });
      S.data({ '块数': '—', '内表扫描遍数': 0 });
      function sweepT(d, col) { for (var j = 0; j < 15; j++) S.to('t' + j, { fill: col || HIT }, { delay: d + j * 45, dur: 150 }); }
      function resetT(d) { for (var j = 0; j < 15; j++) S.to('t' + j, { fill: PG }, { delay: d, dur: 200 }); }

      S.step('缓冲池 22 页：20 页装外表的一块，1 页轮流读内表 T，1 页攒输出', function () {
        S.code([1, 2]);
        S.pop('bo', { delay: 100 }); S.pop('bi', { delay: 350 }); S.pop('bout', { delay: 600 });
      });
      S.step('S 有 200 页 → 每块 20 页，切成 ⌈200 / 20⌉ = 10 块', function () {
        S.code(8);
        for (var i = 0; i < 10; i++) { S.to('s' + i, { x: sx(i), rx: 6, label: '块' + (i + 1) }, { delay: i * 60, dur: 600 }); }
        S.data({ '块数': 10 }, { delay: 800 });
      });
      S.step('第 1 块读进缓冲池：I/O + 20', function () {
        S.code(4);
        S.fly('s0', 'bo', { label: '块1', w: 80, h: 34, color: C.blue, dur: 750 });
        S.to('s0', { fill: HIT }, { delay: 200, dur: 300 }); S.to('bo', { fill: '#1d3358' }, { delay: 750, dur: 300 });
        roll(S, 'io', 'I/O：', 0, 20, { delay: 750, dur: 400 });
      });
      S.step('拿这一块和 T 比：T 的 1,500 页一页页读进那 1 页的位置 —— I/O + 1,500', function () {
        S.code([5, 6]);
        sweepT(0);
        [0, 5, 10, 14].forEach(function (j, n) { S.fly('t' + j, 'bi', { color: C.purple, delay: j * 45 + 100, dur: 450 }); });
        roll(S, 'io', 'I/O：', 20, 1520, { dur: 800 }); S.count('scan', 1, { delay: 700, dur: 200 });
        S.data({ '内表扫描遍数': 1 }, { delay: 800 });
      });
      S.step('第 2 块换进来（+20），T 再从头扫一遍（+1,500）', function () {
        S.code([4, 5]);
        resetT(0);
        S.fly('s1', 'bo', { label: '块2', w: 80, h: 34, color: C.blue, delay: 150, dur: 650 }); S.to('s1', { fill: HIT }, { delay: 150, dur: 300 });
        sweepT(850); roll(S, 'io', 'I/O：', 1520, 3040, { delay: 800, dur: 800 }); S.count('scan', 2, { delay: 1500, dur: 200 });
        S.data({ '内表扫描遍数': 2 }, { delay: 1500 });
      });
      S.step('剩下 8 块同样处理 —— 内表 T 一共被完整扫了 10 遍', function () {
        S.code([4, 6]);
        for (var i = 2; i < 10; i++) {
          var d = (i - 2) * 260;
          S.fly('s' + i, 'bo', { color: C.blue, delay: d, dur: 300 }); S.to('s' + i, { fill: HIT }, { delay: d, dur: 200 });
          S.flash('t' + ((i * 3) % 15), C.cyan, { delay: d + 150 });
        }
        roll(S, 'io', 'I/O：', 3040, 15200, { dur: 2100 }); S.count('scan', 10, { dur: 2100 });
        S.data({ '内表扫描遍数': 10 }, { delay: 2100 }); S.log('I/O = 15,200', { delay: 2150, kind: 'ok' });
      });
      S.step('公式：N + ⌈N / (B − 2)⌉ × O = 200 + 10 × 1,500 = 15,200', function () {
        S.code(9);
        S.pop('f1'); S.pulse('io', { delay: 300 });
      });
      S.step('反过来让 T 在外层：⌈1,500 / 20⌉ = 75 块，S 要被扫 75 遍 → 16,500，比 15,200 多', function () {
        S.code([11, 13]);
        roll(S, 'io', 'I/O：', 15200, 16500, { delay: 200, dur: 900 }); S.count('scan', 75, { delay: 200, dur: 900 });
        S.set('scan', { pre: '内表（换成 S）被扫过：' }, { delay: 200 });
        S.pop('f2', { delay: 700 });
        S.log('小表放外层：15,200 < 16,500', { delay: 1200, kind: 'ok' });
        S.data({ '块数': '75（T 在外）', '内表扫描遍数': 75 }, { delay: 1100 });
      });
    }
  },

  /* ───────────── 场景 2：外部归并排序的遍数 ───────────── */
  {
    name: '外部排序：几遍、多少 I/O',
    moving: 'R 的 28 段按顺序落到 Pass 0 那一行并变色；21 个 run 一起滑进第一个大 run，剩下 7 个滑进第二个；最后两条合成一条；I/O 计数每一遍涨 1,200',
    lang: '计算过程',
    code: [
      'R：600 页，B = 22',
      'Pass 0：每次读 B = 22 页排好写回',
      '  run 数 = ⌈600 / 22⌉ = 28',
      'Pass 1..：每次归并 B − 1 = 21 个 run',
      '  28 → ⌈28 / 21⌉ = 2 → 1',
      '',
      '遍数 = 1 + ⌈log₂₁ 28⌉ = 1 + 2 = 3',
      '      （log₂₁ 28 ≈ 1.09，向上取整）',
      'I/O = 2 × 600 × 3 = 3,600',
      '',
      '若 B = 102：⌈600 / 102⌉ = 6 个 run',
      '  遍数 = 1 + ⌈log₁₀₁ 6⌉ = 2 → 2,400'
    ].join('\n'),
    build: function (S) {
      var X0 = 72, W = 730, Y = [104, 212, 320, 428];
      function rx(i) { return X0 + i * 26.2 + 12; }
      note(S, '页数与缓冲池大小为示意');
      io(S);
      ['原始 R', 'Pass 0', 'Pass 1', 'Pass 2'].forEach(function (t, r) { S.text('pl' + r, { x: 22, y: Y[r], text: t, anchor: 'start', size: 14, color: C.mute }); });
      for (var i = 0; i < 28; i++) {
        var w = i === 27 ? 7 : 23;
        S.box('r' + i, { x: i === 27 ? rx(i) - 8 : rx(i), y: Y[0], w: w, h: 44, rx: 3, fill: '#3a3352', stroke: 'none', sw: 0 });
      }
      S.text('rT', { x: 430, y: Y[0] + 40, text: '600 页，乱序（每段 22 页，最后一段 6 页）', size: 14, color: C.mute });
      var AW = W * 462 / 600, BW = W * 138 / 600;
      S.box('A', { x: X0 + AW / 2, y: Y[2], w: AW, h: 50, rx: 6, fill: HIT, stroke: 'none', sw: 0, label: 'run 1：21 × 22 = 462 页', size: 15, opacity: 0 });
      S.box('Bb', { x: X0 + AW + 8 + BW / 2, y: Y[2], w: BW - 8, h: 50, rx: 6, fill: HIT, stroke: 'none', sw: 0, label: 'run 2：138 页', size: 14, opacity: 0 });
      S.box('F', { x: X0 + W / 2, y: Y[3], w: W, h: 50, rx: 6, fill: C.green, stroke: 'none', sw: 0, label: '600 页，全部有序', size: 16, color: C.bg, opacity: 0 });
      S.text('pc', { x: 840, y: 52, anchor: 'end', val: 0, pre: '已完成遍数：', size: 15, color: C.cyan });
      big(S, 'f1', 430, 500, '遍数 = 1 + ⌈log₂₁ 28⌉ = 3　　I/O = 2 × 600 × 3 = 3,600');
      big(S, 'f2', 430, 530, 'B = 102 时：6 个 run → 2 遍 → 2,400', { size: 15, color: C.amber, weight: 500 });
      S.data({ 'run 数': '—' });

      S.step('给 R（600 页）按连接键排序；缓冲池只有 22 页', function () {
        S.code(1);
        for (var i = 0; i < 28; i++) S.pulse('r' + i, { delay: i * 30, scale: 1.1 });
      }, { hold: 1600 });
      S.step('Pass 0：每次读满 22 页，在内存里排好再写回 → 28 个各自有序的 run', function () {
        S.code([2, 3]);
        for (var i = 0; i < 28; i++) {
          S.to('r' + i, { y: Y[1], fill: HIT }, { delay: i * 55, dur: 450 });
        }
        S.to('rT', { opacity: 0 }, { dur: 300 });
        roll(S, 'io', 'I/O：', 0, 1200, { dur: 1900 }); S.count('pc', 1, { delay: 1900, dur: 200 });
        S.data({ 'run 数': 28 }, { delay: 1900 }); S.log('Pass 0：读 600 + 写 600', { delay: 1950, kind: 'io' });
      }, { hold: 1500 });
      S.step('Pass 1：留 1 页写输出，一次最多归并 B − 1 = 21 个 run —— 前 21 个合成一个', function () {
        S.code([4, 5]);
        for (var i = 0; i < 21; i++) {
          S.fly('r' + i, [X0 + AW / 2, Y[2]], { color: C.cyan, delay: i * 40, dur: 650, ripple: i === 20 });
          S.to('r' + i, { opacity: .3 }, { delay: i * 40 + 300, dur: 300 });
        }
        S.pop('A', { delay: 1000 });
        roll(S, 'io', 'I/O：', 1200, 2124, { delay: 300, dur: 1100 });
      }, { hold: 1600 });
      S.step('剩下 7 个 run 合成第二个 —— 这一遍同样读写了整张表：+1,200', function () {
        S.code(5);
        for (var i = 21; i < 28; i++) { S.fly('r' + i, [X0 + AW + 8 + BW / 2, Y[2]], { color: C.cyan, delay: (i - 21) * 60, dur: 600, ripple: i === 27 }); S.to('r' + i, { opacity: .3 }, { delay: (i - 21) * 60 + 300, dur: 300 }); }
        S.pop('Bb', { delay: 700 });
        roll(S, 'io', 'I/O：', 2124, 2400, { delay: 200, dur: 700 }); S.count('pc', 2, { delay: 900, dur: 200 });
        S.data({ 'run 数': 2 }, { delay: 900 });
      }, { hold: 1600 });
      S.step('Pass 2：2 个 run 归并成 1 个 —— 第 3 遍，排序完成', function () {
        S.code(5);
        S.fly('A', [X0 + W / 2, Y[3]], { label: '462', w: 60, h: 30, color: C.cyan, dur: 700 });
        S.fly('Bb', [X0 + W / 2, Y[3]], { label: '138', w: 60, h: 30, color: C.cyan, delay: 120, dur: 700 });
        S.to('A', { opacity: .35 }, { delay: 300, dur: 300 }); S.to('Bb', { opacity: .35 }, { delay: 400, dur: 300 });
        S.pop('F', { delay: 700 }); S.ripple(X0 + W / 2, Y[3], { delay: 800, color: C.green, r: 60 });
        roll(S, 'io', 'I/O：', 2400, 3600, { delay: 200, dur: 800 }); S.count('pc', 3, { delay: 900, dur: 200 });
        S.data({ 'run 数': 1 }, { delay: 900 }); S.log('3 遍，3,600 次 I/O', { delay: 1000, kind: 'ok' });
      }, { hold: 1500 });
      S.step('公式核对：1 + ⌈log₂₁ 28⌉ —— log₂₁ 28 ≈ 1.09，向上取整成 2，所以是 3 遍不是 2 遍', function () {
        S.code([7, 9]);
        S.pop('f1'); S.pulse('pc', { delay: 300 });
        S.log('少取整一次就会选成 2,400', { delay: 500, kind: 'warn' });
      }, { hold: 1600 });
      S.step('内存多给一些（B = 102）：Pass 0 只产生 6 个 run，一次就能归并完 → 2 遍', function () {
        S.code([11, 12]);
        S.pop('f2'); S.flash('F', C.amber, { delay: 300 });
        S.log('每一遍的 I/O 不变（2 × 600），变的是遍数', { delay: 600 });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 3：归并阶段的最好与最坏 ───────────── */
  {
    name: '归并阶段：最好与最坏',
    moving: '两个游标沿着排好序的页单向前进、页被读到时变蓝；最坏情况下内表游标一次次回溯到开头重扫，读页计数快速上涨',
    lang: '计算过程',
    code: [
      '两张表都已按连接键排好序',
      '（下图每格 = 1 页，示意）',
      '',
      '无重复键：两个游标都只往前走',
      '  每页只读 1 次 → M + N',
      '  本例 1,500 + 600 = 2,100',
      '',
      '最坏：连接键全都相同',
      '  外表每一页都让内表',
      '  回溯到开头整个重读',
      '  → ≈ M × N',
      '  本例 1,500 × 600 = 900,000'
    ].join('\n'),
    build: function (S) {
      var OK = [1, 3, 4, 6, 8, 9, 11, 12], IK = [2, 3, 6, 7, 9, 12];
      function ox(i) { return 110 + i * 88; }
      function ix(i) { return 150 + i * 106; }
      var OY = 150, IY = 330;
      note(S, '每格代表 1 页，键值为示意');
      io(S, '读过的页：');
      title(S, 'tO', 40, 100, '外表（排好序）');
      title(S, 'tI', 40, 280, '内表（排好序）');
      OK.forEach(function (k, i) { S.box('o' + i, { x: ox(i), y: OY, w: 76, h: 52, rx: 7, fill: PG, stroke: C.line, sw: 1.2, label: String(k), size: 18 }); });
      IK.forEach(function (k, i) { S.box('n' + i, { x: ix(i), y: IY, w: 90, h: 52, rx: 7, fill: PG, stroke: C.line, sw: 1.2, label: String(k), size: 18 }); });
      S.box('co', { x: ox(0), y: OY, w: 88, h: 64, rx: 10, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      S.box('ci', { x: ix(0), y: IY, w: 102, h: 64, rx: 10, fill: 'none', stroke: C.purple, sw: 3, opacity: 0 });
      big(S, 'f1', 430, 450, '每页只读一次：8 + 6 = 14 页 → 一般地 M + N（本例 2,100）');
      big(S, 'f2', 430, 500, '每个外表页都重读整个内表 → ≈ M × N（本例 900,000）', { color: C.red });
      S.data({ '情形': '无重复键' });

      S.step('归并阶段：两张表都已经按连接键排好序（每格是一页）', function () {
        S.code([1, 2]);
        S.pop('co'); S.pop('ci', { delay: 200 });
        S.to('o0', { fill: HIT }, { delay: 300, dur: 250 }); S.to('n0', { fill: HIT }, { delay: 400, dur: 250 });
        S.count('io', 2, { delay: 400, dur: 300 });
      });
      S.step('没有重复键时：谁的键小谁的游标往前走 —— 两个游标都只往前，从不后退', function () {
        S.code(4);
        var seq = [['o', 1], ['n', 1], ['o', 2], ['o', 3], ['n', 2], ['n', 3], ['o', 4], ['n', 4], ['o', 5], ['o', 6], ['n', 5], ['o', 7]];
        seq.forEach(function (st, n) {
          var d = n * 190;
          if (st[0] === 'o') S.move('co', ox(st[1]), OY, { delay: d, dur: 170 }); else S.move('ci', ix(st[1]), IY, { delay: d, dur: 170 });
          S.to(st[0] + st[1], { fill: HIT }, { delay: d + 150, dur: 120 });
        });
        S.count('io', 14, { dur: 2300 });
      }, { hold: 1500 });
      S.step('每一页只读了一次：8 + 6 = 14 页 —— 一般地就是 M + N', function () {
        S.code([5, 6]);
        S.pop('f1'); S.pulse('io', { delay: 300 });
        S.log('最好情况：M + N', { delay: 400, kind: 'ok' });
      });
      S.step('最坏情况：连接键全都相同（都是 5）—— 先把游标和读过的页清零', function () {
        S.code(8);
        for (var i = 0; i < 8; i++) { S.to('o' + i, { fill: PG, label: '5' }, { delay: i * 40, dur: 300 }); }
        for (var j = 0; j < 6; j++) { S.to('n' + j, { fill: PG, label: '5' }, { delay: 300 + j * 40, dur: 300 }); }
        S.move('co', ox(0), OY, { delay: 300, dur: 500 }); S.move('ci', ix(0), IY, { delay: 300, dur: 500 });
        S.count('io', 0, { delay: 300, dur: 400 }); S.hide('f1', { delay: 200 });
        S.data({ '情形': '键全相同' }, { delay: 300 });
      });
      S.step('外表第 1 页：内表 6 页全都匹配，全部读一遍', function () {
        S.code([8, 9]);
        S.to('o0', { fill: HIT }, { dur: 200 });
        for (var j = 0; j < 6; j++) { S.move('ci', ix(j), IY, { delay: 200 + j * 220, dur: 200 }); S.to('n' + j, { fill: HIT }, { delay: 350 + j * 220, dur: 120 }); }
        S.count('io', 7, { delay: 200, dur: 1300 });
      });
      S.step('外表第 2 页：内表游标必须回溯到开头，再把 6 页读一遍', function () {
        S.code(10);
        S.move('co', ox(1), OY, { dur: 300 }); S.to('o1', { fill: HIT }, { delay: 250, dur: 200 });
        S.move('ci', ix(0), IY, { delay: 400, dur: 650, ease: 'inOut' }); S.flash('ci', C.red, { prop: 'stroke', delay: 1050 });
        for (var j = 0; j < 6; j++) { S.flash('n' + j, C.red, { delay: 1100 + j * 150 }); S.move('ci', ix(j), IY, { delay: 1100 + j * 150, dur: 130 }); }
        S.count('io', 14, { delay: 400, dur: 1600 });
        S.log('回溯！', { delay: 1050, kind: 'warn' });
      }, { hold: 1500 });
      S.step('…… 外表每一页都让内表整个重读一次：8 + 8 × 6 = 56 页 → 一般地 ≈ M × N', function () {
        S.code([11, 12]);
        for (var i = 2; i < 8; i++) {
          var d = (i - 2) * 300;
          S.move('co', ox(i), OY, { delay: d, dur: 200 }); S.to('o' + i, { fill: HIT }, { delay: d + 150, dur: 150 });
          S.move('ci', ix(5), IY, { delay: d + 60, dur: 110 }); S.move('ci', ix(0), IY, { delay: d + 180, dur: 110 });
        }
        S.count('io', 56, { dur: 1900 }); S.pop('f2', { delay: 1900 });
        S.log('最坏情况：≈ M × N', { delay: 2000, kind: 'err' });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 4：Grace 哈希连接 ───────────── */
  {
    name: 'Grace 哈希连接：3 (M + N)',
    moving: '两张表的页化作数据包按 h₁ 飞进编号相同的分区、分区格子长高；每一对分区依次飞进内存建表与探测；倾斜的分区变红并用 h₂ 劈成两半；I/O 分三段滚动',
    lang: '计算过程',
    code: [
      'S（build 侧，课上叫 outer）N = 200',
      'R（probe 侧）M = 600',
      '',
      '① 分区：读 S、按 h₁ 写出   200 + 200',
      '       读 R、按 h₁ 写出   600 + 600',
      '② 探测：for 每一对 (S_i, R_i)：',
      '         S_i 读进内存建哈希表',
      '         R_i 一页页读进来探测',
      '       每个分区再读一次     200 + 600',
      '',
      '合计 3 × (200 + 600) = 2,400',
      '（不计最后写结果）',
      '',
      '某个分区太大 → 只对它换 h₂ 再分一层'
    ].join('\n'),
    build: function (S) {
      var PX = [200, 360, 520, 680], SY = 312, RY = 392, SH = [26, 22, 30, 22], RH = [56, 60, 52, 62];
      note(S, '分区数（4 个）和各分区大小为示意');
      io(S);
      title(S, 'tS', 40, 76, 'S：200 页');
      S.box('S', { x: 200, y: 108, w: 160, h: 40, rx: 6, fill: '#3a3352', stroke: 'none', sw: 0 });
      title(S, 'tR', 40, 160, 'R：600 页');
      S.box('R', { x: 340, y: 192, w: 440, h: 40, rx: 6, fill: '#3a3352', stroke: 'none', sw: 0 });
      title(S, 'tP', 40, 258, '磁盘上的分区（按 h₁）');
      PX.forEach(function (x, p) {
        S.box('ps' + p, { x: x, y: SY, w: 120, h: 2, rx: 4, fill: C.blue, stroke: 'none', sw: 0, opacity: 0 });
        S.box('pr' + p, { x: x, y: RY, w: 120, h: 2, rx: 4, fill: C.purple, stroke: 'none', sw: 0, opacity: 0 });
        S.text('pl' + p, { x: x, y: 440, text: '分区 ' + p, size: 14, color: C.mute, opacity: 0 });
      });
      S.text('lS', { x: 60, y: SY, text: 'S_i', anchor: 'start', size: 15, color: C.blue, opacity: 0 });
      S.text('lR', { x: 60, y: RY, text: 'R_i', anchor: 'start', size: 15, color: C.purple, opacity: 0 });
      S.box('mem', { x: 720, y: 150, w: 200, h: 110, rx: 12, fill: C.panel, stroke: C.line, sw: 2, opacity: 0 });
      S.text('memT', { x: 720, y: 80, text: '内存：S_i 的哈希表', size: 15, color: C.green, opacity: 0 });
      big(S, 'f1', 430, 500, '分区 2 × (200 + 600) + 探测 (200 + 600) = 3 × 800 = 2,400');
      S.text('skew', { x: 520, y: 470, text: '', size: 15, color: C.red });
      S.data({ '阶段': '—' });

      S.step('先用同一个 h₁ 把两张表都切成编号相同的分区（这里画 4 个）', function () {
        S.code([1, 2]);
        PX.forEach(function (x, p) { S.to('ps' + p, { opacity: 1 }, { delay: p * 100, dur: 300 }); S.to('pr' + p, { opacity: 1 }, { delay: p * 100, dur: 300 }); S.to('pl' + p, { opacity: 1 }, { delay: p * 100, dur: 300 }); });
        S.to('lS', { opacity: 1 }, { delay: 400, dur: 300 }); S.to('lR', { opacity: 1 }, { delay: 400, dur: 300 });
        S.data({ '阶段': '① 分区' }, { delay: 300 });
      });
      S.step('分区 S：读 200 页（+200），每条元组按 h₁ 落进 S₀…S₃，写回磁盘（+200）', function () {
        S.code(4);
        S.flash('S', C.blue);
        PX.forEach(function (x, p) {
          [0, 1].forEach(function (k) { S.fly([140 + k * 60 + p * 20, 108], [x, SY], { color: C.blue, delay: p * 220 + k * 110, dur: 600 }); });
          S.to('ps' + p, { h: SH[p] }, { delay: p * 220 + 600, dur: 400 });
        });
        roll(S, 'io', 'I/O：', 0, 400, { dur: 1600 });
      });
      S.step('分区 R：读 600 页、写回 600 页（+1,200）', function () {
        S.code(5);
        S.flash('R', C.purple);
        PX.forEach(function (x, p) {
          [0, 1, 2].forEach(function (k) { S.fly([150 + k * 130 + p * 25, 192], [x, RY], { color: C.purple, delay: p * 220 + k * 90, dur: 600 }); });
          S.to('pr' + p, { h: RH[p] }, { delay: p * 220 + 600, dur: 400 });
        });
        roll(S, 'io', 'I/O：', 400, 1600, { dur: 1600 });
        S.log('分区阶段：2 × (200 + 600) = 1,600', { delay: 1700, kind: 'io' });
      });
      S.step('探测第 0 对：S₀ 读进内存建哈希表，再把 R₀ 一页页读进来逐条探测', function () {
        S.code([6, 8]); S.data({ '阶段': '② 探测' });
        S.pop('mem'); S.to('memT', { opacity: 1 }, { delay: 200, dur: 300 });
        S.fly('ps0', 'mem', { label: 'S₀', w: 56, h: 30, color: C.blue, delay: 300, dur: 700 });
        S.to('mem', { stroke: C.green }, { delay: 1000, dur: 300 });
        [0, 1, 2].forEach(function (k) { S.fly('pr0', 'mem', { color: C.purple, delay: 1100 + k * 220, dur: 500 }); });
        roll(S, 'io', 'I/O：', 1600, 1800, { delay: 300, dur: 1600 });
      });
      S.step('其余 3 对同样处理 —— 每个分区只再读一次；哈希表用完就扔', function () {
        S.code(9);
        [1, 2, 3].forEach(function (p, n) {
          var d = n * 600;
          S.fly('ps' + p, 'mem', { label: 'S' + '₀₁₂₃'[p], w: 56, h: 30, color: C.blue, delay: d, dur: 450 });
          S.fly('pr' + p, 'mem', { color: C.purple, delay: d + 250, dur: 400 });
          S.flash('mem', C.green, { prop: 'stroke', delay: d + 450 });
        });
        roll(S, 'io', 'I/O：', 1800, 2400, { dur: 1900 });
      });
      S.step('合计：分区读一遍 + 写一遍、探测再读一遍 → 3 × (200 + 600) = 2,400', function () {
        S.code(11);
        S.pop('f1'); S.pulse('io', { delay: 300 });
        S.log('Grace 哈希：2,400', { delay: 400, kind: 'ok' });
      });
      S.step('倾斜：如果某个分区太大装不进内存，只对它换一个哈希函数 h₂ 再分一层', function () {
        S.code(14);
        S.to('ps2', { h: 70, fill: C.red }, { dur: 600 }); S.set('skew', { text: 'S₂ 装不下 → 用 h₂ 劈成两半（不能再用 h₁）' }, { delay: 400 });
        S.to('ps2', { w: 54, x: PX[2] - 32, h: 36, fill: C.blue }, { delay: 1300, dur: 600 });
        S.box('ps2b', { x: PX[2] + 32, y: SY, w: 54, h: 36, rx: 4, fill: C.blue, stroke: 'none', sw: 0, opacity: 0 });
        S.pop('ps2b', { delay: 1600 }); S.ripple(PX[2], SY, { delay: 1500, color: C.amber });
        S.log('递归分区：只处理撑爆的那个', { delay: 1900, kind: 'warn' });
      });
      S.step('要放进内存的是 build 侧（课上叫 outer）的每个分区；probe 侧一页页流过即可，多大都行', function () {
        S.code(1);
        S.flash('mem', C.green, { prop: 'stroke' }); S.pulse('mem', { scale: 1.05 });
        S.flash('lS', C.green, { prop: 'color', delay: 300 });
        S.log('读题时看清 outer / inner 的定义', { delay: 500 });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 5：基数估算 ───────────── */
  {
    name: '基数估算',
    moving: '选择性小数飞进乘式、估计值滚动；「真实值」柱子长高、和估计值形成对比；连接公式里的数字从表卡片飞进分子分母，结果滚动到 120,000 和 1,800,000',
    lang: '计算过程',
    code: [
      'Course：20,000 行',
      '  P(dept = CS) = 8%，P(building = GHC) = 2%',
      '  独立：20,000 × 0.08 × 0.02 = 32',
      '  实际高度相关 → 低估',
      '',
      '连接：N_R × N_S / max(V(A,R), V(A,S))',
      '  A ⋈ B = 6,000 × 12,000 / 600',
      '        = 120,000',
      '  (A ⋈ B) ⋈ C = 120,000 × 12,000 / 800',
      '        = 1,800,000',
      '  C ⋈ D（外键 → 主键）= |C| = 12,000',
      '',
      '单表：x = 5 → 6,000 / 300 = 20',
      '      z ≠ 3 → 12,000 − 15 = 11,985'
    ].join('\n'),
    build: function (S) {
      note(S, '所有统计量为示意');
      title(S, 'tC', 40, 66, 'Course 表 20,000 行');
      S.box('p1', { x: 150, y: 116, w: 150, h: 40, rx: 7, fill: PG, stroke: C.blue, sw: 1.5, label: 'CS：0.08', size: 16 });
      S.box('p2', { x: 330, y: 116, w: 150, h: 40, rx: 7, fill: PG, stroke: C.blue, sw: 1.5, label: 'GHC：0.02', size: 16 });
      S.text('mul', { x: 240, y: 116, text: '×', size: 20, color: C.mute });
      S.text('est', { x: 520, y: 116, val: 0, pre: '估计 = ', suf: ' 行', anchor: 'start', size: 18, weight: 700, color: C.cyan, opacity: 0 });
      S.box('bE', { x: 92, y: 186, w: 4, h: 26, rx: 3, fill: C.cyan, stroke: 'none', sw: 0, opacity: 0 });
      S.box('bT', { x: 92, y: 222, w: 4, h: 26, rx: 3, fill: C.amber, stroke: 'none', sw: 0, opacity: 0 });
      S.text('bEl', { x: 40, y: 186, text: '估计', anchor: 'start', size: 14, color: C.cyan, opacity: 0 });
      S.text('bTl', { x: 40, y: 222, text: '真实', anchor: 'start', size: 14, color: C.amber, opacity: 0 });
      S.text('bTv', { x: 110, y: 222, val: 0, pre: '≈ ', suf: ' 行（示意）', anchor: 'start', size: 15, color: C.amber, opacity: 0 });
      title(S, 'tJ', 40, 286, '连接：N_R × N_S / max(V(A,R), V(A,S))');
      var T = [['A', 'A(x, y)', '6,000 行 · V(y) = 600', 120], ['B', 'B(y, z)', '12,000 行 · V(z) = 800', 320], ['C', 'C(z, w)', '12,000 行 · w → D', 520], ['D', 'D(w 主键)', '3,000 行', 720]];
      T.forEach(function (t) {
        S.box('T' + t[0], { x: t[3], y: 340, w: 180, h: 62, rx: 9, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('Tn' + t[0], { x: t[3], y: 328, text: t[1], size: 16, weight: 700 });
        S.text('Ts' + t[0], { x: t[3], y: 354, text: t[2], size: 14, color: C.mute });
      });
      S.text('j1', { x: 430, y: 430, text: '', size: 17, weight: 700, color: C.ink });
      S.text('j1v', { x: 430, y: 466, val: 0, pre: '= ', size: 19, weight: 700, color: C.cyan, opacity: 0 });
      S.text('j2', { x: 430, y: 506, text: '', size: 15, color: C.mute });
      S.data({ '估计': '—' });

      S.step('Course 有 20,000 行：dept = CS 占 8%，building = GHC 占 2%', function () {
        S.code([1, 2]);
        S.pulse('p1', { delay: 100 }); S.pulse('p2', { delay: 300 });
      });
      S.step('均匀 + 独立假设：两个选择性直接相乘 0.08 × 0.02 = 0.0016 → 估计 32 行', function () {
        S.code(3);
        S.fly('p1', [560, 116], { label: '0.08', w: 56, h: 30, color: C.blue, dur: 650 }); S.fly('p2', [560, 116], { label: '0.02', w: 56, h: 30, color: C.blue, delay: 200, dur: 650 });
        S.to('est', { opacity: 1 }, { delay: 850, dur: 250 }); S.count('est', 32, { delay: 900, dur: 600 });
        S.to('bE', { opacity: 1 }, { delay: 1000, dur: 200 }); S.to('bEl', { opacity: 1 }, { delay: 1000, dur: 200 });
        S.to('bE', { w: 15, x: 97.5 }, { delay: 1000, dur: 400 });
        S.data({ '估计': 32 }, { delay: 1500 });
      });
      S.step('可是 CS 的课大多就在 GHC 楼 —— 两列高度相关，真实值约 1,280 行：估计低了 40 倍', function () {
        S.code(4);
        S.to('bT', { opacity: 1 }, { dur: 200 }); S.to('bTl', { opacity: 1 }, { dur: 200 });
        S.to('bT', { w: 570, x: 375 }, { delay: 100, dur: 1100, ease: 'out' });
        S.to('bTv', { opacity: 1, x: 672 }, { delay: 100, dur: 1100, ease: 'out' }); roll(S, 'bTv', '≈ ', 0, 1280, { delay: 100, dur: 1100, suf: ' 行（示意）' });
        S.log('正相关 → 独立性假设低估', { delay: 1300, kind: 'warn' });
      }, { hold: 1600 });
      S.step('A ⋈ B（按 y）：6,000 × 12,000 / max(600, 600)', function () {
        S.code([6, 8]);
        S.set('j1', { text: '|A ⋈ B| = 6,000 × 12,000 / 600' }, { delay: 800 });
        S.fly('TA', [300, 430], { label: '6,000', w: 70, h: 30, color: C.cyan, dur: 700 });
        S.fly('TB', [430, 430], { label: '12,000', w: 76, h: 30, color: C.cyan, delay: 150, dur: 700 });
        S.fly('TB', [580, 430], { label: '600', w: 56, h: 30, color: C.purple, delay: 300, dur: 700 });
        S.to('j1v', { opacity: 1 }, { delay: 1000, dur: 250 }); roll(S, 'j1v', '= ', 0, 120000, { delay: 1050, dur: 800 });
        S.flash('TA', C.cyan, { prop: 'stroke', delay: 200 }); S.flash('TB', C.cyan, { prop: 'stroke', delay: 350 });
      });
      S.step('再连 C（按 z）：分子用上一步的估计 120,000 × 12,000，分母 800', function () {
        S.code([9, 10]);
        S.set('j1', { text: '|(A ⋈ B) ⋈ C| = 120,000 × 12,000 / 800' }, { delay: 700 });
        S.fly([430, 466], [330, 430], { label: '120,000', w: 86, h: 30, color: C.cyan, dur: 650 });
        S.fly('TC', [470, 430], { label: '12,000', w: 76, h: 30, color: C.cyan, delay: 150, dur: 650 });
        S.flash('TC', C.cyan, { prop: 'stroke', delay: 200 });
        roll(S, 'j1v', '= ', 120000, 1800000, { delay: 900, dur: 900 }); S.pulse('j1v', { delay: 1850 });
      });
      S.step('C ⋈ D：w 是 C 里指向 D 主键的外键 → C 的每一行恰好连上 D 的一行 → 12,000', function () {
        S.code(11);
        S.set('j1', { text: '|C ⋈ D| = |C|（外键 → 主键）' }, { delay: 600 });
        S.fly('TC', 'TD', { color: C.green, dur: 700 }); S.flash('TD', C.green, { prop: 'stroke', delay: 700 });
        roll(S, 'j1v', '= ', 1800000, 12000, { delay: 800, dur: 700 });
        S.log('不要被 V(w, C) = 700 带偏', { delay: 900 });
      });
      S.step('单表谓词：x = 5 → 6,000 / 300 = 20；z ≠ 3 → 12,000 − 12,000 / 800 = 11,985', function () {
        S.code([13, 14]);
        S.set('j1', { text: 'σ(x = 5)(A) = N / V(x) = 6,000 / 300' }, { delay: 200 });
        roll(S, 'j1v', '= ', 12000, 20, { delay: 300, dur: 600 }); S.flash('TA', C.blue, { prop: 'stroke', delay: 200 });
        S.set('j2', { text: 'σ(z ≠ 3)(C) = N − N / V(z) = 12,000 − 15 = 11,985' }, { delay: 1100 });
        S.flash('TC', C.blue, { prop: 'stroke', delay: 1100 });
        S.log('主键等值 = 1；外键连接 = 子表行数', { delay: 1300, kind: 'ok' });
      }, { hold: 2000 });
    }
  }
  ]
});
})();
