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
  '  w           Copy workflow command (tasks: executors; epics: epic-sequential)',
  '  m           Release mouse to select/copy detail text (toggle)',
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

  // '?' is deliberately NOT a close key here — the caller (app.js) drives it as
  // an open/close toggle. Binding '?' as a close key would re-enter on the very
  // keypress that opens the modal: the toggle adds this listener mid-dispatch
  // and blessed's emitter would then fire it in the same 'key ?' pass, slamming
  // the help shut the instant it opened. q/Esc/h are safe — they never open the
  // help, so they can only ever close it.
  const CLOSE_KEYS = ['q', 'escape', 'h'];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    screen.unkey(CLOSE_KEYS, close);
    box.destroy();
    screen.render();
    onClose?.();
  };

  // Bind the close keys on the screen, not the box. A box-level binding only
  // fires while the box holds keyboard focus, but the Beads list and Detail
  // pane are both mouse:true — a click on either steals focus from the help
  // box. app.js suppresses every global key while a modal is open, so a
  // focus-stealing click would otherwise leave the help permanently stuck
  // open (its own close keys dead, every global key inert). Screen-level keys
  // fire regardless of which pane holds focus, so q/Esc/h always dismiss it.
  // unkey() on close keeps the binding from leaking across repeated opens.
  screen.key(CLOSE_KEYS, close);

  // Returned so the caller's '?' toggle can dismiss the help regardless of
  // which pane currently holds focus.
  return close;
}
