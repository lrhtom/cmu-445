/* #13 算子处理模型：迭代器（火山）/ 物化 / 向量化（批）
 * 计划形状同笔记第 1 节的例图：投影 ← 哈希连接 ←（扫描 R ｜ 过滤 ← 扫描 S）。表里的元组和批大小是示意值。 */
(function () {
var C = Viz.C, KEY = '#2b4172';
function mk(S, type, id, base, o) { for (var k in o) base[k] = o[k]; S[type](id, base); }
function node(S, id, x, y, w, label, o) {
  mk(S, 'box', id, { x: x, y: y, w: w, h: 46, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: label, size: 16 }, o);
}
function lab(S, id, x, y, text, o) {
  mk(S, 'text', id, { x: x, y: y, text: text, anchor: 'start', color: C.mute, size: 15 }, o);
}
/* 调用沿这些线段向下传：父节点底边 → 子节点顶边 */
var CALL = { 'eng>pi': [[268, 88], [318, 88]], 'pi>jn': [[400, 111], [400, 173]], 'jn>sr': [[350, 219], [225, 293]], 'jn>fl': [[450, 219], [575, 293]], 'fl>ss': [[590, 339], [590, 413]] };

function tree(S, o) {
  S.text('note', { x: 20, y: 24, text: o.note, anchor: 'start', size: 14, color: C.mute });
  S.text('tN', { x: 840, y: 24, anchor: 'end', val: 0, pre: o.fn + ' 调用 ', suf: ' 次', color: C.amber, size: 16 });
  S.line('e_pj', { x1: 400, y1: 111, x2: 400, y2: 173 }); S.line('e_jr', { x1: 350, y1: 219, x2: 225, y2: 293, opacity: o.dimR ? .5 : 1 });
  S.line('e_jf', { x1: 450, y1: 219, x2: 575, y2: 293 }); S.line('e_fs', { x1: 590, y1: 339, x2: 590, y2: 413 });
  S.line('e_st', { x1: 590, y1: 459, x2: 590, y2: 497, dash: '4 4' });
  S.line('e_ht', { x1: 236, y1: 196, x2: 304, y2: 196, dash: '4 4' });
  S.line('e_en', { x1: 268, y1: 88, x2: 313, y2: 88, stroke: C.purple, arrow: true });
  S.line('e_out', { x1: 487, y1: 88, x2: 548, y2: 88, arrow: true });
  S.box('eng', { x: 215, y: 88, w: 104, h: 38, rx: 19, fill: 'none', stroke: C.purple, sw: 2, label: '引擎', color: C.purple, size: 15 });
  S.box('ht', { x: 140, y: 196, w: 190, h: 54, rx: 10, fill: 'none', stroke: C.line, sw: 2, dash: '6 5' });
  S.text('lht', { x: 140, y: 154, text: '哈希表（build 侧）', color: C.mute });
  S.text('lout', { x: 580, y: 88, text: '输出', color: C.mute });
  S.box('tray', { x: 720, y: o.trayY || 88, w: 220, h: o.trayH || 56, rx: 10, fill: C.panel, stroke: C.line, sw: 2, dash: '6 5' });
  node(S, 'pi', 400, 88, 170, 'π 投影'); node(S, 'jn', 400, 196, 190, '⋈ 哈希连接');
  node(S, 'sr', 210, 316, 150, '扫描 R', { opacity: o.dimR ? .5 : 1 }); node(S, 'fl', 590, 316, 190, 'σ 过滤 value > 100'); node(S, 'ss', 590, 436, 150, '扫描 S');
  lab(S, 'lp1', 58, 316, '流水线 ①'); lab(S, 'lp2', 700, 316, '流水线 ②');
}
function chip(S, id, x, y, w, label, o) {
  mk(S, 'box', id, { x: x, y: y, w: w, h: 34, rx: 6, fill: KEY, stroke: 'none', sw: 0, label: label, size: 14, trail: 3 }, o);
}

Viz.register('opmodel', {
  title: '算子处理模型：迭代器 · 物化 · 向量化',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #13 查询执行 I（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/13-queryexecution1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #13 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/13-queryexecution1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Project #3 查询执行', u: 'https://15445.courses.cs.cmu.edu/fall2025/project3/' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：迭代器模型 ───────────────────────── */
  {
    name: '迭代器（火山）模型',
    moving: '紫色的 Next() 调用包沿计划树向下飞；元组一条一条沿原路向上流，穿过每个算子；被过滤掉的变红掉落；null 逐层上传；调用次数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Tuple* Projection::Next() {        // 根',
      '  Tuple* t = child->Next();',
      '  return t ? Project(t) : nullptr;',
      '}',
      'Tuple* HashJoin::Next() {',
      '  while (!built) {                 // 流水线 1',
      '    Tuple* r = left->Next();',
      '    if (r) ht.Insert(r); else built = true;',
      '  }',
      '  while (Tuple* s = right->Next()) // 流水线 2',
      '    if (ht.Probe(s)) return Join(s);',
      '  return nullptr;                  // EOF',
      '}',
      'Tuple* Filter::Next() {',
      '  while (Tuple* t = child->Next())',
      '    if (pred(t)) return t;',
      '  return nullptr;',
      '}'
    ].join('\n'),
    build: function (S) {
      var n = 0, Sd = [[2, 150], [3, 50], [1, 300]], nOut = 0;
      tree(S, { note: 'R、S 各 3 条元组 —— 示意值；计划形状同笔记第 1 节的例图', fn: 'Next()' });
      S.line('e_rt', { x1: 210, y1: 339, x2: 210, y2: 398, dash: '4 4' });
      S.text('lRt', { x: 210, y: 458, text: '表 R（id）', color: C.mute });
      lab(S, 'lSt', 706, 516, '表 S（id · value）');
      [1, 2, 3].forEach(function (v, i) { chip(S, 'r' + i, 150 + i * 60, 418, 50, String(v), { size: 16 }); });
      Sd.forEach(function (d, i) { chip(S, 's' + i, 520 + i * 70, 516, 64, d[0] + ' · ' + d[1]); });
      S.data({ 'Next() 调用': 0, '哈希表': '空', '输出条数': 0 });

      function call(t, a, b) {
        var e = CALL[a + '>' + b];
        S.fly(e[0], e[1], { label: 'Next()', w: 68, h: 26, size: 14, color: C.purple, delay: t, dur: 420, ripple: false });
        S.flash(b, C.purple, { prop: 'stroke', delay: t + 380 });
        S.count('tN', ++n, { delay: t + 200, dur: 250 }); S.data({ 'Next() 调用': n }, { delay: t + 200 });
        return t + 480;
      }
      function chain(t, names) { for (var i = 0; i + 1 < names.length; i++) t = call(t, names[i], names[i + 1]); return t; }
      function nul(t, child, parent) {      /* null 从 child 返回给 parent */
        var e = CALL[parent + '>' + child];
        S.fly(e[1], e[0], { label: 'null', w: 52, h: 26, size: 14, color: C.red, ink: C.white, delay: t, dur: 420, ripple: false });
        return t + 480;
      }
      function rUp(t, i) {                  /* R 的一条元组：表 → 扫描 R → 连接 → 哈希表 */
        var id = 'r' + i, hx = 84 + i * 56;
        S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 150 });
        S.move(id, 210, 316, { delay: t, dur: 420 }); S.pulse('sr', { delay: t + 420, scale: 1.06 });
        S.move(id, 400, 196, { delay: t + 440, dur: 500 }); S.pulse('jn', { delay: t + 940, scale: 1.06 });
        S.move(id, hx, 196, { delay: t + 960, dur: 460 });
        S.to(id, { fill: KEY, color: C.ink }, { delay: t + 1420, dur: 200 }); S.ripple(hx, 196, { delay: t + 1420, color: C.green });
        S.data({ '哈希表': '{' + [1, 2, 3].slice(0, i + 1).join(', ') + '}' }, { delay: t + 1420 });
        return t + 1500;
      }
      function sToFilter(t, i) {            /* S 的一条元组：表 → 扫描 S → 过滤 */
        var id = 's' + i;
        S.to(id, { fill: C.cyan, color: C.bg }, { delay: t, dur: 150 });
        S.move(id, 590, 436, { delay: t, dur: 400 }); S.pulse('ss', { delay: t + 400, scale: 1.06 });
        S.move(id, 590, 316, { delay: t + 420, dur: 420 });
        return t + 860;
      }
      function sPass(t, i) {                /* 过滤通过 → 探测命中 → 投影 → 输出 */
        var id = 's' + i, hit = 'r' + (Sd[i][0] - 1), ox = 670 + nOut * 100;
        S.flash('fl', C.green, { prop: 'stroke', delay: t }); S.pulse('fl', { delay: t, scale: 1.05 });
        S.move(id, 400, 196, { delay: t + 250, dur: 500 }); S.pulse('jn', { delay: t + 750, scale: 1.06 });
        S.flash(hit, C.green, { delay: t + 750 }); S.pulse(hit, { delay: t + 750 });
        S.move(id, 400, 88, { delay: t + 950, dur: 420 }); S.pulse('pi', { delay: t + 1370, scale: 1.06 });
        S.move(id, ox, 88, { delay: t + 1400, dur: 480 });
        S.to(id, { fill: C.green }, { delay: t + 1880, dur: 200 }); S.ripple(ox, 88, { delay: t + 1880, color: C.green });
        S.data({ '输出条数': ++nOut }, { delay: t + 1880 }); S.log('输出 (id=' + Sd[i][0] + ')', { delay: t + 1880, kind: 'ok' });
        return t + 1950;
      }

      S.step('运行时引擎在根节点调一次 Next()，这个调用一路向下渗透到哈希连接', function () {
        S.code([1, 2]); S.log('引擎 → 根.Next()');
        chain(200, ['eng', 'pi', 'jn']);
      });
      S.step('哈希连接先跑 build：对左孩子调 Next()，扫描 R 交回【一条】元组，放进哈希表', function () {
        S.code([6, 8]); S.to('lp1', { color: C.amber }, { dur: 300 });
        var t = call(0, 'jn', 'sr'); rUp(t, 0); S.log('build：拿到 R 的第 1 条', { delay: t });
      });
      S.step('一次 Next() 只拿回一条。再调、再拿 …… 直到左孩子返回 null', function () {
        S.code([6, 8]);
        var t = call(0, 'jn', 'sr'); t = rUp(t, 1);
        t = call(t - 300, 'jn', 'sr'); t = rUp(t, 2);
        t = call(t - 300, 'jn', 'sr'); nul(t, 'sr', 'jn');
        S.log('扫描 R 返回 null（EOF）', { delay: t, kind: 'warn' });
      });
      S.step('哈希表建完（流水线 ① 结束），才轮到右边：Next() 经过滤一路传到扫描 S', function () {
        S.code([10, 11]); S.to('lp1', { color: C.mute }, { dur: 300 }); S.to('lp2', { color: C.amber }, { delay: 300, dur: 300 });
        S.flash('ht', C.green, { prop: 'stroke' }); S.to('sr', { opacity: .5 }, { dur: 400 }); S.to('e_jr', { opacity: .5 }, { dur: 400 });
        var t = call(500, 'jn', 'fl'); S.code([15, 16], { delay: t }); call(t, 'fl', 'ss');
        S.log('build 完成，开始 probe', { delay: 100, kind: 'ok' });
      });
      S.step('S 的第一条元组向上冒：过滤通过 → 探测命中 → 投影 → 输出。一条元组一路流到顶', function () {
        S.code([16, 17]);
        var t = sToFilter(0, 0); S.code([10, 11], { delay: t + 300 }); S.code(3, { delay: t + 1000 }); sPass(t, 0);
      });
      S.step('引擎要下一条，调用又一路传到底；可这次的元组 value = 50，被过滤挡掉了', function () {
        S.code([1, 2]);
        var t = chain(0, ['eng', 'pi', 'jn', 'fl', 'ss']); S.code([15, 16], { delay: t });
        t = sToFilter(t, 1);
        S.flash('fl', C.red, { prop: 'stroke', delay: t }); S.to('s1', { fill: C.red, color: C.white }, { delay: t, dur: 200 });
        S.to('s1', { x: 730, y: 372, opacity: 0, scale: .4 }, { delay: t + 350, dur: 550, ease: 'in' });
        S.log('value = 50 ≤ 100 → 丢弃', { delay: t, kind: 'err' });
      });
      S.step('过滤手里没东西可交，只好自己再向下调一次 Next()；这一条通过，一路流到顶', function () {
        S.code([15, 16]);
        var t = call(0, 'fl', 'ss'); t = sToFilter(t, 2); S.code([10, 11], { delay: t + 300 }); S.code(3, { delay: t + 1000 }); sPass(t, 2);
      });
      S.step('引擎再要一条：扫描 S 返回 null，null 一层层向上传，查询结束', function () {
        S.code([1, 2]);
        var t = chain(0, ['eng', 'pi', 'jn', 'fl', 'ss']);
        S.code(17, { delay: t }); t = nul(t, 'ss', 'fl'); S.code(12, { delay: t }); t = nul(t, 'fl', 'jn');
        S.code(3, { delay: t }); t = nul(t, 'jn', 'pi'); nul(t, 'pi', 'eng');
        S.log('根返回 null → 查询结束', { delay: t + 400, kind: 'ok' });
      });
      S.step('只输出 2 条元组，却调了 17 次 Next() —— 十亿条元组就是十亿次起步的函数调用', function () {
        S.code([1, 3]); S.to('lp2', { color: C.mute }, { dur: 300 });
        S.pulse('tN', { scale: 1.25 }); S.flash('tray', C.green, { prop: 'stroke', delay: 300 });
        S.log('共 17 次 Next()，输出 2 条', { delay: 200, kind: 'warn' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 2：物化模型 ───────────────────────── */
  {
    name: '物化模型',
    moving: 'Output() 调用包只向下飞一轮；每个算子的全部结果装进一个输出缓冲区整体上移；被过滤掉的变红掉落；最后过滤节点滑下去和扫描 S 融合',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 物化模型：一次把全部元组交上去',
      'vector<Tuple> Filter::Output() {',
      '  vector<Tuple> out;',
      '  for (Tuple& t : child->Output())  // 全部',
      '    if (pred(t)) out.push_back(t);',
      '  return out;               // 一次性返回',
      '}',
      'vector<Tuple> HashJoin::Output() {',
      '  for (Tuple& r : left->Output())',
      '    ht.Insert(r);',
      '  vector<Tuple> out;',
      '  for (Tuple& s : right->Output())',
      '    if (ht.Probe(s)) out.push_back(Join(s));',
      '  return out;',
      '}',
      '// 每个算子的 Output() 只被调用一次'
    ].join('\n'),
    build: function (S) {
      var n = 0, Sd = [[2, 150], [3, 50], [1, 300]];
      tree(S, { note: 'R、S 各 3 条元组 —— 示意值；虚线框 = 算子物化出来的输出缓冲区', fn: 'Output()' });
      S.line('e_rt', { x1: 210, y1: 339, x2: 210, y2: 398, dash: '4 4' });
      S.text('lRt', { x: 210, y: 458, text: '表 R（id）', color: C.mute });
      lab(S, 'lSt', 706, 516, '表 S（id · value）');
      [['ob_sr', 288, 256, 180], ['ob_ss', 590, 376, 224], ['ob_fl', 512, 256, 156], ['ob_jn', 400, 142, 156]].forEach(function (b) {
        S.box(b[0], { x: b[1], y: b[2], w: b[3], h: 46, rx: 9, fill: C.bg, stroke: C.amber, sw: 2, dash: '5 4', opacity: 0 });
      });
      [1, 2, 3].forEach(function (v, i) { chip(S, 'r' + i, 150 + i * 60, 418, 50, String(v), { size: 16 }); });
      Sd.forEach(function (d, i) { chip(S, 's' + i, 520 + i * 70, 516, 64, d[0] + ' · ' + d[1]); });
      S.data({ 'Output() 调用': 0, '哈希表': '空', '输出条数': 0 });

      function call(t, a, b) {
        var e = CALL[a + '>' + b];
        S.fly(e[0], e[1], { label: 'Output()', w: 84, h: 26, size: 14, color: C.purple, delay: t, dur: 420, ripple: false });
        S.flash(b, C.purple, { prop: 'stroke', delay: t + 380 });
        S.count('tN', ++n, { delay: t + 200, dur: 250 }); S.data({ 'Output() 调用': n }, { delay: t + 200 });
        return t + 480;
      }

      S.step('引擎调根的 Output()；每个算子都先向孩子要【全部】结果，调用一路传到扫描 R', function () {
        S.code([8, 9]); S.log('引擎 → 根.Output()');
        var t = call(200, 'eng', 'pi'); t = call(t, 'pi', 'jn'); call(t, 'jn', 'sr');
      });
      S.step('扫描 R 把整张表读完，全部元组装进输出缓冲区，一次性交上去', function () {
        S.code(9); S.log('扫描 R 物化 3 条');
        S.pulse('sr', { scale: 1.06 }); S.pop('ob_sr', { delay: 200 });
        [0, 1, 2].forEach(function (i) {
          S.to('r' + i, { fill: C.cyan, color: C.bg }, { delay: i * 90, dur: 150 });
          S.move('r' + i, 288 + (i - 1) * 56, 256, { delay: 150 + i * 90, dur: 650 });
        });
        S.flash('ob_sr', C.cyan, { prop: 'stroke', delay: 1000 });
      });
      S.step('连接拿到整批 R，一口气把哈希表建完', function () {
        S.code([9, 10]);
        [0, 1, 2].forEach(function (i) {
          S.move('r' + i, 84 + i * 56, 196, { delay: i * 90, dur: 650 });
          S.to('r' + i, { fill: KEY, color: C.ink }, { delay: 700 + i * 90, dur: 200 });
        });
        S.hide('ob_sr', { delay: 300 }); S.flash('ht', C.green, { prop: 'stroke', delay: 900 }); S.ripple(140, 196, { delay: 900, color: C.green });
        S.to('sr', { opacity: .5 }, { delay: 900, dur: 400 }); S.to('e_jr', { opacity: .5 }, { delay: 900, dur: 400 });
        S.data({ '哈希表': '{1, 2, 3}' }, { delay: 900 }); S.log('哈希表建好：3 条', { delay: 900, kind: 'ok' });
      });
      S.step('接着向右孩子要全部结果：Output() 经过滤传到扫描 S，扫描 S 同样一次交出全部 3 条', function () {
        S.code([12, 12]);
        var t = call(0, 'jn', 'fl'); S.code(4, { delay: t }); t = call(t, 'fl', 'ss');
        S.pulse('ss', { delay: t, scale: 1.06 }); S.pop('ob_ss', { delay: t + 100 });
        [0, 1, 2].forEach(function (i) {
          S.to('s' + i, { fill: C.cyan, color: C.bg }, { delay: t + i * 90, dur: 150 });
          S.move('s' + i, 590 + (i - 1) * 70, 376, { delay: t + 150 + i * 90, dur: 650 });
        });
        S.log('扫描 S 物化 3 条', { delay: t });
      });
      S.step('过滤把整批处理完，只留下通过的 2 条，装进自己的输出缓冲区再一次性交给连接', function () {
        S.code([4, 6]);
        S.flash('fl', C.blue, { prop: 'stroke' }); S.pulse('fl', { scale: 1.05 });
        S.to('s1', { fill: C.red, color: C.white }, { delay: 350, dur: 200 });
        S.to('s1', { y: 452, x: 730, opacity: 0, scale: .4 }, { delay: 750, dur: 550, ease: 'in' });
        S.log('3 · 50 不满足 value > 100 → 丢弃', { delay: 350, kind: 'err' });
        S.pop('ob_fl', { delay: 900 }); S.hide('ob_ss', { delay: 1100 });
        S.move('s0', 477, 256, { delay: 1000, dur: 700 }); S.move('s2', 547, 256, { delay: 1090, dur: 700 });
      });
      S.step('探测、投影同理：每一步都是整批交接，最后结果一次性返回给引擎', function () {
        S.code([12, 14]);
        S.pop('ob_jn', { delay: 100 }); S.hide('ob_fl', { delay: 400 });
        S.move('s0', 365, 142, { delay: 200, dur: 650 }); S.move('s2', 435, 142, { delay: 290, dur: 650 });
        S.flash('r1', C.green, { delay: 500 }); S.flash('r0', C.green, { delay: 600 }); S.pulse('jn', { delay: 500, scale: 1.05 });
        S.pulse('pi', { delay: 1300, scale: 1.06 }); S.hide('ob_jn', { delay: 1500 });
        S.move('s0', 670, 88, { delay: 1300, dur: 700 }); S.move('s2', 770, 88, { delay: 1390, dur: 700 });
        S.to('s0', { fill: C.green }, { delay: 2000, dur: 200 }); S.to('s2', { fill: C.green }, { delay: 2090, dur: 200 });
        S.ripple(720, 88, { delay: 2090, color: C.green, r: 50 });
        S.data({ '输出条数': 2 }, { delay: 2090 }); S.log('一次性返回 2 条', { delay: 2090, kind: 'ok' });
      });
      S.step('每个算子只被调用一次：一共 5 次调用（同一个查询，迭代器模型要 17 次）', function () {
        S.code(16); S.pulse('tN', { scale: 1.25 });
        ['pi', 'jn', 'sr', 'fl', 'ss'].forEach(function (id, i) { S.flash(id, C.green, { prop: 'stroke', delay: 200 + i * 150 }); });
        S.log('共 5 次 Output()', { delay: 200, kind: 'ok' });
      });
      S.step('缓解手段 · 算子融合：把过滤塞进扫描 S，不合格的元组根本不往上传', function () {
        S.code([2, 5]); S.log('算子融合：过滤 + 扫描 S');
        S.to('fl', { stroke: C.amber }, { dur: 250 });
        S.move('fl', 590, 436, { delay: 300, dur: 800 }); S.to('fl', { opacity: 0 }, { delay: 850, dur: 300 });
        S.to('e_fs', { draw: 0, opacity: 0 }, { delay: 300, dur: 600 });
        S.to('e_jf', { y2: 413 }, { delay: 300, dur: 800 }); S.to('lp2', { y: 436, x: 706 }, { delay: 300, dur: 800 });
        S.to('ss', { w: 196, stroke: C.green }, { delay: 900, dur: 400 }); S.set('ss', { label: '扫描 S + 过滤' }, { delay: 1000 });
        S.pulse('ss', { delay: 1100 }); S.ripple(590, 436, { delay: 1100, color: C.green, r: 60 });
        S.hide('lSt', { delay: 300 });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 3：向量化模型 ───────────────────────── */
  {
    name: '向量化（批）模型',
    moving: 'Next() 调用包向下飞；元组逐条滑进批缓冲框，攒满后整框沿计划树上移；过滤时整批同时变色，不合格的掉落、其余靠拢、框跟着缩短',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 向量化 / 批模型：Next() 一次交回一批',
      'Batch SeqScan::Next() {',
      '  Batch out;',
      '  while (Tuple* t = NextTuple()) {',
      '    out.Add(t);',
      '    if (out.size >= N) break;   // 攒满一批',
      '  }',
      '  return out;                   // 空批 = EOF',
      '}',
      'Batch Filter::Next() {',
      '  Batch out;',
      '  while (Batch in = child->Next()) {',
      '    for (Tuple& t : in)         // 紧凑循环',
      '      if (pred(t)) out.Add(t);',
      '    if (!out.Empty()) break;    // 不满也交',
      '  }',
      '  return out;',
      '}'
    ].join('\n'),
    build: function (S) {
      var n = 0, Sd = [[2, 150], [3, 50], [1, 300], [2, 120], [3, 90], [1, 200], [2, 80], [3, 400]], A = [590, 376], B = [512, 256], Cc = [400, 142], nOut = 0;
      tree(S, { note: '批大小 N = 4、S 共 8 条 —— 示意值；真实系统的 N 通常是 1024', fn: 'Next()', trayY: 100, trayH: 100, dimR: true });
      S.text('lR0', { x: 210, y: 360, text: '（已扫完，哈希表已建好）', color: C.mute, size: 14 });
      S.text('lSt', { x: 332, y: 516, text: '表 S（id · value）', anchor: 'end', color: C.mute });
      S.box('bf', { x: A[0], y: A[1], w: 262, h: 48, rx: 9, fill: C.bg, stroke: C.cyan, sw: 2, dash: '5 4', opacity: 0 });
      S.text('bfT', { x: A[0] + 150, y: A[1], text: '', anchor: 'start', color: C.cyan, size: 15 });
      [1, 2, 3].forEach(function (v, i) { chip(S, 'r' + i, 84 + i * 56, 196, 50, String(v), { size: 16 }); });
      Sd.forEach(function (d, i) { chip(S, 's' + i, 373 + i * 62, 516, 56, d[0] + '·' + d[1]); });
      S.data({ 'Next() 调用': 0, '当前批': '—', '输出条数': 0 });

      function call(t, a, b) {
        var e = CALL[a + '>' + b];
        S.fly(e[0], e[1], { label: 'Next()', w: 68, h: 26, size: 14, color: C.purple, delay: t, dur: 400, ripple: false });
        S.flash(b, C.purple, { prop: 'stroke', delay: t + 360 });
        S.count('tN', ++n, { delay: t + 200, dur: 250 }); S.data({ 'Next() 调用': n }, { delay: t + 200 });
        return t + 440;
      }
      function round(t) { ['eng', 'pi', 'jn', 'fl', 'ss'].forEach(function (a, i, arr) { if (i + 1 < arr.length) t = call(t, a, arr[i + 1]); }); return t; }
      function bx(c, k, m) { return c[0] + (k - (m - 1) / 2) * 62; }
      function fill(t, ids) {               /* 扫描 S 往批缓冲里攒元组 */
        S.set('bf', { x: A[0], y: A[1], w: 262 }, { delay: t }); S.pop('bf', { delay: t });
        S.set('bfT', { x: A[0] + 142, y: A[1], text: '0 / 4', opacity: 1 }, { delay: t });
        ids.forEach(function (i, k) {
          var d = t + 250 + k * 300;
          S.to('s' + i, { fill: C.cyan, color: C.bg }, { delay: d, dur: 150 });
          S.move('s' + i, bx(A, k, 4), A[1], { delay: d, dur: 520 });
          S.set('bfT', { text: (k + 1) + ' / 4' }, { delay: d + 520 });
        });
        S.flash('bf', C.green, { prop: 'stroke', delay: t + 1750 }); S.pulse('ss', { delay: t + 250, scale: 1.05 });
        S.data({ '当前批': '4 / 4（满）' }, { delay: t + 1700 });
        return t + 1900;
      }
      function shift(t, ids, c, dur) {      /* 整批（框 + 里面的元组）一起移到 c */
        S.move('bf', c[0], c[1], { delay: t, dur: dur }); S.to('bfT', { opacity: 0 }, { delay: t, dur: 150 });
        ids.forEach(function (i, k) { S.move('s' + i, bx(c, k, ids.length), c[1], { delay: t + k * 30, dur: dur }); });
        return t + dur + 100;
      }
      function simd(t, ids, bad) {          /* 一条指令同时比较整批：全部同时变色 */
        S.flash('fl', C.blue, { prop: 'stroke', delay: t }); S.pulse('fl', { delay: t, scale: 1.05 });
        ids.forEach(function (i) {
          var no = bad.indexOf(i) >= 0;
          S.to('s' + i, { fill: no ? C.red : C.green, color: no ? C.white : C.bg }, { delay: t + 300, dur: 250 }); S.pulse('s' + i, { delay: t + 300 });
        });
        return t + 900;
      }
      function compact(t, ids, bad) {       /* 不合格的掉落，其余靠拢，框缩短 */
        var keep = ids.filter(function (i) { return bad.indexOf(i) < 0; });
        bad.forEach(function (i, k) { S.to('s' + i, { y: B[1] + 70, opacity: 0, scale: .4 }, { delay: t + k * 100, dur: 500, ease: 'in' }); });
        keep.forEach(function (i, k) { S.move('s' + i, bx(B, k, keep.length), B[1], { delay: t + 450, dur: 500 }); });
        S.to('bf', { w: keep.length * 62 + 14 }, { delay: t + 450, dur: 500 });
        S.data({ '当前批': keep.length + ' 条（不满）' }, { delay: t + 950 });
        return [t + 1050, keep];
      }
      function finish(t, keep, row) {       /* 探测 → 投影 → 输出 */
        t = shift(t, keep, Cc, 650);
        S.pulse('jn', { delay: t - 400, scale: 1.05 }); S.flash('ht', C.green, { prop: 'stroke', delay: t - 400 });
        [0, 1, 2].forEach(function (i) { S.flash('r' + i, C.green, { delay: t - 400 + i * 80 }); });
        S.pulse('pi', { delay: t + 100, scale: 1.06 }); S.hide('bf', { delay: t + 200 });
        keep.forEach(function (i, k) {
          S.move('s' + i, 658 + k * 62, row ? 122 : 80, { delay: t + 150 + k * 80, dur: 650 });
          S.ripple(658 + k * 62, row ? 122 : 80, { delay: t + 800 + k * 80, color: C.green });
        });
        nOut += keep.length; S.data({ '输出条数': nOut, '当前批': '—' }, { delay: t + 900 }); S.log('输出一批：' + keep.length + ' 条', { delay: t + 900, kind: 'ok' });
        return t + 1000;
      }
      var b1 = [0, 1, 2, 3], b2 = [4, 5, 6, 7], k1;

      S.step('控制流不变：Next() 还是从根一路向下；变的是每次调用交回【一批】元组', function () {
        S.code([10, 12]); S.log('引擎 → 根.Next()');
        round(200);
      });
      S.step('扫描 S 往输出缓冲里攒元组，攒满一批（N = 4）才往上交', function () {
        S.code([4, 6]); S.log('SeqScan：攒一批');
        fill(0, b1); S.code(8, { delay: 1800 });
      });
      S.step('整批交给过滤：同类型的数据连续摆放 → 可以用 SIMD，一条指令比较多个值', function () {
        S.code([12, 14]);
        var t = shift(0, b1, B, 700); simd(t, b1, [1]);
        S.log('整批比较 value > 100', { delay: t });
      });
      S.step('不合格的丢掉、其余靠拢。只剩 3 条：这里直接上交（也可以等补满，各有利弊）', function () {
        S.code(15);
        k1 = compact(0, b1, [1])[1]; S.log('3·50 被丢弃，批里剩 3 条', { kind: 'warn' });
      });
      S.step('这一批继续向上：探测哈希表 → 投影 → 输出，全程都是整批处理', function () {
        S.code(17); finish(0, k1, 0);
      });
      S.step('引擎第二次调 Next()：扫描 S 再攒满一批才上路', function () {
        S.code([4, 6]); var t = round(0); fill(t, b2);
      });
      S.step('过滤（丢 2 条）→ 探测 → 投影 → 输出：整批一口气走完', function () {
        S.code([12, 15]);
        var t = shift(0, b2, B, 700); t = simd(t, b2, [4, 6]);
        var r = compact(t, b2, [4, 6]); finish(r[0], r[1], 1);
      });
      S.step('第三轮 Next() 拿到空批 → 结束。8 条元组只用了 3 轮调用，开销被批大小摊薄', function () {
        S.code(8); var t = round(0);
        S.set('bf', { x: A[0], y: A[1], w: 84, stroke: C.red }, { delay: t }); S.pop('bf', { delay: t });
        S.set('bfT', { x: A[0] - 15, y: A[1], text: '空批', color: C.red, opacity: 1 }, { delay: t });
        [B, Cc, [400, 88]].forEach(function (c, k) {
          S.move('bf', c[0], c[1], { delay: t + 400 + k * 480, dur: 440 }); S.move('bfT', c[0] - 15, c[1], { delay: t + 400 + k * 480, dur: 440 });
        });
        S.hide('bf', { delay: t + 1850 }); S.hide('bfT', { delay: t + 1850 });
        S.pulse('tN', { delay: t + 1900, scale: 1.25 }); S.flash('tray', C.green, { prop: 'stroke', delay: t + 1900 });
        S.data({ '当前批': '空批（EOF）' }, { delay: t }); S.log('空批 = EOF；共 12 次 Next()，输出 5 条', { delay: t + 1900, kind: 'ok' });
      }, { hold: 1800 });
    }
  }
  ]
});
})();
