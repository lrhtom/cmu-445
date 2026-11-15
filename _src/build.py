#!/usr/bin/env python3
"""把上一级目录里的 Markdown 笔记构建成自包含的 HTML（每章一个页面，CSS/JS 全部内联，双击即可打开）。

用法：  python _src/build.py                          全量构建到 html/
        python _src/build.py --only 03,05 --out _preview/x   只带上这几讲的图表/可视化，输出到别的目录（多人并行时互不干扰）

输入：  ../NN-*.md、../lab/Pn-*.md、../README.md      —— 笔记正文，原样转换，不改内容
        _src/extras/<讲次>.json                        —— 往某个小节后面插入图表 / 可视化
        _src/viz/*.js                                  —— 可视化场景（Viz.register）
输出：  index.html、ch01-…html … ch09-…html、lab.html

extras/<讲次>.json 的格式（一个数组，讲次如 08、P1）：
  [ { "after": "7. 插入与分裂", "kind": "viz",  "id": "bptree" },
    { "after": "3. 结构与不变式", "kind": "flow", "title": "图题", "spec": { … }, "pos": "end" } ]
  after = 小节标题里的一段文字（匹配第一个包含它的标题）；pos 默认 "start"（紧跟标题），"end" = 该小节末尾
  kind  = viz | flow | seq | layers（后三种的 spec 见 dg.js 头部注释）
"""
import hashlib, html, json, os, re, subprocess, sys
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote, unquote
from markdown_it import MarkdownIt
from markdown_it.common.utils import isMdAsciiPunct, isPunctChar
from markdown_it.rules_inline.state_inline import Scanned, StateInline
from markdown_it.token import Token

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
NOTES = OUT.parent
README = (NOTES / 'README.md').resolve()

CHAPTERS = [
    ('ch01-foundations', '第 1 章', '基础', '关系模型、关系代数，以及现代 SQL 能做到什么', ['01', '02']),
    ('ch02-storage', '第 2 章', '存储', '文件、页、元组怎么摆；缓冲池；日志结构存储；列存与压缩', ['03', '04', '05', '06']),
    ('ch03-indexes', '第 3 章', '索引', '哈希表、B+ 树、过滤器与向量索引，以及数据结构的并发保护', ['07', '08', '09', '10']),
    ('ch04-execution', '第 4 章', '查询执行', '排序、聚合、连接算法；算子模型；并行执行', ['11', '12', '13', '14']),
    ('ch05-optimization', '第 5 章', '查询优化', '从 SQL 到执行计划：规则改写与基于代价的搜索', ['15', '16']),
    ('ch06-concurrency', '第 6 章', '事务与并发控制', '可串行化理论、两阶段封锁、时间戳排序与 OCC、MVCC', ['17', '18', '19', '20']),
    ('ch07-recovery', '第 7 章', '日志与恢复', '预写日志 WAL 与 ARIES 崩溃恢复', ['21', '22']),
    ('ch08-distributed', '第 8 章', '分布式数据库', '架构与分片、分布式事务、共识协议', ['23', '24']),
    ('ch09-review', '第 9 章', '复习与速查', '期末复习、系统巡礼，以及全课术语速查表', ['25', '99']),
    ('homework', '作业', '作业讲解', 'HW1–HW6：每次作业考什么、怎么想、怎么算，配动画演示；题目和官方答案链接到原文', ['HW1', 'HW2', 'HW3', 'HW4', 'HW5', 'HW6']),
    ('lab', '实验', 'BusTub Lab 指南', 'Project 0–4 的学习指南', ['P0', 'P1', 'P2', 'P3', 'P4']),
]

CJK = re.compile('[ᄀ-ᇿ⺀-⿿　-鿿ꥠ-꥿가-퟿豈-﫿︐-︟︰-﹯＀-￯\U00020000-\U0003ffff]')


def punct(ch):
    return isMdAsciiPunct(ord(ch)) or isPunctChar(ch)


class CjkInline(StateInline):
    """CommonMark 判断 ** 能不能开 / 合（左右侧翼规则）时假定词和词之间有空格：紧贴标点的 ** 必须另一侧是空白或标点。
    中文不打空格，于是「爬到了**访问方法（Access Methods）**这一层」里贴着全角括号、引号的 ** 开合不了，原样露出来。
    这里把紧挨在 ** 外侧的中日韩字符当作空白看待（只放宽 * 和 ~，_ 多半是标识符里的下划线，不动）；纯英文的行为不变。"""

    def scanDelims(self, start, canSplitWord):
        s = super().scanDelims(start, canSplitWord)
        if self.src[start] == '_':
            return s
        end = start + s.length
        last = self.src[start - 1] if start > 0 else ' '
        nxt = self.src[end] if end < self.posMax else ' '
        return Scanned(s.can_open or (bool(CJK.match(last)) and punct(nxt)), s.can_close or (punct(last) and bool(CJK.match(nxt))), s.length)


def bold_link(state):
    """`**从这里加粗 [一直到链接文字末尾**](链接)`：开头的 ** 在链接外、结尾的在链接文字里，CommonMark 不让强调跨过链接边界，
    两个都原样露出来。按本意加粗：从开头的 ** 一直到整个链接结束。
    排在 text_join 前面：这时文本 token 里剩下的 * 都是没配上对的定界符，转义的 \\* 还是单独的 token，不会被误认。"""
    for blk in state.tokens:
        ch = blk.children if blk.type == 'inline' else []
        for i in range(len(ch) - 1, 0, -1):
            if ch[i].type != 'link_open' or ch[i - 1].type != 'text':
                continue
            j = next(k for k in range(i, len(ch)) if ch[k].type == 'link_close')
            opens = list(re.finditer(r'(?<!\*)\*\*(?![*\s])', ch[i - 1].content))
            if not opens or j - 1 == i or ch[j - 1].type != 'text' or not re.search(r'(?<![*\s])\*\*$', ch[j - 1].content):
                continue
            a, p = ch[i - 1].content, opens[-1].start()
            ch[j - 1].content = ch[j - 1].content[:-2]
            ch[j + 1:j + 1] = [Token('strong_close', 'strong', -1, markup='**')]
            ch[i - 1:i] = [Token('text', '', 0, content=a[:p]), Token('strong_open', 'strong', 1, markup='**'), Token('text', '', 0, content=a[p + 2:])]


def new_md():
    return MarkdownIt('commonmark', {'html': True}).enable('table').enable('strikethrough')


def cjk_md():
    m = new_md()
    inline = m.inline

    def parse(src, md, env, tokens):      # 同 ParserInline.parse，只是换成 CjkInline
        state = CjkInline(src, md, env, tokens)
        inline.tokenize(state)
        for rule in inline.ruler2.getRules(''):
            rule(state)
        return state.tokens
    inline.parse = parse
    m.core.ruler.before('text_join', 'bold_link', bold_link)
    return m


