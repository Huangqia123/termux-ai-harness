'use strict'

const $ = (id) => document.getElementById(id)
const tx = (v) => (window.I18N ? I18N.tx(v) : v)

let state = null
let selected = null
let booting = false
let history = []

const SYSTEM_PROMPT_ZH =
  '你是一个完全本地运行的 AI 助手，跑在 llama.cpp 上。回答简洁、准确，不确定就说不确定，不要编造。'
const SYSTEM_PROMPT_EN =
  'You are a fully local AI assistant running on llama.cpp. Answer briefly and precisely; say you are unsure instead of inventing things.'
const systemPrompt = () => (window.I18N && I18N.lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH)

/* ----------------------------------------------------------------- boot */

function setStatus(text, kind) {
  $('status-text').textContent = tx(text)
  const dot = $('dot')
  dot.className = 'dot' + (kind ? ' ' + kind : '')
}

function fmtSize(bytes) {
  if (!bytes) return '?'
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + 'GB'
  return Math.round(bytes / 1024 / 1024) + 'MB'
}

async function boot() {
  setStatus('正在检测环境…')
  try {
    state = await window.api.init()
  } catch (e) {
    setStatus('检测失败：' + e.message, 'err')
    return
  }
  renderEngine()
  renderModels()
  updateStart()
  autoRoute(location.search.includes('shot=1'))
}

/* -------------------------------------------------------------- auto boot */

function pickRecommended() {
  const gb = state.totalMemGB || 8
  if (gb >= 7.5) return state.catalog.find((c) => c.id === 'high-cn')
  if (gb >= 3.5) return state.catalog.find((c) => c.id === 'mid-cn')
  return state.catalog.find((c) => c.id === 'low-cn')
}

function autoRoute(shotMode) {
  if (!state.engine) return

  if (state.models.length >= 2) {
    setStatus('发现 ' + state.models.length + ' 个模型，选一个再开始', 'ok')
    return
  }

  if (state.models.length === 1) {
    setStatus('检测到本地模型，正在自动加载…', 'ok')
    setTimeout(start, 200)
    return
  }

  if (shotMode) return

  const rec = pickRecommended()
  if (!rec) return
  const card = document.querySelector('.model-card[data-id="' + rec.id + '"]')
  setStatus('没找到模型，自动下载 ' + rec.name + '（' + rec.sizeLabel + '）', 'ok')
  if (card) card.scrollIntoView({ block: 'center' })
  startDownload(rec, card || null)
}

/* --------------------------------------------------------------- engine */

function renderEngine() {
  const badge = $('engine-badge')
  const hint = $('engine-hint')
  if (state.engine) {
    badge.textContent = window.I18N ? I18N.t('badge.ok') : '已就绪'
    badge.className = 'badge ok'
    hint.innerHTML = (window.I18N ? I18N.t("hint.engineFound") : '找到推理引擎：') + '<code class="mono">' + state.engine + '</code>'
    setStatus('环境正常，等待选择模型', 'ok')
  } else {
    badge.textContent = window.I18N ? I18N.t('badge.missing') : '未找到'
    badge.className = 'badge warn'
    hint.innerHTML =
      '没找到 <code class="mono">llama-server</code>。装好 llama.cpp 后把它放进 PATH，或点下面手动指定；' +
      '下完模型它会自动调用，不需要你配置端口。'
    setStatus('缺少推理引擎', 'err')
  }
}

/* ---------------------------------------------------------------- models */

function renderModels() {
  const list = $('model-list')
  const badge = $('model-badge')
  const hint = $('model-hint')
  list.innerHTML = ''

  const found = state.models

  if (found.length === 0) {
    badge.textContent = tx('未发现模型')
    badge.className = 'badge warn'
    hint.innerHTML = tx('本地没有 GGUF。下面是官网那 6 个，点一个就会自动下载到应用目录，下完自动选中。')
    renderCatalog()
    return
  }

  if (found.length === 1) {
    badge.textContent = tx('1 个')
    badge.className = 'badge ok'
    hint.textContent = tx('只发现一个模型，直接用它。')
    selected = found[0].path
    renderFoundCards(found, true)
    return
  }

  badge.textContent = tx(found.length + ' 个')
  badge.className = 'badge ok'
  hint.textContent = tx('发现多个模型，挑一个来跑。同时只启动一个，避免内存被打爆。')
  renderFoundCards(found, false)
}

