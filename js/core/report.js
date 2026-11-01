/*
 * COMPASS - レポート組み立て
 * 計算結果と data/texts.js の文章パーツを組み合わせて、構造化したレポートを作る。
 * 同じ入力なら同じ文(言い回し)が選ばれる(入力からハッシュ値を作って選択)。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./astro.js'), require('./numerology.js'), require('./kyusei.js'), require('./geo.js'), require('./bigfive.js'));
  } else {
    root.Compass = root.Compass || {};
    var C = root.Compass;
    C.report = factory(C.astro, C.numerology, C.kyusei, C.geo, C.bigfive);
  }
})(typeof self !== 'undefined' ? self : this, function (astro, numerology, kyusei, geo, bigfive) {
  'use strict';

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
  }

  function fmtMD(date) {
    var j = new Date(date.getTime() + 9 * 3600 * 1000);
    return (j.getUTCMonth() + 1) + '/' + j.getUTCDate();
  }
  function fmtYMD(date) {
    var j = new Date(date.getTime() + 9 * 3600 * 1000);
    return j.getUTCFullYear() + '年' + (j.getUTCMonth() + 1) + '月' + j.getUTCDate() + '日';
  }
  function fmtYMDHM(date) {
    var j = new Date(date.getTime() + 9 * 3600 * 1000);
    var mm = j.getUTCMinutes();
    return fmtYMD(date) + ' ' + j.getUTCHours() + ':' + (mm < 10 ? '0' : '') + mm;
  }

  var ELEMENT_GROUP = { fire: 'active', air: 'active', earth: 'calm', water: 'calm' };
  var LP_FREE = [1, 3, 5];
  var LP_STEADY = [2, 4, 6, 8, 22];

  /**
   * @param {object} input {nickname, birth:{y,m,d,hh,mm,timeKnown}, birthPref, homePref, theme, answers}
   * @param {object} texts COMPASS_TEXTS
   * @param {Date} now 基準日時
   */
  function build(input, texts, now) {
    var P = texts.parts;
    var seed = [input.nickname, input.birth.y, input.birth.m, input.birth.d, input.birth.hh, input.birth.mm, input.theme].join('|');
    var used = []; // 使った文章パーツのID(レビュー用)

    function pick(id, vars, field) {
      var part = P[id];
      if (!part) throw new Error('文章パーツが見つかりません: ' + id);
      var arr = part[field || 'v'];
      var idx = hash(seed + '#' + id + '#' + (field || 'v')) % arr.length;
      used.push(id + (field && field !== 'v' ? '.' + field : '') + '[' + (idx + 1) + ']');
      return fill(arr[idx], vars || {});
    }

    // ---- 計算 ----
    var planets = astro.calcPlanets(input.birth);
    var pl = {}; planets.forEach(function (p) { pl[p.id] = p; });
    var lp = numerology.lifePath(input.birth.y, input.birth.m, input.birth.d);
    var bd = numerology.birthday(input.birth.d);
    var ks = kyusei.birthStars(input.birth);
    var honmei = ks.honmei.num;
    var bf = bigfive.score(texts.questions, input.answers);
    var cur = kyusei.currentFortune(now, honmei);
    var regions = geo.regionsByPalace(input.homePref);
    var themeObj = texts.themes.filter(function (t) { return t.id === input.theme; })[0] || texts.themes[texts.themes.length - 1];

    var yearPalaceId = cur.year.honmeiPalace;
    var monthPalaceId = cur.month.honmeiPalace;
    var yearPhase = kyusei.phaseOf(yearPalaceId);
    var monthPhase = kyusei.phaseOf(monthPalaceId);
    var PHASE_SCORE = { spring: 1, summer: 2, autumn: 1, winter: 0 };
    var stanceScore = PHASE_SCORE[yearPhase] * 2 + PHASE_SCORE[monthPhase];
    var stance = stanceScore >= 4 ? 'attack' : (stanceScore >= 2 ? 'balance' : 'prepare');
    // 本命星が年盤の中宮(八方塞がり)にある年は、攻めすぎないよう「中間」までに抑える
    if (yearPalaceId === 'C' && stance === 'attack') stance = 'balance';
    var STANCE_NAMES = { attack: '攻め', balance: '攻めと整えの中間', prepare: '整える' };

    var name = input.nickname;
    var sunLabel = astro.signLabel(pl.sun);
    var moonLabel = astro.signLabel(pl.moon);
    var lpLabel = String(lp.value);
    var baseVars = {
      name: name, sun: sunLabel, moon: moonLabel, lp: lpLabel,
      star: ks.honmei.name, getsu: ks.getsumei.name, getsuKw: P['STAR-' + ks.getsumei.num].kw,
      home: input.homePref, theme: themeObj.name,
      selfEl: kyusei.ELEMENT_NAMES[ks.honmei.element]
    };
    function V(extra) { var o = {}; for (var k in baseVars) o[k] = baseVars[k]; for (var e in (extra || {})) o[e] = extra[e]; return o; }

    var sections = [];
    var T = texts.sectionTitles, F = texts.frameworks;

    // ---- 0. 基礎データ ----
    var s0 = { id: 's0', title: T.s0, blocks: [] };
    s0.blocks.push({ t: 'p', text: pick('INTRO', V()) });
    s0.blocks.push({ t: 'h', text: '西洋占星術', framework: F.western });
    s0.blocks.push({
      t: 'table', head: ['天体', 'サイン', '表すもの'],
      rows: planets.map(function (p) { return [p.name, astro.signLabel(p), pick('PLANET-' + p.id)]; })
    });
    var timeNote = input.birth.timeKnown
      ? '出生時刻 ' + input.birth.hh + ':' + (input.birth.mm < 10 ? '0' : '') + input.birth.mm + '(日本時間)で計算しています。'
      : '出生時刻が不明のため正午(12:00)で計算し、その日のうちにサインが変わる天体は「AまたはB」と両方を表示しています。';
    s0.blocks.push({ t: 'note', text: timeNote + 'ハウス・ASC(上昇宮)は扱いません。出生地' + (input.birthPref ? '(' + input.birthPref + ')' : '') + 'はサインの計算には影響しません。' });

    s0.blocks.push({ t: 'h', text: '数秘術', framework: F.numerology });
    s0.blocks.push({
      t: 'table', head: ['項目', '数', '計算'],
      rows: [
        ['ライフパスナンバー', lpLabel + (lp.master ? '(マスターナンバー)' : ''), lp.digits.split('').join('+') + ' = ' + lp.steps.join(' → ')],
        ['バースデーナンバー', String(bd.value) + (bd.master ? '(マスターナンバー)' : ''), bd.steps.join(' → ')]
      ]
    });

    s0.blocks.push({ t: 'h', text: '九星気学', framework: F.kyusei });
    s0.blocks.push({
      t: 'table', head: ['項目', '星', '補足'],
      rows: [
        ['本命星', ks.honmei.name, '気学上の生まれ年:' + ks.kigakuYear + '年(立春が年の始まり)'],
        ['月命星', ks.getsumei.name, '気学上の生まれ月:' + ks.monthBranch + '月(節入りが月の始まり)']
      ]
    });
    if (ks.boundary) {
      s0.blocks.push({ t: 'note', text: '生まれた日が' + ks.boundary.name + '(' + fmtYMDHM(ks.boundary.date) + ' 日本時間)の当日です。出生時刻が不明のため節入り後として計算しました。節入りより前の生まれなら、本命星は' + ks.boundary.alt.honmei.name + '・月命星は' + ks.boundary.alt.getsumei.name + 'になります。' });
    }

    s0.blocks.push({ t: 'h', text: '性格の5因子', framework: F.bigfive });
    s0.blocks.push({
      t: 'bars',
      items: bigfive.FACTORS.map(function (f) {
        var r = bf[f.id];
        return { label: f.name, value: r.value, level: bigfive.LEVEL_NAMES[r.level], low: f.low, high: f.high };
      })
    });

    s0.blocks.push({ t: 'note', text: '方位の起点:' + input.homePref + '(都道府県庁所在地の座標)/基準日:' + fmtYMD(now) });
    sections.push(s0);

    // ---- ① 内的プロファイルと葛藤 ----
    var s1 = { id: 's1', title: T.s1, blocks: [] };
    var sunMain = pl.sun.sign;
    if (pl.sun.ambiguous) {
      var a0 = pl.sun.alternatives[0], a1 = pl.sun.alternatives[1];
      s1.blocks.push({ t: 'p', text: '【西洋占星術】太陽星座は' + a0.name + '(' + P['SIGN-' + a0.id].kw + ')または' + a1.name + '(' + P['SIGN-' + a1.id].kw + ')。生まれた日に太陽が星座を移っているため、時刻によってどちらかになります。ここでは正午時点の' + sunMain.name + 'をもとに読み進めます。' + pick('SIGN-' + sunMain.id, V()) });
    } else {
      s1.blocks.push({ t: 'p', text: '【西洋占星術】太陽星座は' + sunMain.name + '「' + P['SIGN-' + sunMain.id].kw + '」。' + pick('SIGN-' + sunMain.id, V()) });
    }
    s1.blocks.push({ t: 'p', text: pick('MOON-' + pl.moon.sign.element, V()) });
    s1.blocks.push({ t: 'p', text: '【数秘術】ライフパスナンバー' + lpLabel + '「' + P['LP-' + lp.value].kw + '」。' + pick('LP-' + lp.value, V()) + 'バースデーナンバー' + bd.value + 'からは「' + pick('BD-' + bd.value, V()) + '」が読みとれます。' });
    s1.blocks.push({ t: 'p', text: '【九星気学】本命星は' + ks.honmei.name + '「' + P['STAR-' + honmei].kw + '」。' + pick('STAR-' + honmei, V()) + pick('GETSU', V()) });
    var bfLines = bigfive.FACTORS.map(function (f) { return f.name + '(' + bigfive.LEVEL_NAMES[bf[f.id].level] + '):' + pick('BF-' + f.id + '-' + bf[f.id].level, V()); });
    s1.blocks.push({ t: 'p', text: '【性格の自己チェック】回答から見えた傾向です。' });
    s1.blocks.push({ t: 'list', items: bfLines });

    // 葛藤ルール
    var sunEl = sunMain.element, moonEl = pl.moon.sign.element, marsEl = pl.mars.sign.element;
    var lv = function (f) { return bf[f].level; };
    var conflicts = [];
    function addConf(id, cond, source) { if (cond && conflicts.length < 2) conflicts.push({ id: id, source: source }); }
    addConf('CONF-EARTH-FREE', sunEl === 'earth' && LP_FREE.indexOf(lp.value) !== -1);
    addConf('CONF-FIRE-STEADY', ELEMENT_GROUP[sunEl] === 'active' && LP_STEADY.indexOf(lp.value) !== -1);
    addConf('CONF-SUNMOON-OUT', ELEMENT_GROUP[sunEl] === 'active' && ELEMENT_GROUP[moonEl] === 'calm' && !pl.moon.ambiguous);
    addConf('CONF-SUNMOON-IN', ELEMENT_GROUP[sunEl] === 'calm' && ELEMENT_GROUP[moonEl] === 'active' && !pl.moon.ambiguous);
    addConf('CONF-STAR-QUIET', [3, 7, 9].indexOf(honmei) !== -1 && lv('E') === 'low');
    (function () {
      var src = LP_FREE.indexOf(lp.value) !== -1 && lp.value !== 1 ? 'ライフパス' + lp.value : (sunEl === 'air' ? '太陽星座の' + sunMain.name : null);
      addConf('CONF-OPEN-STAY', src && lv('O') === 'low', src);
    })();
    (function () {
      var src = [4, 8, 22].indexOf(lp.value) !== -1 ? 'ライフパス' + lp.value : (sunEl === 'earth' ? '太陽星座の' + sunMain.name : ([2, 8].indexOf(honmei) !== -1 ? '本命星の' + ks.honmei.name : null));
      addConf('CONF-PLAN-MOOD', src && lv('C') === 'low', src);
    })();
    (function () {
      var src = [1, 8].indexOf(lp.value) !== -1 ? 'ライフパス' + lp.value : ([5, 6].indexOf(honmei) !== -1 ? '本命星の' + ks.honmei.name : null);
      addConf('CONF-LEAD-HARMONY', src && lv('A') === 'high', src);
    })();
    (function () {
      var src = marsEl === 'fire' ? '火星の' + pl.mars.sign.name : (lp.value === 1 ? 'ライフパス1' : (honmei === 3 ? '本命星の三碧木星' : null));
      addConf('CONF-FAST-WORRY', src && lv('N') === 'high', src);
    })();
    (function () {
      var src = [2, 6, 9, 11, 33].indexOf(lp.value) !== -1 ? 'ライフパス' + lp.value : (sunEl === 'water' ? '太陽星座の' + sunMain.name : null);
      addConf('CONF-CARE-SELF', src && lv('A') === 'low', src);
    })();
    if (conflicts.length === 0) conflicts.push({ id: 'CONF-HARMONY' });
    s1.blocks.push({ t: 'h', text: '潜在的な葛藤' });
    conflicts.forEach(function (c) {
      s1.blocks.push({ t: 'card', title: P[c.id].title, text: pick(c.id, V({ source: c.source || '', sun: sunMain.name, moon: pl.moon.sign.name })) });
    });
    sections.push(s1);

    // ---- ② タイミング ----
    var s2 = { id: 's2', title: T.s2, blocks: [] };
    function palaceText(pid, boardName) {
      var p = kyusei.palaceInfo(pid);
      return '本命星が' + boardName + 'の' + p.gua + '(' + p.name + ')にある巡り';
    }
    var monthRange = fmtMD(cur.monthStart) + '〜' + fmtMD(cur.monthEnd) + 'ごろ';
    var yP = kyusei.palaceInfo(yearPalaceId), mP = kyusei.palaceInfo(monthPalaceId);
    s2.blocks.push({
      t: 'table', head: ['', '今年(' + cur.kigakuYear + '年立春〜)', '今月(' + monthRange + ')'],
      rows: [
        ['フェーズ', kyusei.PHASE_NAMES[yearPhase], kyusei.PHASE_NAMES[monthPhase]],
        ['盤の中心の星', cur.year.centerStar.name, cur.month.centerStar.name],
        ['本命星の位置', yP.gua + '(' + yP.name + ')', mP.gua + '(' + mP.name + ')']
      ]
    });
    s2.blocks.push({ t: 'p', text: pick('TIM-YEAR-' + yearPhase, V({ yearPalace: palaceText(yearPalaceId, '年盤') })) });
    s2.blocks.push({ t: 'p', text: pick('TIM-MONTH-' + monthPhase, V({ monthPalace: palaceText(monthPalaceId, '月盤'), monthRange: monthRange })) });
    s2.blocks.push({ t: 'p', text: '今の戦略:' + STANCE_NAMES[stance] + '。' + pick('TIM-STANCE-' + stance, V()) });
    var bfAdj = null;
    if (stance === 'attack' && lv('C') === 'low') bfAdj = 'TIM-BF-CLOW';
    else if (stance !== 'prepare' && lv('N') === 'high') bfAdj = 'TIM-BF-NHIGH';
    else if (stance === 'prepare' && lv('E') === 'high') bfAdj = 'TIM-BF-EHIGH';
    else if (stance === 'prepare' && lv('O') === 'high') bfAdj = 'TIM-BF-OHIGH';
    if (bfAdj) s2.blocks.push({ t: 'p', text: pick(bfAdj, V()) });
    s2.blocks.push({ t: 'note', text: '季節フェーズは、本命星が年盤・月盤のどの宮にあるかで判定しています(坤・震=種まき/巽・中=拡大/乾・兌・離=収穫/艮・坎=整備)。' });
    sections.push(s2);

    // ---- ③ 方位 ----
    var s3 = { id: 's3', title: T.s3, blocks: [] };
    s3.blocks.push({ t: 'p', text: pick('DIR-INTRO', V()) });
    var BAD_NAMES = { gooSatsu: '五黄殺', ankenSatsu: '暗剣殺', saiha: '歳破', geppa: '月破', honmeiSatsu: '本命殺', honmeiTekiSatsu: '本命的殺' };
    function mark(d) {
      if (d.bad.length) return '×' + d.bad.map(function (b) { return BAD_NAMES[b]; }).join('・');
      if (d.good === 'best') return '◎最大吉方';
      if (d.good === 'good') return '○吉方';
      return '-';
    }
    function regionText(pid, n) {
      var list = regions[pid].slice(0, n || 3);
      if (!list.length) return '(この方角に県庁所在地なし)';
      return list.map(function (r) { return r.name.replace(/[都府県]$/, '') + '(' + geo.SCALE_NAMES[r.scale] + ')'; }).join('・');
    }
    var rows = kyusei.PALACES.map(function (p, i) {
      return [p.name, cur.year.directions[i].star.short + ' ' + mark(cur.year.directions[i]), cur.month.directions[i].star.short + ' ' + mark(cur.month.directions[i])];
    });
    s3.blocks.push({ t: 'table', cls: 'dir', head: ['方位', '今年', '今月'], rows: rows });
    s3.blocks.push({ t: 'h', text: input.homePref + 'から見た地域例' });
    s3.blocks.push({ t: 'list', items: kyusei.PALACES.map(function (p) { return p.name + ':' + regionText(p.id); }) });
    var both = [], yOnly = [], mOnly = [];
    kyusei.PALACES.forEach(function (p, i) {
      var yg = cur.year.directions[i].good, mg = cur.month.directions[i].good;
      if (yg && mg) both.push(p); else if (yg) yOnly.push(p); else if (mg) mOnly.push(p);
    });
    function names(arr) { return arr.map(function (p) { return p.name; }).join('・'); }
    if (both.length) s3.blocks.push({ t: 'p', text: pick('DIR-GOOD-BOTH', V({ dirs: names(both) })) });
    if (yOnly.length) s3.blocks.push({ t: 'p', text: pick('DIR-GOOD-YEAR', V({ dirs: names(yOnly) })) });
    if (mOnly.length) s3.blocks.push({ t: 'p', text: pick('DIR-GOOD-MONTH', V({ dirs: names(mOnly), monthRange: monthRange })) });
    if (!both.length && !yOnly.length && !mOnly.length) s3.blocks.push({ t: 'p', text: pick('DIR-GOOD-NONE', V()) });

    var badList = [], badTypes = [];
    kyusei.PALACES.forEach(function (p, i) {
      var parts = [];
      var yb = cur.year.directions[i].bad, mb = cur.month.directions[i].bad;
      if (yb.length) parts.push('今年:' + yb.map(function (b) { return BAD_NAMES[b]; }).join('・'));
      if (mb.length) parts.push('今月:' + mb.map(function (b) { return BAD_NAMES[b]; }).join('・'));
      yb.concat(mb).forEach(function (b) { if (badTypes.indexOf(b) === -1) badTypes.push(b); });
      if (parts.length) badList.push(p.name + '(' + parts.join('/') + ')');
    });
    if (badList.length) {
      s3.blocks.push({ t: 'p', text: pick('DIR-BAD', V({ dirs: badList.join('、') })) });
      var order = ['gooSatsu', 'ankenSatsu', 'saiha', 'geppa', 'honmeiSatsu', 'honmeiTekiSatsu'];
      s3.blocks.push({ t: 'list', items: order.filter(function (b) { return badTypes.indexOf(b) !== -1; }).map(function (b) { return pick('DIR-BADNAME-' + b); }) });
    }
    if (yearPalaceId === 'C') s3.blocks.push({ t: 'p', text: pick('DIR-CENTER', V()) });
    s3.blocks.push({ t: 'p', text: pick('DIR-SCALE-' + stance, V()) });
    s3.blocks.push({ t: 'p', text: pick('DIR-THEME-' + themeObj.id, V()) });
    s3.blocks.push({ t: 'note', text: '地域例は都道府県庁所在地どうしの方角と距離(近場:100km未満/中距離:400km未満/遠方:400km以上)で出しています。同じ都道府県の中でも、住んでいる場所から見た方角で考えてください。' });
    sections.push(s3);

    // ---- ④ 認知バイアス ----
    var s4 = { id: 's4', title: T.s4, blocks: [] };
    var th = themeObj.id;
    var FN = {}; bigfive.FACTORS.forEach(function (f) { FN[f.id] = f.name; });
    function r(f) { return FN[f] + 'が' + bigfive.LEVEL_NAMES[lv(f)] + '(回答)'; }
    var biasRules = [
      { id: 'BIAS-CONFIRM', base: 1, add: [[lv('O') === 'low', 2, r('O')], [lv('A') === 'low', 1, r('A')]] },
      { id: 'BIAS-PLANNING', base: 0, add: [[lv('C') === 'low', 2, r('C')], [stance === 'attack', 1, '今が攻めやすい時期'], [lv('E') === 'high', 1, r('E')]] },
      { id: 'BIAS-LOSS', base: 0, add: [[lv('N') === 'high', 2, r('N')], [stance === 'prepare', 1, '今が整える時期'], [th === 'decision' || th === 'career', 1, '相談テーマが' + themeObj.name]] },
      { id: 'BIAS-CONFORM', base: 0, add: [[lv('A') === 'high', 2, r('A')], [th === 'relation', 1, '相談テーマが' + themeObj.name]] },
      { id: 'BIAS-SUNK', base: 0, add: [[lv('C') === 'high', 2, r('C')], [th === 'career', 1, '相談テーマが' + themeObj.name], [yearPhase === 'autumn', 1, '今年が収穫の時期']] },
      { id: 'BIAS-STATUSQUO', base: 0, add: [[lv('O') === 'low', 2, r('O')], [th === 'move' || th === 'decision', 1.5, '相談テーマが' + themeObj.name]] },
      { id: 'BIAS-OVERCONF', base: 0, add: [[lv('N') === 'low', 2, r('N')], [lv('E') === 'high', 1, r('E')]] },
      { id: 'BIAS-NEGATIVE', base: 0, add: [[lv('N') === 'high', 2, r('N')], [lv('E') === 'low', 1, r('E')]] },
      { id: 'BIAS-AVAIL', base: 0.5, add: [[th === 'decision' || th === 'move', 1.5, '相談テーマが' + themeObj.name]] },
      { id: 'BIAS-SPOTLIGHT', base: 0, add: [[th === 'relation', 1.5, '相談テーマが' + themeObj.name], [lv('N') === 'high', 1, r('N')], [lv('E') === 'low', 1, r('E')]] }
    ];
    var scored = biasRules.map(function (b) {
      var s = b.base, reasons = [];
      b.add.forEach(function (a) { if (a[0]) { s += a[1]; reasons.push(a[2]); } });
      return { id: b.id, score: s + (hash(seed + b.id) % 100) / 1000, reasons: reasons };
    }).sort(function (a, b) { return b.score - a.score; });
    var picked = scored.slice(0, 2);
    s4.blocks.push({ t: 'p', text: '人は誰でも、判断のときに「心のクセ(認知バイアス)」の影響を受けます。' + name + 'さんの回答と今の時期から、特に気をつけたいものを選びました。' });
    picked.concat([{ id: 'BIAS-BARNUM', reasons: ['このレポートを読むすべての人に'] }]).forEach(function (b) {
      s4.blocks.push({
        t: 'card', title: P[b.id].title,
        text: pick(b.id, V()) + (b.reasons.length ? '(選んだ理由:' + b.reasons.join('、') + ')' : ''),
        sub: 'リスクヘッジ:' + pick(b.id, V(), 'hedge')
      });
    });
    sections.push(s4);

    // ---- ⑤ 気をつけること ----
    var s5 = { id: 's5', title: T.s5, blocks: [] };
    s5.blocks.push({ t: 'p', text: pick('CAU-INTRO', V()) });
    var selfEl = ks.honmei.element;
    var yc = cur.year.centerStar, mc = cur.month.centerStar;
    var yRel = kyusei.relation(yc.element, selfEl), mRel = kyusei.relation(mc.element, selfEl);
    var EL = kyusei.ELEMENT_NAMES;
    s5.blocks.push({ t: 'h', text: '今年(' + yc.name + '・' + EL[yc.element] + ')' });
    if (yc.num === honmei) s5.blocks.push({ t: 'p', text: pick('CAU-CENTER', V({ period: '今年' })) });
    else s5.blocks.push({ t: 'p', text: pick('CAU-REL-' + yRel, V({ period: '今年', center: yc.name, centerEl: EL[yc.element] })) });
    s5.blocks.push({ t: 'p', text: pick('CAU-EL-' + yc.element, V()) });
    s5.blocks.push({ t: 'h', text: '今月(' + mc.name + '・' + EL[mc.element] + ')' });
    if (mc.num === honmei) s5.blocks.push({ t: 'p', text: pick('CAU-CENTER', V({ period: '今月' })) });
    else s5.blocks.push({ t: 'p', text: pick('CAU-REL-' + mRel, V({ period: '今月', center: mc.name, centerEl: EL[mc.element] })) });
    if (mc.element !== yc.element) s5.blocks.push({ t: 'p', text: pick('CAU-EL-' + mc.element, V()) });
    else s5.blocks.push({ t: 'p', text: '今月も今年と同じ「' + EL[mc.element] + '」の空気です。上の注意を、今月は特に意識してみてください。' });
    sections.push(s5);

    // ---- ⑥ アクション ----
    var s6 = { id: 's6', title: T.s6, blocks: [] };
    var pool = [1, 2, 3, 4].map(function (n) { return 'ACT-' + th + '-' + stance + '-' + n; });
    var start = hash(seed + 'act') % 4;
    var acts = [pick(pool[start], V()), pick(pool[(start + 1 + (hash(seed + 'act2') % 3)) % 4], V())];
    var bestP = both[0] || mOnly[0] || yOnly[0];
    var bestDirs = cur.year.directions.concat(cur.month.directions).filter(function (d) { return d.good === 'best'; }).map(function (d) { return d.palace.id; });
    [both, mOnly, yOnly].some(function (arr) {
      var b = arr.filter(function (p) { return bestDirs.indexOf(p.id) !== -1 && regions[p.id].length; })[0];
      if (b) { bestP = b; return true; }
      return false;
    });
    if (bestP && regions[bestP.id].length) {
      var SCALE_WORD = { attack: '日帰り〜泊まりがけ', balance: '日帰りか1泊', prepare: '近場・日帰り' };
      acts.push(pick('ACT-DIR', V({ dir: bestP.name, regions: regions[bestP.id].slice(0, 2).map(function (x) { return x.name; }).join('・'), scale: SCALE_WORD[stance] })));
    } else {
      acts.push(pick('ACT-DIR-NONE', V()));
    }
    s6.blocks.push({ t: 'p', text: '相談テーマ「' + themeObj.name + '」と、今の戦略(' + STANCE_NAMES[stance] + ')に合わせた行動の例です。' });
    s6.blocks.push({ t: 'olist', items: acts });
    sections.push(s6);

    // ---- ⑦ 問いかけ ----
    var s7 = { id: 's7', title: T.s7, blocks: [] };
    s7.blocks.push({ t: 'question', text: pick('QUE-' + th, V()) });
    s7.blocks.push({ t: 'p', text: pick('OUTRO', V()) });
    sections.push(s7);

    var aiPrompt = pick('AI-PROMPT', V());

    return {
      title: name + 'さんの戦略プロファイリングレポート',
      generatedFor: fmtYMD(now),
      sections: sections,
      aiPrompt: aiPrompt,
      disclaimer: texts.disclaimer,
      usedParts: used,
      data: { planets: planets, lifePath: lp, birthday: bd, kyusei: ks, bigfive: bf, current: cur, stance: stance, yearPhase: yearPhase, monthPhase: monthPhase }
    };
  }

  // ---- 書き出し ----
  function blockToText(b, md) {
    switch (b.t) {
      case 'p': return b.text;
      case 'note': return md ? '> ※' + b.text : '※' + b.text;
      case 'h': return (md ? '##### ' : '■') + b.text + (b.framework ? (md ? '\n\n*根拠:' + b.framework + '*' : '(根拠:' + b.framework + ')') : '');
      case 'list': return b.items.map(function (x) { return '- ' + x; }).join('\n');
      case 'olist': return b.items.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
      case 'card': return (md ? '**' + b.title + '**\n\n' : '◆' + b.title + '\n') + b.text + (b.sub ? (md ? '\n\n' : '\n') + b.sub : '');
      case 'question': return (md ? '> **' : 'Q. ') + b.text + (md ? '**' : '');
      case 'table':
        if (md) {
          var esc = function (s) { return String(s).replace(/\|/g, '\\|'); };
          return '| ' + b.head.map(esc).join(' | ') + ' |\n|' + b.head.map(function () { return ' --- '; }).join('|') + '|\n' +
            b.rows.map(function (r) { return '| ' + r.map(esc).join(' | ') + ' |'; }).join('\n');
        }
        return b.rows.map(function (r) { return r.filter(function (x) { return x !== ''; }).join(' / '); }).join('\n');
      case 'bars':
        return b.items.map(function (x) {
          var n = Math.round(x.value * 2) / 2;
          var bar = '';
          for (var i = 1; i <= 7; i++) bar += i <= Math.round(x.value) ? '■' : '□';
          return (md ? '- ' : '') + x.label + ' ' + bar + ' ' + n.toFixed(1) + '/7(' + x.level + ')';
        }).join('\n');
      default: return '';
    }
  }

  function toText(rep, md) {
    var out = [(md ? '**' : '【') + rep.title + (md ? '**(基準日:' + rep.generatedFor + ')' : '】') + (md ? '' : '\n基準日:' + rep.generatedFor)];
    rep.sections.forEach(function (s) {
      out.push((md ? '#### ' : '\n――――――――――\n') + s.title);
      s.blocks.forEach(function (b) { out.push(blockToText(b, md)); });
    });
    out.push(md ? '> ' + rep.disclaimer : '\n' + rep.disclaimer);
    return out.join(md ? '\n\n' : '\n');
  }

  function clipboardText(rep) {
    return rep.aiPrompt + '\n\n==========\n' + toText(rep, false);
  }

  return { build: build, toText: toText, clipboardText: clipboardText, fill: fill, hash: hash };
});
