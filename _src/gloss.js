/* gloss.js —— 术语提示卡：鼠标移到缩写 / 专有名词上，弹一张小卡片显示全称和简短解释。主笔记和 Lab 笔记共用。
 * 词表在 _src/glossary/*.json，构建时写进 window.GLOSS = [{ t 名称, f 全称, d 解释, a 别名, h 链接, n 链接文字 }]。
 * 标记在页面脚本里加（不改 Markdown 也不进构建产物）：每次出现都带一条淡淡的细下划线，鼠标移上去有卡片。
 *   Gloss.scan(el)   给 el 里的术语加标记（可重复调用，已标记的跳过）
 *   Gloss.clear(el)  去掉 el 里的标记（进入编辑模式时用，保存的修改里不会混进标记）
 *   Gloss.watch(el)  el 里的内容以后变了也自动加标记（Lab 笔记的组件会反复重绘）
 */
(function (root) {
'use strict';
var G = root.GLOSS || [], map = Object.create(null), re = null;
/* 这些地方不加标记：链接、代码块、按钮、动画和图、小标签 */
var SKIP = 'a,pre,kbd,code,svg,button,input,select,option,textarea,script,style,summary,.gl,.viz,.dg,.chip,.kick,.hn,.lvl,.lvs,.lvsum,.vz-src,.vz-svg,.vz-out,.code,.cl,.cmd,.out,.badge,.sid,.w-hd,.c-pl';
var ALNUM = /[A-Za-z0-9_]/;

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function html(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function init() {
  var words = [];
  G.forEach(function (e, i) { [e.t].concat(e.a || []).forEach(function (w) { map[w] = i; words.push(w); }); });
  words.sort(function (a, b) { return b.length - a.length; });     /* 长的优先：Strict 2PL 先于 2PL */
  re = words.length ? new RegExp(words.map(esc).join('|'), 'g') : null;
}
/* 英文词两边不能再连着字母数字（LSN 不匹配 GRSN），中文词不用看 */
function bounded(s, a, b) {
  return !(ALNUM.test(s.charAt(a)) && a > 0 && ALNUM.test(s.charAt(a - 1))) && !(ALNUM.test(s.charAt(b - 1)) && b < s.length && ALNUM.test(s.charAt(b)));
}
function mark(id) {
  var sp = document.createElement('span');
  sp.className = 'gl'; sp.setAttribute('data-g', id);
  return sp;
}
function scan(scope) {
  if (!re || !scope) return;
  var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  var nodes = [], n;
  while ((n = w.nextNode())) { if (n.nodeValue.trim()) nodes.push(n); }
  nodes.forEach(function (t) {
    var s = t.nodeValue, m, last = 0, frag = null;
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      var a = m.index, b = a + m[0].length;
      if (!bounded(s, a, b)) { re.lastIndex = a + 1; continue; }
      frag = frag || document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last, a)));
      var sp = mark(map[m[0]]); sp.textContent = m[0];
      frag.appendChild(sp); last = b;
    }
    if (frag) { frag.appendChild(document.createTextNode(s.slice(last))); t.parentNode.replaceChild(frag, t); }
  });
  /* 行内代码：整段内容正好是一个术语才标（pageLSN 这种），整个 <code> 包起来 */
  Array.prototype.forEach.call(scope.querySelectorAll('code'), function (c) {
    var p = c.parentElement;
    if (!p || p.closest(SKIP) || !(c.textContent in map)) return;
    var sp = mark(map[c.textContent]);
    p.replaceChild(sp, c); sp.appendChild(c);
  });
}
function clear(scope) {
  if (!scope) return;
  Array.prototype.forEach.call(scope.querySelectorAll('.gl'), function (e) {
    var p = e.parentNode;
    while (e.firstChild) p.insertBefore(e.firstChild, e);
    p.removeChild(e); p.normalize();
  });
}
function watch(el) {
  var pending = [], raf = 0, ob;
  function flush() {
    raf = 0;
    var list = pending; pending = [];
    ob.disconnect();
    list.forEach(function (x) { if (x.isConnected) scan(x); });
    ob.observe(el, { childList: true, subtree: true });
  }
  ob = new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      var t = m.target;
      if (t.closest && t.closest('svg,.vz-src,.gl')) return;
      if (t.nodeType === 1 && pending.indexOf(t) < 0) pending.push(t);
    });
    if (pending.length && !raf) raf = requestAnimationFrame(flush);
  });
  scan(el);
  ob.observe(el, { childList: true, subtree: true });
}

