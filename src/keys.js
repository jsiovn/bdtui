import blessed from 'blessed';

export const HELP_TEXT = [
  '',
  '  Navigation',
  '  ──────────────────────────────────────',
  '  j / ↓       Move down in list',
  '  k / ↑       Move up in list',
  '  g           Jump to top',
  '  Shift+g     Jump to bottom',
  '  Enter / l   Focus detail pane',
  '  h / Esc     Back to list (from detail)',
  '',
  '  Filters & refresh',
  '  ──────────────────────────────────────',
  '  Tab         Next status filter (blocked/ready/in_progress/closed/all)',
  '  Shift+Tab   Previous status filter',
  '  t           Cycle type filter (all/epic/task/chore/bug)',
  '  e           Filter by epic (modal picker; x clears; switches status to all)',
  '  /           In-memory title filter (empty submit clears it)',
  '  r           Reload (keeps active filters)',
  '  Shift+r     Reset all filters (title / epic / type) and reload',
  '  (all & closed tabs load more rows as you scroll to the bottom)',
  '',
  '  Mutations',
  '  ──────────────────────────────────────',
  '  s           Change status',
  '  c           Close with reason',
  '  Shift+c     Claim bead (in_progress + assign self)',
  '  o           Reopen',
  '  p           Change priority',
  '  h           Change parent (epic / standalone)',
  '',
  '  Other',
  '  ──────────────────────────────────────',
  '  y           Yank bead ID to clipboard',
  '  w           Copy workflow skill command for selected task',
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
