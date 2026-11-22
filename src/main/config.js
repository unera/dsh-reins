/**
 * The settings Reins keeps on this machine.
 *
 * One JSON file under Electron's own userData: not the Harness home, because these are the
 * preferences of the window (how to reach a Harness, how to draw), not of the Harness itself.
 * The token is deliberately absent: a launch token lives one process, so it is used once and
 * dropped. What survives is the address and whatever cookie the exchange left in the browser
 * session.
 */
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Defaults: a local Harness in the shared home, its own profile, stopped on exit. */
export const DEFAULTS = {
  connection: {
    // 'local' starts a Harness here, 'remote' joins one already running somewhere
    mode: 'local',
    // the address of a remote Harness, for example https://dsh.uvw.ru
    url: '',
    // a local Harness keeps its profile next to the CLI's own, in the shared home
    profile: 'reins',
    // 0 is the OS choosing a free port: no collisions with anything already listening
    port: 0,
    // an explicit DSH_HOME, empty means $DSH_HOME or ~/.dsh
    home: '',
    // 'stop' ends the Harness with the window, 'detach' leaves it running
    onExit: 'stop'
  },
  theme: 'system',
  tabs: true,
  proxy: {
    // 'system' follows the OS, 'direct' goes straight out, 'manual' uses the rules
    mode: 'system',
    rules: '',
    bypass: 'localhost,127.0.0.1,::1'
  }
}

let cached = null

export function configPath () {
  return join(app.getPath('userData'), 'settings.json')
}

/** Read the settings, filling anything missing with the defaults. */
export function load () {
  if (cached) return cached
  let saved = {}
  try {
    saved = JSON.parse(readFileSync(configPath(), 'utf8'))
  } catch {
    // no file yet, or it is unreadable: the defaults are a working answer
    saved = {}
  }
  cached = {
    ...DEFAULTS,
    ...saved,
    connection: { ...DEFAULTS.connection, ...(saved.connection ?? {}) },
    proxy: { ...DEFAULTS.proxy, ...(saved.proxy ?? {}) }
  }
  return cached
}

/** Write the settings back, whole: a partial file would read as a change of everything else. */
export function save (next) {
  const merged = {
    ...load(),
    ...next,
    connection: { ...load().connection, ...(next.connection ?? {}) },
    proxy: { ...load().proxy, ...(next.proxy ?? {}) }
  }
  cached = merged
  writeFileSync(configPath(), JSON.stringify(merged, null, 2))
  return merged
}

/** Is there anything to connect to? A local Harness needs no address, only a profile. */
export function hasConnection (config = load()) {
  return config.connection.mode === 'local' ? Boolean(config.connection.profile) : Boolean(config.connection.url)
}
