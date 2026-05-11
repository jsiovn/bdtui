import blessed from 'blessed';

export const HELP_TEXT = [
  '',
  '  Navigation',
  '  ──────────────────────────────────────',
  '  j / ↓       Move down in list',
  '  k / ↑       Move up in list',
  '  g           Jump to top',
  '  G           Jump to bottom',
  '  Enter / l   Focus detail pane',
  '  h / Esc     Back to list',
  '',
  '  Filters & refresh',
  '  ──────────────────────────────────────',
  '  f           Cycle filter (ready/open/in_progress/all)',
  '  r           Reload current filter from bd',
  '  /           In-memory title filter',
  '',
  '  Mutations',
  '  ──────────────────────────────────────',
  '  s           Change status',
  '  c           Close with reason',
  '  C           Claim bead (in_progress + assign self)',
  '  o           Reopen',
  '  p           Change priority',
  '  D           Dependency menu (add / remove)',
  '',
  '  Other',
  '  ──────────────────────────────────────',
  '  y           Yank bead ID to clipboard',
  '  ?           Toggle this help',
  '  q / Ctrl-C  Quit',
  '',
  '  Press ? q or Esc to close',
].join('\n');

export function showHelp(screen, onClose) {
  const box = blessed.box({
    parent: screen,
    label: ' Keybindings ',
    border: { type: 'line' },
    top: 'center',
    left: 'center',
    width: '55%',
    height: '80%',
    content: HELP_TEXT,
    tags: false,
    keys: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│' },
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan', bold: true },
    },
  });

  box.focus();
  screen.render();

  const close = () => {
    box.destroy();
    screen.render();
    onClose?.();
  };

  box.key(['?', 'q', 'escape', 'h'], close);
}
