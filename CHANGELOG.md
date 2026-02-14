# Changelog

## [1.1.0-alpha.3] - 2026-02-14

### Fixed
- CI build commands now disable auto-publish in `electron-builder` (`--publish never`), so GitHub Actions can build installers and upload assets via release step without `GH_TOKEN` build failure.

## [1.1.0-alpha.2] - 2026-02-14

### Fixed
- Release CI now installs dev dependencies explicitly (`npm ci --include=dev`) for Windows/macOS build jobs.

## [1.1.0-alpha.1] - 2026-02-14

### Added
- New desktop tray mode:
  - runs in background
  - tray icon in status bar
  - right-click menu with:
    - launch at startup
    - language (FR/EN)
    - restart relay
    - restart application
- New basic installer/configuration window in app.
- Persistent local settings (port, language, startup mode, repository, local path).

### Changed
- Relay HTTP server was modularized (`src/relay-server.js`) and reused by:
  - CLI mode (`src/server.js`)
  - Desktop tray app (`src/main.js`)
- Release workflow now builds installer packages:
  - Windows (`.exe`)
  - macOS (`.dmg` / `.zip`)
  - source archive

## [1.0.1] - 2026-02-14

### Added
- GitHub Release workflow now builds and publishes desktop executables as release assets:
  - Windows (`statnerd-relay-win.exe`)
  - macOS Intel (`statnerd-relay-macos-x64`)
  - macOS Apple Silicon (`statnerd-relay-macos-arm64`)
- Source archive attached to each release.

## [1.0.0] - 2026-02-14

### Added
- Initial desktop relay app for StatNerd one-click updates.
- Local HTTP API (`/health`, `/v1/update`) to execute local update scripts.
- Packaged targets for Windows and macOS.
