/* AURA · landing (index.html)
 * Menu, lista playlist z przykładowymi utworami, makieta urządzenia, dla kogo, FAQ,
 * przyciski „Wykup abonament” (płatność Stripe → dziekujemy.html).
 */
(function () {
  'use strict';

  const { bySlug, samples } = window.AURA; // na landingu tylko 5 playlist z przykładami
  const A = window.AuraAudio;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const RM = window.AURA.reducedMotion;

  // [ROBOCZE] typy lokali i playlisty, od których warto zacząć
  const VENUES = [
    { name: 'Kawiarnie', slugs: ['lofi', 'chillout'] },
    { name: 'Barberzy i salony fryzjerskie', slugs: ['deephouse', 'lofi'] },
    { name: 'Gabinety kosmetyczne i spa', slugs: ['ambient', 'chillout'] },
    { name: 'Butiki i showroomy', slugs: ['deephouse', 'smooth-jazz'] },
    { name: 'Restauracje i winiarnie', slugs: ['smooth-jazz', 'chillout'] },
    { name: 'Hotele', slugs: ['chillout', 'ambient'] },
  ];

  /* ---------- ikony UI ---------- */
  function paintIcons(root) {
    $$('[data-ui-icon]', root).forEach((el) => (el.innerHTML = window.AURA.uiIcon(el.dataset.uiIcon, el.dataset.size || 20)));
  }
  paintIcons();

  /* ---------- nawigacja ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menu = $('#menu'), menuBtn = $('#menu-toggle');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      $('a', menu).focus();
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 320);
    }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
  });
  $$('[data-buy], [data-listen]', menu).forEach((b) => b.addEventListener('click', () => setMenu(false)));

  /* ---------- wizualizacje ---------- */
  const heroVis = window.AuraVisual.create($('#hero-canvas'), { mode: 'hero' });
  const devVis = window.AuraVisual.create($('#device-canvas'), { mode: 'device' });
  const visuals = [heroVis, devVis];

  /* ---------- lista playlist (przykłady: jeden utwór z każdej) ---------- */
  const list = $('#channels');
  list.innerHTML = samples.map((p, i) => `
    <li>
      <button class="ch" type="button" data-slug="${p.slug}" aria-pressed="false" style="--ch-accent:${p.accent}">
        <span class="ch__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="ch__icon">${window.AURA.profileIcon(p, 28)}</span>
        <span class="ch__main">
          <span class="ch__name">${p.name}</span>
          <span class="ch__mood">${p.mood}</span>
        </span>
        <span class="ch__places">${p.places}</span>
        <span class="ch__bpm">${p.bpm}<small> BPM</small></span>
        <span class="ch__status">
          <span class="ch__meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="ch__state">Gotowy</span>
        </span>
      </button>
    </li>`).join('');

  const dots = $('#dv-dots');
  dots.innerHTML = samples.map((p) => `<i data-slug="${p.slug}" style="--ch-accent:${p.accent}"></i>`).join('');

  let selected = null;
  let loading = false;

  /* ---------- limit odsłuchu: 2 minuty łącznie na wizytę (sessionStorage) ---------- */
  const LIMIT = 120;
  let used = 0;
  try { used = Number(sessionStorage.getItem('aura.previewUsed')) || 0; } catch (e) { /* brak dostępu */ }
  const saveUsed = () => { try { sessionStorage.setItem('aura.previewUsed', used.toFixed(1)); } catch (e) { /* brak dostępu */ } };
  const limitReached = () => used >= LIMIT;
  const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  function renderTimer() {
    const el = $('#dv-timer');
    if (used <= 0) return;
    el.hidden = false;
    $('b', el).textContent = mmss(LIMIT - used);
  }
  function highlightCta() {
    const cta = $('.device__cta');
    cta.classList.remove('is-highlight');
    void cta.offsetWidth; // restart animacji
    cta.classList.add('is-highlight');
  }
  // true = limit wykorzystany, odtwarzanie zablokowane
  function blockIfLimit() {
    if (!limitReached()) return false;
    toast('Na stronie można posłuchać 2 minut przykładów. Wykup abonament, aby słuchać dalej.');
    highlightCta();
    return true;
  }
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (A.state !== 'playing' || limitReached()) return;
    used = Math.min(LIMIT, used + dt);
    saveUsed();
    renderTimer();
    if (limitReached()) {
      A.stop();
      loading = false;
      $('#dv-track').textContent = 'Limit odsłuchu wykorzystany';
      highlightCta();
    }
  }, 250);

  function select(slug) {
    if (A.state !== 'playing' && blockIfLimit()) return;
    A.unlock();
    if (selected === slug && A.slug === slug) { A.toggle(); return; }
    selected = slug;
    loading = true;
    const p = bySlug[slug];
    window.AURA.applyAccent(p);
    visuals.forEach((v) => v.setProfile(p));
    renderSelection();
    $('#dv-track').textContent = 'Ładowanie…';
    A.play(slug, { single: true });
  }

  function renderSelection() {
    const st = A.state;
    $$('.ch', list).forEach((b) => {
      const on = b.dataset.slug === selected;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-live', on && st === 'playing');
      $('.ch__state', b).textContent = on ? (st === 'playing' ? 'Gra' : st === 'paused' ? 'Pauza' : loading ? 'Ładowanie' : 'Gotowy') : 'Gotowy';
    });
    $$('i', dots).forEach((d) => d.classList.toggle('is-on', d.dataset.slug === selected));
    $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.slug === selected && st === 'playing')));
    const p = selected && bySlug[selected];
    $('#st-channel').textContent = p ? p.name.toUpperCase() : '—';
    const playing = st === 'playing';
    $('#hero-play-text').textContent = playing ? 'Zatrzymaj' : 'Odtwórz';
    $('#hero-play').innerHTML = window.AURA.uiIcon(playing ? 'pause' : 'play', 16) + $('#hero-play-text').outerHTML;
    $('#hero-play').setAttribute('aria-label', playing ? 'Zatrzymaj przykład' : 'Odtwórz losowy przykład');
    $('#hero-play').classList.toggle('is-live', playing);
    $('#dv-live').textContent = playing ? 'Gra' : st === 'paused' ? 'Pauza' : 'Gotowy';
    if (p) {
      $('#dv-idx').textContent = String(samples.indexOf(p) + 1).padStart(2, '0') + ' / ' + String(samples.length).padStart(2, '0');
      $('#dv-name').textContent = p.name;
    }
    const play = $('#dv-play');
    play.innerHTML = window.AURA.uiIcon(st === 'playing' ? 'pause' : 'play', 22);
    play.setAttribute('aria-label', st === 'playing' ? 'Pauza' : 'Odtwórz przykład');
    document.body.classList.toggle('is-playing', st === 'playing');
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.ch');
    if (b) select(b.dataset.slug);
  });

  $('#dv-play').addEventListener('click', () => {
    if (A.state !== 'playing' && blockIfLimit()) return;
    if (!selected) select('ambient'); else if (A.slug) { A.unlock(); A.toggle(); } else select(selected);
  });

  // „Odtwórz” w panelu statusu hero: losowy przykład (bez powtórzenia ostatniego), w trakcie: zatrzymaj
  $('#hero-play').addEventListener('click', () => {
    if (A.state === 'playing') { A.stop(); return; }
    if (blockIfLimit()) return;
    const pool = samples.filter((p) => p.slug !== selected);
    select(pool[Math.floor(Math.random() * pool.length)].slug);
  });

  // „Posłuchaj przykładów” (belka, menu, hero): przewija do listy i włącza przykład
  $$('[data-listen]').forEach((b) => b.addEventListener('click', () => {
    if (A.state !== 'playing') select(selected || 'ambient');
    $('#posluchaj').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
  }));

  A.on('state', (s) => {
    visuals.forEach((v) => v.setMode(s === 'playing' ? 'playing' : s === 'paused' ? 'paused' : 'idle'));
    renderSelection();
    if (s === 'playing') meterLoop();
  });
  A.on('track', (t) => {
    loading = false;
    $('#dv-track').textContent = 'Przykład · ' + t.title;
    renderSelection();
  });
  A.on('ended', () => {
    loading = false;
    $('#dv-track').textContent = 'Koniec przykładu';
    renderSelection();
  });

  /* ---------- wskaźniki poziomu (panel statusu) ---------- */
  let meterRaf = 0;
  const heroBars = $$('#st-meter i');
  function meterLoop() {
    if (meterRaf) return;
    const tick = () => {
      meterRaf = 0;
      const lv = A.levels();
      const active = $('.ch[aria-pressed="true"]', list);
      if (active) {
        const bands = [lv.low, lv.mid, lv.high, lv.rms];
        $$('.ch__meter i', active).forEach((bar, i) => (bar.style.transform = 'scaleY(' + (0.15 + Math.min(1, bands[i] * 1.4) * 0.85).toFixed(3) + ')'));
      }
      const lit = Math.round(Math.min(1, lv.rms * 1.3) * heroBars.length);
      heroBars.forEach((b, i) => b.classList.toggle('on', i < lit));
      const db = lv.rms > 0.003 ? Math.max(-60, 20 * Math.log10(lv.rms / 3.2)) : -Infinity;
      $('#st-db').textContent = isFinite(db) ? '−' + Math.abs(db).toFixed(0).padStart(2, '0') + ' dB' : '−∞ dB';
      if (A.state === 'playing' || lv.rms > 0.004) {
        if (!document.hidden) meterRaf = requestAnimationFrame(tick);
      } else {
        heroBars.forEach((b) => b.classList.remove('on'));
        $$('.ch__meter i', list).forEach((bar) => (bar.style.transform = ''));
      }
    };
    meterRaf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.state === 'playing') meterLoop(); });

  /* ---------- zegar ---------- */
  const clock = $('#st-clock');
  const pad = (n) => String(n).padStart(2, '0');
  const tickClock = () => { const d = new Date(); clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  tickClock(); setInterval(tickClock, 1000);

  /* ---------- dla kogo ---------- */
  $('#venues').innerHTML = VENUES.map((v) => `
    <li class="venue reveal">
      <h3 class="h3">${v.name}</h3>
      <div class="venue__chips">
        ${v.slugs.map((s) => { const p = bySlug[s]; return `<button class="chip" type="button" data-slug="${s}" aria-pressed="false" style="--ch-accent:${p.accent}"><i></i>${p.name}</button>`; }).join('')}
      </div>
    </li>`).join('');
  $('#venues').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    select(c.dataset.slug);
    toast('Przykład z playlisty ' + bySlug[c.dataset.slug].name);
  });

  /* ---------- FAQ: animacja wysokości ---------- */
  $$('.qa').forEach((d) => {
    const s = $('summary', d), body = $('.qa__a', d);
    s.addEventListener('click', (e) => {
      if (RM.matches || !body.animate) return;
      e.preventDefault();
      if (d.open) {
        const h = body.offsetHeight;
        d.classList.remove('is-open');
        body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: 'cubic-bezier(.2,.7,.1,1)' })
          .onfinish = () => (d.open = false);
      } else {
        d.open = true;
        d.classList.add('is-open');
        const h = body.offsetHeight;
        body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.1,1)' });
      }
    });
  });

  /* ---------- „Wykup abonament”: płatność Stripe → strona z linkiem ---------- */
  // [DO UZUPEŁNIENIA] adres Stripe Checkout / Payment Link dla planu 69 zł.
  // W produkcji Stripe po płatności sam przekierowuje na dziekujemy.html z linkiem klienta.
  const CHECKOUT_URL = 'https://stripe.com/';
  $$('[data-buy]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    window.open(CHECKOUT_URL, '_blank', 'noopener');
    window.location.href = 'dziekujemy.html';
  }));

  /* ---------- licencja: wzór do druku / zapisu jako PDF ---------- */
  function printLicense() {
    document.body.classList.add('print-license');
    window.print();
    setTimeout(() => document.body.classList.remove('print-license'), 500);
  }
  $('#print-license').addEventListener('click', printLicense);

  /* ---------- atrapy linków ---------- */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }
  $$('[data-dummy]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast('W prototypie ta strona jeszcze nie istnieje'); }));

  /* ---------- wejście sekcji ---------- */
  if ('IntersectionObserver' in window && !RM.matches) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  renderSelection();
  renderTimer();
  if (limitReached()) $('#dv-track').textContent = 'Limit odsłuchu wykorzystany';
  A.init();
})();
