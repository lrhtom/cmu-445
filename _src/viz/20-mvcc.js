/* #20 MVCC：版本可见性 / 写冲突（先写者胜）/ 写偏斜 / 增量式版本存储 / 垃圾回收
 * 例子里的数值（A₀=123、A₁=456、$111/$222/$333、A100/B100/B101、ts=12/25）都取自官方 Slides。T1 蓝、T2 紫。 */
(function () {
var C = Viz.C, TC = { 1: C.blue, 2: C.purple };
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #20 Multi-Version Concurrency Control（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/20-multiversioning.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #20 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/20-multiversioning.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Project #4 Concurrency Control', u: 'https://15445.courses.cs.cmu.edu/fall2025/project4/' }
];
var SUB = ['₀', '₁', '₂', '₃'];

/* 场景 1 / 2 共用：版本表 + 事务状态表 + 可见区间时间轴 */
function mv(S) {
  var RY = [186, 232], BY = [366, 404], END = 812;
  function TX(ts) { return 150 + ts * 150; }
  S.text('note', { x: 430, y: 22, text: '例子与数值取自官方 Slides', size: 14, color: C.mute });
  [1, 2].forEach(function (th) {
    S.box('chip' + th, { x: th === 1 ? 120 : 740, y: 62, w: 200, h: 40, rx: 20, fill: C.panel, stroke: TC[th], sw: 2, label: 'T' + th + '：未开始', size: 15, color: C.mute });
  });
  S.box('vp', { x: 300, y: 192, w: 440, h: 176, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
  S.text('vt', { x: 300, y: 124, text: 'A 的物理版本（从不原地覆盖）', size: 15, weight: 700 });
  [['版本', 140], ['值', 240], ['begin-ts', 345], ['end-ts', 455]].forEach(function (h, i) { S.text('vh' + i, { x: h[1], y: 150, text: h[0], size: 14, color: C.mute }); });
  S.box('sp', { x: 700, y: 192, w: 280, h: 176, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
  S.text('st', { x: 700, y: 124, text: '事务状态表', size: 15, weight: 700 });
  [['事务', 606], ['ts', 672], ['状态', 762]].forEach(function (h, i) { S.text('sh' + i, { x: h[1], y: 150, text: h[0], size: 14, color: C.mute }); });
  S.text('tt', { x: 40, y: 322, text: '每个版本的可见区间 [begin-ts, end-ts)：事务拿自己的时间戳去对', anchor: 'start', size: 14, color: C.mute });
  S.line('ax', { x1: 120, y1: 470, x2: 836, y2: 470, stroke: C.line, sw: 2, arrow: true });
  [0, 1, 2, 3].forEach(function (t) {
    S.line('tk' + t, { x1: TX(t), y1: 464, x2: TX(t), y2: 476, stroke: C.line, sw: 2 });
    S.text('tl' + t, { x: TX(t), y: 490, text: String(t), size: 14, color: C.mute });
  });
  S.text('tinf', { x: END, y: 490, text: '∞', size: 16, color: C.mute }); S.text('tax', { x: 120, y: 490, text: 'ts', size: 14, color: C.mute, anchor: 'end' });
  [0, 1].forEach(function (i) {
    S.box('vr' + i, { x: 300, y: RY[i], w: 410, h: 38, rx: 6, fill: C.cell, stroke: C.line, sw: 1.5, opacity: i ? 0 : 1 });
    S.text('vn' + i, { x: 140, y: RY[i], text: 'A' + SUB[i], size: 17, weight: 700, opacity: i ? 0 : 1 });
    S.text('vv' + i, { x: 240, y: RY[i], text: i ? '456' : '123', size: 17, weight: 700, opacity: i ? 0 : 1 });
    S.text('vb' + i, { x: 345, y: RY[i], val: 0, size: 17, weight: 700, color: C.purple, opacity: i ? 0 : 1 });
    S.text('ve' + i, { x: 455, y: RY[i], text: '∞', size: 17, weight: 700, color: C.purple, opacity: i ? 0 : 1 });
    S.box('sr' + (i + 1), { x: 700, y: RY[i], w: 250, h: 38, rx: 6, fill: C.cell, stroke: C.line, sw: 1.5, opacity: 0 });
    S.text('sn' + (i + 1), { x: 606, y: RY[i], text: 'T' + (i + 1), size: 16, weight: 700, color: TC[i + 1], opacity: 0 });
    S.text('sts' + (i + 1), { x: 672, y: RY[i], text: String(i + 1), size: 16, weight: 700, color: C.purple, opacity: 0 });
    S.text('ss' + (i + 1), { x: 762, y: RY[i], text: 'ACTIVE', size: 15, weight: 700, color: C.amber, opacity: 0 });
  });
  [1, 2].forEach(function (th) {
    S.line('mk' + th, { x1: TX(th), y1: 470, x2: TX(th), y2: 344, stroke: TC[th], sw: 2.5, draw: 0, opacity: 0 });
    S.box('ml' + th, { x: TX(th), y: 520, w: 96, h: 24, rx: 12, fill: C.bg, stroke: TC[th], sw: 2, label: 'T' + th + '：ts=' + th, size: 14, opacity: 0 });
  });
  S.box('bar0', { x: (TX(0) + END) / 2, y: BY[0], w: END - TX(0), h: 28, rx: 6, fill: '#1c416e', stroke: C.blue, sw: 1.5, label: 'A₀ = 123　[0, ∞)', size: 14 });
  S.box('bar1', { x: TX(0), y: BY[1], w: 2, h: 28, rx: 6, fill: '#4d3b17', stroke: C.amber, sw: 1.5, label: '', size: 14, opacity: 0 });
  S.text('vd', { x: 430, y: 298, text: '', size: 16, weight: 700, opacity: 0 });
  S.box('vcur', { x: 300, y: RY[0], w: 422, h: 48, rx: 9, fill: 'none', stroke: C.purple, sw: 3, opacity: 0 });
  var mark = {};
  S.data({ 'A₀': '123  [0, ∞)', '事务': '—' });

  return {
    TX: TX, RY: RY, BY: BY,
    begin: function (th, ts, t) {
      var x = TX(ts); mark[th] = x;
      S.set('chip' + th, { label: 'T' + th + ' · ts = ' + ts, color: C.ink }, { delay: t }); S.pulse('chip' + th, { delay: t, scale: 1.06 });
      ['sr', 'sn', 'sts', 'ss'].forEach(function (p) { S.to(p + th, { opacity: 1 }, { delay: t + 300, dur: 300 }); });
      S.fly([th === 1 ? 120 : 740, 82], [672, RY[th - 1]], { label: String(ts), color: C.purple, delay: t + 100, dur: 600 });
      S.pop('ml' + th, { delay: t + 600 }); S.to('mk' + th, { opacity: 1, draw: 1 }, { delay: t + 700, dur: 500 });
      S.log('T' + th + ': BEGIN，ts = ' + ts, { delay: t + 300 });
    },
    /* 读：时间戳沿标记线往上找，落在哪个版本的区间里 */
    probe: function (th, i, col, t) {
      S.fly([mark[th], 508], [mark[th], BY[i]], { color: TC[th], delay: t, dur: 600, ripple: false });
      S.ripple(mark[th], BY[i], { delay: t + 600, color: col });
      S.flash('bar' + i, col, { prop: 'stroke', delay: t + 600, hold: 700 }); S.pulse('bar' + i, { delay: t + 600, scale: 1.03 });
      return t + 600;
    },
    take: function (th, i, t) { /* 把这个版本的值读走 */
      S.flash('vr' + i, C.green, { prop: 'stroke', delay: t, hold: 700 });
      S.fly([240, RY[i]], [th === 1 ? 120 : 740, 84], { label: i ? '456' : '123', w: 54, h: 26, color: C.cyan, delay: t + 100, dur: 750 });
      S.flash('chip' + th, C.green, { prop: 'stroke', delay: t + 850 });
      return t + 850;
    },
    /* 写：新建版本 A₁，旧版本的 end-ts 截断 */
    create: function (th, ts, t) {
      S.fly([th === 1 ? 120 : 740, 84], [240, RY[1]], { label: '456', w: 54, h: 26, color: C.cyan, delay: t, dur: 750 });
      S.set('vb1', { val: ts }, { delay: t + 700 });
      ['vr1', 'vn1', 'vv1', 'vb1', 've1'].forEach(function (id) { S.to(id, { opacity: 1 }, { delay: t + 750, dur: 250 }); });
      S.to('vr1', { stroke: C.amber }, { delay: t + 750, dur: 300 });
      S.set('bar1', { x: TX(ts), label: 'A₁ = 456　[' + ts + ', ∞)' }, { delay: t + 900 }); S.to('bar1', { opacity: 1 }, { delay: t + 900, dur: 150 });
      S.to('bar1', { x: (TX(ts) + END) / 2, w: END - TX(ts) }, { delay: t + 900, dur: 700 });
      S.pulse('ve0', { delay: t + 1700, scale: 1.3 }); S.set('ve0', { text: String(ts), color: C.amber }, { delay: t + 1700 });
      S.to('bar0', { x: (TX(0) + TX(ts)) / 2, w: TX(ts) - TX(0) }, { delay: t + 1800, dur: 700 });
      S.set('bar0', { label: 'A₀ = 123　[0, ' + ts + ')' }, { delay: t + 2100 });
      S.data({ 'A₀': '123  [0, ' + ts + ')', 'A₁': '456  [' + ts + ', ∞)  T' + th + ' 未提交' }, { delay: t + 1800 });
      S.log('T' + th + ': W(A) → 新建 A₁ [' + ts + ', ∞)', { delay: t + 750 }); S.log('A₀.end-ts: ∞ → ' + ts, { delay: t + 1700 });
      return t + 2500;
    },
    state: function (th, txt, col, t) { S.set('ss' + th, { text: txt, color: col }, { delay: t }); S.pulse('ss' + th, { delay: t, scale: 1.2 }); S.flash('sr' + th, col, { prop: 'stroke', delay: t, hold: 700 }); },
    lookup: function (creator, t) { /* 拿版本的 begin-ts 去事务状态表查创建者 */
      S.pulse('vb1', { delay: t, scale: 1.3 });
      S.fly([345, RY[1]], [672, RY[creator - 1]], { label: String(S.byId.vb1.cur.val), color: C.purple, delay: t + 150, dur: 700 });
      S.flash('sr' + creator, C.amber, { prop: 'stroke', delay: t + 850, hold: 800 }); S.pulse('ss' + creator, { delay: t + 850, scale: 1.25 });
      return t + 850;
    }
  };
}

var MCODE = [
  'struct Version { Value v; Ts begin, end; };',
  'Value Read(Txn& t, Obj o) {',
  '  for (Version* v : chain[o])',
  '    if (v->begin <= t.ts && t.ts < v->end',
  '        && CreatorCommitted(v))  // 查状态表',
  '      return v->v;      // 只会命中一个版本',
  '}',
  'void Write(Txn& t, Obj o, Value x) {',
  '  Version* last = Latest(o);    // end == ∞',
  '  if (status[Creator(last)] == ACTIVE)',
  '    Abort(t);           // 写冲突：先写者胜',
  '  last->end = t.ts;     // 旧版本到此为止',
  '  chain[o].Append({x, t.ts, INF});',
  '}                       // 从不原地覆盖'
].join('\n');

Viz.register('mvcc', {
  title: 'MVCC：版本可见性 · 写冲突 · 写偏斜 · 版本存储 · 垃圾回收',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：版本可见性 ───────────────────────── */
  {
    name: '写出新版本 · 快照读',
    moving: '时间戳沿事务的标记线向上去找落在哪个版本的区间里；新版本从写者飞进版本表、它的区间条向右长出；旧版本的区间条缩短；读到的值飞回读者',
    lang: 'C++ 风格伪代码（示意）',
    code: MCODE,
    build: function (S) {
      var K = mv(S);

      S.step('T1 BEGIN：事务一开始就拿到时间戳 1，登记进事务状态表', function () {
        S.code(1); K.begin(1, 1, 0); S.data({ '事务': 'T1(ts=1) ACTIVE' }, { delay: 600 });
      });
      S.step('T1 R(A)：拿 1 去对 A₀ 的区间 [0, ∞) → 落在里面 → 读 A₀ = 123', function () {
        S.code([3, 6]); var e = K.probe(1, 0, C.green, 0); K.take(1, 0, e + 200);
        S.log('T1: R(A) → A₀ = 123', { delay: e + 1000, kind: 'ok' });
      });
      S.step('T2 BEGIN：时间戳 2', function () {
        S.code(1); K.begin(2, 2, 0); S.data({ '事务': 'T1(ts=1) ACTIVE，T2(ts=2) ACTIVE' }, { delay: 600 });
      });
      S.step('T2 W(A)：不改 A₀，新建 A₁ = 456（begin-ts = 2），并把 A₀ 的 end-ts 改成 2', function () {
        S.code([12, 13]); K.create(2, 2, 0);
      });
      S.step('切回 T1 R(A)：1 仍落在 A₀ 的 [0, 2) 里 → 读到的还是 123，写者没有挡住读者', function () {
        S.code([3, 6]); var e = K.probe(1, 0, C.green, 0); K.take(1, 0, e + 200);
        S.log('T1: R(A) → 还是 A₀ = 123（可重复读）', { delay: e + 1000, kind: 'ok' });
      });
      S.step('只看时间戳还不够：A₁ 的创建者 T2 仍是 ACTIVE —— 版本提交了没有，要查事务状态表', function () {
        S.code(5); var e = K.lookup(2, 0);
        S.flash('vr1', C.amber, { prop: 'stroke', delay: e, hold: 800 });
        S.log('可见性 = 时间戳区间 + 创建者已提交', { delay: e, kind: 'warn' });
      });
      S.step('这就是 MVCC 的两个关键性质：写者不阻塞读者，读者不阻塞写者', function () {
        S.code(14);
        S.pulse('chip1', { scale: 1.08 }); S.pulse('chip2', { delay: 300, scale: 1.08 });
        S.flash('bar0', C.green, { prop: 'stroke', delay: 200, hold: 900 }); S.flash('bar1', C.green, { prop: 'stroke', delay: 500, hold: 900 });
        S.set('vd', { text: 'T1 读旧版本 A₀，T2 同时装新版本 A₁ —— 谁也不用等谁', color: C.green }, { delay: 600 }); S.pop('vd', { delay: 600 });
        S.data({ '读写互相阻塞？': '否' }, { delay: 600 }); S.log('读写互不阻塞', { delay: 600, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：写冲突 ───────────────────────── */
  {
    name: '写冲突：先写者胜',
    moving: 'T2 的时间戳先撞上未提交的 A₁、再退回去读 A₀；写的时候紫色游标沿版本链从 A₀ 滑到 A₁；begin-ts 飞进状态表查到创建者还活着；T2 的标记褪成红色',
    lang: 'C++ 风格伪代码（示意）',
    code: MCODE,
    build: function (S) {
      var K = mv(S);

      S.step('T1（ts=1）R(A)：读到 A₀', function () {
        S.code([3, 6]); K.begin(1, 1, 0); var e = K.probe(1, 0, C.green, 1300); K.take(1, 0, e + 200);
        S.data({ '事务': 'T1(ts=1) ACTIVE' }, { delay: 600 });
      });
      S.step('T1 W(A)：新建 A₁ = 456，区间 [1, ∞)；A₀ 收缩成 [0, 1)。T1 还没提交', function () {
        S.code([12, 13]); K.create(1, 1, 0);
      });
      S.step('T2（ts=2）R(A)：A₁ 的创建者 T1 未提交 → 逻辑上不可见，T2 读到的是 A₀', function () {
        S.code([4, 5]); K.begin(2, 2, 0);
        var e = K.probe(2, 1, C.amber, 1300); e = K.lookup(1, e + 200);
        S.code(6, { delay: e + 400 }); K.take(2, 0, e + 400);
        S.data({ '事务': 'T1(ts=1) ACTIVE，T2(ts=2) ACTIVE' }, { delay: 600 }); S.log('T2: R(A) → A₀ = 123（A₁ 未提交）', { delay: e + 1250, kind: 'ok' });
      });
      S.step('T2 W(A)：读时看的是 A₀，写时却必须走到物理上最新的版本 A₁（end-ts = ∞）', function () {
        S.code(9);
        S.pop('vcur'); S.move('vcur', 300, K.RY[1], { delay: 600, dur: 700 });
        S.pulse('ve1', { delay: 1300, scale: 1.3 }); S.flash('ve1', C.amber, { prop: 'color', delay: 1300, hold: 700 });
        S.log('T2: W(A)，Latest(A) = A₁', { delay: 1300 });
      });
      S.step('看 A₁ 的 begin-ts = 1 → 查事务状态表：创建者 T1 仍是 ACTIVE', function () {
        S.code(10); var e = K.lookup(1, 0);
        S.log('status[T1] = ACTIVE', { delay: e, kind: 'warn' });
      });
      S.step('不能在未提交的版本后面接新版本 → 写冲突。先写者胜，后来的 T2 中止', function () {
        S.code(11);
        S.to('vcur', { stroke: C.red }, { dur: 300 }); S.to('vcur', { scale: .9, opacity: 0 }, { delay: 500, dur: 400, ease: 'in' });
        K.state(2, 'ABORTED', C.red, 400);
        S.to('chip2', { stroke: C.red, color: C.red }, { delay: 400, dur: 300 }); S.set('chip2', { label: 'T2 · 已中止' }, { delay: 400 }); S.pulse('chip2', { delay: 400 });
        S.to('mk2', { stroke: C.red, opacity: .35 }, { delay: 600, dur: 400 }); S.to('ml2', { stroke: C.red, opacity: .45 }, { delay: 600, dur: 400 });
        S.data({ '事务': 'T1(ts=1) ACTIVE，T2 ABORTED' }, { delay: 400 }); S.log('T2: 写冲突 → ABORT', { delay: 400, kind: 'err' });
      });
      S.step('T1 提交：状态变成 COMMITTED，A₁ 从此对之后开始的事务可见', function () {
        S.code(5);
        K.state(1, 'COMMITTED', C.green, 0);
        S.to('chip1', { stroke: C.green }, { dur: 300 }); S.set('chip1', { label: 'T1 · 已提交' });
        S.to('vr1', { stroke: C.green }, { delay: 300, dur: 300 }); S.to('bar1', { stroke: C.green, fill: '#16412f' }, { delay: 300, dur: 400 }); S.pulse('bar1', { delay: 300, scale: 1.03 });
        S.data({ '事务': 'T1 COMMITTED，T2 ABORTED', 'A₁': '456  [1, ∞)  已提交' }, { delay: 300 }); S.log('T1: COMMIT', { delay: 0, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 3：写偏斜 ───────────────────────── */
  {
    name: '写偏斜：弹珠',
    moving: '四颗弹珠的副本从数据库分别飞进两个事务的快照；各自要改的弹珠弹一下并变色；提交时改过的弹珠飞回数据库对应的位置；最后弹出两种串行结果作对比',
    lang: 'SQL（示意）',
    code: [
      '-- T1：把所有白弹珠变黑',
      'BEGIN;                    -- 拿到快照',
      'UPDATE marbles SET color = \'black\'',
      ' WHERE color = \'white\';',
      'COMMIT;',
      '-- T2：把所有黑弹珠变白',
      'BEGIN;                    -- 同一时刻的快照',
      'UPDATE marbles SET color = \'white\'',
      ' WHERE color = \'black\';',
      'COMMIT;',
      '-- 快照隔离：两边改的是不同的行，',
      '--   没有写-写冲突 → 都能提交',
      '-- 结果仍是 2 黑 2 白（颜色互换）',
      '-- 串行 T1→T2：全白    T2→T1：全黑'
    ].join('\n'),
    build: function (S) {
      var BLK = '#05080f', WHT = '#f4f7ff', RIM = '#8fa0c4', DX = [340, 400, 460, 520], AX = [100, 160, 220, 280], BX = [580, 640, 700, 760], col = [BLK, BLK, WHT, WHT], i;
      function marble(id, x, y, c, r, o) { S.dot(id, { x: x, y: y, r: r || 20, fill: c, stroke: RIM, sw: 2.5, opacity: o == null ? 1 : o, trail: 3 }); }
      S.text('note', { x: 20, y: 22, text: 'Jim Gray 的弹珠例子：数据库里 2 黑 2 白', anchor: 'start', size: 14, color: C.mute });
      S.box('dbp', { x: 430, y: 112, w: 340, h: 104, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('dbt', { x: 430, y: 80, text: '数据库（已提交的状态）', size: 15, weight: 700 });
      S.box('z1', { x: 190, y: 352, w: 320, h: 150, rx: 14, fill: C.panel, stroke: TC[1], sw: 2 });
      S.text('z1t', { x: 190, y: 300, text: 'T1 的快照：把所有白弹珠变黑', size: 15, weight: 700, color: TC[1] });
      S.box('z2', { x: 670, y: 352, w: 320, h: 150, rx: 14, fill: C.panel, stroke: TC[2], sw: 2 });
      S.text('z2t', { x: 670, y: 300, text: 'T2 的快照：把所有黑弹珠变白', size: 15, weight: 700, color: TC[2] });
      S.text('mid1', { x: 430, y: 340, text: '同一时刻', size: 15, color: C.mute, opacity: 0 }); S.text('mid2', { x: 430, y: 364, text: '同一份快照', size: 15, color: C.mute, opacity: 0 });
      S.text('z1s', { x: 190, y: 406, text: '', size: 14, color: C.mute }); S.text('z2s', { x: 670, y: 406, text: '', size: 14, color: C.mute });
      for (i = 0; i < 4; i++) { marble('a' + i, DX[i], 122, col[i], 20, 0); marble('b' + i, DX[i], 122, col[i], 20, 0); }
      for (i = 0; i < 4; i++) marble('m' + i, DX[i], 122, col[i]);
      S.text('s1t', { x: 44, y: 476, text: '串行 T1 → T2：', anchor: 'start', size: 15, opacity: 0 }); S.text('s2t', { x: 524, y: 476, text: '串行 T2 → T1：', anchor: 'start', size: 15, opacity: 0 });
      for (i = 0; i < 4; i++) { marble('p' + i, 190 + i * 38, 476, WHT, 13, 0); marble('q' + i, 670 + i * 38, 476, BLK, 13, 0); }
      S.text('vd', { x: 430, y: 524, text: '', size: 17, weight: 700, opacity: 0 });
      S.data({ '数据库': '黑 黑 白 白', 'T1 快照': '—', 'T2 快照': '—' });

      S.step('T1、T2 同时开始，各自拿到数据库在这一刻的快照：黑 黑 白 白', function () {
        S.code(2); S.code(7, { delay: 900 });
        for (var i = 0; i < 4; i++) {
          S.set('a' + i, { opacity: 1 }, { delay: i * 110 }); S.move('a' + i, AX[i], 358, { delay: i * 110, dur: 800 });
          S.set('b' + i, { opacity: 1 }, { delay: 500 + i * 110 }); S.move('b' + i, BX[i], 358, { delay: 500 + i * 110, dur: 800 });
        }
        S.pop('mid1', { delay: 1500 }); S.pop('mid2', { delay: 1650 });
        S.data({ 'T1 快照': '黑 黑 白 白', 'T2 快照': '黑 黑 白 白' }, { delay: 1600 }); S.log('T1, T2: BEGIN（同一份快照）', { delay: 900 });
      });
      S.step('T1 在自己的快照里找白弹珠：找到第 3、4 颗', function () {
        S.code(4);
        [2, 3].forEach(function (i, k) { S.pulse('a' + i, { delay: k * 300, scale: 1.3 }); S.ripple(AX[i], 358, { delay: k * 300, color: TC[1], r: 40 }); });
        S.set('z1s', { text: 'WHERE color = \'white\' → 2 行' }, { delay: 500 }); S.log('T1: 命中 2 颗白弹珠', { delay: 500 });
      });
      S.step('T2 在自己的快照里找黑弹珠：找到第 1、2 颗', function () {
        S.code(9);
        [0, 1].forEach(function (i, k) { S.pulse('b' + i, { delay: k * 300, scale: 1.3 }); S.ripple(BX[i], 358, { delay: k * 300, color: TC[2], r: 40 }); });
        S.set('z2s', { text: 'WHERE color = \'black\' → 2 行' }, { delay: 500 }); S.log('T2: 命中 2 颗黑弹珠', { delay: 500 });
      });
      S.step('T1 把那两颗白的写成黑，T2 把那两颗黑的写成白 —— 两边写的是不同的弹珠', function () {
        S.code(3); S.code(8, { delay: 900 });
        [2, 3].forEach(function (i, k) { S.to('a' + i, { fill: BLK, stroke: C.amber }, { delay: k * 250, dur: 500 }); S.pulse('a' + i, { delay: k * 250 }); });
        [0, 1].forEach(function (i, k) { S.to('b' + i, { fill: WHT, stroke: C.amber }, { delay: 900 + k * 250, dur: 500 }); S.pulse('b' + i, { delay: 900 + k * 250 }); });
        S.data({ 'T1 快照': '黑 黑 黑 黑', 'T2 快照': '白 白 白 白' }, { delay: 1500 });
        S.log('T1: 第 3、4 颗 → 黑', { delay: 400 }); S.log('T2: 第 1、2 颗 → 白', { delay: 1300 });
      });
      S.step('写集不重叠，没有写-写冲突 → 两个都提交，各自的新版本装进数据库', function () {
        S.code([11, 12]);
        [2, 3].forEach(function (i, k) {
          S.move('a' + i, DX[i], 122, { delay: k * 200, dur: 850 }); S.to('m' + i, { fill: BLK }, { delay: k * 200 + 850, dur: 200 });
          S.ripple(DX[i], 122, { delay: k * 200 + 850, color: TC[1] }); S.hide('a' + i, { delay: k * 200 + 950 });
        });
        [0, 1].forEach(function (i, k) {
          S.move('b' + i, DX[i], 122, { delay: 700 + k * 200, dur: 850 }); S.to('m' + i, { fill: WHT }, { delay: 700 + k * 200 + 850, dur: 200 });
          S.ripple(DX[i], 122, { delay: 700 + k * 200 + 850, color: TC[2] }); S.hide('b' + i, { delay: 700 + k * 200 + 950 });
        });
        S.to('z1', { stroke: C.green }, { delay: 1100, dur: 300 }); S.to('z2', { stroke: C.green }, { delay: 1800, dur: 300 });
        S.data({ '数据库': '白 白 黑 黑' }, { delay: 1800 }); S.log('T1: COMMIT', { delay: 1100, kind: 'ok' }); S.log('T2: COMMIT', { delay: 1800, kind: 'ok' });
      });
      S.step('结果：白 白 黑 黑 —— 还是 2 黑 2 白，只是颜色互换了', function () {
        S.code(13);
        for (var i = 0; i < 4; i++) S.pulse('m' + i, { delay: i * 150, scale: 1.25 });
        S.flash('dbp', C.amber, { prop: 'stroke', delay: 300, hold: 900 }); S.log('最终：2 白 2 黑', { delay: 300, kind: 'warn' });
      });
      S.step('串行执行只会得到全白（T1→T2）或全黑（T2→T1），四颗必然同色 —— 这就是写偏斜', function () {
        S.code(14);
        S.pop('s1t'); S.pop('s2t', { delay: 700 });
        for (var i = 0; i < 4; i++) { S.pop('p' + i, { delay: 150 + i * 110 }); S.pop('q' + i, { delay: 850 + i * 110 }); }
        S.set('vd', { text: '写偏斜：快照隔离的结果不等价于任何串行顺序', color: C.red }, { delay: 1500 }); S.pop('vd', { delay: 1500 });
        S.to('dbp', { stroke: C.red }, { delay: 1500, dur: 300 }); S.log('不可串行化：write skew', { delay: 1500, kind: 'err' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 4：增量式存储 ───────────────────────── */
  {
    name: '版本存储：增量式',
    moving: '被改列的旧值从主表飞进回滚段；主表里的数值原地滚动成新值；指针线从主表长到 delta 记录、再下移到更新的那条；读旧版本时数值沿 delta 链一步步滚回去',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Update(Tuple* t, Col c, Value nv) {',
      '  Delta* d = undo.Alloc();     // 回滚段',
      '  d->col = c;',
      '  d->old = t->val[c];          // ① 存旧值',
      '  d->next = t->delta;',
      '  t->val[c] = nv;              // ② 原地覆盖',
      '  t->delta = d;                // ③ 指向它',
      '}',
      'Tuple ReadOld(Tuple* t, Ts ts) {',
      '  Tuple img = *t;              // 从最新版出发',
      '  for (Delta* d = t->delta;',
      '       d && !Visible(img, ts); d = d->next)',
      '    img.val[d->col] = d->old;  // 倒着打补丁',
      '  return img;',
      '}'
    ].join('\n'),
    build: function (S) {
      var MY = { A: 174, B: 222 }, DY = [174, 222];
      S.text('note', { x: 20, y: 22, text: '例子与数值取自官方 Slides（MySQL、Oracle 的做法，Oracle 叫回滚段）', anchor: 'start', size: 14, color: C.mute });
      S.box('mp', { x: 220, y: 172, w: 380, h: 186, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('mt', { x: 220, y: 102, text: '主表：每条元组只放最新版本', size: 15, weight: 700 });
      [['版本', 90], ['VALUE', 205], ['指针', 330]].forEach(function (h, i) { S.text('mh' + i, { x: h[1], y: 132, text: h[0], size: 14, color: C.mute }); });
      S.box('dp', { x: 650, y: 172, w: 360, h: 186, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('dt', { x: 650, y: 102, text: '回滚段：只存被改列的旧值', size: 15, weight: 700 });
      [['delta 记录', 600], ['指针', 780]].forEach(function (h, i) { S.text('dh' + i, { x: h[1], y: 132, text: h[0], size: 14, color: C.mute }); });
      S.line('p0', { x1: 348, y1: MY.A, x2: 488, y2: DY[0], stroke: C.purple, sw: 2.5, arrow: true, draw: 0, opacity: 0 });
      ['A', 'B'].forEach(function (o) {
        S.box('mr' + o, { x: 220, y: MY[o], w: 350, h: 38, rx: 6, fill: C.cell, stroke: C.line, sw: 1.5 });
        S.text('mn' + o, { x: 90, y: MY[o], text: o + '₁', size: 17, weight: 700 });
        S.text('mv' + o, { x: 205, y: MY[o], val: o === 'A' ? 111 : 10, pre: '$', size: 17, weight: 700 });
        S.text('mq' + o, { x: 330, y: MY[o], text: 'Ø', size: 16, color: C.mute });
      });
      [0, 1].forEach(function (i) {
        S.box('dr' + i, { x: 650, y: DY[i], w: 330, h: 38, rx: 6, fill: C.bg, stroke: C.line, sw: 1.5, dash: '4 4' });
        S.text('dx' + i, { x: 600, y: DY[i], text: '', size: 16, weight: 700, opacity: 0 });
        S.text('dq' + i, { x: 780, y: DY[i], text: 'Ø', size: 16, color: C.mute, opacity: 0 });
      });
      S.box('upd', { x: 220, y: 340, w: 330, h: 44, rx: 22, fill: C.panel, stroke: C.amber, sw: 2, label: '', size: 16, opacity: 0 });
      S.box('rd', { x: 650, y: 392, w: 360, h: 148, rx: 12, fill: C.panel, stroke: C.blue, sw: 2, opacity: 0 });
      S.text('rdt', { x: 650, y: 344, text: '老事务要读旧版本 A₁', size: 15, weight: 700, color: C.blue, opacity: 0 });
      S.text('rdv', { x: 650, y: 392, val: 333, pre: 'VALUE = $', size: 24, weight: 700, opacity: 0 });
      S.text('rdn', { x: 650, y: 434, text: '', size: 15, color: C.mute, opacity: 0 });
      S.text('vd', { x: 220, y: 440, text: '', size: 16, weight: 700, opacity: 0 }); S.text('vd2', { x: 220, y: 468, text: '', size: 16, weight: 700, opacity: 0 });
      S.data({ '主表 A': 'A₁ = $111', '回滚段': '（空）' });
      function update(nv, old, ver, i, t) { /* 第 i 条 delta；ver = 主表里的新版本号 */
        S.set('upd', { label: 'UPDATE A：VALUE = $' + nv }, { delay: t }); S.pop('upd', { delay: t });
        S.flash('mrA', C.amber, { prop: 'stroke', delay: t + 400, hold: 2200 });
        S.fly([205, MY.A], [600, DY[i]], { label: '$' + old, w: 64, h: 26, color: C.cyan, delay: t + 600, dur: 850 });
        S.set('dx' + i, { text: 'A' + SUB[ver] + '（VALUE → $' + old + '）' }, { delay: t + 1400 });
        S.to('dx' + i, { opacity: 1 }, { delay: t + 1450, dur: 200 }); S.to('dq' + i, { opacity: 1 }, { delay: t + 1450, dur: 200 });
        S.set('dr' + i, { dash: '' }, { delay: t + 1450 }); S.to('dr' + i, { stroke: C.purple }, { delay: t + 1450, dur: 300 });
        return t + 1700;
      }
      function overwrite(nv, ver, t) {
        S.fly([220, 318], [205, MY.A], { label: '$' + nv, w: 64, h: 26, color: C.amber, delay: t, dur: 600 });
        S.count('mvA', nv, { delay: t + 600 }); S.pulse('mvA', { delay: t + 600 });
        S.set('mnA', { text: 'A' + SUB[ver + 1] }, { delay: t + 600 }); S.pulse('mnA', { delay: t + 600 });
        S.hide('upd', { delay: t + 1200 });
        return t + 1200;
      }

      S.step('主表里每条逻辑元组只有一个版本：A₁ = $111，B₁ = $10', function () {
        S.pulse('mrA', { scale: 1.04 }); S.pulse('mrB', { delay: 300, scale: 1.04 });
        S.flash('mt', C.blue, { prop: 'color', delay: 300, hold: 800 }); S.log('主表：A₁=$111，B₁=$10');
      });
      S.step('UPDATE A = $222：① 先把被改那一列的旧值 $111 复制到回滚段', function () {
        S.code([2, 5]); update(222, 111, 1, 0, 0);
        S.data({ '回滚段': 'A₁(VALUE→$111)' }, { delay: 1450 }); S.log('delta: A₁（VALUE → $111）', { delay: 1450 });
      });
      S.step('② 主表里直接覆盖成最新值 $222；③ 元组的指针指向刚才那条 delta', function () {
        S.code(6); var e = overwrite(222, 1, 0);
        S.code(7, { delay: 900 });
        S.set('mqA', { text: '●', color: C.purple }, { delay: 900 }); S.to('p0', { opacity: 1, draw: 1 }, { delay: 900, dur: 600 });
        S.data({ '主表 A': 'A₂ = $222 → delta' }, { delay: 900 }); S.log('主表：A₂ = $222（原地覆盖）', { delay: 600 });
      });
      S.step('再 UPDATE A = $333：旧值 $222 进回滚段并指向更老的 delta；主表变成 A₃ = $333', function () {
        S.code([2, 7]); var e = update(333, 222, 2, 1, 0);
        S.set('dq1', { text: '↑ 更老', color: C.purple }, { delay: e }); S.pulse('dq1', { delay: e, scale: 1.2 });
        e = overwrite(333, 2, e + 300);
        S.to('p0', { y2: DY[1] }, { delay: e - 500, dur: 600 });
        S.data({ '主表 A': 'A₃ = $333 → delta', '回滚段': 'A₂(VALUE→$222) → A₁(VALUE→$111)' }, { delay: e - 500 });
        S.log('delta: A₂（VALUE → $222）', { delay: 1450 }); S.log('主表：A₃ = $333', { delay: e - 600 });
      });
      S.step('老事务要读 A₁：先从主表拿到最新的 A₃ = $333，再沿指针往回走', function () {
        S.code(10);
        S.to('rd', { opacity: 1 }, { dur: 300 }); S.pop('rdt', { delay: 100 });
        S.fly([205, MY.A], [650, 392], { label: '$333', w: 64, h: 26, color: C.cyan, delay: 400, dur: 850 });
        S.to('rdv', { opacity: 1 }, { delay: 1250, dur: 200 }); S.set('rdn', { text: '手里是 A₃，还不是要的版本' }, { delay: 1250 }); S.to('rdn', { opacity: 1 }, { delay: 1250, dur: 200 });
        S.flash('p0', C.cyan, { prop: 'stroke', delay: 1500 });
        S.log('ReadOld: img = A₃ ($333)', { delay: 1250 });
      });
      S.step('像打补丁一样依次应用 delta：先得到 A₂ = $222，再得到 A₁ = $111', function () {
        S.code([11, 13]);
        S.flash('dr1', C.cyan, { prop: 'stroke', hold: 700 });
        S.fly([600, DY[1]], [650, 392], { label: '$222', w: 64, h: 26, color: C.cyan, delay: 150, dur: 700 });
        S.count('rdv', 222, { delay: 850 }); S.set('rdn', { text: '应用 1 条 delta → A₂' }, { delay: 850 }); S.pulse('rdn', { delay: 850 });
        S.flash('dq1', C.cyan, { prop: 'color', delay: 1400 }); S.flash('dr0', C.cyan, { prop: 'stroke', delay: 1600, hold: 700 });
        S.fly([600, DY[0]], [650, 392], { label: '$111', w: 64, h: 26, color: C.cyan, delay: 1750, dur: 700 });
        S.count('rdv', 111, { delay: 2450 }); S.set('rdn', { text: '应用 2 条 delta → A₁ ✓', color: C.green }, { delay: 2450 }); S.pulse('rdn', { delay: 2450 });
        S.to('rd', { stroke: C.green }, { delay: 2450, dur: 300 });
        S.log('patch → A₂ ($222)', { delay: 850 }); S.log('patch → A₁ ($111) ✓', { delay: 2450, kind: 'ok' });
      });
      S.step('好处：只存被改的那几列；垃圾回收时整块丢掉回滚段，主表纹丝不动', function () {
        S.code(2);
        [0, 1].forEach(function (i) {
          S.to('dx' + i, { opacity: 0, scale: .6 }, { delay: 300 + i * 250, dur: 400, ease: 'in' }); S.to('dq' + i, { opacity: 0 }, { delay: 300 + i * 250, dur: 300 });
          S.set('dr' + i, { dash: '4 4' }, { delay: 700 + i * 250 }); S.to('dr' + i, { stroke: C.line }, { delay: 300 + i * 250, dur: 400 });
        });
        S.to('p0', { draw: 0, opacity: 0 }, { delay: 600, dur: 400 });
        S.set('mqA', { text: 'Ø', color: C.mute }, { delay: 1000 });
        S.flash('mrA', C.green, { prop: 'stroke', delay: 1100, hold: 900 }); S.flash('mrB', C.green, { prop: 'stroke', delay: 1100, hold: 900 });
        S.set('vd', { text: '水位线一过：回滚段整块回收', color: C.green }, { delay: 1100 }); S.pop('vd', { delay: 1100 });
        S.set('vd2', { text: '主表里的 A₃、B₁ 完全没被碰过', color: C.green }, { delay: 1400 }); S.pop('vd2', { delay: 1400 });
        S.data({ '回滚段': '（已回收）', '主表 A': 'A₃ = $333' }, { delay: 1100 }); S.log('GC: 丢弃回滚段', { delay: 1100, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 5：垃圾回收 ───────────────────────── */
  {
    name: '垃圾回收：水位线',
    moving: '版本的区间条沿时间轴长出来；活跃事务的标记线落下；黄色水位线向右滑动、数字滚动；VACUUM 游标逐个扫过版本，过期的版本和它的区间条一起缩小消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 后台 VACUUM：顺序扫表里的每个版本',
      'void Vacuum(Table& tbl) {',
      '  Ts wm = MinActiveTs();      // 水位线',
      '  for (Version* v : tbl.AllVersions()) {',
      '    if (CreatedByAborted(v))',
      '      Reclaim(v);     // 中止事务留下的',
      '    else if (v->end <= wm)',
      '      Reclaim(v);     // 没有活跃事务看得到',
      '  }',
      '}',
      '// 协作式清理：事务顺着版本链找数据时，',
      '// 顺手清掉沿路遇到的过期版本'
    ].join('\n'),
    build: function (S) {
      function TX(ts) { return 80 + ts * 24; }
      var V = [['A100', 1, 9, 180, 252], ['B100', 1, 9, 430, 298], ['B101', 10, 20, 680, 344]], i;
      S.text('note', { x: 20, y: 22, text: '例子与数值取自官方 Slides', anchor: 'start', size: 14, color: C.mute });
      S.text('vt', { x: 430, y: 52, text: '表里的旧版本（VACUUM 从左到右顺序扫）', size: 15, weight: 700 });
      S.text('bt', { x: 40, y: 212, text: '每个版本的可见区间 [begin-ts, end-ts)', anchor: 'start', size: 14, color: C.mute });
      S.line('ax', { x1: 60, y1: 430, x2: 836, y2: 430, stroke: C.line, sw: 2, arrow: true });
      for (i = 0; i <= 30; i += 5) { S.line('tk' + i, { x1: TX(i), y1: 424, x2: TX(i), y2: 436, stroke: C.line, sw: 2 }); S.text('tl' + i, { x: TX(i), y: 450, text: String(i), size: 14, color: C.mute }); }
      V.forEach(function (v, k) {
        S.box('ch' + k, { x: v[3], y: 100, w: 224, h: 46, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: v[0] + '　begin=' + v[1] + '　end=' + v[2], size: 15, opacity: 0 });
        S.box('br' + k, { x: TX(v[1]), y: v[4], w: 2, h: 30, rx: 6, fill: '#1c416e', stroke: C.blue, sw: 1.5, label: '', size: 14, opacity: 0 });
        S.text('rs' + k, { x: v[3], y: 148, text: '', size: 15, weight: 700, opacity: 0 });
      });
      S.line('m1', { x1: TX(12), y1: 430, x2: TX(12), y2: 228, stroke: C.blue, sw: 2.5, draw: 0, opacity: 0 });
      S.line('m2', { x1: TX(25), y1: 430, x2: TX(25), y2: 228, stroke: C.purple, sw: 2.5, draw: 0, opacity: 0 });
      S.box('ml1', { x: TX(12), y: 486, w: 130, h: 26, rx: 13, fill: C.bg, stroke: C.blue, sw: 2, label: 'Txn #1：ts=12', size: 14, opacity: 0 });
      S.box('ml2', { x: TX(25), y: 486, w: 130, h: 26, rx: 13, fill: C.bg, stroke: C.purple, sw: 2, label: 'Txn #2：ts=25', size: 14, opacity: 0 });
      S.line('wm', { x1: TX(0), y1: 430, x2: TX(0), y2: 196, stroke: C.amber, sw: 3.5, dash: '7 5', opacity: 0 });
      S.text('wmt', { x: TX(0), y: 182, val: 0, pre: '水位线 = ', size: 16, weight: 700, color: C.amber, opacity: 0 });
      S.box('vac', { x: 180, y: 100, w: 240, h: 62, rx: 12, fill: 'none', stroke: C.amber, sw: 3, opacity: 0 });
      S.data({ '活跃事务': '—', '水位线': '—', '已回收': '—' });
      var gone = [];
      function reclaim(k, t) {
        gone.push(V[k][0]);
        S.to('br' + k, { stroke: C.red, fill: '#4a1d26' }, { delay: t, dur: 300 }); S.to('ch' + k, { stroke: C.red }, { delay: t, dur: 300 });
        S.set('rs' + k, { text: 'end ≤ 水位线 → 回收', color: C.red }, { delay: t }); S.pop('rs' + k, { delay: t });
        S.to('br' + k, { scale: .3, opacity: 0 }, { delay: t + 900, dur: 450, ease: 'in' }); S.to('ch' + k, { opacity: .25 }, { delay: t + 900, dur: 450 });
        S.data({ '已回收': gone.join(', ') }, { delay: t + 900 }); S.log('Reclaim(' + V[k][0] + ')', { delay: t + 900, kind: 'ok' });
      }

      S.step('表里有三个旧版本，每个都带着自己的 begin-ts / end-ts', function () {
        S.code(1);
        V.forEach(function (v, k) {
          var l = TX(v[1]), r = TX(v[2]);
          S.pop('ch' + k, { delay: k * 300 });
          S.set('br' + k, { label: v[0] + ' [' + v[1] + ', ' + v[2] + ')' }, { delay: k * 300 + 200 }); S.to('br' + k, { opacity: 1 }, { delay: k * 300 + 200, dur: 150 });
          S.to('br' + k, { x: (l + r) / 2, w: r - l }, { delay: k * 300 + 200, dur: 600 });
        });
        S.log('版本：A100 [1,9)  B100 [1,9)  B101 [10,20)', { delay: 600 });
      });
      S.step('当前活跃的事务：Txn #1（ts=12）和 Txn #2（ts=25）', function () {
        S.code(3);
        S.pop('ml1'); S.to('m1', { opacity: 1, draw: 1 }, { delay: 200, dur: 600 });
        S.pop('ml2', { delay: 500 }); S.to('m2', { opacity: 1, draw: 1 }, { delay: 700, dur: 600 });
        S.data({ '活跃事务': '{12, 25}' }, { delay: 700 }); S.log('活跃时间戳集合 = {12, 25}', { delay: 700 });
      });
      S.step('水位线 = 最小的活跃时间戳 = 12：在它之前就结束的版本，没有任何活跃事务看得到', function () {
        S.code(3);
        S.to('wm', { opacity: 1 }, { dur: 200 }); S.to('wmt', { opacity: 1 }, { dur: 200 });
        S.to('wm', { x1: TX(12), x2: TX(12) }, { delay: 200, dur: 900 }); S.to('wmt', { x: TX(12) }, { delay: 200, dur: 900 }); S.count('wmt', 12, { delay: 200, dur: 900 });
        S.ripple(TX(12), 430, { delay: 1100, color: C.amber, r: 44 });
        S.data({ '水位线': 12 }, { delay: 1100 }); S.log('wm = MinActiveTs() = 12', { delay: 1100 });
      });
      S.step('VACUUM 扫到 A100：区间 [1, 9) 整个在水位线左边 → 回收', function () {
        S.code([7, 8]); S.pop('vac'); reclaim(0, 500);
      });
      S.step('B100 [1, 9)：同样没有活跃事务看得到 → 回收', function () {
        S.code([7, 8]); S.move('vac', 430, 100, { dur: 600 }); reclaim(1, 700);
      });
      S.step('B101 [10, 20)：12 落在区间里，Txn #1 还看得到它 → 保留', function () {
        S.code(7); S.move('vac', 680, 100, { dur: 600 });
        S.ripple(TX(12), 344, { delay: 700, color: C.green, r: 40 }); S.flash('br2', C.green, { prop: 'stroke', delay: 700, hold: 900 }); S.pulse('br2', { delay: 700, scale: 1.04 });
        S.to('ch2', { stroke: C.green }, { delay: 700, dur: 300 });
        S.set('rs2', { text: 'end = 20 > 水位线 → 保留', color: C.green }, { delay: 700 }); S.pop('rs2', { delay: 700 });
        S.log('B101: 10 ≤ 12 < 20 → 保留', { delay: 700 });
      });
      S.step('Txn #1 提交后，水位线推进到 25 → B101 也过期了，下一轮清理把它回收', function () {
        S.code(3); S.hide('vac'); S.hide('rs2');
        S.to('m1', { opacity: 0, draw: 0 }, { dur: 500 }); S.to('ml1', { stroke: C.green, opacity: .4 }, { dur: 400 }); S.set('ml1', { label: 'Txn #1：已提交' });
        S.to('wm', { x1: TX(25), x2: TX(25) }, { delay: 600, dur: 1000 }); S.to('wmt', { x: TX(25) }, { delay: 600, dur: 1000 }); S.count('wmt', 25, { delay: 600, dur: 1000 });
        S.ripple(TX(25), 430, { delay: 1600, color: C.amber, r: 44 });
        S.data({ '活跃事务': '{25}', '水位线': 25 }, { delay: 1600 }); S.log('wm = 25', { delay: 1600 });
        S.code([7, 8], { delay: 1800 }); reclaim(2, 1800);
      });
    }
  }
  ]
});
})();
