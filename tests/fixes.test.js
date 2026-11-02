// REVIEW精査の指摘8点のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');
const kyusei = require('../js/core/kyusei.js');

const P = texts.parts;
const XQ = texts.extraQuestions;
function combos(th) {
  const qs = texts.situations[th];
  return qs.length ? qs[0].options.flatMap((o) => qs[1].options.map((o2) => ({ S1: o.id, S2: o2.id }))) : [{}];
}
function build(o) {
  return R.build(Object.assign({ nickname: 'テスト', birth: { y: 1990, m: 7, d: 15, timeKnown: false }, homePref: '東京都', theme: 'overview', answers: Object.fromEntries(texts.questions.map((q) => [q.id, 4])), extra: { cool: ['purpose'], success: 'prepare' } }, o), texts, o.now || new Date('2026-11-02T12:00:00+09:00'));
}
function bodyOf(rep) { return rep.sections.map((s) => [s.title].concat(s.blocks.map((b) => R.blockToText(b, false, { hideBirth: true })).filter((x) => x !== null)).join('\n')).join('\n'); }
const allVariants = (re) => Object.keys(P).filter((id) => re.test(id)).flatMap((id) => P[id].v.map((v, i) => [id + '[' + (i + 1) + ']', v]));

test('1: 行動の文の期間の言葉が、入る枠(今週/〇月中/3か月)と食い違わない', () => {
  const RULES = [
    // [その枠だけで使うパーツ, 使ってはいけない期間の言葉]
    [/^(ACT-S2-|PLAN-WEEK-)/, /今月|月中|か月|今日中/],
    [/^(ACT-S1-|PLAN-MONTH-)/, /今週|今日|3日以内|週末|3か月/],
    [/^(PLAN-3M-|PLAN-KEEP-)/, /今週|今日|今月|月中|3日以内|週末/],
    // 今週と〇月中の両方に入る共通の文には、期間の言葉を入れない
    [/^ACT-overview-/, /今週|今日|今月|月中|週末|か月|3日以内/]
  ];
  for (const [re, bad] of RULES) {
    const list = allVariants(re);
    assert.ok(list.length > 0);
    list.forEach(([id, v]) => assert.ok(!bad.test(v), `${id}: ${v}`));
  }
  // 実際のレポートでも確認(6テーマ×状況の全組み合わせ×3つの戦略になりうる日付)
  for (const t of texts.themes) for (const sit of combos(t.id)) for (const now of ['2026-11-02', '2027-04-15', '2027-08-20']) {
    const r = build({ theme: t.id, situation: sit, now: new Date(now + 'T12:00:00+09:00') });
    const plan = r.sections.find((s) => s.id === 'strategy').blocks.find((b) => b.t === 'plan');
    const [week, month, long] = plan.groups;
    week.items.forEach((x) => assert.ok(!/今月|月中|か月/.test(x), 'week: ' + x));
    month.items.forEach((x) => assert.ok(!/今週|今日|3日以内|週末|3か月/.test(x), 'month: ' + x));
    long.items.forEach((x) => assert.ok(!/今週|今日|今月|月中|週末/.test(x), '3m: ' + x));
  }
});

test('2: 「まずは全体を見たい」ではテーマ名を差し込まず、専用の言い回しを使う', () => {
  for (const y of [1981, 1983, 1985, 1987, 1989]) {
    const body = bodyOf(build({ theme: 'overview', birth: { y, m: 6, d: 6, timeKnown: false } }));
    assert.ok(!body.includes('これからの過ごし方'), y);
    assert.ok(!/「毎日の過ごし方」/.test(body), y);
    assert.ok(/毎日の過ごし方でも|ふだんの暮らしの中でも/.test(body), y);
  }
  // ほかのテーマでは「「〇〇」のテーマでは/でも」の〇〇がテーマ名
  for (const t of texts.themes.filter((x) => x.id !== 'overview')) {
    const body = bodyOf(build({ theme: t.id, situation: combos(t.id)[0] }));
    const m = body.match(/「([^」]+)」(のテーマでは|でも)/g) || [];
    m.filter((x) => /のテーマでは/.test(x)).forEach((x) => assert.ok(x.includes(texts.themeShort[t.id]), x));
  }
});

