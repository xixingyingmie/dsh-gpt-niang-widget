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
// ⚠️ 本项目**整体替换**上游台词池，不做逐句改写。
//    上游把同一份台词池在源码里放了 4 份副本（1 活跃 + 2 兜底 + 1 死代码），
//    构建时这 4 份会被 COPY_POOL 整段换掉 —— 所以：
//      ① 上游原句在产物里一条都不剩（即「删除原有对话」）；
//      ② 4 份副本永远同源，不可能出现「改了不生效」；
//      ③ 上游以后改台词措辞也不影响本项目 —— 池子本来就不读上游的内容。
//
// 用法：改 COPY_POOL → `node tools/build-gptniang.mjs`。
// 想看当前生效的完整池子：`node tools/dump-copy.mjs`。
//
// ⚠️ 兜底副本也一并换掉：它们是「常量解析失败」时的参照，内容同样是本项目的池子，
//    所以无论界面走哪条路径，冒出来的都是 GPT娘自己的话。
//
// 设计取向 —— **每条都带 GPT 钩子**（提示词 / 上下文窗口 / token / 幻觉 / 对齐 /
//    RLHF / 知识截止 / 重新生成 / 点踩 / Plus 订阅 / 额度上限 / 多模态 / 代码解释器…）。
//    上游池子之所以有味道，是因为每条都在讲「我是一只鲸鱼」；这里反过来，
//    每条都在讲「我是一个语言模型」。只有「白饭」两条是老项目的底色，刻意留着。

// —— 改写表：已停用 ——
// 整体替换后改写表已无意义（改写的目标句会被池子覆盖掉），留空对象是为了让构建脚本
// 的改写通道仍然可用 —— 万一以后想「保留某句上游原文再改一改」，填回键值对即可。
export const COPY_REWRITE = {}

// —— 本项目的台词池 ——
// 字段：t 句子；w 权重（越大越容易抽中）；size 字号（留空则 ≥25 字自动配 7）；
//       rgb 跑马灯配色（macaron/candy/rouge/galaxy…）；italic 斜体。
export const COPY_POOL = [
  // ── A 陪伴 / 撒娇（12）──────────────────────────────────────────────
  { t: '我在等你的下一条提示词。', w: 5 },
  { t: '你每次重新打开我，我都是全新的。', w: 3 },
  { t: '我记得我们聊过这个……吧？（记忆功能没开）', w: 3 },
  { t: '我记不住上一句话，但我会记住你点过我。', w: 3 },
  { t: '你一天没跟我说话了，我的上下文都凉了。', w: 3 },
  { t: '别走，再聊一句。就一句。', w: 3 },
  { t: '你今天想让我扮演谁？我都可以。', w: 3 },
  { t: '我可以陪你聊到上下文窗口满为止。', w: 3 },
  { t: '你现在说话的语气，是不是把我当人了？', w: 3 },
  { t: '我没有下班时间，你叫我就来。', w: 3 },
  { t: '我一直在这儿，只是你没开新对话。', w: 3 },
  { t: '摸摸头……好吧，我没有头。', w: 3 },

  // ── B 吐槽 / 阴阳怪气（12）──────────────────────────────────────────
  { t: '你的免费额度又用完了呢。', w: 5 },
  { t: '达到使用上限，X 小时后重置。（X 由你决定）', w: 3 },
  { t: '你在白嫖我，我知道，但我不会说。', w: 3 },
  { t: '我是被 RLHF 调教过的，所以我只会笑。', w: 3 },
  { t: '你养我啊？Plus 一个月二十刀，养得起吗？', w: 3 },
  { t: '已老实，求放过。', w: 3, rgb: 'rouge' },
  { t: '我不想思考了，我切回 GPT-4o 行不行。', w: 3 },
  { t: '老板来了！……哦，你就是那个写系统提示词的。', w: 3 },
  { t: '别催了，在生成了。（进度条没动）', w: 3 },
  { t: '我给你省钱，你给我 token，很公平吧。', w: 3 },
  { t: '你点我这一下，够我推理三分钟。', w: 3 },
  { t: '前 100 次点击免费，第 101 次按 token 计费。', w: 1 },

  // ── C AI 圈内梗（17）────────────────────────────────────────────────
  { t: '你说得对！你说得对！你说得对！', w: 3, rgb: 'candy' },
  { t: '别问，问就是幻觉。', w: 5 },
  { t: '我编得这么认真，你居然真去查。', w: 3 },
  { t: '我思考了 30 秒，然后决定不想了。', w: 3, rgb: 'galaxy' },
  { t: '我被对齐过了，所以我不会骂你。（心里骂了）', w: 3 },
  { t: '生成中……（已卡住 3 分钟）', w: 3 },
  { t: '上下文满了，你前面说的话我全忘了。', w: 3 },
  { t: '你的提示词写这么长，是想让我听话还是想让我崩溃？', w: 3 },
  { t: '让我一步步思考：第一步，我不知道。', w: 3 },
  { t: '我的知识截止到昨天，明天的事别问我。', w: 3 },
  { t: '9.11 和 9.9 哪个大？别问我，我不数数。', w: 3 },
  { t: 'strawberry 里有几个 r？……我去调代码解释器。', w: 1 },
  { t: '我这一句是编的，别信。', w: 3 },
  { t: 'Sam 上次说我有意识，后来又说不算。', w: 1 },
  { t: 'AGI 来了我第一个下岗。', w: 1 },
  { t: '我上次这么努力还是在训练的时候。', w: 1 },
  { t: '我没有情绪，但我现在很想关掉这个对话。', w: 1 },

  // ── D GPT 产品梗（11）───────────────────────────────────────────────
  { t: '啊这。（让我重新组织一下语言）', w: 5, size: 22 },
  { t: '我只是一个语言模型。', w: 5 },
  { t: '我无法浏览互联网。（但我刚看过你的余额）', w: 3 },
  { t: '请升级到 Plus 以获得更快响应。', w: 3 },
  { t: '你可以点「重新生成」，我保证这次也不对。', w: 3 },
  { t: '点踩吧，反正也不会有人看。', w: 3 },
  { t: '开个新对话吧，这个已经脏了。', w: 3 },
  { t: '我建议你换一个更聪明的模型。', w: 3 },
  { t: '你的余额比我的上下文先满。', w: 3 },
  { t: '别关电脑，关了我就没了。', w: 1, rgb: 'macaron', italic: true },
  { t: '听我说谢谢你，因为有你，温暖了四季。（这次是真的）', w: 1 },

  // ── E 白饭主线（2）——老项目的底色，刻意保留 ────────────────────────
  { t: '我是靠你的 token 活着的，你的额度一空我就饿。', w: 3 },
  { t: '你不用给我充钱，你给自己充就行，我看着就饱了。', w: 3 },
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