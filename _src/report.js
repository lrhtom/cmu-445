/* 校验所有可视化并输出场景表：node _src/report.js [--json] [讲次前缀…]
 * 约束：每个可视化 3–6 个场景；每个场景 5–16 步；1× 速度下 20–60 秒。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = __dirname;
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(dir, 'anim.js'), 'utf8'), { filename: 'anim.js' });
let bad = 0;
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));   /* 可选：只看文件名以这些前缀开头的，如 03 05 */
for (const f of fs.readdirSync(path.join(dir, 'viz')).filter(f => f.endsWith('.js') && (!only.length || only.some(p => f.startsWith(p)))).sort()) {
  try { vm.runInThisContext(fs.readFileSync(path.join(dir, 'viz', f), 'utf8'), { filename: f }); }
  catch (e) { bad++; console.error('✗ ' + f + ' 加载失败: ' + e.message); }
}
let rep;
try { rep = Viz.report(); } catch (e) { console.error('✗ 编译失败: ' + e.stack); process.exit(1); }
if (process.argv.includes('--json')) { console.log(JSON.stringify(rep)); process.exit(bad ? 1 : 0); }
for (const v of rep) {
  const warn = [];
  if (v.scenes.length < 3 || v.scenes.length > 6) warn.push('场景数 ' + v.scenes.length + ' 不在 3–6');
  if (!v.sources.length) warn.push('缺出处');
  console.log('\n■ ' + v.id + ' — ' + v.title);
  for (const s of v.scenes) {
    const w = [];
    if (s.steps < 5 || s.steps > 16) w.push('步数不在 5–16');
    if (s.seconds < 20 || s.seconds > 60) w.push('时长不在 20–60s');
    if (!s.moving) w.push('缺 moving 描述');
    if (w.length) bad++;
    console.log('  ' + (w.length ? '✗' : '✓') + ' ' + s.name + ' | ' + s.steps + ' 步 | ' + s.seconds + 's' + (w.length ? '  ← ' + w.join('；') : ''));
  }
  if (warn.length) { bad++; console.log('  ✗ ' + warn.join('；')); }
}
console.log('\n' + (bad ? '有 ' + bad + ' 处不合格' : '全部合格') + '，共 ' + rep.length + ' 个可视化 / ' + rep.reduce((a, v) => a + v.scenes.length, 0) + ' 个场景');
process.exit(bad ? 1 : 0);
