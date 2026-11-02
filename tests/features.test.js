// テーマ・状況の質問・指針・共有文章のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');

const answers = Object.fromEntries(texts.questions.map((q) => [q.id, 4]));
const NOW = new Date('2026-11-02T12:00:00+09:00');
const base = { nickname: 'テスト', birth: { y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true }, homePref: '東京都', answers };

test('相談テーマは6つ。「まずは全体を見たい」が初期選択で、状況の質問なし', () => {
  assert.deepEqual(texts.themes.map((t) => t.id), ['career', 'money', 'love', 'relation', 'move', 'overview']);
  assert.equal(texts.themes.filter((t) => t.default).map((t) => t.id)[0], 'overview');
  assert.equal(texts.situations.overview.length, 0);
});

test('各テーマに選択式の質問が2問(各3択)あり、対応する文章パーツがそろっている', () => {
  for (const t of texts.themes.filter((x) => x.id !== 'overview')) {
    const qs = texts.situations[t.id];
    assert.equal(qs.length, 2, t.id);
    qs.forEach((q) => assert.equal(q.options.length, 3));
    for (const o of qs[0].options) {
      for (const st of ['attack', 'balance', 'prepare']) assert.ok(texts.parts[`ACT-S1-${t.id}-${o.id}-${st}`], `ACT-S1-${t.id}-${o.id}-${st}`);
      assert.ok(texts.parts[`GUIDE-TAIL-${t.id}-${o.id}`]);
    }
    for (const o of qs[1].options) assert.ok(texts.parts[`ACT-S2-${t.id}-${o.id}`]);
    assert.ok(texts.parts['DIR-THEME-' + t.id] && texts.parts['DIR-ACT-' + t.id] && texts.parts['QUE-' + t.id]);
  }
});

test('状況の回答で、行動のヒントと指針の説明が変わる', () => {
  const a = R.build({ ...base, theme: 'love', situation: { S1: 'partner', S2: 'trust' } }, texts, NOW);
  const b = R.build({ ...base, theme: 'love', situation: { S1: 'seeking', S2: 'fun' } }, texts, NOW);
  const actA = a.card.actions, actB = b.card.actions;
  assert.notEqual(actA[0], actB[0]);
  assert.notEqual(actA[1], actB[1]);
  assert.notEqual(a.card.guideDesc, b.card.guideDesc);
  assert.ok(texts.parts['GUIDE-TAIL-love-partner'].v.some((v) => a.card.guideDesc.endsWith(v)));
  assert.ok(texts.parts['GUIDE-TAIL-love-seeking'].v.some((v) => b.card.guideDesc.endsWith(v)));
});

test('指針の名前は今月のフェーズ、説明の前半は戦略から選ばれる', () => {
  const r = R.build({ ...base, theme: 'overview' }, texts, NOW);
  assert.ok(texts.parts['GUIDE-NAME-' + r.data.monthPhase].v.includes(r.data.guide.name));
  assert.ok(texts.parts['GUIDE-LEAD-' + r.data.stance].v.some((v) => r.data.guide.desc.startsWith(v)));
  assert.equal(r.sections[0].title, '11月の指針');
  assert.equal(r.card.month, 11);
});

test('お金のテーマは投資の助言をしない(注意書きつき・投資を勧める言葉なし)', () => {
  const NG = ['銘柄', '株を', '仮想通貨', 'FX', '利回り', '投資しましょう', '儲か', '必ず増'];
  const moneyIds = Object.keys(texts.parts).filter((id) => /money/.test(id));
  for (const id of moneyIds) for (const v of texts.parts[id].v) for (const w of NG) assert.ok(!v.includes(w), id + ' ' + w);
  for (const s1 of ['buy', 'save', 'earn']) {
    const r = R.build({ ...base, theme: 'money', situation: { S1: s1, S2: 'impulse' } }, texts, NOW);
    const txt = R.toText(r, false);
    assert.ok(txt.includes('投資や金融商品'));
    for (const w of NG) assert.ok(!txt.includes(w), w);
  }
});

test('共有の要約・全文コピーに、初期設定では生年月日を載せない', () => {
  const r = R.build({ ...base, theme: 'career', situation: { S1: 'grow', S2: 'growth' } }, texts, NOW);
  const sum = R.summaryText(r, texts, {});
  assert.ok(!sum.includes('1990'));
  assert.ok(sum.includes(r.card.guideName) && sum.includes('https://studio-kakuu.github.io/kakuu-compass/'));
  r.card.actions.forEach((a) => assert.ok(sum.includes(a)));
  assert.ok(R.summaryText(r, texts, { includeBirth: true }).includes('1990-07-15'));
  const full = R.toText(r, false, { hideBirth: true });
  assert.ok(!full.includes('1990-07-15') && !full.includes('1+9+9+0') && !full.includes('1990年'));
  assert.ok(R.toText(r, false, { hideBirth: false }).includes('1990-07-15'));
  const ai = R.clipboardText(r);
  assert.ok(!ai.includes('1990-07-15') && !ai.includes('1+9+9+0'));
});

test('カード用データ: 吉方位は今月吉・今年も凶でない方位、避けたい方位と重ならない', () => {
  for (const y of [1960, 1975, 1985, 1990, 1999, 2001, 2005, 2010, 2020]) {
    const r = R.build({ ...base, birth: { y, m: 5, d: 10, timeKnown: false }, theme: 'overview' }, texts, NOW);
    const good = r.card.goodDirs.map((d) => d.id), bad = r.card.badDirs.map((d) => d.id);
    good.forEach((g) => assert.ok(!bad.includes(g)));
    if (r.card.needle) assert.equal(r.card.needle, good[0]);
    assert.ok(r.card.luckyDays.length <= 3);
    assert.ok(!JSON.stringify({ ...r.card, birthLabel: '' }).includes(String(y) + '.'));
  }
});
