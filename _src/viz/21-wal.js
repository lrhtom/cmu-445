/* #21 预写日志 WAL：一次提交的时序 / STEAL 与 WAL 规则 / 组提交
 * 画面里的对象值（A=1→8、B=2→9）和 LSN 编号是为演示取的示意值。 */
(function () {
var C = Viz.C, REC = '#3a2f66';
var MEM = [[172, 226], [328, 226], [172, 266], [328, 266]], DISK = [[172, 446], [328, 446], [172, 486], [328, 486]];
function frame(S, id, x, y, w, h, title, tx) {
  S.box(id, { x: x, y: y, w: w, h: h, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
  S.text(id + 'T', { x: tx, y: y - h / 2 + 20, text: title, anchor: 'start', color: C.mute, size: 15 });
}
function cell(S, id, x, y, label) { S.box(id, { x: x, y: y, w: 130, h: 50, rx: 8, fill: C.cell, stroke: C.line, label: label, size: 18 }); }
function base(S) {
  S.text('note', { x: 20, y: 24, text: '对象的值和 LSN 编号为示意', anchor: 'start', size: 14, color: C.mute });
  S.line('div', { x1: 20, y1: 338, x2: 840, y2: 338, stroke: C.line, dash: '7 7', sw: 1.5 });
  S.text('tMem', { x: 30, y: 322, text: '▲ 内存（断电即丢）', anchor: 'start', color: C.mute, size: 14 });
  S.text('tDsk', { x: 30, y: 356, text: '▼ 磁盘（持久）', anchor: 'start', color: C.mute, size: 14 });
  frame(S, 'lb', 250, 235, 330, 150, '日志缓冲区', 100);
  frame(S, 'bp', 650, 235, 320, 150, '缓冲池里的页 P1', 505);
  frame(S, 'dl', 250, 455, 330, 150, '日志文件（只顺序追加）', 100);
  frame(S, 'dd', 650, 455, 320, 150, '数据文件里的页 P1', 505);
  S.box('t1', { x: 110, y: 78, w: 150, h: 48, rx: 10, fill: C.panel, stroke: C.blue, sw: 2, label: '事务 T1' });
}
function rec(S, id, pos, label, o) {
  var p = { x: pos[0], y: pos[1], w: 148, h: 30, rx: 6, fill: REC, stroke: C.purple, sw: 1.2, label: label, size: 14, weight: 500, trail: 3 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
/* 一条日志记录从事务飞进日志缓冲区的第 i 个槽 */
function emit(S, id, i, label, delay) {
  S.fly('t1', MEM[i], { id: id, label: label, w: 148, h: 30, size: 14, color: C.purple, ink: C.bg, keep: true, delay: delay || 0, dur: 750 });
  S.to(id, { fill: REC, color: C.ink, stroke: C.purple, sw: 1.2 }, { delay: (delay || 0) + 800, dur: 350 });
}

Viz.register('wal', {
  title: '预写日志 WAL：先写日志，再写数据',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #21 Database Logging（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/21-logging.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #21 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/21-logging.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #22 Database Recovery（Slides，pageLSN / flushedLSN）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/22-recovery.pdf' }
  ],
  scenes: [

  /* ───────────── 场景 1：一次提交的完整时序 ───────────── */
  {
    name: '一次提交的时序',
    moving: '日志记录从事务飞进日志缓冲区；页里的值滚动变化并变脏；fsync 时记录成批滑到磁盘；确认信号飞回事务',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Txn::Write(obj, new_val) {',
      '  log_buf.Append({txn, obj, old, new_val});',
      '  page->Set(obj, new_val);  // 只改内存里的页',
      '  page->dirty = true;',
      '}',
      'void Txn::Commit() {',
      '  log_buf.Append({COMMIT, txn});',
      '  log_buf.Flush();          // fsync，顺序写',
      '  ReplyToClient(OK);        // 落盘后才能回复',
      '}'
    ].join('\n'),
    build: function (S) {
      base(S);
      cell(S, 'cA', 570, 250, 'A = 1'); cell(S, 'cB', 730, 250, 'B = 2');
      cell(S, 'dA', 570, 470, 'A = 1'); cell(S, 'dB', 730, 470, 'B = 2');
      S.text('dirty', { x: 795, y: 180, text: '脏页', anchor: 'end', color: C.amber, size: 15, weight: 700, opacity: 0 });
      S.text('ack', { x: 200, y: 78, text: '✓ 提交成功', anchor: 'start', color: C.green, size: 17, weight: 700, opacity: 0 });
      S.text('nF', { x: 840, y: 24, anchor: 'end', val: 0, pre: 'fsync 次数：', color: C.amber, size: 16 });
      S.data({ '内存 P1': 'A=1, B=2', '磁盘 P1': 'A=1, B=2', '缓冲区里的日志': 0, '已落盘的日志': 0 });

      S.step('T1 BEGIN → 往内存里的日志缓冲区追加 <BEGIN, T1>', function () {
        S.log('T1: BEGIN'); S.pulse('t1');
        emit(S, 'r0', 0, '<BEGIN, T1>', 200);
        S.data({ '缓冲区里的日志': 1 }, { delay: 950 });
      });
      S.step('T1 写 A：① 先追加日志记录 —— 里面同时有旧值（undo 用）和新值（redo 用）', function () {
        S.code([1, 2]); S.log('T1: W(A) = 8');
        emit(S, 'r1', 1, '<T1, A, 旧1, 新8>', 150);
        S.data({ '缓冲区里的日志': 2 }, { delay: 900 });
      });
      S.step('② 再改缓冲池里的页：A 变成 8，这页成了脏页', function () {
        S.code([3, 4]);
        S.fly('t1', 'cA', { color: C.blue, dur: 750 });
        S.set('cA', { label: 'A = 8' }, { delay: 750 }); S.flash('cA', C.blue, { delay: 750 }); S.pulse('cA', { delay: 750 });
        S.to('bp', { stroke: C.amber }, { delay: 900, dur: 400 }); S.pop('dirty', { delay: 900 });
        S.data({ '内存 P1': 'A=8, B=2' }, { delay: 750 });
      });
      S.step('T1 写 B：同样先记日志、再改页', function () {
        S.code([1, 3]); S.log('T1: W(B) = 9');
        emit(S, 'r2', 2, '<T1, B, 旧2, 新9>', 100);
        S.fly('t1', 'cB', { color: C.blue, dur: 750, delay: 1000 });
        S.set('cB', { label: 'B = 9' }, { delay: 1750 }); S.flash('cB', C.blue, { delay: 1750 }); S.pulse('cB', { delay: 1750 });
        S.data({ '缓冲区里的日志': 3 }, { delay: 850 }); S.data({ '内存 P1': 'A=8, B=9' }, { delay: 1750 });
      });
      S.step('T1 COMMIT → 追加 <COMMIT, T1>', function () {
        S.code(7); S.log('T1: COMMIT');
        emit(S, 'r3', 3, '<COMMIT, T1>', 150);
        S.data({ '缓冲区里的日志': 4 }, { delay: 900 });
      });
      S.step('fsync：日志缓冲区里的记录整批顺序写进磁盘上的日志文件', function () {
        S.code(8);
        [0, 1, 2, 3].forEach(function (i) {
          S.move('r' + i, DISK[i][0], DISK[i][1], { delay: i * 170, dur: 800 });
          S.ripple(DISK[i][0], DISK[i][1], { delay: i * 170 + 800, color: C.purple });
        });
        S.flash('div', C.purple, { prop: 'stroke', delay: 300 });
        S.count('nF', 1, { delay: 1300 }); S.pulse('nF', { delay: 1300 });
        S.data({ '缓冲区里的日志': 0, '已落盘的日志': 4 }, { delay: 1300 }); S.log('fsync(log) 完成', { delay: 1400, kind: 'io' });
      });
      S.step('硬件确认日志已落盘 → 现在才能告诉应用「提交成功」', function () {
        S.code(9);
        S.fly('r3', 't1', { color: C.green, dur: 850 });
        S.to('t1', { stroke: C.green }, { delay: 850, dur: 350 }); S.pulse('t1', { delay: 850 }); S.pop('ack', { delay: 900 });
        S.log('T1 提交成功', { delay: 950, kind: 'ok' });
      });
      S.step('注意：脏页 P1 一直没写回磁盘 —— 没关系，恢复所需的一切都在日志里（NO-FORCE）', function () {
        S.flash('dA', C.amber); S.pulse('dA'); S.flash('dB', C.amber, { delay: 250 }); S.pulse('dB', { delay: 250 });
        S.flash('r1', C.green, { delay: 800 }); S.flash('r2', C.green, { delay: 1000 });
        S.log('磁盘 P1 仍是旧值；日志里有新值可 redo', { delay: 900 });
      });
    }
  },

  /* ───────────── 场景 2：STEAL 与 WAL 规则 ───────────── */
  {
    name: 'STEAL 与 WAL 规则',
    moving: '脏页往磁盘方向冲、被虚线挡回；日志记录滑到磁盘、flushedLSN 滚动；脏页的值飞到数据文件；崩溃后旧值从日志飞回把它撤销',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'bool CanFlush(Page* p) {',
      '  return p->pageLSN <= flushedLSN;',
      '}',
      'void Evict(Page* p) {',
      '  if (!CanFlush(p))',
      '    log_buf.Flush();     // 先让日志落盘',
      '  disk.Write(p);         // 再写数据页',
      '}',
      '// 恢复：有改动却没有 COMMIT 的事务',
      'for (rec : Reverse(log.Of(txn)))',
      '  page->Set(rec.obj, rec.old);  // undo'
    ].join('\n'),
    build: function (S) {
      base(S);
      rec(S, 'r0', MEM[0], 'LSN 1 <BEGIN,T1>'); rec(S, 'r1', MEM[1], 'LSN 2 <T1,A,旧1,新8>');
      cell(S, 'cA', 570, 250, 'A = 8'); cell(S, 'cB', 730, 250, 'B = 2');
      cell(S, 'dA', 570, 470, 'A = 1'); cell(S, 'dB', 730, 470, 'B = 2');
      S.text('dirty', { x: 795, y: 180, text: '脏页 · pageLSN = 2', anchor: 'end', color: C.amber, size: 15, weight: 700 });
      S.text('nFL', { x: 840, y: 24, anchor: 'end', val: 0, pre: 'flushedLSN = ', color: C.amber, size: 17, weight: 700 });
      S.box('probe', { x: 650, y: 250, w: 290, h: 56, rx: 8, fill: 'none', stroke: C.amber, sw: 3, opacity: 0, trail: 3 });
      S.text('tag', { x: 570, y: 512, text: '未提交的改动！', color: C.red, size: 15, weight: 700, opacity: 0 });
      S.text('boom', { x: 430, y: 130, text: '💥 崩溃', color: C.red, size: 34, weight: 800, opacity: 0 });
      S.data({ 'T1 状态': '运行中（未提交）', 'pageLSN(P1)': 2, flushedLSN: 0, '磁盘 P1': 'A=1, B=2' });

      S.step('T1 把 A 改成 8 后还没提交，缓冲池却要淘汰脏页 P1 腾地方', function () {
        S.code(4); S.log('Evict(P1)');
        S.to('bp', { stroke: C.amber }, { dur: 350 }); S.pulse('bp', { scale: 1.05 }); S.pop('probe', { delay: 400 });
      });
      S.step('WAL 规则检查：pageLSN(2) ≤ flushedLSN(0)？不成立 —— 对应的日志还在内存里，这页不能写盘', function () {
        S.code([1, 2]);
        S.pulse('dirty'); S.pulse('nFL', { delay: 300 });
        S.move('probe', 650, 318, { delay: 600, dur: 500, ease: 'in' });
        S.flash('div', C.red, { prop: 'stroke', delay: 1050 }); S.ripple(650, 338, { delay: 1050, color: C.red });
        S.to('probe', { stroke: C.red }, { delay: 1050, dur: 150 });
        S.move('probe', 650, 250, { delay: 1150, dur: 600, ease: 'back' });
        S.to('probe', { stroke: C.amber }, { delay: 1500, dur: 300 });
        S.code(5, { delay: 1100 }); S.log('2 ≤ 0 不成立 → 先刷日志', { delay: 1100, kind: 'warn' });
      });
      S.step('所以先让日志落盘：日志缓冲区顺序写进日志文件，flushedLSN 推进到 2', function () {
        S.code(6);
        S.move('r0', DISK[0][0], DISK[0][1], { dur: 800 }); S.ripple(DISK[0][0], DISK[0][1], { delay: 800, color: C.purple });
        S.move('r1', DISK[1][0], DISK[1][1], { delay: 200, dur: 800 }); S.ripple(DISK[1][0], DISK[1][1], { delay: 1000, color: C.purple });
        S.count('nFL', 2, { delay: 1050 }); S.pulse('nFL', { delay: 1050 });
        S.data({ flushedLSN: 2 }, { delay: 1050 }); S.log('fsync(log) → flushedLSN = 2', { delay: 1100, kind: 'io' });
      });
      S.step('再检查：2 ≤ 2 成立 → 可以把这张带着未提交改动的脏页写出去（这就是 STEAL）', function () {
        S.code([1, 2]); S.code(7, { delay: 700 });
        S.flash('nFL', C.green, { prop: 'color' }); S.flash('dirty', C.green, { prop: 'color' });
        S.to('probe', { stroke: C.green }, { delay: 300, dur: 300 });
        S.move('probe', 650, 470, { delay: 700, dur: 850 }); S.hide('probe', { delay: 1550 });
        S.set('dA', { label: 'A = 8' }, { delay: 1500 }); S.to('dA', { stroke: C.amber, sw: 3 }, { delay: 1500, dur: 300 }); S.pulse('dA', { delay: 1500 });
        S.to('bp', { stroke: C.line }, { delay: 1600, dur: 350 }); S.set('dirty', { text: '已写回 · pageLSN = 2', color: C.mute }, { delay: 1600 });
        S.data({ '磁盘 P1': 'A=8, B=2' }, { delay: 1500 }); S.log('disk.Write(P1)', { delay: 1550, kind: 'io' });
      });
      S.step('磁盘上的数据页里出现了未提交的改动 —— 所以 STEAL 必须配 undo', function () {
        S.pop('tag'); S.pulse('dA', { delay: 200 });
        S.flash('r1', C.amber, { delay: 700 }); S.pulse('r1', { delay: 700 });
        S.log('靠日志里的「旧1」才能撤销', { delay: 800 });
      }, { hold: 2000 });
      S.step('假如此刻断电：内存里的东西全没了，磁盘上只剩日志和这张页', function () {
        S.pop('boom'); S.log('CRASH', { kind: 'err' });
        ['lb', 'lbT', 'bp', 'bpT', 'cA', 'cB', 'dirty', 't1'].forEach(function (id, i) { S.to(id, { opacity: .15 }, { delay: 250 + i * 50, dur: 500 }); });
        S.data({ 'T1 状态': '崩溃时未提交', 'pageLSN(P1)': null, flushedLSN: null }, { delay: 500 });
      });
      S.step('恢复：日志里 T1 有改动却没有 COMMIT → 用记录里的旧值把 A 撤回 1', function () {
        S.code([9, 11]); S.hide('boom');
        S.flash('r0', C.blue); S.flash('r1', C.blue, { delay: 300 }); S.pulse('r1', { delay: 300 });
        S.fly('r1', 'dA', { label: '旧 1', w: 60, h: 30, color: C.green, delay: 750, dur: 850 });
        S.set('dA', { label: 'A = 1' }, { delay: 1600 }); S.to('dA', { stroke: C.line, sw: 1.5 }, { delay: 1600, dur: 350 }); S.pulse('dA', { delay: 1600 });
        S.hide('tag', { delay: 1600 });
        S.data({ '磁盘 P1': 'A=1, B=2' }, { delay: 1600 }); S.log('undo T1：A 8 → 1', { delay: 1650, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 3：组提交 ───────────── */
  {
    name: '组提交',
    moving: '各事务的提交记录先后飞进缓冲区；等待条从左长到右；整批记录一起滑向磁盘；「当前缓冲区」标记换边；确认信号同时飞回三个事务',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void LogManager::Commit(txn) {',
      '  cur->Append({COMMIT, txn});',
      '  WaitForFlush(txn);       // 不单独 fsync',
      '}',
      'void LogManager::FlushLoop() {',
      '  while (true) {',
      '    SleepUntil(timeout || cur->Full());',
      '    swap(cur, other);      // 换缓冲区接新日志',
      '    disk.AppendAndFsync(other);  // 整批顺序写',
      '    WakeAll(other->waiters);     // 一起返回',
      '  }',
      '}'
    ].join('\n'),
    build: function (S) {
      var TX = [130, 310, 490, 670], M = [[110, 240], [240, 240], [370, 240]], D = [[150, 465], [330, 465], [510, 465]];
      S.text('note', { x: 20, y: 24, text: '等待时长 5 毫秒是讲课举的例子；一批 3 笔为示意', anchor: 'start', size: 14, color: C.mute });
      S.line('div', { x1: 20, y1: 338, x2: 840, y2: 338, stroke: C.line, dash: '7 7', sw: 1.5 });
      S.text('tMem', { x: 30, y: 322, text: '▲ 内存', anchor: 'start', color: C.mute, size: 14 });
      S.text('tDsk', { x: 30, y: 356, text: '▼ 磁盘', anchor: 'start', color: C.mute, size: 14 });
      frame(S, 'b1', 240, 232, 400, 116, '日志缓冲区 1', 54); frame(S, 'b2', 650, 232, 340, 116, '日志缓冲区 2', 494);
      frame(S, 'dl', 430, 455, 780, 130, '日志文件（只顺序追加）', 54);
      TX.forEach(function (x, i) { S.box('t' + (i + 1), { x: x, y: 78, w: 130, h: 46, rx: 10, fill: C.panel, stroke: C.blue, sw: 2, label: '事务 T' + (i + 1) }); });
      S.text('curT', { x: 240, y: 158, text: '▼ 当前写入', color: C.cyan, size: 15, weight: 700 });
      S.box('trk', { x: 240, y: 304, w: 360, h: 8, rx: 4, fill: C.cell, stroke: 'none', sw: 0 });
      S.box('tmr', { x: 60, y: 304, w: 0, h: 8, rx: 4, fill: C.amber, stroke: 'none', sw: 0 });
      S.text('tmrT', { x: 430, y: 304, text: '等待超时', anchor: 'start', color: C.mute, size: 14, opacity: 0 });
      S.text('nF', { x: 808, y: 410, anchor: 'end', val: 0, pre: 'fsync 次数：', color: C.amber, size: 16 });
      S.data({ '等待提交的事务': 0, '已提交的事务': 0, 'fsync 次数': 0, '当前缓冲区': 1 });
      function commit(i, slot, delay) {
        S.fly('t' + (i + 1), slot, { id: 'c' + (i + 1), label: 'T' + (i + 1) + ' COMMIT', w: 118, h: 30, size: 14, color: C.purple, ink: C.bg, keep: true, delay: delay, dur: 750 });
        S.to('c' + (i + 1), { fill: REC, color: C.ink, stroke: C.purple, sw: 1.2 }, { delay: delay + 800, dur: 300 });
      }

      S.step('T1 要提交：COMMIT 记录进了缓冲区 1', function () {
        S.code([1, 2]); S.log('T1: COMMIT'); S.pulse('t1');
        commit(0, M[0], 200);
        S.data({ '等待提交的事务': 1 }, { delay: 950 });
      });
      S.step('不立刻 fsync —— 先等一个很短的超时（例如 5 毫秒），看看还有谁要一起走', function () {
        S.code(3); S.code(7, { delay: 700 });
        S.pop('tmrT'); S.to('tmr', { x: 110, w: 100 }, { dur: 1300, ease: 'linear' });
        S.to('t1', { stroke: C.amber }, { dur: 400 });
      });
      S.step('等待期间，T2、T3 的提交记录也攒进了同一个缓冲区', function () {
        S.code([1, 3]);
        S.to('tmr', { x: 240, w: 360 }, { dur: 2300, ease: 'linear' });
        S.log('T2: COMMIT', { delay: 100 }); commit(1, M[1], 100); S.to('t2', { stroke: C.amber }, { delay: 900, dur: 300 });
        S.log('T3: COMMIT', { delay: 1100 }); commit(2, M[2], 1100); S.to('t3', { stroke: C.amber }, { delay: 1900, dur: 300 });
        S.data({ '等待提交的事务': 2 }, { delay: 900 }); S.data({ '等待提交的事务': 3 }, { delay: 1900 });
      });
      S.step('超时到：缓冲区 1 里攒的日志打成一包，开始一次顺序写盘', function () {
        S.code(7); S.code(9, { delay: 500 });
        S.flash('tmr', C.red); S.hide('tmrT');
        [0, 1, 2].forEach(function (i) { S.move('c' + (i + 1), D[i][0], 338, { delay: 300 + i * 120, dur: 800, ease: 'in' }); });
        S.log('flush 缓冲区 1 …', { delay: 400, kind: 'io' });
      });
      S.step('写盘的同时切到缓冲区 2：T4 的日志照常写入，不用等这次 I/O', function () {
        S.code(8);
        S.move('curT', 650, 158, { dur: 600 }); S.pulse('curT', { delay: 600 }); S.set('tmr', { x: 60, w: 0 }, { delay: 100 });
        S.log('T4: W(…)', { delay: 300 });
        S.fly('t4', [560, 240], { id: 'c4', label: 'T4 的日志', w: 118, h: 30, size: 14, color: C.purple, ink: C.bg, keep: true, delay: 300, dur: 750 });
        S.to('c4', { fill: REC, color: C.ink, stroke: C.purple, sw: 1.2 }, { delay: 1100, dur: 300 });
        [0, 1, 2].forEach(function (i) {
          S.move('c' + (i + 1), D[i][0], D[i][1], { delay: 500 + i * 120, dur: 800, ease: 'out' });
          S.ripple(D[i][0], D[i][1], { delay: 1300 + i * 120, color: C.purple });
        });
        S.count('nF', 1, { delay: 1600 }); S.pulse('nF', { delay: 1600 });
        S.data({ '当前缓冲区': 2 }, { delay: 600 }); S.data({ 'fsync 次数': 1 }, { delay: 1600 });
        S.log('fsync(log) 完成', { delay: 1650, kind: 'io' });
      });
      S.step('硬件确认后，T1、T2、T3 同时得到「提交成功」', function () {
        S.code(10);
        [0, 1, 2].forEach(function (i) {
          S.fly('c' + (i + 1), 't' + (i + 1), { color: C.green, delay: i * 160, dur: 850 });
          S.to('t' + (i + 1), { stroke: C.green }, { delay: i * 160 + 850, dur: 300 }); S.pulse('t' + (i + 1), { delay: i * 160 + 850 });
        });
        S.data({ '等待提交的事务': 0, '已提交的事务': 3 }, { delay: 1200 }); S.log('T1 T2 T3 提交成功', { delay: 1250, kind: 'ok' });
      });
      S.step('一次 fsync 服务了 3 笔事务 —— 真实系统里一批可以是上万笔', function () {
        S.pulse('nF', { scale: 1.3 }); S.flash('nF', C.green, { prop: 'color' });
        [0, 1, 2].forEach(function (i) { S.flash('c' + (i + 1), C.green, { delay: 300 + i * 150 }); });
        S.log('1 次 fsync / 3 笔提交', { delay: 500, kind: 'ok' });
      });
    }
  }
  ]
});
})();
