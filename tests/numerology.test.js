// 数秘術のテスト(全桁加算・11/22/33はマスターナンバーとして残す方式)
const test = require('node:test');
const assert = require('node:assert/strict');
const nu = require('../js/core/numerology.js');

test('ライフパス: 通常の例', () => {
  assert.equal(nu.lifePath(1985, 2, 3).value, 1);   // 28 → 10 → 1
  assert.deepEqual(nu.lifePath(1985, 2, 3).steps, [28, 10, 1]);
  assert.equal(nu.lifePath(1990, 7, 15).value, 5);  // 32 → 5
  assert.equal(nu.lifePath(2001, 12, 22).value, 1); // 10 → 1
  assert.deepEqual(nu.lifePath(1999, 9, 9).steps, [46, 10, 1]); // 2段階で還元
});

test('ライフパス: 最初の合計がマスターナンバー', () => {
  assert.equal(nu.lifePath(2000, 1, 8).value, 11);  // 11
  assert.equal(nu.lifePath(2003, 8, 9).value, 22);  // 22
  assert.equal(nu.lifePath(1969, 7, 1).value, 33);  // 33
  assert.equal(nu.lifePath(1969, 7, 1).master, true);
});

test('ライフパス: 途中でマスターナンバーになる(29→11, 38→11)', () => {
  assert.deepEqual(nu.lifePath(1990, 1, 9).steps, [29, 11]);
  assert.deepEqual(nu.lifePath(1988, 3, 9).steps, [38, 11]);
});

test('ライフパス: マスターナンバーにならない2桁(20→2, 44→8)', () => {
  assert.equal(nu.lifePath(2000, 9, 9).value, 2);  // 2+9+9=20 → 2
  assert.equal(nu.lifePath(1989, 9, 8).value, 8);  // 1+9+8+9+0+9+0+8=44 → 8
});

test('バースデーナンバー', () => {
  assert.equal(nu.birthday(11).value, 11);
  assert.equal(nu.birthday(22).value, 22);
  assert.equal(nu.birthday(29).value, 11);
  assert.equal(nu.birthday(15).value, 6);
  assert.equal(nu.birthday(31).value, 4);
  assert.equal(nu.birthday(3).value, 3);
  assert.equal(nu.birthday(19).value, 1); // 10 → 1
});
