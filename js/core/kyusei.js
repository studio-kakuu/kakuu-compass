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

  /** 今日(またはテスト用の日時)の年盤・月盤と、本命星から見た方位 */
  function currentFortune(now, honmei) {
    var per = periodAt(now);
    var yStar = yearStarOf(per.year);
    var mStar = monthStarOf(yStar, per.monthIndex);
    var yBranch = BRANCHES[(((per.year - 4) % 12) + 12) % 12];
    var mBranch = MONTH_BRANCH[per.monthIndex - 1];
    var year = evaluateBoard(yStar, yBranch, honmei, 'year');
    var month = evaluateBoard(mStar, mBranch, honmei, 'month');
    var nextIdx = per.monthIndex === 12 ? 1 : per.monthIndex + 1;
    var nextYear = per.monthIndex === 12 ? per.year + 1 : per.year;
    return {
      kigakuYear: per.year,
      monthIndex: per.monthIndex,
      monthStart: setsuDate(per.year, per.monthIndex),
      monthEnd: setsuDate(nextYear, nextIdx),
      year: year,
      month: month
    };
  }

  /**
   * 季節フェーズ(本サービスの割り当て)
   * 本命星が入っている宮で、9年(9か月)で巡る運気の流れを4つの季節にまとめる。
   *   坤宮・震宮 → 種まき(春)   巽宮・中宮 → 拡大(夏)
   *   乾宮・兌宮・離宮 → 収穫(秋) 艮宮・坎宮 → 整備(冬)
   */
  var PHASE_BY_PALACE = { SW: 'spring', E: 'spring', SE: 'summer', C: 'summer', NW: 'autumn', W: 'autumn', S: 'autumn', NE: 'winter', N: 'winter' };
  var PHASE_NAMES = { spring: '種まき(春)', summer: '拡大(夏)', autumn: '収穫(秋)', winter: '整備(冬)' };

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
    phaseOf: phaseOf,
    palaceInfo: palaceInfo,
    palaceOfBearing: palaceOfBearing
  };
});
