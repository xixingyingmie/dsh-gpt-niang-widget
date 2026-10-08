#!/usr/bin/env node
// ============================================================================
// preview-widget.mjs —— 离线预览/集成自检：把**真实的宿主路由处理器**跑起来，
//                        再用一个最小的 DSH 壳页面挂上真实的前端挂件。
// ============================================================================
// 为什么不是"另写一套假数据"：本脚本把 lib/gptniang-index.js 真的 apply 到一个
// mock ctx 上，捕获它注册的 23 条路由，然后用 Node 原生 http 服务器把进来的请求
// **原样派发给插件自己的 handler**。所以页面上看到的每一个数字，都是宿主代码
// 真跑出来的 —— 顺手就验证了「空数据 / 无凭据」时的降级路径不会抛异常。
//
//   node tools/preview-widget.mjs              # 用真实 $DSH_HOME（看真实数据）
//   node tools/preview-widget.mjs --sandbox    # 用临时 $DSH_HOME（干净环境，验证冷启动）
//   node tools/preview-widget.mjs --port 8899
//   node tools/preview-widget.mjs --host 0.0.0.0
//
// 只读性质：不修改仓库里任何文件；宿主可能写 .dshgn-*.json 缓存（与生产行为一致）。
// ============================================================================

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes('--' + n)
const opt = (n, d) => {
  const i = argv.indexOf('--' + n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

// —— $DSH_HOME：--sandbox 时换到临时目录，验证冷启动（没有任何 .dshgn-* 文件）——
const sandbox = flag('sandbox')
if (sandbox) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gptniang-preview-'))
  process.env.DSH_HOME = tmp
  console.log('  ⓘ sandbox 模式：DSH_HOME =', tmp)
}
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

// —— 挂上真实宿主插件，捕获它注册的路由与注入回调 ——
const routes = []
const injections = []
const taps = []
const effects = []
const mockCtx = {
  on(evt, cb) { if (evt === 'webserver/index-inject') injections.push(cb); return () => {} },
  effect(cb) { effects.push(cb); return () => {} },
  inject(services, cb) {
    const c = {
      get: (n) => {
        if (n === 'webServer') return {
          register: (def) => { routes.push(def); return () => {} },
          tapIndex: (fn) => { taps.push(fn); return () => {} },
        }
        // 与真实凭据服务同形：插件用的是 credentials.resolve / credentials.set
        // （**不是** get）。少了 resolve 会让 /balance.json 落进 NO_KEY 分支，
        // 预览就看不到余额区域了。
        if (n === 'credentials') return {
          // 冷启动的真实情形：没有配置凭据。插件会走 NO_KEY 分支、挂件显示未配置态
          // —— 这正是新用户第一次打开时会看到的画面，所以预览要如实呈现。
          resolve: async () => null,
          set: async () => {},
          delete: async () => {},
        }
        // 回环请求一律放行 —— 与真实宿主在 --trusted-host 缺省下的行为一致
        if (n === 'connection') return { requestRejection: () => null }
        return null
      },
      on() { return () => {} },
      effect(cb) { effects.push(cb); return () => {} },
    }
    c.webServer = c.get('webServer')
    c.credentials = c.get('credentials')
    c.connection = c.get('connection')
    cb(c)
  },
  get: () => null,
}

const mod = await import(new URL('../lib/gptniang-index.js', import.meta.url).href)
mod.default.apply(mockCtx)

const byPath = new Map(routes.filter((r) => r.path).map((r) => [r.path, r]))
const FRONTEND = '/dsh-gptniang/widget.js'

// —— 最小 DSH 壳页面 ——
// 挂件的自检判据是 #root 里存在 [data-composer-input]（新版 DSH 的 composer），
// 没有它挂件一行 DOM 都不碰。所以壳页面必须给出这一条。
const SHELL = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>GPT娘挂件 · 离线预览</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0f1115; color:#e6e6e6;
         font:14px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif; }
  #root { min-height:100vh; display:flex; flex-direction:column; }
  .fake-msgs { flex:1; padding:24px 32px; opacity:.45; }
  .fake-msgs p { margin:0 0 10px; }
  .fake-composer { padding:12px 32px 22px; }
  .fake-composer .card { border:1px solid #2a2f3a; border-radius:14px;
        background:#151922; padding:12px 14px; min-height:52px; }
  .fake-note { position:fixed; left:12px; top:12px; z-index:99999;
        background:#1d2430; border:1px solid #33405a; border-radius:8px;
        padding:8px 12px; font-size:12px; opacity:.9; max-width:360px; }
  .fake-note b { color:#7aa2ff; }
</style></head>
<body>
<div class="fake-note">
  <b>离线预览</b> —— 宿主路由处理器是<b>真跑的</b>（lib/gptniang-index.js）。<br>
  数据源：<code>${DSH_HOME.replace(/</g, '&lt;')}</code>
</div>
<div id="root">
  <div class="fake-msgs">
    <p>这是一个最小的 DSH 壳页面，只为让挂件通过挂载自检。</p>
    <p>右下角那只就是 GPT娘。点它会冒出台词。</p>
  </div>
  <div class="fake-composer">
    <div class="card" data-composer-seat>
      <div data-composer-input="true" contenteditable="false" role="textbox"
           aria-multiline="true" style="min-height:28px;outline:none">说点什么…</div>
    </div>
  </div>
</div>
<script src="${FRONTEND}"></script>
<script>
  // 壳页面自己不做任何事；挂件由上面那行注入。
  window.addEventListener('error', function (e) { console.error('[shell]', e.message) });
</script>
</body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'))
  const p = url.pathname

  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    return res.end(SHELL)
  }
  if (p === FRONTEND) {
    const bytes = fs.readFileSync(path.join(ROOT, 'lib', 'gptniang-widget.js'))
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Length': String(bytes.length), 'Cache-Control': 'no-store' })
    return res.end(bytes)
  }
  const route = byPath.get(p)
  if (route) {
    try {
      return route.handler(req, res)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('route threw: ' + String((err && err.message) || err))
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found: ' + p)
})

const port = Number(opt('port', 8899))
const host = opt('host', '127.0.0.1')
server.listen(port, host, () => {
  console.log(`  ✓ 宿主插件已 apply：${mod.default.name || '(匿名)'}`)
  console.log(`  ✓ 派发路由 ${byPath.size} 条（全部走插件的真实 handler）`)
  console.log(`  ✓ 注入订阅 ${injections.length} 个 / tapIndex ${taps.length} 个`)
  console.log(`  → 预览地址 http://${host}:${port}/`)
  console.log('  （Ctrl+C 退出）')
})