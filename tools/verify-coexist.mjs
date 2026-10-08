// 并行共存校验：把三只桌宠（小鲸鱼 / 小克 / GPT娘）同时挂到**同一个** mock 宿主上，
// 检查它们在真机上会不会互相踩。
//
// 这是「可与其他桌宠并行运行」这一条需求的直接回归测试 —— 前两个校验脚本各自只加载
// 一只插件，证明不了「两只碰面不打架」。这里要证明的是：
//   1. 每只插件只在自己的前缀下注册路由（不越界）；
//   2. 69 条路由（3×23）**没有一条被两只插件重复注册**（重复注册才是真正的冲突）；
//   3. 每只插件往页面注入的 <script> 都指向自己的 widget.js，且合并后的 HTML 里
//      三只的脚本都在、谁都没把别人顶掉；
//   4. 每只插件的运行时 plugin.name 互不相同。
//
// 找不到同伴插件时（比如只 clone 了本项目）会跳过它并明确说明，不算失败。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SELF = path.resolve(HERE, '..')

// ── 定位同伴插件 ────────────────────────────────────────────────────────────
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const NM = path.join(DSH_HOME, 'profiles', 'desktop', 'node_modules')

/** 从已安装目录里读出包的 main 入口；读不到就返回 null。 */
function locate(pkgDir) {
  const pj = path.join(pkgDir, 'package.json')
  if (!fs.existsSync(pj)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pj, 'utf8'))
    const main = path.join(pkgDir, pkg.main || 'index.js')
    return fs.existsSync(main) ? { main, version: pkg.version, dir: pkgDir } : null
  } catch { return null }
}

const PEERS = [
  { label: 'whale', pkg: 'dsh-whale-widget', prefix: '/dsh-whale/', expectName: 'whale-balance-widget' },
  { label: 'xiaoke', pkg: 'dsh-xiaoke-widget', prefix: '/dsh-xiaoke/', expectName: 'xiaoke-balance-widget' },
  { label: 'gptniang', pkg: 'dsh-gpt-niang-widget', prefix: '/dsh-gptniang/', expectName: 'gptniang-balance-widget', self: true },
]

const loaded = []
for (const p of PEERS) {
  const found = p.self
    ? { main: path.join(SELF, 'lib', 'gptniang-index.js'), version: '0.3.17', dir: SELF }
    : locate(path.join(NM, p.pkg))
  if (!found) {
    console.log(`· 跳过 ${p.label}（${p.pkg} 未安装，找不到 ${path.join(NM, p.pkg)}）`)
    continue
  }
  loaded.push({ ...p, ...found })
}

if (loaded.length < 2) {
  console.log('\n只找到一只插件，无法做共存比对。')
  console.log('（本项目自己的路由校验请用 tools/verify-host-routes.mjs）')
  process.exit(0)
}

// ── 一个共享的 mock 宿主，三只插件都挂它上面 ────────────────────────────────
const routes = []            // { path, by }
const injections = []        // { by, cb }
const taps = []              // { by, cb }
const effects = []

function makeCtx(by) {
  const webServer = {
    register(def) {
      routes.push({ path: def.path, kind: def.kind, by, def })
      return () => {}
    },
    tapIndex(fn) { taps.push({ by, fn }); return () => {} },
  }
  const credentials = { resolve: async () => null, set: async () => {}, delete: async () => {} }
  const connection = { requestRejection: () => null }
  const c = {
    get: (n) => (n === 'webServer' ? webServer : n === 'credentials' ? credentials : n === 'connection' ? connection : null),
    on() { return () => {} },
    effect(cb) { effects.push({ by, cb }); return () => {} },
  }
  c.webServer = webServer
  c.credentials = credentials
  c.connection = connection
  return {
    on(evt, cb) { if (evt === 'webserver/index-inject') injections.push({ by, cb }); return () => {} },
    effect(cb) { effects.push({ by, cb }); return () => {} },
    inject(services, cb) { cb(c) },
    get: (n) => (n === 'webServer' ? webServer : n === 'credentials' ? credentials : n === 'connection' ? connection : null),
  }
}