md = cjk_md()
md_cm = new_md()    # 原样 CommonMark，只用来算块 id：修好粗体前后块 id 不变，读者已有的编辑不会失效
warnings = []


def warn(msg):
    warnings.append(msg)


def plain(tok):
    return ''.join(c.content for c in (tok.children or []) if c.type in ('text', 'code_inline'))


def slugify(text):
    s = re.sub(r'[^\w\- ]', '', text.strip().lower())
    return s.replace(' ', '-')


def groups(tokens):
    """把 token 流切成顶层块"""
    out, i = [], 0
    while i < len(tokens):
        if tokens[i].nesting == 1:
            j, depth = i + 1, 1
            while depth:
                depth += tokens[j].nesting
                j += 1
            out.append(tokens[i:j])
            i = j
        else:
            out.append([tokens[i]])
            i += 1
    return out


def render(g):
    return md.renderer.render(g, md.options, {}).strip()


def block_html(g, seen_h2):
    t, h, kind = g[0], render(g), 'p'
    if t.type == 'table_open':
        kind = 'table'
    elif t.type == 'blockquote_open':
        txt = re.sub(r'<[^>]+>', '', h).strip()
        cls = 'meta' if not seen_h2 else 'tip' if txt.startswith(('💡', '补充')) else 'warn' if txt.startswith(('⚠', '踩坑')) else ''
        if cls:
            h = h.replace('<blockquote', '<blockquote class="%s"' % cls, 1)
        if cls == 'meta':
            h = re.sub(r'(?<!>)\n(?!<)', '<br>\n', h)   # 讲次信息块：一行一项
    elif t.type == 'fence':
        lang = (t.info or '').strip().split(' ')[0]
        if lang:
            h = h.replace('<pre', '<pre data-lang="%s"' % html.escape(lang), 1)
    return kind, h


