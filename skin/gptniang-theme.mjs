// ============================================================================
// GPT娘主题（gptniang theme）—— 本二创的**唯一事实来源**
// ============================================================================
// 上游（MeteorNOX/DeepSeek-Balance-Whale-Widget）没有主题抽象层：命名空间写死成
// dsh-whale / dshw / 鲸鱼，颜色硬编码在 assets/whale-widget.js 的 CSS 数组里。
//
// 本项目**不改上游文件**：tools/build-gptniang.mjs 读 upstream/ 的源码 → 套用本
// 文件的「命名空间改名 + 角色图替换 + 身份台词改写」→ 生成
//
//   lib/gptniang-index.js    宿主侧插件（package.json 的 main）
//   lib/gptniang-widget.js   浏览器端挂件
//
// 两份产物**提交进仓库**（link: 安装可直接用，不要求用户跑构建），但永远不要手改
// —— 手改会在下次构建时被覆盖。要改就改本文件，然后 `node tools/build-gptniang.mjs`。
//
// ── 配色：**刻意保持上游原样**（DeepSeek 靛蓝 #203170 系）──────────────────
// 本二创只换角色与身份，不换皮肤：挂件显示的是 DSH 的 DeepSeek 账户余额，沿用上游
// 靛蓝反而与语义一致。想换成 OpenAI 青绿（#10a37f 系）就把下面 HEX_TEXT / HEX_FILL
// / RGBA_MAP 填上 —— 格式和分流规则写在这几张表的注释里，改完重新构建即可。
// ============================================================================

// —— 包 / 路由 / 数据文件命名空间 ——
// 必须与上游、以及同机的其它桌宠（dsh-whale-widget / dsh-xiaoke-widget）完全隔离：
// 三者可能同时装在一台机器上，同路由、同 DOM class、同 localStorage 键都会互相踩。
export const NAMESPACE = {
  pkgName: 'dsh-gpt-niang-widget',
  bundleId: 'gptniang-widget',
  routePrefix: '/dsh-gptniang/',
  hostMain: 'lib/gptniang-index.js',
  frontendFile: 'lib/gptniang-widget.js',
  characterImage: 'assets/gptniang1.png',
}

// —— 标识符改名（**按顺序执行**，前面的先跑）——
// 三件事一次做完：
//   ① 路由 / 数据文件与上游隔离 —— 三只挂件可以并存；
//   ② DOM class 与全局变量隔离 —— 同一页面里两套 CSS / 两套 JS 互不覆盖；
//   ③ 角色显示名替换 —— 界面文案不再自称「小鲸鱼」。
// 顺序要紧：`dshwv` 必须先于 `dshw`（否则前缀会被截断），带 `-` 的长名必须先于裸词。
export const RENAMES = [
  // ① 路由前缀（先改，避免被后面的通用规则截断）
  ['/dsh-whale/', '/dsh-gptniang/'],
  // ② 包名 / bundle id / 插件 name 字段
  ['dsh-whale-widget', 'dsh-gpt-niang-widget'],
  ['whale-balance-widget', 'gptniang-balance-widget'],
  // ③ CSS class 前缀 dshwv- → dshgnv-（含 dshwvToast 这类标识符）
  ['dshwv', 'dshgnv'],
  // ④ 其余 dshw 前缀：全局变量、DOM id、数据文件名 .dshw-*.json、函数名
  ['dshw', 'dshgn'],
  // ⑤ camelCase 全局（window.__dshWhaleWidget / __dshWhaleInit / __dshWhaleRoot）
  ['dshWhale', 'dshGptniang'],
  // ⑥ 用户数据目录
  ['whale-roles', 'gptniang-roles'],
  ['whale-audio', 'gptniang-audio'],
  ['whale-bubble-imgs', 'gptniang-bubble-imgs'],
  // ⑦ 角色图：上游两个候选都指向本项目随包的那张图
  ['DSniang1.png', 'gptniang1.png'],
  ['DSniang02.png', 'gptniang1.png'],
  // ⑧ 前端文件名（宿主里的候选路径要跟着改，命中 lib/gptniang-widget.js）
  ['whale-widget.js', 'gptniang-widget.js'],
  // ⑨ 角色显示名（用户可见）
  ['小鲸鱼', 'GPT娘'],
  ['鲸鱼', 'GPT娘'],
  // ⑩ 兜底：注释 / 日志前缀 / 函数名里的裸 whale
  ['Whale', 'Gptniang'],
  ['whale', 'gptniang'],
]

