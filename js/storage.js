/*
 * COMPASS - 「この端末に覚えておく」(本人が選んだときだけ、この端末の localStorage に保存)
 * サーバーへの送信は一切しない。localStorage が使えない環境(プライベートブラウズなど)でも
 * エラーにならないよう、すべて try/catch で守る。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Compass = root.Compass || {};
    root.Compass.store = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KEY = 'kakuu-compass:v1';

  function ls(storage) {
    if (storage) return storage;
    try { return (typeof window !== 'undefined' && window.localStorage) || null; } catch (e) { return null; }
  }

  /** 使えるかどうか(書いて消せるか試す) */
  function available(storage) {
    try {
      var s = ls(storage);
      if (!s) return false;
      s.setItem(KEY + ':test', '1');
      s.removeItem(KEY + ':test');
      return true;
    } catch (e) { return false; }
  }

  /** 保存(成功したら true) */
  function save(data, storage) {
    try {
      var s = ls(storage);
      if (!s) return false;
      var body = { v: 1, savedAt: new Date().toISOString(), data: data };
      s.setItem(KEY, JSON.stringify(body));
      return true;
    } catch (e) { return false; }
  }

  /** 読み込み(なければ null) */
  function load(storage) {
    try {
      var s = ls(storage);
      if (!s) return null;
      var raw = s.getItem(KEY);
      if (!raw) return null;
      var body = JSON.parse(raw);
      if (!body || body.v !== 1 || !body.data) return null;
      return body.data;
    } catch (e) { return null; }
  }

  /** 消す(この端末の記憶を消す) */
  function clear(storage) {
    try {
      var s = ls(storage);
      if (!s) return false;
      s.removeItem(KEY);
      return true;
    } catch (e) { return false; }
  }

  return { KEY: KEY, available: available, save: save, load: load, clear: clear };
});
