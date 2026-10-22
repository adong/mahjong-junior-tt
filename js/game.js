/* TT Mahjong Junior: the menu, the round, the HUD, input and the main loop.
   Screens: home (1 or 2 players, Teddy or Tommy, the level; the story card), play, pause and the result. The title
   plays a quiet round by itself on the table behind the menu.
   - 1 PLAYER: you (bottom) against 🦊 Foxy (right), 🐼 Panda (top) and 🐸 Froggy (left).
   - 2 PLAYERS: Teddy (bottom) and Tommy (top, his tiles facing up too) with Foxy and Froggy.
   - 🐣 EASY (the default, for Tommy, 5): the friends make mistakes and rarely take tiles, the kids' hands are sorted into
     sets, pairs and loose tiles with little lines under the sets, tiles have their number in the corner, a picked tile
     says its name, and the kids get a lucky draw now and then (js/rules.js). 🔥 NORMAL (for Teddy, 8): real play.
   A round: everybody gets 13 tiles; on your turn a tile slides into your hand, you tap a tile and tap it again to
   throw it. When a tile is thrown, the buttons show what you can do with it (CHOW, PUNG, HÚ or PASS). Win with four
   sets and a pair: the winner's points go on the scoreboard and PLAY AGAIN deals the next round (the dealer, east,
   moves round). Your brother (js/buddy.js) shows you the best tile to throw.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const MJ = window.MJ;
  const RL = MJ.rules;
  const ST = MJ.stage;
  const S = Kit.sound;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'mahjongJuniorTT.v1';
  const ZCH = 1.4; // the boys stand this far in front of the table
  const TILT = 0.16; // and lean back a little, so we see them a bit from above
  const FRIENDS = { foxy: '🦊', panda: '🐼', froggy: '🐸' };
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY', panda: 'PANDA', froggy: 'FROGGY' };
  const LUCK = { easy: 0.4, normal: 0.1 }; // how often a kid's draw is a helpful one (see rules.draw)
  const THINK = { easy: [0.75, 1.1], normal: [0.5, 0.85], demo: [0.55, 0.85] }; // a friend's thinking time (s)
  const SHOW = { easy: 0.85, normal: 0.6, demo: 0.6 }; // how long a thrown tile waits on the disc
  const RANK = { win: 3, pung: 2, chow: 1 };
  const WIND_EN = 'ESWN', WIND_ZH = '东南西北';

  const prefs = Object.assign(
    { mode: 'solo', who: 'teddy', levels: { teddy: 'easy', tommy: 'easy', two: 'easy' }, wins: { teddy: 0, tommy: 0 }, taps: 0, storySeen: false },
    load(),
  );
  const G = {
    state: 'boot', mode: 'solo', who: 'teddy', diff: 'easy', seats: [], R: null, dealer: 0, round: 0, totals: [0, 0, 0, 0],
    sel: {}, wait: null, hint: -1, lastThrown: -1, timers: [], gen: 0, held: false, last: 0, wide: true, result: null,
    pausedFrom: null, story: -1, demo: false, L: null, ready: {}, keyboard: false, statusFn: null, claimBtns: [], dec: null,
  };
  const boys = { teddy: MJ.makeActor(), tommy: MJ.makeActor() };
  const tags = {};
  let ui = null, flyers = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }
  const ctxKey = () => (prefs.mode === 'two' ? 'two' : prefs.who);
  const diffNow = () => prefs.levels[ctxKey()] || 'easy';
  const zh = () => Kit.lang.is('zh');
  // a tile's name, in English: js/zh.js says every one in 中文 (and in the sentences they're in)
  const tileName = (id) => RL.nameOf(G.R.KIND[id], false);

  // ---------------------------------------------------------------- who's at the table

  function makeSeats(mode, who, diff) {
    const cpu = (id) => ({ id, name: NAMES[id], human: false, emoji: FRIENDS[id], level: diff });
    const kid = (id) => ({ id, name: NAMES[id], human: true, actor: boys[id] });
    if (mode === 'two') return [kid('teddy'), cpu('foxy'), kid('tommy'), cpu('froggy')];
    return [kid(who), cpu('foxy'), cpu('panda'), cpu('froggy')];
  }
  // the seats a kid sits in (none on the title: the title's round plays itself)
  const kidSeats = () => (G.demo ? [] : G.seats.map((s, i) => (s.human ? i : -1)).filter((i) => i >= 0));
  const isKid = (s) => !G.demo && !!G.seats[s] && G.seats[s].human;
  const levelOf = (s) => (G.demo ? 'normal' : G.seats[s].level || 'normal');
  // the hands shown face up and big: the kids' (the title shows seat 0's)
  const faceUp = () => (G.demo ? [0] : kidSeats());

  // ---------------------------------------------------------------- layout

  function area() {
    const W = ST.W, H = ST.H;
    if (G.state === 'home' || G.state === 'boot') return G.wide ? { x: 0, y: 0, w: W * 0.53, h: H } : { x: 0, y: 0, w: W, h: H * 0.42 };
    return { x: 0, y: 0, w: W, h: H };
  }

  function layout() {
    ST.resize();
    MJ.fx.overlay.resize();
    G.wide = ST.W / ST.H >= 0.82;
    document.body.dataset.tall = G.wide ? '0' : '1';
    relayout();
  }

  function relayout() {
    const R = G.R;
    if (!R) return;
    const home = G.state === 'home' || G.state === 'boot';
    const hudH = home ? 0 : Math.max(44, ui.hudtop.getBoundingClientRect().bottom);
    const callW = home ? 0 : (ui.callBtn.getBoundingClientRect().width || 90) + 14;
    const A = area();
    const L = MJ.layout({
      W: ST.W, H: ST.H, area: A, R, humans: faceUp(), easy: G.diff === 'easy' && !G.demo, sel: G.sel, hudH, callW,
      reveal: R.phase === 'over', tall: home && A.w / A.h < 1.05 ? true : null, // the title: the hand big, in two rows
    });
    G.L = L;
    ST.setTable(L.table, L.rim);
    ST.compass({ x: L.compass.x, y: L.compass.y, r: L.compass.r, turn: R.phase === 'over' && R.winner >= 0 ? R.winner : R.turn, dealer: R.dealer, left: R.wall.length });
    const from = { x: L.compass.x, y: L.compass.y };
    const shown = new Set();
    for (const [id, tg] of L.tiles) {
      ST.to(id, Object.assign({ from }, tg));
      shown.add(id);
    }
    for (let id = 0; id < R.KIND.length; id++) if (!shown.has(id)) ST.hide(id);
    ST.bars(L.bars);
    const inPond = (id) => R.ponds.some((p) => p.includes(id));
    ST.glow('last', R.phase === 'claim' && R.last ? R.last.id : G.lastThrown >= 0 && inPond(G.lastThrown) ? G.lastThrown : -1);
    ST.glow('hint', G.hint);
    ST.glow('win', R.phase === 'over' && R.winner >= 0 ? R.winTile : -1);
    const sel = Object.values(G.sel).find((x) => x >= 0);
    ST.glow('pick', sel === undefined ? -1 : sel);
    placeSeats();
    placeActors();
    placeClaims();
  }

  // the seat badges: face, name, points, wind; a gold ring for whose turn it is
  function placeSeats() {
    const R = G.R, L = G.L;
    for (let s = 0; s < 4; s++) {
      const el = ui.seats[s], seat = G.seats[s];
      const b = L.badges[s];
      const show = !!seat && !!b && !G.demo && G.state !== 'boot';
      el.classList.toggle('gone', !show);
      if (!show) continue;
      el.style.left = `${b.x}px`;
      el.style.top = `${b.y}px`;
      const tf = { center: 'translate(-50%, -50%)', leftTop: 'translate(0, 0)', rightTop: 'translate(-100%, 0)' }[b.align] || 'translate(0, -50%)';
      el.style.transform = tf;
      el.classList.toggle('human', !!seat.human);
      el.classList.toggle('turn', R.phase !== 'over' && R.phase !== 'claim' && R.turn === s && G.state !== 'boot');
      el.querySelector('.pts').textContent = `⭐ ${G.totals[s]}`;
      const w = (s - R.dealer + 4) % 4;
      const wind = el.querySelector('.wind');
      wind.textContent = zh() ? WIND_ZH[w] : WIND_EN[w];
      wind.classList.toggle('east', w === 0);
    }
  }
  function fillSeats() {
    for (let s = 0; s < 4; s++) {
      const el = ui.seats[s], seat = G.seats[s];
      el.classList.remove('won');
      if (!seat) continue;
      const face = el.querySelector('.face');
      face.innerHTML = seat.human || seat.id === 'teddy' || seat.id === 'tommy' ? `<img alt="" src="${art[seat.id]}">` : seat.emoji;
      el.querySelector('.nm').textContent = seat.name;
    }
  }

  // a spot in pixels -> where a boy stands in the world, and his scale (a boy is about 2.1 tall)
  function spotWorld(sp) {
    const p = ST.toWorld(sp.x, sp.feet, ZCH);
    return { x: p.x, y: p.y, z: ZCH, scale: (sp.h * ST.kAt(ZCH)) / 2.1 };
  }
  function placeActors() {
    const L = G.L;
    if (!L) return;
    const show = new Set();
    const put = (actor, sp) => {
      if (!sp) return;
      tags[actor === boys.teddy ? 'teddy' : 'tommy'].visible = G.demo;
      const w = spotWorld(sp);
      if (!MJ.highFive.on) actor.place(w.x, w.y, w.z);
      actor.setScale(w.scale);
      actor.visible = true;
      show.add(actor);
    };
    if (G.demo) {
      if (prefs.mode === 'two') {
        put(boys.teddy, L.actors[0]);
        put(boys.tommy, L.buddy && { x: L.buddy.x, feet: L.actors[0].feet, h: L.actors[0].h * 0.92 });
      } else put(boys[prefs.who], L.actors[0]);
    } else {
      for (const s of kidSeats()) put(G.seats[s].actor, L.actors[s]);
    }
    for (const a of [boys.teddy, boys.tommy]) if (!show.has(a) && !(MJ.buddy.on && MJ.buddy.actor === a)) a.visible = false;
    MJ.buddy.relayout();
  }
  const actorScale = () => (G.L && G.L.actors[0] ? spotWorld(G.L.actors[0]).scale : 1);

  // ---------------------------------------------------------------- timers

  function after(secs, fn) {
    G.timers.push({ t: secs, fn, gen: G.gen });
  }
  function runTimers(dt) {
    const due = [];
    for (const tm of G.timers) {
      tm.t -= dt;
      if (tm.t <= 0) due.push(tm);
    }
    if (!due.length) return;
    G.timers = G.timers.filter((tm) => tm.t > 0);
    for (const tm of due) if (tm.gen === G.gen) tm.fn();
  }
  const think = (s) => {
    const [a, b] = THINK[G.demo ? 'demo' : levelOf(s)] || THINK.normal;
    return rand(a, b);
  };
  const showTime = () => SHOW[G.demo ? 'demo' : G.diff];

  // ---------------------------------------------------------------- a game

  // From the menu (or the test hook): opts { mode, who, level, seed }
  function startGame(opts = {}) {
    if (opts.mode) prefs.mode = opts.mode;
    if (opts.who) prefs.who = opts.who;
    if (opts.level) prefs.levels[ctxKey()] = opts.level;
    save();
    MJ.highFive.cancel();
    MJ.buddy.dismiss();
    G.gen++;
    G.timers = [];
    G.demo = false;
    G.mode = prefs.mode;
    G.who = prefs.who;
    G.diff = diffNow();
    G.seats = makeSeats(G.mode, G.who, G.diff);
    G.totals = [0, 0, 0, 0];
    G.round = 0;
    G.dealer = 0;
    hideOverlays();
    G.state = 'play';
    screen('play');
    fillSeats();
    if (G.mode !== 'two') MJ.buddy.setFor(G.who);
    syncCallButton();
    for (const s of kidSeats()) G.seats[s].actor.react('hello');
    ST.setFaces({ zh: zh(), index: G.diff === 'easy' });
    S.music('play');
    newRound(opts.seed);
    if (!prefs.storySeen && !opts.seed) {
      prefs.storySeen = true;
      save();
      after(0.4, () => openStory(true));
    }
  }

  function newRound(seed) {
    G.gen++;
    G.timers = [];
    const luck = G.seats.map((s) => (s.human && !G.demo ? LUCK[G.diff] : 0));
    G.R = RL.newRound({ seed: seed || Math.floor(Math.random() * 2 ** 31) + 1, dealer: G.dealer, luck });
    G.round++;
    G.sel = {};
    G.wait = null;
    G.hint = -1;
    G.lastThrown = -1;
    G.result = null;
    G.ready = {};
    hideClaims();
    for (const el of ui.seats) el.classList.remove('won');
    ST.makeTiles(G.R.KIND);
    ST.hideAll();
    if (!G.demo) {
      G.state = 'play';
      for (const s of kidSeats()) G.seats[s].actor.react('idle');
      ui.roundInfo.textContent = `ROUND ${G.round}`;
      setStatus(() => `${G.seats[G.dealer].name} STARTS!`);
    }
    MJ.sfx.wash();
    relayout();
    after(G.demo ? 1.2 : 1.1, doDraw);
  }

  // the turn seat draws a tile (or the wall is empty: a draw)
  function doDraw() {
    const R = G.R;
    if (R.phase !== 'draw') return;
    RL.draw(R);
    if (R.phase === 'over') return finish();
    MJ.sfx.draw();
    const s = R.turn;
    relayout();
    if (isKid(s)) waitThrow(s);
    else {
      if (!G.demo) setStatus(() => `${G.seats[s].name} IS THINKING...`);
      after(think(s), cpuAct);
    }
  }

  // a CPU friend wins or throws
  function cpuAct() {
    const R = G.R, s = R.turn;
    if (R.phase !== 'discard' || isKid(s)) return;
    if (RL.canSelfWin(R, s)) {
      RL.selfWin(R, s);
      return finish();
    }
    doThrow(s, RL.cpuThrow(R, s, levelOf(s)));
  }

  function doThrow(s, id) {
    const R = G.R;
    RL.discard(R, s, id);
    G.lastThrown = id;
    G.sel[s] = -1;
    if (G.hint >= 0) G.hint = -1;
    MJ.sfx.clack(R.throws);
    relayout();
    if (!G.demo && isKid(s) && G.diff === 'easy') checkReady(s);
    if (!G.demo && !isKid(s)) setStatus(() => `${G.seats[s].name}: ${tileName(id)}`);
    after(showTime(), doClaims);
  }

  // 🐣 EASY: a kid's hand is one tile from a win: say so (once per wait)
  function checkReady(s) {
    const R = G.R;
    const w = RL.waits(RL.counts(R, s), R.melds[s].length);
    const key = w.join(',');
    if (w.length && G.ready[s] !== key) {
      G.ready[s] = key;
      toast('ONE TILE TO WIN!', 'learn');
      MJ.sfx.ready();
    }
  }

  // everybody decides about the thrown tile: the friends at once, the kids with the buttons
  function doClaims() {
    const R = G.R;
    if (R.phase !== 'claim') return;
    const from = R.last.from;
    const dec = [null, null, null, null];
    let cpuBest = 0, cpuWinner = -1;
    const order = [1, 2, 3].map((d) => (from + d) % 4);
    for (const s of order) {
      if (isKid(s)) continue;
      dec[s] = RL.cpuClaim(R, s, levelOf(s));
      if (dec[s] && RANK[dec[s].type] > cpuBest) cpuBest = RANK[dec[s].type];
      if (dec[s] && dec[s].type === 'win' && cpuWinner < 0) cpuWinner = s;
    }
    // ask the kids who could do better than the friends (in turn order)
    const ask = [];
    for (const s of order) {
      if (!isKid(s)) continue;
      const o = RL.options(R, s);
      if (!RL.anyOption(o)) continue;
      const best = o.win ? 3 : o.pung ? 2 : 1;
      const nearer = cpuWinner < 0 || order.indexOf(s) < order.indexOf(cpuWinner);
      if (best > cpuBest || (best === 3 && nearer)) ask.push({ s, o });
    }
    G.dec = dec;
    G.ask = ask;
    nextAsk();
  }
  function nextAsk() {
    const q = G.ask.shift();
    if (!q) return resolveClaims();
    G.wait = { kind: 'claim', seat: q.s, o: q.o };
    const R = G.R, from = R.last.from;
    const offer = `TAKE ${G.seats[from].name}'S ${tileName(R.last.id)}?`;
    setStatus(() => (G.mode === 'two' ? `${G.seats[q.s].name}: ${offer}` : offer), true);
    showClaims(q.s, q.o, false);
    MJ.sfx.offer();
  }
  // a kid's choice on the claim buttons: { type, ix } or null (pass)
  function choose(c) {
    const w = G.wait;
    if (!w) return;
    hideClaims();
    G.wait = null;
    if (w.kind === 'throw') {
      // the only button in your own turn is HÚ
      if (c && c.type === 'win' && RL.canSelfWin(G.R, w.seat)) {
        RL.selfWin(G.R, w.seat);
        finish();
      }
      return;
    }
    if (c) G.dec[w.seat] = c;
    else MJ.sfx.pass();
    nextAsk();
  }

  function resolveClaims() {
    const R = G.R;
    hideClaims();
    G.wait = null;
    const res = RL.resolve(R, G.dec);
    if (!res) {
      relayout();
      after(0.3, doDraw);
      return;
    }
    const s = res.s;
    if (!G.demo) callout(s, res.type === 'win' ? 'HÚ!' : res.type === 'pung' ? 'PUNG!' : 'CHOW!');
    if (res.type === 'win') return finish();
    MJ.sfx[res.type]();
    if (isKid(s)) {
      G.seats[s].actor.react('cheer');
      MJ.buddy.cheer();
      if (G.diff === 'easy') toast(res.type === 'pung' ? 'A PUNG: THREE THE SAME!' : 'A CHOW: THREE IN A ROW!', 'learn');
    }
    relayout();
    if (isKid(s)) after(0.45, () => waitThrow(s));
    else after(think(s), cpuAct);
  }

  // a kid's turn to throw (after a draw, or after taking a tile)
  function waitThrow(s) {
    const R = G.R;
    G.wait = { kind: 'throw', seat: s };
    G.sel[s] = -1;
    const two = G.mode === 'two';
    setStatus(() => (two ? `${G.seats[s].name}'S TURN! THROW A TILE.` : 'YOUR TURN! THROW A TILE.'), true);
    if (RL.canSelfWin(R, s)) {
      showClaims(s, { win: true, pung: false, chows: [] }, true);
      toast('YOU CAN WIN! TAP HÚ!', 'save');
      MJ.sfx.offer();
    } else hideClaims();
    relayout();
  }

  // tap a tile in a kid's hand: the first tap picks it up, the second throws it
  function tapTile(id) {
    const w = G.wait;
    if (!w || w.kind !== 'throw') return 'not your turn';
    const s = w.seat;
    if (!G.R.hands[s].includes(id)) return 'not in the hand';
    if (G.sel[s] === id) {
      if (prefs.taps < 5) {
        prefs.taps++;
        save();
      }
      return throwTile(s, id);
    }
    G.sel[s] = id;
    MJ.sfx.pick();
    relayout();
    if (G.diff === 'easy') toast(tileName(id), 'name');
    if (prefs.taps < 3 && !G.keyboard) toast('TAP IT AGAIN TO THROW IT!', 'learn');
    return 'picked';
  }
  function throwTile(s, id) {
    const w = G.wait;
    if (!w || w.kind !== 'throw' || w.seat !== s) return 'not your turn';
    hideClaims();
    G.wait = null;
    if (id === G.hint) MJ.buddy.cheer();
    G.hint = -1;
    doThrow(s, id);
    return 'thrown';
  }

  // the round is over: a win, or the wall ran out
  function finish() {
    const R = G.R;
    G.wait = null;
    hideClaims();
    G.hint = -1;
    G.sel = {};
    if (G.demo) {
      relayout();
      after(3, () => newRound());
      return;
    }
    G.state = 'over';
    relayout();
    const sc = RL.score(R);
    G.result = { winner: R.winner, by: R.winBy, from: R.from, score: sc };
    for (const el of ui.seats) el.classList.remove('turn');
    if (R.winner >= 0) {
      G.totals[R.winner] += sc.total;
      const seat = G.seats[R.winner];
      if (R.winBy === 'self') callout(R.winner, 'HÚ!');
      if (seat.human) {
        prefs.wins[seat.id] = (prefs.wins[seat.id] || 0) + 1;
        save();
        seat.actor.react('over');
        for (const s of kidSeats()) if (s !== R.winner) G.seats[s].actor.react('cheer');
        MJ.sfx.win();
        const p = ST.toScreen(seat.actor.root.position);
        MJ.fx.overlay.burst(p.x, p.y - 80, 40, ['🎉', '⭐', '🀫'], 1.1);
        MJ.fx.overlay.rain(110);
      } else {
        ui.seats[R.winner].classList.add('won');
        for (const s of kidSeats()) G.seats[s].actor.react('sulk');
        MJ.sfx.lose();
      }
    } else {
      for (const s of kidSeats()) G.seats[s].actor.react('shrug');
      MJ.sfx.lose();
    }
    placeSeats();
    setStatus(() => (R.winner >= 0 ? `${G.seats[R.winner].name} WINS!` : "IT'S A DRAW!"));
    S.music('over');
    after(R.winner >= 0 && G.seats[R.winner].human ? 2.6 : 2.0, showResult);
  }

  function showResult() {
    const R = G.R, res = G.result;
    if (!res || G.state !== 'over') return;
    const face = (s) => {
      const seat = G.seats[s];
      return seat.human ? `<img class="${seat.id}" alt="" src="${art[seat.id]}">` : `<span class="emoface">${seat.emoji}</span>`;
    };
    if (res.winner >= 0) {
      const seat = G.seats[res.winner];
      ui.oFace.innerHTML = face(res.winner);
      ui.oTitle.textContent = `${seat.name} WINS!`;
      ui.oSub.textContent = res.by === 'self' ? 'HÚ! A WINNING TILE FROM THE WALL!' : `HÚ! WITH ${G.seats[res.from].name}'S ${tileName(R.winTile)}!`;
      ui.oHand.innerHTML = handHTML(res.winner);
      ui.oPts.innerHTML = res.score.items.map(([what, n]) => `<span>${what} +${n}</span>`).join('') + `<span class="total">⭐ ${res.score.total}</span>`;
    } else {
      ui.oFace.innerHTML = kidSeats().map(face).join('');
      ui.oTitle.textContent = "IT'S A DRAW!";
      ui.oSub.textContent = 'THE WALL RAN OUT OF TILES. NOBODY WON THIS TIME.';
      ui.oHand.innerHTML = '';
      ui.oPts.innerHTML = '';
    }
    ui.oTable.innerHTML = G.seats.map((seat, s) => `<span class="row${s === res.winner ? ' win' : ''}">${seat.human ? `<img alt="" src="${art[seat.id]}">` : `<span class="e">${seat.emoji}</span>`}⭐ ${G.totals[s]}</span>`).join('');
    show(ui.gameOver, true);
  }
  // the winning hand as pictures: its sets apart (shown sets on a little green mat), the winning tile ringed
  function handHTML(s) {
    const R = G.R;
    const img = (id) => `<img alt="" src="${ST.faceURL(R.KIND[id])}"${id === R.winTile ? ' class="last"' : ''}>`;
    const c = RL.counts(R, s);
    const g = RL.groups(c);
    const left = R.hands[s].slice();
    // the winning tile goes into the first group of its kind (so its ring shows)
    const take = (k) => {
      let i = R.KIND[R.winTile] === k ? left.indexOf(R.winTile) : -1;
      if (i < 0) i = left.findIndex((id) => R.KIND[id] === k);
      return left.splice(i, 1)[0];
    };
    const groups = [...g.sets, ...g.pairs].map((grp) => grp.map(take));
    let html = groups.map((grp) => `<span class="grp">${grp.map(img).join('')}</span>`).join('');
    html += R.melds[s].map((m) => `<span class="grp shown">${m.ids.map(img).join('')}</span>`).join('');
    if (left.length) html += `<span class="grp">${left.map(img).join('')}</span>`;
    return html;
  }

  function again() {
    if (!G.seats.length || G.demo) return;
    MJ.highFive.cancel();
    hideOverlays();
    G.state = 'play';
    G.dealer = (G.dealer + 1) % 4;
    S.music('play');
    for (const s of kidSeats()) G.seats[s].actor.react('idle');
    newRound();
  }
  // pause → 🔄: the same round again from the deal (same dealer, a new deal, no points)
  function redeal() {
    if (!G.seats.length || G.demo) return;
    hideOverlays();
    G.state = 'play';
    S.music('play');
    G.round--;
    newRound();
  }

  // ---------------------------------------------------------------- the claim buttons

  const tileImg = (k) => `<img alt="" src="${ST.faceURL(k)}">`;
  function showClaims(s, o, self) {
    const box = ui.claims;
    box.innerHTML = '';
    G.claimBtns = [];
    let n = 1;
    const add = (cls, html, c, key) => {
      const b = document.createElement('button');
      b.className = `claimbtn ${cls}`;
      b.innerHTML = `<kbd>${key || n++}</kbd>${html}`;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        choose(c);
      });
      box.appendChild(b);
      G.claimBtns.push({ el: b, c, cls });
    };
    if (o.win) add('win', '<span>HÚ!</span><small>I WIN!</small>', { type: 'win' });
    if (!self && o.pung) add('pung', `<span class="tiles">${tileImg(o.k).repeat(3)}</span><span>PUNG</span>`, { type: 'pung' });
    if (!self) {
      o.chows.forEach((ch, ix) => {
        const ks = [ch[0], ch[1], o.k].sort((a, b) => a - b);
        add('chow', `<span class="tiles">${ks.map(tileImg).join('')}</span><span>CHOW</span>`, { type: 'chow', ix });
      });
      add('pass', '<span>PASS</span>', null, 'X');
    }
    box.classList.remove('gone');
    box.dataset.seat = s;
    placeClaims();
  }
  function hideClaims() {
    ui.claims.classList.add('gone');
    ui.claims.innerHTML = '';
    G.claimBtns = [];
  }
  function placeClaims() {
    if (ui.claims.classList.contains('gone') || !G.L) return;
    const c = G.L.claim[+ui.claims.dataset.seat];
    if (!c) return;
    ui.claims.style.left = `${c.x}px`;
    ui.claims.style.top = `${c.y}px`;
    ui.claims.classList.toggle('below', c.anchor === 'top');
  }
  function claimKey(k) {
    if (!G.claimBtns.length) return false;
    if (k === 'x') {
      const p = G.claimBtns.find((b) => b.cls === 'pass');
      if (p) choose(null);
      return !!p;
    }
    if (k === 'h') {
      const w = G.claimBtns.find((b) => b.cls === 'win');
      if (w) choose(w.c);
      return !!w;
    }
    const i = +k - 1;
    const real = G.claimBtns.filter((b) => b.cls !== 'pass');
    if (i >= 0 && i < real.length) {
      choose(real[i].c);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- your brother, the high five

  const buddyApi = {
    flyers: null,
    tilt: TILT,
    scale: () => actorScale(),
    spot() {
      const w = spotWorld(G.L.buddy);
      return { x: w.x, y: w.y, z: ZCH + 0.3 };
    },
    player: () => G.seats[kidSeats()[0]].actor,
    // 2 players: the high five
    players: () => kidSeats().map((s) => G.seats[s].actor),
    meet() {
      const [a, c] = kidSeats().map((s) => G.seats[s].actor.root.position);
      const mid = (a.x + c.x) / 2, gap = 0.55 * actorScale();
      return [{ x: mid - gap, z: a.z }, { x: mid + gap, z: c.z }];
    },
    homes: () => kidSeats().map((s) => spotWorld(G.L.actors[s])),
    toast: (text, cls) => toast(text, cls),
    over: () => G.state !== 'play',
    // he helps when it's your turn to throw, or a tile is on offer to you
    canPeek: () => G.state === 'play' && !!G.wait && G.wait.seat === kidSeats()[0],
    peek() {
      const R = G.R, s = G.wait.seat;
      let say, at = null;
      if (G.wait.kind === 'throw') {
        if (RL.canSelfWin(R, s)) {
          say = 'SAY HÚ! YOU WIN!';
          hintButton('win');
        } else {
          const id = RL.bestThrow(R, s);
          G.hint = id;
          relayout();
          at = ST.tile(id).px;
          say = `THROW THE ${tileName(id)}!`;
        }
      } else {
        const c = RL.cpuClaim(R, s, 'best');
        if (!c) {
          say = 'PASS THIS ONE!';
          hintButton('pass');
        } else if (c.type === 'win') {
          say = 'SAY HÚ! YOU WIN!';
          hintButton('win');
        } else {
          say = c.type === 'pung' ? 'TAKE IT! PUNG!' : 'TAKE IT! CHOW!';
          hintButton(c.type, c.ix);
        }
      }
      const me = ST.toScreen(MJ.buddy.actor.root.position);
      return { say, dx: at ? at.x - me.x : 0 };
    },
  };
  function hintButton(cls, ix = 0) {
    const list = G.claimBtns.filter((b) => b.cls === cls);
    const b = list[Math.min(ix, list.length - 1)];
    if (b) b.el.classList.add('hint');
  }
  // T, or the face button: call your brother (1 player) or a high five (2 players)
  function call() {
    if (G.state !== 'play' && G.state !== 'over') return 'not now';
    if (G.mode === 'two') return MJ.highFive.start();
    if (G.state !== 'play') return 'not now';
    return MJ.buddy.call();
  }
  function syncCallButton() {
    if (G.mode === 'two') {
      ui.callFace.style.display = 'none';
      ui.callEmoji.textContent = '🙌';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    } else {
      const b = Kit.roster.buddyFor(G.who);
      ui.callFace.style.display = '';
      ui.callFace.src = art[b];
      ui.callEmoji.textContent = '';
      ui.callBtn.title = 'Call your brother (T)';
      ui.callBtn.setAttribute('aria-label', 'Call your brother');
    }
  }

  // ---------------------------------------------------------------- the title's round

  function demoStart() {
    G.demo = true;
    G.seats = makeSeats('solo', prefs.mode === 'two' ? 'teddy' : prefs.who, 'normal');
    G.diff = 'normal';
    G.dealer = Math.floor(Math.random() * 4);
    ST.setFaces({ zh: zh(), index: false });
    newRound();
  }

  // ---------------------------------------------------------------- screens

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }
  function hideOverlays() {
    show(ui.gameOver, false);
    show(ui.pause, false);
  }
  function screen(name) {
    document.body.dataset.screen = name;
    show(ui.home, name === 'home');
    show(ui.hud, name === 'play');
    show(ui.callBtn, name === 'play');
    if (name !== 'play') hideOverlays();
  }

  function goHome() {
    G.gen++;
    G.timers = [];
    MJ.highFive.cancel();
    MJ.buddy.dismiss();
    G.state = 'home';
    G.wait = null;
    hideClaims();
    screen('home');
    for (const a of [boys.teddy, boys.tommy]) a.react('idle');
    syncMenu();
    layout();
    demoStart();
    S.music('title');
  }

  function syncMenu() {
    const mark = (seg, v) => {
      for (const b of seg.children) {
        b.classList.toggle('on', b.dataset.v === v);
        b.setAttribute('aria-checked', b.dataset.v === v ? 'true' : 'false');
        b.setAttribute('role', 'radio');
      }
    };
    mark(ui.segMode, prefs.mode);
    mark(ui.segWho, prefs.who);
    mark(ui.segLevel, diffNow());
    ui.segWho.style.display = prefs.mode === 'two' ? 'none' : '';
    ui.duo.style.display = prefs.mode === 'two' ? '' : 'none';
    const friends = prefs.mode === 'two' ? ['foxy', 'froggy'] : ['foxy', 'panda', 'froggy'];
    ui.friends.innerHTML = `<span>WITH</span>${friends.map((f) => `<span class="f" title="${NAMES[f]}">${FRIENDS[f]}</span>`).join('')}`;
  }
  function setPref(k, v) {
    if (k === 'level') prefs.levels[ctxKey()] = v;
    else prefs[k] = v;
    save();
    syncMenu();
    if (k === 'who' || k === 'mode') {
      G.seats = makeSeats('solo', prefs.mode === 'two' ? 'teddy' : prefs.who, 'normal');
      fillSeats();
      relayout();
    }
    MJ.sfx.pick();
  }

  // ---------------------------------------------------------------- the story card

  const STORY = [
    { art: '🐦🀫🀫🀫🐦', text: 'Mahjong is a tile game from China, about 150 years old. Four players sit round a square table. Its name comes from the word for sparrow: mixing the tiles sounds like sparrows chattering!' },
    { art: '🪙🎋🦚🧭🐉', text: 'Three suits go from 1 to 9: DOTS (coins), BAMBOO (strings of coins, and the 1 is a bird) and CHARACTERS (WAN means ten thousand). Then the honours: four WINDS and three DRAGONS. Four of every tile, 136 in all!' },
    { art: '✋🀫🔁', text: 'On your turn, draw a tile and throw one away. Make sets of three: a PUNG is three the same, a CHOW is three in a row of one suit. Anyone can PUNG a thrown tile, but only the next player can CHOW it.' },
    { art: '🏆😊⭐', text: 'Four sets and a pair make 14 tiles. Then shout HÚ! That means "I win!" We play for points and smiles, never for money.' },
  ];
  function openStory(on) {
    if (on) {
      G.story = 0;
      drawStory();
      show(ui.story, true);
    } else {
      G.story = -1;
      show(ui.story, false);
    }
    MJ.sfx.pick();
  }
  function storyTurn(d) {
    const n = G.story + d;
    if (n < 0) return;
    if (n >= STORY.length) return openStory(false);
    G.story = n;
    drawStory();
    MJ.sfx.step();
  }
  function drawStory() {
    if (G.story < 0) return;
    const p = STORY[G.story];
    ui.sArt.textContent = p.art;
    ui.sText.textContent = p.text;
    ui.sDots.innerHTML = STORY.map((s, i) => `<i class="${i === G.story ? 'on' : ''}"></i>`).join('');
    ui.sPrev.style.visibility = G.story === 0 ? 'hidden' : 'visible';
  }

  // ---------------------------------------------------------------- HUD and toasts

  // the line at the top: what's happening (a function, so it can be said again in the other language)
  function setStatus(fn, you = false) {
    G.statusFn = fn;
    ui.status.textContent = fn ? fn() : '';
    ui.status.classList.toggle('you', you);
  }
  function toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    ui.toasts.appendChild(el);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    setTimeout(() => el.remove(), cls === 'save' ? 2900 : 2000);
  }
  // CHOW! PUNG! HÚ! over a seat's badge
  function callout(s, word) {
    const b = ui.seats[s].getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'callout';
    el.textContent = word;
    el.style.left = `${Math.min(ST.W - 80, Math.max(80, b.left + b.width / 2))}px`;
    el.style.top = `${Math.max(70, b.top - 10)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ---------------------------------------------------------------- input

  // the kid whose turn it is to throw: ← → move along his hand, Enter / Space throw
  function keyMove(d) {
    const w = G.wait;
    if (!w || w.kind !== 'throw' || !G.L.order || !G.L.order[w.seat]) return;
    G.keyboard = true;
    const order = G.L.order[w.seat];
    const R = G.R;
    let i = order.indexOf(G.sel[w.seat]);
    if (i < 0) i = R.drawn >= 0 && order.includes(R.drawn) ? order.indexOf(R.drawn) : order.length - 1;
    else i = (i + d + order.length) % order.length;
    G.sel[w.seat] = order[i];
    MJ.sfx.step();
    relayout();
    if (G.diff === 'easy') toast(tileName(order[i]), 'name');
  }
  function keyThrow() {
    const w = G.wait;
    if (!w || w.kind !== 'throw') return;
    G.keyboard = true;
    const id = G.sel[w.seat];
    if (id >= 0 && G.R.hands[w.seat].includes(id)) throwTile(w.seat, id);
    else keyMove(0);
  }

  function bindInput() {
    const firstGesture = () => S.init();
    addEventListener('pointerdown', firstGesture, { capture: true });
    addEventListener('keydown', firstGesture, { capture: true });

    ui.goPlay.addEventListener('click', () => startGame({}));
    ui.storyBtn.addEventListener('click', () => openStory(true));
    for (const [seg, k] of [[ui.segMode, 'mode'], [ui.segWho, 'who'], [ui.segLevel, 'level']]) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) setPref(k, b.dataset.v);
      });
    }
    ui.pauseBtn.addEventListener('click', () => pause(true));
    ui.muteBtn.addEventListener('click', toggleMute);
    ui.callBtn.addEventListener('click', call);
    ui.oAgain.addEventListener('click', again);
    ui.oHome.addEventListener('click', goHome);
    ui.pResume.addEventListener('click', () => pause(false));
    ui.pRestart.addEventListener('click', redeal);
    ui.pHome.addEventListener('click', goHome);
    ui.sPrev.addEventListener('click', () => storyTurn(-1));
    ui.sNext.addEventListener('click', () => storyTurn(1));
    ui.sClose.addEventListener('click', () => openStory(false));

    const handIds = () => {
      const w = G.wait;
      return w && w.kind === 'throw' ? G.R.hands[w.seat] : [];
    };
    ui.canvas.addEventListener('pointerdown', (e) => {
      if (G.state !== 'play' || !G.R) return;
      const id = ST.tileAt(e.clientX, e.clientY, handIds(), 6);
      if (id < 0) return;
      G.keyboard = false;
      tapTile(id);
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || G.state !== 'play' || !G.R) return;
      ui.canvas.style.cursor = ST.tileAt(e.clientX, e.clientY, handIds(), 6) >= 0 ? 'pointer' : '';
    });

    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (Kit.help && Kit.help.isOpen && Kit.help.isOpen()) return;
      const k = e.key.toLowerCase();
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (k === 'm') return toggleMute();
      if (G.story >= 0) {
        if (k === 'arrowright' || k === 'enter' || k === ' ') storyTurn(1);
        else if (k === 'arrowleft') storyTurn(-1);
        else if (k === 'escape' || k === 'b') openStory(false);
        return;
      }
      if (G.state === 'home') {
        if (k === 'enter' || k === ' ') startGame({});
        else if (k === '1') setPref('mode', 'solo');
        else if (k === '2') setPref('mode', 'two');
        else if (k === 'w') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'l') setPref('level', diffNow() === 'easy' ? 'normal' : 'easy');
        else if (k === 'b') openStory(true);
        return;
      }
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        return;
      }
      if (G.state === 'over') {
        if (k === 't') return call();
        if (ui.gameOver.classList.contains('hidden')) return;
        if (k === 'enter' || k === ' ') again();
        else if (k === 'escape') goHome();
        return;
      }
      if (G.state !== 'play') return;
      if (k === 'p' || k === 'escape') return pause(true);
      if (k === 't') return call();
      if (claimKey(k)) return;
      if (k === 'arrowleft' || k === 'arrowup') keyMove(-1);
      else if (k === 'arrowright' || k === 'arrowdown') keyMove(1);
      else if (k === 'enter' || k === ' ') keyThrow();
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
    Kit.lang.onChange(() => {
      ST.setFaces({ zh: zh(), index: G.diff === 'easy' && !G.demo });
      syncMenu();
      drawStory();
      if (G.statusFn) ui.status.textContent = G.statusFn();
      if (G.wait && G.claimBtns.length) {
        const w = G.wait;
        if (w.kind === 'claim') showClaims(w.seat, w.o, false);
        else showClaims(w.seat, { win: true, pung: false, chows: [] }, true);
      }
      relayout();
      if (G.state === 'over' && !ui.gameOver.classList.contains('hidden')) showResult();
    });
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'over')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.gameOver, false);
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      if (G.state === 'over' && G.result && G.timers.length === 0) show(ui.gameOver, true);
      S.music(G.state === 'over' ? 'over' : 'play');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  function step(dt, draw = true) {
    dt = Math.min(dt, 0.1);
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    // the story card (opened by itself the first time you play) holds the round until it's closed
    const running = G.state !== 'paused' && G.state !== 'boot' && !(G.story >= 0 && G.state === 'play');
    if (running) {
      runTimers(dt);
      ST.update(dt);
      flyers.update(dt);
      for (const a of [boys.teddy, boys.tommy]) if (a.visible) a.update(dt);
      MJ.buddy.update(dt);
      MJ.highFive.update(dt);
    }
    MJ.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', MJ.buddy.on || MJ.highFive.on);
    if (draw) ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    const ids = [
      'home', 'hud', 'logo', 'goPlay', 'storyBtn', 'segMode', 'segWho', 'segLevel', 'duo', 'duoA', 'duoB', 'friends',
      'pauseBtn', 'muteBtn', 'status', 'roundInfo', 'claims', 'callBtn', 'callFace', 'callEmoji', 'toasts',
      'gameOver', 'oFace', 'oTitle', 'oSub', 'oHand', 'oPts', 'oTable', 'oAgain', 'oHome', 'pause', 'pResume', 'pRestart', 'pHome',
      'story', 'sArt', 'sText', 'sDots', 'sPrev', 'sNext', 'sClose',
    ];
    ui = { canvas: $('game'), hudtop: document.querySelector('.hudtop') };
    for (const id of ids) ui[id] = $(id);
    ui.seats = [0, 1, 2, 3].map((s) => $(`seat${s}`));
    // the logo: "TT" small on top, the rest big
    const words = window.MJ_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    MJ.fx.overlay.init($('fx'));
    flyers = MJ.fx.flyers(ST.scene, 90);
    buddyApi.flyers = flyers;
    for (const id of ['teddy', 'tommy']) {
      boys[id].attach(ST.scene, flyers);
      boys[id].set(id, 1);
      boys[id].root.rotation.x = TILT;
      const tag = Kit.gfx.nameTag(NAMES[id], (Kit.roster.get(id) || {}).tag || '#2f7cf0');
      tag.position.y = 2.75;
      boys[id].person.root.add(tag);
      tags[id] = tag;
      boys[id].visible = false;
    }
    art = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });
    for (const b of ui.segWho.children) b.querySelector('img').src = art[b.dataset.v];
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    MJ.buddy.init(buddyApi);
    bindInput();
    goHome();
    fillSeats();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  function info() {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width ? { x0: Math.round(r.left), y0: Math.round(r.top), x1: Math.round(r.right), y1: Math.round(r.bottom) } : null;
    };
    const R = G.R;
    return {
      state: G.state, mode: G.mode, who: G.who, diff: G.diff, demo: G.demo, round: G.round, dealer: G.dealer, totals: G.totals.slice(),
      seats: G.seats.map((s) => s.id), phase: R && R.phase, turn: R && R.turn, wall: R && R.wall.length,
      hands: R && R.hands.map((h) => h.length), melds: R && R.melds.map((m) => m.length), ponds: R && R.ponds.map((p) => p.length),
      wait: G.wait && { kind: G.wait.kind, seat: G.wait.seat }, sel: Object.assign({}, G.sel), hint: G.hint,
      claims: G.claimBtns.map((b) => b.cls), result: G.result && { winner: G.result.winner, by: G.result.by, total: G.result.score && G.result.score.total },
      buddy: MJ.buddy.info(), story: G.story, status: ui.status.textContent,
      panel: !ui.gameOver.classList.contains('hidden') ? 'over' : !ui.pause.classList.contains('hidden') ? 'pause' : !ui.story.classList.contains('hidden') ? 'story' : null,
      tilePx: G.L ? Math.round(G.L.hw) : 0, pondPx: G.L ? Math.round(G.L.ps || 0) : 0, table: G.L && G.L.table,
      kitButtons: [rect($('kit-help-btn')), rect($('kit-lang-btn')), rect($('kit-sound-btn'))],
      callBtn: rect(ui.callBtn), hud: rect(ui.hudtop), claimBar: rect(ui.claims), seatBadges: ui.seats.map(rect),
      hand: G.L && G.L.order && G.L.order[0] ? G.L.order[0].map((id) => { const p = ST.tile(id).px; return { id, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w) }; }) : null,
    };
  }

  // the kid being waited on does what the best player would (a test helper): win, take, pass or throw the best tile
  function autoKid() {
    const w = G.wait, R = G.R;
    if (!w) return false;
    if (w.kind === 'throw') {
      if (RL.canSelfWin(R, w.seat)) choose({ type: 'win' });
      else throwTile(w.seat, RL.bestThrow(R, w.seat));
    } else choose(RL.cpuClaim(R, w.seat, 'best'));
    return true;
  }
  // play the round to its end (the kids by autoKid), `secs` of game time at most
  function autoRound(secs = 600) {
    for (let i = 0; i < secs * 4 && G.state === 'play'; i++) {
      if (G.wait) autoKid();
      window.game.step(0.25);
    }
    return info();
  }

  window.game = {
    // advance `secs` of game time in 1/60 s steps, drawing only the last (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60, i === n - 1);
      return info();
    },
    hold(on = true) { G.held = on; },
    // start({ mode: 'solo' | 'two', who: 'teddy' | 'tommy', level: 'easy' | 'normal', seed })
    start(opts = {}) {
      startGame(opts);
      return info();
    },
    home: () => goHome(),
    tap: (id) => tapTile(id),
    throwBest: () => (G.wait && G.wait.kind === 'throw' ? throwTile(G.wait.seat, RL.bestThrow(G.R, G.wait.seat)) : 'not now'),
    choose: (c) => choose(c),
    autoKid,
    autoRound,
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    pause: (on = true) => pause(on),
    again: () => again(),
    story: (on = true) => openStory(on),
    toast: (text) => toast(text),
    check: (opts = {}) => MJ.check(Object.assign({ games: 60 }, opts)),
    checkCanFail: (opts = {}) => MJ.checkCanFail(opts),
    info,
    get G() { return G; },
    get R() { return G.R; },
    get rules() { return RL; },
    get prefs() { return prefs; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