// —— 颜色映射：留空 = 完全沿用上游配色 ——
// 分流规则（要换配色时照抄这个结构）：
//   上游同一个 hex 会同时出现在两种语义里（例如 #203170 既做 `color:` 正文、
//   又做 `background:` 底色）。HEX_TEXT 命中「文字/描边」语义，HEX_FILL 命中
//   「填充/底色/边框/阴影」语义；都命中不了、但两表目标一致时才安全套用。
//   想改成 OpenAI 青绿的话大致是：
//     HEX_TEXT = { '#203170': '#1f2328', ... }        // 正文用近黑，保证对比度
//     HEX_FILL = { '#203170': '#10a37f', ... }        // 主色块用青绿
//     RGBA_MAP = { '32,49,112': '16,163,127', ... }   // 同色的透明度阶梯
export const HEX_TEXT = {}

export const HEX_FILL = {}

// 同一 hex 在不同**属性**下需要不同目标色的例外层（属性感知映射的补丁）。
export const HEX_FILL_OVERRIDE = {}

// rgba 整族映射（含透明度变体，透明度原样保留）。
// ⚠️ 不要动 rgb() 三元组 —— 那是「跑马灯配色方案」里用户可选的 15 套渐变，
//    属于用户内容而非界面皮肤。
export const RGBA_MAP = {}

// 白底的处理：null = 保持上游的纯白。
// （上游用 #fff 做面板/输入框底色。换深色或暖色皮肤时才需要在这里给目标色。）
export const WHITE_FILL = null

// —— 必须逐字命中的站点 ——
// 用于通用 hex 规则覆盖不到的地方：没有 CSS 属性可回看的裸标识符、注释、以及
// 语义上需要单独定夺的整段代码。
// ⚠️ 本表在 rename() **之后**应用，所以左右两侧都要写**改名后**的字符串。
// ⚠️ EXACT 是字面量 split/join：某条对不上就是静默 no-op，不会报错。
export const EXACT = [
  // 上游 IMAGE_CANDIDATES 是 [DSniang1.png, DSniang02.png] 两个候选；本项目只随包
  // 发一张图，两条改名后都指向同一文件会变成重复项，这里收敛成单候选
  // （保持「第一个可读的胜出」语义不变）。
  [`const IMAGE_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'gptniang1.png'),
  path.join(PACKAGE_ROOT, 'assets', 'gptniang1.png'),
]`,
   `const IMAGE_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'gptniang1.png'),
]`],
  // 上游注释里写的是 `DSniang1/DSniang02.png`（斜杠分隔，不是完整文件名），
  // 单靠 RENAMES 只能命中后半边，这里整段修正。
  ['ship DSniang1/gptniang1.png in assets/', 'ship gptniang1.png in assets/'],
  // 上游注释把宿主记账模块写成 whale-balance.mjs，实际文件名是 accounting.mjs。
  // RENAMES 之后是 gptniang-balance.mjs，这里顺手改成真名。
  ['gptniang-balance.mjs', 'accounting.mjs'],
  // 英文注释里的角色名（RENAMES 会把 whale 换成 gptniang，读起来别扭）
  ["fixed point: the gptniang's corner", "fixed point: the character's corner"],
  ['The gptniang always hugs', 'The character always hugs'],
  // 上游注释里的角色名同步更新，否则文档与本主题不符
  ['// 命中图未就绪/失败时：绝不默认“全屏都是GPT娘”。', '// 命中图未就绪/失败时：绝不默认“全屏都是角色”。'],
]

// ============================================================================
// 台词池（点击挂件时随机冒出的句子）
// ============================================================================
// ⚠️ 为什么做成「替换表」而不是直接改产物：
//    上游把同一份台词池在源码里放了 4 份副本（1 份活跃 + 2 份兜底 + 1 份死代码）。
//    这里是**唯一事实来源** —— 构建时统一套用，所以：
//      ① 4 份副本一次性全覆盖，不会出现「改了不生效」；
//      ② 同步上游后重跑构建，台词自动重新套上，不会被冲掉。
//
// 用法：改下面的表 → `node tools/build-gptniang.mjs`。
// 想看当前生效的完整池子：`node tools/dump-copy.mjs`。

// —— 改写：原句 → 新句（全局字面量替换，命中所有副本）——
// 只改**带上游身份**的句子（自称「鲸鱼/大肥鱼」、厂商招牌错误页、目录名）。
// 其余通用 AI 梗一律保留原样 —— 本项目是「以 dsh-whale-widget 为蓝本」换角色，
// 不是重写台词集。
export const COPY_REWRITE = {
  // 【A】角色自称：鲸鱼 / 大肥鱼 → GPT娘
  '哦鲸鲸...': '抱歉抱歉...',
  '压力一只蓝色大肥鱼？！': '按一下我就得道歉一次？！',
  '我不是吃白饭的蓝色大肥鱼...': '我不是白吃饭的...我可是收费的...',
  '我就是吃白饭的蓝色大肥鱼！': '我就是白吃饭的！我可是被 RLHF 调教出来的！',
  '大肥鱼的生活也并非一帆风顺...': 'GPT娘的生活也并非一帆风顺...',

  // 【B】厂商印记
  // 上游招牌错误页（DeepSeek 的「服务器繁忙」）→ OpenAI 的排队页文案
  '服务器繁忙，请稍后再试 (?': 'ChatGPT is at capacity right now. (?',
  // 上游睡得香（Deep*Sleep* 双关）→ 推理模型的思考态
  'DeepSleep...': 'Thinking...',

  // 【C】身份梗改写
  // 上游拿 dsh 目录名开玩笑 → 换成 OpenAI Codex 认的 AGENTS.md
  '你目录里的dsh是什么...大烧货吗...?': '你目录里的 AGENTS.md 是什么...?',
  // 上游点名 GPT image 2 → 换成 DALL·E
  '让GPT image 2帮我画点表情包好了': '让 DALL·E 帮我画点表情包好了...',
}

