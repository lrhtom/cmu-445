/* app.js —— BusTub Lab 复原笔记的页面逻辑。数据来自 data.js（window.LAB，由 _tools/build_labs.py 生成）。 */
(function () {
'use strict';
var LAB = window.LAB, PAGES = ['intro', 'prereq', 'phases', 'files', 'viz', 'steps'];
var NAMES = { intro: '功能介绍', prereq: '前置知识', phases: '分阶段笔记', files: '文件地图', viz: '可视化演示', steps: '复原步骤链' };
var $ = function (q, el) { return (el || document).querySelector(q); };
var $$ = function (q, el) { return Array.prototype.slice.call((el || document).querySelectorAll(q)); };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function sget(k, d) { try { var v = JSON.parse(store(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
function sset(k, v) { store(k, JSON.stringify(v)); }
function paras(a) { return (Array.isArray(a) ? a : a ? [a] : []).map(function (p) { return '<p>' + inline(p) + '</p>'; }).join(''); }
function inline(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function proj(id) { return LAB.projects.filter(function (p) { return p.id === id; })[0] || LAB.projects[0]; }

/* ── 主题（和主笔记共用一个开关）── */
var theme = store('cmu445:theme') || ((window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);
$('#themeBtn').onclick = function () { theme = theme === 'dark' ? 'light' : 'dark'; store('cmu445:theme', theme); document.documentElement.setAttribute('data-theme', theme); if (viz) viz.go(viz.idx, true); };

/* ── C++ 着色：只用于显示，复制出去的是原文 ── */
var KW = /\b(alignas|auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|extern|false|final|float|for|friend|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|return|short|signed|sizeof|static|static_cast|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while)\b/g;
function hiLine(text, st) {
  var out = '', i = 0, s = text;
  if (st.block) {
    var e = s.indexOf('*/');
    if (e < 0) return '<span class="tk-c">' + esc(s) + '</span>';
    out += '<span class="tk-c">' + esc(s.slice(0, e + 2)) + '</span>'; s = s.slice(e + 2); st.block = false;
  }
  if (/^\s*#/.test(s)) return out + '<span class="tk-p">' + esc(s) + '</span>';
  var re = /(\/\/.*$)|(\/\*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d.xXa-fA-FuUlL']*\b)|(\b(?:std|bustub|size_t|u?int\d+_t|frame_id_t|page_id_t|txn_id_t|timestamp_t|KeyType|ValueType|KeyComparator)\b)/g, m, last = 0;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index)).replace(KW, '<span class="tk-k">$1</span>');
    if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
    else if (m[2]) { var e2 = s.indexOf('*/', m.index + 2); if (e2 < 0) { out += '<span class="tk-c">' + esc(s.slice(m.index)) + '</span>'; st.block = true; return out; } out += '<span class="tk-c">' + esc(s.slice(m.index, e2 + 2)) + '</span>'; re.lastIndex = e2 + 2; }
    else if (m[3]) out += '<span class="tk-s">' + esc(m[3]) + '</span>';
    else if (m[4]) out += '<span class="tk-n">' + esc(m[4]) + '</span>';
    else out += '<span class="tk-t">' + esc(m[5]) + '</span>';
    last = re.lastIndex;
  }
  return out + esc(s.slice(last)).replace(KW, '<span class="tk-k">$1</span>');
}
function blockState(file, upto) {
  // 进入第 upto 行之前是否处在块注释里
  var st = { block: false }, lines = LAB.files[file] || [];
  for (var i = 0; i < upto - 1; i++) hiLine(lines[i], st);
  return st;
}
var copies = [];
function codeBlock(file, a, b, notes, label) {
  var lines = (LAB.files[file] || []).slice(a - 1, b), st = blockState(file, a), at = {};
  Object.keys(notes || {}).forEach(function (k) { var m = /^(\d+)(?:-(\d+))?$/.exec(k); if (m) { var e = +(m[2] || m[1]); (at[e] = at[e] || []).push([k, notes[k]]); } });
  var body = lines.map(function (l, j) {
    var no = a + j, html = '<div class="ln"><span class="no">' + no + '</span><code>' + (hiLine(l, st) || ' ') + '</code></div>';
    (at[no] || []).forEach(function (n) { html += '<div class="an"><b class="r">' + (n[0].indexOf('-') > 0 ? '第 ' + n[0].replace('-', '–') + ' 行' : '第 ' + n[0] + ' 行') + '</b>' + inline(n[1]) + '</div>'; });
    return html;
  }).join('');
  var ci = copies.push(lines.join('\n') + '\n') - 1;
  return '<div class="code"><div class="code-hd"><span class="path">' + esc(file) + '</span><span class="rng">' + (label || '第 ' + a + '–' + b + ' 行') + '</span><span class="sp"></span>' +
    '<button class="copy" type="button" data-copy="' + ci + '">复制</button></div><div class="code-bd">' + body + '</div></div>';
}
document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('[data-copy]');
  if (!b) return;
  var text = copies[+b.getAttribute('data-copy')];
  function ok() { b.classList.add('ok'); b.textContent = '已复制'; setTimeout(function () { b.classList.remove('ok'); b.textContent = '复制'; }, 1400); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { } document.body.removeChild(t); }
});

/* ── 状态：当前 Project、每页滚动位置、勾选 ── */
var cur = sget('labs:proj', LAB.projects[0].id), page = 'intro', scrolls = sget('labs:scroll', {}), viz = null;
var done = sget('labs:done', {}), chk = sget('labs:chk', {});
window.LabCode = codeBlock;
window.LabDone = { get: function (id) { return !!done[id]; }, set: function (id, v) { done[id] = v; sset('labs:done', done); var sp = $('#pg-steps'); if (sp) sp.__key = null; paintProgress(); } };
function kindBadge(k) { return { new: '<span class="badge b-new">新建</span>', cont: '<span class="badge b-cont">续写</span>', todo: '<span class="badge b-todo">骨架+实现</span>', info: '<span class="badge b-info">讲解</span>', verify: '<span class="badge b-verify">验证</span>' }[k] || ''; }
function scopeBadge(k) { return { todo: '<span class="badge b-todo">含要你实现的空壳</span>', skeleton: '<span class="badge b-cont">骨架代码</span>', readonly: '<span class="badge b-ro">只读，不要改</span>' }[k] || ''; }
function lvl(n) { n = +n || 1; return '<span class="lvl" title="难度 ' + n + ' / 3">' + '●●●'.slice(0, n) + '<span style="opacity:.25">' + '●●●'.slice(0, 3 - n) + '</span></span>'; }
function phaseOf(pj, id) { return pj.phases.filter(function (p) { return p.id === id; })[0]; }
/* 难度 1–5、重要程度 3 必会 / 2 重要 / 1 了解：level = [难度, 重要程度, 理由] */
var IMP = { 3: '必会', 2: '重要', 1: '了解' };
function lvlLine(lv) {
  if (!lv) return '';
  return '<div class="lvl i' + lv[1] + '"><span class="st" title="难度 ' + lv[0] + ' / 5">难度 <b>' + '★★★★★'.slice(0, lv[0]) + '</b><u>' + '★★★★★'.slice(lv[0]) + '</u></span><span class="im">' + IMP[lv[1]] + '</span><span class="why">' + esc(lv[2]) + '</span></div>';
}
function lvlBadge(lv) { return lv ? ' <b class="lvs i' + lv[1] + '" title="' + IMP[lv[1]] + ' · 难度 ' + lv[0] + ' / 5：' + esc(lv[2]) + '">★' + lv[0] + '</b>' : ''; }
window.LabLevel = { line: lvlLine, IMP: IMP };
function stepsOf(pj, ph) { return pj.steps.filter(function (s) { return s.phase === ph; }); }

/* ── 完成进度：每一步打勾；阶段 = 它的步骤全勾上（也能整阶段一次打勾）；Project 同理。存在本机浏览器 ── */
function cnt(sts) { return { n: sts.length, d: sts.filter(function (s) { return done[s.id]; }).length }; }
function setPhase(pj, phId, v) { stepsOf(pj, phId).forEach(function (s) { done[s.id] = v; }); sset('labs:done', done); }
function paintProgress() {
  var pj = proj(cur);
  $$('[data-phck]').forEach(function (b) {
    var r = cnt(stepsOf(pj, b.getAttribute('data-phck'))), on = r.n > 0 && r.d === r.n;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  $$('[data-phn]').forEach(function (e) { var r = cnt(stepsOf(pj, e.getAttribute('data-phn'))); e.textContent = r.d ? '完成 ' + r.d + ' / ' + r.n + ' 步' : r.n + ' 步'; });
  $$('[data-phrl]').forEach(function (a) { var r = cnt(stepsOf(pj, a.getAttribute('data-phrl'))); a.classList.toggle('done', r.n > 0 && r.d === r.n); });
  var all = cnt(pj.steps);
  $$('[data-pjbar]').forEach(function (i) { i.style.width = (all.n ? all.d / all.n * 100 : 0).toFixed(1) + '%'; });
  $$('[data-pjtxt]').forEach(function (e) { e.textContent = all.n && all.d === all.n ? '✓ 全部完成' : '完成 ' + all.d + ' / ' + all.n + ' 步'; e.parentNode.classList.toggle('done', all.n > 0 && all.d === all.n); });
  $$('.side-rail .rn').forEach(function (e) { e.textContent = pj.phases.filter(function (p) { var r = cnt(stepsOf(pj, p.id)); return r.n && r.d === r.n; }).length + '/' + pj.phases.length; });
  $$('#projSeg button').forEach(function (b) {
    var p = proj(b.getAttribute('data-proj')), r = cnt(p.steps);
    b.classList.toggle('done', r.n > 0 && r.d === r.n); b.title = p.name + '：已完成 ' + r.d + ' / ' + r.n + ' 步';
  });
}
/* 目录侧栏收起成窄条（宽屏；窄屏目录在正文上方，不用收） */
function setSide(c) {
  document.body.classList.toggle('side-collapsed', c);
  $$('[data-side-tg]').forEach(function (b) { b.setAttribute('aria-expanded', c ? 'false' : 'true'); });
  sset('labs:side', c);
}
function nlines(f) { return (LAB.files[f] || []).length; }

/* ════════ 页面 1：功能介绍 ════════ */
function renderIntro(pj) {
  var env = LAB.env || {}, scope = pj.scope || [];
  var cards = LAB.projects.map(function (p) {
    var n = p.steps.length, d = p.steps.filter(function (s) { return done[s.id]; }).length;
    return '<a class="box" style="display:block;margin:0;color:inherit' + (p.id === pj.id ? ';border-color:var(--accent)' : '') + '" href="#intro:' + p.id + '"><div class="kick">' + p.id + '</div><b>' + esc(p.name) + '</b><div class="muted" style="font-size:13px">' + esc(p.en || '') + '</div>' +
      '<div class="muted" style="font-size:12.5px;margin-top:4px">' + p.phases.length + ' 个阶段 · ' + n + ' 步 · 已完成 ' + d + '</div></a>';
  }).join('');
  var order = pj.phases.map(function (ph) { return '<li><a href="#phases:' + pj.id + ':' + ph.id + '">' + esc(ph.name) + '</a> <span class="muted">（' + stepsOf(pj, ph.id).length + ' 步）</span></li>'; }).join('');
  return '<div class="wrap"><div class="kick">BusTub · Fall 2025 · ' + pj.id + '</div><h1>' + esc(pj.name) + ' <span class="muted" style="font-size:17px;font-weight:400">' + esc(pj.en || '') + '</span></h1>' +
    '<p class="lead">' + inline(pj.summary) + '</p>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:0 0 16px">' + cards + '</div>' +
    '<div class="grid2"><div class="box"><h3>这个 Project 做什么</h3><ul>' + (pj.features || []).map(function (f) { return '<li>' + inline(f) + '</li>'; }).join('') + '</ul>' +
    '<p class="muted" style="font-size:13.5px">官方说明：<a href="' + esc(pj.writeup) + '" target="_blank" rel="noopener">' + esc(pj.writeup) + '</a>' + (pj.guide ? ' · 本站学习指南：<a href="' + esc(pj.guide) + '">' + pj.id + '</a>' : '') +
    ((pj.lectures || []).length ? ' · 对应讲次：' + pj.lectures.map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join(' ') : '') + '</p></div>' +
    '<div class="box"><h3>三个目录</h3><div class="kv"><span>原项目</span><span><code>CMU-15-445/lab-original/bustub</code>：官方仓库 Fall 2025 最后一次提交 <code>' + LAB.commit.slice(0, 10) + '</code>，只读参照。</span>' +
    '<span>复原目录</span><span>你自己克隆的一份 BusTub，在里面把复原范围的文件清空后按步骤链重敲。笔记和比对脚本都不会改它。</span>' +
    '<span>笔记目录</span><span><code>CMU-15-445/html/labs</code>：本笔记、<code>check_restore.py</code> 比对脚本、<code>_content/</code> 可手改的内容。</span></div>' +
    '<h3>推荐的复原顺序</h3><ol>' + order + '</ol></div></div>' +
    '<h2>复原范围</h2><p class="muted">只重敲下面这些文件；BusTub 其余部分（构建脚本、第三方库、别的模块、测试）直接用克隆下来的原样。</p>' +
    '<div class="tw"><table class="t"><thead><tr><th>文件</th><th>类型</th><th>行数</th><th>作用</th></tr></thead><tbody>' +
    scope.map(function (s) { return '<tr><td><code>' + esc(s.path) + '</code></td><td>' + scopeBadge(s.kind) + '</td><td>' + nlines(s.path) + '</td><td>' + inline(s.role) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<h2>官方测试</h2><p class="muted">测试文件不复原，用克隆下来的原样。部分 gtest 用例被官方标成了 <code>DISABLED_</code>（P0 的没有），要跑哪个就把它的前缀去掉，或者加 <code>--gtest_also_run_disabled_tests</code>；SQLLogicTest 用表里写的命令。</p>' +
    '<div class="tw"><table class="t"><thead><tr><th>测试文件</th><th>编译并运行</th><th>测什么</th></tr></thead><tbody>' +
    (pj.tests || []).map(function (t) { return '<tr><td><code>' + esc(t.path) + '</code></td><td><code>' + esc(t.cmd || ('make ' + t.target + ' -j`nproc` && ./test/' + t.target)) + '</code></td><td>' + inline(t.what) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    envBox(env) +
    '<h2>自检工具</h2><div class="box"><p>每做完一个阶段，在笔记目录里运行（只读，不改任何文件）：</p><pre class="cmd">python check_restore.py &lt;你的复原目录&gt; ' + pj.id + '</pre>' +
    '<p>每个文件给出一种状态：<b>一致</b>、<b>仅行尾或空行不同</b>、<b>内容不同</b>（列出原项目里不同的行号）、<b>缺失</b>、<b>多余</b>。标了「含你的实现」的文件，等你开始写 TODO 以后和骨架不同是正常的。原项目不在默认位置时加 <code>--orig &lt;路径&gt;</code>。</p></div>' +
    '<h2>许可与诚信</h2><div class="box"><p>BusTub 以 MIT 许可证开源（Copyright © 2015–2025 Carnegie Mellon University Database Group），本笔记逐字引用的骨架代码均来自它，许可证全文见原项目的 <code>LICENSE</code>。</p>' +
    '<p>笔记只复原官方公开的骨架，<b>不包含任何 Project 的答案代码</b>；空壳里要写的部分只给思路和伪代码。CMU 要求不要把自己的实现公开发布，做完放私有仓库。</p></div></div>';
}
function envBox(env) {
  if (!env.rows) return '';
  return '<h2>环境检查</h2><div class="box">' + paras(env.summary) + '<div class="tw"><table class="t"><thead><tr><th>项目</th><th>结果</th><th>说明</th></tr></thead><tbody>' +
    env.rows.map(function (r) { return '<tr><td>' + inline(r[0]) + '</td><td>' + inline(r[1]) + '</td><td>' + inline(r[2] || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    (env.cmds || []).map(function (c) { return '<h3>' + esc(c.t) + '</h3><pre class="cmd">' + esc(c.cmd) + '</pre>' + (c.note ? '<p class="muted">' + inline(c.note) + '</p>' : ''); }).join('') + '</div>';
}

/* ════════ 页面 2：前置知识 ════════ */
function renderPrereq(pj) {
  var groups = {};
  (pj.prereq || []).forEach(function (p) { (groups[p.kind] = groups[p.kind] || []).push(p); });
  var lists = Object.keys(groups).map(function (g) {
    return '<h2>' + esc(g) + '</h2>' + groups[g].map(function (p) {
      return '<div class="box" id="pq-' + esc(p.id) + '"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b style="font-size:15.5px">' + esc(p.name) + '</b>' + lvl(p.level) + '</div>' + paras(p.desc) +
        '<div class="muted" style="font-size:13px">在哪用到：' + (p.where || []).map(function (w, i) { return '<a href="#" data-where="' + esc(p.id) + ':' + i + '"><code>' + esc(w[0].split('/').pop()) + ':' + w[1] + (w[2] !== w[1] ? '–' + w[2] : '') + '</code></a>'; }).join(' ') + '</div>' +
        '<div class="where-box" id="wb-' + esc(p.id) + '"></div>' +
        '<details class="fold"><summary>自测：' + inline(p.q) + '</summary>' + paras(p.a) + '</details></div>';
    }).join('');
  }).join('');
  var cl = pj.phases.map(function (ph) {
    var items = (pj.checklist || {})[ph.id] || [];
    if (!items.length) return '';
    return '<h3>' + esc(ph.name) + '</h3>' + items.map(function (t, i) {
      var k = pj.id + ':' + ph.id + ':' + i;
      return '<label style="display:flex;gap:8px;align-items:baseline;margin:3px 0"><input type="checkbox" data-chk="' + k + '"' + (chk[k] ? ' checked' : '') + '><span>' + inline(t) + '</span></label>';
    }).join('');
  }).join('');
  return '<div class="wrap"><div class="kick">' + pj.id + ' · 前置知识</div><h1>开工前要会的东西</h1><p class="lead">只列这个 Project 的复原范围里<b>实际用到</b>的 C++ 语法、标准库和数据库概念。每条标了在哪个文件哪几行用到、难度（●●● 最难），附一道自测题。</p>' +
    '<div class="box"><h2 style="margin-top:0">开工前最少要会（可勾选，存在本机浏览器）</h2>' + (cl || '<p class="muted">（暂无）</p>') + '</div>' + lists + '</div>';
}

/* ════════ 页面 3：分阶段笔记 ════════ */
function stepHtml(pj, s, opts) {
  opts = opts || {};
  var h = '<div class="step" id="st-' + s.id + '"><div class="step-hd"><span class="sid">' + s.id + '</span>' + kindBadge(s.kind) + '<b>' + inline(s.title) + '</b></div>';
  if (s.file) {
    var prev = s.kind === 'cont' || (s.kind === 'todo' && s.from > 1) ? (LAB.files[s.file] || [])[s.from - 2] : null;
    h += '<div class="kv"><span>文件</span><span><code>' + esc(s.file) + '</code> · 第 ' + s.from + '–' + s.to + ' 行（共 ' + (s.to - s.from + 1) + ' 行）</span>';
    if (s.from > 1) h += '<span>接在哪</span><span>接在第 ' + (s.from - 1) + ' 行 <code>' + esc((prev || '').trim() || '（空行）') + '</code> 之后' + (((LAB.files[s.file] || [])[s.from - 1] || '').trim() === '' ? '；这一步第一行是空行，别漏' : '') + '</span>';
    else h += '<span>新建</span><span>新文件，从第 1 行开始</span>';
    h += '</div>';
  }
  h += '<div class="kv"><span>做什么</span><span>' + inline(s.what) + '</span>' + (s.why ? '<span>为什么</span><span>' + inline(s.why) + '</span>' : '') + '</div>';
  if (s.file) h += codeBlock(s.file, s.from, s.to, s.notes);
  if (s.impl) {
    h += '<div class="impl"><h4>你的实现：' + inline(s.impl.goal || '') + '</h4>' + (s.impl.hints || []).map(function (x) { return '<div>· ' + inline(x) + '</div>'; }).join('') +
      ((s.impl.pseudo || []).length ? '<pre>' + esc(s.impl.pseudo.join('\n')) + '</pre>' : '') +
      ((s.impl.tests || []).length ? '<div class="muted" style="font-size:13px">写完用这些测试检查：' + s.impl.tests.map(function (t) { return '<code>' + esc(t) + '</code>'; }).join(' ') + '</div>' : '') + '</div>';
  }
  if (s.cmd) h += '<pre class="cmd">' + esc(s.cmd) + '</pre>';
  if (s.run && pj._runs[s.run]) h += '<pre class="out">' + esc(pj._runs[s.run]) + '</pre>';
  if (s.early) h += '<div class="callout">⚠ ' + inline(s.early) + '</div>';
  if (s.build) h += '<div class="callout blue"><b>此刻能编译吗？</b>' + inline(s.build) + '</div>';
  if (s.trace && opts.mini !== false) h += '<div class="mini" data-mini="' + esc(s.trace) + '"></div>';
  if (s.think) h += '<details class="fold"><summary>敲完前想一想：' + inline(s.think.q) + '</summary>' + paras(s.think.a) + '</details>';
  return h + '</div>';
}
function renderPhases(pj, phId) {
  var ph = phaseOf(pj, phId) || pj.phases[0], idx = pj.phases.indexOf(ph), sts = stepsOf(pj, ph.id);
  var side = '<div class="side-full"><div class="side-hd"><b>' + pj.id + ' · ' + pj.phases.length + ' 个阶段</b><button class="side-tg" type="button" data-side-tg title="收起目录，给正文腾位置（快捷键 [ ）">«</button></div>' +
    '<div class="cprog"><span class="bar"><i data-pjbar></i></span><span class="txt" data-pjtxt></span></div>' +
    pj.phases.map(function (p) {
      return '<div class="pr' + (p === ph ? ' on' : '') + '"><a href="#phases:' + pj.id + ':' + p.id + '">' + esc(p.name) + '<small><span data-phn="' + p.id + '"></span>' + lvlBadge(p.level) + '</small></a>' +
        '<button class="ck" type="button" data-phck="' + p.id + '" title="这一阶段的步骤一次全部打勾 / 全部取消" aria-pressed="false"></button></div>';
    }).join('') + '</div>' +
    '<div class="side-rail"><button class="side-tg" type="button" data-side-tg title="展开目录（快捷键 [ ）">»</button><span class="rn"></span>' +
    pj.phases.map(function (p, i) { return '<a class="rl' + (p === ph ? ' on' : '') + '" href="#phases:' + pj.id + ':' + p.id + '" data-phrl="' + p.id + '" title="' + esc(p.name) + '">' + i + '</a>'; }).join('') + '</div>';
  var seenBefore = {};
  pj.steps.forEach(function (s) { if (s.file && pj.phases.indexOf(phaseOf(pj, s.phase)) < idx) seenBefore[s.file] = 1; });
  var nw = [], ct = [], td = [];
  sts.forEach(function (s) {
    if (!s.file) return;
    if (!seenBefore[s.file] && nw.indexOf(s.file) < 0 && s.from === 1) nw.push(s.file);
    else if (nw.indexOf(s.file) < 0 && ct.indexOf(s.file) < 0) ct.push(s.file);
    if (s.kind === 'todo') td.push(s);
  });
  var chg = (nw.length ? '<p><span class="badge b-new">新增</span> ' + nw.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join('、') + '</p>' : '') +
    (ct.length ? '<p><span class="badge b-cont">续写</span> ' + ct.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join('、') + '</p>' : '') +
    (td.length ? '<p><span class="badge b-todo">要你实现</span> ' + td.map(function (s) { return '<a href="#st-' + s.id + '">' + esc(s.title) + '</a>'; }).join('、') + '</p>' : '') +
    (!nw.length && !ct.length ? '<p class="muted">这一阶段不新增也不修改文件。</p>' : '') + '<p class="muted" style="font-size:13px">没有删除任何文件（原项目只有一个快照）。</p>';
  var verify = (ph.verify || []).map(function (v) {
    return '<pre class="cmd">' + esc(v.cmd) + '</pre>' + (v.run && pj._runs[v.run] ? '<pre class="out">' + esc(pj._runs[v.run]) + '</pre>' : '<div class="callout red"><b>未实测</b>：' + inline(v.why || '这台机器上没有编译运行 BusTub（Windows，你选择了跳过 Docker 实测）。') + '</div>') +
      (v.expect ? '<p>' + inline(v.expect) + '</p>' : '');
  }).join('');
  var sec = function (n, t, body) { return '<div class="sec"><h2><span class="hn">' + n + '</span>' + t + '</h2>' + body + '</div>'; };
  return '<div class="wrap wide"><div class="phase-layout"><nav class="side">' + side + '</nav><main>' +
    '<div class="kick">' + pj.id + ' · ' + esc(pj.name) + ' · 第 ' + (idx + 1) + ' / ' + pj.phases.length + ' 阶段</div><h1>' + esc(ph.name) + '</h1>' + lvlLine(ph.level) +
    sec(1, '目标', paras(ph.goal)) + sec(2, '相对上一阶段的变化', chg) +
    (ph.concepts && ph.concepts.length ? sec(3, '核心原理 · 翻页图解', (ph.intro ? '<p class="lead" style="margin-bottom:10px">' + inline(ph.intro) + '</p>' : '') +
      '<p class="muted" style="font-size:13.5px">' + ph.concepts.length + ' 节、共 ' + ph.concepts.reduce(function (a, c) { return a + c.pages.length; }, 0) + ' 页图解。节用下拉菜单或「上一节 / 下一节」（Shift + ← →），页用 ‹ › 或 ← →，进度条可拖。翻页时同一个东西会移动、变色，新出现的淡入；橙框是这一页的变化。</p>' +
      '<div data-cpt="' + ph.id + '"></div>' + ((ph.principle || []).length ? '<details class="fold"><summary>文字版原理</summary>' + paras(ph.principle) + '</details>' : '')) : sec(3, '核心原理', paras(ph.principle))) +
    sec(4, '逐步走读 · 先写，后跑', '<p class="muted" style="font-size:13.5px">大步是这个阶段的每一步，按动手顺序排（下拉菜单 / 上一大步 / 下一大步，Shift + ← →）。写代码的大步分两段：<b>✎ 写</b>——舞台左边是这一步做完后的文件，绿色是这一步要敲的行，旁边写着这一步写了什么、写完能不能编译；<b>▶ 跑</b>——这几行在逐行演示里被执行到的那一段（左边橙色行正在执行，右边是调用栈和数据）。小步用 ← → 或拖进度条。勾选和「复原步骤链」页是同一份进度。</p>' +
      '<div data-walk="' + ph.id + '"></div>') +
    sec(5, '运行验证', verify || '<p class="muted">（这一阶段没有要运行的命令）</p>') +
    sec(6, '易错点', (ph.pitfalls || []).map(function (p) { return '<div class="box"><b>' + inline(p.t) + '</b>' + (p.err ? '<pre class="cmd">' + esc(p.err) + '</pre>' : '') + paras(p.why) + '</div>'; }).join('') || '<p class="muted">（暂无）</p>') +
    sec(7, '自测题', (ph.quiz || []).map(function (q, i) { return '<details class="fold"><summary>' + (i + 1) + '. ' + inline(q.q) + '</summary>' + paras(q.a) + '</details>'; }).join('')) +
    '</main></div></div>';
}

/* ════════ 页面 4：文件地图 ════════ */
function renderFiles(pj) {
  var where = {};
  pj.steps.forEach(function (s) { if (!s.file) return; var ph = phaseOf(pj, s.phase); (where[s.file] = where[s.file] || []).push([ph.name, s.kind]); });
  var tree = {};
  function add(path, info) { var parts = path.split('/'), node = tree; parts.forEach(function (p, i) { node[p] = node[p] || (i === parts.length - 1 ? { __f: info } : {}); node = node[p]; }); }
  (pj.scope || []).forEach(function (s) { add(s.path, { role: s.role, kind: s.kind, scope: true }); });
  (pj.tests || []).forEach(function (t) { add(t.path, { role: '官方测试：' + t.what, kind: 'test' }); });
  var out = [];
  function walk(node, depth) {
    Object.keys(node).sort(function (a, b) { var fa = !!node[a].__f, fb = !!node[b].__f; return fa === fb ? a.localeCompare(b) : fa ? 1 : -1; }).forEach(function (k) {
      var n = node[k], pad = new Array(depth + 1).join('  ');
      if (n.__f) {
        var f = n.__f, path = null;
        (pj.scope || []).concat(pj.tests || []).forEach(function (s) { if (s.path.split('/').pop() === k && (!path)) path = s.path; });
        var st = (where[path] || []).filter(function (x, i, a) { return a.map(String).indexOf(String(x)) === i; }).map(function (x) {
          return '<span class="badge ' + (x[1] === 'new' ? 'b-new' : x[1] === 'todo' ? 'b-todo' : 'b-cont') + '">' + esc(x[0].replace(/^阶段\s*/, '').split(' · ')[0]) + ' ' + (x[1] === 'new' ? '新增' : x[1] === 'todo' ? '含实现' : '续写') + '</span>';
        }).join(' ');
        out.push('<div class="row"><span class="nm">' + pad + (f.kind === 'test' ? '🧪 ' : '📄 ') + esc(k) + '</span><span class="role">' + inline(f.role) + ' ' + (f.scope ? scopeBadge(f.kind) : '<span class="badge b-same">不复原</span>') + ' ' + st + '</span></div>');
      } else {
        out.push('<div class="row dir"><span class="nm">' + pad + '📁 ' + esc(k) + '/</span><span class="role"></span></div>');
        walk(n, depth + 1);
      }
    });
  }
  walk(tree, 0);
  var stat = pj.phases.map(function (ph) {
    var cells = (pj.scope || []).map(function (s) {
      var ks = pj.steps.filter(function (x) { return x.phase === ph.id && x.file === s.path; }).map(function (x) { return x.kind; });
      var before = pj.steps.some(function (x) { return x.file === s.path && pj.phases.indexOf(phaseOf(pj, x.phase)) < pj.phases.indexOf(ph); });
      return '<td>' + (ks.length ? (before ? '<span class="badge b-cont">修改/续写</span>' : '<span class="badge b-new">新增</span>') : before ? '<span class="badge b-same">未变</span>' : '<span class="muted">—</span>') + '</td>';
    }).join('');
    return '<tr><td>' + esc(ph.name) + '</td>' + cells + '</tr>';
  }).join('');
  return '<div class="wrap wide"><div class="kick">' + pj.id + ' · 文件地图</div><h1>文件地图</h1><p class="lead">复原范围里每个文件的作用，以及它在哪个阶段新增、续写。🧪 是官方测试，不复原。完整的 BusTub 目录结构见原项目。</p>' +
    '<div class="box tree">' + out.join('') + '</div>' +
    '<h2>各阶段的文件状态</h2><div class="tw"><table class="t"><thead><tr><th>阶段</th>' + (pj.scope || []).map(function (s) { return '<th title="' + esc(s.path) + '">' + esc(s.path.split('/').pop()) + '</th>'; }).join('') + '</tr></thead><tbody>' + stat + '</tbody></table></div></div>';
}

/* ════════ 页面 5：可视化演示 ════════ */
function renderViz(pj) {
  var el = $('#pg-viz');
  if (!viz) {
    el.innerHTML = '<div class="wrap wide"><div class="kick" id="vz-kick"></div><h1>可视化演示</h1><p class="lead">四个视图共用一块常驻画布：切换视图或前进一步时，已有的框和线移动到新位置、新出现的淡入、不再需要的淡出。代码逐行执行视图里，左边是原文件，右边是调用栈帧和数据，底下是终端输出。</p><div id="vz-host"></div></div>';
    viz = new window.LabStage.Viz($('#vz-host'), { onState: function (s) { var all = sget('labs:viz', {}); all[cur] = s; sset('labs:viz', all); } });
  }
  $('#vz-kick').textContent = pj.id + ' · ' + pj.name;
  if (viz.pj !== pj) viz.setProject(pj, sget('labs:viz', {})[pj.id]);
}

/* ════════ 页面 6：复原步骤链 ════════ */
function renderSteps(pj) {
  var all = pj.steps, n = all.length, d = all.filter(function (s) { return done[s.id]; }).length, first = all.filter(function (s) { return !done[s.id]; })[0];
  var hide = sget('labs:hideDone', false);
  var body = pj.phases.map(function (ph) {
    var sts = stepsOf(pj, ph.id), dd = sts.filter(function (s) { return done[s.id]; }).length;
    return '<div class="box"><div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center"><button class="ck" type="button" data-phck="' + ph.id + '" title="这一阶段的步骤一次全部打勾 / 全部取消" aria-pressed="false"></button><b>' + esc(ph.name) + '</b><a class="muted" style="font-size:13px" href="#phases:' + pj.id + ':' + ph.id + '">📖 本阶段笔记</a><span class="bar" style="max-width:240px;margin-left:auto"><i style="width:' + (sts.length ? dd / sts.length * 100 : 0) + '%"></i></span><span class="muted" style="font:12px var(--mono)">' + dd + '/' + sts.length + '</span></div>' +
      sts.map(function (s) {
        if (hide && done[s.id]) return '';
        var meta = s.file ? '<code>' + esc(s.file) + '</code> · 第 ' + s.from + '–' + s.to + ' 行' : (s.cmd ? '<code>$ ' + esc(s.cmd.split('\n')[0]) + '</code>' : '');
        var stg = (s.hl && s.hl.length) || s.trace ? ' <button class="stage-btn" type="button" data-stage="' + s.id + '">▶ 在舞台上看</button>' : '';
        return '<div class="srow' + (done[s.id] ? ' done' : '') + (first === s ? ' cur' : '') + '" id="sr-' + s.id + '"><input type="checkbox" data-done="' + s.id + '"' + (done[s.id] ? ' checked' : '') + '><span class="sid">' + s.id + '</span>' + kindBadge(s.kind) +
          '<span class="ttl" data-open="' + s.id + '">' + inline(s.title) + '</span><span></span><span class="meta">' + meta + stg + '</span><div class="open" id="op-' + s.id + '"></div></div>';
      }).join('') + '</div>';
  }).join('');
  return '<div class="wrap"><div class="kick">' + pj.id + ' · 复原步骤链</div><h1>复原步骤链</h1><p class="lead">全部阶段和步骤，按真实依赖顺序排：环境与骨架 → 各个模块 → 验证。点标题展开这一步要敲的完整代码；做完勾上，进度存在本机浏览器里。每个阶段最后一步是验证：运行 <code>check_restore.py</code> 比对，再跑官方测试。</p>' +
    '<div class="box prog"><span>当前进度：<b>' + (first ? first.id + ' ' + inline(first.title) : '全部完成 🎉') + '</b>（已完成 ' + d + ' / ' + n + ' 步）</span><span class="bar"><i style="width:' + (n ? d / n * 100 : 0) + '%"></i></span>' +
    '<label class="muted" style="font-size:13px"><input type="checkbox" id="hideDone"' + (hide ? ' checked' : '') + '> 隐藏已完成</label><button class="tb" type="button" id="locate">定位到当前步骤</button></div>' + body + '</div>';
}

/* ════════ 路由与事件 ════════ */
function render(p, arg) {
  var pj = proj(cur), el = $('#pg-' + p);
  copies.length = 0;
  if (p === 'intro') el.innerHTML = renderIntro(pj);
  else if (p === 'prereq') el.innerHTML = renderPrereq(pj);
  else if (p === 'phases') el.innerHTML = renderPhases(pj, arg);
  else if (p === 'files') el.innerHTML = renderFiles(pj);
  else if (p === 'steps') el.innerHTML = renderSteps(pj);
  else if (p === 'viz') renderViz(pj);
  $$('[data-mini]', el).forEach(function (m) { var v = new window.LabStage.Viz(m, { trace: m.getAttribute('data-mini') }); v.setProject(pj); });
  $$('[data-cpt]', el).forEach(function (m) { var ph = phaseOf(pj, m.getAttribute('data-cpt')); if (ph && window.LabPhase) window.LabPhase.mountConcepts(m, pj, ph); });
  $$('[data-walk]', el).forEach(function (m) { var ph = phaseOf(pj, m.getAttribute('data-walk')); if (ph && window.LabPhase) window.LabPhase.mountWalk(m, pj, ph); });
  el.__key = cur + '|' + p + '|' + (arg || '');
  paintProgress();
}
function show(p, arg, keepScroll) {
  var old = $('.page.active');
  if (old) { scrolls[old.id + '|' + cur + '|' + (old.__arg || '')] = old.scrollTop; sset('labs:scroll', scrolls); }
  $$('.page').forEach(function (e) { e.classList.toggle('active', e.id === 'pg-' + p); });
  $$('.pages a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-p') === p); });
  $$('.seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-proj') === cur); });
  paintProgress();
  var el = $('#pg-' + p), key = cur + '|' + p + '|' + (arg || '');
  if (el.__key !== key) render(p, arg);
  el.__arg = arg || '';
  page = p;
  document.title = NAMES[p] + ' · ' + proj(cur).id + ' · BusTub Lab 复原笔记';
  if (!keepScroll) { var s = scrolls['pg-' + p + '|' + cur + '|' + (arg || '')]; el.scrollTop = s || 0; }
}
function route() {
  var m = /^#?(\w+)(?::(P\d))?(?::(\w+))?$/.exec(decodeURIComponent(location.hash || ''));
  var p = m && PAGES.indexOf(m[1]) >= 0 ? m[1] : 'intro';
  if (m && m[2] && m[2] !== cur && LAB.projects.some(function (x) { return x.id === m[2]; })) { cur = m[2]; sset('labs:proj', cur); }
  show(p, m && m[3]);
}
window.addEventListener('hashchange', route);
setSide(sget('labs:side', false) === true);
document.addEventListener('keydown', function (ev) {
  var t = ev.target, typing = t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || t.tagName === 'INPUT' && !/^(checkbox|radio|range|button)$/.test(t.type));
  if (ev.key === '[' && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey && page === 'phases') setSide(!document.body.classList.contains('side-collapsed'));
});
$$('.pages a').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); location.hash = a.getAttribute('data-p') + ':' + cur; }; });
$('#projSeg').innerHTML = LAB.projects.map(function (p) { return '<button type="button" data-proj="' + p.id + '" title="' + esc(p.name) + '">' + p.id + '</button>'; }).join('');
$$('#projSeg button').forEach(function (b) { b.onclick = function () { location.hash = page + ':' + b.getAttribute('data-proj'); }; });
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (t.hasAttribute('data-chk')) { chk[t.getAttribute('data-chk')] = t.checked; sset('labs:chk', chk); }
  if (t.hasAttribute('data-done')) { done[t.getAttribute('data-done')] = t.checked; sset('labs:done', done); var keep = $('#pg-steps').scrollTop; render('steps'); $('#pg-steps').scrollTop = keep; }
  if (t.id === 'hideDone') { sset('labs:hideDone', t.checked); render('steps'); }
});
document.addEventListener('click', function (ev) {
  var t = ev.target.closest ? ev.target : null;
  if (!t) return;
  var pc = t.closest('[data-phck]'), tg = t.closest('[data-side-tg]');
  if (tg) { setSide(!document.body.classList.contains('side-collapsed')); return; }
  if (pc) {
    var pjx = proj(cur), phx = phaseOf(pjx, pc.getAttribute('data-phck')), r = cnt(stepsOf(pjx, phx.id)), all = r.n > 0 && r.d === r.n;
    if (r.d && all && !confirm('把「' + phx.name + '」的 ' + r.n + ' 步全部取消勾选？')) return;
    setPhase(pjx, phx.id, !all);
    var pe = $('.page.active'), keep = pe.scrollTop;
    $$('.page').forEach(function (e) { e.__key = null; });   /* 步骤链、走读组件里的勾都要跟着变 */
    render(page, pe.__arg || undefined); pe.scrollTop = keep;
    return;
  }
  var o = t.closest('[data-open]'), sb = t.closest('[data-stage]'), wh = t.closest('[data-where]');
  if (o) {
    var id = o.getAttribute('data-open'), box = $('#op-' + id), pj = proj(cur), s = pj.steps.filter(function (x) { return x.id === id; })[0];
    if (box.innerHTML) box.innerHTML = ''; else { box.innerHTML = stepHtml(pj, s, { mini: false }); }
  }
  if (sb) {
    var pj2 = proj(cur), s2 = pj2.steps.filter(function (x) { return x.id === sb.getAttribute('data-stage'); })[0];
    location.hash = 'viz:' + cur;
    setTimeout(function () { if (s2.trace) { viz.view = 'code'; viz.sub = s2.trace; viz.fillSub(); viz.go(0); } else viz.highlight(s2.hl); }, 30);
  }
  if (wh) {
    ev.preventDefault();
    var pr = wh.getAttribute('data-where').split(':'), pj3 = proj(cur), item = pj3.prereq.filter(function (x) { return x.id === pr[0]; })[0], w = item.where[+pr[1]], bx = $('#wb-' + pr[0]);
    bx.innerHTML = bx.getAttribute('data-on') === pr[1] ? '' : codeBlock(w[0], w[1], w[2]);
    bx.setAttribute('data-on', bx.innerHTML ? pr[1] : '');
  }
  if (t.id === 'locate') {
    var c = $('.srow.cur'); if (c) c.scrollIntoView({ block: 'center' });
  }
});
route();
})();
