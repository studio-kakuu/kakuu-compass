/*
 * COMPASS - 共有用カード画像(1080×1920 PNG)をブラウザ内の Canvas で描く
 * 外部ライブラリ・外部通信なし。同梱フォントの読み込み完了を待ってから描く。
 * データは report.build() が返す rep.card を使う。
 */
(function (root) {
  'use strict';
  var W = 1080, H = 1920;
  var C = {
    bg: '#0B0B0B', lime: '#C8F03C', gold: '#E9C46A', orange: '#F2A65A',
    white: '#F4F4F1', muted: '#B9B9B2', dim: 'rgba(255,255,255,0.35)', panel: 'rgba(255,255,255,0.035)'
  };
  var JA = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  var EN = '"Space Grotesk", "Zen Kaku Gothic New", sans-serif';
  var ANGLE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  var SPAN = { N: 30, E: 30, S: 30, W: 30, NE: 60, SE: 60, SW: 60, NW: 60 }; // 気学の区分(四正30°・四隅60°)
  var NO_LINE_START = '、。,.・:;!?!?)」』】ー〜…ぁぃぅぇぉっゃゅょァィゥェォッャュョ';

  function font(size, weight, fam) { return (weight || 400) + ' ' + size + 'px ' + (fam || JA); }

  /** 日本語の折り返し(1文字ずつ。行頭禁則を少しだけ) */
  function wrap(ctx, text, maxW) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        if (NO_LINE_START.indexOf(ch) !== -1 && line.length > 1) {
          lines.push(line.slice(0, -1));
          line = line.slice(-1) + ch;
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * 枠に収まるように、文字を小さくしながら折り返す。最小サイズでも収まらなければ最終行を「…」で切る。
   * @returns {{lines:string[], size:number, height:number}}
   */
  function fitLines(ctx, text, maxW, size, minSize, maxLines, weight, fam, lh) {
    lh = lh || 1.45;
    var s = size, lines;
    for (; s >= minSize; s -= 2) {
      ctx.font = font(s, weight, fam);
      lines = wrap(ctx, text, maxW);
      if (lines.length <= maxLines) return { lines: lines, size: s, height: lines.length * s * lh };
    }
    s = minSize;
    ctx.font = font(s, weight, fam);
    lines = wrap(ctx, text, maxW).slice(0, maxLines);
    var last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
    return { lines: lines, size: s, height: lines.length * s * lh };
  }

  function drawLines(ctx, fit, x, y, color, weight, fam, align, lh) {
    lh = lh || 1.45;
    ctx.font = font(fit.size, weight, fam);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    fit.lines.forEach(function (l, i) { ctx.fillText(l, x, y + fit.size + i * fit.size * lh - fit.size * 0.18); });
    return fit.height;
  }

  /** 1行に収める(縮小、それでも無理なら…) */
  function fitOne(ctx, text, maxW, size, minSize, weight, fam) {
    return fitLines(ctx, text, maxW, size, minSize, 1, weight, fam, 1.2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function toRad(deg) { return (deg - 90) * Math.PI / 180; } // 0°=上(北)、時計回り

  /** 方位図(上が北・下が南) */
  function compass(ctx, cx, cy, r, marks, markColor, needle) {
    ctx.save();
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    // 8方位の目盛り
    Object.keys(ANGLE).forEach(function (k) {
      var a = toRad(ANGLE[k]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    });
    // 縁の印(その方位の範囲を弧で)
    marks.forEach(function (id) {
      var half = SPAN[id] / 2 - 3;
      ctx.strokeStyle = markColor;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, toRad(ANGLE[id] - half), toRad(ANGLE[id] + half));
      ctx.stroke();
      var a = toRad(ANGLE[id]);
      ctx.fillStyle = markColor;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 16), 6, 0, Math.PI * 2); ctx.fill();
    });
    // 金色の針
    if (needle) {
      var na = toRad(ANGLE[needle]);
      var len = r - 18, wdt = 11;
      var tipX = cx + Math.cos(na) * len, tipY = cy + Math.sin(na) * len;
      var tailX = cx - Math.cos(na) * len * 0.45, tailY = cy - Math.sin(na) * len * 0.45;
      var px = -Math.sin(na) * wdt, py = Math.cos(na) * wdt;
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(cx + px, cy + py); ctx.lineTo(cx - px, cy - py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(233,196,106,0.4)';
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(cx + px, cy + py); ctx.lineTo(cx - px, cy - py); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = needle ? C.gold : C.dim;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    // 方位の文字
    ctx.font = font(24, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.white;
    ctx.fillText('北', cx, cy - r - 34);
    ctx.fillStyle = C.muted;
    ctx.fillText('南', cx, cy + r + 34);
    ctx.fillText('東', cx + r + 42, cy);
    ctx.fillText('西', cx - r - 42, cy);
    ctx.restore();
  }

  function sectionTitle(ctx, text, x, y, color) {
    ctx.font = font(30, 700);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y + 30);
    return 46;
  }

  /** カード上のすべての文字(フォントの読み込みに使う) */
  function allText(card, T, opts) {
    return [card.lead, card.guideName, card.guideDesc, card.doThere, card.caution, card.question, card.note, card.url, card.yearMonth,
      card.goodDirs.map(function (d) { return d.name; }).join(''), card.badDirs.map(function (d) { return d.name; }).join(''),
      card.luckyDays.join(''), card.actions.join(''), card.friends.supports.join(''), card.friends.same.join(''), card.color.name,
      opts.includeBirth ? card.birthLabel : '', 'KAKUU LAB / COMPASS 北南東西0123456789…',
      Object.keys(T).map(function (k) { return T[k]; }).join(''), '支えてくれる星気が合う星'].join('');
  }

  function loadFonts(text) {
    if (!(root.document && document.fonts && document.fonts.load)) return Promise.resolve();
    var specs = ['400 30px "Zen Kaku Gothic New"', '700 30px "Zen Kaku Gothic New"', '400 30px "Space Grotesk"', '500 30px "Space Grotesk"', '700 30px "Space Grotesk"'];
    return Promise.all(specs.map(function (s) { return document.fonts.load(s, text).catch(function () { return []; }); }))
      .then(function () { return document.fonts.ready; });
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} card rep.card
   * @param {object} T COMPASS_TEXTS.card(見出しの文言)
   * @param {{includeBirth?:boolean}} opts
   * @returns {Promise<HTMLCanvasElement>}
   */
  function draw(canvas, card, T, opts) {
    opts = opts || {};
    return loadFonts(allText(card, T, opts)).then(function () {
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      // 文章が長くて下の注意書きに重なりそうなら、余白を詰めた配置(compact)で描き直す
      for (var mode = 0; mode <= 2; mode++) {
        ctx.clearRect(0, 0, W, H);
        var end = paint(ctx, card, T, opts, mode);
        if (end <= FOOTER_TOP - 14) break;
      }
      return canvas;
    });
  }

  var FOOTER_TOP = 1752;
  function paint(ctx, card, T, opts, mode) {
    mode = mode || 0;
    var L = [
      { ch: 600, cr: 80, cyo: 190, gap: 36, act: 28, nameSize: 104 },
      { ch: 560, cr: 72, cyo: 178, gap: 28, act: 26, nameSize: 96 },
      { ch: 530, cr: 66, cyo: 168, gap: 22, act: 24, nameSize: 88 }
    ][mode];
    // 背景・光・円の模様・枠
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(540, -60, 40, 540, -60, 980);
    g.addColorStop(0, 'rgba(233,196,106,0.30)');
    g.addColorStop(0.45, 'rgba(233,196,106,0.08)');
    g.addColorStop(1, 'rgba(233,196,106,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    [150, 230, 310, 390, 470, 550].forEach(function (r, i) {
      ctx.strokeStyle = 'rgba(233,196,106,' + (0.16 - i * 0.02) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(540, 250, r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.setLineDash([2, 10]);
    ctx.strokeStyle = 'rgba(233,196,106,0.18)';
    ctx.beginPath(); ctx.arc(540, 250, 190, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(233,196,106,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    var X = 72, IW = W - 144;
    var y = 80;

    // ロゴ + 年月
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(34, 700, EN);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    var p1 = 'KAKUU LAB', p2 = '  /  ', p3 = 'COMPASS';
    var w1 = ctx.measureText(p1).width, w2 = ctx.measureText(p2).width, w3 = ctx.measureText(p3).width;
    var lx = (W - (w1 + w2 + w3)) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.white; ctx.fillText(p1, lx, y + 34);
    ctx.fillStyle = C.muted; ctx.fillText(p2, lx + w1, y + 34);
    ctx.fillStyle = C.lime; ctx.fillText(p3, lx + w1 + w2, y + 34);
    ctx.font = font(28, 500, EN);
    ctx.fillStyle = C.gold;
    ctx.textAlign = 'center';
    ctx.fillText(card.yearMonth, W / 2, y + 78);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    y += 92;
    if (opts.includeBirth) {
      ctx.font = font(24, 400);
      ctx.fillStyle = C.muted;
      ctx.fillText(card.birthLabel, W / 2, y + 30);
      y += 36;
    }

    // 〇〇さんの、〇月の指針
    y += 36;
    var lead = fitOne(ctx, card.lead, IW, 40, 28, 700);
    y += drawLines(ctx, lead, W / 2, y, C.white, 700, JA, 'center', 1.2) + 12;

    // 指針の名前(最大の文字)
    var gname = fitOne(ctx, '「' + card.guideName + '」', IW, L.nameSize, 60, 700);
    y += drawLines(ctx, gname, W / 2, y, C.lime, 700, JA, 'center', 1.2) + 6;

    // 説明(金色)
    var desc = fitLines(ctx, card.guideDesc, IW - 40, 36, 28, 2, 500, JA, 1.45);
    y += drawLines(ctx, desc, W / 2, y, C.gold, 400, JA, 'center', 1.45);

    // 2列のカード
    var top = y + 32;
    var cw = (IW - 28) / 2, ch = L.ch;
    var lx0 = X, rx0 = X + cw + 28;
    [[lx0, C.lime], [rx0, C.orange]].forEach(function (a) {
      roundRect(ctx, a[0], top, cw, ch, 28);
      ctx.fillStyle = C.panel; ctx.fill();
      ctx.strokeStyle = a[1]; ctx.lineWidth = 3; ctx.stroke();
    });
    var pad = 30, tw = cw - pad * 2;

    // 左: 追い風
    sectionTitle(ctx, T.tailwind, lx0 + pad, top + 26, C.lime);
    compass(ctx, lx0 + cw / 2, top + L.cyo, L.cr, card.goodDirs.map(function (d) { return d.id; }), C.lime, card.needle);
    var ly = top + L.cyo + L.cr + 62;
    ctx.font = font(24, 700); ctx.fillStyle = C.lime; ctx.textAlign = 'left';
    ctx.fillText(T.goodDirs, lx0 + pad, ly + 24); ly += 34;
    var gtxt = card.goodDirs.length ? card.goodDirs.map(function (d) { return d.name; }).join('・') : T.noGood;
    ly += drawLines(ctx, fitLines(ctx, gtxt, tw, 34, 26, 2, 700, JA, 1.3), lx0 + pad, ly, C.white, 700, JA, 'left', 1.3) + 12;
    ctx.font = font(24, 700); ctx.fillStyle = C.lime;
    var hasGood = card.goodDirs.length > 0;
    ctx.fillText(hasGood ? T.doThere : T.doThereNone, lx0 + pad, ly + 24); ly += 34;
    ly += drawLines(ctx, fitLines(ctx, hasGood ? card.doThere : T.noGoodDo, tw, 28, 24, 2, 400, JA, 1.4), lx0 + pad, ly, C.white, 400, JA, 'left', 1.4) + 12;
    ctx.font = font(24, 700); ctx.fillStyle = C.lime;
    ctx.fillText(T.color, lx0 + pad, ly + 24); ly += 36;
    ctx.fillStyle = card.color.hex;
    ctx.beginPath(); ctx.arc(lx0 + pad + 18, ly + 18, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = font(30, 700); ctx.fillStyle = C.white; ctx.textAlign = 'left';
    ctx.fillText(card.color.name, lx0 + pad + 50, ly + 29);

    // 右: 気をつけること
    sectionTitle(ctx, T.caution, rx0 + pad, top + 26, C.orange);
    compass(ctx, rx0 + cw / 2, top + L.cyo, L.cr, card.badDirs.map(function (d) { return d.id; }), C.orange, null);
    var ry = top + L.cyo + L.cr + 62;
    ctx.font = font(24, 700); ctx.fillStyle = C.orange; ctx.textAlign = 'left';
    ctx.fillText(T.badDirs, rx0 + pad, ry + 24); ry += 34;
    var btxt = card.badDirs.length ? card.badDirs.map(function (d) { return d.name; }).join('・') : T.noBad;
    ry += drawLines(ctx, fitLines(ctx, btxt, tw, 32, 24, 3, 700, JA, 1.3), rx0 + pad, ry, C.white, 700, JA, 'left', 1.3) + 12;
    ctx.font = font(24, 700); ctx.fillStyle = C.orange;
    ctx.fillText('注意', rx0 + pad, ry + 24); ry += 34;
    drawLines(ctx, fitLines(ctx, card.caution, tw, 28, 24, 3, 400, JA, 1.4), rx0 + pad, ry, C.white, 400, JA, 'left', 1.4);

    y = top + ch + L.gap;

    // ラッキーデー
    y += sectionTitle(ctx, T.luckyDays, X, y, C.gold) + 6;
    if (card.luckyDays.length) {
      var cx0 = X;
      card.luckyDays.forEach(function (d) {
        ctx.font = font(32, 700);
        var wd = ctx.measureText(d).width + 56;
        roundRect(ctx, cx0, y, wd, 64, 32);
        ctx.fillStyle = 'rgba(233,196,106,0.12)'; ctx.fill();
        ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = C.gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d, cx0 + wd / 2, y + 33);
        ctx.textBaseline = 'alphabetic';
        cx0 += wd + 20;
      });
      y += 64;
    } else {
      y += drawLines(ctx, fitOne(ctx, T.noDays, IW, 28, 24, 400), X, y, C.white, 400, JA, 'left', 1.2);
    }
    y += L.gap;

    // 行動のヒント
    y += sectionTitle(ctx, T.actions, X, y, C.lime) + 4;
    card.actions.forEach(function (a, i) {
      ctx.fillStyle = C.lime;
      ctx.beginPath(); ctx.arc(X + 20, y + 22, 20, 0, Math.PI * 2); ctx.fill();
      ctx.font = font(24, 700, EN); ctx.fillStyle = C.bg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), X + 20, y + 23);
      ctx.textBaseline = 'alphabetic';
      var f = fitLines(ctx, a, IW - 60, L.act, 24, 2, 400, JA, 1.4);
      y += Math.max(drawLines(ctx, f, X + 60, y, C.white, 400, JA, 'left', 1.4), 44) + 10;
    });
    y += L.gap - 10;

    // 力をくれる人
    y += sectionTitle(ctx, T.friends, X, y, C.gold) + 4;
    var ftxt = '支えてくれる星:' + card.friends.supports.join('・') + '/気が合う星:' + card.friends.same.join('・');
    y += drawLines(ctx, fitLines(ctx, ftxt, IW, 28, 24, 2, 400, JA, 1.4), X, y, C.white, 400, JA, 'left', 1.4) + 2;
    y += drawLines(ctx, fitOne(ctx, T.friendsNote, IW, 26, 22, 400), X, y, C.lime, 400, JA, 'left', 1.2);

    // 最下部(位置は固定)
    ctx.strokeStyle = 'rgba(233,196,106,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X, FOOTER_TOP); ctx.lineTo(W - X, FOOTER_TOP); ctx.stroke();
    drawLines(ctx, fitOne(ctx, card.question, IW, 34, 28, 700), W / 2, FOOTER_TOP + 14, C.lime, 700, JA, 'center', 1.2);
    drawLines(ctx, fitOne(ctx, card.url, IW, 24, 22, 500, EN), W / 2, FOOTER_TOP + 64, C.white, 500, EN, 'center', 1.2);
    drawLines(ctx, fitOne(ctx, card.note, IW, 22, 22, 400), W / 2, FOOTER_TOP + 100, C.muted, 400, JA, 'center', 1.2);
    return y;
  }

  root.Compass = root.Compass || {};
  root.Compass.card = { draw: draw, WIDTH: W, HEIGHT: H };
})(typeof self !== 'undefined' ? self : this);
