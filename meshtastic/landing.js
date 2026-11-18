(() => {
  'use strict';
  // Keep bookmarks made before the course directory gained a landing page.
  if (/^#lesson-[1-7]$/.test(location.hash)) {
    location.replace(`basics.html${location.hash}`);
    return;
  }

  function updateProgress() {
    document.querySelectorAll('.course-card[data-storage-key]').forEach(card => {
      const total = Number(card.dataset.total);
      let completed = [];
      try {
        const saved = JSON.parse(localStorage.getItem(card.dataset.storageKey) || '{}');
        if (Array.isArray(saved.completed)) {
          completed = saved.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= total);
        }
      } catch { /* The course links still work when storage is unavailable. */ }
      const done = new Set(completed);
      card.querySelector('[data-progress-label]').textContent = `${done.size} of ${total} lessons complete`;
      card.querySelector('[data-progress-fill]').style.width = `${done.size / total * 100}%`;

      card.querySelectorAll('.course-lessons li[data-lesson]').forEach(item => {
        const finished = done.has(Number(item.dataset.lesson));
        item.classList.toggle('is-done', finished);
        item.querySelector('b').textContent = finished ? '✓' : '↗';
      });

      const next = [...card.querySelectorAll('.course-lessons li[data-lesson]')]
        .find(item => !done.has(Number(item.dataset.lesson)));
      const cta = card.querySelector('[data-course-cta]');
      if (next) {
        cta.href = next.querySelector('a').getAttribute('href');
        cta.firstChild.textContent = `${done.size ? 'Continue' : 'Start'} ${cta.dataset.courseName} `;
      } else {
        cta.href = card.querySelector('.course-lessons a').getAttribute('href');
        cta.firstChild.textContent = `Review ${cta.dataset.courseName} `;
      }
    });
  }

  updateProgress();
  window.addEventListener('pageshow', updateProgress);
  window.addEventListener('storage', updateProgress);
})();
