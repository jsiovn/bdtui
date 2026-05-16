# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2026-05-16

### Added

- Auto-start Dolt on launch: `bdtui` runs `bd dolt test` and falls back to `bd dolt start` if the project's Dolt server is down, so the TUI no longer opens against a dead backend. Skipped for `-v`/`--version`.

## [0.3.0] - 2026-05-15

### Added

- `e` shortcut: filter the list by epic via a modal picker; selecting an epic scopes the view to that epic and its children, with an option to clear the filter

## [0.2.3] - 2026-05-13

### Added

- `bdtui -v` / `bdtui --version` prints the current version and exits

## [0.2.2] - 2026-05-11

### Added

- `repository`, `homepage`, and `bugs` fields in package.json — GitHub link now visible on npmjs.com

## [0.2.1] - 2026-05-11

### Fixed

- Screenshot not rendering on npmjs.com — switched to absolute GitHub raw URL

## [0.2.0] - 2026-05-11

### Fixed

- Clipboard action stuck at "Copying" after the first use — now resolves on stdin flush instead of waiting for daemon processes (`wl-copy`, `xclip`) to exit

### Changed

- `blocked` tab now uses `bd blocked` (dependency-blocked issues) instead of `bd list --status blocked`
- Workflow skill picker renamed to "Copy workflow command" and positioned on the left side of the screen
- Detail pane field rows use a `│` column separator with consistent alignment across all rows

### Added

- Screenshot in README

## [0.1.0] - 2026-04-28

### Added

- Initial MVP: blessed two-pane TUI (list + detail) for `bd`
- Tree view grouping tasks under their parent epic
- Status and type filter tabs with keyboard cycling
- Rich color scheme for status, priority, and dependency lines
- Inline markdown rendering in description, acceptance, and notes fields
- Mutation keys: change status, close, claim, reopen, change priority, manage deps
- `y` to yank bead ID to clipboard, `w` to copy a workflow skill command
- In-memory title filter (`/`)
- Help overlay (`?`)
