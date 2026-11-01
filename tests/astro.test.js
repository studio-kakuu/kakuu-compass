// 西洋占星術(天体サイン)のテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const astro = require('../js/core/astro.js');

const jst = (s) => new Date(s + '+09:00');
const minutesDiff = (a, b) => Math.abs(a.getTime() - b.getTime()) / 60000;

test('春分点(2024年): 国立天文台 3月20日12:06 JST と1分以内', () => {
  const t = astro.searchSunLongitude(0, jst('2024-03-01T00:00:00'));
  assert.ok(minutesDiff(t, jst('2024-03-20T12:06:00')) <= 1, t.toISOString());
});

test('冬至(2001年): 国立天文台 12月22日04:21 JST と1分以内', () => {
  const t = astro.searchSunLongitude(270, jst('2001-12-01T00:00:00'));
  assert.ok(minutesDiff(t, jst('2001-12-22T04:21:00')) <= 1, t.toISOString());
});

test('太陽のサインが変わる日(2001-12-22)・時刻不明は「射手座または山羊座」', () => {
  const sun = astro.calcPlanets({ y: 2001, m: 12, d: 22, timeKnown: false })[0];
  assert.equal(sun.ambiguous, true);
  assert.deepEqual(sun.alternatives.map((s) => s.name), ['射手座', '山羊座']);
  assert.equal(sun.sign.name, '山羊座'); // 正午時点
  assert.equal(astro.signLabel(sun), '射手座または山羊座');
});

test('太陽のサインが変わる日・時刻がわかれば1つに決まる', () => {
  const before = astro.calcPlanets({ y: 2001, m: 12, d: 22, hh: 4, mm: 0, timeKnown: true })[0];
  const after = astro.calcPlanets({ y: 2001, m: 12, d: 22, hh: 4, mm: 45, timeKnown: true })[0];
  assert.equal(before.sign.name, '射手座');
  assert.equal(after.sign.name, '山羊座');
  assert.equal(before.ambiguous, false);
});

test('月の位置: 2024-04-08 皆既日食の新月(18:21 UTC)で太陽と月の黄経が0.5°以内', () => {
  const d = new Date('2024-04-08T18:21:00Z');
  const diff = Math.abs(astro.eclipticLongitude('Moon', d) - astro.eclipticLongitude('Sun', d));
  assert.ok(diff < 0.5, String(diff));
});

test('月のサインが変わる日(1990-07-02 3:01ごろ 天秤座→蠍座)', () => {
  const unknown = astro.calcPlanets({ y: 1990, m: 7, d: 2, timeKnown: false })[1];
  assert.equal(unknown.ambiguous, true);
  assert.equal(astro.signLabel(unknown), '天秤座または蠍座');
  assert.equal(astro.calcPlanets({ y: 1990, m: 7, d: 2, hh: 2, mm: 0, timeKnown: true })[1].sign.name, '天秤座');
  assert.equal(astro.calcPlanets({ y: 1990, m: 7, d: 2, hh: 4, mm: 0, timeKnown: true })[1].sign.name, '蠍座');
});

test('月のサインが変わらない日は1つだけ表示', () => {
  const moon = astro.calcPlanets({ y: 1990, m: 7, d: 15, timeKnown: false })[1];
  assert.equal(moon.ambiguous, false);
  assert.equal(moon.sign.name, '牡羊座');
});

test('惑星のサイン(よく知られた滞在期間の中日で確認)', () => {
  const sign = (y, m, d, id) => astro.calcPlanets({ y, m, d, hh: 12, mm: 0, timeKnown: true }).find((p) => p.id === id).sign.name;
  assert.equal(sign(2024, 1, 25, 'mercury'), '山羊座'); // 2024/1/14〜2/5 山羊座
  assert.equal(sign(2020, 5, 15, 'venus'), '双子座');   // 2020/4/3〜8/7 双子座
  assert.equal(sign(2020, 10, 1, 'mars'), '牡羊座');    // 2020/6/28〜2021/1/7 牡羊座
  assert.equal(sign(2025, 6, 1, 'jupiter'), '双子座');  // 2025/6/10 蟹座入り
  assert.equal(sign(2025, 6, 20, 'jupiter'), '蟹座');
  assert.equal(sign(2023, 3, 1, 'saturn'), '水瓶座');   // 2023/3/7 魚座入り
  assert.equal(sign(2023, 3, 15, 'saturn'), '魚座');
});

test('サイン判定の境界: 0°=牡羊座, 29.999°=牡羊座, 30°=牡牛座, 359.9°=魚座', () => {
  assert.equal(astro.signIndexOf(0), 0);
  assert.equal(astro.signIndexOf(29.999), 0);
  assert.equal(astro.signIndexOf(30), 1);
  assert.equal(astro.signIndexOf(359.9), 11);
});
