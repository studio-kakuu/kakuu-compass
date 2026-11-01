/*
 * COMPASS - 性格の自己チェック(Big Five の5因子・簡易版)
 *
 * 本ツールのオリジナル10問。学術的に検証された心理検査ではない。
 * 日本語版TIPI(TIPI-J)は、無料公開ツールでの利用条件を公開情報から確認できなかったため使っていない。
 * 1因子2問(うち1問は逆転項目)、7段階(1=まったくあてはまらない 〜 7=とてもよくあてはまる)。
 * 因子得点 = (順項目 + (8 - 逆転項目)) / 2  → 1.0〜7.0
 * 区分: 3.5未満=低め / 3.5以上4.5以下=中くらい / 4.5超=高め
 * 質問文そのものは data/texts.js の questions にある(文章だけ修正可能)。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Compass = root.Compass || {};
    root.Compass.bigfive = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FACTORS = [
    { id: 'E', name: '外向性', low: 'ひとりで深める', high: '人と動いて広げる' },
    { id: 'A', name: '協調性', low: '自分の意見を通す', high: '相手に合わせる' },
    { id: 'C', name: '勤勉性', low: '柔軟・その場対応', high: '計画的・きっちり' },
    { id: 'N', name: '神経症傾向', low: '動じにくい', high: '気にしやすい・慎重' },
    { id: 'O', name: '開放性', low: '慣れたやり方を好む', high: '新しいことを好む' }
  ];

  /**
   * @param {Array<{id:string,factor:string,reverse:boolean}>} questions
   * @param {Object<string,number>} answers 質問ID → 1〜7
   */
  function score(questions, answers) {
    var sums = {}, counts = {};
    questions.forEach(function (q) {
      var v = Number(answers[q.id]);
      if (!(v >= 1 && v <= 7)) throw new Error('回答がありません: ' + q.id);
      var s = q.reverse ? 8 - v : v;
      sums[q.factor] = (sums[q.factor] || 0) + s;
      counts[q.factor] = (counts[q.factor] || 0) + 1;
    });
    var out = {};
    FACTORS.forEach(function (f) {
      var val = counts[f.id] ? sums[f.id] / counts[f.id] : 4;
      out[f.id] = { id: f.id, name: f.name, value: val, level: levelOf(val), lowLabel: f.low, highLabel: f.high };
    });
    return out;
  }

  function levelOf(v) {
    if (v < 3.5) return 'low';
    if (v > 4.5) return 'high';
    return 'mid';
  }

  return { FACTORS: FACTORS, score: score, levelOf: levelOf, LEVEL_NAMES: { low: '低め', mid: '中くらい', high: '高め' } };
});
