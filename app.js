/**
 * AI Level Quiz — Telegram Web App
 *
 * Loads quiz data from data.json, renders questions with smooth transitions,
 * calculates the AI interaction level, and sends results back to the bot.
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
  let quizData = null;       // parsed data.json
  let questions = [];        // quizData.questions
  let currentIndex = -1;     // -1 = consent screen, 0..N = questions
  const answers = {};        // { q1: "b", q3: ["a","c"], q6: "free text", ... }

  // ── Progress persistence ───────────────────────────────────────
  const STORAGE_KEY = 'ai_quiz_progress';

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        answers: answers,
        index: currentIndex
      }));
    } catch (e) { /* silent */ }
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.answers) {
        Object.assign(answers, saved.answers);
        return saved.index || 0;
      }
    } catch (e) { /* silent */ }
    return 0;
  }

  function clearProgress() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* silent */ }
  }

  // ── Init ─────────────────────────────────────────────────────────
  fetch('data.json')
    .then(r => r.json())
    .then(data => {
      quizData = data;
      questions = data.questions;
      const startIndex = loadProgress();
      renderQuestion(startIndex);
    })
    .catch(err => {
      container.innerHTML = '<p style="padding:40px;text-align:center;">Не удалось загрузить данные квиза.</p>';
      console.error('Failed to load data.json:', err);
    });

  // ── Consent screen ───────────────────────────────────────────────
  function renderConsent() {
    currentIndex = -1;
    progressFill.style.width = '0%';
    navigation.classList.add('hidden');

    container.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'consent-screen';

    const icon = document.createElement('div');
    icon.className = 'consent-icon';
    icon.textContent = '\u{1F916}';

    const text = document.createElement('div');
    text.className = 'consent-text';
    text.textContent = quizData.consent.text;

    const btn = document.createElement('button');
    btn.className = 'consent-button';
    btn.textContent = quizData.consent.button;
    btn.addEventListener('click', () => {
      transitionTo(() => renderQuestion(0));
    });

    screen.appendChild(icon);
    screen.appendChild(text);
    screen.appendChild(btn);
    container.appendChild(screen);
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
      // Restore previous answer
      if (answers[q.id] === opt.id) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        // Deselect all
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
      // Restore previous answer
      if (Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        // Collect selected
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
    // Restore previous answer
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

    // Add description if present (Q9)
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
      clearProgress();
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
      // Already at first question, can't go back further
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
    // Questions that contribute to the score (7 scored questions)
    // Q1 (single), Q2 (single), Q3 (multi-special), Q4 (multi-max),
    // Q5 (single), Q7 (single), Q8 (single)
    // Q6 = text (no score), Q9 = segment (no score)

    const scoredQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q7', 'q8'];
    let totalScore = 0;

    scoredQuestions.forEach(qId => {
      const q = questions.find(qq => qq.id === qId);
      const answer = answers[qId];

      if (!q || answer === undefined || answer === null) {
        return;
      }

      if (q.type === 'single') {
        // Direct score from selected option
        const opt = q.options.find(o => o.id === answer);
        if (opt) totalScore += opt.score;

      } else if (q.type === 'multi' && q.scoring === 'special') {
        // Q3: special multi-select scoring
        // Logic: score based on the mix of selected options
        // (a)=1, (b)=1 are basic; (c)(d)(e)(f) are mid-level; (g) is advanced
        totalScore += scoreQ3(answer, q);

      } else if (q.type === 'multi' && q.scoring === 'max') {
        // Q4: max of selected scores
        totalScore += scoreQ4(answer, q);
      }
    });

    // Average of 7 scored questions
    const avg = totalScore / scoredQuestions.length;
    const level = Math.round(avg);

    return {
      rawScore: totalScore,
      average: Math.round(avg * 100) / 100,
      level: Math.max(1, Math.min(5, level))
    };
  }

  /**
   * Q3 scoring: multi-select with special logic.
   * - If only (a) and/or (b) selected: score = 1
   * - If any of (c)(d)(e)(f) selected: base 2, +1 if 3+ of these selected (up to 3)
   * - If (g) selected: score = 4
   * - Result = max of applicable scores
   */
  function scoreQ3(selected, q) {
    if (!Array.isArray(selected) || selected.length === 0) return 1;

    let score = 0;

    // Check for code/automation (highest)
    if (selected.includes('g')) {
      score = Math.max(score, 4);
    }

    // Check mid-level options (c, d, e, f)
    const midOptions = ['c', 'd', 'e', 'f'];
    const midCount = selected.filter(s => midOptions.includes(s)).length;
    if (midCount > 0) {
      // 1 mid-option = 2, 2 = 2, 3+ = 3
      const midScore = midCount >= 3 ? 3 : 2;
      score = Math.max(score, midScore);
    }

    // Only basic options
    if (score === 0) {
      score = 1;
    }

    return score;
  }

  /**
   * Q4 scoring: max of selected option scores.
   */
  function scoreQ4(selected, q) {
    if (!Array.isArray(selected) || selected.length === 0) return 1;

    let maxScore = 0;
    selected.forEach(optId => {
      const opt = q.options.find(o => o.id === optId);
      if (opt && opt.score > maxScore) {
        maxScore = opt.score;
      }
    });

    return maxScore || 1;
  }

  // ── Finish quiz and send data ────────────────────────────────────
  function finishQuiz() {
    const scoring = calculateScore();

    // Q9 segmentation: a/b → tools track, c/d → create track
    // c = product approach, d = system approach
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

    // Send data to Telegram bot
    if (tg) {
      tg.sendData(JSON.stringify(payload));
      // sendData automatically closes the Web App
    } else {
      // Fallback for testing outside Telegram
      console.log('Quiz results:', JSON.stringify(payload, null, 2));
      showTestResults(payload);
    }
  }

  // ── Test mode: show results in the page ──────────────────────────
  function showTestResults(payload) {
    const levelNames = {
      1: 'Наблюдатель',
      2: 'Собеседник',
      3: 'Дирижёр',
      4: 'Изобретатель',
      5: 'Архитектор'
    };

    navigation.classList.add('hidden');
    progressFill.style.width = '100%';
    container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'consent-screen';

    const title = document.createElement('div');
    title.className = 'question-title';
    title.style.textAlign = 'center';
    title.textContent = 'Твой уровень: ' + levelNames[payload.level];

    const details = document.createElement('div');
    details.className = 'consent-text';
    details.textContent = 'Средний балл: ' + payload.score + '\n'
      + 'Уровень: ' + payload.level + ' (' + levelNames[payload.level] + ')\n'
      + 'Направление: ' + payload.q9_segment + '\n\n'
      + 'В Telegram результат был бы отправлен боту автоматически.';

    screen.appendChild(title);
    screen.appendChild(details);
    container.appendChild(screen);
  }

})();
