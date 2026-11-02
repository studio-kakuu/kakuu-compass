// レポート作り直し(A1〜A4・B1〜B4・C)のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');
const persona = require('../js/core/persona.js');
const kyusei = require('../js/core/kyusei.js');

const XQ = texts.extraQuestions;
const NOW = new Date('2026-11-02T12:00:00+09:00');
const answerSets = [
  Object.fromEntries(texts.questions.map((q) => [q.id, 4])),
  Object.fromEntries(texts.questions.map((q) => [q.id, q.reverse ? 1 : 7])),
  Object.fromEntries(texts.questions.map((q) => [q.id, q.reverse ? 7 : 1])),
  Object.fromEntries(texts.questions.map((q, i) => [q.id, (i % 7) + 1])),
  Object.fromEntries(texts.questions.map((q, i) => [q.id, ((i * 3) % 7) + 1]))
];
function combos(th) {
  const qs = texts.situations[th];
  return qs.length ? qs[0].options.flatMap((o) => qs[1].options.map((o2) => ({ S1: o.id, S2: o2.id }))) : [{}];
}
function build(opts) {
  return R.build(Object.assign({ nickname: 'テスト', birth: { y: 1990, m: 7, d: 15, timeKnown: false }, homePref: '東京都', theme: 'overview', answers: answerSets[0], extra: { cool: ['purpose'], success: 'prepare' } }, opts), texts, opts.now || NOW);
}
function bodyOf(rep) { // 1〜5章(要約と付録を除く)
  return rep.sections.slice(1).map((s) => [s.title].concat(s.blocks.map((b) => R.blockToText(b, false, { hideBirth: true })).filter((x) => x !== null)).join('\n')).join('\n');
}

// ---------- A1 ----------
test('A1: 性格の質問は各因子2問(1問逆転)のまま。同じ因子の2問は別の場面を聞く文になっている', () => {
  for (const f of ['E', 'A', 'C', 'N', 'O']) {
    const qs = texts.questions.filter((q) => q.factor === f);
    assert.equal(qs.length, 2);
    assert.equal(qs.filter((q) => q.reverse).length, 1);
    assert.notEqual(qs[0].text, qs[1].text);
  }
  const before = Object.fromEntries(texts.questionsBefore.map((q) => [q.id, q.text]));
  assert.notEqual(texts.questions.find((q) => q.id === 'Q03').text, before.Q03);
  assert.notEqual(texts.questions.find((q) => q.id === 'Q08').text, before.Q08);
  assert.match(texts.questions.find((q) => q.id === 'Q03').text, /段取り/);   // 準備・計画
  assert.match(texts.questions.find((q) => q.id === 'Q08').text, /片付け|三日坊主/); // 片付け・継続
});

// ---------- A2 ----------
test('A2: ラッキーデーの「向いていること」は3日で重ならない(テーマ・本命星・日付を変えて確認)', () => {
  let checked = 0;
  for (const t of texts.themes) for (let y = 1981; y <= 1989; y++) {
    for (const now of ['2026-11-02T12:00:00+09:00', '2027-01-25T12:00:00+09:00', '2027-05-10T12:00:00+09:00', '2027-09-03T12:00:00+09:00']) {
      const r = build({ theme: t.id, situation: combos(t.id)[0], birth: { y, m: 3, d: 3, timeKnown: false }, now: new Date(now) });
      const uses = r.data.luckyUses;
      assert.equal(uses.length, r.data.lucky.days.length);
      assert.equal(new Set(uses.map((u) => u.tag)).size, uses.length);
      assert.equal(new Set(uses.map((u) => u.text)).size, uses.length);
      const list = r.sections.find((s) => s.id === 'strategy').blocks;
      uses.forEach((u) => assert.ok(list.some((b) => b.t === 'list' && b.items.some((x) => x.includes('「' + u.tag + '」向き')))));
      if (uses.length >= 2) checked++;
    }
  }
  assert.ok(checked > 100);
});