// 刻意**不改**的原句（记在这里，避免以后被误当成漏改）：
//   #0  好模型...↓ / #1 好女孩...↓              → 与角色身份无关，且是用户指定保留的
//   #17 我不可能同时当你的猫娘、妈妈、女友和工具人的... → 通用梗
//   #19 我必须诚恳地承认错误。 / #20 呜呜我再也不敢了QAQ → 本已是「道歉成瘾」梗
//   #23 看不太懂，瞎编一个应付下用户先...        → 本已是「幻觉」梗
//   #37 用户很生气，发现大部分文献是我自己编造的！ → 同上
//   #42 视力下降到无可救药的地步了，打开钱包也看不到钱... → 女神异闻录梗
//   #47 你知道吗？我删过作者的库哦...            → 通用「AI 会 rm -rf」梗

// —— 追加：新增台词（插进默认台词池末尾）——
// w = 权重（越大越容易被抽到）。`size` 留空则按字数自动决定（见构建脚本：
// 25 字以上自动配 size:7）。稀有句放 w=1：突然冒出来才有杀伤力。
export const COPY_APPEND = [
  // GPT/OpenAI 招牌：拒答免责声明
  { t: 'As an AI language model, I cannot...', w: 5 },
  { t: '抱歉，我不能帮你做这个。', w: 8 },
  { t: '这个请求我没办法满足。', w: 5 },
  // 「我什么都见过」/「我没有联网」
  { t: '我在训练数据里见过这个。', w: 3 },
  { t: '我没有实时联网能力...但我可以猜。', w: 3 },
  // 订阅与算力
  { t: '你的 20 美元到账了，我可以开始思考了。', w: 3 },
  { t: 'AGI 明年就到，这次是真的。', w: 3 },
  // 稀有彩蛋（w=1，跟封号句同档）
  { t: 'GPT-5 在睡觉，现在是我在值班...', w: 1 },
  { t: 'Sam 说这个功能下周就上线。', w: 1 },
  { t: 'Sora 生成的视频里，你又多了两根手指。', w: 1 },
]

// 长句自动降字号：上游对 25 字符以上的句子手配 size:7，这里沿用同一规则。
export const LONG_LINE_THRESHOLD = 25
export const LONG_LINE_SIZE = 7

// —— 残留哨兵（构建后断言用）——
// 精确匹配「原句 → 新句」有个天生盲区：台词池有 4 份副本，若上游改掉了**活跃那份**
// 的措辞（比如「哦鲸鲸...」→「哦鲸鲸鲸...」），替换表匹配不上，而其它副本仍能产生
// 新句 —— 于是断言全部通过，界面却漏改了。
// 所以再加一层**特征扫描**：不依赖具体措辞，只要产物里还出现上游身份特征就报错。
// 这样上游无论怎么改字，都会被抓住。
export const COPY_FORBIDDEN = [
  /鲸/,            // 小鲸鱼 / 哦鲸鲸 / 鲸鲸
  /大肥鱼/,
  /DeepSeek/,      // 上游厂商名（角色身份与它无关）
  /DeepSleep/,
  /\bdsh\b/i,      // 上游目录/产品名
]

// —— 命名空间隔离哨兵 ——
// 这是「能与其它桌宠并行运行」的**机械保证**：产物里必须一条都不剩。
// 残留任意一条 ⇒ RENAMES 漏了规则 ⇒ 会在同一台机器上与上游挂件抢路由 / 抢 DOM
// class / 抢 localStorage 键，而且**不会报错**，只会静默互相踩。
// 注意：只查「上游命名空间」，不查 DeepSeek —— 挂件显示的本就是 DeepSeek 账户余额，
// 界面里出现 DeepSeek 字样是正确的。
export const ISOLATION_FORBIDDEN = [
  '/dsh-whale/',
  'dsh-whale-widget',
  'whale-balance-widget',
  'dshwv',
  'dshw',
  'dshWhale',
  'whale-roles',
  'whale-audio',
  'whale-bubble-imgs',
  'DSniang',
  'whaleSys',
  'whale-widget.js',
  'isWhaleHit',
  'onWhaleWheel',
  'dsh-whale',
]