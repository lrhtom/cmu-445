/* HW6 恢复：检查点快照与盘上可能的值 / 分析阶段 / 重做的三类判断 / 撤销与 CLR 计数
 * 整段日志（LSN 10–31、对象 P/Q/R/S 的取值）是讲义第 2.2 节自编的示意数据。 */
(function () {
var C = Viz.C, ROWF = '#1e2b4a';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #6（题目 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw6-clean.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Homework #6（官方答案 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw6-sols.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #22 Database Recovery（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/22-recovery.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #22 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/22-recovery.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #21 Database Logging（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/21-logging.pdf' }
];
var TC = { T1: C.blue, T2: C.purple, T3: C.amber, T4: C.green, '': C.mute };
function note(S, t) { S.text('note', { x: 20, y: 24, text: t, anchor: 'start', size: 14, color: C.mute }); }
function title(S, id, x, y, text, o) {
  var p = { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}
/* 日志行：[LSN, 事务, 内容] */
function logRows(S, rows, y0, dy, x0, w, op) {
  rows.forEach(function (r, i) {
    var y = y0 + i * dy, o = op == null ? 1 : op;
    S.box('r' + r[0], { x: x0 + w / 2, y: y, w: w, h: dy - 8, rx: 6, fill: ROWF, stroke: 'none', sw: 0, opacity: o });
    S.text('a' + r[0], { x: x0 + 10, y: y, text: String(r[0]), anchor: 'start', size: 15, weight: 700, color: C.purple, opacity: o });
    S.text('b' + r[0], { x: x0 + 52, y: y, text: r[1], anchor: 'start', size: 15, weight: 700, color: TC[r[1]], opacity: o });
    S.text('c' + r[0], { x: x0 + 92, y: y, text: r[2], anchor: 'start', size: 15, opacity: o });
  });
}
function showRow(S, l, d) { S.pop('r' + l, { delay: d }); ['a', 'b', 'c'].forEach(function (p) { S.to(p + l, { opacity: 1 }, { delay: d + 100, dur: 300 }); }); }
function chip(S, id, x, y, label, col, o) {
  var p = { x: x, y: y, w: 58, h: 30, rx: 6, fill: col || C.cell, stroke: 'none', sw: 0, label: label, color: C.bg, size: 15, opacity: 0 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
var LOG1 = [[10, 'T1', 'BEGIN'], [11, 'T2', 'BEGIN'], [12, 'T1', 'UPDATE P 5→6'], [13, 'T2', 'UPDATE Q 1→2'], [14, 'T2', 'COMMIT'],
            [15, '', 'CHECKPOINT-BEGIN'], [16, 'T3', 'BEGIN'], [17, 'T3', 'UPDATE R 0→1'], [18, 'T1', 'UPDATE S 7→8'], [19, '', 'CHECKPOINT-END']];
var LOG2 = [[23, '', 'CHECKPOINT-BEGIN'], [24, 'T4', 'BEGIN'], [25, 'T4', 'UPDATE Q 2→3'], [26, '', 'CHECKPOINT-END (ATT, DPT=∅)'], [27, 'T1', 'TXN-END'],
            [28, 'T3', 'UPDATE R 2→4'], [29, 'T4', 'UPDATE P 6→0'], [30, 'T4', 'ABORT'], [31, 'T4', 'CLR P 0→6  undoNext 25']];

Viz.register('hw6-aries', {
  title: 'HW6：ARIES 日志分析 —— 快照 · 分析 · 重做 · 撤销',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：检查点快照与盘上可能的值 ───────────── */
  {
    name: '检查点快照：盘上可能是什么',
    moving: '扫描框沿日志下移；每一页「可能的值」随之增删（新值弹出、被排除的值变红缩小）；BEGIN 时刻的 ATT / DPT 快照弹出，再整体飞进 CHECKPOINT-END 那一行；崩溃标记出现后各页闪烁',
    lang: '推理规则',
    code: [
      '① END 里的 ATT/DPT = BEGIN 那一刻的快照',
      '② 不在 DPT ⇒ BEGIN 时干净',
      '   ⇒ 之前的修改都已落盘',
      '③ 后台线程随时刷脏页',
      '   ⇒ 脏页的新旧值都有可能在盘上',
      '④ TXN-END 才把事务移出 ATT',
      '',
      '在 19 之后崩溃：',
      '  P：不在 DPT，15 后没再改 → 只能是 6',
      '  Q：在 DPT → 1 或 2',
      '  R：BEGIN 后才改 → 0 或 1',
      '  S：BEGIN 后才改 → 7 或 8',
      '  ATT = {T1, T2}（T3 在 BEGIN 后才开始）'
    ].join('\n'),
    build: function (S) {
      var Y0 = 76, DY = 40, PG = { P: [5, 6], Q: [1, 2], R: [0, 1], S: [7, 8] }, PY = { P: 104, Q: 184, R: 264, S: 344 };
      note(S, '日志为示意');
      logRows(S, LOG1, Y0, DY, 24, 400, 0);
      S.box('cur', { x: 224, y: Y0, w: 410, h: 38, rx: 8, fill: 'none', stroke: C.blue, sw: 2.5, opacity: 0 });
      title(S, 'tP', 470, 62, '磁盘上每页可能的值');
      ['P', 'Q', 'R', 'S'].forEach(function (p) {
        S.box('pg' + p, { x: 660, y: PY[p], w: 360, h: 58, rx: 10, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('pn' + p, { x: 498, y: PY[p], text: '页 ' + p, anchor: 'start', size: 16, weight: 700 });
        chip(S, 'v' + p + '0', 610, PY[p], String(PG[p][0]), C.cyan, { opacity: 1 });
        chip(S, 'v' + p + '1', 680, PY[p], String(PG[p][1]), C.cyan);
      });
      S.box('snap', { x: 660, y: 456, w: 360, h: 84, rx: 10, fill: C.panel, stroke: C.purple, sw: 2, dash: '6 4', opacity: 0 });
      S.text('snT', { x: 492, y: 430, text: 'BEGIN 时刻的快照', anchor: 'start', size: 14, color: C.purple, opacity: 0 });
      S.text('snA', { x: 492, y: 458, text: 'ATT：', anchor: 'start', size: 15, opacity: 0 });
      S.text('snD', { x: 492, y: 488, text: 'DPT：', anchor: 'start', size: 15, opacity: 0 });
      chip(S, 'sT1', 580, 458, 'T1', C.blue); chip(S, 'sT2', 646, 458, 'T2', C.purple); chip(S, 'sQ', 580, 488, 'Q', C.amber);
      chip(S, 'sT3', 760, 458, 'T3', C.amber, { fill: C.cell, color: C.mute });
      S.text('boom', { x: 224, y: 488, text: '💥 在 19 之后崩溃', size: 20, weight: 800, color: C.red, opacity: 0 });
      S.data({ '扫描到': '—' });
      function addV(p, d) { S.pop('v' + p + '1', { delay: d }); S.ripple(680, PY[p], { delay: d, color: C.cyan }); }

      S.step('数据库从干净状态开始，后台线程随时可能刷脏页；先看 LSN 10–14', function () {
        S.code([3, 5]);
        [10, 11, 12, 13, 14].forEach(function (l, i) { showRow(S, l, i * 180); });
        S.pop('cur', { delay: 900 });
      });
      S.step('12、13：P、Q 被改 —— 新值还在内存里，盘上可能是旧值也可能已被刷成新值', function () {
        S.code([4, 5]);
        S.move('cur', 224, Y0 + 2 * DY, { dur: 400 }); addV('P', 400);
        S.move('cur', 224, Y0 + 3 * DY, { delay: 800, dur: 400 }); addV('Q', 1200);
        S.data({ '扫描到': 13, P: '{5, 6}', Q: '{1, 2}' }, { delay: 1300 });
      });
      S.step('15 CHECKPOINT-BEGIN：拍下这一刻 —— 活跃事务 T1、T2（T2 已提交但还没 TXN-END）；脏页只有 Q', function () {
        S.code([1, 6]); showRow(S, 15, 0);
        S.move('cur', 224, Y0 + 5 * DY, { delay: 100, dur: 400 });
        S.pop('snap', { delay: 400 }); ['snT', 'snA', 'snD'].forEach(function (id) { S.to(id, { opacity: 1 }, { delay: 500, dur: 300 }); });
        S.pop('sT1', { delay: 700 }); S.pop('sT2', { delay: 850 }); S.pop('sQ', { delay: 1000 });
      });
      S.step('P 不在这个快照的 DPT 里 → 15 那一刻 P 已经干净 → 12 的修改已经落盘，P 不可能还是 5', function () {
        S.code([2, 3]);
        S.flash('pgP', C.green, { prop: 'stroke' });
        S.to('vP0', { fill: C.red }, { delay: 300, dur: 250 }); S.to('vP0', { scale: .3, opacity: 0 }, { delay: 700, dur: 400, ease: 'in' });
        S.move('vP1', 610, PY.P, { delay: 1100, dur: 500 });
        S.data({ P: '{6}' }, { delay: 1100 }); S.log('P 只能是 6', { delay: 1100, kind: 'ok' });
      });
      S.step('16–18：T3 开始；R、S 被改 —— 它们在 BEGIN 之后才变脏，所以不会出现在这个快照里', function () {
        S.code([10, 11]);
        [16, 17, 18].forEach(function (l, i) { showRow(S, l, i * 200); });
        S.move('cur', 224, Y0 + 7 * DY, { delay: 300, dur: 400 }); addV('R', 700);
        S.move('cur', 224, Y0 + 8 * DY, { delay: 1000, dur: 400 }); addV('S', 1400);
        S.pop('sT3', { delay: 500 });
        S.data({ R: '{0, 1}', S: '{7, 8}' }, { delay: 1500 });
      });
      S.step('19 CHECKPOINT-END：写进去的是 BEGIN 时刻的快照 —— ATT = {T1, T2}，DPT = {Q}；T3 不在其中', function () {
        S.code(1); showRow(S, 19, 0);
        S.move('cur', 224, Y0 + 9 * DY, { delay: 100, dur: 400 });
        S.set('c19', { text: 'CHECKPOINT-END  ATT={T1,T2}  DPT={Q}' }, { delay: 1300 });
        ['sT1', 'sT2', 'sQ'].forEach(function (id, n) { S.fly(id, 'r19', { color: C.purple, delay: 500 + n * 150, dur: 650 }); });
        S.to('sT3', { opacity: .3 }, { delay: 400, dur: 300 });
        S.data({ 'ATT@19': '{T1, T2}', 'DPT@19': '{Q}' }, { delay: 1300 });
      });
      S.step('在 19 之后崩溃：P 只能是 6；Q 是 1 或 2；R 是 0 或 1；S 是 7 或 8', function () {
        S.code([8, 13]); S.hide('cur');
        S.pop('boom');
        ['P', 'Q', 'R', 'S'].forEach(function (p, i) { S.flash('pg' + p, C.amber, { prop: 'stroke', delay: 300 + i * 200 }); });
        S.log('CRASH（19 之后）', { delay: 200, kind: 'err' });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 2：分析阶段 ───────────── */
  {
    name: '分析：重建 ATT / DPT',
    moving: 'MasterRecord 的信号飞到第 23 条；扫描框逐条下移；ATT / DPT 的表项从日志飞出落位，被 TXN-END 删掉的表项缩小消失、下面的顶上来；最后待撤销的事务变红',
    lang: '分析阶段',
    code: [
      'lsn = MasterRecord   // 最后完整检查点的 BEGIN',
      'for rec in log[lsn ..]:',
      '  if CKPT-END: 合并快照里的 ATT、DPT',
      '  if TXN-END: ATT.erase(rec.txn)',
      '  if rec.txn 不在 ATT: 加入，默认待撤销',
      '  if COMMIT: 状态改为已提交',
      '  if 改了页 p 且 p 不在 DPT:',
      '    DPT[p] = rec.lsn   // recLSN',
      '',
      '结果：ATT = {T3, T4}（都要撤销）',
      '      DPT = {Q:25, R:28, P:29}'
    ].join('\n'),
    build: function (S) {
      var Y0 = 96, DY = 44, AX = 680, AY = [176, 216, 256], DX0 = 680, DYs = [388, 428, 468];
      note(S, '日志为示意；假设 LSN 26 里的 DPT 为空');
      S.text('more', { x: 30, y: 62, text: '……（LSN 10–22 略）', anchor: 'start', size: 14, color: C.mute });
      logRows(S, LOG2, Y0, DY, 24, 430);
      S.box('cur', { x: 239, y: Y0, w: 440, h: 40, rx: 8, fill: 'none', stroke: C.blue, sw: 2.5, opacity: 0 });
      S.box('mr', { x: AX, y: 82, w: 280, h: 40, rx: 8, fill: C.panel, stroke: C.purple, sw: 2, label: 'MasterRecord = 23', size: 16 });
      title(S, 'tA', 540, 140, 'ATT（活跃事务表）');
      title(S, 'tD', 540, 352, 'DPT（脏页 : recLSN）');
      var ent = { a4: 'T4 · 待撤销', a1: 'T1 · 已提交', a3: 'T3 · 待撤销', dQ: 'Q : 25', dR: 'R : 28', dP: 'P : 29' };
      Object.keys(ent).forEach(function (k) { S.box(k, { x: AX, y: 0, w: 280, h: 34, rx: 6, fill: C.panel, stroke: C.line, sw: 1.5, label: ent[k], size: 15, opacity: 0 }); });
      S.text('boom', { x: 239, y: Y0 + 9 * DY, text: '💥 崩溃（31 已落盘）', size: 17, weight: 800, color: C.red });
      S.data({ ATT: '{}', DPT: '{}' });
      function land(id, y, from, d) { S.set(id, { y: y }, { delay: 0 }); S.fly(from, [AX, y], { color: C.cyan, delay: d, dur: 600 }); S.pop(id, { delay: d + 550 }); }
      function at(i, d) { S.move('cur', 239, Y0 + i * DY, { delay: d || 0, dur: 400 }); }

      S.step('重启：读磁盘上的 MasterRecord —— 它指向最后一个完整检查点的 BEGIN，即 23', function () {
        S.code(1); S.log('CRASH → 重启', { kind: 'err' });
        S.fly('mr', 'r23', { color: C.purple, delay: 200, dur: 700 });
        S.pop('cur', { delay: 850 }); S.flash('r23', C.purple, { delay: 900 });
      });
      S.step('24：T4 开始 —— 它不在 ATT 里，加进去，默认「待撤销」', function () {
        S.code(5); at(1);
        land('a4', AY[0], 'r24', 400);
        S.data({ ATT: '{T4}' }, { delay: 1000 });
      });
      S.step('25：T4 改了 Q，Q 不在 DPT 里 → 加进去，recLSN = 25', function () {
        S.code([7, 8]); at(2);
        land('dQ', DYs[0], 'r25', 400);
        S.data({ DPT: '{Q:25}' }, { delay: 1000 });
      });
      S.step('26：CHECKPOINT-END —— 合并快照：ATT 加上 T1（已提交）和 T3；快照里的 DPT 是空的', function () {
        S.code(3); at(3);
        land('a1', AY[1], 'r26', 400); land('a3', AY[2], 'r26', 650);
        S.data({ ATT: '{T4, T1(已提交), T3}' }, { delay: 1300 });
      });
      S.step('27：T1 TXN-END → 从 ATT 里删掉，下面的表项顶上来', function () {
        S.code(4); at(4);
        S.to('a1', { fill: C.red }, { delay: 400, dur: 200 }); S.to('a1', { scale: .3, opacity: 0 }, { delay: 650, dur: 400, ease: 'in' });
        S.move('a3', AX, AY[1], { delay: 1050, dur: 450 });
        S.data({ ATT: '{T4, T3}' }, { delay: 1100 });
      });
      S.step('28：T3 改 R → DPT 加 R:28；29：T4 改 P → DPT 加 P:29', function () {
        S.code([7, 8]); at(5);
        land('dR', DYs[1], 'r28', 400);
        at(6, 1000); land('dP', DYs[2], 'r29', 1400);
        S.data({ DPT: '{Q:25, R:28, P:29}' }, { delay: 2000 });
      });
      S.step('30、31：T4 中止并写了一条 CLR —— P 已经在 DPT 里了，不变', function () {
        S.code(7); at(7); at(8, 600);
        S.flash('dP', C.amber, { delay: 1000 }); S.pulse('dP', { delay: 1000, scale: 1.05 });
        S.log('31 是 CLR：撤过 29，undoNext = 25', { delay: 1100 });
      });
      S.step('分析结束：ATT 里剩 T3、T4，都要撤销；DPT = {Q:25, R:28, P:29}', function () {
        S.code([10, 11]); S.hide('cur');
        ['a4', 'a3'].forEach(function (id, n) { S.to(id, { stroke: C.red }, { delay: n * 200, dur: 300 }); S.pulse(id, { delay: n * 200, scale: 1.05 }); });
        ['dQ', 'dR', 'dP'].forEach(function (id, n) { S.flash(id, C.green, { prop: 'stroke', delay: 500 + n * 150 }); });
        S.log('ATT = {T3, T4} · DPT = {Q:25, R:28, P:29}', { delay: 900, kind: 'ok' });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 3：重做的三类 ───────────── */
  {
    name: '重做：一定 / 可能 / 一定不',
    moving: '9 条修改记录排成一行；重做起点的竖线落到 21 和 25 之间；起点之前的记录飞进「一定不重做」框；之后的记录飞进「可能重做」框，其中一张页的 pageLSN 对比来回闪烁；「一定重做」框保持空着',
    lang: '重做阶段',
    code: [
      '起点 = DPT 里最小的 recLSN = 25',
      'for rec in log[25 ..] (UPDATE / CLR):',
      '  if rec.page 不在 DPT: 跳过',
      '  if DPT[page].recLSN > rec.lsn: 跳过',
      '  读页：if pageLSN >= rec.lsn: 跳过',
      '  否则重做，pageLSN = rec.lsn',
      '',
      '一定不重做：12 13 17 18 21（在起点之前）',
      '可能重做：25 28 29 31（要看 pageLSN）',
      '一定重做：没有',
      '  —— 后台线程可能早已把页刷过'
    ].join('\n'),
    build: function (S) {
      var R = [[12, 'P'], [13, 'Q'], [17, 'R'], [18, 'S'], [21, 'R'], [25, 'Q'], [28, 'R'], [29, 'P'], [31, 'P']];
      function rx(i) { return 64 + i * 92; }
      var BX = [150, 430, 710], BY = 380;
      note(S, '日志为示意；DPT 来自上一个场景的分析结果');
      title(S, 'tR', 30, 66, '所有 UPDATE / CLR 记录（LSN · 页）');
      S.text('dpt', { x: 430, y: 186, text: 'DPT：Q:25 · R:28 · P:29', size: 16, weight: 700, color: C.cyan, opacity: 0 });
      S.line('start', { x1: 476, y1: 74, x2: 476, y2: 150, stroke: C.red, sw: 3, dash: '6 4', opacity: 0 });
      S.text('startT', { x: 486, y: 70, text: '重做起点 25', anchor: 'start', size: 15, weight: 700, color: C.red, opacity: 0 });
      [['一定不重做', C.mute], ['可能重做', C.amber], ['一定重做', C.green]].forEach(function (b, i) {
        S.box('B' + i, { x: BX[i], y: BY, w: 250, h: 200, rx: 12, fill: C.panel, stroke: b[1], sw: 2 });
        S.text('Bt' + i, { x: BX[i], y: BY - 78, text: b[0], size: 17, weight: 700, color: b[1] });
      });
      R.forEach(function (r, i) { S.box('k' + r[0], { x: rx(i), y: 112, w: 80, h: 44, rx: 8, fill: ROWF, stroke: C.purple, sw: 1.5, label: r[0] + ' · ' + r[1], size: 15, opacity: 0 }); });
      S.text('empty', { x: BX[2], y: BY + 10, text: '（空）', size: 18, color: C.mute, opacity: 0 });
      S.text('pl', { x: 430, y: 236, text: '', size: 15, color: C.ink });
      S.data({ '重做起点': '—' });
      function slot(b, n) { return [BX[b] - 64 + (n % 3) * 64, BY - 16 + Math.floor(n / 3) * 52]; }

      S.step('要判断的是每一条 UPDATE / CLR：重做阶段会不会真的把它重放一遍', function () {
        S.code(2);
        R.forEach(function (r, i) { S.pop('k' + r[0], { delay: i * 110 }); });
      }, { hold: 1700 });
      S.step('重做从 DPT 里最小的 recLSN 开始 —— 25', function () {
        S.code(1);
        S.to('dpt', { opacity: 1 }, { dur: 300 }); S.pulse('dpt', { delay: 200 });
        S.to('start', { opacity: 1 }, { delay: 500, dur: 300 }); S.to('startT', { opacity: 1 }, { delay: 500, dur: 300 });
        S.data({ '重做起点': 25 }, { delay: 600 });
      }, { hold: 1800 });
      S.step('起点之前的 12、13、17、18、21 根本不会被扫到 → 一定不重做', function () {
        S.code(8);
        [12, 13, 17, 18, 21].forEach(function (l, n) {
          var p = slot(0, n);
          S.to('k' + l, { x: p[0], y: p[1], w: 56, label: String(l), stroke: C.mute }, { delay: n * 180, dur: 650 });
        });
        S.log('5 条：一定不重做', { delay: 1500 });
      }, { hold: 1600 });
      S.step('印证：它们改过的 P、Q、R、S 在 23 时都已经干净（快照的 DPT 为空），改动早就在盘上了', function () {
        S.code(3);
        [12, 13, 17, 18, 21].forEach(function (l, n) { S.flash('k' + l, '#2a3a5c', { delay: n * 120 }); });
        S.set('pl', { text: '23 时的 DPT = ∅ → 这些页在 23 之前都已刷盘' }, { delay: 300 });
      }, { hold: 2000 });
      S.step('25、28、29、31：页都在 DPT 里，recLSN 也不大于它们 → 必须把页读进来比 pageLSN', function () {
        S.code([3, 5]); S.set('pl', { text: '' });
        [25, 28, 29, 31].forEach(function (l, n) {
          var p = slot(1, n);
          S.to('k' + l, { x: p[0], y: p[1], w: 56, label: String(l), stroke: C.amber }, { delay: n * 180, dur: 650 });
        });
        S.to('start', { opacity: .2 }, { delay: 900, dur: 300 }); S.to('startT', { opacity: .2 }, { delay: 900, dur: 300 });
      });
      S.step('后台线程可能早已把这些页刷过：pageLSN ≥ 这条 LSN 就跳过，否则才重做 → 只能说「可能」', function () {
        S.code([5, 6]);
        S.set('pl', { text: '例：Q 页若已刷过，pageLSN = 25 ≥ 25 → 跳过；没刷过 → 重做' }, { delay: 200 });
        S.flash('k25', C.green, { delay: 400 }); S.flash('k25', C.red, { delay: 1300 });
        S.log('可能重做：25 28 29 31', { delay: 1500, kind: 'warn' });
      }, { hold: 1500 });
      S.step('「一定重做」是空的 —— 有后台刷盘时，没有哪一页能保证一定没被刷过', function () {
        S.code([10, 11]); S.set('pl', { text: '' });
        S.pop('empty'); S.pulse('B2', { delay: 300, scale: 1.04 });
        S.log('一定重做：无', { delay: 500, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────── 场景 4：撤销与 CLR 计数 ───────────── */
  {
    name: '撤销：沿 prevLSN 补 CLR',
    moving: '两条 prevLSN 链上的游标轮流后退（总是先撤 LSN 最大的那条）；旧值飞回页里、数字滚动；每撤一条就在新日志尾部弹出一条 CLR；T4 的 CLR 沿 undoNext 跳过 29；各事务的 CLR 计数滚动',
    lang: '撤销阶段',
    code: [
      'ToUndo = { 每个待撤销事务的 lastLSN }',
      'while ToUndo 非空:',
      '  lsn = max(ToUndo)          // 跨事务挑最大的',
      '  rec = log[lsn]',
      '  if rec 是 CLR:',
      '    下一个 = rec.undoNext    // 已撤过，跳',
      '  else:',
      '    页里写回旧值；追加 CLR',
      '    下一个 = rec.prevLSN',
      '  下一个是 BEGIN → 写 TXN-END',
      '',
      '顺序：28(T3) → 25(T4) → 21(T3) → 17(T3)',
      '新 CLR：T1 0 · T2 0 · T3 3 · T4 1'
    ].join('\n'),
    build: function (S) {
      var C3 = [[28, 'R 2→4'], [21, 'R 1→2'], [17, 'R 0→1'], [16, 'BEGIN']], C4 = [[31, 'CLR P'], [29, 'P 6→0'], [25, 'Q 2→3'], [24, 'BEGIN']];
      function cx(i) { return 120 + i * 140; }
      var Y3 = 112, Y4 = 214;
      note(S, '日志为示意；重做之后各页的值：P=6、Q=3、R=4、S=8');
      S.text('l3', { x: 24, y: Y3, text: 'T3', anchor: 'start', size: 18, weight: 700, color: C.amber });
      S.text('l4', { x: 24, y: Y4, text: 'T4', anchor: 'start', size: 18, weight: 700, color: C.green });
      [[C3, Y3, 'x'], [C4, Y4, 'y']].forEach(function (ch) {
        ch[0].forEach(function (r, i) {
          S.box(ch[2] + r[0], { x: cx(i), y: ch[1], w: 120, h: 44, rx: 8, fill: ROWF, stroke: C.purple, sw: 1.5, label: r[0] + '  ' + r[1], size: 15 });
          if (i < 3) S.line(ch[2] + 'e' + i, { x1: cx(i) + 62, y1: ch[1], x2: cx(i + 1) - 64, y2: ch[1], stroke: C.purple, sw: 2, arrow: true });
        });
      });
      S.text('pv', { x: 330, y: 64, text: '箭头：沿 prevLSN 指向更早的记录', size: 14, color: C.purple });
      S.path('skip', { d: 'M150,238 C200,300 350,300 400,238', stroke: C.cyan, sw: 2.5, dash: '6 4', opacity: 0, draw: 0 });
      S.text('skipT', { x: 275, y: 304, text: 'undoNext = 25', size: 14, color: C.cyan, opacity: 0 });
      S.box('u3', { x: cx(0), y: Y3, w: 132, h: 54, rx: 10, fill: 'none', stroke: C.amber, sw: 3, opacity: 0 });
      S.box('u4', { x: cx(0), y: Y4, w: 132, h: 54, rx: 10, fill: 'none', stroke: C.green, sw: 3, opacity: 0 });
      S.text('todo', { x: 430, y: 330, text: 'ToUndo = { 28 (T3), 31 (T4) }', size: 16, weight: 700, color: C.cyan });
      title(S, 'tP', 30, 378, '页里的值');
      var PV = { P: 6, Q: 3, R: 4, S: 8 };
      ['P', 'Q', 'R', 'S'].forEach(function (p, i) {
        S.box('pg' + p, { x: 90 + i * 96, y: 420, w: 84, h: 50, rx: 8, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('pv' + p, { x: 90 + i * 96, y: 420, val: PV[p], pre: p + ' = ', size: 17, weight: 700 });
      });
      title(S, 'tN', 470, 378, '恢复时追加的新日志');
      var NEW = [[32, 'T3 CLR 撤 28'], [33, 'T4 CLR 撤 25'], [34, 'T4 TXN-END'], [35, 'T3 CLR 撤 21'], [36, 'T3 CLR 撤 17'], [37, 'T3 TXN-END']];
      NEW.forEach(function (r, i) { S.box('n' + r[0], { x: 560 + (i % 2) * 150, y: 410 + Math.floor(i / 2) * 42, w: 142, h: 34, rx: 6, fill: '#3a2f66', stroke: C.purple, sw: 1, label: r[0] + ' ' + r[1], size: 14, opacity: 0 }); });
      S.text('cnt', { x: 430, y: 530, text: '新 CLR：T1 0 · T2 0 · T3 0 · T4 0', size: 15, weight: 700, color: C.amber });
      S.data({ 'T3 新 CLR': 0, 'T4 新 CLR': 0 });
      function undo(box, page, to, nid, d) {
        S.fly(box, 'pg' + page, { label: '旧值', w: 50, h: 26, color: C.green, delay: d, dur: 650 });
        S.count('pv' + page, to, { delay: d + 650, dur: 400 }); S.pulse('pg' + page, { delay: d + 650, scale: 1.06 });
        S.pop(nid, { delay: d + 900 });
        S.to(box, { opacity: .35 }, { delay: d + 900, dur: 300 });
      }

      S.step('撤销 ATT 里剩下的 T3、T4：各自从 lastLSN 出发，沿 prevLSN 往回走', function () {
        S.code(1);
        S.pop('u3'); S.pop('u4', { delay: 200 });
        S.flash('todo', C.amber, { prop: 'color', delay: 400 });
      }, { hold: 1700 });
      S.step('T4 的 lastLSN 31 是一条 CLR —— 29 已经撤过了，直接按 undoNext 跳到 25', function () {
        S.code([5, 6]);
        S.to('skip', { opacity: 1, draw: 1 }, { dur: 700 }); S.to('skipT', { opacity: 1 }, { delay: 500, dur: 300 });
        S.to('y29', { opacity: .35 }, { delay: 600, dur: 300 }); S.move('u4', cx(2), Y4, { delay: 700, dur: 600 });
        S.set('todo', { text: 'ToUndo = { 28 (T3), 25 (T4) }' }, { delay: 900 });
      }, { hold: 1600 });
      S.step('每次挑 LSN 最大的：先撤 T3 的 28 —— R 从 4 写回 2，追加 CLR 32', function () {
        S.code([3, 8]);
        S.flash('x28', C.amber); undo('x28', 'R', 2, 'n32', 300);
        S.move('u3', cx(1), Y3, { delay: 1300, dur: 500 });
        S.set('todo', { text: 'ToUndo = { 25 (T4), 21 (T3) }' }, { delay: 1400 });
        S.set('cnt', { text: '新 CLR：T1 0 · T2 0 · T3 1 · T4 0' }, { delay: 1300 }); S.data({ 'T3 新 CLR': 1 }, { delay: 1300 });
      });
      S.step('再撤 T4 的 25 —— Q 从 3 写回 2，追加 CLR 33；T4 走到 BEGIN，写 TXN-END（34）', function () {
        S.code([8, 10]);
        S.flash('y25', C.green); undo('y25', 'Q', 2, 'n33', 300);
        S.move('u4', cx(3), Y4, { delay: 1300, dur: 500 }); S.pop('n34', { delay: 1700 }); S.hide('u4', { delay: 1900 });
        S.set('todo', { text: 'ToUndo = { 21 (T3) }' }, { delay: 1700 });
        S.set('cnt', { text: '新 CLR：T1 0 · T2 0 · T3 1 · T4 1' }, { delay: 1300 }); S.data({ 'T4 新 CLR': 1 }, { delay: 1300 });
      });
      S.step('接着撤 T3 的 21 —— R 从 2 写回 1，追加 CLR 35', function () {
        S.code([8, 9]);
        S.flash('x21', C.amber); undo('x21', 'R', 1, 'n35', 300);
        S.move('u3', cx(2), Y3, { delay: 1300, dur: 500 });
        S.set('todo', { text: 'ToUndo = { 17 (T3) }' }, { delay: 1400 });
        S.set('cnt', { text: '新 CLR：T1 0 · T2 0 · T3 2 · T4 1' }, { delay: 1300 }); S.data({ 'T3 新 CLR': 2 }, { delay: 1300 });
      });
      S.step('最后撤 T3 的 17 —— R 从 1 写回 0，追加 CLR 36；T3 到 BEGIN，写 TXN-END（37）', function () {
        S.code([8, 10]);
        S.flash('x17', C.amber); undo('x17', 'R', 0, 'n36', 300);
        S.move('u3', cx(3), Y3, { delay: 1300, dur: 500 }); S.pop('n37', { delay: 1700 }); S.hide('u3', { delay: 1900 });
        S.set('todo', { text: 'ToUndo = { }' }, { delay: 1700 });
        S.set('cnt', { text: '新 CLR：T1 0 · T2 0 · T3 3 · T4 1' }, { delay: 1300 }); S.data({ 'T3 新 CLR': 3 }, { delay: 1300 });
      });
      S.step('恢复完成：P = 6、Q = 2、R = 0、S = 8；新写的 CLR —— T3 三条、T4 一条、已提交的 T1、T2 零条', function () {
        S.code([12, 13]);
        ['P', 'Q', 'R', 'S'].forEach(function (p, i) { S.flash('pg' + p, C.green, { prop: 'stroke', delay: i * 150 }); });
        S.pulse('cnt', { delay: 600, scale: 1.05 });
        S.log('T3 3 条 · T4 1 条 · T1/T2 0 条', { delay: 800, kind: 'ok' });
      }, { hold: 1600 });
    }
  }
  ]
});
})();