function renderFoundCards(found, auto) {
  const list = $('model-list')
  found.forEach((m) => {
    const card = document.createElement('div')
    card.className = 'model-card' + (auto ? ' selected' : '')
    card.innerHTML =
      '<span class="tier">' + (window.I18N ? I18N.t('tier.local') : '本地') + '</span>' +
      '<h3>' + escapeHtml(m.name) + '</h3>' +
      '<div class="meta">' + fmtSize(m.size) + '</div>' +
      '<div class="note">' + escapeHtml(m.dir) + '</div>'
    card.onclick = () => {
      selected = m.path
      document.querySelectorAll('.model-card').forEach((c) => c.classList.remove('selected'))
      card.classList.add('selected')
      updateStart()
    }
    list.appendChild(card)
  })
}

function renderCatalog() {
  const list = $('model-list')
  state.catalog.forEach((item) => {
    const card = document.createElement('div')
    card.className = 'model-card'
    card.dataset.id = item.id
    card.innerHTML =
      '<span class="tier">' + (window.I18N && I18N.lang === 'en' && item.tierEn ? item.tierEn : item.tier) + '</span>' +
      '<h3>' + escapeHtml(item.name) + '</h3>' +
      '<div class="meta">' + item.sizeLabel + (window.I18N ? I18N.t('meta.ram', { ram: item.ram }) : ' · 约 ' + item.ram + ' 内存') + '</div>' +
      '<div class="note">' + escapeHtml(window.I18N && I18N.lang === 'en' && item.noteEn ? item.noteEn : item.note) + '</div>' +
      '<div class="progress"><span></span></div>'
    card.onclick = () => startDownload(item, card)
    list.appendChild(card)
  })
}

async function startDownload(item, card) {
  if (booting) return
  booting = true
  const bar = card ? card.querySelector('.progress') : null
  const fill = card ? card.querySelector('.progress span') : null
  if (bar) bar.classList.add('show')
  if (card) card.classList.add('selected')
  selected = null
  updateStart()

  try {
    const res = await window.api.downloadModel(item.id)
    selected = res.path
    state.models = [{ path: res.path, name: item.file, size: item.size, dir: '' }]
    setStatus('模型已就绪，正在启动服务…', 'ok')
    renderModels()
    if (state.engine) setTimeout(start, 200)
  } catch (e) {
    setStatus('下载失败：' + e.message, 'err')
    if (bar) bar.classList.remove('show')
    if (card) card.classList.remove('selected')
  } finally {
    booting = false
    updateStart()
  }
}

/* ---------------------------------------------------------------- launch */

function updateStart() {
  const btn = $('btn-start')
  const note = $('launch-note')
  const canStart = !!selected && !!state.engine
  btn.disabled = !canStart
  if (!state.engine) note.textContent = tx('先解决 llama-server')
  else if (!selected) note.textContent = tx('先选一个模型')
  else note.textContent = tx('将监听 127.0.0.1:' + 8080 + ' 并自动进入聊天')

  const chatModel = $('chat-model')
  if (chatModel && selected) chatModel.textContent = selected.split(/[\\/]/).pop()
}

async function start() {
  if (!selected) return
  const btn = $('btn-start')
  btn.disabled = true
  btn.textContent = tx('正在启动…')
  setStatus('正在加载模型，首次可能要十几秒', 'ok')

  try {
    const res = await window.api.startEngine({ modelPath: selected, threads: state.cpuThreads, ctx: 4096 })
    showChat(res.endpoint)
  } catch (e) {
    setStatus('启动失败：' + e.message, 'err')
    btn.disabled = false
    btn.textContent = tx('重试启动')
    const log = $('engine-log')
    log.classList.add('show')
    log.textContent += '\n启动失败：' + e.message + '\n'
    return
  }
  btn.textContent = window.I18N ? I18N.t('btn.start') : '启动并进入聊天'
}

/* ------------------------------------------------------------------ chat */

function showChat(endpoint) {
  $('setup').classList.add('hidden')
  $('chat').classList.remove('hidden')
  $('chat-endpoint').textContent = endpoint
  $('chat-model').textContent = selected ? selected.split(/[\\/]/).pop() : '—'
  setStatus('服务已就绪 · ' + endpoint, 'ok')
  addMsg('sys', '模型已加载，端口 ' + endpoint + '。直接聊，或让它帮你写命令。')
  $('input').focus()
}

function addMsg(kind, text) {
  const box = document.createElement('div')
  box.className = 'msg ' + kind
  box.textContent = tx(text)
  $('messages').appendChild(box)
  $('messages').scrollTop = $('messages').scrollHeight
  return box
}

let current = null

