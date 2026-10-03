/* AURA · panel właściciela (admin.html), atrapa
 * Logowanie jednym hasłem („test”), tabela linków, nowy link, włącz/wyłącz.
 * Dane w localStorage przez js/links.js; nic nie jest wysyłane.
 */
(function () {
  'use strict';

  const L = window.AuraLinks;
  const $ = (s, el) => (el || document).querySelector(s);
  const PASSWORD = 'test'; // [ATRAPA] w produkcji hasło po stronie serwera (np. HTTP Basic / Cloudflare Access)

  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  function copy(text) {
    const done = () => toast('Skopiowano link');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => toast(text));
    } else {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
      t.remove();
    }
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return d + '.' + m + '.' + y; };

  /* ---------- logowanie ---------- */
  const isIn = () => { try { return sessionStorage.getItem('aura.admin') === '1'; } catch (e) { return false; } };
  function showPanel() {
    $('#admin-login').hidden = true;
    $('#admin').hidden = false;
    render();
  }
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.password;
    if (input.value === PASSWORD) {
      try { sessionStorage.setItem('aura.admin', '1'); } catch (err) { /* brak dostępu */ }
      showPanel();
    } else {
      $('#login-error').hidden = false;
      input.closest('.field').classList.add('is-invalid');
      input.select();
    }
  });
  $('#login-form').password.addEventListener('input', (e) => {
    $('#login-error').hidden = true;
    e.target.closest('.field').classList.remove('is-invalid');
  });

  /* ---------- tabela ---------- */
  function render() {
    const list = L.all();
    $('#list-count').textContent = list.filter((l) => l.active).length + ' aktywne / ' + list.length;
    $('#rows').innerHTML = list.map((l) => `
      <div class="admin-row${l.active ? '' : ' is-off'}" role="row" data-token="${esc(l.token)}">
        <span role="cell" class="admin-row__venue" data-label="Lokal">${esc(l.venue)}</span>
        <span role="cell" class="admin-row__email" data-label="E-mail">${esc(l.email)}</span>
        <span role="cell" class="admin-row__link" data-label="Link">
          <code>?t=${esc(l.token)}</code>
          <button class="admin-mini" type="button" data-act="copy">Kopiuj</button>
          <a class="admin-mini" href="${esc(L.url(l.token))}" target="_blank" rel="noopener">Otwórz</a>
        </span>
        <span role="cell" class="admin-row__status" data-label="Status"><i class="admin-dot"></i>${l.active ? 'Aktywny' : 'Nieaktywny'}</span>
        <span role="cell" class="admin-row__date" data-label="Utworzono">${fmtDate(l.created)}</span>
        <span role="cell" class="admin-row__act">
          <button class="btn btn--sm" type="button" data-act="toggle">${l.active ? 'Wyłącz' : 'Włącz'}</button>
        </span>
      </div>`).join('');
  }

  $('#rows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const token = btn.closest('[data-token]').dataset.token;
    if (btn.dataset.act === 'copy') { copy(L.publicUrl(token)); return; }
    const link = L.find(token);
    L.setActive(token, !link.active);
    render();
    toast((link.active ? 'Wyłączono' : 'Włączono') + ' link: ' + link.venue);
  });

  /* ---------- nowy link ---------- */
  const form = $('#new-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    [form.venue, form.email].forEach((i) => {
      const bad = !i.value.trim();
      i.closest('.field').classList.toggle('is-invalid', bad);
      if (bad && ok) { i.focus(); ok = false; }
    });
    if (!ok) return;
    const link = L.create(form.venue.value.trim(), form.email.value.trim());
    form.reset();
    render();
    $('#created').hidden = false;
    $('#created-venue').textContent = link.venue;
    $('#created-url').value = L.publicUrl(link.token);
    $('#created-url').focus();
    $('#created-url').select();
  });
  $('#created-copy').addEventListener('click', () => copy($('#created-url').value));

  if (isIn()) showPanel(); else $('#login-form').password.focus();
})();
