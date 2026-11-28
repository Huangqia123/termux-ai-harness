'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const http = require('node:http')
const https = require('node:https')
const { spawn } = require('node:child_process')
const net = require('node:net')
const { readPage, pickUrl } = require('./web')

const BASE_PORT = 8080
let activePort = BASE_PORT
const endpoint = () => `http://127.0.0.1:${activePort}`

const CATALOG = [
  {
    id: 'low-cn',
    tier: '低配',
    tierEn: 'Low',
    name: 'Qwen2.5-0.5B-Instruct',
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    size: 491 * 1024 * 1024,
    sizeLabel: '491MB',
    ram: '0.4~0.6GB',
    note: '4GB 内存级设备，能跑但比较笨',
    noteEn: 'For 4GB-RAM devices — runs, but rather dim',
    url: 'https://hf-mirror.com/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    ctx: 512
  },
  {
    id: 'low-en',
    tier: '低配',
    tierEn: 'Low',
    name: 'TinyLlama-1.1B-Chat',
    file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    size: 669 * 1024 * 1024,
    sizeLabel: '669MB',
    ram: '0.8~1.0GB',
    note: '英文低配，中文基本别指望',
    noteEn: 'Tiny and English-only — do not expect usable Chinese',
    url: 'https://hf-mirror.com/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    ctx: 512
  },
  {
    id: 'vision-cn',
    tier: '识图',
    tierEn: 'Vision',
    name: 'Qwen2.5-VL-3B-Instruct',
    file: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    size: 1929 * 1024 * 1024,
    sizeLabel: '1.9GB',
    ram: '3~4GB',
    note: '能看图：把截图丢给它，它描述画面里的内容',
    noteEn: 'Sees images — drop in a screenshot and it describes what is there',
    url: 'https://hf-mirror.com/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    mmproj: {
      file: 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
      url: 'https://hf-mirror.com/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
      size: 427 * 1024 * 1024
    },
    ctx: 4096
  },
  {
    id: 'mid-en',
    tier: '中配',
    tierEn: 'Mid',
    name: 'Llama-3.2-1B-Instruct',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    size: 808 * 1024 * 1024,
    sizeLabel: '808MB',
    ram: '0.8~1.0GB',
    note: '英文对话质量好，中文弱',
    noteEn: 'Good English chat, weak Chinese',
    url: 'https://hf-mirror.com/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    ctx: 1024
  },
  {
    id: 'mid-cn',
    tier: '中配',
    tierEn: 'Mid',
    name: 'Qwen2.5-1.5B-Instruct',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: 1.12 * 1024 * 1024 * 1024,
    sizeLabel: '1.12GB',
    ram: '1.2~1.5GB',
    note: '主流手机 / 轻薄本，速度 9~14 t/s',
    noteEn: 'Mainstream phones and thin laptops, 9–14 t/s',
    url: 'https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    ctx: 1024
  },
  {
    id: 'high-cn',
    tier: '高配',
    tierEn: 'High',
    name: 'Qwen2.5-3B-Instruct',
    file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    size: 1929903264,
    sizeLabel: '1.80GB',
    ram: '2.2~2.6GB',
    note: '推荐起点，守得住 CMD:/TEXT: 协议',
    noteEn: 'Recommended starting point, keeps the CMD:/TEXT: protocol in line',
    url: 'https://hf-mirror.com/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    ctx: 2048
  },
  {
    id: 'high-en',
    tier: '高配',
    tierEn: 'High',
    name: 'Llama-3.2-3B-Instruct',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: 2.02 * 1024 * 1024 * 1024,
    sizeLabel: '2.02GB',
    ram: '2.2~2.6GB',
    note: '英文高配，中文一般',
    noteEn: 'High-end English model, so-so Chinese',
    url: 'https://hf-mirror.com/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    ctx: 2048
  }
]

let mainWindow = null
let engineProc = null
let engineReady = false
let engineBin = null
let activeModel = null

/* ------------------------------------------------------------------ paths */

function modelDirs() {
  const home = os.homedir()
  const dirs = [
    path.join(app.getPath('userData'), 'models'),
    path.join(home, 'models'),
    path.join(home, '.termux-ai', 'models'),
    path.join(home, '.local', 'share', 'termux-ai', 'models'),
    path.join(home, 'storage', 'downloads'),
    path.join(home, 'storage', 'downloads', 'Lark')
  ]
  if (process.platform === 'win32') {
    dirs.push(path.join(app.getPath('userData'), 'models'))
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'TermuxAI', 'models'))
  }
  return [...new Set(dirs)]
}

