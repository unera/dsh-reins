/**
 * The main process: one window to a Harness, and the settings that decide which one.
 *
 * The lifecycle in one paragraph. On start Reins reads its settings; when they name a Harness
 * it connects and shows the tabs window, and when they do not it shows settings. A local
 * Harness is started as a child and stopped on exit (or left running, if the person asked for
 * "detach"); a remote one is only joined. Whichever it is, the browser session carries the
 * credential, and an ordinary `/api` request tells us whether it is still good — that is the
 * check behind "записан ли урл и авторизован ли он".
 */
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, session, shell, WebContentsView } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { load, save, hasConnection } from './config.js'
import { isRunning, startHarness, stopHarness } from './host.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const PARTITION = 'persist:reins'

/** @type {{child: import('node:child_process').ChildProcess|null, base: string, token: string, lines: string[]}} */
/**
 * `base` is the Harness origin — no path, no query: every request and every tab is built on it.
 * `start` is the address the first tab opens, which may carry the launch token once.
 */
const state = { child: null, base: '', start: '', token: '', lines: [] }

/**
 * Tabs are native views, not elements of a page.
 *
 * The `<webview>` tag was the first attempt and it failed in a way worth recording: the element
 * was laid out full size, but the guest inside kept its default 150-pixel viewport, so every
 * Harness page drew itself into a strip at the top of the window. `WebContentsView` is sized by
 * the main process, which is the same approach the upstream desktop app uses.
 */
const tabs = []
let activeTab = null

/** The height of our own tab strip; everything under it belongs to the Harness page. */
const STRIP_HEIGHT = 44

let settingsWindow = null
let shellWindow = null

/** The one browser session every tab shares: one Harness, one credential. */
function reinsSession () {
  return session.fromPartition(PARTITION)
}

/** A line for the window's own log: what the child says and what we did. */
function note (line) {
  state.lines.push(`${new Date().toLocaleTimeString('ru-RU')} ${line}`)
  if (state.lines.length > 200) state.lines.shift()
}

/**
 * Apply the proxy choice to the shared session.
 *
 * It must happen before the first request, which is why it runs at startup and again after a
 * settings change — a proxy applied later would leave the loaded page on the old route.
 */
async function applyProxy (config = load()) {
  const ses = reinsSession()
  const proxy = config.proxy ?? {}
  if (proxy.mode === 'direct') {
    await ses.setProxy({ mode: 'direct' })
  } else if (proxy.mode === 'manual' && proxy.rules) {
    await ses.setProxy({
      mode: 'fixed_servers',
      proxyRules: proxy.rules,
      proxyBypassRules: proxy.bypass || '<-loopback>'
    })
  } else {
    await ses.setProxy({ mode: 'system' })
  }
  note(`прокси: ${proxy.mode === 'manual' ? proxy.rules : proxy.mode}`)
}

/** The theme of our own windows; the Harness page has its own switch. */
function applyTheme (config = load()) {
  nativeTheme.themeSource = config.theme === 'dark' || config.theme === 'light' ? config.theme : 'system'
}

/**
 * The address to open for the current connection.
 *
 * A local Harness answers with its own ready line, and that line carries the launch token. A
 * remote one is the address from the settings; a token pasted for this attempt is turned into
 * `?token=…` — the only place the server accepts it, and the exchange turns it into a cookie.
 */
async function openConnection () {
  const config = load()
  const connection = config.connection
  if (connection.mode === 'local') {
    if (isRunning(state.child)) {
      state.base = state.base || ''
      return { ok: Boolean(state.base), url: state.base, error: state.base ? null : 'локальный харнесс уже запускается' }
    }
    note(`запускаю локальный харнесс: профиль ${connection.profile}, порт ${connection.port || 'свободный'}`)
    try {
      const started = await startHarness({
        profile: connection.profile,
        port: Number(connection.port) || 0,
        home: connection.home || '',
        onLine: note
      })
      state.child = started.child
      // the ready line carries the token as a query and may carry a path when behind a prefix:
      // only its origin is the Harness address, the rest belongs to this one opening
      const ready = new URL(started.url)
      state.base = ready.origin
      state.start = started.url
      note(`харнесс готов: ${state.base}`)
      return { ok: true, url: state.start, error: null }
    } catch (error) {
      note(`локальный харнесс не поднялся: ${error.message}`)
      return { ok: false, url: '', error: explainLocalFailure(error.message, connection.profile) }
    }
  }
  if (!connection.url) return { ok: false, url: '', error: 'адрес сервера не задан' }
  try {
    state.base = new URL(connection.url).origin
  } catch {
    return { ok: false, url: '', error: `адрес «${connection.url}» не разбирается как URL` }
  }
  const token = state.token
  // the token is spent by this one opening: keeping it would send a dead credential again
  state.token = ''
  state.start = token ? `${state.base}/?token=${encodeURIComponent(token)}` : state.base
  return { ok: true, url: state.start, error: null }
}

