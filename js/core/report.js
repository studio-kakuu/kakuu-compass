/*
 * COMPASS - レポート組み立て
 * 計算結果と data/texts.js の文章パーツを組み合わせて、構造化したレポートを作る(AIは使わない)。
 * 同じ入力なら同じ文(言い回し)が選ばれる(入力からハッシュ値を作って選択)。
 *
 * 構成
 *   0. 要約と目次 / 1. 〇月の指針 / 2. 人物像(アクセルとブレーキ) /
 *   3. テーマ別の作戦(3-1〜3-6) / 4. 気をつけること(〇月のみ・期間明記) / 5. 最後の問いかけ /
 *   6. 付録(根拠の詳細・方位の全一覧・用語集)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./astro.js'), require('./numerology.js'), require('./kyusei.js'), require('./geo.js'), require('./bigfive.js'), require('./persona.js'));
  } else {
    root.Compass = root.Compass || {};
    var C = root.Compass;
    C.report = factory(C.astro, C.numerology, C.kyusei, C.geo, C.bigfive, C.persona);
  }
})(typeof self !== 'undefined' ? self : this, function (astro, numerology, kyusei, geo, bigfive, persona) {
  'use strict';

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
  }

  function jst(date) { return new Date(date.getTime() + 9 * 3600 * 1000); }
  function fmtMD(date) { var j = jst(date); return (j.getUTCMonth() + 1) + '/' + j.getUTCDate(); }
  function fmtYMD(date) { var j = jst(date); return j.getUTCFullYear() + '年' + (j.getUTCMonth() + 1) + '月' + j.getUTCDate() + '日'; }
  function fmtYMDslash(date) { var j = jst(date); return j.getUTCFullYear() + '/' + (j.getUTCMonth() + 1) + '/' + j.getUTCDate(); }
  function fmtYMDHM(date) {
    var j = jst(date);
    var mm = j.getUTCMinutes();
    return fmtYMD(date) + ' ' + j.getUTCHours() + ':' + (mm < 10 ? '0' : '') + mm;
  }
  var DAY = 86400000;
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function dayLabel(d) { return d.m + '/' + d.d + '(' + WD[d.dow] + ')'; }

  var STANCE_NAMES = { attack: '攻め', balance: '攻めと整えの中間', prepare: '整える' };
  var BAD_NAMES = { gooSatsu: '五黄殺', ankenSatsu: '暗剣殺', saiha: '歳破', geppa: '月破', honmeiSatsu: '本命殺', honmeiTekiSatsu: '本命的殺' };
  var BAD_PRIORITY = ['gooSatsu', 'ankenSatsu', 'honmeiSatsu', 'honmeiTekiSatsu', 'geppa'];
  var PHASE_SHORT = { spring: '種まき', summer: '拡大', turning: '転換期', autumn: '収穫', winter: '整備' };

  /**
   * @param {object} input {nickname, birth:{y,m,d,hh,mm,timeKnown}, birthPref, homePref, theme, situation:{S1,S2},
   *                        answers, extra:{cool:[id,...](最大2), success:id}}
   * @param {object} texts COMPASS_TEXTS
   * @param {Date} now 基準日時
   */
  function build(input, texts, now) {
    var P = texts.parts;
    var sit = input.situation || {};
    var extra = input.extra || {};
    var seed = [input.nickname, input.birth.y, input.birth.m, input.birth.d, input.birth.hh, input.birth.mm, input.theme, sit.S1 || '', sit.S2 || ''].join('|');
    var used = []; // 使った文章パーツのID(レビュー用)

    function pick(id, vars, field, forceIdx) {
      var part = P[id];
      if (!part) throw new Error('文章パーツが見つかりません: ' + id);
      var arr = part[field || 'v'];
      var idx = forceIdx !== undefined ? forceIdx % arr.length : hash(seed + '#' + id + '#' + (field || 'v')) % arr.length;
      used.push(id + (field && field !== 'v' ? '.' + field : '') + '[' + (idx + 1) + ']');
      return fill(arr[idx], vars || {});
    }

    // ================= 計算 =================
    var planets = astro.calcPlanets(input.birth);
    var pl = {}; planets.forEach(function (p) { pl[p.id] = p; });
    var lp = numerology.lifePath(input.birth.y, input.birth.m, input.birth.d);
    var bd = numerology.birthday(input.birth.d);
    var ks = kyusei.birthStars(input.birth);
    var honmei = ks.honmei.num;
    var bf = bigfive.score(texts.questions, input.answers);
    var lv = function (f) { return bf[f].level; };
    var cur = kyusei.currentFortune(now, honmei);
    var regions = geo.regionsByPalace(input.homePref);
    var themeObj = texts.themes.filter(function (t) { return t.id === input.theme; })[0] || texts.themes.filter(function (t) { return t.default; })[0];
    var th = themeObj.id;
    var themeShort = texts.themeShort[th];

    // テーマ別「今の状況」の回答(該当する選択肢がないときは「まずは全体を見たい」と同じ扱い)
    var sitQs = (texts.situations && texts.situations[th]) || [];
    var sitAns = sitQs.map(function (q) {
      var opt = q.options.filter(function (o) { return o.id === sit[q.id]; })[0];
      return opt ? { q: q, opt: opt } : null;
    });
    var hasSit = sitQs.length > 0 && sitAns.every(Boolean);
    var sitLabel = hasSit ? sitAns.map(function (a) { return a.opt.label; }).join('・') : '';
    var s1id = hasSit ? sitAns[0].opt.id : '', s2id = hasSit ? sitAns[1].opt.id : '';

    // 追加の質問(冷めるきっかけ・うまくいった型)
    var XQ = texts.extraQuestions;
    var cools = (extra.cool || []).map(function (id) { return XQ.cool.options.filter(function (o) { return o.id === id; })[0]; }).filter(Boolean).slice(0, XQ.cool.max);
    var success = XQ.success.options.filter(function (o) { return o.id === extra.success; })[0] || null;
    var coolIds = cools.map(function (c) { return c.id; });

    var lucky = kyusei.luckyDays(now, honmei, 3);
    var friends = kyusei.friendStars(honmei);
    var targetMonth = cur.target.calendarMonth;

    // 期間の表記(計算で出す)
    var monthLastDay = new Date(cur.monthEnd.getTime() - DAY);
    var monthRange = fmtMD(cur.monthStart) + '〜' + fmtMD(monthLastDay);
    var monthLabel = targetMonth + '月(' + monthRange + ')';
    var yearStart = kyusei.risshun(cur.kigakuYear), yearEnd = new Date(kyusei.risshun(cur.kigakuYear + 1).getTime() - DAY);
    var yearLabel = '今年(' + fmtYMDslash(yearStart) + '〜' + fmtYMDslash(yearEnd) + ')';
    var plan3End = (function () { var j = jst(now); return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth() + 3, j.getUTCDate()) - 9 * 3600 * 1000); })();

    // 季節フェーズと戦略(〇月の指針なので、月の流れを重くみる:年×1 + 月×2)
    var yearPalaceId = cur.year.honmeiPalace;
    var monthPalaceId = cur.month.honmeiPalace;
    var yearPhase = kyusei.phaseOf(yearPalaceId);
    var monthPhase = kyusei.phaseOf(monthPalaceId);
    var PHASE_SCORE = { spring: 1, summer: 2, turning: 2, autumn: 1, winter: 0 };
    var stanceScore = PHASE_SCORE[yearPhase] + PHASE_SCORE[monthPhase] * 2;
    var stance = stanceScore >= 4 ? 'attack' : (stanceScore >= 2 ? 'balance' : 'prepare');
    var capped = false;
    // 本命星が年盤または月盤の中宮(八方塞がり=転換期)にあるときは、攻めすぎないよう「中間」までに抑える
    if ((yearPalaceId === 'C' || monthPalaceId === 'C') && stance === 'attack') { stance = 'balance'; capped = true; }

    // 人物像(4軸)
    var pers = persona.compute(bf, { sunEl: pl.sun.sign.element, moonEl: pl.moon.sign.element, lp: lp.value, star: honmei });
    var accelPole = pers.accel.pole, brakePole = pers.brake.pole;
    var PN = persona.POLE_NAMES;
    var accelName = accelPole === 'balance' ? 'バランス型' : PN[accelPole];
    var brakeName = texts.brakeLabels[brakePole]; // 見出しと本文(BRAKE-…・TRAP-…)で同じ言い方を使う
    var srcNames = { sun: pl.sun.sign.name, moon: pl.moon.sign.name, lp: 'ライフパス' + lp.value, star: ks.honmei.name };

    var name = input.nickname;
    var baseVars = {
      name: name, sun: astro.signLabel(pl.sun), moon: astro.signLabel(pl.moon), lp: String(lp.value),
      star: ks.honmei.name, getsu: ks.getsumei.name, getsuKw: P['STAR-' + ks.getsumei.num].kw,
      home: input.homePref, theme: themeObj.name, themeName: themeShort, month: targetMonth,
      monthLabel: monthLabel, monthRange: monthRange, selfEl: kyusei.ELEMENT_NAMES[ks.honmei.element],
      accel: accelName, pattern: success ? success.type : ''
    };
    function V(extraVars) { var o = {}; for (var k in baseVars) o[k] = baseVars[k]; for (var e in (extraVars || {})) o[e] = extraVars[e]; return o; }

    // ================= 方位(〇月の盤) =================
    var REL_ORDER = { supports: 3, same: 2, drains: 1 };
    var monthGood = cur.month.directions.filter(function (d) { return d.good; })
      .sort(function (a, b) { return (a.good === 'best' ? 0 : 1) - (b.good === 'best' ? 0 : 1) || (REL_ORDER[b.relation] - REL_ORDER[a.relation]); });
    // 金色の針・行動のヒントの方位・ラッキーカラーは同じ方位にそろえる(地域例がある方位を優先)
    var needleDir = monthGood.filter(function (d) { return regions[d.palace.id].length; })[0] || monthGood[0] || null;
    var goodOrdered = (needleDir ? [needleDir] : []).concat(monthGood.filter(function (d) { return d !== needleDir; }));
    var lcolor = kyusei.luckyColor(cur, honmei, needleDir ? needleDir.palace.id : null);
    var monthBad = cur.month.directions.filter(function (d) { return d.bad.length; }).map(function (d) {
      return { palace: d.palace, bad: d.bad, rank: Math.min.apply(null, d.bad.map(function (b) { var i = BAD_PRIORITY.indexOf(b); return i === -1 ? 99 : i; })) };
    }).sort(function (a, b) { return a.rank - b.rank || kyusei.PALACES.indexOf(a.palace) - kyusei.PALACES.indexOf(b.palace); });
    var avoid = monthBad.slice(0, 2).map(function (x) { return x.palace; });
    function regionNames(pid, n) { return regions[pid].slice(0, n).map(function (r) { return r.name.replace(/[都府県]$/, ''); }); }

    // ================= 〇月のひとこと注意(カードの「注意」と4章) =================
    var mcStar = cur.month.centerStar;
    var cauRel = mcStar.num === honmei ? 'center' : kyusei.relation(mcStar.element, ks.honmei.element);
    var sameRelStars = [];
    for (var sn = 1; sn <= 9; sn++) {
      var r0 = sn === mcStar.num ? 'center' : kyusei.relation(mcStar.element, kyusei.STARS[sn].element);
      if (r0 === cauRel) sameRelStars.push(sn);
    }
    var cardCaution = pick('CAU-LEAD-' + cauRel, V(), 'v', sameRelStars.indexOf(honmei)) + pick(hasSit ? 'CAU-SIT-' + th + '-' + s1id : 'CAU-SHORT-' + mcStar.element, V());

    // ================= 指針 =================
    var guideName = pick('GUIDE-NAME-' + monthPhase, V());
    var guideDesc = pick('GUIDE-LEAD-' + stance, V()) + pick(hasSit ? 'GUIDE-TAIL-' + th + '-' + s1id : 'GUIDE-TAIL-overview', V());

    // ================= 行動(3-4・カード・要約で共通) =================
    var weekAct, monthAct;
    if (hasSit) {
      weekAct = pick('ACT-S2-' + th + '-' + s2id, V());
      monthAct = pick('ACT-S1-' + th + '-' + s1id + '-' + stance, V());
    } else {
      var poolStart = hash(seed + 'act') % 4;
      weekAct = pick('ACT-overview-' + stance + '-' + (poolStart + 1), V());
      monthAct = pick('ACT-overview-' + stance + '-' + (((poolStart + 1 + (hash(seed + 'act2') % 3)) % 4) + 1), V());
    }
    var SCALE_WORD = { attack: '日帰り〜泊まりがけ', balance: '日帰りか1泊', prepare: '近場・日帰り' };
    var actDir = needleDir && regions[needleDir.palace.id].length ? needleDir : null;
    var dirAct = actDir
      ? pick('ACT-DIR', V({ dir: actDir.palace.name, regions: regions[actDir.palace.id].slice(0, 2).map(function (x) { return x.name; }).join('・'), scale: SCALE_WORD[stance] }))
      : pick('ACT-DIR-NONE', V());
    var cardActions = [weekAct, monthAct, dirAct];

    var sections = [];
    var T = texts.sectionTitles, F = texts.frameworks;

    // ================= 1. 〇月の指針 =================
    var sg = { id: 'guide', title: fill(T.guide, { monthLabel: monthLabel }), blocks: [] };
    sg.blocks.push({ t: 'p', text: pick('GUIDE-INTRO', V()) });
    sg.blocks.push({ t: 'guide', name: guideName, text: guideDesc });
    if (cur.target.beforeSetsu) {
      sg.blocks.push({ t: 'note', text: pick('GUIDE-SWITCH', V({ setsu: kyusei.SETSU[cur.monthIndex - 1].name, setsuDate: fmtMD(cur.monthStart) })) });
    }
    sg.blocks.push({ t: 'h', text: 'ラッキーカラー' });
    sg.blocks.push({ t: 'color', name: lcolor.color.name, hex: lcolor.color.hex, text: pick('COLOR-' + lcolor.rule, V({ star: lcolor.star.name, color: lcolor.color.name, dir: lcolor.palace ? lcolor.palace.name : '' })) });
    sg.blocks.push({ t: 'h', text: '力をくれる人' });
    var fnames = function (arr) { return arr.map(function (x) { return x.name; }).join('・'); };
    var sameOthers = friends.same.filter(function (x) { return x.num !== honmei; });
    sg.blocks.push({ t: 'p', text: pick(sameOthers.length ? 'FRIEND' : 'FRIEND-NOSAME', V({ supports: fnames(friends.supports), same: fnames(sameOthers), drains: fnames(friends.drains) })) });
    sg.blocks.push({ t: 'label', text: '根拠:九星気学(' + targetMonth + '月の盤・本命星)' });

    // ================= 2. 人物像 =================
    var sp = { id: 'persona', title: T.persona, blocks: [] };
    sp.blocks.push({ t: 'p', text: pick('PERSONA-OPEN', V()) });
    sp.blocks.push({ t: 'pair', accel: accelName, brake: brakeName });
    sp.blocks.push({
      t: 'axes',
      items: pers.axes.map(function (a) {
        return { id: a.id, label: a.label, plusName: PN[a.plus], minusName: PN[a.minus], score: a.score };
      })
    });
    sp.blocks.push({ t: 'label', text: '根拠:Big Five(回答)60%+西洋占星術・数秘術・九星気学 40%(変換表は付録)' });
    sp.blocks.push({ t: 'h', text: 'アクセル(強み):' + accelName });
    sp.blocks.push({ t: 'p', text: pick('ACCEL-' + accelPole, V()) });
    if (accelPole !== 'balance') sp.blocks.push({ t: 'label', text: 'アクセルの根拠:' + persona.sources(pers.accel.axis, accelPole, srcNames).join('・') });
    if (success) sp.blocks.push({ t: 'p', text: pick('SUCCESS-' + success.id, V()) });
    sp.blocks.push({ t: 'h', text: 'ブレーキ(盲点):' + brakeName });
    sp.blocks.push({ t: 'p', text: pick('BRAKE-' + brakePole, V()) });
    if (brakePole !== 'balance') sp.blocks.push({ t: 'label', text: 'ブレーキの根拠:' + persona.sources(pers.brake.axis, brakePole, srcNames).join('・') });
    cools.forEach(function (c) { sp.blocks.push({ t: 'p', text: pick('COOL-' + c.id, V()) }); });
    if (cools.length) sp.blocks.push({ t: 'label', text: '根拠:あなたの回答(やる気が冷めやすいとき)' });
    sp.blocks.push({ t: 'p', text: pick('PERSONA-CLOSE', V()) });

    // ================= 3. テーマ別の作戦 =================
    var ss = { id: 'strategy', title: th === 'overview' ? T.strategyOverview : fill(T.strategy, { themeName: themeObj.name }), blocks: [] };
    ss.blocks.push({ t: 'p', text: pick(th === 'overview' ? 'STRAT-INTRO-overview' : 'STRAT-INTRO', V()) });

    // 3-1 今の状況の読み
    ss.blocks.push({ t: 'h', id: 's31', text: T.s31 });
    if (hasSit) {
      ss.blocks.push({ t: 'p', text: pick('READ-' + th + '-' + s1id, V()) });
      ss.blocks.push({ t: 'p', text: pick('VALUE-' + th + '-' + s2id, V()) });
    } else {
      ss.blocks.push({ t: 'p', text: pick('READ-overview-' + monthPhase, V()) });
    }
    ss.blocks.push({ t: 'p', text: pick((th === 'overview' ? 'READ-AXIS-ALL-' : 'READ-AXIS-') + accelPole, V()) });
    ss.blocks.push({ t: 'label', text: '根拠:' + (hasSit ? '今の状況の回答・' : '九星気学(' + targetMonth + '月の盤)・') + '人物像' });

    // 3-2 〇月の勝ち筋
    ss.blocks.push({ t: 'h', id: 's32', text: fill(T.s32, { month: targetMonth }) });
    ss.blocks.push({ t: 'p', text: yearLabel + 'は「' + PHASE_SHORT[yearPhase] + '」の流れ。その中で、' + name + 'さんの' + targetMonth + '月の戦略は「' + STANCE_NAMES[stance] + '」です。' + (capped ? '本命星が盤の中央に入る時期なので、攻めすぎず、足元を固めながら進めるのがよさそうです。' : '') });
    if (th !== 'overview') {
      var mP = kyusei.palaceInfo(monthPalaceId);
      ss.blocks.push({ t: 'p', text: pick('TIM-MONTH-' + monthPhase, V({ monthPalace: monthPalaceId === 'C' ? '月の盤の中央' : '月の盤で本命星が' + mP.name + 'にある巡り' })) });
    }
    ss.blocks.push({ t: 'p', text: pick('WIN-' + th + '-' + stance, V()) });
    var bfAdj = null;
    if (stance === 'attack' && lv('C') === 'low') bfAdj = 'TIM-BF-CLOW';
    else if (stance !== 'prepare' && lv('N') === 'high') bfAdj = 'TIM-BF-NHIGH';
    else if (stance === 'prepare' && lv('E') === 'high') bfAdj = 'TIM-BF-EHIGH';
    else if (stance === 'prepare' && lv('O') === 'high') bfAdj = 'TIM-BF-OHIGH';
    if (bfAdj) ss.blocks.push({ t: 'p', text: pick(bfAdj, V()) });
    ss.blocks.push({ t: 'label', text: '根拠:九星気学(年の盤・' + targetMonth + '月の盤)・Big Five' });

    // 3-3 落とし穴と対策
    ss.blocks.push({ t: 'h', id: 's33', text: T.s33 });
    ss.blocks.push({ t: 'p', text: pick('TRAP-INTRO', V()) });
    ss.blocks.push({ t: 'card', title: '盲点:' + brakeName, text: pick('TRAP-' + brakePole, V()) });
    var FN = {}; bigfive.FACTORS.forEach(function (f) { FN[f.id] = f.name; });
    function r(f) { return FN[f] + 'が' + bigfive.LEVEL_NAMES[lv(f)] + '(回答)'; }
    var tr = '相談テーマが' + themeObj.name;
    var sr = function (i) { return '「' + sitAns[i].opt.label + '」と回答'; };
    var biasRules = [
      { id: 'BIAS-CONFIRM', base: 1, add: [[lv('O') === 'low', 2, r('O')], [lv('A') === 'low', 1, r('A')]] },
      { id: 'BIAS-PLANNING', base: 0, add: [[lv('C') === 'low', 2, r('C')], [stance === 'attack', 1, targetMonth + '月が攻めの流れ'], [lv('E') === 'high', 1, r('E')], [s2id === 'impulse', 1.5, hasSit && sr(1)]] },
      { id: 'BIAS-LOSS', base: 0, add: [[lv('N') === 'high', 2, r('N')], [stance === 'prepare', 1, targetMonth + '月が整える流れ'], [th === 'money' || th === 'career', 1, tr], [s2id === 'hesitate', 1.5, hasSit && sr(1)]] },
      { id: 'BIAS-CONFORM', base: 0, add: [[lv('A') === 'high', 2, r('A')], [th === 'relation' || th === 'love', 1, tr]] },
      { id: 'BIAS-SUNK', base: 0, add: [[lv('C') === 'high', 2, r('C')], [th === 'career' || th === 'money', 1, tr], [yearPhase === 'autumn', 1, '年の流れが収穫の時期']] },
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
    scored.slice(0, 2).forEach(function (b) {
      ss.blocks.push({ t: 'card', title: '判断のクセ:' + P[b.id].title, text: pick(b.id, V()) + (b.reasons.length ? '(選んだ理由:' + b.reasons.join('、') + ')' : ''), sub: '対策:' + pick(b.id, V(), 'hedge') });
    });
    var pat = success ? success.id : null;
    cools.forEach(function (c) {
      // 対策が行動プラン(3-4)とほぼ同じになる組み合わせは、重ねて書かずに3-4を案内する
      var overlap = (c.id === 'purpose' && pat === 'purpose') || (c.id === 'alone' && pat === 'team');
      ss.blocks.push({ t: 'card', title: '冷めるきっかけ:' + c.label, text: overlap ? '対策:3-4の行動プランにある「' + success.type + 'の進め方」が、そのまま対策になります。' : '対策:' + pick('COOL-' + c.id, V(), 'fix') + '。' });
    });
    ss.blocks.push({ t: 'card', title: '読むときの注意:' + P['BIAS-BARNUM'].title, text: pick('BIAS-BARNUM', V()), sub: '対策:' + pick('BIAS-BARNUM', V(), 'hedge') });
    ss.blocks.push({ t: 'label', text: '根拠:Big Five・今の状況とやる気についての回答' });

    // 3-4 行動プラン
    ss.blocks.push({ t: 'h', id: 's34', text: T.s34 });
    ss.blocks.push({ t: 'p', text: pick('PLAN-INTRO', V({ pattern: success ? success.type : 'これまでの' })) });
    var weekItems = (pat ? [pick('PLAN-WEEK-' + pat, V())] : []).concat([weekAct]);
    var monthItems = [monthAct].concat(pat ? [pick('PLAN-MONTH-' + pat, V())] : []);
    var longItems = [pick('PLAN-3M-' + (hasSit ? th + '-' + s1id : 'overview-' + stance), V())].concat(pat ? [pick('PLAN-KEEP-' + pat, V())] : []);
    ss.blocks.push({
      t: 'plan', groups: [
        { label: '今週', items: weekItems },
        { label: targetMonth + '月中(' + monthRange + ')', items: monthItems },
        { label: '3か月(〜' + fmtYMDslash(plan3End) + ')', items: longItems }
      ]
    });
    if (th === 'money') ss.blocks.push({ t: 'note', text: pick('MONEY-NOTE', V()) });
    ss.blocks.push({ t: 'label', text: '根拠:今の状況の回答・うまくいった型・' + targetMonth + '月の戦略' });

    // 3-5 ラッキーデーの使いどころ
    ss.blocks.push({ t: 'h', id: 's35', text: T.s35 });
    var range = fmtMD(new Date(Date.UTC(lucky.start.y, lucky.start.m - 1, lucky.start.d))) + '〜' + fmtMD(new Date(Date.UTC(lucky.end.y, lucky.end.m - 1, lucky.end.d)));
    var useArr = P['LUCKY-USE-' + th].v;
    var usedUse = [];
    // 方角と組み合わせる日は、〇月の盤の期間(節入り〜次の節入りの前日)に入るラッキーデーだけ
    var mStartDn = kyusei.dayNumberOfDate(cur.monthStart), mEndDn = kyusei.dayNumberOfDate(cur.monthEnd) - 1;
    var inMonthDays = lucky.days.filter(function (d) { return d.dn >= mStartDn && d.dn <= mEndDn; });
    var doArr = P['DIR-ACT-' + th].v;
    var doStart = hash(seed + 'dirdo') % doArr.length;
    var dirPairs = goodOrdered.slice(0, 3).map(function (d, i) {
      var rn = regionNames(d.palace.id, 2);
      var doIdx = (doStart + i) % doArr.length;
      used.push('DIR-ACT-' + th + '[' + (doIdx + 1) + ']');
      return {
        dir: d, day: inMonthDays[i] || null, act: doArr[doIdx],
        where: d.palace.name + (rn.length ? '(' + rn.join('・') + '方面)' : '(' + input.homePref + 'の中の' + d.palace.name + '側)')
      };
    });
    function pairOfDay(d) { return dirPairs.filter(function (p) { return p.day && p.day.dn === d.dn; })[0]; }
    var luckyUses = lucky.days.map(function (d) {
      var pr = pairOfDay(d);
      if (pr) return { tag: pr.dir.palace.name + 'へのお出かけ', text: pr.where + 'への' + pr.act + 'に使う(3-6の方角)', paired: true };
      var idx = ((kyusei.kanshiIndex(d.dn) % 12) + d.date.dow) % useArr.length;
      while (usedUse.indexOf(idx) !== -1) idx = (idx + 1) % useArr.length;
      usedUse.push(idx);
      used.push('LUCKY-USE-' + th + '[' + (idx + 1) + ']');
      var parts = useArr[idx].split('|');
      return { tag: parts[0], text: fill(parts[1], V()), paired: false };
    });
    if (lucky.days.length) {
      ss.blocks.push({ t: 'p', text: pick('LUCKY-INTRO', V({ range: range })) });
      ss.blocks.push({
        t: 'list', items: lucky.days.map(function (d, i) {
          return dayLabel(d.date) + ' ' + d.star.short + 'の日(' + pick('LABEL-REL-' + d.relation) + '):「' + luckyUses[i].tag + '」向き。' + luckyUses[i].text + '。';
        })
      });
    } else {
      ss.blocks.push({ t: 'p', text: pick('LUCKY-NONE', V({ range: range })) });
    }
    ss.blocks.push({ t: 'label', text: '根拠:九星気学(日盤)・相談テーマ' });

    // 3-6 方角の使い方(1方位1行:どこへ・何をしに・いつ)
    ss.blocks.push({ t: 'h', id: 's36', text: T.s36 });
    var dirLines = [];
    if (dirPairs.length) {
      ss.blocks.push({ t: 'p', text: pick('DIRLINE-INTRO', V()) });
      dirPairs.forEach(function (pr) {
        var d = pr.dir;
        var when = pr.day ? 'ラッキーデーの' + dayLabel(pr.day.date) : targetMonth + '月中(' + monthRange + ')';
        // 年の盤の情報は付録「方位の全一覧」だけに載せる(すすめる方角に凶のラベルを並べない)
        var tag = d.good === 'best' ? '〔最大吉方〕' : '〔吉方位〕';
        dirLines.push(pr.where + 'へ。' + pr.act + 'の予定を' + when + 'に。' + tag);
      });
      ss.blocks.push({ t: 'list', items: dirLines });
    } else {
      ss.blocks.push({ t: 'p', text: pick('DIRLINE-NONE', V()) });
    }
    if (monthBad.length) {
      ss.blocks.push({ t: 'p', text: '避けたい方角:' + monthBad.map(function (x) { return x.palace.name + '〔' + x.bad.map(function (b) { return BAD_NAMES[b]; }).join('・') + '〕'; }).join('、') + '(言葉の意味は付録の用語集へ)' });
    }
    ss.blocks.push({ t: 'p', text: pick('DIR-SCALE-' + stance, V()) });
    ss.blocks.push({ t: 'p', text: pick('DIRLINE-LONG', V()) });
    ss.blocks.push({ t: 'label', text: '根拠:九星気学(' + targetMonth + '月の盤)・' + input.homePref + 'からの方角' });

    // ================= 4. 気をつけること(〇月のみ) =================
    var sc = { id: 'caution', title: fill(T.caution, { monthLabel: monthLabel }), blocks: [] };
    var EL = kyusei.ELEMENT_NAMES;
    sc.blocks.push({ t: 'p', text: pick('CAU-INTRO', V()) });
    sc.blocks.push({ t: 'h', text: '盤の中心:' + mcStar.name + '(' + EL[mcStar.element] + ')' });
    if (mcStar.num === honmei) sc.blocks.push({ t: 'p', text: pick('CAU-CENTER', V({ period: monthLabel })) });
    else sc.blocks.push({ t: 'p', text: pick('CAU-REL-' + cauRel, V({ period: monthLabel, center: mcStar.name, centerEl: EL[mcStar.element] })) });
    sc.blocks.push({ t: 'p', text: pick('CAU-EL-' + mcStar.element, V()) });
    sc.blocks.push({ t: 'p', text: 'ひとこと注意:' + cardCaution + '。', key: 'caution' });
    sc.blocks.push({ t: 'label', text: '根拠:九星気学(' + targetMonth + '月の盤・五行)・相談テーマ' });

    // ================= 5. 最後の問いかけ =================
    var sq = { id: 'question', title: T.question, blocks: [] };
    sq.blocks.push({ t: 'question', text: pick('QUE-' + th, V()) });
    sq.blocks.push({ t: 'p', text: pick('OUTRO', V()) });

    // ================= 付録 =================
    var appendix = [];
    // 根拠の詳細
    var ab = { id: 'app-basis', title: T.appBasis, appendix: true, blocks: [] };
    ab.blocks.push({ t: 'h', text: '西洋占星術', framework: F.western });
    ab.blocks.push({ t: 'table', head: ['天体', 'サイン', '表すもの'], rows: planets.map(function (p) { return [p.name, astro.signLabel(p), pick('PLANET-' + p.id)]; }) });
    var timeNote = input.birth.timeKnown
      ? '出生時刻 ' + input.birth.hh + ':' + (input.birth.mm < 10 ? '0' : '') + input.birth.mm + '(日本時間)で計算しています。'
      : '出生時刻が不明のため正午(12:00)で計算し、その日のうちにサインが変わる天体は「AまたはB」と両方を表示しています。';
    ab.blocks.push({ t: 'note', text: timeNote + 'ハウス・ASC(上昇宮)は扱いません。出生地' + (input.birthPref ? '(' + input.birthPref + ')' : '') + 'はサインの計算には影響しません。' });
    var sunMain = pl.sun.sign;
    if (pl.sun.ambiguous) {
      var a0 = pl.sun.alternatives[0], a1 = pl.sun.alternatives[1];
      ab.blocks.push({ t: 'p', text: '太陽星座は' + a0.name + '(' + P['SIGN-' + a0.id].kw + ')または' + a1.name + '(' + P['SIGN-' + a1.id].kw + ')。生まれた日に太陽が星座を移っているため、正午時点の' + sunMain.name + 'で読んでいます。' + pick('SIGN-' + sunMain.id, V()) });
    } else {
      ab.blocks.push({ t: 'p', text: '太陽星座は' + sunMain.name + '「' + P['SIGN-' + sunMain.id].kw + '」。' + pick('SIGN-' + sunMain.id, V()) });
    }
    ab.blocks.push({ t: 'p', text: pick('MOON-' + pl.moon.sign.element, V()) });
    ab.blocks.push({ t: 'h', text: '数秘術', framework: F.numerology });
    ab.blocks.push({
      t: 'table', head: ['項目', '数', '計算'], birthCols: [2],
      rows: [
        ['ライフパスナンバー', lp.value + (lp.master ? '(マスターナンバー)' : ''), lp.digits.split('').join('+') + ' = ' + lp.steps.join(' → ')],
        ['バースデーナンバー', bd.value + (bd.master ? '(マスターナンバー)' : ''), bd.steps.join(' → ')]
      ]
    });
    ab.blocks.push({ t: 'p', text: 'ライフパスナンバー' + lp.value + '「' + P['LP-' + lp.value].kw + '」。' + pick('LP-' + lp.value, V()) + 'バースデーナンバー' + bd.value + 'からは「' + pick('BD-' + bd.value, V()) + '」が読みとれます。' });
    ab.blocks.push({ t: 'h', text: '九星気学', framework: F.kyusei });
    ab.blocks.push({
      t: 'table', head: ['項目', '星', '補足'], birthCols: [2],
      rows: [
        ['本命星', ks.honmei.name, '気学上の生まれ年:' + ks.kigakuYear + '年(立春が年の始まり)'],
        ['月命星', ks.getsumei.name, '気学上の生まれ月:' + ks.monthBranch + '月(節入りが月の始まり)']
      ]
    });
    if (ks.boundary) {
      ab.blocks.push({ t: 'note', birthInfo: true, text: '生まれた日が' + ks.boundary.name + '(' + fmtYMDHM(ks.boundary.date) + ' 日本時間)の当日です。出生時刻が不明のため節入り後として計算しました。節入りより前の生まれなら、本命星は' + ks.boundary.alt.honmei.name + '・月命星は' + ks.boundary.alt.getsumei.name + 'になります。' });
    }
    ab.blocks.push({ t: 'p', text: '本命星は' + ks.honmei.name + '「' + P['STAR-' + honmei].kw + '」。' + pick('STAR-' + honmei, V()) + pick('GETSU', V()) });
    var yP = kyusei.palaceInfo(yearPalaceId);
    ab.blocks.push({ t: 'p', text: yearLabel + 'の流れ:' + pick('TIM-YEAR-' + yearPhase, V({ yearPalace: yearPalaceId === 'C' ? '本命星が年の盤の中央にある巡り' : '本命星が年の盤の' + yP.name + 'にある巡り' })) });
    ab.blocks.push({ t: 'note', text: '季節フェーズは、本命星が年の盤・月の盤のどこにあるかで判定しています(坤・震=種まき/巽=拡大/中央=転換期/乾・兌・離=収穫/艮・坎=整備)。戦略は「年の流れ×1+月の流れ×2」の点数で決めています。' });
    ab.blocks.push({ t: 'h', text: '性格の5因子', framework: F.bigfive });
    ab.blocks.push({ t: 'bars', items: bigfive.FACTORS.map(function (f) { var rr = bf[f.id]; return { label: f.name, value: rr.value, level: bigfive.LEVEL_NAMES[rr.level], low: f.low, high: f.high }; }) });
    ab.blocks.push({ t: 'list', items: bigfive.FACTORS.map(function (f) { return f.name + '(' + bigfive.LEVEL_NAMES[bf[f.id].level] + '):' + pick('BF-' + f.id + '-' + bf[f.id].level, V()); }) });
    ab.blocks.push({ t: 'h', text: '人物像の4軸の計算' });
    ab.blocks.push({
      t: 'table', head: ['軸', 'Big Five(60%)', '占い(40%)', '合計'],
      rows: pers.axes.map(function (a) { return [a.label, (a.bf >= 0 ? '+' : '') + a.bf.toFixed(2), (a.fortune >= 0 ? '+' : '') + a.fortune.toFixed(2), (a.score >= 0 ? '+' : '') + a.score.toFixed(2)]; })
    });
    ab.blocks.push({ t: 'note', text: '各軸は −1〜+1。Big Five は回答の値(1〜7)を −1〜+1 に直して使い、占いは太陽星座・月星座(半分の重み)・ライフパス・本命星の変換表の平均です。いちばん大きく偏った軸の側を「アクセル」、2番目を「ブレーキ」としています。' });
    appendix.push(ab);

    // 方位の全一覧
    var ad = { id: 'app-dirs', title: T.appDirs, appendix: true, blocks: [] };
    function mark(d) {
      if (d.bad.length) return '×' + d.bad.map(function (b) { return BAD_NAMES[b]; }).join('・');
      if (d.good === 'best') return '◎最大吉方';
      if (d.good === 'good') return '○吉方';
      return '-';
    }
    ad.blocks.push({ t: 'table', head: ['方位', yearLabel.replace('今年', cur.kigakuYear + '年'), monthLabel, input.homePref + 'から見た地域例'], rows: kyusei.PALACES.map(function (p, i) {
      var rn = regions[p.id].slice(0, 3).map(function (x) { return x.name.replace(/[都府県]$/, '') + '(' + geo.SCALE_NAMES[x.scale] + ')'; }).join('・') || '(この方角に県庁所在地なし)';
      return [p.name, cur.year.directions[i].star.short + ' ' + mark(cur.year.directions[i]), cur.month.directions[i].star.short + ' ' + mark(cur.month.directions[i]), rn];
    }) });
    var mixM = [], mixY = [];
    kyusei.PALACES.forEach(function (p, i) {
      var yd = cur.year.directions[i], md = cur.month.directions[i];
      if (md.good && yd.bad.length) mixM.push(p.name);
      if (yd.good && md.bad.length) mixY.push(p.name);
    });
    if (mixM.length) ad.blocks.push({ t: 'p', text: pick('DIR-MIXED-MONTH', V({ dirs: mixM.join('・') })) });
    if (mixY.length) ad.blocks.push({ t: 'p', text: pick('DIR-MIXED-YEAR', V({ dirs: mixY.join('・') })) });
    if (yearPalaceId === 'C') ad.blocks.push({ t: 'p', text: pick('DIR-CENTER', V()) });
    ad.blocks.push({ t: 'note', text: 'カード画像と本文の「方角の使い方」は、' + targetMonth + '月の盤だけで判断しています(避けたい方位はカードでは優先順に最大2つ)。方角は地図上の北が基準で、東西南北を30°、斜めの4方位を60°で区切っています。地域例は都道府県庁所在地どうしの方角と距離(近場:100km未満/中距離:400km未満/遠方:400km以上)です。' });
    appendix.push(ad);

    // 用語集
    var ag = { id: 'app-gloss', title: T.appGloss, appendix: true, blocks: [] };
    ag.blocks.push({ t: 'gloss', items: Object.keys(P).filter(function (k) { return k.indexOf('GLOSS-') === 0; }).map(function (k) { return { term: P[k].title, text: P[k].v[0] }; }) });
    appendix.push(ag);

    // ================= 0. 要約と目次 =================
    var s0 = { id: 'summary', title: T.summary, blocks: [] };
    s0.blocks.push({ t: 'p', text: pick('INTRO', V()) });
    s0.blocks.push({
      t: 'summary', items: [
        { label: targetMonth + '月の指針', text: '「' + guideName + '」' + guideDesc },
        { label: '人物像', text: 'アクセル=' + accelName + '/ブレーキ=' + brakeName },
        { label: '吉方位', text: goodOrdered.length ? goodOrdered.map(function (d) { return d.palace.name; }).join('・') + '(' + targetMonth + '月の盤)' : texts.card.noGood },
        { label: '避けたい方位', text: avoid.length ? avoid.map(function (p) { return p.name; }).join('・') + (monthBad.length > 2 ? 'など' : '') : texts.card.noBad },
        { label: 'ラッキーデー', text: lucky.days.length ? lucky.days.map(function (d, i) { return dayLabel(d.date) + '「' + luckyUses[i].tag + '」'; }).join('・') : texts.card.noDays },
        { label: '行動のヒント', list: cardActions },
        { label: '気をつけること', text: cardCaution }
      ]
    });
    var toc = [
      { id: 'guide', text: sg.title }, { id: 'persona', text: sp.title }, { id: 'strategy', text: ss.title }
    ].concat(['s31', 's32', 's33', 's34', 's35', 's36'].map(function (id) {
      var h = ss.blocks.filter(function (b) { return b.id === id; })[0];
      return { id: id, text: h.text, sub: true };
    })).concat([{ id: 'caution', text: sc.title }, { id: 'question', text: sq.title }, { id: 'appendix', text: T.appendix + '(根拠の詳細・方位の全一覧・用語集)' }]);
    s0.blocks.push({ t: 'toc', items: toc });

    sections.push(s0, sg, sp, ss, sc, sq);

    // ================= AI相談・カード =================
    var aiPrompt = pick('AI-PROMPT', V({
      situation: hasSit ? '(今の状況:' + sitLabel + ')' : '',
      cool: cools.length ? cools.map(function (c) { return c.label; }).join('・') : '(未回答)',
      success: success ? success.label : '(未回答)'
    }));
    var cardT = texts.card;
    var card = {
      month: targetMonth,
      yearMonth: cur.target.calendarYear + '.' + (targetMonth < 10 ? '0' : '') + targetMonth,
      lead: fill(cardT.lead, { name: name, month: targetMonth }),
      guideName: guideName,
      guideDesc: guideDesc,
      goodDirs: goodOrdered.map(function (d) { return { id: d.palace.id, name: d.palace.name }; }),
      needle: needleDir ? needleDir.palace.id : null,
      doThere: dirPairs.length ? dirPairs[0].act : P['DIR-ACT-' + th].v[0],
      color: lcolor.color,
      badDirs: avoid.map(function (p) { return { id: p.id, name: p.name }; }),
      badMore: monthBad.length > 2,
      caution: cardCaution,
      luckyDays: lucky.days.map(function (d) { return dayLabel(d.date); }),
      actions: cardActions,
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
      appendix: appendix,
      appendixTitle: T.appendix,
      aiPrompt: aiPrompt,
      disclaimer: texts.disclaimer,
      usedParts: used,
      data: {
        planets: planets, lifePath: lp, birthday: bd, kyusei: ks, bigfive: bf, current: cur, stance: stance, stanceCapped: capped,
        yearPhase: yearPhase, monthPhase: monthPhase, lucky: lucky, luckyUses: luckyUses, friends: friends, luckyColor: lcolor,
        situation: hasSit ? [s1id, s2id] : [], guide: { name: guideName, desc: guideDesc }, persona: pers,
        accelName: accelName, brakeName: brakeName, monthLabel: monthLabel, yearLabel: yearLabel, dirLines: dirLines,
        extra: { cool: coolIds, success: success ? success.id : null }
      }
    };
  }

  // ================= 人物像の軸:数字を使わない表し方 =================
  // 5段階: かなり左 / やや左 / ほぼ中間 / やや右 / かなり右(しきい値 0.15・0.6)
  function axisStep(score) {
    if (score <= -0.6) return 0;
    if (score < -0.15) return 1;
    if (score <= 0.15) return 2;
    if (score < 0.6) return 3;
    return 4;
  }
  function axisScale(score) {
    var i = axisStep(score), out = '';
    for (var k = 0; k < 5; k++) out += k === i ? '■' : '□';
    return out;
  }
  function axisWord(a) {
    var i = axisStep(a.score);
    return ['かなり' + a.minusName + '寄り', 'やや' + a.minusName + '寄り', 'ほぼ中間', 'やや' + a.plusName + '寄り', 'かなり' + a.plusName + '寄り'][i];
  }

  // ================= 書き出し =================
  // opts.hideBirth: 生年月日がわかる部分(数秘術の計算式・気学上の生まれ年など)を伏せる
  function blockToText(b, md, opts) {
    opts = opts || {};
    if (opts.hideBirth && b.birthInfo) return null;
    switch (b.t) {
      case 'p': return b.text;
      case 'note': return md ? '> ※' + b.text : '※' + b.text;
      case 'label': return md ? '<sub>' + b.text + '</sub>' : '(' + b.text + ')';
      case 'h': return (md ? '##### ' : '■') + b.text + (b.framework ? (md ? '\n\n*根拠:' + b.framework + '*' : '(根拠:' + b.framework + ')') : '');
      case 'list': return b.items.map(function (x) { return '- ' + x; }).join('\n');
      case 'olist': return b.items.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
      case 'card': return (md ? '**' + b.title + '**\n\n' : '◆' + b.title + '\n') + b.text + (b.sub ? (md ? '\n\n' : '\n') + b.sub : '');
      case 'question': return (md ? '> **' : 'Q. ') + b.text + (md ? '**' : '');
      case 'guide': return (md ? '> ### 「' + b.name + '」\n>\n> ' : '「' + b.name + '」\n') + b.text;
      case 'color': return (md ? '**' + b.name + '**(' + b.hex + ')\n\n' : '') + b.text;
      case 'pair': return (md ? '**' : '') + 'アクセル(強み):' + b.accel + '/ブレーキ(盲点):' + b.brake + (md ? '**' : '');
      case 'axes': return b.items.map(function (a) { return '- ' + a.minusName + ' ' + axisScale(a.score) + ' ' + a.plusName + '(' + axisWord(a) + ')'; }).join('\n');
      case 'plan': return b.groups.map(function (g) { return (md ? '**' + g.label + '**\n\n' : '【' + g.label + '】\n') + g.items.map(function (x) { return '- ' + x; }).join('\n'); }).join(md ? '\n\n' : '\n');
      case 'summary': return b.items.map(function (it) {
        return '- ' + (md ? '**' + it.label + '**' : it.label) + ':' + (it.list ? '\n' + it.list.map(function (x, i) { return '  ' + (i + 1) + '. ' + x; }).join('\n') : it.text);
      }).join('\n');
      case 'toc': return (md ? '' : '目次\n') + b.items.map(function (it) { return (it.sub ? '  - ' : '- ') + it.text; }).join('\n');
      case 'gloss': return b.items.map(function (it) { return '- ' + (md ? '**' + it.term + '**' : it.term) + ':' + it.text; }).join('\n');
      case 'table':
        var rows = b.rows.map(function (rr) {
          return rr.map(function (c, i) { return opts.hideBirth && b.birthCols && b.birthCols.indexOf(i) !== -1 ? '(省略)' : c; });
        });
        if (md) {
          var esc = function (s) { return String(s).replace(/\|/g, '\\|'); };
          return '| ' + b.head.map(esc).join(' | ') + ' |\n|' + b.head.map(function () { return ' --- '; }).join('|') + '|\n' +
            rows.map(function (rr) { return '| ' + rr.map(esc).join(' | ') + ' |'; }).join('\n');
        }
        return rows.map(function (rr) { return rr.filter(function (x) { return x !== ''; }).join(' / '); }).join('\n');
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

  function sectionText(s, md, opts) {
    var out = [(md ? '#### ' : '\n――――――――――\n') + s.title];
    s.blocks.forEach(function (b) { var t = blockToText(b, md, opts); if (t !== null) out.push(t); });
    return out.join(md ? '\n\n' : '\n');
  }

  function toText(rep, md, opts) {
    opts = opts || {};
    var out = [(md ? '**' : '【') + rep.title + (md ? '**(基準日:' + rep.generatedFor + ')' : '】') + (md ? '' : '\n基準日:' + rep.generatedFor)];
    if (!opts.hideBirth && !md) out.push('生年月日:' + rep.birthText);
    rep.sections.forEach(function (s) { out.push(sectionText(s, md, opts)); });
    if (!opts.noAppendix) {
      if (md) {
        out.push('<details><summary>' + rep.appendixTitle + '(根拠の詳細・方位の全一覧・用語集)</summary>');
        rep.appendix.forEach(function (s) { out.push(sectionText(s, md, opts)); });
        out.push('</details>');
      } else {
        out.push('\n――――――――――\n' + rep.appendixTitle);
        rep.appendix.forEach(function (s) { out.push(sectionText(s, md, opts)); });
      }
    }
    out.push(md ? '> ' + rep.disclaimer : '\n' + rep.disclaimer);
    return out.join(md ? '\n\n' : '\n');
  }

  /** AI相談用: 相談文 + 全文 */
  function clipboardText(rep, opts) {
    return rep.aiPrompt + '\n\n==========\n' + toText(rep, false, opts || { hideBirth: true });
  }

  /** 共有用の要約(指針・人物像・吉方位・ラッキーデー・行動のヒント・URL) */
  function summaryText(rep, texts, opts) {
    opts = opts || {};
    var S = texts.share, c = rep.card;
    var lines = [fill(S.head, { name: rep.nickname, month: c.month, guide: c.guideName }), c.guideDesc];
    if (opts.includeBirth) lines.push(fill(S.birth, { birth: rep.birthText }));
    lines.push(fill(S.persona, { accel: rep.data.accelName, brake: rep.data.brakeName }));
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

  /** 文字数(章ごと)。ブロックの中の文字を数える(目次は数えない) */
  function blockChars(b) {
    switch (b.t) {
      case 'toc': return 0;
      case 'list': case 'olist': return b.items.join('').length;
      case 'card': return (b.title + b.text + (b.sub || '')).length;
      case 'guide': return (b.name + b.text).length;
      case 'pair': return (b.accel + b.brake).length + 16;
      case 'axes': return b.items.map(function (a) { return a.label; }).join('').length;
      case 'plan': return b.groups.map(function (g) { return g.label + g.items.join(''); }).join('').length;
      case 'summary': return b.items.map(function (it) { return it.label + (it.text || '') + (it.list ? it.list.join('') : ''); }).join('').length;
      case 'table': return b.rows.map(function (r) { return r.join(''); }).join('').length;
      case 'bars': return b.items.length * 12;
      case 'gloss': return b.items.map(function (it) { return it.term + it.text; }).join('').length;
      default: return (b.text || '').length;
    }
  }
  function sectionChars(s) { return s.title.length + s.blocks.reduce(function (n, b) { return n + blockChars(b); }, 0); }

  return { axisStep: axisStep, axisScale: axisScale, axisWord: axisWord, build: build, toText: toText, clipboardText: clipboardText, summaryText: summaryText, fill: fill, hash: hash, sectionChars: sectionChars, blockToText: blockToText };
});
