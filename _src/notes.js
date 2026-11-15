/* notes.js —— 页面交互：讲次切换、侧边栏、可编辑笔记（本机保存）、主题、图表与可视化挂载 */
(function () {
'use strict';
var PAGE = document.body.getAttribute('data-page') || 'page', KEY = 'cmu445:' + PAGE;
var $ = function (q, el) { return (el || document).querySelector(q); };
var $$ = function (q, el) { return Array.prototype.slice.call((el || document).querySelectorAll(q)); };
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.className = 'toast on'; clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 1800); }

/* ── 主题 ── */
var theme = store('cmu445:theme') || ((window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
function applyTheme() { document.documentElement.setAttribute('data-theme', theme); }
applyTheme();
var tBtn = $('#themeBtn');
if (tBtn) tBtn.onclick = function () { theme = theme === 'dark' ? 'light' : 'dark'; store('cmu445:theme', theme); applyTheme(); };

var onTab = $('.tabs a.on');
if (onTab && onTab.scrollIntoView) onTab.scrollIntoView({ block: 'nearest', inline: 'center' });

if (window.DG) DG.renderAll();
if (window.Viz) Viz.mountAll();

/* ── 完成进度：每一讲、每一小节都能打勾，章节按讲数算（首页和章节页共用，存在本机浏览器）──
 * READ[讲 id] = 1 表示整讲完成；READ[小节 id] = 1 表示这一小节完成。
 * 一讲的小节全打勾 → 自动算整讲完成；整讲打勾时它的小节都显示为已完成；取消其中一个小节 → 整讲变回未完成。 */
var READ = {};
try { READ = JSON.parse(store('cmu445:read') || '{}') || {}; } catch (e) { READ = {}; }
function subsOf(lec) {
  var out = [];
  $$('[data-of="' + lec + '"]').forEach(function (b) { var s = b.getAttribute('data-ck'); if (out.indexOf(s) < 0) out.push(s); });
  return out;
}
function isOn(id, of) { return !!(READ[id] || (of && READ[of])); }
function saveRead() { store('cmu445:read', JSON.stringify(READ)); paintRead(); }
function setLec(id, on) { if (on) READ[id] = 1; else delete READ[id]; subsOf(id).forEach(function (s) { delete READ[s]; }); }
function toggleCk(b) {
  var id = b.getAttribute('data-ck'), of = b.getAttribute('data-of');
  if (!of) { setLec(id, !READ[id]); return saveRead(); }
  var subs = subsOf(of);
  if (isOn(id, of)) {
    if (READ[of]) { subs.forEach(function (s) { READ[s] = 1; }); delete READ[of]; }
    delete READ[id];
  } else {
    READ[id] = 1;
    if (subs.every(function (s) { return READ[s]; })) { setLec(of, true); toast('这一讲的小节都打勾了，整讲记为完成'); }
  }
  saveRead();
}
function paintRead() {
  $$('[data-ck]').forEach(function (b) {
    var on = isOn(b.getAttribute('data-ck'), b.getAttribute('data-of'));
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (b.hasAttribute('data-big')) b.textContent = on ? '✓ 这一讲已完成（点一下取消）' : '这一讲学完了，打个勾';
  });
  $$('[data-lec]').forEach(function (li) {
    var id = li.getAttribute('data-lec'), subs = subsOf(id), n = subs.filter(function (s) { return READ[s]; }).length, sc = $('.sc', li);
    li.classList.toggle('read', !!READ[id]);
    if (sc) sc.textContent = !READ[id] && n ? '小节 ' + n + ' / ' + subs.length + ' 已打勾' : '';
  });
  $$('[data-rl]').forEach(function (a) { a.classList.toggle('done', !!READ[a.getAttribute('data-rl')]); });
  /* 本章进度（章节页侧边栏） */
  var ids = $$('.lecs > li[data-lec]').map(function (li) { return li.getAttribute('data-lec'); });
  if (ids.length) {
    var k = ids.filter(function (id) { return READ[id]; }).length, all = k === ids.length, cp = $('.cprog');
    if (cp) {
      cp.classList.toggle('done', all);
      $('.bar i', cp).style.width = (k / ids.length * 100).toFixed(1) + '%';
      $('.txt', cp).textContent = all ? '✓ 本章全部完成' : '完成 ' + k + ' / ' + ids.length + ' 讲';
      $('.call', cp).textContent = all ? '全部取消' : '全部打勾';
    }
    var rn = $('.side-rail .rn'); if (rn) rn.textContent = k + '/' + ids.length;
  }
  /* 顶栏：整章完成的章节后面打 ✓ */
  $$('.tabs a[data-lecs]').forEach(function (a) {
    var ls = a.getAttribute('data-lecs').split(',').filter(Boolean), k2 = ls.filter(function (id) { return READ[id]; }).length;
    a.classList.toggle('done', ls.length > 0 && k2 === ls.length);
  });
  /* 首页章节卡片 */
  $$('.pcard').forEach(function (c) {
    var bs = $$('[data-ck]', c), k3 = bs.filter(function (e) { return e.classList.contains('on'); }).length, pr = $('.prog', c), all3 = bs.length > 0 && k3 === bs.length;
    c.classList.toggle('done', all3);
    if (pr) pr.textContent = all3 ? '✓ 本章完成' : k3 ? '完成 ' + k3 + ' / ' + bs.length : '';
  });
}
paintRead();
document.addEventListener('click', function (ev) {
  var t = ev.target.closest ? ev.target : null;
  var b = t && t.closest('[data-ck]');
  if (b) { ev.preventDefault(); ev.stopPropagation(); toggleCk(b); return; }
  var ca = t && t.closest('[data-call]');
  if (ca) {
    var ids = $$('.lecs > li[data-lec]').map(function (li) { return li.getAttribute('data-lec'); }), all = ids.every(function (id) { return READ[id]; });
    if (all && !confirm('把本章 ' + ids.length + ' 讲的勾全部取消？')) return;
    ids.forEach(function (id) { setLec(id, !all); });
    saveRead(); toast(all ? '已取消本章全部勾选' : '本章 ' + ids.length + ' 讲都打上勾了');
  }
}, true);

/* ── 目录侧栏：可以收起成窄条，给正文腾位置（宽屏才有；窄屏目录本来就是抽屉）── */
function setSide(c) {
  document.body.classList.toggle('side-collapsed', c);
  $$('[data-side-tg]').forEach(function (b) { b.setAttribute('aria-expanded', c ? 'false' : 'true'); });
  store('cmu445:side', c ? '1' : '0');
}
if ($('.side-rail')) {
  setSide(store('cmu445:side') === '1');
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-side-tg]');
    if (b) setSide(!document.body.classList.contains('side-collapsed'));
  });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target, typing = t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || t.tagName === 'INPUT' && !/^(checkbox|radio|range|button)$/.test(t.type));
    if (ev.key === '[' && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) setSide(!document.body.classList.contains('side-collapsed'));
  });
}

