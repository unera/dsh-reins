#!/usr/bin/env node
/**
 * The `reins` command: an npm install is a way to get the application, not a library.
 *
 * The package ships Electron itself, so this script finds that binary and hands it the app
 * directory — the same thing `npm start` does in a checkout. Everything else (arguments,
 * environment, exit code) passes through untouched, so `reins --remote-debugging-port=9222`
 * works exactly like it does on a development start.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')

let electron
try {
  electron = require('electron')
} catch (error) {
  console.error('reins: no Electron next to the package — reinstall it: npm i -g @dr-co/dsh-reins')
  console.error(String(error?.message ?? error))
  process.exit(1)
}
if (typeof electron !== 'string') {
  console.error('reins: Electron is installed without its binary (the build was skipped) — reinstall without --ignore-scripts')
  process.exit(1)
}

const child = spawn(electron, [appRoot, ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
