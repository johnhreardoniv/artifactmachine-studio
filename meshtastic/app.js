(() => {
  'use strict';
  const storageKey = 'meshtastic-p1pro-course-v1';
  const empty = { completed: [], notes: {} };
  let state;
  try {
    state = { ...empty, ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
  } catch {
    state = { ...empty };
  }
  if (!Array.isArray(state.completed)) state.completed = [];
  if (!state.notes || typeof state.notes !== 'object') state.notes = {};
  const lessons = [...document.querySelectorAll('.lesson')];
  const navLinks = [...document.querySelectorAll('[data-nav]')];

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Offline course still works without storage. */ }
  }

  function updateProgress() {
    const count = state.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= 7).length;
    document.getElementById('progress-count').textContent = `${count} / 7`;
    document.getElementById('progress-bar').setAttribute('aria-valuenow', String(count));
    document.getElementById('progress-fill').style.width = `${count / 7 * 100}%`;
    navLinks.forEach(link => {
      const done = state.completed.includes(Number(link.dataset.nav));
      link.classList.toggle('is-complete', done);
      link.querySelector('b').textContent = done ? '✓' : '○';
    });
  }

  function showLesson() {
    const match = location.hash.match(/^#lesson-([1-7])$/);
    const active = match ? Number(match[1]) : 1;
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
        feedback.textContent = 'Answer all three questions first.';
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
      feedback.textContent = score === 3 ? '3 / 3 — excellent. Lesson complete.' : `${score} / 3 — review the highlighted answers, then try again.`;
      if (score === 3) {
        const number = Number(quiz.dataset.quiz);
        if (!state.completed.includes(number)) state.completed.push(number);
        save();
        updateProgress();
      }
    });
  });

  document.querySelectorAll('[data-note]').forEach(input => {
    const key = input.dataset.note;
    input.value = typeof state.notes[key] === 'string' ? state.notes[key] : '';
    input.addEventListener('input', () => { state.notes[key] = input.value; save(); });
  });

  document.querySelectorAll('[data-video]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.video;
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}`;
      iframe.title = button.closest('.media-card').querySelector('h4').textContent;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      button.closest('.media-card').querySelector('.video-slot').replaceChildren(iframe);
      button.remove();
    });
  });

  window.addEventListener('hashchange', showLesson);
  updateProgress();
  showLesson();
})();
