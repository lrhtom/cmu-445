/* concept-core.js —— 第 3 页「核心原理 · 翻页图解」的纯函数部分：逐页累积状态、排版成舞台图元、校验排版。
 * 浏览器（window.ConceptCore）和 node（module.exports）共用，不碰 DOM。界面在 phase-ui.js。
 *
 * ── 数据写在 _content/Pn.json 的 phases[].concepts 里 ────────────────────────────
 * "intro": "这一阶段几节分别讲什么（一两句，显示在图解上方）"            ← phases[] 上的字段，可选
 * "concepts": [ {
 *    "t": "节标题：一个核心原理",
 *    "level": [难度 1–5, 重要程度 3 必会 / 2 重要 / 1 了解, "一句话理由"],
 *    "files": { "A": "src/buffer/arc_replacer.cpp" },     可选。写了就是「有源码」布局：左边源码栏，右边画图；不写是「整幅」布局
 *    "init": { 操作… },                                    可选。第 1 页之前先执行的操作（不显示）
 *    "pages": [ { "h": "页标题（≤20 字）", "say": "讲解（≤320 字，支持 `代码` 和 **粗体**，空行分段）",
 *                 "at": "A:36-50" 或 "A:10-12,20-22"（有源码的节才能写；几段合计 ≤27 行；第 1 页必须写，后面不写沿用上一页）,
 *                 操作… } ],                                至少 2 页，一般 3–8 页
 *    "sum": "一句话记住（最后一页显示）" } ]
 *
 * 操作（一页里可以写几种，按下面的顺序生效）：
 *   obj  : [ { "id": "c", "kind": "box", … } ]   新建对象；id 已存在就浅合并（只改写出来的字段）
 *   set  : { "c.nbytes": "10", "c.tone": "warn", "s.2": "x", "s.2.tone": "ok", "tb.1.2": "x", "n3.label": "7" }
 *          改盒子的一行（没有这一行就追加）、对象的 label/sub/tone/title/text/w/at、数组第 i 格（及其 tone/sub）、
 *          表格第 r 行第 c 列（从 0 数）、链表 / 树 / 数组里带 id 的节点字段、箭头的 from/to/label
 *   push : { "s.items": [ … ], "l.items": [ … ], "t.nodes": [ … ], "tb.rows": [ [ … ] ], "c.rows": [ ["键", "值"] ] }   追加（值必须是数组）
 *   del  : [ "e1", "c.nbytes", "s.3" ]           删对象（也会从链表 / 树里摘掉）、删盒子的一行、删数组第 i 格
 *   out  : "一行" 或 [ … ]                        终端输出（累计，显示在舞台下方的终端框）
 *   hl   : [ "e1", "c.nbytes", "s.2", "tb.1" ]    这一页额外高亮。这一页新建的对象、改过的行 / 格子会自动高亮，不用写
 * 盒子的值以「→」开头是指针（"→n1"），画一根线连到目标；要显示以箭头开头的普通文字就换成「⇒」。
 *
 * 画布：整幅 1000×560（图画在 x 8–992、y 8–552）；有源码时右边画图区 600×560（x 8–592）。坐标是左上角。用了 out 时终端框在舞台下方，不占画布。
 * 对象（kind）：
 *   box   at, title, sub, rows: [[键, 值], …], w(默认 200), tone, dash        高 = 30 + 22×行数 + 6（没有行时 44）
 *   node  at, label, sub, w(默认 90), tone                                    高 44
 *   slice at, title, items(字符串或 {id, v, w, tone, sub}), cw(默认 56), idx(默认 true，格子下面写下标；有 sub 时写 sub)
 *         标题占 20，格子高 34，下面一行小字 16：总高 70（没有标题 50）
 *   list  at, title, items: [{id, label, sub, tone}], dir: "h"|"v", nw(默认 90), gap(默认 34), dbl(双向箭头)
 *   tree  at, title, nodes: [{id, label, sub, parent, tone}], nw(默认 90), gx(默认 14), gy(默认 40)   每层 44 + gy
 *   table at, title, cols: [表头…], rows: [[…], …], cw: [各列宽]（不写按内容算）   高 = (标题 20) + 26 + 24×行数
 *   text  at, text(\n 换行), w(默认 240), tone(默认 note 便签), mono(等宽字)      高 = 行数×17 + 12
 *   arrow from, to, label, tone, dash                                         没有 at
 *   tag   on(贴在哪个对象旁边), text, side: top|right|bottom|left(默认 top), tone 没有 at
 * tone：heap 蓝（默认）、map 绿、ok 绿底（成功 / 结论）、go 紫（线程）、ext 灰虚线（外部：磁盘、别的模块）、
 *       warn 红（淘汰 / 出错）、chan 黄（锁、等待、正在处理）、virt 浅蓝、note 便签
 * 文字宽度：中文每字约 1 个字号宽、英文数字约 0.6 个字号宽；标题 14px、行 12.5px、格子 14px、表格 13.5px、便签 13px。
 */
