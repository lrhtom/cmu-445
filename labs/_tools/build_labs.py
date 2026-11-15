#!/usr/bin/env python3
"""BusTub Lab 复原笔记的构建脚本：把 _content/P*.json（手改的内容）和原项目源码合并成 assets/data.js，并校验步骤链。

用法：  python _tools/build_labs.py            构建全部 Project，写 assets/data.js 和 scope.json
        python _tools/build_labs.py P1         只构建 / 校验 P1，输出到 _preview/P1/（自带一份页面，可直接打开），
                                               不碰正式的 data.js——多人并行写不同 Project 时互不干扰

原项目：../../lab-original/bustub（Fall 2025，提交 d49b823f82），只读。
笔记里出现的每一行源码都由本脚本按「文件 + 行号」从原项目逐字取出，内容文件里不写源码。

─── _content/<Pn>.json 的格式 ─────────────────────────────────────────────
{
  "id": "P1", "name": "缓冲池管理器", "en": "Buffer Pool Manager",
  "summary": "一句话", "features": ["主要功能…"], "writeup": "官方说明链接", "guide": "../lab.html#P1",
  "lectures": [["#04", "../ch02-storage.html#L04"]],
  "scope": [ { "path": "src/buffer/arc_replacer.cpp", "role": "这个文件干什么", "kind": "todo|skeleton|readonly" } ],
           kind：todo = 里面有要你实现的空壳；skeleton = 骨架里已经写好的代码；readonly = 只需读懂、官方要求不改
  "tests": [ { "path": "test/buffer/arc_replacer_test.cpp", "target": "arc_replacer_test", "what": "测什么", "cmd": "可选：不是 gtest 时写完整命令" } ],
  "prereq": [ { "id": "唯一", "name": "名字", "kind": "C++|STL|并发|数据库", "level": 1-3, "desc": "说明",
                "where": [["src/...", 起行, 止行], …], "q": "自测题", "a": "答案" } ],
  "checklist": { "<阶段id>": ["开工前最少要会…", …] },
  "phases": [ { "id": "A", "name": "阶段 1 · …", "goal": ["…"], "principle": ["段落…"],
                "verify": [ { "cmd": "命令", "run": "runs/xxx.log 或 null", "expect": "说明" } ],
                "pitfalls": [ { "t": "易错点", "err": "报错长什么样", "why": "原因" } ],
                "quiz": [ { "q": "…", "a": "…" } ] } ],
  "steps": [ { "id": "P1-07", "phase": "A", "kind": "info|new|cont|todo|verify", "title": "…",
               "file": "src/…", "from": 1, "to": 38,            ← info / verify 步骤可以没有代码
               "what": "做什么", "why": "为什么这么写",
               "notes": { "13": "逐行注释", "15-18": "一段注释" },   ← 只在页面上显示，复制出去的代码不带
               "early": "提前引入、后面才用到的东西（编辑器可能自动删掉），第 N 步再补回",
               "build": "此刻能不能编译 / 运行",
               "think": { "q": "敲完前想一想", "a": "答案" },
               "impl": { "goal": "这个空壳要做到什么", "hints": ["…"], "pseudo": ["伪代码行…"], "tests": ["…"] },  ← kind=todo 时
               "cmd": "info / verify 步骤要执行的命令", "run": "runs/xxx.log", "hl": ["舞台上要高亮的节点 id"],
               "trace": "这一步对应的逐行演示 id（可选）",
               "points": ["`L37` 读代码要点，用 L+行号指这一步里的行（2–5 条，代码 ≥8 行时建议写）"],
               "runNote": "这一步有「▶ 跑」片段时的导读：执行从哪进来、盯住什么（可选，不写就用自动生成的一句）" } ],
  phases[].intro / phases[].concepts：第 3 页「核心原理 · 翻页图解」，格式见 assets/concept-core.js 头部。
  phases[].level / phases[].concepts[].level：[难度 1–5, 重要程度 3 必会 / 2 重要 / 1 了解, "一句话理由"]。
  "stage": { "nodes": [ { "id": "arc", "label": "ArcReplacer", "sub": "arc_replacer.h", "kind": "core|feat|ext|test", "file": "src/…" } ],
             "class": { "pos": { "arc": [x, y] }, "edges": [["bpm", "arc", "持有"]], "members": { "arc": ["mru_ : list<frame_id_t>", …] } },
             "call":  { "nodes": [ { "id": "f1", "label": "Fn()", "file": "src/…", "line": 12, "owner": "arc" } ], "edges": [["f1", "f2"]] },
             "apis":  [ { "id": "fetch", "name": "ReadPage(page_id)", "hops": [ ["bpm", "arc", "说明这一跳", "可选：连线上的短标签"] ] } ],
             "traces": [ { "id": "t1", "title": "…", "steps": [ { "file": "src/…", "line": 28, "note": "这一行干了什么",
                         "frames": [ { "id": "fr1", "fn": "main", "vars": [["名", "值"], ["指针", "", "o1"]] } ],
                         "objs":   [ { "id": "o1", "title": "对象", "col": 1, "rows": [["字段", "值", "可选：指向的对象 id"]] } ],   ← col 可选：1 / 2 指定放第几列数据区
                         "out": ["累计的终端输出"], "chg": ["这一步的变化"], "real": true } ] } ] }
}
"""
import json, re, sys, hashlib, datetime
from pathlib import Path