window.api.onChunk((d) => {
  if (!current || !d) return
  if (d.type === 'think') {
    current.thinkEl.style.display = 'block'
    current.think += d.text
    current.thinkEl.textContent = current.think
  } else if (d.type === 'text') {
    current.text += d.text
    current.bodyEl.textContent = current.text
  }
  $('messages').scrollTop = $('messages').scrollHeight
})

function aiBubble() {
  const box = document.createElement('div')
  box.className = 'msg ai'
  const thinkEl = document.createElement('div')
  thinkEl.className = 'think'
  thinkEl.style.display = 'none'
  const bodyEl = document.createElement('div')
  bodyEl.className = 'body'
  bodyEl.textContent = '…'
  box.appendChild(thinkEl)
  box.appendChild(bodyEl)
  $('messages').appendChild(box)
  $('messages').scrollTop = $('messages').scrollHeight
  current = { thinkEl, bodyEl, think: '', text: '' }
  return current
}

let pendingImage = null

function fileToDataUrl(file, maxSide) {
  maxSide = maxSide || 1024
  return new Promise(function (resolve, reject) {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = function () {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = function () {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

function setPendingImage(dataUrl) {
  pendingImage = dataUrl
  const btn = $('btn-img')
  if (btn) btn.textContent = tx('图片 ✓')
  addSys('已选好一张图片，发送时会一起交给模型')
}

async function takeImageFile(file) {
  if (!file || !/^image\//.test(file.type || '')) return
  try {
    const dataUrl = await fileToDataUrl(file)
    setPendingImage(dataUrl)
  } catch (e) {
    addSys('❌ 图片读取失败：' + e.message)
  }
}

function extractUrl(text) {
  const m = String(text || '').match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[\w\-./?%&=#+~]*)?/i)
  if (!m) return null
  let u = m[0].replace(/[),.;'"，。；）]+$/, '')
  if (!/^https?:\/\//i.test(u)) {
    if (!/\.[a-z]{2,}(?:[:/]|$)/i.test(u)) return null
    u = 'https://' + u
  }
  return /^https?:\/\//i.test(u) ? u : null
}

function addSys(text) {
  const box = document.createElement('div')
  box.className = 'msg sys'
  box.textContent = tx(text)
  $('messages').appendChild(box)
  $('messages').scrollTop = $('messages').scrollHeight
}

function fileUrl(p) {
  const s = String(p || '').replace(/\\/g, '/')
  const prefix = /^[a-zA-Z]:/.test(s) ? 'file:///' : 'file://'
  return prefix + encodeURI(s)
}

function addShot(src, url) {
  const box = document.createElement('div')
  box.className = 'msg shot'
  const img = document.createElement('img')
  img.src = /^data:/.test(String(src)) ? src : fileUrl(src)
  img.alt = url ? '网页截图' : '发送的图片'
  img.title = '点击打开原图'
  img.onclick = () => { if (url) window.api.openExternal(url) }
  box.appendChild(img)
  const cap = document.createElement('div')
  cap.className = 'shot-cap'
  cap.textContent = url || ''
  box.appendChild(cap)
  $('messages').appendChild(box)
  $('messages').scrollTop = $('messages').scrollHeight
}

async function webContext(query) {
  try {
    const hits = await window.api.search(query)
    if (!hits || !hits.length) return '\n\n（联网搜索没有返回结果。回答时说明没查到最新资料，不要编造。）'
    const lines = hits
      .map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.snippet}`.trim())
      .join('\n\n')
    return `\n\n以下是通过联网搜索刚取回的资料，回答时优先采用，并在句末标注来源编号：\n${lines}`
  } catch (e) {
    return '\n\n（联网搜索失败：' + (e.message || e) + '。如实告诉用户网络不通，不要编造搜索结果。）'
  }
}

async function send(text) {
  const value = text.trim()
  if (!value && !pendingImage) return
  const img = pendingImage
  pendingImage = null
  const imgBtn = $('btn-img')
  if (imgBtn) imgBtn.textContent = window.I18N ? I18N.t('btn.img') : '图片'

  addMsg('user', value || '（发送了一张图片）')
  if (img) addShot(img, '')
  $('input').value = ''
  const cur = aiBubble()
  const userContent = img
    ? [{ type: 'text', text: value || '看看这张图' }, { type: 'image_url', image_url: { url: img } }]
    : value
  history.push({ role: 'user', content: userContent })

  try {
    let system = systemPrompt()

    // 消息里带网址 -> 真实打开、取正文、截图，再把内容喂给模型
    const target = extractUrl(value)
    if (target) {
      cur.bodyEl.textContent = '正在打开 ' + target + ' …'
      let page = null
      try {
        page = await window.api.readUrl(target)
      } catch (e) {
        page = { url: target, error: e.message || String(e) }
      }
      if (!page || page.error) {
        const msg = (page && page.error) || '打不开这个网址'
        addSys('❌ ' + msg)
        system += '\n\n（用户要求查看网址 ' + target + '，但打开失败：' + msg + '。请如实告诉用户打不开，不要编造任何网页内容。）'
      } else if (page.text) {
        if (page.shot || page.shotDataUrl) addShot(page.shot || page.shotDataUrl, page.url)
        addSys('🌐 已读取 ' + page.url + '（' + (page.chars || 0) + ' 字' + (page.shotDataUrl ? ' + 截图' : '') + '）')
        system +=
          '\n\n以下是网页的真实内容（网址 ' + page.url + '，标题：' + page.title + '）：\n"""\n' +
          page.text +
          '\n"""\n请严格依据上面的网页内容回答，网页里没有的信息不要编造。'
      } else {
        addSys('⚠️ 这个页面没取到正文，只有截图')
        if (page.shot || page.shotDataUrl) addShot(page.shot || page.shotDataUrl, page.url)
      }
    }

    if ($('web-on') && $('web-on').checked) {
      cur.bodyEl.textContent = '联网搜索中…'
      system += await webContext(value)
    }
    const res = await window.api.send([
      { role: 'system', content: system },
      ...history.slice(-12)
    ])
    const answer = (res && res.content) || cur.text || '（空回复）'
    cur.bodyEl.textContent = answer
    history.push({ role: 'assistant', content: answer })
  } catch (e) {
    cur.bodyEl.textContent = '请求失败：' + e.message
    cur.bodyEl.style.color = '#ff8b8b'
  } finally {
    current = null
  }
}

/* ------------------------------------------------------------------- ui */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

window.api.onProgress((d) => {
  const card = document.querySelector('.model-card[data-id="' + d.id + '"]')
  if (!card) return
  const bar = card.querySelector('.progress')
  const fill = card.querySelector('.progress span')
  bar.classList.add('show')
  fill.style.width = Math.min(100, d.percent) + '%'
  if (d.done) setStatus('下载完成，正在准备启动', 'ok')
})

window.api.onEngineLog((line) => {
  const log = $('engine-log')
  log.classList.add('show')
  log.textContent += line + '\n'
  log.scrollTop = log.scrollHeight
})

window.api.onEngineExit((code) => {
  setStatus('服务已退出（code ' + code + '）', 'err')
  $('setup').classList.remove('hidden')
  $('chat').classList.add('hidden')
  $('btn-start').disabled = false
  $('btn-start').textContent = tx('重新启动')
})

$('btn-start').onclick = start

$('btn-pick-engine').onclick = async () => {
  const p = await window.api.pickEngine()
  if (p) {
    state.engine = p
    renderEngine()
    updateStart()
  }
}

$('btn-open-llama').onclick = () => {
  window.api.openExternal('https://github.com/ggml-org/llama.cpp/releases')
}

$('btn-add-model').onclick = async () => {
  const m = await window.api.addModel()
  if (!m) return
  selected = m.path
  state.models = state.models.concat([{ ...m, dir: '' }])
  renderModels()
  updateStart()
}


/* ------------------------------------------------------------ image input */

if ($('btn-img') && $('img-file')) {
  $('btn-img').onclick = () => $('img-file').click()
  $('img-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    await takeImageFile(f)
  }
}

window.addEventListener('paste', async (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || []
  for (const it of items) {
    if (it.type && it.type.indexOf('image/') === 0) {
      await takeImageFile(it.getAsFile())
      break
    }
  }
})

document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', async (e) => {
  e.preventDefault()
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
  if (f) await takeImageFile(f)
})

$('btn-open-site').onclick = () => window.api.openExternal('https://huangqia123.github.io/termux-ai-harness/')

$('btn-restart').onclick = async () => {
  await window.api.stopEngine()
  $('chat').classList.add('hidden')
  $('setup').classList.remove('hidden')
  $('btn-start').textContent = tx('重新启动')
  updateStart()
}

$('composer').onsubmit = (e) => {
  e.preventDefault()
  send($('input').value)
}

$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send($('input').value)
  }
})

document.addEventListener('langchange', () => {
  try { renderEngine() } catch (e) {}
  try { renderModels() } catch (e) {}
  try { updateStart() } catch (e) {}
})

boot()
