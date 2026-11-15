/* #07 哈希表：线性探测（插入/查找） · 删除与墓碑 · 可扩展哈希 · 线性哈希
 * 槽数 N = 8、每个 key 的哈希值、每桶 3 个 key、哈希值的比特串都是为了画得下而取的示意值；
 * 线性哈希里的 6 / 17 / 8 / 20 照抄笔记，同桶的其它 key 是为了把桶填满补的。 */
(function () {
var C = Viz.C, PG = '#2b4172', TY = 322, HY = 96, HV = 228;
function mix(p, o) { for (var k in o) p[k] = o[k]; return p; }
function lbl(S, id, x, y, t, o) { S.text(id, mix({ x: x, y: y, text: t, anchor: 'start', color: C.mute, size: 15 }, o)); }
function SX(i) { return 115 + i * 90; }
/* 线性探测两个场景共用的舞台：哈希函数、8 个槽、游标 */
function probeStage(S, note, homes, op) {     /* homes[i] = 槽 i 里那个 key 的哈希值（一开始就有的） */
  S.text('note', { x: 20, y: 24, text: note, anchor: 'start', size: 14, color: C.mute });
  lbl(S, 'tOp', 40, HY, op || '插入：');
  S.box('hb', { x: 430, y: HY, w: 210, h: 50, rx: 10, fill: C.panel, stroke: C.purple, sw: 2, label: 'hash(key) mod 8' });
  S.text('tH', { x: 550, y: HY, anchor: 'start', val: 0, pre: '= 槽 ', size: 18, weight: 700, color: C.amber, opacity: 0 });
  for (var i = 0; i < 8; i++) {
    S.box('s' + i, { x: SX(i), y: TY, w: 84, h: 72, rx: 8, fill: C.panel, stroke: C.line, sw: 2 });
    S.text('n' + i, { x: SX(i), y: TY + 52, text: '槽 ' + i, size: 14, color: C.mute });
    var hv = homes && homes[i] != null;
    S.text('hm' + i, { x: SX(i), y: TY - 50, text: hv ? 'hash = ' + homes[i] : '', size: 14, color: C.mute, opacity: hv ? 1 : 0 });
  }
  S.box('cur', { x: SX(0), y: TY, w: 98, h: 86, rx: 12, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
}
function keyChip(S, id, label, o) {
  S.box(id, mix({ x: 150, y: HY, w: 72, h: 44, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: label, color: C.bg, size: 15, opacity: 0, trail: 3 }, o));
}
/* key 进哈希函数 → 落到起始槽的正上方，蓝色游标框出现。返回“可以开始比较”的时刻 */
function travel(S, id, h, d) {
  S.pop(id, { delay: d });
  S.move(id, 430, HY, { delay: d + 350, dur: 500 });
  S.flash('hb', C.purple, { delay: d + 850 }); S.set('tH', { val: h }, { delay: d + 850 }); S.pop('tH', { delay: d + 880 });
  S.move(id, SX(h), HV, { delay: d + 1100, dur: 600 });
  S.set('cur', { x: SX(h) }, { delay: d + 1500 }); S.pop('cur', { delay: d + 1550 });
  return d + 1850;
}
function hop(S, id, i, t) {                  /* 游标和手里的 key 一起往后挪一格 */
  S.move('cur', SX(i + 1), TY, { delay: t, dur: 380 }); S.move(id, SX(i + 1), HV, { delay: t, dur: 380 });
  return t + 430;
}
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #07 Hash Tables（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/07-hashtables.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #07 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/07-hashtables.pdf' }
];

Viz.register('hashing', {
  title: '哈希表：线性探测 · 墓碑 · 可扩展哈希 · 线性哈希',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：线性探测 ───────────────────────── */
  {
    name: '线性探测：插入与查找',
    moving: 'key 先滑进哈希函数、再落到起始槽上方；蓝色游标带着它一格一格往后挪，撞到的槽闪红；找到空槽后落进去；查找时命中的槽变绿、结果飞进结果栏；已用槽数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Insert(Key k, Value v) {',
      '  int i = Hash(k) % N;      // 起始槽',
      '  while (slot[i].used)      // 被占了',
      '    i = (i + 1) % N;        // 往后看一个',
      '  slot[i] = {k, v};         // key 也要存',
      '}',
      'Value* Find(Key k) {',
      '  int i = Hash(k) % N;',
      '  while (slot[i].used) {',
      '    if (slot[i].key == k)',
      '      return &slot[i].val;  // 命中',
      '    i = (i + 1) % N;',
      '  }',
      '  return nullptr;           // 空槽：不存在',
      '}'
    ].join('\n'),
    build: function (S) {
      var occ = {}, used = 0, nRes = 0;
      probeStage(S, 'N = 8、各个 key 的哈希值都是示意值');
      S.text('tUsed', { x: 840, y: 24, anchor: 'end', val: 0, pre: '已用槽：', suf: ' / 8', color: C.amber, size: 16 });
      lbl(S, 'tRes', 73, 468, '查找结果：');
      S.box('tray', { x: 480, y: 468, w: 560, h: 50, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function (k) { keyChip(S, 'k' + k, k + ' | val'); });
      keyChip(S, 'q', 'D ?', { fill: C.blue });
      S.data({ '操作': '—', '起始槽': '—', '探测次数': 0, '已用槽': '0 / 8' });

      function ins(key, h, d) {
        var id = 'k' + key, i = h, n = 1, t = travel(S, id, h, d);
        S.set('tOp', { text: '插入：' }, { delay: d });
        while (occ[i]) {
          S.flash('s' + i, C.red, { prop: 'stroke', delay: t, hold: 300 }); S.pulse(occ[i], { delay: t });
          t = hop(S, id, i, t + 400); i++; n++;
        }
        S.flash('s' + i, C.green, { prop: 'stroke', delay: t, hold: 500 });
        S.to(id, { y: TY }, { delay: t + 120, dur: 450, ease: 'in' });
        S.ripple(SX(i), TY, { delay: t + 570, color: C.green });
        S.to(id, { fill: PG, color: C.ink }, { delay: t + 650, dur: 350 });
        S.set('hm' + i, { text: 'hash = ' + h }, { delay: t + 570 }); S.pop('hm' + i, { delay: t + 600 });
        S.count('tUsed', ++used, { delay: t + 570, dur: 300 });
        S.hide('cur', { delay: t + 600 });
        S.data({ '操作': 'Insert ' + key, '起始槽': h, '探测次数': n, '已用槽': used + ' / 8' }, { delay: t + 570 });
        S.log('Insert ' + key + '：起始槽 ' + h + ' → 放进槽 ' + i, { delay: t + 570, kind: n > 1 ? 'warn' : 'ok' });
        occ[i] = id;
        return t + 1000;
      }
      function find(key, h, d) {
        var i = h, n = 1, t;
        S.set('tOp', { text: '查找：' }, { delay: d });
        S.set('q', { x: 150, y: HY, label: key + ' ?', fill: C.blue }, { delay: d });
        t = travel(S, 'q', h, d + 50);
        while (occ[i] && occ[i] !== 'k' + key) {
          S.flash(occ[i], C.blue, { delay: t, hold: 250, dur: 300 }); S.pulse(occ[i], { delay: t });
          t = hop(S, 'q', i, t + 400); i++; n++;
        }
        if (occ[i]) {
          S.to(occ[i], { fill: C.green, color: C.bg }, { delay: t, dur: 300 }); S.pulse(occ[i], { delay: t, scale: 1.15 });
          S.ripple(SX(i), TY, { delay: t, color: C.green });
          S.fly([SX(i), TY], [300 + nRes * 240, 468], { label: key + '：在槽 ' + i + ' 命中', w: 200, h: 34, color: C.green, keep: true, delay: t + 350, dur: 750 });
          S.to(occ[i], { fill: PG, color: C.ink }, { delay: t + 1300, dur: 350 });
          S.log('Find ' + key + ' → 槽 ' + i + ' 命中，比较了 ' + n + ' 个槽', { delay: t + 300, kind: 'ok' });
        } else {
          S.flash('s' + i, C.red, { prop: 'stroke', delay: t, hold: 600 }); S.pulse('s' + i, { delay: t, scale: 1.08 });
          S.to('q', { fill: C.red }, { delay: t, dur: 250 });
          S.fly([SX(i), TY], [300 + nRes * 240, 468], { label: key + '：不存在', w: 200, h: 34, color: C.red, keep: true, delay: t + 350, dur: 750 });
          S.log('Find ' + key + ' → 槽 ' + i + ' 是空槽，不存在', { delay: t + 300, kind: 'err' });
        }
        nRes++;
        S.hide('q', { delay: t + 400 }); S.hide('cur', { delay: t + 900 });
        S.data({ '操作': 'Find ' + key, '起始槽': h, '探测次数': n }, { delay: t });
        return t + 1200;
      }

      S.step('Insert A、Insert B：各自 hash 到的槽都空着 → 直接放进去（key 和 value 都要存）', function () {
        S.code([1, 5]); var t = ins('A', 1, 0); ins('B', 4, t - 300);
      });
      S.step('Insert C：也 hash 到槽 1，可 A 已经占着 → 碰撞。往后看下一个槽，槽 2 空着，放进去', function () {
        S.code([2, 4]); var t = ins('C', 1, 0); S.code(5, { delay: t - 900 });
      });
      S.step('Insert D：hash 到槽 2 —— 却被 C 占了（C 本来就不该在这）→ 再往后，落到槽 3', function () {
        S.code([3, 4]); var t = ins('D', 2, 0); S.code(5, { delay: t - 900 });
      });
      S.step('Insert E：hash 到槽 4，撞上 B → 落到槽 5', function () {
        S.code([3, 4]); var t = ins('E', 4, 0); S.code(5, { delay: t - 900 });
      });
      S.step('Insert F：hash 到槽 3，一路扫过 D、B、E，直到槽 6 才有空位 —— 表越满，扫得越远', function () {
        S.code([3, 4]); var t = ins('F', 3, 0); S.code(5, { delay: t - 900 });
      });
      S.step('Find D：从 hash 到的槽 2 开始逐个比对 key（所以槽里必须存 key），在槽 3 命中', function () {
        S.code([8, 11]); find('D', 2, 0);
      });
      S.step('Find X：hash 到槽 5，扫过 E、F，在槽 7 遇到空槽 → 一定不存在（要是存在，当初就会放在这）', function () {
        S.code([9, 12]); var t = find('X', 5, 0); S.code(14, { delay: t - 1200 });
      });
    }
  },

  /* ───────────────────────── 场景 2：删除与墓碑 ───────────────────────── */
  {
    name: '删除的坑与墓碑',
    moving: '被删的 key 缩小消失；查找的 key 落到空槽上方被拦住；墓碑从小弹出、页头位图里对应的位翻成 1；游标越过墓碑继续往后挪；新 key 落进墓碑的位置把它顶掉',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Delete(Key k) {       // 不清空，只打标记',
      '  tomb[Locate(k)] = true;  // Locate 同 Find',
      '}',
      'Value* Find(Key k) {',
      '  int i = Hash(k) % N;',
      '  while (slot[i].used) {   // 墓碑也算被占用',
      '    if (!tomb[i] && slot[i].key == k)',
      '      return &slot[i].val;',
      '    i = (i + 1) % N;       // 继续往后',
      '  }',
      '  return nullptr;          // 真正的空槽才停',
      '}',
      'void Insert(Key k, Value v) {',
      '  int i = Hash(k) % N;',
      '  while (slot[i].used && !tomb[i])',
      '    i = (i + 1) % N;',
      '  slot[i] = {k, v}; tomb[i] = false; // 复用',
      '}'
    ].join('\n'),
    build: function (S) {
      var INIT = [['A', 1, 1], ['C', 2, 1], ['D', 3, 2], ['B', 4, 4], ['E', 5, 4], ['F', 6, 3]], BY = 432, RY = 502, t;
      var homes = {};
      INIT.forEach(function (k) { homes[k[1]] = k[2]; });
      probeStage(S, '接着上一个场景的表；N = 8、哈希值都是示意值', homes, '操作：');
      INIT.forEach(function (k) { keyChip(S, 'k' + k[0], k[0] + ' | val', { x: SX(k[1]), y: TY, fill: PG, color: C.ink, opacity: 1 }); });
      lbl(S, 'tBm', 73, BY - 30, '页头里的墓碑位图（每个槽 1 位）');
      for (var i = 0; i < 8; i++) S.box('bm' + i, { x: SX(i), y: BY, w: 44, h: 30, rx: 5, fill: C.cell, stroke: C.line, label: '0', size: 15, color: C.mute });
      lbl(S, 'tRes', 73, RY, '查找结果：');
      S.box('tray', { x: 480, y: RY, w: 560, h: 46, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      S.box('tomb', { x: SX(2), y: TY, w: 72, h: 44, rx: 6, fill: C.bg, stroke: C.red, sw: 2, dash: '5 4', label: '墓碑', color: C.red, size: 15, opacity: 0 });
      keyChip(S, 'q', 'D ?', { fill: C.blue });
      keyChip(S, 'kG', 'G | val');
      S.data({ '操作': '—', '槽 2': 'C', '墓碑位图': '00000000' });

      S.step('接着上一场景的表：D 的 hash 是槽 2，只因当时被 C 占着，才被挤到了槽 3', function () {
        S.code(5); S.log('槽 1–6：A C D B E F');
        S.flash('hm3', C.amber, { prop: 'color', hold: 900 }); S.pulse('hm3', { scale: 1.3 });
        S.flash('s2', C.amber, { prop: 'stroke', delay: 400, hold: 700 }); S.pulse('kC', { delay: 400 });
        S.fly([SX(2), TY - 46], [SX(3), TY - 46], { color: C.amber, delay: 800, dur: 600 });
        S.flash('kD', C.amber, { delay: 1400 }); S.pulse('kD', { delay: 1400, scale: 1.12 });
      });
      S.step('错误做法：Delete C 时直接把槽 2 清空', function () {
        S.code([1, 3]); S.log('Delete C：直接清空槽 2', { kind: 'warn' });
        S.set('tOp', { text: '删除：C' });  S.pulse('tOp');
        S.to('kC', { fill: C.red }, { delay: 300, dur: 250 });
        S.to('kC', { scale: .2, opacity: 0 }, { delay: 700, dur: 450, ease: 'in' });
        S.hide('hm2', { delay: 900 });
        S.flash('s2', C.red, { prop: 'stroke', delay: 1100 });
        S.data({ '操作': 'Delete C（直接清空）', '槽 2': '空' }, { delay: 1100 });
      });
      S.step('这时 Find D：hash 到槽 2，看到的是空槽 → 判定“不存在”。可 D 明明就在隔壁', function () {
        S.code([5, 6]); S.log('Find D'); S.data({ '操作': 'Find D' });
        S.set('tOp', { text: '查找：' });
        t = travel(S, 'q', 2, 0);
        S.flash('s2', C.red, { prop: 'stroke', delay: t, hold: 700 }); S.pulse('s2', { delay: t, scale: 1.08 });
        S.to('q', { fill: C.red }, { delay: t, dur: 250 }); S.code(11, { delay: t });
        S.flash('kD', C.amber, { delay: t + 300, hold: 700 }); S.pulse('kD', { delay: t + 300, scale: 1.15 });
        S.fly([SX(2), TY], [300, RY], { id: 'bad', label: 'D：不存在 ✗（错！）', w: 200, h: 32, color: C.red, keep: true, delay: t + 500, dur: 750 });
        S.hide('q', { delay: t + 500 }); S.hide('cur', { delay: t + 1100 });
        S.log('槽 2 是空槽 → 返回“不存在”，探测链断了', { delay: t + 300, kind: 'err' });
      });
      S.step('正确做法：不清空，放一个墓碑 —— “这里曾经有东西”；标记记在页头的位图里', function () {
        S.code([1, 3]); S.log('Delete C：tomb[2] = true', { kind: 'ok' });
        S.hide('bad');
        S.pop('tomb', { delay: 300 }); S.ripple(SX(2), TY, { delay: 500, color: C.red });
        S.fly([SX(2), TY + 30], [SX(2), BY], { color: C.red, delay: 750, dur: 600 });
        S.set('bm2', { label: '1', color: C.bg }, { delay: 1350 }); S.to('bm2', { fill: C.red }, { delay: 1350, dur: 250 }); S.pulse('bm2', { delay: 1350, scale: 1.25 });
        S.data({ '操作': 'Delete C（墓碑）', '槽 2': '墓碑', '墓碑位图': '00100000' }, { delay: 1350 });
      });
      S.step('再 Find D：扫到墓碑，把它当作“被占用”，继续往后 → 在槽 3 命中', function () {
        S.code([5, 7]); S.log('Find D'); S.data({ '操作': 'Find D' });
        S.set('q', { x: 150, y: HY, fill: C.blue });
        t = travel(S, 'q', 2, 0);
        S.flash('tomb', C.amber, { prop: 'stroke', delay: t, hold: 300 }); S.pulse('tomb', { delay: t }); S.pulse('bm2', { delay: t });
        S.code(9, { delay: t + 300 });
        t = hop(S, 'q', 2, t + 450);
        S.code([7, 8], { delay: t });
        S.to('kD', { fill: C.green, color: C.bg }, { delay: t, dur: 300 }); S.pulse('kD', { delay: t, scale: 1.15 }); S.ripple(SX(3), TY, { delay: t, color: C.green });
        S.fly([SX(3), TY], [300, RY], { label: 'D：在槽 3 命中 ✓', w: 200, h: 32, color: C.green, keep: true, delay: t + 350, dur: 750 });
        S.hide('q', { delay: t + 400 }); S.hide('cur', { delay: t + 900 });
        S.to('kD', { fill: PG, color: C.ink }, { delay: t + 1300, dur: 350 });
        S.log('越过墓碑 → 槽 3 命中', { delay: t + 300, kind: 'ok' });
      });
      S.step('Insert G（hash 到槽 1）：A 占着 → 往后遇到墓碑，这个位置可以直接复用', function () {
        S.code([13, 16]); S.log('Insert G'); S.data({ '操作': 'Insert G' });
        S.set('tOp', { text: '插入：' });
        t = travel(S, 'kG', 1, 0);
        S.flash('s1', C.red, { prop: 'stroke', delay: t, hold: 300 }); S.pulse('kA', { delay: t });
        t = hop(S, 'kG', 1, t + 400);
        S.flash('tomb', C.green, { prop: 'stroke', delay: t, hold: 500 }); S.code(17, { delay: t });
        S.to('tomb', { scale: .2, opacity: 0 }, { delay: t + 250, dur: 400, ease: 'in' });
        S.to('kG', { y: TY }, { delay: t + 350, dur: 450, ease: 'in' }); S.ripple(SX(2), TY, { delay: t + 800, color: C.green });
        S.to('kG', { fill: PG, color: C.ink }, { delay: t + 900, dur: 350 });
        S.set('hm2', { text: 'hash = 1' }, { delay: t + 800 }); S.pop('hm2', { delay: t + 830 });
        S.set('bm2', { label: '0', color: C.mute }, { delay: t + 800 }); S.to('bm2', { fill: C.cell }, { delay: t + 800, dur: 250 }); S.pulse('bm2', { delay: t + 800, scale: 1.25 });
        S.hide('cur', { delay: t + 850 });
        S.data({ '槽 2': 'G', '墓碑位图': '00000000' }, { delay: t + 800 }); S.log('G 复用了墓碑所在的槽 2', { delay: t + 800, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 3：可扩展哈希 ───────────────────────── */
  {
    name: '可扩展哈希：分裂与目录翻倍',
    moving: '哈希值的前几位飞到桶指针数组对应的槽；圆点沿指针走到桶；翻倍时数组里的每一项一分为二、上下拉开，指针跟着挪；满桶上移、新桶弹出，key 按第 3 位滑进新桶；global / local 数字滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Insert(Key k, Value v) {',
      '  Bucket* b = dir[TopBits(Hash(k), global)];',
      '  if (!b->Full()) { b->Add(k, v); return; }',
      '  if (b->local == global) {  // 没有多余的位',
      '    dir.Double();            // 只翻倍指针数组',
      '    global++;',
      '  }',
      '  Bucket* nb = NewBucket();  // 只分裂这个桶',
      '  nb->local = ++b->local;',
      '  Redistribute(b, nb);       // 按新的一位分',
      '  RepointDir(b, nb);         // 改相关槽指针',
      '  Insert(k, v);              // 再试一次',
      '}',
      'Value* Find(Key k) {',
      '  Bucket* b = dir[TopBits(Hash(k), global)];',
      '  return b->Scan(k);         // 桶内顺序扫',
      '}'
    ].join('\n'),
    build: function (S) {
      var DX = 170, EL = 225, BX = 590, BL = 435, CXS = [490, 590, 690], YX = 200, YY = 332, YN = 388, YZ = 458;
      var B2 = ['00', '01', '10', '11'], B3 = ['000', '001', '010', '011', '100', '101', '110', '111'];
      var T0 = [195, 195, 205, 205, 332, 332, 458, 458], T1 = [185, 195, 205, 215, 327, 337, 453, 463];
      function y8(i) { return 128 + i * 48; }
      function y4(j) { return (y8(2 * j) + y8(2 * j + 1)) / 2; }
      function bucket(id, y, o) { S.box(id, mix({ x: BX, y: y, w: 310, h: 56, rx: 10, fill: C.panel, stroke: C.line, sw: 2 }, o)); }
      function kc(id, slot, y, label, o) { S.box(id, mix({ x: CXS[slot], y: y, w: 90, h: 36, rx: 6, fill: PG, stroke: 'none', sw: 0, label: label, size: 14, trail: 3 }, o)); }
      function local(id, y, v, o) { S.text(id, mix({ x: 756, y: y, anchor: 'start', val: v, pre: 'local ', color: C.purple, size: 15 }, o)); }
      S.text('note', { x: 20, y: 24, text: '每桶最多 3 个 key、哈希值只画前 5 位 —— 都是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tG', { x: 840, y: 24, anchor: 'end', val: 2, pre: '全局位数 global = ', color: C.amber, size: 16 });
      S.box('hk', { x: 350, y: 62, w: 250, h: 40, rx: 8, fill: C.panel, stroke: C.blue, sw: 2, label: 'hash(A) = 01110…', size: 16, opacity: 0 });
      S.text('tDir', { x: DX, y: 94, text: '桶指针数组', color: C.ink });
      S.text('tBk', { x: BX, y: 142, text: '桶（每桶最多 3 个 key）', color: C.ink });
      for (var i = 0; i < 8; i++) {
        var odd = i % 2, j = i >> 1;
        S.line('p' + i, { x1: EL, y1: y4(j), x2: BL, y2: T0[i], stroke: C.purple, sw: 2, arrow: true, opacity: odd ? 0 : 1, draw: odd ? 0 : 1 });
      }
      for (i = 7; i >= 0; i--) {
        S.box('d' + i, { x: DX, y: y4(i >> 1), w: 110, h: 36, rx: 6, fill: C.cell, stroke: C.purple, label: i % 2 ? B3[i] : B2[i >> 1], size: 16, opacity: i % 2 ? 0 : 1 });
      }
      bucket('bX', YX); bucket('bY', YY); bucket('bZ', YZ); bucket('bN', YN, { opacity: 0 });
      kc('cA', 0, YX, 'A 01110'); kc('cP', 1, YX, 'P 00101');
      kc('cQ', 0, YY, 'Q 10011'); kc('cR', 1, YY, 'R 10110'); kc('cS', 2, YY, 'S 10001');
      kc('cT', 0, YZ, 'T 11010');
      kc('cC', 1, 266, 'C 10100', { fill: C.amber, color: C.bg, opacity: 0 });
      local('lX', YX, 1); local('lY', YY, 2); local('lZ', YZ, 2); local('lN', YN, 3, { opacity: 0 });
      S.box('cur', { x: BX, y: YX, w: 326, h: 72, rx: 14, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      S.data({ global: 2, '数组大小': 4, '桶数': 3 });

      S.step('Find A：hash(A) = 01110…，global = 2 → 只看前 2 位 “01”，去桶指针数组的 01 号槽', function () {
        S.code(15); S.log('Find A：前 2 位 = 01');
        S.pop('hk'); S.pulse('tG', { delay: 400 });
        S.fly([282, 62], 'd2', { label: '01', w: 44, h: 30, size: 16, color: C.blue, delay: 700, dur: 800 });
        S.flash('d2', C.blue, { delay: 1500, hold: 600 }); S.pulse('d2', { delay: 1500 });
        S.data({ '看的位': '01' }, { delay: 700 });
      });
      S.step('顺着指针进桶，桶内顺序扫描找到 A。注意 00 和 01 指向同一个桶 —— 它的 local 只有 1 位', function () {
        S.code(16);
        S.flash('p2', C.blue, { prop: 'stroke' });
        S.fly([EL, y4(1)], [BL, T0[2]], { color: C.blue, dur: 650 });
        S.pop('cur', { delay: 600 });
        S.to('cA', { fill: C.green, color: C.bg }, { delay: 1000, dur: 300 }); S.pulse('cA', { delay: 1000, scale: 1.12 });
        S.flash('p0', C.cyan, { prop: 'stroke', delay: 1500, hold: 700 }); S.flash('p2', C.cyan, { prop: 'stroke', delay: 1500, hold: 700 });
        S.flash('d0', C.purple, { delay: 1500, hold: 500 }); S.flash('d2', C.purple, { delay: 1500, hold: 500 });
        S.pulse('lX', { delay: 1700, scale: 1.3 });
        S.log('Find A → 命中（桶 local = 1）', { delay: 1050, kind: 'ok' });
      });
      S.step('Insert C：hash(C) = 10100…，前 2 位 “10” → 指向的桶已经装满 3 个 key', function () {
        S.code([1, 3]); S.log('Insert C：前 2 位 = 10');
        S.hide('cur'); S.to('cA', { fill: PG, color: C.ink }, { dur: 300 });
        S.set('hk', { label: 'hash(C) = 10100…' }); S.pulse('hk', { scale: 1.06 });
        S.fly([282, 62], 'd4', { label: '10', w: 44, h: 30, size: 16, color: C.blue, delay: 400, dur: 800 });
        S.flash('d4', C.blue, { delay: 1200, hold: 500 }); S.pulse('d4', { delay: 1200 });
        S.fly([EL, y4(2)], [BL, YY], { color: C.blue, delay: 1400, dur: 600 });
        S.pop('cC', { delay: 1600 });
        S.to('bY', { stroke: C.red }, { delay: 2000, dur: 250 }); S.pulse('bY', { delay: 2000, scale: 1.04 });
        S.data({ '看的位': '10', '目标桶': '满（3 / 3）' }, { delay: 2000 }); S.log('桶满了 → 要分裂', { delay: 2050, kind: 'warn' });
      });
      S.step('这个桶的 local 已经等于 global（都是 2）：没有多余的位可分 → global 2 → 3，桶指针数组翻倍', function () {
        S.code([4, 6]);
        S.pulse('lY', { scale: 1.3 }); S.pulse('tG', { delay: 200, scale: 1.15 });
        S.count('tG', 3, { delay: 500, dur: 500 });
        for (var j = 0; j < 4; j++) {
          var a = 2 * j, b = a + 1, o = { delay: 800, dur: 750 };
          S.to('d' + a, { y: y8(a) }, o); S.set('d' + a, { label: B3[a] }, { delay: 1150 });
          S.set('d' + b, { opacity: 1 }, { delay: 800 }); S.to('d' + b, { y: y8(b) }, o);
          S.to('p' + a, { y1: y8(a), y2: T1[a] }, o);
          S.set('p' + b, { y1: y8(b), y2: T1[b] }); S.to('p' + b, { opacity: 1, draw: 1 }, { delay: 1550 + j * 80, dur: 450 });
        }
        S.data({ global: 3, '数组大小': 8, '看的位': null }, { delay: 1000 }); S.log('桶指针数组 4 → 8 项（数据没动）', { delay: 1600 });
      });
      S.step('只分裂满了的那个桶：新建一个桶，按第 3 位把 key 重新分配 —— 100 的留下，101 的搬过去', function () {
        S.code([8, 11]);
        var o = { dur: 600 };
        S.to('bY', { y: 320, stroke: C.line }, o); S.to('cQ', { y: 320 }, o); S.to('cR', { y: 320 }, o); S.to('cS', { y: 320 }, o); S.to('lY', { y: 320 }, o);
        S.to('p4', { y2: 320 }, o); S.to('p5', { y2: 330 }, o);
        S.pop('bN', { delay: 450 }); S.pop('lN', { delay: 550 });
        S.to('p5', { y2: YN }, { delay: 800, dur: 550 });
        S.count('lY', 3, { delay: 800, dur: 400 }); S.pulse('lY', { delay: 800 });
        S.flash('cR', C.amber, { delay: 1200, hold: 200, dur: 200 });
        S.to('cR', { x: CXS[0], y: YN }, { delay: 1500, dur: 750 }); S.ripple(CXS[0], YN, { delay: 2250, color: C.cyan });
        S.to('cS', { x: CXS[1] }, { delay: 1800, dur: 500 });
        S.data({ '桶数': 4, '目标桶': null, '桶 100': 'Q, S', '桶 101': 'R' }, { delay: 2250 }); S.log('按第 3 位重分配：R(101) 搬到新桶', { delay: 1500 });
      });
      S.step('再试一次：C 的前 3 位是 101 → 落进新桶，这回有位置了', function () {
        S.code(12); S.log('Insert C：前 3 位 = 101');
        S.fly([282, 62], 'd5', { label: '101', w: 52, h: 30, size: 16, color: C.blue, dur: 800 });
        S.flash('d5', C.blue, { delay: 800, hold: 500 }); S.pulse('d5', { delay: 800 });
        S.fly([EL, y8(5)], [BL, YN], { color: C.blue, delay: 1000, dur: 550 });
        S.code(3, { delay: 1500 });
        S.to('cC', { y: YN }, { delay: 1500, dur: 700, ease: 'inOut' }); S.ripple(CXS[1], YN, { delay: 2200, color: C.green });
        S.to('cC', { fill: PG, color: C.ink }, { delay: 2300, dur: 350 });
        S.data({ '桶 101': 'R, C' }, { delay: 2200 }); S.log('C 放进桶 101', { delay: 2200, kind: 'ok' });
      });
      S.step('其它桶一个字节都没动，只是被更多的槽指向；翻倍的只是很小的指针数组，不是整张表', function () {
        S.code(5);
        S.hide('hk');
        ['bX', 'bZ'].forEach(function (id, i) { S.flash(id, C.green, { prop: 'stroke', delay: i * 400, hold: 800 }); S.pulse(id, { delay: i * 400, scale: 1.03 }); });
        ['p0', 'p1', 'p2', 'p3'].forEach(function (id, i) { S.flash(id, C.green, { prop: 'stroke', delay: 150 + i * 90, hold: 700 }); });
        ['p6', 'p7'].forEach(function (id, i) { S.flash(id, C.green, { prop: 'stroke', delay: 550 + i * 90, hold: 700 }); });
        S.pulse('lX', { delay: 300, scale: 1.3 }); S.pulse('lZ', { delay: 700, scale: 1.3 });
        S.log('没满的桶原样保留', { delay: 800, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 4：线性哈希 ───────────────────────── */
  {
    name: '线性哈希：split pointer',
    moving: 'key 飞到按 mod 4 算出的槽、再沿指针进桶；溢出桶从桶 1 右边弹出；新桶在数组末尾弹出，20 从桶 0 滑进新桶；紫色 split pointer 往下挪一格；查 20 时小方块从槽 0 再跳到槽 4',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'int Locate(Key k) {',
      '  int i = k % N;             // 第一个哈希函数',
      '  if (i < split_ptr)         // 这个桶分裂过',
      '    i = k % (2 * N);         // 用第二个',
      '  return i;',
      '}',
      'void Insert(Key k, Value v) {',
      '  Bucket* b = bucket[Locate(k)];',
      '  if (!b->Full()) { b->Add(k, v); return; }',
      '  b->AddOverflow(k, v);      // 先挂溢出桶',
      '  SplitNext();               // 再去分裂',
      '}',
      'void SplitNext() {           // 不管谁溢出',
      '  bucket.push_back(NewBucket());',
      '  Rehash(bucket[split_ptr], 2 * N);',
      '  if (++split_ptr == N)      // 走到头：下一轮',
      '    N *= 2, split_ptr = 0;',
      '}'
    ].join('\n'),
    build: function (S) {
      var DX = 230, BX = 480, BL = 326, OX = 745, CX = [380, 480, 580], KX = 480, KY = 70;
      function ry(i) { return 126 + i * 66; }
      function entry(i, o) {
        S.line('p' + i, mix({ x1: DX + 37, y1: ry(i), x2: BL, y2: ry(i), stroke: C.purple, sw: 2, arrow: true }, o && { opacity: 0, draw: 0 }));
        S.box('d' + i, mix({ x: DX, y: ry(i), w: 70, h: 40, rx: 6, fill: C.cell, stroke: C.purple, label: String(i), size: 16 }, o));
        S.box('b' + i, mix({ x: BX, y: ry(i), w: 300, h: 48, rx: 10, fill: C.panel, stroke: C.line, sw: 2 }, o));
      }
      function kc(id, x, y, label, o) { S.box(id, mix({ x: x, y: y, w: 80, h: 34, rx: 6, fill: PG, stroke: 'none', sw: 0, label: label, size: 16, trail: 3 }, o)); }
      function req(label, col, d) { S.set('rq', { label: label, fill: col }, { delay: d }); S.pop('rq', { delay: d + 30 }); }
      function go(i, d, col) {                   /* 请求飞到槽 i，再沿指针进桶 i */
        S.fly('rq', 'd' + i, { color: col, delay: d, dur: 750 });
        S.flash('d' + i, col, { delay: d + 750, hold: 450 }); S.pulse('d' + i, { delay: d + 750 });
        S.fly([DX + 37, ry(i)], [BL, ry(i)], { color: col, delay: d + 1000, dur: 450 });
        return d + 1450;
      }
      S.text('note', { x: 20, y: 24, text: '每桶最多 3 个 key —— 示意值；6 / 17 / 8 / 20 与课上例子相同', anchor: 'start', size: 14, color: C.mute });
      S.text('tN', { x: 840, y: 24, anchor: 'end', val: 4, pre: '桶的个数：', color: C.amber, size: 16 });
      S.text('h1', { x: 836, y: 62, anchor: 'end', text: '第一个哈希函数：key mod 4', color: C.ink });
      S.text('h2', { x: 836, y: 88, anchor: 'end', text: '第二个哈希函数：key mod 8', color: C.mute });
      S.text('tDir', { x: DX, y: 86, text: '桶指针数组', color: C.ink });
      [0, 1, 2, 3].forEach(function (i) { entry(i); }); entry(4, { opacity: 0 }); entry(5, { opacity: 0 });
      S.line('ol', { x1: BX + 152, y1: ry(1), x2: OX - 67, y2: ry(1), stroke: C.amber, sw: 2, arrow: true, dash: '5 4', opacity: 0, draw: 0 });
      S.box('ov', { x: OX, y: ry(1), w: 130, h: 48, rx: 10, fill: C.panel, stroke: C.amber, sw: 2, dash: '6 5', opacity: 0 });
      S.text('tOv', { x: OX, y: ry(1) - 38, text: '溢出桶', size: 14, color: C.amber, opacity: 0 });
      kc('k8', CX[0], ry(0), '8'); kc('k20', CX[1], ry(0), '20');
      kc('k5', CX[0], ry(1), '5'); kc('k9', CX[1], ry(1), '9'); kc('k13', CX[2], ry(1), '13');
      kc('k6', CX[0], ry(2), '6'); kc('k7', CX[0], ry(3), '7'); kc('k11', CX[1], ry(3), '11');
      S.line('sp', { x1: 56, y1: ry(0), x2: 172, y2: ry(0), stroke: C.purple, sw: 4, arrow: true });
      S.text('tSp', { x: 110, y: ry(0) - 18, text: 'split pointer', size: 14, color: C.purple, weight: 700 });
      S.box('rq', { x: KX, y: KY, w: 130, h: 38, rx: 6, fill: C.blue, stroke: 'none', sw: 0, label: 'Find 6', color: C.bg, size: 16, opacity: 0 });
      S.box('k17', { x: KX, y: KY, w: 80, h: 34, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: '17', color: C.bg, size: 16, opacity: 0, trail: 3 });
      S.data({ N: 4, 'split pointer': '槽 0', '桶数': 4 });
      function moveSp(i, d) { S.to('sp', { y1: ry(i), y2: ry(i) }, { delay: d, dur: 700 }); S.to('tSp', { y: ry(i) - 18 }, { delay: d, dur: 700 }); }

      S.step('Find 6：6 mod 4 = 2。槽 2 在 split pointer 下方（还没分裂过）→ 只用第一个哈希函数，直接进桶扫', function () {
        S.code([2, 3]); S.log('Find 6：6 mod 4 = 2');
        req('Find 6', C.blue, 0); S.flash('h1', C.blue, { prop: 'color', delay: 300, hold: 700 });
        var t = go(2, 600, C.blue);
        S.to('k6', { fill: C.green, color: C.bg }, { delay: t, dur: 300 }); S.pulse('k6', { delay: t, scale: 1.15 }); S.ripple(CX[0], ry(2), { delay: t, color: C.green });
        S.hide('rq', { delay: t }); S.code(5, { delay: t });
        S.data({ '请求': 'Find 6 → 桶 2' }, { delay: t }); S.log('桶 2 里找到 6', { delay: t, kind: 'ok' });
      });
      S.step('Insert 17：17 mod 4 = 1，桶 1 已经满了 → 先给它挂一个溢出桶，把 17 放进去', function () {
        S.code([8, 10]); S.log('Insert 17：17 mod 4 = 1');
        S.to('k6', { fill: PG, color: C.ink }, { dur: 300 });
        req('Insert 17', C.amber, 0);
        var t = go(1, 500, C.amber);
        S.to('b1', { stroke: C.red }, { delay: t, dur: 250 }); S.pulse('b1', { delay: t, scale: 1.04 });
        S.to('ol', { opacity: 1, draw: 1 }, { delay: t + 400, dur: 400 }); S.pop('ov', { delay: t + 650 }); S.pop('tOv', { delay: t + 750 });
        S.hide('rq', { delay: t + 600 }); S.pop('k17', { delay: t + 600 });
        S.move('k17', OX, ry(1), { delay: t + 1000, dur: 800 }); S.ripple(OX, ry(1), { delay: t + 1800, color: C.amber });
        S.to('k17', { fill: PG, color: C.ink }, { delay: t + 1900, dur: 350 });
        S.data({ '请求': 'Insert 17 → 桶 1（满）', '桶 1': '5 9 13 + 溢出 17' }, { delay: t + 1800 }); S.log('桶 1 满 → 挂溢出桶', { delay: t + 300, kind: 'warn' });
      });
      S.step('一有溢出就触发一次分裂 —— 但分裂的不是桶 1，而是 split pointer 指着的桶 0（哪怕它还有空位）', function () {
        S.code([11, 13]);
        S.to('b1', { stroke: C.line }, { dur: 400 });
        S.flash('sp', C.amber, { prop: 'stroke', delay: 200, hold: 800 }); S.pulse('tSp', { delay: 200, scale: 1.2 });
        S.fly([172, ry(0)], [BL, ry(0)], { color: C.purple, delay: 500, dur: 600 });
        S.to('b0', { stroke: C.amber }, { delay: 1100, dur: 300 }); S.pulse('b0', { delay: 1100, scale: 1.04 });
        S.log('SplitNext()：分裂桶 0', { delay: 1100 });
      });
      S.step('桶指针数组末尾加一项，指向新建的桶 4', function () {
        S.code(14);
        S.pop('d4'); S.to('p4', { opacity: 1, draw: 1 }, { delay: 350, dur: 400 }); S.pop('b4', { delay: 600 });
        S.count('tN', 5, { delay: 600, dur: 300 }); S.pulse('tN', { delay: 600 });
        S.data({ '桶数': 5 }, { delay: 600 }); S.log('新增桶 4', { delay: 600 });
      });
      S.step('用第二个哈希函数 mod 8 重新分配桶 0 里的 key：8 mod 8 = 0 留下，20 mod 8 = 4 搬到新桶', function () {
        S.code(15);
        S.to('h2', { color: C.amber }, { dur: 300 }); S.pulse('h2', { scale: 1.06 });
        S.flash('k8', C.green, { delay: 500, hold: 500 }); S.pulse('k8', { delay: 500 });
        S.flash('k20', C.amber, { delay: 1200, hold: 300 }); S.pulse('k20', { delay: 1200 });
        S.move('k20', CX[0], ry(4), { delay: 1600, dur: 900 }); S.ripple(CX[0], ry(4), { delay: 2500, color: C.cyan });
        S.to('b0', { stroke: C.line }, { delay: 2500, dur: 300 });
        S.data({ '桶 0': '8', '桶 4': '20' }, { delay: 2500 }); S.log('8 mod 8 = 0 留下；20 mod 8 = 4 搬走', { delay: 1200 });
      });
      S.step('split pointer 下移一格：下一次分裂轮到桶 1', function () {
        S.code(16);
        moveSp(1, 200); S.pulse('tSp', { delay: 900, scale: 1.2 });
        S.data({ 'split pointer': '槽 1' }, { delay: 600 }); S.log('split_ptr = 1', { delay: 600 });
      });
      S.step('Find 20：20 mod 4 = 0，可槽 0 在 split pointer 上方 → 它分裂过，要再用 mod 8 = 4 才是真实位置', function () {
        S.code([2, 3]); S.log('Find 20：20 mod 4 = 0');
        req('Find 20', C.blue, 0);
        S.fly('rq', 'd0', { color: C.blue, delay: 500, dur: 750 });
        S.flash('d0', C.amber, { delay: 1250, hold: 600 }); S.pulse('d0', { delay: 1250 });
        S.flash('sp', C.amber, { prop: 'stroke', delay: 1300, hold: 600 });
        S.code(4, { delay: 1500 }); S.flash('h2', C.blue, { prop: 'color', delay: 1500, hold: 700 });
        S.fly('d0', 'd4', { label: 'mod 8', w: 64, h: 28, color: C.blue, delay: 1900, dur: 800 });
        S.flash('d4', C.blue, { delay: 2700, hold: 450 }); S.pulse('d4', { delay: 2700 });
        S.fly([DX + 37, ry(4)], [BL, ry(4)], { color: C.blue, delay: 2900, dur: 450 });
        S.to('k20', { fill: C.green, color: C.bg }, { delay: 3350, dur: 300 }); S.pulse('k20', { delay: 3350, scale: 1.15 }); S.ripple(CX[0], ry(4), { delay: 3350, color: C.green });
        S.hide('rq', { delay: 3350 });
        S.data({ '请求': 'Find 20 → 槽 0 → 槽 4' }, { delay: 2700 }); S.log('槽 0 < split_ptr → 20 mod 8 = 4，命中', { delay: 3350, kind: 'ok' });
      });
      S.step('分裂一路推进：下次溢出就轮到挂着溢出链的桶 1，按 mod 8 重分配后溢出桶消失，自然摊平', function () {
        S.code([14, 16]); S.log('下一次 SplitNext()：分裂桶 1');
        S.to('k20', { fill: PG, color: C.ink }, { dur: 300 });
        S.to('b1', { stroke: C.amber }, { dur: 300 });
        S.pop('d5', { delay: 300 }); S.to('p5', { opacity: 1, draw: 1 }, { delay: 550, dur: 400 }); S.pop('b5', { delay: 750 });
        S.count('tN', 6, { delay: 750, dur: 300 });
        S.move('k5', CX[0], ry(5), { delay: 1200, dur: 850 }); S.move('k13', CX[1], ry(5), { delay: 1450, dur: 850 });
        S.move('k9', CX[0], ry(1), { delay: 2100, dur: 450 });
        S.move('k17', CX[1], ry(1), { delay: 2300, dur: 750 }); S.ripple(CX[1], ry(1), { delay: 3050, color: C.green });
        S.to('ol', { draw: 0, opacity: 0 }, { delay: 3000, dur: 350 }); S.hide('ov', { delay: 3000 }); S.hide('tOv', { delay: 3000 });
        S.to('b1', { stroke: C.line }, { delay: 3100, dur: 300 });
        moveSp(2, 3200);
        S.data({ '桶 1': '9 17', '桶 5': '5 13', '桶数': 6, 'split pointer': '槽 2' }, { delay: 3100 });
        S.log('5、13 → 桶 5；9、17 留在桶 1', { delay: 2300, kind: 'ok' });
      });
    }
  }
  ]
});
})();
