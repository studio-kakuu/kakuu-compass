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
   * @param {object} input {nickname, birth:{y,m,d,hh,mm,timeKnown}, birthPref, homePref, theme, situation:{S1,S2}, answers}
   * @param {object} texts COMPASS_TEXTS
   * @param {Date} now 基準日時
   */
  function build(input, texts, now) {
    var P = texts.parts;
    var sit = input.situation || {};
    var seed = [input.nickname, input.birth.y, input.birth.m, input.birth.d, input.birth.hh, input.birth.mm, input.theme, sit.S1 || '', sit.S2 || ''].join('|');
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
    var themeObj = texts.themes.filter(function (t) { return t.id === input.theme; })[0] || texts.themes.filter(function (t) { return t.default; })[0];
    var th = themeObj.id;
    // テーマ別「今の状況」の回答(該当する選択肢がないときは「まずは全体を見たい」と同じ扱い)
    var sitQs = (texts.situations && texts.situations[th]) || [];
    var sitAns = sitQs.map(function (q) {
      var opt = q.options.filter(function (o) { return o.id === sit[q.id]; })[0];
      return opt ? { q: q, opt: opt } : null;
    });
    var hasSit = sitQs.length > 0 && sitAns.every(Boolean);
    var sitLabel = hasSit ? sitAns.map(function (a) { return a.opt.label; }).join('・') : '';
    var lucky = kyusei.luckyDays(now, honmei, 3);
    var friends = kyusei.friendStars(honmei);
    var lcolor = kyusei.luckyColor(cur, honmei);
    var targetMonth = cur.target.calendarMonth;

    var yearPalaceId = cur.year.honmeiPalace;
    var monthPalaceId = cur.month.honmeiPalace;
    var yearPhase = kyusei.phaseOf(yearPalaceId);
    var monthPhase = kyusei.phaseOf(monthPalaceId);
    // 転換期(中宮)の点数は従来どおり2。年が中宮のときは下で「攻め」にしない
    var PHASE_SCORE = { spring: 1, summer: 2, turning: 2, autumn: 1, winter: 0 };
    var stanceScore = PHASE_SCORE[yearPhase] * 2 + PHASE_SCORE[monthPhase];
    var stance = stanceScore >= 4 ? 'attack' : (stanceScore >= 2 ? 'balance' : 'prepare');
    // 本命星が年盤または月盤の中宮(八方塞がり=転換期)にあるときは、攻めすぎないよう「中間」までに抑える
    if ((yearPalaceId === 'C' || monthPalaceId === 'C') && stance === 'attack') stance = 'balance';
    var STANCE_NAMES = { attack: '攻め', balance: '攻めと整えの中間', prepare: '整える' };

    var name = input.nickname;
    var sunLabel = astro.signLabel(pl.sun);
    var moonLabel = astro.signLabel(pl.moon);
    var lpLabel = String(lp.value);
    var baseVars = {
      name: name, sun: sunLabel, moon: moonLabel, lp: lpLabel,
      star: ks.honmei.name, getsu: ks.getsumei.name, getsuKw: P['STAR-' + ks.getsumei.num].kw,
      home: input.homePref, theme: themeObj.name, month: targetMonth,
      selfEl: kyusei.ELEMENT_NAMES[ks.honmei.element]
    };
    function V(extra) { var o = {}; for (var k in baseVars) o[k] = baseVars[k]; for (var e in (extra || {})) o[e] = extra[e]; return o; }

    var sections = [];
    var T = texts.sectionTitles, F = texts.frameworks;
    var WD = ['日', '月', '火', '水', '木', '金', '土'];
    function dayLabel(d) { return d.m + '/' + d.d + '(' + WD[d.dow] + ')'; }
    var monthRange = fmtMD(cur.monthStart) + '〜' + fmtMD(cur.monthEnd) + 'ごろ';

    // ---- 方位(今月の指針・カード用): 今月の吉方位のうち、今年の凶方位でないもの ----
    var REL_ORDER = { supports: 3, same: 2, drains: 1 };
    var monthGood = cur.month.directions.filter(function (d, i) { return d.good && !cur.year.directions[i].bad.length; })
      .sort(function (a, b) { return (a.good === 'best' ? 0 : 1) - (b.good === 'best' ? 0 : 1) || (REL_ORDER[b.relation] - REL_ORDER[a.relation]); });
    var avoid = kyusei.PALACES.filter(function (p, i) { return cur.year.directions[i].bad.length || cur.month.directions[i].bad.length; });

    // ---- 今月の指針 ----
    var guideName = pick('GUIDE-NAME-' + monthPhase, V());
    var tailId = hasSit ? 'GUIDE-TAIL-' + th + '-' + sitAns[0].opt.id : 'GUIDE-TAIL-overview';
    var guideDesc = pick('GUIDE-LEAD-' + stance, V()) + pick(tailId, V());
    var sg = { id: 'guide', title: fill(T.guide, { month: targetMonth }), blocks: [] };
    sg.blocks.push({ t: 'p', text: pick('GUIDE-INTRO', V()) });
    sg.blocks.push({ t: 'guide', name: guideName, text: guideDesc });
    if (cur.target.beforeSetsu) {
      sg.blocks.push({ t: 'note', text: pick('GUIDE-SWITCH', V({ setsu: kyusei.SETSU[cur.monthIndex - 1].name, setsuDate: fmtMD(cur.monthStart) })) });
    }
    sg.blocks.push({ t: 'h', text: 'ラッキーデー' });
    var range = fmtMD(new Date(Date.UTC(lucky.start.y, lucky.start.m - 1, lucky.start.d))) + '〜' + fmtMD(new Date(Date.UTC(lucky.end.y, lucky.end.m - 1, lucky.end.d)));
    if (lucky.days.length) {
      sg.blocks.push({ t: 'p', text: pick('LUCKY-INTRO', V({ range: range })) });
      sg.blocks.push({ t: 'list', items: lucky.days.map(function (d) { return dayLabel(d.date) + ' ' + d.star.name + 'の日:' + pick('LABEL-REL-' + d.relation); }) });
    } else {
      sg.blocks.push({ t: 'p', text: pick('LUCKY-NONE', V({ range: range })) });
    }
    sg.blocks.push({ t: 'h', text: 'ラッキーカラー' });
    var colorVars = V({ star: lcolor.star.name, color: lcolor.color.name, dir: lcolor.palace ? lcolor.palace.name : '' });
    sg.blocks.push({ t: 'color', name: lcolor.color.name, hex: lcolor.color.hex, text: pick('COLOR-' + lcolor.rule, colorVars) });
    sg.blocks.push({ t: 'h', text: '力をくれる人' });
    var fnames = function (arr) { return arr.map(function (x) { return x.name; }).join('・'); };
    var sameOthers = friends.same.filter(function (x) { return x.num !== honmei; });
    var friendVars = V({ supports: fnames(friends.supports), same: fnames(sameOthers), drains: fnames(friends.drains) });
    sg.blocks.push({ t: 'p', text: pick(sameOthers.length ? 'FRIEND' : 'FRIEND-NOSAME', friendVars) });
    sections.push(sg);

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
      t: 'table', head: ['項目', '数', '計算'], birthCols: [2],
      rows: [
        ['ライフパスナンバー', lpLabel + (lp.master ? '(マスターナンバー)' : ''), lp.digits.split('').join('+') + ' = ' + lp.steps.join(' → ')],
        ['バースデーナンバー', String(bd.value) + (bd.master ? '(マスターナンバー)' : ''), bd.steps.join(' → ')]
      ]
    });

    s0.blocks.push({ t: 'h', text: '九星気学', framework: F.kyusei });
    s0.blocks.push({
      t: 'table', head: ['項目', '星', '補足'], birthCols: [2],
      rows: [
        ['本命星', ks.honmei.name, '気学上の生まれ年:' + ks.kigakuYear + '年(立春が年の始まり)'],
        ['月命星', ks.getsumei.name, '気学上の生まれ月:' + ks.monthBranch + '月(節入りが月の始まり)']
      ]
    });
    if (ks.boundary) {
      s0.blocks.push({ t: 'note', birthInfo: true, text: '生まれた日が' + ks.boundary.name + '(' + fmtYMDHM(ks.boundary.date) + ' 日本時間)の当日です。出生時刻が不明のため節入り後として計算しました。節入りより前の生まれなら、本命星は' + ks.boundary.alt.honmei.name + '・月命星は' + ks.boundary.alt.getsumei.name + 'になります。' });
    }

    s0.blocks.push({ t: 'h', text: '性格の5因子', framework: F.bigfive });
    s0.blocks.push({
      t: 'bars',
      items: bigfive.FACTORS.map(function (f) {
        var r = bf[f.id];
        return { label: f.name, value: r.value, level: bigfive.LEVEL_NAMES[r.level], low: f.low, high: f.high };
      })
    });

    s0.blocks.push({ t: 'note', text: '相談テーマ:' + themeObj.name + (hasSit ? '(' + sitAns.map(function (a) { return a.q.text.replace(/[??]$/, '') + ':' + a.opt.label; }).join('/') + ')' : '') });
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
    var yP = kyusei.palaceInfo(yearPalaceId), mP = kyusei.palaceInfo(monthPalaceId);
    s2.blocks.push({
      t: 'table', head: ['', '今年(' + cur.kigakuYear + '年立春〜)', targetMonth + '月(' + monthRange + ')'],
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
    s2.blocks.push({ t: 'note', text: '季節フェーズは、本命星が年盤・月盤のどの宮にあるかで判定しています(坤・震=種まき/巽=拡大/中宮=転換期/乾・兌・離=収穫/艮・坎=整備)。' });
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
    s3.blocks.push({ t: 'table', cls: 'dir', head: ['方位', '今年', targetMonth + '月'], rows: rows });
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
    var FN = {}; bigfive.FACTORS.forEach(function (f) { FN[f.id] = f.name; });
    function r(f) { return FN[f] + 'が' + bigfive.LEVEL_NAMES[lv(f)] + '(回答)'; }
    var tr = '相談テーマが' + themeObj.name;
    var s1id = hasSit ? sitAns[0].opt.id : '', s2id = hasSit ? sitAns[1].opt.id : '';
    var sr = function (i) { return '「' + sitAns[i].opt.label + '」と回答'; };
    var biasRules = [
      { id: 'BIAS-CONFIRM', base: 1, add: [[lv('O') === 'low', 2, r('O')], [lv('A') === 'low', 1, r('A')]] },
      { id: 'BIAS-PLANNING', base: 0, add: [[lv('C') === 'low', 2, r('C')], [stance === 'attack', 1, '今が攻めやすい時期'], [lv('E') === 'high', 1, r('E')], [s2id === 'impulse', 1.5, hasSit && sr(1)]] },
      { id: 'BIAS-LOSS', base: 0, add: [[lv('N') === 'high', 2, r('N')], [stance === 'prepare', 1, '今が整える時期'], [th === 'money' || th === 'career', 1, tr], [s2id === 'hesitate', 1.5, hasSit && sr(1)]] },
      { id: 'BIAS-CONFORM', base: 0, add: [[lv('A') === 'high', 2, r('A')], [th === 'relation' || th === 'love', 1, tr]] },
      { id: 'BIAS-SUNK', base: 0, add: [[lv('C') === 'high', 2, r('C')], [th === 'career' || th === 'money', 1, tr], [yearPhase === 'autumn', 1, '今年が収穫の時期']] },
      { id: 'BIAS-STATUSQUO', base: 0, add: [[lv('O') === 'low', 2, r('O')], [th === 'move', 1.5, tr], [s1id === 'change' || s1id === 'indep' || s1id === 'relocate', 1, hasSit && sr(0)]] },
      { id: 'BIAS-OVERCONF', base: 0, add: [[lv('N') === 'low', 2, r('N')], [lv('E') === 'high', 1, r('E')]] },
      { id: 'BIAS-NEGATIVE', base: 0, add: [[lv('N') === 'high', 2, r('N')], [lv('E') === 'low', 1, r('E')]] },
      { id: 'BIAS-AVAIL', base: 0.5, add: [[th === 'money' || th === 'move', 1.5, tr]] },
      { id: 'BIAS-SPOTLIGHT', base: 0, add: [[th === 'relation' || th === 'love', 1.5, tr], [s1id === 'seeking', 1, hasSit && sr(0)], [lv('N') === 'high', 1, r('N')], [lv('E') === 'low', 1, r('E')]] }
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
    s5.blocks.push({ t: 'h', text: targetMonth + '月(' + mc.name + '・' + EL[mc.element] + ')' });
    if (mc.num === honmei) s5.blocks.push({ t: 'p', text: pick('CAU-CENTER', V({ period: '今月' })) });
    else s5.blocks.push({ t: 'p', text: pick('CAU-REL-' + mRel, V({ period: '今月', center: mc.name, centerEl: EL[mc.element] })) });
    if (mc.element !== yc.element) s5.blocks.push({ t: 'p', text: pick('CAU-EL-' + mc.element, V()) });
    else s5.blocks.push({ t: 'p', text: '今月も今年と同じ「' + EL[mc.element] + '」の空気です。上の注意を、今月は特に意識してみてください。' });
    sections.push(s5);

    // ---- ⑥ 行動のヒント ----
    var s6 = { id: 's6', title: T.s6, blocks: [] };
    var acts;
    if (hasSit) {
      acts = [pick('ACT-S1-' + th + '-' + sitAns[0].opt.id + '-' + stance, V()), pick('ACT-S2-' + th + '-' + sitAns[1].opt.id, V())];
    } else {
      var pool = [1, 2, 3, 4].map(function (n) { return 'ACT-overview-' + stance + '-' + n; });
      var start = hash(seed + 'act') % 4;
      acts = [pick(pool[start], V()), pick(pool[(start + 1 + (hash(seed + 'act2') % 3)) % 4], V())];
    }
    // 方位のアクション: 今月の指針と同じ方位(今月吉・今年も凶でない)のうち、地域例がある方位
    var actDir = monthGood.filter(function (d) { return regions[d.palace.id].length; })[0];
    var SCALE_WORD = { attack: '日帰り〜泊まりがけ', balance: '日帰りか1泊', prepare: '近場・日帰り' };
    if (actDir) {
      acts.push(pick('ACT-DIR', V({ dir: actDir.palace.name, regions: regions[actDir.palace.id].slice(0, 2).map(function (x) { return x.name; }).join('・'), scale: SCALE_WORD[stance] })));
    } else {
      acts.push(pick('ACT-DIR-NONE', V()));
    }
    s6.blocks.push({ t: 'p', text: '相談テーマ「' + themeObj.name + '」' + (hasSit ? '(今の状況:' + sitLabel + ')' : '') + 'と、今の戦略(' + STANCE_NAMES[stance] + ')に合わせた行動のヒントです。' });
    s6.blocks.push({ t: 'olist', items: acts });
    if (th === 'money') s6.blocks.push({ t: 'note', text: pick('MONEY-NOTE', V()) });
    sections.push(s6);

    // ---- ⑦ 問いかけ ----
    var s7 = { id: 's7', title: T.s7, blocks: [] };
    s7.blocks.push({ t: 'question', text: pick('QUE-' + th, V()) });
    s7.blocks.push({ t: 'p', text: pick('OUTRO', V()) });
    sections.push(s7);

    var aiPrompt = pick('AI-PROMPT', V({ situation: hasSit ? '(今の状況:' + sitLabel + ')' : '' }));

    // ---- 共有・カード用のデータ ----
    var cardT = texts.card;
    var needle = monthGood[0] ? monthGood[0].palace.id : null;
    var card = {
      month: targetMonth,
      yearMonth: cur.target.calendarYear + '.' + (targetMonth < 10 ? '0' : '') + targetMonth,
      lead: fill(cardT.lead, { name: name, month: targetMonth }),
      guideName: guideName,
      guideDesc: guideDesc,
      goodDirs: monthGood.map(function (d) { return { id: d.palace.id, name: d.palace.name }; }),
      needle: needle,
      doThere: pick('DIR-ACT-' + th, V()),
      color: lcolor.color,
      badDirs: avoid.map(function (p) { return { id: p.id, name: p.name }; }),
      caution: pick('CAU-SHORT-' + cur.month.centerStar.element, V()),
      luckyDays: lucky.days.map(function (d) { return dayLabel(d.date); }),
      actions: acts,
      friends: { supports: friends.supports.map(function (x) { return x.name; }), same: (sameOthers.length ? sameOthers : [ks.honmei]).map(function (x) { return x.name; }) },
      question: fill(cardT.question, { month: targetMonth }),
      url: texts.toolUrl,
      note: cardT.note,
      birthLabel: fill(cardT.birth, { birth: input.birth.y + '.' + (input.birth.m < 10 ? '0' : '') + input.birth.m + '.' + (input.birth.d < 10 ? '0' : '') + input.birth.d })
    };

    return {
      title: name + 'さんの戦略プロファイリングレポート',
      nickname: name,
      birthText: input.birth.y + '-' + (input.birth.m < 10 ? '0' : '') + input.birth.m + '-' + (input.birth.d < 10 ? '0' : '') + input.birth.d,
      card: card,
      generatedFor: fmtYMD(now),
      sections: sections,
      aiPrompt: aiPrompt,
      disclaimer: texts.disclaimer,
      usedParts: used,
      data: { planets: planets, lifePath: lp, birthday: bd, kyusei: ks, bigfive: bf, current: cur, stance: stance, yearPhase: yearPhase, monthPhase: monthPhase, lucky: lucky, friends: friends, luckyColor: lcolor, situation: hasSit ? sitAns.map(function (a) { return a.opt.id; }) : [], guide: { name: guideName, desc: guideDesc } }
    };
  }

  // ---- 書き出し ----
  // opts.hideBirth: 生年月日がわかる部分(数秘術の計算式・気学上の生まれ年など)を伏せる
  function blockToText(b, md, opts) {
    opts = opts || {};
    if (opts.hideBirth && b.birthInfo) return null;
    switch (b.t) {
      case 'p': return b.text;
      case 'note': return md ? '> ※' + b.text : '※' + b.text;
      case 'h': return (md ? '##### ' : '■') + b.text + (b.framework ? (md ? '\n\n*根拠:' + b.framework + '*' : '(根拠:' + b.framework + ')') : '');
      case 'list': return b.items.map(function (x) { return '- ' + x; }).join('\n');
      case 'olist': return b.items.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
      case 'card': return (md ? '**' + b.title + '**\n\n' : '◆' + b.title + '\n') + b.text + (b.sub ? (md ? '\n\n' : '\n') + b.sub : '');
      case 'question': return (md ? '> **' : 'Q. ') + b.text + (md ? '**' : '');
      case 'guide': return (md ? '> ### 「' + b.name + '」\n>\n> ' : '「' + b.name + '」\n') + b.text;
      case 'color': return (md ? '**' + b.name + '**(' + b.hex + ')\n\n' : '') + b.text;
      case 'table':
        var rows = b.rows.map(function (r) {
          return r.map(function (c, i) { return opts.hideBirth && b.birthCols && b.birthCols.indexOf(i) !== -1 ? '(省略)' : c; });
        });
        if (md) {
          var esc = function (s) { return String(s).replace(/\|/g, '\\|'); };
          return '| ' + b.head.map(esc).join(' | ') + ' |\n|' + b.head.map(function () { return ' --- '; }).join('|') + '|\n' +
            rows.map(function (r) { return '| ' + r.map(esc).join(' | ') + ' |'; }).join('\n');
        }
        return rows.map(function (r) { return r.filter(function (x) { return x !== ''; }).join(' / '); }).join('\n');
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

  function toText(rep, md, opts) {
    opts = opts || {};
    var out = [(md ? '**' : '【') + rep.title + (md ? '**(基準日:' + rep.generatedFor + ')' : '】') + (md ? '' : '\n基準日:' + rep.generatedFor)];
    if (!opts.hideBirth && !md) out.push('生年月日:' + rep.birthText);
    rep.sections.forEach(function (s) {
      out.push((md ? '#### ' : '\n――――――――――\n') + s.title);
      s.blocks.forEach(function (b) { var t = blockToText(b, md, opts); if (t !== null) out.push(t); });
    });
    out.push(md ? '> ' + rep.disclaimer : '\n' + rep.disclaimer);
    return out.join(md ? '\n\n' : '\n');
  }

  /** AI相談用: 相談文 + 全文 */
  function clipboardText(rep, opts) {
    return rep.aiPrompt + '\n\n==========\n' + toText(rep, false, opts || { hideBirth: true });
  }

  /** 共有用の要約(指針・吉方位・ラッキーデー・行動のヒント・URL) */
  function summaryText(rep, texts, opts) {
    opts = opts || {};
    var S = texts.share, c = rep.card;
    var lines = [fill(S.head, { name: rep.nickname, month: c.month, guide: c.guideName }), c.guideDesc];
    if (opts.includeBirth) lines.push(fill(S.birth, { birth: rep.birthText }));
    lines.push('');
    lines.push(fill(S.good, { dirs: c.goodDirs.length ? c.goodDirs.map(function (d) { return d.name; }).join('・') : texts.card.noGood }));
    lines.push(fill(S.days, { days: c.luckyDays.length ? c.luckyDays.join('・') : texts.card.noDays }));
    lines.push(fill(S.color, { color: c.color.name }));
    lines.push(S.actions);
    c.actions.forEach(function (a, i) { lines.push((i + 1) + '. ' + a); });
    lines.push('');
    lines.push(S.footer);
    lines.push(opts.url || c.url);
    return lines.join('\n');
  }

  return { build: build, toText: toText, clipboardText: clipboardText, summaryText: summaryText, fill: fill, hash: hash };
});