function scanModels() {
  const found = []
  for (const dir of modelDirs()) {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (!e.isFile() && !e.isSymbolicLink()) continue
      if (!e.name.toLowerCase().endsWith('.gguf')) continue
      if (/^mmproj/i.test(e.name) || /mmproj/i.test(e.name)) continue // 多模态投影文件不是模型
      const full = path.join(dir, e.name)
      try {
        const st = fs.statSync(full)
        if (st.size < 50 * 1024 * 1024) continue
        found.push({ path: full, name: e.name, size: st.size, dir })
      } catch {}
    }
  }
  const seen = new Set()
  return found.filter((m) => {
    if (seen.has(m.path)) return false
    seen.add(m.path)
    return true
  })
}

function findMmproj(modelPath) {
  if (!modelPath) return null
  const dir = path.dirname(modelPath)
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  const cands = names.filter((n) => /\.gguf$/i.test(n) && /mmproj/i.test(n))
  if (!cands.length) return null
  const base = path.basename(modelPath).toLowerCase()
  const exact = cands.find((n) => {
    const nb = n.toLowerCase()
    return nb.startsWith('mmproj') && base.includes(nb.replace(/^mmproj-?/, '').replace(/\.gguf$/, ''))
  })
  const pick = exact || cands[0]
  return path.join(dir, pick)
}

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK)
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function findEngine() {
  const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
  const candidates = [
    process.env.TERMUX_AI_LLAMA,
    process.env.LLAMA_SERVER,
    path.join(app.getPath('userData'), 'bin', exe),
    process.resourcesPath ? path.join(process.resourcesPath, 'bin', exe) : null,
    path.join(os.homedir(), '.local', 'bin', exe),
    '/usr/local/bin/' + exe,
    '/usr/bin/' + exe,
    '/opt/homebrew/bin/' + exe,
    // Android / Termux installs: llama.cpp compiled from the repo's own script
    '/data/data/com.termux/files/usr/bin/' + exe,
    '/data/data/com.termux/files/home/.local/bin/' + exe
  ].filter(Boolean)

  for (const c of candidates) {
    if (c && isExecutable(c)) return c
  }

  const PATH = (process.env.PATH || '').split(path.delimiter)
  for (const dir of PATH) {
    if (!dir) continue
    const p = path.join(dir, exe)
    if (isExecutable(p)) return p
  }
  return null
}

/* ---------------------------------------------------------------- download */

function downloadTo(url, dest, onProgress) {
  const part = dest + '.part'
  return new Promise((resolve, reject) => {
    try { fs.rmSync(part, { force: true }) } catch {}
    const go = (u, redirects) => {
      const req = https.get(u, { headers: { 'User-Agent': 'termux-ai-harness-app' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects > 5) return reject(new Error('too many redirects'))
          res.resume()
          return go(new URL(res.headers.location, u).toString(), redirects + 1)
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error('HTTP ' + res.statusCode))
        }
        const total = Number(res.headers['content-length'] || 0)
        let received = 0
        let last = 0
        const out = fs.createWriteStream(part)
        res.on('data', (c) => {
          received += c.length
          const now = Date.now()
          if (onProgress && now - last > 300) {
            last = now
            onProgress(received, total)
          }
        })
        res.pipe(out)
        out.on('finish', () => out.close(() => {
          try { fs.renameSync(part, dest) } catch (e) { return reject(e) }
          resolve(dest)
        }))
        res.on('error', reject)
      })
      req.on('error', reject)
    }
    go(url, 0)
  })
}

