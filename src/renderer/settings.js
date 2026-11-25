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
  adoptLink()
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
/**
 * A pasted launch link, split into the two things it carries.
 *
 * `https://host/?token=…` is one string on the clipboard and two fields on this page, so it is
 * parsed once here: the origin becomes the address, the `token` parameter becomes the token. What
 * is not a link is taken as a bare token — a person may have copied just the value.
 */
function linkParts (value) {
  const raw = String(value ?? '').trim()
  if (!raw) return { origin: '', token: '' }
  try {
    const url = new URL(raw)
    return { origin: url.origin, token: url.searchParams.get('token') ?? '' }
  } catch {
    return { origin: '', token: raw }
  }
}

/** The token alone, for the request. */
function tokenOf (value) {
  const parts = linkParts(value)
  return parts.token
}

/**
 * A link in the token field is the whole answer: it names the server too.
 *
 * The mode is switched and the address is filled, because asking for the same server twice — once
 * as a link and once as an address — is exactly the confusion this field exists to avoid.
 */
function adoptLink () {
  const parts = linkParts($('token').value)
  if (!parts.origin) return
  if ($('mode').value !== 'remote') {
    $('mode').value = 'remote'
    syncBoxes()
  }
  // the link wins over whatever stands in the address field: it is the freshest statement about
  // which server this is, and a stale address silently sent the token to the wrong host
  $('url').value = parts.origin
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
  status('saved', 'good')
}

async function connect () {
  const { config, token } = collect()
  $('connect').disabled = true
  status('connecting…')
  try {
    await window.reins.token(tokenOf(token))
    const result = await window.reins.connect(config)
    $('token').value = ''
    if (!result.ok) {
      status(result.error ?? 'could not connect', 'bad')
      return
    }
    status(result.authorized ? 'connected' : `a launch link with a token is needed: ${result.reason ?? ''}`, result.authorized ? 'good' : 'bad')
  } finally {
    $('connect').disabled = false
    const fresh = await window.reins.state()
    current = fresh.config
    logLines(fresh.log)
  }
}

$('token').addEventListener('input', adoptLink)
// an address has no meaning for a local Harness: typing one is a statement about the mode too
$('url').addEventListener('input', () => {
  if ($('url').value.trim() && $('mode').value === 'local') {
    $('mode').value = 'remote'
    syncBoxes()
  }
})
$('mode').addEventListener('change', syncBoxes)
$('proxyMode').addEventListener('change', syncBoxes)
$('save').addEventListener('click', saveOnly)
$('connect').addEventListener('click', connect)

window.addEventListener('DOMContentLoaded', async () => {
  const state = await window.reins.state()
  current = state.config
  fill(state.config)
  logLines(state.log)
  if (state.authorized) status(`already authorized: ${state.base}`, 'good')
  else status(state.reason ?? 'not connected', state.base ? 'bad' : '')
})

window.reins.onMessage((text) => {
  if (text) status(text, 'bad')
})