/**
 * Is the session authorized on this Harness?
 *
 * The root page answers 401 without a valid cookie and the application with one — that is the
 * cheapest question that separates "authorized" from "not", and it needs no API method.
 *
 * `session.fetch` and not `net.fetch`: the latter ignores the session's cookie jar even when it
 * is handed the session, so every check came back 401 over a page that was open and working.
 * A network failure is "unknown", not "authorized": a wrong answer here would open an empty
 * window instead of the settings.
 */
async function authStatus () {
  const base = state.base
  if (!base) return { authorized: false, reason: 'нет подключения' }
  try {
    const answer = await reinsSession().fetch(`${base}/`)
    if (answer.status === 401 || answer.status === 403) return { authorized: false, reason: 'нужна ссылка с токеном' }
    if (!answer.ok) return { authorized: false, reason: `сервер ответил ${answer.status}` }
    return { authorized: true, reason: '' }
  } catch (error) {
    return { authorized: false, reason: `сервер не отвечает: ${error.message}` }
  }
}

/**
 * Wait until the session is authorized.
 *
 * The launch token is exchanged for a cookie by the page load itself: the server sees
 * `GET /?token=…`, answers with a cookie and a redirect. A single check right after opening the
 * window therefore races that exchange and loses half the time — the settings window used to pop
 * up over a Harness that had just been authorized successfully.
 */
async function waitAuthorized (timeoutMs = 15_000) {
  const started = Date.now()
  let last = { authorized: false, reason: 'нет подключения' }
  for (;;) {
    last = await authStatus()
    if (last.authorized) return last
    if (Date.now() - started >= timeoutMs) return last
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

/**
 * A failed local start, said in words that lead somewhere.
 *
 * The CLI's own answer — `profile "reins" does not exist; create it with 'dsh plugin --profile
 * reins add <package>'` — is true and useless: a person who wanted a window to a remote server is
 * not going to run that. The message names both ways out instead.
 */
function explainLocalFailure (message, profile) {
  const missing = /profile "([^"]+)" does not exist/.exec(message ?? '')
  if (missing) {
    const name = missing[1]
    return `Профиль «${name}» ещё не создан в этом DSH. Либо укажите в настройках существующий профиль ` +
      `(например web), либо создайте этот командой: dsh plugin --profile ${name} add @deepseek-ai/dsh-base @deepseek-ai/dsh-web-app. ` +
      'Если харнесс на другом сервере — переключите «Где живёт» на «На сервере» и вставьте ссылку с токеном.'
  }
  return message ?? 'локальный харнесс не поднялся'
}

/** A small frameless page around our own markup. */
function createWindow (file, options = {}) {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141414' : '#f5f5f5',
    show: false,
    title: 'Reins',
    ...options,
    webPreferences: {
      preload: join(here, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      ...(options.webPreferences ?? {})
    }
  })
  window.once('ready-to-show', () => window.show())
  window.loadFile(join(here, '..', 'renderer', file))
  return window
}

function showSettings (message = '') {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createWindow('settings.html', { width: 860, height: 760 })
    settingsWindow.on('closed', () => { settingsWindow = null })
  }
  settingsWindow.webContents.once('did-finish-load', () => {
    settingsWindow?.webContents.send('reins:message', message)
  })
  settingsWindow.show()
  settingsWindow.focus()
  return settingsWindow
}

