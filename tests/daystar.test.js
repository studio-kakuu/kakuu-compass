// 日盤(日家九星)・ラッキーデー・相性の星・ラッキーカラーのテスト
const test = require('node:test');
const assert = require('node:assert/strict');
const k = require('../js/core/kyusei.js');

const D = (y, m, d) => k.dayNumber(y, m, d);
const jst = (s) => new Date(s + '+09:00');

test('日の干支: 2026-06-19・2026-12-16・2021-01-16 は甲子', () => {
  assert.equal(k.kanshiIndex(D(2026, 6, 19)), 0);
  assert.equal(k.kanshiIndex(D(2026, 12, 16)), 0);
  assert.equal(k.kanshiIndex(D(2021, 1, 16)), 0);
  assert.equal(k.kanshiIndex(D(2026, 6, 20)), 1); // 乙丑
});

test('2026年 陰遁始め 6/19(甲子・九紫)の前後', () => {
  assert.equal(k.dayStar(D(2026, 6, 18)).star, 9); // 陽遁の最終日も九紫
  assert.equal(k.dayStar(D(2026, 6, 18)).kind, 'yang');
  const d = k.dayStar(D(2026, 6, 19));
  assert.equal(d.star, 9);
  assert.equal(d.kind, 'yin');
  assert.equal(k.dayStar(D(2026, 6, 20)).star, 8); // 陰遁は 9→8→7…
});

test('2026年 陽遁始め 12/16(甲子・一白)の前後', () => {
  assert.equal(k.dayStar(D(2026, 12, 15)).star, 1); // 陰遁の最終日も一白
  assert.equal(k.dayStar(D(2026, 12, 15)).kind, 'yin');
  const d = k.dayStar(D(2026, 12, 16));
  assert.equal(d.star, 1);
  assert.equal(d.kind, 'yang');
  assert.equal(k.dayStar(D(2026, 12, 17)).star, 2); // 陽遁は 1→2→3…
});

test('2021年 陽遁始めは 1/16(甲子)', () => {
  assert.equal(k.dayStar(D(2021, 1, 16)).kind, 'yang');
  assert.equal(k.dayStar(D(2021, 1, 15)).kind, 'yin');
  assert.equal(k.dayStar(D(2021, 1, 16)).star, 1);
});

test('切り替え日は至(夏至・冬至)の前後31日以内、期間は180日か210日(閏)', () => {
  const pts = k.switchPoints(2045).filter((p) => p.day >= D(1995, 1, 1));
  const all = [];
  for (let y = 2000; y <= 2060; y += 4) k.switchPoints(y).forEach((p) => { if (!all.some((q) => q.day === p.day)) all.push(p); });
  all.sort((a, b) => a.day - b.day);
  for (let i = 1; i < all.length; i++) {
    const gap = all[i].day - all[i - 1].day;
    assert.ok(gap === 180 || gap === 210, 'gap ' + gap);
    assert.notEqual(all[i].kind, all[i - 1].kind); // 陽遁と陰遁が交互
  }
  for (const p of all) {
    const sol = (p.solstice.getTime() + 9 * 3600e3) / 864e5;
    assert.ok(Math.abs(p.day - sol) <= 31, 'distance');
  }
  assert.ok(all.some((p) => p.leap), '閏が少なくとも1回ある');
  assert.ok(pts.length > 0);
});

test('閏の切り替えは甲午日で、陽遁は七赤・陰遁は三碧から始まる', () => {
  const all = [];
  for (let y = 2000; y <= 2060; y += 4) k.switchPoints(y).forEach((p) => { if (!all.some((q) => q.day === p.day)) all.push(p); });
  for (const p of all.filter((x) => x.leap)) {
    assert.equal(k.kanshiIndex(p.day), 30); // 甲午
    assert.equal(p.startStar, p.kind === 'yang' ? 7 : 3);
  }
});

test('日の九星は毎日1つずつ進む(戻る)。切り替え日だけ同じ星が2日続く(2000〜2060年)', () => {
  let prev = k.dayStar(D(2000, 1, 1));
  for (let dn = D(2000, 1, 2); dn <= D(2060, 12, 31); dn++) {
    const cur = k.dayStar(dn);
    if (cur.since === dn) {
      assert.equal(cur.star, prev.star, 'switch day ' + dn);
    } else {
      const step = cur.kind === 'yang' ? 1 : -1;
      assert.equal(cur.star, ((prev.star - 1 + step + 9) % 9) + 1, 'day ' + dn);
    }
    prev = cur;
  }
});

