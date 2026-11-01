/*
 * COMPASS - 西洋占星術(トロピカル・ジオセントリック)の計算
 * 天文計算は同梱の astronomy-engine (MIT) を使用。
 *
 * ルール
 * - 出生時刻は日本時間(JST = UTC+9、夏時間なし)として扱う。
 *   ※1948〜1951年の日本のサマータイム期間は考慮していない(REVIEW.md 参照)。
 * - 黄経は「その日の春分点・黄道(of date)」基準のトロピカル方式。
 * - 時刻不明のときは正午(12:00 JST)で計算し、さらに 00:00〜24:00 の間に
 *   サインが変わる天体は「AまたはB」として両方を返す。
 * - ハウス・ASC は扱わない(出生地は計算に使わない)。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../../vendor/astronomy-engine/astronomy.browser.min.js'));
  } else {
    root.Compass = root.Compass || {};
    root.Compass.astro = factory(root.Astronomy);
  }
})(typeof self !== 'undefined' ? self : this, function (Astronomy) {
  'use strict';

  var SIGNS = [
    { id: 'aries', name: '牡羊座', element: 'fire', quality: 'cardinal' },
    { id: 'taurus', name: '牡牛座', element: 'earth', quality: 'fixed' },
    { id: 'gemini', name: '双子座', element: 'air', quality: 'mutable' },
    { id: 'cancer', name: '蟹座', element: 'water', quality: 'cardinal' },
    { id: 'leo', name: '獅子座', element: 'fire', quality: 'fixed' },
    { id: 'virgo', name: '乙女座', element: 'earth', quality: 'mutable' },
    { id: 'libra', name: '天秤座', element: 'air', quality: 'cardinal' },
    { id: 'scorpio', name: '蠍座', element: 'water', quality: 'fixed' },
    { id: 'sagittarius', name: '射手座', element: 'fire', quality: 'mutable' },
    { id: 'capricorn', name: '山羊座', element: 'earth', quality: 'cardinal' },
    { id: 'aquarius', name: '水瓶座', element: 'air', quality: 'fixed' },
    { id: 'pisces', name: '魚座', element: 'water', quality: 'mutable' }
  ];

  var ELEMENT_NAMES = { fire: '火', earth: '地', air: '風', water: '水' };

  var PLANETS = [
    { id: 'sun', name: '太陽', body: 'Sun' },
    { id: 'moon', name: '月', body: 'Moon' },
    { id: 'mercury', name: '水星', body: 'Mercury' },
    { id: 'venus', name: '金星', body: 'Venus' },
    { id: 'mars', name: '火星', body: 'Mars' },
    { id: 'jupiter', name: '木星', body: 'Jupiter' },
    { id: 'saturn', name: '土星', body: 'Saturn' }
  ];

  var JST_OFFSET_MS = 9 * 3600 * 1000;

  /** JST の年月日時分 → JS Date(UTC) */
  function jstToDate(y, m, d, hh, mm, ss) {
    return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0) - JST_OFFSET_MS);
  }

  /** 天体の地心黄経(度, 0〜360, of date) */
  function eclipticLongitude(bodyName, date) {
    var time = Astronomy.MakeTime(date);
    if (bodyName === 'Sun') {
      return Astronomy.SunPosition(time).elon;
    }
    if (bodyName === 'Moon') {
      return Astronomy.EclipticGeoMoon(time).lon;
    }
    var vec = Astronomy.GeoVector(Astronomy.Body[bodyName], time, true);
    return Astronomy.Ecliptic(vec).elon;
  }

  function signIndexOf(lon) {
    var x = ((lon % 360) + 360) % 360;
    return Math.floor(x / 30) % 12;
  }

  /**
   * 出生データ → 各天体のサイン
   * @param {{y:number,m:number,d:number,hh?:number,mm?:number,timeKnown:boolean}} b
   */
  function calcPlanets(b) {
    var timeKnown = !!b.timeKnown;
    var main = timeKnown ? jstToDate(b.y, b.m, b.d, b.hh, b.mm) : jstToDate(b.y, b.m, b.d, 12, 0);
    var dayStart = jstToDate(b.y, b.m, b.d, 0, 0, 0);
    var dayEnd = new Date(jstToDate(b.y, b.m, b.d + 1, 0, 0, 0).getTime() - 1000); // 23:59:59
    return PLANETS.map(function (p) {
      var lon = eclipticLongitude(p.body, main);
      var idx = signIndexOf(lon);
      var result = {
        id: p.id,
        name: p.name,
        lon: lon,
        sign: SIGNS[idx],
        signIndex: idx,
        ambiguous: false,
        alternatives: [SIGNS[idx]]
      };
      if (!timeKnown) {
        var i0 = signIndexOf(eclipticLongitude(p.body, dayStart));
        var i1 = signIndexOf(eclipticLongitude(p.body, dayEnd));
        if (i0 !== i1) {
          result.ambiguous = true;
          result.alternatives = [SIGNS[i0], SIGNS[i1]];
        }
      }
      return result;
    });
  }

  /** 表示用: 「蟹座」または「蟹座または獅子座」 */
  function signLabel(planet) {
    if (planet.ambiguous) {
      return planet.alternatives[0].name + 'または' + planet.alternatives[1].name;
    }
    return planet.sign.name;
  }

  /** 太陽黄経が lon 度になる時刻を startDate 以降で探す */
  function searchSunLongitude(lon, startDate, limitDays) {
    var t = Astronomy.SearchSunLongitude(lon, Astronomy.MakeTime(startDate), limitDays || 400);
    return t ? t.date : null;
  }

  return {
    SIGNS: SIGNS,
    ELEMENT_NAMES: ELEMENT_NAMES,
    PLANETS: PLANETS,
    jstToDate: jstToDate,
    eclipticLongitude: eclipticLongitude,
    signIndexOf: signIndexOf,
    calcPlanets: calcPlanets,
    signLabel: signLabel,
    searchSunLongitude: searchSunLongitude,
    sunLongitude: function (date) { return eclipticLongitude('Sun', date); }
  };
});
