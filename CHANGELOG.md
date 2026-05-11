# Changelog

All notable changes to this project will be documented in this file.

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
