#!/usr/bin/env node
// ============================================================================
// build-gptniang.mjs —— 由上游源码生成 GPT娘 二创版
// ============================================================================
// 设计目标：**上游文件永远保持原样**，所以 `git merge upstream/main` 不会冲突。
// 本脚本把 upstream 的 lib/index.js 与 assets/whale-widget.js 读进来，应用
// skin/gptniang-theme.mjs 的「命名空间改名 + 配色映射（默认空）+ 台词改写」，产出：
//
//   lib/gptniang-index.js    ← 宿主插件（package.json 的 main）
//   lib/gptniang-widget.js   ← 浏览器端挂件
//
// 这两份产物**提交进仓库**（这样 link: 安装能直接用，且不要求用户跑构建），
// 但永远不要手改 —— 手改会在下次构建时被覆盖。要改就改主题文件。
//
// 用法：
//   node tools/build-gptniang.mjs            # 生成
//   node tools/build-gptniang.mjs --check    # 只校验产物是最新的（CI / 提交前）
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NAMESPACE,
  RENAMES, HEX_TEXT, HEX_FILL, HEX_FILL_OVERRIDE, RGBA_MAP, EXACT, WHITE_FILL,
  COPY_REWRITE, COPY_APPEND, LONG_LINE_THRESHOLD, LONG_LINE_SIZE, COPY_FORBIDDEN,
  ISOLATION_FORBIDDEN,
} from '../skin/gptniang-theme.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_HOST = path.join(ROOT, 'upstream', 'lib', 'index.js')
const SRC_WIDGET = path.join(ROOT, 'upstream', 'assets', 'whale-widget.js')

const OUT_HOST = path.join(ROOT, NAMESPACE.hostMain)
const OUT_WIDGET = path.join(ROOT, NAMESPACE.frontendFile)

// 上游源码的「在哪里」。默认在 upstream/；也兼容「上游文件仍原地」的初始状态。
function pickSource(preferred, fallbacks) {
  for (const p of [preferred, ...fallbacks]) {
    if (fs.existsSync(p)) return p
  }
  throw new Error(
    '找不到上游源码：' + [preferred, ...fallbacks].join(' / ') +
    '\n请确认上游文件在位（lib/index.js、assets/whale-widget.js）。')
}

// —— 第 1 步：命名空间改名 ——
// 纯字面量替换。这些标识符在上游里全局唯一，不会与语言关键字或第三方 API 撞名。
function rename(text) {
  let out = text
  for (const [from, to] of RENAMES) {
    if (from === to) continue
    out = out.split(from).join(to)
  }
  return out
}

// 判定「这个 hex 是文字色还是填充色」。
// 上游同一个 hex 会同时出现在两种语义里：CSS 里 #203170 做 color: 82 次、
// 做 background: 13 次；JS 里既做 m.color 又是 m.bg。两者目标色通常不同，必须分流。
function classify(prop) {
  if (!prop) return null
  const p = prop.toLowerCase()
  // 文字/描边语义
  if (p === 'color' || p.endsWith('text-fill-color') || p === 'caret-color') return 'text'
  if (/^(peak|off)color$/.test(p)) return 'text'
  if (p === 'strokestyle') return 'text'
  // 填充语义（底线、底色、边框、阴影、画布填充）
  if (/(bg|background|fill|border|outline|shadow|accent|hex)/.test(p)) return 'fill'
  if (p === 'strokestyle') return 'fill'
  return null
}

