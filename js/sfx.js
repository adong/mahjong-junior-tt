/* TT Mahjong Junior: the game's own sounds, built on Kit.sound.tone / hiss (all synthesised, no files).
   MJ.sfx.kit(name, ...args) plays a kit effect; the rest are ours. Every call is a silent no-op until
   Kit.sound.init() has run from the first tap, and nothing plays while the sound is off (Kit.sound's mute). */
(function () {
  'use strict';
  const MJ = (window.MJ = window.MJ || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o);
  const hiss = (o) => S.hiss(o);
  let lastClack = 0;

  MJ.sfx = {
    kit(name, ...args) {
      if (S[name]) S[name](...args);
    },
    // a tile lifted out of your hand
    pick() {
      hiss({ filter: 'bandpass', f: 3200, q: 2.5, dur: 0.04, vol: 0.12 });
      tone({ type: 'triangle', f: 880, to: 1100, dur: 0.06, vol: 0.06 });
    },
    // put back
    drop() {
      hiss({ filter: 'bandpass', f: 2200, q: 2.5, dur: 0.035, vol: 0.08 });
      tone({ type: 'triangle', f: 660, to: 520, dur: 0.05, vol: 0.05 });
    },
    // a tile slides off the wall into a hand
    draw() {
      hiss({ filter: 'bandpass', f: 1800, to: 2600, q: 1.5, dur: 0.12, vol: 0.05 });
    },
    // a tile thrown onto the table: click-clack (no more than one every 25 ms)
    clack(i = 0) {
      const now = performance.now();
      if (now - lastClack < 25) return;
      lastClack = now;
      hiss({ filter: 'bandpass', f: 2600 + (i % 5) * 300, q: 3, dur: 0.035, vol: 0.1 });
      tone({ type: 'triangle', f: 1400 + (i % 3) * 120, dur: 0.03, vol: 0.04 });
    },
    // the tiles shuffled on the table at the start of a round (the "sparrows twittering")
    wash() {
      for (let i = 0; i < 14; i++) hiss({ filter: 'bandpass', f: 2000 + ((i * 397) % 1600), q: 3, dur: 0.03, vol: 0.05, at: i * 0.045 + (i % 3) * 0.01 });
    },
    // CHOW: three in a row, a little run up
    chow() {
      [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.14, vol: 0.09 }));
      [0, 0.07, 0.14].forEach((at) => hiss({ filter: 'bandpass', f: 2800, q: 3, dur: 0.03, vol: 0.08, at }));
    },
    // PUNG: three the same, three knocks on one note
    pung() {
      [0, 0.09, 0.18].forEach((at) => {
        tone({ type: 'square', f: 392, dur: 0.07, vol: 0.06, at, lp: 1800 });
        hiss({ filter: 'bandpass', f: 2400, q: 3, dur: 0.035, vol: 0.1, at });
      });
    },
    // a claim button pops up
    offer() {
      tone({ type: 'sine', f: 880, to: 1320, dur: 0.14, vol: 0.07 });
    },
    // no thanks
    pass() {
      tone({ type: 'sine', f: 520, to: 440, dur: 0.1, vol: 0.05 });
    },
    // the keyboard moves along your hand
    step() { tone({ type: 'square', f: 1500, dur: 0.02, vol: 0.02, lp: 3000 }); },
    // one tile to win!
    ready() {
      [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.16, vol: 0.07 }));
    },
    // your brother's help: a magic sparkle
    peek() {
      [1319, 1568, 1976, 2637].forEach((f, i) => tone({ type: 'sine', f, at: i * 0.05, dur: 0.25, vol: 0.06 }));
      hiss({ filter: 'highpass', f: 7000, dur: 0.5, vol: 0.04 });
    },
    // 胡! a gong, then a fanfare
    win() {
      tone({ type: 'sine', f: 196, to: 180, dur: 1.6, vol: 0.14 });
      tone({ type: 'sine', f: 392, to: 370, dur: 1, vol: 0.05 });
      hiss({ filter: 'bandpass', f: 900, q: 0.6, dur: 0.5, vol: 0.05 });
      [523, 587, 659, 784, 880].forEach((f, i) => tone({ type: 'triangle', f: f * 2, at: 0.3 + i * 0.09, dur: 0.22, vol: 0.08 }));
      [523, 659, 784].forEach((f) => tone({ type: 'triangle', f: f * 2, at: 0.8, dur: 0.7, vol: 0.07 }));
      hiss({ filter: 'highpass', f: 6000, at: 0.8, dur: 0.5, vol: 0.05 });
    },
    // a friend won (or nobody did): a soft wah-wah, never harsh
    lose() { [392, 370, 349, 311].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: i === 3 ? 0.5 : 0.22, vol: 0.08 })); },
    // your brother pops in (and out)
    pop() {
      tone({ f: 300, to: 900, dur: 0.12, vol: 0.1 });
      hiss({ f: 2000, to: 6000, dur: 0.15, vol: 0.05 });
    },
    // the high five: a clap
    clap() {
      hiss({ filter: 'bandpass', f: 1500, q: 0.8, dur: 0.09, vol: 0.22 });
      hiss({ filter: 'highpass', f: 3000, dur: 0.05, vol: 0.1, at: 0.01 });
    },
  };
})();
