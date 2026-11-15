/* #15 查询优化：200 万 → 37 的五步优化 / 拆分合取与谓词下推 / × 变内连接与投影下推 / System R 自底向上搜索
 * 场景 1 的 I/O 数字、场景 2–3 的计划和谓词、场景 4 的访问方法都照笔记（及其对应的官方 Slides）；
 * 场景 4 的成本数字、场景 1 的条形长度是示意。 */
(function () {
var C = Viz.C;
function mk(S, type, id, base, o) { for (var k in o) base[k] = o[k]; S[type](id, base); }
function lab(S, id, x, y, text, o) {
  mk(S, 'text', id, { x: x, y: y, text: text, anchor: 'start', color: C.mute, size: 15 }, o);
}
/* 一棵会动的计划树：节点移动或换父节点时，连线的两端跟着走 */
function mkTree(S) {
  var pos = {}, par = {}, last = {}, HH = 42;
  function ends(c) {
    var p = pos[par[c]], q = pos[c], off = Math.max(-p[2] / 2 + 18, Math.min(p[2] / 2 - 18, (q[0] - p[0]) * .3));
    return { x1: p[0] + off, y1: p[1] + HH / 2, x2: q[0], y2: q[1] - HH / 2 };
  }
  return {
    pos: pos,
    node: function (id, x, y, w, label, o) {
      pos[id] = [x, y, w];
      mk(S, 'box', id, { x: x, y: y, w: w, h: HH, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: label, size: 16 }, o);
    },
    link: function (c, p, o) {
      par[c] = p; var e = ends(c); last[c] = e;
      mk(S, 'line', 'e_' + c, { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, stroke: C.line, sw: 2 }, o);
    },
    setW: function (id, w) { pos[id][2] = w; },
    go: function (moves, links, t, dur) {
      var id, c, e, l;
      for (id in moves) { pos[id][0] = moves[id][0]; pos[id][1] = moves[id][1]; S.move(id, moves[id][0], moves[id][1], { delay: t, dur: dur }); }
      for (c in links) par[c] = links[c];
      for (c in par) {
        e = ends(c); l = last[c];
        if (e.x1 !== l.x1 || e.y1 !== l.y1 || e.x2 !== l.x2 || e.y2 !== l.y2) { S.to('e_' + c, e, { delay: t, dur: dur }); last[c] = e; }
      }
      return t + dur;
    }
  };
}
var RULES = ['① 拆分合取子句', '② 谓词下推', '③ × + 连接谓词 → ⋈', '④ 投影下推'];
function rules(S, done) {
  RULES.forEach(function (r, i) {
    S.box('ru' + i, { x: 730, y: 62 + i * 42, w: 204, h: 32, rx: 8, fill: C.panel, stroke: i < done ? C.green : C.line, sw: 2, label: r, size: 15, color: i < done ? C.green : C.mute });
  });
}
function ruleOn(S, i, t) { S.to('ru' + i, { stroke: C.blue, color: C.ink }, { delay: t || 0, dur: 300 }); S.pulse('ru' + i, { delay: t || 0, scale: 1.08 }); }
function ruleDone(S, i, t) { S.to('ru' + i, { stroke: C.green, color: C.green }, { delay: t || 0, dur: 300 }); }
function preds(S) {
  S.text('note', { x: 20, y: 24, text: '计划和谓词照笔记第 6 节的例子：找出出现在某张致敬专辑上的艺人', anchor: 'start', size: 14, color: C.mute });
  lab(S, 'pd1', 20, 58, 'p1：artist.id = appears.artist_id', { size: 14 });
  lab(S, 'pd2', 20, 80, 'p2：appears.album_id = album.id', { size: 14 });
  lab(S, 'pd3', 20, 102, "p3：album.name = 'Mooshoo Tribute'", { size: 14 });
}

Viz.register('optimizer', {
  title: '查询优化：改写计划树与搜索连接顺序',
  sources: [
    { t: 'CMU 15-445 Fall 2025 · Lecture #15 查询优化 I（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/15-optimization1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #15 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/15-optimization1.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Lecture #16 查询优化 II（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/16-optimization2.pdf' },
    { t: 'CMU 15-445 Fall 2025 · Project #3 查询执行', u: 'https://15445.courses.cs.cmu.edu/fall2025/project3/' }
  ],
  scenes: [

  /* ───────────────────────── 场景 1：200 万 → 37 ───────────────────────── */
  {
    name: '同一条 SQL：200 万 → 37',
    moving: '连接条件飞进 × 变成 ⋈；临时文件缩小飞走；过滤节点沿树滑到 department 上方、其余节点跟着挪位；两棵子树交换左右；I/O 次数滚动、条形伸长',
    lang: 'SQL 与五步优化（笔记第 2 节）',
    code: [
      'SELECT DISTINCT e.name',
      '  FROM employee AS e, department AS d',
      ' WHERE e.dept_id = d.id',
      "   AND d.name = 'Toy';",
      '-- 目录：employee   10,000 条 / 1,000 页',
      '--       department    500 条 /    50 页',
      '-- #0 字面翻译：× + σ + π      2,000,000',
      '-- #1 块嵌套循环内连接            54,000',
      '-- #2 排序归并连接（B = 50）       7,000',
      '-- #3 物化模型 → 向量化模型        3,000',
      '-- #4 下推 + 换边 + 索引嵌套循环      37'
    ].join('\n'),
    build: function (S) {
      var T = mkTree(S), BX = 520, i;
      var rows = [['#0 字面翻译：× + σ + π', 2000000, '2,000,000', C.red], ['#1 块嵌套循环内连接', 54000, '54,000', C.amber], ['#2 排序归并连接（B = 50）', 7000, '7,000', C.amber],
        ['#3 物化模型 → 向量化模型', 3000, '3,000', C.blue], ['#4 下推 + 换边 + 索引嵌套循环', 37, '37', C.green]];
      function bw(i) { return Math.round(34 * Math.log(rows[i][1]) / Math.LN10); }
      S.text('note', { x: 20, y: 24, text: 'I/O 次数是笔记第 2 节的官方算例；右侧条形长度按对数刻度画（示意）', anchor: 'start', size: 14, color: C.mute });
      lab(S, 'lIO', BX, 62, 'I/O 次数');
      S.text('tIO', { x: BX, y: 106, anchor: 'start', val: 0, color: C.amber, size: 38, weight: 700 });
      rows.forEach(function (r, i) {
        var y = 196 + i * 62;
        lab(S, 'bl' + i, BX, y - 18, r[0], { size: 14, opacity: 0 });
        S.box('bar' + i, { x: BX + 1, y: y + 6, w: 2, h: 20, rx: 4, fill: r[3], stroke: 'none', sw: 0, opacity: 0 });
        S.text('bv' + i, { x: BX + bw(i) + 10, y: y + 6, text: r[2], anchor: 'start', size: 15, color: C.ink, opacity: 0 });
      });
      T.node('pi', 240, 80, 230, 'π DISTINCT e.name');
      T.node('sg', 240, 172, 350, "σ e.dept_id = d.id ∧ d.name = 'Toy'");
      T.node('jn', 240, 270, 170, '× 笛卡尔积');
      T.node('emp', 120, 430, 196, 'employee · 1,000 页'); T.node('dep', 360, 430, 196, 'department · 50 页');
      T.link('sg', 'pi'); T.link('jn', 'sg'); T.link('emp', 'jn'); T.link('dep', 'jn');
      S.box('t1', { x: 240, y: 126, w: 88, h: 26, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: '临时文件', color: C.bg, size: 14, trail: 3 });
      S.box('t2', { x: 240, y: 221, w: 88, h: 26, rx: 6, fill: C.amber, stroke: 'none', sw: 0, label: '临时文件', color: C.bg, size: 14, trail: 3 });
      S.data({ '计划': '—', 'I/O 次数': 0 });
      function bar(i, t) {
        var w = bw(i);
        S.to('bl' + i, { opacity: 1 }, { delay: t, dur: 250 }); S.set('bar' + i, { opacity: 1 }, { delay: t });
        S.to('bar' + i, { w: w, x: BX + w / 2 }, { delay: t, dur: 700, ease: 'out' }); S.to('bv' + i, { opacity: 1 }, { delay: t + 600, dur: 250 });
        S.count('tIO', rows[i][1], { delay: t, dur: 900 }); S.data({ '计划': rows[i][0], 'I/O 次数': rows[i][2] }, { delay: t + 600 });
        S.log(rows[i][0] + ' → ' + rows[i][2] + ' 次 I/O', { delay: t + 600, kind: i === 4 ? 'ok' : i ? '' : 'err' });
      }

      S.step('SQL 的字面翻译：笛卡尔积 + 过滤 + 投影，每个算子都把结果写成临时文件', function () {
        S.code(7);
        S.flash('jn', C.red, { prop: 'stroke' }); S.pulse('jn');
        S.pulse('t2', { delay: 350 }); S.pulse('t1', { delay: 550 });
        bar(0, 500);
      }, { hold: 1500 });
      S.step('① 消掉笛卡尔积：连接条件并进 ×，换成块嵌套循环内连接 —— 边扫边匹配', function () {
        S.code(8);
        S.fly([150, 172], [240, 270], { label: 'e.dept_id = d.id', w: 150, h: 28, color: C.amber, dur: 750 });
        S.set('sg', { label: "σ d.name = 'Toy'" }, { delay: 250 }); S.to('sg', { w: 210 }, { delay: 250, dur: 500 }); T.setW('sg', 210);
        S.set('jn', { label: '⋈ 块嵌套循环连接' }, { delay: 750 }); S.to('jn', { w: 230 }, { delay: 750, dur: 400 }); T.setW('jn', 230);
        S.flash('jn', C.green, { prop: 'stroke', delay: 750 }); S.pulse('jn', { delay: 750, scale: 1.08 });
        T.go({}, {}, 750, 400);
        bar(1, 1100);
      }, { hold: 1500 });
      S.step('② 把连接算法换成排序归并连接（B = 50 个缓冲页）', function () {
        S.code(9);
        S.flash('jn', C.amber, { prop: 'stroke' }); S.set('jn', { label: '⋈ 排序归并连接' }, { delay: 200 }); S.pulse('jn', { delay: 200, scale: 1.08 });
        bar(2, 500);
      }, { hold: 1500 });
      S.step('③ 从物化模型换成向量化模型：不再写临时文件，全程流水线', function () {
        S.code(10);
        S.to('t2', { x: 420, opacity: 0, scale: .4 }, { dur: 650, ease: 'in' }); S.to('t1', { x: 420, opacity: 0, scale: .4 }, { delay: 180, dur: 650, ease: 'in' });
        S.fly([240, 249], [240, 193], { color: C.cyan, delay: 800, dur: 450 }); S.fly([240, 151], [240, 101], { color: C.cyan, delay: 1150, dur: 450 });
        bar(3, 900);
      }, { hold: 1500 });
      S.step("④ 谓词下推：把 d.name = 'Toy' 推到连接下面，直接压在 department 的扫描上", function () {
        S.code(11); S.log('谓词下推');
        S.to('sg', { stroke: C.amber }, { dur: 250 });
        var t = T.go({ sg: [360, 318], pi: [240, 100], jn: [240, 205] }, { jn: 'pi', sg: 'jn', dep: 'sg' }, 300, 950);
        S.ripple(360, 318, { delay: t, color: C.amber }); S.to('sg', { stroke: C.green }, { delay: t, dur: 300 });
      }, { hold: 1500 });
      S.step('交换连接两侧：department 过滤后只剩极少数行，放到外层；它走 name 上的索引', function () {
        S.code(11); S.log('交换连接两侧');
        T.go({ emp: [240, 512] }, {}, 0, 400);
        var t = T.go({ emp: [360, 430], sg: [120, 318], dep: [120, 430] }, {}, 420, 700);
        S.set('dep', { label: 'department · name 索引' }, { delay: t }); S.flash('dep', C.green, { prop: 'stroke', delay: t }); S.pulse('dep', { delay: t, scale: 1.06 });
      }, { hold: 1500 });
      S.step('再拿这几行去 employee 上做索引嵌套循环连接', function () {
        S.code(11);
        S.set('jn', { label: '⋈ 索引嵌套循环连接' }, { delay: 150 }); S.flash('jn', C.green, { prop: 'stroke', delay: 150 }); S.pulse('jn', { delay: 150, scale: 1.08 });
        [0, 1, 2].forEach(function (k) {
          S.fly([120, 297], [204, 226], { color: C.cyan, delay: 450 + k * 260, dur: 420, ripple: false });
          S.fly([276, 226], [360, 409], { color: C.cyan, delay: 870 + k * 260, dur: 420 });
        });
        S.set('emp', { label: 'employee · 按索引探测' }, { delay: 900 }); S.flash('emp', C.green, { prop: 'stroke', delay: 900 });
        bar(4, 1500);
      }, { hold: 1500 });
      S.step('同一条 SQL、同一份结果：I/O 从 2,000,000 降到 37 —— 这就是优化器的价值', function () {
        S.code([7, 11]);
        S.flash('bar0', C.white, {}); S.pulse('bv0'); S.flash('bar4', C.white, { delay: 500 }); S.pulse('bv4', { delay: 500 }); S.pulse('tIO', { delay: 800, scale: 1.2 });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 2：拆分合取与谓词下推 ───────────────────────── */
  {
    name: '拆分合取与谓词下推',
    moving: '一个过滤节点裂成三个并上下排开，下面的子树整体下移让位；p3、p1 两个过滤节点沿树枝滑到各自的位置，连线跟着改接，其余节点收拢',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 规则 1：拆分合取子句',
      'Plan SplitConjunction(Filter f) {',
      '  Plan p = f.child;',
      '  for (Expr e : SplitByAnd(f.pred))',
      '    p = Filter(e, p);      // 一个谓词一个算子',
      '  return p;',
      '}',
      '// 规则 2：谓词下推（f 的孩子是 × 或 ⋈）',
      'Plan PushDown(Filter f, Join j) {',
      '  if (f.OnlyUses(j.left))',
      '    j.left = Filter(f.pred, j.left);   // 推左',
      '  else if (f.OnlyUses(j.right))',
      '    j.right = Filter(f.pred, j.right); // 推右',
      '  else',
      '    return f;        // 两边都用到：留原地',
      '  return j;',
      '}'
    ].join('\n'),
    build: function (S) {
      var T = mkTree(S);
      preds(S); rules(S, 0);
      T.node('pi', 430, 62, 200, 'π artist.name');
      T.node('sAll', 430, 142, 240, 'σ p1 ∧ p2 ∧ p3');
      T.node('x2', 430, 232, 70, '×'); T.node('x1', 300, 332, 70, '×'); T.node('album', 620, 332, 130, 'album');
      T.node('artist', 200, 442, 130, 'artist'); T.node('appears', 400, 442, 130, 'appears');
      ['sp1', 'sp2', 'sp3'].forEach(function (id, i) { T.node(id, 430, 142, 120, 'σ p' + (i + 1), { opacity: 0 }); });
      T.link('sAll', 'pi'); T.link('x2', 'sAll'); T.link('x1', 'x2'); T.link('album', 'x2'); T.link('artist', 'x1'); T.link('appears', 'x1');
      T.link('sp1', 'pi', { opacity: 0 }); T.link('sp2', 'sp1', { opacity: 0 }); T.link('sp3', 'sp2', { opacity: 0 });
      S.data({ '当前规则': '—', 'p1 的位置': '顶部的过滤', 'p2 的位置': '顶部的过滤', 'p3 的位置': '顶部的过滤' });

      S.step('绑定器给出的朴素计划：三个条件挤在一个过滤算子里，下面是两个笛卡尔积', function () {
        S.code([1, 2]); S.log('朴素计划：σ(p1∧p2∧p3) 压在两个 × 上面');
        S.flash('sAll', C.amber, { prop: 'stroke' }); S.pulse('sAll', { scale: 1.06 });
        S.flash('x2', C.red, { prop: 'stroke', delay: 500 }); S.pulse('x2', { delay: 500 }); S.flash('x1', C.red, { prop: 'stroke', delay: 750 }); S.pulse('x1', { delay: 750 });
        ['pd1', 'pd2', 'pd3'].forEach(function (id, i) { S.flash(id, C.ink, { prop: 'color', delay: 1100 + i * 180 }); });
      }, { hold: 1500 });
      S.step('① 拆分合取：按 AND 把一个过滤拆成三个独立的过滤算子；下面的子树整体下移让位', function () {
        S.code([3, 5]); ruleOn(S, 0); S.data({ '当前规则': '规则 1 · 拆分合取' }); S.log('SplitConjunction → σp1、σp2、σp3');
        S.hide('sAll', { delay: 250 }); S.hide('e_sAll', { delay: 250 });
        ['sp1', 'sp2', 'sp3'].forEach(function (id) { S.to(id, { opacity: 1 }, { delay: 250, dur: 250 }); S.to('e_' + id, { opacity: 1 }, { delay: 700, dur: 400 }); });
        var t = T.go({ sp1: [430, 132], sp2: [430, 192], sp3: [430, 252], x2: [430, 332], x1: [300, 412], album: [620, 412], artist: [200, 502], appears: [400, 502] }, { x2: 'sp3' }, 350, 850);
        ['sp1', 'sp2', 'sp3'].forEach(function (id, i) { S.pulse(id, { delay: t + i * 120 }); });
        ruleDone(S, 0, t + 300);
      }, { hold: 1500 });
      S.step('拆开之后，每个谓词就能独立移动了 —— 这是后面所有下推的前提', function () {
        S.code(5);
        ['sp1', 'sp2', 'sp3'].forEach(function (id, i) { S.flash(id, C.blue, { prop: 'stroke', delay: i * 300 }); S.pulse(id, { delay: i * 300, scale: 1.1 }); S.flash('pd' + (i + 1), C.ink, { prop: 'color', delay: i * 300 }); });
      });
      S.step('② 谓词下推：p3 只用到 album → 推到 album 扫描的正上方；上面的节点收拢', function () {
        S.code([12, 13]); ruleOn(S, 1); S.data({ '当前规则': '规则 2 · 谓词下推' }); S.log('p3 → album 正上方');
        S.to('sp3', { stroke: C.amber }, { dur: 250 }); S.flash('album', C.amber, { prop: 'stroke', delay: 100 });
        var t = T.go({ sp3: [620, 372], album: [620, 472], x2: [430, 272], x1: [300, 372], artist: [200, 472], appears: [400, 472] }, { sp3: 'x2', album: 'sp3', x2: 'sp2' }, 400, 950);
        S.ripple(620, 372, { delay: t, color: C.green }); S.to('sp3', { stroke: C.green }, { delay: t, dur: 300 });
        S.data({ 'p3 的位置': 'album 正上方' }, { delay: t });
      }, { hold: 1500 });
      S.step('p1 只用到 artist 和 appears → 绕过 p2，推到 artist × appears 的正上方', function () {
        S.code([10, 11]); S.log('p1 → artist × appears 正上方');
        S.to('sp1', { stroke: C.amber }, { dur: 250 }); S.flash('x1', C.amber, { prop: 'stroke', delay: 100 });
        T.go({ sp1: [300, 132] }, {}, 300, 500);
        var t = T.go({ sp1: [300, 292], sp2: [430, 132], x2: [430, 212], album: [620, 462], artist: [200, 462], appears: [400, 462] }, { sp1: 'x2', x1: 'sp1', sp2: 'pi' }, 850, 900);
        S.ripple(300, 292, { delay: t, color: C.green }); S.to('sp1', { stroke: C.green }, { delay: t, dur: 300 });
        S.data({ 'p1 的位置': 'artist × appears 正上方' }, { delay: t });
      }, { hold: 1500 });
      S.step('p2 同时用到 appears 和 album，两边都得有 → 只能留在上面那个 × 的正上方', function () {
        S.code([14, 15]);
        S.flash('sp2', C.blue, { prop: 'stroke' }); S.pulse('sp2', { scale: 1.1 }); S.flash('pd2', C.ink, { prop: 'color' });
        S.flash('e_x1', C.blue, { prop: 'stroke', delay: 400 }); S.flash('e_sp1', C.blue, { prop: 'stroke', delay: 400 }); S.flash('e_sp3', C.blue, { prop: 'stroke', delay: 400 });
        S.to('sp2', { stroke: C.green }, { delay: 900, dur: 300 }); ruleDone(S, 1, 900);
        S.data({ 'p2 的位置': '上层 × 正上方（没动）' }, { delay: 400 }); S.log('p2 留在原地', { delay: 400 });
      });
      S.step('过滤尽早做，流进上层算子的元组就少。这类改写永远该做，不用问成本模型', function () {
        S.code([8, 9]);
        S.fly([620, 441], [620, 393], { color: C.green, dur: 450 }); S.fly([620, 351], [466, 233], { color: C.green, delay: 450, dur: 600 });
        S.fly([200, 441], [282, 393], { color: C.green, delay: 150, dur: 450 }); S.fly([400, 441], [318, 393], { color: C.green, delay: 300, dur: 450 });
        S.fly([300, 351], [300, 313], { color: C.green, delay: 750, dur: 350 }); S.fly([300, 271], [394, 233], { color: C.green, delay: 1100, dur: 500 });
        S.fly([430, 191], [430, 153], { color: C.green, delay: 1600, dur: 350 }); S.fly([430, 111], [430, 83], { color: C.green, delay: 1950, dur: 300 });
        S.log('谓词下推完成', { delay: 1500, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 3：× 变内连接与投影下推 ───────────────────────── */
  {
    name: '× 变内连接 · 投影下推',
    moving: '过滤节点滑下去和 × 合并成 ⋈，树向上收拢；投影从根节点分身飞到各张表和连接的上方，下面的节点下移让位',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// 规则 3：过滤 + 笛卡尔积 → 内连接（2 → 1）',
      'Plan ToInnerJoin(Filter f, Product x) {',
      '  if (!f.IsJoinPredicate(x.left, x.right))',
      '    return f;',
      '  return InnerJoin(f.pred, x.left, x.right);',
      '}',
      '// 规则 4：投影下推（1 → N）',
      'Plan PushProjection(Plan p, Cols need) {',
      '  // 孩子除了上层要的列，还得留 p 自己用的',
      '  Cols below = need ∪ ColsUsedBy(p);',
      '  for (Plan& c : p.children)',
      '    c = PushProjection(c, below);',
      '  // p 之上只留上层要的列',
      '  return Project(need ∩ p.OutputCols(), p);',
      '}',
      '// 砍不掉列、或不划算时可以不加投影'
    ].join('\n'),
    build: function (S) {
      var T = mkTree(S);
      preds(S); rules(S, 2);
      T.node('pi', 430, 62, 200, 'π artist.name'); T.node('sp2', 430, 132, 120, 'σ p2', { stroke: C.green }); T.node('x2', 430, 212, 70, '×');
      T.node('sp1', 300, 292, 120, 'σ p1', { stroke: C.green }); T.node('x1', 300, 372, 70, '×'); T.node('sp3', 620, 372, 120, 'σ p3', { stroke: C.green });
      T.node('artist', 200, 462, 130, 'artist'); T.node('appears', 400, 462, 130, 'appears'); T.node('album', 620, 462, 130, 'album');
      T.node('pA', 430, 62, 130, 'π id, name', { opacity: 0, stroke: C.purple }); T.node('pP', 430, 62, 214, 'π artist_id, album_id', { opacity: 0, stroke: C.purple });
      T.node('pJ', 430, 62, 176, 'π name, album_id', { opacity: 0, stroke: C.purple }); T.node('pL', 430, 62, 90, 'π id', { opacity: 0, stroke: C.purple });
      T.link('sp2', 'pi'); T.link('x2', 'sp2'); T.link('sp1', 'x2'); T.link('sp3', 'x2'); T.link('x1', 'sp1');
      T.link('artist', 'x1'); T.link('appears', 'x1'); T.link('album', 'sp3');
      ['pA', 'pP', 'pJ', 'pL'].forEach(function (id) { T.link(id, 'pi', { opacity: 0 }); });
      S.data({ '当前规则': '—', '笛卡尔积': 2, '投影算子': 1 });
      function show(id, t) { S.to(id, { opacity: 1 }, { delay: t, dur: 200 }); S.to('e_' + id, { opacity: 1 }, { delay: t + 500, dur: 400 }); }

      S.step('接着上一幕：三个过滤已各就各位，但计划里还有两个笛卡尔积', function () {
        S.code([1, 2]); S.log('还剩 2 个笛卡尔积');
        S.flash('x1', C.red, { prop: 'stroke' }); S.pulse('x1', { scale: 1.2 }); S.flash('x2', C.red, { prop: 'stroke', delay: 350 }); S.pulse('x2', { delay: 350, scale: 1.2 });
        ruleOn(S, 2, 800);
      });
      S.step('③ p1 是连接谓词：它和正下方的 × 合并成内连接 ⋈ p1 —— 2 个算子变 1 个', function () {
        S.code([3, 5]); S.data({ '当前规则': '规则 3 · × → ⋈' });
        var t = T.go({ sp1: [300, 372] }, {}, 0, 650);
        S.hide('sp1', { delay: t - 100 }); S.hide('e_sp1', { delay: t - 250 });
        S.set('x1', { label: '⋈ p1' }, { delay: t }); S.to('x1', { w: 120, stroke: C.green }, { delay: t, dur: 350 }); T.setW('x1', 120);
        S.pulse('x1', { delay: t, scale: 1.12 }); S.ripple(300, 372, { delay: t, color: C.green });
        T.go({}, { x1: 'x2' }, t + 50, 450);
        S.data({ '笛卡尔积': 1 }, { delay: t }); S.log('σp1 + × → ⋈p1', { delay: t, kind: 'ok' });
      }, { hold: 1500 });
      S.step('p2 和上面的 × 同理 → ⋈ p2。计划里再也没有笛卡尔积，整棵树向上收拢', function () {
        S.code([3, 5]);
        var t = T.go({ sp2: [430, 212] }, {}, 0, 650);
        S.hide('sp2', { delay: t - 100 }); S.hide('e_sp2', { delay: t - 250 });
        S.set('x2', { label: '⋈ p2' }, { delay: t }); S.to('x2', { w: 120, stroke: C.green }, { delay: t, dur: 350 }); T.setW('x2', 120);
        S.pulse('x2', { delay: t, scale: 1.12 }); S.ripple(430, 212, { delay: t, color: C.green });
        T.go({ x2: [430, 152], x1: [300, 262], sp3: [620, 262], artist: [200, 372], appears: [400, 372], album: [620, 372] }, { x2: 'pi' }, t + 400, 800);
        ruleDone(S, 2, t + 400);
        S.data({ '笛卡尔积': 0 }, { delay: t }); S.log('σp2 + × → ⋈p2', { delay: t, kind: 'ok' });
      }, { hold: 1500 });
      S.step('④ 投影下推：顶上只要 artist.name → 连接之前就把用不到的列砍掉', function () {
        S.code([8, 12]); ruleOn(S, 3); S.data({ '当前规则': '规则 4 · 投影下推' }); S.log('artist 只留 id, name；appears 只留 artist_id, album_id');
        S.pulse('pi', { scale: 1.08 }); show('pA', 250); show('pP', 250);
        T.go({ x2: [430, 138], x1: [300, 290], sp3: [640, 366], album: [640, 446], artist: [190, 446], appears: [410, 446], pA: [190, 366], pP: [410, 366] },
          { pA: 'x1', artist: 'pA', pP: 'x1', appears: 'pP' }, 300, 950);
        S.ripple(190, 366, { delay: 1250, color: C.purple }); S.ripple(410, 366, { delay: 1250, color: C.purple });
        S.data({ '投影算子': 3 }, { delay: 1250 });
      }, { hold: 1500 });
      S.step('⋈ p1 之后，p1 用过的连接列也没用了 → 再插一个投影，只留 name 和 album_id', function () {
        S.code([13, 14]); S.log('⋈p1 之上只留 name, album_id');
        S.pulse('pi', { scale: 1.08 }); show('pJ', 200);
        var t = T.go({ pJ: [300, 214] }, { pJ: 'x2', x1: 'pJ' }, 250, 850);
        S.ripple(300, 214, { delay: t, color: C.purple }); S.data({ '投影算子': 4 }, { delay: t });
      });
      S.step('album 这边：过滤要用 name，所以投影放在过滤之上，只留 id 去参加连接', function () {
        S.code([9, 10]); S.log('σp3 之上只留 id');
        S.pulse('pi', { scale: 1.08 }); show('pL', 200);
        var t = T.go({ pL: [640, 290] }, { pL: 'x2', sp3: 'pL' }, 250, 850);
        S.ripple(640, 290, { delay: t, color: C.purple }); S.data({ '投影算子': 5 }, { delay: t });
      });
      S.step('1 个投影变成了 5 个。值不值得要看情况 —— 表很宽时收益极大', function () {
        S.code(16); ruleDone(S, 3, 300);
        ['pA', 'pP', 'pJ', 'pL'].forEach(function (id, i) { S.flash(id, C.purple, { delay: i * 200 }); S.pulse(id, { delay: i * 200, scale: 1.08 }); });
        S.log('四步逻辑改写完成，全程没问成本模型', { delay: 700, kind: 'ok' });
      }, { hold: 1800 });
    }
  },

  /* ───────────────────────── 场景 4：System R 自底向上搜索 ───────────────────────── */
  {
    name: 'System R：自底向上搜索',
    moving: '候选连接从下层的表向上长出连线；成本数字滚动；被剪掉的候选变红缩小；胜出的成本沿连线飞到上一层；最优路径整条变绿',
    lang: 'C++ 风格伪代码（示意）',
    code: [
      '// System R：自底向上的动态规划（只看左深树）',
      'for (Table t : tables)             // 第 1 步',
      '  best[{t}] = BestAccessPath(t);',
      'for (int n = 2; n <= N; n++)       // 一次一层',
      '  for (TableSet s : SubsetsOfSize(n))',
      '    for (Table t : s) {',
      '      TableSet l = s - {t};        // 左深',
      '      if (!Linked(l, t)) continue; // 笛卡尔积',
      '      for (Algo a : {Hash, SortMerge}) {',
      '        Plan p = Join(a, best[l], t);',
      '        if (Cost(p) < Cost(best[s]))',
      '          best[s] = p;             // 只留最优',
      '      }',
      '    }',
      'return best[AllTables];            // 第 4 步'
    ].join('\n'),
    build: function (S) {
      var TX = { artist: 170, appears: 430, album: 690 }, yT = 462, y1 = 310, y2 = 140;
      function grp(id, x, y, w, title, o) {
        mk(S, 'box', id, { x: x, y: y, w: w, h: 78, rx: 12, fill: C.panel, stroke: C.line, sw: 2, opacity: 0 }, o);
        S.text(id + 't', { x: x, y: y - 20, text: title, size: 16, weight: 600, opacity: 0 });
      }
      function cand(id, x, y, name) {
        S.box(id, { x: x, y: y, w: 124, h: 30, rx: 7, fill: C.cell, stroke: C.line, sw: 1.5, opacity: 0 });
        S.text(id + 'v', { x: x, y: y, val: 0, pre: name + ' ', size: 15, opacity: 0 });
      }
      function edge(id, x1, yy1, x2, yy2) { S.line(id, { x1: x1, y1: yy1, x2: x2, y2: yy2, stroke: C.line, sw: 2, opacity: 0, draw: 0 }); }
      S.text('note', { x: 20, y: 24, text: '访问方法和连接顺序照官方例子；成本数字是示意值', anchor: 'start', size: 14, color: C.mute });
      S.text('best', { x: 840, y: 24, text: '', anchor: 'end', size: 16, color: C.green, opacity: 0 });
      lab(S, 'l1', 20, 412, '① 访问方法', { opacity: 0 });
      lab(S, 'l2', 20, 244, '② 两表连接', { opacity: 0 });
      lab(S, 'l3', 20, 74, '③ 三表连接', { opacity: 0 });
      edge('eA1', 150, yT - 22, 130, y1 + 39); edge('eP1', 400, yT - 22, 200, y1 + 39);
      edge('eP3', 460, yT - 22, 660, y1 + 39); edge('eL3', 710, yT - 22, 730, y1 + 39);
      edge('eA2', 185, yT - 22, 400, y1 + 39); edge('eL2', 675, yT - 22, 460, y1 + 39);
      edge('eU1', 160, y1 - 39, 220, y2 + 39); edge('eU3', 700, y1 - 39, 640, y2 + 39);
      ['artist', 'appears', 'album'].forEach(function (t) {
        S.box(t, { x: TX[t], y: yT, w: 170, h: 44, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: t, size: 16 });
        S.box(t + 'A', { x: TX[t], y: yT + 50, w: 170, h: 30, rx: 15, fill: C.cell, stroke: 'none', sw: 0, label: t === 'album' ? '索引扫描（name）' : '顺序扫描', size: 14, color: t === 'album' ? C.green : C.ink, opacity: 0 });
      });
      grp('g1', 160, y1, 276, 'artist ⋈ appears'); grp('g2', 430, y1, 190, 'artist × album'); grp('g3', 700, y1, 276, 'appears ⋈ album');
      cand('c1h', 94, y1 + 16, '哈希'); cand('c1m', 226, y1 + 16, '归并'); cand('c3h', 634, y1 + 16, '哈希'); cand('c3m', 766, y1 + 16, '归并');
      S.text('g2n', { x: 430, y: y1 + 16, text: '没有连接条件', size: 14, color: C.red, opacity: 0 });
      grp('u1', 220, y2, 316, '(artist ⋈ appears) ⋈ album'); grp('u3', 640, y2, 316, '(appears ⋈ album) ⋈ artist');
      cand('d1h', 148, y2 + 16, '哈希'); cand('d1m', 292, y2 + 16, '归并'); cand('d3h', 568, y2 + 16, '哈希'); cand('d3m', 712, y2 + 16, '归并');
      S.data({ '层': '—', '候选数': 0, '已剪掉': 0, '当前最优': '—' });
      function pop2(id, t) { S.pop(id, { delay: t }); S.pop(id + 't', { delay: t + 100 }); }
      function grow(id, t) { S.set(id, { opacity: 1 }, { delay: t }); S.to(id, { draw: 1 }, { delay: t, dur: 500 }); }
      function cost(id, v, t) { S.pop(id, { delay: t }); S.pop(id + 'v', { delay: t }); S.count(id + 'v', v, { delay: t + 150, dur: 700 }); }
      function cut(id, t) {
        S.to(id, { stroke: C.red }, { delay: t, dur: 200 }); S.to(id + 'v', { color: C.red }, { delay: t, dur: 200 });
        S.to(id, { opacity: .3, scale: .85 }, { delay: t + 350, dur: 400 }); S.to(id + 'v', { opacity: .35, scale: .85 }, { delay: t + 350, dur: 400 });
      }
      function keep(id, t) { S.to(id, { stroke: C.green }, { delay: t, dur: 250 }); S.to(id + 'v', { color: C.green }, { delay: t, dur: 250 }); S.pulse(id, { delay: t }); S.pulse(id + 'v', { delay: t }); }

      S.step('第 1 步：为每张表挑访问方法 —— 只有 album 的过滤条件能用上 name 索引', function () {
        S.code([2, 3]); S.pop('l1'); S.data({ '层': '1 张表' }); S.log('挑访问方法（查目录）');
        ['artist', 'appears', 'album'].forEach(function (t, i) { S.flash(t, C.blue, { prop: 'stroke', delay: 200 + i * 350 }); S.pop(t + 'A', { delay: 350 + i * 350 }); });
        S.log('album → 索引扫描，其余顺序扫描', { delay: 1100, kind: 'ok' });
      }, { hold: 1500 });
      S.step('第 2 步：枚举两表连接。artist 和 album 之间没有连接条件 → 笛卡尔积，立刻扔掉', function () {
        S.code([4, 8]); S.pop('l2'); S.data({ '层': '2 张表', '候选数': 3 });
        grow('eA1', 0); grow('eP1', 100); pop2('g1', 450);
        grow('eP3', 250); grow('eL3', 350); pop2('g3', 700);
        grow('eA2', 500); grow('eL2', 600); pop2('g2', 950); S.pop('g2n', { delay: 1100 });
        S.to('g2', { stroke: C.red }, { delay: 1700, dur: 250 }); S.to('g2t', { color: C.red }, { delay: 1700, dur: 250 });
        ['g2', 'g2t', 'g2n'].forEach(function (id) { S.to(id, { opacity: 0, scale: .6 }, { delay: 2200, dur: 450, ease: 'in' }); });
        S.to('eA2', { draw: 0, opacity: 0 }, { delay: 2200, dur: 450 }); S.to('eL2', { draw: 0, opacity: 0 }, { delay: 2200, dur: 450 });
        S.data({ '候选数': 2, '已剪掉': 1 }, { delay: 2300 }); S.log('artist × album：笛卡尔积 → 剪掉', { delay: 1700, kind: 'err' });
      }, { hold: 1500 });
      S.step('剩下的每个连接再枚举物理算子（哈希连接、排序归并连接），逐个问成本模型', function () {
        S.code([9, 10]); S.log('枚举物理算子，估算成本');
        cost('c1h', 300, 0); cost('c1m', 520, 300); cost('c3h', 180, 700); cost('c3m', 260, 1000);
        S.data({ '候选数': 4 }, { delay: 1000 });
      }, { hold: 1500 });
      S.step('每条路径只留成本最低的那个，其余剪掉', function () {
        S.code([11, 12]);
        keep('c1h', 0); cut('c1m', 250); keep('c3h', 700); cut('c3m', 950);
        S.data({ '候选数': 2, '已剪掉': 3 }, { delay: 1300 }); S.log('留下：哈希 300、哈希 180', { delay: 1000, kind: 'ok' });
      }, { hold: 1500 });
      S.step('第 3 步：把上一层留下的最优结果和第三张表连接，成本在它的基础上累加', function () {
        S.code([4, 10]); S.pop('l3'); S.data({ '层': '3 张表' }); S.log('向上一层：和第三张表连接');
        grow('eU1', 0); pop2('u1', 400); grow('eU3', 300); pop2('u3', 700);
        S.fly([94, y1 + 16], [148, y2 + 16], { label: '300', w: 50, h: 26, color: C.green, delay: 900, dur: 650 }); S.fly([94, y1 + 16], [292, y2 + 16], { label: '300', w: 50, h: 26, color: C.green, delay: 1000, dur: 650 });
        cost('d1h', 550, 1500); cost('d1m', 720, 1650);
        S.fly([634, y1 + 16], [568, y2 + 16], { label: '180', w: 50, h: 26, color: C.green, delay: 1900, dur: 650 }); S.fly([634, y1 + 16], [712, y2 + 16], { label: '180', w: 50, h: 26, color: C.green, delay: 2000, dur: 650 });
        cost('d3h', 400, 2500); cost('d3m', 570, 2650);
        S.data({ '候选数': 4 }, { delay: 2650 });
      }, { hold: 1500 });
      S.step('同样每条路径只留最低的', function () {
        S.code([11, 12]);
        keep('d1h', 0); cut('d1m', 250); keep('d3h', 700); cut('d3m', 950);
        S.data({ '候选数': 2, '已剪掉': 5 }, { delay: 1300 }); S.log('留下：550 和 400', { delay: 1000 });
      }, { hold: 1500 });
      S.step('第 4 步：在所有从底到顶的完整路径里，挑全局成本最低的那条', function () {
        S.code(15);
        ['appears', 'album', 'eP3', 'eL3', 'g3', 'eU3', 'u3'].forEach(function (id, i) { S.to(id, { stroke: C.green }, { delay: i * 130, dur: 300 }); });
        S.to('g3t', { color: C.green }, { delay: 500, dur: 300 }); S.to('u3t', { color: C.green }, { delay: 800, dur: 300 }); S.pulse('u3', { delay: 900, scale: 1.05 });
        ['g1', 'g1t', 'u1', 'u1t', 'eA1', 'eP1', 'eU1', 'c1h', 'c1hv', 'd1h', 'd1hv'].forEach(function (id) { S.to(id, { opacity: .4 }, { delay: 900, dur: 400 }); });
        S.set('best', { text: '最优：(appears ⋈ album) ⋈ artist，哈希连接，成本 400' }, { delay: 1100 }); S.pop('best', { delay: 1100 });
        S.data({ '当前最优': '(appears ⋈ album) ⋈ artist = 400' }, { delay: 1100 }); S.log('全局最优：成本 400', { delay: 1100, kind: 'ok' });
      }, { hold: 1500 });
      S.step('这就是动态规划：一次只看一层。它只考虑左深树，所以并不保证找到真正的最优计划', function () {
        S.code([4, 7]);
        [['l1', 0], ['l2', 350], ['l3', 700]].forEach(function (p) { S.flash(p[0], C.ink, { prop: 'color', delay: p[1] }); S.pulse(p[0], { delay: p[1], scale: 1.04 }); });
        S.pulse('best', { delay: 1100, scale: 1.05 });
      }, { hold: 1800 });
    }
  }
  ]
});
})();