function showShell (url) {
  if (!shellWindow || shellWindow.isDestroyed()) {
    shellWindow = createWindow('shell.html')
    shellWindow.on('closed', () => { shellWindow = null })
  }
  shellWindow.on('resize', () => layoutTabs())
  shellWindow.webContents.once('did-finish-load', () => {
    shellWindow?.webContents.send('reins:base', { base: state.base, tabs: config().tabs })
    createTab(url)
  })
  shellWindow.show()
  return shellWindow
}

/**
 * Every Harness page lives in a tab; anything else belongs to the system browser.
 *
 * `window.open` and `target=_blank` arrive here. A link to the same Harness opens another tab —
 * one page per tab is what "tabs hold different sessions" means — while a link anywhere else
 * leaves for the browser the person already uses, with its own credentials and history.
 */
function routeNewWindow (contents, details) {
  let target = null
  try {
    target = new URL(details.url)
  } catch {
    return { action: 'deny' }
  }
  const base = state.base ? new URL(state.base) : null
  if (base && target.origin === base.origin) {
    createTab(target.toString())
    return { action: 'deny' }
  }
  if (target.protocol === 'http:' || target.protocol === 'https:') void shell.openExternal(target.toString())
  return { action: 'deny' }
}

/**
 * Put the active tab where the page area is and keep the rest out of sight.
 *
 * The shell page is the tab strip; the area under it belongs to one native view at a time. A
 * hidden tab is given an empty rectangle rather than destroyed: its page keeps its session, its
 * draft and its scroll position, which is the whole point of tabs.
 */
function layoutTabs () {
  if (!shellWindow || shellWindow.isDestroyed()) return
  const { width, height } = shellWindow.getContentBounds()
  // with tabs turned off there is no strip at all: the page gets the whole window, not a window
  // with an empty band at the top
  const strip = load().tabs === false ? 0 : STRIP_HEIGHT
  for (const tab of tabs) {
    const visible = tab === activeTab
    tab.view.setBounds({
      x: 0,
      y: visible ? strip : 0,
      width: visible ? Math.max(0, width) : 0,
      height: visible ? Math.max(0, height - strip) : 0
    })
  }
}

/** A new tab with a Harness page in it. */
function createTab (url) {
  if (!shellWindow || shellWindow.isDestroyed()) return null
  const view = new WebContentsView({
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false }
  })
  view.webContents.loadURL(url)
  shellWindow.contentView.addChildView(view)
  const tab = { id: `tab-${Date.now()}-${tabs.length}`, view, url }
  tabs.push(tab)
  activeTab = tab
  layoutTabs()
  publishTabs()
  return tab
}

function closeTab (id) {
  const index = tabs.findIndex((tab) => tab.id === id)
  if (index < 0) return
  const [tab] = tabs.splice(index, 1)
  try {
    shellWindow?.contentView.removeChildView(tab.view)
  } catch {}
  tab.view.webContents.close()
  if (activeTab === tab) activeTab = tabs[Math.max(0, index - 1)] ?? null
  layoutTabs()
  publishTabs()
  if (!tabs.length) showSettings()
}

function activateTab (id) {
  const tab = tabs.find((item) => item.id === id)
  if (!tab) return
  activeTab = tab
  layoutTabs()
  publishTabs()
}

/** Tell the strip what exists; the strip draws, the main process owns. */
function publishTabs (status = '') {
  shellWindow?.webContents.send('reins:tabs', {
    // the Harness names every page "DeepSeek Harness", so an unnamed tab is numbered: five
    // identical labels would be no navigation at all
    tabs: tabs.map((tab, index) => ({ id: tab.id, title: tab.title || `Harness ${index + 1}` })),
    active: activeTab?.id ?? null,
    status
  })
}

function config () {
  return load()
}

/**
 * The keys that replace the missing menu, bound to every page we own.
 *
 * F12 belongs to settings, not to DevTools: with the strip hidden there is no other way back into
 * the settings screen, and a key that opens a developer panel a person does not want would be the
 * only way in. DevTools stay available on Ctrl+Shift+I for whoever needs them.
 */
function bindKeys (contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12') {
      event.preventDefault()
      showSettings()
      return
    }
    if (input.control && input.shift && String(input.key).toLowerCase() === 'i') {
      event.preventDefault()
      contents.toggleDevTools()
    }
  })
}