class Lec:
    def __init__(self, key, page):
        self.key, self.page = key, page
        self.id = key if key.startswith(('P', 'HW')) else 'L' + key
        pat = ('lab/%s-*.md' % key) if key.startswith('P') else ('hw/%s-*.md' % key) if key.startswith('HW') else ('%s-*.md' % key)
        found = sorted(NOTES.glob(pat))
        if not found:
            sys.exit('找不到笔记文件: ' + pat)
        self.path = found[0].resolve()
        self.title = self.path.stem
        self.blocks, self.ids, self.toc, self.viz, self.ndg = [], set(), [], [], 0
        self.vizn, self.vizat = {}, {}      # 每个可视化拆成了几处；(可视化, 场景号) → 它所在那一处的锚点
        self.levels = {}                    # 节的锚点 → (难度, 重要程度, 理由)，或 (None, 标签, '') 表示练习 / 导览这类不评级的节
        self.kick = ('Project ' + key[1:]) if key.startswith('P') else ('作业 ' + key[2:]) if key.startswith('HW') else ('附录' if key == '99' else '第 %d 讲' % int(key))
        self.num = key if key.startswith(('P', 'HW')) else ('附' if key == '99' else '#' + key)
        self.parse()

    def uid(self, base, pool):
        base = base or 'x'
        cand, n = base, 0
        while cand in pool:
            n += 1
            cand = '%s-%d' % (base, n)
        pool.add(cand)
        return cand

    def parse(self):
        bids, slugs, skipping, seen_h2 = set(), set(), False, False
        src = self.path.read_text(encoding='utf-8')
        # g 用来出页面，g0 是同一块的原样 CommonMark 解析，只用来算块 id（两边的块一一对应，只有行内不同）
        for g, g0 in zip(groups(md.parse(src)), groups(md_cm.parse(src)), strict=True):
            t = g[0]
            if t.type == 'heading_open':
                level, text = int(t.tag[1]), plain(g[1])
                skipping = False
                if level == 1:
                    self.title = re.sub(r'^#?\d+\s*', '', text).strip() or text
                    continue
                if level == 2 and text.strip() == '目录':
                    skipping = True      # 侧边栏已经是目录，正文里的那份去掉
                    continue
                hid = self.id + '-' + self.uid(slugify(text), slugs)
                self.ids.add(hid)
                if level == 2:
                    seen_h2 = True
                    self.toc.append((hid, text))
                h, key = (re.sub(r'^<(h\d)', lambda m: '<%s id="%s"' % (m.group(1), hid), render(x)) for x in (g, g0))
                self.blocks.append({'kind': 'h', 'level': level, 'text': text, 'html': h, 'key': key})
                continue
            if skipping or t.type == 'hr':
                continue
            (kind, h), (_, key) = block_html(g, seen_h2), block_html(g0, seen_h2)
            if h:
                self.blocks.append({'kind': kind, 'html': h, 'key': key})
        for b in self.blocks:
            bid = self.id + '-' + self.uid(hashlib.md5(b.pop('key').encode('utf-8')).hexdigest()[:8], bids)
            restyle(b)      # 只改呈现；块 id 取自改之前的内容，所以读者已有的编辑不会失效
            b['html'] = re.sub(r'^<(\w+)', lambda m: '<%s data-b="%s"' % (m.group(1), bid), b['html'])
            if b['kind'] == 'table':
                b['html'] = '<div class="tbl">' + b['html'] + '</div>'

    def add_levels(self):
        """每一节的难度和重要程度：_src/levels/<讲>.json，{ "节标题": [难度 1–5, 重要程度 3 必会 / 2 重要 / 1 了解, "一句话理由"] }"""
        f = SRC / 'levels' / (self.key + '.json')
        if not f.exists():
            sys.exit('%s 还没有难度 / 重要程度：_src/levels/%s.json 不存在' % (self.key, self.key))
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            sys.exit('levels/%s.json 不是合法 JSON: %s' % (self.key, e))
        hs = [i for i, b in enumerate(self.blocks) if b['kind'] == 'h' and b['level'] == 2]
        need = {}
        for (hid, text), at in zip(self.toc, hs):
            label = next((v for k, v in NEUTRAL if k in text), None)
            if label:
                self.levels[hid] = (None, label, '')
                self.blocks[at]['lvl'] = '<div class="lvl n"><span class="im">%s</span></div>' % label
                continue
            need[text] = 1
            v = data.get(text)
            if not isinstance(v, list) or len(v) != 3 or v[0] not in (1, 2, 3, 4, 5) or v[1] not in IMP or not v[2].strip():
                sys.exit('levels/%s.json：「%s」要写成 [难度 1–5, 重要程度 1–3, "理由"]，现在是 %r' % (self.key, text, v))
            self.levels[hid] = tuple(v)
            self.blocks[at]['lvl'] = ('<div class="lvl i%d"><span class="st" title="难度 %d / 5">难度 <b>%s</b><u>%s</u></span><span class="im">%s</span><span class="why">%s</span></div>'
                                      % (v[1], v[0], '★' * v[0], '★' * (5 - v[0]), IMP[v[1]], html.escape(v[2])))
        stale = [k for k in data if k not in need]
        if stale:
            sys.exit('levels/%s.json 里这些节标题对不上：%s' % (self.key, '；'.join(stale)))
        for at in reversed(hs):
            if 'lvl' in self.blocks[at]:
                self.blocks.insert(at + 1, {'kind': 'extra', 'html': self.blocks[at].pop('lvl')})

    def add_extras(self, viz_ids):
        f = SRC / 'extras' / (self.key + '.json')
        if not f.exists():
            return
        try:
            items = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            sys.exit('extras/%s.json 不是合法 JSON: %s' % (self.key, e))
        ins = []
        for seq, it in enumerate(items):
            # after 可以写成「大节 > 小节」：先找到大节，再在它后面找小节（小节标题在全讲里重名时用）
            idx = -1
            for part in it['after'].split(' > '):
                idx = next((i for i in range(idx + 1, len(self.blocks)) if self.blocks[i]['kind'] == 'h' and part in self.blocks[i]['text']), None)
                if idx is None:
                    break
            # 只写了一段、又同时出现在好几个标题里：会落到第一个，多半不是想要的位置
            same = [b['text'] for b in self.blocks if b['kind'] == 'h' and it['after'] in b['text']] if ' > ' not in it['after'] else []
            if len(same) > 1:
                warn('extras/%s.json 第 %d 项：「%s」同时出现在 %d 个标题里（%s），用「大节 > 小节」写明' % (self.key, seq + 1, it['after'], len(same), '、'.join(same[:3])))
            if idx is None:
                heads ='\n    '.join(b['text'] for b in self.blocks if b['kind'] == 'h')
                sys.exit('extras/%s.json 第 %d 项：找不到包含「%s」的小节标题。可用标题：\n    %s' % (self.key, seq + 1, it['after'], heads))
            at = idx + 1
            if it.get('pos') == 'end':
                lv = self.blocks[idx]['level']
                at = next((i for i in range(idx + 1, len(self.blocks)) if self.blocks[i]['kind'] == 'h' and self.blocks[i]['level'] <= lv), len(self.blocks))
            elif it.get('pos') == 'intro':     # 这一节自己的正文之后、第一个小标题之前
                at = next((i for i in range(idx + 1, len(self.blocks)) if self.blocks[i]['kind'] == 'h'), len(self.blocks))
            kind = it['kind']
            if kind == 'viz':
                if it['id'] not in viz_ids:
                    sys.exit('extras/%s.json：可视化「%s」未注册（_src/viz/ 里没有）' % (self.key, it['id']))
                # scenes：这一处只放其中几个场景——一个可视化按场景拆开，放到各自对应的小节下面。
                # 第一处的锚点是 viz-<id>（讲次顶部、首页都链到这里），后面的是 viz-<id>-2、-3…
                vid, sc, total = it['id'], it.get('scenes'), len(VIZ.get(it['id'], {}).get('scenes', []))
                if sc is not None and (not sc or any(not isinstance(i, int) or not 0 <= i < total for i in sc)):
                    sys.exit('extras/%s.json 第 %d 项：可视化「%s」只有 %d 个场景，scenes %s 不对' % (self.key, seq + 1, vid, total, sc))
                if vid not in self.viz:
                    self.viz.append(vid)
                k = self.vizn[vid] = self.vizn.get(vid, 0) + 1
                anchor = 'viz-%s' % vid if k == 1 else 'viz-%s-%d' % (vid, k)
                for i in (sc if sc is not None else range(total)):
                    self.vizat[(vid, i)] = anchor
                attrs = (' data-scenes="%s"' % ','.join(str(i) for i in sc) if sc is not None else '') + (' data-title="%s"' % html.escape(it['title']) if it.get('title') else '')
                h = '<div class="viz-wrap wide" id="%s"><div data-viz="%s"%s></div></div>' % (anchor, vid, attrs)
            elif kind in ('flow', 'seq', 'layers'):
                self.ndg += 1
                spec = json.dumps(it['spec'], ensure_ascii=False).replace('</', '<\\/')
                cap = '<figcaption><b>图</b> %s</figcaption>' % html.escape(it['title']) if it.get('title') else ''
                h = ('<figure class="dg%s" data-dg="%s" contenteditable="false"><div class="dg-body"></div>'
                     '<script type="application/json">%s</script>%s</figure>') % (' wide' if it.get('wide') else '', kind, spec, cap)
            else:
                sys.exit('extras/%s.json 第 %d 项：未知 kind「%s」' % (self.key, seq + 1, kind))
            ins.append((at, seq, h))
        for at, _, h in sorted(ins, reverse=True):
            self.blocks.insert(at, {'kind': 'extra', 'html': h})


# 标题 / 引用块开头的表情 → 小标签（含义不变，只是不再满屏表情）
CHIP = {'🔑': ('key', '重点'), '🔥': ('hot', '高频'), '⚠': ('warn', '注意'), '✅': ('ok', '✓'), '❌': ('bad', '✗'),
        '💡': ('tip', '补充'), '🆕': ('new', '新'), '😱': ('warn', '坑'), '📊': ('tip', '对比')}
QUOTE = {'🔑': 'key', '🔥': 'key', '✅': 'ok', '❌': 'bad', '😱': 'warn', '⚠': 'warn', '💡': 'tip'}
IMP = {3: '必会', 2: '重要', 1: '了解'}
NEUTRAL = (('自测', '练习'), ('这一课在整门课里的位置', '导览'), ('交卷前自查', '练习'), ('交作业前的检查清单', '练习'))   # 这些节不评级，只打一个标签
LEAD = re.compile(r'^\s*(' + '|'.join(re.escape(k) for k in CHIP) + r')\ufe0f?\s*')
VIZ = {}


def meta_grid(h):
    """讲次开头的信息块：一行一项 → 两列对齐的表"""
    m = re.match(r'<blockquote class="meta">\s*<p>(.*)</p>\s*</blockquote>$', h, re.S)
    if not m:
        return h
    rows = []
    for line in re.split(r'(?:<br>\s*|\n)', m.group(1)):
        line = line.strip()
        k = re.match(r'<strong>([^<]{1,16})</strong>\s*[：:]\s*(.*)$', line, re.S)
        if k:
            rows.append('<div class="mk">%s</div><div class="mv">%s</div>' % (k.group(1), k.group(2)))
        elif line:
            rows.append('<div class="mq">%s</div>' % line)
    return '<div class="meta">' + ''.join(rows) + '</div>'


