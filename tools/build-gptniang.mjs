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
  COPY_REWRITE, COPY_POOL, LONG_LINE_THRESHOLD, LONG_LINE_SIZE, COPY_FORBIDDEN,
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

// —— 第 4 步：整体替换台词池 ——
// 上游把同一份池子放了 4 份副本，这里**整段换掉**（不是追加、也不是逐句改写）：
//   ① 活跃池：BUBBLE_DEFAULT_ITEMS 里 `"type":  "random",` 之后的 "lines" 数组（JSON 形态）
//   ② bubbleDefaultRandomLines() 里的裸 `return [ ... ]`（JS 对象形态，没有 lines: 键）
//   ③④ 另外两个 `lines: [` 兜底数组（JS 对象形态）
// 断言恰好 4 处、且全部换到 —— 这是「改了不生效」的机械防线。
function matchArray(s, open) {
  let depth = 0, q = null
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === '\\') { i++; continue } if (c === q) q = null; continue }
    if (c === '"' || c === "'") { q = c; continue }
    if (c === '[') depth++
    else if (c === ']') { depth--; if (depth === 0) return i }
  }
  return -1
}

// 产物里 4 处台词池数组的位置（构建前后都可用，第 5 步断言也用它）
function locatePools(text) {
  const raw = []
  const add = (open, jsonForm, tag) => {
    if (open < 0) return
    const close = matchArray(text, open)
    if (close < 0) return
    raw.push({ open, close, jsonForm, tag, body: text.slice(open + 1, close) })
  }
  const KEY = '"type":  "random",'
  const idx = text.indexOf(KEY)
  if (idx >= 0) {
    const lk = text.indexOf('"lines":', idx)
    if (lk >= 0) add(text.indexOf('[', lk), true, '活跃池')
  }
  const fnA = text.indexOf('function bubbleDefaultRandomLines(')
  if (fnA >= 0) {
    const ret = text.indexOf('return [', fnA)
    if (ret >= 0 && ret - fnA < 4000) add(ret + 'return '.length, false, 'bubbleDefaultRandomLines')
  }
  let at = 0, n = 0
  for (;;) {
    const i = text.indexOf('lines: [', at)
    if (i < 0) break
    add(i + 'lines: '.length, false, 'lines[' + (n++) + ']')
    at = i + 1
  }
  raw.sort((a, b) => a.open - b.open)
  const out = []
  for (const f of raw) if (!out.length || f.open > out[out.length - 1].close) out.push(f)
  return out
}

// 渲染新池：长句自动降字号；缩进沿用原处，尽量少动 diff
function poolBody(body, jsonForm) {
  const indent = (body.match(/\n([ \t]*)\S/) || [])[1] || '  '
  const closeIndent = (body.match(/\n([ \t]*)$/) || [])[1] || ''
  const items = COPY_POOL.map(x => {
    const sz = x.size != null ? x.size
      : (x.t.length >= LONG_LINE_THRESHOLD ? LONG_LINE_SIZE : null)
    if (jsonForm) {
      let o = '{ "t": ' + JSON.stringify(x.t) + ', "w": ' + x.w + ', "bold": true'
      if (sz != null) o += ', "size": ' + sz
      if (x.rgb) o += ', "rgb": ' + JSON.stringify(x.rgb) + ', "color": ""'
      if (x.italic) o += ', "italic": true'
      return indent + o + ' }'
    }
    let o = '{ t: ' + JSON.stringify(x.t) + ', w: ' + x.w + ', bold: true'
    if (sz != null) o += ', size: ' + sz
    if (x.rgb) o += ', rgb: ' + JSON.stringify(x.rgb)
    if (x.italic) o += ', italic: true'
    return indent + o + ' }'
  })
  return '\n' + items.join(',\n') + '\n' + closeIndent
}

function replaceCopyPools(text, report) {
  const pools = locatePools(text)
  if (pools.length !== 4) {
    report.poolError = '台词池副本定位失败：期望 4 处，实际 ' + pools.length +
      '（' + pools.map(p => p.tag).join(' / ') + '）'
    return text
  }
  let out = text
  // 从后往前替换，前面的下标才不会失效
  for (const p of [...pools].sort((a, b) => b.open - a.open)) {
    out = out.slice(0, p.open + 1) + poolBody(p.body, p.jsonForm) + out.slice(p.close)
  }
  report.poolsReplaced = pools.length
  report.poolCount = COPY_POOL.length
  report.poolTags = pools.map(p => p.tag)
  return out
}

