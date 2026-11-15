/* anim.js —— 虚拟时钟动画引擎（不使用 CSS transition / animation）
 *
 * 画面是「虚拟时间 T」的纯函数：任何时刻 seek(T) 都能瞬间摆好，接着播不会穿帮。
 * 播放 / 暂停 / 单步 / 回退 / 调速 都只是在改 T 的走法。
 *
 * ── 注册一个可视化 ────────────────────────────────────────────────
 * Viz.register('bptree', {
 *   title: 'B+ 树',
 *   sources: [{ t: '显示文字', u: 'https://…' }],
 *   scenes: [{
 *     name: '查找',                       // 顶部按钮
 *     moving: '游标沿指针下探、命中的键弹一下', // 场景表里「哪些东西在动」
 *     lang: 'cpp', code: '多行字符串',     // 右侧代码（可省略）
 *     build: function (S) { … }           // 见下
 *   }]
 * });
 *
 * ── build(S) 里能用的东西 ─────────────────────────────────────────
 * 舞台是 SVG viewBox 0 0 860 560。字号建议 ≥15。颜色用 S.C（有语义）：
 *   blue 读/查找/当前焦点   green 成功/已提交/命中   amber 进行中/脏/等待
 *   red 冲突/中止/淘汰/崩溃 purple 指针/日志/元数据   cyan 飞行中的数据
 *   cell 普通格子底色  line 边框/连线  ink 正文  mute 次要文字  bg 舞台底
 *
 * 元素（id 全场景唯一；x,y 是【中心点】坐标）：
 *   S.box (id, {x,y,w,h,rx,fill,stroke,sw,label,color,size,opacity,scale,dash})
 *   S.dot (id, {x,y,r,fill,label,color,opacity,scale})
 *   S.text(id, {x,y,text,color,size,weight,anchor:'start|middle|end',opacity, val,pre,suf})
 *            val 为数字时显示 pre+四舍五入(val)+suf，可用 S.count 做数字滚动
 *   S.line(id, {x1,y1,x2,y2,stroke,sw,arrow:true,dash,opacity,draw})   draw 0→1 = 线“长出来”
 *   S.path(id, {d,stroke,sw,dash,opacity,draw})
 *   后出现的元素：创建时给 opacity:0，在 step 里用 S.pop / S.to 显示。
 *
 * 步骤：S.step('一句简短说明', function () { …只在这里写动画… }, {hold:1200})
 *   step 时长 = 最后一个动画结束 + hold（默认 1200ms，留给读说明的时间）。
 *
 * 动画（时间都是相对本 step 起点的毫秒；对同一元素同一属性按时间先后调用）：
 *   S.to(id, {x:…, fill:'#…', label:'…'}, {dur:600, delay:0, ease:'inOut|out|in|back|linear'})
 *        数字和 #hex 颜色会插值；其它值（label/text 等）在 delay 时刻瞬间切换
 *   S.set(id, {…}, {delay})         瞬间赋值
 *   S.move(id, x, y, {dur,delay})   = to({x,y})
 *   S.pop(id, {delay})              从小弹出来（opacity 0→1 + 回弹）
 *   S.hide(id, {delay})             淡出
 *   S.pulse(id, {delay})            弹一下（落点反馈）
 *   S.flash(id, color, {delay, prop:'fill'|'stroke'})  闪一下再恢复
 *   S.ripple(x, y, {delay, color})  涟漪
 *   S.fly(from, to, {delay,dur,color,label,w,h,keep,id})  数据包飞行：带拖影，落点自动涟漪
 *        from/to 是元素 id 或 [x,y]；给 w 则是带字的小方块，否则是圆点；keep:true 落地后不消失
 *   S.count(id, 目标数字, {delay,dur})   数字滚动（text 元素需有 val）
 *   S.pos(id) → {x,y}               元素当前（编译期）位置
 *
 * 右侧面板（同样受时钟控制）：
 *   S.code(行号 | [起,止], {delay})   高亮条滑到这一行（行号从 1 开始）
 *   S.log('文字', {delay, kind:'ok|warn|err|io'})   控制台追加一行
 *   S.data({键: 值, 键2: null}, {delay})           数据面板合并更新，null = 删除该键
 *   这三个也可以写在 step 之外，表示初始状态。
 */