def restyle(b):
    h = b['html']
    if b['kind'] == 'h':
        m = re.match(r'(<h\d[^>]*>)(.*)(</h\d>)$', h, re.S)
        head, body, tail = m.groups()
        pre = ''
        if b['level'] == 2:
            n = re.match(r'(\d+)\.\s+', body)
            if n:
                pre, body = '<span class="hn">%s</span>' % n.group(1), body[n.end():]
        e = LEAD.match(body)
        if e:
            cls, lab = CHIP[e.group(1)]
            pre, body = pre + '<span class="hc hc-%s">%s</span>' % (cls, lab), body[e.end():]
        b['html'] = head + pre + body + tail
    elif h.startswith('<blockquote class="meta"'):
        b['html'] = meta_grid(h)
    elif h.startswith('<blockquote'):
        m = re.match(r'(<blockquote[^>]*>\s*<p>)(.*)$', h, re.S)
        e = m and LEAD.match(m.group(2))
        if e and e.group(1) in QUOTE:
            head = m.group(1) if 'class=' in m.group(1) else m.group(1).replace('<blockquote', '<blockquote class="%s"' % QUOTE[e.group(1)], 1)
            b['html'] = head + m.group(2)[e.end():]
    elif h.startswith('<pre') and 'data-lang' not in h[:60]:
        b['html'] = h.replace('<pre', '<pre class="plain"', 1)


def sections(blocks, drop=()):
    """按二级标题把内容切成一张张卡片"""
    out, cur, cls, skip = [], [], 'sec intro', False
    for b in blocks:
        if b['kind'] == 'h' and b['level'] == 2:
            if cur:
                out.append('<section class="%s">\n%s\n</section>' % (cls, '\n'.join(cur)))
            t, cur = b['text'].strip(), []
            skip = any(d in t for d in drop)
            cls = 'sec quiz' if t.startswith('自测') else 'sec place' if '这一课在整门课里的位置' in t else 'sec'
        if not skip:
            cur.append(b['html'])
    if cur:
        out.append('<section class="%s">\n%s\n</section>' % (cls, '\n'.join(cur)))
    return '\n'.join(out)


def lec_id(key):
    return key if key.startswith(('P', 'HW')) else 'L' + key


def nav_tabs(chapters, slug):
    # data-lecs：这一章有哪几讲，脚本据此在全部打勾的章节后面显示 ✓
    return ''.join('<a href="%s.html"%s data-lecs="%s"><em>%s</em>%s<i class="tck" title="这一章全部完成">✓</i></a>'
                   % (c[0], ' class="on"' if c[0] == slug else '', ','.join(lec_id(k) for k in c[4]), {'lab': 'L', 'homework': 'H'}.get(c[0], i + 1), 'Lab' if c[0] == 'lab' else c[2])
                   for i, c in enumerate(chapters))


def toc_item(lec, hid, t, lv=None):
    n = re.match(r'(\d+)\.\s+', t)
    num, t = (n.group(1), t[n.end():]) if n else ('·', t)
    badge = ''
    if lv and lv[0]:
        badge = '<b class="lvs i%d" title="%s · 难度 %d / 5：%s">★%d</b>' % (lv[1], IMP[lv[1]], lv[0], html.escape(lv[2], quote=True), lv[0])
    return ('<li><a href="#%s"><i>%s</i><span>%s</span>%s</a><button class="ck sm" type="button" data-ck="%s" data-of="%s" title="这一小节看完了就打勾" aria-pressed="false"></button></li>'
            % (hid, num, html.escape(LEAD.sub('', t)), badge, hid, lec))


def norm_frag(s):
    return re.sub(r'[-_\d①-⑳]', '', s)


def fix_links(lec, by_path, h):
    def rep(m):
        raw = html.unescape(m.group(1))
        if re.match(r'^(https?:|mailto:)', raw):
            cls = ' class="ts"' if re.search(r'youtu\.?be.*[?&]t=\d', raw) else ''
            return '<a href="%s"%s target="_blank" rel="noopener"' % (m.group(1), cls)
        path, _, frag = unquote(raw).partition('#')
        target = lec
        if path:
            p = (lec.path.parent / path).resolve()
            target = by_path.get(p)
            if target is None:
                if p == README:
                    return '<a href="index.html"'
                rel = os.path.relpath(p, OUT).replace('\\', '/')
                if not p.exists():
                    warn('%s: 链接目标不存在 %s' % (lec.key, raw))
                return '<a href="%s%s"' % (html.escape(rel), '#' + html.escape(frag) if frag else '')
        anchor = target.id
        if frag:
            if target.id + '-' + frag in target.ids:
                anchor = target.id + '-' + frag
            elif not (target is lec and frag == '目录'):
                # 原笔记里有些锚点和标题对不上（标题后来改过）：按相似度找最接近的小节
                want, best, score = norm_frag(frag), None, 0.0
                for hid in target.ids:
                    have = norm_frag(hid[len(target.id) + 1:])
                    sc = 1.0 if have == want else 0.9 if want and (want in have or have in want) else SequenceMatcher(None, want, have).ratio()
                    if sc > score:
                        best, score = hid, sc
                if best and score >= 0.6:
                    anchor = best
                else:
                    warn('%s: 找不到小节锚点 %s#%s，已改为指向该讲开头' % (lec.key, target.key, frag))
        return '<a href="%s#%s"' % ('' if target.page == lec.page else target.page + '.html', anchor)
    return re.sub(r'<a href="([^"]*)"', rep, h)


GLOSS_BAD = set('IS ON OR DO AS IN AT BY TO OF IF NO GO UP ID AND NOT SET ALL ANY FOR THE PUT GET CAT MAP ADD USE'.split())


