/* TT Mahjong Junior: the rules, with no page in sight (the page and node's tools/check.js both load this file).
   A simplified family mahjong (麻将):
   - 136 tiles, four of each of 34 kinds: dots, bamboo and characters 1 to 9, the four winds and the three dragons.
   - Four seats in turn order 0 (bottom, you) → 1 (right) → 2 (top) → 3 (left), round the table the way real mahjong
     goes. Everyone gets 13 tiles; the dealer starts. On your turn: draw a tile, then throw one away.
   - When someone throws a tile away, anyone can take it for a PUNG (碰, three the same, with two from their hand) or to
     WIN (胡); only the next player can take it for a CHOW (吃, three in a row of one suit, with two from their hand).
     A win beats a pung, a pung beats a chow; two wins: the one nearer in turn order. The taker shows the set and throws.
   - Win (胡) with 14 tiles: four sets (pungs or chows) and a pair (对子), by drawing it yourself or taking a throw.
   - No kongs (four the same), flowers or minimum points: family simplifications. Nobody pays anybody: a win earns
     points (SCORE below). If the wall runs out first, it's a draw.
   MJ.rules also has the CPU friends' brains (pick a throw, decide a claim) and autoPlay() for games with nobody at the
   table (the title screen, the headless check). */
(function () {
  'use strict';
  const MJ = (globalThis.MJ = globalThis.MJ || {});

  // ---------------------------------------------------------------- the tiles

  // 34 kinds: 0-8 dots 1-9, 9-17 bamboo 1-9, 18-26 characters 1-9, 27-30 winds (east, south, west, north),
  // 31-33 dragons (red, green, white). A tile is its id (0..N-1) and R.KIND[id] is its kind.
  const NK = 34;
  const isNum = (k) => k < 27;
  const suitOf = (k) => (k < 27 ? (k / 9) | 0 : k < 31 ? 3 : 4); // 0 dots, 1 bamboo, 2 characters, 3 winds, 4 dragons
  const rankOf = (k) => (k < 27 ? (k % 9) + 1 : k < 31 ? k - 26 : k - 30);
  const ALL = Array.from({ length: NK }, (_, k) => k);
  const SUIT_EN = ['DOTS', 'BAMBOO', 'CHARACTERS'];
  const SUIT_ZH = ['筒', '条', '万'];
  const ZH_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HONOUR_EN = ['EAST WIND', 'SOUTH WIND', 'WEST WIND', 'NORTH WIND', 'RED DRAGON', 'GREEN DRAGON', 'WHITE DRAGON'];
  const HONOUR_ZH = ['东风', '南风', '西风', '北风', '红中', '发财', '白板'];
  // a tile's name, for the toasts: "3 DOTS" / "三筒"
  function nameOf(k, zh) {
    if (isNum(k)) return zh ? ZH_NUM[k % 9] + SUIT_ZH[suitOf(k)] : `${rankOf(k)} ${SUIT_EN[suitOf(k)]}`;
    return (zh ? HONOUR_ZH : HONOUR_EN)[k - 27];
  }

  // A planted bug for the headless check (js/check.js): it must catch every one. Never set in the game.
  const SAB = { on: null };

  // a small seeded random number generator (mulberry32), so a round can be played again exactly
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------- winning hands

  // Is c (counts of each kind, 14 - 3 × melds tiles) four sets and a pair, with `melds` sets already shown?
  function isWin(c, melds = 0) {
    let n = 0;
    for (let k = 0; k < NK; k++) n += c[k];
    if (n !== 14 - 3 * melds) return false;
    if (SAB.on === 'sevenPairs' && melds === 0 && c.filter((x) => x === 2).length === 7) return true;
    for (let p = 0; p < NK; p++) {
      if (c[p] < 2) continue;
      c[p] -= 2;
      const ok = allSets(c, 0);
      c[p] += 2;
      if (ok) return true;
    }
    if (SAB.on === 'noPair') {
      // the bug: any two tiles will do instead of a pair
      for (let a = 0; a < NK; a++) for (let b = a + 1; b < NK; b++) {
        if (!c[a] || !c[b]) continue;
        c[a]--; c[b]--;
        const ok = allSets(c, 0);
        c[a]++; c[b]++;
        if (ok) return true;
      }
    }
    return false;
  }
  // can every tile left (from kind i up) be made into pungs and chows?
  function allSets(c, i) {
    while (i < NK && !c[i]) i++;
    if (i >= NK) return true;
    if (c[i] >= 3) {
      c[i] -= 3;
      const ok = allSets(c, i);
      c[i] += 3;
      if (ok) return true;
    }
    if (isNum(i) && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      const ok = allSets(c, i);
      c[i]++; c[i + 1]++; c[i + 2]++;
      if (ok) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- how far from winning (shanten)

  // Each suit (and the honours) on its own: every way to split it into sets (m), part-sets (t: a pair, two in a row or
  // two with a gap) and at most one pair kept for the win (h). Kept per suit pattern, so it's quick.
  const memo = new Map();
  function groupCombos(c, start, len, num) {
    let key = num ? 1 : 2;
    for (let i = 0; i < len; i++) key = key * 5 + c[start + i];
    const hit = memo.get(key);
    if (hit) return hit;
    const a = [];
    for (let i = 0; i < len; i++) a.push(c[start + i]);
    const seen = new Set(), all = [];
    (function scan(i, m, t, h) {
      while (i < len && !a[i]) i++;
      if (i >= len) {
        const id = m * 100 + t * 10 + h;
        if (!seen.has(id)) {
          seen.add(id);
          all.push([m, t, h]);
        }
        return;
      }
      if (a[i] >= 3) { a[i] -= 3; scan(i, m + 1, t, h); a[i] += 3; }
      if (num && i <= len - 3 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; scan(i, m + 1, t, h); a[i]++; a[i + 1]++; a[i + 2]++; }
      if (a[i] >= 2) {
        a[i] -= 2;
        if (!h) scan(i, m, t, 1);
        scan(i, m, t + 1, h);
        a[i] += 2;
      }
      if (num && i <= len - 2 && a[i + 1]) { a[i]--; a[i + 1]--; scan(i, m, t + 1, h); a[i]++; a[i + 1]++; }
      if (num && i <= len - 3 && a[i + 2]) { a[i]--; a[i + 2]--; scan(i, m, t + 1, h); a[i]++; a[i + 2]++; }
      a[i]--; scan(i, m, t, h); a[i]++;
    })(0, 0, 0, 0);
    // keep only the splits nothing else beats in every way
    const out = all.filter((x) => !all.some((y) => y !== x && y[0] >= x[0] && y[1] >= x[1] && y[2] >= x[2] && (y[0] > x[0] || y[1] > x[1] || y[2] > x[2])));
    if (memo.size > 300000) memo.clear();
    memo.set(key, out);
    return out;
  }
  // How many tiles away from a ready hand: -1 = a win, 0 = one tile to win, 1, 2 ... (8 at worst).
  function shanten(c, melds = 0) {
    const g = [groupCombos(c, 0, 9, true), groupCombos(c, 9, 9, true), groupCombos(c, 18, 9, true), groupCombos(c, 27, 7, false)];
    let best = 8;
    for (const A of g[0]) for (const B of g[1]) for (const C of g[2]) for (const D of g[3]) {
      const h = A[2] + B[2] + C[2] + D[2];
      if (h > 1) continue;
      const m = Math.min(4, melds + A[0] + B[0] + C[0] + D[0]);
      const t = Math.min(A[1] + B[1] + C[1] + D[1], 4 - m);
      const s = 8 - 2 * m - t - h;
      if (s < best) best = s;
    }
    return best;
  }

  // the kinds that would win (or, with -1, any wait): for "ONE TILE TO WIN!" on 🐣 EASY
  function waits(c, melds, kinds = ALL) {
    const out = [];
    for (const k of kinds) {
      if (c[k] >= 4) continue;
      c[k]++;
      if (isWin(c, melds)) out.push(k);
      c[k]--;
    }
    return out;
  }

  // ---------------------------------------------------------------- claims: chow, pung, win

  // the pairs of kinds in hand c that make a chow with thrown kind k (three in a row, one suit, 1 to 9: no wrapping)
  function chowOptions(c, k) {
    const out = [];
    if (SAB.on === 'honourChow' && !isNum(k)) {
      // the bug: winds and dragons in a row count too
      const base = k < 31 ? 27 : 31, len = k < 31 ? 4 : 3;
      for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
        const ka = k + a, kb = k + b;
        if (ka >= base && kb < base + len && ka < base + len && kb >= base && c[ka] && c[kb]) out.push([ka, kb]);
      }
      return out;
    }
    if (!isNum(k)) return out;
    const s = suitOf(k) * 9, r = k - s;
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      let ra = r + a, rb = r + b;
      if (SAB.on === 'wrapChow') { ra = (ra + 9) % 9; rb = (rb + 9) % 9; } // the bug: 8 9 1 counts
      if (ra < 0 || rb < 0 || ra > 8 || rb > 8) continue;
      if (c[s + ra] && c[s + rb]) out.push([s + ra, s + rb]);
    }
    return out;
  }

  // ---------------------------------------------------------------- a round

  // newRound({ seed, dealer, luck: [chance per seat] })
  // luck: a seat with luck gets a helpful tile from deeper in the wall that often (🐣 EASY's kids, see draw()).
  function newRound(o = {}) {
    const seed = o.seed >>> 0 || Math.floor(Math.random() * 2 ** 31) + 1;
    const r = rng(seed);
    const kinds = ALL;
    const KIND = [];
    for (const k of kinds) for (let n = 0; n < 4; n++) KIND.push(k);
    const wall = shuffle(KIND.map((_, i) => i), r);
    const dealer = (o.dealer | 0) % 4;
    const R = {
      seed, rng: r, kinds, KIND, wall, dealer, turn: dealer, phase: 'draw',
      hands: [[], [], [], []], melds: [[], [], [], []], ponds: [[], [], [], []], luck: (o.luck || [0, 0, 0, 0]).slice(),
      drawn: -1, last: null, winner: -1, winBy: '', winTile: -1, from: -1, draws: 0, throws: 0, claims: 0, lucky: 0, log: [],
    };
    for (let i = 0; i < 13; i++) for (let s = 0; s < 4; s++) R.hands[(dealer + s) % 4].push(wall.pop());
    for (let s = 0; s < 4; s++) sortHand(R, s);
    return R;
  }

  function sortHand(R, s) {
    R.hands[s].sort((a, b) => R.KIND[a] - R.KIND[b] || a - b);
  }
  // counts of each kind in seat s's hand (the tiles not shown)
  function counts(R, s) {
    const c = new Array(NK).fill(0);
    for (const id of R.hands[s]) c[R.KIND[id]]++;
    return c;
  }
  // the tiles seat s hasn't seen (not in its hand, any pond or any shown set): what it might still draw
  function unseen(R, s) {
    const u = new Array(NK).fill(0);
    for (const k of R.kinds) u[k] = 4;
    const see = (id) => { u[R.KIND[id]] = Math.max(0, u[R.KIND[id]] - 1); };
    R.hands[s].forEach(see);
    for (let q = 0; q < 4; q++) {
      R.ponds[q].forEach(see);
      for (const m of R.melds[q]) m.ids.forEach(see);
    }
    return u;
  }

  // the turn seat draws a tile. Returns its id, or -1 when the wall is empty (the round is a draw).
  function draw(R) {
    if (R.phase !== 'draw') throw new Error('not time to draw');
    if (!R.wall.length) {
      if (SAB.on === 'endless') {
        // the bug: an empty wall doesn't end the round, the turn just goes round and round
        R.turn = (R.turn + 1) % 4;
        return -1;
      }
      R.phase = 'over';
      R.winner = -1;
      R.log.push('wall');
      return -1;
    }
    const s = R.turn;
    if (R.luck[s] > 0 && R.wall.length > 1 && R.rng() < R.luck[s]) lucky(R, s);
    const id = R.wall.pop();
    R.hands[s].push(id);
    R.drawn = id;
    R.draws++;
    R.phase = 'discard';
    R.log.push(`${s}d${R.KIND[id]}`);
    return id;
  }
  // 🐣 EASY's luck: swap a tile from deeper in the wall that brings seat s nearer a win to the top (the tiles stay the
  // same tiles, only their order changes).
  function lucky(R, s) {
    const c = counts(R, s), m = R.melds[s].length;
    const now = shanten(c, m);
    const good = new Set();
    for (const k of R.kinds) {
      c[k]++;
      if (shanten(c, m) < now) good.add(k);
      c[k]--;
    }
    if (!good.size) return;
    const top = R.wall.length - 1;
    if (good.has(R.KIND[R.wall[top]])) return;
    const ix = [];
    for (let i = 0; i < top; i++) if (good.has(R.KIND[R.wall[i]])) ix.push(i);
    if (!ix.length) return;
    const i = ix[Math.floor(R.rng() * ix.length)];
    [R.wall[i], R.wall[top]] = [R.wall[top], R.wall[i]];
    R.lucky++;
  }

  // can the turn seat win with what it holds (it just drew, or took a tile)?
  function canSelfWin(R, s) {
    return R.phase === 'discard' && R.turn === s && R.drawn >= 0 && isWin(counts(R, s), R.melds[s].length);
  }
  function selfWin(R, s) {
    if (!canSelfWin(R, s)) throw new Error('no win');
    R.winner = s;
    R.winBy = 'self';
    R.winTile = R.drawn;
    R.from = s;
    R.phase = 'over';
    R.log.push(`${s}W`);
  }

  // seat s throws tile id away
  function discard(R, s, id) {
    if (R.phase !== 'discard' || R.turn !== s) throw new Error('not your throw');
    const i = R.hands[s].indexOf(id);
    if (i < 0) throw new Error('not in your hand');
    R.hands[s].splice(i, 1);
    R.ponds[s].push(id);
    R.last = { id, from: s };
    R.drawn = -1;
    R.throws++;
    R.phase = 'claim';
    sortHand(R, s);
    R.log.push(`${s}t${R.KIND[id]}`);
  }

  // what seat s could do with the tile just thrown: { win, pung, chows: [[kind, kind], ...], k }, or null
  function options(R, s) {
    if (R.phase !== 'claim' || !R.last || s === R.last.from) return null;
    const k = R.KIND[R.last.id];
    const c = counts(R, s), m = R.melds[s].length;
    c[k]++;
    const win = isWin(c, m);
    c[k]--;
    const pung = c[k] >= 2;
    const next = (R.last.from + 1) % 4;
    const chows = s === next || SAB.on === 'anyChow' ? chowOptions(c, k) : [];
    return { win, pung, chows, k };
  }
  const anyOption = (o) => !!o && (o.win || o.pung || o.chows.length > 0);

  // seat s takes the thrown tile: type 'win' | 'pung' | 'chow' (ix: which chow)
  function claim(R, s, type, ix = 0) {
    const o = options(R, s);
    if (!o) throw new Error('nothing to take');
    const { id, from } = R.last;
    if (type === 'win') {
      if (!o.win) throw new Error('not a win');
      R.ponds[from].pop();
      R.hands[s].push(id);
      sortHand(R, s);
      R.winner = s;
      R.winBy = 'discard';
      R.winTile = id;
      R.from = from;
      R.phase = 'over';
      R.last = null;
      R.log.push(`${s}H${from}`);
      return;
    }
    let need;
    if (type === 'pung') {
      if (!o.pung) throw new Error('no pung');
      need = [o.k, o.k];
    } else if (type === 'chow') {
      if (!o.chows[ix]) throw new Error('no chow');
      need = o.chows[ix];
    } else throw new Error('what claim?');
    const hand = R.hands[s], ids = [];
    for (const k of need) {
      const i = hand.findIndex((x) => R.KIND[x] === k && !ids.includes(x));
      ids.push(hand[i]);
    }
    for (const x of ids) hand.splice(hand.indexOf(x), 1);
    R.ponds[from].pop();
    if (SAB.on !== 'lostTile') ids.push(id); // the bug: the taken tile vanishes
    ids.sort((a, b) => R.KIND[a] - R.KIND[b]);
    R.melds[s].push({ type, ids, claimed: id, from });
    R.turn = s;
    R.phase = 'discard';
    R.drawn = -1;
    R.last = null;
    R.claims++;
    R.log.push(`${s}${type === 'pung' ? 'P' : 'C'}${from}`);
  }
  // nobody takes it: the next seat's turn
  function pass(R) {
    if (R.phase !== 'claim') throw new Error('nothing to pass');
    R.turn = (R.last.from + 1) % 4;
    R.phase = 'draw';
    R.last = null;
  }
  // everybody's choices at once (dec[s] = { type, ix } or null): a win first (nearest in turn order), then a pung,
  // then a chow. Returns { s, type } for the claim that happened, or null (passed).
  function resolve(R, dec) {
    const from = R.last.from;
    const order = [1, 2, 3].map((d) => (from + d) % 4);
    const types = SAB.on === 'chowFirst' ? ['win', 'chow', 'pung'] : ['win', 'pung', 'chow'];
    for (const type of types) for (const s of order) {
      if (dec[s] && dec[s].type === type) {
        claim(R, s, type, dec[s].ix || 0);
        return { s, type };
      }
    }
    pass(R);
    return null;
  }

  // ---------------------------------------------------------------- points (no money: points and smiles)

  // the winner's points, as [[what, points], ...]: WIN 10, plus SELF-DRAWN, NO CLAIMS, ONE SUIT, ALL PUNGS ...
  function score(R) {
    if (R.winner < 0) return null;
    const s = R.winner, melds = R.melds[s];
    const c = counts(R, s);
    const all = c.slice();
    for (const m of melds) for (const id of m.ids) all[R.KIND[id]]++;
    const items = [['WIN', 10]];
    if (R.winBy === 'self') items.push(['SELF-DRAWN', 5]);
    if (!melds.length) items.push(['NO CLAIMS', 5]);
    const suits = new Set(), kinds = [];
    for (let k = 0; k < NK; k++) if (all[k]) { kinds.push(k); if (isNum(k)) suits.add(suitOf(k)); }
    const honours = kinds.some((k) => !isNum(k));
    if (!suits.size) items.push(['ALL HONOURS', 30]);
    else if (suits.size === 1) items.push(honours ? ['ONE SUIT + HONOURS', 10] : ['ALL ONE SUIT', 20]);
    // all pungs: every set three the same; all chows: every set three in a row
    const pungsOnly = melds.every((m) => m.type === 'pung') && c.filter((x) => x === 2).length === 1 && c.every((x) => x === 0 || x === 2 || x === 3);
    if (pungsOnly) items.push(['ALL PUNGS', 10]);
    else if (melds.every((m) => m.type === 'chow') && chowsOnly(c)) items.push(['ALL CHOWS', 5]);
    // a pung of dragons: lucky!
    let dragons = 0;
    for (let k = 31; k < 34; k++) if (all[k] >= 3) dragons++;
    for (let i = 0; i < dragons; i++) items.push(['DRAGON PUNG', 5]);
    const total = items.reduce((t, x) => t + x[1], 0);
    return { items, total };
  }
  function chowsOnly(c) {
    for (let p = 0; p < NK; p++) {
      if (c[p] < 2) continue;
      const d = c.slice();
      d[p] -= 2;
      let ok = true;
      for (let i = 0; i < NK && ok; i++) {
        while (d[i] > 0) {
          if (!isNum(i) || i % 9 > 6 || !d[i + 1] || !d[i + 2]) { ok = false; break; }
          d[i]--; d[i + 1]--; d[i + 2]--;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the CPU friends' brains

  // levels: slip = how often a throw is a so-so one; pung / chow = how often a helpful claim is taken
  const LEVELS = {
    easy: { slip: 0.3, pung: 0.45, chow: 0.2 },
    normal: { slip: 0.08, pung: 1, chow: 1 },
    best: { slip: 0, pung: 1, chow: 1 },
  };

  // every kind seat s could throw (after its draw), with how far from winning it would be (s) and how many unseen
  // tiles would bring it nearer (u)
  function analyse(R, s, c = counts(R, s), m = R.melds[s].length) {
    const u = unseen(R, s);
    const res = [];
    for (let k = 0; k < NK; k++) {
      if (!c[k]) continue;
      c[k]--;
      res.push({ k, s: shanten(c, m), u: 0 });
      c[k]++;
    }
    const min = Math.min(...res.map((r) => r.s));
    for (const r of res) {
      if (r.s > min + 1) { r.u = -1; continue; }
      c[r.k]--;
      let n = 0;
      for (let j = 0; j < NK; j++) {
        if (!u[j]) continue;
        c[j]++;
        if (shanten(c, m) < r.s) n += u[j];
        c[j]--;
      }
      c[r.k]++;
      r.u = n;
    }
    // best first: nearest a win, then the most tiles that help, then lonely honours and ends (1s and 9s) first
    const lonely = (k) => (isNum(k) ? Math.min(k % 9, 8 - (k % 9)) : -1);
    res.sort((a, b) => a.s - b.s || b.u - a.u || lonely(a.k) - lonely(b.k) || b.k - a.k);
    return res;
  }

  // the best tile for seat s to throw (the one your brother makes glow): an id from the hand
  function bestThrow(R, s) {
    const res = analyse(R, s);
    return idOfKind(R, s, res[0].k);
  }
  // a CPU friend's throw at `level`
  function cpuThrow(R, s, level = 'normal', r = R.rng) {
    const L = LEVELS[level] || LEVELS.normal;
    const res = analyse(R, s);
    let k = res[0].k;
    if (r() < L.slip) {
      const ok = res.filter((x) => x.s <= res[0].s + 1);
      k = ok[Math.floor(r() * ok.length)].k;
    }
    return idOfKind(R, s, k);
  }
  function idOfKind(R, s, k) {
    const h = R.hands[s];
    // the drawn tile first if it's that kind (so the hand doesn't shuffle about), else the last one of the kind
    if (R.drawn >= 0 && R.KIND[R.drawn] === k && h.includes(R.drawn)) return R.drawn;
    for (let i = h.length - 1; i >= 0; i--) if (R.KIND[h[i]] === k) return h[i];
    return h[h.length - 1];
  }

  // what seat s would do with the thrown tile at `level`: { type, ix } or null. A win is always taken; a pung or chow
  // when it brings the hand nearer a win (at EASY, only sometimes).
  function cpuClaim(R, s, level = 'normal', r = R.rng) {
    const o = options(R, s);
    if (!anyOption(o)) return null;
    if (o.win) return { type: 'win' };
    const L = LEVELS[level] || LEVELS.normal;
    const c = counts(R, s), m = R.melds[s].length;
    const now = shanten(c, m);
    const after = (need) => {
      const d = c.slice();
      for (const k of need) d[k]--;
      let best = 9;
      for (let k = 0; k < NK; k++) {
        if (!d[k]) continue;
        d[k]--;
        best = Math.min(best, shanten(d, m + 1));
        d[k]++;
      }
      return best;
    };
    if (o.pung && after([o.k, o.k]) < now && r() < L.pung) return { type: 'pung' };
    let bestIx = -1, bestS = now;
    o.chows.forEach((ch, i) => {
      const a = after(ch);
      if (a < bestS) { bestS = a; bestIx = i; }
    });
    if (bestIx >= 0 && r() < L.chow) return { type: 'chow', ix: bestIx };
    return null;
  }

  // ---------------------------------------------------------------- a game with nobody at the table

  // Play R to the end, every seat a CPU at levels[s]. Returns R. maxSteps guards against a round that never ends.
  function autoPlay(R, levels = ['normal', 'normal', 'normal', 'normal'], r = R.rng, maxSteps = 3000, onStep = null) {
    let steps = 0;
    while (R.phase !== 'over' && steps++ < maxSteps) {
      autoStep(R, levels, r);
      if (onStep) onStep(R);
    }
    return R;
  }
  // one step: a draw, a throw (or a win), or everybody's claims
  function autoStep(R, levels, r = R.rng) {
    if (R.phase === 'draw') draw(R);
    else if (R.phase === 'discard') {
      const s = R.turn;
      if (canSelfWin(R, s)) selfWin(R, s);
      else discard(R, s, cpuThrow(R, s, levels[s], r));
    } else if (R.phase === 'claim') {
      const dec = [null, null, null, null];
      for (let s = 0; s < 4; s++) if (s !== R.last.from) dec[s] = cpuClaim(R, s, levels[s], r);
      resolve(R, dec);
    }
  }

  MJ.rules = {
    NK, ALL, isNum, suitOf, rankOf, nameOf, SAB, rng, shuffle,
    isWin, allSets, shanten, waits, chowOptions,
    newRound, sortHand, counts, unseen, draw, canSelfWin, selfWin, discard, options, anyOption, claim, pass, resolve,
    score, LEVELS, analyse, bestThrow, cpuThrow, cpuClaim, autoPlay, autoStep,
    // every tile is somewhere, exactly once: the wall, a hand, a pond or a shown set
    tally(R) {
      const seen = new Array(R.KIND.length).fill(0);
      R.wall.forEach((id) => seen[id]++);
      for (let s = 0; s < 4; s++) {
        R.hands[s].forEach((id) => seen[id]++);
        R.ponds[s].forEach((id) => seen[id]++);
        for (const m of R.melds[s]) m.ids.forEach((id) => seen[id]++);
      }
      return seen;
    },
  };
})();
