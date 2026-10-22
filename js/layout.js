/* TT Mahjong Junior: where everything goes, in screen pixels. MJ.layout(o) looks at the screen and the round and
   returns the table, the wind disc, every tile's spot (for MJ.stage.to), the seat badges, the boys and where the claim
   buttons go. Nothing here draws; js/game.js applies it.
   Seats: 0 bottom (you, or Teddy in 2 players), 1 right, 2 top (Tommy in 2 players), 3 left.
   - A wide screen: the boys in a strip on the left, the table filling the rest; a kid's hand stands on the table's
     edge (bottom, and top for Tommy in 2 players) in one row; the CPU friends' hidden tiles are small backs along the
     other edges, their shown sets face up beside them.
   - A tall screen (a phone held upright): the hand in two rows under the table, the boys in a strip at the bottom.
   - The ponds (thrown tiles) sit in front of each seat round the wind disc and shrink as they fill. A tile just thrown
     waits big on the disc while everyone decides whether to take it.
   - 🐣 EASY sorts a kid's hand into sets, then pairs, then loose tiles (with little lines under the sets and pairs),
     so the loose ones are easy to spot. */
(function () {
  'use strict';
  const MJ = (window.MJ = window.MJ || {});
  const CH = 1.34; // a tile's height for its width
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // the biggest tile width for n tiles in a cellW × cellH box, and the columns that gives
  function fit(cellW, cellH, n) {
    let best = { ps: 0, cols: 1 };
    for (let cols = 1; cols <= Math.max(1, n); cols++) {
      const rows = Math.ceil(n / cols);
      const ps = Math.min(cellW / cols, cellH / (rows * CH));
      if (ps > best.ps) best = { ps, cols };
    }
    return best;
  }

  // the order a kid's hand is shown in, and the gaps and lines (🐣 EASY: sets, pairs, loose; else just sorted)
  function handOrder(R, s, easy) {
    const hand = R.hands[s].filter((id) => !(R.turn === s && R.phase === 'discard' && id === R.drawn));
    if (!easy) return { order: hand.map((id) => ({ id, gap: 0, group: -1 })), groups: [] };
    const c = new Array(34).fill(0);
    for (const id of hand) c[R.KIND[id]]++;
    const g = MJ.rules.groups(c);
    const left = hand.slice();
    const takeKind = (k) => {
      const i = left.findIndex((id) => R.KIND[id] === k);
      return left.splice(i, 1)[0];
    };
    const order = [], groups = [];
    let gi = 0;
    for (const set of g.sets) {
      groups.push({ type: 'set', ids: set.map((k) => takeKind(k)) });
    }
    for (const pair of g.pairs) groups.push({ type: 'pair', ids: pair.map((k) => takeKind(k)) });
    for (const grp of groups) {
      grp.ids.forEach((id, i) => order.push({ id, gap: i === 0 && order.length ? 0.16 : 0, group: gi }));
      gi++;
    }
    left.forEach((id, i) => order.push({ id, gap: i === 0 && order.length ? 0.3 : 0, group: -1 }));
    return { order, groups };
  }

  // o: { W, H, area: { x, y, w, h } (the whole screen if left out), R, humans: [seat...], easy, sel: { seat: id },
  //      hudH, callW, safe: { l, r, t, b }, reveal }
  function layout(o) {
    const A = o.area || { x: 0, y: 0, w: o.W, h: o.H };
    const W = A.w, H = A.h, R = o.R;
    const safe = o.safe || { l: 0, r: 0, t: 0, b: 0 };
    const tall = W / H < 0.82;
    const L = { tall, tiles: new Map(), badges: [], actors: {}, bars: [], claim: {}, handRect: {}, hw: 0 };
    const pad = 8;
    const rim = clamp(Math.min(W, H) * 0.018, 6, 14);
    const humans = o.humans || [0];
    const two = humans.length === 2;
    const top = (o.hudH == null ? 60 : o.hudH) + 4 + safe.t;

    // ------------------------------------------------ the frame: the table, the hands, the boys' strip
    let table, hw, bottomHand, topHand, strip;
    if (!tall) {
      const sideW = clamp(W * 0.13, 64, 180) + safe.l;
      table = { x: sideW + rim, y: top + rim, w: W - sideW - pad - 2 * rim - safe.r, h: H - top - pad - 2 * rim - safe.b };
      const handX0 = table.x + 6;
      const handX1 = Math.min(table.x + table.w - 6, W - (o.callW || 90) - 12 - safe.r);
      hw = Math.min((handX1 - handX0) / 15.4, (table.h * (two ? 0.15 : 0.19)) / CH, 78);
      const hh = hw * CH;
      bottomHand = { x0: handX0, x1: handX1, y: table.y + table.h - 6 - hh / 2, rows: 1, meldsInline: true };
      if (two) topHand = { x0: table.x + 6, x1: table.x + table.w - 6, y: table.y + 6 + hh / 2, rows: 1, meldsInline: true };
      strip = { x: safe.l, y: top, w: sideW - safe.l, h: H - top - safe.b };
    } else {
      const stripH = clamp(H * 0.13, 84, 128);
      hw = Math.min((W - 2 * pad - safe.l - safe.r) / 7.8, 64);
      const hh = hw * CH, ms = hw * 0.62;
      const handH = 2 * hh + 6 + ms * CH + 6;
      const yBottom = H - stripH - safe.b - 4;
      bottomHand = { x0: pad + safe.l, x1: W - pad - safe.r, y: yBottom - handH, rows: 2, meldsInline: false, h: handH };
      let tableTop = top + rim;
      if (two) {
        topHand = { x0: pad + safe.l, x1: W - pad - safe.r, y: top, rows: 2, meldsInline: false, h: handH, flip: true };
        tableTop = top + handH + rim + 4;
      }
      table = { x: pad + rim + safe.l, y: tableTop, w: W - 2 * pad - 2 * rim - safe.l - safe.r, h: bottomHand.y - 6 - rim - tableTop };
      strip = { x: safe.l, y: H - stripH - safe.b, w: W - safe.l - safe.r, h: stripH };
    }
    L.table = table;
    L.rim = rim;
    L.hw = hw;
    L.strip = strip;
    const hh = hw * CH;

    // ------------------------------------------------ the seats round the table
    const isHuman = (s) => humans.includes(s);
    const ms = hw * (tall ? 0.62 : 0.7); // a shown set's tile
    const meldsOf = (s) => (R ? R.melds[s] : []);
    const backsOf = (s) => (R ? R.hands[s] : []);
    // a CPU friend's hidden tiles: small backs. Top: a row; left and right: a column (on their side).
    const zones = { top: 0, left: 0, right: 0, bottom: 0 };
    let bs = Math.min(hw * 0.55, 26);
    const sideMs = Math.min(ms, (table.w * 0.16) / 3);
    if (!isHuman(2)) zones.top = bs * CH + 8;
    else if (!tall) zones.top = hh + 10;
    const sideNeed = (s) => {
      const nm = meldsOf(s).length;
      return { w: Math.max(bs * CH, 3 * sideMs + 4) + 8, mh: nm * (sideMs * CH + 4) };
    };
    zones.left = sideNeed(3).w;
    zones.right = sideNeed(1).w;
    zones.bottom = tall ? 6 : hh + 10;
    // a side seat's badge sits at the top of its column, its tiles below: shrink the backs if they don't fit
    const badgeH = clamp(hw * 0.8, 30, 46);
    const sideH = table.h - zones.top - 8 - badgeH - 6;
    for (const s of [1, 3]) {
      const need = sideNeed(s);
      const room = sideH - need.mh - 8;
      if (13 * bs > room) bs = Math.max(8, room / 13);
    }
    L.bs = bs;

    // ------------------------------------------------ the middle: the wind disc and four ponds in a cross
    const inner = {
      x: table.x + zones.left + 6, y: table.y + zones.top + 6,
      w: table.w - zones.left - zones.right - 12, h: table.h - zones.top - zones.bottom - 12,
    };
    L.inner = inner;
    const colSide = inner.w * 0.28, colMid = inner.w - 2 * colSide;
    const rowSide = inner.h * 0.31, rowMid = inner.h - 2 * rowSide;
    const cx = inner.x + inner.w / 2, cy = inner.y + inner.h / 2;
    const cr = clamp(Math.min(colMid, rowMid) * 0.4, 20, 70);
    L.compass = { x: cx, y: cy, r: cr };
    const cells = {
      0: { x: inner.x + colSide, y: inner.y + rowSide + rowMid, w: colMid, h: rowSide, from: 'bottom' },
      2: { x: inner.x + colSide, y: inner.y, w: colMid, h: rowSide, from: 'top' },
      3: { x: inner.x, y: inner.y + rowSide * 0.5, w: colSide - 6, h: rowMid + rowSide, from: 'left' },
      1: { x: inner.x + colSide + colMid + 6, y: inner.y + rowSide * 0.5, w: colSide - 6, h: rowMid + rowSide, from: 'right' },
    };
    L.cells = cells;
    if (!R) return shift(L, A.x, A.y);

    const pondN = (s) => R.ponds[s].length - (R.last && R.last.from === s && R.phase === 'claim' ? 1 : 0);
    let ps = Math.min(hw * 0.74, 40);
    for (let s = 0; s < 4; s++) ps = Math.min(ps, fit(cells[s].w, cells[s].h, Math.max(10, pondN(s))).ps);
    L.ps = ps;
    for (let s = 0; s < 4; s++) {
      const cell = cells[s], n = pondN(s);
      const cols = Math.max(1, Math.floor(cell.w / ps));
      const ph = ps * CH;
      for (let i = 0; i < n; i++) {
        const id = R.ponds[s][i];
        const r = Math.floor(i / cols), c = i % cols;
        let x, y;
        if (cell.from === 'bottom') { x = cell.x + (cell.w - Math.min(cols, n) * ps) / 2 + c * ps + ps / 2; y = cell.y + cell.h - r * ph - ph / 2; }
        else if (cell.from === 'top') { x = cell.x + (cell.w - Math.min(cols, n) * ps) / 2 + c * ps + ps / 2; y = cell.y + r * ph + ph / 2; }
        else if (cell.from === 'left') { x = cell.x + c * ps + ps / 2; y = cell.y + r * ph + ph / 2; }
        else { x = cell.x + cell.w - c * ps - ps / 2; y = cell.y + r * ph + ph / 2; }
        L.tiles.set(id, { x, y, w: ps * 0.97 });
      }
    }
    // the tile on offer: big on the wind disc
    if (R.last && R.phase === 'claim') L.tiles.set(R.last.id, { x: cx, y: cy, w: Math.min(hw * 1.05, cr * 1.5), z: 2 });

    // ------------------------------------------------ the CPU friends' hidden tiles and shown sets
    const seatBox = {};
    for (const s of [1, 2, 3]) {
      if (isHuman(s)) continue;
      const backs = backsOf(s), melds = meldsOf(s);
      const show = o.reveal; // the round is over: everybody's tiles turn face up
      if (s === 2) {
        // a row along the top, to the right of its badge
        const x0 = table.x + clamp(hw * 2.2, 84, 150), x1 = table.x + table.w - 8;
        const mw = melds.length * (3 * ms + 6);
        const tb = Math.min(bs, (x1 - x0 - (melds.length ? 10 + mw : 0)) / Math.max(13, backs.length));
        const tw = backs.length * tb + (melds.length ? 10 + mw : 0);
        let x = Math.max(x0, Math.min(cx - tw / 2, x1 - tw));
        const y = table.y + 4 + (bs * CH) / 2;
        const rowX = x;
        for (const id of backs) {
          L.tiles.set(id, show ? { x: x + tb / 2, y, w: tb * 0.98 } : { x: x + tb / 2, y, w: tb * 0.98, back: true });
          x += tb;
        }
        x += 10;
        for (const m of melds) {
          for (const id of m.ids) { L.tiles.set(id, { x: x + ms / 2, y: table.y + 4 + (ms * CH) / 2, w: ms * 0.97 }); x += ms; }
          x += 6;
        }
        seatBox[s] = { x: rowX, y: table.y, w: tw, h: Math.max(tb, ms) * CH + 8 };
      } else {
        const left = s === 3;
        const colX = left ? table.x + 4 : table.x + table.w - 4;
        const bw = bs * CH; // a back lying on its side
        const totalH = backs.length * bs;
        let y = table.y + zones.top + badgeH + 10;
        const x = left ? colX + bw / 2 : colX - bw / 2;
        for (const id of backs) {
          L.tiles.set(id, show ? { x, y: y + bs / 2, w: bs * 0.98 * 0.9 } : { x, y: y + bs / 2, w: bs * 0.98, back: true, rot: left ? -90 : 90 });
          y += bs;
        }
        y += 6;
        for (const m of melds) {
          let mx = left ? colX + 2 : colX - 2 - 3 * sideMs;
          for (const id of m.ids) { L.tiles.set(id, { x: mx + sideMs / 2, y: y + (sideMs * CH) / 2, w: sideMs * 0.97 }); mx += sideMs; }
          y += sideMs * CH + 4;
        }
        seatBox[s] = { x: left ? colX : colX - Math.max(bw, 3 * sideMs), y: table.y + zones.top + badgeH + 10, w: Math.max(bw, 3 * sideMs), h: totalH };
      }
    }

    // ------------------------------------------------ the kids' hands
    for (const s of humans) {
      const box = s === 0 ? bottomHand : topHand;
      if (!box) continue;
      const { order, groups } = handOrder(R, s, o.easy);
      const drawn = R.turn === s && R.phase === 'discard' && R.drawn >= 0 && R.hands[s].includes(R.drawn) ? R.drawn : -1;
      const melds = meldsOf(s);
      const sel = o.sel ? o.sel[s] : -1;
      const pos = [];
      const lift = hh * 0.28;
      if (box.rows === 1) {
        // one row: the hand, the new tile a little apart, then the shown sets
        const units = order.reduce((t, x) => t + 1 + x.gap, 0) + (drawn >= 0 ? 1.35 : 0) + (melds.length ? 0.5 + melds.length * (3 * 0.8 + 0.2) : 0);
        const w = Math.min(hw, (box.x1 - box.x0) / Math.max(units, 1));
        let x = box.x0 + Math.max(0, (box.x1 - box.x0 - units * w) / 2);
        for (const it of order) {
          x += it.gap * w;
          pos.push({ id: it.id, x: x + w / 2, y: box.y, w: w * 0.97, group: it.group });
          x += w;
        }
        if (drawn >= 0) {
          x += 0.35 * w;
          pos.push({ id: drawn, x: x + w / 2, y: box.y, w: w * 0.97, group: -1, drawn: true });
          x += w;
        }
        if (melds.length) x += 0.5 * w;
        for (const m of melds) {
          for (const id of m.ids) {
            L.tiles.set(id, { x: x + (w * 0.8) / 2, y: box.y + (hh - hh * 0.8) / 2 * (s === 0 ? 1 : -1), w: w * 0.8 * 0.97 });
            x += w * 0.8;
          }
          x += 0.2 * w;
        }
        L.handRect[s] = { x0: box.x0, x1: box.x1, y0: box.y - hh / 2 - lift, y1: box.y + hh / 2, w };
      } else {
        // two rows (a tall screen): 7 on top, the rest and the new tile below; shown sets small in a row above
        const w = Math.min(hw, (box.x1 - box.x0) / 7.6);
        const msx = w * 0.62;
        const meldRowY = box.flip ? box.y + 2 * w * CH + 12 + (msx * CH) / 2 : box.y + (msx * CH) / 2;
        const row1Y = box.flip ? box.y + (w * CH) / 2 : box.y + msx * CH + 6 + (w * CH) / 2;
        const row2Y = row1Y + w * CH + 6;
        const items = order.slice();
        if (drawn >= 0) items.push({ id: drawn, gap: 0.3, drawn: true, group: -1 });
        const rows = [items.slice(0, 7), items.slice(7)];
        rows.forEach((row, r) => {
          const units = row.reduce((t, x) => t + 1 + (x.gap || 0), 0) - (row[0] ? row[0].gap || 0 : 0);
          let x = box.x0 + Math.max(0, (box.x1 - box.x0 - units * w) / 2);
          row.forEach((it, i) => {
            if (i > 0) x += (it.gap || 0) * w;
            pos.push({ id: it.id, x: x + w / 2, y: r ? row2Y : row1Y, w: w * 0.97, group: it.group, drawn: it.drawn });
            x += w;
          });
        });
        const mw = melds.length * (3 * msx + 8);
        let x = box.x0 + (box.x1 - box.x0 - mw) / 2;
        for (const m of melds) {
          for (const id of m.ids) { L.tiles.set(id, { x: x + msx / 2, y: meldRowY, w: msx * 0.97 }); x += msx; }
          x += 8;
        }
        L.handRect[s] = { x0: box.x0, x1: box.x1, y0: box.y, y1: box.y + box.h, w };
      }
      for (const p of pos) {
        L.tiles.set(p.id, { x: p.x, y: p.y, w: p.w, lift: p.id === sel ? lift * (s === 2 && box.flip ? 1 : 1) : 0, z: p.id === sel ? 1 : 0 });
      }
      // 🐣 EASY: a line under each set (green) and pair (blue)
      if (o.easy) {
        for (let gi = 0; gi < groups.length; gi++) {
          const ps2 = pos.filter((p) => p.group === gi);
          if (!ps2.length) continue;
          // a group split over two rows gets a line in each
          for (const yv of [...new Set(ps2.map((p) => p.y))]) {
            const inRow = ps2.filter((p) => p.y === yv);
            const x0 = Math.min(...inRow.map((p) => p.x - p.w / 2)), x1 = Math.max(...inRow.map((p) => p.x + p.w / 2));
            const th = inRow[0].w * CH;
            L.bars.push({ x0: x0 + 3, x1: x1 - 3, y: yv + (s === 2 && !tall ? -1 : 1) * (th / 2 + 5), h: Math.max(5, inRow[0].w * 0.13), color: groups[gi].type === 'set' ? '#22c77a' : '#2f8cff' });
          }
        }
      }
      L.order = L.order || {};
      L.order[s] = pos.map((p) => p.id);
    }

    // ------------------------------------------------ badges, the boys, the claim buttons
    const badgeAt = {};
    if (!tall) {
      badgeAt[0] = { x: strip.x + 6, y: two ? strip.y + strip.h * 0.52 : strip.y + 4, align: 'leftTop' };
      if (two) badgeAt[2] = { x: strip.x + 6, y: strip.y + 4, align: 'leftTop' };
    } else {
      badgeAt[0] = { x: strip.x + strip.w * (two ? 0.3 : 0.5), y: strip.y + strip.h - 22, align: 'center' };
      if (two) badgeAt[2] = { x: strip.x + strip.w * 0.62, y: strip.y + strip.h - 22, align: 'center' };
    }
    if (!isHuman(2)) badgeAt[2] = { x: table.x + 4, y: table.y + 4 + (bs * CH) / 2, align: 'left' };
    badgeAt[3] = { x: table.x + 4, y: table.y + zones.top + 4, align: 'leftTop' };
    badgeAt[1] = { x: table.x + table.w - 4, y: table.y + zones.top + 4, align: 'rightTop' };
    L.badges = badgeAt;

    // the boys: feet and height in pixels
    if (!tall) {
      // 2 players: the brothers side by side at the bottom of the strip (so a high five is a run, not a flight)
      const h = two ? Math.min(strip.h * 0.32, strip.w * 1.1) : Math.min(strip.h * 0.36, strip.w * 1.45);
      L.actors[0] = { x: strip.x + strip.w * (two ? 0.3 : 0.5), feet: H - safe.b - 10, h };
      if (two) L.actors[2] = { x: strip.x + strip.w * 0.74, feet: H - safe.b - 16, h: h * 0.94 };
      L.buddy = { x: strip.x + strip.w * 0.5 + h * 0.3, feet: H - safe.b - 10 - h * 0.12, h: h * 0.85 };
    } else {
      const h = strip.h * 0.84;
      L.actors[0] = { x: strip.x + strip.w * (two ? 0.3 : 0.38), feet: strip.y + strip.h - 4, h };
      if (two) L.actors[2] = { x: strip.x + strip.w * 0.55, feet: strip.y + strip.h - 4, h };
      L.buddy = { x: strip.x + strip.w * 0.56, feet: strip.y + strip.h - 2, h: h * 0.85 };
    }
    // the claim buttons: just inside the table, next to the kid being asked
    L.claim[0] = tall ? { x: W / 2, y: bottomHand.y - 8, anchor: 'bottom' } : { x: (bottomHand.x0 + bottomHand.x1) / 2, y: bottomHand.y - hh / 2 - hh * 0.3 - 10, anchor: 'bottom' };
    if (topHand) L.claim[2] = tall ? { x: W / 2, y: topHand.y + topHand.h + 8, anchor: 'top' } : { x: (topHand.x0 + topHand.x1) / 2, y: topHand.y + hh / 2 + 10, anchor: 'top' };
    L.seatBox = seatBox;
    return shift(L, A.x, A.y);
  }

  // everything was worked out inside the area: move it to where the area is on the screen
  function shift(L, dx, dy) {
    if (!dx && !dy) return L;
    const mv = (p) => {
      if (!p) return;
      if ('x' in p) p.x += dx;
      if ('y' in p) p.y += dy;
      if ('x0' in p) { p.x0 += dx; p.x1 += dx; }
      if ('y0' in p) { p.y0 += dy; p.y1 += dy; }
      if ('feet' in p) p.feet += dy;
    };
    [L.table, L.inner, L.compass, L.strip, L.buddy].forEach(mv);
    for (const group of [L.cells, L.badges, L.actors, L.claim, L.handRect, L.seatBox]) if (group) Object.values(group).forEach(mv);
    L.bars.forEach(mv);
    for (const t of L.tiles.values()) mv(t);
    return L;
  }

  MJ.layout = layout;
  MJ.layout.handOrder = handOrder;
})();
