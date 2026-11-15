/* #05 日志结构存储（LSM）：写入与落盘 · 读路径与墓碑 · 归并压实 · 分层压实
 * MemTable 容量、key、值、每个文件的条数都是为了画得下而取的示意值；
 * 场景 3、4 的例子（DELETE 100 / PUT 101…；[A~R] [E~T] [B~Q] → [A~K] [L~T]）照抄笔记。 */
(function () {
var C = Viz.C, PG = '#2b4172', TOMB = '#6b2a36', WAL = '#33285c';
function mix(p, o) { for (var k in o) p[k] = o[k]; return p; }
function lbl(S, id, x, y, t, o) { S.text(id, mix({ x: x, y: y, text: t, anchor: 'start', color: C.mute, size: 15 }, o)); }
function chip(S, id, x, y, label, o) {
  S.box(id, mix({ x: x, y: y, w: 92, h: 42, rx: 6, fill: PG, stroke: 'none', sw: 0, label: label, size: 15, trail: 3 }, o));
}
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #05 Log-Structured Storage（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/05-storage2.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #05 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/05-storage2.pdf' }
];

Viz.register('lsm', {
  title: 'LSM：写入与落盘 · 读路径 · 压实',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：写入与落盘 ───────────────────────── */
  {
    name: '写入 MemTable 与落盘',
    moving: '每条 PUT 先飞一份到日志文件、再滑进 MemTable 的有序位置，后面的条目往右让一格；原地更新时旧值被新值替换；写满后整批条目穿过内存/磁盘分界线落成 SSTable，旧 SSTable 往下让位；条数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Put(Key k, Value v) {',
      '  wal.Append(PUT, k, v);   // 先追加日志',
      '  memtable.Upsert(k, v);   // 有序；可原地改',
      '  if (memtable.size() >= LIMIT) Flush();',
      '}',
      'void Flush() {',
      '  SSTable sst;             // 写完就不可变',
      '  for (auto& e : memtable) // 已按 key 有序',
      '    sst.Append(e.key, e.val); // 只有最新值',
      '  level0.PushFront(sst);   // 越新越靠前',
      '  memtable = NewMemTable();',
      '}'
    ].join('\n'),
    build: function (S) {
      var MX = [320, 420, 520, 620], MY = 178, OX = 300, OY = 84, WY = 292, YT = 385, YB = 470, mem = [], nW = 0;
      function wal(from, label, d) {             /* 日志文件末尾追加一条 */
        var x = 236 + nW * 78, id = 'w' + nW; nW++;
        S.fly(from, [x, WY], { id: id, label: label, w: 70, h: 30, color: C.purple, keep: true, delay: d, dur: 700 });
        return id;
      }
      function put(id, key, d) {                 /* 新条目滑进有序位置，比它大的往右让 */
        var pos = mem.length, j;
        for (j = 0; j < mem.length; j++) if (mem[j].key > key) { pos = j; break; }
        for (j = mem.length - 1; j >= pos; j--) S.move(mem[j].id, MX[j + 1], MY, { delay: d + 150, dur: 550 });
        mem.splice(pos, 0, { id: id, key: key });
        S.to(id, { x: MX[pos], y: MY, w: 92, h: 42 }, { delay: d + 250, dur: 800 });
        S.ripple(MX[pos], MY, { delay: d + 1050, color: C.amber }); S.pulse(id, { delay: d + 1050, scale: 1.08 });
        S.to(id, { fill: PG, color: C.ink }, { delay: d + 1200, dur: 350 });
        S.count('tN', mem.length, { delay: d + 1050, dur: 300 });
      }
      function op(id, label, key, d) {           /* 一次完整的 PUT：弹出 → 记日志 → 进 MemTable */
        S.pop(id, { delay: d });
        wal(id, 'PUT ' + key, d + 400);
        if (key) put(id, key, d + 1000);
      }
      S.text('note', { x: 20, y: 24, text: 'MemTable 只放 4 条、key 和值都是示意值（真实的 MemTable 常有几百 MB）', anchor: 'start', size: 14, color: C.mute });
      S.text('tN', { x: 840, y: 24, anchor: 'end', val: 0, pre: 'MemTable：', suf: ' / 4 条', color: C.amber, size: 16 });
      S.box('cl', { x: 120, y: OY, w: 160, h: 46, fill: C.panel, stroke: C.line, sw: 2, label: '客户端写入' });
      S.box('mt', { x: 470, y: 165, w: 420, h: 100, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
      lbl(S, 'tMT', 276, 133, 'MemTable：按 key 有序，在内存里可以原地改', { size: 14 });
      S.line('div', { x1: 20, y1: 240, x2: 840, y2: 240, stroke: C.line, sw: 1.5, dash: '4 6' });
      lbl(S, 'tMem', 30, 226, '内存 ↑', { size: 14 }); lbl(S, 'tDsk', 30, 256, '磁盘 ↓', { size: 14 });
      S.box('walbox', { x: 500, y: WY, w: 600, h: 48, rx: 8, fill: '#161a33', stroke: C.purple, dash: '6 5' });
      lbl(S, 'tWal', 40, WY - 10, '日志文件', { color: C.purple }); lbl(S, 'tWal2', 40, WY + 12, '只追加', { size: 14 });
      lbl(S, 'tL0', 40, YT - 10, 'Level 0', { color: C.ink }); lbl(S, 'tL0b', 40, YT + 12, '越新越靠上', { size: 14 });
      S.box('sO', { x: 470, y: YT, w: 420, h: 64, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
      ['k2 = p', 'k3 = z', 'k6 = q', 'k9 = r'].forEach(function (t, i) { chip(S, 'so' + i, MX[i], YT, t, { trail: 0 }); });
      lbl(S, 'tO', 694, YT - 10, 'SSTable #1', { color: C.ink }); lbl(S, 'tO2', 694, YT + 12, '不可变', { size: 14 });
      S.box('sN', { x: 470, y: YT, w: 420, h: 64, rx: 10, fill: C.panel, stroke: C.line, sw: 2, opacity: 0 });
      lbl(S, 'tNw', 694, YT - 10, 'SSTable #2', { color: C.ink, opacity: 0 }); lbl(S, 'tNw2', 694, YT + 12, '不可变', { size: 14, opacity: 0 });
      [['o1', 'PUT k3 = a'], ['o2', 'PUT k1 = b'], ['o3', 'PUT k3 = c'], ['o4', 'PUT k7 = d'], ['o5', 'PUT k5 = e']].forEach(function (o) {
        S.box(o[0], { x: OX, y: OY, w: 130, h: 38, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: o[1], color: C.bg, size: 15, opacity: 0, trail: 3 });
      });
      S.data({ MemTable: '（空）', '日志条数': 0, 'Level 0': 'SSTable #1' });

      S.step('PUT(k3, a)：先把这次操作追加到日志文件，再写进内存里的 MemTable', function () {
        S.code([2, 3]); S.log('Put(k3, a)');
        S.pulse('cl', { scale: 1.05 }); op('o1', 'k3 = a', 'k3', 150);
        S.set('o1', { label: 'k3 = a' }, { delay: 1400 });
        S.data({ MemTable: 'k3=a', '日志条数': 1 }, { delay: 2200 });
      });
      S.step('PUT(k1, b)：MemTable 按 key 有序 —— k3 往后让一格，k1 插到前面', function () {
        S.code([2, 3]); S.log('Put(k1, b)');
        S.pulse('cl', { scale: 1.05 }); op('o2', 'k1 = b', 'k1', 150);
        S.set('o2', { label: 'k1 = b' }, { delay: 1400 });
        S.data({ MemTable: 'k1=b, k3=a', '日志条数': 2 }, { delay: 2200 });
      });
      S.step('PUT(k3, c)：k3 已经在 MemTable 里 → 原地把值改掉；日志里照样追加一条', function () {
        S.code([2, 3]); S.log('Put(k3, c)');
        S.pulse('cl', { scale: 1.05 }); S.pop('o3', { delay: 150 }); wal('o3', 'PUT k3', 550);
        S.to('o3', { x: MX[1], y: MY - 2, w: 92, h: 42 }, { delay: 1200, dur: 800 });
        S.set('o1', { label: 'k3 = c' }, { delay: 2000 }); S.flash('o1', C.amber, { delay: 2000 }); S.pulse('o1', { delay: 2000, scale: 1.12 });
        S.hide('o3', { delay: 1950, dur: 150 }); S.pulse('tN', { delay: 2000 });
        S.data({ MemTable: 'k1=b, k3=c', '日志条数': 3 }, { delay: 2000 }); S.log('k3 原地更新：a → c', { delay: 2000, kind: 'ok' });
      });
      S.step('PUT(k7, d)、PUT(k5, e)：k5 插在 k3 和 k7 中间，k7 往后让；MemTable 写满了', function () {
        S.code([2, 3]); S.log('Put(k7, d)');
        S.pulse('cl', { scale: 1.05 }); op('o4', 'k7 = d', 'k7', 100); S.set('o4', { label: 'k7 = d' }, { delay: 1350 });
        S.log('Put(k5, e)', { delay: 2000 }); S.pulse('cl', { delay: 2000, scale: 1.05 });
        op('o5', 'k5 = e', 'k5', 2000); S.set('o5', { label: 'k5 = e' }, { delay: 3250 });
        S.to('mt', { stroke: C.amber }, { delay: 3300, dur: 300 }); S.pulse('tN', { delay: 3300 });
        S.code(4, { delay: 3300 });
        S.data({ MemTable: 'k1=b, k3=c, k5=e, k7=d（满）', '日志条数': 5 }, { delay: 3300 }); S.log('MemTable 满了 → Flush()', { delay: 3350, kind: 'warn' });
      });
      S.step('落盘：按 key 从小到大整批写成一个新的 SSTable；旧的 SSTable 往下让位（越新越靠上）', function () {
        S.code([6, 10]);
        var o = { dur: 700 };
        S.to('sO', { y: YB }, o); S.to('tO', { y: YB - 10 }, o); S.to('tO2', { y: YB + 12 }, o);
        [0, 1, 2, 3].forEach(function (i) { S.to('so' + i, { y: YB }, o); });
        S.pop('sN', { delay: 550 });
        mem.forEach(function (e, j) {
          S.move(e.id, MX[j], YT, { delay: 900 + j * 260, dur: 800 });
          S.ripple(MX[j], YT, { delay: 1700 + j * 260, color: C.cyan });
        });
        S.pop('tNw', { delay: 2500 }); S.pop('tNw2', { delay: 2580 });
        S.data({ 'Level 0': 'SSTable #2（新）, #1' }, { delay: 2500 }); S.log('Flush → SSTable #2：k1 k3 k5 k7', { delay: 2500, kind: 'io' });
      });
      S.step('k3 在日志里出现过两次，但落盘时只写出最新的 k3 = c；SSTable 写完就不再改', function () {
        S.code(9);
        S.flash('w0', C.amber, { hold: 600 }); S.pulse('w0'); S.flash('w2', C.amber, { delay: 250, hold: 600 }); S.pulse('w2', { delay: 250 });
        S.fly('w2', 'o1', { color: C.amber, delay: 700, dur: 700 });
        S.to('o1', { fill: C.green, color: C.bg }, { delay: 1400, dur: 350 }); S.pulse('o1', { delay: 1400, scale: 1.12 });
        S.to('sN', { stroke: C.green }, { delay: 1500, dur: 350 });
        S.flash('so1', C.amber, { delay: 1900, hold: 500 });
        S.log('更旧的 SSTable #1 里还留着 k3 = z', { delay: 1950 });
      });
      S.step('换上一个空的 MemTable，继续接收写入', function () {
        S.code(11);
        S.to('mt', { stroke: C.line }, { dur: 300 }); S.pulse('mt', { scale: 1.04 });
        S.flash('mt', C.green, { prop: 'stroke', delay: 300 });
        S.count('tN', 0, { delay: 200 }); S.pulse('tN', { delay: 200 });
        S.fly('cl', [MX[0], MY], { color: C.green, delay: 600, dur: 700 });
        S.data({ MemTable: '（空）' }, { delay: 300 }); S.log('新的空 MemTable 就绪', { delay: 400, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：读路径与墓碑 ───────────────────────── */
  {
    name: '读：由新到旧 + 墓碑',
    moving: '蓝色游标框从 MemTable 一层层往下滑；小圆点飞去问过滤器；被跳过的文件变暗；命中的条目变绿飞进“返回”槽；墓碑记录飞进 MemTable；读文件次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Value* Get(Key k) {',
      '  Entry* e = memtable.Find(k);   // 最新的在这',
      '  if (e) return e->tomb ? nullptr : &e->val;',
      '  for (SSTable& t : NewestToOldest()) {',
      '    if (!t.bloom.MayContain(k))',
      '      continue;          // 一定没有：跳过',
      '    e = t.Find(k);       // 可能有：读文件',
      '    if (e) return e->tomb ? nullptr : &e->val;',
      '  }',
      '  return nullptr;',
      '}',
      'void Delete(Key k) {     // 不用找旧数据',
      '  memtable.Upsert(k, TOMBSTONE);',
      '}'
    ].join('\n'),
    build: function (S) {
      var RX = 440, EX = [280, 360, 440, 520, 600], RY = [165, 268, 348, 432], BX = 172, TX = 760;
      var ROWS = [['k4'], ['k1', 'k3', 'k5', 'k7'], ['k2', 'k3', 'k6 = v2', 'k9'], ['k1', 'k2', 'k6 = v1', 'k8 = v1', 'k9']];
      S.text('note', { x: 20, y: 24, text: 'key、值、每个文件放几条都是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('tIO', { x: 840, y: 24, anchor: 'end', val: 0, pre: '读 SSTable 文件：', suf: ' 个', color: C.amber, size: 16 });
      S.box('cl', { x: 120, y: 84, w: 160, h: 46, fill: C.panel, stroke: C.line, sw: 2, label: '客户端' });
      S.box('rq', { x: 290, y: 84, w: 130, h: 38, rx: 6, fill: C.blue, stroke: 'none', sw: 0, label: 'Get(k6)', color: C.bg, size: 15, opacity: 0 });
      S.line('div', { x1: 20, y1: 216, x2: 840, y2: 216, stroke: C.line, sw: 1.5, dash: '4 6' });
      lbl(S, 'tMem', 836, 202, '内存 ↑', { size: 14, anchor: 'end' }); lbl(S, 'tDsk', 836, 232, '磁盘 ↓', { size: 14, anchor: 'end' });
      lbl(S, 'l0', 30, RY[0] - 10, 'MemTable', { color: C.ink }); lbl(S, 'l0b', 30, RY[0] + 12, '最新的改动', { size: 14 });
      lbl(S, 'l1', 30, RY[1] - 10, 'Level 0', { color: C.ink }); lbl(S, 'l1b', 30, RY[1] + 12, '较新的文件', { size: 14 });
      lbl(S, 'l2', 30, RY[2] - 10, 'Level 0', { color: C.ink }); lbl(S, 'l2b', 30, RY[2] + 12, '较旧的文件', { size: 14 });
      lbl(S, 'l3', 30, RY[3] - 10, 'Level 1', { color: C.ink }); lbl(S, 'l3b', 30, RY[3] + 12, '最旧', { size: 14 });
      lbl(S, 'tBF', 30, 500, '左侧小方块 = 留在内存里的过滤器（Bloom Filter），查文件前先问它', { size: 14 });
      ROWS.forEach(function (ks, r) {
        S.box('row' + r, { x: RX, y: RY[r], w: 440, h: 60, rx: 10, fill: C.panel, stroke: C.line, sw: 2 });
        if (r) S.box('bf' + r, { x: BX, y: RY[r], w: 76, h: 34, rx: 6, fill: C.cell, stroke: C.purple, label: 'BF', size: 14 });
        ks.forEach(function (k, i) { chip(S, 'e' + r + i, EX[i], RY[r], k, { w: 72, h: 38, size: 14, trail: 0 }); });
      });
      S.text('tRet', { x: TX, y: 262, text: '返回给客户端', color: C.mute });
      S.box('tray', { x: TX, y: 340, w: 150, h: 124, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      S.box('cur', { x: RX, y: RY[0], w: 456, h: 76, rx: 14, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      S.data({ '请求': '—', '读 SSTable 文件': 0 });

      function ask(r, d, ans, col) {             /* 游标滑到第 r 行，圆点飞去问过滤器 */
        S.move('cur', RX, RY[r], { delay: d, dur: 600 });
        S.fly([RX - 110, RY[r]], 'bf' + r, { color: C.blue, delay: d + 550, dur: 450 });
        S.set('bf' + r, { label: ans, color: C.bg }, { delay: d + 1000 }); S.to('bf' + r, { fill: col }, { delay: d + 1000, dur: 250 });
        S.pulse('bf' + r, { delay: d + 1000 });
      }
      S.step('Get(k6)：先查 MemTable —— 最新的改动都在这里。里面只有 k4，没有 k6', function () {
        S.code([2, 3]); S.log('Get(k6)'); S.data({ '请求': 'Get(k6)' });
        S.pulse('cl', { scale: 1.05 }); S.pop('rq', { delay: 150 });
        S.fly('rq', [RX, RY[0] - 38], { color: C.blue, delay: 500, dur: 600 });
        S.pop('cur', { delay: 1050 });
        S.flash('e00', C.red, { delay: 1450 }); S.pulse('e00', { delay: 1450 });
        S.log('MemTable：没有 k6', { delay: 1500 });
      });
      S.step('往下到 Level 0 较新的文件：先问过滤器 —— 它说“一定没有”，整个文件直接跳过，不读盘', function () {
        S.code([4, 6]);
        ask(1, 0, '没有', C.red);
        ['row1', 'e10', 'e11', 'e12', 'e13'].forEach(function (id) { S.to(id, { opacity: .35 }, { delay: 1250, dur: 350 }); });
        S.pulse('tIO', { delay: 1250 });
        S.log('SSTable(较新)：过滤器说没有 → 跳过', { delay: 1050, kind: 'ok' });
      });
      S.step('再往下一个更旧的文件：过滤器说“可能有” → 这才真的读文件，在里面找到 k6', function () {
        S.code([5, 7]);
        ask(2, 0, '可能有', C.amber);
        S.count('tIO', 1, { delay: 1300 }); S.log('SSTable(较旧)：可能有 → 读文件', { delay: 1300, kind: 'io' });
        S.code(7, { delay: 1300 });
        S.flash('e20', C.blue, { delay: 1500, hold: 150, dur: 250 }); S.flash('e21', C.blue, { delay: 1750, hold: 150, dur: 250 });
        S.to('e22', { fill: C.green, color: C.bg }, { delay: 2050, dur: 350 }); S.pulse('e22', { delay: 2050, scale: 1.12 });
        S.ripple(EX[2], RY[2], { delay: 2100, color: C.green });
        S.data({ '读 SSTable 文件': 1 }, { delay: 1300 });
      });
      S.step('找到就返回、不再往下：Level 1 里那个更旧的 k6 = v1 永远轮不到', function () {
        S.code(8);
        S.fly('e22', [TX, 312], { label: 'k6 = v2', w: 120, h: 36, color: C.green, keep: true, dur: 850 });
        S.to('e32', { opacity: .35 }, { delay: 500, dur: 400 }); S.pulse('e32', { delay: 500 });
        S.hide('cur', { delay: 900 }); S.hide('rq', { delay: 900 });
        S.log('Get(k6) → v2，读了 1 个文件', { delay: 900, kind: 'ok' });
      });
      S.step('Delete(k8)：不用去找旧数据在哪，只往 MemTable 里追加一条墓碑记录', function () {
        S.code([12, 14]); S.log('Delete(k8)'); S.data({ '请求': 'Delete(k8)' });
        ['row1', 'e10', 'e11', 'e12', 'e13', 'e32'].forEach(function (id) { S.to(id, { opacity: 1 }, { dur: 350 }); });
        S.to('e22', { fill: PG, color: C.ink }, { dur: 350 });
        S.set('bf1', { label: 'BF', color: C.ink }); S.to('bf1', { fill: C.cell }, { dur: 300 });
        S.set('bf2', { label: 'BF', color: C.ink }); S.to('bf2', { fill: C.cell }, { dur: 300 });
        S.set('rq', { label: 'Delete(k8)', fill: C.red }); S.pop('rq', { delay: 200 }); S.pulse('cl', { scale: 1.05 });
        S.fly('rq', [EX[1], RY[0]], { id: 'tomb', label: 'DEL k8', w: 72, h: 38, color: C.red, keep: true, delay: 700, dur: 850 });
        S.flash('row0', C.red, { prop: 'stroke', delay: 1550 });
        S.hide('rq', { delay: 1000 });
        S.log('MemTable 里多了墓碑 DEL k8', { delay: 1550, kind: 'warn' });
      });
      S.step('Get(k8)：在 MemTable 里先碰到墓碑 → 直接回答“不存在”，根本不用往下查', function () {
        S.code([2, 3]); S.log('Get(k8)'); S.data({ '请求': 'Get(k8)' });
        S.set('rq', { label: 'Get(k8)', fill: C.blue }); S.pop('rq', { delay: 100 });
        S.fly('rq', [RX, RY[0] - 38], { color: C.blue, delay: 450, dur: 600 });
        S.set('cur', { y: RY[0] }); S.pop('cur', { delay: 1000 });
        S.flash('e00', C.blue, { delay: 1350, hold: 150, dur: 250 });
        S.pulse('tomb', { delay: 1650, scale: 1.15 }); S.ripple(EX[1], RY[0], { delay: 1650, color: C.red });
        S.fly('tomb', [TX, 368], { label: 'k8 不存在', w: 120, h: 36, color: C.red, keep: true, delay: 2000, dur: 850 });
        S.pulse('tIO', { delay: 2000 });
        S.log('Get(k8) → 不存在，读了 0 个文件', { delay: 2850, kind: 'ok' });
      });
      S.step('k8 的旧值物理上还躺在 Level 1 的文件里 —— 要等压实（compaction）时才真正清掉', function () {
        S.code(13);
        S.hide('cur'); S.hide('rq');
        S.fly('tomb', 'e33', { color: C.red, delay: 200, dur: 900 });
        S.to('e33', { fill: TOMB }, { delay: 1100, dur: 350 }); S.pulse('e33', { delay: 1100, scale: 1.12 });
        S.flash('row3', C.amber, { prop: 'stroke', delay: 1100, hold: 700 });
        S.log('Level 1 里仍有 k8 = v1（已被墓碑遮住）', { delay: 1150, kind: 'warn' });
      });
    }
  },

  /* ───────────────────────── 场景 3：归并压实 ───────────────────────── */
  {
    name: '压实：归并两个 SSTable',
    moving: '两个游标箭头各自向下走；胜出的记录从 A 或 B 滑进右边的输出文件；key 相同的旧版本变红缩小消失；三个计数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// A 较新，B 较旧；两边都按 key 有序',
      'SSTable Merge(SSTable& A, SSTable& B) {',
      '  auto a = A.begin(), b = B.begin();',
      '  SSTable out;',
      '  while (a != A.end() && b != B.end()) {',
      '    if (a->key < b->key) out.Add(*a++);',
      '    else if (b->key < a->key) out.Add(*b++);',
      '    else {                 // key 相同',
      '      out.Add(*a++);       // 只留新的',
      '      b++;                 // 旧版本丢弃',
      '    }',
      '  }',
      '  while (a != A.end()) out.Add(*a++);',
      '  while (b != B.end()) out.Add(*b++);',
      '  return out;              // 旧文件可删',
      '}'
    ].join('\n'),
    build: function (S) {
      var AX = 180, BX = 440, OX = 700, RY = [134, 198, 262, 326, 390], nOut = 0, nDrop = 0;
      var A = ['DEL 100', 'PUT 101', 'PUT 102', 'DEL 103'], B = ['PUT 101', 'PUT 102', 'PUT 103', 'PUT 104'];
      function col(id, x, o) { S.box(id, mix({ x: x, y: 262, w: 200, h: 320, rx: 12, fill: C.panel, stroke: C.line, sw: 2 }, o)); }
      function take(id, d) {                     /* 胜出的记录滑进输出文件的下一行 */
        S.move(id, OX, RY[nOut], { delay: d, dur: 850 });
        S.ripple(OX, RY[nOut], { delay: d + 850, color: C.green });
        S.count('tOut', ++nOut, { delay: d + 850, dur: 300 });
      }
      function drop(id, d) {                     /* 旧版本：变红、缩小消失 */
        S.to(id, { fill: C.red }, { delay: d, dur: 250 });
        S.to(id, { scale: .2, opacity: 0 }, { delay: d + 350, dur: 450, ease: 'in' });
        S.count('tDrop', ++nDrop, { delay: d + 600, dur: 300 });
      }
      function adv(c, r, d) { S.to(c, { y1: RY[r], y2: RY[r] }, { delay: d, dur: 450 }); }
      function cmp(i, j, col, d) {
        S.flash('a' + i, col, { delay: d, hold: 420 }); S.pulse('a' + i, { delay: d });
        S.flash('b' + j, col, { delay: d + 120, hold: 420 }); S.pulse('b' + j, { delay: d + 120 });
      }
      S.text('note', { x: 20, y: 24, text: '例子与课上相同：100–104 是 key；每个文件 4 条是示意', anchor: 'start', size: 14, color: C.mute });
      S.text('hA', { x: AX, y: 76, text: 'SSTable A（较新）', color: C.ink, weight: 700 });
      S.text('hB', { x: BX, y: 76, text: 'SSTable B（较旧）', color: C.ink, weight: 700 });
      S.text('hO', { x: OX, y: 76, text: '合并出的新 SSTable', color: C.green, weight: 700 });
      col('fA', AX); col('fB', BX); col('fO', OX, { dash: '6 5' });
      B.forEach(function (t, i) { chip(S, 'b' + i, BX, RY[i], t, { w: 160, h: 44, size: 16 }); });
      A.forEach(function (t, i) { chip(S, 'a' + i, AX, RY[i], t, { w: 160, h: 44, size: 16, fill: t.charAt(0) === 'D' ? TOMB : PG }); });
      S.line('ca', { x1: 34, y1: RY[0], x2: 72, y2: RY[0], stroke: C.blue, sw: 4, arrow: true, opacity: 0 });
      S.line('cb', { x1: 292, y1: RY[0], x2: 330, y2: RY[0], stroke: C.blue, sw: 4, arrow: true, opacity: 0 });
      S.text('tIn', { x: AX, y: 478, text: '输入：4 + 4 = 8 条', color: C.mute });
      S.text('tDrop', { x: BX, y: 478, val: 0, pre: '丢弃的旧版本：', suf: ' 条', color: C.red });
      S.text('tOut', { x: OX, y: 478, val: 0, pre: '输出：', suf: ' 条', color: C.green });
      S.data({ 'A 游标': '—', 'B 游标': '—', '输出': 0 });

      S.step('两个游标各自从文件开头出发：A 是较新的 SSTable，B 是较旧的', function () {
        S.code(3); S.log('Merge(A, B)');
        S.set('ca', { x1: 20, x2: 40 }); S.to('ca', { opacity: 1, x1: 34, x2: 72 }, { dur: 500 });
        S.set('cb', { x1: 278, x2: 298 }); S.to('cb', { opacity: 1, x1: 292, x2: 330 }, { delay: 250, dur: 500 });
        S.pulse('a0', { delay: 600 }); S.pulse('b0', { delay: 850 });
        S.data({ 'A 游标': 'DEL 100', 'B 游标': 'PUT 101' }, { delay: 600 });
      });
      S.step('100 比 101 小，而 B 是有序的、后面不可能再有 100 → 直接输出 A 的 DELETE 100', function () {
        S.code(6); cmp(0, 0, C.blue, 0);
        take('a0', 700); adv('ca', 1, 800);
        S.data({ 'A 游标': 'PUT 101', '输出': 1 }, { delay: 1550 }); S.log('100 < 101 → 输出 DEL 100', { delay: 700 });
      });
      S.step('两边都是 101：key 相同只留新的 —— A 的 PUT 101 进输出，B 的旧版本丢弃', function () {
        S.code([8, 10]); cmp(1, 0, C.amber, 0);
        take('a1', 700); drop('b0', 800); adv('ca', 2, 900); adv('cb', 1, 1400);
        S.data({ 'A 游标': 'PUT 102', 'B 游标': 'PUT 102', '输出': 2 }, { delay: 1550 }); S.log('101 = 101 → 留 A 的，丢 B 的', { delay: 700 });
      });
      S.step('102 也一样：留 A 的 PUT 102，丢掉 B 的', function () {
        S.code([8, 10]); cmp(2, 1, C.amber, 0);
        take('a2', 700); drop('b1', 800); adv('ca', 3, 900); adv('cb', 2, 1400);
        S.data({ 'A 游标': 'DEL 103', 'B 游标': 'PUT 103', '输出': 3 }, { delay: 1550 }); S.log('102 = 102 → 留 A 的', { delay: 700 });
      });
      S.step('103：A 这条是 DELETE —— 墓碑也是“最新版本”，照样保留；B 的 PUT 103 丢弃', function () {
        S.code([8, 10]); cmp(3, 2, C.amber, 0);
        take('a3', 700); drop('b2', 800); S.hide('ca', { delay: 1000 }); adv('cb', 3, 1400);
        S.data({ 'A 游标': '（结束）', 'B 游标': 'PUT 104', '输出': 4 }, { delay: 1550 }); S.log('103 = 103 → 留墓碑 DEL 103', { delay: 700, kind: 'warn' });
      });
      S.step('A 走完了：B 剩下的 PUT 104 没人跟它抢，直接抄进输出', function () {
        S.code(14);
        S.flash('b3', C.blue, { hold: 350 }); S.pulse('b3');
        take('b3', 500); S.hide('cb', { delay: 800 });
        S.data({ 'B 游标': '（结束）', '输出': 5 }, { delay: 1350 }); S.log('A 已结束 → 输出 PUT 104', { delay: 500 });
      });
      S.step('输出天然有序，写成一个新的 SSTable；两个旧文件整个删掉 —— 8 条变 5 条', function () {
        S.code(15);
        S.set('fO', { dash: '' }); S.to('fO', { stroke: C.green }, { dur: 350 }); S.pulse('tOut', { delay: 200, scale: 1.2 });
        S.fly([OX - 84, RY[0] - 34], [OX - 84, RY[4] + 34], { color: C.green, delay: 200, dur: 900, ease: 'linear' });
        ['fA', 'fB'].forEach(function (id, i) { S.to(id, { stroke: C.red }, { delay: 900 + i * 200, dur: 250 }); S.to(id, { opacity: .25 }, { delay: 1300 + i * 200, dur: 450 }); });
        S.to('hA', { color: C.mute }, { delay: 1300, dur: 300 }); S.to('hB', { color: C.mute }, { delay: 1500, dur: 300 });
        S.log('新 SSTable：100✗ 101 102 103✗ 104', { delay: 1100, kind: 'ok' }); S.log('删除旧文件 A、B', { delay: 1500 });
      });
    }
  },

  /* ───────────────────────── 场景 4：分层压实 ───────────────────────── */
  {
    name: '分层压实：L0 重叠，L1 不重叠',
    moving: '查询探针沿 key = Q 那条竖线往下长，碰到的文件依次亮起；三个重叠的范围条滑到一起归并，再拉开成两个互不重叠的条落到 Level 1；新落盘的条从上方落下；要查的文件数和读写文件数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// Level 0：范围可重叠，按从新到旧逐个查',
      '// Level 1 起：同一层范围不重叠，至多查一个',
      'Value* Get(Key k) {',
      '  for (SSTable& t : level0.NewestFirst())',
      '    if (t.Covers(k))',
      '      if (Value* v = t.Find(k)) return v;',
      '  for (Level& L : levels_below)',
      '    if (SSTable* t = L.FileCovering(k))',
      '      if (Value* v = t->Find(k)) return v;',
      '  return nullptr;',
      '}',
      'void CompactLevel0() {',
      '  auto in = level0.All();',
      '  in += level1.Overlapping(in); // 下层也读',
      '  level1.Replace(MergeSorted(in)); // 重写',
      '}'
    ].join('\n'),
    build: function (S) {
      var L = 'ABCDEFGHIJKLMNOPQRST', Y0 = [118, 168, 218], YM = 306, Y1 = 404, QX;
      function kx(ch) { return 112 + L.indexOf(ch) * 36; }
      function bx(a, b) { return (kx(a) + kx(b)) / 2; }
      function bwid(a, b) { return kx(b) - kx(a) + 30; }
      function bar(id, a, b, y, o) {
        S.box(id, mix({ x: bx(a, b), y: y, w: bwid(a, b), h: 38, rx: 8, fill: PG, stroke: C.line, sw: 1.5, label: '[ ' + a + ' ~ ' + b + ' ]', size: 16, trail: 2 }, o));
      }
      QX = kx('Q');
      S.text('note', { x: 20, y: 24, text: '例子与课上相同：key 用字母 A–T 表示，横向位置 = key 的大小', anchor: 'start', size: 14, color: C.mute });
      S.text('tCnt', { x: 840, y: 24, anchor: 'end', val: 0, pre: '查 Q 要看的文件：', suf: ' 个', color: C.amber, size: 16 });
      L.split('').forEach(function (ch) { S.text('ax' + ch, { x: kx(ch), y: 72, text: ch, size: 15, color: C.mute }); });
      lbl(S, 'l0', 24, 168, 'Level 0', { color: C.ink });
      lbl(S, 'l1', 24, Y1, 'Level 1', { color: C.ink });
      S.line('sep', { x1: 20, y1: 258, x2: 840, y2: 258, stroke: C.line, sw: 1.5, dash: '4 6' });
      S.line('pr', { x1: QX, y1: 86, x2: QX, y2: 242, stroke: C.blue, sw: 3, dash: '7 5', opacity: 0, draw: 0 });
      bar('b3', 'B', 'Q', Y0[2]); bar('b1', 'A', 'R', Y0[0]); bar('b2', 'E', 'T', Y0[1]);   /* 叠放次序：b3 在最下，b2 在最上 */
      bar('b4', 'C', 'S', 106, { opacity: 0, fill: C.amber, color: C.bg });
      S.text('tRd', { x: 250, y: 492, val: 0, pre: '读回下层文件：', suf: ' 个', color: C.amber, opacity: 0 });
      S.text('tWr', { x: 610, y: 492, val: 0, pre: '重写下层文件：', suf: ' 个', color: C.amber, opacity: 0 });
      S.data({ 'Level 0': '[A~R] [E~T] [B~Q]', 'Level 1': '（空）' });

      S.step('Level 0 的 SSTable 是 MemTable 直接落盘来的：谁也管不了它们的 key 范围，互相重叠', function () {
        S.code(1); S.log('Level 0：3 个文件，范围重叠');
        ['b1', 'b2', 'b3'].forEach(function (id, i) { S.flash(id, C.amber, { prop: 'stroke', delay: i * 300, hold: 500 }); S.pulse(id, { delay: i * 300, scale: 1.04 }); });
        S.fly([kx('E'), 96], [kx('E'), 240], { color: C.amber, delay: 1000, dur: 700, ease: 'linear' });
        S.fly([kx('Q'), 96], [kx('Q'), 240], { color: C.amber, delay: 1200, dur: 700, ease: 'linear' });
      });
      S.step('查 key = Q：三个范围都盖住了 Q → 最坏要把三个文件都查一遍', function () {
        S.code([4, 6]); S.log('Get(Q)');
        S.to('axQ', { color: C.blue }, { dur: 250 }); S.pulse('axQ', { scale: 1.5 });
        S.to('pr', { opacity: 1, draw: 1 }, { delay: 300, dur: 1000, ease: 'linear' });
        ['b1', 'b2', 'b3'].forEach(function (id, i) {
          var d = 300 + (Y0[i] - 86) / 156 * 1000;
          S.to(id, { stroke: C.amber }, { delay: d, dur: 200 }); S.flash(id, C.amber, { delay: d, hold: 300 }); S.pulse(id, { delay: d, scale: 1.04 });
          S.count('tCnt', i + 1, { delay: d, dur: 250 });
        });
        S.log('Level 0：3 个文件都可能有 Q', { delay: 1300, kind: 'warn' }); S.data({ '查 Q 要看': '3 个文件' }, { delay: 1300 });
      });
      S.step('压实：把这几个范围重叠的文件读进来做归并（就是上一个场景的算法）', function () {
        S.code([12, 13]); S.log('CompactLevel0()');
        S.to('pr', { draw: 0, opacity: 0 }, { dur: 350 }); S.to('axQ', { color: C.mute }, { dur: 300 });
        ['b1', 'b2', 'b3'].forEach(function (id, i) {
          S.to(id, { y: YM, stroke: C.amber }, { delay: 300 + i * 150, dur: 750 });
          S.set(id, { label: '' }, { delay: 1300 });
          S.to(id, { x: bx('A', 'T'), w: bwid('A', 'T'), fill: '#5a4a1c' }, { delay: 1300, dur: 500 });
        });
        S.set('b2', { label: '归并中：A ~ T' }, { delay: 1500 }); S.set('b3', { opacity: 0 }, { delay: 1800 });
        S.ripple(bx('A', 'T'), YM, { delay: 1800, color: C.amber });
      });
      S.step('再按 key 切成互不重叠的文件写进 Level 1：[A ~ K] 和 [L ~ T]', function () {
        S.code(15);
        S.to('b1', { x: bx('A', 'K'), w: bwid('A', 'K') }, { dur: 600 }); S.to('b2', { x: bx('L', 'T'), w: bwid('L', 'T') }, { dur: 600 });
        S.set('b1', { label: '[ A ~ K ]' }, { delay: 300 }); S.set('b2', { label: '[ L ~ T ]' }, { delay: 300 });
        S.to('b1', { y: Y1 }, { delay: 700, dur: 700 }); S.to('b2', { y: Y1 }, { delay: 850, dur: 700 });
        S.to('b1', { fill: PG, stroke: C.green }, { delay: 1400, dur: 350 }); S.to('b2', { fill: PG, stroke: C.green }, { delay: 1550, dur: 350 });
        S.ripple(bx('A', 'K'), Y1, { delay: 1400, color: C.green }); S.ripple(bx('L', 'T'), Y1, { delay: 1550, color: C.green });
        S.data({ 'Level 0': '（空）', 'Level 1': '[A~K] [L~T]', '查 Q 要看': null }, { delay: 1500 }); S.log('Level 1：[A~K] [L~T]，互不重叠', { delay: 1550, kind: 'ok' });
      });
      S.step('再查 key = Q：Level 1 里只有 [L ~ T] 可能有它 → 只读一个文件', function () {
        S.code([7, 9]); S.log('Get(Q)');
        S.to('axQ', { color: C.blue }, { dur: 250 }); S.pulse('axQ', { scale: 1.5 });
        S.set('pr', { y2: Y1 - 22 }); S.to('pr', { opacity: 1, draw: 1 }, { delay: 300, dur: 1000, ease: 'linear' });
        S.flash('b2', C.green, { delay: 1300, hold: 500 }); S.pulse('b2', { delay: 1300, scale: 1.05 });
        S.flash('b1', C.cell, { delay: 1300, hold: 500 });
        S.count('tCnt', 1, { delay: 1300, dur: 500 }); S.pulse('tCnt', { delay: 1300 });
        S.log('Level 1：只有 [L~T] 盖住 Q', { delay: 1350, kind: 'ok' }); S.data({ '查 Q 要看': '1 个文件' }, { delay: 1350 });
      });
      S.step('新的 MemTable 又落盘到 Level 0：[C ~ S] —— 它和下层两个文件都有重叠', function () {
        S.code(14); S.log('Flush → Level 0：[C~S]', { kind: 'io' });
        S.to('pr', { draw: 0, opacity: 0 }, { dur: 350 }); S.to('axQ', { color: C.mute }, { dur: 300 });
        S.pop('b4', { delay: 300 }); S.to('b4', { y: Y0[1] }, { delay: 700, dur: 650, ease: 'in' });
        S.ripple(bx('C', 'S'), Y0[1], { delay: 1350, color: C.amber });
        S.fly([kx('C'), Y0[1] + 20], [kx('C'), Y1 - 20], { color: C.amber, delay: 1500, dur: 700 });
        S.fly([kx('S'), Y0[1] + 20], [kx('S'), Y1 - 20], { color: C.amber, delay: 1650, dur: 700 });
        S.to('b1', { stroke: C.amber }, { delay: 2200, dur: 250 }); S.to('b2', { stroke: C.amber }, { delay: 2350, dur: 250 });
        S.data({ 'Level 0': '[C~S]' }, { delay: 1350 });
      });
      S.step('要保持 Level 1 不重叠，只能把下层这两个文件都读进来、归并后整层重写 —— 这就是写放大', function () {
        S.code([13, 15]); S.log('CompactLevel0()');
        S.pop('tRd'); S.pop('tWr', { delay: 100 });
        S.to('b1', { y: YM }, { delay: 200, dur: 700 }); S.to('b2', { y: YM }, { delay: 350, dur: 700 });
        S.count('tRd', 2, { delay: 400, dur: 600 });
        S.to('b4', { y: YM, fill: '#5a4a1c', color: C.ink }, { delay: 500, dur: 700 });
        S.set('b4', { label: '' }, { delay: 1200 }); S.hide('b4', { delay: 1250, dur: 250 });
        S.to('b1', { fill: '#5a4a1c' }, { delay: 1200, dur: 300 }); S.to('b2', { fill: '#5a4a1c' }, { delay: 1200, dur: 300 });
        S.ripple(bx('A', 'T'), YM, { delay: 1300, color: C.amber });
        S.to('b1', { y: Y1 }, { delay: 1900, dur: 700 }); S.to('b2', { y: Y1 }, { delay: 2050, dur: 700 });
        S.to('b1', { fill: PG, stroke: C.green }, { delay: 2600, dur: 350 }); S.to('b2', { fill: PG, stroke: C.green }, { delay: 2750, dur: 350 });
        S.count('tWr', 2, { delay: 2000, dur: 600 });
        S.data({ 'Level 0': '（空）', '读回下层': '2 个文件', '重写下层': '2 个文件' }, { delay: 2600 });
        S.log('若 Level 1 有 10 GB：可能读 10 GB、写 10 GB', { delay: 2650, kind: 'warn' });
      });
    }
  }
  ]
});
})();
