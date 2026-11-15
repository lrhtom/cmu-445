/* HW5 事务：依赖图 / 视图可串行 / 意向锁 / OCC 后向验证
 * 四个事务的调度、数据库与表的划分、OCC 的时间线都是讲义里自编的示意数据。 */
(function () {
var C = Viz.C, OP = '#22325a';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #5（题目 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw5-clean.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Homework #5（官方答案 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw5-sols.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #17 Concurrency Control Theory（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/17-concurrencycontrol.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #18 Two-Phase Locking（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/18-twophaselocking.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #19 Timestamp Ordering & OCC（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/19-timestampordering.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #19 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/19-timestampordering.pdf' }
];
var TC = [C.blue, C.purple, C.amber, C.green];
function note(S, t) { S.text('note', { x: 20, y: 24, text: t, anchor: 'start', size: 14, color: C.mute }); }
function title(S, id, x, y, text, o) {
  var p = { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}
/* 8 个操作的调度：[事务下标, 文字, 对象] */
var OPS = [[0, 'R(Y)', 'Y'], [1, 'W(Y)', 'Y'], [2, 'R(X)', 'X'], [0, 'W(Y)', 'Y'], [1, 'W(X)', 'X'], [2, 'W(Z)', 'Z'], [3, 'R(X)', 'X'], [3, 'W(Y)', 'Y']];
function schedule(S, x0, dx, y0, dy, op) {
  for (var t = 0; t < 4; t++) S.text('tn' + t, { x: x0 - 52, y: y0 + t * dy, text: 'T' + (t + 1), size: 17, weight: 700, color: TC[t] });
  for (var k = 0; k < 8; k++) {
    S.text('tk' + k, { x: x0 + k * dx, y: y0 - 34, text: 't' + (k + 1), size: 14, color: C.mute });
    S.box('op' + k, { x: x0 + k * dx, y: y0 + OPS[k][0] * dy, w: dx - 8, h: 32, rx: 6, fill: OP, stroke: TC[OPS[k][0]], sw: 1.6, label: OPS[k][1], size: 15, opacity: op });
  }
}

Viz.register('hw5-txn', {
  title: 'HW5：依赖图 · 视图可串行 · 意向锁 · OCC 验证',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：依赖图 ───────────── */
  {
    name: '画依赖图',
    moving: '操作按时间依次弹出；同一对象的操作被高亮；冲突对之间飞出数据包、依赖图里的箭头随之长出来；成环的两条边变红闪烁',
    lang: '方法',
    code: [
      'for 每个对象 o：',
      '  把 o 上的操作按时间排好',
      '  for 每一对 (先 p, 后 q)：',
      '    if 不同事务 且 至少一个是写：',
      '      加边 Txn(p) → Txn(q)',
      '',
      'Y：R1 W2 W1 W4',
      '  → T1→T2, T2→T1, T1→T4, T2→T4',
      'X：R3 W2 R4',
      '  → T3→T2, T2→T4',
      'Z：W3（只有一个，无冲突）',
      '',
      '有环 T1⇄T2 → 不是冲突可串行',
      '→ 2PL 不可能产生这个调度'
    ].join('\n'),
    build: function (S) {
      var X0 = 120, DX = 62, Y0 = 120, DY = 52;
      var N = [[700, 110], [790, 250], [610, 390], [790, 420]];
      note(S, '调度为示意');
      schedule(S, X0, DX, Y0, DY, 0);
      title(S, 'tG', 640, 66, '依赖图');
      N.forEach(function (p, t) { S.dot('n' + t, { x: p[0], y: p[1], r: 28, fill: C.panel, label: 'T' + (t + 1), color: TC[t], size: 17 }); });
      function edge(id, a, b, off) {
        var A = N[a], B = N[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L, px = -uy * (off || 0), py = ux * (off || 0);
        S.line(id, { x1: A[0] + ux * 30 + px, y1: A[1] + uy * 30 + py, x2: B[0] - ux * 32 + px, y2: B[1] - uy * 32 + py, stroke: C.line, sw: 2.4, arrow: true, opacity: 0, draw: 0 });
      }
      edge('e12', 0, 1, 9); edge('e21', 1, 0, 9); edge('e14', 0, 3, 0); edge('e24', 1, 3, 0); edge('e32', 2, 1, 0);
      S.text('lab', { x: 330, y: 360, text: '', size: 16, weight: 700, color: C.amber });
      S.text('lab2', { x: 330, y: 396, text: '', size: 15, color: C.mute });
      S.text('res', { x: 330, y: 470, text: '', size: 17, weight: 700, color: C.red });
      S.data({ '边': '—' });
      function grow(id, d, col) { S.to(id, { opacity: 1, draw: 1, stroke: col || C.cyan }, { delay: d, dur: 600 }); S.to(id, { stroke: C.line }, { delay: d + 900, dur: 400 }); }
      function conflict(a, b, d) { S.fly('op' + a, 'op' + b, { color: C.cyan, delay: d, dur: 600 }); }
      function hi(list, col, d) { list.forEach(function (k, n) { S.to('op' + k, { fill: col }, { delay: (d || 0) + n * 80, dur: 250 }); }); }
      function lo(list, d) { list.forEach(function (k) { S.to('op' + k, { fill: OP }, { delay: d || 0, dur: 300 }); }); }

      S.step('调度：4 个事务、8 个操作，时间从左往右', function () {
        for (var k = 0; k < 8; k++) S.pop('op' + k, { delay: k * 150 });
      });
      S.step('先按对象分组：Y 上的操作按时间是 R1、W2、W1、W4', function () {
        S.code([1, 2]);
        hi([0, 1, 3, 7], '#4a3b1a');
        S.set('lab', { text: 'Y：R1(t1)  W2(t2)  W1(t4)  W4(t8)' }, { delay: 300 });
      });
      S.step('Y：R1 在 W2 之前（读-写）→ T1→T2；W2 在 W1 之前（写-写）→ T2→T1', function () {
        S.code([3, 5]);
        conflict(0, 1, 0); grow('e12', 600);
        conflict(1, 3, 900); grow('e21', 1500);
        S.set('lab2', { text: 'R1→W2：T1→T2 · W2→W1：T2→T1' }, { delay: 300 });
        S.data({ '边': 'T1→T2, T2→T1' }, { delay: 1600 });
      });
      S.step('Y 还有：R1、W1 都在 W4 之前 → T1→T4；W2 在 W4 之前 → T2→T4', function () {
        S.code([7, 8]);
        conflict(0, 7, 0); conflict(3, 7, 200); grow('e14', 700);
        conflict(1, 7, 900); grow('e24', 1500);
        S.set('lab2', { text: 'R1/W1→W4：T1→T4 · W2→W4：T2→T4' }, { delay: 300 });
        S.data({ '边': 'T1→T2, T2→T1, T1→T4, T2→T4' }, { delay: 1600 });
      });
      S.step('X 上：R3、W2、R4 —— R3→W2 得 T3→T2；W2→R4 得 T2→T4（已经有了）', function () {
        S.code([9, 10]);
        lo([0, 1, 3, 7]); hi([2, 4, 6], '#4a3b1a', 200);
        S.set('lab', { text: 'X：R3(t3)  W2(t5)  R4(t7)' }, { delay: 300 });
        conflict(2, 4, 500); grow('e32', 1100);
        conflict(4, 6, 1300); S.flash('e24', C.cyan, { prop: 'stroke', delay: 1900 });
        S.set('lab2', { text: 'R3→W2：T3→T2 · W2→R4：T2→T4' }, { delay: 600 });
        S.data({ '边': 'T1→T2, T2→T1, T1→T4, T2→T4, T3→T2' }, { delay: 1800 });
      });
      S.step('Z 上只有 W3 一个操作 —— 没有冲突，不加边；读-读也从来不算冲突', function () {
        S.code(11);
        lo([2, 4, 6]); hi([5], '#4a3b1a', 200);
        S.set('lab', { text: 'Z：W3(t6)' }, { delay: 300 }); S.set('lab2', { text: '只有一个操作 → 无边' }, { delay: 300 });
        S.pulse('op5', { delay: 400 });
      });
      S.step('依赖图里有环：T1 → T2 → T1 —— 所以不是冲突可串行的', function () {
        S.code(13); lo([5]);
        S.to('e12', { stroke: C.red }, { dur: 300 }); S.to('e21', { stroke: C.red }, { delay: 150, dur: 300 });
        S.pulse('n0', { delay: 400 }); S.pulse('n1', { delay: 600 });
        S.flash('e12', C.amber, { prop: 'stroke', delay: 900 }); S.flash('e21', C.amber, { prop: 'stroke', delay: 1000 });
        S.set('lab', { text: '' }); S.set('lab2', { text: '' });
        S.set('res', { text: '有环 → 不是冲突可串行' }, { delay: 500 });
        S.log('环：T1 → T2 → T1', { delay: 600, kind: 'err' });
      });
      S.step('2PL 只会产生冲突可串行的调度 → 在 2PL 下这个调度不可能出现', function () {
        S.code(14);
        S.set('res', { text: '有环 → 不是冲突可串行 → 2PL 产生不了它' }, { delay: 200 });
        S.pulse('res', { delay: 200, scale: 1.05 });
        S.log('但它可能是视图可串行的 → 下一个场景', { delay: 600 });
      }, { hold: 1600 });
    }
  },

  /* ───────────── 场景 2：视图可串行 ───────────── */
  {
    name: '视图可串行：三件事',
    moving: '三条检查规则依次点亮、对应的操作闪烁；推出的先后约束化作箭头；四个事务的方块滑进串行顺序的空位；被覆盖的盲写变暗',
    lang: '方法',
    code: [
      '视图等价：三件事一样',
      '  ① 谁读了初值',
      '  ② 谁读了谁写的值',
      '  ③ 谁写了最终值',
      '',
      '① T1 读 Y 初值 → T1 在 T2、T4 前',
      '  T3 读 X 初值 → T3 在 T2 前',
      '② T4 读 T2 写的 X → T2 在 T4 前',
      '③ Y 最后由 T4 写 → T4 在 T1、T2 后',
      '  X 最后由 T2 写，Z 最后由 T3 写',
      '',
      '→ T1, T3, T2, T4（视图可串行）',
      'W2(Y)、W1(Y) 没人读、被 W4 覆盖'
    ].join('\n'),
    build: function (S) {
      var X0 = 120, DX = 62, Y0 = 104, DY = 44;
      note(S, '调度与场景 1 相同（示意）');
      schedule(S, X0, DX, Y0, DY, 1);
      var R = ['① 谁读了初值', '② 谁读了谁写的', '③ 谁写了最终值'];
      R.forEach(function (t, i) {
        S.box('r' + i, { x: 720, y: 96 + i * 62, w: 220, h: 46, rx: 9, fill: C.panel, stroke: C.line, sw: 1.5, label: t, size: 16, opacity: .45 });
      });
      S.text('c1', { x: 330, y: 300, text: '', size: 16, color: C.ink });
      S.text('c2', { x: 330, y: 332, text: '', size: 16, color: C.ink });
      S.text('c3', { x: 330, y: 364, text: '', size: 16, color: C.ink });
      title(S, 'tL', 40, 420, '串行顺序');
      for (var i = 0; i < 4; i++) S.box('sl' + i, { x: 220 + i * 150, y: 470, w: 120, h: 50, rx: 10, fill: 'none', stroke: C.line, sw: 1.5, dash: '6 5' });
      [0, 2, 1, 3].forEach(function (t, i) { S.box('st' + t, { x: 760, y: 420, w: 110, h: 44, rx: 10, fill: C.panel, stroke: TC[t], sw: 2.5, label: 'T' + (t + 1), color: TC[t], size: 18, opacity: 0 }); });
      S.text('res', { x: 430, y: 530, text: '', size: 16, weight: 700, color: C.green });
      S.data({ '约束': '—' });
      function rule(i) { S.to('r' + i, { opacity: 1, stroke: C.blue }, { dur: 300 }); if (i) S.to('r' + (i - 1), { stroke: C.line }, { dur: 300 }); }

      S.step('视图等价只看三件事：谁读了初值、谁读了谁写的值、谁写了最终值', function () {
        S.code([1, 4]);
        [0, 1, 2].forEach(function (i) { S.pulse('r' + i, { delay: i * 200, scale: 1.05 }); });
      }, { hold: 1600 });
      S.step('① 读初值：T1 读的 Y、T3 读的 X 都是初值 → T1 要在写 Y 的 T2、T4 之前；T3 要在写 X 的 T2 之前', function () {
        S.code([6, 7]); rule(0);
        S.flash('op0', C.blue, { delay: 300 }); S.pulse('op0', { delay: 300 }); S.flash('op2', C.blue, { delay: 600 }); S.pulse('op2', { delay: 600 });
        S.set('c1', { text: 'T1 < T2、T1 < T4、T3 < T2' }, { delay: 800 }); S.pulse('c1', { delay: 800 });
        S.data({ '约束': 'T1<T2, T1<T4, T3<T2' }, { delay: 900 });
      }, { hold: 1800 });
      S.step('② 读谁写的：T4 在 t7 读到的 X 是 T2 在 t5 写的 → T2 要在 T4 之前', function () {
        S.code(8); rule(1);
        S.fly('op4', 'op6', { color: C.cyan, delay: 200, dur: 700 }); S.pulse('op6', { delay: 900 });
        S.set('c2', { text: 'T2 < T4' }, { delay: 900 }); S.pulse('c2', { delay: 900 });
        S.data({ '约束': 'T1<T2, T1<T4, T3<T2, T2<T4' }, { delay: 1000 });
      });
      S.step('③ 最终写：Y 最后由 T4 写、X 由 T2、Z 由 T3 → T4 要排在另外两个写 Y 的 T1、T2 之后', function () {
        S.code([9, 10]); rule(2);
        S.flash('op7', C.green, { delay: 200 }); S.flash('op4', C.green, { delay: 400 }); S.flash('op5', C.green, { delay: 600 });
        S.set('c3', { text: 'T1 < T4、T2 < T4' }, { delay: 800 }); S.pulse('c3', { delay: 800 });
      }, { hold: 1600 });
      S.step('按这些约束排出一个串行顺序：T1、T3、T2、T4', function () {
        S.code(12); S.to('r2', { stroke: C.line }, { dur: 300 });
        [0, 2, 1, 3].forEach(function (t, i) {
          S.pop('st' + t, { delay: i * 300 });
          S.move('st' + t, 220 + i * 150, 470, { delay: i * 300 + 200, dur: 700 });
          S.ripple(220 + i * 150, 470, { delay: i * 300 + 900, color: TC[t] });
        });
      });
      S.step('照这个顺序串行执行，三件事和原调度完全一样 → 视图可串行', function () {
        S.code(12);
        [0, 1, 2].forEach(function (i) { S.to('r' + i, { stroke: C.green }, { delay: i * 200, dur: 300 }); S.flash('r' + i, '#1f5c47', { delay: i * 200 }); });
        S.set('res', { text: '视图可串行 ✓（但不是冲突可串行）' }, { delay: 700 });
        S.log('等价串行顺序：T1 T3 T2 T4', { delay: 800, kind: 'ok' });
      });
      S.step('依赖图里那个环来自 Y 上的 W2、W1 —— 这两个值没人读过，最后又被 W4 覆盖（W2 是盲写）', function () {
        S.code(13);
        S.to('op1', { opacity: .35 }, { delay: 200, dur: 400 }); S.to('op3', { opacity: .35 }, { delay: 350, dur: 400 });
        S.flash('op7', C.amber, { delay: 800 }); S.pulse('op7', { delay: 800 });
        S.log('视图可串行能接受盲写，冲突可串行不能', { delay: 1000 });
      }, { hold: 1800 });
    }
  },

  /* ───────────── 场景 3：意向锁 ───────────── */
  {
    name: '意向锁：选锁与兼容',
    moving: '锁标签从事务飞到树上的节点、落定时弹一下；兼容性矩阵里对应的格子高亮；冲突时请求标签变红并被弹回、等待；放锁时标签缩小消失、等待者的锁飞上去',
    lang: '规则',
    code: [
      '自顶向下：',
      '  下面要读 → 这一层至少 IS',
      '  下面要写 → 这一层至少 IX',
      '  这一层全读 + 下面改一点 → SIX',
      '  真正操作的那层：S 或 X',
      '',
      '甲：扫 Orders 只读',
      '  IS(D), S(Orders)',
      '乙：改 U17.5',
      '  IX(D), IX(Users), IX(U17), X(U17.5)',
      '丙：扫 O100–O900，改 O450.3',
      '  IX(D), SIX(Orders), IX(O450),',
      '  X(O450.3)',
      '',
      '兼容：IS-IX ✓  S-SIX ✗  IX-IX ✓'
    ].join('\n'),
    build: function (S) {
      var ND = { D: [430, 92, '数据库 D'], O: [250, 196, 'Orders'], U: [610, 196, 'Users'], P: [250, 300, '页 O450'], Q: [610, 300, '页 U17'], A: [250, 404, '记录 O450.3'], B: [610, 404, '记录 U17.5'] };
      note(S, '库表与页号为示意');
      [['D', 'O'], ['D', 'U'], ['O', 'P'], ['U', 'Q'], ['P', 'A'], ['Q', 'B']].forEach(function (e) {
        S.line('l' + e[0] + e[1], { x1: ND[e[0]][0], y1: ND[e[0]][1] + 22, x2: ND[e[1]][0], y2: ND[e[1]][1] - 22, stroke: C.line, sw: 2 });
      });
      Object.keys(ND).forEach(function (k) { S.box('N' + k, { x: ND[k][0], y: ND[k][1], w: 150, h: 44, rx: 9, fill: C.panel, stroke: C.line, sw: 1.8, label: ND[k][2], size: 16 }); });
      S.box('w0', { x: 60, y: 150, w: 70, h: 40, rx: 10, fill: C.panel, stroke: C.blue, sw: 2, label: '甲', color: C.blue, size: 17 });
      S.box('w1', { x: 800, y: 150, w: 70, h: 40, rx: 10, fill: C.panel, stroke: C.purple, sw: 2, label: '乙', color: C.purple, size: 17 });
      S.box('w2', { x: 60, y: 470, w: 70, h: 40, rx: 10, fill: C.panel, stroke: C.amber, sw: 2, label: '丙', color: C.amber, size: 17, opacity: 0 });
      /* 锁标签：放在节点旁边 */
      function tag(id, node, side, label, col) {
        var x = ND[node][0] + side * 112, y = ND[node][1];
        S.box(id, { x: x, y: y, w: 66, h: 30, rx: 6, fill: col, stroke: 'none', sw: 0, label: label, color: C.bg, size: 15, opacity: 0 });
        return [x, y];
      }
      function give(id, from, d) {
        var a = S.pos(id); S.set(id, { x: S.pos(from).x, y: S.pos(from).y }, { delay: d });
        S.to(id, { opacity: 1 }, { delay: d, dur: 150 }); S.move(id, a.x, a.y, { delay: d, dur: 650 }); S.pulse(id, { delay: d + 650 });
      }
      tag('aD', 'D', -1, 'IS', C.blue); tag('aO', 'O', -1, 'S', C.blue);
      tag('bD', 'D', 1, 'IX', C.purple); tag('bU', 'U', 1, 'IX', C.purple); tag('bQ', 'Q', 1, 'IX', C.purple); tag('bB', 'B', 1, 'X', C.purple);
      S.box('cD', { x: ND.D[0] - 112, y: ND.D[1] + 34, w: 66, h: 30, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: 'IX', color: C.bg, size: 15, opacity: 0 });
      tag('cO', 'O', 1, 'SIX', C.amber); tag('cP', 'P', 1, 'IX', C.amber); tag('cA', 'A', 1, 'X', C.amber);
      S.text('msg', { x: 430, y: 520, text: '', size: 16, weight: 700, color: C.ink });
      S.text('mx', { x: 840, y: 470, anchor: 'end', text: '', size: 15, color: C.mute });
      S.data({ '甲': '—', '乙': '—', '丙': '—' });

      S.step('锁的层次：数据库 → 表 → 页 → 记录；高层一把锁隐含锁住下面的一切', function () {
        S.code(1);
        ['ND', 'NO', 'NU', 'NP', 'NQ', 'NA', 'NB'].forEach(function (id, i) { S.pulse(id, { delay: i * 110, scale: 1.06 }); });
      });
      S.step('甲要扫 Orders 全表、只读：D 上拿 IS（"下面有人读"），Orders 上拿一把 S', function () {
        S.code([7, 8]);
        give('aD', 'w0', 0); give('aO', 'w0', 400);
        S.data({ '甲': 'IS(D), S(Orders)' }, { delay: 1100 }); S.log('甲：IS(D), S(Orders)', { delay: 1100, kind: 'ok' });
      });
      S.step('乙要改 U17.5：一路拿 IX 下来，只在那条记录上拿 X', function () {
        S.code([9, 10]);
        give('bD', 'w1', 0); give('bU', 'w1', 300); give('bQ', 'w1', 600); give('bB', 'w1', 900);
        S.data({ '乙': 'IX(D), IX(Users), IX(U17), X(U17.5)' }, { delay: 1600 });
      });
      S.step('D 上同时有甲的 IS 和乙的 IX —— 兼容；两人动的又是不同的表 → 完全并行', function () {
        S.code(15);
        S.flash('aD', C.green, { delay: 100 }); S.flash('bD', C.green, { delay: 100 }); S.flash('ND', C.green, { prop: 'stroke', delay: 300 });
        S.set('msg', { text: 'IS 与 IX 兼容 ✓', color: C.green }, { delay: 300 }); S.log('甲、乙并行', { delay: 400, kind: 'ok' });
      }, { hold: 1600 });
      S.step('丙要扫 O100–O900 并改 O450.3：D 上拿 IX，Orders 上要 SIX —— 可甲正拿着 S(Orders)', function () {
        S.code([11, 13]); S.set('msg', { text: '' });
        S.pop('w2');
        S.set('cD', { x: 60, y: 470 }, { delay: 300 }); S.to('cD', { opacity: 1 }, { delay: 300, dur: 150 }); S.move('cD', ND.D[0] - 112, ND.D[1] + 34, { delay: 300, dur: 650 }); S.pulse('cD', { delay: 950 });
        S.set('cO', { x: 60, y: 470 }, { delay: 1100 }); S.to('cO', { opacity: 1 }, { delay: 1100, dur: 150 }); S.move('cO', ND.O[0] + 60, ND.O[1], { delay: 1100, dur: 600, ease: 'in' });
        S.to('cO', { fill: C.red }, { delay: 1700, dur: 150 }); S.ripple(ND.O[0] + 75, ND.O[1], { delay: 1700, color: C.red });
        S.move('cO', 150, 470, { delay: 1850, dur: 500, ease: 'out' });
        S.set('msg', { text: 'S 与 SIX 不兼容 → 丙等待', color: C.red }, { delay: 1800 }); S.log('丙：SIX(Orders) 等待中', { delay: 1850, kind: 'warn' });
        S.data({ '丙': 'IX(D) ✓，SIX(Orders) 等待' }, { delay: 1900 });
      });
      S.step('甲读完提交，放掉全部锁 → 丙拿到 SIX(Orders)，再拿 IX(O450)、X(O450.3)', function () {
        S.code([12, 13]);
        S.to('aD', { scale: .3, opacity: 0 }, { dur: 400, ease: 'in' }); S.to('aO', { scale: .3, opacity: 0 }, { delay: 100, dur: 400, ease: 'in' });
        S.to('cO', { fill: C.amber }, { delay: 500, dur: 200 }); S.move('cO', ND.O[0] + 112, ND.O[1], { delay: 500, dur: 650 }); S.pulse('cO', { delay: 1150 });
        S.set('cP', { x: 60, y: 470 }, { delay: 1100 }); S.to('cP', { opacity: 1 }, { delay: 1100, dur: 150 }); S.move('cP', ND.P[0] + 112, ND.P[1], { delay: 1100, dur: 600 });
        S.set('cA', { x: 60, y: 470 }, { delay: 1500 }); S.to('cA', { opacity: 1 }, { delay: 1500, dur: 150 }); S.move('cA', ND.A[0] + 112, ND.A[1], { delay: 1500, dur: 600 }); S.pulse('cA', { delay: 2100 });
        S.set('msg', { text: '丙：IX(D), SIX(Orders), IX(O450), X(O450.3)', color: C.amber }, { delay: 2100 });
        S.data({ '甲': '已提交', '丙': 'IX(D), SIX(Orders), IX(O450), X(O450.3)' }, { delay: 2100 });
      });
      S.step('为什么不直接 X(Orders)：SIX 下别人还能拿 IS 进来读其他记录；X 会把所有人挡在外面', function () {
        S.code(4);
        S.flash('cO', C.green, { delay: 200 }); S.pulse('cO', { delay: 200 });
        S.set('mx', { text: 'SIX 只和 IS 兼容；X 和谁都不兼容' }, { delay: 400 });
        S.log('满足正确性的前提下选最弱的锁', { delay: 600, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────── 场景 4：OCC 后向验证 ───────────── */
  {
    name: 'OCC：后向验证',
    moving: '操作沿三条时间线依次弹出；读操作把带版本号的 X 拷进私有工作区；验证时时间戳徽章弹出、读集和写集逐个比对；写阶段把新版本飞进全局数据库、版本号滚动；被中止的事务整行变暗',
    lang: '后向验证（示意）',
    code: [
      '读：把对象连同写时间戳拷进工作区',
      '验证开始：分配时间戳 ts',
      'for 每个在我运行期间提交的 Tj：',
      '  for x in WS(Tj) ∩ RS(我)：',
      '    if 我读的 x 是 Tj 之前的版本：',
      '      中止',
      '写阶段：工作区改动装进数据库',
      '',
      'T1：ts=1，没有可比的 → 通过',
      'T2：ts=2，读的是 X@0，T1 写了 X@1',
      '    → 漏读 → 中止',
      'T3：ts=3，读的是 X@1 → 通过',
      '只比集合（不看版本）会误杀 T3'
    ].join('\n'),
    build: function (S) {
      var LY = [140, 236, 332], X0 = 130, DX = 54;
      function tx(t) { return X0 + (t - 1) * DX; }
      note(S, '调度为示意；X@1 表示「写时间戳为 1 的 X」');
      for (var t = 1; t <= 13; t++) S.text('tt' + t, { x: tx(t), y: 76, text: String(t), size: 14, color: C.mute });
      ['T1', 'T2', 'T3'].forEach(function (n, i) {
        S.line('ln' + i, { x1: tx(1) - 30, y1: LY[i], x2: tx(13) + 28, y2: LY[i], stroke: C.line, sw: 1.5, dash: '4 5' });
        S.text('tl' + i, { x: 40, y: LY[i], text: n, anchor: 'start', size: 18, weight: 700, color: TC[i] });
        S.text('rw' + i, { x: 40, y: LY[i] + 34, text: '', anchor: 'start', size: 14, color: C.mute });
      });
      var EV = [[1, 0, 'R(X)'], [2, 1, 'R(Y)'], [3, 0, 'W(X)'], [4, 1, 'R(X)'], [5, 2, 'R(Z)'], [6, 0, '验证'], [7, 0, '写'], [8, 1, 'W(Y)'], [9, 2, 'R(X)'], [10, 1, '验证'], [11, 2, 'W(Z)'], [12, 2, '验证'], [13, 2, '写']];
      EV.forEach(function (e, k) {
        var v = e[2] === '验证' || e[2] === '写';
        S.box('ev' + k, { x: tx(e[0]), y: LY[e[1]], w: 50, h: 32, rx: 6, fill: v ? '#3a2f66' : OP, stroke: TC[e[1]], sw: 1.5, label: e[2], size: 14, opacity: 0 });
      });
      S.box('db', { x: 430, y: 450, w: 400, h: 70, rx: 12, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('dbT', { x: 250, y: 430, text: '全局数据库', anchor: 'start', size: 14, color: C.mute });
      S.text('dbX', { x: 430, y: 458, val: 0, pre: 'X 的写时间戳 = ', size: 18, weight: 700, color: C.cyan });
      S.text('vd', { x: 430, y: 520, text: '', size: 16, weight: 700, color: C.ink });
      ['ts0', 'ts1', 'ts2'].forEach(function (id, i) { S.dot(id, { x: tx([6, 10, 12][i]), y: LY[i] - 34, r: 15, fill: C.purple, label: 'ts' + (i + 1), color: C.bg, size: 14, opacity: 0 }); });
      S.data({ 'RS(T2)': '—', 'RS(T3)': '—', 'WS(T1)': '—' });

      S.step('t1–t5：三个事务各在私有工作区里读写；读到的对象带着它的写时间戳一起拷进来', function () {
        S.code(1);
        [0, 1, 2, 3, 4].forEach(function (k) { S.pop('ev' + k, { delay: k * 250 }); });
        S.set('rw0', { text: 'RS {X@0}　WS {X}' }, { delay: 600 }); S.set('rw1', { text: 'RS {Y, X@0}' }, { delay: 900 }); S.set('rw2', { text: 'RS {Z}' }, { delay: 1100 });
        S.fly('db', 'ev0', { label: 'X@0', w: 46, h: 26, color: C.cyan, delay: 100, dur: 600 });
        S.fly('db', 'ev3', { label: 'X@0', w: 46, h: 26, color: C.cyan, delay: 850, dur: 600 });
        S.data({ 'WS(T1)': '{X}', 'RS(T2)': '{Y, X@0}', 'RS(T3)': '{Z}' }, { delay: 1300 });
      });
      S.step('t6：T1 进入验证，此刻才拿到时间戳 1；在它之前没有已提交的事务 → 通过', function () {
        S.code([2, 3]);
        S.pop('ev5'); S.pop('ts0', { delay: 300 });
        S.set('vd', { text: 'T1 验证：无可比的事务 → 通过 ✓', color: C.green }, { delay: 600 }); S.log('T1 通过（ts = 1）', { delay: 700, kind: 'ok' });
      });
      S.step('t7：T1 写阶段 —— 把 X 装进全局数据库，X 的写时间戳变成 1', function () {
        S.code(7);
        S.pop('ev6'); S.fly('ev6', 'db', { label: 'X@1', w: 46, h: 26, color: C.green, delay: 300, dur: 750 });
        S.count('dbX', 1, { delay: 1050, dur: 300 }); S.pulse('db', { delay: 1050, scale: 1.04 });
        S.set('vd', { text: '' });
      });
      S.step('t8–t9：T2 在工作区里写 Y；T3 读 X —— 读到的是 T1 刚装入的新版本 X@1', function () {
        S.code(1);
        S.pop('ev7'); S.pop('ev8', { delay: 400 });
        S.fly('db', 'ev8', { label: 'X@1', w: 46, h: 26, color: C.cyan, delay: 500, dur: 650 });
        S.set('rw2', { text: 'RS {Z, X@1}' }, { delay: 1150 }); S.data({ 'RS(T3)': '{Z, X@1}' }, { delay: 1150 });
      });
      S.step('t10：T2 验证（ts = 2）—— T1 在 T2 运行期间提交了，写集 {X} 和 T2 的读集 {Y, X} 相交', function () {
        S.code([3, 4]);
        S.pop('ev9'); S.pop('ts1', { delay: 300 });
        S.flash('rw0', C.amber, { prop: 'color', delay: 500 }); S.flash('rw1', C.amber, { prop: 'color', delay: 700 });
        S.set('vd', { text: 'WS(T1) ∩ RS(T2) = {X}', color: C.amber }, { delay: 800 });
      });
      S.step('T2 读到的是 X@0，比 T1 写的 X@1 旧 —— 它漏看了 T1 的写 → 中止', function () {
        S.code([5, 6]);
        S.flash('ev3', C.red, { delay: 100 }); S.pulse('ev3', { delay: 100 });
        S.set('vd', { text: 'T2 读的是 X@0 → 漏读 → 中止 ✗', color: C.red }, { delay: 500 });
        [1, 3, 7, 9].forEach(function (k) { S.to('ev' + k, { opacity: .3 }, { delay: 900, dur: 500 }); });
        S.to('tl1', { color: C.red }, { delay: 900, dur: 300 }); S.to('ts1', { opacity: .3 }, { delay: 900, dur: 400 });
        S.log('T2 中止', { delay: 900, kind: 'err' });
      });
      S.step('t11–t12：T3 写 Z 后验证（ts = 3）—— T1 的写集 {X} 也和 T3 的读集相交，但 T3 读到的正是 X@1 → 没有漏读，通过', function () {
        S.code([4, 5]);
        S.pop('ev10'); S.pop('ev11', { delay: 400 }); S.pop('ts2', { delay: 700 });
        S.flash('ev8', C.green, { delay: 900 }); S.pulse('ev8', { delay: 900 });
        S.set('vd', { text: 'T3 读的是 X@1 → 通过 ✓（T2 已中止，不用比）', color: C.green }, { delay: 1000 });
        S.log('T3 通过（ts = 3）', { delay: 1100, kind: 'ok' });
      });
      S.step('对照：只比集合、不看读到哪个版本的保守写法，会把 T3 也误杀 —— 读题时按课上的判法', function () {
        S.code(13);
        S.flash('rw2', C.red, { prop: 'color', delay: 200 });
        S.set('vd', { text: '保守写法：WS(T1) ∩ RS(T3) ≠ ∅ → 中止（误杀）', color: C.mute }, { delay: 300 });
        S.log('课上按「有没有读到旧版本」判', { delay: 600, kind: 'warn' });
      }, { hold: 1800 });
      S.step('t13：T3 写阶段，把 Z 装进数据库 —— 最终提交的是 T1 和 T3', function () {
        S.code(7);
        S.pop('ev12'); S.fly('ev12', 'db', { label: 'Z', w: 40, h: 26, color: C.green, delay: 300, dur: 700 });
        S.set('vd', { text: '提交：T1、T3　中止：T2', color: C.green }, { delay: 1000 });
        S.log('最终：T1 ✓  T2 ✗  T3 ✓', { delay: 1100, kind: 'ok' });
      });
    }
  }
  ]
});
})();
