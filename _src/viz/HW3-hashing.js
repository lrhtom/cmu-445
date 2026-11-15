/* HW3 索引与过滤器：线性探测与墓碑 / 布谷鸟哈希的踢出与死循环 / 可扩展哈希（按最低位）/ Bloom filter
 * 所有键、哈希值、表大小都是讲义里自编的示意数据，规则与作业题干的写法一致。 */
(function () {
var C = Viz.C, CHIP = '#2b4172', TOMB = '#3b3f55';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #3（题目 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw3-clean.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Homework #3（官方答案 PDF）', u: 'https://15445.courses.cs.cmu.edu/fall2025/files/hw3-sols.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #07 Hash Tables（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/07-hashtables.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #07 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/07-hashtables.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #09 Filters & Index Structures（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/09-indexes2.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #09 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/09-indexes2.pdf' }
];
function note(S, t) { S.text('note', { x: 20, y: 24, text: t, anchor: 'start', size: 14, color: C.mute }); }
function title(S, id, x, y, text, o) {
  var p = { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute };
  for (var k in o) p[k] = o[k];
  S.text(id, p);
}
function chip(S, id, x, y, label, o) {
  var p = { x: x, y: y, w: 60, h: 38, rx: 7, fill: C.amber, stroke: 'none', sw: 0, label: String(label), color: C.bg, size: 17, opacity: 0 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
function land(S, id, delay) { S.to(id, { fill: CHIP, color: C.ink }, { delay: delay, dur: 350 }); }

Viz.register('hw3-hashing', {
  title: 'HW3：线性探测 · 布谷鸟 · 可扩展哈希 · Bloom filter',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：线性探测与墓碑 ───────────── */
  {
    name: '线性探测与墓碑',
    moving: '探测框逐槽下移、到底绕回槽 0；待插入的键飞进落点；被删的键缩小、墓碑弹出；「如果清空」时墓碑淡去、探测框在空槽处变红停下；墓碑被新键复用',
    lang: '伪代码',
    code: [
      'Insert(x):',
      '  i = h(x)',
      '  while slot[i] 被占且不是墓碑:',
      '    i = (i + 1) % N     // 到底绕回',
      '  slot[i] = x',
      'Find(x):',
      '  i = h(x)',
      '  while slot[i] 不是空槽:',
      '    if slot[i] == x: return i',
      '    i = (i + 1) % N     // 墓碑也继续',
      '  return 不存在',
      'Delete(x):',
      '  i = Find(x)',
      '  slot[i] = 墓碑         // 不能清空'
    ].join('\n'),
    build: function (S) {
      var SX = 330, PX = 680, PY = 262;
      function sy(i) { return 132 + i * 76; }
      note(S, '键和表大小为示意');
      title(S, 'tT', 40, 66, '5 个槽 · h(x) = x mod 5');
      for (var i = 0; i < 5; i++) {
        S.box('s' + i, { x: SX, y: sy(i), w: 240, h: 58, rx: 9, fill: C.panel, stroke: C.line, sw: 1.5 });
        S.text('si' + i, { x: 150, y: sy(i), text: '槽 ' + i, anchor: 'start', size: 16, color: C.mute });
      }
      S.box('tomb', { x: SX, y: sy(3), w: 120, h: 38, rx: 7, fill: TOMB, stroke: C.mute, sw: 1, dash: '4 3', label: '✝ 墓碑', size: 16, color: C.mute, opacity: 0 });
      S.box('cur', { x: SX, y: sy(2), w: 264, h: 70, rx: 12, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      S.text('op', { x: PX, y: 128, text: '', size: 19, weight: 700 });
      S.text('hx', { x: PX, y: 174, text: '', size: 17, color: C.cyan });
      S.text('res', { x: PX, y: 360, text: '', size: 17, weight: 700, color: C.green });
      S.text('wrap', { x: 535, y: 132, text: '', size: 15, color: C.amber });
      S.data({ '表': '[ -, -, -, -, - ]' });
      function probe(path, d0, gap, col) {
        path.forEach(function (i, n) {
          S.move('cur', SX, sy(i), { delay: d0 + n * gap, dur: Math.min(gap - 60, 420) });
          if (n < path.length - 1) S.flash('s' + i, col || C.red, { prop: 'stroke', delay: d0 + n * gap + 300 });
        });
      }
      function put(key, slot, d) {
        chip(S, 'k' + key, PX, PY, key);
        S.pop('k' + key, { delay: d });
        S.move('k' + key, SX, sy(slot), { delay: d + 450, dur: 750 });
        S.ripple(SX, sy(slot), { delay: d + 1200, color: C.green }); land(S, 'k' + key, d + 1200);
      }

      S.step('插入 12：h(12) = 12 mod 5 = 2 → 槽 2 是空的，直接放', function () {
        S.code([1, 5]); S.set('op', { text: '插入 12' }); S.set('hx', { text: 'h(12) = 12 mod 5 = 2' });
        S.pop('cur', { delay: 200 }); put(12, 2, 300);
        S.data({ '表': '[ -, -, 12, -, - ]' }, { delay: 1500 });
      });
      S.step('插入 7：h = 2，槽 2 被 12 占了 → 往下探一格到槽 3', function () {
        S.code([3, 4]); S.set('op', { text: '插入 7' }); S.set('hx', { text: 'h(7) = 7 mod 5 = 2' });
        probe([2, 3], 0, 600); put(7, 3, 600);
        S.data({ '表': '[ -, -, 12, 7, - ]' }, { delay: 1800 });
      });
      S.step('插入 22：h = 2 → 槽 2、3 都被占 → 槽 4', function () {
        S.code([3, 4]); S.set('op', { text: '插入 22' }); S.set('hx', { text: 'h(22) = 22 mod 5 = 2' });
        probe([2, 3, 4], 0, 500); put(22, 4, 1000);
        S.data({ '表': '[ -, -, 12, 7, 22 ]' }, { delay: 2200 });
      });
      S.step('插入 3：h = 3 → 槽 3、4 被占 → 到底了，绕回槽 0', function () {
        S.code(4); S.set('op', { text: '插入 3' }); S.set('hx', { text: 'h(3) = 3 mod 5 = 3' });
        probe([3, 4], 0, 500);
        S.set('wrap', { text: '↺ 从槽 4 绕回槽 0' }, { delay: 900 });
        S.move('cur', SX, sy(0), { delay: 1000, dur: 650, ease: 'inOut' });
        put(3, 0, 1100);
        S.data({ '表': '[ 3, -, 12, 7, 22 ]' }, { delay: 2300 });
      });
      S.step('删除 7：先查找（槽 2 → 槽 3 找到），然后留下墓碑 —— 不能直接清空', function () {
        S.code([12, 14]); S.set('op', { text: '删除 7' }); S.set('hx', { text: 'h(7) = 2' }); S.set('wrap', { text: '' });
        probe([2, 3], 0, 550);
        S.to('k7', { fill: C.red, color: C.ink }, { delay: 700, dur: 250 });
        S.to('k7', { scale: .3, opacity: 0 }, { delay: 1000, dur: 400, ease: 'in' });
        S.pop('tomb', { delay: 1300 });
        S.data({ '表': '[ 3, -, 12, ✝, 22 ]' }, { delay: 1400 }); S.log('槽 3 ← 墓碑', { delay: 1400 });
      });
      S.step('查找 22：槽 2 不是 → 槽 3 是墓碑，当作「被占」继续 → 槽 4 命中', function () {
        S.code([8, 10]); S.set('op', { text: '查找 22' }); S.set('hx', { text: 'h(22) = 2' });
        S.move('cur', SX, sy(2), { dur: 400 }); S.flash('s2', C.red, { prop: 'stroke', delay: 300 });
        S.move('cur', SX, sy(3), { delay: 600, dur: 400 }); S.flash('tomb', C.amber, { delay: 900 });
        S.move('cur', SX, sy(4), { delay: 1300, dur: 400 }); S.to('cur', { stroke: C.green }, { delay: 1700, dur: 200 });
        S.flash('k22', C.green, { delay: 1700 }); S.set('res', { text: '✓ 找到 22（槽 4）', color: C.green }, { delay: 1700 });
        S.log('Find(22) → 槽 4', { delay: 1750, kind: 'ok' });
      });
      S.step('对照：如果删除时把槽 3 清空 —— 查找在槽 3 看到空槽就停，误判 22 不存在', function () {
        S.code(8); S.set('res', { text: '' }); S.set('op', { text: '假如没有墓碑' });
        S.to('cur', { stroke: C.blue }, { dur: 200 });
        S.to('tomb', { opacity: .12 }, { dur: 400 });
        S.move('cur', SX, sy(2), { delay: 300, dur: 400 }); S.move('cur', SX, sy(3), { delay: 900, dur: 400 });
        S.to('cur', { stroke: C.red }, { delay: 1300, dur: 200 }); S.ripple(SX, sy(3), { delay: 1300, color: C.red });
        S.set('res', { text: '✗ 遇到空槽就停：22 "不存在"', color: C.red }, { delay: 1350 });
        S.to('tomb', { opacity: 1 }, { delay: 2400, dur: 400 }); S.to('cur', { stroke: C.blue }, { delay: 2400, dur: 300 });
        S.log('没有墓碑 → 漏查 22', { delay: 1400, kind: 'err' });
      }, { hold: 1000 });
      S.step('插入 17：h = 2 → 槽 2 被占 → 槽 3 是墓碑，可以直接复用', function () {
        S.code([3, 5]); S.set('op', { text: '插入 17' }); S.set('hx', { text: 'h(17) = 17 mod 5 = 2' }); S.set('res', { text: '' });
        probe([2, 3], 0, 600);
        S.hide('tomb', { delay: 900 }); put(17, 3, 700);
        S.data({ '表': '[ 3, -, 12, 17, 22 ]' }, { delay: 1900 }); S.log('墓碑被复用', { delay: 1900, kind: 'ok' });
      });
      S.step('查找 7：2 → 3 → 4 → 绕回 0 → 槽 1 是空槽，停 → 7 不存在', function () {
        S.code([7, 11]); S.set('op', { text: '查找 7' }); S.set('hx', { text: 'h(7) = 2' });
        [2, 3, 4, 0, 1].forEach(function (i, n) {
          S.move('cur', SX, sy(i), { delay: n * 420, dur: 360 });
        });
        S.to('cur', { stroke: C.mute }, { delay: 2000, dur: 300 });
        S.set('res', { text: '槽 1 是空槽 → 7 不存在', color: C.mute }, { delay: 2050 });
        S.log('Find(7) → 不存在', { delay: 2100 });
      });
    }
  },

  /* ───────────── 场景 2：布谷鸟哈希 ───────────── */
  {
    name: '布谷鸟哈希：踢出与死循环',
    moving: '新键飞向候选格子；被踢的键滑到两表之间的中转位、再滑进另一张表；三个键在 T1[2]、T2[2] 之间来回转圈，踢出次数滚动；死循环时三个键一起闪红',
    lang: '伪代码',
    code: [
      'h1(x) = x mod 4',
      'h2(x) = (x >> 2) mod 4',
      'Insert(x):',
      '  if T1[h1(x)] 空: T1[h1(x)] = x; return',
      '  if T2[h2(x)] 空: T2[h2(x)] = x; return',
      '  t = 1                  // 先踢 T1 里的',
      '  loop:',
      '    swap(x, Tt[ht(x)])   // x 占位，旧键出来',
      '    if x 为空: return',
      '    t = 3 - t            // 去另一张表',
      '    if 踢的次数 > 上限:',
      '      扩容 / 换哈希函数重建'
    ].join('\n'),
    build: function (S) {
      var T1X = 260, T2X = 600, TR = [430, 320], TR2 = [430, 384];
      function ty(i) { return 160 + i * 80; }
      note(S, '键和哈希函数为示意');
      title(S, 'tT', 40, 66, 'h1(x) = x mod 4　　h2(x) = (x >> 2) mod 4　　先试 T1；都满时踢 T1 里的');
      ['T1', 'T2'].forEach(function (n, t) {
        var X = t ? T2X : T1X;
        S.text('h' + t, { x: X, y: 112, text: n, size: 18, weight: 700, color: t ? C.purple : C.blue });
        for (var i = 0; i < 4; i++) {
          S.box('t' + t + i, { x: X, y: ty(i), w: 200, h: 60, rx: 9, fill: C.panel, stroke: C.line, sw: 1.5 });
          S.text('ti' + t + i, { x: X - 116, y: ty(i), text: '[' + i + ']', anchor: 'end', size: 15, color: C.mute });
        }
      });
      S.text('info', { x: 430, y: 470, text: '', size: 17, weight: 700, color: C.cyan });
      S.text('info2', { x: 430, y: 506, text: '', size: 15, color: C.mute });
      S.text('kick', { x: 840, y: 66, anchor: 'end', val: 0, pre: '踢出次数：', size: 16, weight: 700, color: C.amber, opacity: 0 });
      chip(S, 'c6', 790, 470, 6); chip(S, 'c10', 790, 470, 10); chip(S, 'c26', 790, 470, 26); chip(S, 'c42', 790, 470, 42);
      S.text('pendT', { x: 790, y: 432, text: '待插入', size: 14, color: C.mute });
      S.data({ T1: '[ -, -, -, - ]', T2: '[ -, -, -, - ]' });
      function arrive(id, d) { S.pop(id, { delay: d }); }

      S.step('插入 6：h1(6) = 2，T1[2] 空 → 直接放进 T1', function () {
        S.code([3, 4]); S.set('info', { text: '6 → (h1, h2) = (2, 1)' });
        arrive('c6', 100);
        S.move('c6', T1X, ty(2), { delay: 500, dur: 750 }); land(S, 'c6', 1250); S.ripple(T1X, ty(2), { delay: 1250, color: C.green });
        S.data({ T1: '[ -, -, 6, - ]' }, { delay: 1250 });
      });
      S.step('插入 10：h1 = 2 被 6 占了；h2(10) = 2，T2[2] 空 → 放进 T2', function () {
        S.code(5); S.set('info', { text: '10 → (h1, h2) = (2, 2)' });
        arrive('c10', 100);
        S.flash('t02', C.red, { prop: 'stroke', delay: 400 });
        S.move('c10', T2X, ty(2), { delay: 700, dur: 800 }); land(S, 'c10', 1500); S.ripple(T2X, ty(2), { delay: 1500, color: C.green });
        S.data({ T2: '[ -, -, 10, - ]' }, { delay: 1500 });
      });
      S.step('插入 26：(2, 2) —— T1[2]（6）和 T2[2]（10）都满 → 按规则踢出 T1 里的 6', function () {
        S.code([6, 8]); S.set('info', { text: '26 → (h1, h2) = (2, 2)' });
        arrive('c26', 100);
        S.flash('t02', C.red, { prop: 'stroke', delay: 400 }); S.flash('t12', C.red, { prop: 'stroke', delay: 550 });
        S.to('c6', { fill: C.red }, { delay: 800, dur: 200 }); S.move('c6', TR[0], TR[1], { delay: 900, dur: 600 });
        S.move('c26', T1X, ty(2), { delay: 1100, dur: 700 }); land(S, 'c26', 1800);
        S.to('kick', { opacity: 1 }, { delay: 900, dur: 200 }); S.count('kick', 1, { delay: 900, dur: 300 });
      });
      S.step('被踢的 6 去另一张表：h2(6) = 1 → T2[1] 空，落定', function () {
        S.code([9, 10]);
        S.move('c6', T2X, ty(1), { dur: 750 }); land(S, 'c6', 750); S.ripple(T2X, ty(1), { delay: 750, color: C.green });
        S.data({ T1: '[ -, -, 26, - ]', T2: '[ -, 6, 10, - ]' }, { delay: 800 }); S.log('6 → T2[1]', { delay: 800, kind: 'ok' });
      });
      S.step('插入 42：也是 (2, 2) → 踢出 26；26 去 T2[2]，又把 10 踢出来', function () {
        S.code([6, 10]); S.set('info', { text: '42 → (h1, h2) = (2, 2)' });
        arrive('c42', 100);
        S.move('c26', TR[0], TR[1], { delay: 500, dur: 500 }); S.move('c42', T1X, ty(2), { delay: 700, dur: 650 }); land(S, 'c42', 1350);
        S.move('c10', TR2[0], TR2[1], { delay: 1100, dur: 500 }); S.move('c26', T2X, ty(2), { delay: 1300, dur: 550 });
        S.count('kick', 3, { delay: 500, dur: 1300 });
      });
      S.step('10 回 T1[2] 踢出 42，42 去 T2[2] 踢出 26，26 回 T1[2] …… 同一串键在两个格子之间转圈', function () {
        S.code([7, 10]);
        var R = [['c42', 'c10', 'c26'], ['c10', 'c26', 'c42']];
        R.forEach(function (r, n) {
          var d = n * 1300;
          S.move(r[0], TR[0], TR[1], { delay: d, dur: 450 }); S.move(r[1], T1X, ty(2), { delay: d + 200, dur: 550 });
          S.move(r[2], TR2[0], TR2[1], { delay: d + 650, dur: 450 }); S.move(r[0], T2X, ty(2), { delay: d + 850, dur: 450 });
        });
        S.count('kick', 7, { dur: 2600 });
        S.log('踢出次数不断增加 …', { delay: 1500, kind: 'warn' });
      });
      S.step('检测到循环：10、26、42 的候选位置都是 (2, 2) —— 3 个键只有 T1[2]、T2[2] 两个位置', function () {
        S.code([11, 12]);
        ['c10', 'c26', 'c42'].forEach(function (id, n) { S.flash(id, C.red, { delay: n * 150 }); S.pulse(id, { delay: n * 150 }); });
        S.flash('t02', C.red, { prop: 'stroke', delay: 500 }); S.flash('t12', C.red, { prop: 'stroke', delay: 500 });
        S.set('info', { text: '3 个键 · 2 个候选位置 → 必然死循环', color: C.red }, { delay: 400 });
        S.log('超过上限 → 扩容 / 换哈希函数重建', { delay: 700, kind: 'err' });
      });
      S.step('判断方法：写出每个键的 (h1, h2)，若 k 个键的候选位置加起来不到 k 个，就一定转不出来', function () {
        S.code(12);
        S.set('info2', { text: '反例：3、7、11、15 的 h1 都是 3，但 h2 是 0、1、2、3 —— 4 个键有 5 个位置，不会死循环' }, { delay: 300 });
        S.pulse('info2', { delay: 300, scale: 1.04 });
        S.log('候选位置数 < 键数 ⇒ 死循环', { delay: 500 });
      }, { hold: 2000 });
    }
  },

  /* ───────────── 场景 3：可扩展哈希（最低位） ───────────── */
  {
    name: '可扩展哈希：按最低位',
    moving: '新键飞向目录指向的桶，满了就弹回；目录格子成倍弹出、标签位数变长；指针线改指新桶；桶分裂时键滑进新桶；全局深度数字滚动',
    lang: '伪代码',
    code: [
      'Insert(x):',
      '  b = dir[x 的最低 g 位]',
      '  while b 已满:',
      '    if b.d == g:',
      '      目录翻倍; g = g + 1',
      '      // 新格子复制旧格子的指针',
      '    按第 b.d 位把 b 拆成两个桶',
      '    两个新桶的 d = b.d + 1',
      '    改目录指针，重新分配 b 的键',
      '    b = dir[x 的最低 g 位]',
      '  b.Add(x)'
    ].join('\n'),
    build: function (S) {
      var DX = 130, BX = 565, BL = 435, PEND = [330, 66];
      var BY = { A: 120, O: 230, C: 340, E: 450 };
      function dy(i) { return 112 + i * 50; }
      function bin(i, g) { if (!g) return '·'; var s = i.toString(2); while (s.length < g) s = '0' + s; return s; }
      note(S, '键为示意；哈希函数取键本身');
      title(S, 'tD', 80, 66, '目录');
      title(S, 'tB', 440, 66, '桶（最多 2 个键）');
      S.text('g', { x: 840, y: 24, anchor: 'end', val: 0, pre: '全局深度 g = ', size: 17, weight: 700, color: C.amber });
      for (var i = 0; i < 8; i++) {
        S.box('D' + i, { x: DX, y: dy(i), w: 96, h: 36, rx: 6, fill: C.panel, stroke: C.blue, sw: 1.5, label: bin(i, 0), size: 16, opacity: i ? 0 : 1 });
        S.line('L' + i, { x1: DX + 48, y1: dy(i), x2: BL, y2: BY.O, stroke: C.line, sw: 1.6, arrow: true, opacity: i ? 0 : 1 });
      }
      [['O', '—', 'd = 0', 1], ['A', '…0', 'd = 1', 0], ['C', '…001', 'd = 3', 0], ['E', '…11', 'd = 2', 0]].forEach(function (b) {
        S.box('B' + b[0], { x: BX, y: BY[b[0]], w: 260, h: 60, rx: 9, fill: C.panel, stroke: C.line, sw: 1.6, opacity: b[3] });
        S.text('Bn' + b[0], { x: BL + 12, y: BY[b[0]], text: b[1], anchor: 'start', size: 16, weight: 700, color: C.cyan, opacity: b[3] });
        S.text('Bd' + b[0], { x: BX + 145, y: BY[b[0]], text: b[2], anchor: 'start', size: 15, color: C.mute, opacity: b[3] });
      });
      function slot(b, k) { return [BX - 15 + k * 66, BY[b]]; }
      [5, 9, 6, 13].forEach(function (k) { S.box('k' + k, { x: PEND[0], y: PEND[1], w: 56, h: 36, rx: 7, fill: C.amber, stroke: 'none', sw: 0, label: String(k), color: C.bg, size: 17, opacity: 0 }); });
      S.text('pend', { x: 280, y: 66, text: '', anchor: 'end', size: 15, color: C.mute });
      S.data({ g: 0, '桶': '— d0 [ ]' });
      function grow(g0, d) {
        var n0 = 1 << g0;
        for (var i = 0; i < n0; i++) S.set('D' + i, { label: bin(i, g0 + 1) }, { delay: d });
        for (var j = n0; j < 2 * n0; j++) {
          S.pop('D' + j, { delay: d + (j - n0) * 120 });
          S.set('D' + j, { label: bin(j, g0 + 1) }, { delay: d });
        }
        S.count('g', g0 + 1, { delay: d, dur: 400 }); S.pulse('g', { delay: d + 400 });
      }
      function point(i, b, d, dur) { S.to('L' + i, { y2: BY[b], opacity: 1 }, { delay: d, dur: dur || 500 }); }
      function bounce(id, b, d) {
        S.move(id, BL - 40, BY[b], { delay: d, dur: 600, ease: 'in' });
        S.to(id, { fill: C.red }, { delay: d + 600, dur: 150 }); S.ripple(BL, BY[b], { delay: d + 600, color: C.red });
        S.move(id, PEND[0], PEND[1], { delay: d + 750, dur: 600, ease: 'out' }); S.to(id, { fill: C.amber }, { delay: d + 1300, dur: 200 });
      }

      S.step('g = 0：目录只有 1 格，指向唯一的桶；插入 5、9 都放得下', function () {
        S.code([1, 2]); S.set('pend', { text: '插入' });
        S.pop('k5'); S.move('k5', slot('O', 0)[0], BY.O, { delay: 300, dur: 700 }); land(S, 'k5', 1000);
        S.pop('k9', { delay: 500 }); S.move('k9', slot('O', 1)[0], BY.O, { delay: 800, dur: 700 }); land(S, 'k9', 1500);
        S.data({ '桶': '— d0 [5, 9]' }, { delay: 1500 });
      });
      S.step('插入 6：桶已满，而且它的 d = g = 0 → 先把目录翻倍到 g = 1', function () {
        S.code([3, 5]);
        S.pop('k6'); bounce('k6', 'O', 300);
        grow(0, 1500); point(1, 'O', 1700);
        S.data({ g: 1 }, { delay: 1600 }); S.log('目录 1 → 2 格', { delay: 1600 });
      });
      S.step('分裂：新桶接管 …0；按最低 1 位重新分配 —— 6 去新桶，5、9（…1）留下', function () {
        S.code([7, 9]);
        S.pop('BA'); S.to('BnA', { opacity: 1 }, { delay: 200, dur: 300 }); S.to('BdA', { opacity: 1 }, { delay: 200, dur: 300 });
        S.set('BnO', { text: '…1' }, { delay: 300 }); S.set('BdO', { text: 'd = 1' }, { delay: 300 }); S.flash('BdO', C.amber, { prop: 'color', delay: 300 });
        point(0, 'A', 400, 600);
        S.move('k6', slot('A', 0)[0], BY.A, { delay: 900, dur: 700 }); land(S, 'k6', 1600);
        S.data({ '桶': '…0 d1 [6] · …1 d1 [5, 9]' }, { delay: 1600 });
      });
      S.step('插入 13（二进制 1101，最低位 1）：…1 桶已满且 d = g = 1 → 目录再翻倍到 g = 2', function () {
        S.code([3, 5]);
        S.pop('k13'); bounce('k13', 'O', 300);
        grow(1, 1500); point(2, 'A', 1700); point(3, 'O', 1800);
        S.data({ g: 2 }, { delay: 1600 });
      });
      S.step('把 …1 拆成 …01 和 …11：5、9、13 的最低 2 位都是 01 —— 全挤在 …01，…11 是空的', function () {
        S.code([7, 9]);
        S.pop('BE'); S.to('BnE', { opacity: 1 }, { delay: 200, dur: 300 }); S.to('BdE', { opacity: 1 }, { delay: 200, dur: 300 });
        S.set('BnO', { text: '…01' }, { delay: 300 }); S.set('BdO', { text: 'd = 2' }, { delay: 300 }); S.flash('BdO', C.amber, { prop: 'color', delay: 300 });
        point(3, 'E', 400, 600);
        S.pulse('k5', { delay: 900 }); S.pulse('k9', { delay: 1000 }); S.flash('k13', C.red, { delay: 1200 });
        S.log('5=0101 · 9=1001 · 13=1101：低 2 位都是 01', { delay: 1100, kind: 'warn' });
        S.data({ '桶': '…0 d1 [6] · …01 d2 [5, 9] · …11 d2 [ ]' }, { delay: 1200 });
      });
      S.step('…01 还是满的，而且 d = g = 2 → 第三次翻倍到 g = 3', function () {
        S.code([3, 6]);
        bounce('k13', 'O', 0);
        grow(2, 1200); point(4, 'A', 1500); point(5, 'O', 1600); point(6, 'A', 1700); point(7, 'E', 1800);
        S.data({ g: 3 }, { delay: 1300 }); S.log('目录 4 → 8 格', { delay: 1300 });
      });
      S.step('把 …01 拆成 …001 和 …101：9（1001）去 …001；5（0101）留下；13 终于放进 …101', function () {
        S.code([7, 11]);
        S.pop('BC'); S.to('BnC', { opacity: 1 }, { delay: 200, dur: 300 }); S.to('BdC', { opacity: 1 }, { delay: 200, dur: 300 });
        S.set('BnO', { text: '…101' }, { delay: 300 }); S.set('BdO', { text: 'd = 3' }, { delay: 300 }); S.flash('BdO', C.amber, { prop: 'color', delay: 300 });
        point(1, 'C', 400, 600);
        S.move('k9', slot('C', 0)[0], BY.C, { delay: 900, dur: 700 });
        S.move('k13', slot('O', 1)[0], BY.O, { delay: 1300, dur: 800 }); land(S, 'k13', 2100); S.ripple(slot('O', 1)[0], BY.O, { delay: 2100, color: C.green });
        S.data({ '桶': '…0 d1 [6] · …001 d3 [9] · …101 d3 [5, 13] · …11 d2 [ ]' }, { delay: 2100 });
        S.log('13 插入成功', { delay: 2150, kind: 'ok' });
      });
      S.step('没满的桶一个字节都不动：…0 被 4 个格子指着（d = 1），…11 被 2 个格子指着（d = 2）', function () {
        S.code(6);
        [0, 2, 4, 6].forEach(function (i, n) { S.flash('L' + i, C.blue, { prop: 'stroke', delay: n * 150 }); });
        [3, 7].forEach(function (i, n) { S.flash('L' + i, C.purple, { prop: 'stroke', delay: 800 + n * 150 }); });
        S.pulse('BA', { delay: 300, scale: 1.04 }); S.pulse('BE', { delay: 900, scale: 1.04 });
        S.log('一个桶被 2^(g − d) 个格子指着', { delay: 1000 });
      });
      S.step('下一个插入：4（100）、3（011）、1（001）都直接放；只有 21（10101 → …101 满且 d = g）会再让目录翻倍', function () {
        S.code([3, 5]);
        S.fly(PEND, slot('A', 1), { label: '4', w: 46, h: 32, color: C.green, dur: 700 });
        S.fly(PEND, [slot('E', 0)[0], BY.E], { label: '3', w: 46, h: 32, color: C.green, delay: 300, dur: 800 });
        S.fly(PEND, [BL - 40, BY.O], { label: '21', w: 46, h: 32, color: C.red, delay: 1100, dur: 700 });
        S.flash('BO', C.red, { prop: 'stroke', delay: 1800 }); S.flash('BdO', C.red, { prop: 'color', delay: 1800 });
        S.log('21 → 满桶且 d = g → g 将变成 4', { delay: 1900, kind: 'warn' });
      });
    }
  },

  /* ───────────── 场景 4：Bloom filter ───────────── */
  {
    name: 'Bloom filter',
    moving: '哈希结果从词卡飞向对应的位、位从 0 翻成 1；查询探针飞去检查两位，遇到 0 变红、全 1 变黄；「删除」时位被清零、再查时出现假阴性；假阳性率的柱子依次长出',
    lang: '伪代码 · 计算',
    code: [
      'Insert(x):',
      '  for h in {h1, h2}:',
      '    bits[h(x) % 8] = 1',
      'Lookup(x):',
      '  for h in {h1, h2}:',
      '    if bits[h(x) % 8] == 0:',
      '      return 一定不在',
      '  return 可能在     // 可能是假阳性',
      '// 没有 Delete：位是好几个键共用的',
      '',
      '假阳性率 ≈ (1 − e^(−k·n/m))^k',
      '  m = 8 个位，n = 2 个键：',
      '  k=1 22%   k=2 15.5%  k=3 14.7%',
      '  k=4 16%   k=5 18.5%'
    ].join('\n'),
    build: function (S) {
      var BXs = [], BY0 = 150;
      for (var i = 0; i < 8; i++) BXs.push(150 + i * 80);
      note(S, '词的哈希值为示意');
      title(S, 'tT', 40, 66, '8 个位 · 两个哈希函数（先算出数，再 mod 8）');
      for (i = 0; i < 8; i++) {
        S.box('b' + i, { x: BXs[i], y: BY0, w: 66, h: 60, rx: 8, fill: C.panel, stroke: C.line, sw: 1.5, label: '0', size: 22 });
        S.text('bi' + i, { x: BXs[i], y: BY0 + 46, text: '位 ' + i, size: 14, color: C.mute });
      }
      S.box('card', { x: 220, y: 300, w: 320, h: 104, rx: 12, fill: C.panel, stroke: C.line, sw: 1.5 });
      S.text('w', { x: 220, y: 270, text: '', size: 19, weight: 700 });
      S.text('w1', { x: 220, y: 304, text: '', size: 16, color: C.cyan });
      S.text('w2', { x: 220, y: 334, text: '', size: 16, color: C.cyan });
      S.text('res', { x: 620, y: 290, text: '', size: 18, weight: 700 });
      S.text('res2', { x: 620, y: 324, text: '', size: 15, color: C.mute });
      title(S, 'tF', 40, 400, '假阳性率（m = 8、n = 2）');
      var F = [22.1, 15.5, 14.7, 16.0, 18.5];
      F.forEach(function (v, k) {
        var x = 300 + k * 110;
        S.box('f' + k, { x: x, y: 505, w: 60, h: 0, rx: 4, fill: k === 2 ? C.green : C.amber, stroke: 'none', sw: 0, opacity: 0 });
        S.text('fv' + k, { x: x, y: 494, val: 0, suf: '%', size: 15, weight: 700, opacity: 0 });
        S.text('fk' + k, { x: x, y: 522, text: 'k = ' + (k + 1), size: 14, color: C.mute, opacity: 0 });
      });
      S.data({ bits: '00000000' });
      function card(word, a, am, b, bm) {
        S.set('w', { text: word }); S.set('w1', { text: 'h1 = ' + a + ' → ' + a + ' mod 8 = ' + am }); S.set('w2', { text: 'h2 = ' + b + ' → ' + b + ' mod 8 = ' + bm });
        S.pulse('card', { scale: 1.04 });
      }
      function setBit(i, d, col) {
        S.fly([220, 320], 'b' + i, { color: col || C.green, delay: d, dur: 650 });
        S.set('b' + i, { label: '1' }, { delay: d + 650 }); S.to('b' + i, { fill: '#1f5c47', stroke: C.green }, { delay: d + 650, dur: 300 });
      }
      function check(i, d, ok) {
        S.fly([220, 320], 'b' + i, { color: C.blue, delay: d, dur: 600 });
        S.flash('b' + i, ok ? C.amber : C.red, { prop: 'stroke', delay: d + 600 });
      }

      S.step('8 个位全是 0；每个词用两个哈希函数各算出一个数，再对 8 取模决定置哪一位', function () {
        S.code(1);
        for (var i = 0; i < 8; i++) S.pulse('b' + i, { delay: i * 70, scale: 1.08 });
      });
      S.step('插入「苹果」：37 mod 8 = 5，106 mod 8 = 2 → 把位 5、位 2 置 1', function () {
        S.code([1, 3]); card('插入「苹果」', 37, 5, 106, 2);
        setBit(5, 300); setBit(2, 550);
        S.data({ bits: '00100100' }, { delay: 1300 });
      });
      S.step('插入「香蕉」：49 mod 8 = 1 → 置位 1；61 mod 8 = 5 → 位 5 已经是 1（两个词共用这一位）', function () {
        S.code([1, 3]); card('插入「香蕉」', 49, 1, 61, 5);
        setBit(1, 300); S.fly([220, 320], 'b5', { color: C.amber, delay: 550, dur: 650 }); S.pulse('b5', { delay: 1200 });
        S.data({ bits: '01100100' }, { delay: 1300 }); S.log('位 5 被苹果和香蕉共用', { delay: 1300 });
      });
      S.step('查「西瓜」：14 mod 8 = 6，33 mod 8 = 1 → 位 6 是 0 → 一定没插入过', function () {
        S.code([4, 7]); card('查询「西瓜」', 14, 6, 33, 1);
        check(6, 300, false); check(1, 550, true);
        S.set('res', { text: '一定不在', color: C.red }, { delay: 1300 }); S.set('res2', { text: '有一位是 0 → 不可能插入过' }, { delay: 1300 });
        S.log('西瓜：一定不在（不会假阴性）', { delay: 1350, kind: 'ok' });
      });
      S.step('查「葡萄」：29 mod 8 = 5，42 mod 8 = 2 → 两位都是 1 → 回答「可能在」—— 其实没插过：假阳性', function () {
        S.code(8); card('查询「葡萄」', 29, 5, 42, 2);
        S.set('res', { text: '' }); S.set('res2', { text: '' });
        check(5, 300, true); check(2, 550, true);
        S.set('res', { text: '可能在（假阳性）', color: C.amber }, { delay: 1300 }); S.set('res2', { text: '位 5、2 是苹果置的，不是葡萄' }, { delay: 1300 });
        S.log('葡萄：假阳性', { delay: 1350, kind: 'warn' });
      });
      S.step('假如想「删除苹果」：把位 5、位 2 清零 ……', function () {
        S.code(9); S.set('w', { text: '删除「苹果」？' }); S.set('w1', { text: '清掉位 5、位 2' }); S.set('w2', { text: '' });
        S.set('res', { text: '' }); S.set('res2', { text: '' });
        [5, 2].forEach(function (i, n) {
          S.fly([220, 320], 'b' + i, { color: C.red, delay: 200 + n * 250, dur: 600 });
          S.set('b' + i, { label: '0' }, { delay: 800 + n * 250 }); S.to('b' + i, { fill: C.panel, stroke: C.red }, { delay: 800 + n * 250, dur: 300 });
        });
        S.data({ bits: '01000000' }, { delay: 1300 });
      });
      S.step('再查「香蕉」：位 5 成了 0 → 回答「一定不在」—— 出现假阴性，所以 Bloom filter 不支持删除', function () {
        S.code([4, 7]); card('查询「香蕉」', 49, 1, 61, 5);
        check(1, 300, true); check(5, 550, false);
        S.set('res', { text: '✗ 假阴性', color: C.red }, { delay: 1300 }); S.set('res2', { text: '位 5 也是香蕉的，不能清' }, { delay: 1300 });
        [5, 2].forEach(function (i) { S.set('b' + i, { label: '1' }, { delay: 2300 }); S.to('b' + i, { fill: '#1f5c47', stroke: C.green }, { delay: 2300, dur: 300 }); });
        S.data({ bits: '01100100（已恢复）' }, { delay: 2300 }); S.log('删除会造成假阴性', { delay: 1350, kind: 'err' });
      }, { hold: 1000 });
      S.step('哈希函数也不是越多越好：位图小时多算几个反而把位填满 —— m = 8、n = 2 时 k = 3 附近最低', function () {
        S.code([11, 14]); S.set('res', { text: '' }); S.set('res2', { text: '' });
        F.forEach(function (v, k) {
          var hgt = v * 3.6, d = 200 + k * 220;
          S.to('f' + k, { opacity: 1 }, { delay: d, dur: 150 });
          S.to('f' + k, { h: hgt, y: 505 - hgt / 2 }, { delay: d, dur: 600, ease: 'out' });
          S.to('fv' + k, { opacity: 1, y: 494 - hgt }, { delay: d, dur: 600, ease: 'out' }); S.count('fv' + k, v, { delay: d, dur: 600 });
          S.set('fv' + k, { val: null, text: v.toFixed(1) + '%' }, { delay: d + 620 });
          S.to('fk' + k, { opacity: 1 }, { delay: d, dur: 300 });
        });
        S.pulse('f2', { delay: 1500 });
        S.log('最优 k ≈ (m/n)·ln2 ≈ 2.8', { delay: 1600, kind: 'ok' });
      });
    }
  }
  ]
});
})();
