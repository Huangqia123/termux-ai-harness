'use strict'

/* 首次启动的账号引导：本地账号 / GitHub 账号 + 本地人机验证（滑块） */

;(function () {
  const api = window.api
  if (!api || !api.profileList) return

  let profiles = []
  let pendingType = 'local'
  let busy = false

  const el = (tag, cls, text) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  /* ---------------------------------------------------------- 人机验证判定 */

  function judge(samples, trackW, thumbW, targetLeft) {
    const n = samples.length
    if (n < 6) return { human: false, reason: 'too-few-samples' }
    const first = samples[0]
    const last = samples[n - 1]
    const duration = last.t - first.t
    if (duration < 140) return { human: false, reason: 'too-fast', detail: { duration } }

    const speeds = []
    for (let i = 1; i < n; i++) {
      const dt = samples[i].t - samples[i - 1].t
      if (dt <= 0) continue
      speeds.push(Math.abs(samples[i].x - samples[i - 1].x) / dt)
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length || 0
    const dev = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length)
    const cv = mean > 0 ? dev / mean : 0

    let yMin = Infinity
    let yMax = -Infinity
    for (const s of samples) {
      if (s.y < yMin) yMin = s.y
      if (s.y > yMax) yMax = s.y
    }
    const yRange = yMax - yMin

    const bias = Math.abs(last.x - targetLeft)

    // 机器人特征：轨迹几乎笔直（无手抖）+ 落点几乎零偏差
    const perfect = bias < 1.2 && yRange < 1.6
    if (perfect) return { human: false, reason: 'too-perfect', detail: { cv, yRange, bias } }

    // 人类特征：纵向手抖明显，或速度有快慢变化，或落点有可见偏差
    const humanish = yRange > 1.6 || cv > 0.12 || bias >= 1.5
    if (!humanish) return { human: false, reason: 'too-perfect', detail: { cv, yRange, bias } }

    return { human: true, detail: { cv: cv.toFixed(3), yRange: yRange.toFixed(2), bias: bias.toFixed(1), duration: Math.round(duration) } }
  }

  /* ------------------------------------------------------------- 滑块组件 */

  function buildSlider(label, onPass, onFail) {
    const box = el('div', 'ob-slider')
    const track = el('div', 's-track')
    const slot = el('div', 's-slot')
    const fill = el('div', 's-fill')
    const thumb = el('div', 's-thumb', '››')
    const text = el('span', 's-text', label || '按住滑块，拖到虚线框')
    track.append(slot, fill, thumb, text)
    const note = el('p', 's-note')
    box.append(track, note)

    const slotW = 54
    const thumbW = 56
    const geo = { left: 0 }

    function measure() {
      const tw = track.clientWidth || 520
      geo.left = Math.max(10, Math.round(tw * (0.62 + Math.random() * 0.22)) - slotW / 2)
      slot.style.left = geo.left + 'px'
    }

    let dragging = false
    let startX = 0
    let samples = []

    const maxX = () => track.clientWidth - thumbW

    function place(left) {
      thumb.style.transform = `translateX(${left}px)`
      fill.style.width = left + thumbW / 2 + 'px'
    }

    requestAnimationFrame(measure)

    thumb.addEventListener('pointerdown', (e) => {
      if (busy) return
      if (!geo.left) measure()
      dragging = true
      startX = e.clientX
      samples = [{ t: performance.now(), x: 0, y: 0 }]
      try {
        thumb.setPointerCapture(e.pointerId)
      } catch {}
      text.style.opacity = '0'
      e.preventDefault()
    })

    thumb.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const rel = Math.max(0, Math.min(maxX(), e.clientX - startX))
      const r = track.getBoundingClientRect()
      samples.push({
        t: performance.now(),
        x: rel,
        y: e.clientY - (r.top + r.height / 2)
      })
      place(rel)
    })

    thumb.addEventListener('pointerup', (e) => {
      if (!dragging) return
      dragging = false
      const rel = Math.max(0, Math.min(maxX(), e.clientX - startX))
      const r = track.getBoundingClientRect()
      samples.push({ t: performance.now(), x: rel, y: e.clientY - (r.top + r.height / 2) })
      place(rel)
      const res = judge(samples, track.clientWidth, thumbW, geo.left)
      const hitSlot = Math.abs(rel - geo.left) <= slotW / 2 + 6

      if (res.human && hitSlot) {
        thumb.classList.add('ok')
        track.classList.add('ok')
        busy = true
        const d = res.detail
        note.textContent = `验证通过 · 抖动 ${d.yRange}px / 偏差 ${d.bias}px / 速度变化 ${d.cv}`
        note.style.color = 'var(--accent)'
        setTimeout(() => onPass && onPass(), 700)
        return
      }

      thumb.classList.add('bad')
      setTimeout(() => {
        thumb.classList.remove('bad')
        place(0)
        track.classList.remove('ok')
      }, 380)
      if (!res.human) {
        note.textContent =
          res.reason === 'too-fast'
            ? '拖得太快了，不像人手。慢一点再来。'
            : '轨迹太完美，判定为机器人。手抖一点点、别正好停中心。'
      } else {
        note.textContent = '手抖够了，但没拖到虚线框里。对准框再松手。'
      }
      note.style.color = 'var(--warn)'
      onFail && onFail(res)
    })
    return box
  }

  /* ------------------------------------------------------------- 引导视图 */

  let onboard

  function show() {
    if (!onboard) {
      onboard = el('div', 'onboard')
      onboard.innerHTML = `<div class="ob-card"><div class="ob-head">
        <span class="brand-mark">&gt;_</span>
        <div><h2>设置账号</h2><p class="ob-sub">所有数据只留在这台设备上，不上传、不联网</p></div>
      </div><div class="ob-body"></div><div class="ob-foot"></div></div>`
      document.body.append(onboard)
    }
    onboard.classList.remove('hidden')
    renderChoose()
  }

  const body = () => onboard.querySelector('.ob-body')
  const foot = () => onboard.querySelector('.ob-foot')

  function renderChoose() {
    busy = false
    body().innerHTML = ''
    foot().innerHTML = '<span class="ob-tip">先选一个账号方式，两种都要过人机验证</span>'

    const grid = el('div', 'ob-grid')

    const cards = [
      {
        type: 'local',
        tag: '离线',
        title: '本地账号',
        desc: '立刻创建，数据只存本机。不要邮箱、不要验证码。',
        meta: '秒开 · 无网络'
      },
      {
        type: 'github',
        tag: '联网',
        title: 'GitHub 账号',
        desc: '绑定 GitHub，用于同步与身份标识。需要浏览器授权一次。',
        meta: '设备码授权 · 需联网'
      }
    ]

    for (const c of cards) {
      const card = el('button', 'ob-acct')
      card.type = 'button'
      card.innerHTML = `<span class="ob-tag ${c.type}">${c.tag}</span>
        <h3>${c.title}</h3><p>${c.desc}</p><span class="ob-meta">${c.meta}</span>`
      card.onclick = () => startFlow(c.type)
      grid.append(card)
    }
    body().append(grid)
  }

  function startFlow(type) {
    pendingType = type
    renderHuman(type)
  }

  function renderHuman(type) {
    body().innerHTML = ''
    const title = el('h3', 'ob-step', type === 'local' ? '本地账号 · 人机验证' : 'GitHub 账号 · 人机验证')
    const hint = el(
      'p',
      'ob-hint',
      '按住滑块，拖到虚线框里松手。判定不看你是不是点了，看轨迹：速度有没有起伏、手有没有抖、最后停得准不准。太直、太稳、正正好好命中，会被判成机器人。'
    )
    body().append(title, hint)
    body().append(
      buildSlider(
        '按住滑块，拖到虚线框',
        () => (type === 'local' ? renderLocalForm() : renderGithubForm()),
        () => {}
      )
    )
    foot().innerHTML = '<button class="ob-link" id="ob-back" type="button">← 换一种账号</button>'
    foot().querySelector('#ob-back').onclick = renderChoose
  }

  function renderLocalForm() {
    busy = false
    body().innerHTML = ''
    const t = el('h3', 'ob-step', '本地账号 · 创建')
    body().append(t)

    const form = el('div', 'ob-form')
    form.innerHTML = `
      <label>昵称<input id="ob-name" maxlength="24" placeholder="比如 黄桥" /></label>
      <label>PIN（至少 4 位，只用数字也行）<input id="ob-pin" type="password" inputmode="numeric" maxlength="32" placeholder="解锁用，别写生日" /></label>
      <label>再输一次<input id="ob-pin2" type="password" inputmode="numeric" maxlength="32" /></label>
      <p class="ob-err" id="ob-err"></p>
      <button class="btn primary ob-submit" id="ob-create" type="button">创建并进入</button>`

    body().append(form)
    foot().innerHTML = '<span class="ob-tip">PIN 只在本机哈希保存，不上传</span>'

    const err = form.querySelector('#ob-err')
    form.querySelector('#ob-create').onclick = async () => {
      if (busy) return
      const name = form.querySelector('#ob-name').value.trim()
      const pin = form.querySelector('#ob-pin').value
      const pin2 = form.querySelector('#ob-pin2').value
      err.textContent = ''
      if (!name) return (err.textContent = '昵称不能空着')
      if (pin.length < 4) return (err.textContent = 'PIN 至少 4 位')
      if (pin !== pin2) return (err.textContent = '两次 PIN 不一致')
      busy = true
      const r = await api.profileCreate({ name, pin, type: 'local' })
      busy = false
      if (!r.ok) {
        err.textContent =
          r.error === 'name-taken' ? '这个昵称已经用过了' : r.error === 'bad-pin' ? 'PIN 长度不对' : '创建失败：' + r.error
        return
      }
      renderRecovery(r.recoveryCode, r.profile)
    }
  }

  function renderRecovery(code, profile) {
    body().innerHTML = ''
    body().append(el('h3', 'ob-step', '记下恢复码'))
    body().append(
      el('p', 'ob-hint', `账号「${profile.name}」已创建。这串恢复码只显示这一次——PIN 忘了、或者要换 PIN，只能靠它。抄到纸上，别只存在这台机器里。`)
    )
    const box = el('div', 'ob-code', code)
    const copy = el('button', 'btn tiny ghost', '复制')
    copy.type = 'button'
    copy.onclick = () => {
      navigator.clipboard.writeText(code)
      copy.textContent = '已复制'
    }
    body().append(box, copy)
    foot().innerHTML = '<button class="btn primary" id="ob-go" type="button">进入应用</button>'
    foot().querySelector('#ob-go').onclick = done
  }

  function renderGithubForm() {
    body().innerHTML = ''
    body().append(el('h3', 'ob-step', 'GitHub 账号'))
    body().append(
      el('p', 'ob-hint', 'GitHub 登录走设备码：这里给你 8 位码，你去浏览器输入并授权，回来就绑好了。需要一个 OAuth App 的 Client ID（自己建一个，别用别人的）。')
    )
    const form = el('div', 'ob-form')
    form.innerHTML = `
      <label>OAuth App Client ID<input id="ob-cid" placeholder="Iv1.xxxxxxxxxxxx" /></label>
      <label>昵称<input id="ob-ghname" maxlength="24" placeholder="显示名，比如 Huangqia123" /></label>
      <p class="ob-err" id="ob-gerr"></p>
      <button class="btn primary ob-submit" id="ob-ghgo" type="button">获取设备码</button>`
    body().append(form)
    foot().innerHTML = '<span class="ob-tip">不想建 OAuth App 就先选本地账号</span>'

    const err = form.querySelector('#ob-gerr')
    form.querySelector('#ob-ghgo').onclick = async () => {
      const cid = form.querySelector('#ob-cid').value.trim()
      const name = form.querySelector('#ob-ghname').value.trim() || 'GitHub 用户'
      if (!cid) return (err.textContent = '先填 Client ID')
      err.textContent = '正在请求设备码…'
      const r = await api.githubDeviceCode(cid)
      if (!r || !r.ok) return (err.textContent = '拿设备码失败：' + ((r && r.error) || '未知错误'))
      renderGithubCode(cid, name, r.data)
    }
  }

  function renderGithubCode(cid, name, data) {
    body().innerHTML = ''
    body().append(el('h3', 'ob-step', '在浏览器里授权'))
    body().append(
      el('p', 'ob-hint', `打开 ${data.verification_uri} ，输入下面这串码，然后点授权。我这边会一直等。`)
    )
    body().append(el('div', 'ob-code', data.user_code))
    const st = el('p', 's-note', '等待授权…')
    body().append(st)
    foot().innerHTML = '<button class="ob-link" id="ob-back2" type="button">← 换一种账号</button>'
    foot().querySelector('#ob-back2').onclick = renderChoose

    const interval = Math.max(5, data.interval || 5) * 1000
    const deadline = Date.now() + (data.expires_in || 900) * 1000
    const poll = async () => {
      if (Date.now() > deadline) {
        st.textContent = '设备码过期了，重来一次。'
        st.style.color = 'var(--warn)'
        return
      }
      const r = await api.githubPoll({ clientId: cid, deviceCode: data.device_code })
      if (r && r.ok && r.token) {
        const p = await api.profileCreate({ name, pin: 'github', type: 'github' })
        st.textContent = '授权成功，账号已绑定。'
        st.style.color = 'var(--accent)'
        setTimeout(done, 900)
        return
      }
      if (r && (r.error === 'expired_token' || r.error === 'access_denied')) {
        st.textContent = '授权失败：' + r.error
        st.style.color = 'var(--warn)'
        return
      }
      setTimeout(poll, interval)
    }
    setTimeout(poll, interval)
  }

  function done() {
    if (onboard) onboard.classList.add('hidden')
    window.dispatchEvent(new CustomEvent('tah:profile-ready'))
  }

  /* --------------------------------------------------------- 已存在账号时 */

  async function init() {
    const r = await api.profileList()
    profiles = r.profiles || []
    if (!profiles.length) show()
  }

  window.TAH_AUTH = { show, init }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