LABS = Path(__file__).resolve().parent.parent
CONTENT = LABS / '_content'
ORIG = (LABS / '..' / '..' / 'lab-original' / 'bustub').resolve()
COMMIT = 'd49b823f829a4bf311a2c80b239ab5a9864c9c41'
MAX_LINES = 40          # 每步代码上限（要求：不超过约 40 行）
HARD_MAX = 45
KINDS = {'info', 'new', 'cont', 'todo', 'verify'}

errors, warnings = [], []


def err(p, msg):
    errors.append('%s: %s' % (p, msg))


def warn(p, msg):
    warnings.append('%s: %s' % (p, msg))


def read_src(rel):
    f = ORIG / rel
    if not f.is_file():
        return None
    # 按 \n 切，保留原样（包括行尾空格）；文件末尾的换行不算一行
    text = f.read_bytes().decode('utf-8')
    lines = text.split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    return lines


def parse_range(key):
    m = re.fullmatch(r'(\d+)(?:-(\d+))?', key.strip())
    if not m:
        return None
    a = int(m.group(1))
    return a, int(m.group(2) or a)


def build_project(pj, files_cache):
    pid = pj['id']
    scope = {s['path']: s for s in pj.get('scope', [])}
    for s in pj.get('scope', []):
        if s['path'] not in files_cache:
            src = read_src(s['path'])
            if src is None:
                err(pid, '复原范围里的文件在原项目中不存在：' + s['path'])
                continue
            files_cache[s['path']] = src
    phases = [ph['id'] for ph in pj.get('phases', [])]
    if not phases:
        err(pid, '没有阶段')
    seen_ids, covered = set(), {p: [0] * len(files_cache.get(p, [])) for p in scope}
    last_end = {}
    order = {ph: i for i, ph in enumerate(phases)}
    prev_phase = -1
    for st in pj.get('steps', []):
        sid = st.get('id', '?')
        if sid in seen_ids:
            err(pid, '步骤 id 重复：' + sid)
        seen_ids.add(sid)
        if st.get('phase') not in order:
            err(sid, '所属阶段不存在：%s' % st.get('phase'))
            continue
        if order[st['phase']] < prev_phase:
            err(sid, '步骤顺序跨回了更早的阶段')
        prev_phase = order[st['phase']]
        if st.get('kind') not in KINDS:
            err(sid, '未知 kind：%s' % st.get('kind'))
        for k in ('title', 'what'):
            if not st.get(k):
                err(sid, '缺少 ' + k)
        if st.get('kind') in ('new', 'cont', 'todo'):
            f = st.get('file')
            if f not in scope:
                err(sid, '文件不在复原范围里：%s' % f)
                continue
            src = files_cache.get(f)
            if src is None:
                continue
            a, b = st.get('from'), st.get('to')
            if not (isinstance(a, int) and isinstance(b, int) and 1 <= a <= b <= len(src)):
                err(sid, '行号越界：%s-%s（文件共 %d 行）' % (a, b, len(src)))
                continue
            n = b - a + 1
            if n > HARD_MAX:
                err(sid, '这一步有 %d 行，超过 %d 行，要拆开' % (n, HARD_MAX))
            elif n > MAX_LINES:
                warn(sid, '这一步有 %d 行，略超 %d 行' % (n, MAX_LINES))
            for i in range(a, b + 1):
                if covered[f][i - 1]:
                    err(sid, '%s 第 %d 行已经属于别的步骤' % (f, i))
                covered[f][i - 1] = 1
            exp = last_end.get(f, 0) + 1
            if a != exp:
                err(sid, '%s 应该从第 %d 行接着写，这一步却从第 %d 行开始' % (f, exp, a))
            if st['kind'] == 'new' and f in last_end:
                err(sid, '文件已经新建过，这一步应标为 cont')
            if st['kind'] == 'cont' and f not in last_end:
                err(sid, '文件还没新建，这一步应标为 new')
            last_end[f] = b
            for key in (st.get('notes') or {}):
                r = parse_range(key)
                if not r or r[0] < a or r[1] > b:
                    err(sid, '逐行注释的行号 %s 不在这一步的 %d-%d 行里' % (key, a, b))
            if st['kind'] == 'todo' and not st.get('impl'):
                err(sid, 'kind=todo 的步骤要写 impl（你的实现要做到什么）')
            if not st.get('think'):
                err(sid, '缺少「敲完前想一想」')
            if not st.get('build'):
                err(sid, '缺少「此刻能不能编译 / 运行」')
        for r in [st.get('run')] + [v.get('run') for v in []]:
            if r and not (CONTENT / r).is_file():
                err(sid, '引用的实测输出不存在：' + r)
    # 全覆盖
    for f, cov in covered.items():
        miss = [i + 1 for i, c in enumerate(cov) if not c]
        if miss:
            spans, s0 = [], miss[0]
            for x, y in zip(miss, miss[1:] + [None]):
                if y != x + 1:
                    spans.append('%d' % s0 if s0 == x else '%d-%d' % (s0, x))
                    s0 = y
            err(pid, '%s 有 %d 行没有被任何步骤覆盖：%s' % (f, len(miss), ', '.join(spans[:8]) + (' …' if len(spans) > 8 else '')))
    # 每个阶段最后一步是验证
    for ph in phases:
        sts = [s for s in pj.get('steps', []) if s.get('phase') == ph]
        if not sts:
            err(pid, '阶段 %s 没有步骤' % ph)
        elif sts[-1].get('kind') != 'verify':
            err(pid, '阶段 %s 的最后一步不是验证步骤' % ph)
    for st in pj.get('steps', []):
        for pt in st.get('points') or []:
            for m in re.finditer(r'L(\d+)(?:[–-](\d+))?', pt):
                a2, b2 = int(m.group(1)), int(m.group(2) or m.group(1))
                if not st.get('file') or a2 < st.get('from', 0) or b2 > st.get('to', 0):
                    err(st.get('id'), '读代码要点里的 L%s 不在这一步的第 %s–%s 行里' % (m.group(0)[1:], st.get('from'), st.get('to')))
        if st.get('runNote') and st.get('kind') in ('new', 'cont', 'todo'):
            if not any(x.get('file') == st['file'] and st['from'] <= x.get('line', 0) <= st['to'] for t in pj.get('stage', {}).get('traces', []) for x in t.get('steps', [])):
                warn(st.get('id'), '写了 runNote 导读，但没有任何逐行演示执行到这一步的行，「▶ 跑」不会出现')
    def lv(o, where):
        v = o.get('level')
        if v is None:
            err(pj['id'], where + ' 还没有 level（难度 / 重要程度）')
        elif not isinstance(v, list) or len(v) != 3 or v[0] not in (1, 2, 3, 4, 5) or v[1] not in (1, 2, 3) or not str(v[2]).strip() or len(v[2]) > 40:
            err(pj['id'], where + ' 的 level 要写成 [难度 1–5, 重要程度 1–3, "理由（≤40 字）"]，现在是 %r' % (v,))
    for ph in pj.get('phases', []):
        lv(ph, '阶段 ' + ph['id'])
        for ci, c in enumerate(ph.get('concepts') or []):
            w = '阶段 %s 第 %d 节' % (ph['id'], ci + 1)
            lv(c, w)
            if not c.get('t'):
                err(pj['id'], w + ' 缺少节标题 t')
            pages = c.get('pages') or []
            if len(pages) < 2:
                err(pj['id'], w + ' 至少要 2 页')
            files = c.get('files') or {}
            for alias, path in files.items():
                src = files_cache.get(path) or read_src(path)
                if src is None:
                    err(pj['id'], w + ' 的源码文件不存在：' + path)
                else:
                    files_cache[path] = src
            for pi, pg in enumerate(pages):
                ww = w + ' 第 %d 页' % (pi + 1)
                if not pg.get('h') or len(pg['h']) > 20:
                    err(pj['id'], ww + ' 的页标题要有，且不超过 20 个字（现在 %d）' % len(pg.get('h') or ''))
                if not pg.get('say') or len(pg['say']) > 320:
                    err(pj['id'], ww + ' 的讲解要有，且不超过 320 字（现在 %d）' % len(pg.get('say') or ''))
                at = pg.get('at')
                if files and pi == 0 and not at:
                    err(pj['id'], ww + '：有源码的节，第 1 页必须写 at')
                if at:
                    m = re.fullmatch(r'(\w+):([\d,\-–\s]+)', at.strip())
                    if not files or not m or m.group(1) not in files:
                        err(pj['id'], ww + ' 的 at「%s」无效（别名要在 files 里）' % at)
                        continue
                    src = files_cache.get(files[m.group(1)]) or []
                    total = 0
                    for part in m.group(2).split(','):
                        ab = re.split(r'[-–]', part.strip())
                        a3, b3 = int(ab[0]), int(ab[-1])
                        total += b3 - a3 + 1
                        if not (1 <= a3 <= b3 <= len(src)):
                            err(pj['id'], ww + ' 的 at「%s」行号越界（文件共 %d 行）' % (at, len(src)))
                    if total > 27:
                        err(pj['id'], ww + ' 的 at 一共 %d 行，超过 27 行（源码栏一屏放不下）' % total)
    for ph in pj.get('phases', []):
        for v in ph.get('verify', []):
            if v.get('run') and not (CONTENT / v['run']).is_file():
                err(pid, '阶段 %s 引用的实测输出不存在：%s' % (ph['id'], v['run']))
        if not ph.get('quiz'):
            err(pid, '阶段 %s 没有自测题' % ph['id'])
    for p in pj.get('prereq', []):
        for w in p.get('where', []):
            src = files_cache.get(w[0]) or read_src(w[0])
            if src is None or not (1 <= w[1] <= w[2] <= len(src)):
                err(pid, '前置知识「%s」的出处 %s:%s-%s 无效' % (p.get('name'), w[0], w[1], w[2]))
            elif w[0] not in files_cache:
                files_cache[w[0]] = src
    # 舞台
    stg = pj.get('stage', {})
    ids = {n['id'] for n in stg.get('nodes', [])}
    for st in pj.get('steps', []):
        for h in st.get('hl', []):
            if h not in ids:
                err(st.get('id'), '高亮的节点不存在：' + h)
    for e in stg.get('class', {}).get('edges', []):
        if e[0] not in ids or e[1] not in ids:
            err(pid, '类图的边引用了不存在的节点：%s' % e)
    for a in stg.get('apis', []):
        for hop in a.get('hops', []):
            if hop[0] not in ids or hop[1] not in ids:
                err(pid, 'API「%s」引用了不存在的节点：%s' % (a.get('name'), hop[:2]))
    cids = {n['id'] for n in stg.get('call', {}).get('nodes', [])}
    for n in stg.get('call', {}).get('nodes', []):
        src = files_cache.get(n.get('file')) or (read_src(n['file']) if n.get('file') else None)
        if n.get('file') and (src is None or not (1 <= n.get('line', 0) <= len(src))):
            err(pid, '调用图节点 %s 的位置无效' % n['id'])
        elif n.get('file') and n['file'] not in files_cache:
            files_cache[n['file']] = src
    for e in stg.get('call', {}).get('edges', []):
        if e[0] not in cids or e[1] not in cids:
            err(pid, '调用图的边引用了不存在的节点：%s' % e)
    tids = set()
    for t in stg.get('traces', []):
        tids.add(t['id'])
        for i, s in enumerate(t.get('steps', [])):
            src = files_cache.get(s.get('file')) or read_src(s.get('file', ''))
            if src is None or not (1 <= s.get('line', 0) <= len(src)):
                err(pid, '演示 %s 第 %d 步的 %s:%s 无效' % (t['id'], i + 1, s.get('file'), s.get('line')))
            elif s['file'] not in files_cache:
                files_cache[s['file']] = src
            if not s.get('note'):
                err(pid, '演示 %s 第 %d 步缺少说明' % (t['id'], i + 1))
    for st in pj.get('steps', []):
        if st.get('trace') and st['trace'] not in tids:
            err(st.get('id'), '引用的演示不存在：' + st['trace'])
    # 附上实测输出
    runs = {}
    for r in [st.get('run') for st in pj.get('steps', [])] + [v.get('run') for ph in pj.get('phases', []) for v in ph.get('verify', [])]:
        if r and (CONTENT / r).is_file():
            runs[r] = (CONTENT / r).read_text(encoding='utf-8', errors='replace')
    pj['_runs'] = runs
    total = sum(len(files_cache.get(p, [])) for p in scope)
    code_steps = [s for s in pj.get('steps', []) if s.get('kind') in ('new', 'cont', 'todo')]
    return {'phases': len(phases), 'steps': len(pj.get('steps', [])), 'code_steps': len(code_steps), 'files': len(scope), 'lines': total,
            'traces': len(stg.get('traces', [])), 'trace_steps': sum(len(t.get('steps', [])) for t in stg.get('traces', []))}