const names = {}
for (const p of loaded) {
  const mod = await import(pathToFileURL(p.main).href)
  const plugin = mod.default ?? mod.plugin ?? mod
  if (typeof plugin?.apply !== 'function') {
    console.log(`✗ ${p.label}: 导出的对象没有 apply()`)
    process.exit(1)
  }
  plugin.apply(makeCtx(p.label))
  names[p.label] = plugin.name
}

// ── 判定 ───────────────────────────────────────────────────────────────────
let fail = 0
const bad = (msg) => { console.log('✗ ' + msg); fail++ }
const ok = (msg) => console.log('✓ ' + msg)

console.log('\n已挂载：' + loaded.map(p => `${p.label}(${p.version})`).join('、'))
console.log('运行时 plugin.name: ' + loaded.map(p => `${p.label}=${names[p.label]}`).join('  '))

// 1) 每只只在自己的前缀下注册
for (const p of loaded) {
  const mine = routes.filter(r => r.by === p.label)
  const outside = mine.filter(r => !r.path.startsWith(p.prefix))
  outside.length
    ? bad(`${p.label} 有 ${outside.length} 条路由跑到 ${p.prefix} 之外：${outside.map(r => r.path).join(', ')}`)
    : ok(`${p.label}: ${mine.length} 条路由全在 ${p.prefix} 下`)
}

// 2) 无重复注册（真正的冲突形态）
const seen = new Map()
const dupes = []
for (const r of routes) {
  const prev = seen.get(r.path)
  if (prev && prev !== r.by) dupes.push(`${r.path} ← ${prev} 与 ${r.by}`)
  else seen.set(r.path, r.by)
}
dupes.length
  ? bad(`${dupes.length} 条路由被两只插件重复注册：\n      ` + dupes.join('\n      '))
  : ok(`${routes.length} 条路由无一条重复注册`)

const expect = loaded.length * 23
routes.length === expect
  ? ok(`路由总数 ${routes.length} = ${loaded.length} 只 × 23`)
  : bad(`路由总数 ${routes.length}，预期 ${expect}`)

// 3) 注入：合并后的 HTML 里三只的脚本都在
const table = []
for (const inj of injections) inj.cb(table)
const injected = JSON.stringify(table)
const tapHtml = taps.map(t => t.fn('<html><body></body></html>')).join('\n')
const allHtml = injected + '\n' + tapHtml
for (const p of loaded) {
  const w = p.prefix + 'widget.js'
  allHtml.includes(w) ? ok(`合并注入里含 ${w}`) : bad(`合并注入里缺 ${w}（被顶掉了？）`)
}
const foreign = routes.filter(r => loaded.some(p => r.path.startsWith(p.prefix)) === false)
foreign.length ? bad(`${foreign.length} 条路由前缀不属于任何一只：${foreign.map(r => r.path).join(', ')}`) : null

// 4) 名字互不相同
const nameVals = Object.values(names).filter(Boolean)
new Set(nameVals).size === nameVals.length
  ? ok(`plugin.name 互不相同：${nameVals.join(' / ')}`)
  : bad(`plugin.name 有重复：${nameVals.join(' / ')}`)

// 5) 没有插件跨前缀泄露到别人的领地
for (const p of loaded) {
  const mine = routes.filter(r => r.by === p.label)
  const others = loaded.filter(q => q !== p)
  for (const q of others) {
    const leak = mine.filter(r => r.path.startsWith(q.prefix))
    if (leak.length) bad(`${p.label} 侵占了 ${q.label} 的前缀：${leak.map(r => r.path).join(', ')}`)
  }
}

console.log(fail === 0
  ? `\n✓ ${loaded.length} 只桌宠可在同一宿主上并行运行，零冲突。`
  : `\n✗ ${fail} 项冲突。`)
process.exit(fail === 0 ? 0 : 1)