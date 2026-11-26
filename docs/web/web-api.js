/* Browser shim for the web build.
 * The web page only mirrors the UI: the real llama-server runs on the user's
 * own machine (Termux / cmd prompt) and is reached over 127.0.0.1. There is
 * no local file access, no engine spawn, no model download from the browser.
 */
(function () {
  'use strict'

  var PORTS = [8080, 8082]
  var endpoint = null

  var CATALOG = [
    { id: 'low-en', tier: '低配', name: 'TinyLlama-1.1B-Chat', file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf', size: 669 * 1024 * 1024, sizeLabel: '669MB', ram: '0.8~1.0GB', note: '英文低配，中文基本别指望', ctx: 512 },
    { id: 'vision-cn', tier: '识图', name: 'Qwen2.5-VL-3B-Instruct', file: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf', size: 1929 * 1024 * 1024, sizeLabel: '1.9GB', ram: '3~4GB', note: '能看图：把截图丢给它，它描述画面里的内容', mmproj: { file: 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf', size: 427 * 1024 * 1024 }, ctx: 4096 },
    { id: 'mid-en', tier: '中配', name: 'Llama-3.2-1B-Instruct', file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf', size: 808 * 1024 * 1024, sizeLabel: '808MB', ram: '0.8~1.0GB', note: '英文对话质量好，中文弱', ctx: 1024 },
    { id: 'mid-cn', tier: '中配', name: 'Qwen2.5-1.5B-Instruct', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', size: 1.12 * 1024 * 1024 * 1024, sizeLabel: '1.12GB', ram: '1.2~1.5GB', note: '主流手机 / 轻薄本，速度 9~14 t/s', ctx: 1024 },
    { id: 'high-cn', tier: '高配', name: 'Qwen2.5-3B-Instruct', file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf', size: 1929903264, sizeLabel: '1.80GB', ram: '2.2~2.6GB', note: '推荐起点，守得住 CMD:/TEXT: 协议', ctx: 2048 },
    { id: 'high-en', tier: '高配', name: 'Llama-3.2-3B-Instruct', file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf', size: 2.02 * 1024 * 1024 * 1024, sizeLabel: '2.02GB', ram: '2.2~2.6GB', note: '英文高配，中文一般', ctx: 2048 }
  ]

  function timeout(ms) {
    return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')) }, ms) })
  }

  async function probe() {
    for (var i = 0; i < PORTS.length; i++) {
      var p = PORTS[i]
      var url = 'http://127.0.0.1:' + p + '/v1/models'
      try {
        var r = await Promise.race([fetch(url, { method: 'GET', cache: 'no-store' }), timeout(1500)])
        if (r && r.ok) {
          var j = await r.json().catch(function () { return null })
          var list = (j && (j.models || j.data)) || []
          if (Array.isArray(list) && list.length) { endpoint = 'http://127.0.0.1:' + p; return endpoint }
        }
      } catch (e) { /* try next port */ }
    }
    endpoint = null
    return null
  }

  async function fetchPage(url) {
    var res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    var html = await res.text()
    var doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script,style,noscript,svg,iframe').forEach(function (n) { n.remove() })
    var title = (doc.querySelector('title') && doc.querySelector('title').textContent || '').trim()
    var text = (doc.body ? doc.body.innerText : doc.textContent || '').replace(/\s{3,}/g, '\n\n').trim()
    return { url: url, title: title, text: text.slice(0, 3500), chars: Math.min(text.length, 3500), shot: null }
  }

  window.api = {
    init: async function () {
      var ep = await probe()
      return {
        models: [],
        engine: ep ? '本机 llama-server @ ' + ep : null,
        catalog: CATALOG,
        endpoint: ep,
        ready: !!ep,
        cpuThreads: 2,
        totalMemGB: 8,
        vision: false
      }
    },
    startEngine: async function () {
      if (!endpoint) await probe()
      if (!endpoint) throw new Error('没探测到本机 llama-server（127.0.0.1:8080 / 8082）。请先在 Termux 或命令行按网页说明启动引擎')
      return { endpoint: endpoint }
    },
    stopEngine: async function () { return true },
    send: async function (messages) {
      if (!endpoint) await probe()
      if (!endpoint) throw new Error('引擎未连接')
      var r = await fetch(endpoint + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, temperature: 0.7, max_tokens: 512, stream: false })
      })
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160))
      var j = await r.json()
      var c = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : ''
      return { content: c }
    },
    search: async function () { return [] },
    readUrl: async function (url) {
      try { return await fetchPage(String(url || '')) }
      catch (e) { return { url: url, error: '网页读取失败：' + (e.message || e) + '（浏览器跨域限制，该站点可能不允许直接抓取）' } }
    },
    readFromText: async function () { return null },
    addModel: async function () { return null },
    pickEngine: async function () { return null },
    downloadModel: async function () {
      throw new Error('网页版不能在浏览器里下载模型，请在本机命令行用 engine/ 目录里的脚本下载并启动')
    },
    openExternal: function (u) { window.open(u, '_blank', 'noopener') },
    onChunk: function () {},
    onProgress: function () {},
    onEngineLog: function () {},
    onEngineExit: function () {}
  }
})()
