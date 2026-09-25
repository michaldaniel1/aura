/* AURA · landing (index.html)
 * Menu, panel kanałów z demo audio, makieta urządzenia, dla kogo, FAQ, atrapa płatności.
 */
(function () {
  'use strict';

  const { profiles, bySlug } = window.AURA;
  const A = window.AuraAudio;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const RM = window.AURA.reducedMotion;

  // [ROBOCZE] typy lokali i sugerowane profile
  const VENUES = [
    { k: 'A', name: 'Kawiarnia', note: 'Rozmowy przy stolikach i laptop przy oknie.', slugs: ['lofi', 'chillout'] },
    { k: 'B', name: 'Barber i fryzjer', note: 'Energia, ale bez wokali nad głową klienta.', slugs: ['hiphop', 'deephouse'] },
    { k: 'C', name: 'Gabinet i spa', note: 'Tło, które uspokaja, zanim klient usiądzie.', slugs: ['ambient', 'chillout'] },
    { k: 'D', name: 'Butik i showroom', note: 'Rytm, który prowadzi między wieszakami.', slugs: ['deephouse', 'smooth-jazz'] },
    { k: 'E', name: 'Restauracja i wine bar', note: 'Muzyka pod rozmowę, nie zamiast niej.', slugs: ['smooth-jazz', 'chillout'] },
    { k: 'F', name: 'Hotel i lobby', note: 'Jeden nastrój od śniadania do późnego check-inu.', slugs: ['chillout', 'ambient'] },
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
  $$('[data-open-checkout]', menu).forEach((b) => b.addEventListener('click', () => setMenu(false)));

  /* ---------- wizualizacje ---------- */
  const heroVis = window.AuraVisual.create($('#hero-canvas'), { mode: 'hero' });
  const devVis = window.AuraVisual.create($('#device-canvas'), { mode: 'device' });
  const visuals = [heroVis, devVis];

  /* ---------- panel kanałów ---------- */
  const list = $('#channels');
  list.innerHTML = profiles.map((p) => `
    <li>
      <button class="ch" type="button" data-slug="${p.slug}" aria-pressed="false" style="--ch-accent:${p.accent}">
        <span class="ch__n">${p.n}</span>
        <span class="ch__icon">${window.AURA.profileIcon(p, 28)}</span>
        <span class="ch__main">
          <span class="ch__name">${p.name}</span>
          <span class="ch__mood">${p.mood}</span>
        </span>
        <span class="ch__places">${p.places}</span>
        <span class="ch__bpm">${p.bpm}<small> BPM</small></span>
        <span class="ch__tracks">${p.tracks}<small> utw.</small></span>
        <span class="ch__status">
          <span class="ch__meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="ch__state">Gotowy</span>
        </span>
      </button>
    </li>`).join('');

  const dots = $('#dv-dots');
  dots.innerHTML = profiles.map((p) => `<i data-slug="${p.slug}" style="--ch-accent:${p.accent}"></i>`).join('');

  let selected = null;

  function select(slug) {
    A.unlock();
    if (selected === slug && A.slug === slug) { A.toggle(); return; }
    selected = slug;
    const p = bySlug[slug];
    window.AURA.applyAccent(p);
    visuals.forEach((v) => v.setProfile(p));
    renderSelection();
    $('#dv-track').textContent = 'Łączenie…';
    A.play(slug);
  }

  function renderSelection() {
    const st = A.state;
    $$('.ch', list).forEach((b) => {
      const on = b.dataset.slug === selected;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-live', on && st === 'playing');
      $('.ch__state', b).textContent = on ? (st === 'playing' ? 'Na żywo' : st === 'paused' ? 'Pauza' : 'Łączenie') : 'Gotowy';
    });
    $$('i', dots).forEach((d) => d.classList.toggle('is-on', d.dataset.slug === selected));
    $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.slug === selected && st === 'playing')));
    const p = selected && bySlug[selected];
    $('#st-channel').textContent = p ? p.n + ' / ' + p.name.toUpperCase() : '—';
    $('#hero-live-text').textContent = st === 'playing' ? 'Na żywo' : st === 'paused' ? 'Pauza' : 'Gotowy';
    $('#hero-live').classList.toggle('is-live', st === 'playing');
    $('#panel-hint').textContent = st === 'playing' ? 'Kliknij ponownie, aby wstrzymać' : 'Wybierz kanał';
    if (p) {
      $('#dv-idx').textContent = p.n + ' / 07';
      $('#dv-name').textContent = p.name;
    }
    const play = $('#dv-play');
    play.innerHTML = window.AURA.uiIcon(st === 'playing' ? 'pause' : 'play', 22);
    play.setAttribute('aria-label', st === 'playing' ? 'Pauza' : 'Odtwórz');
    document.body.classList.toggle('is-playing', st === 'playing');
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.ch');
    if (b) select(b.dataset.slug);
  });

  $('#dv-play').addEventListener('click', () => {
    if (!selected) select('ambient'); else if (A.slug) { A.unlock(); A.toggle(); } else select(selected);
  });

  $('#hero-listen').addEventListener('click', () => {
    if (A.state !== 'playing') select(selected || 'ambient');
    $('#posluchaj').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
  });

  A.on('state', (s) => {
    visuals.forEach((v) => v.setMode(s === 'playing' ? 'playing' : s === 'paused' ? 'paused' : 'idle'));
    renderSelection();
    if (s === 'playing') meterLoop();
  });
  A.on('track', (t) => {
    $('#dv-track').textContent = 'Utwór ' + t.number + ' · ' + t.title;
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
      <span class="venue__k">${v.k} /</span>
      <h3 class="h3">${v.name}</h3>
      <p>${v.note}</p>
      <p class="label venue__label">Sugerowane kanały</p>
      <div class="venue__chips">
        ${v.slugs.map((s) => { const p = bySlug[s]; return `<button class="chip" type="button" data-slug="${s}" aria-pressed="false" style="--ch-accent:${p.accent}"><i></i>${p.n} ${p.name}</button>`; }).join('')}
      </div>
    </li>`).join('');
  $('#venues').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    select(c.dataset.slug);
    toast('Gra: ' + bySlug[c.dataset.slug].n + ' / ' + bySlug[c.dataset.slug].name);
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

  /* ---------- atrapa płatności ---------- */
  const dlg = $('#checkout'), form = $('#co-form'), done = $('#co-done');
  $$('[data-open-checkout]').forEach((b) => b.addEventListener('click', () => {
    form.hidden = false; done.hidden = true; form.reset();
    $$('.field', form).forEach((f) => f.classList.remove('is-invalid'));
    dlg.showModal();
  }));
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // prototyp: nic nie jest wysyłane
    let ok = true;
    $$('input[required]', form).forEach((i) => {
      const bad = !i.checkValidity() || !i.value.trim();
      i.closest('.field').classList.toggle('is-invalid', bad);
      if (bad && ok) { i.focus(); ok = false; }
    });
    if (!ok) return;
    form.hidden = true; done.hidden = false;
    $('a', done).focus();
  });

  /* ---------- licencja: druk wzoru ---------- */
  $('#print-license').addEventListener('click', () => {
    document.body.classList.add('print-license');
    window.print();
    setTimeout(() => document.body.classList.remove('print-license'), 500);
  });

  // Atrapa kodu QR (deterministyczny wzór, nie jest prawdziwym kodem)
  (function qr() {
    const svg = $('#doc-qr');
    let s = 142, out = '';
    const finder = (x, y) => `<path d="M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
      s = (s * 16807) % 2147483647;
      if (s % 2) out += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    svg.innerHTML = finder(0, 0) + finder(14, 0) + finder(0, 14) + out;
  })();

  /* ---------- atrapy linków ---------- */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }
  $$('[data-dummy]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast('Atrapa: strona powstanie w kolejnej iteracji'); }));

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
  A.init();
})();