function downloadModel(id, win) {
  const item = CATALOG.find((c) => c.id === id)
  if (!item) return Promise.reject(new Error('unknown model id'))

  const dir = path.join(app.getPath('userData'), 'models')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, item.file)
  const part = dest + '.part'

  const mmDest = item.mmproj ? path.join(dir, item.mmproj.file) : null
  if (fs.existsSync(dest)) {
    if (mmDest && !fs.existsSync(mmDest) && !fs.existsSync(mmDest + '.part')) {
      return downloadTo(item.mmproj.url, mmDest, null).then(() => ({ path: dest, already: true }))
    }
    return Promise.resolve({ path: dest, already: true })
  }

  return new Promise((resolve, reject) => {
    let received = 0
    let lastTick = 0

    const request = (url, redirects = 0) => {
      const req = https.get(url, { headers: { 'User-Agent': 'termux-ai-harness-app' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects > 5) {
            reject(new Error('too many redirects'))
            return
          }
          res.resume()
          request(new URL(res.headers.location, url).toString(), redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          res.resume()
          return
        }

        const total = Number(res.headers['content-length'] || item.size)
        const out = fs.createWriteStream(part)
        res.on('data', (chunk) => {
          received += chunk.length
          const now = Date.now()
          if (win && !win.isDestroyed() && now - lastTick > 300) {
            lastTick = now
            win.webContents.send('model:progress', {
              id,
              received,
              total,
              percent: total ? Math.min(100, (received / total) * 100) : 0
            })
          }
        })
        res.pipe(out)
        out.on('finish', () => {
          out.close(() => {
            try {
              fs.renameSync(part, dest)
            } catch (e) {
              reject(e)
              return
            }
            if (win && !win.isDestroyed()) {
              win.webContents.send('model:progress', { id, received, total, percent: 100, done: true })
            }
            if (mmDest && !fs.existsSync(mmDest)) {
              const prog = win && !win.isDestroyed()
                ? (r, t) => win.webContents.send('model:progress', { id, received: r, total: t, percent: t ? Math.min(100, (r / t) * 100) : 0, extra: true })
                : null
              downloadTo(item.mmproj.url, mmDest, prog)
                .then(() => resolve({ path: dest, already: false }))
                .catch(() => resolve({ path: dest, already: false }))
              return
            }
            resolve({ path: dest, already: false })
          })
        })
        res.on('error', reject)
      })
      req.on('error', reject)
    }

    try {
      fs.rmSync(part, { force: true })
    } catch {}
    request(item.url)
  })
}

/* ------------------------------------------------------------- port scan */

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

function probeLlama(port, timeoutMs = 900) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/v1/models', timeout: timeoutMs }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          const j = JSON.parse(body)
          resolve(Array.isArray(j.data) && j.data.length > 0)
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/* ----------------------------------------------------------------- engine */

async function startEngine(modelPath, opts, win) {
  if (engineProc) stopEngine()

  // an honest llama.cpp already listening on 8080? treat it as ours
  if (await probeLlama(BASE_PORT)) {
    activePort = BASE_PORT
    engineReady = true
    activeModel = modelPath
    return { ok: true, endpoint: endpoint(), reused: true }
  }

  let chosen = null
  for (let p = BASE_PORT; p < BASE_PORT + 12; p++) {
    if (await portFree(p)) {
      chosen = p
      break
    }
  }
  if (!chosen) throw new Error('没有可用端口（8080-8091 全被占用）')
  activePort = chosen

  const bin = engineBin || findEngine()
  if (!bin) throw new Error('llama-server not found')
  engineBin = bin

  const cores = Math.max(2, Math.min(8, os.cpus().length))
  const threads = opts && opts.threads ? opts.threads : Math.min(4, cores)
  const ctx = opts && opts.ctx ? opts.ctx : 2048

  const mmproj = findMmproj(modelPath)
  const args = ['-m', modelPath, '-c', String(ctx), '--port', String(activePort), '-t', String(threads)]
  if (mmproj) args.push('--mmproj', mmproj, '--image-min-tokens', '512')
  if (win && !win.isDestroyed()) win.webContents.send('engine:log', mmproj ? '多模态模式：' + path.basename(mmproj) : '纯文本模式（没找到 mmproj）')
  engineProc = spawn(bin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: false
  })

  const log = []
  const push = (line) => {
    log.push(line)
    if (log.length > 40) log.shift()
    if (win && !win.isDestroyed()) win.webContents.send('engine:log', line)
  }
  engineProc.stdout.on('data', (d) => push(d.toString().trim()))
  engineProc.stderr.on('data', (d) => push(d.toString().trim()))
  engineProc.on('exit', (code) => {
    engineReady = false
    if (win && !win.isDestroyed()) win.webContents.send('engine:exit', code)
    engineProc = null
  })

  activeModel = modelPath
  await waitForHealth(90000)
  engineReady = true
  return { ok: true, endpoint: endpoint(), pid: engineProc ? engineProc.pid : null }
}

