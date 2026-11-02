// REVIEW.md とカード画像で使うサンプル(3人分)。回答・状況は確認用の仮のもの。
'use strict';
module.exports = {
  NOW: '2026-11-02T12:00:00+09:00', // サンプルの基準日(固定)
  SAMPLES: [
    {
      file: 'sample-1',
      label: 'サンプル1:1985-02-03・時刻不明(立春の前日生まれ)',
      input: { nickname: 'アオイ', birth: { y: 1985, m: 2, d: 3, timeKnown: false }, birthPref: null, homePref: '大阪府', theme: 'career', situation: { S1: 'indep', S2: 'income' } },
      answers: [6, 3, 5, 4, 6, 2, 5, 4, 5, 2]
    },
    {
      file: 'sample-2',
      label: 'サンプル2:1990-07-15 14:30・東京都生まれ',
      input: { nickname: 'ハル', birth: { y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true }, birthPref: '東京都', homePref: '東京都', theme: 'love', situation: { S1: 'crush', S2: 'trust' } },
      answers: [3, 2, 6, 6, 4, 6, 6, 2, 3, 5]
    },
    {
      file: 'sample-3',
      label: 'サンプル3:2001-12-22・時刻不明(冬至=太陽の星座が変わる日)',
      input: { nickname: 'ミナト', birth: { y: 2001, m: 12, d: 22, timeKnown: false }, birthPref: null, homePref: '福岡県', theme: 'move', situation: { S1: 'relocate', S2: 'later' } },
      answers: [5, 5, 3, 3, 7, 3, 4, 6, 4, 2]
    }
  ]
};
