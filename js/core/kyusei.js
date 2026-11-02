/*
 * COMPASS - 九星気学
 *
 * 【採用したルール】
 * - 年の区切り: 立春(太陽黄経315°)。立春の瞬間より前は前年扱い。
 * - 月の区切り: 二十四節気の「節」(太陽黄経 315°,345°,15°,…,285° の30°ごと)。
 *   寅月(立春〜啓蟄の前)を1番目の月とする。
 *   立春・節入りの日時は astronomy-engine で毎回計算する(表を持たない)。
 * - 本命星: (11 - 年 mod 9) mod 9、0は9(九紫)。
 * - 月命星: 年の本命星のグループごとに寅月の星が決まり、1か月ごとに1つずつ減る。
 *     一白・四緑・七赤の年 → 寅月 八白
 *     三碧・六白・九紫の年 → 寅月 五黄
 *     二黒・五黄・八白の年 → 寅月 二黒
 * - 出生時刻が不明で、生まれた日が立春・節入りの当日の場合:
 *     「節入り当日は新しい期間に入る」として計算し、境界フラグを立てて表示する。
 * - 方位盤: 中宮の星を c とすると、後天定位で n だった宮には (n - 5 + c) の星が入る(1〜9で循環)。
 * - 方位の区分: 東西南北は各30°、北東・南東・南西・北西は各60°(九星気学で一般的な区分)。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./astro.js'));
  } else {
    root.Compass = root.Compass || {};
    root.Compass.kyusei = factory(root.Compass.astro);
  }
})(typeof self !== 'undefined' ? self : this, function (astro) {
  'use strict';

  var STARS = {
    1: { num: 1, name: '一白水星', short: '一白', element: 'water' },
    2: { num: 2, name: '二黒土星', short: '二黒', element: 'earth' },
    3: { num: 3, name: '三碧木星', short: '三碧', element: 'wood' },
    4: { num: 4, name: '四緑木星', short: '四緑', element: 'wood' },
    5: { num: 5, name: '五黄土星', short: '五黄', element: 'earth' },
    6: { num: 6, name: '六白金星', short: '六白', element: 'metal' },
    7: { num: 7, name: '七赤金星', short: '七赤', element: 'metal' },
    8: { num: 8, name: '八白土星', short: '八白', element: 'earth' },
    9: { num: 9, name: '九紫火星', short: '九紫', element: 'fire' }
  };

  var ELEMENT_NAMES = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

  // 相生: key が value を生む
  var GENERATES = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
  // 相剋: key が value を剋す
  var CONTROLS = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

  // 宮(方位)。home = 後天定位の星番号
  var PALACES = [
    { id: 'N', name: '北', home: 1, gua: '坎宮', center: 0 },
    { id: 'NE', name: '北東', home: 8, gua: '艮宮', center: 45 },
    { id: 'E', name: '東', home: 3, gua: '震宮', center: 90 },
    { id: 'SE', name: '南東', home: 4, gua: '巽宮', center: 135 },
    { id: 'S', name: '南', home: 9, gua: '離宮', center: 180 },
    { id: 'SW', name: '南西', home: 2, gua: '坤宮', center: 225 },
    { id: 'W', name: '西', home: 7, gua: '兌宮', center: 270 },
    { id: 'NW', name: '北西', home: 6, gua: '乾宮', center: 315 }
  ];
  var CENTER = { id: 'C', name: '中央', home: 5, gua: '中宮' };
  var OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', SE: 'NW', NW: 'SE' };

  var BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var BRANCH_PALACE = { '子': 'N', '丑': 'NE', '寅': 'NE', '卯': 'E', '辰': 'SE', '巳': 'SE', '午': 'S', '未': 'SW', '申': 'SW', '酉': 'W', '戌': 'NW', '亥': 'NW' };

  // 節(月の始まり)。index 0 = 寅月
  var SETSU = [
    { name: '立春', lon: 315 }, { name: '啓蟄', lon: 345 }, { name: '清明', lon: 15 },
    { name: '立夏', lon: 45 }, { name: '芒種', lon: 75 }, { name: '小暑', lon: 105 },
    { name: '立秋', lon: 135 }, { name: '白露', lon: 165 }, { name: '寒露', lon: 195 },
    { name: '立冬', lon: 225 }, { name: '大雪', lon: 255 }, { name: '小寒', lon: 285 }
  ];
  var MONTH_BRANCH = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

  function wrap9(n) { var r = ((n - 1) % 9 + 9) % 9; return r + 1; }

  function yearStarOf(year) {
    var r = (11 - (((year % 9) + 9) % 9)) % 9;
    return r === 0 ? 9 : r;
  }

  function monthStartStar(yearStar) {
    if ([1, 4, 7].indexOf(yearStar) !== -1) return 8;
    if ([3, 6, 9].indexOf(yearStar) !== -1) return 5;
    return 2; // 2,5,8
  }

  function monthStarOf(yearStar, monthIndex /* 1=寅月 … 12=丑月 */) {
    return wrap9(monthStartStar(yearStar) - (monthIndex - 1));
  }

  function jstParts(date) {
    var j = new Date(date.getTime() + 9 * 3600 * 1000);
    return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate() };
  }

  /** ある瞬間の「気学上の年・月」 */
  function periodAt(date) {
    var lon = astro.sunLongitude(date);
    var monthIndex = Math.floor((((lon - 315) % 360) + 360) % 360 / 30) + 1; // 1..12
    var p = jstParts(date);
    var year = p.y;
    if (p.m <= 2 && monthIndex >= 11) year -= 1; // 1月〜立春前(子月・丑月)は前年
    return { year: year, monthIndex: monthIndex, sunLon: lon };
  }

  /** 指定した節の日時(その年のもの)を探す */
  function setsuDate(year, monthIndex) {
    var s = SETSU[monthIndex - 1];
    // 節は毎月4〜8日ごろ。寅月=2月 … 子月=12月、丑月(小寒)は翌年1月。その月の1日から探す
    var start = monthIndex === 12 ? astro.jstToDate(year + 1, 1, 1) : astro.jstToDate(year, monthIndex + 1, 1);
    return astro.searchSunLongitude(s.lon, start, 40);
  }

  function risshun(year) { return setsuDate(year, 1); }

  /**
   * 出生データ → 本命星・月命星
   * @param {{y,m,d,hh,mm,timeKnown}} b
   */
  function birthStars(b) {
    var boundary = null;
    var moment;
    if (b.timeKnown) {
      moment = astro.jstToDate(b.y, b.m, b.d, b.hh, b.mm);
    } else {
      var start = astro.jstToDate(b.y, b.m, b.d, 0, 0, 0);
      var end = new Date(astro.jstToDate(b.y, b.m, b.d + 1, 0, 0, 0).getTime() - 1000);
      var ps = periodAt(start), pe = periodAt(end);
      if (ps.monthIndex !== pe.monthIndex) {
        var setsuName = SETSU[pe.monthIndex - 1].name;
        var exact = setsuDate(pe.year, pe.monthIndex);
        boundary = {
          name: setsuName,
          date: exact,
          isRisshun: pe.monthIndex === 1,
          before: { year: ps.year, monthIndex: ps.monthIndex },
          after: { year: pe.year, monthIndex: pe.monthIndex }
        };
      }
      moment = end; // 節入り当日は新しい期間として扱う
    }
    var per = periodAt(moment);
    var honmei = yearStarOf(per.year);
    var getsumei = monthStarOf(honmei, per.monthIndex);
    var result = {
      kigakuYear: per.year,
      monthIndex: per.monthIndex,
      monthBranch: MONTH_BRANCH[per.monthIndex - 1],
      honmei: STARS[honmei],
      getsumei: STARS[getsumei],
      boundary: boundary
    };
    if (boundary) {
      var bh = yearStarOf(boundary.before.year);
      result.boundary.alt = {
        honmei: STARS[bh],
        getsumei: STARS[monthStarOf(bh, boundary.before.monthIndex)]
      };
    }
    return result;
  }

  /** 中宮の星 → 盤(宮ID → 星番号) */
  function makeBoard(centerStar) {
    var board = { C: centerStar };
    PALACES.forEach(function (p) { board[p.id] = wrap9(p.home - 5 + centerStar); });
    return board;
  }

  function palaceOfStar(board, star) {
    var keys = Object.keys(board);
    for (var i = 0; i < keys.length; i++) if (board[keys[i]] === star) return keys[i];
    return null;
  }

  /** 五行の関係: a(相手の星) が b(本命) に対してどう働くか */
  function relation(otherEl, selfEl) {
    if (otherEl === selfEl) return 'same';          // 比和
    if (GENERATES[otherEl] === selfEl) return 'supports'; // 相手が自分を生む(生気)
    if (GENERATES[selfEl] === otherEl) return 'drains';   // 自分が相手を生む(退気)
    if (CONTROLS[otherEl] === selfEl) return 'pressures'; // 相手が自分を剋す(殺気)
    return 'controls';                                   // 自分が相手を剋す(死気)
  }

  /**
   * 盤と本命星から、各方位の吉凶を判定
   * @param {number} centerStar 盤の中宮
   * @param {string} branch 年または月の十二支
   * @param {number} honmei 本命星
   * @param {'year'|'month'} kind
   */
  function evaluateBoard(centerStar, branch, honmei, kind) {
    var board = makeBoard(centerStar);
    var selfEl = STARS[honmei].element;
    var bad = {}; // palaceId -> [reasons]
    function mark(pid, reason) { if (!pid || pid === 'C') return; (bad[pid] = bad[pid] || []).push(reason); }

    var goou = palaceOfStar(board, 5);
    if (goou !== 'C') { mark(goou, 'gooSatsu'); mark(OPPOSITE[goou], 'ankenSatsu'); }
    var breakP = OPPOSITE[BRANCH_PALACE[branch]];
    mark(breakP, kind === 'year' ? 'saiha' : 'geppa');
    var hp = palaceOfStar(board, honmei);
    if (hp !== 'C') { mark(hp, 'honmeiSatsu'); mark(OPPOSITE[hp], 'honmeiTekiSatsu'); }

    var directions = PALACES.map(function (p) {
      var star = board[p.id];
      var rel = relation(STARS[star].element, selfEl);
      var good = null;
      if (!bad[p.id] && star !== 5 && star !== honmei) {
        if (rel === 'supports') good = 'best';
        else if (rel === 'same' || rel === 'drains') good = 'good';
      }
      return { palace: p, star: STARS[star], relation: rel, bad: bad[p.id] || [], good: good };
    });

    return {
      centerStar: STARS[centerStar],
      branch: branch,
      board: board,
      honmeiPalace: hp,
      directions: directions
    };
  }

  /**
   * 「〇月の指針」の対象になる瞬間
   * 各カレンダー月には「節」がちょうど1つある(立春は2月、小寒は1月…、4〜8日ごろ)。
   * 「M月」= M月の節入りから始まる気学の月、とする。
   * 例) 11月2日に見る → 11月の節(立冬 11/7ごろ)前なので、11/7から始まる月を「11月」として見る。
   *     11月20日に見る → すでに立冬後なので、そのまま。
   * 年盤もこの瞬間で決める(2月1日なら、2/4ごろの立春から始まる新しい年)。
   */
  function targetMoment(now) {
    var p = jstParts(now);
    var setsu = p.m === 1 ? setsuDate(p.y - 1, 12) : setsuDate(p.y, p.m - 1);
    if (now.getTime() < setsu.getTime()) {
      return { date: new Date(setsu.getTime() + 60000), calendarMonth: p.m, calendarYear: p.y, beforeSetsu: true, setsu: setsu };
    }
    return { date: now, calendarMonth: p.m, calendarYear: p.y, beforeSetsu: false, setsu: setsu };
  }

  /** 今日(またはテスト用の日時)の年盤・月盤と、本命星から見た方位(対象月は targetMoment で決める) */
  function currentFortune(now, honmei) {
    var tm = targetMoment(now);
    var per = periodAt(tm.date);
    var yStar = yearStarOf(per.year);
    var mStar = monthStarOf(yStar, per.monthIndex);
    var yBranch = BRANCHES[(((per.year - 4) % 12) + 12) % 12];
    var mBranch = MONTH_BRANCH[per.monthIndex - 1];
    var year = evaluateBoard(yStar, yBranch, honmei, 'year');
    var month = evaluateBoard(mStar, mBranch, honmei, 'month');
    var nextIdx = per.monthIndex === 12 ? 1 : per.monthIndex + 1;
    var nextYear = per.monthIndex === 12 ? per.year + 1 : per.year;
    return {
      asOf: now,
      target: tm,
      kigakuYear: per.year,
      monthIndex: per.monthIndex,
      monthStart: setsuDate(per.year, per.monthIndex),
      monthEnd: setsuDate(nextYear, nextIdx),
      year: year,
      month: month
    };
  }

  // ===================== 日盤(日家九星) =====================
  /*
   * - 日の干支: 2026-06-19 を甲子(干支番号0)として60日周期で数える(日本時間の日付)。
   * - 陽遁: 冬至に最も近い甲子日から。甲子日を一白とし、1日ごとに 1→2→…→9→1 と進む。
   * - 陰遁: 夏至に最も近い甲子日から。甲子日を九紫とし、1日ごとに 9→8→…→1→9 と戻る。
   * - 閏: 上の決め方だと切り替えの間隔が240日になる場合がある。そのときは
   *   切り替えを30日早い甲午日にし、陽遁は七赤、陰遁は三碧から始める
   *   (こうすると次の甲子日が一白/九紫になり、流れがつながる)。
   *   結果として、遁の期間はいつも180日または210日になる。
   */
  var DAY_MS = 86400000;
  function dayNumber(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS); }
  function dayNumberOfDate(date) { return Math.floor((date.getTime() + 9 * 3600 * 1000) / DAY_MS); }
  function dateOfDayNumber(dn) { var j = new Date(dn * DAY_MS); return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate(), dow: j.getUTCDay() }; }
  var KOSHI_REF = dayNumber(2026, 6, 19);
  function kanshiIndex(dn) { return (((dn - KOSHI_REF) % 60) + 60) % 60; }
  function dayBranch(dn) { return BRANCHES[kanshiIndex(dn) % 12]; }

  var solsticeCache = {};
  function solstices(year) {
    if (!solsticeCache[year]) {
      solsticeCache[year] = [
        { kind: 'yin', time: astro.searchSunLongitude(90, astro.jstToDate(year, 6, 1), 40) },
        { kind: 'yang', time: astro.searchSunLongitude(270, astro.jstToDate(year, 12, 1), 40) }
      ];
    }
    return solsticeCache[year];
  }

  /** 至(夏至・冬至)に最も近い甲子日の日番号 */
  function nearestKoshi(time) {
    var t = (time.getTime() + 9 * 3600 * 1000) / DAY_MS; // 日本時間の通日(小数)
    var base = Math.floor(t);
    var before = base - kanshiIndex(base);
    var after = before + 60;
    return (Math.abs(before + 0.5 - t) <= Math.abs(after + 0.5 - t)) ? before : after;
  }

  /** dn を含む前後の、陽遁・陰遁の切り替え点(閏を反映済み) */
  function switchPoints(y) {
    var list = [];
    for (var yy = y - 3; yy <= y + 1; yy++) {
      solstices(yy).forEach(function (s) { list.push({ kind: s.kind, solstice: s.time, nominal: nearestKoshi(s.time) }); });
    }
    list.sort(function (a, b) { return a.nominal - b.nominal; });
    list.forEach(function (sp, i) {
      sp.day = sp.nominal;
      sp.leap = false;
      if (i > 0 && sp.nominal - list[i - 1].nominal === 240) { sp.day = sp.nominal - 30; sp.leap = true; }
      sp.startStar = sp.kind === 'yang' ? (sp.leap ? 7 : 1) : (sp.leap ? 3 : 9);
    });
    return list;
  }

  function dayStar(dn) {
    var y = dateOfDayNumber(dn).y;
    var pts = switchPoints(y);
    var cur = null;
    for (var i = 0; i < pts.length; i++) if (pts[i].day <= dn) cur = pts[i];
    var k = dn - cur.day;
    var star = cur.kind === 'yang' ? wrap9(cur.startStar + k) : wrap9(cur.startStar - k);
    return { star: star, kind: cur.kind, since: cur.day, leap: cur.leap, branch: dayBranch(dn) };
  }

  /**
   * ラッキーデー(本命星と相性のよい日)
   * 期間: 今日〜今月末。今月の残りが10日未満なら来月末まで。
   * 候補: 日の九星が本命星と 相生(生気=日の星が自分を生む > 退気=自分が日の星を生む) または 比和。
   *       吉方位と同じ考え方で、五黄の日・本命星と同じ星の日(本命星が中宮)は除く。
   * 除外: その日の盤で本命星が「暗剣殺」または「日破」の位置に入る日。
   * 順位: 生気 > 比和 > 退気、同じ順位なら早い日。最大3日を日付順に返す。
   */
  var REL_RANK = { supports: 3, same: 2, drains: 1 };
  function luckyDays(now, honmei, max) {
    max = max || 3;
    var start = dayNumberOfDate(now);
    var p = jstParts(now);
    var endOfMonth = dayNumber(p.y, p.m + 1, 1) - 1;
    var end = endOfMonth;
    var extended = false;
    if (endOfMonth - start + 1 < 10) { end = dayNumber(p.y, p.m + 2, 1) - 1; extended = true; }
    var selfEl = STARS[honmei].element;
    var cands = [];
    for (var dn = start; dn <= end; dn++) {
      var ds = dayStar(dn);
      if (ds.star === 5 || ds.star === honmei) continue;
      var rel = relation(STARS[ds.star].element, selfEl);
      if (!REL_RANK[rel]) continue;
      var board = makeBoard(ds.star);
      var hp = palaceOfStar(board, honmei);
      var anken = OPPOSITE[palaceOfStar(board, 5)];
      var nippa = OPPOSITE[BRANCH_PALACE[ds.branch]];
      if (hp === anken || hp === nippa) continue;
      cands.push({ dn: dn, date: dateOfDayNumber(dn), star: STARS[ds.star], relation: rel, rank: REL_RANK[rel], branch: ds.branch });
    }
    var picked = cands.slice().sort(function (a, b) { return (b.rank - a.rank) || (a.dn - b.dn); }).slice(0, max);
    picked.sort(function (a, b) { return a.dn - b.dn; });
    return { days: picked, start: dateOfDayNumber(start), end: dateOfDayNumber(end), extended: extended, candidates: cands.length };
  }

  // ===================== 相性の星・ラッキーカラー =====================
  /** 本命星と相生・比和の星 */
  function friendStars(honmei) {
    var selfEl = STARS[honmei].element;
    var out = { supports: [], same: [], drains: [] };
    for (var n = 1; n <= 9; n++) {
      var rel = relation(STARS[n].element, selfEl);
      if (out[rel]) out[rel].push(STARS[n]);
    }
    return out;
  }

  // 九星の伝統的な色(星の名前に入っている色)
  var STAR_COLORS = {
    1: { name: '白', hex: '#F4F1E8' }, 2: { name: '黒', hex: '#3A3A3A' }, 3: { name: '青', hex: '#3C8DD8' },
    4: { name: '緑', hex: '#3FAE5A' }, 5: { name: '黄', hex: '#F2C94C' }, 6: { name: '白', hex: '#F4F1E8' },
    7: { name: '赤', hex: '#D94B4B' }, 8: { name: '白', hex: '#F4F1E8' }, 9: { name: '紫', hex: '#9B6BD3' }
  };

  /**
   * ラッキーカラー(カードと同じく「〇月の盤」だけで判断する)
   * 1) preferId(カードの金色の針が指す方位)が今月の吉方位なら、そこにいる星の色
   * 2) なければ、今月の吉方位にいる星の色(最大吉方 > 生気 > 比和 > 退気 の順)
   * 3) 今月に吉方位がなければ、本命星を生む星(生気の星)のうち数字の小さい星の色
   */
  function luckyColor(fortune, honmei, preferId) {
    var rank = { supports: 3, same: 2, drains: 1 };
    var cands = fortune.month.directions.filter(function (d) { return d.good; })
      .sort(function (a, b) { return ((a.good === 'best' ? 0 : 1) - (b.good === 'best' ? 0 : 1)) || ((rank[b.relation] || 0) - (rank[a.relation] || 0)); });
    var pref = cands.filter(function (d) { return d.palace.id === preferId; })[0];
    var d = pref || cands[0];
    if (d) return { star: d.star, color: STAR_COLORS[d.star.num], rule: d.good === 'best' ? 'best' : 'good', palace: d.palace };
    var fs = friendStars(honmei).supports.filter(function (s) { return s.num !== 5; });
    var st = fs[0] || STARS[honmei];
    return { star: st, color: STAR_COLORS[st.num], rule: 'supports', palace: null };
  }

  /**
   * 季節フェーズ(本サービスの割り当て)
   * 本命星が入っている宮で、9年(9か月)で巡る運気の流れを季節にまとめる。
   *   坤宮・震宮 → 種まき(春)   巽宮 → 拡大(夏)
   *   乾宮・兌宮・離宮 → 収穫(秋) 艮宮・坎宮 → 整備(冬)
   *   中宮(八方塞がり) → 転換期(足元を固める) ※年・月とも同じ扱い
   */
  var PHASE_BY_PALACE = { SW: 'spring', E: 'spring', SE: 'summer', C: 'turning', NW: 'autumn', W: 'autumn', S: 'autumn', NE: 'winter', N: 'winter' };
  var PHASE_NAMES = { spring: '種まき(春)', summer: '拡大(夏)', turning: '転換期(足元を固める)', autumn: '収穫(秋)', winter: '整備(冬)' };

  function phaseOf(palaceId) { return PHASE_BY_PALACE[palaceId]; }

  function palaceInfo(id) {
    if (id === 'C') return CENTER;
    for (var i = 0; i < PALACES.length; i++) if (PALACES[i].id === id) return PALACES[i];
    return null;
  }

  /** 方位角(真北0°・時計回り) → 宮ID(30°/60°区分) */
  function palaceOfBearing(deg) {
    var a = ((deg % 360) + 360) % 360;
    if (a >= 345 || a < 15) return 'N';
    if (a < 75) return 'NE';
    if (a < 105) return 'E';
    if (a < 165) return 'SE';
    if (a < 195) return 'S';
    if (a < 255) return 'SW';
    if (a < 285) return 'W';
    return 'NW';
  }

  return {
    STARS: STARS,
    ELEMENT_NAMES: ELEMENT_NAMES,
    PALACES: PALACES,
    OPPOSITE: OPPOSITE,
    SETSU: SETSU,
    MONTH_BRANCH: MONTH_BRANCH,
    BRANCHES: BRANCHES,
    PHASE_NAMES: PHASE_NAMES,
    yearStarOf: yearStarOf,
    monthStarOf: monthStarOf,
    periodAt: periodAt,
    setsuDate: setsuDate,
    risshun: risshun,
    birthStars: birthStars,
    makeBoard: makeBoard,
    palaceOfStar: palaceOfStar,
    relation: relation,
    evaluateBoard: evaluateBoard,
    currentFortune: currentFortune,
    targetMoment: targetMoment,
    dayNumber: dayNumber,
    dayNumberOfDate: dayNumberOfDate,
    dateOfDayNumber: dateOfDayNumber,
    kanshiIndex: kanshiIndex,
    switchPoints: switchPoints,
    dayStar: dayStar,
    luckyDays: luckyDays,
    friendStars: friendStars,
    STAR_COLORS: STAR_COLORS,
    luckyColor: luckyColor,
    BRANCH_PALACE: BRANCH_PALACE,
    phaseOf: phaseOf,
    palaceInfo: palaceInfo,
    palaceOfBearing: palaceOfBearing
  };
});
