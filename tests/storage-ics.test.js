// 「この端末に覚えておく」(本人が選んだときだけ保存)と、ラッキーデーの .ics のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../js/storage.js');
const ics = require('../js/ics.js');
const texts = require('../data/texts.js');
const R = require('../js/core/report.js');

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get size() { return m.size; }, keys: () => [...m.keys()] };
}
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('denied'); } };

test('保存:オンにしない限り何も保存されない/オンなら端末内(localStorage)の1つのキーだけ/「記憶を消す」で消える', () => {
  const s = fakeStorage();
  assert.equal(store.load(s), null);       // 何もしなければ空
  assert.equal(s.size, 0);
  const data = { form: { nickname: 'テスト', birthdate: '1990-07-15' }, answers: { Q01: 4 }, checks: { a1: true } };
  assert.equal(store.save(data, s), true);
  assert.deepEqual(s.keys(), [store.KEY]);
  assert.deepEqual(store.load(s), data);
  assert.equal(store.clear(s), true);       // 「この端末の記憶を消す」
  assert.equal(store.load(s), null);
  assert.equal(s.size, 0);
});

test('保存:localStorage が使えない環境でもエラーにならない', () => {
  assert.equal(store.available(broken), false);
  assert.equal(store.save({ a: 1 }, broken), false);
  assert.equal(store.load(broken), null);
  assert.equal(store.clear(broken), false);
  // 壊れたデータも無視する
  const s = fakeStorage();
  s.setItem(store.KEY, '{壊れたJSON');
  assert.equal(store.load(s), null);
  s.setItem(store.KEY, JSON.stringify({ v: 999, data: {} }));
  assert.equal(store.load(s), null);
});

test('保存:レポートの作成だけでは何も保存されない(保存は画面側で、オンのときだけ呼ぶ)', () => {
  // report / ics の作成は storage に一切触れない
  const s = fakeStorage();
  global.window = { localStorage: s };
  try {
    const r = R.build({ nickname: 'テスト', birth: { y: 1990, m: 7, d: 15, timeKnown: false }, homePref: '東京都', theme: 'overview', answers: Object.fromEntries(texts.questions.map((q) => [q.id, 4])), extra: { cool: ['purpose'], success: 'prepare' } }, texts, new Date('2026-11-02T12:00:00+09:00'));
    ics.build(r.ics, { url: texts.toolUrl });
    assert.equal(s.size, 0);
  } finally { delete global.window; }
});

test('ics:終日の予定・タイトル・説明(向いていること+URL)・CRLF・75バイト折り返し', () => {
  const r = R.build({ nickname: 'ハル', birth: { y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true }, homePref: '東京都', theme: 'love', situation: { S1: 'crush', S2: 'trust' }, answers: Object.fromEntries(texts.questions.map((q) => [q.id, 4])), extra: { cool: ['denied'], success: 'prepare' } }, texts, new Date('2026-11-02T12:00:00+09:00'));
  assert.ok(r.ics.length >= 1 && r.ics.length <= 3);
  const body = ics.build(r.ics, { url: texts.toolUrl, now: new Date('2026-11-02T03:00:00Z') });
  assert.ok(body.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(body.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(body), 'すべての改行が CRLF');
  assert.equal((body.match(/BEGIN:VEVENT/g) || []).length, r.ics.length);
  // 折り返しをもどして中身を確認
  const unfolded = body.replace(/\r\n /g, '');
  r.ics.forEach((d) => {
    const ymd = String(d.y) + String(d.m).padStart(2, '0') + String(d.d).padStart(2, '0');
    assert.ok(unfolded.includes('DTSTART;VALUE=DATE:' + ymd));
    assert.ok(unfolded.includes('SUMMARY:ラッキーデー:' + d.tag + '(COMPASS)'));
    assert.ok(unfolded.includes('DESCRIPTION:' + ics.esc(d.text + '\n' + texts.toolUrl)));
  });
  // 生年月日・ニックネームは入れない
  assert.ok(!unfolded.includes('ハル') && !unfolded.includes('1990') && !unfolded.includes('0715'));
  // 1行は75バイト以内
  body.split('\r\n').forEach((l) => assert.ok(Buffer.byteLength(l, 'utf8') <= 75, l));
});

test('ics:翌日(DTEND)は月末・年末もまたぐ', () => {
  const body = ics.build([{ y: 2026, m: 12, d: 31, tag: '連絡', text: 'テスト' }, { y: 2027, m: 2, d: 28, tag: '始める', text: 'テスト' }], { url: 'https://example.invalid/' }).replace(/\r\n /g, '');
  assert.ok(body.includes('DTEND;VALUE=DATE:20270101'));
  assert.ok(body.includes('DTEND;VALUE=DATE:20270301'));
});

test('ics:記号のエスケープ', () => {
  assert.equal(ics.esc('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});
