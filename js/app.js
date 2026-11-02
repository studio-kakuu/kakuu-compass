/*
 * COMPASS - 画面の動き
 * 入力データは変数(メモリ)にだけ持ち、localStorage・cookie・通信は一切使わない。
 */
(function () {
  'use strict';
  var C = window.Compass;
  var TX = window.COMPASS_TEXTS;
  var $ = function (id) { return document.getElementById(id); };

  var state = { input: null, answers: {}, report: null };

  // ---------- 初期化 ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function init() {
    $('disclaimer').textContent = TX.disclaimer;
    var today = new Date();
    $('birthdate').max = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

    C.geo.PREFS.forEach(function (p) {
      $('birthPref').appendChild(new Option(p.name, p.name));
      $('homePref').appendChild(new Option(p.name, p.name));
    });

    TX.themes.forEach(function (t, i) {
      var lab = el('label', 'chip');
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'theme'; inp.value = t.id;
      if (i === 0) inp.required = true;
      if (t.default) inp.checked = true;
      lab.appendChild(inp);
      var sp = el('span', null, t.name);
      if (t.note) sp.appendChild(el('small', null, t.note));
      lab.appendChild(sp);
      $('themes').appendChild(lab);
    });
    $('themes').addEventListener('change', renderSituation);
    $('form1').addEventListener('change', function () { $('error1').hidden = true; });
    renderSituation();

    $('timeUnknown').addEventListener('change', function () {
      $('birthtime').disabled = this.checked;
      if (!this.checked) $('birthtime').focus();
    });

    buildQuestions();

    $('form1').addEventListener('submit', onSubmit1);
    $('form2').addEventListener('submit', onSubmit2);
    $('back1').addEventListener('click', function () { show(1); });
    $('back2').addEventListener('click', function () { show(2); });
    $('restart').addEventListener('click', restart);
    $('copyBtn').addEventListener('click', function () { copyText(C.report.clipboardText(state.report, { hideBirth: !birthOn() }), 'コピーしました。AIチャットの入力欄に貼り付けてください。'); });
    $('copyAllBtn').addEventListener('click', function () { copyText(C.report.toText(state.report, false, { hideBirth: !birthOn() }), 'レポートの全文をコピーしました。'); });
    $('shareBtn').addEventListener('click', shareSummary);
    $('cardBtn').addEventListener('click', saveCard);
    $('includeBirth').addEventListener('change', function () { if (!$('cardPreview').hidden) drawCard(); });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---------- テーマ別「今の状況」の質問 ----------
  function currentTheme() {
    var t = document.querySelector('input[name="theme"]:checked');
    return t ? t.value : null;
  }
  function renderSituation() {
    var box = $('situation');
    box.textContent = '';
    var qs = (TX.situations && TX.situations[currentTheme()]) || [];
    if (!qs.length) return;
    box.appendChild(el('p', 'situation-lead', '「' + TX.themes.filter(function (t) { return t.id === currentTheme(); })[0].name + '」について、今の状況を教えてください'));
    qs.forEach(function (q) {
      var fs = el('fieldset', 'field');
      var lg = el('legend', null, q.text);
      lg.appendChild(el('span', 'req', '必須'));
      fs.appendChild(lg);
      var chips = el('div', 'chips');
      q.options.forEach(function (o) {
        var lab = el('label', 'chip');
        var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'sit-' + q.id; inp.value = o.id;
        lab.appendChild(inp);
        lab.appendChild(el('span', null, o.label));
        chips.appendChild(lab);
      });
      fs.appendChild(chips);
      box.appendChild(fs);
    });
  }

  function buildQuestions() {
    var box = $('questions');
    TX.questions.forEach(function (q, i) {
      var wrap = el('div', 'q');
      wrap.id = 'q-' + q.id;
      wrap.setAttribute('role', 'radiogroup');
      wrap.setAttribute('aria-labelledby', 'qt-' + q.id);
      var legend = el('p', 'q-text');
      legend.id = 'qt-' + q.id;
      legend.appendChild(el('span', 'q-num', 'Q' + (i + 1)));
      legend.appendChild(document.createTextNode(q.text));
      wrap.appendChild(legend);
      var scale = el('div', 'scale');
      for (var v = 1; v <= 7; v++) {
        var lab = el('label');
        var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = q.id; inp.value = String(v);
        inp.setAttribute('aria-label', v + ':' + TX.scaleLabels[v - 1]);
        lab.appendChild(inp);
        lab.appendChild(el('span', null, String(v)));
        scale.appendChild(lab);
      }
      wrap.appendChild(scale);
      var ends = el('div', 'scale-ends');
      ends.appendChild(el('span', null, '← ' + TX.scaleLabels[0]));
      ends.appendChild(el('span', null, TX.scaleLabels[6] + ' →'));
      wrap.appendChild(ends);
      var sel = el('p', 'selected-label');
      sel.setAttribute('aria-live', 'polite');
      wrap.appendChild(sel);
      wrap.addEventListener('change', function (e) {
        var v = Number(e.target.value);
        state.answers[q.id] = v;
        wrap.classList.add('is-answered');
        sel.textContent = '選択中:' + v + '(' + TX.scaleLabels[v - 1] + ')';
        $('answered').textContent = String(Object.keys(state.answers).length);
        $('error2').hidden = true;
      });
      box.appendChild(wrap);
    });
  }

  // ---------- 画面切り替え ----------
  function show(n) {
    [1, 2, 3].forEach(function (i) { $('step' + i).hidden = i !== n; });
    var lis = document.querySelectorAll('.steps li');
    for (var i = 0; i < lis.length; i++) {
      var s = Number(lis[i].getAttribute('data-step'));
      lis[i].className = s === n ? 'is-current' : (s < n ? 'is-done' : '');
      if (s === n) lis[i].setAttribute('aria-current', 'step'); else lis[i].removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
    var h = $('step' + n).querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function showError(id, msg) { var e = $(id); e.textContent = msg; e.hidden = false; }

  function onSubmit1(ev) {
    ev.preventDefault();
    $('error1').hidden = true;
    var nickname = $('nickname').value.trim();
    var bd = $('birthdate').value;
    var timeUnknown = $('timeUnknown').checked;
    var bt = $('birthtime').value;
    var home = $('homePref').value;
    var themeEl = document.querySelector('input[name="theme"]:checked');
    if (!nickname) return showError('error1', 'ニックネームを入力してください。');
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bd);
    if (!m) return showError('error1', '生年月日を入力してください。');
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var check = new Date(Date.UTC(y, mo - 1, d));
    if (y < 1900 || check.getUTCMonth() !== mo - 1 || check.getTime() > Date.now()) return showError('error1', '生年月日は1900年1月1日から今日までの日付で入力してください。');
    var hh = null, mm = null;
    if (!timeUnknown) {
      var t = /^(\d{2}):(\d{2})/.exec(bt);
      if (!t) return showError('error1', '出生時刻を入力するか、「わからない」にチェックを入れてください。');
      hh = Number(t[1]); mm = Number(t[2]);
    }
    if (!home) return showError('error1', '現在住んでいる都道府県を選んでください。');
    if (!themeEl) return showError('error1', '相談テーマを選んでください。');
    var situation = {};
    var sitQs = (TX.situations && TX.situations[themeEl.value]) || [];
    for (var i = 0; i < sitQs.length; i++) {
      var sel = document.querySelector('input[name="sit-' + sitQs[i].id + '"]:checked');
      if (!sel) return showError('error1', '「' + sitQs[i].text + '」を選んでください。');
      situation[sitQs[i].id] = sel.value;
    }
    state.input = {
      nickname: nickname,
      birth: { y: y, m: mo, d: d, hh: hh, mm: mm, timeKnown: !timeUnknown },
      birthPref: $('birthPref').value || null,
      homePref: home,
      theme: themeEl.value,
      situation: situation
    };
    show(2);
  }

  function onSubmit2(ev) {
    ev.preventDefault();
    var missing = TX.questions.filter(function (q) { return !state.answers[q.id]; });
    if (missing.length) {
      showError('error2', 'まだ答えていない質問があります(' + missing.map(function (q) { return 'Q' + (TX.questions.indexOf(q) + 1); }).join('・') + ')。');
      var first = $('q-' + missing[0].id);
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var input = {};
    for (var k in state.input) input[k] = state.input[k];
    input.answers = state.answers;
    try {
      state.report = C.report.build(input, TX, new Date());
    } catch (e) {
      showError('error2', '計算中にエラーが起きました。入力内容を確かめてください。(' + e.message + ')');
      return;
    }
    renderReport(state.report);
    show(3);
  }

  // ---------- レポート表示 ----------
  function renderReport(rep) {
    var root = $('report');
    root.textContent = '';
    var head = el('div', 'report-head');
    var h = el('h2', null, rep.title);
    h.id = 'report-title';
    head.appendChild(h);
    head.appendChild(el('p', 'meta', '基準日:' + rep.generatedFor));
    root.appendChild(head);

    rep.sections.forEach(function (s) {
      var sec = el('section', 'r-section');
      sec.appendChild(el('h3', null, s.title));
      s.blocks.forEach(function (b) { sec.appendChild(renderBlock(b)); });
      root.appendChild(sec);
    });
  }

  function renderBlock(b) {
    var e, i;
    switch (b.t) {
      case 'p': return el('p', null, b.text);
      case 'note': return el('p', 'note', '※' + b.text);
      case 'h':
        e = el('h4', null, b.text);
        if (b.framework) e.appendChild(el('span', 'framework', b.framework));
        return e;
      case 'list':
      case 'olist':
        e = el(b.t === 'list' ? 'ul' : 'ol');
        b.items.forEach(function (x) { e.appendChild(el('li', null, x)); });
        return e;
      case 'card':
        e = el('div', 'r-card');
        e.appendChild(el('h5', null, b.title));
        e.appendChild(el('p', null, b.text));
        if (b.sub) e.appendChild(el('p', 'sub', b.sub));
        return e;
      case 'question': return el('p', 'question', b.text);
      case 'guide':
        e = el('div', 'guide-box');
        e.appendChild(el('p', 'guide-name', '「' + b.name + '」'));
        e.appendChild(el('p', 'guide-text', b.text));
        return e;
      case 'color':
        e = el('div', 'color-row');
        var dot = el('span', 'color-dot');
        dot.style.backgroundColor = b.hex;
        dot.setAttribute('aria-hidden', 'true');
        e.appendChild(dot);
        var cp = el('p', null, b.text);
        e.appendChild(cp);
        return e;
      case 'table':
        var wrap = el('div', 'table-wrap');
        var tb = el('table');
        var thead = el('thead'), tr = el('tr');
        b.head.forEach(function (x) { var th = el('th', null, x); th.scope = 'col'; tr.appendChild(th); });
        thead.appendChild(tr); tb.appendChild(thead);
        var tbody = el('tbody');
        b.rows.forEach(function (r) {
          var row = el('tr');
          r.forEach(function (x) {
            var td = el('td', null, x);
            if (/◎|○/.test(x)) td.classList.add('mark-good');
            else if (/×/.test(x)) td.classList.add('mark-bad');
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });
        tb.appendChild(tbody); wrap.appendChild(tb);
        return wrap;
      case 'bars':
        e = el('div', 'bars');
        b.items.forEach(function (x) {
          var bar = el('div', 'bar');
          var hd = el('div', 'bar-head');
          hd.appendChild(el('b', null, x.label));
          hd.appendChild(el('span', null, x.value.toFixed(1) + ' / 7(' + x.level + ')'));
          bar.appendChild(hd);
          var track = el('div', 'bar-track');
          track.setAttribute('role', 'img');
          track.setAttribute('aria-label', x.label + ' ' + x.value.toFixed(1) + ' / 7');
          var fill = el('div', 'bar-fill');
          fill.style.width = ((x.value - 1) / 6 * 100) + '%';
          track.appendChild(fill);
          bar.appendChild(track);
          var ends = el('div', 'bar-ends');
          ends.appendChild(el('span', null, x.low));
          ends.appendChild(el('span', null, x.high));
          bar.appendChild(ends);
          e.appendChild(bar);
        });
        return e;
      default:
        return el('div');
    }
  }

  // ---------- コピー・共有・カード ----------
  function birthOn() { return $('includeBirth').checked; }
  function msg(text) { $('copyMsg').textContent = text; }

  function copyText(text, okMsg) {
    if (!state.report) return;
    function ok() { msg(okMsg); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (done) ok(); else msg('コピーできませんでした。お手数ですが、レポートを選択してコピーしてください。');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else {
      fallback();
    }
  }

  function toolUrl() {
    var l = window.location;
    if (/^https?:$/.test(l.protocol)) return l.origin + l.pathname;
    return TX.toolUrl;
  }

  function shareSummary() {
    if (!state.report) return;
    var text = C.report.summaryText(state.report, TX, { includeBirth: birthOn(), url: toolUrl() });
    if (navigator.share) {
      navigator.share({ title: TX.share.title, text: text }).then(function () {
        msg('共有メニューを開きました。');
      }, function (err) {
        if (err && err.name === 'AbortError') { msg(''); return; }
        copyText(text, '共有メニューが使えなかったため、要約をコピーしました。');
      });
    } else {
      copyText(text, 'この環境では共有メニューが使えないため、要約をコピーしました。LINEやメールに貼り付けて送れます。');
    }
  }

  function drawCard() {
    var card = Object.assign({}, state.report.card, { url: toolUrl() });
    $('cardPreview').hidden = false;
    return C.card.draw($('cardCanvas'), card, TX.card, { includeBirth: birthOn() });
  }

  function saveCard() {
    if (!state.report) return;
    msg('カード画像を作っています…');
    drawCard().then(function (canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) { msg('画像を作れませんでした。'); return; }
        var name = 'compass-' + state.report.card.yearMonth.replace('.', '-') + '.png';
        var file = (typeof File === 'function') ? new File([blob], name, { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          navigator.share({ files: [file], title: TX.share.title }).then(function () {
            msg('共有メニューを開きました。');
          }, function (err) {
            if (err && err.name === 'AbortError') { msg(''); return; }
            download(canvas, name);
          });
        } else {
          download(canvas, name);
        }
      }, 'image/png');
    });
  }

  function download(canvas, name) {
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    msg('カード画像を保存しました(' + name + ')。');
  }

  function restart() {
    state = { input: null, answers: {}, report: null };
    $('form1').reset();
    $('form2').reset();
    $('birthtime').disabled = true;
    $('answered').textContent = '0';
    $('report').textContent = '';
    $('copyMsg').textContent = '';
    $('includeBirth').checked = false;
    $('cardPreview').hidden = true;
    renderSituation();
    var qs = document.querySelectorAll('.q');
    for (var i = 0; i < qs.length; i++) { qs[i].classList.remove('is-answered'); qs[i].querySelector('.selected-label').textContent = ''; }
    show(1);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