function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (!engineProc) {
        reject(new Error('engine exited before it became ready'))
        return
      }
      http
        .get(`${endpoint()}/health`, (res) => {
          res.resume()
          if (res.statusCode === 200) {
            resolve()
          } else if (Date.now() > deadline) {
            reject(new Error('health check timeout'))
          } else {
            setTimeout(tick, 1000)
          }
        })
        .on('error', () => {
          if (Date.now() > deadline) reject(new Error('health check timeout'))
          else setTimeout(tick, 1000)
        })
    }
    setTimeout(tick, 500)
  })
}

function stopEngine() {
  if (engineProc) {
    try {
      engineProc.kill('SIGTERM')
      setTimeout(() => {
        if (engineProc) {
          try {
            engineProc.kill('SIGKILL')
          } catch {}
        }
      }, 3000)
    } catch {}
    engineProc = null
  }
  engineReady = false
}

function chat(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
      chat_template_kwargs: { enable_thinking: true }
    })

    let think = ''
    let answer = ''
    let buffer = ''

    const req = http.request(
      `${endpoint()}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'text/event-stream'
        }
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let err = ''
          res.on('data', (c) => (err += c))
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode} ${err.slice(0, 200)}`)))
          return
        }
        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const raw of lines) {
            const line = raw.trim()
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (payload === '[DONE]') continue
            let piece = null
            try {
              const j = JSON.parse(payload)
              const delta = j.choices && j.choices[0] && j.choices[0].delta
              if (delta) {
                if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
                  think += delta.reasoning_content
                  emitChunk({ type: 'think', text: delta.reasoning_content })
                }
                if (typeof delta.content === 'string' && delta.content) {
                  answer += delta.content
                  emitChunk({ type: 'text', text: delta.content })
                }
              }
            } catch {
              piece = null
            }
          }
        })
        res.on('end', () => resolve({ ok: true, content: answer, reasoning: think }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

let chunkSink = null
function emitChunk(payload) {
  if (chunkSink) chunkSink(payload)
}

/* ---------------------------------------------------------------- search */

function httpText(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? https : http
    const req = mod.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(httpText(res.headers.location, timeoutMs))
          res.resume()
          return
        }
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(data))
      }
    )
    req.on('timeout', () => { req.destroy(); resolve('') })
    req.on('error', () => resolve(''))
  })
}

function decodeEntities(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function unwrapBing(href) {
  if (!href.includes('bing.com/ck/a')) return href
  const m = href.match(/[?&]u=a1([^&]+)/)
  if (!m) return href
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    return href
  }
}

async function bingSearch(query) {
  const html = await httpText('https://cn.bing.com/search?q=' + encodeURIComponent(query))
  const out = []
  const blocks = html.split('class="b_algo"').slice(1)
  for (const block of blocks) {
    const href = block.match(/href="(http[^"]+)"/)
    const title = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)
    if (!href || !title) continue
    const snip = block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    out.push({
      title: decodeEntities(title[1]),
      url: unwrapBing(href[1]),
      snippet: snip ? decodeEntities(snip[1]) : ''
    })
    if (out.length >= 5) break
  }
  return out
}

async function webSearch(query) {
  const out = []
  try {
    const bing = await bingSearch(query)
    if (bing.length) return bing
  } catch {}
  try {
    const html = await httpText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query))
    const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g
    const snipRe = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g
    const snippets = []
    let m
    while ((m = snipRe.exec(html))) snippets.push(decodeEntities(m[1]))
    let i = 0
    let hit
    while ((hit = linkRe.exec(html)) && out.length < 5) {
      let href = hit[1]
      const uddg = href.match(/uddg=([^&]+)/)
      if (uddg) href = decodeURIComponent(uddg[1])
      if (href.startsWith('//')) href = 'https:' + href
      if (!/^https?:/.test(href)) continue
      out.push({ title: decodeEntities(hit[2]), url: href, snippet: snippets[i] || '' })
      i++
    }
  } catch {}
  if (out.length === 0) {
    try {
      const raw = await httpText(
        'https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=5&srsearch=' +
          encodeURIComponent(query)
      )
      const j = JSON.parse(raw)
      const hits = (j.query && j.query.search) || []
      for (const h of hits) {
        out.push({
          title: h.title,
          url: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(h.title),
          snippet: decodeEntities(h.snippet || '')
        })
      }
    } catch {}
  }
  return out
}


/* ---------------------------------------------------------------- profiles */

