/* #04 缓冲池：命中/缺页与 pin · CLOCK · LRU 的顺序泛洪 · LRU-K · 脏页写回
 * 帧的个数（3–6 个）、页号、时间戳都是为了画得下而取的示意值。 */
(function () {
var C = Viz.C, PG = '#2b4172', DIRTY = '#7a5416';
function mix(p, o) { for (var k in o) p[k] = o[k]; return p; }
function lbl(S, id, x, y, t, o) { S.text(id, mix({ x: x, y: y, text: t, anchor: 'start', color: C.mute, size: 15 }, o)); }
function disk(S, pages, x0, dx, y) {
  pages.forEach(function (p, i) { S.box('d' + p, { x: x0 + i * dx, y: y, w: 84, h: 40, fill: C.cell, stroke: C.line, label: 'page ' + p, size: 15 }); });
}
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #04 Memory Management & Buffer Pools（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/04-bufferpool.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #04 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/04-bufferpool.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Project #1 Buffer Pool Manager', u: 'https://15445.courses.cs.cmu.edu/fall2025/project1/' }
];

Viz.register('bufferpool', {
  title: '缓冲池：命中与缺页 · 替换策略 · 脏页写回',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：命中、缺页、pin ───────────────────────── */
  {
    name: '命中、缺页与 pin',
    moving: '请求小方块从查询飞到页表；整页从磁盘飞进空闲帧；页表项弹出、指针线长到帧；指针飞回查询；pin 数字滚动；红色淘汰框在帧之间滑动；被换出的页缩小消失',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Page* Fetch(page_id_t pid) {',
      '  if (page_table.contains(pid)) {  // 命中',
      '    Frame* f = page_table[pid];',
      '    f->pin_count++;',
      '    return f->data;       // 交出内存指针',
      '  }',
      '  Frame* f = free_list.empty()     // 缺页',
      '           ? EvictOne()  // 只挑 pin == 0 的',
      '           : free_list.pop();',
      '  disk.ReadPage(pid, f->data);     // 1 次 I/O',
      '  page_table[pid] = f;',
      '  f->pin_count = 1;',
      '  return f->data;',
      '}',
      'void Unpin(page_id_t pid) {        // 用完了',
      '  page_table[pid]->pin_count--;',
      '}                       // 减到 0 才可换出'
    ].join('\n'),
    build: function (S) {
      var FX = [330, 520, 710], FY = 335, EY = 170, DY = 500;
      function dx(p) { return 250 + p * 100; }
      S.text('note', { x: 20, y: 24, text: '3 个帧、页号都是示意值；真实的缓冲池有成千上万个帧', anchor: 'start', size: 14, color: C.mute });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: '磁盘 I/O：', suf: ' 次', color: C.amber, size: 16 });
      S.box('q1', { x: 330, y: 84, w: 150, h: 46, fill: C.panel, stroke: C.line, sw: 2, label: '查询 Q1' });
      S.box('q2', { x: 590, y: 84, w: 150, h: 46, fill: C.panel, stroke: C.line, sw: 2, label: '查询 Q2' });
      lbl(S, 'lPT', 40, EY - 11, '页表（纯内存）', { color: C.ink }); lbl(S, 'lPT2', 40, EY + 11, 'page id → 帧', { size: 14 });
      lbl(S, 'lBP', 40, FY - 11, '缓冲池', { color: C.ink }); lbl(S, 'lBP2', 40, FY + 11, '一帧正好放一页', { size: 14 });
      lbl(S, 'lDK', 40, DY - 11, '磁盘', { color: C.ink }); lbl(S, 'lDK2', 40, DY + 11, '数据文件', { size: 14 });
      S.box('e2x', { x: FX[2], y: EY, w: 160, h: 40, fill: C.bg, stroke: C.line, dash: '6 5', label: '（空）', color: C.mute, size: 15 });
      ['page 1 → 帧 0', 'page 3 → 帧 1', 'page 2 → 帧 2'].forEach(function (t, i) {
        S.line('l' + i, { x1: FX[i], y1: EY + 22, x2: FX[i], y2: FY - 67, stroke: C.purple, sw: 2, arrow: true, opacity: i < 2 ? 1 : 0, draw: i < 2 ? 1 : 0 });
        S.box('e' + i, { x: FX[i], y: EY, w: 160, h: 40, fill: C.cell, stroke: C.purple, label: t, size: 15, opacity: i < 2 ? 1 : 0 });
        S.box('fr' + i, { x: FX[i], y: FY, w: 160, h: 130, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
        S.text('fn' + i, { x: FX[i], y: FY - 47, text: '帧 ' + i, size: 14, color: C.mute });
        S.text('pin' + i, { x: FX[i], y: FY + 42, val: 0, pre: 'pin = ', size: 16, color: C.mute, weight: 700 });
      });
      S.box('pg0', { x: FX[0], y: FY - 6, w: 124, h: 44, rx: 6, fill: PG, stroke: 'none', sw: 0, label: 'page 1' });
      S.box('pg1', { x: FX[1], y: FY - 6, w: 124, h: 44, rx: 6, fill: PG, stroke: 'none', sw: 0, label: 'page 3' });
      disk(S, [0, 1, 2, 3, 4, 5], 250, 100, DY);
      S.box('ev', { x: FX[2], y: FY, w: 178, h: 148, rx: 16, fill: 'none', stroke: C.red, sw: 3, opacity: 0 });
      S.data({ '页表': '1→帧0, 3→帧1', '帧 2': '空闲', '磁盘 I/O': 0 });

      S.step('Q1 要读 page 2：先拿页号去查页表 —— 没有这一项，缺页', function () {
        S.code(2); S.log('Q1：Fetch(2)');
        S.pulse('q1');
        S.fly('q1', 'e2x', { label: 'Fetch(2)', w: 90, h: 30, color: C.blue, delay: 250, dur: 850 });
        S.flash('e2x', C.red, { prop: 'stroke', delay: 1100 }); S.pulse('e2x', { delay: 1100 });
        S.code(7, { delay: 1150 }); S.log('页表里没有 page 2 → 缺页', { delay: 1150, kind: 'warn' });
      });
      S.step('缺页：拿一个空闲帧（帧 2），把 page 2 整页从磁盘读进来 —— 1 次磁盘 I/O', function () {
        S.code([7, 10]);
        S.to('fr2', { stroke: C.amber }, { dur: 300 }); S.pulse('fr2', { scale: 1.05 });
        S.fly('e2x', 'd2', { color: C.blue, delay: 350, dur: 750 });
        S.flash('d2', C.amber, { delay: 1100 }); S.pulse('d2', { delay: 1100 });
        S.fly('d2', [FX[2], FY - 6], { id: 'pg2', label: 'page 2', w: 124, h: 44, size: 16, color: C.cyan, keep: true, delay: 1350, dur: 850 });
        S.to('pg2', { fill: PG, color: C.ink }, { delay: 2350, dur: 400 });
        S.count('tIO', 1, { delay: 1400 }); S.log('disk.ReadPage(2) → 帧 2', { delay: 1400, kind: 'io' });
        S.data({ '帧 2': 'page 2', '磁盘 I/O': 1 }, { delay: 2200 });
      });
      S.step('页表登记 page 2 → 帧 2，pin 计数 0 → 1，再把指向这块内存的指针交给 Q1', function () {
        S.code([11, 13]);
        S.hide('e2x'); S.pop('e2', { delay: 150 });
        S.to('l2', { opacity: 1, draw: 1 }, { delay: 500, dur: 450 });
        S.count('pin2', 1, { delay: 1000, dur: 400 }); S.to('pin2', { color: C.amber }, { delay: 1000, dur: 300 }); S.pulse('pin2', { delay: 1000 });
        S.fly([FX[2], FY - 50], 'q1', { label: '指针', w: 60, h: 30, color: C.purple, delay: 1450, dur: 900 });
        S.flash('q1', C.green, { prop: 'stroke', delay: 2350 }); S.pulse('q1', { delay: 2350 });
        S.data({ '页表': '1→帧0, 3→帧1, 2→帧2', 'page 2 的 pin': 1 }, { delay: 1000 });
      });
      S.step('Q2 也要 page 2：页表命中 → 不读盘，pin 1 → 2，同一块内存的指针再交给 Q2', function () {
        S.code([2, 5]); S.log('Q2：Fetch(2)');
        S.pulse('q2');
        S.fly('q2', 'e2', { label: 'Fetch(2)', w: 90, h: 30, color: C.blue, delay: 250, dur: 700 });
        S.flash('e2', C.green, { delay: 950 }); S.pulse('e2', { delay: 950 });
        S.fly([FX[2], EY + 22], [FX[2], FY - 67], { color: C.green, delay: 1100, dur: 450 });
        S.count('pin2', 2, { delay: 1550, dur: 400 }); S.pulse('pin2', { delay: 1550 });
        S.fly([FX[2], FY - 50], 'q2', { label: '指针', w: 60, h: 30, color: C.purple, delay: 1900, dur: 800 });
        S.flash('q2', C.green, { prop: 'stroke', delay: 2700 }); S.pulse('tIO', { delay: 1100 });
        S.data({ 'page 2 的 pin': 2 }, { delay: 1550 }); S.log('命中：I/O 仍是 1 次', { delay: 1600, kind: 'ok' });
      });
      S.step('Q1 又要 page 5，三个帧都占着 → 得换出一页。帧 2 的 pin = 2：有人正拿着它的指针，绝不能动', function () {
        S.code([7, 8]); S.log('Q1：Fetch(5) → 缺页，且没有空闲帧');
        S.pulse('q1');
        S.pop('ev', { delay: 450 });
        S.flash('pin2', C.red, { prop: 'color', delay: 950, hold: 700 }); S.pulse('pin2', { delay: 950, scale: 1.3 });
        S.to('ev', { x: FX[2] + 9 }, { delay: 1000, dur: 90 }); S.to('ev', { x: FX[2] - 9 }, { delay: 1090, dur: 120 }); S.to('ev', { x: FX[2] }, { delay: 1210, dur: 120 });
        S.log('帧 2：pin = 2 → 跳过', { delay: 1000, kind: 'err' });
      });
      S.step('改看帧 0：pin = 0，没人在用 → 换出它。干净页直接丢弃，页表里删掉 page 1', function () {
        S.code(8);
        S.move('ev', FX[0], FY, { dur: 850 });
        S.flash('pin0', C.green, { prop: 'color', delay: 900 }); S.pulse('pin0', { delay: 900, scale: 1.3 });
        S.to('pg0', { fill: C.red }, { delay: 1250, dur: 250 });
        S.to('pg0', { scale: .2, opacity: 0 }, { delay: 1550, dur: 450, ease: 'in' });
        S.to('e0', { fill: C.red }, { delay: 1250, dur: 250 }); S.hide('e0', { delay: 1600 });
        S.to('l0', { draw: 0, opacity: 0 }, { delay: 1600, dur: 400 });
        S.hide('ev', { delay: 2100 });
        S.data({ '页表': '3→帧1, 2→帧2', '被换出': 'page 1（干净）' }, { delay: 1600 }); S.log('换出 page 1（帧 0）', { delay: 1600, kind: 'warn' });
      });
      S.step('page 5 读进帧 0、登记页表、pin = 1 —— 同一个帧，现在装的是另一页', function () {
        S.code([10, 13]);
        S.flash('d5', C.amber); S.pulse('d5');
        S.fly('d5', [FX[0], FY - 6], { id: 'pg0b', label: 'page 5', w: 124, h: 44, size: 16, color: C.cyan, keep: true, delay: 250, dur: 900 });
        S.to('pg0b', { fill: PG, color: C.ink }, { delay: 1250, dur: 400 });
        S.count('tIO', 2, { delay: 300 }); S.log('disk.ReadPage(5) → 帧 0', { delay: 300, kind: 'io' });
        S.set('e0', { label: 'page 5 → 帧 0', fill: C.cell }, { delay: 1200 }); S.pop('e0', { delay: 1200 });
        S.to('l0', { opacity: 1, draw: 1 }, { delay: 1500, dur: 400 });
        S.count('pin0', 1, { delay: 1900, dur: 400 }); S.to('pin0', { color: C.amber }, { delay: 1900, dur: 300 }); S.pulse('pin0', { delay: 1900 });
        S.to('fr0', { stroke: C.amber }, { delay: 1900, dur: 300 });
        S.fly([FX[0], FY - 50], 'q1', { label: '指针', w: 60, h: 30, color: C.purple, delay: 2250, dur: 750 });
        S.data({ '页表': '5→帧0, 3→帧1, 2→帧2', '被换出': null, '磁盘 I/O': 2 }, { delay: 1200 });
      });
      S.step('Q1、Q2 用完 page 2，各自 Unpin：pin 2 → 1 → 0，这一帧才重新可以被换出', function () {
        S.code([15, 17]); S.log('Q1：Unpin(2)');
        S.fly('q1', [FX[2], FY - 50], { label: 'Unpin(2)', w: 96, h: 30, color: C.blue, dur: 800 });
        S.count('pin2', 1, { delay: 800, dur: 350 }); S.pulse('pin2', { delay: 800 });
        S.fly('q2', [FX[2], FY - 50], { label: 'Unpin(2)', w: 96, h: 30, color: C.blue, delay: 1050, dur: 750 });
        S.log('Q2：Unpin(2)', { delay: 1050 });
        S.count('pin2', 0, { delay: 1800, dur: 350 }); S.pulse('pin2', { delay: 1800 }); S.to('pin2', { color: C.mute }, { delay: 2000, dur: 300 });
        S.to('fr2', { stroke: C.line }, { delay: 2000, dur: 400 });
        S.data({ 'page 2 的 pin': 0 }, { delay: 1800 }); S.log('page 2：pin = 0，可以被换出了', { delay: 2000, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：CLOCK ───────────────────────── */
  {
    name: 'CLOCK：访问位与时钟指针',
    moving: '紫色指针绕着一圈帧转动；被指到的帧访问位 1→0；被选中的页飞进“换出”槽；新页从请求处飞进腾出的帧；扫过的帧数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Frame* Clock::Evict() {  // 只在要腾帧时调用',
      '  while (true) {',
      '    Frame* f = &frames[hand]; // 接着上次位置',
      '    hand = (hand + 1) % N;',
      '    if (f->ref) f->ref = 0;  // 被碰过：放过',
      '    else return f;           // 没被碰过：换出',
      '  }',
      '}',
      'void Clock::OnAccess(Frame* f) {',
      '  f->ref = 1;            // 平时只做这一件事',
      '}'
    ].join('\n'),
    build: function (S) {
      var CX = 290, CY = 312, R = 178, HR = 92, N = 6, ref = [1, 0, 0, 1, 0, 1], scanned = 0, outN = 0;
      function ang(i) { return (-90 + i * 60) * Math.PI / 180; }
      function fx(i) { return CX + R * Math.cos(ang(i)); }
      function fy(i) { return CY + R * Math.sin(ang(i)); }
      function tip(a) { return [CX + HR * Math.cos(a), CY + HR * Math.sin(a)]; }
      function turn(from, d, dur) {              /* 指针从帧 from 转到下一帧：分 3 小段走圆弧 */
        var a0 = ang(from), a1 = ang(from + 1), k, p;
        for (k = 1; k <= 3; k++) { p = tip(a0 + (a1 - a0) * k / 3); S.to('hand', { x2: p[0], y2: p[1] }, { delay: d + (k - 1) * dur / 3, dur: dur / 3, ease: 'linear' }); }
        S.count('tScan', ++scanned, { delay: d, dur: dur });
      }
      function setRef(i, v, d) {
        S.set('r' + i, { text: 'ref = ' + v, color: v ? C.green : C.mute }, { delay: d }); S.pulse('r' + i, { delay: d, scale: 1.3 });
      }
      function clear(i, d) {                     /* ref=1 → 清 0，指针前进 */
        S.to('f' + i, { stroke: C.purple }, { delay: d, dur: 250 });
        S.flash('r' + i, C.amber, { prop: 'color', delay: d + 150, hold: 250, dur: 100 });
        setRef(i, 0, d + 550);
        S.to('f' + i, { stroke: C.line }, { delay: d + 900, dur: 300 });
        turn(i, d + 900, 700);
      }
      function evict(i, oldPg, newPg, d) {       /* ref=0 → 换出，新页进来，指针停到下一帧 */
        S.to('f' + i, { stroke: C.red }, { delay: d, dur: 250 }); S.pulse('f' + i, { delay: d, scale: 1.06 });
        S.set('p' + i, { text: '' }, { delay: d + 500 });
        S.fly([fx(i), fy(i) - 12], [650 + outN * 100, 440], { label: 'page ' + oldPg, w: 84, h: 36, color: C.red, keep: true, delay: d + 500, dur: 850 }); outN++;
        S.fly('req', [fx(i), fy(i) - 12], { label: 'page ' + newPg, w: 84, h: 30, color: C.cyan, delay: d + 1450, dur: 800 });
        S.hide('req', { delay: d + 1450 });
        S.set('p' + i, { text: 'page ' + newPg }, { delay: d + 2250 }); S.pulse('p' + i, { delay: d + 2250 });
        setRef(i, 1, d + 2350);
        S.to('f' + i, { stroke: C.line }, { delay: d + 2400, dur: 300 });
        turn(i, d + 2600, 700);
      }
      S.text('note', { x: 20, y: 24, text: '6 个帧、页号都是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tScan', { x: 840, y: 24, anchor: 'end', val: 0, pre: '指针扫过的帧：', color: C.amber, size: 16 });
      S.line('hand', { x1: CX, y1: CY, x2: tip(ang(0))[0], y2: tip(ang(0))[1], stroke: C.purple, sw: 4, arrow: true });
      S.dot('hub', { x: CX, y: CY, r: 10, fill: C.purple });
      for (var i = 0; i < N; i++) {
        S.box('f' + i, { x: fx(i), y: fy(i), w: 112, h: 66, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
        S.text('n' + i, { x: fx(i), y: fy(i) - 46, text: '帧 ' + i, size: 14, color: C.mute });
        S.text('p' + i, { x: fx(i), y: fy(i) - 12, text: 'page ' + (i + 1), size: 16, weight: 700 });
        S.text('r' + i, { x: fx(i), y: fy(i) + 15, text: 'ref = ' + ref[i], color: ref[i] ? C.green : C.mute });
      }
      S.box('req', { x: 700, y: 96, w: 200, h: 46, fill: C.blue, stroke: 'none', sw: 0, label: '访问 page 2', color: C.bg, opacity: 0 });
      lbl(S, 'g1', 572, 190, 'ref = 1：上次扫描后被访问过', { color: C.green, size: 14 });
      lbl(S, 'g2', 572, 216, 'ref = 0：没被碰过，可以换出', { size: 14 });
      lbl(S, 'g3', 572, 242, '指针只在要腾帧时才转', { color: C.purple, size: 14 });
      S.text('tOut', { x: 700, y: 384, text: '被换出的页', color: C.mute });
      S.box('tray', { x: 700, y: 440, w: 230, h: 70, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      S.data({ '指针指向': '帧 0', '访问位': '1 0 0 1 0 1' });

      S.step('平时的访问（读 page 2，在帧 1）：命中，只把它的访问位置成 1 —— 指针一动不动', function () {
        S.code([9, 11]); S.log('访问 page 2 → ref = 1');
        S.pop('req');
        S.fly('req', [fx(1), fy(1)], { color: C.blue, delay: 500, dur: 800 });
        S.flash('f1', C.blue, { prop: 'stroke', delay: 1300 });
        setRef(1, 1, 1350); S.hide('req', { delay: 1500 });
        S.data({ '访问位': '1 1 0 1 0 1' }, { delay: 1350 });
      });
      S.step('现在要读 page 7，可 6 个帧全满了 → 要腾一个帧，时钟这才开始转', function () {
        S.code([1, 3]); S.log('Fetch(7)：没有空闲帧 → Evict()');
        S.set('req', { label: '要读 page 7', fill: C.amber }); S.pop('req', { delay: 50 });
        S.flash('hand', C.amber, { prop: 'stroke', delay: 600 }); S.pulse('hub', { delay: 600, scale: 1.5 });
      });
      S.step('指针指着帧 0：ref = 1 → 清成 0，放它一马，指针前进一格', function () {
        S.code(5); clear(0, 0);
        S.data({ '指针指向': '帧 1', '访问位': '0 1 0 1 0 1' }, { delay: 600 }); S.log('帧 0：ref 1 → 0', { delay: 600 });
      });
      S.step('帧 1：ref = 1（就是刚才那次访问置的）→ 同样清 0，继续走', function () {
        S.code(5); clear(1, 0);
        S.data({ '指针指向': '帧 2', '访问位': '0 0 0 1 0 1' }, { delay: 600 }); S.log('帧 1：ref 1 → 0', { delay: 600 });
      });
      S.step('帧 2：ref = 0 —— 上次扫描以来没人碰过 → 换出 page 3，page 7 进来，指针停到帧 3', function () {
        S.code(6); evict(2, 3, 7, 0); S.code(4, { delay: 2600 });
        S.log('帧 2：ref = 0 → 换出 page 3', { delay: 500, kind: 'warn' }); S.log('page 7 → 帧 2，ref = 1', { delay: 2300, kind: 'ok' });
        S.data({ '指针指向': '帧 3', '访问位': '0 0 1 1 0 1' }, { delay: 2400 });
      });
      S.step('又要腾帧（读 page 8）：从上次停下的帧 3 接着走，不从头来。ref = 1 → 清 0', function () {
        S.code(3); S.log('Fetch(8) → Evict()，从帧 3 继续');
        S.set('req', { label: '要读 page 8' }); S.pop('req', { delay: 50 });
        S.flash('hand', C.amber, { prop: 'stroke', delay: 500 });
        S.code(5, { delay: 900 }); clear(3, 900);
        S.data({ '指针指向': '帧 4', '访问位': '0 0 1 0 0 1' }, { delay: 1500 });
      });
      S.step('帧 4：ref = 0 → 换出 page 5，page 8 进来；指针停在帧 5，等下一次', function () {
        S.code(6); evict(4, 5, 8, 0); S.code(4, { delay: 2600 });
        S.log('帧 4：ref = 0 → 换出 page 5', { delay: 500, kind: 'warn' }); S.log('page 8 → 帧 4，ref = 1', { delay: 2300, kind: 'ok' });
        S.data({ '指针指向': '帧 5', '访问位': '0 0 1 0 1 1' }, { delay: 2400 });
      });
    }
  },

  /* ───────────────────────── 场景 3：LRU 与顺序泛洪 ───────────────────────── */
  {
    name: 'LRU 的顺序泛洪',
    moving: '读进来的页从磁盘飞到队首，队里的页整体往队尾滑一格；队尾的页滑进“换出”框缩小消失；扫描游标沿磁盘上的页前进；I/O 次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// LRU 链表：队首 = 刚访问，队尾 = 最久未用',
      'Frame* Fetch(page_id_t pid) {',
      '  if (Frame* f = page_table.Find(pid)) {',
      '    lru.MoveToFront(f);   // 命中：挪到队首',
      '    return f;',
      '  }',
      '  Frame* f = free_list.empty()',
      '           ? lru.PopBack()  // 换出最久未用',
      '           : free_list.pop();',
      '  disk.ReadPage(pid, f->data);',
      '  lru.PushFront(f);       // 新页排队首',
      '  return f;',
      '}'
    ].join('\n'),
    build: function (S) {
      var SX = [200, 370, 540], QY = 262, EX = 740, DY = 470, q = [], io = 0;
      function dx(p) { return 250 + p * 100; }
      function load(pg, d, id) {                 /* 页 pg 从磁盘读进来排到队首；满了就先把队尾挤出去 */
        id = id || 'c' + pg;
        S.flash('d' + pg, C.amber, { delay: d }); S.pulse('d' + pg, { delay: d });
        S.pop(id, { delay: d + 150 });
        if (q.length === 3) {
          var v = q.pop();
          S.to(v, { fill: C.red }, { delay: d, dur: 250 });
          S.move(v, EX, QY, { delay: d + 350, dur: 600 });
          S.to(v, { scale: .3, opacity: 0 }, { delay: d + 1050, dur: 400, ease: 'in' });
          S.flash('ebox', C.red, { prop: 'stroke', delay: d + 950 });
        }
        q.forEach(function (c, k) { S.move(c, SX[k + 1], QY, { delay: d + 450 + k * 60, dur: 600 }); });
        S.move(id, SX[0], QY, { delay: d + 550, dur: 850 });
        S.ripple(SX[0], QY, { delay: d + 1400, color: C.cyan });
        S.count('tIO', ++io, { delay: d + 300 });
        q.unshift(id);
      }
      S.text('note', { x: 20, y: 24, text: '缓冲池只有 3 个帧 —— 示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: '磁盘 I/O：', suf: ' 次', color: C.amber, size: 16 });
      S.box('qa', { x: 190, y: 90, w: 260, h: 48, fill: C.panel, stroke: C.line, sw: 2, label: '点查：WHERE id = 1' });
      S.box('qb', { x: 560, y: 90, w: 320, h: 48, fill: C.panel, stroke: C.line, sw: 2, label: '全表扫描：SELECT AVG(…)' });
      lbl(S, 'lQ', 40, 184, '缓冲池（按 LRU 顺序排）', { color: C.ink });
      S.text('tHead', { x: SX[0], y: 212, text: '队首：刚访问', size: 14, color: C.mute });
      S.line('ar', { x1: SX[0] + 60, y1: 212, x2: SX[2] - 66, y2: 212, stroke: C.line, sw: 1.5, arrow: true });
      S.text('tTail', { x: SX[2], y: 212, text: '队尾：最久未用', size: 14, color: C.mute });
      S.text('tEv', { x: EX, y: 212, text: '换出', size: 14, color: C.red });
      SX.forEach(function (x, i) { S.box('sl' + i, { x: x, y: QY, w: 152, h: 66, rx: 10, fill: C.bg, stroke: C.line, dash: '6 5' }); });
      S.box('ebox', { x: EX, y: QY, w: 152, h: 66, rx: 10, fill: C.bg, stroke: '#7a3340', dash: '6 5' });
      lbl(S, 'lDK', 40, DY - 11, '磁盘', { color: C.ink }); lbl(S, 'lDK2', 40, DY + 11, '表的数据页', { size: 14 });
      disk(S, [0, 1, 2, 3, 4, 5], 250, 100, DY);
      S.text('tHot', { x: dx(0), y: DY + 38, text: 'id = 1 在这页', size: 14, color: C.green });
      S.box('scan', { x: dx(1), y: DY, w: 98, h: 54, rx: 12, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      [0, 1, 2, 3, 4, 5].forEach(function (p) {
        S.box('c' + p, { x: dx(p), y: DY, w: 134, h: 48, rx: 6, fill: PG, stroke: p ? 'none' : C.green, sw: p ? 0 : 2.5, label: 'page ' + p, opacity: 0, trail: 3 });
      });
      S.box('c0b', { x: dx(0), y: DY, w: 134, h: 48, rx: 6, fill: PG, stroke: C.green, sw: 2.5, label: 'page 0', opacity: 0, trail: 3 });
      S.data({ 'LRU 队列': '（空）', '磁盘 I/O': 0 });

      S.step('点查 WHERE id = 1：要的元组在 page 0 → 读进缓冲池，排在 LRU 队首', function () {
        S.code([10, 11]); S.log('点查 id = 1 → 读 page 0', { kind: 'io' });
        S.flash('qa', C.blue, { prop: 'stroke' }); S.pulse('qa', { scale: 1.05 });
        load(0, 400);
        S.data({ 'LRU 队列': '[0]', '磁盘 I/O': 1 }, { delay: 1800 });
      });
      S.step('全表扫描从头读起，先读 page 1：新来的排队首，page 0 往队尾挪一格', function () {
        S.code([10, 11]); S.log('扫描：读 page 1', { kind: 'io' });
        S.flash('qb', C.blue, { prop: 'stroke' }); S.pulse('qb', { scale: 1.04 });
        S.pop('scan', { delay: 200 });
        load(1, 500);
        S.data({ 'LRU 队列': '[1, 0]', '磁盘 I/O': 2 }, { delay: 1900 });
      });
      S.step('扫到 page 2：三个帧全满了，page 0 已经被挤到队尾', function () {
        S.code([10, 11]); S.log('扫描：读 page 2', { kind: 'io' });
        S.move('scan', dx(2), DY, { dur: 500 });
        load(2, 400);
        S.flash('tTail', C.amber, { prop: 'color', delay: 1500, hold: 600 }); S.pulse('c0', { delay: 1500, scale: 1.08 });
        S.data({ 'LRU 队列': '[2, 1, 0]', '磁盘 I/O': 3 }, { delay: 1800 });
      });
      S.step('扫到 page 3：必须换出一页。LRU 挑最久未用的 —— 正好是那张热页 page 0', function () {
        S.code([7, 8]); S.log('扫描：读 page 3 → 没有空闲帧', { kind: 'io' });
        S.move('scan', dx(3), DY, { dur: 500 });
        load(3, 500);
        S.log('LRU 换出 page 0（热页！）', { delay: 900, kind: 'err' });
        S.data({ 'LRU 队列': '[3, 2, 1]', '被换出': 'page 0', '磁盘 I/O': 4 }, { delay: 1900 });
      });
      S.step('扫描继续读 page 4、page 5：缓冲池里全换成了只用一次的页', function () {
        S.code([7, 11]); S.log('扫描：读 page 4', { kind: 'io' });
        S.move('scan', dx(4), DY, { dur: 450 });
        load(4, 350);
        S.move('scan', dx(5), DY, { delay: 1900, dur: 450 }); S.log('扫描：读 page 5', { delay: 1900, kind: 'io' });
        load(5, 2250);
        S.data({ 'LRU 队列': '[5, 4, 3]', '被换出': 'page 0, 1, 2', '磁盘 I/O': 6 }, { delay: 3700 });
      });
      S.step('又来一次 WHERE id = 1：page 0 早被冲掉了 → 缺页，只能重新读盘。这就是顺序泛洪', function () {
        S.code(3); S.log('点查 id = 1 → page 0 不在缓冲池');
        S.hide('scan'); S.flash('qa', C.blue, { prop: 'stroke' }); S.pulse('qa', { scale: 1.05 });
        S.fly('qa', [SX[0], QY - 33], { color: C.blue, delay: 250, dur: 650 });
        ['c5', 'c4', 'c3'].forEach(function (c, k) { S.flash(c, C.red, { delay: 900 + k * 180, hold: 200, dur: 300 }); });
        S.code([7, 11], { delay: 1800 });
        load(0, 1850, 'c0b');
        S.log('顺序泛洪：热页被只用一次的页冲掉', { delay: 1950, kind: 'err' });
        S.data({ 'LRU 队列': '[0, 5, 4]', '被换出': '…, 3', '磁盘 I/O': 7 }, { delay: 3250 });
      });
    }
  },

  /* ───────────────────────── 场景 4：LRU-K ───────────────────────── */
  {
    name: 'LRU-K：看倒数第 K 次访问',
    moving: '页从磁盘飞进帧；每帧下面的 K 距离数字滚动出来；被换出的页滑进 Ghost 列表并缩成一条记录；Ghost 记录飞回帧里接上访问历史；时间和 I/O 数字滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Frame* LRUK::Evict(Time now) {',
      '  Frame* v = nullptr;',
      '  for (Frame* f : frames) {',
      '    // K 距离 = 现在 − 倒数第 K 次访问时刻',
      '    f->dist = f->hist.size() < K ? INF',
      '            : now - f->hist.KthLatest();',
      '    if (!v || f->dist > v->dist ||',
      '        (f->dist == v->dist &&',
      '         f->hist.Latest() < v->hist.Latest()))',
      '      v = f;      // 距离最大；并列挑最老的',
      '  }',
      '  ghost[v->pid] = v->hist;  // 留下访问时刻',
      '  return v;',
      '}',
      'void LRUK::OnLoad(Frame* f, Time now) {',
      '  f->hist = ghost.Take(f->pid); // 接回历史',
      '  f->hist.push_back(now);',
      '}'
    ].join('\n'),
    build: function (S) {
      var FX = [150, 330, 510], FY = 250, GX = 735, GY = [246, 292], DY = 480, io = 0;
      function dx(p) { return 250 + p * 100; }
      function tick(t, d) { S.count('tT', t, { delay: d, dur: 300 }); S.pulse('tT', { delay: d }); }
      function load(pg, fi, d, id) {             /* 页 pg 从磁盘飞进帧 fi */
        id = id || 'c' + pg;
        S.flash('d' + pg, C.amber, { delay: d }); S.pulse('d' + pg, { delay: d });
        S.pop(id, { delay: d + 150 });
        S.move(id, FX[fi], FY, { delay: d + 450, dur: 850 });
        S.ripple(FX[fi], FY, { delay: d + 1300, color: C.cyan });
        S.count('tIO', ++io, { delay: d + 300 });
      }
      function hist(fi, t, d) { S.set('h' + fi, { text: '访问时刻：' + t }, { delay: d }); S.pulse('h' + fi, { delay: d }); }
      function dist(fi, v, d) {                  /* 显示第 fi 帧的 K 距离；v 为数字或 '∞' */
        if (v === '∞') S.set('k' + fi, { val: null, text: 'K 距离 = ∞', color: C.amber }, { delay: d });
        else { S.set('k' + fi, { val: 0, color: C.blue }, { delay: d }); S.count('k' + fi, v, { delay: d + 50, dur: 500 }); }
        S.pop('k' + fi, { delay: d });
        S.flash('fr' + fi, v === '∞' ? C.amber : C.blue, { prop: 'stroke', delay: d });
      }
      function toGhost(id, slot, label, d) {     /* 被换出的页滑进 Ghost 列表，缩成一条只剩时间戳的记录 */
        S.to(id, { fill: C.red }, { delay: d, dur: 250 });
        S.to(id, { x: GX, y: GY[slot], w: 164, h: 36 }, { delay: d + 350, dur: 800 });
        S.set(id, { label: label }, { delay: d + 800 });
        S.to(id, { fill: '#33285c', color: C.ink }, { delay: d + 1150, dur: 350 });
        S.flash('gbox', C.purple, { prop: 'stroke', delay: d + 1150 });
      }
      S.text('note', { x: 20, y: 24, text: 'K = 2、3 个帧、时间戳都是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tT', { x: 610, y: 24, anchor: 'end', val: 0, pre: '当前时间 t = ', color: C.blue, size: 16 });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: '磁盘 I/O：', suf: ' 次', color: C.amber, size: 16 });
      S.box('qa', { x: 170, y: 90, w: 240, h: 48, fill: C.panel, stroke: C.line, sw: 2, label: '点查：WHERE id = 1' });
      S.box('qb', { x: 470, y: 90, w: 300, h: 48, fill: C.panel, stroke: C.line, sw: 2, label: '全表扫描：SELECT AVG(…)' });
      lbl(S, 'lQ', 40, 176, '缓冲池：每帧记住最近 2 次访问的时刻', { color: C.ink });
      FX.forEach(function (x, i) {
        S.box('fr' + i, { x: x, y: FY, w: 164, h: 80, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
        S.text('h' + i, { x: x, y: FY + 62, text: '访问时刻：—', color: C.ink });
        S.text('k' + i, { x: x, y: FY + 90, val: 0, pre: 'K 距离 = ', text: '', color: C.blue, weight: 700, opacity: 0 });
      });
      S.text('tG', { x: GX, y: 176, text: 'Ghost 列表', color: C.purple });
      S.text('tG2', { x: GX, y: 198, text: '换出后只留访问时刻', size: 14, color: C.mute });
      S.box('gbox', { x: GX, y: 269, w: 186, h: 104, rx: 10, fill: C.bg, stroke: C.line, dash: '6 5' });
      lbl(S, 'lDK', 40, DY - 11, '磁盘', { color: C.ink }); lbl(S, 'lDK2', 40, DY + 11, '表的数据页', { size: 14 });
      disk(S, [0, 1, 2, 3, 4], 250, 100, DY);
      S.text('tHot', { x: dx(0), y: DY + 38, text: 'id = 1 在这页', size: 14, color: C.green });
      S.box('scan', { x: dx(1), y: DY, w: 98, h: 54, rx: 12, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      [0, 1, 2, 3, 4].forEach(function (p) {
        S.box('c' + p, { x: dx(p), y: DY, w: 140, h: 46, rx: 6, fill: PG, stroke: p ? 'none' : C.green, sw: p ? 0 : 2.5, label: 'page ' + p, opacity: 0, trail: 3 });
      });
      S.box('c1b', { x: dx(1), y: DY, w: 140, h: 46, rx: 6, fill: PG, stroke: 'none', sw: 0, label: 'page 1', opacity: 0, trail: 3 });
      S.data({ K: 2, t: 0, '磁盘 I/O': 0 });

      S.step('t = 1、2：两条点查都落在 page 0。第一次读盘，第二次命中 —— 它有了 2 次访问记录', function () {
        S.code([15, 17]); S.log('t=1 点查 id = 1 → 读 page 0', { kind: 'io' });
        tick(1, 0); S.pulse('qa', { scale: 1.05 });
        load(0, 0, 200); hist(0, '1', 1500);
        tick(2, 2000); S.pulse('qa', { delay: 2000, scale: 1.05 }); S.log('t=2 点查 id = 1 → 命中', { delay: 2000, kind: 'ok' });
        S.fly('qa', [FX[0], FY - 40], { color: C.blue, delay: 2100, dur: 650 });
        S.flash('fr0', C.green, { prop: 'stroke', delay: 2750 }); S.pulse('c0', { delay: 2750, scale: 1.06 });
        hist(0, '1, 2', 2850);
        S.data({ t: 2, 'page 0': '[1, 2]', '磁盘 I/O': 1 }, { delay: 2850 });
      });
      S.step('t = 3、4：全表扫描读进 page 1、page 2，它们各只有 1 次访问记录', function () {
        S.code([15, 17]); S.log('t=3 扫描：读 page 1', { kind: 'io' });
        S.pulse('qb', { scale: 1.04 }); S.pop('scan', { delay: 100 });
        tick(3, 200); load(1, 1, 300); hist(1, '3', 1600);
        S.move('scan', dx(2), DY, { delay: 1800, dur: 400 });
        tick(4, 1900); S.log('t=4 扫描：读 page 2', { delay: 1900, kind: 'io' }); load(2, 2, 2000); hist(2, '4', 3300);
        S.data({ t: 4, 'page 1': '[3]', 'page 2': '[4]', '磁盘 I/O': 3 }, { delay: 3300 });
      });
      S.step('t = 5 要读 page 3，没有空帧了。逐帧算 K 距离 = 当前时间 − 倒数第 2 次访问的时刻', function () {
        S.code([3, 6]); S.log('t=5 扫描：读 page 3 → Evict()');
        S.move('scan', dx(3), DY, { dur: 450 }); tick(5, 200);
        dist(0, 4, 700); dist(1, '∞', 1400); dist(2, '∞', 1900);
        S.data({ t: 5, 'page 0 距离': '5 − 1 = 4', 'page 1 距离': '∞（不足 2 次）', 'page 2 距离': '∞（不足 2 次）' }, { delay: 1900 });
      });
      S.step('不足 2 次访问的记为 ∞，最先换出；并列时挑最后一次访问更早的 → page 1（t = 3）', function () {
        S.code([7, 10]);
        S.pulse('k1', { scale: 1.25 }); S.pulse('k2', { delay: 200, scale: 1.25 });
        S.to('fr1', { stroke: C.red }, { delay: 600, dur: 250 }); S.pulse('h1', { delay: 600 });
        S.code(12, { delay: 900 }); toGhost('c1', 0, 'page 1 · t = 3', 900);
        S.log('换出 page 1，访问时刻留在 ghost', { delay: 950, kind: 'warn' });
        ['k0', 'k1', 'k2'].forEach(function (k) { S.hide(k, { delay: 1600 }); });
        S.to('fr1', { stroke: C.line }, { delay: 2100, dur: 300 });
        load(3, 1, 2000); hist(1, '5', 3300);
        S.data({ 'page 0 距离': null, 'page 1 距离': null, 'page 2 距离': null, 'page 1': 'ghost [3]', 'page 3': '[5]', '磁盘 I/O': 4 }, { delay: 3300 });
      });
      S.step('t = 6 读 page 4：page 0 的 K 距离 = 6 − 1 = 5，另外两帧仍是 ∞ → 换出访问更早的 page 2', function () {
        S.code([3, 10]); S.log('t=6 扫描：读 page 4 → Evict()');
        S.move('scan', dx(4), DY, { dur: 450 }); tick(6, 200);
        dist(0, 5, 600); dist(1, '∞', 1000); dist(2, '∞', 1400);
        S.to('fr2', { stroke: C.red }, { delay: 2000, dur: 250 });
        S.code(12, { delay: 2300 }); toGhost('c2', 1, 'page 2 · t = 4', 2300);
        ['k0', 'k1', 'k2'].forEach(function (k) { S.hide(k, { delay: 3000 }); });
        S.to('fr2', { stroke: C.line }, { delay: 3500, dur: 300 });
        load(4, 2, 3400); hist(2, '6', 4700);
        S.data({ t: 6, 'page 2': 'ghost [4]', 'page 4': '[6]', '磁盘 I/O': 5 }, { delay: 4700 }); S.log('换出 page 2；page 0 安然无恙', { delay: 2350, kind: 'warn' });
      });
      S.step('t = 7 再来 WHERE id = 1：page 0 一直没被冲掉 → 命中，不用读盘', function () {
        S.code(5); S.log('t=7 点查 id = 1');
        S.hide('scan'); tick(7, 0); S.pulse('qa', { scale: 1.05 });
        S.fly('qa', [FX[0], FY - 40], { color: C.blue, delay: 250, dur: 700 });
        S.flash('fr0', C.green, { prop: 'stroke', delay: 950, hold: 700 }); S.flash('c0', C.green, { delay: 950, hold: 600 }); S.pulse('c0', { delay: 950, scale: 1.08 });
        hist(0, '2, 7', 1100); S.pulse('tIO', { delay: 1100 });
        S.data({ t: 7, 'page 0': '[2, 7]' }, { delay: 1100 }); S.log('命中：I/O 仍是 5 次', { delay: 1100, kind: 'ok' });
      });
      S.step('t = 8 又读 page 1：它在 ghost 里的记录（t = 3）接回来 → 一进来就有 2 次访问历史，不用从零学', function () {
        S.code([3, 10]); S.log('t=8 读 page 1 → Evict()'); tick(8, 0);
        S.to('fr1', { stroke: C.red }, { delay: 300, dur: 250 });
        S.move('c1', FX[1], FY + 62, { delay: 500, dur: 850 }); S.hide('c1', { delay: 1300 });
        S.code(12, { delay: 700 }); toGhost('c3', 0, 'page 3 · t = 5', 700);
        S.to('fr1', { stroke: C.line }, { delay: 1900, dur: 300 });
        S.code([15, 17], { delay: 1500 }); load(1, 1, 1500, 'c1b'); hist(1, '3, 8', 2800);
        S.flash('h1', C.green, { prop: 'color', delay: 2850, hold: 700 });
        S.data({ t: 8, 'page 1': '[3, 8]', 'page 3': 'ghost [5]', '磁盘 I/O': 6 }, { delay: 2800 });
        S.log('page 1 历史恢复为 [3, 8]', { delay: 2850, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 5：脏页写回 ───────────────────────── */
  {
    name: '脏页写回与后台写线程',
    moving: '修改飞进帧、帧里的页变成琥珀色；干净页原地缩小消失；脏页先飞一条日志记录到日志文件、再整页飞回磁盘；后台写线程的紫框沿着帧滑过去，一路把脏页送回磁盘；写盘次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 修改一页：只改内存，f->dirty = true',
      'Frame* EvictOne() {',
      '  Frame* f = replacer.Victim();  // pin == 0',
      '  if (f->dirty) {',
      '    log.Flush();          // 先刷日志记录',
      '    disk.WritePage(f->pid, f->data); // 再写页',
      '    f->dirty = false;',
      '  }                       // 干净页：直接丢',
      '  return f;',
      '}',
      'void BackgroundWriter() { // 后台线程',
      '  for (Frame* f : frames)',
      '    if (f->dirty) {',
      '      log.Flush();',
      '      disk.WritePage(f->pid, f->data);',
      '      f->dirty = false; // 提前洗干净',
      '    }',
      '}'
    ].join('\n'),
    build: function (S) {
      var FX = [140, 310, 480, 650], FY = 262, DY = 480, DP = [1, 3, 4, 6, 8, 9], PGS = [1, 3, 4, 6], D0 = [0, 0, 1, 1], LX = 772;
      function dx(p) { return 150 + DP.indexOf(p) * 95; }
      function setDirty(i, v, d) {
        S.set('dt' + i, { text: 'dirty = ' + v, color: v ? C.amber : C.mute }, { delay: d }); S.pulse('dt' + i, { delay: d, scale: 1.25 });
      }
      function flush(i, pg, id, d) {             /* 帧 i 里的脏页：整页飞回磁盘，标记清掉 */
        S.fly([FX[i], FY - 4], 'd' + pg, { label: 'page ' + pg, w: 110, h: 36, color: C.amber, delay: d, dur: 850 });
        S.flash('d' + pg, C.green, { delay: d + 850 }); S.pulse('d' + pg, { delay: d + 850 });
        S.to(id, { fill: PG }, { delay: d + 850, dur: 350 });
        setDirty(i, 0, d + 900);
      }
      S.text('note', { x: 20, y: 24, text: '4 个帧、页号都是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tW', { x: 840, y: 24, anchor: 'end', val: 0, pre: '写回数据页：', suf: ' 次', color: C.amber, size: 16 });
      S.box('q', { x: 170, y: 90, w: 260, h: 48, fill: C.panel, stroke: C.line, sw: 2, label: 'UPDATE …（改 page 3）' });
      S.box('need', { x: 520, y: 90, w: 180, h: 46, fill: C.amber, stroke: 'none', sw: 0, label: '要读 page 8', color: C.bg, opacity: 0 });
      lbl(S, 'lBP', 40, 164, '缓冲池', { color: C.ink });
      S.text('tBW', { x: FX[0], y: 164, text: '后台写线程', color: C.purple, opacity: 0 });
      FX.forEach(function (x, i) {
        S.box('fr' + i, { x: x, y: FY, w: 150, h: 124, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
        S.text('fn' + i, { x: x, y: FY - 44, text: '帧 ' + i, size: 14, color: C.mute });
        S.box('pg' + i, { x: x, y: FY - 4, w: 118, h: 42, rx: 6, fill: D0[i] ? DIRTY : PG, stroke: 'none', sw: 0, label: 'page ' + PGS[i] });
        S.text('dt' + i, { x: x, y: FY + 40, text: 'dirty = ' + D0[i], color: D0[i] ? C.amber : C.mute, weight: 700 });
      });
      lbl(S, 'lDK', 40, DY - 11, '磁盘', { color: C.ink }); lbl(S, 'lDK2', 40, DY + 11, '数据页', { size: 14 });
      disk(S, DP, 150, 95, DY);
      S.box('wal', { x: LX, y: DY, w: 120, h: 56, rx: 8, fill: '#2a2350', stroke: C.purple, label: '日志文件', size: 15 });
      S.box('ev', { x: FX[0], y: FY, w: 166, h: 140, rx: 16, fill: 'none', stroke: C.red, sw: 3, opacity: 0 });
      S.box('bw', { x: FX[0], y: FY, w: 166, h: 140, rx: 16, fill: 'none', stroke: C.purple, sw: 3, opacity: 0 });
      S.data({ '脏页': 'page 4, page 6', '写回数据页': 0 });

      S.step('UPDATE 改了 page 3 里的一条元组：只改内存里的帧，把它的 dirty 标记置 1', function () {
        S.code(1); S.log('UPDATE → 改帧 1 里的 page 3');
        S.pulse('q', { scale: 1.04 });
        S.fly('q', [FX[1], FY - 4], { label: '改 8 字节', w: 96, h: 30, color: C.amber, delay: 250, dur: 850 });
        S.to('pg1', { fill: DIRTY }, { delay: 1100, dur: 350 }); S.pulse('pg1', { delay: 1100, scale: 1.08 });
        setDirty(1, 1, 1250);
        S.data({ '脏页': 'page 3, page 4, page 6' }, { delay: 1250 });
      });
      S.step('要读 page 8，得腾一个帧。选中的是干净页 page 1：内存和磁盘一模一样 → 直接丢弃，零成本', function () {
        S.code([2, 3]); S.log('Fetch(8) → 换出帧 0（干净）');
        S.pop('need'); S.pop('ev', { delay: 400 });
        S.flash('dt0', C.green, { prop: 'color', delay: 850 }); S.pulse('dt0', { delay: 850, scale: 1.25 });
        S.code(8, { delay: 1100 });
        S.to('pg0', { scale: .2, opacity: 0 }, { delay: 1150, dur: 450, ease: 'in' });
        S.pulse('tW', { delay: 1300 });
        S.flash('d8', C.amber, { delay: 1700 });
        S.fly('d8', [FX[0], FY - 4], { id: 'pg0b', label: 'page 8', w: 118, h: 42, size: 16, color: C.cyan, keep: true, delay: 1800, dur: 850 });
        S.to('pg0b', { fill: PG, color: C.ink }, { delay: 2750, dur: 350 });
        S.hide('need', { delay: 1800 }); S.hide('ev', { delay: 2650 });
        S.log('干净页：直接丢，写盘 0 次', { delay: 1200, kind: 'ok' });
      });
      S.step('又要读 page 9，这次选中的是脏页 page 3：不能直接丢，否则刚才的 UPDATE 就没了', function () {
        S.code([3, 4]); S.log('Fetch(9) → 换出帧 1（脏）');
        S.set('need', { label: '要读 page 9' }); S.pop('need');
        S.set('ev', { x: FX[1] }); S.pop('ev', { delay: 400 });
        S.flash('dt1', C.red, { prop: 'color', delay: 900, hold: 700 }); S.pulse('dt1', { delay: 900, scale: 1.3 });
        S.to('pg1', { x: FX[1] + 8 }, { delay: 950, dur: 90 }); S.to('pg1', { x: FX[1] - 8 }, { delay: 1040, dur: 120 }); S.to('pg1', { x: FX[1] }, { delay: 1160, dur: 120 });
        S.log('dirty = 1 → 必须先写回', { delay: 950, kind: 'warn' });
      });
      S.step('写回有顺序：先把描述这次修改的日志记录刷到日志文件……', function () {
        S.code(5);
        S.fly([FX[1], FY - 4], 'wal', { label: '日志记录', w: 84, h: 28, color: C.purple, delay: 150, dur: 950 });
        S.flash('wal', C.purple, { delay: 1100 }); S.pulse('wal', { delay: 1100, scale: 1.08 });
        S.log('log.Flush()', { delay: 1100, kind: 'io' }); S.data({ '日志': '已刷盘' }, { delay: 1100 });
      });
      S.step('……再把数据页写回磁盘、清掉 dirty；这个帧才能腾给 page 9', function () {
        S.code([6, 7]);
        flush(1, 3, 'pg1', 0);
        S.count('tW', 1, { delay: 850 }); S.log('disk.WritePage(3)', { delay: 850, kind: 'io' });
        S.to('pg1', { scale: .2, opacity: 0 }, { delay: 1500, dur: 400, ease: 'in' });
        S.flash('d9', C.amber, { delay: 1900 });
        S.fly('d9', [FX[1], FY - 4], { id: 'pg1b', label: 'page 9', w: 118, h: 42, size: 16, color: C.cyan, keep: true, delay: 2000, dur: 850 });
        S.to('pg1b', { fill: PG, color: C.ink }, { delay: 2950, dur: 350 });
        S.hide('need', { delay: 2000 }); S.hide('ev', { delay: 2850 });
        S.data({ '脏页': 'page 4, page 6', '写回数据页': 1, '日志': null }, { delay: 900 });
      });
      S.step('这一整套很慢 → 后台写线程提前干：沿着帧巡一遍，把脏页写出去、清掉标记', function () {
        S.code([11, 16]); S.log('BackgroundWriter 开始巡检');
        S.pop('bw'); S.pop('tBW', { delay: 100 });
        S.to('bw', { x: FX[2] }, { delay: 500, dur: 900, ease: 'linear' }); S.to('tBW', { x: FX[2] }, { delay: 500, dur: 900, ease: 'linear' });
        S.fly([FX[2], FY - 4], 'wal', { label: '日志记录', w: 84, h: 28, color: C.purple, delay: 1450, dur: 650 });
        flush(2, 4, 'pg2', 2000); S.count('tW', 2, { delay: 2850 }); S.log('WritePage(4)', { delay: 2850, kind: 'io' });
        S.to('bw', { x: FX[3] }, { delay: 3100, dur: 500, ease: 'linear' }); S.to('tBW', { x: FX[3] }, { delay: 3100, dur: 500, ease: 'linear' });
        S.fly([FX[3], FY - 4], 'wal', { label: '日志记录', w: 84, h: 28, color: C.purple, delay: 3650, dur: 550 });
        flush(3, 6, 'pg3', 4100); S.count('tW', 3, { delay: 4950 }); S.log('WritePage(6)', { delay: 4950, kind: 'io' });
        S.data({ '脏页': '（无）', '写回数据页': 3 }, { delay: 5000 });
      }, { hold: 900 });
      S.step('于是下次再挑牺牲页，候选全是干净页；代价是：后台刷得太勤会把 I/O 带宽占满', function () {
        S.code(8);
        S.hide('bw'); S.hide('tBW');
        FX.forEach(function (x, i) { S.flash('fr' + i, C.green, { prop: 'stroke', delay: 300 + i * 220 }); S.pulse('dt' + i, { delay: 300 + i * 220, scale: 1.2 }); });
        S.fly([FX[0] - 60, FY + 80], [FX[3] + 60, FY + 80], { color: C.green, delay: 300, dur: 900, ease: 'linear' });
        S.log('所有帧都是干净页', { delay: 1200, kind: 'ok' });
      });
    }
  }
  ]
});
})();
