# Changelog

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