def load_gloss(by_id, strict=False):
    """术语表：_src/glossary/*.json，[{ "t": 名称, "full": 全称, "desc": 解释, "alias": [别名], "see": "L21" }]。
    t 和 alias 都会在正文里匹配（区分大小写）；see 是讲次 id，卡片上会有一个链接。返回写给页面的精简列表（链接相对主笔记目录）。
    构建时词表有问题只警告并跳过那一条，不挡笔记的构建；strict=True（check_gloss.py）才报错退出。"""
    out, seen = [], {}

    def bad(msg):
        if strict:
            sys.exit(msg)
        warn(msg)
    for f in sorted((SRC / 'glossary').glob('*.json')):
        try:
            items = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            bad('glossary/%s 不是合法 JSON: %s' % (f.name, e))
            continue
        for it in items:
            t, desc = it.get('t'), it.get('desc')
            if not t or not desc:
                bad('glossary/%s：词条缺 t 或 desc：%r' % (f.name, it))
                continue
            if len(desc) > 90:
                bad('glossary/%s：「%s」的解释 %d 字，超过 90 字' % (f.name, t, len(desc)))
                continue
            words, ok = [t] + it.get('alias', []), True
            for w in words:
                if w in seen:
                    bad('glossary/%s：「%s」重复，已在 %s 里' % (f.name, w, seen[w]))
                    ok = False
                elif w in GLOSS_BAD or len(w) < 2:
                    bad('glossary/%s：「%s」太容易误伤普通文字，换一个更具体的写法' % (f.name, w))
                    ok = False
            if not ok:
                continue
            for w in words:
                seen[w] = f.name + ' 的 ' + t
            e = {'t': t, 'f': it.get('full', ''), 'd': desc}
            if it.get('alias'):
                e['a'] = it['alias']
            if it.get('see'):
                l = by_id.get(it['see'])
                if l is None:
                    bad('glossary/%s：「%s」的 see「%s」不是讲次 id' % (f.name, t, it['see']))
                else:
                    e['h'], e['n'] = '%s.html#%s' % (l.page, l.id), '详见 %s %s' % (l.num, l.title)
            out.append(e)
    return out


def gloss_js(items, prefix=''):
    data = [dict(e, h=prefix + e['h']) if 'h' in e else e for e in items]
    return 'window.GLOSS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + (SRC / 'gloss.js').read_text(encoding='utf-8')


def inline_js(*parts):
    return '\n'.join(p.replace('</script', '<\\/script') for p in parts)


TOP = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<style>
%(css)s
</style>
</head>
'''


def page_chapter(ch, lecs, order, css, js_core, viz_files, chapters):
    slug, kick, name, _desc, _ = ch
    nav = []
    for l in lecs:
        bits = [x for x in ('▶ %d 个演示' % sum(l.vizn.get(v, 1) for v in l.viz) if l.viz else '', '%d 张图' % l.ndg if l.ndg else '') if x]
        nav.append('<li data-lec="%s"><div class="lr"><a href="#%s"><span class="n">%s</span><span class="t">%s%s<small class="sc"></small></span></a>'
                   '<button class="ck" type="button" data-ck="%s" title="这一讲学完了就打勾" aria-pressed="false"></button></div><ul class="sub">%s</ul></li>'
                   % (l.id, l.id, l.num, html.escape(l.title), '<small>%s</small>' % ' · '.join(bits) if bits else '', l.id, ''.join(toc_item(l.id, i, t, l.levels.get(i)) for i, t in l.toc)))
    # 目录收起后的窄条：每一讲一个小方块（✓ 完成、蓝框 正在看）
    rail = ''.join('<a class="rl" href="#%s" data-rl="%s" title="%s %s">%s</a>' % (l.id, l.id, l.num, html.escape(l.title), l.num.lstrip('#')) for l in lecs)
    arts = []
    for l in lecs:
        k = order.index(l)
        pn = []
        for d, lab in ((-1, '← 上一讲'), (1, '下一讲 →')):
            if 0 <= k + d < len(order):
                o = order[k + d]
                pn.append('<a href="%s#%s"><small>%s</small>%s %s</a>' % ('' if o.page == l.page else o.page + '.html', o.id, lab, o.num, html.escape(o.title)))
            else:
                pn.append('<span></span>')
        rated = [v for v in l.levels.values() if v[0]]
        lvsum = ''
        if rated:
            cnt = ' · '.join('%s %d' % (IMP[k], sum(1 for v in rated if v[1] == k)) for k in (3, 2, 1) if any(v[1] == k for v in rated))
            lvsum = '<div class="lvsum">本讲 %d 节：%s · 平均难度 ★%.1f</div>' % (len(rated), cnt, sum(v[0] for v in rated) / len(rated))
        chips = ''.join(('<a class="chip cv" href="#viz-%s">▶ 演示：%s</a>' % (v, html.escape(VIZ[v]['title'])) if l.vizn.get(v, 1) < 2 else
                         '<a class="chip cv" href="#viz-%s" title="%s">▶ %d 段演示：%s（放在各自的小节下面）</a>' % (v, html.escape(VIZ[v]['title']), l.vizn[v], html.escape(VIZ[v]['title'].split('：')[0])))
                        for v in l.viz if v in VIZ)
        if l.ndg:
            chips += '<span class="chip">%d 张图表</span>' % l.ndg
        if l.video:
            chips = '<a class="chip vd" href="%s" target="_blank" rel="noopener">▶ 看视频 · %s</a>' % (html.escape(l.video[1]), l.video[2]) + chips
        if l.tr:
            chips += '<a class="chip" href="%s" target="_blank" rel="noopener">英文字幕原文</a>' % rel_url(l.tr)
        if l.key.startswith('P') and (OUT / 'labs' / 'index.html').is_file():
            chips = '<a class="chip cv" href="labs/index.html#intro:%s">⌨ 逐行复原笔记</a>' % l.key + chips
        arts.append('<article class="lec" id="%s">\n<div class="lec-hd"><div class="kick">%s · %s · %s</div><h1>%s</h1>%s</div>\n<div class="md">\n%s\n'
                    '<div class="mynote" data-b="%s-my"></div>\n</div>\n'
                    '<div class="lec-ft"><button class="rd" data-ck="%s" data-big="1" type="button">这一讲学完了，打个勾</button></div>\n<div class="pn">%s</div>\n</article>'
                    % (l.id, kick, name, l.kick, html.escape(l.title), ('<div class="chips">%s</div>' % chips if chips else '') + lvsum, sections(l.blocks), l.id, l.id, ''.join(pn)))
    need = []
    for l in lecs:
        for v in l.viz:
            if viz_files[v] not in need:
                need.append(viz_files[v])
    js = inline_js(js_core['anim'], *[f.read_text(encoding='utf-8') for f in need], js_core['dg'], js_core['gloss'], js_core['notes'])
    return (TOP % {'title': '%s · %s · CMU 15-445 笔记' % (kick, name), 'css': css}) + '''<body data-page="%(slug)s">