(function (root) {
'use strict';

var NS = 'http://www.w3.org/2000/svg';
var C = {
  bg: '#0f1626', panel: '#17213a', cell: '#1e2b4a', line: '#3b4d78', ink: '#e8eefc', mute: '#8fa0c4',
  blue: '#4da3ff', green: '#3ddc97', amber: '#ffb84d', red: '#ff5d6c', purple: '#b58cff', cyan: '#38d6e8',
  white: '#ffffff'
};
var EASE = {
  linear: function (t) { return t; },
  'in': function (t) { return t * t * t; },
  out: function (t) { return 1 - Math.pow(1 - t, 3); },
  inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  back: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};
var COLOR = { fill: 1, stroke: 1, color: 1 };
var DEF = {
  box: { x: 0, y: 0, w: 80, h: 40, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, opacity: 1, scale: 1, label: '', color: C.ink, size: 16, weight: 600, dash: '' },
  dot: { x: 0, y: 0, r: 12, fill: C.cyan, stroke: 'none', sw: 0, opacity: 1, scale: 1, label: '', color: C.bg, size: 13, weight: 700 },
  text: { x: 0, y: 0, text: '', color: C.ink, size: 15, weight: 500, anchor: 'middle', opacity: 1, scale: 1, val: null, pre: '', suf: '' },
  line: { x1: 0, y1: 0, x2: 0, y2: 0, stroke: C.line, sw: 2, opacity: 1, draw: 1, arrow: false, dash: '' },
  ring: { x: 0, y: 0, r: 4, stroke: C.cyan, sw: 2.5, opacity: 0 },
  path: { d: '', stroke: C.line, sw: 2, opacity: 1, draw: 1, dash: '' }
};
var REG = {}, ORDER = [];

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function isHex(c) { return typeof c === 'string' && c.charAt(0) === '#'; }
var HEX = {};
function hex(c) {
  var v = HEX[c];
  if (v) return v;
  var s = c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c, n = parseInt(s.slice(1), 16);
  return (HEX[c] = [n >> 16 & 255, n >> 8 & 255, n & 255]);
}
function mix(a, b, p) {
  var A = hex(a), B = hex(b);
  return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * p) + ',' + Math.round(A[1] + (B[1] - A[1]) * p) + ',' + Math.round(A[2] + (B[2] - A[2]) * p) + ')';
}

/* ════════ Scene：把 build() 编译成时间轴（不碰 DOM，Node 里也能跑） ════════ */
function Scene(def) {
  this.def = def; this.C = C;
  this.actors = []; this.byId = {}; this.steps = []; this.events = [];
  this.t = 0; this._cur = null; this._uid = 0;
  def.build(this);
  this.total = this.t;
  var byT = function (a, b) { return a.t0 - b.t0; };
  this.actors.forEach(function (a) { for (var k in a.tracks) a.tracks[k].sort(byT); });
  this.events.sort(function (a, b) { return a.t - b.t; });
  this.anim = this.actors.filter(function (a) { return Object.keys(a.tracks).length; });
}
var P = Scene.prototype;

P.add = function (type, id, props) {
  if (this.byId[id]) throw new Error('重复的元素 id: ' + id);
  var d = DEF[type], init = {}, k;
  for (k in d) init[k] = d[k];
  for (k in props) init[k] = props[k];
  var a = { id: id, type: type, init: init, cur: {}, tracks: {} };
  for (k in init) a.cur[k] = init[k];
  this.actors.push(a); this.byId[id] = a;
  return id;
};
Object.keys(DEF).forEach(function (t) { P[t] = function (id, props) { return this.add(t, id, props || {}); }; });

P.to = function (id, props, o) {
  var a = this.byId[id];
  if (!a) throw new Error('未知元素: ' + id);
  if (!this._cur) throw new Error('动画只能写在 step() 里: ' + id);
  o = o || {};
  var dur = o.dur == null ? 600 : o.dur, delay = o.delay || 0, t0 = this._cur.t0 + delay + 1, k, to, from, kind, end = delay;
  for (k in props) {
    to = props[k]; from = a.cur[k];
    kind = (typeof to === 'number' && typeof from === 'number') ? 'n' : (COLOR[k] && isHex(to) && isHex(from)) ? 'c' : 'd';
    (a.tracks[k] || (a.tracks[k] = [])).push({ t0: t0, t1: kind === 'd' ? t0 : t0 + dur, from: from, to: to, ease: EASE[o.ease] || EASE.inOut, kind: kind });
    a.cur[k] = to;
    if (kind !== 'd') end = delay + dur;
  }
  if (end > this._cur.end) this._cur.end = end;
  return this;
};
P.set = function (id, props, o) { return this.to(id, props, { dur: 0, delay: (o && o.delay) || 0 }); };
P.move = function (id, x, y, o) { return this.to(id, { x: x, y: y }, o); };
P.pos = function (id) { var a = this.byId[id]; return { x: a.cur.x, y: a.cur.y }; };

P.val = function (a, k, T) {
  var tr = a.tracks[k], i, s, p;
  if (!tr) return a.init[k];
  for (i = tr.length - 1; i >= 0; i--) {
    s = tr[i];
    if (s.t0 <= T) {
      if (T >= s.t1 || s.kind === 'd') return s.to;
      p = s.ease((T - s.t0) / (s.t1 - s.t0));
      return s.kind === 'n' ? s.from + (s.to - s.from) * p : mix(s.from, s.to, p);
    }
  }
  return a.init[k];
};

P.step = function (caption, fn, o) {
  o = o || {};
  var st = { i: this.steps.length, t0: this.t, caption: caption, end: 0 };
  this._cur = st;
  if (fn) fn.call(this, this);
  this._cur = null;
  st.dur = o.dur || Math.max(st.end + (o.hold == null ? 1200 : o.hold), 1600);
  st.t1 = st.t0 + st.dur; this.t = st.t1;
  this.steps.push(st);
  return this;
};

P._ev = function (type, v, o) {
  var st = this._cur, delay = (o && o.delay) || 0;
  this.events.push({ t: st ? st.t0 + delay + 1 : 0, type: type, v: v });
  if (st && delay > st.end) st.end = delay;
  return this;
};
P.code = function (n, o) { return this._ev('code', Array.isArray(n) ? n : [n, n], o); };
P.log = function (text, o) { return this._ev('log', { text: String(text), kind: (o && o.kind) || '' }, o); };
P.data = function (obj, o) { return this._ev('data', obj, o); };

P.pop = function (id, o) {
  var d = (o && o.delay) || 0;
  this.set(id, { scale: .4 }, { delay: d });
  return this.to(id, { opacity: 1, scale: 1 }, { dur: (o && o.dur) || 450, delay: d, ease: 'back' });
};
P.hide = function (id, o) { o = o || {}; return this.to(id, { opacity: 0 }, { dur: o.dur || 350, delay: o.delay || 0, ease: 'out' }); };
P.pulse = function (id, o) {
  o = o || {}; var d = o.delay || 0;
  this.to(id, { scale: o.scale || 1.18 }, { dur: 170, delay: d, ease: 'out' });
  return this.to(id, { scale: 1 }, { dur: 330, delay: d + 170, ease: 'back' });
};
P.flash = function (id, color, o) {
  o = o || {};
  var d = o.delay || 0, k = o.prop || 'fill', orig = this.byId[id].cur[k], up = {}, back = {};
  up[k] = color; back[k] = orig;
  this.to(id, up, { dur: 180, delay: d, ease: 'out' });
  return this.to(id, back, { dur: o.dur || 520, delay: d + (o.hold || 380), ease: 'inOut' });
};
P.ripple = function (x, y, o) {
  o = o || {};
  var d = o.delay || 0, id = '_r' + (this._uid++);
  this.ring(id, { x: x, y: y, stroke: o.color || C.cyan });
  this.set(id, { opacity: .95 }, { delay: d });
  this.to(id, { r: o.r || 34, opacity: 0 }, { dur: o.dur || 650, delay: d, ease: 'out' });
  return this;
};
P._pt = function (p) {
  if (typeof p !== 'string') return p;
  var a = this.byId[p];
  if (!a) throw new Error('未知元素: ' + p);
  return a.type === 'line' ? [a.cur.x2, a.cur.y2] : [a.cur.x, a.cur.y];
};
P.fly = function (from, to, o) {
  o = o || {};
  var A = this._pt(from), B = this._pt(to), d = o.delay || 0, dur = o.dur || 700, col = o.color || C.cyan;
  var id = o.id || ('_f' + (this._uid++));
  if (o.label != null && o.w) this.box(id, { x: A[0], y: A[1], w: o.w, h: o.h || 30, rx: 6, fill: col, stroke: 'none', sw: 0, label: o.label, color: o.ink || C.bg, size: o.size || 14, opacity: 0, trail: 3 });
  else this.dot(id, { x: A[0], y: A[1], r: o.r || (o.label != null ? 15 : 9), fill: col, label: o.label == null ? '' : o.label, color: o.ink || C.bg, opacity: 0, trail: 4 });
  this.to(id, { opacity: 1 }, { dur: 120, delay: d, ease: 'out' });
  this.to(id, { x: B[0], y: B[1] }, { dur: dur, delay: d, ease: o.ease || 'inOut' });
  if (o.ripple !== false) this.ripple(B[0], B[1], { delay: d + dur, color: col });
  if (!o.keep) this.to(id, { opacity: 0 }, { dur: 220, delay: d + dur + (o.linger || 60), ease: 'out' });
  return id;
};
P.count = function (id, to, o) { o = o || {}; return this.to(id, { val: to }, { dur: o.dur || 600, delay: o.delay || 0, ease: 'out' }); };

/* ════════ 注册表 / 场景表 ════════ */
function register(id, def) { def.id = id; if (!REG[id]) ORDER.push(id); REG[id] = def; }
function report() {
  return ORDER.map(function (id) {
    var def = REG[id];
    return { id: id, title: def.title, sources: def.sources || [], scenes: def.scenes.map(function (sd) {
      var sc = new Scene(sd);
      return { name: sd.name, steps: sc.steps.length, seconds: Math.round(sc.total / 100) / 10, moving: sd.moving || '' };
    }) };
  });
}

var Viz = { C: C, register: register, report: report, Scene: Scene, players: [] };
root.Viz = Viz;
if (typeof document === 'undefined') return;

/* ════════ Player：DOM、时钟、播放条 ════════ */
var REDUCE = false;
if (root.matchMedia) {
  var mq = root.matchMedia('(prefers-reduced-motion: reduce)');
  REDUCE = mq.matches;
  var onMq = function (e) { REDUCE = e.matches; };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
}
var LH = 21; /* 代码行高，与 CSS .viz-code .ln 保持一致 */

function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function s(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
function setA(e, k, v) { var c = e.__c || (e.__c = {}); if (c[k] !== v) { c[k] = v; e.setAttribute(k, v); } }
function setT(e, v) { if (e.__t !== v) { e.__t = v; e.textContent = v; } }
function r2(v) { return Math.round(v * 100) / 100; }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function makeEl(layer, a) {
  var i = a.init, e = {}, g, k, n;
  if (a.type === 'line') {
    e.g = g = s('g', {});
    e.shape = s('line', { 'stroke-linecap': 'round' }); g.appendChild(e.shape);
    if (i.arrow) { e.head = s('polygon', {}); g.appendChild(e.head); }
  } else if (a.type === 'path') {
    e.g = g = s('g', {});
    e.shape = s('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1 }); g.appendChild(e.shape);
  } else if (a.type === 'ring') {
    e.g = g = s('g', {});
    e.shape = s('circle', { fill: 'none' }); g.appendChild(e.shape);
  } else {
    n = i.trail || 0;
    if (n) {
      e.ghosts = [];
      for (k = 0; k < n; k++) {
        var gh = a.type === 'box' ? s('rect', { rx: i.rx, opacity: 0 }) : s('circle', { opacity: 0 });
        layer.appendChild(gh); e.ghosts.push(gh);
      }
    }
    e.g = g = s('g', {});
    if (a.type !== 'text') { e.shape = s(a.type === 'box' ? 'rect' : 'circle', {}); g.appendChild(e.shape); }
    e.label = s('text', { 'xml:space': 'preserve', 'dominant-baseline': 'central', 'text-anchor': a.type === 'text' ? i.anchor : 'middle', 'font-weight': i.weight });
    g.appendChild(e.label);
  }
  layer.appendChild(g);
  a.el = e;
}

function draw(sc, a, T) {
  var e = a.el, t = a.type, v = function (k) { return sc.val(a, k, T); }, x, y, op = r2(clamp01(v('opacity')));
  setA(e.g, 'opacity', op);
  if (t === 'line') {
    var x1 = v('x1'), y1 = v('y1'), d = clamp01(v('draw')), x2 = x1 + (v('x2') - x1) * d, y2 = y1 + (v('y2') - y1) * d, sw = v('sw'), st = v('stroke');
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)), ex = x2, ey = y2;
    if (e.head) {
      var L = 9 + sw * 1.6, W = L * .48, ux = len ? (x2 - x1) / len : 1, uy = len ? (y2 - y1) / len : 0;
      if (len > L) { ex = x2 - ux * L * .8; ey = y2 - uy * L * .8; }
      setA(e.head, 'points', r2(x2) + ',' + r2(y2) + ' ' + r2(x2 - ux * L - uy * W) + ',' + r2(y2 - uy * L + ux * W) + ' ' + r2(x2 - ux * L + uy * W) + ',' + r2(y2 - uy * L - ux * W));
      setA(e.head, 'fill', st); setA(e.head, 'opacity', len > 4 ? 1 : 0);
    }
    setA(e.shape, 'x1', r2(x1)); setA(e.shape, 'y1', r2(y1)); setA(e.shape, 'x2', r2(ex)); setA(e.shape, 'y2', r2(ey));
    setA(e.shape, 'stroke', st); setA(e.shape, 'stroke-width', sw); setA(e.shape, 'stroke-dasharray', v('dash') || 'none');
    return;
  }
  if (t === 'path') {
    var dr = clamp01(v('draw'));
    setA(e.shape, 'd', v('d')); setA(e.shape, 'stroke', v('stroke')); setA(e.shape, 'stroke-width', v('sw'));
    setA(e.shape, 'stroke-dasharray', dr < 1 ? r2(dr) + ' 1' : 'none');
    return;
  }
  x = v('x'); y = v('y');
  if (t === 'ring') {
    setA(e.shape, 'cx', r2(x)); setA(e.shape, 'cy', r2(y)); setA(e.shape, 'r', r2(v('r')));
    setA(e.shape, 'stroke', v('stroke')); setA(e.shape, 'stroke-width', v('sw'));
    return;
  }
  setA(e.g, 'transform', 'translate(' + r2(x) + ',' + r2(y) + ') scale(' + r2(v('scale')) + ')');
  if (t === 'text') {
    var val = v('val');
    setT(e.label, val == null ? String(v('text')) : v('pre') + Math.round(val) + v('suf'));
    setA(e.label, 'fill', v('color')); setA(e.label, 'font-size', v('size'));
    return;
  }
  var fill = v('fill');
  if (t === 'box') {
    var w = v('w'), hh = v('h');
    setA(e.shape, 'x', r2(-w / 2)); setA(e.shape, 'y', r2(-hh / 2)); setA(e.shape, 'width', r2(w)); setA(e.shape, 'height', r2(hh));
    setA(e.shape, 'rx', v('rx')); setA(e.shape, 'stroke-dasharray', v('dash') || 'none');
  } else {
    setA(e.shape, 'r', r2(v('r')));
  }
  setA(e.shape, 'fill', fill); setA(e.shape, 'stroke', v('stroke')); setA(e.shape, 'stroke-width', v('sw'));
  setT(e.label, String(v('label'))); setA(e.label, 'fill', v('color')); setA(e.label, 'font-size', v('size'));
  if (e.ghosts) {
    for (var k = 0; k < e.ghosts.length; k++) {
      var tk = T - (k + 1) * 38, gx = sc.val(a, 'x', tk), gy = sc.val(a, 'y', tk), gh = e.ghosts[k];
      var go = (Math.abs(gx - x) + Math.abs(gy - y) > .6) ? clamp01(sc.val(a, 'opacity', tk)) * .42 * (1 - k / (e.ghosts.length + 1)) : 0;
      setA(gh, 'opacity', r2(go));
      if (!go) continue;
      setA(gh, 'fill', fill);
      if (t === 'box') { var gw = v('w'), ghh = v('h'); setA(gh, 'x', r2(gx - gw / 2)); setA(gh, 'y', r2(gy - ghh / 2)); setA(gh, 'width', gw); setA(gh, 'height', ghh); }
      else { setA(gh, 'cx', r2(gx)); setA(gh, 'cy', r2(gy)); setA(gh, 'r', r2(v('r') * (1 - k * .12))); }
    }
  }
}

function Player(mount, def) {
  this.def = def; this.speed = 1; this.T = 0; this.playing = false; this.stopAt = null; this.cache = {}; this._raf = 0; this._acc = 0;
  this.build(mount);
  this.load(0);
}
var PP = Player.prototype;

PP.build = function (mount) {
  var self = this, def = this.def, el = this.el = h('div', 'viz');
  el.tabIndex = 0; el.setAttribute('contenteditable', 'false');
  var head = h('div', 'viz-head');
  head.appendChild(h('div', 'viz-title', def.title));
  var tabs = this.tabs = h('div', 'viz-tabs');
  def.scenes.forEach(function (sd, i) {
    var b = h('button', 'viz-tab', (i + 1) + '. ' + sd.name); b.type = 'button';
    b.onclick = function () { self.load(i); };
    tabs.appendChild(b);
  });
  if (def.scenes.length < 2) tabs.style.display = 'none';
  head.appendChild(tabs); el.appendChild(head);

  var body = h('div', 'viz-body'), stage = h('div', 'viz-stage');
  this.svg = s('svg', { viewBox: '0 0 860 560', role: 'img', 'aria-label': def.title });
  this.svg.appendChild(s('rect', { x: 0, y: 0, width: 860, height: 560, fill: C.bg }));
  this.layer = s('g', {}); this.svg.appendChild(this.layer);
  stage.appendChild(this.svg);
  this.cap = h('div', 'viz-cap'); stage.appendChild(this.cap);
  body.appendChild(stage);

  var side = this.sideEl = h('div', 'viz-side');
  var pc = h('div', 'viz-pane viz-pane-code'); pc.appendChild(this.codeHd = h('div', 'viz-pane-hd', '代码'));
  this.codeBox = h('div', 'viz-code'); pc.appendChild(this.codeBox); side.appendChild(pc);
  var pl = h('div', 'viz-pane viz-pane-log'); pl.appendChild(h('div', 'viz-pane-hd', '控制台'));
  this.logBox = h('div', 'viz-log'); pl.appendChild(this.logBox); side.appendChild(pl);
  var pd = h('div', 'viz-pane viz-pane-data'); pd.appendChild(h('div', 'viz-pane-hd', '数据'));
  this.dataBox = h('div', 'viz-data'); pd.appendChild(this.dataBox); side.appendChild(pd);
  body.appendChild(side); el.appendChild(body);

  var bar = h('div', 'viz-bar'), ctl = h('div', 'viz-ctl');
  function btn(txt, title, fn) { var b = h('button', 'viz-btn', txt); b.type = 'button'; b.title = title; b.onclick = fn; ctl.appendChild(b); return b; }
  btn('⏮', '回到开头', function () { self.pause(); self.seek(0); });
  btn('◀ 回退', '回到上一步', function () { self.stepBack(); });
  this.btnPlay = btn('▶ 播放', '播放 / 暂停（空格）', function () { self.toggle(); });
  this.btnPlay.className += ' viz-btn-main';
  btn('单步 ▶', '只播放下一步', function () { self.stepFwd(); });
  var sp = h('div', 'viz-speed'); this.spBtns = [];
  [0.5, 1, 2].forEach(function (v) {
    var b = h('button', 'viz-btn', v + '×'); b.type = 'button'; b.title = '速度 ' + v + '×';
    b.onclick = function () { self.speed = v; self.ui(); };
    b.__v = v; sp.appendChild(b); self.spBtns.push(b);
  });
  ctl.appendChild(sp);
  this.cnt = h('span', 'viz-cnt'); ctl.appendChild(this.cnt);
  this.tm = h('span', 'viz-tm'); ctl.appendChild(this.tm);
  bar.appendChild(ctl);
  this.prog = h('div', 'viz-prog'); bar.appendChild(this.prog);
  el.appendChild(bar);

  if (def.sources && def.sources.length) {
    var det = h('details', 'viz-src'), ul = h('ul');
    det.appendChild(h('summary', null, '出处'));
    def.sources.forEach(function (o) {
      var li = h('li'), a = h('a', null, o.t); a.href = o.u; a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a); ul.appendChild(li);
    });
    det.appendChild(ul); el.appendChild(det);
  }

  el.addEventListener('keydown', function (ev) {
    if (ev.target !== el) return;
    if (ev.key === ' ') { ev.preventDefault(); self.toggle(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); self.stepFwd(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); self.stepBack(); }
  });

  /* 进度条：点一段 = 跳到该步完成时；按住拖动 = 任意时刻 */
  var down = null;
  function at(ev) { var r = self.prog.getBoundingClientRect(); return clamp01((ev.clientX - r.left) / r.width) * self.sc.total; }
  this.prog.addEventListener('pointerdown', function (ev) { down = { x: ev.clientX, drag: false }; self.prog.setPointerCapture(ev.pointerId); });
  this.prog.addEventListener('pointermove', function (ev) {
    if (!down) return;
    if (Math.abs(ev.clientX - down.x) > 4) down.drag = true;
    if (down.drag) { self.pause(); self.seek(at(ev)); }
  });
  this.prog.addEventListener('pointerup', function (ev) {
    if (!down) return;
    if (!down.drag) {
      var t = at(ev), st = self.sc.steps, i;
      for (i = 0; i < st.length; i++) if (t < st[i].t1 || i === st.length - 1) { self.pause(); self.seek(st[i].t1); break; }
    }
    down = null;
  });

  if (root.IntersectionObserver) {
    new IntersectionObserver(function (en) { if (!en[0].isIntersecting && self.playing) self.pause(); }).observe(el);
  }
  mount.appendChild(el);
};

