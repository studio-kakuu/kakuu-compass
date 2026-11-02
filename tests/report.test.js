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
    if (/^(PLANET|ACT-(?!DIR)|AI-PROMPT|LABEL-|GLOSS-|COOLWHY-)/.test(id)) continue; // COOLWHY は組み合わせ(きっかけ×アクセル)ごとに1文
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
    const qs = texts.situations[t.id];
    const combos = qs.length ? qs[0].options.map((o, i) => ({ S1: o.id, S2: qs[1].options[(i + n) % 3].id })) : [{}];
    for (const home of ['東京都', '沖縄県', '北海道']) for (const situation of combos) {
      const extra = { cool: [texts.extraQuestions.cool.options[n % 7].id], success: texts.extraQuestions.success.options[n % 5].id };
      const rep = R.build({ nickname: 'テスト', birth: b, birthPref: null, homePref: home, theme: t.id, situation, answers: a, extra }, texts, new Date(now));
      const txt = R.clipboardText(rep);
      assert.ok(!/\{\w+\}/.test(txt), '差し込み漏れ: ' + txt.match(/\{\w+\}/));
      assert.ok(!txt.includes('undefined') && !txt.includes('NaN'), 'undefined/NaN');
      for (const w of FORBIDDEN) assert.ok(!txt.includes(w), w);
      assert.equal(rep.sections.length, 6);
      assert.equal(rep.appendix.length, 3);
      assert.ok(rep.card.guideName && rep.card.guideDesc);
      if (t.id === 'money') assert.ok(txt.includes('投資や金融商品'), 'money note');
      assert.ok(txt.includes('バーナム効果'));
      assert.ok(txt.includes(texts.disclaimer));
      const actions = rep.card.actions;
      assert.equal(actions.length, 3);
      assert.equal(new Set(actions).size, 3);
      n++;
    }
  }
  assert.ok(n > 1000);
});

test('同じ入力なら同じレポート(言い回しの選択が安定)', () => {
  const inp = { nickname: 'A', birth: births[1], homePref: '東京都', theme: 'career', situation: { S1: 'grow', S2: 'growth' }, answers: answerSets[3] };
  const now = new Date(nows[0]);
  assert.equal(R.clipboardText(R.build(inp, texts, now)), R.clipboardText(R.build(inp, texts, now)));
});

test('ニックネームに記号やHTMLが入ってもそのまま文字として扱う', () => {
  const rep = R.build({ nickname: '<b>{name}</b>', birth: births[0], homePref: '東京都', theme: 'overview', answers: answerSets[0] }, texts, new Date(nows[0]));
  assert.ok(rep.title.startsWith('<b>{name}</b>'));
});

test('戦略: 今月だけ本命星が中宮(転換期)なら「攻め」にせず「中間」', () => {
  // 2000年生まれ=九紫火星。基準日2026-11-01は 今年=巽宮(拡大)・今月=九紫中宮(転換期)
  const a = Object.fromEntries(texts.questions.map((q) => [q.id, 4]));
  // 基準日2026-10-20 は 10月=戌月(九紫中宮)。今年=巽宮(拡大)・今月=中宮(転換期)
  const rep = R.build({ nickname: 'T', birth: { y: 2000, m: 6, d: 1, timeKnown: false }, homePref: '東京都', theme: 'overview', answers: a }, texts, new Date('2026-10-20T12:00:00+09:00'));
  assert.equal(rep.data.yearPhase, 'summer');
  assert.equal(rep.data.monthPhase, 'turning');
  assert.equal(rep.data.stance, 'balance'); // 点数は 2×2+2=6 だが抑える
});

test('戦略: 今年本命星が中宮(転換期)なら「攻め」にしない', () => {
  // 1990年生まれ=一白水星。2026年は一白中宮
  const a = Object.fromEntries(texts.questions.map((q) => [q.id, 4]));
  for (const now of ['2026-03-15T12:00:00+09:00', '2026-06-15T12:00:00+09:00', '2026-11-01T12:00:00+09:00']) {
    const rep = R.build({ nickname: 'T', birth: { y: 1990, m: 7, d: 15, timeKnown: false }, homePref: '東京都', theme: 'overview', answers: a }, texts, new Date(now));
    assert.equal(rep.data.yearPhase, 'turning');
    assert.notEqual(rep.data.stance, 'attack', now);
  }
});

test('戦略: 中宮が絡まなければ点数どおり「攻め」になる', () => {
  // 2001年生まれ=八白土星。2026-10-20 は 今年=震宮(種まき1)・今月=巽宮(拡大2) → 1×2+2=4 で攻め
  const a = Object.fromEntries(texts.questions.map((q) => [q.id, 4]));
  const rep = R.build({ nickname: 'T', birth: { y: 2001, m: 12, d: 22, timeKnown: false }, homePref: '福岡県', theme: 'move', situation: { S1: 'trip', S2: 'soon' }, answers: a }, texts, new Date('2026-10-20T12:00:00+09:00'));
  assert.equal(rep.data.stance, 'attack');
});
