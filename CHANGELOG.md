# Changelog

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