PP.load = function (i) {
  var sd = this.def.scenes[i], sc = this.cache[i] || (this.cache[i] = new Scene(sd)), self = this, k;
  this.pause();
  this.sc = sc; this.idx = i; this.T = 0;
  for (k = 0; k < this.tabs.children.length; k++) this.tabs.children[k].className = 'viz-tab' + (k === i ? ' on' : '');
  while (this.layer.firstChild) this.layer.removeChild(this.layer.firstChild);
  sc.actors.forEach(function (a) { makeEl(self.layer, a); draw(sc, a, 0); });

  var lines = sd.code ? String(sd.code).replace(/^\n+|\s+$/g, '').split('\n') : [];
  this.codeBox.innerHTML = '';
  this.codeBox.parentNode.style.display = lines.length ? '' : 'none';
  this.codeHd.textContent = '代码' + (sd.lang ? ' · ' + sd.lang : '');
  this.bar = h('div', 'viz-hl'); this.codeBox.appendChild(this.bar);
  this.lns = lines.map(function (t, n) {
    var d = h('div', 'ln'), no = h('span', 'no', n + 1);
    d.appendChild(no); d.appendChild(document.createTextNode(t || ' '));
    self.codeBox.appendChild(d); return d;
  });
  this.prog.innerHTML = ''; this.fills = [];
  sc.steps.forEach(function (st) {
    var seg = h('div', 'viz-seg'), f = h('div', 'viz-fill');
    seg.style.flex = st.dur + ' 0 0'; seg.title = '第 ' + (st.i + 1) + ' 步：' + st.caption;
    seg.appendChild(f); self.prog.appendChild(seg); self.fills.push(f);
  });
  this._nlog = -1; this._sig = null; this._codeEv = undefined; this.cells = {};
  this.render(); this.ui();
};