test('3: 3-6「方角の使い方」に年の盤の凶のラベルを付けない(年の盤は付録だけ)', () => {
  for (let y = 1975; y <= 2005; y++) {
    const r = build({ theme: 'move', situation: { S1: 'trip', S2: 'soon' }, birth: { y, m: 3, d: 3, timeKnown: false } });
    r.data.dirLines.forEach((l) => {
      assert.ok(!/年の盤|五黄殺|暗剣殺|歳破|本命殺|本命的殺|月破/.test(l), l);
      assert.match(l, /〔(最大吉方|吉方位)〕$/);
    });
    const s36 = r.sections.find((s) => s.id === 'strategy').blocks;
    const i = s36.findIndex((b) => b.id === 's36');
    const txt = s36.slice(i).map((b) => b.text || (b.items || []).join('')).join('');
    assert.ok(!txt.includes('〔年の盤'));
  }
});

test('4: ラッキーデーの期間表示は「今日〜その気学の月の終わり」で、ほかの期間表示とそろう', () => {
  const r = build({ theme: 'career', situation: { S1: 'grow', S2: 'growth' } });
  const body = bodyOf(r);
  assert.ok(body.includes('11/2〜12/6'));
  assert.ok(!body.includes('11/2〜11/30'));
  assert.deepEqual([r.data.lucky.end.m, r.data.lucky.end.d], [12, 6]);
  r.data.lucky.days.forEach((d) => assert.ok(d.dn <= kyusei.dayNumberOfDate(r.data.current.monthEnd) - 1));
});

test('5: 本文(0〜5章)に作り手の説明に見える言い回しがない', () => {
  const BAD = /(に|と)しています|判定|組み込んでいます|で決めています|と決めています|1行にしました|1行にまとめました/;
  for (const t of texts.themes) for (const sit of combos(t.id)) for (const now of ['2026-11-02', '2027-04-15', '2027-08-20']) {
    for (const y of [1981, 1990]) {
      const body = bodyOf(build({ theme: t.id, situation: sit, birth: { y, m: 2, d: 2, timeKnown: false }, now: new Date(now + 'T12:00:00+09:00') }));
      const m = body.match(new RegExp('.{0,30}(' + BAD.source + ').{0,10}'));
      assert.ok(!m, m && m[0]);
    }
  }
});

test('6: お金テーマの文章に投資・金融商品を連想させる言葉がない', () => {
  const NG = /積立|積み立て|投資|運用|資産|金利|利回り|株|銘柄|FX|仮想通貨|ローン|保険|自動で貯|増やす商品/;
  const ids = Object.keys(P).filter((id) => /money/.test(id));
  assert.ok(ids.length > 20);
  ids.forEach((id) => P[id].v.forEach((v) => assert.ok(!NG.test(v), id + ': ' + v)));
  for (const sit of combos('money')) {
    const r = build({ theme: 'money', situation: sit });
    const body = bodyOf(r).replace(r.sections.find((s) => s.id === 'strategy').blocks.filter((b) => b.t === 'note').map((b) => b.text).join(''), '');
    assert.ok(!NG.test(body), JSON.stringify(sit) + ' ' + (body.match(NG) || [])[0]);
  }
});

test('7: 人物像の軸は本文では数字を使わず、言葉+5段階の目盛り。数字は付録の計算表だけ', () => {
  const r = build({ answers: Object.fromEntries(texts.questions.map((q, i) => [q.id, (i % 7) + 1])) });
  const persona = r.sections.find((s) => s.id === 'persona');
  const txt = persona.blocks.map((b) => R.blockToText(b, false, {})).join('\n');
  assert.ok(!/[+-]0\.\d\d/.test(txt));
  const axes = persona.blocks.find((b) => b.t === 'axes');
  const lines = R.blockToText(axes, false, {}).split('\n');
  assert.equal(lines.length, 4);
  lines.forEach((l) => assert.match(l, /^- \S+ [□■]{5} \S+((かなり|やや)\S+寄り|ほぼ中間)\)$/));
  assert.equal(R.axisScale(-0.7), '■□□□□');
  assert.equal(R.axisScale(0), '□□■□□');
  assert.equal(R.axisScale(0.3), '□□□■□');
  const app = r.appendix.find((s) => s.id === 'app-basis');
  assert.ok(app.blocks.some((b) => b.t === 'table' && b.head[0] === '軸'));
});

