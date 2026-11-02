/*
 * COMPASS - 人物像の4軸(アクセルとブレーキ)
 *
 * 4つの軸(それぞれ -1.0 〜 +1.0)
 *   pace   : 推進力(+) ⇔ 慎重さ(-)
 *   social : 外向(+)   ⇔ 内向(-)
 *   flex   : 変化(+)   ⇔ 安定(-)
 *   bond   : 共感(+)   ⇔ 独立(-)
 *
 * 重み: Big Five(本人の回答)60% + 占いの要素 40%
 *   占いの内訳: 太陽星座 1 : 月星座 0.5 : ライフパス 1 : 本命星 1 (合計3.5で割って -1〜+1 に収める)
 *   = 太陽星座 約11.4% / 月星座 約5.7% / ライフパス 約11.4% / 本命星 約11.4%
 *
 * アクセル(強み) = いちばん大きく偏っている軸の側
 * ブレーキ(盲点) = 2番目に大きく偏っている軸の側(その偏りが 0.15 未満なら、アクセルの使いすぎ)
 * すべての軸の偏りが 0.15 未満なら「バランス型」
 * 変換表は docs/REVIEW.md にも載せています。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Compass = root.Compass || {};
    root.Compass.persona = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AXES = [
    { id: 'pace', plus: 'drive', minus: 'caution', label: '推進力⇔慎重さ' },
    { id: 'social', plus: 'extro', minus: 'intro', label: '外向⇔内向' },
    { id: 'flex', plus: 'change', minus: 'stable', label: '安定⇔変化' },
    { id: 'bond', plus: 'empathy', minus: 'indep', label: '共感⇔独立' }
  ];
  var POLE_NAMES = { drive: '推進力', caution: '慎重さ', extro: '外向', intro: '内向', change: '変化', stable: '安定', empathy: '共感', indep: '独立' };

  var W_BF = 0.6, W_FORTUNE = 0.4;
  var W_SRC = { sun: 1, moon: 0.5, lp: 1, star: 1 };
  var W_SUM = 3.5;
  var THRESHOLD = 0.15;

  /* Big Five → 4軸。z = (因子の値 - 4) / 3  (-1〜+1) */
  var BF_MAP = {
    pace: { N: -0.6, E: 0.4 },        // 動じにくく外向的なほど推進力
    social: { E: 1.0 },
    flex: { O: 0.8, C: -0.2 },        // 新しいもの好きほど変化、きっちりほど安定
    bond: { A: 1.0 }
  };

  /* 西洋占星術(太陽・月のエレメント) */
  var ELEMENT_MAP = {
    fire: { pace: 1, social: 0.5, flex: 0.5 },
    air: { social: 0.5, flex: 1, bond: -0.5 },
    earth: { pace: -0.5, flex: -1 },
    water: { pace: -0.5, social: -0.5, bond: 1 }
  };

  /* 数秘術(ライフパス) */
  var LP_MAP = {
    1: { pace: 1, bond: -0.5 }, 2: { bond: 1, pace: -0.5 }, 3: { social: 1, flex: 0.5 }, 4: { flex: -1, pace: -0.5 },
    5: { flex: 1, pace: 0.5 }, 6: { bond: 1, flex: -0.5 }, 7: { social: -1, bond: -0.5 }, 8: { pace: 1, flex: -0.5 },
    9: { bond: 0.5, flex: 0.5 }, 11: { bond: 0.5, flex: 0.5, social: -0.5 }, 22: { pace: 0.5, flex: -0.5 }, 33: { bond: 1 }
  };

  /* 九星気学(本命星) */
  var STAR_MAP = {
    1: { flex: 0.5, social: -0.5 }, 2: { bond: 0.5, pace: -0.5 }, 3: { pace: 1, social: 0.5 },
    4: { bond: 0.5, flex: 0.5 }, 5: { pace: 1, bond: -0.5 }, 6: { pace: 0.5, flex: -0.5 },
    7: { social: 1 }, 8: { pace: 0.5, flex: -0.5 }, 9: { social: 0.5, flex: 0.5 }
  };

  function clamp(x) { return Math.max(-1, Math.min(1, x)); }

  /**
   * @param {object} bf  bigfive.score() の結果
   * @param {{sunEl:string, moonEl:string, lp:number, star:number, sunName?:string, moonName?:string, starName?:string}} f
   */
  function compute(bf, f) {
    var axes = AXES.map(function (ax) {
      var bfv = 0, bfParts = {}, bfZ = {};
      Object.keys(BF_MAP[ax.id]).forEach(function (k) {
        var z = (bf[k].value - 4) / 3;
        var c = z * BF_MAP[ax.id][k];
        bfParts[k] = c;
        bfZ[k] = z;
        bfv += c;
      });
      bfv = clamp(bfv);
      var src = {
        sun: (ELEMENT_MAP[f.sunEl] || {})[ax.id] || 0,
        moon: (ELEMENT_MAP[f.moonEl] || {})[ax.id] || 0,
        lp: (LP_MAP[f.lp] || {})[ax.id] || 0,
        star: (STAR_MAP[f.star] || {})[ax.id] || 0
      };
      var fortune = (src.sun * W_SRC.sun + src.moon * W_SRC.moon + src.lp * W_SRC.lp + src.star * W_SRC.star) / W_SUM;
      var score = clamp(W_BF * bfv + W_FORTUNE * fortune);
      return { id: ax.id, label: ax.label, plus: ax.plus, minus: ax.minus, score: score, bf: bfv, bfParts: bfParts, bfZ: bfZ, fortune: fortune, src: src };
    });
    var ranked = axes.slice().sort(function (a, b) { return Math.abs(b.score) - Math.abs(a.score) || AXES.findIndex(function (x) { return x.id === a.id; }) - AXES.findIndex(function (x) { return x.id === b.id; }); });
    function pole(ax) { return ax.score >= 0 ? ax.plus : ax.minus; }
    var accel, brake, balanced = false;
    if (Math.abs(ranked[0].score) < THRESHOLD) {
      balanced = true;
      accel = { pole: 'balance', axis: null, score: 0 };
      brake = { pole: 'balance', axis: null, score: 0 };
    } else {
      accel = { pole: pole(ranked[0]), axis: ranked[0], score: ranked[0].score };
      if (Math.abs(ranked[1].score) >= THRESHOLD) brake = { pole: pole(ranked[1]), axis: ranked[1], score: ranked[1].score, overuse: false };
      else brake = { pole: accel.pole, axis: ranked[0], score: ranked[0].score, overuse: true };
    }
    return { axes: axes, accel: accel, brake: brake, balanced: balanced };
  }

  /** その軸の側を強めている根拠(ラベル用) */
  function sources(axis, poleSide, names) {
    if (!axis) return ['Big Five'];
    var sign = poleSide === axis.plus ? 1 : -1;
    var out = [];
    var FN = { E: '外向性', A: '協調性', C: '勤勉性', N: '神経症傾向', O: '開放性' };
    var bfKeys = Object.keys(axis.bfParts).filter(function (k) { return axis.bfParts[k] * sign > 0.05; });
    // 変換表の重みがマイナスの因子は「低さ」が根拠になる(例:神経症傾向の低さ → 推進力)
    out.push('Big Five' + (bfKeys.length ? '(' + bfKeys.map(function (k) { return FN[k] + (axis.bfZ[k] >= 0 ? 'の高さ' : 'の低さ'); }).join('・') + ')' : ''));
    if (axis.src.sun * sign > 0) out.push('西洋占星術(太陽:' + names.sun + ')');
    else if (axis.src.moon * sign > 0) out.push('西洋占星術(月:' + names.moon + ')');
    if (axis.src.lp * sign > 0) out.push('数秘術(' + names.lp + ')');
    if (axis.src.star * sign > 0) out.push('九星気学(' + names.star + ')');
    return out;
  }

  return { AXES: AXES, POLE_NAMES: POLE_NAMES, compute: compute, sources: sources, BF_MAP: BF_MAP, ELEMENT_MAP: ELEMENT_MAP, LP_MAP: LP_MAP, STAR_MAP: STAR_MAP, W_BF: W_BF, W_FORTUNE: W_FORTUNE, W_SRC: W_SRC, THRESHOLD: THRESHOLD };
});
