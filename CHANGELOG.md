# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.5.1] - 2026-06-14

### Fixed

- Blocked tab now also lists beads whose status was explicitly set to `blocked`. Previously it ran only `bd blocked` (which returns *derived*-blocked beads — open beads with unclosed blockers), so explicitly-blocked beads were missing from the tab; the filter now merges `bd blocked` with `bd list --status blocked`.
- List rows for open beads that are derived-blocked now show the `blocked` status label and color, matching the detail view's effective-status logic.

## [0.5.0] - 2026-06-13

### Added

- `h` key: dedicated parent-picker to reparent a bead under a different epic or detach it as standalone (epics listed newest-updated-first; current parent excluded).
- `chore` and `bug` added to the `t` type-filter cycle (`all → epic → task → chore → bug → all`).
- `x` key in the epic-filter picker clears the filter immediately (same as selecting ✗ Clear).

### Changed

- All tabs now sort beads by `updated_at` DESC (most-recently-touched first), preserving the epic→children tree grouping for tree tabs and ordering children within each epic the same way.
- `r` (reload) now also clears any active epic filter before reloading; status bar shows "Epic filter cleared" when it does.

### Removed

- `D` dependency menu — replaced by the focused `h` reparent picker.

## [0.4.0] - 2026-06-07

### Added

- Lazy pagination for the `all` and `closed` tabs: every bead loads in a single `bd` call (flat, no per-bead dependency fetch) and rows are revealed in batches as you scroll to the bottom, with a "showing X of Y" count. This lifts the previous silent 50-row cap so the full history is reachable. `G` jumps to the true bottom; `/` searches the whole list.

### Changed

- Epic filter picker now lists the most recently created epics first.

### Fixed

- `stdout maxBuffer length exceeded` error when a `bd list` payload exceeded 1 MB (e.g. the `all` tab on a large repo) — the output buffer is now 64 MB.
- Epic filter picker could miss epics beyond the first 50 results; it now enumerates all epics.

## [0.3.2] - 2026-05-24

### Changed

- Detail-pane dependency rows redesigned: status-colored icons (○ open, ◐ in_progress, ● blocked, ✓ closed, ❄ deferred) with the whole row tinted by effective status. Open beads whose blockers aren't all closed now render as blocked, mirroring how `bd blocked` derives the Blocked tab.

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
