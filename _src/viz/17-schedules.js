/* #17 并发控制理论：好的交错 / 坏的交错 / 丢失更新 / 依赖图判环
 * 转账 + 计息的数字（A=B=$1000、$100、6%、$2120、$2114）与官方 Slides 一致；T1 蓝、T2 紫。 */
(function () {
var C = Viz.C, TC = { 1: C.blue, 2: C.purple };
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Lecture #17 Concurrency Control Theory（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/17-concurrencycontrol.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #17 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/17-concurrencycontrol.pdf' }
];

function lanes(S, y1, y2) {
  [[1, y1], [2, y2]].forEach(function (a) {
    S.line('ln' + a[0], { x1: 86, y1: a[1], x2: 838, y2: a[1], stroke: C.line, sw: 1.5, dash: '2 6' });
    S.box('lab' + a[0], { x: 52, y: a[1], w: 56, h: 34, rx: 17, fill: C.panel, stroke: TC[a[0]], sw: 2, label: 'T' + a[0], size: 16 });
  });
  S.text('tm', { x: 838, y: y2 + 36, text: '时间 →', anchor: 'end', color: C.mute, size: 14 });
}
function op(S, id, x, y, label, w) {
  S.box(id, { x: x, y: y, w: w || 66, h: 34, rx: 8, fill: C.cell, stroke: C.line, sw: 1.5, label: label, color: C.mute, size: label.length > 5 ? 14 : 15 });
}
function light(S, id, th, t) {
  S.to(id, { fill: TC[th], color: C.bg, stroke: TC[th] }, { delay: t || 0, dur: 300 }); S.pulse(id, { delay: t || 0 });
}

/* ───────── 场景 1 / 2 共用：转账 + 计息 ───────── */
function bank(S, slot) {
  var Y1 = 92, Y2 = 162, RX = { 1: 150, 2: 710 }, DX = { A: 340, B: 520 };
  function SX(i) { return 128 + i * 74; }
  S.text('note', { x: 20, y: 24, text: 'T1：从 A 转 $100 到 B　　T2：给 A、B 各计 6% 利息', anchor: 'start', size: 14, color: C.mute });
  lanes(S, Y1, Y2);
  [1, 2].forEach(function (th) {
    var y = th === 1 ? Y1 : Y2, s = slot[th];
    op(S, 'c' + th + 'RA', SX(s.A), y, 'R(A)'); op(S, 'c' + th + 'WA', SX(s.A + 1), y, 'W(A)');
    op(S, 'c' + th + 'RB', SX(s.B), y, 'R(B)'); op(S, 'c' + th + 'WB', SX(s.B + 1), y, 'W(B)');
    op(S, 'c' + th + 'C', SX(s.C), y, 'COMMIT');
    S.text('rt' + th, { x: RX[th], y: 262, text: 'T' + th + ' 读进来的值（局部变量）', color: C.mute, size: 14 });
    S.box('reg' + th, { x: RX[th], y: 304, w: 220, h: 56, rx: 10, fill: C.panel, stroke: TC[th], sw: 2 });
    S.text('rv' + th, { x: RX[th], y: 304, val: 0, pre: 'A = $', size: 20, weight: 700, opacity: 0 });
    S.text('cp' + th, { x: RX[th], y: 350, text: '', color: C.amber, size: 16, weight: 700, opacity: 0 });
  });
  S.box('stall', { x: 430, y: 304, w: 250, h: 40, rx: 10, fill: C.bg, stroke: C.amber, sw: 2, dash: '5 4', label: '', color: C.amber, size: 15, opacity: 0 });
  S.text('dbt', { x: 430, y: 392, text: '数据库里的共享数据', color: C.mute, size: 14 });
  ['A', 'B'].forEach(function (o) {
    S.box('db' + o, { x: DX[o], y: 438, w: 150, h: 60, rx: 10, fill: C.cell, stroke: C.line, sw: 2 });
    S.text('db' + o + 'n', { x: DX[o] - 50, y: 438, text: o, color: C.mute, size: 18, weight: 700 });
    S.text('db' + o + 'v', { x: DX[o] + 12, y: 438, val: 1000, pre: '$', size: 22, weight: 700 });
  });
  S.text('sum', { x: 430, y: 500, val: 2000, pre: 'A + B = $', color: C.amber, size: 18, weight: 700 });
  S.text('exp', { x: 430, y: 528, text: '正确结果：$2120（= 2000 × 1.06）', color: C.mute, size: 14 });
  S.line('ph', { x1: SX(0), y1: 62, x2: SX(0), y2: 196, stroke: C.amber, sw: 2, dash: '3 4', opacity: 0 });
  S.data({ A: 1000, B: 1000, 'A + B': 2000, 'T1 局部': '—', 'T2 局部': '—' });
  var bal = { A: 1000, B: 1000 };

  return {
    SX: SX,
    head: function (i, t) { S.to('ph', { opacity: 1 }, { delay: t, dur: 200 }); S.to('ph', { x1: SX(i), x2: SX(i) }, { delay: t, dur: 400 }); },
    /* 读 → 算 → 写：值从数据库飞到局部变量，滚动成新值，再飞回去 */
    rw: function (th, o, txt, to, t) {
      var s = slot[th][o], from = bal[o], reg = 'rv' + th, d = {};
      this.head(s, t); light(S, 'c' + th + 'R' + o, th, t + 350);
      S.flash('db' + o, C.blue, { prop: 'stroke', delay: t + 350 });
      S.fly([DX[o], 406], [RX[th], 334], { label: '$' + from, w: 70, h: 28, color: C.cyan, delay: t + 500, dur: 750 });
      S.set(reg, { pre: o + ' = $', val: from }, { delay: t + 1250 }); S.to(reg, { opacity: 1 }, { delay: t + 1250, dur: 150 }); S.pulse('reg' + th, { delay: t + 1250, scale: 1.05 });
      d['T' + th + ' 局部'] = o + ' = ' + from; S.data(d, { delay: t + 1250 });
      S.set('cp' + th, { text: txt }, { delay: t + 1600 }); S.pop('cp' + th, { delay: t + 1600 });
      S.count(reg, to, { delay: t + 1800, dur: 600 }); S.hide('cp' + th, { delay: t + 2700 });
      d = {}; d['T' + th + ' 局部'] = o + ' = ' + to; S.data(d, { delay: t + 2400 });
      this.head(s + 1, t + 2500); light(S, 'c' + th + 'W' + o, th, t + 2850);
      S.fly([RX[th], 334], [DX[o], 406], { label: '$' + to, w: 70, h: 28, color: C.cyan, delay: t + 3000, dur: 750 });
      bal[o] = to;
      S.count('db' + o + 'v', to, { delay: t + 3750, dur: 500 }); S.flash('db' + o, TC[th], { prop: 'stroke', delay: t + 3750, hold: 600 });
      S.count('sum', bal.A + bal.B, { delay: t + 3750, dur: 500 });
      d = {}; d[o] = to; d['A + B'] = bal.A + bal.B; S.data(d, { delay: t + 3750 });
      S.log('T' + th + ': R(' + o + ')=' + from + ' → W(' + o + ')=' + to, { delay: t + 3750 });
      return t + 4250;
    },
    commit: function (th, t) {
      this.head(slot[th].C, t);
      S.to('c' + th + 'C', { fill: C.green, color: C.bg, stroke: C.green }, { delay: t + 400, dur: 300 }); S.pulse('c' + th + 'C', { delay: t + 400 });
      S.ripple(SX(slot[th].C), th === 1 ? Y1 : Y2, { delay: t + 400, color: C.green });
      S.hide('rv' + th, { delay: t + 500 });
      S.log('T' + th + ': COMMIT', { delay: t + 400, kind: 'ok' });
      return t + 900;
    },
    stall: function (txt, t) { S.set('stall', { label: txt }, { delay: t }); S.pop('stall', { delay: t }); },
    resume: function (t) { S.hide('stall', { delay: t }); }
  };
}

Viz.register('schedules', {
  title: '调度与可串行化：交错执行 · 丢失更新 · 依赖图',
  sources: SRC,
  scenes: [

  /* ───────────────────────── 场景 1：好的交错 ───────────────────────── */
  {
    name: '好的交错',
    moving: '时间线上的游标逐格右移、操作块依次点亮；余额从数据库飞进事务的局部变量、滚动成新值再飞回数据库；A+B 合计随之滚动',
    lang: '调度（按执行顺序）',
    code: [
      'T1  BEGIN',
      'T1  R(A)  A = A - 100   W(A)',
      '    -- T1 停顿：等磁盘读 B 所在的页',
      'T2  BEGIN',
      'T2  R(A)  A = A * 1.06  W(A)',
      '    -- T2 也停顿，切回 T1',
      'T1  R(B)  B = B + 100   W(B)',
      'T1  COMMIT',
      'T2  R(B)  B = B * 1.06  W(B)',
      'T2  COMMIT',
      '-- 结果 A=954  B=1166  合计 2120',
      '-- 等价于串行 T1 → T2'
    ].join('\n'),
    build: function (S) {
      var K = bank(S, { 1: { A: 0, B: 4, C: 6 }, 2: { A: 2, B: 7, C: 9 } });

      S.step('A、B 各 $1000。T1 转账、T2 计息：不管怎么交错，最后 A + B 必须是 $2120', function () {
        S.code(1); S.log('初始 A=1000 B=1000');
        S.pulse('dbA', { scale: 1.06 }); S.pulse('dbB', { delay: 250, scale: 1.06 });
        S.flash('exp', C.green, { prop: 'color', delay: 600, hold: 900 }); S.pulse('exp', { delay: 600, scale: 1.06 });
      });
      S.step('T1：读 A → 减 100 → 写回，A 变成 $900', function () {
        S.code(2); K.rw(1, 'A', '− 100', 900, 0);
      });
      S.step('T1 停顿等磁盘，数据库趁机让 T2 跑：读 A（$900）→ ×1.06 → 写回 $954', function () {
        S.code(3); K.stall('T1 停顿：等磁盘', 0);
        S.code(5, { delay: 700 }); K.rw(2, 'A', '× 1.06', 954, 700);
      });
      S.step('T2 也停顿，切回 T1：读 B → 加 100 → 写回，B 变成 $1100', function () {
        S.code(6); K.stall('T2 停顿：等磁盘', 0);
        S.code(7, { delay: 700 }); K.rw(1, 'B', '+ 100', 1100, 700);
      });
      S.step('T1 提交', function () {
        S.code(8); K.commit(1, 0); S.data({ 'T1 局部': '已提交' }, { delay: 500 });
      });
      S.step('T2 醒来：读 B —— 读到的是已经到账的 $1100 → ×1.06 → 写回 $1166', function () {
        K.resume(0); S.code(9); K.rw(2, 'B', '× 1.06', 1166, 200);
      });
      S.step('T2 提交。A + B = $2120 ✓ —— 对 A 和对 B 都是 T1 先于 T2，等价于串行 T1 → T2', function () {
        S.code(10); var e = K.commit(2, 0); S.data({ 'T2 局部': '已提交' }, { delay: 500 });
        S.code([11, 12], { delay: e });
        S.to('sum', { color: C.green }, { delay: e, dur: 400 }); S.pulse('sum', { delay: e });
        S.set('exp', { text: '= 正确结果 $2120 ✓　等价于串行 T1 → T2', color: C.green }, { delay: e + 200 }); S.pulse('exp', { delay: e + 200, scale: 1.06 });
        S.hide('ph', { delay: e });
        S.log('A+B = 2120：可串行化', { delay: e + 200, kind: 'ok' });
      });
    }
  },

  /* ───────────────────────── 场景 2：坏的交错 ───────────────────────── */
  {
    name: '坏的交错：少了 $6',
    moving: '同样的操作块换了排列；T2 的四个操作连着点亮，余额在数据库和两个事务的局部变量之间来回飞；合计最终停在 2114 并变红',
    lang: '调度（按执行顺序）',
    code: [
      'T1  BEGIN',
      'T1  R(A)  A = A - 100   W(A)',
      '    -- T1 停顿',
      'T2  BEGIN',
      'T2  R(A)  A = A * 1.06  W(A)',
      'T2  R(B)  B = B * 1.06  W(B)',
      'T2  COMMIT',
      'T1  R(B)  B = B + 100   W(B)',
      'T1  COMMIT',
      '-- 结果 A=954  B=1160  合计 2114',
      '-- 串行 T1→T2：A=954  B=1166',
      '-- 串行 T2→T1：A=960  B=1160',
      '-- 两种都是 2120，这个调度少了 $6'
    ].join('\n'),
    build: function (S) {
      var K = bank(S, { 1: { A: 0, B: 7, C: 9 }, 2: { A: 2, B: 4, C: 6 } });

      S.step('T1：读 A → 减 100 → 写回 $900。那 $100 此刻已经离开 A，还没进 B', function () {
        S.code(2); K.rw(1, 'A', '− 100', 900, 0);
      });
      S.step('T1 停顿，T2 上场：读 A（$900）→ ×1.06 → 写回 $954', function () {
        S.code(3); K.stall('T1 停顿：等磁盘', 0);
        S.code(5, { delay: 700 }); K.rw(2, 'A', '× 1.06', 954, 700);
      });
      S.step('这次 T2 没停，接着读 B —— 还是旧的 $1000，T1 的 $100 没到账 → 写回 $1060', function () {
        S.code(6); var e = K.rw(2, 'B', '× 1.06', 1060, 0);
        S.flash('dbBv', C.red, { prop: 'color', delay: 500, hold: 700 });
        S.log('T2 读到的 B 不含那 $100', { delay: 1300, kind: 'warn' });
      });
      S.step('T2 提交', function () {
        S.code(7); K.commit(2, 0); S.data({ 'T2 局部': '已提交' }, { delay: 500 });
      });
      S.step('T1 醒来：读 B（$1060）→ 加 100 → 写回 $1160，提交', function () {
        K.resume(0); S.code(8); var e = K.rw(1, 'B', '+ 100', 1160, 200);
        S.code(9, { delay: e }); K.commit(1, e); S.data({ 'T1 局部': '已提交' }, { delay: e + 500 });
      });
      S.step('A + B = $2114，少了 $6：那 $100 两边都没计到息，任何串行顺序都得不到它', function () {
        S.code([10, 13]); S.hide('ph');
        S.to('sum', { color: C.red }, { dur: 400 }); S.pulse('sum'); S.ripple(430, 500, { color: C.red, r: 70 });
        S.set('exp', { text: '≠ 正确结果 $2120 ✗　少了 $100 × 6% = $6', color: C.red }, { delay: 400 }); S.pulse('exp', { delay: 400, scale: 1.06 });
        S.flash('dbA', C.red, { prop: 'stroke', delay: 700, hold: 800 }); S.flash('dbB', C.red, { prop: 'stroke', delay: 700, hold: 800 });
        S.log('A+B = 2114：不可串行化', { delay: 400, kind: 'err' });
      });
    }
  },

  /* ───────────────────────── 场景 3：丢失更新 ───────────────────────── */
  {
    name: '写-写冲突：丢失更新',
    moving: '写入的值从操作块飞向数据库格子；被覆盖的旧值掉落消失；格子边框换成最后写入者的颜色；三张结果卡片依次弹出对比',
    lang: '调度（按执行顺序）',
    code: [
      'T1  W(A) = $10',
      'T2  W(A) = $19      -- 盲写：不读直接覆盖',
      'T2  W(B) = "Bob"',
      'T1  W(B) = "Alice"',
      '-- 最终：A = $19，B = "Alice"',
      '-- 串行 T1→T2 应得 ($19, "Bob")',
      '-- 串行 T2→T1 应得 ($10, "Alice")',
      '-- 哪个都不是：两个事务的写被撕开'
    ].join('\n'),
    build: function (S) {
      var Y1 = 92, Y2 = 162, SX = [200, 370, 540, 710], DX = { A: 300, B: 560 }, DY = 344;
      S.text('note', { x: 20, y: 24, text: 'T1 想写 (A=$10, B="Alice")　　T2 想写 (A=$19, B="Bob")', anchor: 'start', size: 14, color: C.mute });
      lanes(S, Y1, Y2);
      op(S, 'w1A', SX[0], Y1, 'W(A)=$10', 120); op(S, 'w2A', SX[1], Y2, 'W(A)=$19', 120);
      op(S, 'w2B', SX[2], Y2, 'W(B)="Bob"', 120); op(S, 'w1B', SX[3], Y1, 'W(B)="Alice"', 120);
      S.text('dbt', { x: 430, y: 276, text: '数据库里的共享数据', color: C.mute, size: 14 });
      ['A', 'B'].forEach(function (o) {
        S.box('db' + o, { x: DX[o], y: DY, w: 210, h: 76, rx: 12, fill: C.cell, stroke: C.line, sw: 2.5 });
        S.text('db' + o + 'n', { x: DX[o] - 76, y: DY, text: o, color: C.mute, size: 20, weight: 700 });
        S.text('db' + o + 'v', { x: DX[o] + 14, y: DY, text: '旧值', color: C.mute, size: 22, weight: 700 });
        S.text('db' + o + 'w', { x: DX[o], y: DY + 56, text: '最后写入：—', color: C.mute, size: 14 });
      });
      S.line('tear', { x1: 430, y1: 294, x2: 430, y2: 418, stroke: C.red, sw: 3, dash: '6 5', draw: 0, opacity: 0 });
      var card = [['r1', 150, '串行 T1→T2：($19, "Bob")'], ['r2', 430, '串行 T2→T1：($10, "Alice")'], ['r3', 710, '实际：($19, "Alice")']];
      card.forEach(function (c) { S.box(c[0], { x: c[1], y: 488, w: 254, h: 52, rx: 10, fill: C.panel, stroke: C.line, sw: 2, label: c[2], size: 15, opacity: 0 }); });
      S.line('ph', { x1: SX[0], y1: 62, x2: SX[0], y2: 196, stroke: C.amber, sw: 2, dash: '3 4', opacity: 0 });
      S.data({ A: '旧值', B: '旧值', 'A 的最后写入者': '—', 'B 的最后写入者': '—' });
      var gid = 0;
      /* 一次盲写：值从操作块飞进格子；格子里原来的值掉出去 */
      function write(th, o, id, i, val, old, t) {
        S.to('ph', { opacity: 1 }, { delay: t, dur: 200 }); S.to('ph', { x1: SX[i], x2: SX[i] }, { delay: t, dur: 400 });
        light(S, id, th, t + 350);
        S.fly([SX[i], (th === 1 ? Y1 : Y2) + 20], [DX[o] + 14, DY - 40], { label: val, w: 90, h: 28, color: C.cyan, delay: t + 500, dur: 850 });
        if (old) {
          var g = 'gh' + (gid++);
          S.text(g, { x: DX[o] + 14, y: DY, text: old.v, color: TC[old.th], size: 22, weight: 700, opacity: 0 });
          S.set(g, { opacity: 1 }, { delay: t + 1350 });
          S.to(g, { y: DY + 100, opacity: 0 }, { delay: t + 1350, dur: 700, ease: 'in' });
        }
        S.set('db' + o + 'v', { text: val, color: TC[th] }, { delay: t + 1350 }); S.pulse('db' + o + 'v', { delay: t + 1350 });
        S.to('db' + o, { stroke: TC[th] }, { delay: t + 1350, dur: 300 });
        S.set('db' + o + 'w', { text: '最后写入：T' + th, color: TC[th] }, { delay: t + 1350 });
        var d = {}; d[o] = val + '（T' + th + ' 写）'; d[o + ' 的最后写入者'] = 'T' + th; S.data(d, { delay: t + 1350 });
        S.log('T' + th + ': W(' + o + ') = ' + val, { delay: t + 1350, kind: old ? 'warn' : '' });
        return t + 2050;
      }

      S.step('两个事务都要写 A 和 B，谁也不读。串行执行只可能得到两种结果之一', function () {
        S.pulse('lab1', { scale: 1.1 }); S.pulse('lab2', { delay: 300, scale: 1.1 });
        S.flash('note', C.ink, { prop: 'color', delay: 300, hold: 900 });
        S.code(6, { delay: 600 }); S.pop('r1', { delay: 600 }); S.code(7, { delay: 1100 }); S.pop('r2', { delay: 1100 });
        S.log('T1: (A=$10, B="Alice")'); S.log('T2: (A=$19, B="Bob")', { delay: 300 });
      });
      S.step('T1：W(A) = $10', function () {
        S.code(1); write(1, 'A', 'w1A', 0, '$10', null, 0);
      });
      S.step('T2：W(A) = $19 —— 盲写，不读就直接覆盖，T1 写的 $10 被挤掉', function () {
        S.code(2); write(2, 'A', 'w2A', 1, '$19', { v: '$10', th: 1 }, 0);
      });
      S.step('T2：W(B) = "Bob"', function () {
        S.code(3); write(2, 'B', 'w2B', 2, '"Bob"', null, 0);
      });
      S.step('T1：W(B) = "Alice" —— 这回轮到 T1 覆盖 T2 的 "Bob"', function () {
        S.code(4); write(1, 'B', 'w1B', 3, '"Alice"', { v: '"Bob"', th: 2 }, 0);
      });
      S.step('最终 A 是 T2 写的、B 是 T1 写的 —— 两个事务的写被撕开了', function () {
        S.code(5); S.hide('ph');
        S.pulse('dbA', { scale: 1.06 }); S.pulse('dbB', { delay: 250, scale: 1.06 });
        S.to('tear', { opacity: 1, draw: 1 }, { delay: 500, dur: 600 });
        S.log('最终 A=$19(T2)  B="Alice"(T1)', { delay: 500, kind: 'err' });
      });
      S.step('和两种串行结果对比：实际得到的 ($19, "Alice") 哪个都不是', function () {
        S.code(6); S.pulse('r1'); S.to('r1', { stroke: C.green }, { delay: 200, dur: 300 });
        S.code(7, { delay: 600 }); S.pulse('r2', { delay: 600 }); S.to('r2', { stroke: C.green }, { delay: 800, dur: 300 });
        S.fly([300, 344], [650, 488], { label: '$19', w: 60, h: 26, color: C.purple, delay: 1100, dur: 700, ripple: false });
        S.fly([560, 344], [760, 488], { label: '"Alice"', w: 76, h: 26, color: C.blue, delay: 1300, dur: 700, ripple: false });
        S.code(8, { delay: 2000 }); S.pop('r3', { delay: 2000 }); S.to('r3', { stroke: C.red, color: C.red }, { delay: 2300, dur: 300 });
        S.ripple(710, 488, { delay: 2300, color: C.red, r: 60 });
        S.log('不等价于任何串行顺序', { delay: 2300, kind: 'err' });
      });
    }
  },

  /* ───────────────────────── 场景 4：依赖图 ───────────────────────── */
  {
    name: '依赖图：成环即不可串行化',
    moving: '黄色箭头从先发生的操作连到后发生的冲突操作；数据包飞进下方的图里长出一条边；红点沿环绕圈；最后操作块滑动换位，反向的边缩回',
    lang: '伪代码（示意）',
    code: [
      '// 用依赖图判定冲突可串行化',
      'Graph g;  // 每个事务一个节点',
      'for (Op a : schedule)',
      '  for (Op b : schedule after a)',
      '    if (a.txn != b.txn          // 不同事务',
      '        && a.obj == b.obj       // 同一对象',
      '        && (a.isWrite || b.isWrite))',
      '      g.AddEdge(a.txn, b.txn);  // 先 → 后',
      'if (g.HasCycle())',
      '  return NOT_CONFLICT_SERIALIZABLE;',
      'return g.TopoOrder();  // 等价的串行顺序'
    ].join('\n'),
    build: function (S) {
      var Y1 = 92, Y2 = 162;
      function SX(i) { return 150 + i * 88; }
      var ops = { a1: [1, 0, 'R(A)'], a2: [1, 1, 'W(A)'], a3: [2, 2, 'R(A)'], a4: [2, 3, 'W(A)'], b3: [2, 4, 'R(B)'], b4: [2, 5, 'W(B)'], b1: [1, 6, 'R(B)'], b2: [1, 7, 'W(B)'] };
      S.text('note', { x: 20, y: 24, text: '调度就是「坏的交错」那一个，只是抹掉了算术，只剩读写', anchor: 'start', size: 14, color: C.mute });
      lanes(S, Y1, Y2);
      Object.keys(ops).forEach(function (k) {
        var o = ops[k];
        S.box(k, { x: SX(o[1]), y: o[0] === 1 ? Y1 : Y2, w: 72, h: 34, rx: 8, fill: C.cell, stroke: TC[o[0]], sw: 2, label: o[2], size: 15 });
      });
      function pt(k, up) { var o = ops[k]; return [SX(o[1]), (o[0] === 1 ? Y1 : Y2) + (up ? -19 : 19)]; }
      /* 冲突箭头：从先发生的操作指向后发生的 */
      var cf = { c1: ['a2', 'a3'], c2: ['a1', 'a4'], c3: ['a2', 'a4'], c4: ['b4', 'b1'], c5: ['b3', 'b2'], c6: ['b4', 'b2'] };
      Object.keys(cf).forEach(function (k) {
        var a = pt(cf[k][0], ops[cf[k][0]][0] === 2), b = pt(cf[k][1], ops[cf[k][1]][0] === 2);
        S.line(k, { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.amber, sw: 2.5, arrow: true, draw: 0, opacity: 0 });
      });
      S.line('c7', { x1: SX(5), y1: Y1 + 19, x2: SX(6), y2: Y2 - 19, stroke: C.amber, sw: 2.5, arrow: true, draw: 0, opacity: 0 });
      S.text('rule', { x: 430, y: 236, text: '冲突 = 不同事务 + 同一个对象 + 至少一个是写　　边：先发生的 → 后发生的', color: C.mute, size: 14 });
      S.text('gt', { x: 430, y: 290, text: '依赖图（优先图）', color: C.mute, size: 15 });
      S.line('gAB', { x1: 322, y1: 372, x2: 538, y2: 372, stroke: C.ink, sw: 3, arrow: true, draw: 0, opacity: 0 });
      S.line('gBA', { x1: 538, y1: 408, x2: 322, y2: 408, stroke: C.ink, sw: 3, arrow: true, draw: 0, opacity: 0 });
      S.text('gABt', { x: 430, y: 352, text: 'A', color: C.amber, size: 16, weight: 700, opacity: 0 });
      S.text('gBAt', { x: 430, y: 428, text: 'B', color: C.amber, size: 16, weight: 700, opacity: 0 });
      S.box('g1', { x: 270, y: 390, w: 96, h: 96, rx: 48, fill: C.panel, stroke: TC[1], sw: 3, label: 'T1', size: 22, opacity: 0 });
      S.box('g2', { x: 590, y: 390, w: 96, h: 96, rx: 48, fill: C.panel, stroke: TC[2], sw: 3, label: 'T2', size: 22, opacity: 0 });
      S.text('cnt', { x: 40, y: 390, val: 0, pre: '冲突对：', anchor: 'start', color: C.amber, size: 16, weight: 700 });
      S.text('vd', { x: 430, y: 500, text: '', size: 18, weight: 700, opacity: 0 });
      S.data({ '冲突对': 0, '边': '—', '判定': '—' });
      function pair(k, t) { /* 画一条冲突箭头，两端的操作块弹一下 */
        S.pulse(cf[k][0], { delay: t }); S.pulse(cf[k][1], { delay: t + 250 });
        S.to(k, { opacity: 1, draw: 1 }, { delay: t + 100, dur: 500 });
      }
      function mid(k) { var a = S.byId[k].init; return [(a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2]; }

      S.step('每个事务画一个节点', function () {
        S.code(2); S.pop('g1'); S.pop('g2', { delay: 300 });
        S.log('节点：T1, T2', { delay: 300 });
      });
      S.step('T1 的 W(A) 早于 T2 的 R(A)：不同事务、同一对象、有写 → 冲突，画边 T1 → T2', function () {
        S.code([5, 7]); pair('c1', 0);
        S.code(8, { delay: 800 });
        S.fly(mid('c1'), [430, 372], { color: C.amber, delay: 800, dur: 700 });
        S.to('gAB', { opacity: 1, draw: 1 }, { delay: 1400, dur: 500 }); S.pop('gABt', { delay: 1700 });
        S.count('cnt', 1, { delay: 800 }); S.data({ '冲突对': 1, '边': 'T1 → T2 (A)' }, { delay: 1500 });
        S.log('W1(A) < R2(A) ⇒ T1 → T2', { delay: 1500 });
      });
      S.step('A 上还有两对冲突（R-W、W-W），方向相同 → 只是重复的边，不影响判定', function () {
        S.code([5, 7]); pair('c2', 0); pair('c3', 700);
        S.count('cnt', 2, { delay: 300 }); S.count('cnt', 3, { delay: 1000 });
        S.flash('gAB', C.amber, { prop: 'stroke', delay: 600 }); S.flash('gAB', C.amber, { prop: 'stroke', delay: 1500 });
        S.data({ '冲突对': 3 }, { delay: 1000 }); S.log('R1(A)<W2(A), W1(A)<W2(A)：重复', { delay: 1000 });
      });
      S.step('再看 B：T2 的 W(B) 早于 T1 的 R(B) → 冲突，这次方向相反，画边 T2 → T1', function () {
        S.code([5, 7]);
        ['c1', 'c2', 'c3'].forEach(function (k) { S.to(k, { opacity: .25 }, { dur: 300 }); });
        pair('c4', 300);
        S.code(8, { delay: 1100 });
        S.fly(mid('c4'), [430, 408], { color: C.amber, delay: 1100, dur: 700 });
        S.to('gBA', { opacity: 1, draw: 1 }, { delay: 1700, dur: 500 }); S.pop('gBAt', { delay: 2000 });
        S.count('cnt', 4, { delay: 1100 }); S.data({ '冲突对': 4, '边': 'T1 → T2 (A)，T2 → T1 (B)' }, { delay: 1800 });
        S.log('W2(B) < R1(B) ⇒ T2 → T1', { delay: 1800 });
      });
      S.step('B 上另外两对冲突同样指向 T2 → T1', function () {
        S.code([5, 7]); pair('c5', 0); pair('c6', 700);
        S.count('cnt', 5, { delay: 300 }); S.count('cnt', 6, { delay: 1000 });
        S.flash('gBA', C.amber, { prop: 'stroke', delay: 600 }); S.flash('gBA', C.amber, { prop: 'stroke', delay: 1500 });
        S.data({ '冲突对': 6 }, { delay: 1000 }); S.log('R2(B)<W1(B), W2(B)<W1(B)：重复', { delay: 1000 });
      });
      S.step('判定：T1 ⇄ T2 成环 → 不是冲突可串行化，没有哪个串行顺序和它等价', function () {
        S.code([9, 10]);
        S.to('gAB', { stroke: C.red }, { dur: 350 }); S.to('gBA', { stroke: C.red }, { dur: 350 });
        S.fly([322, 372], [538, 372], { color: C.red, delay: 300, dur: 600, ripple: false }); S.fly([538, 408], [322, 408], { color: C.red, delay: 900, dur: 600, ripple: false });
        S.fly([322, 372], [538, 372], { color: C.red, delay: 1500, dur: 600, ripple: false }); S.fly([538, 408], [322, 408], { color: C.red, delay: 2100, dur: 600, ripple: false });
        S.set('vd', { text: '有环 ✗　不是冲突可串行化', color: C.red }, { delay: 600 }); S.pop('vd', { delay: 600 });
        S.data({ '判定': '有环：不可串行化' }, { delay: 600 }); S.log('HasCycle() = true', { delay: 600, kind: 'err' });
      });
      S.step('换成「好的交错」：T2 对 B 的读写挪到 T1 之后 → B 上的边掉头，无环', function () {
        S.code(11); S.hide('vd');
        ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].forEach(function (k) { S.to(k, { opacity: 0 }, { dur: 300 }); });
        var o = { delay: 400, dur: 900 };
        S.to('b3', { x: SX(6) }, o); S.to('b4', { x: SX(7) }, o); S.to('b1', { x: SX(4) }, o); S.to('b2', { x: SX(5) }, o);
        S.to('gBA', { draw: 0, opacity: 0 }, { delay: 1300, dur: 500 }); S.hide('gBAt', { delay: 1300 });
        S.to('c7', { opacity: 1, draw: 1 }, { delay: 1500, dur: 500 });
        S.fly([(SX(5) + SX(6)) / 2, (Y1 + Y2) / 2], [430, 372], { color: C.green, delay: 1900, dur: 700 });
        S.to('gAB', { stroke: C.green }, { delay: 2600, dur: 350 });
        S.set('gABt', { text: 'A, B', color: C.green }, { delay: 2600 }); S.pulse('gABt', { delay: 2600 });
        S.to('g1', { stroke: C.green }, { delay: 2700, dur: 300 }); S.to('g2', { stroke: C.green }, { delay: 2900, dur: 300 });
        S.set('vd', { text: '无环 ✓　等价于串行 T1 → T2', color: C.green }, { delay: 2700 }); S.pop('vd', { delay: 2700 });
        S.data({ '边': 'T1 → T2 (A, B)', '判定': '无环：等价于 T1 → T2' }, { delay: 2700 });
        S.log('TopoOrder() = T1, T2', { delay: 2700, kind: 'ok' });
      });
    }
  }
  ]
});
})();