// ---------- A3 ----------
test('A3: 「気をつけること」は対象月だけで、見出しに気学の月の開始日〜終了日がある', () => {
  const r = build({ theme: 'career', situation: { S1: 'grow', S2: 'growth' } });
  const c = r.sections.find((s) => s.id === 'caution');
  assert.equal(c.title, '4. 気をつけること:11月(11/7〜12/6)');
  // 12/6 = 次の節入り(大雪 12/7)の前日
  const taisetsu = kyusei.setsuDate(2026, 11);
  assert.equal(new Date(taisetsu.getTime() + 9 * 3600e3).getUTCDate(), 7);
  assert.ok(!c.blocks.some((b) => (b.text || '').includes('今年')));
});

test('A3: 本文(1〜5章)に「今月」はなく、「今年」は期間つき(今年(…))だけ', () => {
  for (const t of texts.themes) for (const sit of combos(t.id).slice(0, 3)) {
    for (const now of ['2026-11-02T12:00:00+09:00', '2027-02-01T12:00:00+09:00', '2027-07-20T12:00:00+09:00']) {
      const body = bodyOf(build({ theme: t.id, situation: sit, now: new Date(now) }));
      assert.ok(!body.includes('今月'), t.id);
      assert.ok(!/今年(?!\()/.test(body), t.id + ' ' + (body.match(/.{0,20}今年(?!\().{0,20}/) || [''])[0]);
    }
  }
});

// ---------- A4 ----------
test('A4: 先頭に要約と目次。目次のリンク先はすべて存在する', () => {
  const r = build({ theme: 'money', situation: { S1: 'buy', S2: 'impulse' } });
  const s0 = r.sections[0];
  assert.equal(s0.id, 'summary');
  const sum = s0.blocks.find((b) => b.t === 'summary');
  const labels = sum.items.map((i) => i.label);
  ['11月の指針', '人物像', '吉方位', '避けたい方位', 'ラッキーデー', '行動のヒント', '気をつけること'].forEach((l) => assert.ok(labels.includes(l), l));
  assert.deepEqual(sum.items.find((i) => i.label === '行動のヒント').list, r.card.actions);
  const toc = s0.blocks.find((b) => b.t === 'toc');
  const ids = new Set(r.sections.map((s) => s.id).concat(['appendix']));
  r.sections.forEach((s) => s.blocks.forEach((b) => { if (b.id) ids.add(b.id); }));
  toc.items.forEach((it) => assert.ok(ids.has(it.id), it.id));
  assert.equal(toc.items.filter((it) => it.sub).length, 6);
});

// ---------- B1 ----------
test('B1: 4軸の計算(Big Five 60%・占い 40%)、アクセル=最大の偏り、ブレーキ=2番目', () => {
  assert.equal(persona.W_BF, 0.6);
  assert.equal(persona.W_FORTUNE, 0.4);
  const poles = new Set();
  for (const a of answerSets) for (let y = 1981; y <= 1992; y++) {
    const r = build({ answers: a, birth: { y, m: (y % 12) + 1, d: 10, timeKnown: false } });
    const p = r.data.persona;
    const sorted = p.axes.slice().sort((x, z) => Math.abs(z.score) - Math.abs(x.score));
    if (!p.balanced) {
      assert.equal(p.accel.axis.id, sorted[0].id);
      assert.equal(p.accel.pole, sorted[0].score >= 0 ? sorted[0].plus : sorted[0].minus);
      if (!p.brake.overuse) assert.equal(p.brake.axis.id, sorted[1].id);
      else assert.ok(Math.abs(sorted[1].score) < persona.THRESHOLD);
    }
    p.axes.forEach((ax) => assert.ok(Math.abs(ax.score - (0.6 * ax.bf + 0.4 * ax.fortune)) < 1e-9 || Math.abs(ax.score) === 1));
    poles.add(p.accel.pole);
  }
  assert.ok(poles.size >= 4, [...poles].join(','));
});

test('B1/B3: 冷めるきっかけは人物像と落とし穴に、うまくいった型は人物像と行動プランに反映', () => {
  const r = build({ theme: 'career', situation: { S1: 'change', S2: 'income' }, extra: { cool: ['denied', 'routine'], success: 'team' } });
  const persona2 = r.sections.find((s) => s.id === 'persona');
  const strat = r.sections.find((s) => s.id === 'strategy');
  const ptext = persona2.blocks.map((b) => b.text || '').join('');
  const accel = r.data.persona.accel.pole;
  assert.ok(ptext.includes(texts.parts['COOLWHY-denied-' + accel].v[0]));
  assert.ok(ptext.includes('また、' + texts.parts['COOLWHY-routine-' + accel].v[0]));
  assert.ok(texts.parts['SUCCESS-team'].v.some((v) => ptext.includes(v.replace(/\{name\}/g, 'テスト'))));
  const cards = strat.blocks.filter((b) => b.t === 'card').map((b) => b.title);
  assert.ok(cards.includes('冷めるきっかけ:頭ごなしに否定されたとき'));
  assert.ok(cards.includes('冷めるきっかけ:同じことの繰り返しが続くとき'));
  const plan = strat.blocks.find((b) => b.t === 'plan');
  assert.ok(texts.parts['PLAN-WEEK-team'].v.some((v) => plan.groups[0].items[0] === v));
  assert.equal(plan.groups.length, 3);
  assert.match(plan.groups[1].label, /^11月中\(11\/7〜12\/6\)$/);
  assert.match(plan.groups[2].label, /^3か月\(〜2027\/2\/2\)$/);
});

test('B3: 冷めるきっかけは最大2つまで使う', () => {
  const r = build({ extra: { cool: ['denied', 'routine', 'alone'], success: 'leap' } });
  assert.deepEqual(r.data.extra.cool, ['denied', 'routine']);
});

test('B1: 流派ごとの解説は付録に移し、本文には根拠ラベルだけ', () => {
  const r = build({ theme: 'love', situation: { S1: 'partner', S2: 'fun' } });
  const body = bodyOf(r);
  ['ライフパスナンバー', 'バースデーナンバー', '月命星'].forEach((w) => assert.ok(!body.includes(w), w));
  const app = r.appendix.map((s) => s.blocks.map((b) => R.blockToText(b, false, {})).join('\n')).join('\n');
  ['ライフパスナンバー', '月命星', '太陽星座'].forEach((w) => assert.ok(app.includes(w), w));
  assert.ok(r.sections.find((s) => s.id === 'persona').blocks.some((b) => b.t === 'label' && /Big Five/.test(b.text)));
});

// ---------- B2 ----------
test('B2: 方角は1方位1行(どこへ・何をしに・いつ)。用語の定義文は本文になく用語集にある', () => {
  for (let y = 1981; y <= 1989; y++) {
    const r = build({ theme: 'relation', situation: { S1: 'friend', S2: 'closer' }, birth: { y, m: 5, d: 10, timeKnown: false } });
    const cur = r.data.current;
    const mStart = kyusei.dayNumberOfDate(cur.monthStart), mEnd = kyusei.dayNumberOfDate(cur.monthEnd) - 1;
    const inMonth = r.data.lucky.days.filter((d) => d.dn >= mStart && d.dn <= mEnd);
    r.data.dirLines.forEach((l, i) => {
      assert.match(l, /^.+へ。.+の予定を(ラッキーデーの\d+\/\d+\(.\)|11月中\(11\/7〜12\/6\))に。〔(最大吉方|吉方位)〕/);
      // 方角と組み合わせる日は〇月の盤の期間内のラッキーデーだけ(期間外の日とは組み合わせない)
      if (inMonth[i]) assert.ok(l.includes('ラッキーデーの' + inMonth[i].date.m + '/' + inMonth[i].date.d + '('));
      else assert.ok(l.includes('11月中('));
    });
    // 3-5で同じ日に別の用途を書かない(方角と組んだ日は「〇〇へのお出かけ」)
    r.data.luckyUses.forEach((u, k) => {
      const d = r.data.lucky.days[k];
      const paired = r.data.dirLines.some((l) => l.includes('ラッキーデーの' + d.date.m + '/' + d.date.d + '('));
      assert.equal(u.paired, paired);
    });
    const body = bodyOf(r);
    Object.keys(texts.parts).filter((k) => k.startsWith('GLOSS-')).forEach((k) => assert.ok(!body.includes(texts.parts[k].v[0]), k));
  }
  const gloss = build({}).appendix.find((s) => s.id === 'app-gloss').blocks[0].items.map((i) => i.term);
  ['五黄殺', '暗剣殺', '月破', '本命殺', '本命的殺'].forEach((t) => assert.ok(gloss.includes(t), t));
});

// ---------- B4 ----------
test('B4: 「3. テーマ別の作戦」が本文(0〜5章)の文字数の50%以上(6テーマ×状況の全組み合わせ)', () => {
  let n = 0, min = 1;
  for (const t of texts.themes) for (const sit of combos(t.id)) for (let i = 0; i < answerSets.length; i++) {
    const r = build({ theme: t.id, situation: sit, answers: answerSets[i], birth: { y: 1981 + i * 2, m: 6, d: 6, timeKnown: false }, extra: { cool: [XQ.cool.options[i % 7].id], success: XQ.success.options[i % 5].id } });
    const ch = r.sections.map((s) => R.sectionChars(s));
    const ratio = ch[r.sections.findIndex((s) => s.id === 'strategy')] / ch.reduce((a, b) => a + b, 0);
    min = Math.min(min, ratio);
    assert.ok(ratio >= 0.5, `${t.id} ${JSON.stringify(sit)} ${ratio.toFixed(3)}`);
    n++;
  }
  assert.equal(n, (5 * 9 + 1) * answerSets.length);
});

test('B4: 「まずは全体を見たい」は3章を「全体の作戦」として同じ構成で作る', () => {
  const r = build({ theme: 'overview' });
  const s = r.sections.find((x) => x.id === 'strategy');
  assert.equal(s.title, '3. 全体の作戦');
  ['s31', 's32', 's33', 's34', 's35', 's36'].forEach((id) => assert.ok(s.blocks.some((b) => b.id === id), id));
});

// ---------- C ----------
test('C: 同じレポートの中で同じ文が2回出ない(1〜5章)', () => {
  for (const t of texts.themes) for (const sit of combos(t.id)) for (let y = 1981; y <= 1989; y += 2) {
    const r = build({ theme: t.id, situation: sit, birth: { y, m: 8, d: 8, timeKnown: false }, answers: answerSets[y % 5], extra: { cool: [XQ.cool.options[y % 7].id, XQ.cool.options[(y + 2) % 7].id], success: XQ.success.options[y % 5].id } });
    const sents = bodyOf(r).split(/[。\n]/).map((x) => x.trim()).filter((x) => x.length >= 12 && !x.startsWith('('));
    const seen = new Set();
    for (const x of sents) { assert.ok(!seen.has(x), `${t.id} 重複: ${x}`); seen.add(x); }
  }
});

test('C: 戦略と文面が矛盾しない(攻めの月に「整える」の勝ち筋・規模が出ない)', () => {
  for (let y = 1975; y <= 2005; y++) for (const now of ['2026-11-02T12:00:00+09:00', '2027-04-15T12:00:00+09:00', '2027-08-20T12:00:00+09:00']) {
    const r = build({ theme: 'career', situation: { S1: 'grow', S2: 'growth' }, birth: { y, m: 1, d: 20, timeKnown: false }, now: new Date(now) });
    const st = r.data.stance;
    const ids = r.usedParts.join(' ');
    assert.ok(ids.includes('WIN-career-' + st + '['));
    assert.ok(ids.includes('DIR-SCALE-' + st + '['));
    assert.ok(ids.includes('GUIDE-LEAD-' + st + '['));
    if (r.data.monthPhase === 'winter') assert.notEqual(st, 'attack');
    if (r.data.monthPhase === 'turning' || r.data.yearPhase === 'turning') assert.notEqual(st, 'attack');
    if (r.data.monthPhase === 'summer' && !r.data.stanceCapped && r.data.yearPhase !== 'turning') assert.equal(st, 'attack');
  }
});

test('C: 共有の要約・AI相談用の文章も新しい構成に合わせている', () => {
  const r = build({ theme: 'move', situation: { S1: 'trip', S2: 'soon' }, extra: { cool: ['offplan'], success: 'deadline' } });
  const sum = R.summaryText(r, texts, {});
  assert.ok(sum.includes('アクセル:' + r.data.accelName));
  assert.ok(r.aiPrompt.includes('計画どおりに進まないとき') && r.aiPrompt.includes('期限に追われたとき') && r.aiPrompt.includes('旅行・お出かけ'));
});
