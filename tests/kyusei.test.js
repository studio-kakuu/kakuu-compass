// 九星気学のテスト(立春・節入り、本命星・月命星、方位盤、凶方位)
const test = require('node:test');
const assert = require('node:assert/strict');
const k = require('../js/core/kyusei.js');

const jst = (s) => new Date(s + '+09:00');
const roundMin = (d) => new Date(Math.round(d.getTime() / 60000) * 60000);

test('立春の日時が国立天文台の暦(分単位・四捨五入)と一致', () => {
  const cases = {
    1985: '1985-02-04T06:12', 2021: '2021-02-03T23:59', 2024: '2024-02-04T17:27',
    2025: '2025-02-03T23:10', 2026: '2026-02-04T05:02'
  };
  for (const [y, s] of Object.entries(cases)) {
    assert.equal(roundMin(k.risshun(Number(y))).getTime(), jst(s + ':00').getTime(), 'year ' + y);
  }
});

test('2026年の節入り日(立冬は11月7日・寒露は10月8日)', () => {
  const md = (d) => { const j = new Date(d.getTime() + 9 * 3600e3); return (j.getUTCMonth() + 1) + '/' + j.getUTCDate(); };
  assert.equal(md(k.setsuDate(2026, 10)), '11/7');
  assert.equal(md(k.setsuDate(2026, 9)), '10/8');
  assert.equal(md(k.setsuDate(2026, 12)), '1/5'); // 小寒(2027年1月)
});

test('年の本命星(年盤の中宮)', () => {
  const exp = { 1984: 7, 1985: 6, 1990: 1, 1999: 1, 2000: 9, 2001: 8, 2024: 3, 2025: 2, 2026: 1, 2027: 9 };
  for (const [y, s] of Object.entries(exp)) assert.equal(k.yearStarOf(Number(y)), s, 'year ' + y);
});

test('立春より前の生まれは前年扱い(1985-02-03 → 1984年の七赤金星)', () => {
  const r = k.birthStars({ y: 1985, m: 2, d: 3, timeKnown: false });
  assert.equal(r.kigakuYear, 1984);
  assert.equal(r.honmei.name, '七赤金星');
  assert.equal(r.getsumei.name, '六白金星'); // 1984年の丑月
  assert.equal(r.boundary, null); // 1985年の立春は2/4なので当日ではない
});

test('立春当日の時刻による違い(1985-02-04 立春 6:12)', () => {
  assert.equal(k.birthStars({ y: 1985, m: 2, d: 4, hh: 6, mm: 0, timeKnown: true }).honmei.num, 7);
  assert.equal(k.birthStars({ y: 1985, m: 2, d: 4, hh: 6, mm: 30, timeKnown: true }).honmei.num, 6);
});

test('2021年 立春 2/3 23:59 の前後', () => {
  assert.equal(k.birthStars({ y: 2021, m: 2, d: 3, hh: 23, mm: 0, timeKnown: true }).honmei.name, '七赤金星');
  assert.equal(k.birthStars({ y: 2021, m: 2, d: 4, hh: 0, mm: 30, timeKnown: true }).honmei.name, '六白金星');
});

test('立春当日で時刻不明 → 立春後として計算し、境界フラグと別の候補を返す', () => {
  const r = k.birthStars({ y: 2025, m: 2, d: 3, timeKnown: false });
  assert.equal(r.honmei.name, '二黒土星');
  assert.ok(r.boundary);
  assert.equal(r.boundary.name, '立春');
  assert.equal(r.boundary.alt.honmei.name, '三碧木星');
  assert.equal(r.boundary.alt.getsumei.name, '三碧木星'); // 2024年(三碧)の丑月 = 五黄から11減
  assert.equal(r.getsumei.name, '二黒土星'); // 2025年(二黒)の寅月
});

test('月命星', () => {
  assert.equal(k.birthStars({ y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true }).getsumei.name, '三碧木星'); // 一白年・未月
  assert.equal(k.birthStars({ y: 2001, m: 12, d: 22, timeKnown: false }).getsumei.name, '一白水星'); // 八白年・子月
  // 一白・四緑・七赤年の寅月は八白、三碧・六白・九紫年は五黄、二黒・五黄・八白年は二黒
  assert.equal(k.monthStarOf(1, 1), 8);
  assert.equal(k.monthStarOf(6, 1), 5);
  assert.equal(k.monthStarOf(8, 1), 2);
  assert.equal(k.monthStarOf(1, 12), 6);
});

test('節入り(月の境目)前後で月命星が変わる(2026-11-07 立冬 18:52ごろ)', () => {
  const a = k.birthStars({ y: 2026, m: 11, d: 7, hh: 18, mm: 30, timeKnown: true });
  const b = k.birthStars({ y: 2026, m: 11, d: 7, hh: 19, mm: 15, timeKnown: true });
  assert.equal(a.monthBranch, '戌');
  assert.equal(b.monthBranch, '亥');
  assert.equal(a.getsumei.num, 9);
  assert.equal(b.getsumei.num, 8);
  const u = k.birthStars({ y: 2026, m: 11, d: 7, timeKnown: false });
  assert.equal(u.boundary.name, '立冬');
  assert.equal(u.boundary.isRisshun, false);
});

test('1月(丑月・立春前)は前年の年盤で月命星を出す', () => {
  const r = k.birthStars({ y: 2026, m: 1, d: 20, hh: 12, mm: 0, timeKnown: true });
  assert.equal(r.kigakuYear, 2025);
  assert.equal(r.monthBranch, '丑');
  assert.equal(r.getsumei.num, k.monthStarOf(2, 12));
});

