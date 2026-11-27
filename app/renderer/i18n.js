/* 轻量中英双语：data-i18n 机制 + localStorage 记忆 */
(function () {
  const DICT = {
    zh: {
      'status.checking': '正在检测环境…',
      'intro.title': '本地 AI，开机即用',
      'intro.desc': '自动找模型、自动起服务、自动进聊天。全程 <code>127.0.0.1</code>，不联网就不花钱。',
      'step.engine': '推理引擎',
      'badge.detecting': '检测中',
      'btn.pickEngine': '手动指定 llama-server',
      'btn.getLlama': '去下载 llama.cpp',
      'step.model': '模型',
      'badge.scanning': '扫描中',
      'btn.addModel': '选择本地 GGUF',
      'step.start': '启动',
      'btn.start': '启动并进入聊天',
      'chat.site': '官网',
      'chat.restart': '重启服务',
      'btn.img.title': '发一张图片给模型看',
      'btn.img': '图片',
      'input.placeholder': '问点什么，或让它干点什么…（可直接粘贴图片）',
      'btn.web.title': '先用 DuckDuckGo / 维基百科 搜一遍，再把结果喂给模型',
      'toggle.web': '联网',
      'btn.send': '发送',
      'badge.ok': '已就绪',
      'badge.missing': '未找到',
      'hint.engineFound': '找到推理引擎：',
      'hint.engineMissing': '没找到 <code class="mono">llama-server</code>。装好 llama.cpp 后把它放进 PATH，或点下面手动指定；下完模型它会自动调用，不需要你配置端口。',
      'status.envOk': '环境正常，等待选择模型',
      'status.noEngine': '缺少推理引擎',
      'tier.local': '本地',
      'meta.ram': ' · 约 {ram} 内存',
      'web.header': '\n\n以下是网页的真实内容（网址 {url}，标题：{title}）：\n"""\n',
      'web.footer': '\n"""\n请严格依据上面的网页内容回答，网页里没有的信息不要编造。',
    },
    en: {
      'status.checking': 'Detecting environment…',
      'intro.title': 'Local AI, ready when you boot',
      'intro.desc': 'Finds the models, starts the server, opens the chat — everything on <code>127.0.0.1</code>. No network, no bill.',
      'step.engine': 'Inference engine',
      'badge.detecting': 'Scanning',
      'btn.pickEngine': 'Pick llama-server manually',
      'btn.getLlama': 'Get llama.cpp',
      'step.model': 'Model',
      'badge.scanning': 'Scanning',
      'btn.addModel': 'Choose local GGUF',
      'step.start': 'Start',
      'btn.start': 'Start and open chat',
      'chat.site': 'Website',
      'chat.restart': 'Restart',
      'btn.img.title': 'Send an image to the model',
      'btn.img': 'Image',
      'input.placeholder': 'Ask something, or tell it what to do… (paste an image too)',
      'btn.web.title': 'Search DuckDuckGo / Wikipedia first, then feed the results to the model',
      'toggle.web': 'Web',
      'btn.send': 'Send',
      'badge.ok': 'Ready',
      'badge.missing': 'Not found',
      'hint.engineFound': 'Inference engine found: ',
      'hint.engineMissing': '<code class="mono">llama-server</code> was not found. Install llama.cpp and put it on PATH, or pick it manually below. Once a model is downloaded it launches automatically — no port setup needed.',
      'status.envOk': 'Environment OK — choose a model',
      'status.noEngine': 'Inference engine missing',
      'tier.local': 'Local',
      'meta.ram': ' · ~{ram} RAM',
      'web.header': '\n\nHere is the real content of the page (URL {url}, title: {title}):\n"""\n',
      'web.footer': '\n"""\nAnswer strictly from the page content above; do not invent anything not present there.',
    },
  }

  /* 动态文案：按中文原句/前缀替换成英文；中文模式原样返回 */
  const RULES = [
    [/你是一个完全本地运行的 AI 助手，(.*)$/s,
      'You are a fully local AI assistant running on llama.cpp. Answer briefly and precisely; say you are unsure instead of inventing things.'],
    [/^正在检测环境…$/, 'Detecting environment…'],
    [/^检测失败：/, 'Detection failed: '],
    [/^发现 (\d+) 个模型，选一个再开始$/, 'Found $1 models — pick one to start'],
    [/^检测到本地模型，正在自动加载…$/, 'Local model detected, loading automatically…'],
    [/^没找到模型，自动下载 (.+)（(.+)）$/i, 'No model found — downloading $1 ($2)'],
    [/^已就绪$/, 'Ready'],
    [/^未找到$/, 'Not found'],
    [/^未发现模型$/, 'No model found'],
    [/^缺少推理引擎$/, 'Inference engine missing'],
    [/^环境正常，等待选择模型$/, 'Environment OK — waiting for a model'],
    [/^本地没有 GGUF。下面是官网那 6 个，点一个就会自动下载到应用目录，下完自动选中。$/,
      'No GGUF on this machine. The 6 official builds are listed below — click one and it downloads into the app folder, then gets selected automatically.'],
    [/^1 个$/, '1 model'],
    [/^只发现一个模型，直接用它。$/, 'Only one model found — using it directly.'],
    [/^([\d,]+) 个$/, '$1 models'],
    [/^发现多个模型，挑一个来跑。同时只启动一个，避免内存被打爆。$/,
      'Several models found. Pick one to run — only one is loaded at a time so memory does not blow up.'],
    [/^模型已就绪，正在启动服务…$/, 'Model ready — starting the service…'],
    [/^下载失败：/, 'Download failed: '],
    [/^先解决 llama-server$/, 'Install llama-server first'],
    [/^先选一个模型$/, 'Pick a model first'],
    [/^将监听 127\.0\.0\.1:(\d+) 并自动进入聊天$/, 'Will listen on 127.0.0.1:$1 and open the chat'],
    [/^正在启动…$/, 'Starting…'],
    [/^重新启动$/, 'Restart'],
    [/^重试启动$/, 'Retry'],
    [/^启动并进入聊天$/, 'Start and open chat'],
    [/^正在加载模型，首次可能要十几秒$/, 'Loading the model — the first run can take ~15 seconds'],
    [/^启动失败：/, 'Start failed: '],
    [/^服务已就绪 · /, 'Service ready · '],
    [/^模型已加载，端口 (.+)。直接聊，或让它帮你写命令。$/, 'Model loaded on $1. Chat away, or ask it to write commands for you.'],
    [/^图片读取失败$/, 'Could not read the image'],
    [/^图片 ✓$/, 'Image ✓'],
    [/^已选好一张图片，发送时会一起交给模型$/, 'Image attached — it goes to the model with your next message'],
    [/^❌ 图片读取失败：/, '❌ Could not read the image: '],
    [/^网页截图$/, 'Page screenshot'],
    [/^发送的图片$/, 'Uploaded image'],
    [/^点击打开原图$/, 'Click to open the full image'],
    [/^（联网搜索没有返回结果。回答时说明没查到最新资料，不要编造。）$/,
      '(The web search returned nothing. Tell the user you could not find fresh material; do not invent it.)'],
    [/^以下是通过联网搜索刚取回的资料，回答时优先采用，并在句末标注来源编号：$/,
      'Here are results just fetched from the web. Prefer them and cite the source number at the end of each sentence:'],
    [/^（联网搜索失败：/, '(Web search failed: '],
    [/^（发送了一张图片）$/, '(sent an image)'],
    [/^看看这张图$/, 'Look at this image'],
    [/^正在打开 (.*) …$/, 'Opening $1 …'],
    [/^打不开这个网址$/, 'Could not open this URL'],
    [/^已读取 (.+)（(\d*) 字/, 'Read $1 ($2 chars'],
    [/^⚠️ 这个页面没取到正文，只有截图$/, '⚠️ No body text was extracted — screenshot only'],
    [/^联网搜索中…$/, 'Searching the web…'],
    [/^（空回复）$/, '(empty reply)'],
    [/^请求失败：/, 'Request failed: '],
    [/^下载完成，正在准备启动$/, 'Download complete — preparing to start'],
    [/^服务已退出（code (\d+)）$/, 'Service exited (code $1)'],
    [/^以下网页的真实内容/,
      'Real content of the page'],
  ]

  function tx(text) {
    if (lang === 'zh' || !text) return text
    let s = String(text)
    for (let i = 0; i < RULES.length; i++) {
      const re = RULES[i][0]
      if (re.test(s)) return s.replace(re, RULES[i][1])
    }
    return s
  }

  let lang = localStorage.getItem('tih-lang') || 'zh'

  function t(key, vars) {
    const table = DICT[lang] || DICT.zh
    let s = table[key] != null ? table[key] : (DICT.zh[key] != null ? DICT.zh[key] : key)
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('{' + k + '}', 'g'), vars[k])
      })
    }
    return s
  }

  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n')
      const val = t(key)
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = val
      else el.textContent = val
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')))
    })
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')))
    })
    const btn = document.getElementById('btn-lang')
    if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中'
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'zh'
    localStorage.setItem('tih-lang', lang)
    apply()
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }))
  }

  function toggle() {
    setLang(lang === 'zh' ? 'en' : 'zh')
  }

  window.I18N = {
    get lang() { return lang },
    t: t,
    tx: tx,
    apply: apply,
    setLang: setLang,
    toggle: toggle,
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply()
    const btn = document.getElementById('btn-lang')
    if (btn) btn.addEventListener('click', toggle)
  })
})()
