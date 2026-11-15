/* #10 Latch Crabbing：读蟹行 / 悲观写蟹行 / 乐观蟹行 / 叶子扫描 no-wait
 * 树的形状与键值取自官方 Slides 的例子（每个节点最多 2 个键）；左子树只画了一个桩。
 * 线程用颜色区分：T1 蓝、T2 紫；latch 徽章 R = 空心（读，可共享）、W = 实心（写，独占）。 */
(function () {
var C = Viz.C, KEY = '#2b4172', NW = 112, NH = 44, TC = { 1: C.blue, 2: C.purple };

function node(S, id, p, keys) {
  S.box('n' + id, { x: p.x, y: p.y, w: NW, h: NH, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
  S.text('t' + id, { x: p.x - 42, y: p.y, text: p.name || id, color: C.mute, size: 16, weight: 700 });
  keys.forEach(function (k, i) {
    S.box('k' + id + i, { x: p.x - 8 + i * 40, y: p.y, w: 36, h: 30, rx: 5, fill: KEY, stroke: 'none', sw: 0, label: String(k), size: 16 });
  });
}
function edge(S, id, a, j, b) {
  S.line(id, { x1: a.x - 28 + j * 40, y1: a.y + NH / 2, x2: b.x, y2: b.y - NH / 2, stroke: C.line, sw: 2, arrow: true });
}

/* 一个场景里两个线程的 latch / 游标 / 状态行 */
function Ctx(S, P, chips) {
  var held = { 1: {}, 2: {} }, wait = {}, uid = 0, me = this;
  function slot(th, nd) { var p = P[nd], s = th === 1 ? -1 : 1; return p.leaf ? [p.x + s * 26, p.y + 54] : [p.x + s * 92, p.y]; }
  function src(th, f) { return f ? slot(th, f) : chips[th]; }
  function mk(th, mode, at, waiting) {
    var id = 'b' + th + '_' + (uid++), col = TC[th], solid = mode === 'W' && !waiting;
    S.box(id, { x: at[0], y: at[1], w: 34, h: 24, rx: 7, fill: solid ? col : C.bg, stroke: waiting ? C.amber : col, sw: 2, dash: waiting ? '4 3' : '',
      label: mode, color: waiting ? C.amber : (solid ? C.bg : col), size: 15, weight: 700, opacity: 0, trail: 3 });
    return id;
  }
  [1, 2].forEach(function (th) {
    S.box('cur' + th, { x: 0, y: 0, w: NW + (th === 1 ? 14 : 28), h: NH + (th === 1 ? 14 : 28), rx: 14, fill: 'none', stroke: TC[th], sw: 3, opacity: 0 });
    S.text('st' + th, { x: 30, y: th === 1 ? 500 : 526, anchor: 'start', text: 'T' + th + ' 持有：—', color: TC[th], size: 15, weight: 600 });
  });
  S.text('vd', { x: 430, y: P.vy || 462, text: '', size: 16, weight: 700, opacity: 0 });

  this.slot = slot;
  /* 拿 latch：徽章从父节点的槽位（或线程标签）飞到目标槽位，落地涟漪 */
  this.acquire = function (th, nd, mode, o) {
    o = o || {};
    var d = o.delay || 0, dur = o.dur || 650, to = slot(th, nd), id = mk(th, mode, src(th, o.from), false);
    S.to(id, { opacity: 1 }, { dur: 120, delay: d }); S.move(id, to[0], to[1], { dur: dur, delay: d });
    S.ripple(to[0], to[1], { delay: d + dur, color: TC[th] }); S.pulse(id, { delay: d + dur });
    held[th][nd] = { id: id, mode: mode };
    return d + dur;
  };
  this.release = function (th, nd, o) {
    var h = held[th][nd]; if (!h) throw new Error('T' + th + ' 没有持有 ' + nd);
    delete held[th][nd];
    S.to(h.id, { scale: .2, opacity: 0 }, { dur: 380, delay: (o && o.delay) || 0, ease: 'in' });
  };
  this.releaseAll = function (th, o) {
    var d = (o && o.delay) || 0, k = 0;
    Object.keys(held[th]).forEach(function (nd) { me.release(th, nd, { delay: d + (k++) * 220 }); });
    return d + k * 220 + 380;
  };
  /* 被不兼容的 latch 挡住：黄色虚线徽章停在槽位外侧 */
  this.want = function (th, nd, mode, o) {
    o = o || {};
    var d = o.delay || 0, dur = o.dur || 650, to = slot(th, nd), s = th === 1 ? -1 : 1, w = P[nd].leaf ? [to[0], to[1] + 30] : [to[0] + s * 40, to[1]];
    var id = mk(th, mode, src(th, o.from), true);
    S.to(id, { opacity: 1 }, { dur: 120, delay: d }); S.move(id, w[0], w[1], { dur: dur, delay: d });
    S.ripple(w[0], w[1], { delay: d + dur, color: C.red });
    wait[th] = { id: id, nd: nd, mode: mode };
    return d + dur;
  };
  this.grant = function (th, o) {
    var w = wait[th], d = (o && o.delay) || 0, to = slot(th, w.nd), col = TC[th], solid = w.mode === 'W';
    S.set(w.id, { dash: '' }, { delay: d });
    S.to(w.id, { x: to[0], y: to[1], stroke: col, fill: solid ? col : C.bg, color: solid ? C.bg : col }, { dur: 450, delay: d });
    S.ripple(to[0], to[1], { delay: d + 450, color: col }); S.pulse(w.id, { delay: d + 450 });
    held[th][w.nd] = { id: w.id, mode: w.mode }; delete wait[th];
    return d + 450;
  };
  this.giveUp = function (th, o) {
    var w = wait[th]; delete wait[th];
    S.to(w.id, { scale: .2, opacity: 0 }, { dur: 380, delay: (o && o.delay) || 0, ease: 'in' });
  };
  this.badge = function (th, nd) { return held[th][nd].id; };
  /* 从线程标签出发，拿到 latch 之后游标才落到节点上 */
  this.enter = function (th, nd, mode, t) {
    t = t || 0;
    var e = me.acquire(th, nd, mode, { delay: t, dur: 700 });
    S.set('cur' + th, { x: P[nd].x, y: P[nd].y }, { delay: t }); S.pop('cur' + th, { delay: e });
    return e + 450;
  };
  /* 蟹行一步：先拿孩子的 latch → 游标下移 → （孩子安全才）放父亲 */
  this.hop = function (th, a, b, mode, t, keep) {
    t = t || 0;
    if (S.byId['e' + a + b]) S.flash('e' + a + b, TC[th], { prop: 'stroke', delay: t });
    var e = me.acquire(th, b, mode, { from: a, delay: t + 100, dur: 650 });
    S.move('cur' + th, P[b].x, P[b].y, { delay: e + 50, dur: 600 });
    if (keep) return e + 650;
    me.release(th, a, { delay: e + 700 });
    return e + 1080;
  };
  this.leave = function (th, t) { S.hide('cur' + th, { delay: t || 0 }); };
  this.verdict = function (text, col, t, nd) {
    S.set('vd', { text: text, color: col }, { delay: t }); S.pop('vd', { delay: t });
    if (nd) { S.flash('n' + nd, col, { prop: 'stroke', delay: t, hold: 700 }); S.pulse('n' + nd, { delay: t, scale: 1.08 }); }
  };
  /* 把两个线程当前持有的 latch 同步到状态行和数据面板 */
  this.sync = function (t, extra) {
    var d = {};
    [1, 2].forEach(function (th) {
      var ks = Object.keys(held[th]).map(function (nd) { return nd + '(' + held[th][nd].mode + ')'; }).join(' ');
      if (wait[th]) ks += (ks ? ' ' : '') + '等 ' + wait[th].nd + '(' + wait[th].mode + ')…';
      ks = ks || '—';
      S.set('st' + th, { text: 'T' + th + ' 持有：' + ks }, { delay: t });
      d['T' + th + ' 持有'] = ks;
    });
    if (extra) for (var k in extra) d[k] = extra[k];
    S.data(d, { delay: t });
  };
}

function chip(S, th, x, y, label) {
  S.box('chip' + th, { x: x, y: y, w: 250, h: 34, rx: 17, fill: C.panel, stroke: TC[th], sw: 2, label: label, size: 15 });
}
function legend(S) {
  S.box('lgR', { x: 610, y: 500, w: 34, h: 24, rx: 7, fill: C.bg, stroke: C.mute, sw: 2, label: 'R', color: C.mute, size: 15 });
  S.text('lgRt', { x: 636, y: 500, text: '读 latch：多个线程可共享', anchor: 'start', color: C.mute, size: 14 });
  S.box('lgW', { x: 610, y: 526, w: 34, h: 24, rx: 7, fill: C.mute, stroke: C.mute, sw: 2, label: 'W', color: C.bg, size: 15 });
  S.text('lgWt', { x: 636, y: 526, text: '写 latch：独占，与谁都不兼容', anchor: 'start', color: C.mute, size: 14 });
}

/* 官方 Slides 例子里的那棵树（右半边完整，左半边只画一个桩） */
function bigTree(S, l1, l2) {
  var P = {
    A: { x: 282, y: 74 }, X: { x: 110, y: 176, name: '…' }, B: { x: 454, y: 176 }, C: { x: 272, y: 278 }, D: { x: 635, y: 278 },
    E: { x: 200, y: 380, leaf: 1 }, F: { x: 345, y: 380, leaf: 1 }, G: { x: 490, y: 380, leaf: 1 }, H: { x: 635, y: 380, leaf: 1 }, I: { x: 780, y: 380, leaf: 1 }
  };
  S.text('note', { x: 20, y: 22, text: '树与键值取自官方 Slides 的例子 · 每个节点最多 2 个键', anchor: 'start', size: 14, color: C.mute });
  edge(S, 'eAX', P.A, 0, P.X); edge(S, 'eAB', P.A, 1, P.B); edge(S, 'eBC', P.B, 0, P.C); edge(S, 'eBD', P.B, 1, P.D);
  edge(S, 'eCE', P.C, 0, P.E); edge(S, 'eCF', P.C, 1, P.F); edge(S, 'eDG', P.D, 0, P.G); edge(S, 'eDH', P.D, 1, P.H); edge(S, 'eDI', P.D, 2, P.I);
  S.line('stub1', { x1: 84, y1: 198, x2: 62, y2: 236, stroke: C.line, sw: 2, dash: '5 4' });
  S.line('stub2', { x1: 124, y1: 198, x2: 150, y2: 236, stroke: C.line, sw: 2, dash: '5 4' });
  S.text('stubT', { x: 106, y: 254, text: '左子树（略）', color: C.mute, size: 14 });
  node(S, 'A', P.A, [20]); node(S, 'X', P.X, [10]); node(S, 'B', P.B, [35]); node(S, 'C', P.C, [23]); node(S, 'D', P.D, [38, 44]);
  node(S, 'E', P.E, [20, 22]); node(S, 'F', P.F, [23, 31]); node(S, 'G', P.G, [35, 36]); node(S, 'H', P.H, [38, 41]); node(S, 'I', P.I, [44]);
  chip(S, 1, 700, 50, l1); chip(S, 2, 700, 94, l2);
  legend(S);
  return new Ctx(S, P, { 1: [585, 50], 2: [585, 94] });
}

var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #10 Index Concurrency Control（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/10-indexconcurrency.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #10 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/10-indexconcurrency.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Project #2 B+Tree Index', u: 'https://15445.courses.cs.cmu.edu/fall2025/project2/' }
];

Viz.register('crabbing', {
  title: 'Latch Crabbing：读蟹行 · 悲观写 · 乐观写 · 叶子扫描',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：读操作的蟹行 ───────────────────────── */
  {
    name: '读操作的蟹行',
    moving: '读 latch 徽章沿指针从父节点飞到孩子、落地涟漪；游标随后下移；父节点的徽章缩小消失；两个线程的徽章在同一节点并排',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Value Find(Key k) {',
      '  Node* n = root;',
      '  n->latch.RLock();          // 先拿根',
      '  while (!n->is_leaf) {',
      '    Node* c = n->ChildFor(k);',
      '    c->latch.RLock();        // ① 先拿孩子',
      '    n->latch.RUnlock();      // ② 再放父亲',
      '    n = c;',
      '  }',
      '  Value v = n->Lookup(k);',
      '  n->latch.RUnlock();',
      '  return v;',
      '}',
      '// 读 latch 之间兼容：多个 Find 可以',
      '// 同时停在同一个节点上'
    ].join('\n'),
    build: function (S) {
      var X = bigTree(S, 'T1：Find(38)', 'T2：Find(44)');
      S.data({ 'T1 持有': '—', 'T2 持有': '—' });

      S.step('T1 Find(38)：先给根 A 加读 latch（R）—— 读模式下没人能改 A 里的指针', function () {
        S.code(3); S.log('T1: Find(38)');
        X.enter(1, 'A', 'R'); X.sync(700);
        S.flash('kA0', C.blue, { delay: 1200 }); S.pulse('kA0', { delay: 1200 });
      });
      S.step('38 ≥ 20 → 走右指针：先拿到孩子 B 的读 latch，再释放父亲 A', function () {
        S.code(6);
        var e = X.hop(1, 'A', 'B', 'R');
        S.code(7, { delay: e - 400 }); X.sync(e - 380);
        S.log('T1: RLock(B) → RUnlock(A)', { delay: e - 380 });
      });
      S.step('T2 Find(44) 进来：A 已经空了，直接拿到读 latch；T1 继续蟹行到 D（38 ≥ 35）', function () {
        S.code(3); S.log('T2: Find(44)');
        X.enter(2, 'A', 'R'); X.sync(700);
        S.code([6, 7], { delay: 900 });
        var e = X.hop(1, 'B', 'D', 'R', 900); X.sync(e - 380);
        S.log('T1: RLock(D) → RUnlock(B)', { delay: e - 380 });
      });
      S.step('T2 跟到 B（44 ≥ 20），放开 A —— 每个读线程手里最多同时握两个 latch', function () {
        S.code([6, 7]);
        var e = X.hop(2, 'A', 'B', 'R'); X.sync(e - 380);
        S.log('T2: RLock(B) → RUnlock(A)', { delay: e - 380 });
      });
      S.step('T2 也要进 D（44 ≥ 35）：D 上已有 T1 的读 latch —— 读读兼容，两个线程同时持有', function () {
        S.code(14);
        var e = X.hop(2, 'B', 'D', 'R'); X.sync(e - 380);
        S.flash(X.badge(1, 'D'), C.green, { delay: 800, prop: 'stroke' }); S.flash(X.badge(2, 'D'), C.green, { delay: 800, prop: 'stroke' });
        S.log('D 上有 2 个读 latch：兼容', { delay: 800, kind: 'ok' });
      });
      S.step('T1：38 ≤ 38 < 44 → 中间指针。拿叶子 H 的读 latch，放开 D，在叶内找到 38', function () {
        S.code([6, 7]);
        var e = X.hop(1, 'D', 'H', 'R'); X.sync(e - 380);
        S.code(10, { delay: e });
        S.to('kH0', { fill: C.green, color: C.bg }, { delay: e, dur: 400 }); S.pulse('kH0', { delay: e }); S.ripple(627, 380, { delay: e, color: C.green });
        S.log('T1: Find(38) → 命中', { delay: e + 100, kind: 'ok' });
        S.code(11, { delay: e + 700 }); X.release(1, 'H', { delay: e + 700 }); X.leave(1, e + 700); X.sync(e + 800);
      });
      S.step('T2：44 ≥ 44 → 最右指针。拿叶子 I 的读 latch，放开 D，找到 44', function () {
        S.code([6, 7]);
        var e = X.hop(2, 'D', 'I', 'R'); X.sync(e - 380);
        S.code(10, { delay: e });
        S.to('kI0', { fill: C.green, color: C.bg }, { delay: e, dur: 400 }); S.pulse('kI0', { delay: e }); S.ripple(772, 380, { delay: e, color: C.green });
        S.log('T2: Find(44) → 命中', { delay: e + 100, kind: 'ok' });
        S.code(11, { delay: e + 700 }); X.release(2, 'I', { delay: e + 700 }); X.leave(2, e + 700); X.sync(e + 800);
      });
    }
  },

  /* ───────────────────────── 场景 2：悲观写蟹行 ───────────────────────── */
  {
    name: '悲观写：安全才放祖先',
    moving: '写 latch 徽章逐层飞向孩子；孩子不安全时祖先的徽章留在原地，安全时自上而下依次缩小消失；T2 的等待徽章停在根旁，根一放开就滑进槽位',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Delete(Key k) {          // Insert 同理',
      '  vector<Node*> held;',
      '  Node* n = root;',
      '  n->latch.WLock();           // 总是先锁根',
      '  held.push_back(n);',
      '  while (!n->is_leaf) {',
      '    Node* c = n->ChildFor(k);',
      '    c->latch.WLock();',
      '    if (c->IsSafe(DELETE)) {  // 不会合并',
      '      for (Node* a : held)    // 自上而下',
      '        a->latch.WUnlock();   // 全部释放',
      '      held.clear();',
      '    }',
      '    held.push_back(c); n = c;',
      '  }',
      '  n->Remove(k);',
      '  for (Node* a : held) a->latch.WUnlock();',
      '} // 安全：插入=未满；删除=超过半满'
    ].join('\n'),
    build: function (S) {
      var X = bigTree(S, 'T1：Delete(38)', 'T2：Insert(45)');
      S.data({ 'T1 持有': '—', 'T2 持有': '—' });

      S.step('T1 Delete(38)：写操作的第一步，永远是给根 A 加写 latch（W）', function () {
        S.code(4); S.log('T1: Delete(38)');
        X.enter(1, 'A', 'W'); X.sync(700);
      });
      S.step('T2 Insert(45) 也要根的写 latch：写与任何模式都不兼容 → 只能在根外面等', function () {
        S.code(4); S.log('T2: Insert(45)');
        var e = X.want(2, 'A', 'W');
        S.flash(X.badge(1, 'A'), C.red, { delay: e, prop: 'stroke' }); S.pulse(X.badge(1, 'A'), { delay: e });
        S.to('chip2', { stroke: C.amber }, { delay: e, dur: 300 });
        X.sync(e); S.log('T2: WLock(A) 被挡住，等待', { delay: e, kind: 'warn' });
      });
      S.step('T1 → B：加写 latch。B 只有 1 个键，再少一个就要合并 → 不安全，A、B 都留着', function () {
        S.code([7, 8]);
        var e = X.hop(1, 'A', 'B', 'W', 0, true);
        S.code(9, { delay: e });
        X.verdict('B 对删除不安全：没有超过半满 → 保留 A、B', C.red, e, 'B'); X.sync(e);
        S.log('IsSafe(B, DELETE) = false', { delay: e, kind: 'warn' });
      });
      S.step('T1 → D：加写 latch。D 有 2 个键、超过半满 → 安全，结构变化传不到上面去', function () {
        S.code([7, 8]);
        var e = X.hop(1, 'B', 'D', 'W', 0, true);
        S.code(9, { delay: e });
        X.verdict('D 对删除安全：超过半满 → 可以释放所有祖先', C.green, e, 'D'); X.sync(e);
        S.log('IsSafe(D, DELETE) = true', { delay: e, kind: 'ok' });
      });
      S.step('释放全部祖先：先放 A（挡住的范围最大），再放 B；顺序只影响性能', function () {
        S.code([10, 11]);
        S.pulse(X.badge(1, 'A')); X.release(1, 'A', { delay: 250 });
        S.pulse(X.badge(1, 'B'), { delay: 800 }); X.release(1, 'B', { delay: 1050 });
        X.sync(1100); S.log('T1: WUnlock(A), WUnlock(B)', { delay: 1100 });
      });
      S.step('A 一放开，等在根外面的 T2 立刻拿到写 latch，进入根', function () {
        S.code(4); S.hide('vd');
        var e = X.grant(2);
        S.to('chip2', { stroke: C.purple }, { delay: e, dur: 300 });
        S.set('cur2', { x: 282, y: 74 }); S.pop('cur2', { delay: e });
        X.sync(e); S.log('T2: WLock(A) 成功', { delay: e, kind: 'ok' });
      });
      S.step('T1 → H：加写 latch。H 有 2 个键 → 安全，放开 D；删掉 38，再放开 H', function () {
        S.code([7, 11]);
        var e = X.hop(1, 'D', 'H', 'W');
        X.verdict('H 对删除安全 → 释放 D，执行删除', C.green, e - 1000, 'H'); X.sync(e - 380);
        S.code(16, { delay: e });
        S.to('kH0', { fill: C.red }, { delay: e, dur: 250 });
        S.to('kH0', { scale: .2, opacity: 0 }, { delay: e + 300, dur: 450, ease: 'in' });
        S.code(17, { delay: e + 800 }); X.release(1, 'H', { delay: e + 800 }); X.leave(1, e + 800); X.sync(e + 900);
        S.log('T1: Delete(38) 完成', { delay: e + 900, kind: 'ok' });
      });
      S.step('T2 → B：同一个 B 对「插入」是安全的（未满）→ 放开 A。安全与否看操作类型', function () {
        S.code([7, 11]);
        var e = X.hop(2, 'A', 'B', 'W');
        X.verdict('B 对插入安全：未满，装得下冒上来的键 → 释放 A', C.green, e - 1000, 'B'); X.sync(e - 380);
        S.log('IsSafe(B, INSERT) = true', { delay: e - 1000, kind: 'ok' });
      });
      S.step('瓶颈：每个写操作都从根的写 latch 开始 → 所有写者在根上排队，树退化成单线程', function () {
        S.code(4);
        S.set('vd', { text: '所有修改操作的第一步：给根加写 latch', color: C.amber }); S.pop('vd');
        S.flash('nA', C.red, { prop: 'stroke', hold: 900 }); S.pulse('nA', { scale: 1.1 });
        S.ripple(282, 74, { color: C.red, r: 60, dur: 900 }); S.ripple(282, 74, { color: C.red, r: 60, dur: 900, delay: 350 });
        S.log('根 = 所有写操作的必经之路', { delay: 300, kind: 'warn' });
      });
    }
  },

  /* ───────────────────────── 场景 3：乐观蟹行 ───────────────────────── */
  {
    name: '乐观写：先赌后验',
    moving: '两个线程的读 latch 徽章并排落在根上、各自蟹行下探；到叶子换成实心的写徽章；猜错的线程徽章全部缩回、游标退出，再从根用写徽章重走一遍',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void InsertOptimistic(Key k, Value v) {',
      '  Node* n = root; n->latch.RLock();',
      '  while (!n->child_is_leaf) { // 读 latch 蟹行',
      '    Node* c = n->ChildFor(k);',
      '    c->latch.RLock(); n->latch.RUnlock();',
      '    n = c;',
      '  }',
      '  Node* leaf = n->ChildFor(k);',
      '  leaf->latch.WLock();        // 只写锁叶子',
      '  if (leaf->IsSafe(INSERT)) { // 猜对了',
      '    n->latch.RUnlock();',
      '    leaf->Insert(k, v);',
      '    leaf->latch.WUnlock();',
      '  } else {                    // 猜错了',
      '    leaf->latch.WUnlock(); n->latch.RUnlock();',
      '    InsertPessimistic(k, v);  // 从根重来',
      '  }',
      '} // Delete 同理'
    ].join('\n'),
    build: function (S) {
      var X = bigTree(S, 'T1：Delete(38) 乐观', 'T2：Insert(25) 乐观');
      S.data({ 'T1 持有': '—', 'T2 持有': '—' });

      S.step('T1 Delete(38)（乐观）：赌叶子不会合并 —— 根 A 只加读 latch', function () {
        S.code(2); S.log('T1: Delete(38) 乐观');
        X.enter(1, 'A', 'R'); X.sync(700);
      });
      S.step('T2 Insert(25) 同时到达：读读兼容，也拿到 A 的读 latch —— 根不再是写操作的瓶颈', function () {
        S.code(2); S.log('T2: Insert(25) 乐观');
        X.enter(2, 'A', 'R'); X.sync(700);
        S.flash(X.badge(1, 'A'), C.green, { delay: 800, prop: 'stroke' }); S.flash(X.badge(2, 'A'), C.green, { delay: 800, prop: 'stroke' });
        S.log('根上 2 个读 latch：兼容', { delay: 800, kind: 'ok' });
      });
      S.step('T1 用读 latch 蟹行：A → B → D，和 Find 完全一样', function () {
        S.code([3, 6]);
        var e = X.hop(1, 'A', 'B', 'R'); X.sync(e - 380);
        e = X.hop(1, 'B', 'D', 'R', e - 250); X.sync(e - 380);
        S.log('T1: 读 latch 到达 D（倒数第二层）', { delay: e - 380 });
      });
      S.step('T2 也用读 latch 蟹行：A → B → C（25 ≥ 20，25 < 35）', function () {
        S.code([3, 6]);
        var e = X.hop(2, 'A', 'B', 'R'); X.sync(e - 380);
        e = X.hop(2, 'B', 'C', 'R', e - 250); X.sync(e - 380);
        S.log('T2: 读 latch 到达 C（倒数第二层）', { delay: e - 380 });
      });
      S.step('T1 到了倒数第二层：对叶子 H 直接加【写】latch，检查 H 能不能吸收这次删除', function () {
        S.code([8, 9]);
        var e = X.hop(1, 'D', 'H', 'W', 0, true);
        S.code(10, { delay: e });
        X.verdict('H 有 2 个键，删一个不会合并 → 猜对了', C.green, e, 'H'); X.sync(e);
        S.log('T1: 叶子安全，赌赢', { delay: e, kind: 'ok' });
      });
      S.step('T1 放开 D，删掉 38，放开 H —— 全程只有一个叶子被写锁过', function () {
        S.code(11); X.release(1, 'D'); S.hide('vd', { delay: 1250 });
        S.code(12, { delay: 450 });
        S.to('kH0', { fill: C.red }, { delay: 450, dur: 250 });
        S.to('kH0', { scale: .2, opacity: 0 }, { delay: 750, dur: 450, ease: 'in' });
        S.code(13, { delay: 1250 }); X.release(1, 'H', { delay: 1250 }); X.leave(1, 1250); X.sync(1350);
        S.log('T1: Delete(38) 完成', { delay: 1350, kind: 'ok' });
      });
      S.step('T2 对叶子 F 加写 latch，检查：F 已满（2/2），插入 25 必须分裂 → 猜错了', function () {
        S.code([8, 9]);
        var e = X.hop(2, 'C', 'F', 'W', 0, true);
        S.code(14, { delay: e });
        X.verdict('F 已满，插入 25 要分裂 → 猜错了', C.red, e, 'F'); X.sync(e);
        S.log('T2: 叶子不安全，赌输', { delay: e, kind: 'err' });
      });
      S.step('T2 释放手里所有 latch，退出这棵树；不从中间续：上层可能已被别人改过', function () {
        S.code(15);
        var e = X.releaseAll(2);
        S.fly([345, 380], [585, 94], { color: C.red, delay: 300, dur: 800 });
        X.leave(2, 300); X.sync(e);
        S.flash('chip2', C.red, { prop: 'stroke', delay: 1100 }); S.pulse('chip2', { delay: 1100, scale: 1.06 });
        S.set('chip2', { label: 'T2：Insert(25) 悲观重试' }, { delay: 1100 });
        S.log('T2: 全部释放，从根重来', { delay: 1100, kind: 'warn' });
      });
      S.step('T2 第二次走悲观协议：根加写 latch → B 未满（安全）放 A → C 未满（安全）放 B', function () {
        S.code(16); S.hide('vd');
        var e = X.enter(2, 'A', 'W'); X.sync(700);
        e = X.hop(2, 'A', 'B', 'W', e - 100); X.sync(e - 380);
        e = X.hop(2, 'B', 'C', 'W', e - 250); X.sync(e - 380);
        S.log('T2: 写 latch 到达 C', { delay: e - 380 });
      });
      S.step('T2 → F：F 要分裂 → 保留父亲 C 的写 latch，在它保护下分裂并更新 C 的路标', function () {
        S.code(16);
        var e = X.hop(2, 'C', 'F', 'W', 0, true);
        X.verdict('F 不安全 → 保留 C；持有 C 的写 latch 才能合法地分裂 F', C.amber, e, 'F'); X.sync(e);
        S.flash('nC', C.amber, { prop: 'stroke', delay: e + 300, hold: 700 }); S.pulse('nC', { delay: e + 300, scale: 1.08 });
        S.log('T2: 持有 C(W)+F(W)，执行分裂', { delay: e + 300, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 4：叶子扫描与 no-wait ───────────────────────── */
  {
    name: '叶子扫描：No-Wait',
    moving: '两个线程的徽章沿兄弟指针相向飞行、两个游标对穿交换位置；读者撞上写 latch 时等待徽章停在外侧；三个选项依次弹出、被划掉或点亮；放弃的线程徽章缩回、红点飞回起点后重试',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 沿兄弟指针横向移动（no-wait）',
      'bool MoveToSibling(Node*& cur, Mode m) {',
      '  Node* sib = cur->sibling;',
      '  if (!sib->latch.TryLock(m)) { // 不等待',
      '    ReleaseAllLatches();        // 自己放弃',
      '    return false;               // 从头重试',
      '  }',
      '  cur->latch.Unlock();          // 先拿到再放',
      '  cur = sib;',
      '  return true;',
      '}',
      '// 调用方：外面套一层重试循环',
      'for (int tries = 0; !Scan(lo, hi); tries++)',
      '  Backoff(tries);              // 越失败睡越久'
    ].join('\n'),
    build: function (S) {
      var P = { A: { x: 430, y: 126 }, B: { x: 250, y: 290, leaf: 1 }, C: { x: 610, y: 290, leaf: 1 }, vy: 404 };
      S.text('note', { x: 430, y: 22, text: '例子取自官方 Slides：根 A，叶子 B、C 用兄弟指针双向相连', size: 14, color: C.mute });
      edge(S, 'eAB', P.A, 0, P.B); edge(S, 'eAC', P.A, 1, P.C);
      S.line('sBC', { x1: 312, y1: 282, x2: 548, y2: 282, stroke: C.purple, sw: 2, arrow: true, dash: '5 4' });
      S.line('sCB', { x1: 548, y1: 298, x2: 312, y2: 298, stroke: C.purple, sw: 2, arrow: true, dash: '5 4' });
      S.text('sT', { x: 430, y: 262, text: '兄弟指针', color: C.mute, size: 14 });
      node(S, 'A', P.A, [3]); node(S, 'B', P.B, [1, 2]); node(S, 'C', P.C, [3, 4]);
      chip(S, 1, 150, 70, 'T1：Find(key < 4)'); chip(S, 2, 710, 70, 'T2：Find(key > 1)');
      var opt = [['o1', 190, '① 等待'], ['o2', 430, '② 放弃自己，重试'], ['o3', 670, '③ 杀掉对方']];
      opt.forEach(function (o) { S.box(o[0], { x: o[1], y: 452, w: 210, h: 40, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: o[2], size: 15, opacity: 0 }); });
      S.line('x3', { x1: 580, y1: 452, x2: 760, y2: 452, stroke: C.red, sw: 3, draw: 0, opacity: 0 });
      legend(S);
      var X = new Ctx(S, P, { 1: [255, 84], 2: [605, 84] });
      S.data({ 'T1 持有': '—', 'T2 持有': '—' });

      S.step('T1 Find(key<4) 用读 latch 蟹行到叶子 C；T2 Find(key>1) 蟹行到叶子 B', function () {
        S.log('T1: Find(key < 4)'); S.log('T2: Find(key > 1)', { delay: 500 });
        var e = X.enter(1, 'A', 'R'); e = X.hop(1, 'A', 'C', 'R', e - 250);
        var f = X.enter(2, 'A', 'R', 500); f = X.hop(2, 'A', 'B', 'R', f - 250);
        X.sync(Math.max(e, f) - 380);
      });
      S.step('T1 要沿兄弟指针向左到 B：先拿到 B 的 latch，才能放开 C（同样是蟹行）', function () {
        S.code([3, 4]);
        S.flash('sCB', C.blue, { prop: 'stroke' });
        var e = X.acquire(1, 'B', 'R', { from: 'C', delay: 100, dur: 800 }); X.sync(e);
        S.log('T1: TryLock(B, R) 成功（读读兼容）', { delay: e, kind: 'ok' });
      });
      S.step('T2 要向右到 C：同样先拿 C 的读 latch。此刻 B、C 上各有两个读 latch', function () {
        S.code([3, 4]);
        S.flash('sBC', C.purple, { prop: 'stroke' });
        var e = X.acquire(2, 'C', 'R', { from: 'B', delay: 100, dur: 800 }); X.sync(e);
        S.log('T2: TryLock(C, R) 成功（读读兼容）', { delay: e, kind: 'ok' });
      });
      S.step('各自放开原来的叶子，两个读者对穿而过 —— 都是读模式，没有任何问题', function () {
        S.code([8, 9]);
        S.move('cur1', 250, 290, { dur: 900 }); S.move('cur2', 610, 290, { dur: 900 });
        X.release(1, 'C', { delay: 900 }); X.release(2, 'B', { delay: 900 }); X.sync(1000);
        S.log('两个读者互换位置', { delay: 1000, kind: 'ok' });
      });
      S.step('重摆一局：T1 改成 Delete(4)，持有 C 的【写】latch；T2 仍在 B 上持读 latch', function () {
        S.code(2); X.release(1, 'B'); X.release(2, 'C'); X.leave(1); X.leave(2);
        S.set('chip1', { label: 'T1：Delete(4)' }, { delay: 350 }); S.pulse('chip1', { delay: 350, scale: 1.06 });
        S.log('T1: Delete(4)', { delay: 350 }); S.log('T2: Find(key > 1)', { delay: 350 });
        var e = X.acquire(1, 'C', 'W', { delay: 500, dur: 800 });
        S.set('cur1', { x: 610, y: 290 }, { delay: 500 }); S.pop('cur1', { delay: e });
        var f = X.acquire(2, 'B', 'R', { delay: 800, dur: 800 });
        S.set('cur2', { x: 250, y: 290 }, { delay: 800 }); S.pop('cur2', { delay: f });
        X.sync(f);
      });
      S.step('T2 想要 C 的读 latch → 与 T1 的写 latch 不兼容，拿不到', function () {
        S.code([3, 4]);
        S.flash('sBC', C.purple, { prop: 'stroke' });
        var e = X.want(2, 'C', 'R', { from: 'B', delay: 100, dur: 800 });
        S.flash(X.badge(1, 'C'), C.red, { delay: e, prop: 'stroke' }); S.pulse(X.badge(1, 'C'), { delay: e });
        X.verdict('读 latch 与写 latch 不兼容', C.red, e); X.sync(e);
        S.log('T2: TryLock(C, R) 失败', { delay: e, kind: 'err' });
      });
      S.step('T2 不知道 T1 在干什么（latch 没有中央管理者），它只有三个选择', function () {
        S.code(4); S.hide('vd');
        S.pop('o1', { delay: 200 }); S.pop('o2', { delay: 600 }); S.pop('o3', { delay: 1000 });
        S.log('T2: 等待？放弃？杀掉对方？', { delay: 1000, kind: 'warn' });
      });
      S.step('③ 做不到：不知道是谁、也没人替它回滚；① 等待：等多久？还可能是死锁', function () {
        S.to('o3', { stroke: C.red, color: C.mute }, { dur: 350 }); S.pulse('o3');
        S.to('x3', { opacity: 1, draw: 1 }, { delay: 300, dur: 500 });
        S.to('o1', { stroke: C.amber, color: C.mute }, { delay: 1100, dur: 350 }); S.pulse('o1', { delay: 1100 });
        S.log('杀掉对方：不可行', { delay: 300, kind: 'err' }); S.log('等待：不知道要等多久', { delay: 1100, kind: 'warn' });
      });
      S.step('② No-Wait：拿不到就立刻放弃 —— 释放自己所有 latch，退出，整个操作从头重试', function () {
        S.code([4, 6]);
        S.to('o2', { stroke: C.green, fill: '#16382f' }, { dur: 350 }); S.pulse('o2'); S.ripple(430, 452, { color: C.green, r: 50 });
        X.giveUp(2, { delay: 600 }); X.release(2, 'B', { delay: 800 }); X.leave(2, 800);
        S.fly([250, 290], [605, 84], { color: C.red, delay: 900, dur: 800 });
        S.flash('chip2', C.red, { prop: 'stroke', delay: 1700 }); S.pulse('chip2', { delay: 1700, scale: 1.06 });
        X.sync(1250); S.log('T2: 释放 B(R)，重试', { delay: 1250, kind: 'warn' });
      });
      S.step('T1 不需要 B，删完 4 就放开 C；T2 重试，这次一路畅通', function () {
        S.code([13, 14]);
        S.to('kC1', { fill: C.red }, { dur: 250 }); S.to('kC1', { scale: .2, opacity: 0 }, { delay: 300, dur: 450, ease: 'in' });
        X.release(1, 'C', { delay: 800 }); X.leave(1, 800); S.log('T1: Delete(4) 完成', { delay: 800, kind: 'ok' });
        var e = X.enter(2, 'A', 'R', 1100); e = X.hop(2, 'A', 'B', 'R', e - 250);
        S.flash('sBC', C.purple, { prop: 'stroke', delay: e - 300 });
        e = X.hop(2, 'B', 'C', 'R', e - 300); X.sync(e - 380);
        S.log('T2: 重试成功，读到 C', { delay: e - 380, kind: 'ok' });
      });
    }
  }
  ]
});
})();
