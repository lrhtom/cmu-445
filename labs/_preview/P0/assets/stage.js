/* stage.js —— 页面 5 的常驻舞台
 * 一个固定 SVG 画布；所有元素有稳定 id。切换视图或状态时：已有元素对位置 / 尺寸 / 颜色 / 透明度做补间，
 * 新增元素淡入，移除元素淡出；从不整块重绘、从不瞬间跳变。补间由 requestAnimationFrame 驱动的时钟推进，
 * 不使用 CSS transition；速度可调；系统开启「减少动态效果」时直接摆到终态。
 *
 * 四个视图都只是在生成「场景」（一组带 id 的图元），交给同一个补间引擎：
 *   class 类图 / api 接口流程（令牌沿路径逐跳移动）/ call 函数调用图 / code 代码逐行执行（源码 + 栈帧 + 数据 + 终端）
 */
(function (root) {
'use strict';
var NS = 'http://www.w3.org/2000/svg', W = 1000, H = 640, DUR = 650;
var REDUCE = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
var PAL = {
  light: { paper: '#fffdf8', ink: '#1f2328', mute: '#6b7079', line: '#cfc8b8', soft: '#f1ede4',
           core: '#2563eb', feat: '#0f8b6c', ext: '#8b919a', test: '#b7791f', hot: '#d97706', hotBg: '#fff1bf', cur: '#1d4ed8', curBg: '#dbeafe',
           visit: '#eef4ff', tok: '#e0452b', newBg: '#dcf5e8', frame: '#6d4fd6', frameBg: '#f3efff', obj: '#0f8b6c', objBg: '#effaf5', flash: '#ffd970' },
  dark:  { paper: '#1c1f23', ink: '#e6e3dc', mute: '#9a9a93', line: '#3a3f46', soft: '#24282d',
           core: '#6aa6ff', feat: '#4fd1a5', ext: '#8b919a', test: '#f0a94a', hot: '#f0a94a', hotBg: '#3a3215', cur: '#8ab4ff', curBg: '#1d2d4d',
           visit: '#1a2236', tok: '#ff7a5c', newBg: '#12302a', frame: '#a996f5', frameBg: '#221d38', obj: '#4fd1a5', objBg: '#12261f', flash: '#6b5a1c' }
};
function pal() { return PAL[document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light']; }
function svg(tag, a) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); return e; }
function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/* 说明文字里允许 **加粗** 和 `代码` */
function md(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function hex(c) { var s = c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c, n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, p) {
  if (a === b || a[0] !== '#' || b[0] !== '#') return p < .5 ? a : b;
  var A = hex(a), B = hex(b);
  return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(A[i] + (B[i] - A[i]) * p); }).join(',') + ')';
}
function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function tw(s, f) { var w = 0; s = String(s); for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e7f ? 1 : .6; return w * f; }

/* ════════ 补间引擎 ════════ */
var NUM = ['x', 'y', 'w', 'h', 'op', 'sw'], COL = ['fill', 'stroke', 'tc'];
function Engine(svgEl) {
  this.svg = svgEl; this.items = {}; this.order = []; this.speed = 1; this.raf = 0; this.now = 0; this.last = 0;
  this.gEdge = svg('g', {}); this.gBox = svg('g', {}); this.gTop = svg('g', {});
  svgEl.appendChild(this.gEdge); svgEl.appendChild(this.gBox); svgEl.appendChild(this.gTop);
}
var E = Engine.prototype;
E.setBox = function (w, hh) {
  var c = this.box || [W, H];
  if (c[0] === w && c[1] === hh && !this.boxTo) return;
  this.boxFrom = c.slice(); this.boxTo = [w, hh]; this.boxT0 = this.now; this.kick();
};
E.show = function (scene) {
  var self = this, want = {}, t0 = this.now;
  scene.forEach(function (it) {
    want[it.id] = 1;
    var cur = self.items[it.id];
    /* 同一个 id 换了图元类型（比如上一节的便签、这一节的表格）：旧元素结构不同，删掉重建 */
    if (cur && cur.type !== it.type) { if (cur.g && cur.g.parentNode) cur.g.parentNode.removeChild(cur.g); delete self.items[it.id]; cur = null; }
    if (!cur) {
      cur = self.items[it.id] = { id: it.id, type: it.type, cur: {}, from: {}, to: {}, t0: t0, dead: false };
      for (var k in it) cur.cur[k] = it[k];
      cur.cur.op = 0;
      if (it.type !== 'edge') { cur.cur.y = (it.y || 0) + 10; }
      self.make(cur);
    }
    cur.dead = false;
    cur.from = {}; for (var k2 in cur.cur) cur.from[k2] = cur.cur[k2];
    cur.to = {}; for (var k3 in it) cur.to[k3] = it[k3];
    if (cur.to.op == null) cur.to.op = 1;
    cur.t0 = t0;
    if (it.flash) { cur.flashAt = t0; cur.flashRows = it.flash; }
  });
  Object.keys(this.items).forEach(function (id) {
    var it = self.items[id];
    if (!want[id] && !it.dead) { it.dead = true; it.from = {}; for (var k in it.cur) it.from[k] = it.cur[k]; it.to = {}; for (var k2 in it.cur) it.to[k2] = it.cur[k2]; it.to.op = 0; it.t0 = t0; }
  });
  this.kick();
};
E.make = function (it) {
  var g = svg('g', {});
  if (it.type === 'edge') {
    it.path = svg('path', { fill: 'none' }); it.head = svg('polygon', {}); it.lbg = svg('rect', { rx: 4 }); it.lab = svg('text', { 'font-size': 12, 'text-anchor': 'middle' });
    g.appendChild(it.path); g.appendChild(it.head); g.appendChild(it.lbg); g.appendChild(it.lab); this.gEdge.appendChild(g);
  } else if (it.type === 'txt' || it.type === 'table') {
    it.rect = svg('rect', { rx: 8 }); it.head = svg('rect', { rx: 8 }); it.inner = svg('g', {});
    g.appendChild(it.rect); g.appendChild(it.head); g.appendChild(it.inner); this.gBox.appendChild(g);
  } else if (it.type === 'tok') {
    it.c = svg('circle', { r: 9 }); it.lab = svg('text', { 'font-size': 11, 'text-anchor': 'middle', dy: 4, 'font-weight': 700 });
    g.appendChild(it.c); g.appendChild(it.lab); this.gTop.appendChild(g);
  } else {
    it.rect = svg('rect', { rx: 9 }); it.head = svg('rect', { rx: 9 }); it.t1 = svg('text', { 'font-size': 14, 'font-weight': 700 });
    it.t2 = svg('text', { 'font-size': 11 }); it.rowsG = svg('g', {});
    g.appendChild(it.rect); g.appendChild(it.head); g.appendChild(it.t1); g.appendChild(it.t2); g.appendChild(it.rowsG); this.gBox.appendChild(g);
  }
  it.g = g;
};
E.kick = function () {
  var self = this;
  if (this.raf) return;
  this.last = 0;
  function tick(ts) {
    self.raf = 0;
    var dt = self.last ? Math.min(ts - self.last, 60) : 16; self.last = ts;
    self.now += REDUCE ? 1e6 : dt * self.speed;
    var busy = self.frame(), more = self.onTick ? self.onTick() : false;
    if (busy || more) self.raf = requestAnimationFrame(tick);
  }
  this.raf = requestAnimationFrame(tick);
};
E.frame = function () {
  var self = this, busy = false, P = pal();
  if (this.boxTo) {
    var bp = Math.min(1, (this.now - this.boxT0) / DUR), be = ease(bp);
    this.box = [this.boxFrom[0] + (this.boxTo[0] - this.boxFrom[0]) * be, this.boxFrom[1] + (this.boxTo[1] - this.boxFrom[1]) * be];
    this.svg.setAttribute('viewBox', '0 0 ' + this.box[0].toFixed(1) + ' ' + this.box[1].toFixed(1));
    if (bp < 1) busy = true; else { this.box = this.boxTo; this.boxTo = null; }
  }
  Object.keys(this.items).forEach(function (id) {
    var it = self.items[id], p = Math.min(1, (self.now - it.t0) / DUR), e = ease(p);
    if (p < 1) busy = true;
    NUM.forEach(function (k) { if (it.to[k] != null) it.cur[k] = (it.from[k] == null ? it.to[k] : it.from[k] + (it.to[k] - it.from[k]) * e); });
    COL.forEach(function (k) { if (it.to[k] != null) it.cur[k] = it.from[k] == null ? it.to[k] : mix(it.from[k], it.to[k], e); });
    ['title', 'sub', 'rows', 'from', 'to', 'label', 'dash', 'kind', 'rowFrom', 'lines', 'cols', 'colW', 'hlRows', 'mono', 'bidir', 'size', 'bold'].forEach(function (k) { if (k in it.to && k !== 'from' && k !== 'to') it.cur[k] = it.to[k]; });
    if (it.type === 'edge') { it.cur.a = it.to.a; it.cur.b = it.to.b; }
    if (it.flashAt != null && self.now - it.flashAt < 1400) busy = true;
    if (it.dead && p >= 1) { it.g.parentNode && it.g.parentNode.removeChild(it.g); delete self.items[id]; return; }
  });
  Object.keys(this.items).forEach(function (id) { var it = self.items[id]; if (it.type !== 'edge') self.drawBox(it, P); });
  Object.keys(this.items).forEach(function (id) { var it = self.items[id]; if (it.type === 'edge') self.drawEdge(it, P); });
  return busy;
};
E.drawBox = function (it, P) {
  var c = it.cur, op = Math.max(0, Math.min(1, c.op));
  it.g.setAttribute('opacity', op.toFixed(3));
  if (it.type === 'txt') return this.drawTxt(it, P);
  if (it.type === 'table') return this.drawTable(it, P);
  if (it.type === 'tok') {
    it.c.setAttribute('cx', c.x.toFixed(1)); it.c.setAttribute('cy', c.y.toFixed(1)); it.c.setAttribute('fill', c.fill || P.tok);
    it.lab.setAttribute('x', c.x.toFixed(1)); it.lab.setAttribute('y', c.y.toFixed(1)); it.lab.setAttribute('fill', '#fff'); it.lab.textContent = c.label || '';
    return;
  }
  var x = c.x, y = c.y, w = c.w, hh = c.h, rows = c.rows || [], hd = rows.length ? 30 : hh;
  it.rect.setAttribute('x', x.toFixed(1)); it.rect.setAttribute('y', y.toFixed(1)); it.rect.setAttribute('width', w.toFixed(1)); it.rect.setAttribute('height', hh.toFixed(1));
  it.rect.setAttribute('fill', c.fill || P.paper); it.rect.setAttribute('stroke', c.stroke || P.line); it.rect.setAttribute('stroke-width', (c.sw || 1.6).toFixed(2));
  it.rect.setAttribute('stroke-dasharray', c.dash || 'none');
  it.head.setAttribute('x', x.toFixed(1)); it.head.setAttribute('y', y.toFixed(1)); it.head.setAttribute('width', w.toFixed(1));
  it.head.setAttribute('height', rows.length ? 30 : 0); it.head.setAttribute('fill', rows.length ? (c.stroke || P.line) : 'none'); it.head.setAttribute('opacity', rows.length ? .14 : 0);
  var single = !rows.length;
  it.t1.setAttribute('x', (single ? x + w / 2 : x + 10).toFixed(1)); it.t1.setAttribute('text-anchor', single ? 'middle' : 'start');
  it.t1.setAttribute('y', (single ? y + hh / 2 - (c.sub ? 3 : -5) : y + 20).toFixed(1)); it.t1.setAttribute('fill', c.tc || P.ink);
  it.t1.textContent = c.title || '';
  it.t2.setAttribute('x', (single ? x + w / 2 : x + w - 8).toFixed(1)); it.t2.setAttribute('text-anchor', single ? 'middle' : 'end');
  it.t2.setAttribute('y', (single ? y + hh / 2 + 13 : y + 20).toFixed(1)); it.t2.setAttribute('fill', P.mute); it.t2.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
  var subTxt = c.sub || '', roomSub = single ? w - 16 : w - 26 - tw(c.title || '', 14);
  if (tw(subTxt, 11) > roomSub) {   /* 按实际字宽（中文按全角）逐字截断 */
    var cut = subTxt; while (cut.length > 1 && tw(cut + '…', 11) > roomSub) cut = cut.slice(0, -1);
    subTxt = cut.length > 3 ? cut + '…' : '';
  }
  it.t2.textContent = subTxt;
  var key = JSON.stringify(rows);
  if (it.rowsKey !== key) {
    it.rowsKey = key;
    while (it.rowsG.firstChild) it.rowsG.removeChild(it.rowsG.firstChild);
    it.rowEls = rows.map(function (r) {
      var bg = svg('rect', { rx: 4 }), k = svg('text', { 'font-size': 12.5 }), v = svg('text', { 'font-size': 12.5, 'text-anchor': 'end', 'font-family': 'JetBrains Mono, Consolas, monospace' });
      var room = Math.max(4, Math.floor(((c.w || 240) - 26 - tw(r[0], 12.5)) / 7.4)), val = r[2] ? '●' : String(r[1]);
      k.textContent = r[0]; v.textContent = val.length > room ? val.slice(0, room - 1) + '…' : val;
      it.rowsG.appendChild(bg); it.rowsG.appendChild(k); it.rowsG.appendChild(v);
      return { bg: bg, k: k, v: v };
    });
  }
  var fl = it.flashAt != null ? Math.max(0, 1 - (this.now - it.flashAt) / 1400) : 0;
  (it.rowEls || []).forEach(function (re, i) {
    var ry = y + 30 + i * 22;
    re.bg.setAttribute('x', x + 4); re.bg.setAttribute('y', ry + 2); re.bg.setAttribute('width', Math.max(0, w - 8)); re.bg.setAttribute('height', 19);
    var hot = it.flashRows && it.flashRows.indexOf(i) >= 0, keep = c.hlRows && c.hlRows.indexOf(i) >= 0;
    if (keep) { re.bg.setAttribute('fill', P.hotBg); re.bg.setAttribute('opacity', 1); }
    else { re.bg.setAttribute('fill', hot && fl ? P.flash : 'none'); re.bg.setAttribute('opacity', hot ? fl.toFixed(2) : 0); }
    re.k.setAttribute('x', x + 10); re.k.setAttribute('y', ry + 16); re.k.setAttribute('fill', P.mute);
    re.v.setAttribute('x', x + w - 10); re.v.setAttribute('y', ry + 16); re.v.setAttribute('fill', rows[i][2] ? (c.stroke || P.ink) : P.ink);
  });
};
E.drawTxt = function (it, P) {
  var c = it.cur, x = c.x, y = c.y, w = c.w, hh = c.h, lines = c.lines || [], fs = c.size || 13;
  it.g.setAttribute('opacity', Math.max(0, Math.min(1, c.op)).toFixed(3));
  it.rect.setAttribute('x', x.toFixed(1)); it.rect.setAttribute('y', y.toFixed(1)); it.rect.setAttribute('width', w.toFixed(1)); it.rect.setAttribute('height', hh.toFixed(1));
  it.rect.setAttribute('fill', c.fill || 'none'); it.rect.setAttribute('stroke', c.stroke || 'none'); it.rect.setAttribute('stroke-width', (c.sw || 1.2).toFixed(2));
  it.rect.setAttribute('stroke-dasharray', c.dash || 'none'); it.head.setAttribute('height', 0);
  var key = JSON.stringify([lines, c.mono, fs, c.bold]);
  if (it.key !== key) {
    it.key = key;
    while (it.inner.firstChild) it.inner.removeChild(it.inner.firstChild);
    it.tl = lines.map(function (l) {
      var t = svg('text', { 'font-size': fs, 'xml:space': 'preserve' });
      if (c.mono) t.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
      if (c.bold) t.setAttribute('font-weight', 700);
      t.textContent = l; it.inner.appendChild(t); return t;
    });
  }
  var pad = c.fill && c.fill !== 'none' || c.stroke && c.stroke !== 'none' ? 9 : 0;
  (it.tl || []).forEach(function (t, i) { t.setAttribute('x', (x + pad).toFixed(1)); t.setAttribute('y', (y + pad / 2 + 4 + fs + i * (fs + 4)).toFixed(1)); t.setAttribute('fill', c.tc || P.ink); });
};
E.drawTable = function (it, P) {
  var c = it.cur, x = c.x, y = c.y, w = c.w, hh = c.h, cols = c.cols || [], rows = c.rows || [], cw = c.colW || [];
  it.g.setAttribute('opacity', Math.max(0, Math.min(1, c.op)).toFixed(3));
  it.rect.setAttribute('x', x.toFixed(1)); it.rect.setAttribute('y', y.toFixed(1)); it.rect.setAttribute('width', w.toFixed(1)); it.rect.setAttribute('height', hh.toFixed(1));
  it.rect.setAttribute('fill', c.fill || P.paper); it.rect.setAttribute('stroke', c.stroke || P.line); it.rect.setAttribute('stroke-width', (c.sw || 1.4).toFixed(2));
  it.rect.setAttribute('stroke-dasharray', 'none');
  it.head.setAttribute('x', x.toFixed(1)); it.head.setAttribute('y', y.toFixed(1)); it.head.setAttribute('width', w.toFixed(1)); it.head.setAttribute('height', 26);
  it.head.setAttribute('fill', c.stroke || P.line); it.head.setAttribute('opacity', .14);
  var key = JSON.stringify([cols, rows, cw, c.hlRows]);
  if (it.key !== key) {
    it.key = key;
    while (it.inner.firstChild) it.inner.removeChild(it.inner.firstChild);
    it.cells = [];
    (c.hlRows || []).forEach(function (r) { var bg = svg('rect', { rx: 3 }); bg.__r = r; it.inner.appendChild(bg); it.cells.push({ bg: bg }); });
    var all = [cols].concat(rows);
    all.forEach(function (row, r) {
      row.forEach(function (v, k) {
        var t = svg('text', { 'font-size': 13.5, 'font-weight': r ? 400 : 700 });
        if (r) t.setAttribute('font-family', 'JetBrains Mono, Consolas, \'Microsoft YaHei\', monospace');
        t.textContent = v; t.__r = r; t.__k = k; it.inner.appendChild(t); it.cells.push({ t: t });
      });
    });
  }
  var x0 = [x]; for (var k = 0; k < cw.length; k++) x0.push(x0[k] + cw[k]);
  (it.cells || []).forEach(function (e) {
    if (e.bg) { e.bg.setAttribute('x', x + 3); e.bg.setAttribute('y', y + 26 + e.bg.__r * 24 + 1); e.bg.setAttribute('width', Math.max(0, w - 6)); e.bg.setAttribute('height', 22); e.bg.setAttribute('fill', P.hotBg); return; }
    var t = e.t; t.setAttribute('x', (x0[t.__k] + 8).toFixed(1)); t.setAttribute('y', (y + (t.__r ? 26 + (t.__r - 1) * 24 + 17 : 18)).toFixed(1));
    t.setAttribute('fill', t.__r ? P.ink : (c.tc || P.ink));
  });
};
E.anchor = function (id) { var it = this.items[id]; return it && it.type !== 'edge' ? it.cur : null; };
E.drawEdge = function (it, P) {
  var a = this.anchor(it.cur.a), b = this.anchor(it.cur.b), c = it.cur;
  if (!a || !b) { it.g.setAttribute('opacity', 0); return; }
  var op = Math.max(0, Math.min(1, c.op)) * Math.min(a.op, b.op);
  it.g.setAttribute('opacity', op.toFixed(3));
  var x1, y1, x2, y2, d;
  if (c.rowFrom != null) {
    x1 = a.x + a.w - 4; y1 = a.y + 30 + c.rowFrom * 22 + 11;
    x2 = b.x; y2 = b.y + 15; if (x2 < x1) { x2 = b.x + b.w; }
    var mx = (x1 + x2) / 2;
    d = 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2;
  } else {
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var p1 = clip(a, bx - ax, by - ay), p2 = clip(b, ax - bx, ay - by);
    x1 = p1[0]; y1 = p1[1]; x2 = p2[0]; y2 = p2[1];
    d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' L' + x2.toFixed(1) + ',' + y2.toFixed(1);
  }
  var col = c.stroke || P.line;
  it.path.setAttribute('d', d); it.path.setAttribute('stroke', col); it.path.setAttribute('stroke-width', (c.sw || 1.5).toFixed(2));
  it.path.setAttribute('stroke-dasharray', c.dash || 'none');
  var ang = c.rowFrom != null ? (x2 >= x1 ? 0 : Math.PI) : Math.atan2(y2 - y1, x2 - x1), L = 9;
  it.head.setAttribute('points', [x2, y2, x2 - L * Math.cos(ang - .4), y2 - L * Math.sin(ang - .4), x2 - L * Math.cos(ang + .4), y2 - L * Math.sin(ang + .4)].map(function (v) { return v.toFixed(1); }).join(','));
  it.head.setAttribute('fill', col);
  if (c.bidir) {
    if (!it.head2) { it.head2 = svg('polygon', {}); it.g.insertBefore(it.head2, it.lbg); }
    var a2 = ang + Math.PI;
    it.head2.setAttribute('points', [x1, y1, x1 - L * Math.cos(a2 - .4), y1 - L * Math.sin(a2 - .4), x1 - L * Math.cos(a2 + .4), y1 - L * Math.sin(a2 + .4)].map(function (v) { return v.toFixed(1); }).join(','));
    it.head2.setAttribute('fill', col);
  } else if (it.head2) { it.head2.setAttribute('points', ''); }
  it.lab.textContent = c.label || '';
  var lx = (x1 + x2) / 2, ly = (y1 + y2) / 2 - 4, lw = c.label ? tw(c.label, 12) + 10 : 0;
  it.lab.setAttribute('x', lx.toFixed(1)); it.lab.setAttribute('y', (ly + 4).toFixed(1)); it.lab.setAttribute('fill', c.tc || P.mute);
  it.lbg.setAttribute('x', (lx - lw / 2).toFixed(1)); it.lbg.setAttribute('y', (ly - 9).toFixed(1)); it.lbg.setAttribute('width', lw.toFixed(1)); it.lbg.setAttribute('height', lw ? 17 : 0);
  it.lbg.setAttribute('fill', P.paper); it.lbg.setAttribute('opacity', .92);
};
function clip(n, dx, dy) {
  var hw = n.w / 2 + 2, hh = n.h / 2 + 2, t = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9);
  return [n.x + n.w / 2 + dx * t, n.y + n.h / 2 + dy * t];
}

