/* 中文 for TT Mahjong Junior (小麻将): the words on the page, the toasts, the story card and the ? panel (Kit.lang, from
   kit/lang.js). Simple words: Tommy is 5. 麻将 the game, 吃 a chow, 碰 a pung, 胡 a win, 对子 a pair, 过 pass. The kids'
   and the friends' names and the game's own name stay English. The game writes in English; every tile's name is here
   (三筒, 东风, 红中 ...), and the rules below put them into the sentences they're in. The tiles themselves are painted
   in 中文 by js/stage.js (一万, 东, 中, 发). */
(function () {
  'use strict';
  const L = Kit.lang;
  L.keep(['TT Mahjong Junior', 'TT', 'Mahjong Junior', 'TT Mahjong Junior · Teddy & Tommy', 'TEDDY', 'TOMMY', 'FOXY', 'FROGGY',
    'PANDA', 'TEDDY & TOMMY', 'Teddy & Tommy', 'Teddy', 'Tommy', 'Esc', 'Enter', 'Space', 'H', 'X', 'T', 'B', 'W', 'L', 'M', 'P', '1', '2', '3']);
  const TREATS = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  // every tile's name: "3 DOTS" 三筒, "7 CHARACTERS" 七万, "EAST WIND" 东风, "RED DRAGON" 红中 ...
  const TILES = {};
  for (let k = 0; k < MJ.rules.NK; k++) TILES[MJ.rules.nameOf(k, false)] = MJ.rules.nameOf(k, true);
  const tile = (en) => TILES[en] || en;
  const TILE = '(\\d (?:DOTS|BAMBOO|CHARACTERS)|(?:EAST|SOUTH|WEST|NORTH) WIND|(?:RED|GREEN|WHITE) DRAGON)';
  L.add(TILES);

  L.add({
    // the menu
    'MAKE FOUR SETS AND A PAIR, THEN SHOUT HÚ!': '小麻将！凑齐四组牌加一个对子，就喊"胡"！',
    PLAY: '开始', Play: '开始', 'Play (Enter)': '开始 (Enter)',
    'Who plays': '谁来玩', '1 PLAYER': '单人', '1 player (1)': '单人 (1)', '2 PLAYERS': '双人', '2 players (2)': '双人 (2)',
    'Who are you?': '你是谁？', 'Teddy (W)': 'Teddy (W)', 'Tommy (W)': 'Tommy (W)',
    Level: '难度', EASY: '简单', NORMAL: '普通', 'Easy (L)': '简单 (L)', 'Normal (L)': '普通 (L)',
    WITH: '一起玩', 'The story': '故事', 'The story (B)': '故事 (B)',
    // playing
    Pause: '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'Call your brother (T)': '叫兄弟来帮忙 (T)', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)',
    'HIGH FIVE! 🙌': '击掌！🙌',
    'YOUR TURN! THROW A TILE.': '轮到你啦！打出一张牌。',
    'TAP IT AGAIN TO THROW IT!': '再点一下，就打出去！',
    'ONE TILE TO WIN!': '再来一张就胡啦！',
    'YOU CAN WIN! TAP HÚ!': '可以胡啦！快点"胡"！',
    'A PUNG: THREE THE SAME!': '碰：三张一样的！',
    'A CHOW: THREE IN A ROW!': '吃：同一种花色，连着三张！',
    'HÚ!': '胡！', 'I WIN!': '我赢啦！', PUNG: '碰', CHOW: '吃', PASS: '过', 'PUNG!': '碰！', 'CHOW!': '吃！',
    // your brother
    'SAY HÚ! YOU WIN!': '快喊"胡"！你赢啦！', 'PASS THIS ONE!': '这张不要，过！', 'TAKE IT! PUNG!': '要它！碰！', 'TAKE IT! CHOW!': '要它！吃！',
    // the end of a round
    "IT'S A DRAW!": '平局！',
    'HÚ! A WINNING TILE FROM THE WALL!': '胡！自摸：自己摸到了最后一张！',
    'THE WALL RAN OUT OF TILES. NOBODY WON THIS TIME.': '牌摸完啦，这一局没人胡。',
    WIN: '胡牌', 'SELF-DRAWN': '自摸', 'NO CLAIMS': '门前清', 'ALL ONE SUIT': '清一色', 'ONE SUIT + HONOURS': '混一色',
    'ALL PUNGS': '碰碰胡', 'ALL CHOWS': '平胡', 'DRAGON PUNG': '龙牌碰', 'ALL HONOURS': '字一色',
    Home: '主页', 'Play again': '再玩一局', 'PLAY AGAIN': '再玩一局', 'Keep playing': '继续玩', 'Deal again': '重新发牌',
    // the story
    'MAHJONG FROM CHINA': '来自中国的麻将', 'Back a page': '上一页', 'Next page': '下一页', 'Close the story': '关上故事',
    'Mahjong is a tile game from China, about 150 years old. Four players sit round a square table. Its name comes from the word for sparrow: mixing the tiles sounds like sparrows chattering!':
      '麻将是从中国来的牌，大约有 150 年了。四个人围着一张方桌玩。"麻将"的名字来自"麻雀"：洗牌的时候哗啦啦响，就像一群小麻雀在叽叽喳喳！',
    'Three suits go from 1 to 9: DOTS (coins), BAMBOO (strings of coins, and the 1 is a bird) and CHARACTERS (WAN means ten thousand). Then the honours: four WINDS and three DRAGONS. Four of every tile, 136 in all!':
      '三种花色，都是 1 到 9：筒子（像铜钱）、条子（一串串铜钱，一条是一只小鸟）和万子（"万"就是一万）。还有字牌：东、南、西、北四种风，和红中、发财、白板。每种四张，一共 136 张！',
    'On your turn, draw a tile and throw one away. Make sets of three: a PUNG is three the same, a CHOW is three in a row of one suit. Anyone can PUNG a thrown tile, but only the next player can CHOW it.':
      '轮到你：先摸一张，再打出一张。凑三张一组："碰"是三张一样的，"吃"是同一种花色连着三张。别人打出的牌，谁都可以碰，但只有下家可以吃。',
    'Four sets and a pair make 14 tiles. Then shout HÚ! That means "I win!" We play for points and smiles, never for money.':
      '四组牌加一个对子，一共 14 张，就可以喊"胡"啦！意思是"我赢啦！"我们只玩分数和笑脸，从来不玩钱。',
    // the ? panel
    'pick a tile to throw away': '选一张要打出去的牌', 'throw it': '打出去',
    'take the tile on offer (chow, pung) or win (hú)': '要别人打的牌（吃、碰）或者胡', 'win (hú) when you can': '能胡的时候：胡',
    'no thanks (pass)': '不要（过）', 'call your brother (2 players: high five)': '叫兄弟来帮忙（双人：击掌）',
    'menu: play · the story': '菜单：开始 · 故事', 'menu: 1 player · 2 players': '菜单：单人 · 双人',
    'menu: Teddy or Tommy · level': '菜单：Teddy 或 Tommy · 难度',
    'Draw a tile, then throw one away. Make four sets (three the same, or three in a row of one suit) and a pair. Then you win: hú!':
      '摸一张牌，再打出一张。凑齐四组（三张一样的，或者同一种花色连着三张）加一个对子，就胡啦！',
    "Tap a tile, then tap it again to throw it. Tap the yellow buttons to take a tile. Tap your brother's face (bottom right) and he shows you the best tile to throw.":
      '点一张牌，再点一下就打出去。点黄色的按钮，就能要别人打的牌。点右下角兄弟的脸，他会告诉你打哪张最好。',
  });

  // text with names, numbers and tiles in it
  L.rule(/^ROUND (\d+)$/, '第 $1 局');
  L.rule(/^(\S+) STARTS!$/, '$1 先来！');
  L.rule(/^(\S+) IS THINKING\.\.\.$/, '$1 在想……');
  L.rule(/^(\S+)'S TURN! THROW A TILE\.$/, '轮到 $1 啦！打出一张牌。');
  L.rule(new RegExp(`^(\\S+): TAKE (\\S+)'S ${TILE}\\?$`), (m, kid, who, t) => `${kid}：要 ${who} 打的${tile(t)}吗？`);
  L.rule(new RegExp(`^TAKE (\\S+)'S ${TILE}\\?$`), (m, who, t) => `要 ${who} 打的${tile(t)}吗？`);
  L.rule(new RegExp(`^(\\S+): ${TILE}$`), (m, who, t) => `${who}：${tile(t)}`);
  L.rule(new RegExp(`^THROW THE ${TILE}!$`), (m, t) => `打这张${tile(t)}！`);
  L.rule(new RegExp(`^HÚ! WITH (\\S+)'S ${TILE}!$`), (m, who, t) => `胡！用了 ${who} 打的${tile(t)}！`);
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^(.+) \+(\d+)$/, (m, what, n) => `${L.t(what)} +${n}`);
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREATS[item]}！`);
  L.rule(/^(\S+) SAYS: (.+)$/, (m, who, what) => `${who} 说：${L.t(what)}`);
})();
