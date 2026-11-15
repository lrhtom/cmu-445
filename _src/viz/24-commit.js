/* #24 原子提交：2PC 提交成功 / 一票否决 / 节点无响应 / Paxos 多数派
 * 节点数（1 个协调者 + 3 个参与者）是讲义例子的规模；超时进度条的长度为示意。 */
(function () {
var C = Viz.C, PX = [170, 430, 690], PY = 400, CO = [430, 150], APP = [110, 70];
function stage(S, paxos) {
  var who = paxos ? '接受者' : '参与者';
  S.line('lA', { x1: 185, y1: 78, x2: 322, y2: 138, stroke: C.line, sw: 1.5, dash: '5 5' });
  PX.forEach(function (x, i) { S.line('l' + i, { x1: CO[0], y1: CO[1] + 28, x2: x, y2: PY - 28, stroke: C.line, sw: 1.5, dash: '5 5' }); });
  S.box('app', { x: APP[0], y: APP[1], w: 150, h: 46, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: '应用' });
  S.box('co', { x: CO[0], y: CO[1], w: 220, h: 56, rx: 12, fill: C.panel, stroke: C.blue, sw: 2, label: paxos ? '提议者' : '协调者', size: 18 });
  S.text('coS', { x: CO[0], y: CO[1] + 46, text: '等待请求', size: 15, color: C.mute });
  PX.forEach(function (x, i) {
    S.box('p' + i, { x: x, y: PY, w: 190, h: 56, rx: 12, fill: C.panel, stroke: C.line, sw: 2, label: who + ' ' + (i + 1), size: 17 });
    S.text('s' + i, { x: x, y: PY + 46, text: '事务运行中', size: 15, color: C.mute });
  });
  S.text('ph', { x: 840, y: 26, text: '', anchor: 'end', size: 17, weight: 700, color: C.cyan, opacity: 0 });
  S.text('nV', { x: 840, y: 56, anchor: 'end', val: 0, pre: '同意票：', suf: ' / 3', color: C.amber, size: 16 });
  S.text('note', { x: 20, y: 530, text: '所有来往消息都要先写进各自的预写日志（图上不单独画）', anchor: 'start', size: 14, color: C.mute });
}
function msg(S, from, to, label, col, delay, o) {
  var p = { label: label, w: Math.max(56, label.length * 15 + 22), h: 28, size: 14, color: col, delay: delay || 0, dur: 800 };
  for (var k in o) p[k] = o[k];
  return S.fly(from, to, p);
}
function top(i) { return [PX[i], PY - 28]; }
function phase(S, t, delay) { S.set('ph', { text: t }, { delay: delay || 0 }); S.pop('ph', { delay: delay || 0 }); }
function st(S, i, text, col, delay) { S.set('s' + i, { text: text, color: col }, { delay: delay }); S.pulse('s' + i, { delay: delay }); }
function begin(S) {
  S.step('应用把事务的 COMMIT 请求交给协调者', function () {
    S.code(1); S.log('应用 → COMMIT');
    msg(S, 'app', [CO[0] - 110, CO[1]], 'COMMIT', C.cyan, 100); S.pulse('co', { delay: 900, scale: 1.06 });
    S.set('coS', { text: '收到 COMMIT' }, { delay: 900 });
  });
  S.step('第一阶段 Prepare：协调者逐个问所有参与者「这个事务能提交吗？」', function () {
    S.code(2); phase(S, '第一阶段 Prepare'); S.set('coS', { text: '等待投票' }, { delay: 300 });
    [0, 1, 2].forEach(function (i) { msg(S, [CO[0], CO[1] + 28], top(i), '能提交吗', C.blue, 200 + i * 220); S.pulse('p' + i, { delay: 1000 + i * 220, scale: 1.05 }); });
    S.log('PREPARE → 参与者 1 2 3', { delay: 300 });
  });
}
var CODE_2PC = [
  'bool Coordinator::Commit(txn) {',
  '  for (p : participants) Send(p, PREPARE);',
  '  for (p : participants)',
  '    if (Recv(p, timeout) != OK)  // 否决或超时',
  '      return Abort(txn);',
  '  Log(COMMIT, txn);              // 全票：决定提交',
  '  for (p : participants) Send(p, COMMIT);',
  '  WaitAcks();',
  '  return true;',
  '}',
  'bool Coordinator::Abort(txn) {',
  '  Log(ABORT, txn); ReplyToClient(ABORTED);',
  '  for (p : participants) Send(p, ABORT);',
  '  return false;',
  '}'
].join('\n');

Viz.register('twopc', {
  title: '原子提交：两阶段提交 2PC 与 Paxos',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #24 Distributed Databases Pt.2（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/24-distributed2.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #24 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/24-distributed2.pdf' }
  ],
  scenes: [
  {
    name: '2PC：提交成功',
    moving: '请求、投票、提交通知在协调者和三个参与者之间错峰飞行；每收到一票计数滚动一次；节点状态逐个变绿',
    lang: 'C++ 风格伪代码（示意）', code: CODE_2PC,
    build: function (S) {
      stage(S, false); S.data({ '阶段': '—', '同意票': '0 / 3', '事务结果': '未定' });
      begin(S);
      S.step('每个参与者把「已准备」写进自己的日志，然后投票 OK', function () {
        S.code([3, 4]);
        [0, 1, 2].forEach(function (i) {
          var d = i * 350;
          st(S, i, '已准备', C.amber, d); S.to('p' + i, { stroke: C.amber }, { delay: d, dur: 300 });
          msg(S, top(i), [CO[0], CO[1] + 28], 'OK', C.green, d + 350);
          S.count('nV', i + 1, { delay: d + 1150, dur: 300 }); S.pulse('nV', { delay: d + 1150 });
        });
        S.data({ '阶段': 'Prepare', '同意票': '3 / 3' }, { delay: 1900 }); S.log('收到 3 张 OK', { delay: 1900, kind: 'ok' });
      });
      S.step('全票通过 → 协调者记下「提交」的决定，进入第二阶段：通知所有参与者提交', function () {
        S.code(6); S.code(7, { delay: 700 });
        S.to('co', { stroke: C.green }, { dur: 350 }); S.pulse('co', { scale: 1.06 }); S.set('coS', { text: '决定：提交', color: C.green }, { delay: 200 });
        phase(S, '第二阶段 Commit', 600);
        [0, 1, 2].forEach(function (i) { msg(S, [CO[0], CO[1] + 28], top(i), '提交它', C.green, 700 + i * 220); });
        S.data({ '阶段': 'Commit', '事务结果': '提交' }, { delay: 300 }); S.log('COMMIT → 参与者 1 2 3', { delay: 800 });
      });
      S.step('参与者各自提交，并回报「已提交」', function () {
        S.code(8);
        [0, 1, 2].forEach(function (i) {
          var d = i * 300;
          st(S, i, '已提交', C.green, d); S.to('p' + i, { stroke: C.green }, { delay: d, dur: 300 });
          S.fly(top(i), [CO[0], CO[1] + 28], { color: C.green, delay: d + 300, dur: 750 });
        });
        S.log('3 个参与者均已提交', { delay: 1700, kind: 'ok' });
      });
      S.step('协调者这时才回复应用：提交成功', function () {
        S.code(9);
        msg(S, [CO[0] - 110, CO[1]], 'app', '提交成功', C.green, 100);
        S.to('app', { stroke: C.green }, { delay: 900, dur: 350 }); S.pulse('app', { delay: 900 });
        S.log('应用 ← 提交成功', { delay: 950, kind: 'ok' });
      }, { hold: 1800 });
    }
  },
  {
    name: '2PC：一票否决',
    moving: '参与者 2 的 ABORT 票飞回协调者；协调者不等第三票，中止通知立刻飞向应用和各参与者；节点状态逐个变红',
    lang: 'C++ 风格伪代码（示意）', code: CODE_2PC,
    build: function (S) {
      stage(S, false); S.data({ '阶段': '—', '同意票': '0 / 3', '事务结果': '未定' });
      begin(S);
      S.step('参与者 1 回 OK；参与者 2 回 ABORT（比如违反了完整性约束）；参与者 3 还没回', function () {
        S.code([3, 4]);
        st(S, 0, '已准备', C.amber, 0); S.to('p0', { stroke: C.amber }, { dur: 300 });
        msg(S, top(0), [CO[0], CO[1] + 28], 'OK', C.green, 300); S.count('nV', 1, { delay: 1100, dur: 300 });
        st(S, 1, '不能提交', C.red, 500); S.to('p1', { stroke: C.red }, { delay: 500, dur: 300 });
        msg(S, top(1), [CO[0], CO[1] + 28], 'ABORT', C.red, 900);
        S.flash('co', C.red, { prop: 'stroke', delay: 1700 }); st(S, 2, '还在检查…', C.mute, 800);
        S.data({ '阶段': 'Prepare', '同意票': '1 / 3（1 票否决）' }, { delay: 1700 }); S.log('参与者 2 → ABORT', { delay: 1700, kind: 'err' });
      });
      S.step('必须全票才能提交 → 立刻进入中止阶段，不等参与者 3 的票；并且立刻告诉应用「已中止」', function () {
        S.code(5); S.code(12, { delay: 500 });
        S.to('co', { stroke: C.red }, { dur: 350 }); S.set('coS', { text: '决定：中止', color: C.red }, { delay: 200 }); phase(S, '中止', 300);
        msg(S, [CO[0] - 110, CO[1]], 'app', '已中止', C.red, 600);
        S.to('app', { stroke: C.red }, { delay: 1400, dur: 350 }); S.pulse('app', { delay: 1400 });
        S.data({ '阶段': 'Abort', '事务结果': '中止' }, { delay: 300 }); S.log('应用 ← 已中止（先回复，再清理）', { delay: 1450, kind: 'warn' });
      });
      S.step('再通知所有参与者中止', function () {
        S.code(13);
        [0, 1, 2].forEach(function (i) { msg(S, [CO[0], CO[1] + 28], top(i), '中止', C.red, i * 220); });
        S.log('ABORT → 参与者 1 2 3', { delay: 200 });
      });
      S.step('各节点回滚后陆续回报「已中止」—— 收确认是为了留痕：协调者崩溃重启后得知道谁已经被通知过', function () {
        S.code(13);
        [0, 1, 2].forEach(function (i) {
          var d = i * 350;
          st(S, i, '已中止', C.red, d); S.to('p' + i, { stroke: C.red }, { delay: d, dur: 300 });
          S.fly(top(i), [CO[0], CO[1] + 28], { color: C.red, delay: d + 300, dur: 750 });
        });
        S.log('3 个参与者均已中止', { delay: 1800 });
      }, { hold: 2000 });
    }
  },
  {
    name: '2PC：节点无响应',
    moving: '参与者 2 变暗不再回信；协调者下方的超时条从左长到右；超时后中止通知飞向应用和还活着的参与者',
    lang: 'C++ 风格伪代码（示意）', code: CODE_2PC,
    build: function (S) {
      stage(S, false);
      S.box('trk', { x: CO[0], y: CO[1] + 72, w: 220, h: 8, rx: 4, fill: C.cell, stroke: 'none', sw: 0, opacity: 0 });
      S.box('tmr', { x: CO[0] - 110, y: CO[1] + 72, w: 0, h: 8, rx: 4, fill: C.amber, stroke: 'none', sw: 0 });
      S.data({ '阶段': '—', '同意票': '0 / 3', '事务结果': '未定' });
      begin(S);
      S.step('参与者 1、3 回了 OK；参与者 2 迟迟没有回应 —— 挂了，还是只是卡住了？分不清', function () {
        S.code([3, 4]);
        [0, 2].forEach(function (i, k) {
          var d = k * 400;
          st(S, i, '已准备', C.amber, d); S.to('p' + i, { stroke: C.amber }, { delay: d, dur: 300 });
          msg(S, top(i), [CO[0], CO[1] + 28], 'OK', C.green, d + 300); S.count('nV', k + 1, { delay: d + 1100, dur: 300 });
        });
        S.to('p1', { opacity: .35 }, { delay: 600, dur: 600 }); S.set('p1', { dash: '6 5' }, { delay: 600 }); st(S, 1, '无响应', C.red, 900);
        S.data({ '阶段': 'Prepare', '同意票': '2 / 3' }, { delay: 1600 }); S.log('参与者 2：没有回应', { delay: 1600, kind: 'warn' });
      });
      S.step('协调者只能等 —— 直到超时。等待期间这个事务（和它拿着的锁）就卡在那里', function () {
        S.code(4); S.set('coS', { text: '等待参与者 2 …', color: C.amber });
        S.to('trk', { opacity: 1 }, { dur: 300 });
        S.to('tmr', { x: CO[0], w: 220 }, { dur: 2600, ease: 'linear', delay: 200 });
        S.flash('l1', C.amber, { prop: 'stroke', delay: 600, hold: 1500 });
      });
      S.step('超时 → 自动切到中止阶段，告诉应用「已中止」', function () {
        S.code(5); S.code(12, { delay: 500 });
        S.flash('tmr', C.red); S.to('co', { stroke: C.red }, { dur: 350 }); S.set('coS', { text: '超时 → 中止', color: C.red }, { delay: 200 }); phase(S, '中止', 300);
        msg(S, [CO[0] - 110, CO[1]], 'app', '已中止', C.red, 600);
        S.to('app', { stroke: C.red }, { delay: 1400, dur: 350 }); S.pulse('app', { delay: 1400 });
        S.data({ '阶段': 'Abort', '事务结果': '中止（超时）' }, { delay: 300 }); S.log('超时 → 应用 ← 已中止', { delay: 1450, kind: 'err' });
      });
      S.step('已经投了 OK 的参与者 1、3 也只能跟着回滚。这就是 2PC 的致命伤：一个节点挂了，全体陪着等', function () {
        S.code(13);
        [0, 2].forEach(function (i, k) {
          var d = k * 300;
          msg(S, [CO[0], CO[1] + 28], top(i), '中止', C.red, d);
          st(S, i, '已中止', C.red, d + 850); S.to('p' + i, { stroke: C.red }, { delay: d + 850, dur: 300 });
        });
        S.log('参与者 1、3 回滚', { delay: 1200 });
      }, { hold: 2200 });
    }
  },
  {
    name: 'Paxos：多数派即可',
    moving: '接受者 2 变暗；发给它的提议半路消失；另外两票飞回后计数滚到 2 即达多数派；提交通知飞出；宕机节点恢复后日志飞过去补课',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'bool Proposer::Commit(txn) {',
      '  for (a : acceptors) Send(a, PROPOSE);',
      '  int agree = CountReplies(timeout);',
      '  if (agree < acceptors.size() / 2 + 1)',
      '    return Retry(txn);        // 没凑够多数派',
      '  Log(COMMIT, txn);',
      '  for (a : acceptors) Send(a, COMMIT);',
      '  return true;                // 掉线的节点事后补日志',
      '}'
    ].join('\n'),
    build: function (S) {
      stage(S, true);
      S.data({ '存活的接受者': '3 / 3', '同意票': '0 / 3', '多数派门槛': 2, '事务结果': '未定' });
      S.step('应用把 COMMIT 请求交给提议者（相当于 2PC 里的协调者）', function () {
        S.code(1); S.log('应用 → COMMIT');
        msg(S, 'app', [CO[0] - 110, CO[1]], 'COMMIT', C.cyan, 100); S.pulse('co', { delay: 900, scale: 1.06 }); S.set('coS', { text: '收到 COMMIT' }, { delay: 900 });
      });
      S.step('接受者 2 在事务执行过程中宕机了', function () {
        S.to('p1', { opacity: .35 }, { dur: 600 }); S.set('p1', { dash: '6 5' }); st(S, 1, '已宕机', C.red, 300);
        S.ripple(PX[1], PY, { color: C.red, delay: 100 });
        S.data({ '存活的接受者': '2 / 3' }, { delay: 300 }); S.log('接受者 2 宕机', { delay: 300, kind: 'err' });
      }, { hold: 2000 });
      S.step('提议者照常把提议发给所有接受者 —— 发给接受者 2 的那条石沉大海', function () {
        S.code(2); phase(S, '第一阶段 提议');
        [0, 2].forEach(function (i, k) { msg(S, [CO[0], CO[1] + 28], top(i), '提议', C.blue, 200 + k * 250); S.pulse('p' + i, { delay: 1000 + k * 250, scale: 1.05 }); });
        msg(S, [CO[0], CO[1] + 28], [PX[1], PY - 90], '提议', C.mute, 320, { ripple: false, dur: 700 });
        S.ripple(PX[1], PY - 90, { color: C.red, delay: 1020 });
        S.log('PROPOSE → 接受者 1 2 3', { delay: 300 });
      });
      S.step('接受者 1、3 同意 → 3 个里有 2 个，已经是多数派 → 允许提交。2PC 到这一步就卡住了', function () {
        S.code([3, 5]);
        [0, 2].forEach(function (i, k) {
          var d = k * 400;
          st(S, i, '同意', C.amber, d); S.to('p' + i, { stroke: C.amber }, { delay: d, dur: 300 });
          msg(S, top(i), [CO[0], CO[1] + 28], '同意', C.green, d + 300); S.count('nV', k + 1, { delay: d + 1100, dur: 300 }); S.pulse('nV', { delay: d + 1100 });
        });
        S.flash('nV', C.green, { prop: 'color', delay: 1700 }); S.to('co', { stroke: C.green }, { delay: 1700, dur: 350 });
        S.set('coS', { text: '2 / 3 ≥ 多数派 → 提交', color: C.green }, { delay: 1700 });
        S.data({ '同意票': '2 / 3', '事务结果': '提交' }, { delay: 1700 }); S.log('2 / 3 多数派达成', { delay: 1700, kind: 'ok' });
      });
      S.step('第二阶段：通知存活的接受者提交，并告诉应用成功', function () {
        S.code([6, 7]); phase(S, '第二阶段 提交');
        [0, 2].forEach(function (i, k) {
          msg(S, [CO[0], CO[1] + 28], top(i), '提交', C.green, 100 + k * 250);
          st(S, i, '已提交', C.green, 950 + k * 250); S.to('p' + i, { stroke: C.green }, { delay: 950 + k * 250, dur: 300 });
        });
        msg(S, [CO[0] - 110, CO[1]], 'app', '提交成功', C.green, 1300);
        S.to('app', { stroke: C.green }, { delay: 2100, dur: 350 }); S.pulse('app', { delay: 2100 });
        S.log('应用 ← 提交成功', { delay: 2150, kind: 'ok' });
      });
      S.step('接受者 2 恢复后读日志补课，照日志说的把事务提交 —— 前提是节点不作恶（非拜占庭）', function () {
        S.code(8);
        S.to('p1', { opacity: 1 }, { dur: 600 }); S.set('p1', { dash: '' }, { delay: 300 }); st(S, 1, '恢复中：读日志', C.amber, 400);
        msg(S, [CO[0], CO[1] + 28], top(1), '日志', C.purple, 800);
        st(S, 1, '已提交（补课）', C.green, 1700); S.to('p1', { stroke: C.green }, { delay: 1700, dur: 300 }); S.pulse('p1', { delay: 1700, scale: 1.05 });
        S.data({ '存活的接受者': '3 / 3' }, { delay: 1700 }); S.log('接受者 2 追上进度', { delay: 1750, kind: 'ok' });
      }, { hold: 2000 });
    }
  }
  ]
});
})();
