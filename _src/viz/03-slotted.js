/* #03 Slotted Page：插入 / 删除与压实 / 用 Record ID 取元组
 * 页大小 100 字节、页头 12 字节、每个槽 6 字节、页号 7 等都是为了画得下而取的示意值。 */
(function () {
var C = Viz.C, PX = 40, U = 7.8, TUP = '#2b4172', HDR = '#2a2350', SLOT = '#33285c', uid = 0;
function X(b) { return PX + U * b; }                    /* 页内字节偏移 → 像素 x */
function mid(a, b) { return (X(a) + X(b)) / 2; }
function bw(n) { return n * U - 6; }                    /* n 字节宽的方块的像素宽 */
function mix(p, o) { for (var k in o) p[k] = o[k]; return p; }

function base(S, py, ph, o) {
  S.box('pg', mix({ x: 430, y: py, w: 788, h: ph, rx: 8, fill: C.panel, stroke: C.line, sw: 2 }, o && o.pg));
  S.box('hdr', mix({ x: mid(0, 12), y: py, w: bw(12), h: ph - 12, rx: 5, fill: HDR, stroke: C.purple, sw: 1.5, label: '页头', size: 16 }, o && o.in));
}
function slot(S, i, py, ph, val, o) {                   /* 槽 i 占 [12+6i, 18+6i) */
  var x = mid(12 + 6 * i, 18 + 6 * i);
  S.box('s' + i, mix({ x: x, y: py, w: bw(6), h: ph - 12, rx: 4, fill: SLOT, stroke: C.purple, sw: 1.5 }, o));
  S.text('sn' + i, mix({ x: x, y: py - ph / 2 + 24, text: 's' + i, size: 14, color: C.mute }, o));
  S.text('sv' + i, mix({ x: x, y: py + 10, val: val, size: 16, weight: 700 }, o));
}
function tup(S, id, a, len, py, ph, label, o) {
  S.box(id, mix({ x: mid(a, a + len), y: py, w: bw(len), h: ph - 12, rx: 5, fill: TUP, stroke: 'none', sw: 0, label: label, size: 16, trail: 3 }, o));
}
/* 槽 → 元组 的指针：从槽底出来，往下、横走、再向上扎进元组的起始位置 */
function ptr(S, id, sx, tx, y0, lv, on) {
  var st = { stroke: C.purple, sw: 2, opacity: on ? 1 : 0, draw: on ? 1 : 0 };
  S.line(id + 'a', mix({ x1: sx, y1: y0, x2: sx, y2: lv }, st));
  S.line(id + 'b', mix({ x1: sx, y1: lv, x2: tx, y2: lv }, st));
  S.line(id + 'c', mix({ x1: tx, y1: lv, x2: tx, y2: y0 + 2, arrow: true }, st));
}
function grow(S, id, d) {
  S.to(id + 'a', { opacity: 1, draw: 1 }, { delay: d, dur: 180, ease: 'linear' });
  S.to(id + 'b', { opacity: 1, draw: 1 }, { delay: d + 180, dur: 380, ease: 'linear' });
  S.to(id + 'c', { opacity: 1, draw: 1 }, { delay: d + 560, dur: 220, ease: 'out' });
}
function retract(S, id, d) {
  S.to(id + 'c', { draw: 0, opacity: 0 }, { delay: d, dur: 200, ease: 'linear' });
  S.to(id + 'b', { draw: 0, opacity: 0 }, { delay: d + 200, dur: 350, ease: 'linear' });
  S.to(id + 'a', { draw: 0, opacity: 0 }, { delay: d + 550, dur: 180, ease: 'linear' });
}
/* 一个小圆点沿指针的三段走一遍（约 800ms） */
function trace(S, id, d, col) {
  var a = S.byId[id + 'a'].cur, c = S.byId[id + 'c'].cur, t = '_t' + (uid++);
  S.dot(t, { x: a.x1, y: a.y1, r: 8, fill: col, opacity: 0, trail: 4 });
  S.to(t, { opacity: 1 }, { delay: d, dur: 100 });
  S.to(t, { y: a.y2 }, { delay: d, dur: 180, ease: 'linear' });
  S.to(t, { x: c.x1 }, { delay: d + 180, dur: 420, ease: 'linear' });
  S.to(t, { y: c.y2 }, { delay: d + 600, dur: 200, ease: 'linear' });
  S.ripple(c.x2, c.y2 - 10, { delay: d + 800, color: col });
  S.to(t, { opacity: 0 }, { delay: d + 840, dur: 200 });
  ['a', 'b', 'c'].forEach(function (k, i) { S.flash(id + k, col, { prop: 'stroke', delay: d + i * 200 }); });
}
var NOTE = '页大小 100 字节、页头 12、每个槽 6 字节 —— 示意值（真实的页是 4–16 KB）';

Viz.register('slotted', {
  title: 'Slotted Page：插入 · 删除与压实 · 用 Record ID 取元组',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #03 Database Storage I（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/03-storage1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #03 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/03-storage1.pdf' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：插入 ───────────────────────── */
  {
    name: '插入：两头往中间长',
    moving: '待插入的元组滑到落点上方再落进页尾；空闲空间的虚线框从两头被压窄；新槽弹出、指针从槽长到元组；RID 小方块飞到页外；空闲字节数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'bool Page::Insert(Tuple t, RID* rid) {',
      '  int need = t.size + SLOT_SIZE;',
      '  if (FreeSpace() < need)',
      '    return false;         // 页满，换一页',
      '  free_end -= t.size;     // 数据从页尾往前',
      '  memcpy(data + free_end, t.bytes, t.size);',
      '  slot[num_slots] = free_end; // 槽往后加',
      '  *rid = {page_id, num_slots++};',
      '  return true;',
      '}',
      'int Page::FreeSpace() {   // 两头之间的空隙',
      '  int slots_end = HDR + num_slots * SLOT_SIZE;',
      '  return free_end - slots_end;',
      '}'
    ].join('\n'),
    build: function (S) {
      var PY = 255, PH = 110, Y0 = PY + PH / 2, YS = 90, SX = 240;
      var T = [['A', 24, 76], ['B', 16, 60], ['C', 20, 40]], LV = [386, 368, 350], FREE = [[64, 58], [42, 36], [16, 10]];
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      S.text('tFree', { x: 840, y: 24, anchor: 'end', val: 88, pre: '连续空闲：', suf: ' 字节', color: C.amber, size: 16 });
      S.text('tNew', { x: 40, y: YS, text: '待插入：', anchor: 'start', color: C.mute });
      S.text('gL', { x: X(12), y: 164, text: '槽数组：从前往后长 →', anchor: 'start', color: C.purple });
      S.text('gR', { x: 824, y: 164, text: '← 元组数据：从后往前长', anchor: 'end', color: C.blue });
      S.text('r0', { x: 40, y: 190, text: '偏移 0', anchor: 'start', size: 14, color: C.mute });
      S.text('r100', { x: 824, y: 190, text: '100', anchor: 'end', size: 14, color: C.mute });
      base(S, PY, PH);
      S.box('free', { x: mid(12, 100), y: PY, w: bw(88), h: PH - 12, rx: 5, fill: C.bg, stroke: C.line, dash: '6 5', label: '空闲空间', color: C.mute, size: 15 });
      S.box('pg8', { x: 700, y: YS, w: 230, h: 66, rx: 8, fill: C.panel, stroke: C.line, sw: 2, dash: '6 5', label: '', opacity: 0 });
      S.text('tP8', { x: 700, y: 46, text: '另一页（页 8）', size: 14, color: C.mute, opacity: 0 });
      T.forEach(function (t, i) {
        ptr(S, 'p' + i, mid(12 + 6 * i, 18 + 6 * i), X(t[2]) + 14, Y0, LV[i]);
        slot(S, i, PY, PH, t[2], { opacity: 0 });
        S.text('k' + i, { x: X(t[2]), y: 190, text: String(t[2]), size: 14, color: C.mute, opacity: 0 });
        tup(S, 't' + t[0], 0, t[1], YS, 62, t[0] + ' · ' + t[1] + 'B', { x: SX, fill: C.amber, color: C.bg, opacity: 0 });
      });
      tup(S, 'tD', 0, 14, YS, 62, 'D · 14B', { x: SX, fill: C.amber, color: C.bg, opacity: 0 });
      S.text('tRid', { x: 40, y: 452, text: 'Insert 返回的 Record ID =（页号 7, 槽号）：', anchor: 'start', color: C.mute });
      S.data({ '页号': 7, '槽数': 0, '连续空闲': '88 字节' });

      function hover(i, d) {                 /* 元组滑到自己落点的正上方 */
        var t = T[i];
        S.pop('t' + t[0], { delay: d });
        S.move('t' + t[0], mid(t[2], t[2] + t[1]), YS, { delay: d + 450, dur: 700 });
      }
      function drop(i, d) {                  /* 数据落进页尾方向的空位，空闲框右边被吃掉 */
        var t = T[i], id = 't' + t[0];
        S.to(id, { y: PY, h: PH - 12 }, { delay: d, dur: 650, ease: 'in' });
        S.to('free', { x: mid(12 + 6 * i, t[2]), w: bw(t[2] - 12 - 6 * i) }, { delay: d + 250, dur: 450 });
        S.ripple(X(t[2]) + 14, PY, { delay: d + 650, color: C.amber }); S.pulse(id, { delay: d + 650, scale: 1.05 });
        S.to(id, { fill: TUP, color: C.ink }, { delay: d + 800, dur: 400 });
        S.pop('k' + i, { delay: d + 650 });
        S.count('tFree', FREE[i][0], { delay: d + 300 }); S.data({ '连续空闲': FREE[i][0] + ' 字节' }, { delay: d + 650 });
      }
      function addSlot(i, d) {               /* 槽数组加一项，空闲框左边被吃掉，指针长出来，RID 飞出去 */
        var t = T[i], sx = mid(12 + 6 * i, 18 + 6 * i);
        S.pop('s' + i, { delay: d }); S.pop('sn' + i, { delay: d + 80 }); S.pop('sv' + i, { delay: d + 160 });
        S.to('free', { x: mid(18 + 6 * i, t[2]), w: bw(t[2] - 18 - 6 * i) }, { delay: d, dur: 400 });
        S.count('tFree', FREE[i][1], { delay: d + 100, dur: 400 });
        grow(S, 'p' + i, d + 350);
        S.fly([sx, Y0], [130 + i * 200, 500], { id: 'rid' + i, label: 'RID (7, ' + i + ')', w: 150, h: 42, size: 15, color: C.purple, keep: true, delay: d + 1150, dur: 750 });
        S.data({ '槽数': i + 1, '连续空闲': FREE[i][1] + ' 字节', '返回 RID': '(7, ' + i + ')' }, { delay: d + 400 });
      }

      S.step('一张空页（页 7）：页头之后全是空闲空间。来了一条 24 字节的元组 A', function () {
        S.code([11, 13]); S.log('页 7：连续空闲 88 字节');
        S.flash('hdr', C.purple); S.pulse('hdr', { scale: 1.06 });
        S.flash('free', C.blue, { prop: 'stroke', delay: 450 }); S.pulse('tFree', { delay: 450 });
        S.pop('tA', { delay: 1000 });
      });
      S.step('先算够不够：元组 24 + 一个槽 6 = 30 ≤ 88 → 放得下，A 对准页尾', function () {
        S.code([2, 3]); S.log('Insert(A)：need = 24 + 6 = 30');
        S.pulse('tA'); S.flash('free', C.green, { prop: 'stroke', delay: 300 });
        S.move('tA', mid(76, 100), YS, { delay: 500, dur: 750 });
        S.data({ 'need': '30 字节' }, { delay: 300 });
      });
      S.step('元组数据写到页尾：占住偏移 76–100，空闲空间从右边被吃掉 24 字节', function () {
        S.code([5, 6]); drop(0, 0);
      });
      S.step('槽数组加一项 s0，里面记 A 的页内偏移 76；槽号 0 连同页号作为 RID 返回', function () {
        S.code(7); addSlot(0, 0); S.code(8, { delay: 1150 });
        S.log('A → 偏移 76，RID (7, 0)', { delay: 1200, kind: 'ok' });
      });
      S.step('再插入 B（16 字节）：数据紧贴在 A 的前面，槽 s1 紧跟在 s0 后面', function () {
        S.code([2, 3]); S.log('Insert(B)：need = 22'); S.data({ 'need': '22 字节' });
        hover(1, 0); S.code([5, 6], { delay: 1150 }); drop(1, 1250);
        S.code([7, 8], { delay: 2000 }); addSlot(1, 2100);
        S.log('B → 偏移 60，RID (7, 1)', { delay: 3300, kind: 'ok' });
      });
      S.step('插入 C（20 字节）：两头越来越近，中间只剩 10 字节', function () {
        S.code([2, 3]); S.log('Insert(C)：need = 26'); S.data({ 'need': '26 字节' });
        hover(2, 0); S.code([5, 6], { delay: 1150 }); drop(2, 1250);
        S.set('free', { label: '空闲' }, { delay: 1500 });
        S.code([7, 8], { delay: 2000 }); addSlot(2, 2100);
        S.log('C → 偏移 40，RID (7, 2)', { delay: 3300, kind: 'ok' });
      });
      S.step('插入 D（14 字节）：要 14 + 6 = 20，可中间只剩 10 → 两头相遇，这一页满了', function () {
        S.code([2, 3]); S.log('Insert(D)：need = 20'); S.data({ 'need': '20 字节' });
        S.pop('tD'); S.move('tD', mid(30, 40), YS, { delay: 450, dur: 650 });
        S.to('tD', { y: YS + 30 }, { delay: 1150, dur: 300, ease: 'in' });
        S.to('free', { stroke: C.red }, { delay: 1400, dur: 200 }); S.pulse('free', { delay: 1400, scale: 1.12 });
        S.to('tD', { y: YS, fill: C.red }, { delay: 1500, dur: 450, ease: 'back' });
        S.pulse('tFree', { delay: 1500 });
        S.code(4, { delay: 1500 }); S.log('20 > 10：页满', { delay: 1550, kind: 'err' });
      });
      S.step('D 只能去另一页；剩下的 10 字节成了用不上的碎片 —— 页不保证 100% 填满', function () {
        S.code(4);
        S.pop('pg8'); S.pop('tP8', { delay: 100 });
        S.to('tD', { x: 700, fill: C.amber }, { delay: 350, dur: 800 }); S.ripple(700, YS, { delay: 1150, color: C.amber });
        S.to('pg8', { stroke: C.green }, { delay: 1150, dur: 300 });
        S.to('free', { stroke: C.amber }, { delay: 600, dur: 300 }); S.set('free', { label: '碎片', color: C.amber }, { delay: 700 });
        S.pulse('free', { delay: 700, scale: 1.1 });
        S.data({ need: null, '返回 RID': null, '碎片': '10 字节' }, { delay: 700 }); S.log('D 改放到页 8', { delay: 1200, kind: 'warn' });
      });
    }
  },

  /* ───────────────────────── 场景 2：删除与压实 ───────────────────────── */
  {
    name: '删除与压实：槽号不变',
    moving: '被删的元组缩小消失、留下一个洞；新元组在空闲区和洞上方来回试探；元组 C 向页尾滑动把洞挤走，空闲框随之变宽；槽里的偏移数字滚动、指针终点跟着滑；圆点从索引沿指针再走一遍',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 页外的索引项：key → RID{page_id, slot_no}',
      'void Page::Delete(int slot_no) {',
      '  slot[slot_no] = EMPTY;   // 只清槽，留下洞',
      '}',
      'void Page::Compact() {     // 页已在内存里',
      '  int end = PAGE_SIZE;',
      '  for (int s : SlotsByOffsetDesc()) {',
      '    int len = TupleSize(s);',
      '    end -= len;            // 紧贴后一条',
      '    memmove(data + end, data + slot[s], len);',
      '    slot[s] = end;         // 只改页内偏移',
      '  }',
      '  free_end = end;          // 槽号、RID 不变',
      '}',
      '// Insert 时可以复用 EMPTY 的槽'
    ].join('\n'),
    build: function (S) {
      var PY = 255, PH = 110, Y0 = PY + PH / 2, YS = 90, SX = 250;
      var IX = [150, 430, 710], LV = [386, 368, 350];
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      S.text('tFree', { x: 840, y: 24, anchor: 'end', val: 16, pre: '连续空闲：', suf: ' 字节', color: C.amber, size: 16 });
      S.text('tNew', { x: 40, y: YS, text: '待插入：', anchor: 'start', color: C.mute, opacity: 0 });
      S.text('r0', { x: 40, y: 190, text: '偏移 0', anchor: 'start', size: 14, color: C.mute });
      S.text('r100', { x: 824, y: 190, text: '100', anchor: 'end', size: 14, color: C.mute });
      base(S, PY, PH);
      S.box('free', { x: mid(30, 46), y: PY, w: bw(16), h: PH - 12, rx: 5, fill: C.bg, stroke: C.line, dash: '6 5', label: '空闲', color: C.mute, size: 15 });
      S.box('hole', { x: mid(64, 80), y: PY, w: bw(16), h: PH - 12, rx: 5, fill: C.bg, stroke: C.red, dash: '6 5', label: '洞 16B', color: C.red, size: 15, opacity: 0 });
      ptr(S, 'p0', mid(12, 18), X(80) + 14, Y0, LV[0], true);
      ptr(S, 'p1', mid(18, 24), X(64) + 14, Y0, LV[1], true);
      ptr(S, 'p2', mid(24, 30), X(46) + 14, Y0, LV[2], true);
      slot(S, 0, PY, PH, 80); slot(S, 1, PY, PH, 64); slot(S, 2, PY, PH, 46);
      tup(S, 'tA', 80, 20, PY, PH, 'A · 20B'); tup(S, 'tB', 64, 16, PY, PH, 'B · 16B'); tup(S, 'tC', 46, 18, PY, PH, 'C · 18B');
      S.text('k0', { x: X(80), y: 190, text: '80', size: 14, color: C.mute });
      S.text('k1', { x: X(64), y: 190, text: '64', size: 14, color: C.mute });
      S.text('k2', { x: X(46), y: 190, val: 46, size: 14, color: C.mute });
      S.text('k3', { x: X(34), y: 190, text: '34', size: 14, color: C.mute, opacity: 0 });
      tup(S, 'tE', 0, 28, YS, 62, 'E · 28B', { x: SX, fill: C.amber, color: C.bg, opacity: 0 });
      S.text('tIx', { x: 40, y: 452, text: '页外的索引：key → Record ID（页号, 槽号）', anchor: 'start', color: C.mute });
      ['key 101 → RID (7, 0)', 'key 102 → RID (7, 1)', 'key 103 → RID (7, 2)'].forEach(function (t, i) {
        S.box('ix' + i, { x: IX[i], y: 500, w: 220, h: 44, fill: C.cell, stroke: C.line, label: t, size: 15 });
      });
      S.data({ 's0': 80, 's1': 64, 's2': 46, '连续空闲': '16 字节' });

      S.step('页外的索引只记（页号, 槽号）；真正的页内偏移只有槽数组知道', function () {
        S.code(1); S.log('索引：key 103 → RID (7, 2)');
        S.flash('ix2', C.blue); S.pulse('ix2', { scale: 1.06 });
        S.fly([IX[2], 478], [mid(24, 30), Y0], { color: C.blue, delay: 350, dur: 800 });
        S.flash('s2', C.blue, { delay: 1150 }); S.pulse('s2', { delay: 1150 });
        trace(S, 'p2', 1400, C.blue);
        S.flash('tC', C.blue, { delay: 2200 }); S.pulse('tC', { delay: 2200, scale: 1.05 });
      });
      S.step('Delete key 102：只把槽 s1 清空 —— B 占过的 16 字节成了夹在中间的洞', function () {
        S.code([2, 4]); S.log('Delete(slot 1)');
        S.to('ix1', { fill: C.red }, { dur: 300 }); S.hide('ix1', { delay: 500 });
        S.to('tB', { fill: C.red }, { delay: 200, dur: 300 });
        retract(S, 'p1', 300);
        S.to('tB', { scale: .2, opacity: 0 }, { delay: 700, dur: 450, ease: 'in' });
        S.to('hole', { opacity: 1 }, { delay: 1000, dur: 350 }); S.pulse('hole', { delay: 1000, scale: 1.06 });
        S.hide('k1', { delay: 800 });
        S.set('sv1', { val: null, text: '∅', color: C.mute }, { delay: 900 }); S.pulse('sv1', { delay: 900 });
        S.to('s1', { fill: C.cell, stroke: C.line }, { delay: 900, dur: 300 });
        S.data({ 's1': '空（∅）', '洞': '16 字节' }, { delay: 1000 });
      });
      S.step('新元组 E 要 28 字节：空闲区 16、洞 16，加起来够，但哪一块都放不下', function () {
        S.code(3); S.log('Insert(E)：need = 28');
        S.pop('tNew'); S.pop('tE', { delay: 100 });
        S.move('tE', mid(30, 46), YS + 26, { delay: 600, dur: 650 });
        S.flash('free', C.red, { prop: 'stroke', delay: 1250 }); S.pulse('free', { delay: 1250, scale: 1.08 });
        S.move('tE', mid(64, 80), YS + 26, { delay: 1750, dur: 650 });
        S.flash('hole', C.red, { delay: 2400 }); S.pulse('hole', { delay: 2400, scale: 1.08 });
        S.move('tE', SX, YS, { delay: 2900, dur: 600 });
        S.log('28 > 16：空闲区和洞都塞不下', { delay: 2450, kind: 'warn' });
      });
      S.step('压实：页反正已经在内存里，把 C 往页尾滑 16 字节，洞被挤到前面并入空闲区', function () {
        S.code([5, 10]); S.log('Compact()：memmove C');
        S.move('tC', mid(62, 80), PY, { dur: 900 }); S.to('hole', { x: mid(46, 62) }, { dur: 900 });
        S.to('k2', { x: X(62) }, { dur: 900 }); S.count('k2', 62, { dur: 900 });
        S.ripple(X(80) - 10, PY, { delay: 900, color: C.cyan }); S.pulse('tC', { delay: 900, scale: 1.05 });
        S.hide('hole', { delay: 900 });
        S.to('free', { x: mid(30, 62), w: bw(32) }, { delay: 900, dur: 500 }); S.set('free', { label: '空闲空间' }, { delay: 1100 });
        S.count('tFree', 32, { delay: 900 });
        ['p2a', 'p2b', 'p2c'].forEach(function (id) { S.to(id, { stroke: C.amber }, { delay: 900, dur: 300 }); });
        S.data({ '洞': null, '连续空闲': '32 字节' }, { delay: 1000 });
      });
      S.step('整页只需改一处元数据：槽 s2 里的偏移 46 → 62，指针跟着指到新位置', function () {
        S.code(11);
        S.flash('s2', C.amber); S.pulse('s2');
        S.count('sv2', 62, { delay: 150, dur: 700 });
        S.to('p2b', { x2: X(62) + 14 }, { delay: 150, dur: 700 });
        S.to('p2c', { x1: X(62) + 14, x2: X(62) + 14 }, { delay: 150, dur: 700 });
        ['p2a', 'p2b', 'p2c'].forEach(function (id) { S.to(id, { stroke: C.purple }, { delay: 900, dur: 300 }); });
        S.ripple(X(62) + 14, Y0 - 10, { delay: 850, color: C.purple });
        S.data({ 's2': '46 → 62' }, { delay: 200 }); S.log('slot[2] = 62', { delay: 300 });
      });
      S.step('槽号没变 → 索引里的 RID (7, 2) 一个字节都不用改，照样找得到 C', function () {
        S.code(13);
        S.flash('ix2', C.green); S.pulse('ix2', { scale: 1.06 });
        S.fly([IX[2], 478], [mid(24, 30), Y0], { color: C.green, delay: 350, dur: 800 });
        S.flash('s2', C.green, { delay: 1150 });
        trace(S, 'p2', 1400, C.green);
        S.flash('tC', C.green, { delay: 2200 }); S.pulse('tC', { delay: 2200, scale: 1.05 });
        S.log('RID (7, 2) 不变，索引不用更新', { delay: 2250, kind: 'ok' });
      });
      S.step('E 现在放得下了：数据写进连成一片的空闲区，并复用空着的槽 s1', function () {
        S.code(15); S.log('Insert(E) → 复用槽 1');
        S.move('tE', mid(34, 62), YS, { dur: 600 });
        S.to('tE', { y: PY, h: PH - 12 }, { delay: 600, dur: 600, ease: 'in' });
        S.to('free', { x: mid(30, 34), w: bw(4) }, { delay: 800, dur: 400 }); S.set('free', { label: '' }, { delay: 800 });
        S.ripple(X(34) + 14, PY, { delay: 1200, color: C.amber }); S.pulse('tE', { delay: 1200, scale: 1.04 });
        S.to('tE', { fill: TUP, color: C.ink }, { delay: 1350, dur: 400 });
        S.pop('k3', { delay: 1200 }); S.hide('tNew', { delay: 600 }); S.count('tFree', 4, { delay: 800 });
        S.set('p1a', { y2: 332 }); S.set('p1b', { y1: 332, y2: 332, x2: X(34) + 14 }); S.set('p1c', { x1: X(34) + 14, x2: X(34) + 14, y1: 332 });
        S.to('s1', { fill: SLOT, stroke: C.purple }, { delay: 1400, dur: 300 }); S.pulse('s1', { delay: 1400 });
        S.set('sv1', { val: 34, color: C.ink }, { delay: 1400 });
        grow(S, 'p1', 1600);
        S.set('ix1', { label: 'key 104 → RID (7, 1)', fill: C.cell }, { delay: 2300 }); S.pop('ix1', { delay: 2300 });
        S.data({ 's1': 34, 's2': 62, '连续空闲': '4 字节' }, { delay: 1400 }); S.log('E → 偏移 34，RID (7, 1)', { delay: 2400, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 3：用 RID 取元组 ───────────────────────── */
  {
    name: '用 Record ID 取元组',
    moving: 'RID 的两半从索引飞出；页号飞进页目录、再飞到磁盘上的那一页；整页飞进内存帧并展开；槽号飞到槽数组；圆点沿指针走到元组；元组飞进输出槽；I/O 次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Tuple Get(Key k) {',
      '  RID rid = index.Lookup(k); // {页号, 槽号}',
      '  Loc loc = page_dir.Lookup(rid.page_id);',
      '  Page* p = pool.Fetch(rid.page_id, loc);',
      '  int off = p->slot[rid.slot_no];',
      '  if (off == EMPTY) return NOT_FOUND;',
      '  return Tuple(p->data + off);',
      '}'
    ].join('\n'),
    build: function (S) {
      var PY = 380, PH = 90, Y0 = PY + PH / 2, LV = [467, 453, 439];
      var T = [['key 101', 78, 22], ['key 103', 58, 20], ['key 107', 40, 18]], DX = [250, 380, 510, 640], DY = [90, 120, 150, 180];
      S.text('note', { x: 20, y: 24, text: '页号、偏移、key 都是示意值；这里一页按 8 KB 算', anchor: 'start', size: 14, color: C.mute });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: '磁盘 I/O：', suf: ' 次', color: C.amber, size: 16 });
      S.box('ix', { x: 120, y: 100, w: 180, h: 56, fill: C.panel, stroke: C.line, sw: 2, label: '索引：key 103', size: 16 });
      S.text('tRid', { x: 374, y: 60, text: 'Record ID', size: 14, color: C.mute, opacity: 0 });
      S.box('dir', { x: 700, y: 124, w: 250, h: 160, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
      S.text('tDir', { x: 700, y: 62, text: '页目录：页号 → 文件内位置', size: 14, color: C.mute });
      ['0', '8 KB', '16 KB', '24 KB'].forEach(function (o, i) {
        S.box('d' + i, { x: 700, y: DY[i], w: 226, h: 26, rx: 5, fill: C.cell, stroke: 'none', sw: 0, label: '页 ' + i + ' → 偏移 ' + o, size: 15 });
      });
      S.text('tDisk', { x: 40, y: 262, text: '磁盘上的数据文件', anchor: 'start', color: C.mute });
      DX.forEach(function (x, i) { S.box('f' + i, { x: x, y: 262, w: 116, h: 46, fill: C.cell, stroke: C.line, label: '页 ' + i, size: 16 }); });
      S.text('tMem', { x: 40, y: 318, text: '内存：缓冲池的一个帧（空）', anchor: 'start', color: C.mute });
      base(S, PY, PH, { pg: { dash: '6 5' }, in: { opacity: 0 } });
      S.box('free', { x: mid(30, 40), y: PY, w: bw(10), h: PH - 12, rx: 5, fill: C.bg, stroke: C.line, dash: '6 5', label: '空闲', color: C.mute, size: 14, opacity: 0 });
      T.forEach(function (t, i) {
        ptr(S, 'p' + i, mid(12 + 6 * i, 18 + 6 * i), X(t[1]) + 14, Y0, LV[i]);
        slot(S, i, PY, PH, t[1], { opacity: 0 });
        tup(S, 't' + i, t[1], t[2], PY, PH, t[0], { opacity: 0 });
      });
      S.box('tray', { x: 490, y: 515, w: 600, h: 46, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      S.text('tTray', { x: 40, y: 515, text: '交给上层：', anchor: 'start', color: C.mute });
      S.data({ key: 103, RID: '—', '磁盘 I/O': 0 });

      S.step('先查索引：key 103 → 拿到一个 Record ID =（页 2, 槽 1）', function () {
        S.code(2); S.log('index.Lookup(103)');
        S.flash('ix', C.blue, { prop: 'stroke' }); S.pulse('ix', { scale: 1.05 });
        S.fly('ix', [330, 100], { id: 'ridP', label: '页 2', w: 84, h: 40, size: 16, color: C.purple, keep: true, delay: 400, dur: 650 });
        S.fly('ix', [418, 100], { id: 'ridS', label: '槽 1', w: 84, h: 40, size: 16, color: C.blue, keep: true, delay: 600, dur: 650 });
        S.pop('tRid', { delay: 1050 });
        S.data({ RID: '(页 2, 槽 1)' }, { delay: 1250 });
      });
      S.step('页号 2 交给页目录：查出这一页在数据文件里的位置', function () {
        S.code(3);
        S.pulse('ridP');
        S.fly('ridP', 'd2', { label: '页 2', w: 70, h: 28, color: C.purple, delay: 250, dur: 800 });
        S.to('d2', { fill: '#4a3a86' }, { delay: 1050, dur: 300 }); S.pulse('d2', { delay: 1050, scale: 1.06 });
        S.data({ '文件内位置': '偏移 16 KB' }, { delay: 1100 }); S.log('page_dir：页 2 → 偏移 16 KB', { delay: 1100 });
      });
      S.step('页不在内存 → 把整页从磁盘读进缓冲池的一个帧：1 次磁盘 I/O', function () {
        S.code(4);
        S.fly('d2', 'f2', { color: C.purple, dur: 650 });
        S.flash('f2', C.amber, { delay: 650, hold: 900 }); S.pulse('f2', { delay: 650 });
        S.fly('f2', [430, PY], { label: '页 2', w: 116, h: 46, size: 16, color: C.cyan, delay: 950, dur: 800 });
        S.count('tIO', 1, { delay: 1000 }); S.log('disk.ReadPage(2)', { delay: 1000, kind: 'io' });
        S.set('pg', { dash: '' }, { delay: 1750 }); S.set('tMem', { text: '内存：缓冲池里的页 2', color: C.ink }, { delay: 1750 });
        S.pop('hdr', { delay: 1800 });
        [0, 1, 2].forEach(function (i) {
          S.pop('s' + i, { delay: 1880 + i * 70 }); S.pop('sn' + i, { delay: 1880 + i * 70 }); S.pop('sv' + i, { delay: 1880 + i * 70 });
          S.pop('t' + (2 - i), { delay: 2150 + i * 70 });
          grow(S, 'p' + i, 2400 + i * 120);
        });
        S.pop('free', { delay: 2100 });
        S.data({ '磁盘 I/O': 1 }, { delay: 1750 });
      });
      S.step('槽号 1 直接当下标用：读出 slot[1] 里记的页内偏移 58', function () {
        S.code(5);
        S.pulse('ridS');
        S.fly('ridS', [mid(18, 24), PY - PH / 2], { label: '槽 1', w: 70, h: 28, color: C.blue, delay: 250, dur: 850 });
        S.flash('s1', C.blue, { delay: 1100, hold: 700 }); S.pulse('s1', { delay: 1100 });
        S.data({ '页内偏移': 58 }, { delay: 1150 }); S.log('slot[1] = 58', { delay: 1150 });
      });
      S.step('顺着这个偏移跳到元组的起始字节 —— 找到了', function () {
        S.code(7);
        trace(S, 'p1', 0, C.blue);
        S.to('t1', { fill: C.green, color: C.bg }, { delay: 850, dur: 400 }); S.pulse('t1', { delay: 850, scale: 1.06 });
      });
      S.step('把这段字节交给上层 —— 到这一层为止没人关心它的含义，由上层来解释', function () {
        S.code(7);
        S.fly('t1', [280, 515], { label: 'key 103 的元组', w: 150, h: 32, color: C.green, keep: true, dur: 850 });
        S.log('Get(103) → 命中，读盘 1 次', { delay: 900, kind: 'ok' });
      });
      S.step('再来一个 RID（页 2, 槽 0）：页已经在内存里，不用再读盘，直接走槽数组', function () {
        S.code(4); S.log('Get(101)：RID (页 2, 槽 0)'); S.data({ key: 101, RID: '(页 2, 槽 0)' });
        S.set('ix', { label: '索引：key 101' }); S.pulse('ix', { scale: 1.05 });
        S.set('ridS', { label: '槽 0' }); S.pulse('ridS'); S.pulse('ridP');
        S.flash('pg', C.green, { prop: 'stroke', delay: 300 }); S.pulse('tIO', { delay: 300 });
        S.code(5, { delay: 600 });
        S.fly('ridS', [mid(12, 18), PY - PH / 2], { label: '槽 0', w: 70, h: 28, color: C.blue, delay: 600, dur: 800 });
        S.flash('s0', C.blue, { delay: 1400 }); S.pulse('s0', { delay: 1400 });
        trace(S, 'p0', 1600, C.blue); S.code(7, { delay: 1600 });
        S.to('t0', { fill: C.green, color: C.bg }, { delay: 2450, dur: 350 });
        S.fly('t0', [450, 515], { label: 'key 101 的元组', w: 150, h: 32, color: C.green, keep: true, delay: 2650, dur: 800 });
        S.data({ '页内偏移': 78 }, { delay: 1450 }); S.log('命中内存中的页，I/O 仍是 1 次', { delay: 3450, kind: 'ok' });
      });
    }
  }
  ]
});
})();
