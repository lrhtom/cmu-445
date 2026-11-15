/* #22 ARIES：正常中止与 CLR / 分析 / 重做 / 撤销
 * 「中止与 CLR」用的是讲义里那张表的数字；三阶段共用的那份日志是为演示编的示意数据。 */
(function () {
var C = Viz.C, Y0 = 66, P = 32, LX = 222, LW = 372;
function ry(i) { return Y0 + i * P; }
/* rows: [[lsn, txn, op], …]；第 hideFrom 行起先隐藏 */
function logRows(S, rows, hideFrom, title) {
  S.text('lgT', { x: 36, y: 28, text: title, anchor: 'start', size: 15, color: C.mute });
  rows.forEach(function (r, i) {
    var op = i >= hideFrom ? 0 : 1, y = ry(i), id = String(+r[0]);
    S.box('r' + id, { x: LX, y: y, w: LW, h: 27, rx: 6, fill: C.cell, stroke: 'none', sw: 0, opacity: op });
    S.text('a' + id, { x: 48, y: y, text: r[0], anchor: 'start', size: 14.5, color: C.purple, weight: 700, opacity: op });
    S.text('b' + id, { x: 92, y: y, text: r[1], anchor: 'start', size: 14.5, color: C.cyan, weight: 600, opacity: op });
    S.text('c' + id, { x: 128, y: y, text: r[2], anchor: 'start', size: 14.5, opacity: op });
  });
  S.box('cur', { x: LX, y: ry(0), w: LW + 10, h: 33, rx: 8, fill: 'none', stroke: C.blue, sw: 2.5, opacity: 0 });
}
function showRow(S, id, delay) {
  S.pop('r' + id, { delay: delay }); S.flash('r' + id, C.amber, { delay: delay + 100 });
  ['a', 'b', 'c'].forEach(function (p) { S.to(p + id, { opacity: 1 }, { delay: delay + 120, dur: 350 }); });
}
function goto(S, i, o) { S.to('cur', { y: ry(i) }, o || { dur: 500 }); }
function tbl(S, id, y, label, o) {
  var p = { x: 640, y: y, w: 380, h: 32, rx: 6, fill: C.panel, stroke: C.line, sw: 1.5, label: label, size: 15, weight: 500 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
function head(S, id, y, text) { S.text(id, { x: 450, y: y, text: text, anchor: 'start', size: 15, color: C.mute }); }
var LOG = [
  ['01', 'T1', 'BEGIN'], ['02', 'T1', 'UPDATE P1   A: 1 → 8'], ['03', 'T1', 'UPDATE P3   C: 0 → 3'], ['04', 'T2', 'BEGIN'],
  ['05', 'T2', 'UPDATE P2   B: 2 → 9'], ['06', '', 'CHECKPOINT-BEGIN'], ['07', '', 'CHECKPOINT-END {ATT, DPT}'],
  ['08', 'T1', 'COMMIT'], ['09', 'T1', 'TXN-END'], ['10', 'T2', 'UPDATE P3   C: 3 → 7']
];
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #22 Database Recovery（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/22-recovery.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #22 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/22-recovery.pdf' }
];

Viz.register('aries', {
  title: 'ARIES：CLR 与恢复三阶段',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：正常中止与 CLR ───────────── */
  {
    name: '中止与 CLR',
    moving: '游标沿 prevLSN / undoNext 往回跳；旧值从日志飞回页里、数字滚动；每撤销一条就在日志末尾弹出一条 CLR；锁图标最后才消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Txn::Abort() {',
      '  log.Append({ABORT, txn});',
      '  lsn = txn.lastLSN;',
      '  while (log.Read(lsn).type != BEGIN) {',
      '    rec = log.Read(lsn);',
      '    page->Set(rec.obj, rec.before); // 改回旧值',
      '    log.Append(CLR{rec, undoNext: rec.prevLSN});',
      '    lsn = rec.prevLSN;',
      '  }',
      '  log.Append({TXN_END, txn});',
      '  lock_mgr.ReleaseAll(txn);         // 最后才放锁',
      '}'
    ].join('\n'),
    build: function (S) {
      logRows(S, [
        ['001', 'T1', 'BEGIN'], ['002', 'T1', 'UPDATE A: 30 → 40'], ['003', 'T1', 'UPDATE B: 3 → 4'], ['004', 'T1', 'ABORT'],
        ['005', 'T1', 'CLR B: 4 → 3   undoNext 002'], ['006', 'T1', 'CLR A: 40 → 30  undoNext 001'], ['007', 'T1', 'TXN-END']
      ], 3, '预写日志（时间向下；数字取自讲义的例子）');
      head(S, 'pgT', 100, '页里的数据');
      S.box('pA', { x: 545, y: 170, w: 170, h: 80, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
      S.box('pB', { x: 745, y: 170, w: 170, h: 80, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('vA', { x: 545, y: 170, val: 40, pre: 'A = ', size: 24, weight: 700 }); S.text('vB', { x: 745, y: 170, val: 4, pre: 'B = ', size: 24, weight: 700 });
      S.text('lkA', { x: 545, y: 236, text: '🔒 T1 持有写锁', size: 15, color: C.amber }); S.text('lkB', { x: 745, y: 236, text: '🔒 T1 持有写锁', size: 15, color: C.amber });
      head(S, 'chT', 300, 'prevLSN：把同一事务的记录串成反向链表');
      S.path('p32', { d: 'M408,' + ry(2) + ' C436,' + ry(2) + ' 436,' + ry(1) + ' 412,' + ry(1), stroke: C.purple, sw: 2, dash: '', opacity: 0, draw: 0 });
      S.path('p21', { d: 'M408,' + ry(1) + ' C436,' + ry(1) + ' 436,' + ry(0) + ' 412,' + ry(0), stroke: C.purple, sw: 2, opacity: 0, draw: 0 });
      S.data({ A: 40, B: 4, 'T1 状态': '运行中', 'T1.lastLSN': '003' });

      S.step('T1 已经把 A 改成 40、B 改成 4。应用发来 ABORT → 先追加一条 ABORT 记录', function () {
        S.code([1, 2]); S.log('T1: ABORT');
        showRow(S, '4', 200); S.set('cur', { y: ry(3) }); S.pop('cur', { delay: 500 });
        S.data({ 'T1 状态': '回滚中', 'T1.lastLSN': '004' }, { delay: 300 });
      });
      S.step('沿 prevLSN 往回跳到 T1 最近的一次修改：LSN 003', function () {
        S.code([3, 5]);
        goto(S, 2, { dur: 650 }); S.pulse('r3', { delay: 650, scale: 1.04 }); S.flash('r3', C.blue, { delay: 650 });
      });
      S.step('撤销它：B 从 4 改回 3；并追加 CLR（LSN 005）—— before/after 对调，undoNext 指向 002', function () {
        S.code(6);
        S.fly([300, ry(2)], 'pB', { label: '旧值 3', w: 70, h: 30, color: C.green, dur: 850 });
        S.count('vB', 3, { delay: 850 }); S.pulse('pB', { delay: 850, scale: 1.06 }); S.flash('pB', C.green, { prop: 'stroke', delay: 850 });
        S.code(7, { delay: 1100 }); showRow(S, '5', 1200);
        S.data({ B: 3 }, { delay: 850 }); S.data({ 'T1.lastLSN': '005' }, { delay: 1300 }); S.log('CLR 005：B 4 → 3', { delay: 1300 });
      });
      S.step('沿 undoNext 继续往回：下一条要撤销的是 LSN 002', function () {
        S.code(8);
        S.to('p32', { opacity: 1, draw: 1 }, { dur: 600 });
        goto(S, 1, { delay: 300, dur: 650 }); S.flash('r2', C.blue, { delay: 950 });
      });
      S.step('撤销：A 从 40 改回 30；追加 CLR（LSN 006），undoNext 指向 001', function () {
        S.code(6);
        S.fly([300, ry(1)], 'pA', { label: '旧值 30', w: 76, h: 30, color: C.green, dur: 850 });
        S.count('vA', 30, { delay: 850 }); S.pulse('pA', { delay: 850, scale: 1.06 }); S.flash('pA', C.green, { prop: 'stroke', delay: 850 });
        S.code(7, { delay: 1100 }); showRow(S, '6', 1200);
        S.data({ A: 30 }, { delay: 850 }); S.data({ 'T1.lastLSN': '006' }, { delay: 1300 }); S.log('CLR 006：A 40 → 30', { delay: 1300 });
      });
      S.step('undoNext 指到了 BEGIN → 没有可撤销的了，追加 TXN-END（LSN 007）', function () {
        S.code(8); S.code(10, { delay: 900 });
        S.to('p21', { opacity: 1, draw: 1 }, { dur: 600 }); goto(S, 0, { delay: 300, dur: 650 });
        showRow(S, '7', 1100);
        S.data({ 'T1 状态': '已中止', 'T1.lastLSN': '007' }, { delay: 1200 }); S.log('TXN-END：回滚完成', { delay: 1250, kind: 'ok' });
      });
      S.step('TXN-END 之后才释放全部锁 —— 回滚期间放锁，别人的写会被我“改回旧值”覆盖掉', function () {
        S.code(11); S.hide('cur');
        S.to('lkA', { opacity: 0, y: 256 }, { dur: 600, delay: 200 }); S.to('lkB', { opacity: 0, y: 256 }, { dur: 600, delay: 450 });
        S.flash('pA', C.green, { prop: 'stroke', delay: 800 }); S.flash('pB', C.green, { prop: 'stroke', delay: 1000 });
        S.log('释放 T1 的全部锁', { delay: 700, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 2：分析 ───────────── */
  {
    name: '① 分析',
    moving: '读 MasterRecord 的信号飞到检查点记录；扫描游标逐条向下；ATT / DPT 的表项从日志飞出来落位，被删的表项缩小消失、下面的顶上来',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'lsn = MasterRecord;       // 最近检查点的 BEGIN',
      'for (rec : log.ScanFrom(lsn)) {',
      '  if (rec.type == CKPT_END) { ATT = rec.att; DPT = rec.dpt; }',
      '  if (rec.type == TXN_END) { ATT.erase(rec.txn); continue; }',
      '  if (rec.txn && !ATT.has(rec.txn))',
      '    ATT[rec.txn].status = UNDO;   // 默认要回滚',
      '  if (rec.type == COMMIT) ATT[rec.txn].status = COMMIT;',
      '  if (rec.txn) ATT[rec.txn].lastLSN = rec.lsn;',
      '  if (rec.IsUpdate() && !DPT.has(rec.page))',
      '    DPT[rec.page].recLSN = rec.lsn;',
      '}'
    ].join('\n'),
    build: function (S) {
      logRows(S, LOG, 99, '预写日志（磁盘上；示意数据）');
      S.text('boom', { x: LX, y: ry(10) + 4, text: '💥 崩溃', color: C.red, size: 20, weight: 800, opacity: 0 });
      tbl(S, 'mr', 66, 'MasterRecord = 6（磁盘上）', { stroke: C.purple, w: 300 });
      head(S, 'attT', 128, 'ATT 活跃事务表（内存，重启后是空的）');
      tbl(S, 'att1', 162, 'T1 · 待撤销 · lastLSN 3', { opacity: 0 }); tbl(S, 'att2', 198, 'T2 · 待撤销 · lastLSN 5', { opacity: 0 });
      head(S, 'dptT', 268, 'DPT 脏页表（内存，重启后是空的）');
      tbl(S, 'dpt1', 302, 'P1 · recLSN 2', { opacity: 0 }); tbl(S, 'dpt2', 338, 'P2 · recLSN 5', { opacity: 0 }); tbl(S, 'dpt3', 374, 'P3 · recLSN 10', { opacity: 0 });
      S.data({ '扫描位置': '—', ATT: '{}', DPT: '{}' });

      S.step('崩溃：内存里的 ATT、DPT、缓冲池全丢了，只剩磁盘上的日志和数据页', function () {
        S.pop('boom'); S.log('CRASH → 重启', { kind: 'err' });
        S.flash('attT', C.red, { prop: 'color', delay: 300 }); S.flash('dptT', C.red, { prop: 'color', delay: 500 });
      });
      S.step('先读磁盘上的 MasterRecord：它指向最近一次检查点的 CHECKPOINT-BEGIN（LSN 6）', function () {
        S.code(1); S.pulse('mr');
        S.fly('mr', [408, ry(5)], { color: C.purple, delay: 300, dur: 800 });
        S.set('cur', { y: ry(5) }); S.pop('cur', { delay: 1100 });
        S.data({ '扫描位置': 'LSN 6' }, { delay: 1100 }); S.log('从 LSN 6 开始向后扫', { delay: 1150 });
      });
      S.step('CHECKPOINT-END 里存着检查点开始那一刻的 ATT 和 DPT → 装进内存；默认所有事务都要回滚', function () {
        S.code([2, 3]); goto(S, 6);
        [['att1', 162], ['att2', 198], ['dpt1', 302], ['dpt2', 338]].forEach(function (a, i) {
          S.fly([408, ry(6)], [640, a[1]], { color: C.cyan, delay: 550 + i * 180, dur: 700 });
          S.pop(a[0], { delay: 1250 + i * 180 });
        });
        S.data({ '扫描位置': 'LSN 7', ATT: 'T1:待撤销, T2:待撤销', DPT: 'P1:2, P2:5' }, { delay: 1800 });
      });
      S.step('LSN 8 是 T1 的 COMMIT → 把 T1 的状态改成「提交中」', function () {
        S.code(7); goto(S, 7);
        S.fly([408, ry(7)], 'att1', { color: C.green, delay: 500, dur: 700 });
        S.set('att1', { label: 'T1 · 提交中 · lastLSN 8' }, { delay: 1200 }); S.to('att1', { stroke: C.green }, { delay: 1200, dur: 300 }); S.pulse('att1', { delay: 1200, scale: 1.05 });
        S.data({ '扫描位置': 'LSN 8', ATT: 'T1:提交中, T2:待撤销' }, { delay: 1200 });
      });
      S.step('LSN 9 是 T1 的 TXN-END → T1 彻底完结，从 ATT 里删掉', function () {
        S.code(4); goto(S, 8);
        S.to('att1', { scale: .2, opacity: 0 }, { delay: 600, dur: 500, ease: 'in' });
        S.move('att2', 640, 162, { delay: 1000, dur: 600 });
        S.data({ '扫描位置': 'LSN 9', ATT: 'T2:待撤销' }, { delay: 1100 }); S.log('T1 已完结，移出 ATT', { delay: 1100 });
      });
      S.step('LSN 10：T2 改了 P3，而 P3 不在 DPT 里 → 加进去，recLSN = 10；T2 的 lastLSN 也更新成 10', function () {
        S.code([8, 10]); goto(S, 9);
        S.fly([408, ry(9)], [640, 374], { color: C.amber, delay: 500, dur: 700 }); S.pop('dpt3', { delay: 1200 });
        S.fly([408, ry(9)], 'att2', { color: C.cyan, delay: 800, dur: 700 });
        S.set('att2', { label: 'T2 · 待撤销 · lastLSN 10' }, { delay: 1500 }); S.pulse('att2', { delay: 1500, scale: 1.05 });
        S.data({ '扫描位置': 'LSN 10', ATT: 'T2:待撤销(lastLSN 10)', DPT: 'P1:2, P2:5, P3:10' }, { delay: 1500 });
      });
      S.step('扫到日志末尾。结论：T2 崩溃时还活着，要回滚；P1、P2、P3 可能没落盘，要去检查', function () {
        S.code(11); S.hide('cur');
        S.to('att2', { stroke: C.red }, { dur: 400 }); S.pulse('att2', { scale: 1.05 });
        ['dpt1', 'dpt2', 'dpt3'].forEach(function (id, i) { S.to(id, { stroke: C.amber }, { delay: 500 + i * 200, dur: 350 }); S.pulse(id, { delay: 500 + i * 200, scale: 1.04 }); });
        S.log('分析结束：ATT 1 项，DPT 3 项', { delay: 600, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 3：重做 ───────────── */
  {
    name: '② 重做',
    moving: '扫描游标逐条向下；探针从日志飞到 DPT 和磁盘页去比较 LSN；需要重做时新值飞进页里、pageLSN 更新；每条记录旁弹出「重做 / 跳过」',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'for (rec : log.ScanFrom(DPT.MinRecLSN())) {',
      '  if (!rec.IsUpdateOrCLR()) continue;',
      '  if (!DPT.has(rec.page)) continue;      // ① 已刷盘',
      '  if (DPT[rec.page].recLSN > rec.lsn)',
      '    continue;                            // ② 已在盘上',
      '  Page* p = buffer_pool.Fetch(rec.page); // 必须读盘',
      '  if (p->pageLSN >= rec.lsn) continue;   // ③ 已应用',
      '  p->Apply(rec.after);                   // 重做',
      '  p->pageLSN = rec.lsn;  // 不写新日志、不 fsync',
      '}'
    ].join('\n'),
    build: function (S) {
      logRows(S, LOG, 99, '预写日志（磁盘上；示意数据）');
      head(S, 'dptT', 40, 'DPT 脏页表（分析阶段的产出）');
      tbl(S, 'dpt1', 74, 'P1 · recLSN 2'); tbl(S, 'dpt2', 110, 'P2 · recLSN 5'); tbl(S, 'dpt3', 146, 'P3 · recLSN 10');
      head(S, 'pgT', 216, '磁盘上的页（崩溃时留下的样子）');
      tbl(S, 'pg1', 254, 'P1    A = 1    pageLSN 0', { h: 42, size: 16 }); tbl(S, 'pg2', 306, 'P2    B = 9    pageLSN 5', { h: 42, size: 16 });
      tbl(S, 'pg3', 358, 'P3    C = 3    pageLSN 3', { h: 42, size: 16 });
      [[2, 1], [3, 2], [5, 4], [10, 9]].forEach(function (a) { S.text('g' + a[0], { x: 400, y: ry(a[1]), text: '', anchor: 'end', size: 14, weight: 700, opacity: 0 }); });
      S.text('nR', { x: 450, y: 430, anchor: 'start', val: 0, pre: '读盘次数：', color: C.amber, size: 16 });
      S.data({ '当前 LSN': '—', '重做': 0, '跳过': 0, '读盘次数': 0 });
      function verdict(lsn, redo, delay) {
        S.set('g' + lsn, { text: redo ? '重做' : '跳过', color: redo ? C.green : C.mute }, { delay: delay }); S.pop('g' + lsn, { delay: delay });
      }

      S.step('起点 = DPT 里最小的 recLSN，也就是 LSN 2：比它更早的改动一定已经在盘上了', function () {
        S.code(1);
        S.flash('dpt1', C.amber); S.pulse('dpt1', { scale: 1.04 });
        S.fly('dpt1', [408, ry(1)], { color: C.amber, delay: 400, dur: 800 });
        S.set('cur', { y: ry(1) }); S.pop('cur', { delay: 1200 });
        S.data({ '当前 LSN': 2 }, { delay: 1200 });
      });
      S.step('LSN 2 改 P1：P1 在 DPT 里且 recLSN 2 ≤ 2 → 只能读盘看 pageLSN：0 < 2，没应用过 → 重做', function () {
        S.code([3, 5]);
        S.fly([408, ry(1)], 'dpt1', { color: C.blue, dur: 600 }); S.flash('dpt1', C.blue, { delay: 600 });
        S.code([6, 7], { delay: 900 });
        S.fly([408, ry(1)], 'pg1', { color: C.blue, delay: 900, dur: 700 }); S.flash('pg1', C.red, { delay: 1600 });
        S.count('nR', 1, { delay: 1600 });
        S.code([8, 9], { delay: 2100 });
        S.fly([300, ry(1)], 'pg1', { label: 'A = 8', w: 70, h: 30, color: C.green, delay: 2100, dur: 750 });
        S.set('pg1', { label: 'P1    A = 8    pageLSN 2' }, { delay: 2850 }); S.to('pg1', { stroke: C.green }, { delay: 2850, dur: 300 }); S.pulse('pg1', { delay: 2850, scale: 1.04 });
        verdict(2, true, 2900);
        S.data({ '重做': 1, '读盘次数': 1 }, { delay: 2900 }); S.log('LSN 2 → 重做 P1', { delay: 2900, kind: 'ok' });
      });
      S.step('LSN 3 改 P3：P3 在 DPT 里，但 recLSN 10 > 3 → 这次改动在 P3 上次刷盘前就有了，跳过，连盘都不用读', function () {
        S.code([4, 5]); goto(S, 2);
        S.fly([408, ry(2)], 'dpt3', { color: C.blue, delay: 500, dur: 700 }); S.flash('dpt3', C.amber, { delay: 1200 }); S.pulse('dpt3', { delay: 1200, scale: 1.04 });
        verdict(3, false, 1500);
        S.data({ '当前 LSN': 3, '跳过': 1 }, { delay: 1500 }); S.log('LSN 3 → 跳过（recLSN 10 > 3）', { delay: 1500 });
      });
      S.step('LSN 4 是 BEGIN，不改页，扫过。LSN 5 改 P2：recLSN 5 ≤ 5 → 读盘：pageLSN 5 ≥ 5，已经应用过 → 跳过', function () {
        S.code(2); goto(S, 3, { dur: 400 }); goto(S, 4, { delay: 600, dur: 400 });
        S.code([3, 5], { delay: 1000 });
        S.fly([408, ry(4)], 'dpt2', { color: C.blue, delay: 1000, dur: 600 }); S.flash('dpt2', C.blue, { delay: 1600 });
        S.code([6, 7], { delay: 1800 });
        S.fly([408, ry(4)], 'pg2', { color: C.blue, delay: 1800, dur: 700 }); S.flash('pg2', C.green, { delay: 2500 }); S.pulse('pg2', { delay: 2500, scale: 1.04 });
        S.count('nR', 2, { delay: 2500 }); verdict(5, false, 2700);
        S.data({ '当前 LSN': 5, '跳过': 2, '读盘次数': 2 }, { delay: 2700 }); S.log('LSN 5 → 跳过（pageLSN 5 ≥ 5）', { delay: 2700 });
      });
      S.step('LSN 6–9 是检查点、COMMIT、TXN-END，都不改页 → 直接扫过', function () {
        S.code(2);
        [5, 6, 7, 8].forEach(function (i, k) { goto(S, i, { delay: k * 450, dur: 380 }); });
        S.data({ '当前 LSN': 9 }, { delay: 1700 });
      });
      S.step('LSN 10 改 P3：recLSN 10 ≤ 10 → 读盘：pageLSN 3 < 10 → 重做，C 变成 7，pageLSN 记成 10', function () {
        S.code([3, 5]); goto(S, 9);
        S.fly([408, ry(9)], 'dpt3', { color: C.blue, delay: 500, dur: 600 }); S.flash('dpt3', C.blue, { delay: 1100 });
        S.code([6, 7], { delay: 1300 });
        S.fly([408, ry(9)], 'pg3', { color: C.blue, delay: 1300, dur: 700 }); S.flash('pg3', C.red, { delay: 2000 });
        S.count('nR', 3, { delay: 2000 });
        S.code([8, 9], { delay: 2400 });
        S.fly([300, ry(9)], 'pg3', { label: 'C = 7', w: 70, h: 30, color: C.green, delay: 2400, dur: 750 });
        S.set('pg3', { label: 'P3    C = 7    pageLSN 10' }, { delay: 3150 }); S.to('pg3', { stroke: C.green }, { delay: 3150, dur: 300 }); S.pulse('pg3', { delay: 3150, scale: 1.04 });
        verdict(10, true, 3200);
        S.data({ '当前 LSN': 10, '重做': 2, '读盘次数': 3 }, { delay: 3200 }); S.log('LSN 10 → 重做 P3', { delay: 3200, kind: 'ok' });
      });
      S.step('重做结束：页的内容和崩溃那一刻完全一样 —— 包括 T2 还没提交的改动。这就是「重放历史」', function () {
        S.code(10); S.hide('cur');
        ['pg1', 'pg2', 'pg3'].forEach(function (id, i) { S.flash(id, C.green, { delay: i * 220 }); });
        S.log('重做期间不写新日志、不 fsync', { delay: 500 });
      });
    }
  },

  /* ───────────── 场景 4：撤销 ───────────── */
  {
    name: '③ 撤销',
    moving: '游标从 lastLSN 出发沿 prevLSN 弧线往回跳；旧值从日志飞回页里；每撤销一条就在日志末尾弹出一条 CLR；最后事务从 ATT 消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'for (txn : ATT where status == UNDO) {',
      '  lsn = txn.lastLSN;',
      '  while (lsn != nil) {',
      '    rec = log.Read(lsn);',
      '    if (rec.IsUpdate()) {',
      '      page->Apply(rec.before);       // 撤销',
      '      log.Append(CLR{rec, undoNext: rec.prevLSN});',
      '    }',
      '    lsn = rec.IsCLR() ? rec.undoNext : rec.prevLSN;',
      '  }',
      '  log.Append(TXN_END{txn});',
      '  ATT.erase(txn);',
      '}'
    ].join('\n'),
    build: function (S) {
      logRows(S, LOG.concat([['11', 'T2', 'CLR P3  C: 7 → 3   undoNext 5'], ['12', 'T2', 'CLR P2  B: 9 → 2   undoNext 4'], ['13', 'T2', 'TXN-END']]), 10, '预写日志（示意数据）');
      head(S, 'attT', 40, 'ATT 活跃事务表（分析阶段的产出）');
      tbl(S, 'att2', 74, 'T2 · 待撤销 · lastLSN 10', { stroke: C.red });
      head(S, 'pgT', 150, '缓冲池里的页（重做之后）');
      tbl(S, 'pg1', 188, 'P1    A = 8', { h: 42, size: 16 }); tbl(S, 'pg2', 240, 'P2    B = 9', { h: 42, size: 16 }); tbl(S, 'pg3', 292, 'P3    C = 7', { h: 42, size: 16 });
      S.text('own1', { x: 450, y: 344, text: 'A 是已提交的 T1 写的；B、C 是没提交的 T2 写的', anchor: 'start', size: 14, color: C.mute });
      S.path('p105', { d: 'M412,' + ry(9) + ' C442,' + ry(9) + ' 442,' + ry(4) + ' 414,' + ry(4), stroke: C.purple, sw: 2, opacity: 0, draw: 0 });
      S.path('p54', { d: 'M412,' + ry(4) + ' C436,' + ry(4) + ' 436,' + ry(3) + ' 414,' + ry(3), stroke: C.purple, sw: 2, opacity: 0, draw: 0 });
      S.data({ '要回滚': 'T2', '当前 LSN': '—', 'P2': 'B = 9', 'P3': 'C = 7' });

      S.step('ATT 里只剩 T2，状态是待撤销。用它的 lastLSN 直接跳到它的最后一条记录：LSN 10', function () {
        S.code([1, 2]); S.pulse('att2', { scale: 1.05 });
        S.fly('att2', [408, ry(9)], { color: C.red, delay: 300, dur: 800 });
        S.set('cur', { y: ry(9) }); S.pop('cur', { delay: 1100 });
        S.data({ '当前 LSN': 10 }, { delay: 1100 });
      }, { hold: 1700 });
      S.step('撤销 LSN 10：C 从 7 改回 3；并在日志末尾追加 CLR（LSN 11），undoNext 指向 5', function () {
        S.code([4, 6]);
        S.fly([300, ry(9)], 'pg3', { label: '旧值 3', w: 70, h: 30, color: C.green, dur: 850 });
        S.set('pg3', { label: 'P3    C = 3' }, { delay: 850 }); S.flash('pg3', C.green, { delay: 850 }); S.pulse('pg3', { delay: 850, scale: 1.04 });
        S.code(7, { delay: 1100 }); showRow(S, '11', 1200);
        S.data({ 'P3': 'C = 3' }, { delay: 850 }); S.log('CLR 11：C 7 → 3', { delay: 1300 });
      });
      S.step('沿 prevLSN 往回跳到 T2 的上一条记录：LSN 5（中间别的事务的记录全部跳过）', function () {
        S.code(9);
        S.to('p105', { opacity: 1, draw: 1 }, { dur: 700 });
        goto(S, 4, { delay: 300, dur: 800 }); S.flash('r5', C.blue, { delay: 1100 });
        S.data({ '当前 LSN': 5 }, { delay: 1100 });
      });
      S.step('撤销 LSN 5：B 从 9 改回 2；追加 CLR（LSN 12），undoNext 指向 4', function () {
        S.code([4, 6]);
        S.fly([300, ry(4)], 'pg2', { label: '旧值 2', w: 70, h: 30, color: C.green, dur: 850 });
        S.set('pg2', { label: 'P2    B = 2' }, { delay: 850 }); S.flash('pg2', C.green, { delay: 850 }); S.pulse('pg2', { delay: 850, scale: 1.04 });
        S.code(7, { delay: 1100 }); showRow(S, '12', 1200);
        S.data({ 'P2': 'B = 2' }, { delay: 850 }); S.log('CLR 12：B 9 → 2', { delay: 1300 });
      });
      S.step('再往回就是 T2 的 BEGIN（LSN 4）→ 回滚完成：追加 TXN-END（LSN 13），T2 从 ATT 里删掉', function () {
        S.code(9); S.code([11, 12], { delay: 900 });
        S.to('p54', { opacity: 1, draw: 1 }, { dur: 500 }); goto(S, 3, { delay: 250, dur: 600 });
        showRow(S, '13', 1000);
        S.to('att2', { scale: .2, opacity: 0 }, { delay: 1400, dur: 500, ease: 'in' });
        S.data({ '要回滚': '（无）', '当前 LSN': 4 }, { delay: 1400 }); S.log('TXN-END 13：T2 回滚完成', { delay: 1300, kind: 'ok' });
      });
      S.step('恢复完毕：已提交的 T1 的改动还在（A = 8），没提交的 T2 的改动全部撤销 → 可以接受新事务了', function () {
        S.hide('cur');
        S.to('pg1', { stroke: C.green }, { dur: 400 }); S.pulse('pg1', { scale: 1.04 });
        S.flash('pg2', C.green, { delay: 400 }); S.flash('pg3', C.green, { delay: 650 });
        S.log('恢复完成，开始接受新事务', { delay: 700, kind: 'ok' });
      }, { hold: 2200 });
    }
  }
  ]
});
})();
