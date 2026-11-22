/**
 * The tab strip.
 *
 * The tabs themselves are native views owned by the main process — a `<webview>` tag in this page
 * could not be sized (the guest kept its default viewport), so this page draws only what a page
 * is good at: the strip, its buttons and its state. Every action here is a request to the main
 * process, and the answer is a new list to draw.
 */
const $ = (id) => document.getElementById(id)

let state = { tabs: [], active: null }

function draw () {
  const strip = $('strip')
  strip.classList.toggle('hidden', window.__tabsEnabled === false)
  const box = $('tabs')
  box.textContent = ''
  for (const tab of state.tabs) {
    const button = document.createElement('div')
    button.className = tab.id === state.active ? 'tab active' : 'tab'
    const label = document.createElement('span')
    label.textContent = tab.title
    const close = document.createElement('span')
    close.className = 'x'
    close.textContent = '×'
    button.append(label, close)
    button.addEventListener('click', (event) => {
      if (event.target === close) return
      void window.reins.activateTab(tab.id)
    })
    close.addEventListener('click', () => void window.reins.closeTab(tab.id))
    box.appendChild(button)
  }
}

window.reins.onTabs((payload) => {
  state = payload
  draw()
})

window.reins.onBase(({ tabs }) => {
  window.__tabsEnabled = tabs !== false
  draw()
})

$('add').addEventListener('click', () => void window.reins.newTab())
$('gear').addEventListener('click', () => void window.reins.openSettings())

draw()