def main():
    only = [a for a in sys.argv[1:] if re.fullmatch(r'P\d', a)]
    if not ORIG.is_dir():
        sys.exit('找不到原项目：%s' % ORIG)
    projects, files_cache, report = [], {}, []
    for f in sorted(CONTENT.glob('P*.json')):
        if only and f.stem not in only:
            continue
        try:
            pj = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            sys.exit('%s 不是合法 JSON：%s' % (f.name, e))
        before = len(errors)
        stats = build_project(pj, files_cache)
        report.append((pj['id'], stats, len(errors) - before))
        projects.append(pj)
    with_c = [CONTENT / (pj['id'] + '.json') for pj in projects if any(ph.get('concepts') for ph in pj.get('phases', []))]
    if with_c:
        import subprocess
        r = subprocess.run(['node', str(LABS / '_tools' / 'concept_audit.js')] + [str(x) for x in with_c], capture_output=True, text=True, encoding='utf-8')
        lines = [l for l in r.stdout.splitlines() if l.strip()]
        for l in lines[:-1]:
            errors.append('图解排版：' + l)
        if lines:
            print(lines[-1])
        if r.returncode not in (0, 1):
            errors.append('图解排版校验没跑起来：' + r.stderr.strip()[:300])
    env = json.loads((CONTENT / 'env.json').read_text(encoding='utf-8')) if (CONTENT / 'env.json').is_file() else {}
    data = {'commit': COMMIT, 'repo': 'https://github.com/cmu-db/bustub', 'built': datetime.date.today().isoformat(),
            'env': env, 'files': files_cache, 'projects': projects}
    js = '/* 由 _tools/build_labs.py 生成，不要手改；要改内容去改 _content/*.json */\nwindow.LAB = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    dest = LABS
    if only:
        import shutil
        dest = LABS / '_preview' / '-'.join(only)
        (dest / 'assets').mkdir(parents=True, exist_ok=True)
        shutil.copy(LABS / 'index.html', dest / 'index.html')
        for a in ('app.js', 'stage.js', 'app.css', 'concept-core.js', 'phase-ui.js', 'gloss.js'):
            shutil.copy(LABS / 'assets' / a, dest / 'assets' / a)
    (dest / 'assets').mkdir(exist_ok=True)
    (dest / 'assets' / 'data.js').write_text(js, encoding='utf-8', newline='\n')
    scope = {pj['id']: [{'path': s['path'], 'kind': s.get('kind', 'skeleton')} for s in pj.get('scope', [])] for pj in projects}
    if not only:
        (LABS / 'scope.json').write_text(json.dumps({'commit': COMMIT, 'projects': scope}, ensure_ascii=False, indent=1), encoding='utf-8', newline='\n')

    print('原项目：%s @ %s' % (ORIG, COMMIT[:10]))
    print('%-4s %4s %5s %8s %5s %7s %10s  %s' % ('', '阶段', '步骤', '含代码步', '文件', '源码行', '逐行演示步', '校验'))
    for pid, s, ne in report:
        print('%-4s %4d %5d %8d %5d %7d %6d / %-3d %s' % (pid, s['phases'], s['steps'], s['code_steps'], s['files'], s['lines'], s['trace_steps'], s['traces'],
                                                        '全覆盖 ✓' if not ne else '✗ %d 处问题' % ne))
    print('输出：%s（data.js %d KB）' % (dest / 'index.html', (dest / 'assets' / 'data.js').stat().st_size // 1024))
    for w in warnings:
        print('  ⚠ ' + w)
    for e in errors:
        print('  ✗ ' + e)
    print('校验通过' if not errors else '校验未通过：%d 处错误' % len(errors))
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
