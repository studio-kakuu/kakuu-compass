// レポート全体のテスト(文章ルール・差し込み漏れ・全パターン)
const test = require('node:test');
const assert = require('node:assert/strict');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');

// 未来の断定・健康や生死の予言につながる言葉
const FORBIDDEN = ['病気', '病', 'ケガ', '怪我', '事故', '死', '必ず', '絶対に', '確実に', '運命'];

function allStrings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => allStrings(x, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((x) => allStrings(x, out));
  return out;
}

test('文章パーツに禁止ワードが入っていない', () => {
  for (const [id, part] of Object.entries(texts.parts)) {
    for (const s of allStrings(part)) {
      for (const w of FORBIDDEN) assert.ok(!s.includes(w), `${id} に「${w}」: ${s}`);
    }
  }
});

test('文章の多い主なパーツは言い回しが2種類以上ある', () => {
  for (const [id, part] of Object.entries(texts.parts)) {
    if (/^(PLANET|DIR-BADNAME|ACT-(?!DIR)|AI-PROMPT)/.test(id)) continue;
    assert.ok(part.v.length >= 2, id);
  }
});

const answerSets = [
  Object.fromEntries(texts.questions.map((q) => [q.id, 4])),
  Object.fromEntries(texts.questions.map((q) => [q.id, q.reverse ? 1 : 7])),
  Object.fromEntries(texts.questions.map((q) => [q.id, q.reverse ? 7 : 1])),
  Object.fromEntries(texts.questions.map((q, i) => [q.id, (i % 7) + 1]))
];
const births = [
  { y: 1985, m: 2, d: 3, timeKnown: false },
  { y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true },
  { y: 2001, m: 12, d: 22, timeKnown: false },
  { y: 2025, m: 2, d: 3, timeKnown: false },
  { y: 1969, m: 7, d: 1, timeKnown: false },
  { y: 1950, m: 11, d: 29, hh: 0, mm: 5, timeKnown: true }
];
const nows = ['2026-11-01T12:00:00+09:00', '2027-01-20T12:00:00+09:00', '2027-06-15T12:00:00+09:00'];

test('さまざまな入力でレポートが作れ、差し込み漏れ・禁止ワードがない', () => {
  let n = 0;
  for (const b of births) for (const a of answerSets) for (const t of texts.themes) for (const now of nows) {
    for (const home of ['東京都', '沖縄県', '北海道']) {
      const rep = R.build({ nickname: 'テスト', birth: b, birthPref: null, homePref: home, theme: t.id, answers: a }, texts, new Date(now));
      const txt = R.clipboardText(rep);
      assert.ok(!/\{\w+\}/.test(txt), '差し込み漏れ: ' + txt.match(/\{\w+\}/));
      assert.ok(!txt.includes('undefined') && !txt.includes('NaN'), 'undefined/NaN');
      for (const w of FORBIDDEN) assert.ok(!txt.includes(w), w);
      assert.equal(rep.sections.length, 8);
      assert.ok(txt.includes('バーナム効果'));
      assert.ok(txt.includes(texts.disclaimer));
      const actions = rep.sections[6].blocks.find((x) => x.t === 'olist').items;
      assert.equal(actions.length, 3);
      assert.equal(new Set(actions).size, 3);
      n++;
    }
  }
  assert.ok(n > 1000);
});

test('同じ入力なら同じレポート(言い回しの選択が安定)', () => {
  const inp = { nickname: 'A', birth: births[1], homePref: '東京都', theme: 'career', answers: answerSets[3] };
  const now = new Date(nows[0]);
  assert.equal(R.clipboardText(R.build(inp, texts, now)), R.clipboardText(R.build(inp, texts, now)));
});

test('ニックネームに記号やHTMLが入ってもそのまま文字として扱う', () => {
  const rep = R.build({ nickname: '<b>{name}</b>', birth: births[0], homePref: '東京都', theme: 'other', answers: answerSets[0] }, texts, new Date(nows[0]));
  assert.ok(rep.title.startsWith('<b>{name}</b>'));
});
