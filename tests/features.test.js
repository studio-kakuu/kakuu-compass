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
    for (const o of qs[0].options) {
      assert.ok(texts.parts[`READ-${t.id}-${o.id}`] && texts.parts[`PLAN-3M-${t.id}-${o.id}`] && texts.parts[`CAU-SIT-${t.id}-${o.id}`], o.id);
    }
    for (const o of qs[1].options) assert.ok(texts.parts[`VALUE-${t.id}-${o.id}`], o.id);
    for (const st of ['attack', 'balance', 'prepare']) assert.ok(texts.parts[`WIN-${t.id}-${st}`]);
    assert.ok(texts.parts['DIR-ACT-' + t.id] && texts.parts['QUE-' + t.id] && texts.parts['LUCKY-USE-' + t.id]);
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
  assert.equal(r.sections[0].id, 'summary');
  assert.equal(r.sections[1].title, '1. 11月(11/7〜12/6)の指針');
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

test('カード用データ: 〇月の盤だけで判断。避けたい方位は優先順で最大2つ(3つ以上は「など」)', () => {
  const PRI = ['gooSatsu', 'ankenSatsu', 'honmeiSatsu', 'honmeiTekiSatsu', 'geppa'];
  for (const y of [1960, 1975, 1985, 1990, 1999, 2001, 2005, 2010, 2020]) {
    for (const now of [NOW, new Date('2026-12-20T12:00:00+09:00'), new Date('2027-03-15T12:00:00+09:00')]) {
      const r = R.build({ ...base, birth: { y, m: 5, d: 10, timeKnown: false }, theme: 'overview' }, texts, now);
      const md = r.data.current.month.directions;
      const good = r.card.goodDirs.map((d) => d.id), bad = r.card.badDirs.map((d) => d.id);
      // 吉方位 = 月盤の吉方位(年盤は見ない)
      assert.deepEqual([...good].sort(), md.filter((d) => d.good).map((d) => d.palace.id).sort());
      // 避けたい方位 = 月盤の凶方位から優先順に最大2つ
      const monthBad = md.filter((d) => d.bad.length);
      assert.ok(bad.length <= 2);
      assert.equal(bad.length, Math.min(2, monthBad.length));
      assert.equal(r.card.badMore, monthBad.length > 2);
      const rank = (id) => Math.min(...md.find((d) => d.palace.id === id).bad.map((b) => PRI.indexOf(b)));
      const shownMax = Math.max(...bad.map(rank));
      monthBad.filter((d) => !bad.includes(d.palace.id)).forEach((d) => assert.ok(rank(d.palace.id) >= shownMax));
      good.forEach((g) => assert.ok(!bad.includes(g)));
      // 針・ラッキーカラー・行動のヒントの方位がそろっている
      if (r.card.needle) {
        assert.equal(r.card.needle, good[0]);
        assert.equal(r.data.luckyColor.palace.id, r.card.needle);
        if (r.card.actions[2].includes('方面')) assert.ok(r.card.actions[2].startsWith(r.card.goodDirs[0].name + '方面'));
      } else {
        assert.equal(r.data.luckyColor.rule, 'supports');
      }
      assert.ok(r.card.luckyDays.length <= 3);
    }
  }
});

test('ひとこと注意: 同じ月でも本命星が違えば別の文。テーマ・状況でも変わる', () => {
  const by = {};
  for (let y = 1981; y <= 1989; y++) { // 本命星が一白〜九紫まで1つずつ
    const r = R.build({ ...base, birth: { y, m: 5, d: 10, timeKnown: false }, theme: 'career', situation: { S1: 'grow', S2: 'growth' } }, texts, NOW);
    by[r.data.kyusei.honmei.num] = r.card.caution;
  }
  assert.equal(Object.keys(by).length, 9);
  assert.equal(new Set(Object.values(by)).size, 9);
  const a = R.build({ ...base, theme: 'money', situation: { S1: 'buy', S2: 'steady' } }, texts, NOW).card.caution;
  const b = R.build({ ...base, theme: 'love', situation: { S1: 'crush', S2: 'trust' } }, texts, NOW).card.caution;
  assert.notEqual(a, b);
  const rep = R.build({ ...base, theme: 'money', situation: { S1: 'buy', S2: 'steady' } }, texts, NOW);
  assert.ok(R.toText(rep, false).includes('ひとこと注意:' + rep.card.caution));
});

test('レポート③に、年と月で吉凶が食い違う方位の説明が入る', () => {
  let found = 0;
  for (let y = 1981; y <= 1989; y++) {
    const r = R.build({ ...base, birth: { y, m: 5, d: 10, timeKnown: false }, theme: 'overview' }, texts, NOW);
    const cur = r.data.current;
    const mix = cur.month.directions.some((d, i) => (d.good && cur.year.directions[i].bad.length) || (cur.year.directions[i].good && d.bad.length));
    const txt = R.toText(r, false);
    const has = texts.parts['DIR-MIXED-MONTH'].v.concat(texts.parts['DIR-MIXED-YEAR'].v).some((v) => txt.includes(v.slice(-20).replace(/\{month\}/g, '11')));
    if (mix) { found++; assert.ok(has, 'mixed text for ' + y); }
  }
  assert.ok(found > 0);
});