PP.render = function () {
  var sc = this.sc, T = this.T, i, si = -1, st, w;
  for (i = 0; i < sc.anim.length; i++) draw(sc, sc.anim[i], T);
  for (i = 0; i < sc.steps.length; i++) { if (sc.steps[i].t0 < T) si = i; else break; }
  setT(this.cap, si < 0 ? (sc.def.intro || '按「▶ 播放」连续看，或用「单步 ▶」一步一步看') : sc.steps[si].caption);
  setT(this.cnt, '第 ' + (si + 1) + ' / ' + sc.steps.length + ' 步');
  setT(this.tm, (T / 1000).toFixed(1) + 's / ' + (sc.total / 1000).toFixed(1) + 's');
  for (i = 0; i < sc.steps.length; i++) {
    st = sc.steps[i]; w = Math.round(clamp01((T - st.t0) / st.dur) * 1000) / 10 + '%';
    if (this.fills[i].__w !== w) { this.fills[i].__w = w; this.fills[i].style.width = w; }
  }
  this.side(T);
};

PP.side = function (T) {
  var ev = this.sc.events, i, e, k, cur = null, prev = null, logs = [], data = {}, when = {};
  for (i = 0; i < ev.length; i++) {
    e = ev[i];
    if (e.t > T) break;
    if (e.type === 'code') { prev = cur; cur = e; }
    else if (e.type === 'log') logs.push(e);
    else for (k in e.v) {
      if (e.v[k] === null) { delete data[k]; delete when[k]; }
      else { if (data[k] !== e.v[k]) when[k] = e.t; data[k] = e.v[k]; }
    }
  }
  /* 代码高亮条：在上一行和这一行之间滑动 */
  if (this.lns.length) {
    if (!cur) { this.bar.style.opacity = 0; }
    else {
      var p = EASE.out(clamp01((T - cur.t) / 260)), a = prev ? prev.v : cur.v;
      var top = a[0] + (cur.v[0] - a[0]) * p, bot = a[1] + (cur.v[1] - a[1]) * p;
      this.bar.style.opacity = 1;
      this.bar.style.transform = 'translateY(' + r2((top - 1) * LH) + 'px)';
      this.bar.style.height = r2((bot - top + 1) * LH) + 'px';
    }
    if (this._codeEv !== cur) {
      this._codeEv = cur;
      for (i = 0; i < this.lns.length; i++) this.lns[i].className = 'ln' + (cur && i + 1 >= cur.v[0] && i + 1 <= cur.v[1] ? ' on' : '');
      if (cur) {
        var y0 = (cur.v[0] - 1) * LH, y1 = cur.v[1] * LH, box = this.codeBox;
        if (y0 < box.scrollTop || y1 > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, y0 - box.clientHeight / 3);
      } else this.codeBox.scrollTop = 0;
    }
  }
  /* 控制台 */
  if (logs.length !== this._nlog) {
    this._nlog = logs.length;
    this.logBox.innerHTML = logs.length ? logs.map(function (l) { return '<div class="lg ' + l.v.kind + '">' + esc(l.v.text) + '</div>'; }).join('') : '<div class="lg mute">（暂无输出）</div>';
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }
  if (logs.length) this.logBox.lastChild.style.opacity = r2(.25 + .75 * clamp01((T - logs[logs.length - 1].t) / 260));
  /* 数据 */
  var sig = JSON.stringify(data);
  if (sig !== this._sig) {
    this._sig = sig; this.cells = {};
    this.dataBox.innerHTML = '';
    var keys = Object.keys(data);
    if (!keys.length) this.dataBox.appendChild(h('div', 'dv mute', '（空）'));
    for (i = 0; i < keys.length; i++) {
      var val = data[keys[i]], kd = h('div', 'dk', keys[i]), vd = h('div', 'dv', typeof val === 'object' ? JSON.stringify(val) : String(val));
      this.dataBox.appendChild(kd); this.dataBox.appendChild(vd); this.cells[keys[i]] = vd;
    }
  }
  for (k in this.cells) {
    /* 初始值（t=0 就有的）不闪，只有播放过程中变化的值才高亮一下 */
    var al = when[k] > 0 ? Math.round(clamp01(1 - (T - when[k]) / 800) * 10) / 20 : 0, c = this.cells[k];
    if (c.__a !== al) { c.__a = al; c.style.background = al ? 'rgba(255,184,77,' + al + ')' : ''; }
  }
};

