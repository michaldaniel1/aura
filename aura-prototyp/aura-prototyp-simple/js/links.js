/* AURA · linki dostępu do odtwarzacza (atrapa, wspólna dla odtwarzacza i panelu admina)
 *
 * Dostęp daje sam link: player.html?t={token}. Bez kont i logowania.
 * W prototypie dane żyją tylko w localStorage tej przeglądarki; nic nie jest wysyłane.
 * [ATRAPA] W produkcji linki trzyma baza (D1), a status zmienia też Stripe (webhook).
 */
(function () {
  'use strict';

  const KEY = 'aura.links';

  // [ROBOCZE] dane startowe
  const SEED = [
    { token: 'k7Hq2xR9mT4w', venue: 'Kawiarnia Ziarno', email: 'kawiarnia@przyklad.pl', active: true, created: '2026-10-01' },
    { token: 'Bn3vQe8LpZ2s', venue: 'Salon Fryzjerski Nożyczki', email: 'salon@przyklad.pl', active: true, created: '2026-09-18' },
    { token: 'Wd5tRk1MxA9c', venue: 'Gabinet Spokój', email: 'gabinet@przyklad.pl', active: true, created: '2026-09-02' },
    { token: 'Yf2hJs7NqP4e', venue: 'Bistro Na Rogu', email: 'bistro@przyklad.pl', active: false, created: '2026-08-14' },
  ];

  function all() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* brak dostępu lub uszkodzone dane */ }
    return SEED.map((l) => Object.assign({}, l));
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* brak dostępu */ }
  }

  function find(token) {
    if (!token) return null;
    return all().find((l) => l.token === token) || null;
  }

  function randomToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const buf = new Uint32Array(12);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    return Array.from(buf, (n) => chars[n % chars.length]).join('');
  }

  function create(venue, email) {
    const list = all();
    let token;
    do { token = randomToken(); } while (list.some((l) => l.token === token));
    const d = new Date();
    const link = {
      token, venue, email, active: true,
      created: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    };
    list.unshift(link);
    save(list);
    return link;
  }

  function setActive(token, active) {
    const list = all();
    const l = list.find((x) => x.token === token);
    if (l) { l.active = active; save(list); }
    return l;
  }

  // Adres do otwarcia odtwarzacza w prototypie (lokalnie, względem bieżącej strony)
  function url(token) {
    return 'player.html?t=' + encodeURIComponent(token);
  }

  // Adres pokazywany klientowi i kopiowany (docelowa forma linku)
  // [DO UZUPEŁNIENIA] ostateczna domena i ścieżka odtwarzacza
  const PUBLIC_BASE = 'https://auramuzyka.pl/p/';
  function publicUrl(token) {
    return PUBLIC_BASE + encodeURIComponent(token);
  }

  window.AuraLinks = { all, save, find, create, setActive, url, publicUrl, DEMO_TOKEN: 'k7Hq2xR9mT4w' };
})();
