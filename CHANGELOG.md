# Changelog

## [0.1.4] - 2026-11-22
### Fixed
- **The installers carried a second Electron.** With Electron in `optionalDependencies` the
  packager saw a dependency and bundled `node_modules/electron` inside the app: the Windows setup
  went from 91 to 191 MB, the macOS dmg from 104 to 220. The packaged app gets its runtime from
  electron-builder, so that directory is excluded from the app files; the `bin` shim, which only
  matters to an npm install, stays.

## [0.1.3] - 2026-11-22
### Added
- **`npm i -g github:unera/dsh-reins` gives a working `reins` command.** The package now carries
  a `bin` shim that finds the Electron binary and hands it the application; Electron itself is an
  optional dependency, because a git install brings no `devDependencies` and the installer needs
  the binary. `optional` rather than `dependencies` on purpose: electron-builder refuses a package
  that keeps Electron among its ordinary dependencies, and a skipped build must not fail the
  install.

## [0.1.2] - 2026-11-22
### Fixed
- **The build configuration was never read.** `electron-builder.config.mjs` is not one of the
  file names electron-builder picks up by itself, so every platform built its defaults — the
  Linux job even tried to produce a snap and failed on the missing snapcraft. The scripts now pass
  `--config` explicitly, and the release is published rather than left as a draft.

## [0.1.1] - 2026-11-22
### Fixed
- **CI could not publish.** The release job answered `403 Resource not accessible by
  integration`: a tag-triggered run gets a read-only token unless the workflow asks for
  `contents: write`. The permission is now explicit, and each platform names its publisher
  (`github`) instead of leaving electron-builder to guess.

## [0.1.0] - 2026-11-22
### Added
- **A window to any Harness.** Remote by address and launch link (exchange for the browser cookie),
  local by starting `dsh --profile <p> --port 0 --no-open` and reading its ready line.
- **Start/stop or attach/detach.** A local Harness is stopped on exit or left running, as the
  setting says; a remote one is only joined and left alone.
- **Tabs** over one shared browser session, with links outside the Harness handed to the system
  browser.
- **Settings**: theme, tabs on/off, proxy (system, direct, manual rules), profile, port, DSH_HOME.
- **Packaging**: electron-builder targets for Linux (AppImage), Windows (NSIS) and macOS (dmg, zip),
  driven by a tag-triggered CI matrix.
