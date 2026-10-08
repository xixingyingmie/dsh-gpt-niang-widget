// 用 mock ctx 加载宿主插件，验证：apply 能跑完、23 条路由都以 /dsh-gptniang/ 注册、
// 且没有向 /dsh-whale/ 泄露（否则会与上游鲸鱼、以及小克冲突）。
const routes = [], injections = [], effects = [], taps = []
const ctx = {
  on(evt, cb) { if (evt === 'webserver/index-inject') injections.push(cb); return () => {} },
  effect(cb) { effects.push(cb); return () => {} },
  inject(services, cb) {
    const c = {
      get: (n) => {
        if (n === 'webServer') return {
          register: (def) => { routes.push(def); return () => {} },
          tapIndex: (fn) => { taps.push(fn); return () => {} },
        }
        if (n === 'credentials') return { get: async () => null, set: async () => {}, delete: async () => {} }
        if (n === 'connection') return { requestRejection: () => null }
        return null
      },
      on() { return () => {} },
      effect(cb) { effects.push(cb); return () => {} },
    }
    // 插件同时用 ctx.get('webServer') 与 ctx.webServer（两条取值路径都要给）
    c.webServer = c.get('webServer')
    c.credentials = c.get('credentials')
    c.connection = c.get('connection')
    cb(c)
  },
  get: () => null,
}
const mod = await import(new URL('../lib/gptniang-index.js', import.meta.url).href)
const plugin = mod.default
plugin.apply(ctx)

const paths = routes.map(r => r.path).filter(Boolean)
const bad = paths.filter(p => !p.startsWith('/dsh-gptniang/'))
const whale = paths.filter(p => p.includes('dsh-whale'))
const xiaoke = paths.filter(p => p.includes('dsh-xiaoke'))
console.log('插件名:', plugin.name)
console.log('注册路由数:', paths.length)
console.log('全部以 /dsh-gptniang/ 开头:', bad.length === 0 ? '✓' : '✗ ' + bad)
console.log('泄露到 /dsh-whale/:', whale.length === 0 ? '✓ 无' : '✗ ' + whale)
console.log('泄露到 /dsh-xiaoke/:', xiaoke.length === 0 ? '✓ 无' : '✗ ' + xiaoke)
console.log('注入行订阅数:', injections.length)
// 触发一次注入行，确认推的是 GPT娘脚本
if (injections.length) {
  const table = []
  injections[0](table)
  const text = JSON.stringify(table)
  console.log('注入行指向 /dsh-gptniang/widget.js:', text.includes('/dsh-gptniang/widget.js') ? '✓' : '✗')
  console.log('注入行残留 /dsh-whale/:', text.includes('/dsh-whale/') ? '✗' : '✓ 无')
}
// tapIndex：确认注入的是 GPT娘脚本
if (taps.length) {
  const html = taps[0]('<html><body></body></html>')
  console.log('tapIndex 注入 /dsh-gptniang/widget.js:', html.includes('/dsh-gptniang/widget.js') ? '✓' : '✗')
  console.log('tapIndex 残留 /dsh-whale/:', html.includes('/dsh-whale/') ? '✗' : '✓ 无')
}
console.log('\n路由清单:')
for (const p of paths.sort()) console.log('  ' + p)