<header class="top">
<button class="tb" id="menuBtn" aria-label="本章目录">☰</button>
<a class="brand" href="index.html">CMU 15-445 <span>笔记</span></a>
<nav class="tabs">%(tabs)s</nav>
<button class="tb" id="editBtn" title="打开后可以直接修改正文，改动保存在本机浏览器">✏️<span class="lbl">编辑</span></button>
<button class="tb" id="themeBtn" title="切换明暗主题">🌓</button>
<div class="menu"><button class="tb" id="moreBtn" aria-label="更多">⋯</button><div class="menu-pop">
<button data-act="resetLec">还原这一讲的修改</button><button data-act="resetAll">还原本章全部修改</button><hr>
<button data-act="exportEdits">导出我的修改…</button><button data-act="importEdits">导入修改…</button></div></div>
<div class="rp" id="rp"></div>
</header>
<div class="shell">
<nav class="side">
<div class="side-full"><div class="side-hd"><h4>%(kick)s · %(name)s</h4><button class="side-tg" type="button" data-side-tg title="收起目录，给正文腾位置（快捷键 [ ）" aria-expanded="true">«</button></div>
<div class="cprog"><div class="bar"><i></i></div><span class="txt"></span><button class="call" type="button" data-call title="把本章每一讲都打勾 / 全部取消">全部打勾</button></div>
<ul class="lecs">%(nav)s</ul>
<p class="lvleg">★ 是难度（1–5），颜色是重要程度：<b class="i3">必会</b> <b class="i2">重要</b> <b class="i1">了解</b>。按作业和 Project 的覆盖情况估的，不是官方标注。</p></div>
<div class="side-rail"><button class="side-tg" type="button" data-side-tg title="展开目录（快捷键 [ ）" aria-expanded="false">»</button><span class="rn"></span>%(rail)s</div>
</nav>
<main>
%(arts)s
</main>
</div>
<input type="file" id="importFile" accept=".json" hidden><div class="toast" id="toast"></div>
<script>
%(js)s
</script>
</body>
</html>
''' % {'slug': slug, 'kick': kick, 'name': name, 'tabs': nav_tabs(chapters, slug), 'nav': ''.join(nav), 'rail': rail, 'arts': '\n'.join(arts), 'js': js}


OFFICIAL = 'https://15445.courses.cs.cmu.edu/fall2025/'
PLAYLIST = 'https://www.youtube.com/playlist?list=PLSE8ODhjZXjYMAgsGH-GtY5rJYZ6zjsd5'
BUSTUB = 'https://github.com/cmu-db/bustub'
# 官方 assignments.html 列出的 6 次作业；「对应讲次」是按作业主题对的，属于本笔记的归纳
HOMEWORK = [
    ('HW1', 'SQL', '#01–#02', OFFICIAL + 'homework1/', OFFICIAL + 'files/hw1-sols.tar.gz'),
    ('HW2', '存储 Storage', '#03–#06', OFFICIAL + 'files/hw2-clean.pdf', OFFICIAL + 'files/hw2-sols.pdf'),
    ('HW3', '索引与过滤器 Indexes & Filters', '#07–#10', OFFICIAL + 'files/hw3-clean.pdf', OFFICIAL + 'files/hw3-sols.pdf'),
    ('HW4', '执行与计划 Execution & Planning', '#11–#16', OFFICIAL + 'files/hw4-clean.pdf', OFFICIAL + 'files/hw4-sols.pdf'),
    ('HW5', '事务 Transactions', '#17–#20', OFFICIAL + 'files/hw5-clean.pdf', OFFICIAL + 'files/hw5-sols.pdf'),
    ('HW6', '恢复 Recovery', '#21–#22', OFFICIAL + 'files/hw6-clean.pdf', OFFICIAL + 'files/hw6-sols.pdf'),
]
PROJ_LECS = {'P0': '—', 'P1': '#03 #04', 'P2': '#08 #10', 'P3': '#11 #12 #13', 'P4': '#17–#20'}
NA = '<span class="na">—</span>'


def rel_url(p):
    return quote(os.path.relpath(p, OUT).replace('\\', '/'))


def ext(u, t):
    return '<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(u), t) if u else NA


def lec_sources(l):
    # 从笔记开头的信息块里取视频 / Slides / Notes / 官方页面，再找对应的本地字幕文件
    head = '\n'.join(l.path.read_text(encoding='utf-8').splitlines()[:14])
    m = re.search(r'\*\*视频\*\*：\[([^\]]+)\]\((https?://[^)\s]+)\)\s*·\s*([\d:]+)', head)
    l.video = (m.group(1), m.group(2), m.group(3)) if m else None
    m = re.search(r'\[Slides\]\((https?://[^)\s]+)\)', head)
    l.slides = m.group(1) if m else None
    m = re.search(r'\[Notes\]\((https?://[^)\s]+)\)', head)
    l.notes = m.group(1) if m else None
    m = re.search(r'\*\*官方页面\*\*：<(https?://[^>\s]+)>', head)
    l.official = m.group(1) if m else None
    l.tr = None
    if l.key.isdigit() and l.key != '99':
        t = sorted((NOTES / '_transcripts').glob(l.key + '_*.md'))
        if t:
            l.tr = t[0]
            vid = re.search(r'__([\w-]{11})\.md$', t[0].name)
            if l.video and vid and vid.group(1) not in l.video[1]:
                warn('%s: 笔记里的视频链接和字幕文件对不上（%s）' % (l.key, vid.group(1)))
        else:
            warn('%s: 找不到本地字幕文件' % l.key)


def hms(t):
    sec = 0
    for x in t.split(':'):
        sec = sec * 60 + int(x)
    return sec


def materials_html(by_page, chapters):
    lecs = [l for ls in by_page.values() for l in ls]
    vids = [l for l in lecs if l.video]
    total = sum(hms(l.video[2]) for l in vids)
    ntr = sum(1 for l in lecs if l.tr)

    def tile(u, title, cls, kind, desc):
        return ('<a class="res %s" href="%s" target="_blank" rel="noopener"><span class="rk">%s</span><b>%s</b><span>%s</span></a>'
                % (cls, html.escape(u), kind, title, desc))
    tiles = ''.join([
        tile(PLAYLIST, 'YouTube 播放列表', 'vid', '视频', '%d 讲课堂录像，共 %d 小时 %d 分' % (len(vids), total // 3600, total % 3600 // 60)),
        tile(OFFICIAL + 'schedule.html', '课程日程', 'off', '官方', '按日期排的每讲 Slides、Notes 和作业'),
        tile(OFFICIAL + 'assignments.html', '作业与 Project 总览', 'off', '官方', '6 次作业（含答案）和 5 个 Project'),
        tile(OFFICIAL, '课程官网', 'off', '官方', '公告、讲师和助教、课程信息'),
        tile(OFFICIAL + 'syllabus.html', '教学大纲', 'off', '官方', '课程目标、评分和课程政策'),
        tile(OFFICIAL + 'faq.html', 'FAQ', 'off', '官方', '官方常见问题'),
        tile('https://piazza.com/cmu/fall2025/15445645', 'Piazza 讨论区', 'off', '官方', '课程问答（需要 CMU 账号）'),
        tile(BUSTUB, 'BusTub 源码', 'code', '代码', 'Project 用的教学数据库，C++17'),
        tile(OFFICIAL + 'bustub/', 'BusTub Shell', 'code', '代码', '在浏览器里直接运行 BusTub 的在线 shell'),
        tile(rel_url(NOTES / '_transcripts') + '/', '英文字幕原文', 'local', '本地', '%d 份 YouTube 自动生成字幕，按讲编号' % ntr),
        tile(rel_url(NOTES) + '/', 'Markdown 笔记原文', 'local', '本地', '本站所有页面都由这些文件生成'),
    ] + ([tile('labs/index.html', 'BusTub 逐行复原笔记', 'local', '本站', 'P0–P4：照步骤链从零重敲官方骨架，配逐行执行可视化和比对脚本')] if (OUT / 'labs' / 'index.html').is_file() else [])
      + ([tile('homework.html', '作业可视化讲解', 'local', '本站', 'HW1–HW6：每次作业考什么、怎么想、怎么算')] if by_page.get('homework') else []))
    tiles = tiles.replace('target="_blank" rel="noopener"><span class="rk">本站', '><span class="rk">本站')
    rows = []
    for slug, _k, _n, _d, _keys in chapters:
        for l in by_page[slug]:
            if not l.key.isdigit() or l.key == '99':
                continue
            v = l.video
            vid = ('<a href="%s" target="_blank" rel="noopener" title="%s">▶ 观看</a> <small>%s</small>' % (html.escape(v[1]), html.escape(v[0]), v[2])) if v else NA
            demo = ' '.join('<a href="%s.html#viz-%s">▶ %s</a>' % (l.page, x, html.escape(VIZ[x]['title'].split('：')[0])) for x in l.viz if x in VIZ) or NA
            rows.append('<tr><td><small>%s</small></td><td><a href="%s.html#%s">%s</a></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>'
                        % (l.num, l.page, l.id, html.escape(l.title), vid, ext(l.slides, 'PDF'), ext(l.notes, 'PDF'),
                           ext(rel_url(l.tr), '字幕') if l.tr else NA, ext(rel_url(l.path), '.md'), demo))
    hwk = {l.key for l in by_page.get('homework', [])}
    hw = ''.join('<tr><td><b>%s</b></td><td>%s</td><td><small>%s</small></td><td>%s</td><td>%s</td><td>%s</td></tr>'
                 % (h[0], html.escape(h[1]), h[2], ext(h[3], '题目'), ext(h[4], '答案' + ('（压缩包）' if h[4].endswith('.gz') else '')),
                    '<a href="homework.html#%s">可视化讲解</a>' % h[0] if h[0] in hwk else NA) for h in HOMEWORK)
    labs = (OUT / 'labs' / 'index.html').is_file()
    pj = ''.join('<tr><td><b>%s</b></td><td>%s</td><td><small>%s</small></td><td>%s</td><td>%s</td><td>%s<a href="lab.html#%s">学习指南</a></td></tr>'
                 % (l.key, html.escape(l.title), PROJ_LECS.get(l.key, '—'), ext(l.official, '说明'), ext(BUSTUB, '代码库'),
                    '<a href="labs/index.html#intro:%s">逐行复原笔记</a> · ' % l.key if labs else '', l.id)
                 for l in by_page.get('lab', []))
    return ('<h2 id="res">课程资料</h2>\n<p class="lead">官方的视频、讲义、作业、代码，以及本地保存的字幕原文都在这里。外部链接在新标签页打开；表格在窄屏上可以左右滑动。</p>\n'
            '<div class="res-grid">%s</div>\n'
            '<div class="sec mat"><h3>每一讲：视频 · 讲义 · 字幕 · 笔记</h3><div class="tbl"><table><thead><tr><th>#</th><th>本站笔记</th><th>视频</th><th>Slides</th><th>Notes</th><th>字幕原文</th><th>Markdown</th><th>演示</th></tr></thead><tbody>%s</tbody></table></div></div>\n'
            '<div class="sec mat"><h3>作业与 Project</h3><div class="tbl"><table><thead><tr><th>名称</th><th>主题</th><th>对应讲次</th><th>官方</th><th>答案 / 代码</th><th>本站</th></tr></thead><tbody>%s%s</tbody></table></div>'
            '<p class="note">作业和 Project 的链接取自官方 assignments 页面；「对应讲次」是按作业主题对的，属于本笔记的归纳。</p></div>\n'
            % (tiles, ''.join(rows), hw, pj))


def page_index(chapters, by_page, report, css, js_core, by_path):
    cards = []
    for slug, kick, name, desc, _ in chapters:
        ls = by_page[slug]
        rows = ''.join('<li><a href="%s.html#%s"><em>%s</em><span>%s</span><span class="v">%s</span></a><button class="ck" type="button" data-ck="%s" title="这一讲学完了就打勾" aria-pressed="false"></button></li>'
                       % (slug, l.id, l.num, html.escape(l.title), '▶ %d' % len(l.viz) if l.viz else '', l.id) for l in ls)
        foot = ' · '.join(x for x in ('%d 讲' % len(ls), '%d 个演示' % sum(l.vizn.get(v, 1) for l in ls for v in l.viz) if any(l.viz for l in ls) else '', '%d 张图' % sum(l.ndg for l in ls)) if x)
        cards.append('<div class="pcard"><header><span class="ptag">%s</span><h3><a href="%s.html">%s</a></h3><span class="prog"></span></header>'
                     '<p class="psum">%s</p><ul class="feat">%s</ul><footer>%s</footer></div>' % (kick, slug, name, desc, rows, foot))
    where = {}
    for ls in by_page.values():
        for l in ls:
            for v in l.viz:
                where[v] = l
    rows, nsc = [], 0
    for v in report:
        l = where.get(v['id'])
        if not l:
            warn('可视化 %s 没有被任何 extras 引用' % v['id'])
            continue
        for i, sc in enumerate(v['scenes']):
            nsc += 1
            head = ('<td rowspan="%d"><a href="%s.html#viz-%s">%s %s</a><br>%s</td>' % (len(v['scenes']), l.page, v['id'], l.num, html.escape(l.title), html.escape(v['title']))) if i == 0 else ''
            rows.append('<tr>%s<td><a href="%s.html#%s">%s</a></td><td>%d</td><td>%.1fs</td><td>%s</td></tr>'
                        % (head, l.page, l.vizat.get((v['id'], i), 'viz-' + v['id']), html.escape(sc['name']), sc['steps'], sc['seconds'], html.escape(sc['moving'])))
    viz_tbl = ('<details class="sec vt"><summary>可视化演示一览：%d 个演示 / %d 个场景（点开看每个场景的步数、时长和画面里在动的东西）</summary>'
               '<div class="tbl"><table><thead><tr><th>所在讲 / 演示</th><th>场景</th><th>步数</th><th>时长(1×)</th><th>画面里哪些东西在动</th></tr></thead><tbody>%s</tbody></table></div></details>'
               % (len(where), nsc, ''.join(rows))) if rows else ''
    readme = Lec.__new__(Lec)
    readme.key, readme.page, readme.id, readme.path, readme.title = 'README', 'index', 'R', README, ''
    readme.blocks, readme.ids, readme.toc, readme.viz, readme.ndg, readme.kick, readme.num = [], set(), [], [], 0, '', ''
    readme.parse()
    for blk in readme.blocks:
        blk['html'] = re.sub(r' data-b="[^"]*"', '', fix_links(readme, by_path, blk['html']))
    about = sections([blk for blk in readme.blocks if 'class="meta"' not in blk['html']])
    return (TOP % {'title': 'CMU 15-445 数据库系统 · 中文精读笔记', 'css': css}) + '''<body data-page="index">
