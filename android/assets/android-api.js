// Android 版 API 适配层：App 自身不跑模型，前端连接 Termux 里跑的 llama-server。
// 全部同步定义，保证 app.js 在顶层注册 onChunk 等回调时 window.api 已存在。
(function () {
  var EP = 'http://127.0.0.1:8080'
  var ALIVE = false

  function probe() {
    return fetch(EP + '/health', { cache: 'no-store' })
      .then(function (r) { ALIVE = r.ok; return ALIVE })
      .catch(function () { ALIVE = false; return false })
  }

  window.api = {
    init: function () {
      return probe().then(function (alive) {
        return {
          engine: alive ? 'Termux llama-server @ 127.0.0.1:8080' : null,
          models: alive
            ? [{
                name: 'Termux 里的本地模型',
                size: 0,
                dir: '127.0.0.1:8080',
                path: 'termux-llama-server'
              }]
            : [],
          catalog: [],
          totalMemGB: 0,
          cpuThreads: 0
        }
      })
    },

    startEngine: function () {
      return probe().then(function (alive) {
        if (!alive) {
          throw new Error('没检测到 llama-server。请在 Termux 里先执行：llama-server -m 你的模型.gguf --port 8080')
        }
        return { endpoint: EP }
      })
    },

    stopEngine: function () { return Promise.resolve() },
    downloadModel: function () { return Promise.reject(new Error('Android 版请在 Termux 里下载模型（仓库里的 download-models.sh）')) },
    addModel: function () { return Promise.resolve(null) },
    pickEngine: function () { return Promise.resolve(null) },

    openExternal: function (url) {
      if (window.AndroidApi && window.AndroidApi.openExternal) window.AndroidApi.openExternal(String(url))
      else window.open(url, '_blank')
    },

    search: function (query) {
      if (window.AndroidApi && window.AndroidApi.webSearch) {
        try {
          var raw = window.AndroidApi.webSearch(String(query))
          var hits = JSON.parse(raw || '[]')
          return Promise.resolve(Array.isArray(hits) ? hits : [])
        } catch (e) {
          return Promise.reject(e)
        }
      }
      return Promise.resolve([])
    },

    readUrl: function (url) {
      if (window.AndroidApi && window.AndroidApi.readUrl) {
        try {
          var raw = window.AndroidApi.readUrl(String(url))
          return Promise.resolve(JSON.parse(raw || '{}'))
        } catch (e) {
          return Promise.reject(e)
        }
      }
      return Promise.reject(new Error('这个版本不支持读取网页'))
    },

    send: function (messages) {
      return fetch(EP + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, max_tokens: 512, temperature: 0.7 })
      })
        .then(function (r) { return r.json() })
        .then(function (j) {
          var c = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : ''
          return { content: c || '' }
        })
    },

    onChunk: function () {},
    onProgress: function () {},
    onEngineLog: function () {},
    onEngineExit: function () {}
  }
})()
