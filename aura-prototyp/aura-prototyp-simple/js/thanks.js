/* AURA · strona po płatności (dziekujemy.html): link do odtwarzacza i kopiowanie */
(function () {
  'use strict';

  const token = window.AuraLinks.DEMO_TOKEN; // [ATRAPA] w produkcji z sesji Stripe Checkout
  const url = window.AuraLinks.publicUrl(token); // pokazywany i kopiowany
  const input = document.getElementById('thanks-url');
  input.value = url;
  document.getElementById('thanks-open').href = window.AuraLinks.url(token); // prototyp: lokalny odtwarzacz

  const toastEl = document.getElementById('toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  input.addEventListener('focus', () => input.select());
  document.getElementById('thanks-copy').addEventListener('click', () => {
    const fallback = () => {
      input.focus();
      input.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* nieobsługiwane */ }
      toast(ok ? 'Skopiowano link' : 'Link zaznaczony: skopiuj go skrótem Ctrl+C lub Cmd+C');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => toast('Skopiowano link'), fallback);
    } else {
      fallback();
    }
  });
})();