<header class="top"><a class="brand" href="index.html">CMU 15-445 <span>笔记</span></a><nav class="tabs"><a href="#res"><em>1</em>课程资料</a><a href="#chapters"><em>2</em>章节</a><a href="#demos"><em>3</em>演示与说明</a></nav>
<button class="tb" id="themeBtn" title="切换明暗主题">🌓</button></header>
<div class="home">
<h1>CMU 15-445/645 数据库系统</h1>
<p class="lead">从零剖开一个数据库管理系统的内部构造：25 讲中文精读笔记 + BusTub Lab 指南，自底向上，从页和缓冲池一路讲到事务、恢复和分布式。</p>
<div class="hero">
<div class="box"><h3>这套笔记里有什么</h3><ul>
<li><b>每章一个页面</b>，左侧是该章各讲和小节目录，正文一节一张卡片。</li>
<li><b>关键机制配动画演示</b>：可暂停、可单步、可回退、可调速，右侧同步显示代码、控制台和数据。</li>
<li><b>流程图、时序图、分层图</b>穿插在最需要图的小节后面。</li>
<li><b>正文可以直接改</b>：打开任意一章右上角的「编辑」，改动保存在本机浏览器，可导出。</li>
</ul></div>
<div class="box"><h3>怎么读</h3><div class="kv">
<b>完整走一遍</b><span>按第 1 章到第 9 章的顺序，每周两讲，配合对应的 Lab</span>
<b>面试速通</b><span>#03 #04 #08 #12 #13 #17 #18 #20 #21 这九讲</span>
<b>只看并发</b><span>#10 → #17 → #18 → #19 → #20 → #24</span>
<b>记进度</b><span>每讲末尾可以「标记为已读」，这里和侧边栏会打勾</span>
</div></div>
</div>
%(res)s
<h2 id="chapters">章节</h2>
<div class="cards">%(cards)s</div>
<h2 id="demos">演示与课程说明</h2>
<div class="md">
%(viz)s
%(about)s
</div>
</div>
<script>
%(js)s
</script>
</body>
</html>
''' % {'res': materials_html(by_page, chapters), 'cards': ''.join(cards), 'viz': viz_tbl, 'about': about, 'js': inline_js(js_core['dg'], js_core['notes'])}


def main():
    args = sys.argv[1:]
    only = args[args.index('--only') + 1].split(',') if '--only' in args else None
    dest = (OUT / args[args.index('--out') + 1]) if '--out' in args else OUT
    dest.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['node', str(SRC / 'report.js'), '--json'] + (only or []), capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0 and not r.stdout.strip().startswith('['):
        sys.exit('可视化校验失败：\n' + r.stdout + r.stderr)
    if r.stderr.strip():
        warn(r.stderr.strip())
    report = json.loads(r.stdout)
    VIZ.update({v['id']: v for v in report})
    viz_files = {}
    for f in sorted((SRC / 'viz').glob('*.js')):
        if only and not any(f.name.startswith(p) for p in only):
            continue
        for vid in re.findall(r"Viz\.register\(\s*'([^']+)'", f.read_text(encoding='utf-8')):
            viz_files[vid] = f
    by_page, by_path, order = {}, {}, []
    # 作业讲义（hw/HWn-*.md）还没写出来的那几次先跳过；一章一讲都没有就整章不出
    chapters = []
    for ch in CHAPTERS:
        keys = [k for k in ch[4] if not k.startswith('HW') or list(NOTES.glob('hw/%s-*.md' % k))]
        if keys:
            chapters.append((ch[0], ch[1], ch[2], ch[3], keys))
    for slug, _, _, _, keys in chapters:
        by_page[slug] = [Lec(k, slug) for k in keys]
        for l in by_page[slug]:
            by_path[l.path] = l
            lec_sources(l)
            order.append(l)
    for l in order:
        if not only or l.key in only:
            l.add_extras(viz_files)
    for l in order:
        l.add_levels()
    for l in order:
        for b in l.blocks:
            b['html'] = fix_links(l, by_path, b['html'])
    css = (SRC / 'notes.css').read_text(encoding='utf-8')
    js_core = {k: (SRC / (k + '.js')).read_text(encoding='utf-8') for k in ('anim', 'dg', 'notes')}
    gl = load_gloss({l.id: l for l in order})
    js_core['gloss'] = gloss_js(gl)
    (OUT / 'labs' / 'assets' / 'gloss.js').write_text(gloss_js(gl, '../'), encoding='utf-8', newline='\n')   # Lab 笔记共用同一份
    print('术语表 %d 条' % len(gl))
    total = 0
    for ch in chapters:
        out = page_chapter(ch, by_page[ch[0]], order, css, js_core, viz_files, chapters)
        (dest / (ch[0] + '.html')).write_text(out, encoding='utf-8', newline='\n')
        ls = by_page[ch[0]]
        total += len(out)
        print('%-22s %4d KB  %d 讲  图表 %2d  可视化 %d' % (ch[0] + '.html', len(out.encode('utf-8')) // 1024, len(ls), sum(l.ndg for l in ls), sum(len(l.viz) for l in ls)))
    idx = page_index(chapters, by_page, report, css, js_core, by_path)
    (dest / 'index.html').write_text(idx, encoding='utf-8', newline='\n')
    print('index.html             %4d KB' % (len(idx.encode('utf-8')) // 1024))
    if warnings:
        print('\n%d 条警告：' % len(warnings))
        for w in warnings:
            print('  - ' + w)


if __name__ == '__main__':
    main()
