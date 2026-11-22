/**
 * The settings window.
 *
 * It shows the one question the app cannot answer for a person — where the Harness is — and the
 * three preferences that decide how it is reached and drawn. Everything is written by the main
 * process; this page only collects and reports.
 */
const $ = (id) => document.getElementById(id)

let current = null

function fill (config) {
  const connection = config.connection ?? {}
  $('mode').value = connection.mode === 'remote' ? 'remote' : 'local'
  $('url').value = connection.url ?? ''
  $('profile').value = connection.profile ?? 'reins'
  $('port').value = connection.port ?? 0
  $('onExit').value = connection.onExit === 'detach' ? 'detach' : 'stop'
  $('home').value = connection.home ?? ''
  $('theme').value = config.theme ?? 'system'
  $('tabs').checked = config.tabs !== false
  const proxy = config.proxy ?? {}
  $('proxyMode').value = proxy.mode ?? 'system'
  $('proxyRules').value = proxy.rules ?? ''
  $('proxyBypass').value = proxy.bypass ?? ''
  syncBoxes()
}

/** Only the fields that matter for the chosen mode are shown. */
function syncBoxes () {
  const remote = $('mode').value === 'remote'
  $('remote-box').style.display = remote ? '' : 'none'
  $('local-box').style.display = remote ? 'none' : ''
  $('proxy-box').style.display = $('proxyMode').value === 'manual' ? '' : 'none'
}

/** What is typed here; the token is read once and cleared by the caller. */
function collect () {
  const tokenField = $('token').value.trim()
  return {
    config: {
      connection: {
        mode: $('mode').value,
        url: $('url').value.trim(),
        profile: $('profile').value.trim() || 'reins',
        port: Number($('port').value) || 0,
        home: $('home').value.trim(),
        onExit: $('onExit').value
      },
      theme: $('theme').value,
      tabs: $('tabs').checked,
      proxy: {
        mode: $('proxyMode').value,
        rules: $('proxyRules').value.trim(),
        bypass: $('proxyBypass').value.trim() || 'localhost,127.0.0.1,::1'
      }
    },
    token: tokenField
  }
}

/** A token is accepted as a whole link; only the `token` parameter is taken out of it. */
function tokenOf (value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.searchParams.get('token') ?? value
  } catch {
    return value
  }
}

function status (text, kind = '') {
  const node = $('status')
  node.textContent = text
  node.className = `status ${kind}`
}

function logLines (lines) {
  $('log').textContent = (lines ?? []).join('\n')
}

async function save (patch = {}) {
  return window.reins.save(patch)
}

async function saveOnly () {
  const { config, token } = collect()
  await window.reins.token(tokenOf(token))
  const saved = await save(config)
  current = saved
  status('сохранено', 'good')
}

async function connect () {
  const { config, token } = collect()
  $('connect').disabled = true
  status('подключаюсь…')
  try {
    await window.reins.token(tokenOf(token))
    const result = await window.reins.connect(config)
    $('token').value = ''
    if (!result.ok) {
      status(result.error ?? 'не удалось подключиться', 'bad')
      return
    }
    status(result.authorized ? 'подключено' : `нужна ссылка с токеном: ${result.reason ?? ''}`, result.authorized ? 'good' : 'bad')
  } finally {
    $('connect').disabled = false
    const fresh = await window.reins.state()
    current = fresh.config
    logLines(fresh.log)
  }
}

$('mode').addEventListener('change', syncBoxes)
$('proxyMode').addEventListener('change', syncBoxes)
$('save').addEventListener('click', saveOnly)
$('connect').addEventListener('click', connect)

window.addEventListener('DOMContentLoaded', async () => {
  const state = await window.reins.state()
  current = state.config
  fill(state.config)
  logLines(state.log)
  if (state.authorized) status(`уже авторизован: ${state.base}`, 'good')
  else status(state.reason ?? 'не подключён', state.base ? 'bad' : '')
})

window.reins.onMessage((text) => {
  if (text) status(text, 'bad')
})
