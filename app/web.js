'use strict'

const { BrowserWindow, app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const MAX_TEXT = 3500
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function normalizeUrl(raw) {
  let u = String(raw || '').trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    const p = new URL(u)
    if (!/^https?:$/.test(p.protocol)) return null
    return p.toString()
  } catch {
    return null
  }
}

function cleanText(t) {
  return String(t || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function timeout(promise, ms, label) {
  let timer
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + '超时（' + Math.round(ms / 1000) + 's）')), ms)
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer))
}

/**
 * 用一个离屏窗口真实加载网页：
 *  - 拿到 JS 渲染后的正文（比 http 抓 HTML 更接近人眼所见）
 *  - capturePage 截整页首屏，落盘 png
 * 全平台通用（Windows / macOS / Linux；Android 走同一套 Electron 内核）。
 */
async function readPage(rawUrl, opts = {}) {
  const url = normalizeUrl(rawUrl)
  if (!url) throw new Error('不是合法的 http/https 网址')

  const timeoutMs = opts.timeoutMs || 25000
  const settleMs = opts.settleMs == null ? 1200 : opts.settleMs
  const wantShot = opts.shot !== false

  const win = new BrowserWindow({
    show: false,
    width: opts.width || 1366,
    height: opts.height || 900,
    webPreferences: {
      offscreen: true,
      javascript: true,
      images: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: true
    }
  })
  win.webContents.setAudioMuted(true)

  try {
    await timeout(
      new Promise((resolve, reject) => {
        let settled = false
        const ok = () => {
          if (!settled) {
            settled = true
            resolve()
          }
        }
        const bad = (msg) => {
          if (!settled) {
            settled = true
            reject(new Error(msg))
          }
        }
        win.webContents.once('did-finish-load', ok)
        win.webContents.once('did-fail-load', (_e, code, desc, validated) => {
          if (!validated) bad('打不开这个网址：' + (desc || code))
        })
        win.webContents.on('certificate-error', (e) => e.preventDefault())
        win.loadURL(url, { userAgent: UA }).catch((err) => bad(err.message || '加载失败'))
      }),
      timeoutMs,
      '网页加载'
    )

    if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs))

    const title = await win.webContents
      .executeJavaScript('document.title || ""', true)
      .catch(() => '')

    const raw = await win.webContents
      .executeJavaScript(
        '(document.body && (document.body.innerText || document.body.textContent)) || ""',
        true
      )
      .catch(() => '')

    const text = cleanText(raw)
    const truncated = text.length > MAX_TEXT

    let shot = null
    let shotDataUrl = null
    if (wantShot) {
      try {
        const img = await win.webContents.capturePage()
        if (img && !img.isEmpty()) {
          const dir = path.join(app.getPath('userData'), 'shots')
          fs.mkdirSync(dir, { recursive: true })
          const file = path.join(dir, 'shot-' + Date.now() + '.png')
          fs.writeFileSync(file, img.toPNG())
          shot = file
          try {
            const w = img.getSize().width
            const thumb = w > 900 ? img.resize({ width: 900 }) : img
            shotDataUrl = thumb.toDataURL()
          } catch {
            try { shotDataUrl = img.toDataURL() } catch { shotDataUrl = null }
          }
        }
      } catch {
        shot = null
      }
    }

    return {
      url,
      title: cleanText(title).slice(0, 200),
      text: truncated ? text.slice(0, MAX_TEXT) + '\n…（正文过长，已截断）' : text,
      chars: text.length,
      shot,
      shotDataUrl
    }
  } finally {
    try {
      win.destroy()
    } catch {}
  }
}

/** 从一段自然语言里挑出第一个网址 */
function pickUrl(text) {
  const m = String(text || '').match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[\w\-./?%&=#+~]*)?/i)
  if (!m) return null
  const candidate = m[0].replace(/[),.;'"，。；）]+$/, '')
  if (!/^https?:\/\//i.test(candidate)) {
    if (!/\.[a-z]{2,}(?:[:/]|$)/i.test(candidate)) return null
  }
  return normalizeUrl(candidate)
}

module.exports = { readPage, pickUrl, normalizeUrl }
