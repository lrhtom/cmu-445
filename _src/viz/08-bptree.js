/* #08 B+ 树：查找 / 插入与分裂 / 删除（借键与合并）
 * 节点容量「最多 3 个键、叶子至少 2 个」是为了画得下而取的示意值。 */
(function () {
var C = Viz.C, KEY = '#2b4172', KW = 40, FW = 132, FH = 44;
function sx(cx, w, i) { return cx - w / 2 + 26 + i * KW; }   /* 第 i 个键槽的中心 x */
function px(cx, w, j) { return cx - w / 2 + 6 + j * KW; }    /* 第 j 个孩子指针的 x */
function frame(S, id, cx, y, o) {
  var p = { x: cx, y: y, w: FW, h: FH, rx: 10, fill: C.panel, stroke: C.line, sw: 2 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
function key(S, id, x, y, label, o) {
  var p = { x: x, y: y, w: 36, h: 30, rx: 5, fill: KEY, stroke: 'none', sw: 0, label: String(label), size: 16 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
function edge(S, id, x1, y1, x2, y2, o) {
  var p = { x1: x1, y1: y1, x2: x2, y2: y2, stroke: C.line, sw: 2, arrow: true };
  for (var k in o) p[k] = o[k];
  S.line(id, p);
}
function sib(S, id, x1, x2, y, o) {
  var p = { x1: x1, y1: y, x2: x2, y2: y, stroke: C.purple, sw: 2, arrow: true, dash: '5 4' };
  for (var k in o) p[k] = o[k];
  S.line(id, p);
}
function cursor(S, id, x, y, col) {
  S.box(id, { x: x, y: y, w: 150, h: 62, rx: 14, fill: 'none', stroke: col || C.blue, sw: 3, opacity: 0 });
}
var NOTE = '每个节点最多 3 个键、叶子至少 2 个 —— 示意值，真实节点一页能放几百个键';

Viz.register('bptree', {
  title: 'B+ 树：查找 · 插入分裂 · 删除合并',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #08 B+Trees（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/08-indexes1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #08 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/08-indexes1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Project #2 B+Tree Index', u: 'https://15445.courses.cs.cmu.edu/fall2025/project2/' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：查找 ───────────────────────── */
  {
    name: '点查与范围扫描',
    moving: '蓝色游标逐层下探；数据包沿指针飞向子节点；命中的键变绿并飞进输出槽；读页数滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'Value Find(Key k) {',
      '  Node* n = root;',
      '  while (!n->is_leaf) {',
      '    int i = n->FirstGreater(k);',
      '    n = n->child[i];     // 下探一层',
      '  }',
      '  int i = n->IndexOf(k); // 叶内查找',
      '  return i < 0 ? NOT_FOUND : n->val[i];',
      '}',
      '// 范围扫描 [lo, hi]',
      'for (n = FindLeaf(lo); n; n = n->next)',
      '  for (Key k : n->keys)',
      '    if (k > hi) return;',
      '    else if (k >= lo) emit(k);'
    ].join('\n'),
    build: function (S) {
      var yR = 80, yI = 220, yL = 380, LC = [106, 268, 430, 592, 754];
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      edge(S, 'eRL', px(430, FW, 0), yR + 22, 268, yI - 22); edge(S, 'eRR', px(430, FW, 1), yR + 22, 673, yI - 22);
      edge(S, 'e0', px(268, FW, 0), yI + 22, LC[0], yL - 22); edge(S, 'e1', px(268, FW, 1), yI + 22, LC[1], yL - 22);
      edge(S, 'e2', px(268, FW, 2), yI + 22, LC[2], yL - 22);
      edge(S, 'e3', px(673, FW, 0), yI + 22, LC[3], yL - 22); edge(S, 'e4', px(673, FW, 1), yI + 22, LC[4], yL - 22);
      for (var i = 0; i < 4; i++) sib(S, 's' + i, LC[i] + 66, LC[i + 1] - 66, yL);
      frame(S, 'fR', 430, yR); key(S, 'r20', sx(430, FW, 0), yR, 20);
      frame(S, 'fIL', 268, yI); key(S, 'i6', sx(268, FW, 0), yI, 6); key(S, 'i12', sx(268, FW, 1), yI, 12);
      frame(S, 'fIR', 673, yI); key(S, 'i28', sx(673, FW, 0), yI, 28);
      var leaves = [[1, 3], [6, 9], [12, 15], [20, 23], [28, 31]];
      leaves.forEach(function (ks, n) {
        frame(S, 'fL' + n, LC[n], yL);
        ks.forEach(function (k, j) { key(S, 'l' + k, sx(LC[n], FW, j), yL, k); });
      });
      S.text('tRoot', { x: 520, y: yR, text: '根', anchor: 'start', color: C.mute });
      S.text('tIn', { x: 30, y: yI, text: '内部节点：只存路标', anchor: 'start', color: C.mute, size: 14 });
      S.text('tLeaf', { x: 30, y: yL + 44, text: '叶子：存键和值，用兄弟指针串成链', anchor: 'start', color: C.mute, size: 14 });
      S.box('tray', { x: 430, y: 495, w: 520, h: 50, rx: 10, fill: C.panel, stroke: C.line, dash: '6 5' });
      S.text('tTray', { x: 190, y: 495, text: '输出', anchor: 'start', color: C.mute });
      S.text('tPg', { x: 840, y: 24, anchor: 'end', val: 0, pre: '读过的页：', color: C.amber, size: 16 });
      cursor(S, 'cur', 430, yR);
      S.data({ key: 9, '当前节点': '—', '读过的页': 0 });

      S.step('Find(9)：从根开始，拿 9 和根里的键 20 比较', function () {
        S.code(2); S.log('Find(9)');
        S.pop('cur'); S.flash('r20', C.blue, { delay: 450 }); S.pulse('r20', { delay: 450 });
        S.count('tPg', 1, { delay: 300 }); S.data({ '当前节点': '根 [20]', '读过的页': 1 }, { delay: 300 });
      });
      S.step('9 < 20 → 沿左边的指针下到内部节点', function () {
        S.code([3, 5]);
        S.flash('eRL', C.blue, { prop: 'stroke' });
        S.fly([px(430, FW, 0), yR + 22], [268, yI - 22], { color: C.blue, delay: 150, dur: 800 });
        S.move('cur', 268, yI, { delay: 300, dur: 800 });
        S.count('tPg', 2, { delay: 950 }); S.data({ '当前节点': '内部 [6,12]', '读过的页': 2 }, { delay: 950 });
      });
      S.step('在 [6, 12] 里定位：6 ≤ 9 < 12 → 走中间那个指针', function () {
        S.code([4, 5]);
        S.flash('i6', C.blue); S.pulse('i6'); S.flash('i12', C.blue, { delay: 350 }); S.pulse('i12', { delay: 350 });
        S.flash('e1', C.blue, { prop: 'stroke', delay: 800 });
        S.fly([px(268, FW, 1), yI + 22], [LC[1], yL - 22], { color: C.blue, delay: 900, dur: 750 });
        S.move('cur', LC[1], yL, { delay: 1000, dur: 750 });
        S.count('tPg', 3, { delay: 1650 }); S.data({ '当前节点': '叶子 [6,9]', '读过的页': 3 }, { delay: 1650 });
      });
      S.step('到叶子了。叶内查找命中 9 → 返回它的值', function () {
        S.code([7, 8]);
        S.flash('l6', C.blue); S.pulse('l6');
        S.to('l9', { fill: C.green, color: C.bg }, { delay: 450, dur: 400 }); S.pulse('l9', { delay: 450 });
        S.ripple(sx(LC[1], FW, 1), yL, { delay: 500, color: C.green });
        S.log('Find(9) → 命中，读了 3 页', { delay: 600, kind: 'ok' });
      });
      S.step('范围扫描 9 ≤ key ≤ 20：不回上层，从命中处沿兄弟指针向右走', function () {
        S.code(11); S.log('Scan(9, 20)'); S.data({ key: '9..20', '输出': '9' }, { delay: 700 });
        S.fly('l9', [270, 495], { label: '9', w: 36, h: 30, color: C.green, keep: true, dur: 700 });
        S.flash('s1', C.cyan, { prop: 'stroke', delay: 800 });
        S.fly([LC[1] + 66, yL], [LC[2] - 66, yL], { color: C.purple, delay: 850, dur: 600 });
        S.move('cur', LC[2], yL, { delay: 900, dur: 700 });
        S.count('tPg', 4, { delay: 1500 }); S.data({ '当前节点': '叶子 [12,15]', '读过的页': 4 }, { delay: 1500 });
      });
      S.step('叶子 [12, 15] 整个落在范围内 → 依次输出', function () {
        S.code([12, 14]);
        S.to('l12', { fill: C.green, color: C.bg }, { dur: 350 });
        S.fly('l12', [316, 495], { label: '12', w: 36, h: 30, color: C.green, keep: true, delay: 150, dur: 700 });
        S.to('l15', { fill: C.green, color: C.bg }, { dur: 350, delay: 450 });
        S.fly('l15', [362, 495], { label: '15', w: 36, h: 30, color: C.green, keep: true, delay: 600, dur: 700 });
        S.data({ '输出': '9, 12, 15' }, { delay: 1300 });
      });
      S.step('下一个叶子 [20, 23]：20 输出；23 > 20，扫描结束', function () {
        S.code([12, 13]);
        S.flash('s2', C.cyan, { prop: 'stroke' });
        S.fly([LC[2] + 66, yL], [LC[3] - 66, yL], { color: C.purple, dur: 600 });
        S.move('cur', LC[3], yL, { delay: 50, dur: 700 });
        S.count('tPg', 5, { delay: 700 });
        S.to('l20', { fill: C.green, color: C.bg }, { dur: 350, delay: 800 });
        S.fly('l20', [408, 495], { label: '20', w: 36, h: 30, color: C.green, keep: true, delay: 950, dur: 700 });
        S.flash('l23', C.red, { delay: 1700 }); S.pulse('l23', { delay: 1700 });
        S.data({ '当前节点': '叶子 [20,23]', '读过的页': 5, '输出': '9, 12, 15, 20' }, { delay: 1650 });
        S.log('Scan → 4 个键；23 > hi，停', { delay: 1750, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：插入与分裂 ───────────────────────── */
  {
    name: '插入与分裂',
    moving: '待插入的键飞进叶子；后一半键滑到新节点，其余叶子挪位；中间键飞向父节点；根分裂后整棵树长高一层；树高数字滚动',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Insert(Key k, Value v) {',
      '  Leaf* L = FindLeaf(k);',
      '  L->InsertSorted(k, v);',
      '  if (L->size <= MAX) return;   // 有空位',
      '  Leaf* R = NewLeaf();          // 分裂',
      '  MoveUpperHalf(L, R);',
      '  R->next = L->next; L->next = R;',
      '  InsertIntoParent(L, R->keys[0], R);',
      '}',
      'void InsertIntoParent(Node* l, Key mid, Node* r) {',
      '  if (l == root) { root = NewRoot(l, mid, r); return; }',
      '  Inner* p = l->parent;',
      '  p->InsertAfter(l, mid, r);',
      '  if (p->size <= MAX) return;',
      '  Inner* q = NewInner();        // 父节点也分裂',
      '  Key up = MoveUpperHalf(p, q); // 中间键被推走',
      '  InsertIntoParent(p, up, q);',
      '}'
    ].join('\n'),
    build: function (S) {
      var yR = 150, yL = 380, yI = 235, yN = 90;
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      S.text('tH', { x: 840, y: 24, anchor: 'end', val: 2, pre: '树高：', color: C.amber, size: 16 });
      S.text('tNew', { x: 40, y: 70, text: '待插入', anchor: 'start', color: C.mute, size: 14 });
      edge(S, 'eA', 370, 172, 142, 358); edge(S, 'eB', 410, 172, 334, 358);
      edge(S, 'eC', 450, 172, 526, 358); edge(S, 'eD', 490, 172, 718, 358);
      edge(S, 'eN', 430, 172, 430, 358, { opacity: 0, draw: 0 });
      edge(S, 'nL', 370, yN + 22, 268, yI - 22, { opacity: 0, draw: 0 }); edge(S, 'nR', 410, yN + 22, 673, yI - 22, { opacity: 0, draw: 0 });
      sib(S, 'sAB', 208, 268, yL); sib(S, 'sBC', 400, 460, yL); sib(S, 'sCD', 592, 652, yL);
      sib(S, 'sNC', 496, 526, yL, { opacity: 0, draw: 0 });
      frame(S, 'fNR', 430, yN, { opacity: 0 }); frame(S, 'fRR', 673, yI, { opacity: 0 }); frame(S, 'fN', 430, yL, { opacity: 0 });
      frame(S, 'fR', 430, yR); key(S, 'r9', 390, yR, 9); key(S, 'r13', 430, yR, 13); key(S, 'r17', 470, yR, 17);
      frame(S, 'fA', 142, yL); key(S, 'a1', 102, yL, 1); key(S, 'a5', 142, yL, 5);
      frame(S, 'fB', 334, yL); key(S, 'b9', 294, yL, 9); key(S, 'b10', 334, yL, 10); key(S, 'b11', 374, yL, 11);
      frame(S, 'fC', 526, yL); key(S, 'c13', 486, yL, 13); key(S, 'c15', 526, yL, 15);
      frame(S, 'fD', 718, yL); key(S, 'd17', 678, yL, 17); key(S, 'd19', 718, yL, 19);
      key(S, 'k12', 120, 70, 12, { fill: C.amber, color: C.bg, trail: 3 });
      cursor(S, 'cur', 430, yR);
      S.data({ key: 12, '树高': 2 });

      S.step('Insert(12)：先像查找一样，从根走到该放 12 的叶子（9 ≤ 12 < 13）', function () {
        S.code(2); S.log('Insert(12)');
        S.pop('cur'); S.flash('r9', C.blue, { delay: 350 }); S.flash('r13', C.blue, { delay: 600 });
        S.flash('eB', C.blue, { prop: 'stroke', delay: 900 });
        S.fly([410, 172], [334, 358], { color: C.blue, delay: 950, dur: 750 });
        S.move('cur', 334, yL, { delay: 1050, dur: 750 });
        S.data({ '目标叶子': '[9,10,11]' }, { delay: 1700 });
      });
      S.step('这个叶子已经有 3 个键，12 放进去就溢出了', function () {
        S.code(3);
        S.to('fB', { x: 354, w: 172 }, { dur: 500 }); S.to('cur', { x: 354, w: 190 }, { dur: 500 });
        S.to('sBC', { x1: 440 }, { dur: 500 });
        S.move('k12', 414, yL, { delay: 200, dur: 850 }); S.hide('tNew', { delay: 200 });
        S.ripple(414, yL, { delay: 1050, color: C.amber }); S.pulse('k12', { delay: 1050 });
        S.to('fB', { stroke: C.red }, { delay: 1100, dur: 350 });
        S.code(4, { delay: 1300 });
        S.data({ '叶子键数': '4 / 3 溢出' }, { delay: 1100 }); S.log('叶子满了 → 需要分裂', { delay: 1200, kind: 'warn' });
      });
      S.step('分裂：新建右兄弟，后一半键 [11, 12] 滑过去；其余叶子挪位让出空间', function () {
        S.code([5, 7]); S.hide('cur');
        var o = { dur: 700 }, o2 = { dur: 750, delay: 450 };
        S.to('fA', { x: 106 }, o); S.to('a1', { x: 66 }, o); S.to('a5', { x: 106 }, o);
        S.to('fB', { x: 268, w: FW, stroke: C.line }, o); S.to('b9', { x: 228 }, o); S.to('b10', { x: 268 }, o);
        S.to('fC', { x: 592 }, o); S.to('c13', { x: 552 }, o); S.to('c15', { x: 592 }, o);
        S.to('fD', { x: 754 }, o); S.to('d17', { x: 714 }, o); S.to('d19', { x: 754 }, o);
        S.to('eA', { x2: 106 }, o); S.to('eB', { x2: 268 }, o); S.to('eC', { x2: 592 }, o); S.to('eD', { x2: 754 }, o);
        S.to('sAB', { x1: 172, x2: 202 }, o); S.to('sBC', { x1: 334, x2: 364 }, o); S.to('sCD', { x1: 658, x2: 688 }, o);
        S.pop('fN', { delay: 300 });
        S.to('b11', { x: 390 }, o2); S.to('k12', { x: 430 }, o2);
        S.to('k12', { fill: KEY, color: C.ink }, { delay: 1200, dur: 400 });
        S.to('sNC', { opacity: 1, draw: 1 }, { delay: 1200, dur: 450 });
        S.data({ '叶子键数': null, '左 L': '[9,10]', '右 R（新）': '[11,12]' }, { delay: 1200 });
      });
      S.step('把右半边的第一个键 11【复制】上推给父节点当路标 —— 叶子里仍然留着 11', function () {
        S.code(8);
        var o = { dur: 500 };
        S.to('fR', { w: 172 }, o); S.to('r9', { x: 370 }, o); S.to('r13', { x: 450 }, o); S.to('r17', { x: 490 }, o);
        S.to('eA', { x1: 350 }, o); S.to('eB', { x1: 390 }, o); S.to('eC', { x1: 470 }, o); S.to('eD', { x1: 510 }, o);
        S.pulse('b11', { delay: 200 });
        S.fly([390, yL], [410, yR], { id: 'r11', label: '11', w: 36, h: 30, color: C.amber, keep: true, delay: 350, dur: 850 });
        S.code(13, { delay: 1200 });
        S.to('r11', { fill: KEY, color: C.ink }, { delay: 1500, dur: 400 });
        S.to('eN', { opacity: 1, draw: 1 }, { delay: 1250, dur: 500 });
        S.to('fR', { stroke: C.red }, { delay: 1500, dur: 350 }); S.pulse('fR', { delay: 1500, scale: 1.08 });
        S.code(14, { delay: 1900 });
        S.data({ '上推（复制）': 11, '父节点键数': '4 / 3 溢出' }, { delay: 1500 }); S.log('父节点也满了 → 继续分裂', { delay: 1600, kind: 'warn' });
      });
      S.step('父节点（这里是根）再分裂：[9, 11] 留左，[17] 去右，中间键 13 被【推】走 —— 内部节点不保留它', function () {
        S.code([15, 16]);
        var o = { dur: 800 };
        S.to('fR', { x: 268, y: yI, w: FW, stroke: C.line }, o);
        S.to('r9', { x: 228, y: yI }, o); S.to('r11', { x: 268, y: yI }, o);
        S.pop('fRR', { delay: 250 }); S.to('r17', { x: 633, y: yI }, { dur: 800, delay: 150 });
        S.to('r13', { y: 112, fill: C.amber, color: C.bg }, { dur: 700, delay: 300 });
        S.to('eA', { x1: 208, y1: yI + 22 }, o); S.to('eB', { x1: 248, y1: yI + 22 }, o); S.to('eN', { x1: 288, y1: yI + 22 }, o);
        S.to('eC', { x1: 613, y1: yI + 22 }, o); S.to('eD', { x1: 653, y1: yI + 22 }, o);
        S.data({ '父节点键数': null, '上推（复制）': null, '左 L': '[9,11]', '右 R（新）': '[17]', '上推（推走）': 13 }, { delay: 800 });
      });
      S.step('原来的根没有父节点 → 新建一个只含 13 的根，树长高一层', function () {
        S.code(17); S.code(11, { delay: 500 });
        S.pop('fNR', { delay: 200 });
        S.to('r13', { x: 390, y: yN, fill: KEY, color: C.ink }, { dur: 650, delay: 350 });
        S.ripple(390, yN, { delay: 1000, color: C.green });
        S.to('nL', { opacity: 1, draw: 1 }, { dur: 500, delay: 900 }); S.to('nR', { opacity: 1, draw: 1 }, { dur: 500, delay: 1150 });
        S.count('tH', 3, { delay: 1300 }); S.pulse('tH', { delay: 1300 });
        S.data({ '树高': 3, '上推（推走）': null, '左 L': null, '右 R（新）': null }, { delay: 1300 });
        S.log('根分裂 → 树高 2 → 3', { delay: 1400, kind: 'ok' });
      });
      S.step('检查：所有叶子仍在同一层，沿叶子链读出来依然有序', function () {
        var xs = [106, 268, 430, 592, 754], ids = ['fA', 'fB', 'fN', 'fC', 'fD'];
        S.fly([40, yL + 36], [820, yL + 36], { color: C.green, dur: 1800, ease: 'linear' });
        ids.forEach(function (id, i) { S.flash(id, C.green, { prop: 'stroke', delay: 150 + (xs[i] - 40) / 780 * 1800 }); });
        S.log('叶子链：1 5 9 10 11 12 13 15 17 19', { delay: 1900, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 3：删除 ───────────────────────── */
  {
    name: '删除：借键与合并',
    moving: '被删的键缩小消失；借来的键从兄弟滑过来；新路标飞向父节点；合并时键滑入兄弟、空节点和它的指针缩回；叶子重新居中',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      'void Delete(Key k) {',
      '  Leaf* L = FindLeaf(k);',
      '  L->Remove(k);',
      '  if (L->size >= MIN) return;  // 仍半满',
      '  Node* S = L->Sibling();      // 只看紧邻兄弟',
      '  if (S->size > MIN) {',
      '    Borrow(L, S);              // 借一个键',
      '    parent->UpdateSeparator(L, S);',
      '  } else {',
      '    Merge(L, S);               // 合并',
      '    parent->RemoveEntry(S);    // 少一个路标',
      '    // 父节点不足半满 → 递归向上',
      '  }',
      '}'
    ].join('\n'),
    build: function (S) {
      var yR = 150, yL = 380;
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      edge(S, 'eA', 370, 172, 190, 358); edge(S, 'eB', 410, 172, 430, 358); edge(S, 'eC', 450, 172, 670, 358);
      sib(S, 'sAB', 256, 364, yL); sib(S, 'sBC', 496, 604, yL);
      frame(S, 'fR', 430, yR); key(S, 'r9', 390, yR, 9); key(S, 'r13', 430, yR, 13);
      frame(S, 'fA', 190, yL); key(S, 'a1', 150, yL, 1); key(S, 'a5', 190, yL, 5);
      frame(S, 'fB', 430, yL); key(S, 'b9', 390, yL, 9, { trail: 3 }); key(S, 'b10', 430, yL, 10); key(S, 'b11', 470, yL, 11);
      frame(S, 'fC', 670, yL); key(S, 'c13', 630, yL, 13, { trail: 3 }); key(S, 'c15', 670, yL, 15);
      S.text('tA', { x: 190, y: yL + 44, text: 'A', color: C.mute }); S.text('tB', { x: 430, y: yL + 44, text: 'B', color: C.mute });
      S.text('tC', { x: 670, y: yL + 44, text: 'C', color: C.mute });
      cursor(S, 'cur', 430, yR); cursor(S, 'cur2', 430, yL, C.purple);
      S.data({ key: '—', A: '[1,5]', B: '[9,10,11]', C: '[13,15]', '根': '[9,13]' });

      S.step('Delete(5)：从根走到含 5 的叶子 A', function () {
        S.code(2); S.log('Delete(5)'); S.data({ key: 5 });
        S.pop('cur'); S.flash('r9', C.blue, { delay: 350 });
        S.flash('eA', C.blue, { prop: 'stroke', delay: 650 });
        S.fly([370, 172], [190, 358], { color: C.blue, delay: 700, dur: 750 });
        S.move('cur', 190, yL, { delay: 800, dur: 750 });
        S.to('a5', { fill: C.red }, { delay: 1600, dur: 350 });
      });
      S.step('删掉 5 → A 只剩 1 个键，不足半满', function () {
        S.code(3);
        S.to('a5', { scale: .2, opacity: 0 }, { dur: 500, ease: 'in' });
        S.to('fA', { stroke: C.amber }, { delay: 450, dur: 350 }); S.pulse('fA', { delay: 450, scale: 1.08 });
        S.code(4, { delay: 700 });
        S.data({ A: '[1] 不足半满' }, { delay: 500 }); S.log('A.size = 1 < MIN', { delay: 600, kind: 'warn' });
      });
      S.step('看紧邻的兄弟 B：它有 3 个键，借出一个仍然半满 → 把 9 借过来', function () {
        S.code([5, 7]);
        S.pop('cur2');
        S.move('b9', 190, yL, { delay: 500, dur: 850 }); S.ripple(190, yL, { delay: 1350, color: C.green });
        S.to('b10', { x: 390 }, { delay: 800, dur: 600 }); S.to('b11', { x: 430 }, { delay: 900, dur: 600 });
        S.to('fA', { stroke: C.line }, { delay: 1350, dur: 350 });
        S.data({ A: '[1,9]', B: '[10,11]' }, { delay: 1350 });
      });
      S.step('必须更新父节点的路标 9 → 10，否则查 9 会被引到 B，漏掉刚借走的 9', function () {
        S.code(8);
        S.pulse('b10');
        S.fly([390, yL], [390, yR], { label: '10', w: 36, h: 30, color: C.amber, delay: 250, dur: 800 });
        S.set('r9', { label: '10' }, { delay: 1050 }); S.flash('r9', C.amber, { delay: 1050 }); S.pulse('r9', { delay: 1050 });
        S.hide('cur', { delay: 1300 }); S.hide('cur2', { delay: 1300 });
        S.data({ '根': '[10,13]' }, { delay: 1050 }); S.log('借键完成：路标 9 → 10', { delay: 1150, kind: 'ok' });
      });
      S.step('Delete(15)：走到叶子 C 删掉 15 → C 只剩 [13]，又不足半满', function () {
        S.code(2); S.log('Delete(15)'); S.data({ key: 15 });
        S.set('cur', { x: 430, y: yR }); S.pop('cur'); S.flash('r13', C.blue, { delay: 350 });
        S.fly([450, 172], [670, 358], { color: C.blue, delay: 600, dur: 750 });
        S.move('cur', 670, yL, { delay: 700, dur: 750 });
        S.code(3, { delay: 1500 });
        S.to('c15', { fill: C.red }, { delay: 1500, dur: 250 });
        S.to('c15', { scale: .2, opacity: 0 }, { delay: 1800, dur: 450, ease: 'in' });
        S.to('fC', { stroke: C.amber }, { delay: 2200, dur: 300 });
        S.code(4, { delay: 2250 });
        S.data({ C: '[13] 不足半满' }, { delay: 2200 });
      });
      S.step('兄弟 B 只有 2 个键，借了它自己就不够 → 合并：13 滑进 B，C 被回收', function () {
        S.code([5, 6]);
        S.set('cur2', { x: 430, y: yL }); S.pop('cur2'); S.flash('fB', C.red, { prop: 'stroke', delay: 400 });
        S.code(10, { delay: 900 });
        S.move('c13', 470, yL, { delay: 950, dur: 850 }); S.ripple(470, yL, { delay: 1800, color: C.green });
        S.hide('fC', { delay: 1500, dur: 500 }); S.hide('tC', { delay: 1500 }); S.hide('cur', { delay: 1500 });
        S.to('sBC', { draw: 0, opacity: 0 }, { delay: 1500, dur: 500 });
        S.data({ B: '[10,11,13]', C: '已回收' }, { delay: 1800 });
      });
      S.step('父节点删掉路标 13 和指向 C 的指针；叶子重新居中', function () {
        S.code(11);
        S.to('r13', { scale: .2, opacity: 0 }, { dur: 450, ease: 'in' });
        S.to('eC', { draw: 0, opacity: 0 }, { dur: 550 }); S.hide('cur2');
        var o = { delay: 600, dur: 750 };
        S.to('fA', { x: 310 }, o); S.to('a1', { x: 270 }, o); S.to('b9', { x: 310 }, o); S.to('tA', { x: 310 }, o);
        S.to('fB', { x: 550 }, o); S.to('b10', { x: 510 }, o); S.to('b11', { x: 550 }, o); S.to('c13', { x: 590 }, o); S.to('tB', { x: 550 }, o);
        S.to('eA', { x2: 310 }, o); S.to('eB', { x2: 550 }, o); S.to('sAB', { x1: 376, x2: 484 }, o);
        S.data({ '根': '[10]', C: null }, { delay: 500 }); S.log('合并完成：根少一个路标', { delay: 600, kind: 'ok' });
      });
      S.step('根是特例，允许不足半满；所有叶子仍在同一层', function () {
        S.code(12);
        S.flash('fR', C.green, { prop: 'stroke' }); S.pulse('fR', { scale: 1.08 });
        S.flash('fA', C.green, { prop: 'stroke', delay: 400 }); S.flash('fB', C.green, { prop: 'stroke', delay: 650 });
        S.fly([220, yL + 36], [640, yL + 36], { color: C.green, delay: 400, dur: 1000, ease: 'linear' });
        S.log('叶子链：1 9 10 11 13', { delay: 1400, kind: 'ok' });
      });
    }
  }
  ]
});
})();
