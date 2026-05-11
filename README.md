# bdtui

Fast blessed-based terminal UI for the [`bd`](https://github.com/nicholasgasior/beads) beads issue tracker.

## Install

```bash
npm install -g bdtui
```

## Usage

```bash
bdtui              # use current directory
bdtui .            # explicit current directory
bdtui ~/www/myapp  # explicit project path
```

## Layout

```
┌─[ready  open  in_progress  all]────────────────────────────┐
│ list (40%)            │ detail (60%)                        │
│ > be-12 P1 in_prog …  │ be-12 — Some bead title             │
│   be-13 P2 open    …  │ Status: in_progress  Priority: P1   │
│                       │ Type:   feature      Owner: paolo   │
│                       │ …                                   │
├───────────────────────┴─────────────────────────────────────┤
│ Ready | ? help                                              │
└─────────────────────────────────────────────────────────────┘
```

## Keybindings

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `g` / `G` | Jump to top / bottom |
| `Enter` / `l` | Focus detail pane |
| `h` / `Esc` | Back to list |
| `f` | Cycle filter: ready → open → in_progress → all |
| `r` | Reload current filter |
| `/` | In-memory title filter |
| `s` | Change status |
| `c` | Close with reason |
| `C` | Claim (in_progress + assign self) |
| `o` | Reopen |
| `p` | Change priority |
| `D` | Dependency menu (add / remove) |
| `y` | Yank bead ID to clipboard |
| `?` | Help overlay |
| `q` / `Ctrl-C` | Quit |

## Requirements

- Node ≥ 20
- `bd` installed and on `$PATH`
- A project with a `.beads/` database (created by `bd init`)
