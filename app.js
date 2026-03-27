/**
 * AI Level Quiz — Telegram Web App
 *
 * Three states:
 * 1. Quiz in progress → questions with saved progress
 * 2. Quiz complete → result card with level + guide links
 * 3. Reopened after completion → result card (no re-take)
 */

(function () {
  'use strict';

  // ── Telegram WebApp integration ──────────────────────────────────
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  // ── DOM elements ─────────────────────────────────────────────────
  const container = document.getElementById('question-container');
  const progressFill = document.getElementById('progress-fill');
  const navigation = document.getElementById('navigation');
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');

  // ── State ────────────────────────────────────────────────────────
  let quizData = null;
  let questions = [];
  let currentIndex = -1;
  const answers = {};

  // ── Level data ─────────────────────────────────────────────────
  const LEVEL_NAMES = {
    1: 'Наблюдатель',
    2: 'Собеседник',
    3: 'Дирижёр',
    4: 'Изобретатель',
    5: 'Архитектор'
  };

  const LEVEL_COLORS = {
    1: '#4CAF50',
    2: '#2196F3',
    3: '#9C27B0',
    4: '#FF9800',
    5: '#F44336'
  };

  const LEVEL_PHRASES = {
    1: 'Ты пока наблюдаешь со стороны — и это нормально. Но пока ты наблюдаешь, AI уже пишет письма, анализирует документы и планирует отпуск за твоих коллег.',
    2: 'Вы с AI на «вы» — вежливо общаетесь, но пока не доверяете ему серьёзные дела. А зря — он умеет гораздо больше, чем переписывать письма.',
    3: 'Ты уже дирижируешь — AI делает то, что ты говоришь. Но представь: он мог бы делать это сам, без дирижёрской палочки. Знать твои задачи, контекст и правила — и действовать.',
    4: 'Ты уже изобретаешь — строишь, пробуешь, экспериментируешь. Но пока каждое изобретение живёт отдельно. Что если собрать из них систему, которая работает как единый организм?',
    5: 'Ты уже архитектор — у тебя есть своя система, и ты знаешь, как она устроена. Мы тебя не будем учить — но, кажется, нам есть о чём поговорить.'
  };

  const LEVEL_TRACKS = {
    1: '«Набор AI-инструментов»',
    2: '«Набор AI-инструментов»',
    3: '«Создавай с AI»',
    4: '«Создавай с AI»',
    5: ''
  };

  // ── Persistence ────────────────────────────────────────────────
  const PROGRESS_KEY = 'ai_quiz_progress';
  const RESULT_KEY = 'ai_quiz_result';

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        answers: answers,
        index: currentIndex
      }));
    } catch (e) { /* silent */ }
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (saved && saved.answers) {
        Object.assign(answers, saved.answers);
        return saved.index || 0;
      }
    } catch (e) { /* silent */ }
    return 0;
  }

  function clearProgress() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* silent */ }
  }

  function saveResult(level, score) {
    try {
      localStorage.setItem(RESULT_KEY, JSON.stringify({ level: level, score: score }));
    } catch (e) { /* silent */ }
  }

  function loadResult() {
    try {
      return JSON.parse(localStorage.getItem(RESULT_KEY));
    } catch (e) { return null; }
  }

  // ── Init ─────────────────────────────────────────────────────────
  fetch('data.json')
    .then(r => r.json())
    .then(data => {
      quizData = data;
      questions = data.questions;

      // Check if quiz already completed
      const savedResult = loadResult();
      if (savedResult && savedResult.level) {
        renderResultCard(savedResult.level);
      } else {
        const startIndex = loadProgress();
        renderQuestion(startIndex);
      }
    })
    .catch(err => {
      container.innerHTML = '<p style="padding:40px;text-align:center;">Не удалось загрузить данные квиза.</p>';
      console.error('Failed to load data.json:', err);
    });

  // ── Result card ────────────────────────────────────────────────
  function renderResultCard(level) {
    navigation.classList.add('hidden');
    progressFill.style.width = '100%';
    container.innerHTML = '';

    const color = LEVEL_COLORS[level] || '#2481cc';
    const name = LEVEL_NAMES[level] || 'Неизвестный';
    const phrase = LEVEL_PHRASES[level] || '';
    const track = LEVEL_TRACKS[level] || '';

    // Card wrapper
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px 0;';

    // Level badge
    const badge = document.createElement('div');
    badge.style.cssText = 'width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;margin-bottom:16px;background:' + color + ';';
    badge.textContent = level;
    card.appendChild(badge);

    // Level name
    const title = document.createElement('div');
    title.style.cssText = 'font-size:28px;font-weight:800;margin-bottom:4px;text-align:center;';
    title.textContent = name;
    card.appendChild(title);

    // Track
    if (track) {
      const trackEl = document.createElement('div');
      trackEl.style.cssText = 'font-size:14px;color:var(--tg-theme-hint-color,#999);margin-bottom:20px;text-align:center;';
      trackEl.textContent = 'Трек: ' + track;
      card.appendChild(trackEl);
    }

    // Phrase
    const phraseEl = document.createElement('div');
    phraseEl.style.cssText = 'font-size:15px;line-height:1.6;padding:16px 20px;background:var(--tg-theme-secondary-bg-color,#f4f4f5);border-radius:12px;border-left:4px solid ' + color + ';margin-bottom:24px;width:100%;';
    phraseEl.textContent = phrase;
    card.appendChild(phraseEl);

    // Guide buttons
    const buttonsWrap = document.createElement('div');
    buttonsWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;margin-bottom:24px;';

    const guideBtn = createCardButton('\uD83E\uDDF0 Подборка инструментов', color, function () {
      window.location.href = 'guide-' + level + '.html';
    });
    buttonsWrap.appendChild(guideBtn);

    const stepsBtn = createCardButton('\uD83D\uDCCB Мини-гайд: шаги к следующему уровню', color, function () {
      window.location.href = 'guide-' + level + '.html';
    });
    buttonsWrap.appendChild(stepsBtn);

    card.appendChild(buttonsWrap);

    // Safe to close message
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:13px;color:var(--tg-theme-hint-color,#999);text-align:center;line-height:1.5;padding:0 10px;';
    hint.textContent = 'Можешь закрыть — всё сохранено. Открой бота в любой момент, чтобы вернуться сюда.';
    card.appendChild(hint);

    container.appendChild(card);
  }

  function createCardButton(text, color, onClick) {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;font-size:15px;font-weight:600;color:' + color + ';background:var(--tg-theme-secondary-bg-color,#f4f4f5);border:2px solid ' + color + '22;border-radius:12px;cursor:pointer;text-align:left;transition:transform 0.15s ease;-webkit-tap-highlight-color:transparent;';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mousedown', function () { btn.style.transform = 'scale(0.97)'; });
    btn.addEventListener('mouseup', function () { btn.style.transform = ''; });
    return btn;
  }

  // ── Render a question by index ───────────────────────────────────
  function renderQuestion(index) {
    currentIndex = index;
    const q = questions[index];

    // Progress bar
    const progress = ((index + 1) / questions.length) * 100;
    progressFill.style.width = progress + '%';

    // Navigation visibility
    navigation.classList.remove('hidden');
    btnBack.disabled = (index === 0);

    // Next button label
    const isLast = (index === questions.length - 1);
    btnNext.textContent = isLast ? 'Завершить' : 'Далее \u2192';

    // Build question card
    container.innerHTML = '';

    const numEl = document.createElement('div');
    numEl.className = 'question-number';
    numEl.textContent = 'Вопрос ' + (index + 1) + ' из ' + questions.length + ' \u2014 ' + q.title;

    const titleEl = document.createElement('div');
    titleEl.className = 'question-title';
    titleEl.textContent = q.text;

    container.appendChild(numEl);
    container.appendChild(titleEl);

    // Render based on type
    if (q.type === 'single') {
      renderSingleOptions(q);
    } else if (q.type === 'multi') {
      renderMultiOptions(q);
    } else if (q.type === 'text') {
      renderTextInput(q);
    }

    updateNextButton();
  }

  // ── Single-select options ────────────────────────────────────────
  function renderSingleOptions(q) {
    const list = document.createElement('div');
    list.className = 'options-list';

    q.options.forEach(opt => {
      const btn = createOptionButton(opt, 'radio', q);
      if (answers[q.id] === opt.id) {
        btn.classList.add('selected');
      }
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

  // ── Multi-select options ─────────────────────────────────────────
  function renderMultiOptions(q) {
    const list = document.createElement('div');
    list.className = 'options-list';

    q.options.forEach(opt => {
      const btn = createOptionButton(opt, 'checkbox', q);
      if (Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        const selected = [];
        list.querySelectorAll('.option-btn.selected').forEach(b => {
          selected.push(b.dataset.optionId);
        });
        answers[q.id] = selected;
        saveProgress();
        updateNextButton();
      });
      list.appendChild(btn);
    });

    container.appendChild(list);
  }

  // ── Text input ───────────────────────────────────────────────────
  function renderTextInput(q) {
    const textarea = document.createElement('textarea');
    textarea.className = 'text-input';
    textarea.placeholder = q.placeholder || '';
    if (answers[q.id]) {
      textarea.value = answers[q.id];
    }
    textarea.addEventListener('input', () => {
      answers[q.id] = textarea.value.trim();
      saveProgress();
      updateNextButton();
    });
    container.appendChild(textarea);
  }

  // ── Create an option button element ──────────────────────────────
  function createOptionButton(opt, indicatorType, q) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.optionId = opt.id;

    const indicator = document.createElement('span');
    indicator.className = 'option-indicator ' + indicatorType;
    const check = document.createElement('span');
    check.className = 'option-indicator-check';
    indicator.appendChild(check);

    const textWrap = document.createElement('span');
    textWrap.className = 'option-text';
    textWrap.textContent = opt.text;

    if (opt.description) {
      const desc = document.createElement('span');
      desc.className = 'option-description';
      desc.textContent = opt.description;
      textWrap.appendChild(desc);
    }

    btn.appendChild(indicator);
    btn.appendChild(textWrap);
    return btn;
  }

  // ── Navigation logic ─────────────────────────────────────────────
  btnNext.addEventListener('click', () => {
    if (btnNext.disabled) return;

    const isLast = (currentIndex === questions.length - 1);
    if (isLast) {
      finishQuiz();
    } else {
      transitionTo(() => {
        renderQuestion(currentIndex + 1);
        saveProgress();
      });
    }
  });

  btnBack.addEventListener('click', () => {
    if (btnBack.disabled) return;

    if (currentIndex === 0) {
      return;
    } else {
      transitionTo(() => renderQuestion(currentIndex - 1));
    }
  });

  // ── Enable/disable "Далее" based on current answer ──────────────
  function updateNextButton() {
    if (currentIndex < 0) {
      btnNext.disabled = true;
      return;
    }
    const q = questions[currentIndex];
    if (q.type === 'single') {
      btnNext.disabled = !answers[q.id];
    } else if (q.type === 'multi') {
      btnNext.disabled = !Array.isArray(answers[q.id]) || answers[q.id].length === 0;
    } else if (q.type === 'text') {
      btnNext.disabled = !answers[q.id] || answers[q.id].length === 0;
    }
  }

  // ── Smooth transition between screens ────────────────────────────
  function transitionTo(renderFn) {
    container.classList.add('fade-out');
    setTimeout(() => {
      renderFn();
      container.classList.remove('fade-out');
    }, 200);
  }

  // ── Scoring ──────────────────────────────────────────────────────
  function calculateScore() {
    const scoredQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q7', 'q8'];
    let totalScore = 0;

    scoredQuestions.forEach(qId => {
      const q = questions.find(qq => qq.id === qId);
      const answer = answers[qId];

      if (!q || answer === undefined || answer === null) return;

      if (q.type === 'single') {
        const opt = q.options.find(o => o.id === answer);
        if (opt) totalScore += opt.score;
      } else if (q.type === 'multi' && q.scoring === 'special') {
        totalScore += scoreQ3(answer, q);
      } else if (q.type === 'multi' && q.scoring === 'max') {
        totalScore += scoreQ4(answer, q);
      }
    });

    const avg = totalScore / scoredQuestions.length;
    const level = Math.round(avg);

    return {
      rawScore: totalScore,
      average: Math.round(avg * 100) / 100,
      level: Math.max(1, Math.min(5, level))
    };
  }

  function scoreQ3(selected, q) {
    if (!Array.isArray(selected) || selected.length === 0) return 1;
    let score = 0;
    if (selected.includes('g')) score = Math.max(score, 4);
    const midCount = selected.filter(s => ['c', 'd', 'e', 'f'].includes(s)).length;
    if (midCount > 0) score = Math.max(score, midCount >= 3 ? 3 : 2);
    return score || 1;
  }

  function scoreQ4(selected, q) {
    if (!Array.isArray(selected) || selected.length === 0) return 1;
    let maxScore = 0;
    selected.forEach(optId => {
      const opt = q.options.find(o => o.id === optId);
      if (opt && opt.score > maxScore) maxScore = opt.score;
    });
    return maxScore || 1;
  }

  // ── Finish quiz and send data ────────────────────────────────────
  function finishQuiz() {
    const scoring = calculateScore();

    const q9 = answers['q9'] || '';
    const q9_segment = (q9 === 'a' || q9 === 'b') ? 'tools' : 'create';
    const q9_approach = q9 === 'c' ? 'product' : (q9 === 'd' ? 'system' : '');

    const payload = {
      answers: answers,
      score: scoring.average,
      level: scoring.level,
      q9_segment: q9_segment,
      q9_approach: q9_approach
    };

    // Save result for future reopens
    clearProgress();
    saveResult(scoring.level, scoring.average);

    // Send data to Telegram bot
    if (tg) {
      tg.sendData(JSON.stringify(payload));
    } else {
      console.log('Quiz results:', JSON.stringify(payload, null, 2));
      transitionTo(() => renderResultCard(scoring.level));
    }
  }

})();
