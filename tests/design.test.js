// 見た目の作り直し(色の役割・ポイント・要約パネル・チェックリスト・カレンダー)のデータ側テスト
const test = require('node:test');
const assert = require('node:assert/strict');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');

const NOW = new Date('2026-11-02T12:00:00+09:00');
const THEMES = Object.keys(texts.situations);
const answers = [
  Object.fromEntries(texts.questions.map((q) => [q.id, 4])),
  Object.fromEntries(texts.questions.map((q) => [q.id, q.reverse ? 1 : 7])),
  Object.fromEntries(texts.questions.map((q, i) => [q.id, (i % 7) + 1]))
];
function reps() {
  const out = [];
  THEMES.forEach((th) => answers.forEach((a, i) => [[1990, 7, 15], [1985, 2, 3], [2001, 12, 25]].forEach((b) => {
    const qs = texts.situations[th];
    const situation = qs.length ? { S1: qs[0].options[i % qs[0].options.length].id, S2: qs[1].options[0].id } : {};
    out.push(R.build({ nickname: 'テスト', birth: { y: b[0], m: b[1], d: b[2], timeKnown: false }, homePref: '東京都', theme: th, situation, answers: a, extra: { cool: ['purpose'], success: 'prepare' } }, texts, NOW));
  })));
  return out;
}
const ALL = reps();

test('各章(1〜5)と3-xの小見出しの直後に「ポイント」が1つある', () => {
  for (const rep of ALL) {
    for (const s of rep.sections.slice(1).filter((x) => x.id !== 'appendix')) {
      assert.equal(s.blocks[0].t, 'point', s.id + ' の先頭がポイントではない');
      assert.ok(s.blocks[0].text.length > 0 && s.blocks[0].text.length <= 120);
      s.blocks.forEach((b, i) => {
        if (b.t === 'h' && /^3-\d/.test(b.text)) assert.equal(s.blocks[i + 1].t, 'point', b.text + ' の直後がポイントではない');
      });
    }
  }
});

test('ポイントは新しい主張を足さない(章内の文・見出し語から作る)', () => {
  for (const rep of ALL.slice(0, 20)) {
    for (const s of rep.sections.slice(1)) {
      const body = s.blocks.filter((b) => b.t !== 'point').map((b) => R.blockToText(b, false, { hideBirth: true }) || '').join('\n') + s.title;
      s.blocks.filter((b) => b.t === 'point').forEach((p) => {
        // 「」の中の語は、章の本文(または章タイトル・要約パネル)に出てくる
        const words = (p.text.match(/「([^」]+)」/g) || []).map((w) => w.slice(1, -1));
        const sum = R.blockToText(rep.sections[0].blocks.find((b) => b.t === 'panel'), false, {}) || '';
        words.forEach((w) => assert.ok(body.includes(w) || sum.includes(w), s.id + ': 「' + w + '」が本文にない'));
      });
    }
  }
});

test('色の役割:注意の章・3-3・ブレーキはオレンジ、3-5・ラッキーカラー・力をくれる人は金', () => {
  const rep = ALL[0];
  assert.equal(rep.sections.find((s) => s.id === 'caution').tone, 'orange');
  const hs = rep.sections.flatMap((s) => s.blocks).filter((b) => b.t === 'h');
  const tone = (re) => hs.find((h) => re.test(h.text)).tone;
  assert.equal(tone(/^3-3/), 'orange');
  assert.equal(tone(/^ブレーキ/), 'orange');
  assert.equal(tone(/^3-5/), 'gold');
  assert.equal(tone(/ラッキーカラー/), 'gold');
  assert.equal(tone(/力をくれる人/), 'gold');
  assert.equal(tone(/^3-4/), 'lime');
});

test('要約パネルの行動は3-4のチェックリストと同じID(チェックが連動する)', () => {
  for (const rep of ALL) {
    const pan = rep.sections[0].blocks.find((b) => b.t === 'panel');
    const plan = rep.sections.flatMap((s) => s.blocks).find((b) => b.t === 'plan');
    assert.equal(pan.actions.length, 3);
    const ids = new Map(plan.groups.flatMap((g) => g.items).map((x) => [x.id, x.text]));
    pan.actions.forEach((a) => {
      assert.match(a.id, /^a[0-9a-z]+$/);
      if (ids.has(a.id)) assert.equal(ids.get(a.id), a.text);
    });
    assert.ok(pan.actions.some((a) => ids.has(a.id)), '要約と3-4に共通の行動が1つもない');
    assert.equal(R.actionId('同じ文'), R.actionId('同じ文'));
  }
});

test('カレンダー用データ:最大3日、個人情報なし、要約のラッキーデーと同じ日', () => {
  for (const rep of ALL) {
    assert.ok(Array.isArray(rep.ics) && rep.ics.length <= 3);
    const pan = rep.sections[0].blocks.find((b) => b.t === 'panel');
    assert.equal(rep.ics.length, pan.days.length);
    rep.ics.forEach((d) => {
      assert.ok(d.tag && d.text);
      assert.doesNotMatch(JSON.stringify(d), /テスト|1990|1985|2001/);
    });
  }
});

test('〔吉方位〕などは本文テキストで改行をまたがない', () => {
  for (const rep of ALL.slice(0, 10)) {
    const t = R.toText(rep, false, { hideBirth: true });
    assert.doesNotMatch(t, /〔[^〕\n]*\n/);
  }
});
