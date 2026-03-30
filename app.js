/**
 * AI Level Quiz — Telegram Web App
 *
 * Flow: Questions → CTA (offer → price → contact) → Result card
 * All in WebApp. Bot only receives final data via sendData().
 */

(function () {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  // ── DOM ────────────────────────────────────────────────────────
  const container = document.getElementById('question-container');
  const progressFill = document.getElementById('progress-fill');
  const navigation = document.getElementById('navigation');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');

  // ── State ──────────────────────────────────────────────────────
  let quizData = null;
  let questions = [];
  let currentIndex = -1;
  const answers = {};

  // CTA state
  let ctaResponse = {};  // { price_reaction, price_comment, contact_info }

  // ── Level data ─────────────────────────────────────────────────
  const LEVEL_NAMES = { 1:'Наблюдатель', 2:'Собеседник', 3:'Дирижёр', 4:'Изобретатель', 5:'Архитектор' };
  const LEVEL_COLORS = { 1:'#4CAF50', 2:'#2196F3', 3:'#9C27B0', 4:'#FF9800', 5:'#F44336' };
  const LEVEL_PHRASES = {
    1:'Ты пока наблюдаешь со стороны — и это нормально. Но пока ты наблюдаешь, AI уже пишет письма, анализирует документы и планирует отпуск за твоих коллег.',
    2:'Вы с AI на «вы» — вежливо общаетесь, но пока не доверяете ему серьёзные дела. А зря — он умеет гораздо больше, чем редактировать письма.',
    3:'Ты уже дирижируешь — AI делает то, что ты говоришь. Но представь: он мог бы делать это сам, без дирижёрской палочки. Знать твои задачи, контекст и правила — и действовать.',
    4:'Ты уже изобретаешь — строишь, пробуешь, экспериментируешь. Но пока каждое изобретение живёт отдельно. Что если собрать из них систему, которая собирает все твои наработки и использует во всех следующих проектах?',
    5:'Ты уже архитектор — у тебя есть своя система, и ты знаешь, как она устроена. Твой уровень 10/10!!!'
  };
  const LEVEL_TRACKS = { 1:'«Набор AI-инструментов»', 2:'«Набор AI-инструментов»', 3:'«Создавай с AI»', 4:'«Создавай с AI»', 5:'' };

  // ── Persistence ────────────────────────────────────────────────
  // Bump QUIZ_VERSION to force-clear all user data (for testing / content updates)
  const QUIZ_VERSION = '9';
  const VERSION_KEY = 'ai_quiz_version';
  const PROGRESS_KEY = 'ai_quiz_progress';
  const RESULT_KEY = 'ai_quiz_result';

  // Version check — clear stale data
  try {
    if (localStorage.getItem(VERSION_KEY) !== QUIZ_VERSION) {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(RESULT_KEY);
      localStorage.setItem(VERSION_KEY, QUIZ_VERSION);
    }
  } catch(e) {}

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers, index: currentIndex })); } catch(e) {}
  }
  function loadProgress() {
    try {
      const s = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (s && s.answers) { Object.assign(answers, s.answers); return s.index || 0; }
    } catch(e) {}
    return 0;
  }
  function clearProgress() { try { localStorage.removeItem(PROGRESS_KEY); } catch(e) {} }
  function saveResult(level, score) { try { localStorage.setItem(RESULT_KEY, JSON.stringify({level,score})); } catch(e) {} }
  function loadResult() { try { return JSON.parse(localStorage.getItem(RESULT_KEY)); } catch(e) { return null; } }

  // ── Init ───────────────────────────────────────────────────────
  fetch('data.json').then(r => r.json()).then(data => {
    quizData = data;
    questions = data.questions;
    const saved = loadResult();
    if (saved && saved.level) {
      renderResultCard(saved.level);
    } else {
      const idx = loadProgress();
      renderQuestion(idx);
    }
  }).catch(() => {
    container.innerHTML = '<p style="padding:40px;text-align:center;">Не удалось загрузить данные квиза.</p>';
  });

  // ══════════════════════════════════════════════════════════════
  // QUIZ QUESTIONS
  // ══════════════════════════════════════════════════════════════

  function renderQuestion(index) {
    currentIndex = index;
    const q = questions[index];
    progressFill.style.width = ((index + 1) / questions.length * 100) + '%';
    navigation.classList.remove('hidden');
    btnBack.disabled = (index === 0);
    btnNext.textContent = (index === questions.length - 1) ? 'Далее \u2192' : 'Далее \u2192';
    container.innerHTML = '';

    const numEl = el('div', 'question-number', 'Вопрос ' + (index+1) + ' из ' + questions.length + ' \u2014 ' + q.title);
    const titleEl = el('div', 'question-title', q.text);
    container.appendChild(numEl);
    container.appendChild(titleEl);

    if (q.type === 'single') renderSingleOptions(q);
    else if (q.type === 'multi') renderMultiOptions(q);
    else if (q.type === 'text') renderTextInput(q);
    updateNextButton();
  }

  function renderSingleOptions(q) {
    const list = el('div', 'options-list');
    q.options.forEach(opt => {
      const btn = createOptionButton(opt, 'radio');
      if (answers[q.id] === opt.id) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        list.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        answers[q.id] = opt.id;
        saveProgress();
        updateNextButton();
      });
      list.appendChild(btn);
    });
    container.appendChild(list);
  }

  function renderMultiOptions(q) {
    const list = el('div', 'options-list');
    // Find exclusive options (e.g. "Пока ни для чего", "Ничего из перечисленного")
    const exclusiveIds = q.options.filter(o => o.exclusive).map(o => o.id);

    q.options.forEach(opt => {
      const btn = createOptionButton(opt, 'checkbox');
      if (Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        if (exclusiveIds.includes(opt.id)) {
          // Exclusive option → deselect all others
          list.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        } else {
          // Regular option → deselect all exclusive options
          exclusiveIds.forEach(eid => {
            const exBtn = list.querySelector('[data-option-id="' + eid + '"]');
            if (exBtn) exBtn.classList.remove('selected');
          });
          btn.classList.toggle('selected');
        }
        const sel = [];
        list.querySelectorAll('.option-btn.selected').forEach(b => sel.push(b.dataset.optionId));
        answers[q.id] = sel;
        saveProgress();
        updateNextButton();
      });
      list.appendChild(btn);
    });
    container.appendChild(list);
  }

  function renderTextInput(q) {
    const textarea = document.createElement('textarea');
    textarea.className = 'text-input';
    textarea.placeholder = q.placeholder || '';
    if (answers[q.id]) textarea.value = answers[q.id];
    textarea.addEventListener('input', () => {
      answers[q.id] = textarea.value.trim();
      saveProgress();
      updateNextButton();
    });
    container.appendChild(textarea);
  }

  function createOptionButton(opt, type) {
    const btn = el('button', 'option-btn');
    btn.dataset.optionId = opt.id;
    const indicator = el('span', 'option-indicator ' + type);
    indicator.appendChild(el('span', 'option-indicator-check'));
    const textWrap = el('span', 'option-text', opt.text);
    if (opt.description) {
      const desc = el('span', 'option-description', opt.description);
      textWrap.appendChild(desc);
    }
    btn.appendChild(indicator);
    btn.appendChild(textWrap);
    return btn;
  }

  // ── Navigation ─────────────────────────────────────────────────
  btnNext.addEventListener('click', () => {
    if (btnNext.disabled) return;
    if (currentIndex === questions.length - 1) {
      // Last question → go to CTA
      transitionTo(() => renderCtaOffer());
    } else {
      transitionTo(() => { renderQuestion(currentIndex + 1); saveProgress(); });
    }
  });

  btnBack.addEventListener('click', () => {
    if (btnBack.disabled || currentIndex === 0) return;
    transitionTo(() => renderQuestion(currentIndex - 1));
  });

  function updateNextButton() {
    if (currentIndex < 0) { btnNext.disabled = true; return; }
    const q = questions[currentIndex];
    if (q.type === 'single') btnNext.disabled = !answers[q.id];
    else if (q.type === 'multi') btnNext.disabled = !Array.isArray(answers[q.id]) || !answers[q.id].length;
    else if (q.type === 'text') btnNext.disabled = !answers[q.id] || !answers[q.id].length;
  }

  // ══════════════════════════════════════════════════════════════
  // CTA SCREENS (inside WebApp)
  // ══════════════════════════════════════════════════════════════

  function getTrackKey() {
    const scoring = calculateScore();
    if (scoring.level === 5) return 'architect';
    return scoring.level <= 2 ? 'tools' : 'create';
  }

  function renderCtaOffer() {
    navigation.classList.add('hidden');
    progressFill.style.width = '100%';
    container.innerHTML = '';

    const track = getTrackKey();
    const cta = quizData.cta[track];

    const screen = el('div', '');
    screen.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:30px 0;text-align:center;';

    // Big emoji
    const icon = el('div', '', '\uD83C\uDFAF');
    icon.style.cssText = 'font-size:56px;margin-bottom:16px;';
    screen.appendChild(icon);

    // Title
    const title = el('div', '', quizData.cta.intro);
    title.style.cssText = 'font-size:24px;font-weight:800;margin-bottom:8px;';
    screen.appendChild(title);

    // Subtitle
    const sub = el('div', '', quizData.cta.intro_sub);
    sub.style.cssText = 'font-size:16px;color:var(--tg-theme-hint-color,#999);margin-bottom:24px;';
    screen.appendChild(sub);

    // Divider
    const divider = el('div', '');
    divider.style.cssText = 'width:40px;height:3px;background:var(--tg-theme-button-color,#2481cc);border-radius:2px;margin-bottom:24px;';
    screen.appendChild(divider);

    if (track === 'architect') {
      const text = el('div', '', cta.value);
      text.style.cssText = 'font-size:15px;line-height:1.6;text-align:left;margin-bottom:24px;width:100%;';
      screen.appendChild(text);

      const yesBtn = makeBtn('Да, держите в курсе', 'var(--tg-theme-button-color,#2481cc)', () => {
        ctaResponse.cta_reaction = 'architect_yes';
        transitionTo(() => renderCtaContact());
      });
      const noBtn = makeBtn('Нет, спасибо', 'var(--tg-theme-secondary-bg-color,#f4f4f5)', () => {
        ctaResponse.cta_reaction = 'architect_no';
        finishAll();
      });
      noBtn.style.color = 'var(--tg-theme-text-color,#1a1a1a)';
      screen.appendChild(yesBtn);
      screen.appendChild(noBtn);
    } else {
      // Ask text
      const ask = el('div', '', quizData.cta.intro_ask);
      ask.style.cssText = 'font-size:15px;line-height:1.6;white-space:pre-line;text-align:left;margin-bottom:24px;width:100%;';
      screen.appendChild(ask);

      const btn = makeBtn('Ок, хорошо', 'var(--tg-theme-button-color,#2481cc)', () => {
        ctaResponse.cta_reaction = 'details';
        transitionTo(() => renderCtaPrice());
      });
      screen.appendChild(btn);
    }

    container.appendChild(screen);
  }

  function renderCtaPrice() {
    navigation.classList.add('hidden');
    container.innerHTML = '';

    const track = getTrackKey();
    const trackData = quizData.cta[track];
    const screen = el('div', '');
    screen.style.cssText = 'padding:20px 0;';

    // Top label
    const label = el('div', '', 'Интенсив, который мы готовим');
    label.style.cssText = 'font-size:13px;font-weight:600;color:var(--tg-theme-hint-color,#999);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    screen.appendChild(label);

    // Intensive name
    const nameEl = el('div', '', trackData.name);
    nameEl.style.cssText = 'font-size:22px;font-weight:800;margin-bottom:16px;';
    screen.appendChild(nameEl);

    // Value description
    const valueEl = el('div', '', trackData.value);
    valueEl.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:20px;';
    screen.appendChild(valueEl);

    // Format
    const formatEl = el('div', '', trackData.format);
    formatEl.style.cssText = 'font-size:14px;line-height:1.8;white-space:pre-line;padding:14px 18px;background:var(--tg-theme-secondary-bg-color,#f4f4f5);border-radius:12px;margin-bottom:16px;';
    screen.appendChild(formatEl);

    // Price
    const priceEl = el('div', '', trackData.price_text);
    priceEl.style.cssText = 'font-size:20px;font-weight:700;margin-bottom:24px;';
    screen.appendChild(priceEl);

    // Question
    const question = el('div', '', quizData.cta.price_question);
    question.style.cssText = 'font-size:17px;font-weight:700;margin-bottom:16px;';
    screen.appendChild(question);

    const options = el('div', '');
    options.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    quizData.cta.price_options.forEach(opt => {
      const btn = el('button', 'option-btn');
      btn.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;font-size:15px;line-height:1.4;text-align:left;color:var(--tg-theme-text-color,#1a1a1a);background:var(--tg-theme-secondary-bg-color,#f4f4f5);border:2px solid transparent;border-radius:12px;cursor:pointer;';
      btn.textContent = opt.emoji + '  ' + opt.short;
      btn.addEventListener('click', () => {
        ctaResponse.price_reaction = opt.full;
        ctaResponse.price_id = opt.id;
        if (opt.id === 'no') {
          finishAll();
        } else if (opt.id === 'custom') {
          transitionTo(() => renderCtaCustom());
        } else {
          transitionTo(() => renderCtaContact());
        }
      });
      options.appendChild(btn);
    });

    screen.appendChild(options);
    container.appendChild(screen);
  }

  function renderCtaCustom() {
    navigation.classList.add('hidden');
    container.innerHTML = '';

    const screen = el('div', 'cta-screen');
    screen.style.cssText = 'padding:20px 0;';

    const title = el('div', '', 'Напиши свой ответ — нам интересно! 👇');
    title.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:16px;';
    screen.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.className = 'text-input';
    textarea.placeholder = 'Твой комментарий...';
    textarea.style.marginBottom = '16px';
    screen.appendChild(textarea);

    const btn = makeBtn('Отправить', 'var(--tg-theme-button-color,#2481cc)', () => {
      ctaResponse.price_comment = textarea.value.trim();
      transitionTo(() => renderCtaContact());
    });
    btn.id = 'cta-send-btn';
    screen.appendChild(btn);

    container.appendChild(screen);
  }

  function renderCtaContact() {
    navigation.classList.add('hidden');
    container.innerHTML = '';

    const screen = el('div', 'cta-screen');
    screen.style.cssText = 'padding:20px 0;';

    const title = el('div', '', quizData.cta.contact_text);
    title.style.cssText = 'font-size:16px;line-height:1.6;margin-bottom:16px;';
    screen.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.placeholder = 'Email или телефон';
    input.style.cssText += ';min-height:auto;padding:14px 16px;margin-bottom:16px;';
    screen.appendChild(input);

    const btnSend = makeBtn('\uD83D\uDCE7 Отправить контакт', 'var(--tg-theme-button-color,#2481cc)', () => {
      ctaResponse.contact_info = input.value.trim();
      finishAll();
    });
    screen.appendChild(btnSend);

    const btnSkip = makeBtn('Пропустить', 'var(--tg-theme-secondary-bg-color,#f4f4f5)', () => {
      ctaResponse.contact_info = '';
      finishAll();
    });
    btnSkip.style.color = 'var(--tg-theme-text-color,#1a1a1a)';
    btnSkip.style.marginTop = '8px';
    screen.appendChild(btnSkip);

    container.appendChild(screen);
  }

  // ══════════════════════════════════════════════════════════════
  // RESULT CARD
  // ══════════════════════════════════════════════════════════════

  function renderResultCard(level) {
    navigation.classList.add('hidden');
    progressFill.style.width = '100%';
    container.innerHTML = '';

    const color = LEVEL_COLORS[level] || '#2481cc';
    const name = LEVEL_NAMES[level] || '';
    const phrase = LEVEL_PHRASES[level] || '';
    const track = LEVEL_TRACKS[level] || '';

    const card = el('div', '');
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px 0;';

    // Badge
    const badge = el('div', '', level);
    badge.style.cssText = 'width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;margin-bottom:16px;background:' + color;
    card.appendChild(badge);

    // Title
    card.appendChild(el('div', '', name, 'font-size:28px;font-weight:800;margin-bottom:4px;text-align:center;'));

    // Track
    if (track) card.appendChild(el('div', '', 'Трек: ' + track, 'font-size:14px;color:var(--tg-theme-hint-color,#999);margin-bottom:20px;text-align:center;'));

    // Phrase
    const phraseEl = el('div', '', phrase);
    phraseEl.style.cssText = 'font-size:15px;line-height:1.6;padding:16px 20px;background:var(--tg-theme-secondary-bg-color,#f4f4f5);border-radius:12px;border-left:4px solid ' + color + ';margin-bottom:24px;width:100%;';
    card.appendChild(phraseEl);

    // Guide buttons
    const wrap = el('div', '', '', 'display:flex;flex-direction:column;gap:10px;width:100%;margin-bottom:24px;');
    wrap.appendChild(makeCardBtn('\uD83D\uDCCB Мини-гайд: твои шаги к следующему уровню', color, () => { window.location.href = 'guide-' + level + '.html'; }));
    wrap.appendChild(makeCardBtn('\uD83E\uDDF0 Подборка инструментов', color, () => { window.location.href = 'guide-' + level + '.html'; }));
    card.appendChild(wrap);

    // Hint
    card.appendChild(el('div', '', 'Можешь закрыть — всё сохранено. Открой бота в любой момент, чтобы вернуться сюда.', 'font-size:13px;color:var(--tg-theme-hint-color,#999);text-align:center;line-height:1.5;padding:0 10px;'));

    container.appendChild(card);
  }

  function makeCardBtn(text, color, onClick) {
    const btn = el('button', '', text);
    btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;font-size:15px;font-weight:600;color:' + color + ';background:var(--tg-theme-secondary-bg-color,#f4f4f5);border:2px solid ' + color + '22;border-radius:12px;cursor:pointer;text-align:left;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ══════════════════════════════════════════════════════════════
  // SCORING
  // ══════════════════════════════════════════════════════════════

  function calculateScore() {
    const scored = ['q1','q2','q3','q4','q5','q7','q8'];
    let total = 0;
    scored.forEach(qId => {
      const q = questions.find(qq => qq.id === qId);
      const a = answers[qId];
      if (!q || a == null) return;
      if (q.type === 'single') { const o = q.options.find(o => o.id === a); if (o) total += o.score; }
      else if (q.scoring === 'special') total += scoreQ3(a);
      else if (q.scoring === 'max') total += scoreQ4(a, q);
    });
    const avg = total / scored.length;
    return { average: Math.round(avg * 100) / 100, level: Math.max(1, Math.min(5, Math.round(avg))) };
  }

  function scoreQ3(sel) {
    if (!Array.isArray(sel) || !sel.length) return 1;
    let s = 0;
    if (sel.includes('g')) s = 4;
    const mid = sel.filter(x => 'cdef'.includes(x)).length;
    if (mid) s = Math.max(s, mid >= 3 ? 3 : 2);
    return s || 1;
  }

  function scoreQ4(sel, q) {
    if (!Array.isArray(sel) || !sel.length) return 1;
    let m = 0;
    sel.forEach(id => { const o = q.options.find(o => o.id === id); if (o && o.score > m) m = o.score; });
    return m || 1;
  }

  // ══════════════════════════════════════════════════════════════
  // FINISH — send all data to bot
  // ══════════════════════════════════════════════════════════════

  function finishAll() {
    const scoring = calculateScore();
    const q9 = answers['q9'] || '';

    const payload = {
      answers: answers,
      score: scoring.average,
      level: scoring.level,
      q9_segment: (q9 === 'a' || q9 === 'b') ? 'tools' : 'create',
      q9_approach: q9 === 'c' ? 'product' : (q9 === 'd' ? 'system' : ''),
      cta_response: ctaResponse.cta_reaction || 'details',
      price_reaction: ctaResponse.price_reaction || '',
      price_comment: ctaResponse.price_comment || '',
      contact_info: ctaResponse.contact_info || ''
    };

    clearProgress();
    saveResult(scoring.level, scoring.average);

    if (tg) {
      tg.sendData(JSON.stringify(payload));
    } else {
      console.log('All data:', JSON.stringify(payload, null, 2));
      transitionTo(() => renderResultCard(scoring.level));
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  function el(tag, cls, text, style) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    if (style) e.style.cssText = style;
    return e;
  }

  function makeBtn(text, bg, onClick) {
    const btn = el('button', '', text);
    btn.style.cssText = 'display:block;width:100%;padding:14px 20px;font-size:16px;font-weight:600;color:#fff;background:' + bg + ';border:none;border-radius:12px;cursor:pointer;margin-top:8px;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function transitionTo(fn) {
    container.classList.add('fade-out');
    setTimeout(() => { fn(); container.classList.remove('fade-out'); }, 200);
  }

})();
