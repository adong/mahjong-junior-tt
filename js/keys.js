/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.MJ_TITLE, // the name lives in js/title.js
  button: { top: 'var(--kh-top)' }, // index.html moves it (and the language button) to a corner on tall screens
  keys: [
    ['pick a tile to throw away', '← →'],
    ['throw it', 'Enter or Space'],
    ['take the tile on offer (chow, pung) or win (hú)', '1 2 3'],
    ['win (hú) when you can', 'H'],
    ['no thanks (pass)', 'X'],
    ['call your brother (2 players: high five)', 'T'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: play · the story', 'Enter · B'],
    ['menu: 1 player · 2 players', '1 · 2'],
    ['menu: Teddy or Tommy · level', 'W · L'],
  ],
  note: 'Draw a tile, then throw one away. Make four sets (three the same, or three in a row of one suit) and a pair. Then you win: hú!',
  touch: 'Tap a tile, then tap it again to throw it. Tap the yellow buttons to take a tile. Tap your brother\'s face (bottom right) and he shows you the best tile to throw.',
});
Kit.lang.setup({ button: { top: 'var(--kl-top)' } });
