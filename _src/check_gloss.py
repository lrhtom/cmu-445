#!/usr/bin/env python3
"""检查术语表（_src/glossary/*.json），不写任何页面：  python _src/check_gloss.py [--ctx 词]

- 格式、长度、别名重复、太容易误伤的词：有问题直接报错
- 哪些词在笔记正文里一次都没出现（白写了，或者写法和正文不一致）
- 正文里出现 ≥3 次、还没有词条的缩写和专有名词（候选，不一定都要收）
--ctx 词：打印这个词在正文里的几处上下文，用来判断会不会误伤
"""
import glob
import re
import sys
from collections import Counter

import build

SQL = set('''SELECT FROM WHERE GROUP BY ORDER JOIN LEFT RIGHT INNER OUTER ON AS AND OR NOT NULL COUNT SUM AVG MIN MAX DISTINCT HAVING LIMIT INSERT
UPDATE DELETE INTO VALUES SET CREATE TABLE INDEX DROP ALTER BEGIN COMMIT ABORT ROLLBACK READ WRITE IS IN LIKE EXISTS UNION ALL CAST DATE NOW CASE WHEN THEN
ELSE END TRUE FALSE PRIMARY KEY DO BETWEEN CROSS NOTHING EXPLAIN POSITION ID II III OK PDF RED CS HW CMU US AI IO DB ZJ KB MB GB TB'''.split())


def corpus():
    out = []
    for f in glob.glob(str(build.NOTES / '*.md')) + glob.glob(str(build.NOTES / 'hw' / '*.md')) + glob.glob(str(build.NOTES / 'lab' / '*.md')):
        s = open(f, encoding='utf-8').read()
        s = re.sub(r'```.*?```', '', s, flags=re.S)
        s = re.sub(r'\]\([^)\s]*\)', ']', s)        # 先去掉链接目标，再去掉裸网址（只吃 ASCII，网址后面常常紧贴中文）
        out.append(re.sub(r'https?://[!-~]+', '', s))
    return '\n'.join(out)


def hits(text, w):
    pat = re.escape(w)
    if re.match(r'[A-Za-z0-9_]', w[0]):
        pat = r'(?<![A-Za-z0-9_])' + pat
    if re.match(r'[A-Za-z0-9_]', w[-1]):
        pat += r'(?![A-Za-z0-9_])'
    return list(re.finditer(pat, text))


def main():
    text = corpus()
    if '--ctx' in sys.argv:
        w = sys.argv[sys.argv.index('--ctx') + 1]
        ms = hits(text, w)
        print('「%s」共 %d 处' % (w, len(ms)))
        for m in ms[:: max(1, len(ms) // 12)][:12]:
            print('  …' + text[max(0, m.start() - 22):m.end() + 22].replace('\n', ' ') + '…')
        return
    ids = {}
    for ch in build.CHAPTERS:
        for k in ch[4]:
            if k.startswith('HW') and not list(build.NOTES.glob('hw/%s-*.md' % k)):
                continue
            l = build.Lec(k, ch[0])
            ids[l.id] = l
    items = build.load_gloss(ids, strict=True)        # 格式问题在这里 sys.exit
    words = [w for e in items for w in [e['t']] + e.get('a', [])]
    zero = [w for w in words if not hits(text, w)]
    ab = Counter(re.findall(r'(?<![A-Za-z0-9_])[A-Z0-9][A-Z0-9+\-]*[A-Z][A-Z0-9+\-]*(?![A-Za-z0-9_])', text))
    cam = Counter(re.findall(r'(?<![A-Za-z0-9_])[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+(?![A-Za-z0-9_])', text))
    have = set(words)
    todo = [(k, v) for k, v in (ab + cam).most_common() if v >= 3 and k not in have and k not in SQL]
    print('词条 %d 条，匹配词 %d 个' % (len(items), len(words)))
    print('正文里没出现的词（%d）：%s' % (len(zero), '、'.join(zero[:80])))
    print('还没收的候选（%d）：%s' % (len(todo), ' '.join('%s:%d' % x for x in todo[:120])))


if __name__ == '__main__':
    main()
