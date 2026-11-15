/* HW2 存储：NSM / DSM 数页数、保序字典、排序对 RLE / Delta 的影响
 * 表 Q(k, x, y) 的大小（12,000 条、NSM 120 页、DSM 每列 40 页）、城市名和数值都是讲义里自编的示意数据。 */
(function () {
var C = Viz.C, PG = '#22325a', HIT = '#2c5f9e';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #2（题目 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw2-clean.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Homework #2（官方答案 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw2-sols.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #06 Storage Models & Compression（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/06-storage3.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #06 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/06-storage3.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #04 Buffer Pools（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/04-bufferpool.pdf' }
];
function note(S, t) { S.text('note', { x: 20, y: 24, text: t, anchor: 'start', size: 14, color: C.mute }); }
function title(S, id, x, y, text, o) {
  var p = { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}
function counter(S, pre) { S.text('cnt', { x: 840, y: 24, anchor: 'end', val: 0, pre: pre || '读过的页：', color: C.amber, size: 17, weight: 700 }); }

/* DSM：三列各 40 页 */
var CX0 = 96, CP = 18.4, COLY = [150, 268, 386], COLN = ['k', 'x', 'y'];
function cx(i) { return CX0 + i * CP; }
function dsm(S, op) {
  COLN.forEach(function (n, r) {
    S.text('L' + r, { x: 30, y: COLY[r] - 8, text: n + ' 列', anchor: 'start', size: 17, weight: 700, opacity: op });
    S.text('Ls' + r, { x: 30, y: COLY[r] + 16, text: '40 页', anchor: 'start', size: 14, color: C.mute, opacity: op });
    for (var i = 0; i < 40; i++) S.box('p' + r + '_' + i, { x: cx(i), y: COLY[r], w: 14, h: 52, rx: 3, fill: PG, stroke: 'none', sw: 0, opacity: op });
  });
}
function sweep(S, r, from, to, delay, step, col) {
  for (var i = from; i <= to; i++) S.to('p' + r + '_' + i, { fill: col || HIT }, { delay: delay + (i - from) * step, dur: 200 });
}
function bars(S, y) {
  S.text('bN', { x: 40, y: y, text: 'NSM', anchor: 'start', size: 15, weight: 700, opacity: 0 });
  S.box('barN', { x: 110, y: y, w: 0, h: 22, rx: 4, fill: C.red, stroke: 'none', sw: 0, opacity: 0 });
  S.text('barNv', { x: 120, y: y, val: 0, anchor: 'start', size: 15, color: C.ink, opacity: 0 });
  S.text('bD', { x: 40, y: y + 34, text: 'DSM', anchor: 'start', size: 15, weight: 700, opacity: 0 });
  S.box('barD', { x: 110, y: y + 34, w: 0, h: 22, rx: 4, fill: C.green, stroke: 'none', sw: 0, opacity: 0 });
  S.text('barDv', { x: 120, y: y + 34, val: 0, anchor: 'start', size: 15, color: C.ink, opacity: 0 });
}
function growBar(S, id, v, scale, delay) {
  var w = v * scale;
  S.to(id, { opacity: 1 }, { delay: delay, dur: 200 });
  S.to(id, { w: w, x: 90 + w / 2 }, { delay: delay, dur: 700, ease: 'out' });
  S.to(id + 'v', { opacity: 1, x: 100 + w }, { delay: delay, dur: 700, ease: 'out' });
  S.count(id + 'v', v, { delay: delay, dur: 700 });
}

Viz.register('hw2-storage', {
  title: 'HW2：行存与列存要读几页 · 保序字典 · 排序与压缩',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：NSM 全表扫描 ───────────── */
  {
    name: 'NSM：整行一起读',
    moving: '页格子按扫描顺序一格格变蓝、页数滚动；放大镜里一页的 k / x / y 依次闪烁；第二遍扫描时格子变绿、缓冲池命中数滚动而磁盘页数不动',
    lang: '计算过程',
    code: [
      '表 Q(k, x, y)：12,000 条，三列等宽',
      'NSM：一页 100 条完整元组 → 120 页',
      '',
      'SELECT MAX(y) FROM Q WHERE x = 7;',
      '  没有索引 → 顺序扫',
      '  每读一页：k、x、y 一起进来',
      '  内容最坏：每行都命中',
      '  → 120 页（k 列的字节白读了）',
      '',
      'SELECT MIN(k) FROM Q',
      '  WHERE y = (SELECT MAX(y) FROM Q);',
      '  内层：120 页',
      '  外层：缓冲池无限大，全部命中',
      '  → 合计仍是 120 页'
    ].join('\n'),
    build: function (S) {
      var RY = [118, 176, 234, 292];
      function px(i) { return 82 + i * 25; }
      function pid(n) { return 'n' + n; }
      note(S, '表 Q 的大小为示意（12,000 条、120 页）');
      counter(S);
      title(S, 'tT', 40, 64, 'NSM：120 页，每页 100 条完整元组 (k, x, y)');
      for (var n = 0; n < 120; n++) S.box(pid(n), { x: px(n % 30), y: RY[Math.floor(n / 30)], w: 19, h: 46, rx: 3, fill: PG, stroke: 'none', sw: 0 });
      S.text('hitC', { x: 840, y: 52, anchor: 'end', val: 0, pre: '缓冲池命中：', color: C.green, size: 15, opacity: 0 });
      S.box('zoom', { x: 430, y: 438, w: 780, h: 168, rx: 12, fill: C.panel, stroke: C.line, sw: 1.5, opacity: 0 });
      S.text('zT', { x: 60, y: 374, text: '放大一页：元组一条挨一条，三列混在一起', anchor: 'start', size: 15, color: C.mute, opacity: 0 });
      var TUP = [[5, 7, 41], [77, 7, 18], [900, 7, 63]];
      TUP.forEach(function (t, r) {
        ['k', 'x', 'y'].forEach(function (c, j) {
          S.box('z' + r + c, { x: 120 + r * 240 + j * 66, y: 430, w: 62, h: 40, rx: 5, fill: PG, stroke: C.line, sw: 1, label: c + '=' + t[j], size: 15, opacity: 0 });
        });
      });
      S.text('zDots', { x: 795, y: 430, text: '…', size: 20, color: C.mute, opacity: 0 });
      S.text('zN', { x: 430, y: 494, text: '', size: 15, color: C.amber });
      S.data({ '查询': 'MAX(y) WHERE x = 7', '读过的页': 0 });

      S.step('SELECT MAX(y) FROM Q WHERE x = 7：没有索引，只能从第 1 页顺序扫', function () {
        S.code([4, 5]); S.log('顺序扫 Q');
        for (var r = 0; r < 4; r++) S.pulse(pid(r * 30), { delay: r * 120, scale: 1.15 });
      });
      S.step('读第 1 页：整页进缓冲池 —— 100 条元组的 k、x、y 一起被读进来', function () {
        S.code(6);
        S.to(pid(0), { fill: HIT }, { dur: 250 }); S.count('cnt', 1, { delay: 100, dur: 300 });
        S.fly(pid(0), [430, 438], { color: C.blue, delay: 200, dur: 650 });
        S.pop('zoom', { delay: 700 }); S.to('zT', { opacity: 1 }, { delay: 800, dur: 300 });
        TUP.forEach(function (t, r) { ['k', 'x', 'y'].forEach(function (c, j) { S.pop('z' + r + c, { delay: 900 + r * 120 + j * 60 }); }); });
        S.to('zDots', { opacity: 1 }, { delay: 1300, dur: 300 });
        S.data({ '读过的页': 1 }, { delay: 300 });
      });
      S.step('每条元组检查 x = 7 —— 内容最坏：全部命中，y 也都要看；k 跟着进来却没用', function () {
        S.code(7);
        [0, 1, 2].forEach(function (r) { S.flash('z' + r + 'x', C.blue, { delay: r * 150 }); });
        [0, 1, 2].forEach(function (r) { S.to('z' + r + 'y', { fill: C.green, color: C.bg }, { delay: 600 + r * 150, dur: 300 }); });
        [0, 1, 2].forEach(function (r) { S.to('z' + r + 'k', { opacity: .35 }, { delay: 1100 + r * 100, dur: 400 }); });
        S.set('zN', { text: '灰掉的 k：读了，但这条查询用不上' }, { delay: 1300 });
      });
      S.step('继续扫第 1 行剩下的 29 页', function () {
        S.code(5);
        for (var i = 1; i < 30; i++) S.to(pid(i), { fill: HIT }, { delay: i * 35, dur: 200 });
        S.count('cnt', 30, { dur: 1050 }); S.data({ '读过的页': 30 }, { delay: 1050 });
      });
      S.step('第 2、3、4 行 …… 一页都省不掉', function () {
        for (var i = 30; i < 120; i++) S.to(pid(i), { fill: HIT }, { delay: (i - 30) * 16, dur: 180 });
        S.count('cnt', 120, { dur: 1450 }); S.pulse('cnt', { delay: 1450 });
        S.data({ '读过的页': 120 }, { delay: 1450 }); S.log('读完 120 页', { delay: 1500, kind: 'io' });
      });
      S.step('结论：NSM 下这条查询要读整张表 = 120 页，其中 1/3 的字节是白读的 k 列', function () {
        S.code(8);
        S.flash('zoom', C.amber, { prop: 'stroke' });
        [0, 1, 2].forEach(function (r) { S.pulse('z' + r + 'k', { delay: 300 + r * 120 }); });
        S.log('NSM：120 页', { delay: 600, kind: 'ok' });
      });
      S.step('换一条带子查询的：内层 SELECT MAX(y) 已经把 120 页全部读进了缓冲池', function () {
        S.code([10, 12]);
        S.set('zN', { text: '' });
        for (var i = 0; i < 120; i++) S.to(pid(i), { fill: '#3a4f86' }, { delay: i * 8, dur: 200 });
        S.data({ '查询': 'MIN(k) WHERE y = (子查询)', '读过的页': 120 }, { delay: 300 });
        S.log('内层：120 页（同上）', { delay: 500, kind: 'io' });
      });
      S.step('外层再扫一遍：每一页都在缓冲池里 —— 命中数涨到 120，磁盘读一次都没增加', function () {
        S.code([13, 14]);
        S.to('hitC', { opacity: 1 }, { dur: 250 });
        for (var i = 0; i < 120; i++) S.to(pid(i), { fill: C.green }, { delay: 200 + i * 12, dur: 180 });
        S.count('hitC', 120, { delay: 200, dur: 1450 }); S.pulse('cnt', { delay: 1700 });
        S.data({ '缓冲池命中': 120 }, { delay: 1700 }); S.log('合计仍是 120 页磁盘读', { delay: 1750, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 2：DSM 过滤 + 聚合 ───────────── */
  {
    name: 'DSM：只读需要的列',
    moving: '三列页格子先后弹出；过滤列逐页变蓝、页数滚动；命中偏移从 x 列飞到 y 列，y 列逐页变蓝；对比条长出来；子查询版本里 y 列第二遍变绿（缓冲池命中）、k 列再逐页变蓝',
    lang: '计算过程',
    code: [
      'DSM：每列单独存，三列等宽',
      '  → 每列 40 页，每页 300 个值',
      '',
      'SELECT MAX(y) FROM Q WHERE x = 7;',
      '  x 列读完：40 页',
      '  内容最坏 → 全部命中',
      '  y 列也读完：40 页',
      '  k 列：0 页',
      '  → 80 页（NSM 是 120）',
      '',
      'SELECT MIN(k) FROM Q',
      '  WHERE y = (SELECT MAX(y) FROM Q);',
      '  内层：y 列 40 页',
      '  外层扫 y：缓冲池命中，0 页',
      '  内容最坏 → k 列 40 页',
      '  → 80 页'
    ].join('\n'),
    build: function (S) {
      note(S, '表 Q 的大小为示意（每列 40 页）');
      counter(S);
      title(S, 'tT', 30, 64, 'DSM（隐式偏移）：第 i 条元组的值在每一列的第 i 个位置');
      dsm(S, 0);
      S.text('off', { x: 430, y: 330, text: '', size: 15, color: C.amber });
      S.text('hitC', { x: 840, y: 52, anchor: 'end', val: 0, pre: '缓冲池命中：', color: C.green, size: 15, opacity: 0 });
      bars(S, 470);
      S.data({ '查询': 'MAX(y) WHERE x = 7', '读过的页': 0 });

      S.step('同一张表改用 DSM：每列单独成文件；三列等宽 → 每列 40 页', function () {
        S.code([1, 2]);
        COLN.forEach(function (n, r) {
          S.to('L' + r, { opacity: 1 }, { delay: r * 250, dur: 300 }); S.to('Ls' + r, { opacity: 1 }, { delay: r * 250, dur: 300 });
          for (var i = 0; i < 40; i++) S.to('p' + r + '_' + i, { opacity: 1 }, { delay: r * 250 + i * 10, dur: 250 });
        });
      });
      S.step('WHERE x = 7：x 列没有索引，40 页从头读到尾', function () {
        S.code([4, 5]);
        sweep(S, 1, 0, 39, 0, 30); S.count('cnt', 40, { dur: 1200 });
        S.data({ '读过的页': 40 }, { delay: 1200 }); S.log('x 列：40 页', { delay: 1250, kind: 'io' });
      });
      S.step('内容最坏：每一行都满足 x = 7 —— 记下所有命中的偏移', function () {
        S.code(6);
        for (var i = 0; i < 40; i += 3) S.flash('p1_' + i, C.amber, { delay: i * 20 });
        S.set('off', { text: '命中偏移：0, 1, 2, …, 11999（全部）' }, { delay: 300 }); S.pulse('off', { delay: 300 });
      });
      S.step('按偏移去 y 列取值：每一页里都有命中的行 → y 列 40 页也全要读', function () {
        S.code(7);
        [0, 8, 16, 24, 32, 39].forEach(function (i, n) { S.fly('p1_' + i, 'p2_' + i, { color: C.cyan, delay: n * 120, dur: 550 }); });
        sweep(S, 2, 0, 39, 400, 28); S.count('cnt', 80, { delay: 400, dur: 1150 });
        S.data({ '读过的页': 80 }, { delay: 1550 }); S.log('y 列：40 页', { delay: 1600, kind: 'io' });
      });
      S.step('k 列一页都没碰 —— 这就是列存在分析查询上省下的 I/O', function () {
        S.code(8);
        for (var i = 0; i < 40; i++) S.to('p0_' + i, { opacity: .35 }, { delay: i * 12, dur: 250 });
        S.flash('L0', C.green, { prop: 'color', delay: 400 });
        S.log('k 列：0 页', { delay: 500, kind: 'ok' });
      });
      S.step('和 NSM 对比：80 页 vs 120 页', function () {
        S.code(9);
        ['bN', 'bD'].forEach(function (id) { S.to(id, { opacity: 1 }, { dur: 300 }); });
        growBar(S, 'barN', 120, 4, 100); growBar(S, 'barD', 80, 4, 400);
        S.log('DSM 80 页 < NSM 120 页', { delay: 1100, kind: 'ok' });
      });
      S.step('换子查询那条：内层 SELECT MAX(y) 只读 y 列 —— 40 页', function () {
        S.code([11, 13]); S.set('off', { text: '' });
        ['bN', 'bD', 'barN', 'barD', 'barNv', 'barDv'].forEach(function (id) { S.to(id, { opacity: 0 }, { dur: 300 }); });
        for (var r = 0; r < 3; r++) for (var i = 0; i < 40; i++) S.to('p' + r + '_' + i, { fill: PG, opacity: 1 }, { delay: 200, dur: 300 });
        S.count('cnt', 0, { delay: 200, dur: 300 });
        sweep(S, 2, 0, 39, 600, 25); S.count('cnt', 40, { delay: 600, dur: 1000 });
        S.data({ '查询': 'MIN(k) WHERE y = (子查询)', '读过的页': 40 }, { delay: 1600 });
      });
      S.step('外层再扫 y 找最大值所在的行：y 列已经在缓冲池里 → 0 次磁盘读', function () {
        S.code(14);
        S.to('hitC', { opacity: 1 }, { dur: 250 });
        sweep(S, 2, 0, 39, 150, 25, C.green); S.count('hitC', 40, { delay: 150, dur: 1000 });
        S.log('缓冲池命中 40 页', { delay: 1200, kind: 'ok' });
      });
      S.step('内容最坏：所有行的 y 都等于最大值 → 每一行的 k 都要取 → k 列 40 页，合计 80', function () {
        S.code([15, 16]);
        [0, 13, 26, 39].forEach(function (i, n) { S.fly('p2_' + i, 'p0_' + i, { color: C.cyan, delay: n * 120, dur: 550 }); });
        sweep(S, 0, 0, 39, 350, 25); S.count('cnt', 80, { delay: 350, dur: 1000 });
        S.data({ '读过的页': 80 }, { delay: 1350 }); S.log('合计 80 页（NSM 是 120）', { delay: 1400, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 3：DSM 点查的最少与最多 ───────────── */
  {
    name: 'DSM 点查：最少与最多',
    moving: '三个键的标记落在 k 列的页上；扫描游标逐页推进、页数滚动；偏移从 k 列飞到 x、y 列的同号页；换成最坏排列时格子褪回原色、标记挪到分散的页',
    lang: '计算过程',
    code: [
      'SELECT x, y FROM Q',
      '  WHERE k = 5 OR k = 77 OR k = 900;',
      '',
      '最少（最有利的排列）：',
      '  三个键都在 k 列第 1 页：1 页',
      '  偏移都 < 300 → x 第 1 页、y 第 1 页',
      '  → 1 + 1 + 1 = 3',
      '',
      '最多（最不利的排列）：',
      '  最后一个键在 k 列最后一页：40 页',
      '  三个偏移落在三个不同的页',
      '  x 列 3 页，y 列 3 页',
      '  → 40 + 3 + 3 = 46',
      '',
      '对照 NSM：最少 1，最多 120'
    ].join('\n'),
    build: function (S) {
      note(S, '三个键与表的大小为示意');
      counter(S);
      title(S, 'tT', 30, 64, 'k 是主键、没有索引：只能扫 k 列找键，再按偏移去别的列取值');
      dsm(S, 1);
      ['5', '77', '900'].forEach(function (t, m) {
        S.dot('mk' + m, { x: cx(0) + m * 36, y: COLY[0] - 46, r: 16, fill: C.amber, label: t, color: C.bg, size: 14, opacity: 0 });
      });
      S.line('mkL', { x1: cx(0) + 36, y1: COLY[0] - 28, x2: cx(0), y2: COLY[0] - 26, stroke: C.amber, sw: 2, arrow: true, opacity: 0 });
      S.text('mkT', { x: cx(0) + 100, y: COLY[0] - 46, text: '都在 k 列第 1 页', anchor: 'start', size: 15, color: C.amber, opacity: 0 });
      S.text('res', { x: 430, y: 470, text: '', size: 17, weight: 700, color: C.green });
      S.text('res2', { x: 430, y: 506, text: '', size: 15, color: C.mute });
      S.data({ '情形': '最少', '读过的页': 0 });

      S.step('三个要找的键 5、77、900 —— 先看最有利的排列：它们都在 k 列第 1 页', function () {
        S.code([1, 2]); S.log('最少的情形');
        [0, 1, 2].forEach(function (m) { S.pop('mk' + m, { delay: m * 180 }); });
        S.to('mkL', { opacity: 1 }, { delay: 600, dur: 300 }); S.to('mkT', { opacity: 1 }, { delay: 700, dur: 300 });
      });
      S.step('读 k 列第 1 页：三个键全部找到；k 是主键，不会再有第二条，可以停', function () {
        S.code(5);
        S.to('p0_0', { fill: HIT }, { dur: 250 }); S.count('cnt', 1, { delay: 100, dur: 300 }); S.ripple(cx(0), COLY[0], { delay: 200, color: C.blue });
        [0, 1, 2].forEach(function (m) { S.pulse('mk' + m, { delay: 400 + m * 120 }); });
        S.data({ '读过的页': 1 }, { delay: 300 }); S.log('k 第 1 页：找到 3 个键', { delay: 600, kind: 'ok' });
      });
      S.step('三个偏移都小于 300 → 在 x 列、y 列里也都落在第 1 页', function () {
        S.code(6);
        S.fly('p0_0', 'p1_0', { color: C.cyan, dur: 600 }); S.fly('p0_0', 'p2_0', { color: C.cyan, delay: 250, dur: 750 });
        S.to('p1_0', { fill: HIT }, { delay: 600, dur: 200 }); S.to('p2_0', { fill: HIT }, { delay: 1000, dur: 200 });
        S.count('cnt', 2, { delay: 600, dur: 250 }); S.count('cnt', 3, { delay: 1000, dur: 250 });
        S.data({ '读过的页': 3 }, { delay: 1000 });
      });
      S.step('最少 = 3 页：每列各 1 页', function () {
        S.code(7);
        ['p0_0', 'p1_0', 'p2_0'].forEach(function (id, n) { S.flash(id, C.green, { delay: n * 150 }); });
        S.set('res', { text: '最少：1 + 1 + 1 = 3 页' }, { delay: 300 }); S.pulse('res', { delay: 300 });
        S.log('最少 3 页', { delay: 400, kind: 'ok' });
      }, { hold: 1500 });
      S.step('再看最不利的排列：三个键分散在三页，最后一个在 k 列的最后一页', function () {
        S.code([9, 10]); S.log('最多的情形');
        ['p0_0', 'p1_0', 'p2_0'].forEach(function (id) { S.to(id, { fill: PG }, { dur: 400 }); });
        S.count('cnt', 0, { dur: 400 }); S.set('res', { text: '' }, { delay: 100 }); S.hide('mkL'); S.hide('mkT');
        S.move('mk0', cx(6), COLY[0] - 44, { delay: 300, dur: 700 }); S.move('mk1', cx(21), COLY[0] - 44, { delay: 400, dur: 700 }); S.move('mk2', cx(39), COLY[0] - 44, { delay: 500, dur: 700 });
        S.data({ '情形': '最多', '读过的页': 0 }, { delay: 300 });
      });
      S.step('不知道键在哪，只能把 k 列 40 页从头扫到尾，最后一页才找齐', function () {
        S.code(10);
        sweep(S, 0, 0, 39, 0, 32); S.count('cnt', 40, { dur: 1280 });
        S.pulse('mk0', { delay: 6 * 32 + 150 }); S.pulse('mk1', { delay: 21 * 32 + 150 }); S.pulse('mk2', { delay: 39 * 32 + 150 });
        S.data({ '读过的页': 40 }, { delay: 1300 }); S.log('k 列：40 页', { delay: 1350, kind: 'io' });
      });
      S.step('三个偏移落在 x 列三个不同的页 —— 直接跳过去，只读这 3 页，不是 40 页', function () {
        S.code([11, 12]);
        [6, 21, 39].forEach(function (i, n) {
          S.fly('p0_' + i, 'p1_' + i, { color: C.cyan, delay: n * 250, dur: 600 });
          S.to('p1_' + i, { fill: HIT }, { delay: n * 250 + 600, dur: 200 });
        });
        S.count('cnt', 43, { delay: 600, dur: 600 });
        S.data({ '读过的页': 43 }, { delay: 1200 });
      });
      S.step('y 列同理再读 3 页 → 最多 = 40 + 3 + 3 = 46 页', function () {
        S.code(13);
        [6, 21, 39].forEach(function (i, n) {
          S.fly('p1_' + i, 'p2_' + i, { color: C.cyan, delay: n * 250, dur: 600 });
          S.to('p2_' + i, { fill: HIT }, { delay: n * 250 + 600, dur: 200 });
        });
        S.count('cnt', 46, { delay: 600, dur: 600 }); S.pulse('cnt', { delay: 1300 });
        S.set('res', { text: '最多：40 + 3 + 3 = 46 页' }, { delay: 1300 }); S.pulse('res', { delay: 1300 });
        S.data({ '读过的页': 46 }, { delay: 1300 }); S.log('最多 46 页', { delay: 1350, kind: 'ok' });
      });
      S.step('对照 NSM：同一条查询最少 1 页、最多 120 页', function () {
        S.code(15);
        S.set('res2', { text: 'NSM：最少 1 页（三条元组同在第 1 页）· 最多 120 页' }, { delay: 200 }); S.pulse('res2', { delay: 200 });
        S.log('NSM 最少 1 / 最多 120', { delay: 400 });
      });
    }
  },

  /* ───────────── 场景 4：保序字典 ───────────── */
  {
    name: '保序字典编码',
    moving: '城市名飞进字典、重复的合并；字典项滑动排序、编码数字滚出；编码飞回原列位置；范围条件命中的编码变绿；对照的「先来先编号」列里错选的行变红',
    lang: '计算过程',
    code: [
      '原列：[Xian, Beijing, Shanghai,',
      '       Chengdu, Beijing]',
      '① 取不同值并排序：',
      '   Beijing < Chengdu < Shanghai < Xian',
      '② 依次编号：0, 1, 2, 3',
      '③ 替换：[3, 0, 2, 1, 0]',
      '',
      "city < 'S'  ⇔  code < 2（Shanghai=2）",
      '',
      '合法性只看两条：',
      '  相同的值 → 相同的编码',
      '  按原值排序后，编码严格递增',
      '',
      '先来先编号：Xian=1, Beijing=2, …',
      '  → 顺序全乱，范围条件没法直接用'
    ].join('\n'),
    build: function (S) {
      var V = ['Xian', 'Beijing', 'Shanghai', 'Chengdu', 'Beijing'], CODE = [3, 0, 2, 1, 0], BAD = [1, 2, 3, 4, 2];
      var D = ['Beijing', 'Chengdu', 'Shanghai', 'Xian'], DY = [150, 206, 262, 318];
      var arrive = ['Xian', 'Beijing', 'Shanghai', 'Chengdu'];
      function vy(i) { return 140 + i * 56; }
      note(S, '城市名为示意数据');
      title(S, 'tA', 40, 74, '原列 city');
      title(S, 'tD', 330, 74, '字典（排序后编号）');
      title(S, 'tE', 600, 74, '编码后的列');
      V.forEach(function (v, i) { S.box('v' + i, { x: 130, y: vy(i), w: 170, h: 40, rx: 7, fill: PG, stroke: C.line, sw: 1.2, label: v, size: 16 }); });
      arrive.forEach(function (d, j) {
        S.box('d' + j, { x: 440, y: DY[j], w: 170, h: 40, rx: 7, fill: C.panel, stroke: C.purple, sw: 1.5, label: d, size: 16, opacity: 0 });
        S.text('dc' + j, { x: 540, y: DY[j], val: 0, pre: '= ', anchor: 'start', size: 17, weight: 700, color: C.purple, opacity: 0 });
      });
      V.forEach(function (v, i) {
        S.box('e' + i, { x: 660, y: vy(i), w: 70, h: 40, rx: 7, fill: PG, stroke: C.line, sw: 1.2, label: String(CODE[i]), size: 17, opacity: 0 });
        S.box('b' + i, { x: 780, y: vy(i), w: 70, h: 40, rx: 7, fill: C.cell, stroke: C.line, sw: 1.2, label: String(BAD[i]), size: 17, opacity: 0 });
      });
      S.text('tB', { x: 780, y: 100, text: '先来先编号', size: 14, color: C.mute, opacity: 0 });
      S.text('q', { x: 430, y: 470, text: '', size: 17, weight: 700, color: C.cyan });
      S.text('q2', { x: 430, y: 510, text: '', size: 15, color: C.mute });
      S.data({ '字典': '{}' });

      S.step('一列城市名（示意）：要压成整数编码，同时还想支持范围查询', function () {
        S.code([1, 2]);
        V.forEach(function (v, i) { S.pulse('v' + i, { delay: i * 120, scale: 1.06 }); });
      });
      S.step('① 取出不同值：两个 Beijing 只进字典一次', function () {
        S.code(3);
        [0, 1, 2, 3].forEach(function (i) {
          var j = arrive.indexOf(V[i]);
          S.fly('v' + i, 'd' + j, { color: C.purple, delay: i * 220, dur: 600 });
          S.pop('d' + j, { delay: i * 220 + 600 });
        });
        S.fly('v4', 'd1', { color: C.purple, delay: 1000, dur: 600 }); S.pulse('d1', { delay: 1600 });
        S.log('4 个不同值', { delay: 1650 });
      });
      S.step('按字符串排序：字典项滑到排好的位置', function () {
        S.code(4);
        arrive.forEach(function (d, j) { S.move('d' + j, 440, DY[D.indexOf(d)], { delay: j * 100, dur: 750 }); S.to('dc' + j, { y: DY[D.indexOf(d)] }, { delay: j * 100, dur: 750 }); });
      });
      S.step('② 按排好的顺序编号 0、1、2、3 —— 编码的大小关系和原值一致（保序）', function () {
        S.code(5);
        arrive.forEach(function (d, j) {
          var c = D.indexOf(d);
          S.to('dc' + j, { opacity: 1 }, { delay: c * 200, dur: 300 }); S.count('dc' + j, c, { delay: c * 200, dur: 400 });
          S.pulse('d' + j, { delay: c * 200, scale: 1.05 });
        });
        S.data({ '字典': 'Beijing=0, Chengdu=1, Shanghai=2, Xian=3' }, { delay: 900 });
      });
      S.step('③ 把原列逐个换成编码：[3, 0, 2, 1, 0]', function () {
        S.code(6);
        V.forEach(function (v, i) {
          var j = arrive.indexOf(v);
          S.fly('d' + j, 'e' + i, { label: String(CODE[i]), w: 40, h: 32, color: C.purple, delay: i * 200, dur: 600 });
          S.pop('e' + i, { delay: i * 200 + 600 });
        });
      });
      S.step("范围条件 city < 'S' 直接变成 code < 2：只比整数，不用解码", function () {
        S.code(8);
        S.set('q', { text: "city < 'S'   →   code < 2" }); S.pulse('q');
        V.forEach(function (v, i) {
          var ok = CODE[i] < 2;
          S.to('e' + i, { fill: ok ? C.green : PG, color: ok ? C.bg : C.ink }, { delay: 400 + i * 150, dur: 300 });
          if (ok) S.flash('v' + i, C.green, { delay: 400 + i * 150 });
        });
        S.log('选中 Beijing、Chengdu、Beijing ✓', { delay: 1300, kind: 'ok' });
      });
      S.step('对照：如果按出现先后编号（Xian=1, Beijing=2, Shanghai=3, Chengdu=4），顺序就乱了', function () {
        S.code(14);
        S.to('tB', { opacity: 1 }, { dur: 300 });
        V.forEach(function (v, i) { S.pop('b' + i, { delay: 200 + i * 120 }); });
        S.flash('b0', C.amber, { delay: 1000 }); S.flash('b3', C.amber, { delay: 1100 });
        S.log('Xian 拿到最小的 1，Chengdu 拿到最大的 4', { delay: 1100, kind: 'warn' });
      });
      S.step("同样想用 code < 3（Shanghai=3）表示 city < 'S'：选中了 Xian、漏掉了 Chengdu", function () {
        S.code(15);
        S.set('q2', { text: '先来先编号：code < 3 → Xian ✗、Beijing、Beijing；Chengdu(4) 被漏掉 ✗' }, { delay: 200 });
        V.forEach(function (v, i) {
          var pick = BAD[i] < 3, wrong = (pick && v === 'Xian') || (!pick && v === 'Chengdu');
          S.to('b' + i, { fill: wrong ? C.red : pick ? C.green : C.cell, color: (wrong || pick) ? C.bg : C.ink }, { delay: 400 + i * 150, dur: 300 });
        });
        S.log('不保序 → 范围查询必须先解码', { delay: 1300, kind: 'err' });
      });
      S.step('所以判断一组编码合不合法只看两条：同值同码；按原值排序后编码严格递增', function () {
        S.code([10, 12]);
        [0, 1, 2, 3].forEach(function (j) { S.flash('d' + j, C.green, { prop: 'stroke', delay: j * 150 }); });
        S.log('[40, 5, 30, 12, 5] 也合法：空隙无所谓', { delay: 700, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 5：排序对 RLE / Delta 的影响 ───────────── */
  {
    name: '排序与 RLE / Delta',
    moving: '值方块按排序结果滑到新位置；游程括号合并、游程数从 10 滚到 3；数字行重排后增量值飞到下一行、所需位数从 4 滚到 2；最大值方块闪烁说明位打包不受影响',
    lang: '计算过程',
    code: [
      'RLE：每段连续相同值 → (值, 起点, 长度)',
      '  [B,A,B,C,A,B,A,C,B,A] → 10 段',
      '  排序后 [A×4, B×4, C×2] → 3 段',
      '',
      'Delta：存第一个值 + 相邻差',
      '  [105,101,108,102,107]',
      '  差：-4, +7, -6, +5 → 每个 4 位',
      '  排序后 [101,102,105,107,108]',
      '  差：+1, +3, +2, +1 → 每个 2 位',
      '',
      'Bit-packing：位宽看最大值 108 → 7 位',
      '  排不排序都一样',
      '位图 / 字典 / Mostly：',
      '  只看值域或不同值个数，与顺序无关'
    ].join('\n'),
    build: function (S) {
      var L = ['B', 'A', 'B', 'C', 'A', 'B', 'A', 'C', 'B', 'A'];
      var ord = L.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]; });
      var to = []; ord.forEach(function (o, k) { to[o[1]] = k; });
      var N = [105, 101, 108, 102, 107], NS = [101, 102, 105, 107, 108];
      function lx(i) { return 120 + i * 70; }
      function nx(i) { return 200 + i * 110; }
      var COL = { A: C.blue, B: C.purple, C: C.amber };
      note(S, '数值为示意数据');
      title(S, 'tR', 40, 66, 'RLE 游程编码');
      S.text('runs', { x: 840, y: 66, anchor: 'end', val: 10, pre: '游程数：', size: 16, weight: 700, color: C.amber });
      L.forEach(function (v, i) { S.box('l' + i, { x: lx(i), y: 130, w: 58, h: 44, rx: 7, fill: PG, stroke: COL[v], sw: 2, label: v, size: 18 }); });
      ['A', 'B', 'C'].forEach(function (v, j) {
        S.box('rl' + j, { x: [225, 505, 715][j], y: 130, w: [282, 282, 142][j], h: 60, rx: 8, fill: 'none', stroke: COL[v], sw: 2, dash: '5 4', opacity: 0 });
        S.text('rt' + j, { x: [225, 505, 715][j], y: 188, text: ['(A, 0, 4)', '(B, 4, 4)', '(C, 8, 2)'][j], size: 16, weight: 700, color: COL[v], opacity: 0 });
      });
      title(S, 'tD', 40, 262, 'Delta 增量编码');
      S.text('bits', { x: 840, y: 262, anchor: 'end', val: 0, pre: '每个差的位数：', size: 16, weight: 700, color: C.amber, opacity: 0 });
      N.forEach(function (v, i) { S.box('n' + i, { x: nx(i), y: 322, w: 84, h: 42, rx: 7, fill: PG, stroke: C.line, sw: 1.2, label: String(v), size: 17 }); });
      S.text('nl', { x: 40, y: 322, text: '原值', anchor: 'start', size: 15, color: C.mute });
      S.text('dl', { x: 40, y: 392, text: '实际存储', anchor: 'start', size: 15, color: C.mute });
      for (var i = 0; i < 5; i++) S.box('dd' + i, { x: nx(i), y: 392, w: 84, h: 38, rx: 7, fill: C.panel, stroke: C.cyan, sw: 1.5, label: '', size: 16, opacity: 0 });
      S.text('bp', { x: 430, y: 470, text: '', size: 15, color: C.mute });
      S.data({ RLE: '10 段', Delta: '—' });

      S.step('一列 10 个值（示意）：相邻的两个值没有一对相同', function () {
        S.code(2);
        L.forEach(function (v, i) { S.pulse('l' + i, { delay: i * 80, scale: 1.08 }); });
      });
      S.step('RLE 把每段连续相同的值记成一个三元组 —— 这里每段长度都是 1，10 段，一点没省', function () {
        S.code([1, 2]);
        L.forEach(function (v, i) { S.flash('l' + i, C.amber, { prop: 'stroke', delay: i * 90 }); });
        S.log('排序前：10 段', { delay: 900, kind: 'warn' });
      });
      S.step('先排序：每个值滑到排好序的位置', function () {
        S.code(3);
        L.forEach(function (v, i) { S.move('l' + i, lx(to[i]), 130, { delay: i * 60, dur: 800 }); });
      });
      S.step('相同的值连成三段 → RLE 只要 3 个三元组', function () {
        S.code(3);
        [0, 1, 2].forEach(function (j) { S.pop('rl' + j, { delay: j * 200 }); S.to('rt' + j, { opacity: 1 }, { delay: 300 + j * 200, dur: 300 }); });
        S.count('runs', 3, { delay: 300, dur: 700 }); S.pulse('runs', { delay: 1000 });
        S.data({ RLE: '3 段' }, { delay: 1000 }); S.log('排序后：3 段 ✓', { delay: 1050, kind: 'ok' });
      });
      S.step('Delta：存第一个值，后面只存和前一个值的差 —— 原顺序下差是 −4、+7、−6、+5', function () {
        S.code([5, 7]);
        var D0 = ['105', '−4', '+7', '−6', '+5'];
        S.to('bits', { opacity: 1 }, { dur: 250 });
        D0.forEach(function (t, i) {
          S.fly('n' + i, 'dd' + i, { label: t, w: 60, h: 30, color: C.cyan, delay: i * 180, dur: 550 });
          S.set('dd' + i, { label: t }, { delay: i * 180 + 550 }); S.to('dd' + i, { opacity: 1 }, { delay: i * 180 + 500, dur: 200 });
        });
        S.count('bits', 4, { delay: 1200, dur: 500 });
        S.data({ Delta: '差的绝对值最大 7 → 带符号 4 位' }, { delay: 1300 });
      });
      S.step('排序后再算：差变成 +1、+3、+2、+1 → 每个差 2 位就够', function () {
        S.code([8, 9]);
        N.forEach(function (v, i) { S.move('n' + i, nx(NS.indexOf(v)), 322, { delay: i * 70, dur: 800 }); });
        var D1 = ['101', '+1', '+3', '+2', '+1'];
        D1.forEach(function (t, i) { S.set('dd' + i, { label: t }, { delay: 1000 + i * 120 }); S.flash('dd' + i, C.green, { delay: 1000 + i * 120 }); });
        S.count('bits', 2, { delay: 1300, dur: 500 }); S.pulse('bits', { delay: 1800 });
        S.data({ Delta: '差都 ≤ 3 → 2 位' }, { delay: 1800 }); S.log('Delta：4 位 → 2 位 ✓', { delay: 1850, kind: 'ok' });
      });
      S.step('对照位打包：位宽只看最大值 108 → 7 位，排不排序都一样', function () {
        S.code([11, 12]);
        S.flash('n2', C.amber); S.pulse('n2');
        S.set('bp', { text: 'Bit-packing：max = 108 → 7 位；排序前后不变' }, { delay: 300 });
        S.log('位打包不受顺序影响', { delay: 500 });
      });
      S.step('位图、字典、Mostly 也一样：大小只取决于值域或不同值个数，和顺序无关', function () {
        S.code([13, 14]);
        S.set('bp', { text: '位图：行数 × 不同值个数 · 字典：不同值个数 · Mostly：例外有几个' }, { delay: 200 });
        S.flash('runs', C.green, { prop: 'color', delay: 600 }); S.flash('bits', C.green, { prop: 'color', delay: 800 });
        S.log('排序只帮 RLE 和 Delta', { delay: 900, kind: 'ok' });
      });
    }
  }
  ]
});
})();
