/*
 * COMPASS - 数秘術(ピタゴラス式)
 *
 * 【採用した方式】
 * ライフパスナンバー:
 *   生年月日(西暦8桁 YYYYMMDD)の数字を1桁ずつすべて足す。
 *   合計が2桁以上なら、さらに各桁を足す(これを繰り返す)。
 *   途中(または最初)の合計が 11・22・33 になった時点で、それ以上足さず
 *   マスターナンバーとして扱う。
 *   例) 2000-01-08 → 2+0+0+0+0+1+0+8 = 11 → マスターナンバー11
 *   例) 1985-02-03 → 28 → 10 → 1
 * バースデーナンバー:
 *   生まれた「日」の数字を1桁ずつ足す。11日・22日はマスターナンバーとして残す。
 *   (日は最大31なので33にはならない)
 *   例) 29日 → 2+9 = 11 → 11 / 15日 → 6
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Compass = root.Compass || {};
    root.Compass.numerology = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MASTER = [11, 22, 33];

  function digitSum(n) {
    return String(n).split('').reduce(function (a, c) { return a + Number(c); }, 0);
  }

  /** 数字を1桁(またはマスターナンバー)まで還元。steps に途中経過を残す */
  function reduce(n) {
    var steps = [n];
    while (n > 9 && MASTER.indexOf(n) === -1) {
      n = digitSum(n);
      steps.push(n);
    }
    return { value: n, steps: steps, master: MASTER.indexOf(n) !== -1 };
  }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function lifePath(y, m, d) {
    var digits = pad(y, 4) + pad(m, 2) + pad(d, 2);
    var first = digitSum(digits);
    var r = reduce(first);
    r.digits = digits;
    return r;
  }

  function birthday(d) {
    var r = reduce(d);
    r.day = d;
    return r;
  }

  return { lifePath: lifePath, birthday: birthday, reduce: reduce, MASTER: MASTER };
});
