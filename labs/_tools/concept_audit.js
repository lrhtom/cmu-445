#!/usr/bin/env node
/* 翻页图解的排版校验：node _tools/concept_audit.js _content/P1.json [_content/P2.json …]
 * 逐页累积状态并排版（和页面用同一份 assets/concept-core.js），检查：引用的对象在不在、对象重叠、出界、字被截断、
 * 线从别的对象身上穿过去、翻到这一页舞台有没有变化。每个问题打印一行，有问题时退出码为 1。build_labs.py 会调用它。 */
const fs = require('fs'), path = require('path');
const Core = require(path.join(__dirname, '..', 'assets', 'concept-core.js'));
const P = { paper: '#fffdf8', ink: '#1f2328', mute: '#6b7079', line: '#cfc8b8', soft: '#f1ede4', core: '#2563eb', feat: '#0f8b6c', ext: '#8b919a', test: '#b7791f',
  hot: '#d97706', hotBg: '#fff1bf', cur: '#1d4ed8', curBg: '#dbeafe', visit: '#eef4ff', tok: '#e0452b', newBg: '#dcf5e8', frame: '#6d4fd6', frameBg: '#f3efff', obj: '#0f8b6c', objBg: '#effaf5', flash: '#ffd970' };
let bad = 0, pages = 0, secs = 0;
for (const f of process.argv.slice(2)) {
  const pj = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const ph of pj.phases || []) {
    (ph.concepts || []).forEach((c, ci) => {
      secs++;
      const where = (i) => `${pj.id} 阶段 ${ph.id} 第 ${ci + 1} 节「${c.t}」` + (i == null ? '' : `第 ${i + 1} 页「${(c.pages[i] || {}).h || ''}」`);
      const errs = [];
      const states = Core.run(c, (m) => errs.push(m));
      errs.forEach((m) => { bad++; console.log(where() + '：' + m); });
      let prev = null, prevAt = null, prevOut = 0;
      states.forEach((st, i) => {
        pages++;
        const L = Core.layout(st, P, !!c.files), r = Core.audit(L);
        r.errs.forEach((m) => { bad++; console.log(where(i) + '：' + m); });
        if (prev !== null && r.sig === prev && st.at === prevAt && st.out.length === prevOut) { bad++; console.log(where(i) + '：翻到这一页舞台没有任何变化'); }
        prev = r.sig; prevAt = st.at; prevOut = st.out.length;
      });
    });
  }
}
console.log(`图解校验：${secs} 节、${pages} 页，${bad ? bad + ' 处问题' : '没有问题'}`);
process.exit(bad ? 1 : 0);
