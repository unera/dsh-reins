# Changelog

## [0.2.0] - 2026-11-25
### Changed
- **Published to npm as `@dr-co/dsh-reins`.** The bare name `dsh-reins` on the registry belongs to
  an unrelated package, so this one installs as `npm i -g @dr-co/dsh-reins`. The command it puts on
  the PATH is still `reins`, and the GitHub repository keeps its name.
- **The interface is English.** Settings, status messages, log lines and the error the CLI gives
  when Electron is missing are English now, as the package description and the README already were.
### Added
- **A `LICENSE` file and an explicit `files` list.** The published tarball carries the application,
  the CLI shim, the README and this changelog, and nothing else.
## [0.1.6] - 2026-11-22
### Changed
- **Tabs off means no strip at all.** The band stayed reserved with the tab strip hidden inside it:
  a window spending 44 pixels on nothing, with the settings button gone with the strip. With tabs
  off the page now takes the whole window, and the switch applies at once — no restart.
- **Settings moved to F12.** With no strip there is no gear to press, and a key that is always
  there beats a button that disappears. DevTools stay on Ctrl+Shift+I for whoever needs them.
- **The application menu is gone.** The default Electron menu offered Edit and View commands that
  this application never wired to anything — a non-working menu is worse than none.

## [0.1.5] - 2026-11-22
### Fixed
- **A pasted launch link now fills the whole form.** `https://host/?token=…` is one string on the
  clipboard and two fields on the page, and Reins used to ask for the server separately: the link
  filled nothing but the token, so a person who pasted it had to type the address again. The link
  now sets the address, switches "Where it lives" to "On a server", and overrides a stale address —
  which used to send a fresh token to the wrong host, quietly.
- **A missing local profile is explained in words that lead somewhere.** The CLI's own answer
  (`profile "reins" does not exist; create it with 'dsh plugin …'`) is true and useless: the
  message now names both ways out — an existing profile such as `web`, or the command that creates
  this one — and points at "On a server" for anyone who meant a remote Harness all along.
- The mode follows the fields: typing an address, like pasting a link, switches to "On a server".

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