PP.ui = function () {
  this.btnPlay.textContent = this.playing ? '⏸ 暂停' : (this.T >= this.sc.total ? '↻ 重播' : '▶ 播放');
  for (var i = 0; i < this.spBtns.length; i++) this.spBtns[i].className = 'viz-btn' + (this.spBtns[i].__v === this.speed ? ' on' : '');
};
PP.seek = function (t) { this.T = Math.max(0, Math.min(this.sc.total, t)); this.render(); this.ui(); };
PP.pause = function () { this.playing = false; this.stopAt = null; if (this.sc) this.ui(); };
PP.toggle = function () { if (this.playing) this.pause(); else this.play(null); };
PP.play = function (to) {
  if (this.T >= this.sc.total) { if (to != null) return; this.T = 0; }
  this.stopAt = to; this.playing = true; this._acc = 0; this.ui(); this.loop();
};
PP.nextEnd = function () {
  var st = this.sc.steps, i;
  for (i = 0; i < st.length; i++) if (st[i].t1 > this.T + .5) return st[i].t1;
  return this.sc.total;
};
PP.stepFwd = function () {
  if (this.T >= this.sc.total) return;
  var t = this.nextEnd();
  if (REDUCE) { this.pause(); this.seek(t); } else this.play(t);
};
PP.stepBack = function () {
  var st = this.sc.steps, i, t = 0;
  for (i = 0; i < st.length; i++) if (st[i].t0 < this.T - .5) t = st[i].t0;
  this.pause(); this.seek(t);
};
PP.loop = function () {
  var self = this, last = 0;
  if (this._raf) return;
  function tick(now) {
    self._raf = 0;
    if (!self.playing) return;
    var dt = last ? Math.min(now - last, 100) : 16; last = now;
    if (REDUCE) {
      /* 减少动态效果：不做补间，按节奏直接跳到每一步的结果 */
      self._acc += dt * self.speed;
      if (self._acc >= 1500) { self._acc = 0; self.T = self.nextEnd(); if (self.T >= self.sc.total) self.playing = false; }
    } else {
      self.T += dt * self.speed;
      var lim = self.stopAt == null ? self.sc.total : self.stopAt;
      if (self.T >= lim) { self.T = lim; self.playing = false; self.stopAt = null; }
    }
    self.render();
    if (self.playing) self._raf = requestAnimationFrame(tick); else self.ui();
  }
  this._raf = requestAnimationFrame(tick);
};

