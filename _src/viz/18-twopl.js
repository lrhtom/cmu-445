/* #18 两阶段封锁：两个阶段与持锁曲线 / 阻塞与唤醒 / 级联中止与 SS2PL / 死锁检测 / Wait-Die 与 Wound-Wait
 * 调度（谁先加什么锁）取自官方 Slides；对象的具体数值、时间戳 ts=1/2 是为了画得下而取的示意值。T1 蓝、T2 紫。 */
(function () {
var C = Viz.C, TC = { 1: C.blue, 2: C.purple };
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #18 Two-Phase Locking（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/18-twophaselocking.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #18 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/18-twophaselocking.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Project #4 Concurrency Control', u: 'https://15445.courses.cs.cmu.edu/fall2025/project4/' }
];
function slotBox(S, id, x, y, w, label) {
  S.box(id, { x: x, y: y, w: w, h: 38, rx: 8, fill: C.bg, stroke: C.line, sw: 1.5, dash: '4 4', label: label, color: C.mute, size: 14 });
}
function token(S, id, th, x, y, label) {
  S.box(id, { x: x, y: y, w: 92, h: 28, rx: 7, fill: TC[th], stroke: TC[th], sw: 2, label: label, color: C.bg, size: 15, weight: 700, opacity: 0, trail: 3 });
}
function txnBox(S, th, x, y) {
  S.box('tx' + th, { x: x, y: y, w: 220, h: 104, rx: 14, fill: C.panel, stroke: TC[th], sw: 2 });
  S.text('txn' + th, { x: x, y: y - 32, text: 'T' + th, size: 17, weight: 700, color: TC[th] });
  S.text('txo' + th, { x: x, y: y, text: '—', size: 18, weight: 700 });
  S.text('txs' + th, { x: x, y: y + 32, text: '未开始', size: 14, color: C.mute });
}
function say(S, th, op, st, t, col) {
  S.set('txo' + th, { text: op }, { delay: t }); S.pulse('txo' + th, { delay: t });
  if (st) S.set('txs' + th, { text: st, color: col || C.mute }, { delay: t });
}

Viz.register('twopl', {
  title: '两阶段封锁：2PL · 级联中止 · 死锁检测与预防',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：两个阶段 ───────────────────────── */
  {
    name: '增长期与收缩期',
    moving: '加锁请求从事务飞向锁表、回执飞回；持锁数量滚动；曲线一段段长出来、圆点沿曲线爬升再下降；阶段指示框从「增长期」滑到「收缩期」',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'class Txn {',
      '  enum { GROWING, SHRINKING } phase = GROWING;',
      '  set<Obj> held;',
      '  void Lock(Obj o, Mode m) {',
      '    if (phase == SHRINKING)       // 核心禁令',
      '      throw TwoPhaseViolation();',
      '    lock_mgr.Acquire(this, o, m); // 可能阻塞',
      '    held.insert(o);',
      '  }',
      '  void Unlock(Obj o) {',
      '    phase = SHRINKING;   // 放掉任何一个锁',
      '    lock_mgr.Release(this, o);  // 就转阶段',
      '    held.erase(o);',
      '  }',
      '  // 收缩期仍可读写 held 里的对象',
      '};'
    ].join('\n'),
    build: function (S) {
      var XS = [150, 250, 350, 450, 550, 650, 750], YS = [510, 455, 400, 345, 400, 455, 510], ROW = { A: 100, B: 144, C: 188, D: 232 }, k, i;
      S.text('note', { x: 20, y: 22, text: '对象 A–D 与加锁顺序为示意', anchor: 'start', size: 14, color: C.mute });
      S.box('t1', { x: 170, y: 150, w: 290, h: 196, rx: 14, fill: C.panel, stroke: C.blue, sw: 2 });
      S.text('t1t', { x: 170, y: 76, text: '事务 T1', size: 17, weight: 700, color: C.blue });
      S.box('phG', { x: 100, y: 118, w: 128, h: 36, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: '增长期', size: 15 });
      S.box('phS', { x: 240, y: 118, w: 128, h: 36, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: '收缩期', size: 15, color: C.mute });
      S.box('phH', { x: 100, y: 118, w: 138, h: 46, rx: 11, fill: 'none', stroke: C.green, sw: 3 });
      S.text('cnt', { x: 170, y: 178, val: 0, pre: '持锁数量：', size: 22, color: C.amber, weight: 700 });
      S.text('held', { x: 170, y: 218, text: '持有：—', size: 15, color: C.mute });
      S.box('lm', { x: 600, y: 150, w: 440, h: 222, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('lmt', { x: 600, y: 60, text: '锁管理器（中心化的锁表）', size: 15, color: C.mute });
      for (k in ROW) {
        S.box('o' + k, { x: 430, y: ROW[k], w: 56, h: 34, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: k, size: 17 });
        S.box('s' + k, { x: 640, y: ROW[k], w: 320, h: 34, rx: 8, fill: C.bg, stroke: C.line, sw: 1.5, dash: '4 4', label: '空闲', color: C.mute, size: 14 });
        S.box('tk' + k, { x: 640, y: ROW[k], w: 150, h: 26, rx: 6, fill: C.blue, stroke: 'none', sw: 0, label: '', color: C.bg, size: 15, weight: 700, opacity: 0 });
      }
      S.box('rgG', { x: 300, y: 420, w: 300, h: 180, rx: 0, fill: '#13294a', stroke: 'none', sw: 0 });
      S.box('rgS', { x: 600, y: 420, w: 300, h: 180, rx: 0, fill: '#33280f', stroke: 'none', sw: 0, opacity: 0 });
      S.text('rgGt', { x: 300, y: 316, text: 'Growing 增长期', size: 15, color: C.blue });
      S.text('rgSt', { x: 600, y: 316, text: 'Shrinking 收缩期', size: 15, color: C.amber, opacity: 0 });
      S.line('ax', { x1: 110, y1: 510, x2: 832, y2: 510, stroke: C.line, sw: 2, arrow: true });
      S.line('ay', { x1: 110, y1: 510, x2: 110, y2: 292, stroke: C.line, sw: 2, arrow: true });
      for (i = 0; i < 4; i++) S.text('yt' + i, { x: 94, y: 510 - i * 55, text: String(i), size: 14, color: C.mute });
      S.text('ayl', { x: 124, y: 290, text: '持锁数量', anchor: 'start', size: 14, color: C.mute });
      S.text('axl', { x: 832, y: 532, text: '事务生命周期 →', anchor: 'end', size: 14, color: C.mute });
      for (i = 0; i < 6; i++) S.line('seg' + i, { x1: XS[i], y1: YS[i], x2: XS[i + 1], y2: YS[i + 1], stroke: C.amber, sw: 3.5, draw: 0, opacity: 0 });
      S.dot('pt', { x: XS[0], y: YS[0], r: 9, fill: C.amber, trail: 3 });
      S.data({ '阶段': 'GROWING', '持锁数量': 0, 'held': '{}' });
      var n = 0, have = [];
      function acquire(o, m) {
        var y = ROW[o]; n++;
        S.fly([315, 150], [430, y], { label: m + '?', w: 44, h: 26, color: C.cyan, dur: 650 });
        S.flash('o' + o, C.blue, { delay: 650, prop: 'stroke' }); S.pulse('o' + o, { delay: 650 });
        S.set('s' + o, { label: '' }, { delay: 850 }); S.to('s' + o, { stroke: C.green }, { delay: 850, dur: 300 });
        S.set('tk' + o, { label: 'T1 持有 · ' + m }, { delay: 850 }); S.pop('tk' + o, { delay: 850 });
        S.fly([560, y], [315, 150], { color: C.green, delay: 1050, dur: 600 });
        S.count('cnt', n, { delay: 1650 }); S.pulse('cnt', { delay: 1650 });
        have.push(o + '(' + m + ')');
        S.set('held', { text: '持有：' + have.join(' ') }, { delay: 1650 });
        S.to('seg' + (n - 1), { draw: 1, opacity: 1 }, { delay: 1650, dur: 600 }); S.move('pt', XS[n], YS[n], { delay: 1650, dur: 600 });
        S.data({ '持锁数量': n, 'held': '{' + have.join(', ') + '}' }, { delay: 1650 });
        S.log('Lock(' + o + ', ' + m + ') → 授予', { delay: 850, kind: 'ok' });
      }
      var rel = 0;
      function release(o, t) {
        var idx = 3 + rel; rel++; n--;
        have = have.filter(function (h) { return h.charAt(0) !== o; });
        S.to('tk' + o, { scale: .2, opacity: 0 }, { delay: t, dur: 400, ease: 'in' });
        S.fly([640, ROW[o]], [315, 150], { color: C.amber, delay: t + 100, dur: 600 });
        S.set('s' + o, { label: '空闲' }, { delay: t + 400 }); S.to('s' + o, { stroke: C.line }, { delay: t + 400, dur: 300 });
        S.count('cnt', n, { delay: t + 700 }); S.pulse('cnt', { delay: t + 700 });
        S.set('held', { text: '持有：' + (have.join(' ') || '—') }, { delay: t + 700 });
        S.to('seg' + idx, { draw: 1, opacity: 1 }, { delay: t + 700, dur: 600 }); S.move('pt', XS[idx + 1], YS[idx + 1], { delay: t + 700, dur: 600 });
        S.data({ '持锁数量': n, 'held': '{' + have.join(', ') + '}' }, { delay: t + 700 });
        S.log('Unlock(' + o + ')', { delay: t + 400 });
      }

      S.step('增长期：T1 向锁管理器申请 A 的排他锁（X）→ 没人占 → 授予', function () { S.code(7); acquire('A', 'X'); });
      S.step('再申请 B 的共享锁（S）→ 授予，持锁数量继续上升', function () { S.code([7, 8]); acquire('B', 'S'); });
      S.step('再申请 C 的排他锁（X）→ 授予。增长期想申请多少都可以', function () { S.code([7, 8]); acquire('C', 'X'); });
      S.step('T1 释放 A：只要放掉任何一个锁，就立刻进入收缩期', function () {
        S.code(11); release('A', 0);
        S.move('phH', 240, 118, { delay: 700, dur: 700 }); S.to('phH', { stroke: C.amber }, { delay: 700, dur: 700 });
        S.to('phS', { color: C.ink }, { delay: 1000, dur: 300 }); S.to('phG', { color: C.mute }, { delay: 1000, dur: 300 });
        S.to('rgS', { opacity: 1 }, { delay: 900, dur: 500 }); S.pop('rgSt', { delay: 1100 });
        S.data({ '阶段': 'SHRINKING' }, { delay: 1000 }); S.log('phase = SHRINKING', { delay: 1000, kind: 'warn' });
      });
      S.step('收缩期再去申请新锁 D？不允许 ——「放掉一些锁、又去拿新锁」正是 2PL 禁止的', function () {
        S.code([5, 6]);
        S.fly([315, 150], [382, 196], { label: 'X?', w: 44, h: 26, color: C.cyan, dur: 500, ripple: false, linger: 200 });
        S.ripple(382, 196, { delay: 500, color: C.red, r: 44 });
        S.fly([382, 196], [315, 150], { label: '✗', w: 44, h: 26, color: C.red, delay: 750, dur: 500 });
        S.flash('phH', C.red, { prop: 'stroke', delay: 600, hold: 700 }); S.flash('t1', C.red, { prop: 'stroke', delay: 600, hold: 700 });
        S.flash('oD', C.red, { prop: 'stroke', delay: 500 });
        S.log('Lock(D, X) → 违反 2PL，拒绝', { delay: 600, kind: 'err' });
      });
      S.step('但 B、C 的锁还在手里：收缩期照样可以读写它们，只是不能申请新锁', function () {
        S.code(15);
        S.fly([315, 150], [560, 144], { label: 'R(B)', w: 54, h: 26, color: C.cyan, dur: 650 }); S.flash('tkB', C.green, { delay: 650 }); S.pulse('tkB', { delay: 650, scale: 1.08 });
        S.fly([315, 150], [560, 188], { label: 'W(C)', w: 54, h: 26, color: C.cyan, delay: 500, dur: 650 }); S.flash('tkC', C.green, { delay: 1150 }); S.pulse('tkC', { delay: 1150, scale: 1.08 });
        S.log('R(B), W(C)：仍持有锁，允许', { delay: 1150, kind: 'ok' });
      });
      S.step('继续释放 B、C：曲线到峰值后只降不升，持锁数量回到 0', function () {
        S.code([11, 13]); release('B', 0); release('C', 1300);
        S.flash('pt', C.green, { delay: 2700 }); S.ripple(XS[6], YS[6], { delay: 2700, color: C.green });
      });
    }
  },

  /* ───────────────────────── 场景 2：阻塞与唤醒 ───────────────────────── */
  {
    name: '阻塞与唤醒',
    moving: '锁令牌从事务飞进锁表的「持有者」格；被拒的令牌弹开、滑进等待队列；数据在数据库和事务之间飞；持有者释放后，队首令牌滑进持有者格',
    lang: '调度（按执行顺序）',
    code: [
      'T1  BEGIN',
      'T1  X-LOCK(A)     -- 授予',
      'T1  R(A)  W(A)',
      'T2  BEGIN',
      'T2  X-LOCK(A)     -- 拒绝：阻塞等待',
      'T1  R(A)          -- 读到自己写的值',
      'T1  UNLOCK(A)     -- 进入收缩期',
      'T1  COMMIT',
      'T2  X-LOCK(A)     -- 被唤醒，授予',
      'T2  W(A)',
      'T2  UNLOCK(A)',
      'T2  COMMIT'
    ].join('\n'),
    build: function (S) {
      S.text('note', { x: 20, y: 22, text: 'A 的数值 100 → 200 → 300 为示意', anchor: 'start', size: 14, color: C.mute });
      txnBox(S, 1, 140, 118); txnBox(S, 2, 720, 118);
      S.box('lm', { x: 430, y: 296, w: 600, h: 132, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('lmt', { x: 430, y: 214, text: '锁管理器：记录每个对象谁持有、谁在等', size: 15, color: C.mute });
      S.text('h1', { x: 210, y: 256, text: '对象', size: 14, color: C.mute }); S.text('h2', { x: 370, y: 256, text: '持有者', size: 14, color: C.mute }); S.text('h3', { x: 590, y: 256, text: '等待队列', size: 14, color: C.mute });
      S.box('oA', { x: 210, y: 308, w: 64, h: 42, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: 'A', size: 19 });
      slotBox(S, 'sH', 370, 308, 170, '空闲'); slotBox(S, 'sQ', 590, 308, 210, '空');
      S.box('db', { x: 430, y: 462, w: 250, h: 64, rx: 12, fill: C.cell, stroke: C.line, sw: 2.5 });
      S.text('dbn', { x: 356, y: 462, text: 'A =', size: 20, color: C.mute, weight: 700 }); S.text('dbv', { x: 448, y: 462, val: 100, size: 24, weight: 700 });
      S.text('dbs', { x: 430, y: 514, text: '数据库里的对象 A（已提交）', size: 14, color: C.mute });
      token(S, 'k1', 1, 140, 190, 'T1 · X'); token(S, 'k2', 2, 720, 190, 'T2 · X');
      S.data({ 'A 的持有者': '—', '等待队列': '[]', A: 100 });

      S.step('T1：X-LOCK(A)。A 没人占，锁管理器授予', function () {
        S.code(2); S.log('T1: X-LOCK(A)'); say(S, 1, 'X-LOCK(A)', '增长期', 0, C.blue);
        S.pop('k1'); S.move('k1', 370, 308, { delay: 350, dur: 800 }); S.ripple(370, 308, { delay: 1150, color: C.green });
        S.set('sH', { label: '' }, { delay: 1100 }); S.to('sH', { stroke: C.green }, { delay: 1150, dur: 300 });
        S.data({ 'A 的持有者': 'T1 (X)' }, { delay: 1150 }); S.log('Granted (T1 → A)', { delay: 1150, kind: 'ok' });
      });
      S.step('T1：读 A（100），再把它写成 200 —— 这个值还没提交', function () {
        S.code(3); say(S, 1, 'R(A)  W(A)', null, 0);
        S.fly([330, 442], [200, 172], { label: '100', w: 54, h: 26, color: C.cyan, dur: 750 });
        S.fly([200, 172], [330, 442], { label: '200', w: 54, h: 26, color: C.cyan, delay: 1000, dur: 750 });
        S.count('dbv', 200, { delay: 1750 }); S.to('db', { stroke: C.amber }, { delay: 1750, dur: 300 });
        S.set('dbs', { text: '数据库里的对象 A（T1 写的，未提交）', color: C.amber }, { delay: 1750 });
        S.data({ A: '200（未提交）' }, { delay: 1750 }); S.log('T1: R(A)=100, W(A)=200', { delay: 1750 });
      });
      S.step('T2：X-LOCK(A)。T1 以 X 持有，不兼容 → 拒绝，T2 进等待队列并阻塞', function () {
        S.code(5); S.log('T2: X-LOCK(A)'); say(S, 2, 'X-LOCK(A)', '增长期', 0, C.purple);
        S.pop('k2'); S.move('k2', 470, 296, { delay: 350, dur: 750 });
        S.ripple(440, 308, { delay: 1100, color: C.red }); S.flash('k1', C.red, { delay: 1100, prop: 'stroke' }); S.pulse('k1', { delay: 1100 });
        S.move('k2', 590, 308, { delay: 1300, dur: 600 });
        S.to('k2', { fill: C.bg, color: C.amber, stroke: C.amber }, { delay: 1300, dur: 400 }); S.set('k2', { dash: '4 3' }, { delay: 1300 });
        S.set('sQ', { label: '' }, { delay: 1700 }); S.to('sQ', { stroke: C.amber }, { delay: 1700, dur: 300 });
        say(S, 2, 'X-LOCK(A)', '阻塞：等 T1 放锁', 1700, C.amber); S.to('tx2', { stroke: C.amber }, { delay: 1700, dur: 300 });
        S.data({ '等待队列': '[T2 (X)]' }, { delay: 1700 }); S.log('Denied! T2 阻塞', { delay: 1300, kind: 'warn' });
      });
      S.step('T1：再读一次 A —— 还是自己写的 200。它没放过锁，别人插不进来', function () {
        S.code(6); say(S, 1, 'R(A)', null, 0);
        S.fly([330, 442], [200, 172], { label: '200', w: 54, h: 26, color: C.cyan, dur: 750 });
        S.flash('tx1', C.green, { prop: 'stroke', delay: 750, hold: 600 }); S.log('T1: R(A)=200 ✓ 可重复读', { delay: 750, kind: 'ok' });
      });
      S.step('T1：UNLOCK(A) 并提交。锁管理器从等待队列里唤醒 T2，把锁授予它', function () {
        S.code([7, 8]); say(S, 1, 'UNLOCK(A)  COMMIT', '已提交', 0, C.green);
        S.to('k1', { scale: .2, opacity: 0 }, { dur: 400, ease: 'in' }); S.to('tx1', { stroke: C.green }, { delay: 300, dur: 300 });
        S.to('db', { stroke: C.green }, { delay: 400, dur: 300 }); S.set('dbs', { text: '数据库里的对象 A（已提交）', color: C.mute }, { delay: 400 });
        S.log('Released (T1 → A)', { delay: 400 });
        S.code(9, { delay: 900 });
        S.set('k2', { dash: '' }, { delay: 900 }); S.move('k2', 370, 308, { delay: 900, dur: 700 });
        S.to('k2', { fill: C.purple, color: C.bg, stroke: C.purple }, { delay: 900, dur: 500 }); S.ripple(370, 308, { delay: 1600, color: C.green });
        S.set('sQ', { label: '空' }, { delay: 1300 }); S.to('sQ', { stroke: C.line }, { delay: 1300, dur: 300 });
        say(S, 2, 'X-LOCK(A)', '被唤醒：拿到锁', 1600, C.purple); S.to('tx2', { stroke: C.purple }, { delay: 1600, dur: 300 });
        S.data({ 'A 的持有者': 'T2 (X)', '等待队列': '[]', A: 200 }, { delay: 1600 }); S.log('Granted (T2 → A)', { delay: 1600, kind: 'ok' });
      });
      S.step('T2：W(A) = 300', function () {
        S.code(10); say(S, 2, 'W(A)', null, 0);
        S.fly([660, 172], [530, 442], { label: '300', w: 54, h: 26, color: C.cyan, dur: 750 });
        S.count('dbv', 300, { delay: 750 }); S.to('db', { stroke: C.amber }, { delay: 750, dur: 300 });
        S.set('dbs', { text: '数据库里的对象 A（T2 写的，未提交）', color: C.amber }, { delay: 750 });
        S.data({ A: '300（未提交）' }, { delay: 750 }); S.log('T2: W(A)=300', { delay: 750 });
      });
      S.step('T2：UNLOCK(A) 并提交', function () {
        S.code([11, 12]); say(S, 2, 'UNLOCK(A)  COMMIT', '已提交', 0, C.green);
        S.to('k2', { scale: .2, opacity: 0 }, { dur: 400, ease: 'in' }); S.to('tx2', { stroke: C.green }, { delay: 300, dur: 300 });
        S.set('sH', { label: '空闲' }, { delay: 400 }); S.to('sH', { stroke: C.line }, { delay: 400, dur: 300 });
        S.to('db', { stroke: C.green }, { delay: 400, dur: 300 }); S.set('dbs', { text: '数据库里的对象 A（已提交）', color: C.mute }, { delay: 400 });
        S.data({ 'A 的持有者': '—', A: 300 }, { delay: 400 }); S.log('Released (T2 → A)', { delay: 400, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 3：级联中止 ───────────────────────── */
  {
    name: '级联中止 → 强严格 2PL',
    moving: '持锁条随时间向右伸长；未提交的值飞进数据库、又被 T2 读走；中止时数值滚回原值；最后 T1 的持锁条拉长到事务结束、T2 的操作块整体右移',
    lang: '调度（按执行顺序）',
    code: [
      'T1  BEGIN',
      'T1  X-LOCK(A)  X-LOCK(B)',
      'T1  R(A)  W(A)',
      'T1  UNLOCK(A)     -- 2PL 允许提前放',
      'T2  BEGIN',
      'T2  X-LOCK(A)     -- 授予',
      'T2  R(A)  W(A)    -- 读到未提交的值',
      'T1  R(B)  W(B)',
      'T1  ABORT',
      'T2  ABORT         -- 被迫跟着回滚',
      '-- Strong Strict 2PL：',
      '-- 锁只在事务结束（提交/中止）时释放',
      '-- → T2 的 X-LOCK(A) 一直等到 T1 结束'
    ].join('\n'),
    build: function (S) {
      function SX(i) { return 150 + i * 90; }
      function bar(id, i, j, o) { /* 从第 i 格左沿伸到第 j 格右沿 */
        var l = SX(i) - 42, r = SX(j) + 42;
        S.to(id, { x: (l + r) / 2, w: r - l }, o);
      }
      var Y1 = 84, Y2 = 236;
      S.text('note', { x: 20, y: 22, text: 'A 的数值 100 / 200 / 300 为示意', anchor: 'start', size: 14, color: C.mute });
      S.box('mode', { x: 720, y: 24, w: 220, h: 30, rx: 15, fill: C.panel, stroke: C.line, sw: 1.5, label: '协议：基本 2PL', size: 15 });
      [[1, Y1], [2, Y2]].forEach(function (a) {
        S.line('ln' + a[0], { x1: 86, y1: a[1], x2: 838, y2: a[1], stroke: C.line, sw: 1.5, dash: '2 6' });
        S.box('lab' + a[0], { x: 52, y: a[1], w: 56, h: 34, rx: 17, fill: C.panel, stroke: TC[a[0]], sw: 2, label: 'T' + a[0], size: 16 });
      });
      S.text('bl1', { x: 100, y: Y1 + 40, text: 'A 锁', anchor: 'end', size: 14, color: C.mute }); S.text('bl2', { x: 100, y: Y1 + 66, text: 'B 锁', anchor: 'end', size: 14, color: C.mute });
      S.text('bl3', { x: 100, y: Y2 + 40, text: 'A 锁', anchor: 'end', size: 14, color: C.mute });
      S.box('bA1', { x: 109, y: Y1 + 40, w: 2, h: 18, rx: 5, fill: C.blue, stroke: 'none', sw: 0, opacity: 0 });
      S.box('bB1', { x: 109, y: Y1 + 66, w: 2, h: 18, rx: 5, fill: C.blue, stroke: 'none', sw: 0, opacity: 0 });
      S.box('bA2', { x: SX(3) - 41, y: Y2 + 40, w: 2, h: 18, rx: 5, fill: C.purple, stroke: 'none', sw: 0, opacity: 0 });
      S.box('bW2', { x: SX(3) - 41, y: Y2 + 40, w: 2, h: 22, rx: 5, fill: C.bg, stroke: C.amber, sw: 2, dash: '4 3', label: '', color: C.amber, size: 14, opacity: 0 });
      var ops = { p0: [1, 0, 'LOCK(A,B)'], p1: [1, 1, 'R(A) W(A)'], p2: [1, 2, 'UNLOCK(A)'], q3: [2, 3, 'X-LOCK(A)'], q4: [2, 4, 'R(A) W(A)'], p5: [1, 5, 'R(B) W(B)'], p6: [1, 6, 'ABORT'], q7: [2, 7, 'ABORT'] };
      Object.keys(ops).forEach(function (k) {
        var o = ops[k];
        S.box(k, { x: SX(o[1]), y: o[0] === 1 ? Y1 : Y2, w: 84, h: 34, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: o[2], color: C.mute, size: 14 });
      });
      S.text('dbt', { x: 430, y: 356, text: '数据库里的对象 A', size: 14, color: C.mute });
      S.box('db', { x: 430, y: 410, w: 280, h: 70, rx: 12, fill: C.cell, stroke: C.line, sw: 2.5 });
      S.text('dbn', { x: 350, y: 410, text: 'A =', size: 20, color: C.mute, weight: 700 }); S.text('dbv', { x: 452, y: 410, val: 100, size: 26, weight: 700 });
      S.text('dbs', { x: 430, y: 464, text: '已提交', size: 15, color: C.mute });
      S.text('vd', { x: 430, y: 512, text: '', size: 17, weight: 700, opacity: 0 });
      S.data({ A: 100, 'T1 的锁': '—', 'T2 的锁': '—', 'T2 依赖': '—' });
      function on(k, t, col) { var th = ops[k][0], c = col || TC[th]; S.to(k, { fill: c, color: C.bg, stroke: c }, { delay: t || 0, dur: 300 }); S.pulse(k, { delay: t || 0 }); }

      S.step('T1：拿 A、B 的排他锁，读 A、把它写成 200 —— 一个尚未提交的值', function () {
        S.code([2, 3]); S.log('T1: X-LOCK(A), X-LOCK(B)');
        on('p0'); S.to('bA1', { opacity: .85 }, { dur: 200 }); S.to('bB1', { opacity: .85 }, { dur: 200 });
        bar('bA1', 0, 0, { delay: 100, dur: 400 }); bar('bB1', 0, 0, { delay: 100, dur: 400 });
        on('p1', 700); bar('bA1', 0, 1, { delay: 700, dur: 600 }); bar('bB1', 0, 1, { delay: 700, dur: 600 });
        S.fly([SX(1), Y1 + 20], [452, 376], { label: '200', w: 54, h: 26, color: C.cyan, delay: 900, dur: 800 });
        S.count('dbv', 200, { delay: 1700 }); S.to('db', { stroke: C.amber }, { delay: 1700, dur: 300 });
        S.set('dbs', { text: 'T1 写的，未提交', color: C.amber }, { delay: 1700 });
        S.data({ A: '200（T1 未提交）', 'T1 的锁': 'A(X) B(X)' }, { delay: 1700 }); S.log('T1: W(A)=200（未提交）', { delay: 1700 });
      });
      S.step('T1：UNLOCK(A)。基本 2PL 允许提交前就放锁（它进入了收缩期），B 的锁还握着', function () {
        S.code(4); on('p2');
        bar('bA1', 0, 2, { dur: 500 }); bar('bB1', 0, 2, { dur: 500 });
        S.flash('bA1', C.amber, { delay: 500 }); S.ripple(SX(2) + 42, Y1 + 40, { delay: 500, color: C.amber });
        S.data({ 'T1 的锁': 'B(X)' }, { delay: 500 }); S.log('T1: UNLOCK(A) → 收缩期', { delay: 500, kind: 'warn' });
      });
      S.step('T2：拿到 A 的锁，读到 200 —— T1 还没提交的值（脏读），并在它之上写成 300', function () {
        S.code(6); on('q3'); S.to('bA2', { opacity: .85 }, { dur: 200 }); bar('bA2', 3, 3, { delay: 100, dur: 400 }); bar('bB1', 0, 3, { dur: 500 });
        S.code(7, { delay: 700 }); on('q4', 700); bar('bA2', 3, 4, { delay: 700, dur: 600 }); bar('bB1', 0, 4, { delay: 700, dur: 600 });
        S.fly([452, 376], [SX(4), Y2 + 20], { label: '200', w: 54, h: 26, color: C.red, delay: 900, dur: 750 });
        S.flash('q4', C.red, { delay: 1650, prop: 'stroke', hold: 600 });
        S.fly([SX(4), Y2 + 20], [452, 376], { label: '300', w: 54, h: 26, color: C.cyan, delay: 2000, dur: 750 });
        S.count('dbv', 300, { delay: 2750 }); S.set('dbs', { text: 'T2 基于脏值写的，未提交', color: C.amber }, { delay: 2750 });
        S.data({ A: '300（T2 未提交）', 'T2 的锁': 'A(X)', 'T2 依赖': 'T1（读了它的未提交值）' }, { delay: 1650 });
        S.log('T2: R(A)=200 ← 脏读', { delay: 1650, kind: 'warn' }); S.log('T2: W(A)=300', { delay: 2750 });
      });
      S.step('T1：读写 B 之后 ABORT —— 它对 A 的修改必须撤销', function () {
        S.code(8); on('p5'); bar('bB1', 0, 5, { dur: 500 }); bar('bA2', 3, 5, { dur: 500 });
        S.code(9, { delay: 800 }); on('p6', 800, C.red); bar('bB1', 0, 6, { delay: 800, dur: 500 }); bar('bA2', 3, 6, { delay: 800, dur: 500 });
        S.ripple(SX(6), Y1, { delay: 900, color: C.red, r: 50 });
        S.data({ 'T1 的锁': '—（已中止）' }, { delay: 900 }); S.log('T1: ABORT', { delay: 900, kind: 'err' });
      });
      S.step('T2 读过 T1 的未提交值 → 只能跟着 ABORT（级联中止），工作白费，A 滚回 100', function () {
        S.code(10); on('q7', 0, C.red); bar('bA2', 3, 7, { dur: 500 }); S.ripple(SX(7), Y2, { delay: 100, color: C.red, r: 50 });
        S.flash('q4', C.red, { delay: 300, hold: 600 });
        S.count('dbv', 100, { delay: 700, dur: 800 }); S.to('db', { stroke: C.red }, { delay: 700, dur: 300 }); S.to('db', { stroke: C.line }, { delay: 1600, dur: 400 });
        S.set('dbs', { text: '两个事务都被撤销，回到已提交的 100', color: C.mute }, { delay: 1500 });
        S.set('vd', { text: '级联中止：T1 一死，读过它脏数据的事务全部陪葬', color: C.red }, { delay: 900 }); S.pop('vd', { delay: 900 });
        S.data({ A: 100, 'T2 的锁': '—（已中止）' }, { delay: 1500 }); S.log('T2: ABORT（级联）', { delay: 300, kind: 'err' });
      });
      S.step('Strong Strict 2PL：锁撑到事务结束才放 → T2 一直等到 T1 结束，读不到脏值', function () {
        S.code([11, 13]); S.hide('vd');
        S.set('mode', { label: '协议：Strong Strict 2PL' }); S.to('mode', { stroke: C.green }, { dur: 300 }); S.pulse('mode', { scale: 1.08 });
        S.to('p2', { opacity: .25 }, { dur: 400 });
        bar('bA1', 0, 6, { delay: 300, dur: 900 }); S.flash('bA1', C.green, { delay: 1200 });
        S.to('q7', { scale: .2, opacity: 0 }, { delay: 300, dur: 400, ease: 'in' });
        S.to('q4', { x: SX(7), fill: C.purple, stroke: C.purple }, { delay: 700, dur: 900 });
        S.to('q3', { fill: C.bg, color: C.amber, stroke: C.amber }, { delay: 700, dur: 400 });
        S.to('bA2', { x: SX(7), w: 84 }, { delay: 700, dur: 900 });
        S.set('bW2', { label: 'T2 阻塞：等 T1 结束' }, { delay: 900 }); S.to('bW2', { opacity: 1 }, { delay: 900, dur: 200 });
        S.to('bW2', { x: (SX(3) - 42 + SX(6) + 42) / 2, w: SX(6) - SX(3) + 84 }, { delay: 900, dur: 700 });
        S.fly([452, 376], [SX(7), Y2 + 20], { label: '100', w: 54, h: 26, color: C.green, delay: 1800, dur: 750 });
        S.set('dbs', { text: 'T2 读到的是 T1 撤销之后的干净值', color: C.green }, { delay: 2550 }); S.to('db', { stroke: C.green }, { delay: 2550, dur: 300 });
        S.set('vd', { text: '没有脏读，也就没有级联中止', color: C.green }, { delay: 2550 }); S.pop('vd', { delay: 2550 });
        S.data({ 'T1 的锁': 'A(X) B(X) 持有到结束', 'T2 的锁': '等到 T1 结束才拿到 A(X)', 'T2 依赖': '—' }, { delay: 1200 });
        S.log('SS2PL: T2 等到 T1 结束', { delay: 1200, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 4：死锁检测 ───────────────────────── */
  {
    name: '死锁检测：等待图',
    moving: '锁令牌飞进持有者格或被弹到等待格；等待图里的边随之长出来；红点沿环绕圈；牺牲者的令牌全部缩回，另一个事务的等待令牌滑进持有者格',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// lock_table：对象 → {持有者, 等待队列}',
      'void DetectDeadlock() {      // 后台周期运行',
      '  Graph g;                    // 等待图',
      '  for (auto& [obj, e] : lock_table)',
      '    for (Txn* w : e.waiting)',
      '      for (Txn* h : e.holders)',
      '        g.AddEdge(w, h);      // w 在等 h',
      '  while (auto cyc = g.FindCycle()) {',
      '    Txn* victim = PickVictim(*cyc);',
      '    victim->Abort();     // 放锁 + 撤销改动',
      '    g.RemoveNode(victim);',
      '  }',
      '}',
      '// PickVictim 可以看：年龄、已做的工作量、',
      '// 持锁数量、会连带回滚多少事务'
    ].join('\n'),
    build: function (S) {
      var RY = { A: 104, B: 158 };
      S.text('note', { x: 20, y: 22, text: '加锁顺序取自官方 Slides；选 T2 当牺牲品只是示意', anchor: 'start', size: 14, color: C.mute });
      txnBox(S, 1, 136, 124); txnBox(S, 2, 724, 124);
      S.box('lm', { x: 430, y: 124, w: 330, h: 160, rx: 14, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('h2', { x: 412, y: 66, text: '持有者', size: 14, color: C.mute }); S.text('h3', { x: 524, y: 66, text: '在等的', size: 14, color: C.mute }); S.text('h1', { x: 304, y: 66, text: '锁表', size: 14, color: C.mute });
      ['A', 'B'].forEach(function (o) {
        S.box('o' + o, { x: 304, y: RY[o], w: 46, h: 38, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: o, size: 18 });
        slotBox(S, 'sH' + o, 412, RY[o], 104, ''); slotBox(S, 'sW' + o, 524, RY[o], 104, '');
      });
      S.text('gt', { x: 430, y: 262, text: '等待图（Waits-For Graph）：Ti 在等 Tj 持有的锁 → 边 Ti → Tj', size: 15, color: C.mute });
      S.line('g21', { x1: 524, y1: 356, x2: 336, y2: 356, stroke: C.ink, sw: 3, arrow: true, draw: 0, opacity: 0 });
      S.line('g12', { x1: 336, y1: 400, x2: 524, y2: 400, stroke: C.ink, sw: 3, arrow: true, draw: 0, opacity: 0 });
      S.text('g21t', { x: 430, y: 336, text: 'T2 等 A', color: C.amber, size: 15, weight: 700, opacity: 0 });
      S.text('g12t', { x: 430, y: 422, text: 'T1 等 B', color: C.amber, size: 15, weight: 700, opacity: 0 });
      S.box('g1', { x: 282, y: 378, w: 100, h: 100, rx: 50, fill: C.panel, stroke: TC[1], sw: 3, label: 'T1', size: 22 });
      S.box('g2', { x: 578, y: 378, w: 100, h: 100, rx: 50, fill: C.panel, stroke: TC[2], sw: 3, label: 'T2', size: 22 });
      S.text('vd', { x: 430, y: 494, text: '', size: 17, weight: 700, opacity: 0 });
      token(S, 'a1', 1, 136, 196, 'T1 · X'); token(S, 'b2', 2, 724, 196, 'T2 · S'); token(S, 'a2', 2, 724, 196, 'T2 · S'); token(S, 'b1', 1, 136, 196, 'T1 · X');
      S.data({ 'A': '持有 —；等待 —', 'B': '持有 —；等待 —', '等待图': '无边' });
      function grant(id, x, y, t) { S.pop(id, { delay: t }); S.move(id, x, y, { delay: t + 350, dur: 750 }); S.ripple(x, y, { delay: t + 1100, color: C.green }); return t + 1100; }
      function deny(id, hx, wx, y, t, holder) { /* 冲向持有者格 → 被弹开 → 停进等待格 */
        S.pop(id, { delay: t }); S.move(id, hx + (wx > hx ? 30 : -30), y - 22, { delay: t + 350, dur: 700 });
        S.ripple(hx, y, { delay: t + 1050, color: C.red }); S.flash(holder, C.red, { delay: t + 1050, prop: 'stroke' }); S.pulse(holder, { delay: t + 1050 });
        S.move(id, wx, y, { delay: t + 1250, dur: 500 });
        S.to(id, { fill: C.bg, color: C.amber, stroke: C.amber }, { delay: t + 1250, dur: 400 }); S.set(id, { dash: '4 3' }, { delay: t + 1250 });
        return t + 1750;
      }

      S.step('T1：X-LOCK(A) → 授予', function () {
        S.code(1); S.log('T1: X-LOCK(A)'); say(S, 1, 'X-LOCK(A)', '运行中', 0, C.blue);
        var e = grant('a1', 412, RY.A, 0);
        S.data({ 'A': '持有 T1(X)；等待 —' }, { delay: e }); S.log('Granted (T1 → A)', { delay: e, kind: 'ok' });
      });
      S.step('T2：S-LOCK(B) → 授予', function () {
        S.code(1); S.log('T2: S-LOCK(B)'); say(S, 2, 'S-LOCK(B)', '运行中', 0, C.purple);
        var e = grant('b2', 412, RY.B, 0);
        S.data({ 'B': '持有 T2(S)；等待 —' }, { delay: e }); S.log('Granted (T2 → B)', { delay: e, kind: 'ok' });
      });
      S.step('T2：S-LOCK(A)。A 被 T1 以 X 持有 → 拒绝，T2 等待；等待图加边 T2 → T1', function () {
        S.code([5, 7]); S.log('T2: S-LOCK(A)'); say(S, 2, 'S-LOCK(A)', null, 0);
        var e = deny('a2', 412, 524, RY.A, 0, 'a1');
        say(S, 2, 'S-LOCK(A)', '阻塞：等 A', e, C.amber); S.to('tx2', { stroke: C.amber }, { delay: e, dur: 300 });
        S.fly([524, RY.A], [430, 356], { color: C.amber, delay: e, dur: 650 });
        S.to('g21', { opacity: 1, draw: 1 }, { delay: e + 600, dur: 500 }); S.pop('g21t', { delay: e + 900 });
        S.data({ 'A': '持有 T1(X)；等待 T2(S)', '等待图': 'T2 → T1' }, { delay: e + 600 }); S.log('Denied! 边 T2 → T1', { delay: e, kind: 'warn' });
      });
      S.step('T1：X-LOCK(B)。B 被 T2 以 S 持有，X 与 S 不兼容 → 拒绝，T1 等待；加边 T1 → T2', function () {
        S.code([5, 7]); S.log('T1: X-LOCK(B)'); say(S, 1, 'X-LOCK(B)', null, 0);
        var e = deny('b1', 412, 524, RY.B, 0, 'b2');
        say(S, 1, 'X-LOCK(B)', '阻塞：等 B', e, C.amber); S.to('tx1', { stroke: C.amber }, { delay: e, dur: 300 });
        S.fly([524, RY.B], [430, 400], { color: C.amber, delay: e, dur: 650 });
        S.to('g12', { opacity: 1, draw: 1 }, { delay: e + 600, dur: 500 }); S.pop('g12t', { delay: e + 900 });
        S.data({ 'B': '持有 T2(S)；等待 T1(X)', '等待图': 'T2 → T1，T1 → T2' }, { delay: e + 600 }); S.log('Denied! 边 T1 → T2', { delay: e, kind: 'warn' });
      });
      S.step('检测器周期性地在等待图里找环：T1 → T2 → T1，成环 = 死锁，谁也动不了', function () {
        S.code(8);
        S.to('g12', { stroke: C.red }, { dur: 350 }); S.to('g21', { stroke: C.red }, { dur: 350 });
        S.fly([336, 400], [524, 400], { color: C.red, delay: 300, dur: 600, ripple: false }); S.fly([524, 356], [336, 356], { color: C.red, delay: 900, dur: 600, ripple: false });
        S.fly([336, 400], [524, 400], { color: C.red, delay: 1500, dur: 600, ripple: false }); S.fly([524, 356], [336, 356], { color: C.red, delay: 2100, dur: 600, ripple: false });
        S.set('vd', { text: '等待图有环 → 死锁', color: C.red }, { delay: 600 }); S.pop('vd', { delay: 600 });
        S.log('FindCycle() = T1 → T2 → T1', { delay: 600, kind: 'err' });
      });
      S.step('挑一个牺牲品中止（这里选 T2）：释放它的全部锁、撤销它的改动', function () {
        S.code([9, 11]);
        S.to('g2', { stroke: C.red, color: C.red }, { dur: 350 }); S.pulse('g2', { scale: 1.1 }); S.ripple(578, 378, { color: C.red, r: 70 });
        say(S, 2, 'ABORT', '被选为牺牲品', 300, C.red); S.to('tx2', { stroke: C.red }, { delay: 300, dur: 300 });
        S.to('b2', { scale: .2, opacity: 0 }, { delay: 700, dur: 400, ease: 'in' }); S.to('a2', { scale: .2, opacity: 0 }, { delay: 900, dur: 400, ease: 'in' });
        S.to('g21', { draw: 0, opacity: 0 }, { delay: 1100, dur: 500 }); S.hide('g21t', { delay: 1100 });
        S.to('g12', { draw: 0, opacity: 0 }, { delay: 1300, dur: 500 }); S.hide('g12t', { delay: 1300 });
        S.to('g2', { opacity: .3 }, { delay: 1300, dur: 400 });
        S.set('vd', { text: '牺牲 T2，环被打破', color: C.amber }, { delay: 1100 }); S.pulse('vd', { delay: 1100 });
        S.data({ 'A': '持有 T1(X)；等待 —', 'B': '持有 —；等待 T1(X)', '等待图': '无边' }, { delay: 1300 }); S.log('victim = T2 → Abort()', { delay: 300, kind: 'err' });
      });
      S.step('T2 的锁一放，T1 等的 B 立刻到手，继续往下执行', function () {
        S.code(13);
        S.set('b1', { dash: '' }); S.move('b1', 412, RY.B, { dur: 650 }); S.to('b1', { fill: C.blue, color: C.bg, stroke: C.blue }, { dur: 450 });
        S.ripple(412, RY.B, { delay: 650, color: C.green });
        say(S, 1, 'X-LOCK(B)', '被唤醒：继续执行', 650, C.green); S.to('tx1', { stroke: C.green }, { delay: 650, dur: 300 });
        S.to('g1', { stroke: C.green }, { delay: 650, dur: 300 });
        S.set('vd', { text: 'T1 拿到 B，死锁解除', color: C.green }, { delay: 650 }); S.pulse('vd', { delay: 650 });
        S.data({ 'B': '持有 T1(X)；等待 —' }, { delay: 650 }); S.log('Granted (T1 → B)', { delay: 650, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 5：死锁预防 ───────────────────────── */
  {
    name: '预防：Wait-Die / Wound-Wait',
    moving: '左右两栏同时演：持有者令牌飞进锁里；申请者的令牌撞上去弹回；然后按各自规则 —— 停下等待（变黄虚线）、自己缩小消失、或把持有者挤出去自己滑进锁里',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 申请的锁被别人持有时，当场裁决',
      '// 时间戳越小 = 越老 = 优先级越高',
      'Action WaitDie(Txn* req, Txn* holder) {',
      '  if (req->ts < holder->ts)',
      '    return WAIT;          // 老的：等',
      '  return ABORT_SELF;      // 年轻的：死',
      '}',
      'Action WoundWait(Txn* req, Txn* holder) {',
      '  if (req->ts < holder->ts)',
      '    return ABORT_HOLDER;  // 老的：抢',
      '  return WAIT;            // 年轻的：等',
      '}',
      '// 被中止的事务重启时沿用【最初】的 ts',
      '// → 迟早变成最老的，不会饿死'
    ].join('\n'),
    build: function (S) {
      var CX = { L: 222, R: 638 }, AY = 172, LY = 318, WY = 246;
      function AX(p, th) { return CX[p] + (th === 1 ? -98 : 98); }
      ['L', 'R'].forEach(function (p) {
        var cx = CX[p];
        S.box('pn' + p, { x: cx, y: 258, w: 396, h: 404, rx: 16, fill: C.panel, stroke: C.line, sw: 2 });
        S.text('ti' + p, { x: cx, y: 82, text: p === 'L' ? 'Wait-Die' : 'Wound-Wait', size: 20, weight: 700 });
        S.text('su' + p, { x: cx, y: 110, text: p === 'L' ? '老的等年轻的' : '年轻的等老的', size: 15, color: C.amber, weight: 700 });
        S.box('ac' + p + 1, { x: AX(p, 1), y: AY, w: 172, h: 46, rx: 10, fill: C.cell, stroke: TC[1], sw: 2, label: 'T1 · 老（ts=1）', size: 15 });
        S.box('ac' + p + 2, { x: AX(p, 2), y: AY, w: 172, h: 46, rx: 10, fill: C.cell, stroke: TC[2], sw: 2, label: 'T2 · 年轻（ts=2）', size: 15 });
        S.box('lk' + p, { x: cx, y: LY, w: 176, h: 84, rx: 12, fill: C.bg, stroke: C.line, sw: 2, dash: '5 4' });
        S.text('lkt' + p, { x: cx, y: LY - 26, text: 'A 的锁 · 持有者', size: 14, color: C.mute });
        S.line('dir' + p, p === 'L' ? { x1: cx - 44, y1: 214, x2: cx + 44, y2: 214, stroke: C.amber, sw: 3, arrow: true, draw: 0, opacity: 0 } : { x1: cx + 44, y1: 214, x2: cx - 44, y2: 214, stroke: C.amber, sw: 3, arrow: true, draw: 0, opacity: 0 });
        S.text('rs' + p, { x: cx, y: 392, text: '', size: 17, weight: 700, opacity: 0 });
        S.text('ru' + p, { x: cx, y: 436, text: p === 'L' ? '申请者更老 → 等待；更年轻 → 自己中止' : '申请者更老 → 抢锁，持有者中止；更年轻 → 等待', size: 14, color: C.mute });
        [['h2', 2], ['r1', 1], ['r2', 2]].forEach(function (a) { token(S, a[0] + p, a[1], AX(p, a[1]), AY + 40, 'T' + a[1] + ' · X'); });
      });
      S.text('ft1', { x: 430, y: 496, text: '时间戳越小 = 越老 = 优先级越高（ts=1、ts=2 为示意）', size: 15, color: C.mute });
      S.text('ft2', { x: 430, y: 524, text: '只需要每个事务的开始时间戳，不需要等待图', size: 14, color: C.mute });
      S.data({ '例子': '—', 'Wait-Die': '—', 'Wound-Wait': '—' });
      function hold(id, p, t) { S.pop(id, { delay: t }); S.move(id, CX[p], LY + 8, { delay: t + 300, dur: 650 }); S.ripple(CX[p], LY + 8, { delay: t + 950, color: C.green }); }
      function bump(id, p, th, t) { /* 申请者撞上锁，弹回到自己一侧 */
        var s = th === 1 ? -1 : 1;
        S.pop(id, { delay: t }); S.move(id, CX[p] + s * 62, LY - 30, { delay: t + 300, dur: 600 });
        S.ripple(CX[p] + s * 40, LY - 10, { delay: t + 900, color: C.red });
        S.move(id, AX(p, th), WY, { delay: t + 1000, dur: 450 });
      }
      function wait(id, t) { S.to(id, { fill: C.bg, color: C.amber, stroke: C.amber }, { delay: t, dur: 400 }); S.set(id, { dash: '4 3' }, { delay: t }); S.pulse(id, { delay: t }); }
      function die(id, t) { S.to(id, { fill: C.red, stroke: C.red }, { delay: t, dur: 250 }); S.to(id, { scale: .2, opacity: 0 }, { delay: t + 300, dur: 450, ease: 'in' }); }
      function res(p, txt, col, t) { S.set('rs' + p, { text: txt, color: col }, { delay: t }); S.pop('rs' + p, { delay: t }); }

      S.step('例 ①：T2（年轻）先拿到 A 的锁', function () {
        S.code([1, 2]); S.log('例①: T2 持有 A'); S.data({ '例子': '① T2 持有，T1（老）申请' });
        hold('h2L', 'L', 0); hold('h2R', 'R', 200);
      });
      S.step('T1（更老）也来申请这把锁 → 被占着。两种协议在这一刻就做出裁决', function () {
        S.code([1, 2]); S.log('T1: X-LOCK(A) 被 T2 占着', { kind: 'warn' });
        bump('r1L', 'L', 1, 0); bump('r1R', 'R', 1, 200);
        S.flash('h2L', C.red, { prop: 'stroke', delay: 900 }); S.flash('h2R', C.red, { prop: 'stroke', delay: 1100 });
      });
      S.step('Wait-Die：申请者 T1 更老 → 允许等待', function () {
        S.code([4, 5]); wait('r1L', 0); res('L', 'T1 等待', C.amber, 300);
        S.flash('acL1', C.amber, { prop: 'stroke', hold: 700 });
        S.data({ 'Wait-Die': '① T1 等待' }, { delay: 300 }); S.log('Wait-Die: T1 更老 → WAIT', { delay: 300 });
      });
      S.step('Wound-Wait：申请者 T1 更老 → 抢锁，持有者 T2 被中止', function () {
        S.code([9, 10]);
        S.to('h2R', { fill: C.red, stroke: C.red }, { dur: 250 }); S.to('h2R', { x: CX.R + 150, y: LY + 60, opacity: 0, scale: .4 }, { delay: 300, dur: 600, ease: 'in' });
        S.to('acR2', { stroke: C.red, color: C.red }, { delay: 300, dur: 300 }); S.set('acR2', { label: 'T2 · 被中止' }, { delay: 300 }); S.pulse('acR2', { delay: 300 });
        S.move('r1R', CX.R, LY + 8, { delay: 800, dur: 600 }); S.ripple(CX.R, LY + 8, { delay: 1400, color: C.green });
        res('R', 'T2 被中止，T1 拿到锁', C.red, 900);
        S.data({ 'Wound-Wait': '① T2 被中止' }, { delay: 900 }); S.log('Wound-Wait: T1 更老 → 杀 T2', { delay: 900, kind: 'err' });
      });
      S.step('例 ②：换成 T1（老）先持有 A 的锁，T2（年轻）来申请', function () {
        S.code([1, 2]); S.hide('rsL'); S.hide('rsR');
        S.to('h2L', { scale: .2, opacity: 0 }, { dur: 400, ease: 'in' });
        S.set('r1L', { dash: '' }, { delay: 300 }); S.to('r1L', { fill: C.blue, color: C.bg, stroke: C.blue, x: CX.L, y: LY + 8 }, { delay: 300, dur: 600 });
        S.set('acR2', { label: 'T2 · 年轻（ts=2）' }, { delay: 300 }); S.to('acR2', { stroke: C.purple, color: C.ink }, { delay: 300, dur: 300 });
        bump('r2L', 'L', 2, 1000); bump('r2R', 'R', 2, 1200);
        S.flash('r1L', C.red, { prop: 'stroke', delay: 1900 }); S.flash('r1R', C.red, { prop: 'stroke', delay: 2100 });
        S.data({ '例子': '② T1 持有，T2（年轻）申请' }, { delay: 300 }); S.log('例②: T1 持有 A，T2 来申请', { delay: 300 });
      });
      S.step('Wait-Die：申请者 T2 更年轻 → 自己中止（die）', function () {
        S.code(6); die('r2L', 0);
        S.to('acL2', { stroke: C.red, color: C.red }, { delay: 300, dur: 300 }); S.set('acL2', { label: 'T2 · 自己中止' }, { delay: 300 }); S.pulse('acL2', { delay: 300 });
        res('L', 'T2 自己中止', C.red, 400);
        S.data({ 'Wait-Die': '② T2 自己中止' }, { delay: 400 }); S.log('Wait-Die: T2 更年轻 → DIE', { delay: 400, kind: 'err' });
      });
      S.step('Wound-Wait：申请者 T2 更年轻 → 允许等待', function () {
        S.code(11); wait('r2R', 0); res('R', 'T2 等待', C.amber, 300);
        S.flash('acR2', C.amber, { prop: 'stroke', hold: 700 });
        S.data({ 'Wound-Wait': '② T2 等待' }, { delay: 300 }); S.log('Wound-Wait: T2 更年轻 → WAIT', { delay: 300 });
      });
      S.step('两种协议里，等待都只朝一个方向发生 → 等待图不可能成环，也就不会死锁', function () {
        S.code([13, 14]);
        S.to('dirL', { opacity: 1, draw: 1 }, { dur: 600 }); S.to('dirR', { opacity: 1, draw: 1 }, { delay: 400, dur: 600 });
        S.pulse('suL', { delay: 300, scale: 1.12 }); S.pulse('suR', { delay: 700, scale: 1.12 });
        S.flash('ft1', C.ink, { prop: 'color', delay: 1000, hold: 900 });
        S.set('ft2', { text: '被中止的事务重启时沿用最初的时间戳 → 迟早变成最老的，不会饿死', color: C.green }, { delay: 1200 }); S.pulse('ft2', { delay: 1200, scale: 1.04 });
        S.log('等待方向单一 ⇒ 无环 ⇒ 无死锁', { delay: 600, kind: 'ok' });
      });
    }
  }
  ]
});
})();
