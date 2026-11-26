'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const http = require('node:http')
const https = require('node:https')
const { spawn } = require('node:child_process')
const net = require('node:net')

const BASE_PORT = 8080
let activePort = BASE_PORT
const endpoint = () => `http://127.0.0.1:${activePort}`

const CATALOG = [
  {
    id: 'low-cn',
    tier: '低配',
    name: 'Qwen2.5-0.5B-Instruct',
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    size: 491 * 1024 * 1024,
    sizeLabel: '491MB',
    ram: '0.4~0.6GB',
    note: '4GB 内存级设备，能跑但比较笨',
    url: 'https://hf-mirror.com/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    ctx: 512
  },
  {
    id: 'low-en',
    tier: '低配',
    name: 'TinyLlama-1.1B-Chat',
    file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    size: 669 * 1024 * 1024,
    sizeLabel: '669MB',
    ram: '0.8~1.0GB',
    note: '英文低配，中文基本别指望',
    url: 'https://hf-mirror.com/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    ctx: 512
  },
  {
    id: 'mid-en',
    tier: '中配',
    name: 'Llama-3.2-1B-Instruct',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    size: 808 * 1024 * 1024,
    sizeLabel: '808MB',
    ram: '0.8~1.0GB',
    note: '英文对话质量好，中文弱',
    url: 'https://hf-mirror.com/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    ctx: 1024
  },
  {
    id: 'mid-cn',
    tier: '中配',
    name: 'Qwen2.5-1.5B-Instruct',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    size: 1.12 * 1024 * 1024 * 1024,
    sizeLabel: '1.12GB',
    ram: '1.2~1.5GB',
    note: '主流手机 / 轻薄本，速度 9~14 t/s',
    url: 'https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    ctx: 1024
  },
  {
    id: 'high-cn',
    tier: '高配',
    name: 'Qwen2.5-3B-Instruct',
    file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    size: 1929903264,
    sizeLabel: '1.80GB',
    ram: '2.2~2.6GB',
    note: '推荐起点，守得住 CMD:/TEXT: 协议',
    url: 'https://hf-mirror.com/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    ctx: 2048
  },
  {
    id: 'high-en',
    tier: '高配',
    name: 'Llama-3.2-3B-Instruct',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: 2.02 * 1024 * 1024 * 1024,
    sizeLabel: '2.02GB',
    ram: '2.2~2.6GB',
    note: '英文高配，中文一般',
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
      if (!e.isFile()) continue
      if (!e.name.toLowerCase().endsWith('.gguf')) continue
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

function downloadModel(id, win) {
  const item = CATALOG.find((c) => c.id === id)
  if (!item) return Promise.reject(new Error('unknown model id'))

  const dir = path.join(app.getPath('userData'), 'models')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, item.file)
  const part = dest + '.part'

  if (fs.existsSync(dest)) {
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

  const args = ['-m', modelPath, '-c', String(ctx), '--port', String(activePort), '-t', String(threads)]
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
      stream: false
    })

    const req = http.request(
      `${endpoint()}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            const msg = parsed.choices && parsed.choices[0] && parsed.choices[0].message
            resolve({ ok: true, content: msg ? msg.content : '', raw: parsed })
          } catch (e) {
            reject(new Error(`bad response: ${data.slice(0, 200)}`))
          }
        })
      }
    )
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
    totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10
  }
}

function registerIpc() {
  ipcMain.handle('state:init', () => state())

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

  ipcMain.handle('chat:send', async (e, messages) => chat(messages))

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