(function (root) {
'use strict';
var FULL = 1000, SRCW = 600, H = 560;
var FIELDS = { label: 1, sub: 1, tone: 1, title: 1, text: 1, w: 1, at: 1, from: 1, to: 1, dash: 1, side: 1, on: 1, cw: 1, nw: 1 };
function tw(s, f) { var w = 0; s = String(s == null ? '' : s); for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e7f ? 1 : .6; return w * f; }
function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
function isPtr(v) { return typeof v === 'string' && v.charAt(0) === '→'; }
function isNum(x) { return /^\d+$/.test(x); }

/* ════════ 状态 ════════ */
function newMark() { return { obj: {}, rows: {}, cells: {}, trows: {} }; }
function empty() { return { objs: {}, order: [], out: [], at: null, mark: newMark(), hl: [] }; }
function itemsOf(o) { return o.kind === 'tree' ? (o.nodes = o.nodes || []) : o.kind === 'table' ? (o.rows = o.rows || []) : (o.items = o.items || []); }
function findNode(s, id) {
  for (var i = 0; i < s.order.length; i++) {
    var o = s.objs[s.order[i]];
    if (!o || ['slice', 'list', 'tree'].indexOf(o.kind) < 0) continue;
    var arr = itemsOf(o);
    for (var j = 0; j < arr.length; j++) if (arr[j] && typeof arr[j] === 'object' && arr[j].id === id) return { c: o, i: j, item: arr[j] };
  }
  return null;
}
function mark(m, cat, id, key) { (m[cat][id] = m[cat][id] || {})[key] = 1; }
function setPath(s, path, v, err) {
  var parts = path.split('.'), o = s.objs[parts[0]], rest = parts.slice(1);
  if (o) {
    if (rest.length === 1 && FIELDS[rest[0]] && o.kind !== 'box' || rest.length === 1 && FIELDS[rest[0]] && ['title', 'sub', 'tone', 'w', 'at', 'dash'].indexOf(rest[0]) >= 0) {
      o[rest[0]] = clone(v); s.mark.obj[o.id] = 1; return;
    }
    if (o.kind === 'box') {
      var key = rest.join('.'), rows = o.rows = o.rows || [], hit = null;
      rows.forEach(function (r) { if (r[0] === key) hit = r; });
      if (hit) hit[1] = v; else rows.push([key, v]);
      mark(s.mark, 'rows', o.id, key); return;
    }
    if (o.kind === 'table' && rest.length === 2 && isNum(rest[0]) && isNum(rest[1])) {
      var r = (o.rows = o.rows || [])[+rest[0]];
      if (!r) return err && err('set ' + path + '：表格没有第 ' + rest[0] + ' 行');
      r[+rest[1]] = v; mark(s.mark, 'trows', o.id, +rest[0]); return;
    }
    if (['slice', 'list', 'tree'].indexOf(o.kind) >= 0 && rest.length && isNum(rest[0])) {
      var arr = itemsOf(o), k = +rest[0];
      if (k >= arr.length) return err && err('set ' + path + '：第 ' + k + ' 格不存在');
      if (rest.length === 1) { if (arr[k] && typeof arr[k] === 'object') arr[k][o.kind === 'slice' ? 'v' : 'label'] = v; else arr[k] = v; }
      else { if (typeof arr[k] !== 'object') arr[k] = { v: arr[k] }; arr[k][rest[1]] = v; }
      mark(s.mark, 'cells', o.id, k); return;
    }
    return err && err('set ' + path + '：不认识的写法');
  }
  var n = findNode(s, parts[0]);
  if (n) { n.item[rest[0] || (n.c.kind === 'slice' ? 'v' : 'label')] = v; mark(s.mark, 'cells', n.c.id, n.i); return; }
  if (err) err('set ' + path + '：找不到对象 ' + parts[0]);
}
function pushPath(s, path, arr, err) {
  var parts = path.split('.'), o = s.objs[parts[0]];
  if (!o || !Array.isArray(arr)) return err && err('push ' + path + '：对象不存在或值不是数组');
  var f = parts[1] || (o.kind === 'tree' ? 'nodes' : o.kind === 'table' || o.kind === 'box' ? 'rows' : 'items'), cur = o[f] = o[f] || [], n0 = cur.length;
  arr.forEach(function (x) { cur.push(clone(x)); });
  for (var i = n0; i < cur.length; i++) {
    if (o.kind === 'box') mark(s.mark, 'rows', o.id, cur[i][0]);
    else if (o.kind === 'table') mark(s.mark, 'trows', o.id, i);
    else mark(s.mark, 'cells', o.id, i);
  }
}
function delPath(s, path, err) {
  var parts = path.split('.'), o = s.objs[parts[0]];
  if (o && parts.length === 1) { delete s.objs[o.id]; s.order = s.order.filter(function (x) { return x !== o.id; }); return; }
  if (o && o.kind === 'box') { var key = parts.slice(1).join('.'); o.rows = (o.rows || []).filter(function (r) { return r[0] !== key; }); return; }
  if (o && parts.length === 2 && isNum(parts[1])) { itemsOf(o).splice(+parts[1], 1); return; }
  var n = findNode(s, parts[0]);
  if (n && parts.length === 1) { itemsOf(n.c).splice(n.i, 1); return; }
  if (err) err('del ' + path + '：找不到');
}
function apply(st, pg, err) {
  var s = clone(st); s.mark = newMark(); s.hl = (pg.hl || []).slice();
  if (pg.at) s.at = pg.at;
  (pg.obj || []).forEach(function (o) {
    if (!o.id) return err && err('obj 缺少 id');
    var ex = s.objs[o.id];
    if (ex) { for (var k in o) ex[k] = clone(o[k]); }
    else { s.objs[o.id] = clone(o); s.order.push(o.id); }
    s.mark.obj[o.id] = 1;
  });
  Object.keys(pg.set || {}).forEach(function (p) { setPath(s, p, pg.set[p], err); });
  Object.keys(pg.push || {}).forEach(function (p) { pushPath(s, p, pg.push[p], err); });
  (pg.del || []).forEach(function (p) { delPath(s, p, err); });
  if (pg.out != null) s.out = s.out.concat(Array.isArray(pg.out) ? pg.out : [pg.out]);
  return s;
}
/* 一节的全部页：返回每一页的状态 */
function run(concept, err) {
  var s = empty(), out = [];
  if (concept.init) { s = apply(s, concept.init, err); s.mark = newMark(); }
  (concept.pages || []).forEach(function (pg, i) {
    s = apply(s, pg, err && function (m) { err('第 ' + (i + 1) + ' 页：' + m); });
    out.push(s);
  });
  return out;
}

/* ════════ 排版：状态 → 舞台图元 ════════ */
function toneOf(P, t) {
  switch (t) {
    case 'map': return { stroke: P.feat, fill: P.paper };
    case 'ok': return { stroke: P.feat, fill: P.newBg };
    case 'go': return { stroke: P.frame, fill: P.frameBg };
    case 'ext': return { stroke: P.ext, fill: P.soft, dash: '5 4' };
    case 'warn': case 'key': return { stroke: P.tok, fill: P.paper };
    case 'chan': return { stroke: P.hot, fill: P.hotBg };
    case 'virt': return { stroke: P.core, fill: P.visit };
    case 'note': return { stroke: P.hot, fill: P.hotBg, dash: '4 3' };
    default: return { stroke: P.core, fill: P.paper };
  }
}
function layout(s, P, src) {
  var items = [], rects = {}, texts = [], refs = {}, edges = [], hlSet = {};
  (s.hl || []).forEach(function (x) { hlSet[x] = 1; });
  var area = { w: src ? SRCW : FULL, h: H };
  function rect(eid, x, y, w, h, owner, kind) { rects[eid] = { id: eid, x: x, y: y, w: w, h: h, owner: owner, kind: kind }; }
  function hot(o, key) { return s.mark.obj[o] || hlSet[o] || (key != null && hlSet[o + '.' + key]); }
  function title(o, x, y) {
    if (!o.title) return 0;
    var tww = Math.max(40, tw(o.title, 12.5) + 4);
    items.push({ id: 't:' + o.id, type: 'txt', x: x, y: y - 2, w: tww, h: 18, lines: [o.title], size: 12.5, bold: true, tc: P.mute });
    texts.push({ id: o.id + ' 的标题', text: o.title, room: 1e9 });
    rect('t:' + o.id, x, y - 2, tww, 18, o.id, 'title');   /* 标题也参与重叠 / 出界检查（线穿过标题不算） */
    return 20;
  }
  s.order.forEach(function (id) {
    var o = s.objs[id]; if (!o) return;
    var at = o.at || [0, 0], x = at[0], y = at[1], T = toneOf(P, o.tone), on = hot(id);
    if (o.kind === 'box') {
      var rows = (o.rows || []).map(function (r, i) {
        if (isPtr(r[1])) edges.push({ id: 'p:' + id + '#' + i, from: id, rowFrom: i, to: r[1].slice(1) });
        return [r[0], isPtr(r[1]) ? '' : String(r[1]), isPtr(r[1]) ? 1 : 0];
      });
      var w = o.w || 200, h = rows.length ? 30 + 22 * rows.length + 6 : 44, hlr = [];
      rows.forEach(function (r, i) { if ((s.mark.rows[id] || {})[r[0]] || hlSet[id + '.' + r[0]]) hlr.push(i); });
      items.push({ id: 'k:' + id, type: 'box', x: x, y: y, w: w, h: h, title: o.title || '', sub: o.sub || '', rows: rows, hlRows: hlr,
        stroke: on ? P.hot : T.stroke, fill: T.fill, dash: o.dash ? '5 4' : (T.dash || ''), sw: on ? 2.6 : 1.6 });
      rect('k:' + id, x, y, w, h, id, 'box'); refs[id] = 'k:' + id;
      texts.push({ id: id + ' 的标题', text: (o.title || '') + (o.sub ? '  ' + o.sub : ''), size: 14, room: w - 20 });
      rows.forEach(function (r) { texts.push({ id: id + '.' + r[0], text: r[0] + '  ' + r[1], size: 12.5, room: w - 22, mono: true }); });
    } else if (o.kind === 'node') {
      var nw = o.w || 90;
      items.push({ id: 'k:' + id, type: 'box', x: x, y: y, w: nw, h: 44, title: o.label || '', sub: o.sub || '', rows: [], stroke: on ? P.hot : T.stroke, fill: T.fill, dash: T.dash || '', sw: on ? 2.6 : 1.6 });
      rect('k:' + id, x, y, nw, 44, id, 'node'); refs[id] = 'k:' + id;
      texts.push({ id: id, text: o.label || '', size: 14, room: nw - 12 }); texts.push({ id: id + ' 的副标题', text: o.sub || '', size: 11, room: nw - 10 });
    } else if (o.kind === 'text') {
      var lines = String(o.text || '').split('\n'), tww = o.w || 240, th = lines.length * 17 + 12, Tn = o.tone ? T : toneOf(P, 'note');
      items.push({ id: 'k:' + id, type: 'txt', x: x, y: y, w: tww, h: th, lines: lines, mono: !!o.mono, size: 13, fill: Tn.fill, stroke: on ? P.hot : Tn.stroke, dash: Tn.dash || '', sw: on ? 2 : 1.2 });
      rect('k:' + id, x, y, tww, th, id, 'text'); refs[id] = 'k:' + id;
      lines.forEach(function (l, i) { texts.push({ id: id + ' 第 ' + (i + 1) + ' 行', text: l, size: 13, room: tww - 18, mono: !!o.mono }); });
    } else if (o.kind === 'slice') {
      var dy = title(o, x, y), cx = x, cells = itemsOf(o), first = null;
      cells.forEach(function (it, i) {
        var obj = typeof it === 'object' && it ? it : { v: it }, cw = obj.w || o.cw || 56, cid = obj.id || id + '.' + i, CT = toneOf(P, obj.tone || o.tone);
        var chot = on || (s.mark.cells[id] || {})[i] || hlSet[id + '.' + i] || (obj.id && hlSet[obj.id]);
        items.push({ id: 'k:' + cid, type: 'box', x: cx, y: y + dy, w: cw, h: 34, title: String(obj.v == null ? '' : obj.v), sub: '', rows: [], stroke: chot ? P.hot : CT.stroke, fill: CT.fill, dash: CT.dash || '', sw: chot ? 2.6 : 1.4 });
        rect('k:' + cid, cx, y + dy, cw, 34, id, 'cell'); refs[cid] = 'k:' + cid; refs[id + '.' + i] = 'k:' + cid; if (!first) first = 'k:' + cid;
        texts.push({ id: id + ' 第 ' + i + ' 格', text: String(obj.v == null ? '' : obj.v), size: 14, room: cw - 8 });
        var lab = obj.sub != null ? obj.sub : (o.idx === false ? '' : String(i));
        if (lab !== '') {
          items.push({ id: 'i:' + cid, type: 'txt', x: cx, y: y + dy + 34, w: cw, h: 16, lines: [lab], size: 11, tc: P.mute });
          texts.push({ id: id + ' 第 ' + i + ' 格下面的字', text: lab, size: 11, room: cw - 2 });
        }
        cx += cw;
      });
      refs[id] = first; rect('g:' + id, x, y, Math.max(cx - x, o.title ? tw(o.title, 12.5) : 0), dy + 50, id, 'group');
    } else if (o.kind === 'list') {
      var dy2 = title(o, x, y), ns = itemsOf(o), lw = o.nw || 90, gap = o.gap == null ? 34 : o.gap, vert = o.dir === 'v';
      ns.forEach(function (n, i) {
        var nx = vert ? x : x + i * (lw + gap), ny = vert ? y + dy2 + i * (44 + gap) : y + dy2, NT = toneOf(P, n.tone || o.tone), nh = on || (s.mark.cells[id] || {})[i] || hlSet[n.id];
        items.push({ id: 'k:' + n.id, type: 'box', x: nx, y: ny, w: lw, h: 44, title: n.label || '', sub: n.sub || '', rows: [], stroke: nh ? P.hot : NT.stroke, fill: NT.fill, dash: NT.dash || '', sw: nh ? 2.6 : 1.4 });
        rect('k:' + n.id, nx, ny, lw, 44, id, 'cell'); refs[n.id] = 'k:' + n.id;
        texts.push({ id: n.id, text: n.label || '', size: 14, room: lw - 12 }); texts.push({ id: n.id + ' 的副标题', text: n.sub || '', size: 11, room: lw - 10 });
        if (i) edges.push({ id: 'l:' + id + '.' + i, from: ns[i - 1].id, to: n.id, bidir: !!o.dbl, link: true });
      });
      if (ns[0]) refs[id] = 'k:' + ns[0].id;
    } else if (o.kind === 'tree') {
      var dy3 = title(o, x, y), nodes = itemsOf(o), tn = o.nw || 90, gx = o.gx == null ? 14 : o.gx, gy = o.gy == null ? 40 : o.gy;
      var kids = {}, byId = {}, roots = [];
      nodes.forEach(function (n) { byId[n.id] = n; kids[n.id] = []; });
      nodes.forEach(function (n) { if (n.parent && byId[n.parent]) kids[n.parent].push(n.id); else roots.push(n.id); });
      var pos = {}, leaf = 0;
      function place(id2, d) {
        if (!kids[id2].length) { pos[id2] = { x: x + leaf * (tn + gx), d: d }; leaf++; return pos[id2].x; }
        var xs = kids[id2].map(function (c) { return place(c, d + 1); });
        pos[id2] = { x: (xs[0] + xs[xs.length - 1]) / 2, d: d }; return pos[id2].x;
      }
      roots.forEach(function (r) { place(r, 0); });
      nodes.forEach(function (n, i) {
        var p = pos[n.id], nx = p.x, ny = y + dy3 + p.d * (44 + gy), NT = toneOf(P, n.tone || o.tone), nh = on || (s.mark.cells[id] || {})[i] || hlSet[n.id];
        var nwid = n.w || tn;
        items.push({ id: 'k:' + n.id, type: 'box', x: nx, y: ny, w: nwid, h: 44, title: n.label || '', sub: n.sub || '', rows: [], stroke: nh ? P.hot : NT.stroke, fill: NT.fill, dash: NT.dash || '', sw: nh ? 2.6 : 1.4 });
        rect('k:' + n.id, nx, ny, nwid, 44, id, 'cell'); refs[n.id] = 'k:' + n.id;
        texts.push({ id: n.id, text: n.label || '', size: 14, room: nwid - 12 }); texts.push({ id: n.id + ' 的副标题', text: n.sub || '', size: 11, room: nwid - 10 });
        if (n.parent && byId[n.parent]) edges.push({ id: 'tr:' + n.id, from: n.parent, to: n.id, link: true });
      });
      if (nodes[0]) refs[id] = 'k:' + nodes[0].id;
    } else if (o.kind === 'table') {
      var dy4 = title(o, x, y), cols = o.cols || [], trs = o.rows || [];
      var cw = o.cw || cols.map(function (c, k) { return Math.max.apply(null, [tw(c, 13.5)].concat(trs.map(function (r) { return tw(r[k] == null ? '' : r[k], 13.5); }))) + 20; });
      var tw0 = cw.reduce(function (a, b) { return a + b; }, 0), thh = 26 + 24 * trs.length, hl2 = [];
      trs.forEach(function (r, i) { if ((s.mark.trows[id] || {})[i] || hlSet[id + '.' + i]) hl2.push(i); });
      items.push({ id: 'k:' + id, type: 'table', x: x, y: y + dy4, w: tw0, h: thh, cols: cols, rows: trs.map(function (r) { return r.map(String); }), colW: cw, hlRows: hl2, stroke: on ? P.hot : T.stroke, fill: P.paper, sw: on ? 2.4 : 1.4 });
      rect('k:' + id, x, y + dy4, tw0, thh, id, 'table'); refs[id] = 'k:' + id;
      [cols].concat(trs).forEach(function (r, ri) { r.forEach(function (v, k) { texts.push({ id: id + ' 第 ' + ri + ' 行第 ' + k + ' 列', text: v, size: 13.5, room: cw[k] - 12, mono: ri > 0 }); }); });
    }
  });
  /* 第二遍：贴在别的对象旁边的标签、箭头 */
  s.order.forEach(function (id) {
    var o = s.objs[id]; if (!o) return;
    if (o.kind === 'tag') {
      var tgt = rects[refs[o.on]] || rects['g:' + o.on];
      if (!tgt) { texts.push({ id: id, missing: '标签贴的对象 ' + o.on + ' 不存在' }); return; }
      var w = tw(o.text, 12) + 16, hh = 22, side = o.side || 'top', tx = tgt.x, ty = tgt.y - hh - 4;
      if (side === 'right') { tx = tgt.x + tgt.w + 6; ty = tgt.y + (tgt.h - hh) / 2; }
      else if (side === 'bottom') { ty = tgt.y + tgt.h + 4; }
      else if (side === 'left') { tx = tgt.x - w - 6; ty = tgt.y + (tgt.h - hh) / 2; }
      var TT = toneOf(P, o.tone || 'chan'), on2 = hot(id);
      items.push({ id: 'k:' + id, type: 'txt', x: tx, y: ty, w: w, h: hh, lines: [o.text || ''], size: 12, fill: TT.fill, stroke: on2 ? P.hot : TT.stroke, sw: on2 ? 2 : 1.2 });
      rect('k:' + id, tx, ty, w, hh, id, 'tag'); rects['k:' + id].on = tgt.id; refs[id] = 'k:' + id;
    } else if (o.kind === 'arrow') {
      edges.push({ id: 'a:' + id, from: o.from, to: o.to, label: o.label || '', tone: o.tone, dash: o.dash, own: id });
    }
  });
  var miss = [];
  edges.forEach(function (e) {
    var a = refs[e.from], b = refs[e.to];
    if (!a || !b) { miss.push((e.own ? '箭头 ' + e.own : e.id) + ' 的' + (!a ? '起点 ' + e.from : '终点 ' + e.to) + ' 不存在'); return; }
    var T = toneOf(P, e.tone), on = e.own && hot(e.own);
    items.push({ id: e.id, type: 'edge', a: a, b: b, rowFrom: e.rowFrom, label: e.label || '', bidir: !!e.bidir, stroke: on ? P.hot : (e.tone ? T.stroke : (e.rowFrom != null ? P.obj : P.line)), sw: on ? 2.4 : 1.6, dash: e.dash ? '5 4' : '' });
    e.a = a; e.b = b;
  });
  texts.forEach(function (t) { if (t.missing) miss.push(t.missing); });
  return { items: items, rects: rects, texts: texts.filter(function (t) { return !t.missing; }), edges: edges.filter(function (e) { return e.a && e.b; }), missing: miss, area: area };
}

/* ════════ 校验 ════════ */
function textW(t) { return t.mono ? t.text.length * t.size * .62 + (tw(t.text, t.size) - String(t.text).length * t.size * .6 > 0 ? tw(t.text, t.size) - String(t.text).length * t.size * .6 : 0) : tw(t.text, t.size); }
function segHits(x1, y1, x2, y2, r) {
  /* 线段和矩形（内缩 2px）相交 */
  var L = r.x + 2, R = r.x + r.w - 2, T = r.y + 2, B = r.y + r.h - 2;
  if (Math.max(x1, x2) < L || Math.min(x1, x2) > R || Math.max(y1, y2) < T || Math.min(y1, y2) > B) return false;
  function inside(x, y) { return x > L && x < R && y > T && y < B; }
  if (inside(x1, y1) || inside(x2, y2)) return true;
  function cross(ax, ay, bx, by, cx, cy, dx, dy) {
    var d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
    var u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return u > 0 && u < 1 && v > 0 && v < 1;
  }
  return cross(x1, y1, x2, y2, L, T, R, T) || cross(x1, y1, x2, y2, R, T, R, B) || cross(x1, y1, x2, y2, L, B, R, B) || cross(x1, y1, x2, y2, L, T, L, B);
}
function clipPt(n, dx, dy) { var hw = n.w / 2 + 2, hh = n.h / 2 + 2, t = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9); return [n.x + n.w / 2 + dx * t, n.y + n.h / 2 + dy * t]; }
function edgePath(e, rects) {
  var a = rects[e.a], b = rects[e.b];
  if (e.rowFrom != null) {
    var x1 = a.x + a.w - 4, y1 = a.y + 30 + e.rowFrom * 22 + 11, x2 = b.x, y2 = b.y + 15; if (x2 < x1) x2 = b.x + b.w;
    var mx = (x1 + x2) / 2, pts = [];
    for (var t = 0; t <= 1.0001; t += .125) { var u = 1 - t; pts.push([u * u * u * x1 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x2, u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2]); }
    return pts;
  }
  var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  return [clipPt(a, bx - ax, by - ay), clipPt(b, ax - bx, ay - by)];
}
function audit(L, prevSig) {
  var errs = [], R = L.rects, ids = Object.keys(R).filter(function (k) { return R[k].kind !== 'group'; }), A = L.area;
  L.missing.forEach(function (m) { errs.push(m); });
  ids.forEach(function (k) {
    var r = R[k];
    if (r.x < 4 || r.y < 4 || r.x + r.w > A.w - 4 || r.y + r.h > A.h - 4) errs.push(r.owner + ' 出界：x ' + Math.round(r.x) + '–' + Math.round(r.x + r.w) + '，y ' + Math.round(r.y) + '–' + Math.round(r.y + r.h) + '（画图区 ' + A.w + '×' + A.h + '）');
  });
  for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
    var a = R[ids[i]], b = R[ids[j]];
    if (a.owner === b.owner && a.kind === 'cell' && b.kind === 'cell') { /* 同一个容器里的格子可以相邻 */ }
    if (a.on === b.id || b.on === a.id) continue;
    var ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) errs.push(a.owner + (a.owner !== b.owner ? ' 和 ' + b.owner : ' 里的两个格子') + ' 重叠');
  }
  L.texts.forEach(function (t) { if (t.text && textW(t) > t.room + .5) errs.push('字被截断：' + t.id + '「' + String(t.text).slice(0, 24) + '」需要约 ' + Math.round(textW(t)) + 'px，只有 ' + Math.round(t.room) + 'px'); });
  L.edges.forEach(function (e) {
    var pts = edgePath(e, R), A2 = R[e.a], B2 = R[e.b];
    ids.forEach(function (k) {
      var r = R[k];
      if (k === e.a || k === e.b || r.kind === 'group' || r.kind === 'title') return;
      if (A2 && (r.owner === A2.owner && r.kind !== 'cell') || B2 && (r.owner === B2.owner && r.kind !== 'cell')) return;
      if (e.link && (r.owner === A2.owner || r.owner === B2.owner) && r.kind === 'cell') { /* 同一个链表 / 树里的节点，只查穿过别的节点 */ }
      for (var q = 0; q + 1 < pts.length; q++) if (segHits(pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1], r)) { errs.push('线 ' + e.id + ' 从 ' + r.owner + ' 身上穿过去'); break; }
    });
  });
  var sig = JSON.stringify(L.items.map(function (it) { return [it.id, Math.round(it.x || 0), Math.round(it.y || 0), Math.round(it.w || 0), it.title, it.rows, it.lines, it.label, it.stroke, it.hlRows, it.a, it.b]; }));
  return { errs: errs, sig: sig };
}

var Core = { FULL: FULL, SRCW: SRCW, H: H, empty: empty, apply: apply, run: run, layout: layout, audit: audit, tw: tw, toneOf: toneOf };
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
root.ConceptCore = Core;
})(typeof window !== 'undefined' ? window : globalThis);