/* ════════ 小卡片 ════════ */
var card = null, tShow = 0, tHide = 0, cur = null;
function ensure() {
  if (card) return card;
  var st = document.createElement('style');
  /* 淡淡的细下划线：不支持 color-mix 的浏览器退回到灰色 */
  st.textContent = '.gl{cursor:help;text-decoration:underline solid 1px var(--muted);text-decoration-color:color-mix(in srgb,var(--accent-ink) 32%,transparent);text-underline-offset:3px}' +
    '.gl:hover,.gl.on{color:var(--accent-ink);background:var(--accent-soft);border-radius:3px}' +
    'h1 .gl,h2 .gl,h3 .gl,h4 .gl{text-decoration:none}' +
    '.glcard{position:fixed;z-index:60;max-width:min(340px,calc(100vw - 20px));background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px 13px 11px;font:14px/1.6 var(--sans);display:none}' +
    '.glcard.on{display:block}.glcard .t{display:block;font-size:15px;font-weight:700}.glcard .f{color:var(--accent-ink);font-size:13px;line-height:1.5;margin:1px 0 5px}' +
    '.glcard p{margin:0}.glcard .s{display:inline-block;margin-top:6px;font-size:12.5px;color:var(--accent-ink)}@media print{.gl{text-decoration:none}.glcard{display:none!important}}';
  document.head.appendChild(st);
  card = document.createElement('div');
  card.className = 'glcard'; card.setAttribute('role', 'tooltip');
  card.addEventListener('mouseenter', function () { clearTimeout(tHide); });
  card.addEventListener('mouseleave', function () { hideSoon(); });
  document.body.appendChild(card);
  return card;
}
function show(sp) {
  var e = G[+sp.getAttribute('data-g')]; if (!e) return;
  var c = ensure();
  c.innerHTML = '<span class="t">' + html(e.t) + '</span>' + (e.f ? '<div class="f">' + html(e.f) + '</div>' : '') + '<p>' + html(e.d) + '</p>' + (e.h ? '<a class="s" href="' + html(e.h) + '">' + html(e.n || '详见笔记') + ' ›</a>' : '');
  c.classList.add('on');
  if (cur) cur.classList.remove('on');
  cur = sp; sp.classList.add('on');
  /* 优先放在词的下方，放不下翻到上方；左右不出屏幕。折行的词按鼠标所在的那一段算 */
  var rs = sp.getClientRects(), r = rs[0] || sp.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
  if (show.y != null) Array.prototype.forEach.call(rs, function (x) { if (show.y >= x.top && show.y <= x.bottom) r = x; });
  var top = r.bottom + 6 + ch > H - 8 ? r.top - ch - 6 : r.bottom + 6;
  c.style.left = Math.max(8, Math.min(r.left, W - cw - 10)) + 'px';
  c.style.top = Math.max(8, top) + 'px';
}
function hide() { if (card) card.classList.remove('on'); if (cur) cur.classList.remove('on'); cur = null; }
function hideSoon() { clearTimeout(tHide); tHide = setTimeout(hide, 160); }
function active() { return !document.body.classList.contains('editing'); }
document.addEventListener('mouseover', function (ev) {
  var sp = ev.target.closest && ev.target.closest('.gl');
  if (!sp || !active()) return;
  clearTimeout(tHide); clearTimeout(tShow);
  show.y = ev.clientY;
  tShow = setTimeout(function () { show(sp); }, 120);
});
document.addEventListener('mouseout', function (ev) {
  var sp = ev.target.closest && ev.target.closest('.gl');
  if (sp) { clearTimeout(tShow); hideSoon(); }
});
/* 触屏没有悬停：点一下显示，点别处收起 */
document.addEventListener('click', function (ev) {
  var t = ev.target.closest ? ev.target : null; if (!t) return;
  var sp = t.closest('.gl');
  if (sp && active()) { show.y = ev.clientY; show(sp); return; }
  if (!t.closest('.glcard')) hide();
});
document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hide(); });
window.addEventListener('scroll', hide, true);

init();
ensure();      /* 样式一加载就要有：下划线不能等到第一次悬停才出现 */
root.Gloss = { scan: function (el) { scan(el); }, clear: clear, watch: watch };
})(window);
