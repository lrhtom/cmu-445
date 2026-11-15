/* #19 OCC：三个阶段完整走一遍 / 前向验证失败 / 前向验证通过
 * 三个例子（A=123、456、W-TS、TS(T1)/TS(T2) 的取值）都取自官方 Slides。T1 蓝、T2 紫；时间戳用紫色。 */
(function () {
var C = Viz.C, TC = { 1: C.blue, 2: C.purple };
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #19 Timestamp Ordering / OCC（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/19-timestampordering.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #19 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/19-timestampordering.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Project #4 Concurrency Control', u: 'https://15445.courses.cs.cmu.edu/fall2025/project4/' }
];

/* 舞台：上方全局数据库，左右各一个私有工作区，中间是验证区和时间戳发号器 */
function occ(S, objs) {
  var WX = { 1: 180, 2: 680 }, RY = [338, 372], DY = {}, row = { 1: {}, 2: {} }, cnt = { 1: 0, 2: 0 }, next = 1, chips = [], uid = 0;
  var dbh = objs.length === 2 ? 144 : 106;
  S.text('note', { x: 20, y: 22, text: '例子与数值取自官方 Slides', anchor: 'start', size: 14, color: C.mute });
  S.box('dbp', { x: 430, y: 38 + dbh / 2, w: 330, h: dbh, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
  S.text('dbt', { x: 430, y: 56, text: '全局数据库', size: 15, weight: 700 });
  [['对象', 335], ['值', 430], ['W-TS', 525]].forEach(function (h, i) { S.text('dh' + i, { x: h[1], y: 82, text: h[0], size: 14, color: C.mute }); });
  objs.forEach(function (o, i) {
    var y = 112 + i * 38; DY[o[0]] = y;
    S.box('d' + o[0], { x: 430, y: y, w: 290, h: 32, rx: 6, fill: C.cell, stroke: C.line, sw: 1.5 });
    S.text('d' + o[0] + 'A', { x: 335, y: y, text: o[0], size: 16, weight: 700 });
    if (typeof o[1] === 'number') S.text('d' + o[0] + 'V', { x: 430, y: y, val: o[1], size: 16, weight: 700 });
    else S.text('d' + o[0] + 'V', { x: 430, y: y, text: o[1], size: 16, weight: 700 });
    S.text('d' + o[0] + 'T', { x: 525, y: y, val: o[2], size: 16, weight: 700, color: C.purple });
  });
  [1, 2].forEach(function (th) {
    var x = WX[th];
    S.box('wp' + th, { x: x, y: 332, w: 310, h: 124, rx: 12, fill: C.panel, stroke: TC[th], sw: 2 });
    S.text('wt' + th, { x: x, y: 286, text: 'T' + th + ' 的私有工作区', size: 15, weight: 700, color: TC[th] });
    [['对象', -90], ['值', 0], ['W-TS', 90]].forEach(function (h, i) { S.text('wh' + th + i, { x: x + h[1], y: 310, text: h[0], size: 14, color: C.mute }); });
    RY.forEach(function (y, i) { S.box('ws' + th + i, { x: x, y: y, w: 280, h: 28, rx: 6, fill: C.bg, stroke: C.line, sw: 1.5, dash: '4 4' }); });
    [['读阶段', -100], ['验证', 0], ['写阶段', 100]].forEach(function (p, i) {
      S.box('pb' + th + i, { x: x + p[1], y: 424, w: 92, h: 30, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: p[0], size: 14, color: C.mute });
    });
    S.box('ph' + th, { x: x - 100, y: 424, w: 100, h: 38, rx: 10, fill: 'none', stroke: TC[th], sw: 3, opacity: 0 });
    S.text('ts' + th, { x: x, y: 462, text: 'TS(T' + th + ')：未分配', size: 15, weight: 700, color: C.mute });
    S.text('set' + th, { x: x, y: 488, text: '读集 { }　写集 { }', size: 14, color: C.mute });
  });
  S.box('cmp', { x: 430, y: 332, w: 170, h: 124, rx: 12, fill: C.bg, stroke: C.line, sw: 1.5, dash: '5 4' });
  S.text('cmpt', { x: 430, y: 286, text: '验证：求交集', size: 14, color: C.mute });
  S.text('cmpr', { x: 430, y: 378, text: '', size: 15, weight: 700, opacity: 0 });
  S.box('gen', { x: 430, y: 440, w: 150, h: 60, rx: 10, fill: C.panel, stroke: C.purple, sw: 2 });
  S.text('gent', { x: 430, y: 426, text: '时间戳发号器', size: 14, color: C.mute });
  S.text('genv', { x: 430, y: 450, val: 1, pre: '下一个：', size: 17, weight: 700, color: C.purple });
  S.text('vd', { x: 430, y: 526, text: '', size: 17, weight: 700, opacity: 0 });
  S.data({ 'TS(T1)': '未分配', 'TS(T2)': '未分配', 'T1 工作区': '{}', 'T2 工作区': '{}' });

  var K = {
    begin: function (th, t) { S.pop('ph' + th, { delay: t }); S.to('pb' + th + 0, { color: C.ink }, { delay: t, dur: 300 }); S.log('T' + th + ': BEGIN（读阶段）', { delay: t }); },
    /* 读：把全局库里的一行复制进私有工作区 */
    copy: function (th, o, val, wts, t) {
      var i = cnt[th]++, x = WX[th], y = RY[i], id = 'w' + th + o;
      row[th][o] = { y: y, i: i };
      S.flash('d' + o, TC[th], { prop: 'stroke', delay: t });
      S.fly([430, DY[o]], [x, y], { label: o + ' · ' + val + ' · ' + wts, w: 150, h: 26, color: C.cyan, delay: t + 150, dur: 800 });
      S.text(id + 'A', { x: x - 90, y: y, text: o, size: 16, weight: 700, opacity: 0 });
      S.text(id + 'V', { x: x, y: y, text: String(val), size: 16, weight: 700, opacity: 0 });
      S.text(id + 'T', { x: x + 90, y: y, text: String(wts), size: 16, weight: 700, color: C.purple, opacity: 0 });
      ['A', 'V', 'T'].forEach(function (c) { S.to(id + c, { opacity: 1 }, { delay: t + 950, dur: 150 }); });
      S.set('ws' + th + i, { dash: '' }, { delay: t + 950 }); S.to('ws' + th + i, { stroke: TC[th] }, { delay: t + 950, dur: 300 });
      var d = {}; d['T' + th + ' 工作区'] = '{' + o + '=' + val + ', W-TS=' + wts + '}'; S.data(d, { delay: t + 950 });
      S.log('T' + th + ': R(' + o + ') → 复制 ' + o + '=' + val, { delay: t + 950 });
      return t + 950;
    },
    /* 写：只改工作区里的副本，W-TS 记成 ∞ */
    write: function (th, o, val, t) {
      var id = 'w' + th + o, r = row[th][o];
      S.set(id + 'V', { text: String(val), color: C.amber }, { delay: t }); S.pulse(id + 'V', { delay: t });
      S.set(id + 'T', { text: '∞', color: C.amber }, { delay: t + 300 }); S.pulse(id + 'T', { delay: t + 300 });
      S.ripple(WX[th], r.y, { delay: t, color: C.amber }); S.to('ws' + th + r.i, { stroke: C.amber }, { delay: t, dur: 300 });
      var d = {}; d['T' + th + ' 工作区'] = '{' + o + '=' + val + ', W-TS=∞}'; S.data(d, { delay: t + 300 });
      S.log('T' + th + ': W(' + o + ')=' + val + '（只在工作区，W-TS=∞）', { delay: t + 300 });
    },
    phase: function (th, k, t) {
      S.move('ph' + th, WX[th] + (k - 1) * 100, 424, { delay: t, dur: 550 });
      S.to('pb' + th + k, { color: C.ink }, { delay: t + 300, dur: 300 }); S.to('pb' + th + (k - 1), { color: C.mute }, { delay: t + 300, dur: 300 });
    },
    /* 进入验证阶段：此刻才从发号器拿时间戳 */
    stamp: function (th, t) {
      var n = next++, d = {};
      this.phase(th, 1, t);
      S.pulse('gen', { delay: t + 500, scale: 1.08 });
      S.fly([430, 450], [WX[th] + 46, 462], { label: String(n), color: C.purple, delay: t + 600, dur: 700 });
      S.count('genv', next, { delay: t + 800 });
      S.set('ts' + th, { text: 'TS(T' + th + ') = ' + n, color: C.purple }, { delay: t + 1300 }); S.pulse('ts' + th, { delay: t + 1300 });
      d['TS(T' + th + ')'] = n; S.data(d, { delay: t + 1300 });
      S.log('T' + th + ': 验证阶段，TS(T' + th + ') = ' + n, { delay: t + 1300 });
      return t + 1300;
    },
    sets: function (th, rs, ws, t) { S.set('set' + th, { text: '读集 {' + rs + '}　写集 {' + ws + '}', color: C.ink }, { delay: t }); S.pulse('set' + th, { delay: t, scale: 1.06 }); },
    /* 两个集合飞进验证区求交集 */
    compare: function (a, fa, b, fb, ok, t) {
      chips.forEach(function (c) { S.hide(c, { delay: t }); }); chips = [];
      S.hide('cmpr', { delay: t });
      [[a, fa, 316], [b, fb, 346]].forEach(function (c, i) {
        var id = 'cc' + (uid++); chips.push(id);
        S.fly([WX[c[1]], 488], [430, c[2]], { id: id, label: c[0], w: 150, h: 24, color: TC[c[1]], keep: true, delay: t + 200 + i * 350, dur: 750 });
        S.flash(id, ok ? C.green : C.red, { delay: t + 1500, hold: 700 });
      });
      S.set('cmpr', { text: ok ? '交集 = ∅ ✓' : '交集 ≠ ∅ ✗', color: ok ? C.green : C.red }, { delay: t + 1500 }); S.pop('cmpr', { delay: t + 1500 });
      S.to('cmp', { stroke: ok ? C.green : C.red }, { delay: t + 1500, dur: 300 });
      return t + 1500;
    },
    /* 写阶段：把 ∞ 换成自己的时间戳，整行装进全局库 */
    install: function (th, o, val, ts, t) {
      var id = 'w' + th + o, r = row[th][o];
      this.phase(th, 2, t);
      S.set(id + 'T', { text: String(ts), color: C.purple }, { delay: t + 500 }); S.pulse(id + 'T', { delay: t + 500 });
      S.fly([WX[th], r.y], [430, DY[o]], { label: o + ' · ' + val + ' · ' + ts, w: 150, h: 26, color: C.cyan, delay: t + 900, dur: 800 });
      S.count('d' + o + 'V', val, { delay: t + 1700 }); S.count('d' + o + 'T', ts, { delay: t + 1700 });
      S.flash('d' + o, C.green, { prop: 'stroke', delay: t + 1700, hold: 700 }); S.pulse('d' + o + 'T', { delay: t + 1700 });
      S.log('T' + th + ': 写阶段，' + o + '=' + val + ' W-TS=' + ts + ' 装进全局库', { delay: t + 1700, kind: 'ok' });
      return t + 1700;
    },
    /* 事务结束：工作区清空 */
    finish: function (th, ok, t) {
      Object.keys(row[th]).forEach(function (o) {
        ['A', 'V', 'T'].forEach(function (c) { S.to('w' + th + o + c, { opacity: 0, scale: .6 }, { delay: t, dur: 350, ease: 'in' }); });
        S.set('ws' + th + row[th][o].i, { dash: '4 4' }, { delay: t + 350 }); S.to('ws' + th + row[th][o].i, { stroke: C.line }, { delay: t, dur: 350 });
      });
      S.to('wp' + th, { stroke: ok ? C.green : C.red }, { delay: t, dur: 350 }); S.to('ph' + th, { stroke: ok ? C.green : C.red }, { delay: t, dur: 350 });
      S.set('wt' + th, { text: 'T' + th + (ok ? ' 已提交' : ' 已中止') + '（工作区丢弃）', color: ok ? C.green : C.red }, { delay: t });
      var d = {}; d['T' + th + ' 工作区'] = ok ? '已提交' : '已中止'; S.data(d, { delay: t });
      S.log('T' + th + (ok ? ': COMMIT' : ': ABORT'), { delay: t, kind: ok ? 'ok' : 'err' });
    },
    clear: function (t) { chips.forEach(function (c) { S.hide(c, { delay: t }); }); chips = []; S.hide('cmpr', { delay: t }); S.to('cmp', { stroke: C.line }, { delay: t, dur: 300 }); },
    verdict: function (txt, col, t) { S.set('vd', { text: txt, color: col }, { delay: t }); S.pop('vd', { delay: t }); },
    WX: WX, RY: RY, DY: DY
  };
  return K;
}

function vcode(sched) { return [
  '// ' + sched,
  '// 前向验证：T 要提交，逐个检查仍活跃的 U',
  '// （U 未发号 = ∞，故 T < U）满足任一条即可：',
  '// ① T 写完时，U 还没开始',
  '// ② T 写完时，U 还没进写阶段，且',
  '//    WriteSet(T) ∩ ReadSet(U) = ∅',
  '// ③ T 先于 U 结束读阶段，且',
  '//    WriteSet(T) ∩ ReadSet(U) = ∅',
  '//    WriteSet(T) ∩ WriteSet(U) = ∅',
  'bool Validate(Txn& T) {',
  '  for (Txn* U : active_txns)',
  '    if (!Case1(T, U) && !Case2(T, U)',
  '        && !Case3(T, U))',
  '      return false;  // 中止的是 T 自己',
  '  return true;       // 通过 → 写阶段',
  '}'
].join('\n'); }

Viz.register('occ', {
  title: 'OCC 乐观并发控制：读阶段 · 验证 · 写阶段',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：完整走一遍 ───────────────────────── */
  {
    name: '三个阶段走一遍',
    moving: '元组从全局数据库飞进事务的私有工作区；阶段指示框在「读 / 验证 / 写」之间滑动；时间戳从发号器飞到事务上、发号器数字滚动；提交时整行从工作区飞回全局库',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Value Read(Txn& t, Obj o) {     // 读阶段',
      '  if (!t.ws.count(o))',
      '    t.ws[o] = db[o];          // 复制进工作区',
      '  return t.ws[o].value;',
      '}',
      'void Write(Txn& t, Obj o, Value v) {',
      '  Read(t, o);',
      '  t.ws[o].value = v;          // 只改私有副本',
      '  t.ws[o].wts = INF;          // 还没有号',
      '}',
      'bool Commit(Txn& t) {',
      '  t.ts = NextTimestamp();     // 验证时才发号',
      '  if (!Validate(t)) return Abort(t);',
      '  for (auto& [o, tup] : t.ws) // 写阶段',
      '    if (tup.dirty)',
      '      db[o] = {tup.value, t.ts};',
      '  return true;',
      '}'
    ].join('\n'),
    build: function (S) {
      var K = occ(S, [['A', 123, 0]]);

      S.step('T1 BEGIN：进入读阶段，拿到一块空的私有工作区 —— 此时它还没有时间戳', function () {
        K.begin(1, 0); S.flash('ts1', C.amber, { prop: 'color', delay: 500, hold: 800 }); S.pulse('ts1', { delay: 500 });
      });
      S.step('T1 R(A)：把 A=123、W-TS=0 整行复制进自己的工作区（为了可重复读）', function () {
        S.code([2, 3]); var e = K.copy(1, 'A', 123, 0, 0); K.sets(1, 'A', ' ', e);
      });
      S.step('切到 T2：BEGIN，R(A) —— 同样复制一份进 T2 的工作区', function () {
        S.code([2, 3]); K.begin(2, 0); var e = K.copy(2, 'A', 123, 0, 400); K.sets(2, 'A', ' ', e);
      });
      S.step('T2 COMMIT → 进入验证阶段，此刻才分配时间戳：TS(T2) = 1', function () {
        S.code(12); K.stamp(2, 0);
      });
      S.step('T2 没写任何东西，写集为空 → 验证通过；写阶段没东西可装，工作区直接丢弃', function () {
        S.code(13); var e = K.compare('WS(T2) = { }', 2, 'RS(T1) = {A}', 1, true, 0);
        S.code([14, 15], { delay: e + 300 }); K.phase(2, 2, e + 300); K.finish(2, true, e + 1000);
      });
      S.step('切回 T1：W(A) —— 只改工作区里的副本，W-TS 记成 ∞；全局数据库纹丝不动', function () {
        S.code([8, 9]); K.write(1, 'A', 456, 0); K.sets(1, 'A', 'A', 600);
        S.flash('dA', C.mute, { prop: 'stroke', delay: 900, hold: 600 }); S.pulse('dAV', { delay: 900 });
      });
      S.step('T1 R(A)：从自己的工作区读 → 读到自己刚写的 456', function () {
        S.code(4);
        S.fly([K.WX[1], K.RY[0]], [K.WX[1], 286], { label: '456', w: 54, h: 26, color: C.cyan, dur: 700 });
        S.flash('wt1', C.green, { prop: 'color', delay: 700, hold: 700 }); S.log('T1: R(A) = 456（自己的副本）', { delay: 700, kind: 'ok' });
      });
      S.step('T1 COMMIT → 验证阶段：分配 TS(T1) = 2；此时没有别的活跃事务，验证通过', function () {
        S.code(12); K.clear(0); var e = K.stamp(1, 0);
        S.code(13, { delay: e + 300 }); S.set('cmpr', { text: '没有活跃事务 ✓', color: C.green }, { delay: e + 300 }); S.pop('cmpr', { delay: e + 300 });
        S.to('cmp', { stroke: C.green }, { delay: e + 300, dur: 300 });
      });
      S.step('写阶段：把工作区里的 ∞ 换成 2，整行原子地装进全局数据库', function () {
        S.code([14, 16]); var e = K.install(1, 'A', 456, 2, 0);
        S.data({ '全局 A': '456（W-TS=2）' }, { delay: e }); K.finish(1, true, e + 600);
      });
      S.step('T1 物理上先开始，但 T2 先验证、时间戳更小 → 等价的串行顺序是 T2 → T1', function () {
        S.code(12);
        S.pulse('ts2', { scale: 1.15 }); S.pulse('ts1', { delay: 400, scale: 1.15 });
        S.fly([K.WX[2], 462], [K.WX[1], 462], { color: C.purple, delay: 500, dur: 900 });
        K.verdict('逻辑顺序由验证时的时间戳决定：T2（1）→ T1（2）', C.green, 900);
        S.log('等价串行顺序：T2 → T1', { delay: 900, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：验证失败 ───────────────────────── */
  {
    name: '前向验证：失败',
    moving: '两个事务先后把 A 复制进工作区；T1 的写集和 T2 的读集飞进中间的验证区、撞在一起变红；T1 的工作区内容缩小消失',
    lang: '前向验证规则 + 伪代码（示意）',
    code: vcode('T1 R(A)W(A) │ T2 R(A) │ T1 提交'),
    build: function (S) {
      var K = occ(S, [['A', 123, 0]]);

      S.step('T1 BEGIN，R(A)：把 A=123 复制进工作区', function () {
        S.code(1); K.begin(1, 0); var e = K.copy(1, 'A', 123, 0, 300); K.sets(1, 'A', ' ', e);
      });
      S.step('T1 W(A)：工作区里的副本改成 456，W-TS = ∞ —— 全局数据库里还是旧值', function () {
        S.code(1); K.write(1, 'A', 456, 0); K.sets(1, 'A', 'A', 600);
      });
      S.step('T2 BEGIN，R(A)：全局库里仍是 W-TS=0 的旧版本，T2 读走了它', function () {
        S.code(1); K.begin(2, 0); var e = K.copy(2, 'A', 123, 0, 300); K.sets(2, 'A', ' ', e);
        S.flash('w2AV', C.amber, { prop: 'color', delay: e + 200, hold: 700 });
      });
      S.step('T1 COMMIT → 验证阶段，TS(T1) = 1；T2 还没发号，算 ∞ → 逻辑上 T1 在 T2 之前', function () {
        S.code([2, 3]); K.stamp(1, 0);
      });
      S.step('拿 T1 的写集去和活跃事务 T2 的读集求交：{A} ∩ {A} ≠ ∅', function () {
        S.code([5, 6]); var e = K.compare('WS(T1) = {A}', 1, 'RS(T2) = {A}', 2, false, 0);
        S.flash('set1', C.red, { prop: 'color', delay: e, hold: 700 }); S.flash('set2', C.red, { prop: 'color', delay: e, hold: 700 });
        S.log('WS(T1) ∩ RS(T2) = {A}', { delay: e, kind: 'err' });
      });
      S.step('T2 逻辑上在 T1 之后，本该读到 456 却读了旧的 123 → 中止 T1（不是 T2）', function () {
        S.code([11, 14]);
        S.flash('w2AV', C.red, { prop: 'color', hold: 800 }); S.pulse('w2AV', { scale: 1.2 });
        K.finish(1, false, 700); K.verdict('验证失败：中止的是正在验证的 T1', C.red, 900);
      });
      S.step('T1 的改动只存在于私有工作区，丢掉即可 —— 全局数据库从未被弄脏；T2 照常继续', function () {
        S.code(14);
        S.flash('dA', C.green, { prop: 'stroke', hold: 800 }); S.pulse('dAV', { scale: 1.15 });
        S.to('wp2', { stroke: C.green }, { delay: 500, dur: 300 }); S.pulse('wt2', { delay: 500 });
        S.log('全局库 A 仍是 123（W-TS=0）', { delay: 300, kind: 'ok' }); S.log('T2 没做错任何事，继续运行', { delay: 600 });
      });
    }
  },

  /* ───────────────────────── 场景 3：验证通过 ───────────────────────── */
  {
    name: '前向验证：通过',
    moving: 'T1 的写集和 T2 的读集飞进验证区、互不相交变绿；T1 的新行飞进全局数据库、W-TS 滚动；随后 T2 把这个新版本复制进自己的工作区',
    lang: '前向验证规则 + 伪代码（示意）',
    code: vcode('T1 R(A)W(A) │ T2 R(B) │ T1 提交 │ T2 R(A)'),
    build: function (S) {
      var K = occ(S, [['A', 123, 0], ['B', 'XYZ', 0]]);

      S.step('T1：R(A) 复制进工作区，W(A) 把副本改成 456（W-TS = ∞）', function () {
        S.code(1); K.begin(1, 0); var e = K.copy(1, 'A', 123, 0, 300);
        K.write(1, 'A', 456, e + 400); K.sets(1, 'A', 'A', e + 1000);
      });
      S.step('T2：BEGIN，R(B) —— 它到目前为止只读了 B', function () {
        S.code(1); K.begin(2, 0); var e = K.copy(2, 'B', 'XYZ', 0, 300); K.sets(2, 'B', ' ', e);
      });
      S.step('T1 COMMIT → 验证阶段，TS(T1) = 1', function () {
        S.code([2, 3]); K.stamp(1, 0);
      });
      S.step('T1 的写集 {A} 和 T2 的读集 {B} 不相交，T2 也没写过东西 → 验证通过', function () {
        S.code([7, 9]); var e = K.compare('WS(T1) = {A}', 1, 'RS(T2) = {B}', 2, true, 0);
        S.code(15, { delay: e + 300 }); S.log('WS(T1) ∩ RS(T2) = ∅ → 通过', { delay: e, kind: 'ok' });
      });
      S.step('T1 写阶段：A=456、W-TS=1 装进全局数据库', function () {
        S.code(15); var e = K.install(1, 'A', 456, 1, 0);
        S.data({ '全局 A': '456（W-TS=1）' }, { delay: e }); K.finish(1, true, e + 600);
      });
      S.step('T2：R(A) —— 现在读到的就是 T1 装进去的新版本 456（W-TS=1）', function () {
        S.code(1); var e = K.copy(2, 'A', 456, 1, 0); K.sets(2, 'B, A', ' ', e);
        S.flash('w2AV', C.green, { prop: 'color', delay: e + 200, hold: 700 });
      });
      S.step('T2 COMMIT → TS(T2) = 2，验证通过。整个执行等价于串行 T1 → T2', function () {
        S.code(15); var e = K.stamp(2, 0);
        K.phase(2, 2, e + 300); K.finish(2, true, e + 900);
        K.verdict('T2 读到的正是 T1 提交后的值 → 等价于串行 T1 → T2', C.green, e + 900);
      });
    }
  }
  ]
});
})();