// —— 第 4b 步：老 RANDOM_GROUPS ——
// 这是第 5 处台词存放地，结构和其他 4 处不同：不是 `lines: [...]` 数组，而是
// 「按权重分组、每组一个 lines: function(){ return singleCenter(..., pickOne([...])) }」。
// 默认配置下这条路径**不可达**（默认序列的 item.kind 是 'custom'，走模块引擎），
// 但里面装的仍是上游台词 —— 留着就等于产物里还有「鲸鱼」的身份串。
// 所以同样重写：组数/权重/形态全部沿用上游，只是句子换成 COPY_POOL。
function replaceRandomGroups(text, report) {
  const key = 'var RANDOM_GROUPS = ['
  const at = text.indexOf(key)
  if (at < 0) { report.rgError = '找不到 RANDOM_GROUPS'; return text }
  const open = at + key.length - 1
  const close = matchArray(text, open)
  if (close < 0) { report.rgError = 'RANDOM_GROUPS 数组未闭合'; return text }

  const body = text.slice(open + 1, close)
  const indent = (body.match(/\n([ \t]*)\S/) || [])[1] || '  '
  const closeIndent = (body.match(/\n([ \t]*)$/) || [])[1] || ''
  const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
  const list = a => a.map(x => q(x.t)).join(', ')

  const n = COPY_POOL.length
  const chunk = Math.floor((n - 1) / 3)
  const groups = [
    // 权重与形态照抄上游那 5 组：B 组 / A 组(换行) / gif 槽 / A 组(换行) / B 单句
    `{ w: 7, lines: function () { return singleCenter('B', pickOne([${list(COPY_POOL.slice(0, chunk))}])) } },`,
    `{ w: 7, lines: function () { return singleCenter('A', pickOne([${list(COPY_POOL.slice(chunk, chunk * 2))}]), '', true) } },`,
    `{ w: 10, lines: function () { return { gif: true } } },`,
    `{ w: 3, lines: function () { return singleCenter('A', pickOne([${list(COPY_POOL.slice(chunk * 2, n - 1))}]), '', true) } },`,
    `{ w: 1, lines: function () { return singleCenter('B', ${q(COPY_POOL[n - 1].t)}) } },`,
  ]
  report.randomGroups = groups.length
  return text.slice(0, open + 1) + '\n' +
    groups.map(g => indent + g).join('\n') + '\n' + closeIndent + text.slice(close)
}