/* ════════ 场景生成 ════════ */
function nodeSize(n, members) {
  var w = Math.max(150, tw(n.label, 14) + 34, n.sub ? (members && members.length ? tw(n.label, 14) + tw(n.sub, 11) + 44 : tw(n.sub, 11) + 26) : 0, members ? Math.max.apply(null, members.map(function (m) { return tw(m, 12) + 30; }).concat([0])) : 0);
  return { w: Math.min(w, 320), h: members && members.length ? 30 + members.length * 22 + 6 : 52 };
}
function classScene(pj, opt) {
  var P = pal(), st = pj.stage || {}, cls = st.class || {}, pos = cls.pos || {}, mem = cls.members || {}, out = [], hl = opt.hl || [], visit = opt.visit || [], cur = opt.cur;
  (st.nodes || []).forEach(function (n, i) {
    var m = opt.members === false ? null : (mem[n.id] || null), sz = nodeSize(n, m), p = pos[n.id] || [40 + (i % 4) * 240, 40 + Math.floor(i / 4) * 170];
    var kc = P[n.kind || 'core'] || P.core, on = hl.indexOf(n.id) >= 0, isCur = cur === n.id, vis = visit.indexOf(n.id) >= 0;
    out.push({ id: 'n:' + n.id, type: 'box', x: p[0], y: p[1], w: sz.w, h: sz.h, title: n.label, sub: m ? (n.sub || '') : n.sub,
      rows: m ? m.map(function (s) { var j = s.indexOf(' : '); return j > 0 ? [s.slice(0, j), s.slice(j + 3)] : [s, '']; }) : [],
      stroke: isCur ? P.cur : on ? P.hot : kc, fill: isCur ? P.curBg : on ? P.hotBg : vis ? P.visit : P.paper, sw: isCur || on ? 2.6 : 1.6,
      dash: n.kind === 'ext' ? '5 4' : '' });
  });
  (cls.edges || []).forEach(function (e, i) {
    out.push({ id: 'e:' + e[0] + '>' + e[1], type: 'edge', a: 'n:' + e[0], b: 'n:' + e[1], label: e[2] || '', stroke: P.line, sw: 1.5 });
  });
  return out;
}
function apiScene(pj, api, k) {
  var P = pal(), hops = api.hops || [], visit = [], hl = [];
  hops.slice(0, k + 1).forEach(function (hp) { visit.push(hp[0]); visit.push(hp[1]); });
  var cur = hops[k] ? hops[k][1] : null;
  var out = classScene(pj, { visit: visit, cur: cur, hl: hl, members: false });
  var used = {};
  hops.forEach(function (hp, i) {
    var id = 'e:' + hp[0] + '>' + hp[1], hot = i <= k, ex = null;
    for (var j = 0; j < out.length; j++) if (out[j].id === id) ex = out[j];
    var e = ex || { id: id, type: 'edge', a: 'n:' + hp[0], b: 'n:' + hp[1] };
    e.stroke = i === k ? P.hot : hot ? P.cur : P.line; e.sw = i === k ? 3 : hot ? 2.2 : 1.4; e.label = i === k ? (hp[3] || hp[2] || '').slice(0, 28) : (ex ? ex.label : '');
    e.dash = hot ? '' : '4 4';
    if (!ex) out.push(e);
    used[id] = 1;
  });
  if (hops[k]) {
    var a = null, b = null;
    out.forEach(function (o) { if (o.id === 'n:' + hops[k][0]) a = o; if (o.id === 'n:' + hops[k][1]) b = o; });
    if (b) out.push({ id: 'tok', type: 'tok', x: b.x + b.w / 2, y: b.y - 2, label: String(k + 1), fill: P.tok });
  }
  return out;
}
function callScene(pj, hlOwner) {
  var P = pal(), cg = (pj.stage || {}).call || {}, nodes = cg.nodes || [], edges = cg.edges || [], out = [];
  var depth = {}, ins = {};
  nodes.forEach(function (n) { depth[n.id] = 0; ins[n.id] = 0; });
  edges.forEach(function (e) { ins[e[1]] = (ins[e[1]] || 0) + 1; });
  for (var r = 0; r < 12; r++) edges.forEach(function (e) { if (depth[e[1]] < depth[e[0]] + 1 && e[0] !== e[1]) depth[e[1]] = Math.min(depth[e[0]] + 1, 6); });
  var rowsOf = {};
  nodes.forEach(function (n) { (rowsOf[depth[n.id]] = rowsOf[depth[n.id]] || []).push(n); });
  var keys = Object.keys(rowsOf).map(Number).sort(function (x, y) { return x - y; }), nrow = keys.length || 1, rowH = Math.min(110, (H - 30) / nrow);
  keys.forEach(function (d, r) {
    var list = rowsOf[d], ws = list.map(function (n) { return Math.min(300, Math.max(150, tw(n.label, 14) + 30)); });
    var total = ws.reduce(function (a2, b2) { return a2 + b2; }, 0), gap = Math.max(14, (W - 40 - total) / Math.max(1, list.length)), x = 20 + Math.max(0, (W - 40 - total - gap * (list.length - 1)) / 2);
    if (total + gap * (list.length - 1) > W - 40) { var k2 = (W - 40 - 14 * (list.length - 1)) / total; ws = ws.map(function (w0) { return w0 * k2; }); gap = 14; x = 20; }
    list.forEach(function (n, i) {
      var owner = ((pj.stage || {}).nodes || []).filter(function (o) { return o.id === n.owner; })[0], kc = owner ? (P[owner.kind || 'core'] || P.core) : P.core;
      var on = hlOwner && hlOwner.indexOf(n.owner) >= 0;
      out.push({ id: 'c:' + n.id, type: 'box', x: x, y: 18 + r * rowH, w: ws[i], h: 52, title: n.label, sub: n.file ? n.file.split('/').pop() + ':' + n.line : '',
        stroke: on ? P.hot : kc, fill: on ? P.hotBg : P.paper, sw: on ? 2.4 : 1.4 });
      x += ws[i] + gap;
    });
  });
  edges.forEach(function (e) { out.push({ id: 'ce:' + e[0] + '>' + e[1], type: 'edge', a: 'c:' + e[0], b: 'c:' + e[1], label: e[2] || '', stroke: P.line }); });
  return out;
}
function codeScene(trace, i, layout) {
  var P = pal(), s = trace.steps[i], prev = trace.steps[i - 1], out = [];
  var prevVals = {};
  if (prev) (prev.frames || []).concat(prev.objs || []).forEach(function (c) { (c.vars || c.rows || []).forEach(function (r, j) { prevVals[c.id + '#' + r[0]] = r[1] + '|' + (r[2] || ''); }); });
  var colY = [20, 20, 20], fy = 20;
  (s.frames || []).forEach(function (f, k) {
    var rows = f.vars || [], hh = 30 + rows.length * 22 + 6, flash = [];
    rows.forEach(function (r, j) { if (prevVals[f.id + '#' + r[0]] !== r[1] + '|' + (r[2] || '')) flash.push(j); });
    var top = k === s.frames.length - 1;
    out.push({ id: 'f:' + f.id, type: 'box', x: 10, y: fy, w: 232, h: hh, title: (top ? '▶ ' : '') + f.fn, sub: f.at || '', rows: rows,
      stroke: top ? P.frame : P.line, fill: top ? P.frameBg : P.paper, sw: top ? 2.2 : 1.4, flash: prev ? flash : [] });
    fy += hh + 12;
  });
  (s.objs || []).forEach(function (o) {
    var rows = o.rows || [], hh = 30 + rows.length * 22 + 6, flash = [];
    rows.forEach(function (r, j) { if (prevVals[o.id + '#' + r[0]] !== r[1] + '|' + (r[2] || '')) flash.push(j); });
    var L = layout[o.id];
    if (!L) {
      var c = o.col === 1 || o.col === 2 ? o.col : (colY[1] <= colY[2] ? 1 : 2);   /* 内容里可以用 col 指定放哪一列 */
      L = layout[o.id] = { x: c === 1 ? 256 : 508, y: colY[c] };
    }
    var col = L.x < 500 ? 1 : 2; colY[col] = Math.max(colY[col], L.y + hh + 14);
    out.push({ id: 'o:' + o.id, type: 'box', x: L.x, y: L.y, w: 244, h: hh, title: o.title, sub: o.sub || '', rows: rows,
      stroke: P.obj, fill: P.objBg, sw: 1.6, flash: prev ? flash : [] });
  });
  (s.frames || []).concat(s.objs || []).forEach(function (c) {
    var pre = (s.frames || []).indexOf(c) >= 0 ? 'f:' : 'o:';
    (c.vars || c.rows || []).forEach(function (r, j) {
      if (r[2]) out.push({ id: 'p:' + c.id + '#' + j + '>' + r[2], type: 'edge', a: pre + c.id, b: 'o:' + r[2], rowFrom: j, stroke: P.obj, sw: 1.6 });
    });
  });
  return out;
}

