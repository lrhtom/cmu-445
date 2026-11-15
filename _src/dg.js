/* dg.js —— 静态图表：流程图(flow) / 时序图(seq) / 分层图(layers)。颜色走 CSS 变量，跟随明暗主题。
 *
 * flow  : { dir:'TB'|'LR', nodes:[{id,label,kind:'box|pill|diamond',c:'blue|green|amber|red|purple'}],
 *           edges:[[from,to,label?,{dash,c,back}]] }      label 里用 \n 换行；回边(指向上游)加 back:true
 * seq   : { actors:['A','B'], msgs:[[from,to,label,{dash,c}], {note:'文字', over:['A','B']}] }   from==to 为自调用
 * layers: { rows:[{tag,label,desc,c}] }                    自上而下的分层 / 对比条
 */
(function (root) {
'use strict';
var NS = 'http://www.w3.org/2000/svg', FS = 14, LHT = 20;
function s(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }
function tw(t, fs) { var w = 0, i, c; t = String(t); for (i = 0; i < t.length; i++) { c = t.charCodeAt(i); w += c > 0x2e7f ? 1 : c >= 0x41 && c <= 0x5a ? .68 : .56; } return w * (fs || FS); }
function lines(t) { return String(t == null ? '' : t).split('\n'); }
function maxW(ls, fs) { return Math.max.apply(null, ls.map(function (l) { return tw(l, fs); })); }
function mtext(g, ls, x, y, fs, cls) {
  var y0 = y - (ls.length - 1) * LHT / 2;
  ls.forEach(function (l, i) { g.appendChild(s('text', { x: x, y: y0 + i * LHT, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs || FS, 'class': cls }, l)); });
}
function arrow(svg, x1, y1, x2, y2, cls) {
  var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, a = 9, w = 4.2;
  svg.appendChild(s('polygon', { 'class': 'dg-ah ' + cls, points: x2 + ',' + y2 + ' ' + (x2 - ux * a - uy * w) + ',' + (y2 - uy * a + ux * w) + ' ' + (x2 - ux * a + uy * w) + ',' + (y2 - uy * a - ux * w) }));
}
function elabel(svg, x, y, t) {
  var ls = lines(t), w = maxW(ls, 12.5) + 10, hgt = ls.length * 17 + 4;
  svg.appendChild(s('rect', { 'class': 'dg-el-bg', x: x - w / 2, y: y - hgt / 2, width: w, height: hgt, rx: 4 }));
  ls.forEach(function (l, i) { svg.appendChild(s('text', { 'class': 'dg-el', x: x, y: y - (ls.length - 1) * 8.5 + i * 17, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, l)); });
}
/* 从矩形中心沿 (dx,dy) 方向走到边界 */
function clip(n, dx, dy) {
  var hw = n.w / 2 + 2, hh = n.h / 2 + 2, t = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9);
  return [n.x + dx * t, n.y + dy * t];
}

function flow(spec) {
  var N = {}, order = [], i, e, changed, guard = 0, GX = 44, GY = 56, LR = spec.dir === 'LR';
  spec.nodes.forEach(function (n) {
    var ls = lines(n.label), o = { id: n.id, ls: ls, kind: n.kind || 'box', c: n.c || '', layer: 0 };
    o.w = Math.max(maxW(ls) + 30, 84); o.h = ls.length * LHT + 20;
    if (o.kind === 'diamond') { o.w += 40; o.h += 18; }
    N[n.id] = o; order.push(o);
  });
  var E = (spec.edges || []).map(function (a) { return { a: N[a[0]], b: N[a[1]], label: a[2] || '', o: a[3] || {} }; });
  E.forEach(function (e) { if (!e.a || !e.b) throw new Error('flow: 边引用了不存在的节点'); });
  do {
    changed = false;
    for (i = 0; i < E.length; i++) { e = E[i]; if (!e.o.back && e.a !== e.b && e.b.layer < e.a.layer + 1) { e.b.layer = e.a.layer + 1; changed = true; } }
  } while (changed && ++guard < 60);
  var layers = [];
  order.forEach(function (n) { (layers[n.layer] || (layers[n.layer] = [])).push(n); });
  for (i = 0; i < layers.length; i++) if (!layers[i]) layers[i] = [];
  var main = 0, cross = [], maxCross = 0;
  layers.forEach(function (ly, k) {
    var thick = Math.max.apply(null, ly.map(function (n) { return LR ? n.w : n.h; }).concat([0]));
    var span = ly.reduce(function (a, n) { return a + (LR ? n.h : n.w); }, 0) + Math.max(0, ly.length - 1) * (LR ? 26 : GX);
    cross[k] = span; if (span > maxCross) maxCross = span;
    ly.forEach(function (n) { if (LR) n.x = main + thick / 2; else n.y = main + thick / 2; });
    main += thick + (LR ? GX + 26 : GY);
  });
  main -= (LR ? GX + 26 : GY);
  layers.forEach(function (ly, k) {
    var p = (maxCross - cross[k]) / 2;
    ly.forEach(function (n) { if (LR) { n.y = p + n.h / 2; p += n.h + 26; } else { n.x = p + n.w / 2; p += n.w + GX; } });
  });
  var pad = 46, W = (LR ? main : maxCross) + pad * 2, H = (LR ? maxCross : main) + pad * 2;
  order.forEach(function (n) { n.x += pad; n.y += pad; });
  var svg = s('svg', {}), bx0 = 0, by0 = 0, bx1 = W, by1 = H, nLong = 0;
  function ext(x, y) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  function lab(x, y, t) { var ls = lines(t), w = maxW(ls, 12.5) / 2 + 8, hh = ls.length * 8.5 + 4; ext(x - w, y - hh); ext(x + w, y + hh); elabel(svg, x, y, t); }
  E.forEach(function (e) {
    var cls = (e.o.dash ? 'dash ' : '') + (e.o.c ? 'c-' + e.o.c : ''), a = e.a, b = e.b, p1, p2, mx, my, far = 0, k, lo, hi;
    if (e.o.back || a === b) {
      /* 回边：从侧面绕一条弧线 */
      var off = (LR ? -1 : 1) * (Math.max(a.w, b.w) / 2 + 34), cx = LR ? (a.x + b.x) / 2 : Math.max(a.x, b.x) + off + 20, cy = LR ? Math.min(a.y, b.y) - Math.max(a.h, b.h) / 2 - 40 : (a.y + b.y) / 2;
      if (a === b) { cx = a.x + a.w / 2 + 46; cy = a.y; }
      p1 = clip(a, cx - a.x, cy - a.y + (a === b ? -8 : 0)); p2 = clip(b, cx - b.x, cy - b.y + (a === b ? 8 : 0));
      svg.appendChild(s('path', { 'class': 'dg-e ' + cls, d: 'M' + p1[0] + ',' + p1[1] + ' Q' + cx + ',' + cy + ' ' + p2[0] + ',' + p2[1] }));
      arrow(svg, cx, cy, p2[0], p2[1], cls); mx = (p1[0] + 2 * cx + p2[0]) / 4; my = (p1[1] + 2 * cy + p2[1]) / 4;
      ext(cx, cy);
    } else if (Math.abs(b.layer - a.layer) > 1) {
      /* 跨层的边：从侧面绕过中间那些节点，不从它们身上穿过去 */
      lo = Math.min(a.layer, b.layer); hi = Math.max(a.layer, b.layer);
      for (k = lo; k <= hi; k++) layers[k].forEach(function (n) { var v = LR ? n.y + n.h / 2 : n.x + n.w / 2; if (v > far) far = v; });
      far += 44 + nLong * 16; nLong++;
      if (LR) {
        p1 = [a.x, a.y + a.h / 2 + 2]; p2 = [b.x, b.y + b.h / 2 + 2];
        svg.appendChild(s('path', { 'class': 'dg-e ' + cls, d: 'M' + p1[0] + ',' + p1[1] + ' C' + p1[0] + ',' + far + ' ' + p2[0] + ',' + far + ' ' + p2[0] + ',' + (p2[1] + 6) }));
        arrow(svg, p2[0], far, p2[0], p2[1], cls); mx = (p1[0] + p2[0]) / 2; my = (p1[1] + 3 * far + 3 * far + p2[1]) / 8; ext(mx, far);
      } else {
        p1 = [a.x + a.w / 2 + 2, a.y]; p2 = [b.x + b.w / 2 + 2, b.y];
        svg.appendChild(s('path', { 'class': 'dg-e ' + cls, d: 'M' + p1[0] + ',' + p1[1] + ' C' + far + ',' + p1[1] + ' ' + far + ',' + p2[1] + ' ' + (p2[0] + 6) + ',' + p2[1] }));
        arrow(svg, far, p2[1], p2[0], p2[1], cls); mx = (p1[0] + 3 * far + 3 * far + p2[0]) / 8; my = (p1[1] + p2[1]) / 2; ext(far, my);
      }
    } else {
      var dx = b.x - a.x, dy = b.y - a.y;
      p1 = clip(a, dx, dy); p2 = clip(b, -dx, -dy);
      svg.appendChild(s('line', { 'class': 'dg-e ' + cls, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }));
      arrow(svg, p1[0], p1[1], p2[0], p2[1], cls); mx = (p1[0] + p2[0]) / 2; my = (p1[1] + p2[1]) / 2;
    }
    if (e.label) lab(mx, my, e.label);
  });
  bx0 = Math.floor(bx0 - (bx0 < 0 ? 10 : 0)); by0 = Math.floor(by0 - (by0 < 0 ? 10 : 0)); bx1 = Math.ceil(bx1 + (bx1 > W ? 10 : 0)); by1 = Math.ceil(by1 + (by1 > H ? 10 : 0));
  svg.setAttribute('viewBox', bx0 + ' ' + by0 + ' ' + (bx1 - bx0) + ' ' + (by1 - by0)); svg.setAttribute('width', bx1 - bx0);
  order.forEach(function (n) {
    var g = s('g', { 'class': 'dg-n' + (n.c ? ' c-' + n.c : '') });
    if (n.kind === 'diamond') g.appendChild(s('polygon', { points: n.x + ',' + (n.y - n.h / 2) + ' ' + (n.x + n.w / 2) + ',' + n.y + ' ' + n.x + ',' + (n.y + n.h / 2) + ' ' + (n.x - n.w / 2) + ',' + n.y }));
    else g.appendChild(s('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.kind === 'pill' ? n.h / 2 : 9 }));
    mtext(g, n.ls, n.x, n.y);
    svg.appendChild(g);
  });
  return svg;
}

function seq(spec) {
  var A = spec.actors, idx = {}, gap = 150, i, top = 30, y = 96, ROW = 46;
  A.forEach(function (a, k) { idx[a] = k; });
  spec.msgs.forEach(function (m) {
    if (!Array.isArray(m)) return;
    if (!(m[0] in idx) || !(m[1] in idx)) throw new Error('seq: 未知参与者 ' + m[0] + ' / ' + m[1]);
    var d = Math.abs(idx[m[0]] - idx[m[1]]) || 1, need = (maxW(lines(m[2])) * .92 + 36) / d;
    if (need > gap) gap = need;
  });
  gap = Math.min(gap, 300);
  var aw = Math.max.apply(null, A.map(function (a) { return tw(a) + 26; }).concat([80])), x0 = aw / 2 + 16;
  function X(a) { return x0 + idx[a] * gap; }
  var rows = spec.msgs.map(function (m) {
    var hgt = Array.isArray(m) ? ROW + (lines(m[2]).length - 1) * 17 + (m[0] === m[1] ? 14 : 0) : lines(m.note).length * LHT + 28;
    var o = { m: m, y: y + hgt / 2, h: hgt }; y += hgt; return o;
  });
  var W = x0 * 2 + (A.length - 1) * gap + 60, H = y + 20;
  var svg = s('svg', { viewBox: '0 0 ' + Math.round(W) + ' ' + Math.round(H), width: Math.round(W) });
  A.forEach(function (a) {
    svg.appendChild(s('line', { 'class': 'dg-life', x1: X(a), y1: top + 20, x2: X(a), y2: H - 10 }));
    var g = s('g', { 'class': 'dg-n c-blue' });
    g.appendChild(s('rect', { x: X(a) - aw / 2, y: top - 18, width: aw, height: 38, rx: 9 }));
    mtext(g, [a], X(a), top + 1); svg.appendChild(g);
  });
  rows.forEach(function (r) {
    var m = r.m, cls, ls, x1, x2;
    if (!Array.isArray(m)) {
      var ov = m.over ? (Array.isArray(m.over) ? m.over : [m.over]) : [A[0], A[A.length - 1]];
      ls = lines(m.note);
      var xa = X(ov[0]), xb = X(ov[ov.length - 1]), w = Math.max(Math.abs(xb - xa) + 60, maxW(ls, 13) + 24), cx = (xa + xb) / 2, g = s('g', { 'class': 'dg-note' });
      cx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, cx));
      g.appendChild(s('rect', { x: cx - w / 2, y: r.y - r.h / 2 + 6, width: w, height: r.h - 12, rx: 6 }));
      mtext(g, ls, cx, r.y, 13); svg.appendChild(g);
      return;
    }
    cls = ((m[3] && m[3].dash) ? 'dash ' : '') + ((m[3] && m[3].c) ? 'c-' + m[3].c : '');
    ls = lines(m[2]); x1 = X(m[0]); x2 = X(m[1]);
    var ly = r.y + 10 + (ls.length - 1) * 8;
    if (m[0] === m[1]) {
      svg.appendChild(s('path', { 'class': 'dg-e ' + cls, d: 'M' + x1 + ',' + (ly - 12) + ' h34 v20 h-28' }));
      arrow(svg, x1 + 30, ly + 8, x1 + 5, ly + 8, cls);
      ls.forEach(function (l, k) { svg.appendChild(s('text', { x: x1 + 42, y: ly - 2 - (ls.length - 1) * 8.5 + k * 17, 'font-size': 13, 'dominant-baseline': 'central' }, l)); });
    } else {
      var d = x2 > x1 ? 1 : -1;
      svg.appendChild(s('line', { 'class': 'dg-e ' + cls, x1: x1, y1: ly, x2: x2 - d * 7, y2: ly }));
      arrow(svg, x1, ly, x2 - d, ly, cls);
      ls.forEach(function (l, k) { svg.appendChild(s('text', { x: (x1 + x2) / 2, y: ly - 11 - (ls.length - 1 - k) * 17, 'font-size': 13, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, l)); });
    }
  });
  return svg;
}

function layersDg(spec) {
  var d = document.createElement('div'); d.className = 'dg-layers';
  spec.rows.forEach(function (r) {
    var row = document.createElement('div'), tag = document.createElement('div'), bd = document.createElement('div'), b = document.createElement('b'), sp = document.createElement('span');
    row.className = 'dg-layer' + (r.c ? ' c-' + r.c : ''); tag.className = 'tag'; bd.className = 'bd';
    tag.textContent = r.tag || ''; b.textContent = r.label || ''; sp.textContent = r.desc || '';
    bd.appendChild(b); if (r.desc) bd.appendChild(sp); row.appendChild(tag); row.appendChild(bd); d.appendChild(row);
  });
  return d;
}

var KIND = { flow: flow, seq: seq, layers: layersDg };
root.DG = {
  renderAll: function (scope) {
    var list = (scope || document).querySelectorAll('figure.dg'), i, f, body, src;
    for (i = 0; i < list.length; i++) {
      f = list[i]; body = f.querySelector('.dg-body'); src = f.querySelector('script[type="application/json"]');
      if (!body || !src || body.firstChild) continue;
      try { body.appendChild(KIND[f.getAttribute('data-dg')](JSON.parse(src.textContent))); }
      catch (err) { body.textContent = '图表渲染失败：' + err.message; }
    }
  }
};
})(window);
