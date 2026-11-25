# Reins

A window to a DeepSeek Harness — local or remote — with tabs, its own theme and a proxy.

## What it does

- **Joins any Harness.** A remote one by its address and a launch link (`https://host/?token=…`):
  the link is exchanged for the browser cookie the Harness issues, and that cookie is what keeps
  the window authorized. A local one is started by Reins itself:
  `dsh --profile <profile> --port 0 --no-open`, and the ready line it prints — `dsh web: <url>` —
  is both "it is up" and "here is this process's credential".
- **Owns what it started.** On exit Reins stops the Harness it launched, or leaves it running
  (`detach`), depending on the setting. A remote Harness is never touched.
- **Tabs hold different sessions.** Each tab is its own page in one shared browser session: one
  credential, separate sessions and drafts. Links that leave the Harness go to the system browser.
- **Its own theme and proxy.** Light/dark/system for the app's windows; proxy either from the
  system, direct, or by rules.

## Install

```sh
npm i -g @dr-co/dsh-reins
reins
```

The package brings Electron itself, so this is a way to get the application, not a library. The
GitHub releases carry the AppImage, the Windows installer and the macOS dmg/zip for anyone who
prefers a file.

## Settings

Settings live in Electron's `userData` as `settings.json` — these are the window's preferences,
not the Harness's. The local profile defaults to `reins` (its own, clean Harness home profile); set
it to `web` to start the profile the CLI already uses.

## Develop

```sh
npm install
npm start
```

Building installers is CI's job (`.github/workflows/release.yml`): a `v*` tag builds the Linux
AppImage, the Windows installer and the macOS dmg/zip and attaches them to the GitHub release.
Locally `npm run dist:linux` works, and the other two need their own platform.

## Why not the browser

The Harness serves a browser UI, but a window that knows which Harness it belongs to, keeps one
credential across tabs, and can start and stop a local Harness is a different thing from a tab in
someone's browser.
