# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working principles

How to approach any change in this repo: think before coding, keep it simple, make surgical edits, drive every task to a verified outcome.

@docs/context/PRINCIPLES.md

## What this is

`bdtui` is a [blessed](https://github.com/chjj/blessed)-based terminal UI for the [`bd`](https://github.com/gastownhall/beads) "beads" issue tracker. It shells out to the `bd` CLI for every read and write — it has no database of its own. Pure ESM, Node ≥ 20, single runtime dependency (`blessed`).

## Commands

There is no build, lint, or test setup — the source runs directly under Node.

```bash
node bin/bdtui.js               # run against the current directory
node bin/bdtui.js ~/some/proj   # run against another project's .beads/ db
node bin/bdtui.js -v            # print version
```

Requires `bd` on `$PATH` and a project containing a `.beads/` database (`bd init`). `bin/bdtui.js` auto-starts the Dolt server (`bd dolt start`) if `bd dolt test` fails, then `chdir`s into the target and hands off to `src/app.js`.

## Architecture

Strict one-way layering — data → state → views, wired together by `app.js`:

- **`src/bd.js`** — the _only_ module that spawns `bd`. `runBd` parses JSON stdout; `runBdVoid` runs commands whose output is human-readable text (`dep add/remove`) and must NOT be JSON-parsed. `bdErrorMessage` unwraps `bd`'s structured `{"error": …}` failure body into a readable string. Note `MAX_BUFFER` is raised to 64MB because `list --all` can exceed Node's 1MB default.

- **`src/state.js`** — a single mutable `state` object plus all data-loading/filtering logic. Key invariants:
  - The epic→child **tree is built from the `parent` field embedded in each `bd list` row** (`buildTreeOrder`), so there is no per-bead subprocess fan-out even on large repos. The tree is intentionally only two levels deep.
  - `applyFilters()` is the single place filters are applied, and they **compose** in order: epic scope → type → text. A reload (`r`) replays them; the status bar describes them. Type/text filters flatten the tree to a flat list.
  - The **`all` and `closed` tabs page lazily** (`isPaged()`, `visibleCount`, `pageSize`): every bead is fetched (cap lifted via `--limit 0`) but rows render in batches as you scroll. `ensureSelectedVisible()` must be called after `selectedId` is finalized so a kept selection stays rendered.

- **`src/views/list.js`, `detail.js`, `modals.js`** — `create*` build a blessed widget once; `render*` are pure functions that read `state` and repaint. Pickers in `modals.js` return promises that resolve on select and reject with `Error('cancelled')` on Esc/q.

- **`src/keys.js`** — the help overlay (`showHelp`) and the canonical `HELP_TEXT`.

- **`src/app.js`** — `run(cwd)` owns the screen, status/tab bars, all global keybindings, and the modal lifecycle.

### Cross-cutting gotchas

- **Blessed tag escaping.** Any user/`bd`-supplied text rendered into a `tags:true` box must be escaped with the single-pass `escTags`/`esc` helper (`replace(/[{}]/g, …)`). A naive two-step `.replace('{').replace('}')` re-processes the `}` it just inserted and corrupts text containing a literal `}` (e.g. a JSON error blob). This is duplicated deliberately in `app.js` and `views/detail.js`.

- **Shift keybindings.** blessed reports a shifted letter as `S-<lower>`, never bare uppercase — bind `'S-r'`, `'S-c'`, `'S-g'`, NOT `'R'`/`'C'`/`'G'` (those are dead).

- **Modal handling.** `app.js`'s `key()` wrapper swallows every global key while `modalOpen` is true, so each modal owns its own close keys. `?` is the exception: it is registered directly on `screen` as an open/close toggle (binding it as a close key would slam the help shut on the same keypress that opened it). Help close keys are bound at _screen_ level, not box level, because a mouse click can steal focus from the box.

- **Effective "blocked" status.** The Blocked tab and the status glyphs are _derived_: an `open` bead whose id is in `state.blockedIds` (from `bd blocked`) renders as `blocked`. `bdBlocked` merges derived-blocked beads with explicitly `status=blocked` beads, deduped, because `bd blocked` omits the latter.

## Conventions

- ESM only (`"type": "module"`), top-level `await` in `app.js`/`bin`.
- Keep `README.md` (keybindings table), `src/keys.js` (`HELP_TEXT`), and the actual `app.js` bindings in sync when changing keys.
- Version is bumped in the feature commit; `npm publish` is a separate later step. Land changes via a feature branch + PR into `master`, not direct pushes. `CHANGELOG.md` tracks releases.

## Project conventions

### Commits

Conventional Commits by convention — there is **no** commitlint/husky tooling in this repo, so the format is not machine-enforced; follow it anyway. Format: `type: subject`. Commits are **scopeless** (no `(scope)` — every commit in history omits it). Types in use: `feat`, `fix`, `chore`, `docs`.

A release commit bumps the `version` in `package.json` and updates `CHANGELOG.md` in the same commit, and states it in the subject — e.g. `feat: epic 'w' workflow dialog; …; bump to 0.7.2`.

### Pull request conventions

When creating a PR, always set:

- **Assignee:** `jsiovn` (repo owner)
- **Reviewer:** `phudev95` (the repo's other collaborator)
- **Labels:** one type label from the repo's label set — `enhancement`, `bug`, or `documentation` (these are the GitHub defaults; there is no `refactor` or epic-name label, so don't invent one — create the label first if you need it)

```bash
gh pr create \
  --assignee jsiovn \
  --reviewer phudev95 \
  --label "enhancement" \
  ...
```