test('方位盤: 一白中宮の盤(2026年)', () => {
  const b = k.makeBoard(1);
  assert.deepEqual(b, { C: 1, N: 6, NE: 4, E: 8, SE: 9, S: 5, SW: 7, W: 3, NW: 2 });
  assert.deepEqual(k.makeBoard(5), { C: 5, N: 1, NE: 8, E: 3, SE: 4, S: 9, SW: 2, W: 7, NW: 6 });
});

test('凶方位: 2026年(一白中宮・午年)・本命星 二黒', () => {
  const r = k.evaluateBoard(1, '午', 2, 'year');
  const bad = Object.fromEntries(r.directions.map((d) => [d.palace.id, d.bad]));
  assert.ok(bad.S.includes('gooSatsu'));
  assert.ok(bad.N.includes('ankenSatsu'));
  assert.ok(bad.N.includes('saiha'));       // 午の反対=北
  assert.ok(bad.NW.includes('honmeiSatsu')); // 二黒は北西
  assert.ok(bad.SE.includes('honmeiTekiSatsu'));
  // 吉方位: 二黒(土)を生む九紫(火)は南東だが本命的殺と重なるため吉にならない
  const se = r.directions.find((d) => d.palace.id === 'SE');
  assert.equal(se.good, null);
  // 七赤(金)は土が生む関係 → 吉
  assert.equal(r.directions.find((d) => d.palace.id === 'SW').good, 'good');
});

test('五黄が中宮の盤では五黄殺・暗剣殺がない/本命星が中宮なら本命殺がない', () => {
  const r = k.evaluateBoard(5, '子', 5, 'year');
  r.directions.forEach((d) => {
    assert.ok(!d.bad.includes('gooSatsu') && !d.bad.includes('ankenSatsu') && !d.bad.includes('honmeiSatsu'));
  });
});

test('五行の関係', () => {
  assert.equal(k.relation('metal', 'water'), 'supports'); // 金生水
  assert.equal(k.relation('wood', 'water'), 'drains');    // 水生木
  assert.equal(k.relation('earth', 'water'), 'pressures'); // 土剋水
  assert.equal(k.relation('fire', 'water'), 'controls');  // 水剋火
  assert.equal(k.relation('water', 'water'), 'same');
});

test('方位の区分(東西南北30°・四隅60°)', () => {
  assert.equal(k.palaceOfBearing(344.9), 'NW');
  assert.equal(k.palaceOfBearing(345), 'N');
  assert.equal(k.palaceOfBearing(14.9), 'N');
  assert.equal(k.palaceOfBearing(15), 'NE');
  assert.equal(k.palaceOfBearing(75), 'E');
  assert.equal(k.palaceOfBearing(105), 'SE');
  assert.equal(k.palaceOfBearing(165), 'S');
  assert.equal(k.palaceOfBearing(195), 'SW');
  assert.equal(k.palaceOfBearing(255), 'W');
  assert.equal(k.palaceOfBearing(285), 'NW');
});

test('「M月」はM月の節入りから始まる月(11/2に見ると、11/7の立冬から始まる亥月)', () => {
  const c = k.currentFortune(jst('2026-11-02T12:00:00'), 1);
  assert.equal(c.target.calendarMonth, 11);
  assert.equal(c.target.beforeSetsu, true);
  assert.equal(c.kigakuYear, 2026);
  assert.equal(c.year.centerStar.num, 1);
  assert.equal(c.monthIndex, 10);           // 亥月
  assert.equal(c.month.centerStar.num, 8);   // 一白年の亥月 = 八白
  assert.equal(c.year.honmeiPalace, 'C');
  const after = k.currentFortune(jst('2026-11-20T12:00:00'), 1);
  assert.equal(after.target.beforeSetsu, false);
  assert.equal(after.monthIndex, 10);
  const oct = k.currentFortune(jst('2026-10-20T12:00:00'), 1);
  assert.equal(oct.monthIndex, 9);           // 戌月(寒露 10/8〜)
  assert.equal(oct.month.centerStar.num, 9);
});

test('2月1日(立春前)に見ると、立春から始まる新しい年・寅月になる', () => {
  const c = k.currentFortune(jst('2027-02-01T12:00:00'), 1);
  assert.equal(c.kigakuYear, 2027);
  assert.equal(c.year.centerStar.num, 9); // 2027年=九紫中宮
  assert.equal(c.monthIndex, 1);          // 寅月
  assert.equal(c.target.calendarMonth, 2);
});

test('1月(小寒は1月5日ごろ)は前年の年盤の丑月', () => {
  const c = k.currentFortune(jst('2027-01-20T12:00:00'), 1);
  assert.equal(c.kigakuYear, 2026);
  assert.equal(c.monthIndex, 12);
  assert.equal(c.target.calendarMonth, 1);
});

test('季節フェーズの割り当て', () => {
  assert.equal(k.phaseOf('SW'), 'spring');
  assert.equal(k.phaseOf('E'), 'spring');
  assert.equal(k.phaseOf('SE'), 'summer');
  assert.equal(k.phaseOf('C'), 'turning');
  assert.equal(k.PHASE_NAMES.turning, '転換期(足元を固める)');
  assert.equal(k.phaseOf('NW'), 'autumn');
  assert.equal(k.phaseOf('W'), 'autumn');
  assert.equal(k.phaseOf('S'), 'autumn');
  assert.equal(k.phaseOf('NE'), 'winter');
  assert.equal(k.phaseOf('N'), 'winter');
});
