/*
 * COMPASS - ラッキーデーをカレンダーに追加する .ics ファイルを作る(ブラウザ内で作成・外部通信なし)
 * - 終日の予定(DTSTART;VALUE=DATE)。iPhone(カレンダー)・Android(Googleカレンダー等)で開ける iCalendar 形式(RFC 5545)。
 * - タイトル:「ラッキーデー:〇〇(COMPASS)」/ 説明:その日に向いていること+ツールのURL
 * - 生年月日・ニックネームは入れない。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Compass = root.Compass || {};
    root.Compass.ics = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return String(y) + pad(m) + pad(d); }
  function nextDay(y, m, d) { var t = new Date(Date.UTC(y, m - 1, d + 1)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
  function stamp(date) {
    return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + 'T' + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';
  }

  /** テキスト値のエスケープ(\ ; , 改行) */
  function esc(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function utf8Len(ch) {
    var c = ch.codePointAt(0);
    return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  /** 1行75オクテット(UTF-8のバイト数)で折り返す。文字の途中では切らない */
  function fold(line) {
    var out = [], cur = '', bytes = 0, limit = 75;
    Array.from(line).forEach(function (ch) {
      var l = utf8Len(ch);
      if (bytes + l > limit) {
        out.push(cur);
        cur = ' ' + ch;      // 続きの行は先頭に半角スペース
        bytes = 1 + l;
        limit = 75;
      } else {
        cur += ch;
        bytes += l;
      }
    });
    out.push(cur);
    return out.join('\r\n');
  }

  function simpleHash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /**
   * @param {Array<{y:number,m:number,d:number,tag:string,text:string}>} days
   * @param {{url:string, now?:Date}} opts
   * @returns {string} .ics の中身(改行は CRLF)
   */
  function build(days, opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//KAKUU LAB//COMPASS//JA',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + esc('COMPASS ラッキーデー')
    ];
    days.forEach(function (d) {
      var nd = nextDay(d.y, d.m, d.d);
      var summary = 'ラッキーデー:' + d.tag + '(COMPASS)';
      var desc = d.text + (opts.url ? '\n' + opts.url : '');
      lines.push(
        'BEGIN:VEVENT',
        'UID:' + ymd(d.y, d.m, d.d) + '-' + simpleHash(d.tag + d.text) + '@kakuu-compass',
        'DTSTAMP:' + stamp(now),
        'DTSTART;VALUE=DATE:' + ymd(d.y, d.m, d.d),
        'DTEND;VALUE=DATE:' + ymd(nd[0], nd[1], nd[2]),
        'SUMMARY:' + esc(summary),
        'DESCRIPTION:' + esc(desc),
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  return { build: build, fold: fold, esc: esc };
});
