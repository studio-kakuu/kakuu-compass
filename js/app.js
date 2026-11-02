/*
 * COMPASS - 画面の動き
 * 入力データは変数(メモリ)にだけ持ち、localStorage・cookie・通信は一切使わない。
 */
(function () {
  'use strict';
  var C = window.Compass;
  var TX = window.COMPASS_TEXTS;
  var $ = function (id) { return document.getElementById(id); };

  // 入力・答えは画面を開いている間のメモリ(この変数)に置く。
  // 「この端末に覚えておく」をオンにした人だけ、この端末の localStorage にも保存する(送信はしない)
  var state = { input: null, answers: {}, extra: { cool: [], success: null }, report: null, reportKey: null, current: 1, sitMemory: {}, checks: {}, remember: false };

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
    // テーマごとの「今の状況」の答えを覚えておく(画面を開いている間のメモリだけ)
    $('situation').addEventListener('change', function (e) {
      var m = /^sit-(\w+)$/.exec(e.target.name || '');
      if (m) rememberSituation(currentTheme(), m[1], e.target.value);
    });
    $('form1').addEventListener('change', function () { $('error1').hidden = true; });
    renderSituation();

    $('timeUnknown').addEventListener('change', function () {
      $('birthtime').disabled = this.checked;
      if (!this.checked) $('birthtime').focus();
    });

    buildQuestions();
    buildExtra();
    $('toTop').addEventListener('click', function () { window.scrollTo(0, 0); var h = $('report-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } });
    window.addEventListener('scroll', updateToTop, { passive: true });

    $('form1').addEventListener('submit', onSubmit1);
    $('form2').addEventListener('submit', onSubmit2);
    var stepBtns = document.querySelectorAll('.step-btn');
    for (var sb = 0; sb < stepBtns.length; sb++) stepBtns[sb].addEventListener('click', onStepClick);
    $('rebuildBtn').addEventListener('click', rebuild);
    $('back1').addEventListener('click', function () { show(1); });
    $('back2').addEventListener('click', function () { show(2); });
    $('restart').addEventListener('click', restart);
    $('copyBtn').addEventListener('click', copyAi);
    $('copyAllBtn').addEventListener('click', function () { copyText(C.report.toText(state.report, false, { hideBirth: !birthOn() }), 'レポートの全文をコピーしました。'); });
    $('shareBtn').addEventListener('click', shareSummary);
    $('cardBtn').addEventListener('click', saveCard);
    $('includeBirth').addEventListener('change', function () { if (!$('cardPreview').hidden) drawCard(); });
    initMemory();
  }

  // ---------- この端末に覚えておく(本人が選んだときだけ保存) ----------
  var persistTimer = null;
  function persistSoon() {
    if (!state.remember) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 0);
  }
  function snapshot() {
    var themeEl = document.querySelector('input[name="theme"]:checked');
    return {
      savedAt: new Date().toISOString(),
      form: {
        nickname: $('nickname').value, birthdate: $('birthdate').value, birthtime: $('birthtime').value,
        timeUnknown: $('timeUnknown').checked, birthPref: $('birthPref').value, homePref: $('homePref').value,
        theme: themeEl ? themeEl.value : null
      },
      sitMemory: state.sitMemory, answers: state.answers, extra: state.extra, checks: state.checks
    };
  }
  function persist() { if (state.remember) C.store.save(snapshot()); }
  function memMsg(text) { $('memMsg1').textContent = text; $('memMsg2').textContent = text; }
  function setRemember(on, quiet) {
    state.remember = !!on;
    $('remember').checked = state.remember;
    $('remember2').checked = state.remember;
    if (state.remember) {
      var ok = C.store.save(snapshot());
      if (!quiet) memMsg(ok ? 'この端末の中に保存しました。サーバーへは送信していません。' : 'この端末に保存できませんでした。');
    } else {
      C.store.clear();
      if (!quiet) memMsg('この端末の記憶を消しました。');
    }
  }
  function forget() {
    setRemember(false, true);
    memMsg('この端末の記憶を消しました。画面の入力はそのまま残っています。');
  }
  function initMemory() {
    var ok = C.store.available();
    ['remember', 'remember2'].forEach(function (id) {
      $(id).addEventListener('change', function () { setRemember(this.checked); });
      if (!ok) { $(id).disabled = true; }
    });
    $('forget1').addEventListener('click', forget);
    $('forget2').addEventListener('click', forget);
    if (!ok) memMsg('この環境では、この端末に保存できません(プライベートブラウズなど)。');
    // 入力や答えが変わったら(オンのときだけ)保存しなおす
    document.addEventListener('change', function (e) { if (e.target.id !== 'remember' && e.target.id !== 'remember2') persistSoon(); });
    $('nickname').addEventListener('input', persistSoon);
    // 前回の保存があれば、始め方を選んでもらう
    var data = ok ? C.store.load() : null;
    if (data && data.form) {
      var d = data.savedAt ? new Date(data.savedAt) : null;
      $('resumeDate').textContent = d && !isNaN(d) ? '保存した日時:' + d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + pad(d.getMinutes()) : '';
      $('resumeBox').hidden = false;
      $('resumeYes').addEventListener('click', function () { resumeFrom(data); });
      $('resumeNo').addEventListener('click', function () {
        C.store.clear();
        $('resumeBox').hidden = true;
        memMsg('この端末の記憶を消しました。最初から入力できます。');
        $('nickname').focus();
      });
    }
  }
  function resumeFrom(data) {
    var f = data.form || {};
    $('nickname').value = f.nickname || '';
    $('birthdate').value = f.birthdate || '';
    $('birthtime').value = f.birthtime || '';
    $('timeUnknown').checked = f.timeUnknown !== false;
    $('birthtime').disabled = $('timeUnknown').checked;
    $('birthPref').value = f.birthPref || '';
    $('homePref').value = f.homePref || '';
    var tInp = f.theme && document.querySelector('#themes input[value="' + f.theme + '"]');
    if (tInp) tInp.checked = true;
    state.sitMemory = data.sitMemory || {};
    renderSituation();
    // 性格の10問
    state.answers = {};
    Object.keys(data.answers || {}).forEach(function (qid) {
      var v = data.answers[qid];
      var inp = document.querySelector('input[name="' + qid + '"][value="' + v + '"]');
      if (!inp) return;
      inp.checked = true;
      state.answers[qid] = Number(v);
      var wrap = $('q-' + qid);
      if (wrap) { wrap.classList.add('is-answered'); wrap.querySelector('.selected-label').textContent = '選択中:' + v + '(' + TX.scaleLabels[v - 1] + ')'; }
    });
    // 追加の2問
    var ex = data.extra || {};
    state.extra = { cool: [], success: null };
    (ex.cool || []).forEach(function (id) { var i = document.querySelector('input[name="x-X1"][value="' + id + '"]'); if (i) { i.checked = true; state.extra.cool.push(id); } });
    if (ex.success) { var i2 = document.querySelector('input[name="x-X2"][value="' + ex.success + '"]'); if (i2) { i2.checked = true; state.extra.success = ex.success; } }
    if (state.extra.cool.length) { $('q-X1').classList.add('is-answered'); $('q-X1').querySelector('.selected-label').textContent = '選択中:' + state.extra.cool.length + 'つ'; }
    if (state.extra.success) { $('q-X2').classList.add('is-answered'); $('q-X2').querySelector('.selected-label').textContent = '選択中:' + TX.extraQuestions.success.options.filter(function (o) { return o.id === state.extra.success; })[0].label; }
    updateAnswered();
    state.checks = data.checks || {};
    $('resumeBox').hidden = true;
    setRemember(true, true);
    memMsg('前回の入力を読み込みました。');
    // そろっていればそのままレポートへ。足りなければ入力画面・質問画面へ
    var r = readInput();
    if (r.error) { show(1); showError('error1', r.error); return; }
    state.input = r.input;
    var a = checkAnswers();
    if (a) { show(2); showError('error2', a.error); return; }
    try { buildReport(); show(3); } catch (e) { show(2); showError('error2', '計算中にエラーが起きました。入力内容を確かめてください。(' + e.message + ')'); }
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
    // 前にこのテーマで選んだ答えがあれば、選んだ状態にもどす
    var mem = state.sitMemory[currentTheme()] || {};
    Object.keys(mem).forEach(function (qid) {
      var inp = box.querySelector('input[name="sit-' + qid + '"][value="' + mem[qid] + '"]');
      if (inp) inp.checked = true;
    });
  }

  function rememberSituation(theme, qid, value) {
    if (!theme) return;
    state.sitMemory[theme] = state.sitMemory[theme] || {};
    state.sitMemory[theme][qid] = value;
  }

  // ---------- レポートの最後:「相談テーマを変えて見る」 ----------
  function renderThemeSwitch(currentThemeId) {
    var sec = el('section', 'r-section r-themeswitch');
    sec.id = 'r-themeswitch';
    sec.setAttribute('aria-labelledby', 'tsw-title');
    var h = el('h3', null, '相談テーマを変えて見る');
    h.id = 'tsw-title';
    sec.appendChild(h);
    sec.appendChild(el('p', 'hint', 'ニックネーム・生年月日・都道府県・質問の答えはそのままに、相談テーマと今の状況の答えだけを変えてレポートを作り直します。'));
    var fs = el('fieldset', 'field tsw-themes');
    fs.appendChild(el('legend', 'sr-only', '相談テーマ'));
    var chips = el('div', 'chips');
    TX.themes.forEach(function (t) {
      var lab = el('label', 'chip');
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'tsw-theme'; inp.value = t.id;
      if (t.id === currentThemeId) inp.checked = true;
      lab.appendChild(inp);
      var sp = el('span', null, t.name);
      if (t.id === currentThemeId) sp.appendChild(el('small', null, 'いま表示中'));
      lab.appendChild(sp);
      chips.appendChild(lab);
    });
    fs.appendChild(chips);
    sec.appendChild(fs);
    var sitBox = el('div', 'tsw-sit');
    sitBox.setAttribute('aria-live', 'polite');
    sec.appendChild(sitBox);
    var err = el('p', 'error');
    err.setAttribute('role', 'alert');
    err.hidden = true;
    sec.appendChild(err);
    var btn = el('button', 'btn btn-primary tsw-btn', 'このテーマでレポートを作り直す');
    btn.type = 'button';
    sec.appendChild(btn);

    function selectedTheme() { var c = sec.querySelector('input[name="tsw-theme"]:checked'); return c ? c.value : currentThemeId; }
    function drawSit() {
      sitBox.textContent = '';
      err.hidden = true;
      var th = selectedTheme();
      var qs = TX.situations[th] || [];
      if (!qs.length) { sitBox.appendChild(el('p', 'hint', 'このテーマは、今の状況の質問はありません。')); return; }
      var mem = state.sitMemory[th] || {};
      qs.forEach(function (q) {
        var f = el('fieldset', 'field');
        f.id = 'tsw-q-' + q.id;
        var lg = el('legend', null, q.text);
        lg.appendChild(el('span', 'req', '必須'));
        f.appendChild(lg);
        var ch = el('div', 'chips');
        q.options.forEach(function (o) {
          var lab = el('label', 'chip');
          var inp = document.createElement('input');
          inp.type = 'radio'; inp.name = 'tsw-' + q.id; inp.value = o.id;
          if (mem[q.id] === o.id) inp.checked = true;
          lab.appendChild(inp);
          lab.appendChild(el('span', null, o.label));
          ch.appendChild(lab);
        });
        f.appendChild(ch);
        sitBox.appendChild(f);
      });
    }
    fs.addEventListener('change', drawSit);
    sitBox.addEventListener('change', function (e) {
      err.hidden = true;
      var m = /^tsw-(\w+)$/.exec(e.target.name || '');
      if (m) rememberSituation(selectedTheme(), m[1], e.target.value);
    });
    btn.addEventListener('click', function () {
      var th = selectedTheme();
      var qs = TX.situations[th] || [];
      for (var i = 0; i < qs.length; i++) {
        if (!sitBox.querySelector('input[name="tsw-' + qs[i].id + '"]:checked')) {
          err.textContent = '「' + qs[i].text + '」を選んでください。';
          err.hidden = false;
          var f = $('tsw-q-' + qs[i].id);
          if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      // 入力画面のテーマと状況の答えも新しいテーマに合わせてから、いつもの作り直しの流れへ
      var tInp = document.querySelector('#themes input[value="' + th + '"]');
      if (tInp) tInp.checked = true;
      renderSituation();
      rebuild();
    });
    drawSit();
    return sec;
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
        updateAnswered();
        $('error2').hidden = true;
      });
      box.appendChild(wrap);
    });
  }

  // ---------- 追加の質問(冷めるきっかけ・うまくいった型) ----------
  function updateAnswered() {
    var n = Object.keys(state.answers).length + (state.extra.cool.length ? 1 : 0) + (state.extra.success ? 1 : 0);
    $('answered').textContent = String(n);
  }
  function buildExtra() {
    var box = $('extraQs');
    var XQ = TX.extraQuestions;
    box.appendChild(el('h3', 'extra-title', 'あと2問(選択式)'));
    [['cool', 'checkbox'], ['success', 'radio']].forEach(function (pair, qi) {
      var q = XQ[pair[0]];
      var wrap = el('div', 'q');
      wrap.id = 'q-' + q.id;
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-labelledby', 'qt-' + q.id);
      var lg = el('p', 'q-text');
      lg.id = 'qt-' + q.id;
      lg.appendChild(el('span', 'q-num', 'Q' + (11 + qi)));
      lg.appendChild(document.createTextNode(q.text));
      wrap.appendChild(lg);
      wrap.appendChild(el('p', 'hint', q.note));
      var chips = el('div', 'chips chips-col');
      q.options.forEach(function (o) {
        var lab = el('label', 'chip');
        var inp = document.createElement('input');
        inp.type = pair[1]; inp.name = 'x-' + q.id; inp.value = o.id;
        lab.appendChild(inp);
        lab.appendChild(el('span', null, o.label));
        chips.appendChild(lab);
      });
      wrap.appendChild(chips);
      var sel = el('p', 'selected-label');
      sel.setAttribute('aria-live', 'polite');
      wrap.appendChild(sel);
      wrap.addEventListener('change', function (e) {
        if (pair[0] === 'cool') {
          var checked = Array.prototype.slice.call(wrap.querySelectorAll('input:checked'));
          if (checked.length > q.max) { e.target.checked = false; sel.textContent = q.max + 'つまで選べます。ほかの選択を外してから選んでください。'; return; }
          state.extra.cool = checked.map(function (x) { return x.value; });
          sel.textContent = state.extra.cool.length ? '選択中:' + state.extra.cool.length + 'つ' : '';
        } else {
          state.extra.success = e.target.value;
          sel.textContent = '選択中:' + q.options.filter(function (o) { return o.id === e.target.value; })[0].label;
        }
        wrap.classList.toggle('is-answered', pair[0] === 'cool' ? state.extra.cool.length > 0 : true);
        updateAnswered();
        $('error2').hidden = true;
      });
      box.appendChild(wrap);
    });
  }

  function updateToTop() {
    var on = !$('step3').hidden && window.scrollY > 600;
    $('toTop').hidden = !on;
  }

  // ---------- 画面切り替え ----------
  function show(n) {
    state.current = n;
    [1, 2, 3].forEach(function (i) { $('step' + i).hidden = i !== n; });
    updateSteps();
    if (n === 3) updateStale();
    // 移動先の画面の先頭へ
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    updateToTop();
    var h = $('step' + n).querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  // ---------- 上のステップ表示(押して移動できる) ----------
  function canGo(n) {
    if (n === 1) return true;
    if (n === 2) return !!state.input;      // 入力を一度終えたあと
    return !!state.report;                   // レポートを一度作ったあと
  }
  function updateSteps() {
    var btns = document.querySelectorAll('.step-btn');
    for (var i = 0; i < btns.length; i++) {
      var s = Number(btns[i].getAttribute('data-step'));
      var ok = canGo(s);
      btns[i].disabled = !ok;
      btns[i].className = 'step-btn' + (s === state.current ? ' is-current' : (ok ? ' is-done' : ''));
      if (s === state.current) btns[i].setAttribute('aria-current', 'step'); else btns[i].removeAttribute('aria-current');
      if (ok) btns[i].removeAttribute('title');
      else btns[i].title = s === 2 ? '入力を終えると選べます' : 'レポートを作ると選べます';
    }
  }
  function onStepClick(ev) {
    var n = Number(ev.currentTarget.getAttribute('data-step'));
    if (!canGo(n) || n === state.current) return;
    if (n === 2 && state.current === 1) {
      // 入力画面から質問へ進むときは、今の入力内容を確かめてから
      var r = readInput();
      if (r.error) { showError('error1', r.error); return; }
      state.input = r.input;
    }
    show(n);
  }

  // 入力画面の内容を読む(エラーがあれば error に文を入れて返す)
  function readInput() {
    var nickname = $('nickname').value.trim();
    var bd = $('birthdate').value;
    var timeUnknown = $('timeUnknown').checked;
    var bt = $('birthtime').value;
    var home = $('homePref').value;
    var themeEl = document.querySelector('input[name="theme"]:checked');
    if (!nickname) return { error: 'ニックネームを入力してください。' };
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bd);
    if (!m) return { error: '生年月日を入力してください。' };
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var check = new Date(Date.UTC(y, mo - 1, d));
    if (y < 1900 || check.getUTCMonth() !== mo - 1 || check.getTime() > Date.now()) return { error: '生年月日は1900年1月1日から今日までの日付で入力してください。' };
    var hh = null, mm = null;
    if (!timeUnknown) {
      var t = /^(\d{2}):(\d{2})/.exec(bt);
      if (!t) return { error: '出生時刻を入力するか、「わからない」にチェックを入れてください。' };
      hh = Number(t[1]); mm = Number(t[2]);
    }
    if (!home) return { error: '現在住んでいる都道府県を選んでください。' };
    if (!themeEl) return { error: '相談テーマを選んでください。' };
    var situation = {};
    var sitQs = (TX.situations && TX.situations[themeEl.value]) || [];
    for (var i = 0; i < sitQs.length; i++) {
      var sel = document.querySelector('input[name="sit-' + sitQs[i].id + '"]:checked');
      if (!sel) return { error: '「' + sitQs[i].text + '」を選んでください。' };
      situation[sitQs[i].id] = sel.value;
    }
    return {
      input: {
        nickname: nickname,
        birth: { y: y, m: mo, d: d, hh: hh, mm: mm, timeKnown: !timeUnknown },
        birthPref: $('birthPref').value || null,
        homePref: home,
        theme: themeEl.value,
        situation: situation
      }
    };
  }

  // 質問画面の答えがそろっているか(足りなければ error と移動先)
  function checkAnswers() {
    var missing = TX.questions.filter(function (q) { return !state.answers[q.id]; });
    if (missing.length) return { error: 'まだ答えていない質問があります(' + missing.map(function (q) { return 'Q' + (TX.questions.indexOf(q) + 1); }).join('・') + ')。', focus: 'q-' + missing[0].id };
    if (!state.extra.cool.length) return { error: '「' + TX.extraQuestions.cool.text + '」を1つ以上選んでください。', focus: 'q-X1' };
    if (!state.extra.success) return { error: '「' + TX.extraQuestions.success.text + '」を1つ選んでください。', focus: 'q-X2' };
    return null;
  }

  // 今の入力と答えの「指紋」(レポートを作ったときと比べて、変わったかどうかを見る)
  function currentKey() {
    var r = readInput();
    var ans = Object.keys(state.answers).sort().map(function (k) { return k + '=' + state.answers[k]; }).join(',');
    return JSON.stringify([r.input || r.error, ans, state.extra.cool.slice().sort(), state.extra.success]);
  }
  function updateStale() {
    $('staleNote').hidden = !state.report || currentKey() === state.reportKey;
  }

  function buildReport() {
    var input = {};
    for (var k in state.input) input[k] = state.input[k];
    input.answers = state.answers;
    input.extra = { cool: state.extra.cool.slice(), success: state.extra.success };
    state.report = C.report.build(input, TX, new Date());
    state.reportKey = currentKey();
    renderReport(state.report);
    $('copyMsg').textContent = '';
    $('cardPreview').hidden = true;
  }

  function rebuild() {
    var r = readInput();
    if (r.error) { show(1); showError('error1', r.error); return; }
    state.input = r.input;
    var a = checkAnswers();
    if (a) { show(2); showError('error2', a.error); var f = $(a.focus); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    try { buildReport(); } catch (e) { show(2); showError('error2', '計算中にエラーが起きました。入力内容を確かめてください。(' + e.message + ')'); return; }
    show(3);
  }

  function showError(id, msg) { var e = $(id); e.textContent = msg; e.hidden = false; }

  function onSubmit1(ev) {
    ev.preventDefault();
    $('error1').hidden = true;
    var r = readInput();
    if (r.error) return showError('error1', r.error);
    state.input = r.input;
    show(2);
  }

  function onSubmit2(ev) {
    ev.preventDefault();
    var a = checkAnswers();
    if (a) {
      showError('error2', a.error);
      var f = $(a.focus);
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try {
      buildReport();
    } catch (e) {
      showError('error2', '計算中にエラーが起きました。入力内容を確かめてください。(' + e.message + ')');
      return;
    }
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
      var sec = el('section', 'r-section r-' + s.id + (s.tone ? ' tone-' + s.tone : ''));
      sec.id = 'r-' + s.id;
      sec.appendChild(el('h3', null, s.title));
      s.blocks.forEach(function (b) { sec.appendChild(renderBlock(b)); });
      if (s.id === 'question') {
        var ai = el('button', 'btn btn-primary ai-inline', 'このレポートをAIに相談する(コピー)');
        ai.type = 'button';
        ai.addEventListener('click', copyAi);
        sec.appendChild(ai);
        sec.appendChild(el('p', 'hint', 'レポート全文に相談用の文章をつけてコピーします。お使いのAIチャットに貼り付けて相談できます(このページからは送信しません)。'));
      }
      root.appendChild(sec);
    });
    root.appendChild(renderThemeSwitch(state.input ? state.input.theme : null));

    // 付録(折りたたみ)
    var app = $('reportAppendix');
    app.textContent = '';
    var asec = el('section', 'r-section r-appendix');
    asec.id = 'r-appendix';
    asec.appendChild(el('h3', null, rep.appendixTitle));
    asec.appendChild(el('p', 'hint', 'タップすると開きます。'));
    rep.appendix.forEach(function (s) {
      var d = el('details', 'r-details');
      d.id = 'r-' + s.id;
      d.appendChild(el('summary', null, s.title));
      s.blocks.forEach(function (b) { d.appendChild(renderBlock(b)); });
      asec.appendChild(d);
    });
    app.appendChild(asec);
  }

  // 長い段落は、2文ほどずつに分けて読みやすくする(文の中身は変えない)
  function shortParas(text) {
    var frag = document.createDocumentFragment();
    var sents = text.match(/[^。]+。?/g) || [text];
    var cur = '';
    sents.forEach(function (st) {
      if (cur && (cur + st).length > 70) { frag.appendChild(el('p', null, cur)); cur = ''; }
      cur += st;
    });
    if (cur) frag.appendChild(el('p', null, cur));
    return frag;
  }

  function badge(text, tone) { return el('span', 'badge tone-' + tone, text); }

  // 小さな方位図(上が北・下が南)。marks の方位の縁に印、needle の方位を金色の針で指す
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ANG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  var SPAN = { N: 30, E: 30, S: 30, W: 30, NE: 60, SE: 60, SW: 60, NW: 60 };
  function svgEl(tag, attrs) { var x = document.createElementNS(SVGNS, tag); Object.keys(attrs).forEach(function (k) { x.setAttribute(k, attrs[k]); }); return x; }
  function pt(a, r) { var rad = (a - 90) * Math.PI / 180; return [50 + Math.cos(rad) * r, 50 + Math.sin(rad) * r]; }
  function miniCompass(marks, color, needle, label) {
    var svg = svgEl('svg', { viewBox: '0 0 100 100', width: '88', height: '88', role: 'img', 'aria-label': label, 'class': 'mini-compass' });
    svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 30, fill: 'none', stroke: '#6b6b66', 'stroke-width': 2 }));
    Object.keys(ANG).forEach(function (k) {
      var a = pt(ANG[k], 25), b2 = pt(ANG[k], 30);
      svg.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: b2[0], y2: b2[1], stroke: '#8a8a84', 'stroke-width': 1.5 }));
    });
    marks.forEach(function (id) {
      var half = SPAN[id] / 2 - 3, p1 = pt(ANG[id] - half, 30), p2 = pt(ANG[id] + half, 30);
      svg.appendChild(svgEl('path', { d: 'M' + p1[0] + ' ' + p1[1] + ' A30 30 0 0 1 ' + p2[0] + ' ' + p2[1], fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    });
    if (needle) {
      var tip = pt(ANG[needle], 24), l = pt(ANG[needle] + 90, 5), r = pt(ANG[needle] - 90, 5), tail = pt(ANG[needle] + 180, 10);
      svg.appendChild(svgEl('polygon', { points: [tip, l, tail, r].map(function (q) { return q[0] + ',' + q[1]; }).join(' '), fill: '#E9C46A' }));
    }
    svg.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 3, fill: needle ? '#E9C46A' : '#8a8a84' }));
    var n = svgEl('text', { x: 50, y: 13, 'text-anchor': 'middle', 'font-size': 12, fill: '#F4F4F1', 'font-weight': 700 }); n.textContent = '北';
    var so = svgEl('text', { x: 50, y: 96, 'text-anchor': 'middle', 'font-size': 12, fill: '#B9B9B2' }); so.textContent = '南';
    svg.appendChild(n); svg.appendChild(so);
    return svg;
  }

  // 行動のチェックリスト(同じ行動は要約と行動プランで同じチェック状態)
  function checkItem(item, num) {
    var li = el('li', 'check-item');
    var lab = el('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-act', item.id);
    cb.checked = !!state.checks[item.id];
    cb.addEventListener('change', function () {
      if (cb.checked) state.checks[item.id] = true; else delete state.checks[item.id];
      var same = document.querySelectorAll('input[data-act="' + item.id + '"]');
      for (var k = 0; k < same.length; k++) { same[k].checked = cb.checked; same[k].closest('li').classList.toggle('is-done', cb.checked); }
      persistSoon();
    });
    li.classList.toggle('is-done', cb.checked);
    lab.appendChild(cb);
    if (num) lab.appendChild(el('span', 'num', String(num)));
    lab.appendChild(el('span', 'check-text', item.text));
    li.appendChild(lab);
    return li;
  }

  function calendarButton() {
    var wrap = el('div', 'cal-wrap');
    var btn = el('button', 'btn btn-gold cal-btn', 'カレンダーに追加');
    btn.setAttribute('aria-label', 'ラッキーデーをカレンダーに追加');
    btn.type = 'button';
    var msgEl = el('p', 'copy-msg');
    msgEl.setAttribute('role', 'status');
    btn.addEventListener('click', function () { addToCalendar(msgEl); });
    wrap.appendChild(btn);
    wrap.appendChild(msgEl);
    return wrap;
  }

  function renderBlock(b) {
    var e, i;
    switch (b.t) {
      case 'p': return shortParas(b.text);
      case 'point':
        e = el('div', 'point tone-' + (b.tone || 'lime'));
        e.appendChild(el('span', 'point-label', 'ポイント'));
        e.appendChild(el('strong', null, b.text));
        return e;
      case 'panel':
        e = el('div', 'panel');
        e.appendChild(el('p', 'panel-label', b.monthLabel + 'の指針'));
        e.appendChild(el('p', 'panel-name', '「' + b.guideName + '」'));
        e.appendChild(el('p', 'panel-desc', b.guideDesc));
        var tiles = el('div', 'panel-tiles');
        var tg = el('div', 'tile tone-lime');
        tg.appendChild(el('p', 'tile-title', '吉方位'));
        tg.appendChild(miniCompass(b.good.map(function (d) { return d.id; }), '#C8F03C', b.needle, '吉方位の方位図'));
        tg.appendChild(el('p', 'tile-value', b.good.length ? b.good.map(function (d) { return d.name; }).join('・') : b.noGood));
        var tb2 = el('div', 'tile tone-orange');
        tb2.appendChild(el('p', 'tile-title', '避けたい方位'));
        tb2.appendChild(miniCompass(b.avoid.map(function (d) { return d.id; }), '#F2A65A', null, '避けたい方位の方位図'));
        var bv = el('p', 'tile-value', b.avoid.length ? b.avoid.map(function (d) { return d.name; }).join('・') : b.noBad);
        if (b.avoid.length && b.avoidMore) bv.appendChild(el('small', null, 'など'));
        tb2.appendChild(bv);
        tiles.appendChild(tg); tiles.appendChild(tb2);
        e.appendChild(tiles);
        var dayBox = el('div', 'panel-row tone-gold');
        dayBox.appendChild(el('p', 'row-title', 'ラッキーデー'));
        if (b.days.length) {
          var chips = el('div', 'day-chips');
          b.days.forEach(function (d) { var c = el('span', 'day-chip'); c.appendChild(el('b', null, d.date)); c.appendChild(el('small', null, d.tag)); chips.appendChild(c); });
          dayBox.appendChild(chips);
          dayBox.appendChild(calendarButton());
        } else dayBox.appendChild(el('p', null, b.noDays));
        e.appendChild(dayBox);
        var colorRow = el('div', 'panel-row tone-gold color-line');
        var dot = el('span', 'color-dot'); dot.style.backgroundColor = b.color.hex; dot.setAttribute('aria-hidden', 'true');
        colorRow.appendChild(el('p', 'row-title', 'ラッキーカラー'));
        var cv = el('p', 'color-value'); cv.appendChild(dot); cv.appendChild(el('b', null, b.color.name)); colorRow.appendChild(cv);
        e.appendChild(colorRow);
        var actBox = el('div', 'panel-row tone-lime');
        actBox.appendChild(el('p', 'row-title', '行動のヒント'));
        var ol = el('ul', 'checklist numbered');
        b.actions.forEach(function (a, k) { ol.appendChild(checkItem(a, k + 1)); });
        actBox.appendChild(ol);
        e.appendChild(actBox);
        var cau = el('div', 'panel-row tone-orange');
        cau.appendChild(el('p', 'row-title', '気をつけること'));
        cau.appendChild(el('p', null, b.caution));
        e.appendChild(cau);
        return e;
      case 'lucky':
        e = el('div', 'lucky-wrap');
        var ul3 = el('ul', 'lucky-list');
        b.items.forEach(function (x) {
          var li = el('li');
          li.appendChild(el('span', 'day-chip', x.date));
          var body = el('div', 'lucky-body');
          var head = el('p', 'lucky-head');
          head.appendChild(el('b', null, '「' + x.tag + '」向き'));
          head.appendChild(el('small', null, x.star + 'の日・' + x.rel));
          body.appendChild(head);
          body.appendChild(el('p', null, x.text + '。'));
          li.appendChild(body);
          ul3.appendChild(li);
        });
        e.appendChild(ul3);
        e.appendChild(calendarButton());
        return e;
      case 'dirs':
        e = el('ul', 'dir-list');
        b.items.forEach(function (x) {
          var li = el('li');
          li.appendChild(el('b', null, x.dir));
          li.appendChild(document.createTextNode(x.area + 'へ。' + x.act + 'の予定を'));
          li.appendChild(el('b', null, x.when));
          li.appendChild(document.createTextNode('に。'));
          li.appendChild(badge(x.badge, 'lime'));
          e.appendChild(li);
        });
        return e;
      case 'avoid':
        e = el('div', 'avoid-box');
        e.appendChild(el('p', 'row-title', '避けたい方角'));
        var ul4 = el('ul', 'avoid-list');
        b.items.forEach(function (x) {
          var li = el('li');
          li.appendChild(el('b', null, x.dir));
          x.labels.forEach(function (lb) { li.appendChild(badge(lb, 'orange')); });
          ul4.appendChild(li);
        });
        e.appendChild(ul4);
        e.appendChild(el('p', 'note', '言葉の意味は付録の用語集へ'));
        return e;
      case 'note': return el('p', 'note', '※' + b.text);
      case 'label': return el('p', 'basis', b.text);
      case 'pair':
        e = el('div', 'pair-box');
        var pa = el('p', 'pair-accel'); pa.appendChild(el('span', null, 'アクセル(強み)')); pa.appendChild(el('b', null, b.accel));
        var pb = el('p', 'pair-brake'); pb.appendChild(el('span', null, 'ブレーキ(盲点)')); pb.appendChild(el('b', null, b.brake));
        e.appendChild(pa); e.appendChild(pb);
        return e;
      case 'axes':
        e = el('div', 'axes');
        b.items.forEach(function (a) {
          var row = el('div', 'axis');
          var ends = el('div', 'axis-ends');
          ends.appendChild(el('span', null, a.minusName));
          ends.appendChild(el('span', null, a.plusName));
          row.appendChild(ends);
          var track = el('div', 'axis-track');
          track.setAttribute('role', 'img');
          var side = C.report.axisWord(a);
          track.setAttribute('aria-label', a.label + ':' + side);
          var fillEl = el('div', 'axis-fill' + (a.score < 0 ? ' neg' : ''));
          var w = Math.min(50, Math.abs(a.score) * 50);
          fillEl.style.width = w + '%';
          fillEl.style.left = (a.score < 0 ? 50 - w : 50) + '%';
          track.appendChild(fillEl);
          track.appendChild(el('span', 'axis-mid'));
          row.appendChild(track);
          row.appendChild(el('p', 'axis-word', side));
          e.appendChild(row);
        });
        return e;
      case 'plan':
        e = el('div', 'plan');
        b.groups.forEach(function (g) {
          var gr = el('div', 'plan-group');
          gr.appendChild(el('p', 'plan-label', g.label));
          var ul = el('ul', 'checklist');
          g.items.forEach(function (x) { ul.appendChild(checkItem(x)); });
          gr.appendChild(ul);
          e.appendChild(gr);
        });
        e.appendChild(el('p', 'note', '終わったら✓を付けてみてください。「この端末に覚えておく」をオンにすると、チェックもこの端末に保存されます。'));
        return e;
      case 'summary':
        e = el('dl', 'summary');
        b.items.forEach(function (it) {
          e.appendChild(el('dt', null, it.label));
          var dd = el('dd');
          if (it.list) { var ol = el('ol'); it.list.forEach(function (x) { ol.appendChild(el('li', null, x)); }); dd.appendChild(ol); }
          else dd.textContent = it.text;
          e.appendChild(dd);
        });
        return e;
      case 'toc':
        e = el('nav', 'toc');
        e.setAttribute('aria-label', '目次');
        e.appendChild(el('p', 'toc-title', '目次'));
        var ul2 = el('ul');
        b.items.forEach(function (it) {
          var li = el('li', it.sub ? 'sub' : null);
          var a = el('a', null, it.text);
          a.href = '#r-' + it.id;
          if (it.id === 'appendix') a.addEventListener('click', function () { var d = document.querySelector('#r-appendix details'); if (d) d.open = true; });
          li.appendChild(a);
          ul2.appendChild(li);
        });
        e.appendChild(ul2);
        return e;
      case 'gloss':
        e = el('dl', 'gloss');
        b.items.forEach(function (it) { e.appendChild(el('dt', null, it.term)); e.appendChild(el('dd', null, it.text)); });
        return e;
      case 'h':
        e = el('h4', b.tone ? 'tone-' + b.tone : null, b.text);
        if (b.id) e.id = 'r-' + b.id;
        if (b.framework) e.appendChild(el('span', 'framework', b.framework));
        return e;
      case 'list':
      case 'olist':
        e = el(b.t === 'list' ? 'ul' : 'ol', b.tone ? 'tone-list tone-' + b.tone : null);
        b.items.forEach(function (x) { e.appendChild(el('li', null, x)); });
        return e;
      case 'card':
        e = el('div', 'r-card' + (b.tone ? ' tone-' + b.tone : ''));
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
  function copyAi() { copyText(C.report.clipboardText(state.report, { hideBirth: !birthOn() }), 'コピーしました。AIチャットの入力欄に貼り付けてください。'); }
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

  function addToCalendar(msgEl) {
    if (!state.report || !state.report.ics.length) return;
    var text = C.ics.build(state.report.ics, { url: toolUrl() });
    var name = 'compass-luckydays.ics';
    var file = (typeof File === 'function') ? new File([text], name, { type: 'text/calendar' }) : null;
    function dl() {
      var a = document.createElement('a');
      a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      msgEl.textContent = 'カレンダー用のファイル(' + name + ')を保存しました。開くとカレンダーに追加できます。';
    }
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      navigator.share({ files: [file], title: 'COMPASS ラッキーデー' }).then(function () { msgEl.textContent = '共有メニューを開きました。'; }, function (err) {
        if (err && err.name === 'AbortError') { msgEl.textContent = ''; return; }
        dl();
      });
    } else {
      dl();
    }
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
    state = { input: null, answers: {}, extra: { cool: [], success: null }, report: null, reportKey: null, current: 1, sitMemory: {}, checks: {}, remember: state.remember };
    setRemember(false, true); // 入力を消すので、この端末の記憶も消す
    memMsg('');
    $('reportAppendix').textContent = '';
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