// —— 第 5b 步：RANDOM_GROUPS 断言 ——
function assertRandomGroups(widget, report) {
  const at = widget.indexOf('var RANDOM_GROUPS = [')
  if (at < 0) { report.rgError = '产物里找不到 RANDOM_GROUPS'; return }
  const open = at + 'var RANDOM_GROUPS = '.length
  const close = matchArray(widget, open)
  if (close < 0) { report.rgError = 'RANDOM_GROUPS 未闭合'; return }
  const body = widget.slice(open + 1, close)
  const groups = (body.match(/^\s*\{ w:/gm) || []).length
  if (groups !== 5) report.rgShape = 'RANDOM_GROUPS 组数变成 ' + groups + '（应为 5）'
  const hit = []
  for (const re of COPY_FORBIDDEN) {
    const g = re.flags.includes('g') ? re.flags : re.flags + 'g'
    const m = body.match(new RegExp(re.source, g))
    if (m) hit.push(String(re) + ' 命中 ' + JSON.stringify(m[0]))
  }
  if (hit.length) report.rgResidual = hit
  report.rgLines = (body.match(/'/g) || []).length
}

// —— 第 5 步：台词池断言 ——
// 「整体替换」必须证明三件事，少一件都可能静默出错：
//   ① 活跃池**恰好**等于 COPY_POOL（多一句、少一句、顺序错，都算失败）；
//   ② 4 份副本全部换到（只换活跃那份的话，界面走兜底路径时还是上游的话）；
//   ③ 4 份副本都不含上游身份特征（COPY_FORBIDDEN）。
// 只报「一条都没找到」是不够的 —— 漏改是静默的，界面上就是「改了不生效」。
function assertActivePool(widget, report) {
  const expected = COPY_POOL.map(x => x.t)
  const pools = locatePools(widget)

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

  // ① 活跃池必须恰好 == COPY_POOL（含顺序）
  const extra = texts.filter(t => !expected.includes(t))
  const missing = expected.filter(t => !texts.includes(t))
  if (extra.length) report.poolExtra = extra
  if (missing.length) report.poolMissing = missing
  if (!extra.length && !missing.length &&
      !(texts.length === expected.length && texts.every((t, i) => t === expected[i]))) {
    report.poolError = '活跃池与 COPY_POOL 条数/顺序不一致'
  }

  // ② 四份副本都被换到：各副本的 t 键计数必须都等于 COPY_POOL.length
  if (pools.length !== 4) {
    report.poolError = '产物里只找到 ' + pools.length + ' 份台词池副本（应为 4）'
  } else {
    const count = s => (s.match(/(?:"t"|t)\s*:\s*["']/g) || []).length
    const short = pools.filter(p => count(p.body) !== expected.length)
      .map(p => p.tag + ' 只有 ' + count(p.body) + ' 条')
    if (short.length) report.poolCopyShort = short
  }

  // ③ 特征残留：不再只看活跃池，4 份副本全扫
  const residual = []
  for (const p of pools) {
    for (const re of COPY_FORBIDDEN) {
      const g = re.flags.includes('g') ? re.flags : re.flags + 'g'
      const m = p.body.match(new RegExp(re.source, g))
      if (m) residual.push({ where: p.tag, re: String(re), hit: m[0] })
    }
  }
  if (residual.length) report.poolResidual = residual
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
  let widget = replaceCopyPools(
    rewriteCopy(
      recolor(rename(fs.readFileSync(widgetSrc, 'utf8')), report),
      report),
    report)
  widget = replaceRandomGroups(widget, report)

  assertActivePool(widget, report)
  assertRandomGroups(widget, report)
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
if (report.poolsReplaced) {
  console.log('\n✓ 已整体替换台词池 ' + report.poolsReplaced + ' 份副本（' +
    (report.poolTags || []).join(' / ') + '），每份 ' + report.poolCount + ' 条')
}
if (report.poolCount != null) console.log('✓ 活跃台词池共 ' + report.poolCount + ' 条')
if (report.poolError) console.log('\n✗ ' + report.poolError)
if (report.poolExtra) {
  console.log('\n✗ 活跃池里出现了 COPY_POOL 之外的句子（整池替换没做干净）：')
  for (const x of report.poolExtra) console.log('   ' + JSON.stringify(x))
}
if (report.poolMissing) {
  console.log('\n✗ 活跃池里缺少这些新句（替换没落到活跃副本上）：')
  for (const x of report.poolMissing) console.log('   ' + JSON.stringify(x))
}
if (report.poolCopyShort) {
  console.log('\n✗ 有台词池副本没被换到（界面走兜底路径时会说出上游的话）：')
  for (const x of report.poolCopyShort) console.log('   ' + x)
}
if (report.poolResidual) {
  console.log('\n✗ 台词池里仍有上游身份特征：')
  for (const r of report.poolResidual) console.log('   ' + r.where + '  ' + r.re + ' 命中 ' + JSON.stringify(r.hit))
}
if (report.randomGroups) {
  console.log('✓ 已重写老 RANDOM_GROUPS（' + report.randomGroups + ' 组，句子取自 COPY_POOL）')
}
if (report.rgError) console.log('\n✗ ' + report.rgError)
if (report.rgShape) console.log('\n✗ ' + report.rgShape)
if (report.rgResidual) {
  console.log('\n✗ 老 RANDOM_GROUPS 里仍有上游身份特征：')
  for (const x of report.rgResidual) console.log('   ' + x)
}
if (report.isolationHits) {
  console.log('\n✗ 命名空间隔离失败 —— 产物里仍有上游标识（会与上游挂件抢路由/DOM/存储）：')
  for (const h of report.isolationHits) console.log(`   ${h.where}  含 ${h.needle}  ×${h.n}`)
}

const hardFail = report.poolError || report.poolExtra || report.poolMissing ||
  report.poolCopyShort || report.poolResidual || report.rgError || report.rgShape ||
  report.rgResidual || report.isolationHits
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
if (report.unmapped) {
  console.log('\n⚠️ 声明属性未在 TEXT/FILL 表里定义目标色：')
  for (const u of report.unmapped) console.log('   ' + u)
}