/* ════════ 控制器 ════════ */
function Viz(mount, opt) {
  this.opt = opt || {}; this.mount = mount; this.view = 'class'; this.pj = null; this.idx = 0; this.playing = false; this.timer = 0; this.layout = {};
  this.build();
}
var V = Viz.prototype;
V.build = function () {
  var self = this, m = this.mount, mini = !!this.opt.trace;
  m.innerHTML = '';
  var ctl = h('div', 'vz-ctl');
  if (!mini) {
    ctl.innerHTML = '<label>视图</label><select class="v-view"><option value="class">类图（结构体 / 模块关系）</option><option value="api">接口流程（请求进入 → 返回）</option>' +
      '<option value="call">函数调用图</option><option value="code">代码逐行执行</option></select><label class="l-sub">接口</label><select class="v-sub"></select>';
  }
  ctl.insertAdjacentHTML('beforeend', '<button class="tb v-back" type="button">⏮ 上一步</button><button class="tb main v-play" type="button">▶ 播放</button>' +
    '<button class="tb v-next" type="button">下一步 ⏭</button><button class="tb v-reset" type="button">↺ 重置</button>' +
    '<select class="v-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>' +
    '<div class="vz-prog"><i></i></div><span class="vz-cnt"></span>');
  m.appendChild(ctl);
  var main = h('div', mini ? '' : 'vz-main'), stage = h('div', 'vz-stage');
  var src = h('div', 'vz-src'); src.innerHTML = '<div class="hd"></div><div class="bd"><div class="bar-hl"></div><div class="lines"></div></div>';
  var right = h('div', 'vz-right');
  var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'vz-svg', role: 'img' });
  right.appendChild(s);
  var out = h('div', 'vz-out'); right.appendChild(out);
  stage.appendChild(src); stage.appendChild(right); main.appendChild(stage);
  var info = h('div', mini ? 'mini-note' : 'vz-info'); main.appendChild(info);
  m.appendChild(main);
  if (this.opt.bare) { ctl.style.display = 'none'; info.style.display = 'none'; }
  this.$ = { ctl: ctl, stage: stage, src: src, out: out, info: info, view: ctl.querySelector('.v-view'), sub: ctl.querySelector('.v-sub'), lsub: ctl.querySelector('.l-sub'),
    play: ctl.querySelector('.v-play'), prog: ctl.querySelector('.vz-prog i'), cnt: ctl.querySelector('.vz-cnt'), bar: src.querySelector('.bar-hl'), lines: src.querySelector('.lines'),
    srcHd: src.querySelector('.hd'), srcBd: src.querySelector('.bd') };
  this.eng = new Engine(s);
  this.eng.onTick = function () { return self.tickBar(); };
  if (this.$.view) this.$.view.onchange = function () { self.setView(this.value); };
  if (this.$.sub) this.$.sub.onchange = function () { self.setSub(this.value); };
  ctl.querySelector('.v-back').onclick = function () { self.pause(); self.go(self.idx - 1); };
  ctl.querySelector('.v-next').onclick = function () { self.pause(); self.go(self.idx + 1); };
  ctl.querySelector('.v-reset').onclick = function () { self.pause(); self.go(0); };
  this.$.play.onclick = function () { self.playing ? self.pause() : self.play(); };
  ctl.querySelector('.v-speed').onchange = function () { self.eng.speed = +this.value; };
};
V.setProject = function (pj, state) {
  this.pj = pj; this.layout = {}; this.fitFor = null;
  state = state || {};
  if (this.opt.trace) { this.view = 'code'; this.sub = this.opt.trace; }
  else { this.view = state.view || 'class'; this.sub = state.sub || null; }
  this.fillSub(); this.go(state.idx || 0, true);
};
V.fillSub = function () {
  if (!this.$.sub) return;
  var pj = this.pj, st = pj.stage || {}, list = this.view === 'api' ? (st.apis || []).map(function (a) { return [a.id, a.name]; }) :
    this.view === 'code' ? (st.traces || []).map(function (t) { return [t.id, t.title + '（' + t.steps.length + ' 步）']; }) : [];
  this.$.sub.style.display = this.$.lsub.style.display = list.length ? '' : 'none';
  this.$.lsub.textContent = this.view === 'api' ? '接口' : '演示';
  this.$.sub.innerHTML = list.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
  if (!list.some(function (o) { return o[0] === this.sub; }, this)) this.sub = list.length ? list[0][0] : null;
  if (this.sub) this.$.sub.value = this.sub;
  if (this.$.view) this.$.view.value = this.view;
};
V.setView = function (v) { this.pause(); this.view = v; this.layout = {}; this.fitFor = null; this.fillSub(); this.go(0); this.save(); };
V.setSub = function (id) { this.pause(); this.sub = id; this.layout = {}; this.fitFor = null; this.go(0); this.save(); };
V.highlight = function (ids) { this.pause(); this.view = 'class'; this.hl = ids || []; this.fillSub(); this.go(0); this.save(); };
V.len = function () {
  var st = this.pj.stage || {};
  if (this.view === 'api') { var a = this.api(); return a ? (a.hops || []).length : 1; }
  if (this.view === 'code') { var t = this.trace(); return t ? t.steps.length : 1; }
  return 1;
};
V.api = function () { var id = this.sub; return ((this.pj.stage || {}).apis || []).filter(function (a) { return a.id === id; })[0]; };
V.trace = function () { var id = this.sub; return ((this.pj.stage || {}).traces || []).filter(function (t) { return t.id === id; })[0]; };
V.go = function (i, first) {
  var n = this.len(); i = Math.max(0, Math.min(n - 1, i)); this.idx = i;
  var pj = this.pj, scene, info = '', P = pal(), self = this, codeOn = this.view === 'code' && this.trace();
  this.$.stage.classList.toggle('with-src', !!codeOn);
  this.$.out.style.display = codeOn ? '' : 'none';
  if (this.view === 'api' && this.api()) {
    var a = this.api(), hp = a.hops[i] || [];
    scene = apiScene(pj, a, i);
    info = '<div class="kick">接口流程 · 第 ' + (i + 1) + ' / ' + a.hops.length + ' 跳</div><h3>' + esc(a.name) + '</h3><p>' + md(hp[2] || '') + '</p>' + (a.note ? '<p class="muted">' + md(a.note) + '</p>' : '');
  } else if (this.view === 'call') {
    scene = callScene(pj, this.hl);
    info = '<div class="kick">函数调用图</div><h3>谁调用谁</h3><p class="muted">' + md(((pj.stage || {}).call || {}).note || '箭头从调用方指向被调用方；框里标了函数定义所在的文件和行号。') + '</p>';
  } else if (codeOn) {
    var t = this.trace(), s = t.steps[i];
    if (this.fitFor !== t.id) {
      /* 按整条演示里出现过的全部栈帧 / 对象定画布大小（一条演示内不变），内容少时放大显示 */
      this.fitFor = t.id; var mx = 0, my = 0;
      for (var k = 0; k < t.steps.length; k++) codeScene(t, k, this.layout).forEach(function (it) {
        if (it.type === 'edge' || it.x == null) return;
        mx = Math.max(mx, it.x + (it.w || 0)); my = Math.max(my, it.y + (it.h || 0));
      });
      this.fit = [Math.min(760, Math.max(460, mx + 20)), Math.min(600, Math.max(340, my + 20))];
      this.hasOut = t.steps.some(function (x) { return (x.out || []).length; });
    }
    scene = codeScene(t, i, this.layout);
    this.$.out.style.display = this.hasOut ? '' : 'none';   /* 整条演示都没有终端输出就不占地方 */
    this.showSrc(s.file, s.line);
    this.$.out.textContent = (s.out || []).join('\n');
    this.$.out.scrollTop = this.$.out.scrollHeight;
    var line = (window.LAB.files[s.file] || [])[s.line - 1] || '';
    info = '<div class="kick">代码逐行执行 · 第 ' + (i + 1) + ' / ' + t.steps.length + ' 步' + (s.real ? '<span class="tag real">原项目已有代码</span>' : '<span class="tag spec">按官方要求的期望效果</span>') + '</div>' +
      '<h3>' + esc(t.title) + '</h3><div class="muted" style="font-size:12.5px">' + esc(s.file) + ' · 第 ' + s.line + ' 行</div><div class="cl">' + esc(line.trim()) + '</div>' +
      '<p>' + md(s.note) + '</p>' + (s.chg && s.chg.length ? '<div class="muted" style="font-size:12.5px">这一步的变化</div><ul>' + s.chg.map(function (c) { return '<li>' + md(c) + '</li>'; }).join('') + '</ul>' : '') +
      (t.note && i === 0 ? '<p class="muted">' + md(t.note) + '</p>' : '');
  } else {
    scene = classScene(pj, { hl: this.hl || [] });
    info = '<div class="kick">类图</div><h3>' + esc(pj.name) + ' 的结构</h3><p class="muted">' + md(((pj.stage || {}).class || {}).note || '实线框是本 Project 要复原的类，虚线框是依赖的外部模块；框里列出成员。') + '</p>' +
      ((this.hl || []).length ? '<p>高亮的是步骤链里点到的那一步涉及的模块。</p>' : '');
  }
  this.eng.setBox(codeOn ? this.fit[0] : W, codeOn ? this.fit[1] : H);
  this.eng.show(scene || []);
  this.$.info.innerHTML = info;
  this.$.cnt.textContent = (i + 1) + ' / ' + n;
  this.$.prog.style.width = (n > 1 ? (i / (n - 1)) * 100 : 100) + '%';
  if (!first) this.save();
};
V.showSrc = function (file, line) {
  if (this.srcFile !== file) {
    this.srcFile = file;
    var lines = window.LAB.files[file] || [];
    this.$.srcHd.textContent = file;
    this.$.lines.innerHTML = lines.map(function (l, i) { return '<div class="sl"><span class="no">' + (i + 1) + '</span>' + esc(l || ' ') + '</div>'; }).join('');
    this.barY = null;
  }
  this.barTo = (line - 1) * 20; if (this.barY == null) this.barY = this.barTo;
  this.barFrom = this.barY; this.barT0 = this.eng.now;
  var bd = this.$.srcBd, top = this.barTo - bd.clientHeight / 3;
  this.scrollFrom = bd.scrollTop; this.scrollTo = Math.max(0, top);
  this.eng.kick();
};
V.tickBar = function () {
  if (this.barTo == null) return false;
  var p = Math.min(1, (this.eng.now - this.barT0) / DUR), e = ease(p);
  this.barY = this.barFrom + (this.barTo - this.barFrom) * e;
  this.$.bar.style.transform = 'translateY(' + this.barY.toFixed(1) + 'px)';
  this.$.srcBd.scrollTop = this.scrollFrom + (this.scrollTo - this.scrollFrom) * e;
  return p < 1;
};
V.play = function () {
  var self = this;
  if (this.idx >= this.len() - 1) this.go(0);
  this.playing = true; this.$.play.textContent = '⏸ 暂停';
  clearInterval(this.timer);
  this.timer = setInterval(function () { if (self.idx >= self.len() - 1) self.pause(); else self.go(self.idx + 1); }, 1700 / this.eng.speed);
};
V.pause = function () { this.playing = false; clearInterval(this.timer); if (this.$.play) this.$.play.textContent = '▶ 播放'; };
V.save = function () { if (this.opt.onState) this.opt.onState({ view: this.view, sub: this.sub, idx: this.idx }); };

root.LabStage = { Viz: Viz, Engine: Engine, pal: pal, tw: tw, md: md, esc: esc, ease: ease, DUR: DUR };
})(window);
