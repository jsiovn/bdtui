# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.8.0] - 2026-07-02

### Added

- The detail pane now shows a **Close Reason** section for closed beads. When a bead is closed with `c`, `bd` stores the text in its `close_reason` field; that resolution (with the close date) was already fetched but never displayed. It now renders above the dependencies, so you can see why/how a bead was closed without leaving the TUI.
- `m` toggles mouse capture so you can **select and copy detail-pane text**. blessed grabs the terminal mouse process-wide the moment any pane enables it, which blocks the terminal's own click-drag selection. Pressing `m` releases the mouse (drag to select, then copy with your terminal's copy); pressing it again restores wheel scrolling and click-to-select. The status bar shows the current mode.
- A **Deferred** status tab, added to the left of **Blocked** in the tab bar. It lists every bead whose stored status is `deferred` (`bd list --status deferred`) — beads you've explicitly parked — so they're reachable without scrolling the **All** tab. Like the other status tabs it builds the epic→child tree (a deferred bead nests under its parent epic) and cycles with `Tab` / `Shift+Tab`. The deferred status glyph/color and the `s` status picker already supported `deferred`; this surfaces it as a first-class view.

## [0.7.2] - 2026-06-29

### Added

- `w` now works on epics. Previously the workflow-command picker was disabled for epics ("workflow skills apply to tasks only"); pressing `w` on an epic now opens a picker offering `/executor-epic-sequential` and `/executor-epic-sequential-worktree` (which run every ready child of the epic on a single branch / isolated worktree). Tasks, chores, and bugs keep their existing per-bead executors.

### Fixed

- `bd` errors now render as readable text in the status bar. When a `bd` command failed, bdtui threw the entire structured JSON error body (`{"error": "…", "schema_version": 1}`) verbatim — a multi-line blob whose leading `{` corrupted the one-line status bar markup (the "error with `{`" seen when a tab failed to load). bdtui now parses that body and surfaces just the human-readable `error` field, collapsing newlines and escaping tag markup so the status bar stays a clean single line.
- Tag-escaping no longer mangles text containing a literal `}`. The two-step escape (`replace('{')` then `replace('}')`) re-processed the `}` it had just inserted into `{open}`, turning any `}` in a bead description (e.g. JSON/code snippets) or in a `/` search query into a stray `{open}` token. Escaping is now a single pass in both the detail pane and the status bar.

### Changed

- npm package metadata: expanded `description` and added `keywords` for discoverability; normalized the repository URL to the `git+https://` form.
- Removed internal agent-workflow tooling (`.beads/`, `.claude/` agents and skills, `CLAUDE.md`, `BEADS_WORKFLOW.md`, `docs/TROUBLESHOOTING.md`) from the repository.

## [0.7.1] - 2026-06-21

### Fixed

- The **Keybindings** (`?`) help can now be dismissed after a mouse click moves focus to the Beads list or Detail pane. Its close keys were bound to the help box itself, so once a click stole focus the modal became unclosable (every global key is suppressed while a modal is open). `q`/`Esc`/`h` are now bound at the screen level and dismiss it regardless of which pane holds focus.
- Reopening the Keybindings help with `?` works again. `?` is now a single open/close toggle, fixing a re-entrancy where the freshly-registered `?` close handler fired on the very keypress that opened the modal and slammed it shut.
- The boot status bar no longer shows the `? help` hint twice. `setStatus` already appends it, so the redundant hint baked into the "Ready" message was removed.

## [0.7.0] - 2026-06-21

### Added

- `Shift+r`: reset all narrowing filters (title search, epic scope, type) and reload fresh.
- The status bar now summarizes every active narrowing filter together — e.g. `"login"  ·  epic: bd-12  ·  type: task — 3 results | Shift+r to reset` — instead of only the most recent one. The epic filter now shows the same result-count/reset hint that title search did.
- The tab bar gains a persistent `search:` indicator for the active title filter, alongside the existing `type:` and `epic:` indicators.

### Changed

- `r` (reload) now **keeps** active filters instead of clearing the epic filter; use `Shift+r` to clear filters. This reverses the `0.5.0` behavior where `r` cleared the epic filter.
- The `/` title filter is now persistent state: it survives a reload (`r`) and composes with the epic and type filters. The prompt pre-fills with the current search, and submitting an empty value clears just the title filter.

### Fixed

- `Shift+c` (claim) and `Shift+g` (jump to bottom) now actually fire. They were registered as bare uppercase `C`/`G`, but blessed reports a shifted letter as `S-<lower>`, so the handlers were dead — claim did nothing and `Shift+g` only reached the last *loaded* page instead of revealing all rows and jumping to the true bottom.
- Reloading or filtering while scoped to an epic on the **All**/**Closed** tabs no longer caps the fetch at bd's default 50 rows, which could drop an epic's children from the scoped view.
- The title search is now tag-escaped before it reaches the status bar, so a query containing `{`/`}` no longer corrupts the status line.
- Reparenting with `h` no longer throws `Unexpected token '✓' … is not valid JSON`. `bd dep add`/`bd dep remove` print a human-readable line rather than JSON, so their output is no longer parsed as JSON.
- `h` (change parent) now **detaches every existing parent first, then attaches** the chosen one — previously it added the new parent before removing the old, so the JSON error above left the bead with two parents. It also clears *all* existing parent-child links (not just the first), repairing beads that already ended up with multiple parents.

## [0.6.0] - 2026-06-14

### Fixed

- The **Closed** and **All** tabs now render the epic→children tree like the other tabs; previously they showed a flat, ungrouped list with every bead at the top level. Closed children nest under their epic (parent epics that aren't themselves closed are pulled in as the grouping anchor).

### Changed

- Tree views now build from the `parent` field that `bd` embeds in each `bd list`/`bd ready` row instead of fetching one `bd dep list` per bead. The Closed/All tabs gain the tree at no extra per-bead subprocess cost (lazy "load more" pagination is unchanged), and the Ready/Blocked/In-progress tabs load with fewer `bd` calls. The Blocked tab keeps a per-row `bd dep list` fallback for the derived-blocked rows `bd blocked` returns without a `parent` field.

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
