(() => {
  'use strict';
  const root = document.documentElement;
  const course = root.dataset.course;
  const lessons = [...document.querySelectorAll('.lesson')];
  if (!course || !lessons.length) return;
  const total = lessons.length;
  const storageKey = `meshtastic-${course}-v1`;
  let completed = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (Array.isArray(saved.completed)) completed = saved.completed.filter(Number.isInteger);
  } catch { /* Quizzes still work when storage is unavailable. */ }
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const progress = document.getElementById('progress-bar');
  const count = document.getElementById('progress-count');
  const fill = document.getElementById('progress-fill');

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ completed })); } catch { /* Optional persistence. */ }
  }
  function updateProgress() {
    const done = completed.filter(n => n >= 1 && n <= total).length;
    count.textContent = `${done} / ${total}`;
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(done));
    fill.style.width = `${done / total * 100}%`;
    navLinks.forEach(link => {
      const finished = completed.includes(Number(link.dataset.nav));
      link.classList.toggle('is-complete', finished);
      link.querySelector('b').textContent = finished ? '✓' : '○';
    });
  }
  function showLesson() {
    const match = location.hash.match(/^#lesson-(\d+)$/);
    const selected = match ? Number(match[1]) : 1;
    const active = selected >= 1 && selected <= total ? selected : 1;
    lessons.forEach(section => { section.hidden = Number(section.dataset.lesson) !== active; });
    navLinks.forEach(link => {
      if (Number(link.dataset.nav) === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (match) requestAnimationFrame(() => document.getElementById(`lesson-${active}`).scrollIntoView());
  }
  document.querySelectorAll('.quiz').forEach(quiz => {
    quiz.querySelector('.quiz-submit').addEventListener('click', () => {
      const fields = [...quiz.querySelectorAll('fieldset')];
      const selected = fields.map(field => field.querySelector('input:checked'));
      const feedback = quiz.querySelector('.quiz-feedback');
      if (selected.some(input => !input)) {
        feedback.textContent = 'Answer every question first.';
        fields[selected.findIndex(input => !input)].querySelector('input').focus();
        return;
      }
      let score = 0;
      fields.forEach((field, index) => {
        const answer = field.dataset.answer;
        field.querySelectorAll('label').forEach(label => {
          label.classList.remove('correct', 'incorrect');
          const input = label.querySelector('input');
          if (input.value === answer) label.classList.add('correct');
          else if (input === selected[index]) label.classList.add('incorrect');
        });
        if (selected[index].value === answer) score++;
      });
      const corrections = fields.flatMap((field, index) => {
        if (selected[index].value === field.dataset.answer) return [];
        const correct = [...field.querySelectorAll('input')]
          .find(input => input.value === field.dataset.answer);
        const answerText = correct.closest('label').textContent.trim();
        return [`Question ${index + 1}: ${answerText}`];
      });
      feedback.textContent = score === fields.length
        ? `${score} / ${fields.length} \u2014 lesson complete.`
        : `${score} / ${fields.length} \u2014 ${corrections.join('; ')}. Try again.`;
      if (score === fields.length) {
        const number = Number(quiz.dataset.quiz);
        if (!completed.includes(number)) completed.push(number);
        save();
        updateProgress();
      }
    });
  });
  window.addEventListener('hashchange', showLesson);
  updateProgress();
  showLesson();
})();