var lecs = $$('.lec');
if (!lecs.length) return;

/* ── 可编辑：每个块有稳定的 data-b，改动按块存 localStorage ── */
var orig = {}, saved = {}, blocks = $$('[data-b]');
try { saved = JSON.parse(store(KEY) || '{}') || {}; } catch (e) { saved = {}; }
blocks.forEach(function (el) {
  var b = el.getAttribute('data-b');
  orig[b] = el.innerHTML;
  if (saved[b] != null) { el.innerHTML = saved[b]; el.classList.add('edited'); }
});
function persist() { store(KEY, Object.keys(saved).length ? JSON.stringify(saved) : null); }
var editing = store('cmu445:editing') === '1', eBtn = $('#editBtn');
function applyEdit() {
  document.body.classList.toggle('editing', editing);
  blocks.forEach(function (el) { el.setAttribute('contenteditable', editing ? 'true' : 'false'); });
  if (eBtn) { eBtn.classList.toggle('on', editing); $('.lbl', eBtn).textContent = editing ? '编辑中' : '编辑'; }
  if (window.Gloss) {
    if (editing) { lecs.forEach(function (l) { Gloss.clear(l); l.__gl = 0; }); }
    else glossLec(document.getElementById(cur));
  }
}
function glossLec(l) { if (l && window.Gloss && !editing && !l.__gl) { Gloss.scan(l); l.__gl = 1; } }
applyEdit();
if (eBtn) eBtn.onclick = function () { editing = !editing; store('cmu445:editing', editing ? '1' : '0'); applyEdit(); toast(editing ? '现在可以直接修改正文，改动自动保存' : '已退出编辑'); };
var saveT = 0;
document.addEventListener('input', function (ev) {
  var el = ev.target.closest && ev.target.closest('[data-b]');
  if (!el) return;
  var b = el.getAttribute('data-b');
  if (el.innerHTML === orig[b]) { delete saved[b]; el.classList.remove('edited'); } else { saved[b] = el.innerHTML; el.classList.add('edited'); }
  clearTimeout(saveT); saveT = setTimeout(persist, 400);
});
window.addEventListener('beforeunload', persist);
function reset(scope) {
  var n = 0;
  $$('[data-b]', scope).forEach(function (el) {
    var b = el.getAttribute('data-b');
    if (saved[b] != null) { el.innerHTML = orig[b]; el.classList.remove('edited'); delete saved[b]; n++; if (window.Gloss && !editing) Gloss.scan(el); }
  });
  persist(); toast(n ? '已还原 ' + n + ' 处修改' : '没有需要还原的修改');
}
var acts = {
  resetLec: function () { var l = $('.lec.on'); if (l && confirm('还原这一讲里你做的所有修改？')) reset(l); },
  resetAll: function () { if (confirm('还原本页（整章）里你做的所有修改？')) reset(document); },
  exportEdits: function () {
    var blob = new Blob([JSON.stringify({ page: PAGE, edits: saved }, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'cmu445-' + PAGE + '-我的修改.json'; a.click();
    toast('已导出 ' + Object.keys(saved).length + ' 处修改');
  },
  importEdits: function () { $('#importFile').click(); }
};
$$('[data-act]').forEach(function (b) { b.onclick = function () { $('.menu').classList.remove('open'); acts[b.getAttribute('data-act')](); }; });
var imp = $('#importFile');
if (imp) imp.onchange = function () {
  var f = imp.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var o = JSON.parse(r.result), n = 0;
      if (o.page !== PAGE) { toast('这份文件属于另一章（' + o.page + '）'); return; }
      Object.keys(o.edits || {}).forEach(function (b) {
        var el = $('[data-b="' + b + '"]');
        if (el && typeof o.edits[b] === 'string') { el.innerHTML = o.edits[b]; el.classList.add('edited'); saved[b] = o.edits[b]; n++; if (window.Gloss && !editing) Gloss.scan(el); }
      });
      persist(); toast('已导入 ' + n + ' 处修改');
    } catch (e) { toast('导入失败：不是有效的导出文件'); }
  };
  r.readAsText(f); imp.value = '';
};
var mBtn = $('#moreBtn');
if (mBtn) mBtn.onclick = function (ev) { ev.stopPropagation(); $('.menu').classList.toggle('open'); };
document.addEventListener('click', function (ev) {
  var m = $('.menu'); if (m && !m.contains(ev.target)) m.classList.remove('open');
  if (document.body.classList.contains('nav-open') && !ev.target.closest('.side') && !ev.target.closest('#menuBtn')) document.body.classList.remove('nav-open');
});
var nBtn = $('#menuBtn');
if (nBtn) nBtn.onclick = function () { document.body.classList.toggle('nav-open'); };

/* ── 讲次切换（#L08 或 #L08-小节）── */
var ids = lecs.map(function (l) { return l.id; }), cur = null;
function show(id) {
  if (cur === id) return;
  cur = id;
  lecs.forEach(function (l) { l.classList.toggle('on', l.id === id); });
  $$('.lecs > li').forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-lec') === id); });
  $$('[data-rl]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-rl') === id); });
  var l = document.getElementById(id), t = l && $('h1', l);
  glossLec(l);
  if (t) document.title = t.textContent + ' · CMU 15-445 笔记';
  (window.Viz ? Viz.players : []).forEach(function (p) { if (p.playing) p.pause(); });
}
function route() {
  var hsh = decodeURIComponent(location.hash.slice(1)), el = hsh ? document.getElementById(hsh) : null, own = el && el.closest ? el.closest('.lec') : null;
  var m = /^[A-Z]\d+/.exec(hsh), id = own ? own.id : (m && ids.indexOf(m[0]) >= 0 ? m[0] : ids[0]);
  var changed = cur !== id;
  show(id);
  var t = el && hsh !== id ? el : null;
  if (t) t.scrollIntoView(); else if (changed) window.scrollTo(0, 0);
  document.body.classList.remove('nav-open');
  spy();
}
window.addEventListener('hashchange', route);

/* ── 侧边栏小节高亮 ── */
var spyT = 0;
function spy() {
  var l = document.getElementById(cur); if (!l) return;
  var hs = $$('h2[id]', l), best = null, i;
  for (i = 0; i < hs.length; i++) { if (hs[i].getBoundingClientRect().top < 130) best = hs[i]; else break; }
  $$('.lecs li.on .sub a').forEach(function (a) { a.classList.toggle('cur', !!best && a.getAttribute('href') === '#' + best.id); });
  var rp = $('#rp'), room = document.documentElement.scrollHeight - window.innerHeight;
  if (rp) rp.style.width = (room > 0 ? Math.min(100, Math.max(0, window.scrollY / room * 100)) : 0).toFixed(1) + '%';
}
window.addEventListener('scroll', function () { if (spyT) return; spyT = requestAnimationFrame(function () { spyT = 0; spy(); }); }, { passive: true });
route();
})();