test('8: 盲点の見出しと本文の言い方がそろっている', () => {
  for (const [pole, label] of Object.entries(texts.brakeLabels)) {
    P['BRAKE-' + pole].v.forEach((v) => assert.ok(v.includes('「' + label + '」'), 'BRAKE-' + pole));
    assert.ok(P['TRAP-' + pole].v[0].includes('「' + label + '」'), 'TRAP-' + pole);
    // 言い換え(例:「変化への興味の出すぎ」)を使わない
    P['TRAP-' + pole].v.forEach((v) => (v.match(/「[^」]*(出すぎ|すぎ|不足)」/g) || []).forEach((q) => assert.equal(q, '「' + label + '」', 'TRAP-' + pole)));
  }
  for (let y = 1975; y <= 2000; y++) {
    const r = build({ birth: { y, m: 9, d: 9, timeKnown: false }, answers: Object.fromEntries(texts.questions.map((q, i) => [q.id, ((i * y) % 7) + 1])) });
    const label = r.data.brakeName;
    const body = bodyOf(r);
    assert.ok(body.includes('ブレーキ(盲点):' + label));
    assert.ok(body.includes('盲点:' + label));
    assert.ok(body.includes('「' + label + '」'));
  }
});

test('冷めるきっかけ:人物像では言い直しをせず、アクセルとつなげた「なぜ」を1つにつき1文(最大2文)', () => {
  const removed = ['やる気が冷めやすいのは、頭ごなしに否定されたとき', '大切に扱われていないと感じると、やる気が続きにくいタイプかもしれません'];
  const poles = new Set();
  for (const a of [0, 1, 2, 3, 4]) for (const cool of [['denied'], ['denied', 'purpose'], ['routine', 'alone'], ['disrespect', 'noresult'], ['offplan']]) {
    const answers = Object.fromEntries(texts.questions.map((q, i) => [q.id, ((i * (a + 2)) % 7) + 1]));
    const r = build({ answers, birth: { y: 1980 + a * 3, m: 4, d: 4, timeKnown: false }, extra: { cool, success: 'leap' } });
    const accel = r.data.persona.accel.pole;
    poles.add(accel);
    const persona = r.sections.find((s) => s.id === 'persona');
    const p = persona.blocks.find((b) => b.key === 'coolwhy');
    assert.equal(p.text, cool.map((c, i) => (i ? 'また、' : '') + P['COOLWHY-' + c + '-' + accel].v[0]).join(''));
    assert.equal(p.text.split('。').filter(Boolean).length, cool.length); // 1つにつき1文
    const all = persona.blocks.map((b) => b.text || '').join('');
    removed.forEach((x) => assert.ok(!all.includes(x)));
    // 3章の対策は残る(選んだ答えはカードの見出しだけで、本文で言い直さない)
    const cards = r.sections.find((s) => s.id === 'strategy').blocks.filter((b) => b.t === 'card' && b.title.startsWith('冷めるきっかけ:'));
    assert.equal(cards.length, cool.length);
    cards.forEach((c) => assert.ok(c.text.startsWith('対策:')));
  }
  assert.ok(poles.size >= 3);
  // すべての組み合わせ(きっかけ7×アクセル9)がそろい、決めつけない言い方で終わる
  for (const o of XQ.cool.options) for (const pole of Object.keys(texts.brakeLabels)) {
    const v = P['COOLWHY-' + o.id + '-' + pole].v[0];
    assert.match(v, /(かもしれません|ものです)。$/);
    assert.equal(v.split('。').filter(Boolean).length, 1);
  }
  assert.ok(!Object.keys(P).some((id) => /^COOL-/.test(id) && P[id].fix));
});

test('根拠ラベル:本文(0〜5章)・全文コピーの本文部分・AI相談用・共有の要約に出さない(付録の「根拠の詳細」は残す)', () => {
  for (const t of texts.themes) for (const sit of combos(t.id).slice(0, 3)) {
    const r = build({ theme: t.id, situation: sit });
    r.sections.forEach((s) => assert.ok(!s.blocks.some((b) => b.t === 'label'), s.id));
    // 目次にある付録の名前「根拠の詳細」だけは残してよい
    const noLabel = (x) => !/根拠/.test(x.replace(/根拠の詳細/g, ''));
    assert.ok(noLabel(bodyOf(r)), t.id);
    assert.ok(noLabel(R.toText(r, false, { noAppendix: true })), t.id);
    assert.ok(noLabel(R.summaryText(r, texts, {})), t.id);
    const ai = R.clipboardText(r);
    const mainPart = ai.slice(0, ai.indexOf('――――――――――\n' + r.appendixTitle));
    assert.ok(mainPart.length > 1000 && noLabel(mainPart), t.id);
    // 付録は残る
    assert.ok(r.appendix.some((s) => s.id === 'app-basis' && s.title === '根拠の詳細'));
    assert.ok(ai.includes('根拠の詳細'));
  }
});