test('ラッキーデー: 期間・件数・ルール', () => {
  for (let honmei = 1; honmei <= 9; honmei++) {
    const r = k.luckyDays(jst('2026-11-02T12:00:00'), honmei, 3);
    assert.ok(r.days.length <= 3);
    assert.deepEqual([r.start.m, r.start.d], [11, 2]);
    assert.deepEqual([r.end.m, r.end.d], [11, 30]);
    let last = -1;
    for (const d of r.days) {
      assert.ok(d.dn > last); last = d.dn;              // 日付順
      assert.notEqual(d.star.num, 5);                    // 五黄の日は除く
      assert.notEqual(d.star.num, honmei);               // 本命星が中宮の日は除く
      assert.ok(['supports', 'same', 'drains'].includes(d.relation));
      const board = k.makeBoard(d.star.num);
      const hp = k.palaceOfStar(board, honmei);
      assert.notEqual(hp, k.OPPOSITE[k.palaceOfStar(board, 5)]);       // 暗剣殺でない
      assert.notEqual(hp, k.OPPOSITE[k.BRANCH_PALACE[d.branch]]);      // 日破でない
    }
  }
});

test('ラッキーデー: 生気(力をもらえる日)が優先される', () => {
  const r = k.luckyDays(jst('2026-11-02T12:00:00'), 1, 3);
  const rank = { supports: 3, same: 2, drains: 1 };
  const minPicked = Math.min(...r.days.map((d) => rank[d.relation]));
  assert.ok(minPicked >= 2 || r.days.length < 3 || r.candidates <= 3);
});

test('ラッキーデー: 月末で残りが10日未満なら翌月末まで', () => {
  const r = k.luckyDays(jst('2026-11-25T12:00:00'), 3, 3);
  assert.equal(r.extended, true);
  assert.deepEqual([r.end.y, r.end.m, r.end.d], [2026, 12, 31]);
  const r2 = k.luckyDays(jst('2026-11-21T12:00:00'), 3, 3); // 残り10日
  assert.equal(r2.extended, false);
  const r3 = k.luckyDays(jst('2026-12-28T12:00:00'), 3, 3); // 年をまたぐ
  assert.deepEqual([r3.end.y, r3.end.m, r3.end.d], [2027, 1, 31]);
});

test('相性の星(相生・比和)', () => {
  const f1 = k.friendStars(1); // 一白=水
  assert.deepEqual(f1.supports.map((s) => s.num), [6, 7]); // 金生水
  assert.deepEqual(f1.same.map((s) => s.num), [1]);
  assert.deepEqual(f1.drains.map((s) => s.num), [3, 4]);   // 水生木
  const f5 = k.friendStars(5); // 五黄=土
  assert.deepEqual(f5.supports.map((s) => s.num), [9]);
  assert.deepEqual(f5.same.map((s) => s.num), [2, 5, 8]);
  assert.deepEqual(f5.drains.map((s) => s.num), [6, 7]);
});

test('ラッキーカラー: 〇月の盤の吉方位(指定した方位を優先)の星の色 → なければ生気の星', () => {
  for (let h = 1; h <= 9; h++) {
    const f = k.currentFortune(jst('2026-11-02T12:00:00'), h);
    const c = k.luckyColor(f, h);
    assert.equal(c.color, k.STAR_COLORS[c.star.num]);
    const goods = f.month.directions.filter((d) => d.good);
    if (goods.length) {
      assert.ok(goods.some((d) => d.palace.id === c.palace.id), 'month good');
      if (goods.some((d) => d.good === 'best')) assert.equal(c.rule, 'best');
      const other = goods[goods.length - 1].palace.id;
      assert.equal(k.luckyColor(f, h, other).palace.id, other); // 指定した方位を優先
    } else {
      assert.equal(c.rule, 'supports');
      assert.equal(k.relation(c.star.element, k.STARS[h].element), 'supports');
    }
  }
  assert.equal(k.STAR_COLORS[9].name, '紫');
  assert.equal(k.STAR_COLORS[3].name, '青');
});