/* 一个可视化的部分场景（data-scenes="1,2"）：拆开放到各自的知识点下面。标题默认是「总标题的主语 · 这几个场景名」 */
function part(def, idx, title) {
  var d = {}, k;
  for (k in def) d[k] = def[k];
  d.scenes = idx.map(function (i) { return def.scenes[i]; }).filter(Boolean);
  if (!d.scenes.length) throw new Error('data-scenes 没有选中任何场景');
  d.title = title || def.title.split('：')[0] + ' · ' + d.scenes.map(function (sd) { return sd.name; }).join(' / ');
  return d;
}
Viz.mountAll = function (scope) {
  var list = (scope || document).querySelectorAll('[data-viz]'), i, m, def, sub;
  for (i = 0; i < list.length; i++) {
    m = list[i];
    if (m.__viz) continue;
    def = REG[m.getAttribute('data-viz')];
    if (!def) { m.textContent = '（未找到可视化：' + m.getAttribute('data-viz') + '）'; continue; }
    sub = m.getAttribute('data-scenes');
    if (sub) {
      try { def = part(def, sub.split(',').map(Number), m.getAttribute('data-title')); }
      catch (err) { m.textContent = '可视化加载失败：' + err.message; continue; }
    }
    try { m.__viz = new Player(m, def); Viz.players.push(m.__viz); }
    catch (err) { m.textContent = '可视化加载失败：' + err.message; if (root.console) console.error(err); }
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