// —— 第 2 步：配色映射 ——
// 本项目主题表默认留空 ⇒ 本函数是**恒等变换**，上游靛蓝原样保留。
// 要换皮肤就在 skin 里填表，逻辑不用动。
function recolor(text, report) {
  const unmapped = new Set()

  // ① 整族 rgba 映射（含透明度变体）。透明度原样保留；**不碰 rgb() 三元组** ——
  //    那是「跑马灯配色方案」里用户可选的 15 套渐变，属于用户内容而非界面皮肤。
  for (const [from, to] of Object.entries(RGBA_MAP)) {
    const re = new RegExp('(rgba\\()\\s*' + from.replace(/,/g, '\\s*,\\s*') + '\\s*(,)', 'g')
    text = text.replace(re, (m, head, tail) => head + to + tail)
  }

  // ② 精确站点：SVG 呈现属性（fill= / stroke=）、注释、以及需要整段定夺的地方。
  //    先跑，避免被后面的通用规则改写掉匹配串。
  for (const [from, to] of EXACT) {
    text = text.split(from).join(to)
  }

  // ③ 通用单 hex 映射：对每个 hex **向前回看最近的 属性/键名** 来定语义。
  //    一套逻辑同时覆盖三种写法：
  //      CSS   `.x{border:1px dashed #203170}`  → border
  //      JSON  `{"color": "#203170"}`           → color
  //      JS    `x.style.color = '#203170'`      → color
  //    回看以 `;`、`{`、`}`、`=` 边界截断，避免误取到上一条语句的属性名。
  const hexRe = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
  text = text.replace(hexRe, (hex, offset) => {
    const key = hex.toLowerCase()
    const before = text.slice(Math.max(0, offset - 400), offset)
    const ms = [...before.matchAll(/([A-Za-z_$][\w$]*)"?\s*(?::|=)\s*['"`]?[^;{}\n]*?$/g)]
    const prop = ms.length ? ms[ms.length - 1][1] : ''
    const kind = classify(prop)

    if (key === '#fff' || key === '#ffffff') {
      // 白：只有「白底」需要动；按钮上的「白字」必须保留（对比度靠它）
      if (kind === 'text') return hex
      if (kind === 'fill') return WHITE_FILL || hex
      return hex
    }

    const targets = new Set([HEX_TEXT[key], HEX_FILL[key], HEX_FILL_OVERRIDE[key]].filter(Boolean))
    if (targets.size === 0) return hex            // 主题表没定义这个色 ⇒ 原样保留
    if (kind === null) {
      // 上下文判不出、但两表目标一致 → 可以安全套用；否则报告待人工确认
      if (targets.size === 1) return [...targets][0]
      unmapped.add(key + ' @?' + (prop || '(none)'))
      return hex
    }
    if (kind === 'text') return HEX_TEXT[key] || (targets.size === 1 ? [...targets][0] : hex)
    return HEX_FILL_OVERRIDE[key] || HEX_FILL[key] || HEX_TEXT[key] || hex
  })

  // ④ 兜底扫描：报告仍未映射的目标色，避免静默漏改
  const leftovers = new Map()
  const allKeys = [...new Set([...Object.keys(HEX_TEXT), ...Object.keys(HEX_FILL)])]
  for (const key of allKeys) {
    if (key === '#fff' || key === '#ffffff') continue
    const re = new RegExp(key + '\\b', 'gi')
    const n = (text.match(re) || []).length
    if (n) leftovers.set(key, n)
  }
  if (leftovers.size) report.leftovers = leftovers
  if (unmapped.size) report.unmapped = unmapped
  return text
}

// —— 第 3 步：台词替换 ——
// 上游把同一份台词池在源码里放了 4 份副本（1 活跃 + 2 兜底 + 1 死代码）。
// 用全局字面量替换一次性覆盖全部副本，避免「改了不生效」。
function rewriteCopy(text, report) {
  let out = text
  const missed = []
  for (const [from, to] of Object.entries(COPY_REWRITE)) {
    if (from === to) continue
    const n = out.split(from).length - 1
    if (n === 0) { missed.push(from); continue }
    out = out.split(from).join(to)
  }
  report.copyMissed = missed

  // 长句自动降字号：上游对 25+ 字符的句子手配 size:7。
  // ⚠️ 必须区分两种形态，否则会把 JSON 写坏：
  //    ① JSON（BUBBLE_DEFAULT_ITEMS）：键名带引号 —— 只能用 `, "size": N`
  //    ② JS 对象（兜底函数）：键名裸写 —— 只能用 `, size: N`
  // 而且只在该句后面 140 字符内**还没有 size** 时才补，避免重复插入。
  if (LONG_LINE_THRESHOLD) {
    for (const to of Object.values(COPY_REWRITE)) {
      if (to.length < LONG_LINE_THRESHOLD) continue
      const esc = to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // ① JSON 形态
      out = out.replace(
        new RegExp('("t":\\s*)(")' + esc + '\\2(?![\\s\\S]{0,140}?"size")', 'g'),
        (m, head, q) => head + q + to + q + ', "size": ' + LONG_LINE_SIZE)
      // ② JS 对象形态
      out = out.replace(
        new RegExp('(\\bt:\\s*)(["\'])' + esc + '\\2(?![\\s\\S]{0,140}?\\bsize:)', 'g'),
        (m, head, q) => head + q + to + q + ', size: ' + LONG_LINE_SIZE)
    }
  }
  return out
}

// —— 第 4 步：追加新增台词 ——
// 把 COPY_APPEND 插进活跃台词池（BUBBLE_DEFAULT_ITEMS 里那个 lines 数组）。
// 只插活跃副本：兜底副本保持原样即可，它们是「常量解析失败」时的历史参照。
function appendCopy(text, report) {
  if (!COPY_APPEND.length) return text
  const KEY = '"type":  "random",'
  const idx = text.indexOf(KEY)
  if (idx < 0) { report.appendSkipped = '找不到活跃台词池'; return text }
  const linesKey = text.indexOf('"lines":', idx)
  if (linesKey < 0) { report.appendSkipped = '找不到 lines 数组'; return text }
  const open = text.indexOf('[', linesKey)
  let depth = 0, end = -1
  for (let k = open; k < text.length; k++) {
    const c = text[k]
    if (c === '[') depth++
    else if (c === ']') { depth--; if (depth === 0) { end = k; break } }
  }
  if (end < 0) { report.appendSkipped = 'lines 数组未闭合'; return text }

  const indent = '                                                                           '
  const items = COPY_APPEND.map(x => {
    const sz = x.size != null ? x.size
      : (x.t.length >= LONG_LINE_THRESHOLD ? LONG_LINE_SIZE : null)
    const size = sz != null ? `, "size": ${sz}` : ''
    return `${indent}{ "t": ${JSON.stringify(x.t)}, "w": ${x.w}, "bold": true${size} }`
  }).join(',\n')
  const before = text.slice(0, end).replace(/\s*$/, '')
  const after = text.slice(end)
  report.appended = COPY_APPEND.length
  return before + ',\n' + items + '\n' + indent.slice(0, -8) + after
}

// —— 第 5 步：活跃池断言 ——
// 只报「一条都没找到」是不够的：台词池有 4 份副本，若上游只改了**活跃那份**的措辞，
// 其余副本仍能命中，于是静默漏改 —— 界面上就是「改了不生效」。
// 这里直接解析**产物里的活跃台词池**（BUBBLE_DEFAULT_ITEMS），逐个断言。
function assertActivePool(widget, report) {
  const start = widget.indexOf('var BUBBLE_DEFAULT_ITEMS = [')
  if (start < 0) { report.poolError = '产物里找不到 BUBBLE_DEFAULT_ITEMS'; return }
  const end = widget.indexOf('\n];', start)
  if (end < 0) { report.poolError = 'BUBBLE_DEFAULT_ITEMS 数组未闭合'; return }
  let items
  try {
    const raw = widget.slice(start + 'var BUBBLE_DEFAULT_ITEMS = '.length, end + 2).replace(',\n]', ']')
    items = JSON.parse(raw)
  } catch (err) {
    report.poolError = '活跃池 JSON 解析失败（构建把语法写坏了）：' + err.message
    return
  }
  const pool = items[1].options[0].item.modules[0].lines
  const texts = pool.map(x => String(x.t))
  report.poolCount = texts.length

  // ① 原句残留 = 漏改
  const leaked = Object.keys(COPY_REWRITE).filter(src => texts.includes(src))
  // ② 新句缺失（源句与替换句可能是「前缀」关系，故用包含判定，避免误报）
  const missing = Object.values(COPY_REWRITE).filter(dst => {
    const core = dst.replace(/[\.。…！!？?]+$/, '')
    return !texts.some(t => t === dst || t.includes(core))
  })
  // ③ 追加缺失
  const missingAppend = COPY_APPEND.map(x => x.t).filter(t => !texts.includes(t))
  // ④ 特征残留：不依赖具体措辞，能抓住「上游改了字导致替换表失配」的情况
  const residual = []
  for (const t of texts) {
    for (const re of COPY_FORBIDDEN) {
      if (re.test(t)) { residual.push({ t, re: String(re) }); break }
    }
  }
  if (residual.length) report.poolResidual = residual
  if (leaked.length) report.poolLeaked = leaked
  if (missing.length) report.poolMissing = missing
  if (missingAppend.length) report.poolMissingAppend = missingAppend
}

// —— 第 6 步：命名空间隔离断言 ——
// 这是「能与其它桌宠并行」的机械保证：产物里只要还剩任何一个上游命名空间标识，
// 就说明 RENAMES 漏了一条规则 —— 那会在同机上与上游挂件抢路由 / 抢 DOM class /
// 抢 localStorage 键，而且**不会报错**，只会静默互相踩。
function assertIsolation(host, widget, report) {
  const hits = []
  for (const [name, text] of [['lib/gptniang-index.js', host], ['lib/gptniang-widget.js', widget]]) {
    for (const needle of ISOLATION_FORBIDDEN) {
      let n = 0, at = -1
      for (;;) {
        const i = text.indexOf(needle, at + 1)
        if (i < 0) break
        n++; at = i
      }
      if (n) hits.push({ where: name, needle, n })
    }
  }
  if (hits.length) report.isolationHits = hits
}

function build() {
  const hostSrc = pickSource(SRC_HOST, [
    path.join(ROOT, 'lib', 'index.js'),
    path.join(ROOT, 'lib', 'upstream-index.js'),
  ])
  const widgetSrc = pickSource(SRC_WIDGET, [
    path.join(ROOT, 'assets', 'whale-widget.js'),
    path.join(ROOT, 'assets', 'upstream-widget.js'),
  ])

  const report = {}
  const banner = (what, from) =>
    '// ⚠️ 本文件由 tools/build-gptniang.mjs 生成，请勿手改。\n' +
    '// 上游源：' + path.relative(ROOT, from) + '\n' +
    '// 要改命名空间/配色/台词：改 skin/gptniang-theme.mjs 后重新构建。\n' +
    '// ' + what + '\n'

  const host = banner('宿主侧插件（GPT娘版）', hostSrc) +
    recolor(rename(fs.readFileSync(hostSrc, 'utf8')), report)
  const widget = appendCopy(
    rewriteCopy(
      recolor(rename(fs.readFileSync(widgetSrc, 'utf8')), report),
      report),
    report)

  assertActivePool(widget, report)
  assertIsolation(host, widget, report)
  return { host, widget, report, hostSrc, widgetSrc }
}

const check = process.argv.includes('--check')
const { host, widget, report, hostSrc, widgetSrc } = build()

const same = (p, next) => fs.existsSync(p) && fs.readFileSync(p, 'utf8') === next
const stale = []
if (check) {
  if (!same(OUT_HOST, host)) stale.push(path.relative(ROOT, OUT_HOST))
  if (!same(OUT_WIDGET, widget)) stale.push(path.relative(ROOT, OUT_WIDGET))
}
// ⚠️ --check 也必须走完下面的**台词池 + 隔离**校验再退出，
// 否则 CI 永远看不到这两类断言（上游改了台词措辞会被静默放过）。

if (!check) {
  fs.mkdirSync(path.dirname(OUT_HOST), { recursive: true })
  fs.writeFileSync(OUT_HOST, host)
  fs.writeFileSync(OUT_WIDGET, widget)
  console.log('✓ 已生成')
  console.log('  ' + path.relative(ROOT, hostSrc) + '  → ' + path.relative(ROOT, OUT_HOST))
  console.log('  ' + path.relative(ROOT, widgetSrc) + '  → ' + path.relative(ROOT, OUT_WIDGET))
}

if (report.leftovers) {
  console.log('\n⚠️ 仍有目标色未映射（请检查是否漏了语义分支）：')
  for (const [c, n] of [...report.leftovers].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${c}  ×${n}`)
  }
}
if (report.copyMissed && report.copyMissed.length) {
  console.log('\n⚠️ 以下台词在源码里没找到（上游可能改过措辞，请更新主题表）：')
  for (const m of report.copyMissed) console.log('   ' + JSON.stringify(m))
}
if (report.appended) console.log('\n✓ 已追加快捷台词 ' + report.appended + ' 条')
if (report.poolCount != null) console.log('✓ 活跃台词池共 ' + report.poolCount + ' 条')
if (report.poolError) console.log('\n✗ ' + report.poolError)
if (report.poolLeaked) {
  console.log('\n✗ 活跃池里仍有未替换的原句（上游可能改过措辞，请更新 COPY_REWRITE）：')
  for (const x of report.poolLeaked) console.log('   ' + JSON.stringify(x))
}
if (report.poolMissing) {
  console.log('\n✗ 活跃池里缺少这些新句（替换没落到活跃副本上）：')
  for (const x of report.poolMissing) console.log('   ' + JSON.stringify(x))
}
if (report.poolResidual) {
  console.log('\n✗ 活跃池里仍有上游身份特征（上游可能改过措辞导致替换失配）：')
  for (const r of report.poolResidual) console.log('   ' + r.re + ' 命中 ' + JSON.stringify(r.t))
}
if (report.poolMissingAppend) {
  console.log('\n✗ 活跃池里缺少追加台词：')
  for (const x of report.poolMissingAppend) console.log('   ' + JSON.stringify(x))
}
if (report.isolationHits) {
  console.log('\n✗ 命名空间隔离失败 —— 产物里仍有上游标识（会与上游挂件抢路由/DOM/存储）：')
  for (const h of report.isolationHits) console.log(`   ${h.where}  含 ${h.needle}  ×${h.n}`)
}

const hardFail = report.poolError || report.poolLeaked || report.poolMissing ||
  report.poolMissingAppend || report.poolResidual || report.isolationHits
const staleFail = stale.length > 0
if (staleFail) {
  console.error('✗ 构建产物不是最新的：\n  ' + stale.join('\n  '))
  console.error('  请运行：node tools/build-gptniang.mjs')
}
if (hardFail) console.error('\n✗ 台词池 / 隔离校验失败（见上）')
if (check) {
  if (!hardFail && !staleFail) console.log('\n✓ 构建产物是最新的，台词池与隔离校验通过')
  process.exit(hardFail || staleFail ? 1 : 0)
}
if (hardFail) process.exitCode = 1

if (report.appendSkipped) console.log('\n⚠️ 追加台词跳过：' + report.appendSkipped)
if (report.unmapped) {
  console.log('\n⚠️ 声明属性未在 TEXT/FILL 表里定义目标色：')
  for (const u of report.unmapped) console.log('   ' + u)
}