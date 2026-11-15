#!/usr/bin/env python3
"""只读比对：你的复原目录 vs 原项目（BusTub Fall 2025，d49b823f82）。不修改任何文件。

用法：
    python check_restore.py <你的复原目录>                 比对全部 Project 的复原范围
    python check_restore.py <你的复原目录> P1              只比对 P1
    python check_restore.py <你的复原目录> P1 --orig <原项目目录>   原项目不在默认位置时指定

每个文件给出一种状态：
    一致                 逐字节相同
    仅行尾或空行不同     去掉 \\r、行尾空白、空行后相同（Windows 编辑器常见）
    内容不同             列出前 10 处不同的行号（以原项目行号为准）
    缺失                 复原目录里没有这个文件
    多余                 复原范围所在的目录里，复原目录有、原项目没有的文件（只看 .h / .cpp）
复原范围（每个 Project 要你重敲的文件）写在同目录的 scope.json 里。
标了「含你的实现」的文件：等你开始写 TODO 里的实现以后，和骨架不同是正常的。
"""
import difflib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def norm(text):
    return [l.rstrip() for l in text.replace('\r\n', '\n').replace('\r', '\n').split('\n') if l.strip()]


def diff_lines(a, b):
    """返回原项目里不同的行号（1 起）"""
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag != 'equal':
            out.extend(range(i1 + 1, max(i2, i1 + 1) + 1))
    return out


def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    mine = Path(args[0]).resolve()
    orig = (HERE / '..' / '..' / 'lab-original' / 'bustub').resolve()
    if '--orig' in args:
        orig = Path(args[args.index('--orig') + 1]).resolve()
    want = [a for a in args[1:] if a.upper().startswith('P') and len(a) == 2]
    scope = json.loads((HERE / 'scope.json').read_text(encoding='utf-8'))
    if not mine.is_dir():
        print('复原目录不存在：%s' % mine)
        return 2
    if not orig.is_dir():
        print('原项目不存在：%s（用 --orig 指定）' % orig)
        return 2
    print('原项目：%s' % orig)
    print('复原目录：%s' % mine)
    total = {'一致': 0, '仅行尾或空行不同': 0, '内容不同': 0, '缺失': 0, '多余': 0}
    for pid, files in scope['projects'].items():
        if want and pid.upper() not in [w.upper() for w in want]:
            continue
        print('\n── %s ──' % pid)
        dirs = set()
        for f in files:
            rel, kind = f['path'], f.get('kind')
            dirs.add(str(Path(rel).parent))
            a, b = orig / rel, mine / rel
            tag = '（含你的实现）' if kind == 'todo' else ''
            if not b.is_file():
                st, more = '缺失', ''
            else:
                ta, tb = a.read_bytes(), b.read_bytes()
                if ta == tb:
                    st, more = '一致', ''
                else:
                    sa, sb = ta.decode('utf-8', 'replace'), tb.decode('utf-8', 'replace')
                    if norm(sa) == norm(sb):
                        st, more = '仅行尾或空行不同', ''
                    else:
                        la = sa.replace('\r\n', '\n').split('\n')
                        lb = sb.replace('\r\n', '\n').split('\n')
                        d = diff_lines(la, lb)
                        st = '内容不同'
                        more = '：第 ' + ', '.join(str(x) for x in d[:10]) + (' …' if len(d) > 10 else '') + ' 行'
            total[st] += 1
            print('  %-10s %s%s%s' % (st, rel, more, tag if st == '内容不同' else ''))
        for d in sorted(dirs):
            if not (mine / d).is_dir():
                continue
            for p in sorted((mine / d).iterdir()):
                if p.suffix in ('.h', '.cpp') and not (orig / d / p.name).exists():
                    total['多余'] += 1
                    print('  %-10s %s' % ('多余', (Path(d) / p.name).as_posix()))
    print('\n合计：' + '，'.join('%s %d' % (k, v) for k, v in total.items()))
    return 0 if total['内容不同'] == total['缺失'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
