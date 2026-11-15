/* HW1 SQL：一条查询怎么一步步算出结果（聚合→连接→排序 / HAVING 与 COUNT DISTINCT / 每组取第一 / UPSERT）
 * 画面里的人名、球队、数字全部是讲义第 2 节那套玩具数据（示意），与作业数据集无关。 */
(function () {
var C = Viz.C, ROW = '#22325a';
var NOTE = '玩具数据（示意），与作业数据集无关';
var SRC = [
  { t: 'CMU 15-445 Fall 2025 · Homework #1 SQL（作业网页）', u: 'https://15445.courses.cs.cmu.edu/fall2025/homework1/' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #02 Modern SQL（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/02-modernsql.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #02 讲义（Notes）', u: 'https://15445.courses.cs.cmu.edu/fall2025/notes/02-modernsql.pdf' },
  { t: 'CMU 15-445 Fall 2025 · Lecture #01 Relational Model（Slides）', u: 'https://15445.courses.cs.cmu.edu/fall2025/slides/01-relationalmodel.pdf' }
];
function title(S, id, x, y, text) { S.text(id, { x: x, y: y, text: text, anchor: 'start', size: 15, color: C.mute }); }
function row(S, id, x, y, w, label, o) {
  var p = { x: x, y: y, w: w, h: 28, rx: 6, fill: ROW, stroke: C.line, sw: 1.2, label: label, size: 15, weight: 500 };
  for (var k in o) p[k] = o[k];
  S.box(id, p);
}
function settle(S, id, delay) { S.to(id, { fill: ROW, color: C.ink }, { delay: delay, dur: 350 }); }

Viz.register('hw1-sql', {
  title: 'HW1：一条 SQL 是怎么一步步算出结果的',
  sources: SRC,
  scenes: [

  /* ───────────── 场景 1：先聚合、再连接、再排序 ───────────── */
  {
    name: '聚合 → 连接 → 排序',
    moving: '出场记录飞进各自的人名组、组内最大值滚动；ZJ 的读书记录连接到 best 后落进结果槽；重复的 Ann 缩小消失，结果行滑到排好序的位置',
    lang: 'SQL（DuckDB）',
    code: [
      'WITH zj AS (',
      '  SELECT DISTINCT st.pid',
      '  FROM studied st JOIN schools s',
      '    ON s.sid = st.sid',
      "  WHERE s.prov = 'ZJ'),",
      'best AS (',
      '  SELECT pid, MAX(goals) AS best',
      '  FROM games GROUP BY pid)',
      "SELECT first||' ('||given||') '||last,",
      '       best',
      'FROM people p',
      '  JOIN zj USING (pid)',
      '  JOIN best USING (pid)',
      'ORDER BY best DESC, first',
      'LIMIT 3;'
    ].join('\n'),
    build: function (S) {
      var G = [['Ann', 'RED', 2021, 3, 0], ['Ann', 'RED', 2022, 5, 0], ['Bob', 'RED', 2021, 1, 1], ['Bob', 'BLU', 2022, 7, 1], ['Cat', 'BLU', 2022, 2, 2],
               ['Cat', 'RED', 2021, 6, 2], ['Dan', 'BLU', 2021, 4, 3], ['Eve', 'RED', 2022, 0, 4], ['Fay', 'BLU', 2022, 5, 5], ['Fay', 'BLU', 2021, 1, 5]];
      var NAMES = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay'], MAX = [5, 7, 6, 4, 0, 5];
      var ST = [['Ann', 's1', 'ZJ', 0], ['Ann', 's3', 'ZJ', 0], ['Bob', 's2', 'GD', 1], ['Cat', 's3', 'ZJ', 2], ['Dan', 's2', 'GD', 3], ['Fay', 's1', 'ZJ', 5]];
      var SL = [125, 325, 525, 725], YR = 497;
      function gy(i) { return 94 + i * 35; }
      function by(j) { return 104 + j * 54; }
      function sy(k) { return 104 + k * 40; }
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      title(S, 'tG', 40, 62, 'games：一行 = 某人某季');
      title(S, 'tB', 345, 62, 'best：每人一行');
      title(S, 'tZ', 620, 62, 'studied ⋈ schools');
      G.forEach(function (r, i) { row(S, 'g' + i, 135, gy(i), 190, r[0] + '  ' + r[1] + ' ' + r[2] + '  ' + r[3] + ' 球'); });
      NAMES.forEach(function (n, j) {
        S.box('b' + j, { x: 430, y: by(j), w: 170, h: 42, rx: 8, fill: C.panel, stroke: C.line, sw: 1.5, opacity: 0 });
        S.text('bn' + j, { x: 362, y: by(j), text: n, anchor: 'start', size: 16, weight: 700, opacity: 0 });
        S.text('bv' + j, { x: 470, y: by(j), val: 0, pre: 'max ', size: 16, color: C.amber, weight: 700, opacity: 0 });
      });
      ST.forEach(function (r, k) { row(S, 's' + k, 720, sy(k), 200, r[0] + ' · ' + r[1] + ' · ' + r[2], { opacity: 0 }); });
      title(S, 'tR', 40, 447, '结果');
      S.box('tray', { x: 430, y: YR, w: 800, h: 62, rx: 10, fill: 'none', stroke: C.line, sw: 1.5, dash: '6 5' });
      S.data({ '当前步骤': '—', '结果行数': 0 });

      S.step('先算 best：games 有 10 行（一行 = 某人某季），目标是每人收拢成一行', function () {
        S.code([6, 8]); S.log('WITH best AS (… GROUP BY pid)');
        NAMES.forEach(function (n, j) { S.pop('b' + j, { delay: j * 90 }); S.to('bn' + j, { opacity: 1 }, { delay: j * 90 + 150, dur: 300 }); });
        S.data({ '当前步骤': 'GROUP BY pid' }, { delay: 300 });
      });
      S.step('GROUP BY pid：每一行把自己的进球数送进那个人的组', function () {
        S.code(8);
        G.forEach(function (r, i) {
          S.fly('g' + i, [430, by(r[4])], { label: String(r[3]), w: 34, h: 26, color: C.cyan, delay: i * 120, dur: 650 });
          S.pulse('b' + r[4], { delay: i * 120 + 650, scale: 1.06 });
        });
        S.data({ '已分组的行': 10 }, { delay: 1800 });
      });
      S.step('MAX(goals)：每组只留下最大的那个数', function () {
        S.code(7);
        NAMES.forEach(function (n, j) {
          S.to('bv' + j, { opacity: 1 }, { delay: j * 130, dur: 250 });
          S.count('bv' + j, MAX[j], { delay: j * 130 + 100, dur: 650 });
        });
        S.data({ best: 'Ann 5 · Bob 7 · Cat 6 · Dan 4 · Eve 0 · Fay 5', '已分组的行': null }, { delay: 1300 });
        S.log('best：6 行（每人一行）', { delay: 1300, kind: 'ok' });
      });
      S.step("zj：studied ⋈ schools，再过滤 prov = 'ZJ' —— 两条 GD 记录被筛掉", function () {
        S.code([1, 5]);
        ST.forEach(function (r, k) { S.pop('s' + k, { delay: k * 110 }); });
        [2, 4].forEach(function (k, n) {
          S.to('s' + k, { stroke: C.red }, { delay: 900 + n * 150, dur: 250 });
          S.to('s' + k, { opacity: .25 }, { delay: 1250 + n * 150, dur: 400 });
        });
        S.data({ '当前步骤': 'zj（没加 DISTINCT）', 'zj 行数': 4 }, { delay: 1300 });
      });
      S.step('连接：每条 ZJ 记录拿 pid 去 best 里取最大值 —— Ann 有两条，于是出现了两次', function () {
        S.code([11, 13]);
        [0, 1, 3, 5].forEach(function (k, n) {
          var j = ST[k][3];
          S.flash('s' + k, C.blue, { delay: n * 300 });
          S.fly([430, by(j)], [SL[n], YR], { id: 'r' + n, label: ST[k][0] + ' · ' + MAX[j], w: 190, h: 34, size: 15, color: C.cyan, keep: true, delay: n * 300 + 150, dur: 750 });
          settle(S, 'r' + n, n * 300 + 950);
        });
        S.flash('r0', C.amber, { delay: 2000 }); S.flash('r1', C.amber, { delay: 2000 });
        S.data({ '结果行数': 4 }, { delay: 1900 }); S.log('Ann 出现 2 次：连接把行"复制"了', { delay: 2000, kind: 'warn' });
      }, { hold: 1500 });
      S.step('假如就这样排序再 LIMIT 3：Cat、Ann、Ann —— Fay 被挤出去了', function () {
        S.code([14, 15]);
        S.move('r2', SL[0], YR, { dur: 750 }); S.move('r0', SL[1], YR, { delay: 100, dur: 750 }); S.move('r1', SL[2], YR, { delay: 200, dur: 750 });
        S.to('r3', { stroke: C.red, sw: 2.5 }, { delay: 1000, dur: 250 }); S.to('r3', { opacity: .3 }, { delay: 1300, dur: 400 });
        S.log('LIMIT 3 → Cat, Ann, Ann ✗', { delay: 1100, kind: 'err' });
        S.data({ '当前步骤': '不去重的错误结果' }, { delay: 900 });
      }, { hold: 1500 });
      S.step('加上 DISTINCT：zj 先收拢成"一人一行"，多出来的那个 Ann 消失', function () {
        S.code(2);
        S.move('s1', 720, sy(0), { dur: 600 }); S.to('s1', { opacity: 0 }, { delay: 450, dur: 300 }); S.pulse('s0', { delay: 600 });
        S.to('r1', { scale: .3, opacity: 0 }, { delay: 500, dur: 450, ease: 'in' });
        S.to('r3', { opacity: 1, stroke: C.line, sw: 1.2 }, { delay: 900, dur: 350 });
        S.move('r3', SL[2], YR, { delay: 1000, dur: 700 });
        S.data({ '当前步骤': 'zj 加 DISTINCT', 'zj 行数': 3, '结果行数': 3 }, { delay: 1100 });
      });
      S.step('ORDER BY best DESC, first：Ann 和 Fay 都是 5，次关键字 first 决定 Ann 在前', function () {
        S.code(14);
        S.flash('r0', C.amber); S.flash('r3', C.amber, { delay: 150 });
        S.pulse('r0', { delay: 600 }); S.flash('r0', C.green, { delay: 600 });
        S.log("比较 'Ann' < 'Fay' ✓", { delay: 700 });
      });
      S.step('LIMIT 3，按格式拼名字：first (given) last', function () {
        S.code([9, 10]);
        S.set('r2', { label: 'Cat (Catherine) Ma · 6', size: 14 }, { delay: 100 }); S.flash('r2', C.green, { delay: 100 });
        S.set('r0', { label: 'Ann (Anna Mae) Lee · 5', size: 14 }, { delay: 350 }); S.flash('r0', C.green, { delay: 350 });
        S.set('r3', { label: 'Fay (Fiona) He · 5', size: 14 }, { delay: 600 }); S.flash('r3', C.green, { delay: 600 });
        S.data({ '当前步骤': '完成' }, { delay: 800 }); S.log('输出 3 行 ✓', { delay: 900, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 2：HAVING 与 COUNT(DISTINCT) ───────────── */
  {
    name: 'HAVING 与 COUNT DISTINCT',
    moving: '连接出的 9 行把获奖人送进 (队, 年) 组；两种计数滚动；重复的名字滑到一起合并；不达标的组变暗；EXISTS 探测飞去 games 再带着答案飞回；幸存的组飞进结果并按队名换位',
    lang: 'SQL（DuckDB）',
    code: [
      'WITH many AS (',
      '  SELECT g.team, g.yr',
      '  FROM prizes pr JOIN games g',
      '    ON g.pid = pr.pid AND g.yr = pr.yr',
      '  GROUP BY g.team, g.yr',
      '  HAVING COUNT(DISTINCT pr.pid) >= 2)',
      'SELECT m.team, COUNT(DISTINCT m.yr)',
      'FROM many m',
      'WHERE EXISTS (',
      '  SELECT 1 FROM games g2',
      '  WHERE g2.team = m.team',
      '    AND g2.yr = m.yr AND g2.goals >= 5)',
      'GROUP BY m.team',
      'ORDER BY 2 DESC, m.team;'
    ].join('\n'),
    build: function (S) {
      var J = [['Ann', 'MVP', 0], ['Cat', 'Golden Boot', 0], ['Bob', 'Fair Play', 0], ['Bob', 'MVP', 1], ['Fay', 'Rookie', 1],
               ['Cat', 'Golden Boot', 1], ['Cat', 'Top Assist', 1], ['Ann', 'Fair Play', 2], ['Ann', 'Best XI', 2]];
      var GN = ['RED 2021', 'BLU 2022', 'RED 2022'], GY = [142, 266, 390], CNT = [3, 4, 2], DIS = [3, 3, 1], slot = [0, 0, 0], pos = [];
      function jy(i) { return 96 + i * 38; }
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      title(S, 'tJ', 30, 62, 'prizes ⋈ games（一行 = 一个奖）');
      title(S, 'tM', 380, 62, '按 (team, yr) 分组');
      J.forEach(function (r, i) {
        var yr = r[2] === 0 ? 'RED 2021' : r[2] === 1 ? 'BLU 2022' : 'RED 2022';
        row(S, 'j' + i, 150, jy(i), 250, r[0] + '  ' + r[1] + '  → ' + yr, { opacity: 0, size: 14 });
        pos.push(slot[r[2]]++);
      });
      GN.forEach(function (n, g) {
        S.box('G' + g, { x: 530, y: GY[g], w: 300, h: 104, rx: 10, fill: C.panel, stroke: C.line, sw: 2, opacity: 0 });
        S.text('Gn' + g, { x: 392, y: GY[g] - 34, text: n, anchor: 'start', size: 15, weight: 700, opacity: 0 });
        S.text('Gc' + g, { x: 392, y: GY[g] + 34, val: 0, pre: 'COUNT(*) = ', anchor: 'start', size: 15, color: C.amber, opacity: 0 });
        S.text('Gd' + g, { x: 560, y: GY[g] + 34, val: 0, pre: 'DISTINCT = ', anchor: 'start', size: 15, color: C.cyan, opacity: 0 });
        S.text('Gk' + g, { x: 668, y: GY[g] - 34, text: '✓', anchor: 'end', size: 18, color: C.green, weight: 800, opacity: 0 });
      });
      S.box('gm', { x: 780, y: 266, w: 104, h: 56, rx: 10, fill: C.panel, stroke: C.purple, sw: 2, label: 'games', size: 16 });
      S.text('gmT', { x: 780, y: 310, text: '进球 ≥ 5？', size: 14, color: C.mute });
      title(S, 'tR', 30, 470, '结果');
      S.box('tray', { x: 470, y: 505, w: 660, h: 54, rx: 10, fill: 'none', stroke: C.line, sw: 1.5, dash: '6 5' });
      S.data({ 'HAVING 门槛': 'DISTINCT ≥ 2' });

      S.step('prizes ⋈ games：按 (pid, yr) 连接，得到 9 行 —— 一行是一个奖，不是一个人', function () {
        S.code([2, 4]); S.log('prizes ⋈ games → 9 行');
        J.forEach(function (r, i) { S.pop('j' + i, { delay: i * 100 }); });
      });
      S.step('GROUP BY team, yr：每行把获奖人的名字送进自己那个 (队, 年) 组', function () {
        S.code(5);
        GN.forEach(function (n, g) { S.pop('G' + g, { delay: g * 120 }); S.to('Gn' + g, { opacity: 1 }, { delay: g * 120 + 150, dur: 300 }); });
        J.forEach(function (r, i) {
          S.fly('j' + i, [430 + pos[i] * 60, GY[r[2]] - 2], { id: 'c' + i, label: r[0], w: 54, h: 28, size: 14, color: C.cyan, keep: true, delay: 400 + i * 130, dur: 650 });
          settle(S, 'c' + i, 400 + i * 130 + 700);
        });
      });
      S.step('COUNT(*) 数的是行：RED 2022 只有 Ann 一个人，却数出 2', function () {
        S.code(6);
        GN.forEach(function (n, g) { S.to('Gc' + g, { opacity: 1 }, { delay: g * 150, dur: 250 }); S.count('Gc' + g, CNT[g], { delay: g * 150 + 100 }); });
        S.flash('Gc2', C.red, { prop: 'color', delay: 1000 }); S.pulse('c7', { delay: 1000 }); S.pulse('c8', { delay: 1000 });
        S.log('RED 2022：2 行，但都是 Ann', { delay: 1100, kind: 'warn' });
      });
      S.step('COUNT(DISTINCT pr.pid) 数的是人：重复的名字滑到一起合并', function () {
        S.code(6);
        S.move('c6', 430 + 2 * 60, GY[1] - 2, { dur: 650 }); S.to('c6', { opacity: 0 }, { delay: 550, dur: 300 }); S.pulse('c5', { delay: 650 });
        S.move('c8', 430, GY[2] - 2, { delay: 200, dur: 650 }); S.to('c8', { opacity: 0 }, { delay: 750, dur: 300 }); S.pulse('c7', { delay: 850 });
        GN.forEach(function (n, g) { S.to('Gd' + g, { opacity: 1 }, { delay: 900 + g * 150, dur: 250 }); S.count('Gd' + g, DIS[g], { delay: 1000 + g * 150 }); });
        S.data({ '每组人数': 'RED21: 3 · BLU22: 3 · RED22: 1' }, { delay: 1500 });
      });
      S.step('HAVING DISTINCT ≥ 2：RED 2022 被淘汰，另外两组留下', function () {
        S.code(6);
        S.to('G2', { stroke: C.red }, { dur: 300 }); S.to('G2', { opacity: .3 }, { delay: 500, dur: 500 });
        S.to('c7', { opacity: .3 }, { delay: 500, dur: 500 }); ['Gn2', 'Gc2', 'Gd2'].forEach(function (id) { S.to(id, { opacity: .3 }, { delay: 500, dur: 500 }); });
        S.to('G0', { stroke: C.green }, { delay: 300, dur: 300 }); S.to('G1', { stroke: C.green }, { delay: 400, dur: 300 });
        S.log('留下 RED 2021、BLU 2022', { delay: 900, kind: 'ok' });
      });
      S.step('对照：如果写成 COUNT(*) ≥ 2，RED 2022 会混进来（2 ≥ 2），最终 RED 多算一次', function () {
        S.to('G2', { opacity: 1, stroke: C.amber }, { dur: 400 }); ['Gn2', 'Gc2', 'c7'].forEach(function (id) { S.to(id, { opacity: 1 }, { dur: 400 }); });
        S.pulse('Gc2', { delay: 400, scale: 1.25 });
        S.log('COUNT(*) 版本：RED 2 次 ✗', { delay: 600, kind: 'err' });
        S.to('G2', { opacity: .3, stroke: C.red }, { delay: 1500, dur: 500 }); ['Gn2', 'Gc2', 'c7'].forEach(function (id) { S.to(id, { opacity: .3 }, { delay: 1500, dur: 500 }); });
      }, { hold: 1000 });
      S.step('EXISTS：去 games 里问一句"这支队这一年有人进 ≥ 5 球吗"——只要答案，不连接', function () {
        S.code([9, 12]);
        S.fly([680, GY[0]], 'gm', { color: C.purple, dur: 650 });
        S.fly('gm', [668, GY[0] - 34], { label: 'Cat 6', w: 64, h: 26, size: 14, color: C.green, delay: 750, dur: 650 });
        S.pop('Gk0', { delay: 1400 });
        S.fly([680, GY[1]], 'gm', { color: C.purple, delay: 900, dur: 600 });
        S.fly('gm', [668, GY[1] - 34], { label: 'Bob 7', w: 64, h: 26, size: 14, color: C.green, delay: 1600, dur: 650 });
        S.pop('Gk1', { delay: 2250 });
        S.log('两组都满足 → 事件 E 发生', { delay: 2300, kind: 'ok' });
      });
      S.step('外层 GROUP BY team：每支队数一数 E 发生过几年', function () {
        S.code(13);
        S.fly('G0', [340, 505], { id: 'o0', label: 'RED · 1 次', w: 200, h: 34, size: 15, color: C.cyan, keep: true, dur: 800 });
        S.fly('G1', [600, 505], { id: 'o1', label: 'BLU · 1 次', w: 200, h: 34, size: 15, color: C.cyan, keep: true, delay: 250, dur: 800 });
        settle(S, 'o0', 850); settle(S, 'o1', 1100);
      });
      S.step('ORDER BY 次数 DESC, team：都是 1 次 → 按队名，BLU 排到 RED 前面', function () {
        S.code(14);
        S.move('o1', 340, 505, { dur: 750 }); S.move('o0', 600, 505, { delay: 80, dur: 750 });
        S.flash('o1', C.green, { delay: 800 }); S.flash('o0', C.green, { delay: 950 });
        S.log('BLU 1 · RED 1 ✓', { delay: 1000, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 3：每组取第一 ───────────── */
  {
    name: '每组取第一：ROW_NUMBER',
    moving: '外层游标停在当前获奖者上；探测包飞到同队同年的名单；自己的名字变红消失；候选队友飞到右侧、按 (年, 名字) 滑动重排；编号徽章依次弹出；只有 1 号飞进结果表',
    lang: 'SQL（DuckDB）',
    code: [
      '-- 对每个获奖者 me：',
      'SELECT me, mate, yr FROM (',
      '  SELECT a.pid AS me, b.yr,',
      "    q.first||' ('||q.given||') '",
      '      ||q.last AS mate',
      '  FROM games a',
      '  JOIN games b ON b.team = a.team',
      '             AND b.yr = a.yr',
      '             AND b.pid <> a.pid',
      '  JOIN people q ON q.pid = b.pid',
      '  WHERE a.pid IN (SELECT pid FROM prizes)',
      ')',
      'QUALIFY ROW_NUMBER() OVER (',
      '  PARTITION BY me ORDER BY yr, mate) = 1',
      'ORDER BY me;'
    ].join('\n'),
    build: function (S) {
      var W = ['Ann', 'Bob', 'Cat', 'Fay'];
      var R = [['RED 2021', 300, 136, ['Ann', 'Bob', 'Cat']], ['RED 2022', 520, 136, ['Ann', 'Eve']],
               ['BLU 2021', 300, 252, ['Dan', 'Fay']], ['BLU 2022', 520, 252, ['Bob', 'Cat', 'Fay']]];
      var CY = [120, 168, 216], RY = [380, 424, 468, 512];
      var OUT = ['Ann (Anna Mae) Lee → Bob (Robert) Wu · 2021', 'Bob (Robert) Wu → Ann (Anna Mae) Lee · 2021',
                 'Cat (Catherine) Ma → Ann (Anna Mae) Lee · 2021', 'Fay (Fiona) He → Dan (Daniel) Xu · 2021'];
      function cx(r, c) { return R[r][1] - 66 + c * 64; }
      function wy(k) { return 124 + k * 52; }
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      title(S, 'tW', 30, 66, '外层：获奖者');
      title(S, 'tT', 190, 66, '同队同年的名单（games 自连接）');
      title(S, 'tC', 640, 66, '候选队友（me = Ann）');
      W.forEach(function (n, k) { row(S, 'w' + k, 84, wy(k), 92, n, { h: 36, size: 16 }); });
      S.box('cur', { x: 84, y: wy(0), w: 110, h: 48, rx: 10, fill: 'none', stroke: C.blue, sw: 3, opacity: 0 });
      R.forEach(function (r, i) {
        S.box('R' + i, { x: r[1], y: r[2], w: 210, h: 92, rx: 10, fill: C.panel, stroke: C.line, sw: 1.5, opacity: .55 });
        S.text('Rn' + i, { x: r[1] - 94, y: r[2] - 26, text: r[0], anchor: 'start', size: 15, color: C.mute });
        r[3].forEach(function (n, c) { S.box('m' + i + c, { x: cx(i, c), y: r[2] + 14, w: 58, h: 32, rx: 6, fill: ROW, stroke: 'none', sw: 0, label: n, size: 15, opacity: .55 }); });
      });
      title(S, 'tRes', 30, 342, '结果（ORDER BY me）');
      OUT.forEach(function (t, n) { row(S, 'o' + n, 450, RY[n], 620, t, { h: 34, opacity: 0 }); });
      S.data({ me: '—', '候选数': 0 });

      S.step('外层逐个取获奖者，先看 Ann', function () {
        S.code(11); S.log('me = Ann');
        S.pop('cur'); S.flash('w0', C.blue, { delay: 300 });
        S.data({ me: 'Ann' }, { delay: 300 });
      });
      S.step('自连接 games：和 Ann 同队同年的出场 —— RED 2021、RED 2022 两个名单', function () {
        S.code([6, 8]);
        S.fly('w0', 'R0', { color: C.blue, dur: 650 }); S.fly('w0', 'R1', { color: C.blue, delay: 200, dur: 700 });
        [0, 1].forEach(function (i) {
          S.to('R' + i, { opacity: 1, stroke: C.blue }, { delay: 650 + i * 200, dur: 350 });
          R[i][3].forEach(function (n, c) { S.to('m' + i + c, { opacity: 1 }, { delay: 700 + i * 200, dur: 300 }); });
        });
      });
      S.step('b.pid <> a.pid：把 Ann 自己排除 —— 自己不是自己的队友', function () {
        S.code(9);
        ['m00', 'm10'].forEach(function (id, n) { S.to(id, { fill: C.red }, { delay: n * 200, dur: 250 }); S.to(id, { scale: .3, opacity: 0 }, { delay: 500 + n * 200, dur: 400, ease: 'in' }); });
        S.log('排除 Ann 自己', { delay: 600 });
      });
      S.step('剩下的就是候选：(2021, Cat)、(2022, Eve)、(2021, Bob) —— 到达顺序是乱的', function () {
        S.code([3, 5]);
        S.fly('m02', [760, CY[0]], { id: 'k0', label: '2021 · Cat', w: 156, h: 34, size: 15, color: C.cyan, keep: true, dur: 700 });
        S.fly('m11', [760, CY[1]], { id: 'k1', label: '2022 · Eve(NULL)', w: 156, h: 34, size: 14, color: C.cyan, keep: true, delay: 250, dur: 700 });
        S.fly('m01', [760, CY[2]], { id: 'k2', label: '2021 · Bob', w: 156, h: 34, size: 15, color: C.cyan, keep: true, delay: 500, dur: 700 });
        settle(S, 'k0', 750); settle(S, 'k1', 1000); settle(S, 'k2', 1250);
        S.data({ '候选数': 3 }, { delay: 1250 });
      });
      S.step('ORDER BY yr, mate：先比年份，同一年再比名字 —— 候选滑到排好的位置', function () {
        S.code(14);
        S.move('k2', 760, CY[0], { dur: 750 }); S.move('k0', 760, CY[1], { delay: 100, dur: 750 }); S.move('k1', 760, CY[2], { delay: 200, dur: 750 });
        S.log('2021 < 2022；同为 2021 时 Bob < Cat', { delay: 900 });
      });
      S.step('ROW_NUMBER()：按排好的顺序编号 1、2、3', function () {
        S.code([13, 14]);
        ['1', '2', '3'].forEach(function (t, i) {
          S.dot('n' + i, { x: 655, y: CY[i], r: 15, fill: C.purple, label: t, color: C.bg, size: 15, opacity: 0 });
          S.pop('n' + i, { delay: i * 250 });
        });
        S.data({ rn: 'Bob=1, Cat=2, Eve=3' }, { delay: 700 });
      });
      S.step('QUALIFY rn = 1：只留 1 号 —— Ann 最早的队友是 Bob（2021）', function () {
        S.code(14);
        S.to('k2', { fill: C.green, color: C.bg }, { dur: 350 }); S.pulse('k2', { scale: 1.05 });
        ['k0', 'k1', 'n1', 'n2'].forEach(function (id) { S.to(id, { opacity: .25 }, { delay: 300, dur: 400 }); });
        S.fly('k2', [450, RY[0]], { label: 'Bob 2021', w: 96, h: 30, size: 14, color: C.green, delay: 600, dur: 800 });
        S.pop('o0', { delay: 1400 }); S.flash('o0', C.green, { delay: 1450 });
        S.log('Ann → Bob, 2021', { delay: 1450, kind: 'ok' });
      });
      S.step('PARTITION BY me：Bob、Cat、Fay 各自一组，同样排序取 1 号，互不干扰', function () {
        S.code(14);
        ['k0', 'k1', 'k2', 'n0', 'n1', 'n2'].forEach(function (id) { S.hide(id); });
        S.set('tC', { text: '候选队友' }, { delay: 300 });
        var M = [[1, 0, 'Ann 2021'], [2, 0, 'Ann 2021'], [3, 2, 'Dan 2021']];
        M.forEach(function (m, n) {
          var d = 300 + n * 600;
          S.move('cur', 84, wy(m[0]), { delay: d, dur: 400 });
          S.flash('R' + m[1], C.blue, { prop: 'stroke', delay: d + 300 });
          S.fly('R' + m[1], [450, RY[n + 1]], { label: m[2], w: 96, h: 30, size: 14, color: C.cyan, delay: d + 350, dur: 700 });
          S.pop('o' + (n + 1), { delay: d + 1050 });
        });
        S.data({ me: '每个获奖者各一组', '候选数': null, rn: null }, { delay: 300 });
      });
      S.step('ORDER BY me 输出 4 行；换成 LATERAL + ORDER BY … LIMIT 1 写法，结果完全一样', function () {
        S.code(15); S.hide('cur');
        [0, 1, 2, 3].forEach(function (n) { S.flash('o' + n, C.green, { delay: n * 180 }); });
        S.log('4 行 ✓（LATERAL 写法等价）', { delay: 800, kind: 'ok' });
      });
    }
  },

  /* ───────────── 场景 4：UPSERT ───────────── */
  {
    name: 'UPSERT：ON CONFLICT',
    moving: '被 SELECT 选中的行复制飞到「待插入」区、年份数字滚动；没冲突的行滑进表里、下面的行往下让位、表框变高；冲突的行撞上已有行后合并、粉丝数滚动；快照虚线框闪烁',
    lang: 'SQL（DuckDB）',
    code: [
      'INSERT INTO team_years',
      'SELECT yr + 1, team, fans',
      'FROM team_years',
      'WHERE yr = 2022',
      'ON CONFLICT (yr, team)',
      'DO UPDATE SET',
      '  fans = fans + EXCLUDED.fans;',
      '-- 检查：',
      'SELECT * FROM team_years',
      'ORDER BY yr, team;'
    ].join('\n'),
    build: function (S) {
      var TX = 250, RW = 380, Y = [170, 222, 274, 326];
      function tRow(id, y, yr, team, fans) {
        row(S, id, TX, y, RW, '', { h: 38 });
        S.text(id + 'y', { x: TX - 160, y: y, text: String(yr), anchor: 'start', size: 17 });
        S.text(id + 't', { x: TX - 40, y: y, text: team, anchor: 'start', size: 17, weight: 700 });
        S.text(id + 'f', { x: TX + 170, y: y, val: fans, anchor: 'end', size: 17, color: C.amber, weight: 700 });
      }
      S.text('note', { x: 20, y: 24, text: NOTE, anchor: 'start', size: 14, color: C.mute });
      title(S, 'tT', 60, 70, 'team_years　主键 (yr, team)');
      S.text('h1', { x: TX - 160, y: 120, text: 'yr', anchor: 'start', size: 15, color: C.mute });
      S.text('h2', { x: TX - 40, y: 120, text: 'team', anchor: 'start', size: 15, color: C.mute });
      S.text('h3', { x: TX + 170, y: 120, text: 'fans', anchor: 'end', size: 15, color: C.mute });
      S.box('frame', { x: TX, y: 222, w: 410, h: 166, rx: 12, fill: 'none', stroke: C.line, sw: 2 });
      tRow('a', Y[0], 2022, 'BLU', 90); tRow('b', Y[1], 2022, 'RED', 120); tRow('c', Y[2], 2023, 'RED', 150);
      S.box('snap', { x: TX, y: 196, w: 424, h: 108, rx: 12, fill: 'none', stroke: C.cyan, sw: 2, dash: '6 5', opacity: 0 });
      title(S, 'tP', 540, 70, 'SELECT 的结果（待插入）');
      S.text('py0', { x: 545, y: 170, val: 2022, anchor: 'start', size: 17, opacity: 0 });
      S.text('py1', { x: 545, y: 236, val: 2022, anchor: 'start', size: 17, opacity: 0 });
      S.text('ex', { x: 700, y: 290, text: 'EXCLUDED.fans = 120', size: 16, color: C.cyan, opacity: 0 });
      S.text('snapNote', { x: 250, y: 400, text: '', size: 15, color: C.cyan });
      title(S, 'tO', 560, 350, '检查查询的输出');
      S.box('tray', { x: 690, y: 452, w: 280, h: 140, rx: 10, fill: 'none', stroke: C.line, sw: 1.5, dash: '6 5' });
      var OUT = ['2022  BLU   90', '2022  RED  120', '2023  BLU   90', '2023  RED  270'];
      OUT.forEach(function (t, i) { S.text('out' + i, { x: 690, y: 402 + i * 33, text: t, size: 16, opacity: 0 }); });
      S.data({ '冲突': '—' });

      S.step('team_years 现有 3 行，主键是 (yr, team)', function () {
        S.code(1); S.log('3 行');
        ['a', 'b', 'c'].forEach(function (id, i) { S.pulse(id, { delay: i * 150, scale: 1.05 }); });
      });
      S.step('SELECT … WHERE yr = 2022：选中两行 —— 读的是这条语句开始那一刻的数据', function () {
        S.code([2, 4]);
        S.pop('snap'); S.flash('a', C.blue, { delay: 450 }); S.flash('b', C.blue, { delay: 600 });
        S.log('选中 2022 BLU、2022 RED', { delay: 700 });
      });
      S.step('yr + 1：两行被复制到右边的「待插入」区，年份滚到 2023', function () {
        S.code(2);
        S.fly('a', [710, 170], { id: 'p0', label: 'BLU   90', w: 180, h: 38, size: 17, color: C.cyan, keep: true, dur: 750 });
        S.fly('b', [710, 236], { id: 'p1', label: 'RED  120', w: 180, h: 38, size: 17, color: C.cyan, keep: true, delay: 200, dur: 750 });
        settle(S, 'p0', 800); settle(S, 'p1', 1000);
        S.to('py0', { opacity: 1 }, { delay: 800, dur: 250 }); S.to('py1', { opacity: 1 }, { delay: 1000, dur: 250 });
        S.count('py0', 2023, { delay: 1100, dur: 500 }); S.count('py1', 2023, { delay: 1250, dur: 500 });
      });
      S.step('插入 (2023, BLU)：表里没有这个键 → 表框变高，2023 RED 往下让位，新行滑进来', function () {
        S.code(1);
        S.to('frame', { y: 248, h: 218 }, { dur: 600 });
        ['c', 'cy', 'ct', 'cf'].forEach(function (id) { S.to(id, { y: Y[3] }, { dur: 600 }); });
        S.to('py0', { opacity: 0 }, { delay: 400, dur: 250 });
        S.to('p0', { x: TX, y: Y[2], w: RW, label: '' }, { delay: 500, dur: 800 });
        S.text('ny', { x: TX - 160, y: Y[2], text: '2023', anchor: 'start', size: 17, opacity: 0 });
        S.text('nt', { x: TX - 40, y: Y[2], text: 'BLU', anchor: 'start', size: 17, weight: 700, opacity: 0 });
        S.text('nf', { x: TX + 170, y: Y[2], val: 90, anchor: 'end', size: 17, color: C.amber, weight: 700, opacity: 0 });
        ['ny', 'nt', 'nf'].forEach(function (id) { S.to(id, { opacity: 1 }, { delay: 1250, dur: 250 }); });
        S.ripple(TX, Y[2], { delay: 1300, color: C.green }); S.flash('p0', C.green, { delay: 1300 });
        S.log('INSERT (2023, BLU, 90)', { delay: 1350, kind: 'ok' });
      });
      S.step('插入 (2023, RED)：主键撞上已有的那一行 → 冲突', function () {
        S.code(5);
        S.set('py1', { opacity: 0 }); S.set('p1', { label: '2023 RED 120', w: 190 });
        S.to('p1', { x: TX + 292, y: Y[3] }, { dur: 750, ease: 'in' });
        S.flash('c', C.red, { delay: 750 }); S.ripple(TX + 190, Y[3], { delay: 750, color: C.red });
        S.to('p1', { fill: C.red, color: C.ink }, { delay: 750, dur: 200 });
        S.data({ '冲突': '(2023, RED) 已存在' }, { delay: 800 }); S.log('冲突：(2023, RED)', { delay: 850, kind: 'warn' });
      });
      S.step('DO UPDATE：已有那行的 fans = 150 + EXCLUDED.fans（120）= 270', function () {
        S.code([6, 7]);
        S.pop('ex');
        S.to('p1', { x: TX + 120, opacity: 0 }, { delay: 500, dur: 600 });
        S.count('cf', 270, { delay: 900, dur: 700 }); S.pulse('cf', { delay: 1100 }); S.flash('c', C.green, { delay: 1100 });
        S.data({ '冲突': '已更新为 270' }, { delay: 1300 }); S.log('UPDATE (2023, RED) fans → 270', { delay: 1400, kind: 'ok' });
      });
      S.step('刚插入的 2023 行在虚线框（语句开始时的数据）之外，SELECT 不会再读到它 —— 不会无限复制', function () {
        S.code(3); S.hide('ex');
        S.flash('snap', C.amber, { prop: 'stroke' }); S.pulse('snap', { scale: 1.03 });
        S.set('snapNote', { text: 'SELECT 只读语句开始时的数据（虚线框）' }, { delay: 300 }); S.flash('p0', C.cyan, { delay: 500 });
        S.log('这就是万圣节问题被挡住的样子', { delay: 700 });
      }, { hold: 1600 });
      S.step('检查查询：SELECT * … ORDER BY yr, team —— 插入和更新都对了', function () {
        S.code([9, 10]); S.hide('snap'); S.hide('snapNote');
        ['a', 'b', 'p0', 'c'].forEach(function (id, i) {
          S.flash(id, C.green, { delay: i * 220 });
          S.fly(id, [690, 402 + i * 33], { color: C.green, delay: i * 220, dur: 600 });
          S.to('out' + i, { opacity: 1 }, { delay: i * 220 + 600, dur: 300 });
        });
        S.log('4 行 ✓', { delay: 1500, kind: 'ok' });
      });
    }
  }
  ]
});
})();