function wireIpc () {
  ipcMain.handle('reins:state', async () => {
    const config = load()
    const auth = state.base ? await authStatus() : { authorized: false, reason: 'нет подключения' }
    return {
      config,
      base: state.base,
      running: isRunning(state.child),
      ...auth,
      log: state.lines.slice(-60),
      version: app.getVersion()
    }
  })

  ipcMain.handle('reins:save', async (_event, patch) => {
    const config = save(patch ?? {})
    applyTheme(config)
    await applyProxy(config)
    // the tabs switch is a layout change, not a restart: the strip appears or the page takes the
    // whole window right now
    if (shellWindow && !shellWindow.isDestroyed()) {
      shellWindow.webContents.send('reins:base', { base: state.base, tabs: config.tabs })
      layoutTabs()
    }
    return config
  })

  ipcMain.handle('reins:connect', async (_event, patch) => {
    const config = save(patch ?? {})
    applyTheme(config)
    await applyProxy(config)
    const opened = await openConnection()
    if (!opened.ok) {
      showSettings(opened.error ?? 'не удалось подключиться')
      return { ok: false, error: opened.error, url: '' }
    }
    showShell(opened.url)
    const auth = await waitAuthorized()
    if (!auth.authorized) showSettings(auth.reason)
    return { ok: true, url: opened.url, authorized: auth.authorized, reason: auth.reason }
  })

  ipcMain.handle('reins:token', async (_event, token) => {
    state.token = String(token ?? '').trim()
    return true
  })

  ipcMain.handle('reins:disconnect', async () => {
    await detach()
    return true
  })

  ipcMain.handle('reins:settings', async () => {
    showSettings()
    return true
  })

  ipcMain.handle('reins:auth', async () => authStatus())

  // the strip asks for what it cannot do itself: tabs are native views
  ipcMain.handle('reins:tab-new', async () => {
    if (!state.base) return null
    const tab = createTab(state.base)
    return tab?.id ?? null
  })
  ipcMain.handle('reins:tab-close', async (_event, id) => {
    closeTab(String(id))
    return true
  })
  ipcMain.handle('reins:tab-activate', async (_event, id) => {
    activateTab(String(id))
    return true
  })
}

/**
 * Leave the Harness alone.
 *
 * "Detach" is the whole point of the word: the window closes, the process keeps running, and the
 * next start joins it by its address and cookie. "Stop" ends a child we started ourselves.
 */
async function detach () {
  const config = load()
  if (config.connection.onExit !== 'stop') {
    note('отсоединяюсь, процесс оставляю')
    state.child = null
    return
  }
  if (isRunning(state.child)) {
    note('останавливаю локальный харнесс')
    await stopHarness(state.child)
  }
  state.child = null
}

app.on('web-contents-created', (_event, contents) => {
  bindKeys(contents)
  contents.setWindowOpenHandler((details) => routeNewWindow(contents, details))
  contents.on('page-title-updated', (_event, title) => {
    const tab = tabs.find((item) => item.view.webContents === contents)
    if (!tab) return
    tab.title = String(title ?? '').replace(/^DeepSeek Harness\s*[—:-]?\s*/i, '') || 'Harness'
    publishTabs()
  })
})

app.whenReady().then(async () => {
  app.setName('Reins')
  // the default Electron menu lists items that do nothing in this application — an Edit menu
  // over a page we do not own, a View menu nobody wired. A menu that is not working is worse than
  // no menu, and the few commands a person needs are on keys: F12 for settings.
  Menu.setApplicationMenu(null)
  const config = load()
  applyTheme(config)
  await applyProxy(config)
  wireIpc()

  if (!hasConnection(config)) {
    showSettings('укажите харнесс: локальный профиль или адрес сервера')
    return
  }
  const opened = await openConnection()
  if (!opened.ok) {
    showSettings(opened.error ?? 'не удалось подключиться')
    return
  }
  showShell(opened.url)
  // the exchange happens in the page: the check waits for it instead of guessing
  const auth = await waitAuthorized()
  if (!auth.authorized) showSettings(auth.reason)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async (event) => {
  if (!isRunning(state.child)) return
  event.preventDefault()
  await detach()
  app.exit(0)
})
