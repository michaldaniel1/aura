/* AURA · odtwarzacz dla lokalu (player.html)
 *
 * Dostęp daje sam link: player.html?t={token} (bez kont). Token sprawdzany w js/links.js.
 * Widoki: idle → loading → playing ⇄ paused, elsewhere (link gra na innym urządzeniu)
 * oraz inactive (link wyłączony albo abonament wygasł). „Brak internetu” to niezależna flaga z banerem:
 * muzyka gra dalej z bufora, odtwarzacz sam ponawia połączenie.
 * Klawisze: spacja play/pauza · 1–7 kanał · M wycisz · ↑/↓ głośność · N następny · D panel prototypu
 */
(function () {
  'use strict';

  const { profiles, bySlug } = window.AURA;
  const A = window.AuraAudio;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const body = document.body;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('aura.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('aura.' + k, JSON.stringify(v)); } catch (e) { /* tryb prywatny */ } },
  };

  const S = {
    view: 'idle',
    slug: bySlug[store.get('slug', 'ambient')] ? store.get('slug', 'ambient') : 'ambient',
    offline: false,
  };

  // Dostęp z linku: aktywny token → odtwarzacz; brak, nieznany albo wyłączony → „Dostęp nieaktywny”
  const TOKEN = new URLSearchParams(location.search).get('t');
  const LINK = window.AuraLinks.find(TOKEN);
  const VENUE = LINK ? LINK.venue : '';
  const ACCESS = !!(LINK && LINK.active);

  $$('[data-ui-icon]').forEach((el) => (el.innerHTML = window.AURA.uiIcon(el.dataset.uiIcon, el.dataset.size || 20)));

  const vis = window.AuraVisual.create($('#pl-canvas'), { mode: 'player' });

  /* ---------- kanały ---------- */
  const nav = $('#pl-channels');
  nav.innerHTML = profiles.map((p, i) => `
    <button class="pl-ch" type="button" data-slug="${p.slug}" aria-pressed="false" style="--ch-accent:${p.accent}"
      aria-label="Playlista ${p.n} ${p.name} (klawisz ${i + 1})">
      <span class="pl-ch__n">${p.n}</span>
      <span class="pl-ch__icon">${window.AURA.profileIcon(p, 28)}</span>
      <span class="pl-ch__name">${p.name}</span>
      <span class="pl-ch__dot" aria-hidden="true"></span>
    </button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.pl-ch');
    if (b) selectChannel(b.dataset.slug);
  });

  const playOpts = (slug) => ({ playlist: bySlug[slug].playlist });

  function renderProfile(animate) {
    const p = bySlug[S.slug];
    window.AURA.applyAccent(p);
    $$('.pl-ch', nav).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slug === S.slug)));
    $('#ov-idle-ch').textContent = p.name;
    const name = $('#pl-name');
    const apply = () => {
      name.textContent = p.name;
      $('#pl-index').textContent = 'Playlista ' + p.n + ' / 07 · ' + p.bpm + ' BPM';
      $('#pl-mood').textContent = p.mood;
      name.classList.remove('is-swap');
    };
    if (animate && !window.AURA.reducedMotion.matches) { name.classList.add('is-swap'); setTimeout(apply, 220); } else apply();
    document.title = 'AURA · ' + p.name + (VENUE ? ' · ' + VENUE : '');
  }

  function selectChannel(slug) {
    if (S.view === 'inactive' || S.view === 'elsewhere' || S.view === 'loading') return;
    if (slug === S.slug && A.slug === slug) { if (S.view === 'paused') togglePlay(); return; }
    S.slug = slug;
    store.set('slug', slug);
    renderProfile(true);
    vis.setProfile(bySlug[slug]);
    if (S.view === 'idle') { start(); return; }
    $('#pl-title').textContent = 'Zmieniam playlistę…';
    A.play(slug, playOpts(slug));
    setView('playing');
  }

  /* ---------- widoki ---------- */
  const overlays = { idle: '#ov-idle', loading: '#ov-loading', inactive: '#ov-inactive', elsewhere: '#ov-elsewhere' };

  function setView(v) {
    S.view = v;
    body.dataset.state = v;
    Object.entries(overlays).forEach(([k, sel]) => $(sel).classList.toggle('is-on', k === v));
    $('#pl').inert = v === 'idle' || v === 'inactive' || v === 'elsewhere';

    if (v === 'idle') { A.stop(); $('#pl-title').textContent = 'Gotowy do odtwarzania'; }
    if (v === 'paused' || v === 'inactive' || v === 'elsewhere' || v === 'loading') { if (A.state === 'playing') A.pause(); }
    if (v === 'playing' && A.state === 'paused') A.resume();

    vis.setMode(v === 'playing' ? 'playing' : v === 'paused' ? 'paused' : v === 'idle' || v === 'loading' ? 'idle' : 'off');

    const playing = v === 'playing';
    const btn = $('#pl-play');
    btn.innerHTML = window.AURA.uiIcon(playing ? 'pause' : 'play', 48);
    btn.setAttribute('aria-label', (playing ? 'Pauza' : 'Odtwórz') + ' (spacja)');

    if (v === 'idle') setTimeout(() => $('#ov-start').focus(), 50);
    if (v === 'elsewhere') setTimeout(() => $('#ov-takeover').focus(), 50);
    if (playing) { wake(true); uiLoop(); } else wake(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : v === 'paused' ? 'paused' : 'none';
    syncProto();
  }

  // Start z gestu użytkownika: ładowanie → odtwarzanie (min. 900 ms, żeby stan był czytelny)
  function start(loadingText) {
    A.unlock();
    $('#ov-loading-t').textContent = loadingText || 'Ładuję muzykę…';
    setView('loading');
    const t0 = performance.now();
    const go = A.slug === S.slug && A.state === 'paused'
      ? Promise.resolve().then(() => A.resume())
      : A.play(S.slug, Object.assign(playOpts(S.slug), { instant: true }));
    return go.then(() => new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - t0)))))
      .then(() => { if (S.view === 'loading') setView('playing'); });
  }

  function togglePlay() {
    if (S.view === 'idle') return start();
    if (S.view === 'playing') return setView('paused');
    if (S.view === 'paused') { A.unlock(); return setView('playing'); }
  }

  $('#pl-play').addEventListener('click', togglePlay);
  $('#ov-start').addEventListener('click', () => start());
  $('#ov-idle').addEventListener('click', (e) => { if (e.target.id === 'ov-idle') start(); });
  // Jeden link = jedno urządzenie naraz: przejęcie odtwarzania na tym urządzeniu
  $('#ov-takeover').addEventListener('click', () => { toast('Muzyka gra teraz na tym urządzeniu. Poprzednie się zatrzymało.'); start('Przenoszę odtwarzanie…'); });

  /* ---------- utwór i postęp ---------- */
  A.on('track', (t) => {
    if (t.slug !== S.slug) return;
    $('#pl-title').textContent = t.number + ' · ' + t.title;
    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: 'AURA · ' + bySlug[t.slug].name, album: VENUE || 'AURA' });
    }
  });

  const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  setInterval(() => {
    if (S.view !== 'playing' && S.view !== 'paused') return;
    const pos = A.position();
    $('#pl-time').textContent = fmt(pos.time) + ' / ' + fmt(pos.duration);
    $('#pl-progress').style.width = pos.duration ? Math.min(100, (pos.time / pos.duration) * 100).toFixed(2) + '%' : '0%';
  }, 250);

  // Pierścień przycisku reaguje na poziom dźwięku
  let raf = 0;
  const playBtn = $('#pl-play');
  function uiLoop() {
    if (raf || document.hidden) return;
    const tick = () => {
      raf = 0;
      const lv = A.levels();
      playBtn.style.setProperty('--lvl', window.AURA.reducedMotion.matches ? 0 : Math.min(1, lv.rms * 1.2).toFixed(3));
      if (S.view === 'playing' && !document.hidden) raf = requestAnimationFrame(tick);
      else playBtn.style.setProperty('--lvl', 0);
    };
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.view === 'playing') { uiLoop(); wake(true); }
  });

  /* ---------- głośność ---------- */
  const vol = $('#pl-volume'), volOut = $('#pl-vol-out'), muteBtn = $('#pl-mute');
  function setVol(v, save) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    vol.value = v;
    vol.style.setProperty('--val', v + '%');
    volOut.textContent = v + '%';
    A.setVolume(v / 100);
    if (v > 0 && A.muted) setMute(false);
    if (save) store.set('volume', v);
  }
  function setMute(m) {
    A.setMuted(m);
    body.dataset.muted = String(m);
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.setAttribute('aria-label', (m ? 'Włącz dźwięk' : 'Wycisz') + ' (M)');
    muteBtn.innerHTML = window.AURA.uiIcon(m ? 'mute' : 'volume', 22);
    volOut.textContent = m ? 'Wyciszone' : vol.value + '%';
  }
  vol.addEventListener('input', () => setVol(+vol.value, true));
  muteBtn.addEventListener('click', () => setMute(!A.muted));
  setVol(store.get('volume', 80));

  /* ---------- brak internetu ---------- */
  let offTimer = null;
  function setOffline(on) {
    if (S.offline === on) return;
    S.offline = on;
    body.dataset.offline = String(on);
    $('#bn-offline').classList.toggle('is-on', on);
    clearInterval(offTimer);
    if (on) {
      const backoff = [3, 5, 10];
      let attempt = 0, left = backoff[0], buffer = 240;
      const text = $('#bn-text'), sub = $('#bn-sub');
      const render = () => {
        text.textContent = left > 0 ? 'Brak internetu. Kolejna próba za ' + left + ' s' : 'Próbuję połączyć ponownie…';
        sub.textContent = buffer > 0 ? 'Muzyka gra z zapasu jeszcze ok. ' + fmt(buffer) : 'Zapas się skończył. Odtwarzacz wznowi muzykę, gdy wróci internet.';
      };
      render();
      offTimer = setInterval(() => {
        if (S.view === 'playing') buffer = Math.max(0, buffer - 1);
        if (buffer === 0 && S.view === 'playing') setView('paused');
        left--;
        if (left < 0) { attempt++; left = backoff[Math.min(attempt, backoff.length - 1)]; }
        render();
      }, 1000);
    } else {
      toast('Połączenie przywrócone');
    }
    syncProto();
  }
  $('#bn-retry').addEventListener('click', () => {
    $('#bn-text').textContent = 'Próbuję połączyć ponownie…';
    if (navigator.onLine && !S.simOffline) setOffline(false);
  });
  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => { if (!S.simOffline) setOffline(false); });

  /* ---------- panel „Dodatkowe podglądy” (przycisk w prawym dolnym rogu lub klawisz D) ---------- */
  const proto = $('#proto'), protoBtn = $('#proto-toggle');
  function toggleProto(open) {
    open = open == null ? proto.hidden : open;
    proto.hidden = !open;
    protoBtn.setAttribute('aria-expanded', String(open));
    if (open) syncProto();
  }
  function syncProto() {
    $$('#proto-states button').forEach((b) => {
      const st = b.dataset.state;
      b.setAttribute('aria-pressed', String(st === 'offline' ? S.offline : st === S.view));
    });
  }
  protoBtn.addEventListener('click', () => toggleProto());
  $('#proto-close').addEventListener('click', () => { toggleProto(false); protoBtn.focus(); });
  $('#proto-next').addEventListener('click', () => { if (A.slug) { A.next(); toast('Następny utwór'); } });
  $('#proto-states').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const st = b.dataset.state;
    if (st === 'offline') { S.simOffline = !S.offline; setOffline(!S.offline); return; }
    if (st === 'playing') { S.view === 'idle' || !A.slug ? start() : setView('playing'); return; }
    if (st === 'paused') {
      if (!A.slug) start().then(() => setView('paused')); else setView('paused');
      return;
    }
    if (st === 'loading') { A.unlock(); $('#ov-loading-t').textContent = 'Ładuję muzykę…'; }
    setView(st);
  });

  /* ---------- klawiatura ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onRange = e.target === vol;
    const k = e.key.toLowerCase();
    if (k === 'd') { toggleProto(); return; }
    if (k === 'escape' && !proto.hidden) { toggleProto(false); return; }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (S.view === 'inactive' || S.view === 'elsewhere') return;
      togglePlay();
      return;
    }
    if (S.view === 'inactive' || S.view === 'elsewhere') return;
    if (/^[1-7]$/.test(e.key)) { selectChannel(profiles[+e.key - 1].slug); return; }
    if (k === 'm') { setMute(!A.muted); return; }
    if (k === 'n' && A.slug) { A.next(); return; }
    if (!onRange && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setVol(+vol.value + (e.key === 'ArrowUp' ? 5 : -5), true);
    }
  });

  /* ---------- Wake Lock i Media Session ---------- */
  let lock = null;
  function wake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !lock && !document.hidden) {
      navigator.wakeLock.request('screen').then((l) => { lock = l; l.addEventListener('release', () => (lock = null)); }).catch(() => {});
    } else if (!on && lock) { lock.release(); lock = null; }
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => { if (S.view === 'paused') togglePlay(); });
      ms.setActionHandler('pause', () => { if (S.view === 'playing') togglePlay(); });
      ms.setActionHandler('nexttrack', () => A.slug && A.next());
    } catch (e) { /* nieobsługiwane akcje */ }
  }

  /* ---------- zegar, toast ---------- */
  const clock = $('#pl-clock');
  const tickClock = () => { const d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tickClock(); setInterval(tickClock, 10000);

  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  /* ---------- start ---------- */
  renderProfile(false);
  vis.setProfile(bySlug[S.slug], true);
  $('#pl-venue').textContent = VENUE;
  setView(ACCESS ? 'idle' : 'inactive');
  if (!navigator.onLine) setOffline(true);
  A.init();
})();
