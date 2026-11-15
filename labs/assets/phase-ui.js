/* phase-ui.js —— 第 3 页「分阶段笔记」里的两个交互组件
 *   ConceptUI：核心原理 · 翻页图解。一节一张常驻舞台，翻页时对象补间移动 / 变色，新增淡入、移除淡出（数据格式见 concept-core.js 头部）。
 *   WalkUI   ：逐步走读 · 先写，后跑。大步 = 这个阶段的每一步；写代码的大步分「✎ 写」（这一步做完后的文件，要敲的行涂绿，
 *              旁边是这一步写了什么、写完能不能编译）和「▶ 跑」（这几行在逐行演示里被执行到的那一段，借用页面 5 的舞台）。
 */
(function (root) {
'use strict';
var S = root.LabStage, Core = root.ConceptCore, LAB = root.LAB;
var esc = S.esc, md = S.md;
function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function prose(t) { return (Array.isArray(t) ? t : String(t || '').split(/\n{2,}/)).map(function (p) { return '<p>' + md(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
function load(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
function parseAt(at) {
  var m = /^(\w+):([\d,\-–\s]+)$/.exec(String(at || '').trim());
  if (!m) return null;
  return { alias: m[1], ranges: m[2].split(',').map(function (x) { var p = x.trim().split(/[-–]/); return [+p[0], +(p[1] || p[0])]; }) };
}
/* 源码栏：整份文件 + 几段高亮带 + 平滑滚动（用舞台引擎的时钟） */
function SrcPane(el, eng) {
  this.el = el; this.eng = eng; this.file = null;
  el.innerHTML = '<div class="hd"></div><div class="bd"><div class="bands"></div><div class="lines"></div></div>';
  this.hd = el.querySelector('.hd'); this.bd = el.querySelector('.bd'); this.lines = el.querySelector('.lines'); this.bands = el.querySelector('.bands');
}
SrcPane.prototype.show = function (file, ranges, opt) {
  opt = opt || {};
  var lines = LAB.files[file] || [], upto = opt.upto || lines.length, green = opt.green;
  var key = file + '|' + upto + '|' + JSON.stringify(green || null);
  if (this.key !== key) {
    this.key = key;
    this.hd.textContent = file + (opt.note ? '  ·  ' + opt.note : '');
    this.lines.innerHTML = lines.slice(0, upto).map(function (l, i) {
      var g = green && i + 1 >= green[0] && i + 1 <= green[1];
      return '<div class="sl' + (g ? ' add' : '') + '"><span class="no">' + (i + 1) + '</span>' + (g ? '<span class="pl">+</span>' : '') + esc(l || ' ') + '</div>';
    }).join('');
  }
  this.bands.innerHTML = (ranges || []).map(function (r) { return '<div class="band" style="top:' + (r[0] - 1) * 20 + 'px;height:' + (r[1] - r[0] + 1) * 20 + 'px"></div>'; }).join('');
  var first = ranges && ranges[0] ? ranges[0][0] : green ? green[0] : 1, target = Math.max(0, (first - 1) * 20 - 40);
  var self = this, from = this.bd.scrollTop, t0 = this.eng.now, prev = this.eng.onTick;
  this.eng.onTick = function () {
    var p = Math.min(1, (self.eng.now - t0) / S.DUR);
    self.bd.scrollTop = from + (target - from) * S.ease(p);
    var more = prev ? prev() : false;
    if (p >= 1) self.eng.onTick = prev;
    return p < 1 || more;
  };
  this.eng.kick();
};

/* ════════ 核心原理 · 翻页图解 ════════ */
function ConceptUI(mount, pj, ph) {
  this.pj = pj; this.ph = ph; this.cs = ph.concepts; this.key = pj.id + ':' + ph.id;
  var pos = load('labs:cpt')[this.key] || [0, 0];
  this.si = Math.min(pos[0] || 0, this.cs.length - 1); this.pi = pos[1] || 0;
  this.states = {};
  this.build(mount);
  this.go(this.si, this.pi, true);
}
var C = ConceptUI.prototype;
C.build = function (m) {
  var self = this;
  m.innerHTML = '';
  var box = h('div', 'cpt'); box.tabIndex = 0;
  box.innerHTML = '<div class="w-hd"><span class="lb">节</span><button class="tb c-ps" type="button">‹ 上一节</button><select class="c-sel"></select>' +
    '<button class="tb c-ns" type="button">下一节 ›</button><span class="cnt c-cnt"></span></div>' +
    '<div class="w-bd"><div class="c-stage"><div class="vz-src c-src"></div><div class="c-right"><svg class="vz-svg" viewBox="0 0 1000 560"></svg><div class="vz-out c-out"></div></div></div>' +
    '<div class="w-panel"><div class="c-title"></div><div class="c-lv"></div><div class="c-ph"></div><div class="c-say"></div><div class="c-sum"></div><div class="c-nx"></div>' +
    '<div class="muted c-plh"></div><ol class="c-pl"></ol><div class="w-nav"><button class="tb c-pp" type="button">‹</button><input type="range" class="c-rng" min="0" value="0"><button class="tb c-np" type="button">›</button><span class="cnt c-pc"></span></div></div></div>';
  m.appendChild(box);
  var q = function (s) { return box.querySelector(s); };
  this.$ = { box: box, sel: q('.c-sel'), cnt: q('.c-cnt'), stage: q('.c-stage'), out: q('.c-out'), title: q('.c-title'), lv: q('.c-lv'), ph: q('.c-ph'), say: q('.c-say'), sum: q('.c-sum'), nx: q('.c-nx'),
    plh: q('.c-plh'), pl: q('.c-pl'), rng: q('.c-rng'), pc: q('.c-pc') };
  this.eng = new S.Engine(q('svg'));
  this.src = new SrcPane(q('.c-src'), this.eng);
  this.$.sel.innerHTML = this.cs.map(function (c, i) { return '<option value="' + i + '">' + (i + 1) + '. ' + esc(c.t) + '（' + c.pages.length + ' 页' + (c.level ? ' · ★' + c.level[0] + ' ' + root.LabLevel.IMP[c.level[1]] : '') + '）</option>'; }).join('');
  this.$.sel.onchange = function () { self.go(+this.value, 0); };
  q('.c-ps').onclick = function () { self.go(self.si - 1, 0); };
  q('.c-ns').onclick = function () { self.go(self.si + 1, 0); };
  q('.c-pp').onclick = function () { self.go(self.si, self.pi - 1); };
  q('.c-np').onclick = function () { self.go(self.si, self.pi + 1); };
  this.$.rng.oninput = function () { self.go(self.si, +this.value); };
  this.$.pl.onclick = function (ev) { var li = ev.target.closest('li'); if (li) self.go(self.si, +li.getAttribute('data-i')); };
  /* 最后一页：去下一节，或者（最后一节）跳到下面的「逐步走读」 */
  this.$.nx.onclick = function (ev) {
    var a = ev.target.closest('a'); if (!a) return; ev.preventDefault();
    if (a.hasAttribute('data-cnext')) { self.go(self.si + 1, 0); box.focus(); return; }
    var pgEl = box.closest('.page') || document, w = pgEl.querySelector('[data-walk]');
    if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  box.addEventListener('keydown', function (ev) {
    if (ev.target.tagName === 'SELECT' || ev.target.tagName === 'INPUT') return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      var d = ev.key === 'ArrowRight' ? 1 : -1;
      if (ev.shiftKey) self.go(self.si + d, 0); else self.go(self.si, self.pi + d);
    }
  });
};
C.go = function (si, pi, first) {
  si = Math.max(0, Math.min(this.cs.length - 1, si));
  var c = this.cs[si], n = c.pages.length;
  pi = Math.max(0, Math.min(n - 1, pi));
  this.si = si; this.pi = pi;
  if (!this.states[si]) this.states[si] = Core.run(c);
  var st = this.states[si][pi], src = !!c.files, P = S.pal();
  this.$.stage.classList.toggle('with-src', src);
  this.eng.setBox(src ? Core.SRCW : Core.FULL, Core.H);
  var L = Core.layout(st, P, src);
  this.eng.show(L.items);
  if (src) {
    var at = parseAt(st.at), file = at && c.files[at.alias];
    if (file) this.src.show(file, at.ranges);
  }
  var hasOut = this.states[si].some(function (x) { return x.out.length; });
  this.$.out.style.display = hasOut ? '' : 'none';
  this.$.out.textContent = st.out.join('\n'); this.$.out.scrollTop = this.$.out.scrollHeight;
  var pg = c.pages[pi];
  this.$.title.innerHTML = '<span class="hn">' + (si + 1) + '</span>' + esc(c.t);
  this.$.lv.innerHTML = root.LabLevel.line(c.level);
  this.$.ph.innerHTML = '第 ' + (pi + 1) + ' 页 · <b>' + esc(pg.h) + '</b>';
  this.$.say.innerHTML = prose(pg.say);
  this.$.sum.innerHTML = pi === n - 1 && c.sum ? '<b>一句话记住：</b>' + md(c.sum) : '';
  var nx = this.cs[si + 1];
  this.$.nx.innerHTML = pi < n - 1 ? '' : nx ? '本节完。下一节：<a href="#" data-cnext="1">' + (si + 2) + '. ' + esc(nx.t) + ' ›</a>'
    : '这一阶段的原理看完了。接下来动手：<a href="#" data-cwalk="1">逐步走读 · 先写，后跑 ›</a>';
  this.$.plh.textContent = '本节 ' + n + ' 页（点一项直接翻过去）';
  this.$.pl.innerHTML = c.pages.map(function (p, i) { return '<li data-i="' + i + '"' + (i === pi ? ' class="on"' : '') + '>' + esc(p.h) + '</li>'; }).join('');
  this.$.rng.max = n - 1; this.$.rng.value = pi;
  this.$.pc.textContent = (pi + 1) + ' / ' + n;
  this.$.sel.value = si; this.$.cnt.textContent = (si + 1) + ' / ' + this.cs.length;
  if (!first) { var all = load('labs:cpt'); all[this.key] = [si, pi]; save('labs:cpt', all); }
};

/* ════════ 逐步走读 · 先写，后跑 ════════ */
var CODE = { new: 1, cont: 1, todo: 1 };
var KIND = { new: '新建', cont: '续写', todo: '骨架+实现', info: '讲解', verify: '验证' };
/* 这一步写的行在逐行演示里被执行到的那一段：优先挂在这一步上的演示，其次命中最多的那条；相邻两次命中隔 ≤4 步算同一段 */
function clipOf(pj, s) {
  if (!CODE[s.kind]) return null;
  var best = null;
  ((pj.stage || {}).traces || []).forEach(function (t) {
    var hits = [];
    t.steps.forEach(function (x, i) { if (x.file === s.file && x.line >= s.from && x.line <= s.to) hits.push(i); });
    if (!hits.length) return;
    var a = hits[0], b = hits[0];
    for (var k = 1; k < hits.length && hits[k] - b <= 4; k++) b = hits[k];
    var cand = { t: t, a: a, b: b, n: hits.length, own: s.trace === t.id };
    if (!best || cand.own && !best.own || cand.own === best.own && cand.n > best.n) best = cand;
  });
  return best;
}
function defsOf(lines) {
  var out = [];
  lines.forEach(function (l) {
    var m;
    if ((m = /^\s*(?:template\s*<[^>]*>\s*)?(class|struct|enum class|enum|union)\s+(\w+)/.exec(l)) && !/;\s*$/.test(l)) out.push(m[1] + ' ' + m[2]);
    else if ((m = /^\s*using\s+(\w+)\s*=/.exec(l))) out.push('using ' + m[1]);
    else if ((m = /^(?:[\w:<>,*&\s]+\s+)?([A-Za-z_]\w*(?:<[^>]*>)?::~?\w+|operator\S*)\s*\(/.exec(l)) && !/^\s*(return|if|while|for|switch)\b/.test(l)) out.push(m[1].replace(/<[^>]*>/, '') + '()');
    else if ((m = /^\s+(?:virtual\s+|static\s+|explicit\s+|inline\s+|constexpr\s+)*(?:auto|void|bool|[\w:<>]+\s*[*&]?)\s+(\w+)\s*\(.*[;{]\s*$/.exec(l)) && !/^\s*(return|if|while|for|switch|else)\b/.test(l)) out.push(m[1] + '()');
    else if ((m = /^\s*explicit\s+(\w+)\s*\(/.exec(l))) out.push(m[1] + '()');
  });
  return out.filter(function (x, i) { return out.indexOf(x) === i; }).slice(0, 10);
}
function stateChip(s) {
  var b = s.build || '';
  if (!b) return '';
  var cls = /不能编译|还不能|编译不过|链接不了|不能链接|无法编译/.test(b) ? 'no' : /能编译|可以编译|编译通过/.test(b) ? 'ok' : 'mid';
  var head = cls === 'no' ? '✗ 写完还不能编译' : cls === 'ok' ? '✓ 写完能编译' : '• 写完的状态';
  return '<div class="chip-st ' + cls + '">' + head + '<span class="est">推断 · 未实测</span></div>';
}
function WalkUI(mount, pj, ph) {
  this.pj = pj; this.ph = ph; this.key = pj.id + ':' + ph.id;
  var steps = pj.steps.filter(function (s) { return s.phase === ph.id; });
  this.steps = steps;
  var bigs = [{ kind: 'overview' }], seen = {};
  steps.forEach(function (s) { bigs.push({ kind: 'step', s: s, clip: clipOf(pj, s) }); });
  steps.forEach(function (s) {
    var t = s.trace && ((pj.stage || {}).traces || []).filter(function (x) { return x.id === s.trace; })[0];
    if (t && !seen[t.id]) { seen[t.id] = 1; bigs.push({ kind: 'full', t: t }); }
  });
  this.bigs = bigs;
  var pos = load('labs:walk')[this.key] || [0, 0];
  this.bi = Math.min(pos[0] || 0, bigs.length - 1); this.sm = pos[1] || 0;
  this.build(mount);
  this.go(this.bi, this.sm, true);
}
var Wp = WalkUI.prototype;
Wp.stats = function () {
  var code = this.bigs.filter(function (b) { return b.kind === 'step' && CODE[b.s.kind]; }), run = code.filter(function (b) { return b.clip; });
  return { steps: this.steps.length, code: code.length, run: run.length, full: this.bigs.filter(function (b) { return b.kind === 'full'; }).length };
};
Wp.nSmall = function (b) { return b.kind === 'step' ? 1 + (b.clip ? b.clip.b - b.clip.a + 1 : 0) : b.kind === 'full' ? b.t.steps.length : 1; };
Wp.build = function (m) {
  var self = this;
  m.innerHTML = '';
  var box = h('div', 'walk'); box.tabIndex = 0;
  box.innerHTML = '<div class="w-hd"><span class="lb">大步</span><button class="tb w-pb" type="button">‹ 上一大步</button><select class="w-sel"></select>' +
    '<button class="tb w-nb" type="button">下一大步 ›</button><span class="cnt w-cnt"></span></div>' +
    '<div class="w-bd"><div class="w-stage"><div class="w-write"><div class="vz-src w-src"></div><div class="w-side"></div></div><div class="w-run"></div><div class="w-list"></div></div>' +
    '<div class="w-panel"><div class="w-body"></div><div class="w-nav"><button class="tb w-ps" type="button">‹</button><input type="range" class="w-rng" min="0" value="0"><button class="tb w-ns" type="button">›</button><span class="cnt w-pc"></span></div></div></div>';
  m.appendChild(box);
  var q = function (s) { return box.querySelector(s); };
  this.$ = { box: box, sel: q('.w-sel'), cnt: q('.w-cnt'), write: q('.w-write'), side: q('.w-side'), run: q('.w-run'), list: q('.w-list'), body: q('.w-body'), rng: q('.w-rng'), pc: q('.w-pc') };
  var dummy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  this.eng = new S.Engine(dummy);   /* 只借它的时钟给源码栏做平滑滚动 */
  this.src = new SrcPane(q('.w-src'), this.eng);
  this.$.sel.innerHTML = this.bigs.map(function (b, i) {
    if (b.kind === 'overview') return '<option value="0">总览 · 这一阶段的路线</option>';
    if (b.kind === 'full') return '<option value="' + i + '">▶ 完整跑一遍：' + esc(b.t.title) + '</option>';
    var s = b.s, mark = CODE[s.kind] ? ' ✎' + (b.clip ? ' ▶' + (b.clip.b - b.clip.a + 1) : '') : '';
    return '<option value="' + i + '">' + i + '. ' + s.id + ' ' + (KIND[s.kind] || '') + ' ' + esc(s.title).slice(0, 46) + mark + '</option>';
  }).join('');
  this.$.sel.onchange = function () { self.go(+this.value, 0); };
  q('.w-pb').onclick = function () { self.go(self.bi - 1, 0); };
  q('.w-nb').onclick = function () { self.go(self.bi + 1, 0); };
  q('.w-ps').onclick = function () { self.go(self.bi, self.sm - 1); };
  q('.w-ns').onclick = function () { self.go(self.bi, self.sm + 1); };
  this.$.rng.oninput = function () { self.go(self.bi, +this.value); };
  box.addEventListener('keydown', function (ev) {
    if (ev.target.tagName === 'SELECT' || ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      var d = ev.key === 'ArrowRight' ? 1 : -1;
      if (ev.shiftKey) self.go(self.bi + d, 0); else self.go(self.bi, self.sm + d);
    }
  });
  box.addEventListener('change', function (ev) {
    var t = ev.target; if (!t.hasAttribute('data-wdone')) return;
    if (root.LabDone) root.LabDone.set(t.getAttribute('data-wdone'), t.checked);
  });
};
Wp.mode = function (m) {
  this.$.write.style.display = m === 'write' ? '' : 'none';
  this.$.run.style.display = m === 'run' ? '' : 'none';
  this.$.list.style.display = m === 'list' ? '' : 'none';
};
Wp.viz = function (t) {
  if (!this.vz || this.vzTrace !== t.id) {
    this.$.run.innerHTML = '';
    this.vz = new S.Viz(this.$.run, { trace: t.id, bare: true });
    this.vz.setProject(this.pj);
    this.vzTrace = t.id;
  }
  return this.vz;
};
Wp.go = function (bi, sm, first) {
  bi = Math.max(0, Math.min(this.bigs.length - 1, bi));
  var b = this.bigs[bi], n = this.nSmall(b);
  sm = Math.max(0, Math.min(n - 1, sm));
  this.bi = bi; this.sm = sm;
  var html = '', self = this, pj = this.pj;
  if (b.kind === 'overview') {
    this.mode('list');
    var st = this.stats();
    this.$.list.innerHTML = '<div class="w-ov">' + this.bigs.slice(1).map(function (x, i) {
      if (x.kind === 'full') return '<div class="w-ovr full" data-b="' + (i + 1) + '"><span class="badge b-verify">完整跑一遍</span> ' + esc(x.t.title) + '</div>';
      var s = x.s, done = root.LabDone && root.LabDone.get(s.id);
      return '<div class="w-ovr" data-b="' + (i + 1) + '"><span class="sid">' + s.id + '</span><span class="badge b-' + s.kind + '">' + (KIND[s.kind] || '') + '</span> ' + md(s.title) +
        (s.file ? ' <span class="muted">' + esc(s.file.split('/').pop()) + ':' + s.from + '–' + s.to + '</span>' : '') + (CODE[s.kind] ? ' ✎' : '') + (x.clip ? ' <span class="run">▶' + (x.clip.b - x.clip.a + 1) + '</span>' : '') + (done ? ' <span class="okk">✓</span>' : '') + '</div>';
    }).join('') + '</div>';
    this.$.list.onclick = function (ev) { var r = ev.target.closest('[data-b]'); if (r) self.go(+r.getAttribute('data-b'), 0); };
    html = '<div class="kick">总览</div><h3>' + esc(this.ph.name) + '</h3>' + prose(this.ph.goal) +
      '<p class="muted">这一阶段 ' + st.steps + ' 步，其中 ' + st.code + ' 步要写代码、' + st.run + ' 步写完能接着看它怎么跑' + (st.full ? '；最后还有 ' + st.full + ' 条「完整跑一遍」' : '') + '。点左边任意一步直接跳过去。</p>';
  } else if (b.kind === 'full') {
    this.mode('run');
    var vz = this.viz(b.t); vz.go(sm);
    var ts = b.t.steps[sm];
    html = '<div class="kick">完整跑一遍 · 第 ' + (sm + 1) + ' / ' + b.t.steps.length + ' 步</div><h3>' + esc(b.t.title) + '</h3>' + (b.t.note && !sm ? '<p class="muted">' + md(b.t.note) + '</p>' : '') + this.traceInfo(ts);
  } else {
    var s = b.s, done = root.LabDone && root.LabDone.get(s.id);
    var hd = '<div class="w-sh"><input type="checkbox" data-wdone="' + s.id + '"' + (done ? ' checked' : '') + '><span class="sid">' + s.id + '</span><span class="badge b-' + s.kind + '">' + (KIND[s.kind] || '') + '</span><b>' + md(s.title) + '</b></div>';
    if (CODE[s.kind] && sm === 0) {
      this.mode('write');
      var lines = (LAB.files[s.file] || []).slice(s.from - 1, s.to), defs = defsOf(lines), total = (LAB.files[s.file] || []).length;
      this.src.show(s.file, null, { upto: s.to, green: [s.from, s.to], note: '做完这一步：第 1–' + s.to + ' 行（全文 ' + total + ' 行）' });
      this.$.side.innerHTML = '<div class="w-card"><div class="w-ct">这一步写了什么</div><div class="kv"><span>文件</span><span><code>' + esc(s.file) + '</code></span><span>行号</span><span>第 ' + s.from + '–' + s.to + ' 行（' + (s.to - s.from + 1) + ' 行）</span>' +
        (defs.length ? '<span>定义</span><span>' + defs.map(function (d) { return '<code>' + esc(d) + '</code>'; }).join(' ') + '</span>' : '') + '</div></div>' +
        '<div class="w-card st"><div class="w-ct">写完以后</div>' + stateChip(s) + '<div class="w-stt">' + md(s.build || '') + '</div></div>' +
        (b.clip ? '<div class="w-hint">下一格起是「▶ 跑」：这几行在逐行演示「' + esc(b.clip.t.title) + '」里被执行到的那一段（' + (b.clip.b - b.clip.a + 1) + ' 步）。</div>' : '<div class="w-hint muted">这一步写的行没有出现在逐行演示里，只有「写」这一格。</div>');
      var pts = s.points && s.points.length ? '<div class="w-sub">读代码要点（行号同舞台左边）</div><ul class="w-pts">' + s.points.map(function (p) { return '<li>' + md(p).replace(/<code>L(\d+(?:[–-]\d+)?)<\/code>/g, '<code class="lref">L$1</code>') + '</li>'; }).join('') + '</ul>' : '';
      var notes = s.notes ? Object.keys(s.notes) : [];
      html = hd + '<div class="w-goal">' + md(s.what) + '</div>' + stateChip(s) + (s.why ? '<div class="w-sub">为什么这么写</div>' + prose(s.why) : '') + pts +
        '<div class="w-sub">要敲的代码（第 ' + s.from + '–' + s.to + ' 行）</div>' + root.LabCode(s.file, s.from, s.to, s.notes) +
        (s.early ? '<div class="callout">⚠ ' + md(s.early) + '</div>' : '') +
        (s.impl ? '<div class="impl"><h4>你的实现：' + md(s.impl.goal || '') + '</h4>' + (s.impl.hints || []).map(function (x) { return '<div>· ' + md(x) + '</div>'; }).join('') +
          ((s.impl.pseudo || []).length ? '<pre>' + esc(s.impl.pseudo.join('\n')) + '</pre>' : '') + ((s.impl.tests || []).length ? '<div class="muted" style="font-size:13px">写完用这些测试检查：' + s.impl.tests.map(function (t) { return '<code>' + esc(t) + '</code>'; }).join(' ') + '</div>' : '') + '</div>' : '') +
        (s.think ? '<details class="fold"><summary>敲完前想一想：' + md(s.think.q) + '</summary>' + prose(s.think.a) + '</details>' : '') +
        (notes.length ? '<p class="muted" style="font-size:12.5px">上面代码里的 ' + notes.length + ' 条逐行注释只在页面上显示，「复制」出去的代码和原文件一模一样。</p>' : '');
    } else if (CODE[s.kind]) {
      this.mode('run');
      var k = b.clip.a + sm - 1, vz2 = this.viz(b.clip.t); vz2.go(k);
      var ts2 = b.clip.t.steps[k];
      html = hd + '<div class="kick">▶ 跑 · 第 ' + sm + ' / ' + (b.clip.b - b.clip.a + 1) + ' 步 · 演示「' + esc(b.clip.t.title) + '」第 ' + (k + 1) + ' 步</div>' +
        (sm === 1 ? '<div class="w-guide">' + md(s.runNote || ('执行从这条演示的第 ' + (b.clip.a + 1) + ' 步进来，接下来几步正好跑到你刚敲的第 ' + s.from + '–' + s.to + ' 行。盯住右边栈帧里的变量和数据对象怎么变。')) + '</div>' : '') +
        this.traceInfo(ts2);
    } else {
      this.mode('list');
      this.$.list.innerHTML = '<div class="w-cmd">' + (s.cmd ? '<div class="w-ct">要执行的命令</div><pre class="cmd">' + esc(s.cmd) + '</pre>' : '') +
        (s.kind === 'verify' ? (this.ph.verify || []).map(function (v) { return '<pre class="cmd">' + esc(v.cmd) + '</pre><p>' + md(v.expect || '') + '</p>'; }).join('') + '<div class="callout red"><b>未实测</b>：这台机器上没有编译运行过 BusTub，预期是按代码和官方文档推断的。</div>' : '') + '</div>';
      html = hd + '<div class="w-goal">' + md(s.what) + '</div>' + (s.why ? prose(s.why) : '') + (s.cmd ? '<pre class="cmd">' + esc(s.cmd) + '</pre>' : '') +
        (s.think ? '<details class="fold"><summary>想一想：' + md(s.think.q) + '</summary>' + prose(s.think.a) + '</details>' : '');
    }
  }
  this.$.body.innerHTML = html;
  this.$.rng.max = n - 1; this.$.rng.value = sm; this.$.rng.disabled = n < 2;
  this.$.pc.textContent = b.kind === 'step' && CODE[b.s.kind] ? (sm === 0 ? '✎ 写' + (b.clip ? ' · 后面 ▶ ' + (n - 1) + ' 步' : '') : '▶ ' + sm + ' / ' + (n - 1)) : (sm + 1) + ' / ' + n;
  this.$.sel.value = bi; this.$.cnt.textContent = (bi + 1) + ' / ' + this.bigs.length;
  if (!first) { var all = load('labs:walk'); all[this.key] = [bi, sm]; save('labs:walk', all); }
};
Wp.traceInfo = function (ts) {
  var line = (LAB.files[ts.file] || [])[ts.line - 1] || '';
  return '<div class="muted" style="font-size:12.5px">' + esc(ts.file) + ' · 第 ' + ts.line + ' 行' + (ts.real ? ' <span class="tagx real">原项目已有代码</span>' : ' <span class="tagx spec">按官方要求的期望效果</span>') + '</div>' +
    '<div class="cl">' + esc(line.trim()) + '</div><div>' + prose(ts.note) + '</div>' +
    (ts.chg && ts.chg.length ? '<div class="w-sub">这一步的变化</div><ul class="w-pts">' + ts.chg.map(function (c) { return '<li>' + md(c) + '</li>'; }).join('') + '</ul>' : '');
};

root.LabPhase = {
  mountConcepts: function (el, pj, ph) { return new ConceptUI(el, pj, ph); },
  mountWalk: function (el, pj, ph) { return new WalkUI(el, pj, ph); },
  clipOf: clipOf
};
})(window);
