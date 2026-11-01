const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../js/core/geo.js');
const bf = require('../js/core/bigfive.js');
const texts = require('../data/texts.js');

test('都道府県データは47件', () => {
  assert.equal(geo.PREFS.length, 47);
  assert.equal(new Set(geo.PREFS.map((p) => p.name)).size, 47);
});

test('東京都から見た方角と距離', () => {
  const r = geo.regionsByPalace('東京都');
  const where = (n) => Object.keys(r).find((k) => r[k].some((x) => x.name === n));
  assert.equal(where('埼玉県'), 'N');
  assert.equal(where('千葉県'), 'E');
  assert.equal(where('沖縄県'), 'SW');
  assert.equal(where('北海道'), 'N');
  const d = geo.distance(geo.find('東京都'), geo.find('大阪府'));
  assert.ok(d > 380 && d < 410, String(d)); // 直線で約400km
});

test('性格スコア: 逆転項目の計算', () => {
  const all4 = Object.fromEntries(texts.questions.map((q) => [q.id, 4]));
  const s = bf.score(texts.questions, all4);
  for (const f of ['E', 'A', 'C', 'N', 'O']) { assert.equal(s[f].value, 4); assert.equal(s[f].level, 'mid'); }
  const ans = { ...all4, Q01: 7, Q06: 1 }; // 外向性: 順7, 逆転1 → (7 + 7)/2 = 7
  assert.equal(bf.score(texts.questions, ans).E.value, 7);
  const ans2 = { ...all4, Q01: 1, Q06: 7 };
  assert.equal(bf.score(texts.questions, ans2).E.value, 1);
  assert.equal(bf.score(texts.questions, ans2).E.level, 'low');
});

test('性格スコア: 各因子2問・うち1問が逆転項目', () => {
  for (const f of ['E', 'A', 'C', 'N', 'O']) {
    const qs = texts.questions.filter((q) => q.factor === f);
    assert.equal(qs.length, 2);
    assert.equal(qs.filter((q) => q.reverse).length, 1);
  }
});

test('未回答があるとエラー', () => {
  assert.throws(() => bf.score(texts.questions, { Q01: 4 }));
});
