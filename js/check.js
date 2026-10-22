/* TT Mahjong Junior: the headless check of the rules (js/rules.js), for the page (game.check()) and for node
   (tools/check.js). It checks:
     - hands: win detection on test hands (four sets and a pair, with and without shown sets; seven pairs, a missing pair
       and the wrong count are not wins), then thousands of made-up hands against a second, separate win finder
       (sets taken from the top kind down) and the "how far from a win" count;
     - claims: the chow rule (three in a row, one suit, no 8 9 1, no winds or dragons, only the next player), the pung
       rule (anyone with two the same), who goes first (a win, then a pung, then a chow; the nearer win) and what a
       claim does (the set shows three tiles, the throw leaves the pond, the taker throws without drawing);
     - games: CPU games at every level end (a win or an empty wall) within a step limit, every tile stays somewhere
       exactly once, hands keep the right size, and every win is a real one by the second win finder.
   MJ.check({ sabotage, games }) returns { ok, ... }. MJ.checkCanFail() plants each bug in turn (rules.SAB): every
   one must make the check fail, which proves the check can fail. */
(function () {
  'use strict';
  const MJ = (globalThis.MJ = globalThis.MJ || {});
  const SABOTAGES = ['sevenPairs', 'noPair', 'wrapChow', 'honourChow', 'anyChow', 'chowFirst', 'lostTile', 'endless'];

  // "123d456b789c111z55z": digits then d (dots), b (bamboo), c (characters) or z (honours: 1-4 the winds east south
  // west north, 5-7 the dragons red green white) → counts of each kind
  function parse(str) {
    const c = new Array(34).fill(0);
    const re = /(\d+)([dbcz])/g;
    let m;
    while ((m = re.exec(str.replace(/\s/g, '')))) {
      const base = { d: 0, b: 9, c: 18, z: 27 }[m[2]];
      for (const ch of m[1]) c[base + +ch - 1]++;
    }
    return c;
  }
  const kindOf = (str) => parse(str).findIndex((x) => x > 0);

  // the second win finder: a pair, then sets taken from the TOP kind down (a different road from rules.isWin)
  function bruteWin(c, melds = 0) {
    let n = 0;
    for (const x of c) n += x;
    if (n !== 14 - 3 * melds) return false;
    const d = c.slice();
    for (let p = 0; p < 34; p++) {
      if (d[p] < 2) continue;
      d[p] -= 2;
      const ok = down(d, 33);
      d[p] += 2;
      if (ok) return true;
    }
    return false;
  }
  function down(d, k) {
    while (k >= 0 && !d[k]) k--;
    if (k < 0) return true;
    if (d[k] >= 3) {
      d[k] -= 3;
      const ok = down(d, k);
      d[k] += 3;
      if (ok) return true;
    }
    if (k < 27 && k % 9 >= 2 && d[k - 1] && d[k - 2]) {
      d[k]--; d[k - 1]--; d[k - 2]--;
      const ok = down(d, k);
      d[k]++; d[k - 1]++; d[k - 2]++;
      if (ok) return true;
    }
    return false;
  }
  // a shown set is real: three of one kind, or three in a row of one suit
  function realSet(kinds) {
    const [a, b, c] = kinds.slice().sort((x, y) => x - y);
    if (kinds.length !== 3) return false;
    if (a === b && b === c) return true;
    return a < 27 && b === a + 1 && c === a + 2 && ((a / 9) | 0) === ((c / 9) | 0);
  }

  function check(opts = {}) {
    const R = MJ.rules;
    const was = R.SAB.on;
    R.SAB.on = opts.sabotage || null;
    const out = { ok: true, sabotage: R.SAB.on, hands: { pass: 0, fail: 0 }, random: { pass: 0, fail: 0 }, claims: { pass: 0, fail: 0 }, games: { played: 0, wins: 0, walls: 0, unfinished: 0, bad: 0, steps: 0, byLevel: {} }, failures: [] };
    const fail = (sec, msg) => {
      out[sec].fail = (out[sec].fail || 0) + 1;
      if (out.failures.length < 12) out.failures.push(`${sec}: ${msg}`);
    };
    const pass = (sec) => { out[sec].pass++; };
    const expect = (sec, what, got, want) => (got === want ? pass(sec) : fail(sec, `${what}: got ${got}, want ${want}`));
    const t0 = Date.now();
    try {
      // ------------------------------------------------ win detection on test hands
      const HANDS = [
        ['123d456b789c111z55z', 0, true, 'four sets and a pair'],
        ['111d222d333d444d55d', 0, true, 'four pungs (or three chows and a pung) and a pair'],
        ['11123456789995d', 0, true, 'one suit, nine waits, with a 5'],
        ['11123456789991d', 0, true, 'the same with a 1'],
        ['111z222z333z444z55z', 0, true, 'all winds and dragons'],
        ['234d55z', 3, true, 'three sets shown, a chow and a pair in hand'],
        ['55z', 4, true, 'four sets shown, a pair in hand'],
        ['11d33d55d77d99d11b33b', 0, false, 'seven pairs: not a win here'],
        ['11d22b33c44z55z66z77z', 0, false, 'seven different pairs'],
        ['123d456d789d123b45b', 0, false, 'four sets but no pair'],
        ['123d456d789d123b4b9c', 0, false, 'four sets and two odd tiles'],
        ['891d234b567b111z22z', 0, false, '8 9 1 is not a chow'],
        ['123z444z555z666z77z', 0, false, 'east south west is not a chow'],
        ['567z111d222d333d44d', 0, false, 'the dragons in a row are not a chow'],
        ['789d123b456c11z22z', 0, false, 'two pairs and three sets'],
        ['123d456b789c111z5z', 0, false, 'only 13 tiles'],
        ['123d456b789c111z555z', 0, false, '15 tiles'],
        ['234d56z', 3, false, 'three sets shown, no pair'],
        ['234d55z', 2, false, 'two sets shown but the hand is too short'],
        ['9d1b2b345c678c111z77z', 0, false, '9 dots, 1 2 bamboo is not a chow'],
      ];
      for (const [str, m, want, what] of HANDS) {
        const c = parse(str);
        expect('hands', `${what} (${str}${m ? ` + ${m} shown` : ''}) isWin`, R.isWin(c.slice(), m), want);
        expect('hands', `${what} second finder`, bruteWin(c, m), want);
        if (c.reduce((a, b) => a + b, 0) === 14 - 3 * m) expect('hands', `${what} shanten -1`, R.shanten(c.slice(), m) === -1, want);
      }
      // waits: one suit's nine-gates hand waits on all nine
      expect('hands', 'nine gates waits on 1-9', R.waits(parse('1112345678999d'), 0).join(','), '0,1,2,3,4,5,6,7,8');
      expect('hands', 'two pairs wait on either', R.waits(parse('123d456b789c11z22z'), 0).join(','), '27,28');
      expect('hands', 'a gap waits on the middle', R.waits(parse('13d456b789c111z22z'), 0).join(','), '1');

      // ------------------------------------------------ thousands of made-up hands against the second finder
      const r = R.rng(opts.seed || 20261021);
      const randKind = () => Math.floor(r() * 34);
      const made = () => {
        // four random sets and a pair, at most four of a kind
        for (;;) {
          const c = new Array(34).fill(0);
          const p = randKind();
          c[p] += 2;
          for (let i = 0; i < 4; i++) {
            if (r() < 0.45) c[randKind()] += 3;
            else {
              const s = Math.floor(r() * 3) * 9 + Math.floor(r() * 7);
              c[s]++; c[s + 1]++; c[s + 2]++;
            }
          }
          if (c.every((x) => x <= 4)) return c;
        }
      };
      for (let i = 0; i < 3000; i++) {
        const c = made();
        if (!R.isWin(c.slice(), 0) || !bruteWin(c) || R.shanten(c.slice(), 0) !== -1) fail('random', `a made-up win was missed: ${c.join('')}`);
        else pass('random');
        // swap one tile: whatever isWin says, the second finder must agree
        const d = c.slice();
        const from = d.findIndex((x, k) => x > 0 && r() < 0.2);
        const to = randKind();
        if (from >= 0 && d[to] < 4 && to !== from) {
          d[from]--; d[to]++;
          if (R.isWin(d.slice(), 0) !== bruteWin(d) || (R.shanten(d.slice(), 0) === -1) !== bruteWin(d)) fail('random', `the finders disagree on ${d.join('')}`);
          else pass('random');
        }
      }
      for (let i = 0; i < 3000; i++) {
        // plain random 14 tiles (rarely a win) and 11 tiles with a shown set
        const m = i % 3 === 0 ? 1 : 0;
        const c = new Array(34).fill(0);
        for (let n = 0; n < 14 - 3 * m; n++) {
          let k = randKind();
          while (c[k] >= 4) k = randKind();
          c[k]++;
        }
        if (R.isWin(c.slice(), m) !== bruteWin(c, m)) fail('random', `the finders disagree on ${c.join('')} (+${m})`);
        else pass('random');
      }

      // ------------------------------------------------ claims: chow and pung rules, who goes first
      const chowStr = (hand, thrown) => R.chowOptions(parse(hand), kindOf(thrown)).map((p) => p.join('-')).join(' ');
      expect('claims', 'chow 3 dots with 1 2', chowStr('12d', '3d'), '0-1');
      expect('claims', 'chow 3 dots with 2 4', chowStr('24d', '3d'), '1-3');
      expect('claims', 'chow 3 dots with 4 5', chowStr('45d', '3d'), '3-4');
      expect('claims', 'chow 5 bamboo every way', chowStr('3467b', '5b'), '11-12 12-14 14-15');
      expect('claims', 'no chow 9 dots with 1 2 (no wrapping)', chowStr('12d', '9d'), '');
      expect('claims', 'no chow 1 dots with 8 9 (no wrapping)', chowStr('89d', '1d'), '');
      expect('claims', 'no chow 9 dots with 1 2 bamboo', chowStr('12b', '9d'), '');
      expect('claims', 'no chow 1 bamboo with 2 3 dots', chowStr('23d', '1b'), '');
      expect('claims', 'no chow east with south west', chowStr('23z', '1z'), '');
      expect('claims', 'no chow red with green white', chowStr('67z', '5z'), '');
      expect('claims', 'no chow 3 dots with 1 2 characters', chowStr('12c', '3d'), '');

      // a little table set up by hand: seat 0 throws 3 dots
      const table = (hands, thrown, from = 0) => {
        const T = R.newRound({ seed: 7 });
        const K = T.KIND;
        const pool = new Map();
        K.forEach((k, id) => { if (!pool.has(k)) pool.set(k, []); pool.get(k).push(id); });
        const take = (k) => {
          const id = pool.get(k).pop();
          if (id === undefined) throw new Error('the test table wants a fifth tile');
          return id;
        };
        T.hands = hands.map((h) => {
          const c = parse(h), ids = [];
          c.forEach((n, k) => { for (let i = 0; i < n; i++) ids.push(take(k)); });
          return ids;
        });
        const id = take(kindOf(thrown));
        T.wall = [];
        for (const ids of pool.values()) T.wall.push(...ids);
        T.ponds = [[], [], [], []];
        T.melds = [[], [], [], []];
        T.ponds[from].push(id);
        T.last = { id, from };
        T.turn = from;
        T.phase = 'claim';
        return T;
      };
      const fill = '9d19b19c'; // nothing near 3 dots
      const hand = (h) => h + fill;
      let T = table([fill, hand('12d'), hand('12d'), hand('3d')], '3d');
      const o1 = R.options(T, 1), o2 = R.options(T, 2), o3 = R.options(T, 3);
      expect('claims', 'the next player (right) can chow', o1.chows.length, 1);
      expect('claims', 'the player across can not chow', o2.chows.length, 0);
      expect('claims', 'one 3 dots is not a pung', o3.pung, false);
      expect('claims', 'the thrower has no claim', R.options(T, 0), null);

      T = table([fill, hand('12d'), hand('33d'), fill], '3d');
      expect('claims', 'two 3 dots across can pung', R.options(T, 2).pung, true);
      const before = T.hands[2].length;
      let res = R.resolve(T, [null, { type: 'chow', ix: 0 }, { type: 'pung' }, null]);
      expect('claims', 'a pung beats a chow', res && `${res.s}${res.type}`, '2pung');
      const meld = T.melds[2][0];
      expect('claims', 'the pung shows three tiles', meld ? meld.ids.length : 0, 3);
      expect('claims', 'the pung is three 3 dots', meld ? meld.ids.every((id) => T.KIND[id] === 2) : false, true);
      expect('claims', 'the hand gave two tiles', before - T.hands[2].length, 2);
      expect('claims', 'the throw left the pond', T.ponds[0].length, 0);
      expect('claims', 'the taker throws next, without drawing', `${T.turn}${T.phase}${T.drawn}`, '2discard-1');
      expect('claims', 'every tile is somewhere once', R.tally(T).every((n) => n === 1), true);

      T = table([fill, hand('12d'), hand('33d'), '12d456b789b111z22z'], '3d');
      expect('claims', 'the win is seen', R.options(T, 3).win, true);
      res = R.resolve(T, [null, { type: 'chow', ix: 0 }, { type: 'pung' }, { type: 'win' }]);
      expect('claims', 'a win beats a pung', res && `${res.s}${res.type}`, '3win');
      expect('claims', 'the winner is the winner', `${T.winner}${T.winBy}${T.phase}`, '3discardover');
      expect('claims', 'the winning hand holds 14', T.hands[3].length, 14);

      T = table([fill, fill, '12d456b789b111z22z', '12d456c789c333z44z'], '3d', 1);
      res = R.resolve(T, [null, null, { type: 'win' }, { type: 'win' }]);
      expect('claims', 'two wins: the nearer one wins', res && res.s, 2);

      T = table([fill, hand('12d'), fill, fill], '3d');
      res = R.resolve(T, [null, { type: 'chow', ix: 0 }, null, null]);
      const ch = T.melds[1][0];
      expect('claims', 'the chow shows 1 2 3 dots', ch ? ch.ids.map((id) => T.KIND[id]).join(',') : '', '0,1,2');
      expect('claims', 'after a chow, every tile is somewhere once', R.tally(T).every((n) => n === 1), true);
      T = table([fill, fill, fill, fill], '3d');
      res = R.resolve(T, [null, null, null, null]);
      expect('claims', 'nobody takes it: the next player draws', `${res}${T.turn}${T.phase}`, 'null1draw');

      // the wall runs out: the round ends in a draw
      T = R.newRound({ seed: 11 });
      T.wall = [];
      R.draw(T);
      expect('claims', 'an empty wall ends the round, nobody wins', `${T.phase}${T.winner}`, 'over-1');

      // ------------------------------------------------ CPU games end, honestly
      const LV = ['easy', 'normal', 'best'];
      const games = opts.games || 240;
      for (let g = 0; g < games; g++) {
        const levels = [0, 1, 2, 3].map((s) => LV[(g + s * (1 + (g % 2))) % 3]);
        const luck = g % 4 === 0 ? [0.4, 0, 0.4, 0] : g % 4 === 1 ? [0.1, 0.1, 0, 0] : [0, 0, 0, 0];
        const G = R.newRound({ seed: 9000 + g, dealer: g % 4, luck });
        let bad = null;
        R.autoPlay(G, levels, G.rng, 600, (S) => {
          if (bad) return;
          const t = R.tally(S);
          if (t.some((n) => n !== 1)) bad = 'a tile went missing or doubled';
          for (let s = 0; s < 4 && !bad; s++) {
            const want = 13 - 3 * S.melds[s].length + (S.phase === 'discard' && S.turn === s ? 1 : 0) + (S.phase === 'over' && S.winner === s ? 1 : 0);
            if (S.hands[s].length !== want) bad = `seat ${s} holds ${S.hands[s].length}, not ${want}`;
            for (const m of S.melds[s]) if (!realSet(m.ids.map((id) => S.KIND[id]))) bad = `seat ${s} shows a set that isn't one`;
          }
        });
        out.games.played++;
        out.games.steps += G.draws + G.throws;
        const key = levels.join('/');
        if (G.phase !== 'over') {
          out.games.unfinished++;
          fail('games', `game ${g} (${key}) never ended`);
          continue;
        }
        if (G.winner >= 0) {
          out.games.wins++;
          const c = R.counts(G, G.winner);
          if (!bruteWin(c, G.melds[G.winner].length)) bad = bad || `seat ${G.winner}'s win isn't four sets and a pair`;
          const lv = levels[G.winner];
          out.games.byLevel[lv] = (out.games.byLevel[lv] || 0) + 1;
        } else {
          out.games.walls++;
          if (G.wall.length) bad = bad || 'a draw with tiles left in the wall';
        }
        if (bad) {
          out.games.bad++;
          fail('games', `game ${g}: ${bad}`);
        }
      }
      // short walls (only 8 tiles left to draw): these mostly end with an empty wall, and must still end
      for (let g = 0; g < 30; g++) {
        const G = R.newRound({ seed: 7000 + g, dealer: g % 4 });
        G.wall.splice(0, G.wall.length - 8);
        R.autoPlay(G, ['easy', 'easy', 'easy', 'easy'], G.rng, 200);
        out.games.played++;
        if (G.phase !== 'over') {
          out.games.unfinished++;
          fail('games', `short-wall game ${g} never ended`);
        } else if (G.winner < 0) out.games.walls++;
        else out.games.wins++;
      }
      out.games.pass = out.games.played - out.games.unfinished - out.games.bad;
    } catch (e) {
      out.failures.push('crash: ' + e.message);
      out.crashed = true;
    } finally {
      R.SAB.on = was;
    }
    out.ok = !out.crashed && out.failures.length === 0 && out.games.played > 0;
    out.ms = Date.now() - t0;
    return out;
  }

  // every planted bug must make the check fail
  function checkCanFail(opts = {}) {
    const res = {};
    for (const s of SABOTAGES) {
      const o = check(Object.assign({}, opts, { sabotage: s, games: opts.games || 60 }));
      res[s] = o.ok ? 'MISSED' : `caught (${o.failures[0]})`;
    }
    return { ok: Object.values(res).every((v) => v.startsWith('caught')), res };
  }

  MJ.check = check;
  MJ.checkCanFail = checkCanFail;
  MJ.check.SABOTAGES = SABOTAGES;
  MJ.check.parse = parse;
  MJ.check.bruteWin = bruteWin;
})();