const crypto = require('node:crypto')

const profileFile = () => path.join(app.getPath('userData'), 'profiles.json')

function readProfiles() {
  try {
    const d = JSON.parse(fs.readFileSync(profileFile(), 'utf8'))
    if (!d || !Array.isArray(d.profiles)) throw new Error('bad format')
    return d
  } catch {
    return { version: 1, active: null, profiles: [] }
  }
}

function writeProfiles(data) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(profileFile(), JSON.stringify(data, null, 2), { mode: 0o600 })
}

const hashPin = (pin, salt) =>
  crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256').toString('hex')

function makeRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const ran = crypto.randomBytes(20)
  let out = ''
  for (let i = 0; i < 20; i++) {
    out += alphabet[ran[i] % alphabet.length]
    if (i % 5 === 4 && i !== 19) out += '-'
  }
  return out
}

const publicProfile = (p) => ({ id: p.id, type: p.type, name: p.name, createdAt: p.createdAt })

/* ------------------------------------------------------------ github oauth */

let pendingGithubToken = null

function ghPost(pathname, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'github.com',
        path: pathname,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'TermuxAIHarness'
        }
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('GitHub 返回了非 JSON 内容：' + data.slice(0, 80)))
          }
        })
      }
    )
    req.setTimeout(15000, () => req.destroy(new Error('GitHub 请求超时')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/* -------------------------------------------------------------------- ipc */

function state() {
  const models = scanModels()
  const engine = findEngine()
  return {
    models,
    engine,
    catalog: CATALOG.map(({ url, ...rest }) => rest),
    endpoint: endpoint(),
    ready: engineReady,
    activeModel,
    platform: process.platform,
    arch: process.arch,
    cpuThreads: Math.max(2, Math.min(8, os.cpus().length)),
    totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    vision: !!findMmproj(activeModel || (models[0] && models[0].path)),
    mmproj: findMmproj(activeModel || (models[0] && models[0].path))
  }
}

function registerIpc() {
  ipcMain.handle('state:init', () => state())

  /* profiles */
  ipcMain.handle('profile:list', () => {
    const d = readProfiles()
    return { active: d.active, profiles: d.profiles.map(publicProfile) }
  })

  ipcMain.handle('profile:create', (e, { name, pin, type }) => {
    const clean = String(name || '').trim()
    const p = String(pin || '')
    if (clean.length < 1 || clean.length > 24) return { ok: false, error: 'bad-name' }
    if (type !== 'github' && (p.length < 4 || p.length > 32)) return { ok: false, error: 'bad-pin' }
    const d = readProfiles()
    if (d.profiles.some((x) => x.name.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, error: 'name-taken' }
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const profile = {
      id: (type === 'github' ? 'gh-' : 'lc-') + crypto.randomBytes(6).toString('hex'),
      type: type === 'github' ? 'github' : 'local',
      name: clean,
      pinSalt: salt,
      pinHash: hashPin(p, salt),
      recoveryCode: makeRecoveryCode(),
      createdAt: Date.now(),
      githubToken: type === 'github' ? pendingGithubToken : null
    }
    if (type === 'github') pendingGithubToken = null
    d.profiles.push(profile)
    d.active = profile.id
    writeProfiles(d)
    return { ok: true, profile: publicProfile(profile), recoveryCode: profile.recoveryCode }
  })

  ipcMain.handle('profile:verify', (e, { id, pin }) => {
    const d = readProfiles()
    const p = d.profiles.find((x) => x.id === id)
    if (!p) return { ok: false, error: 'no-profile' }
    if (hashPin(String(pin || ''), p.pinSalt) !== p.pinHash) return { ok: false, error: 'bad-pin' }
    d.active = p.id
    writeProfiles(d)
    return { ok: true, profile: publicProfile(p) }
  })

  ipcMain.handle('profile:activate', (e, id) => {
    const d = readProfiles()
    if (!d.profiles.some((x) => x.id === id)) return { ok: false, error: 'no-profile' }
    d.active = id
    writeProfiles(d)
    return { ok: true }
  })

  ipcMain.handle('profile:delete', (e, id) => {
    const d = readProfiles()
    const i = d.profiles.findIndex((x) => x.id === id)
    if (i < 0) return { ok: false, error: 'no-profile' }
    d.profiles.splice(i, 1)
    if (d.active === id) d.active = d.profiles[0] ? d.profiles[0].id : null
    writeProfiles(d)
    return { ok: true }
  })

  ipcMain.handle('profile:reset', (e, { id, recovery, pin }) => {
    const d = readProfiles()
    const p = d.profiles.find((x) => x.id === id)
    if (!p) return { ok: false, error: 'no-profile' }
    const norm = String(recovery || '').toUpperCase().replace(/\s+/g, '')
    if (norm !== p.recoveryCode) return { ok: false, error: 'bad-recovery' }
    if (String(pin || '').length < 4) return { ok: false, error: 'bad-pin' }
    const salt = crypto.randomBytes(16).toString('hex')
    p.pinSalt = salt
    p.pinHash = hashPin(String(pin), salt)
    writeProfiles(d)
    return { ok: true }
  })

  ipcMain.handle('github:device-code', async (e, clientId) => {
    try {
      const d = await ghPost(
        '/login/device/code',
        `client_id=${encodeURIComponent(clientId)}&scope=read:user`
      )
      if (d.error) return { ok: false, error: d.error_description || d.error }
      return { ok: true, data: d }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('github:poll', async (e, { clientId, deviceCode }) => {
    try {
      const d = await ghPost(
        '/login/oauth/access_token',
        `client_id=${encodeURIComponent(clientId)}&device_code=${encodeURIComponent(deviceCode)}&grant_type=urn:ietf:params:oauth:grant-type:device_code`
      )
      if (d.access_token) {
        pendingGithubToken = d.access_token
        return { ok: true }
      }
      return { ok: false, error: d.error || 'unknown' }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle('model:download', async (e, id) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return downloadModel(id, win)
  })

  ipcMain.handle('model:add', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择 GGUF 模型',
      properties: ['openFile'],
      filters: [{ name: 'GGUF', extensions: ['gguf'] }]
    })
    if (r.canceled || !r.filePaths.length) return null
    const p = r.filePaths[0]
    const st = fs.statSync(p)
    return { path: p, name: path.basename(p), size: st.size }
  })

  ipcMain.handle('engine:pick', async () => {
    const exe = process.platform === 'win32' ? ['llama-server.exe'] : ['llama-server', '*']
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择 llama-server 可执行文件',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : []
    })
    if (r.canceled || !r.filePaths.length) return null
    engineBin = r.filePaths[0]
    return engineBin
  })

  ipcMain.handle('engine:start', async (e, { modelPath, threads, ctx }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return startEngine(modelPath, { threads, ctx }, win)
  })

  ipcMain.handle('engine:stop', () => {
    stopEngine()
    return true
  })

  ipcMain.handle('chat:send', async (event, messages) => {
    chunkSink = (payload) => {
      if (!event.sender.isDestroyed()) event.sender.send('chat:chunk', payload)
    }
    try {
      return await chat(messages)
    } finally {
      chunkSink = null
    }
  })

  ipcMain.handle('search:web', async (e, query) => webSearch(String(query || '')))

  // 真实访问网址：离屏加载 + 取正文 + 截图
  ipcMain.handle('web:read', async (e, url, opts) => readPage(String(url || ''), opts || {}))
  ipcMain.handle('web:read-from-text', async (e, text) => {
    const url = pickUrl(String(text || ''))
    if (!url) return null
    try {
      return await readPage(url)
    } catch (err) {
      return { url, error: err.message || String(err) }
    }
  })

  ipcMain.handle('open:external', (e, url) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
  })
}

/* ------------------------------------------------------------------- boot */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#07080c',
    title: 'Termux AI Harness',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const shot = !!process.env.TAH_SHOT
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), shot ? { query: { shot: '1' } } : undefined)

  if (process.env.TAH_SHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (process.env.TAH_SHOT_SEND) {
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(
            `(() => { const i = document.getElementById('input'); i.value = ${JSON.stringify(process.env.TAH_SHOT_SEND)}; document.getElementById('composer').dispatchEvent(new Event('submit', { cancelable: true })); })()`
          )
        }, 3000)
      }
      setTimeout(async () => {
        try {
          const img = await mainWindow.webContents.capturePage()
          fs.writeFileSync(process.env.TAH_SHOT, img.toPNG())
        } catch (e) {
          console.error(e)
        }
        app.quit()
      }, Number(process.env.TAH_SHOT_DELAY || 1500))
    })
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  engineBin = findEngine()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopEngine()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopEngine())
