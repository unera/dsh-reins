/**
 * A Harness running on this machine, started and stopped by Reins.
 *
 * The CLI prints one line when it is ready — `dsh web: https://127.0.0.1:PORT/?token=…` — and
 * that line is the contract: it is both "the server is up" and "here is the credential". The
 * upstream desktop app is built on the same signal, which is why parsing it is the whole job.
 *
 * A stop is a SIGTERM and a window of grace: a Harness writes its store, and killing it outright
 * would be the difference between "closed" and "crashed".
 */
import { spawn } from 'node:child_process'

const READY = /^dsh web: (\S+)$/
const READY_TIMEOUT_MS = 120_000
const STOP_GRACE_MS = 8_000

/**
 * Start a Harness and wait until it says it is ready.
 *
 * @param {object} options
 * @param {string} options.profile profile under the Harness home, e.g. `reins`
 * @param {number} options.port 0 lets the OS pick a free one
 * @param {string} [options.home] an explicit DSH_HOME; empty means the shared one
 * @param {string} [options.binary] the `dsh` executable; PATH by default
 * @param {(line: string) => void} [options.onLine] every line the child prints, for the log
 * @returns {Promise<{url: string, child: import('node:child_process').ChildProcess}>}
 */
export function startHarness ({ profile, port = 0, home = '', binary = '', onLine = () => {} }) {
  const command = binary || process.env.DSH_BIN || 'dsh'
  const args = ['--profile', profile || 'reins', '--port', String(port || 0), '--no-open']
  const env = { ...process.env }
  if (home) env.DSH_HOME = home
  else delete env.DSH_HOME

  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      reject(new Error(`не удалось запустить ${command}: ${error.message}`))
      return
    }
    const tail = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      stopHarness(child)
      reject(new Error(`харнесс не сказал «готов» за ${READY_TIMEOUT_MS / 1000} с. ${reason || tail.slice(-5).join(' | ') || '—'}`))
    }, READY_TIMEOUT_MS)

    // The reason a Harness refused to start is one line near the top of its stack trace, and
    // "the last five lines" would be the trace itself: the first `…Error:` line is kept apart.
    let reason = ""
    const read = (chunk, toStderr) => {
      for (const raw of String(chunk).split('\n')) {
        const line = raw.trimEnd()
        if (!line) continue
        onLine(line)
        if (!reason && /(^|\s)\w*Error: /.test(line)) reason = line
        tail.push(line)
        if (tail.length > 40) tail.shift()
        const ready = READY.exec(line)
        if (ready && !settled) {
          settled = true
          clearTimeout(timer)
          resolve({ url: ready[1], child })
        }
      }
      void toStderr
    }
    child.stdout.on('data', (chunk) => read(chunk, false))
    child.stderr.on('data', (chunk) => read(chunk, true))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`${command}: ${error.message}`))
    })
    child.on('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`харнесс завершился до готовности (${code ?? signal}). ${reason || tail.slice(-5).join(' | ') || '—'}`))
    })
  })
}

/**
 * Stop a Harness politely and wait for it.
 *
 * A process that ignores the signal is killed — an orphan on port 0 would be invisible but
 * alive, and a second window would start a second one.
 */
export function stopHarness (child, graceMs = STOP_GRACE_MS) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(kill)
      resolve()
    }
    child.once('exit', done)
    try {
      child.kill('SIGTERM')
    } catch {
      done()
      return
    }
    const kill = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // already gone: the exit listener is what decides
      }
    }, graceMs)
  })
}

/** Is this child still running? */
export function isRunning (child) {
  return Boolean(child) && child.exitCode === null && child.signalCode === null
}
