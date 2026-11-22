/**
 * The bridge between the two windows and the main process.
 *
 * CommonJS on purpose: a preload script runs before the page and is not part of the ESM main
 * process, so `import` here is a syntax error and the bridge would simply never appear. That is
 * exactly how the first run of this app showed a settings page with no values in it.
 *
 * Nothing else crosses: the pages get a handful of verbs and no Node, no filesystem, no `require`.
 * The token passes one way only (into the main process) and is never handed back to a page.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('reins', {
  /** Everything the windows draw: settings, connection, whether the session is authorized. */
  state: () => ipcRenderer.invoke('reins:state'),
  /** Write settings; the main process applies theme and proxy before answering. */
  save: (patch) => ipcRenderer.invoke('reins:save', patch),
  /** Save and connect: start or join a Harness and show its window. */
  connect: (patch) => ipcRenderer.invoke('reins:connect', patch),
  /** A launch token for the next attempt: one process, one use. */
  token: (value) => ipcRenderer.invoke('reins:token', value),
  /** Leave the Harness — stop it or detach, as the settings say. */
  disconnect: () => ipcRenderer.invoke('reins:disconnect'),
  /** Bring the settings window up. */
  openSettings: () => ipcRenderer.invoke('reins:settings'),
  /** Ask again whether the session is authorized. */
  auth: () => ipcRenderer.invoke('reins:auth'),
  /** A message for the settings window that came from the main process. */
  onMessage: (listener) => ipcRenderer.on('reins:message', (_event, text) => listener(text)),
  /** The connection opened: the strip learns whether tabs are on. */
  onBase: (listener) => ipcRenderer.on('reins:base', (_event, payload) => listener(payload)),
  /** The list of tabs changed — draw it. */
  onTabs: (listener) => ipcRenderer.on('reins:tabs', (_event, payload) => listener(payload)),
  /** Ask for another tab. */
  newTab: () => ipcRenderer.invoke('reins:tab-new'),
  /** Close a tab by id. */
  closeTab: (id) => ipcRenderer.invoke('reins:tab-close', id),
  /** Bring a tab to the front. */
  activateTab: (id) => ipcRenderer.invoke('reins:tab-activate', id)
})
