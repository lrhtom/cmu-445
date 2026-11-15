#!/usr/bin/env python3
"""检查每一节的难度 / 重要程度（_src/levels/<讲>.json），不写任何页面：  python _src/check_levels.py [讲 …]

不给参数就查全部。标题对不上、格式不对、缺节都会报错；最后打印每讲的分布，用来校准评级。
格式：{ "节标题": [难度 1–5, 重要程度 3 必会 / 2 重要 / 1 了解, "一句话理由"] }
「自测」「这一课在整门课里的位置」「交卷前自查」这类节不评级，不用写。
"""
import sys
from collections import Counter

import build

only = sys.argv[1:]
bad, total = 0, Counter()
print('%-5s %4s  %-22s %-16s %s' % ('讲', '节数', '难度 1/2/3/4/5', '必会/重要/了解', '平均难度'))
for ch in build.CHAPTERS:
    for k in ch[4]:
        if (only and k not in only) or (k.startswith('HW') and not list(build.NOTES.glob('hw/%s-*.md' % k))):
            continue
        l = build.Lec(k, ch[0])
        if not (build.SRC / 'levels' / (k + '.json')).exists():
            print('%-5s 还没有 levels/%s.json' % (k, k)); bad += 1
            continue
        try:
            l.add_levels()
        except SystemExit as e:
            print('✗ %s' % e); bad += 1
            continue
        rated = [v for v in l.levels.values() if v[0]]
        d, i = Counter(v[0] for v in rated), Counter(v[1] for v in rated)
        long = [v[2] for v in rated if len(v[2]) > 32]
        print('%-5s %4d  %-22s %-16s %.1f' % (k, len(rated), '/'.join(str(d[x]) for x in (1, 2, 3, 4, 5)), '/'.join(str(i[x]) for x in (3, 2, 1)), sum(v[0] for v in rated) / max(1, len(rated))))
        for s in long:
            print('    理由太长（>32 字）：' + s); bad += 1
        total.update({'节': len(rated)}); total.update({'d%d' % x: d[x] for x in d}); total.update({'i%d' % x: i[x] for x in i})
print('合计 %d 节；难度 %s；必会 %d / 重要 %d / 了解 %d' % (total['节'], '/'.join(str(total['d%d' % x]) for x in (1, 2, 3, 4, 5)), total['i3'], total['i2'], total['i1']))
print('通过' if not bad else '有 %d 处问题' % bad)
sys.exit(1 if bad else 0)
