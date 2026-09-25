/* AURA · silnik audio (wspólny dla landingu i odtwarzacza)
 *
 * Graf:  kanał (źródło → GainNode) ─┐
 *        kanał (crossfade)         ─┴→ bus (pauza) → AnalyserNode → master (głośność) → wyjście
 *                                     └→ pogłos (wysyłka) ─┘
 *
 * - AudioContext powstaje dopiero w geście użytkownika (unlock()).
 * - Głośność wyłącznie przez GainNode (iOS ignoruje audio.volume).
 * - Brak pliku assets/audio/{slug}.mp3 → zastępczy syntezator Web Audio w charakterze profilu.
 */
(function () {
  'use strict';

  const XFADE = 1.5; // s, crossfade między kanałami i utworami
  const listeners = {};
  const probe = {}; // slug → true (plik jest) | false (brak)

  let ctx = null, bus, analyser, master, reverb, noiseBuf, crackleBuf;
  let freqData, timeData;
  let current = null; // aktywny kanał
  let state = 'idle'; // idle | playing | paused
  let volume = 0.8, muted = false;
  let tickTimer = null;
  const bags = {}; // shuffle bag per profil
  const lastPick = {};

  const emit = (evt, data) => (listeners[evt] || []).forEach((fn) => fn(data));

  /* ---------- pomocnicze ---------- */

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Losowanie bez powtórzeń: tasuje pulę, a po jej wyczerpaniu tasuje od nowa
  // tak, żeby pierwszy element nowej puli nie był ostatnim odtworzonym.
  function nextFromBag(key, size) {
    if (!bags[key] || !bags[key].length) {
      const arr = Array.from({ length: size }, (_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (size > 1 && arr[arr.length - 1] === lastPick[key]) [arr[0], arr[arr.length - 1]] = [arr[arr.length - 1], arr[0]];
      bags[key] = arr;
    }
    const v = bags[key].pop();
    lastPick[key] = v;
    return v;
  }

  // Płynna zmiana GainNode. Krzywa equal-power (sin/cos), start od bieżącej wartości.
  // Wartość śledzimy po stronie JS, bo AudioParam.value nie odzwierciedla automatyki natychmiast.
  function fade(ch, to, dur) {
    const now = ctx.currentTime;
    const from = gainAt(ch, now);
    const g = ch.gain.gain;
    const steps = 48;
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const p = i / (steps - 1);
      const s = to > from ? Math.sin(p * Math.PI / 2) : 1 - Math.cos(p * Math.PI / 2);
      curve[i] = Math.max(0.0001, from + (to - from) * s);
    }
    try {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(0);
      g.setValueAtTime(curve[0], now);
      g.setValueCurveAtTime(curve, now + 0.01, dur);
    } catch (e) {
      g.cancelScheduledValues(0);
      g.setValueAtTime(from, now);
      g.linearRampToValueAtTime(to, now + dur);
    }
    ch.ramp = { from, to, start: now, dur };
  }
  function gainAt(ch, t) {
    const r = ch.ramp;
    if (!r) return 0.0001;
    const p = Math.min(1, Math.max(0, (t - r.start) / r.dur));
    const s = r.to > r.from ? Math.sin(p * Math.PI / 2) : 1 - Math.cos(p * Math.PI / 2);
    return r.from + (r.to - r.from) * s;
  }

  /* ---------- kontekst ---------- */

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'playback' });
      bus = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume * volume;
      const comp = ctx.createDynamicsCompressor(); // ochrona przed przesterem przy nakładaniu kanałów
      comp.threshold.value = -10; comp.ratio.value = 3;
      bus.connect(comp); comp.connect(analyser); analyser.connect(master); master.connect(ctx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Float32Array(analyser.fftSize);

      // Pogłos z wygenerowanej odpowiedzi impulsowej
      reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 3.2;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      reverb.buffer = ir;
      const rvOut = ctx.createGain(); rvOut.gain.value = 0.55;
      reverb.connect(rvOut); rvOut.connect(bus);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const cd = crackleBuf.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.015;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------- raport brakujących plików ---------- */

  function init() {
    const P = window.AURA.profiles;
    return Promise.all(P.map((p) =>
      fetch('assets/audio/' + p.slug + '.mp3', { method: 'HEAD', cache: 'no-store' })
        .then((r) => (probe[p.slug] = r.ok))
        .catch(() => (probe[p.slug] = false))
    )).then(() => {
      const missing = P.filter((p) => !probe[p.slug]);
      if (missing.length) {
        console.info('%cAURA / audio', 'font-weight:bold',
          'Brakuje ' + missing.length + ' z 7 próbek. Zamiast nich gra zastępczy syntezator Web Audio:');
        console.table(missing.map((p) => ({ profil: p.n + ' / ' + p.name, plik: 'assets/audio/' + p.slug + '.mp3', zastępstwo: 'syntezator Web Audio' })));
      } else {
        console.info('AURA / audio: wszystkie 7 próbek dostępne.');
      }
      return probe;
    });
  }

  /* ---------- źródło: plik ---------- */

  function fileSource(ch, url) {
    const el = new Audio();
    el.preload = 'auto';
    el.src = url;
    const src = ctx.createMediaElementSource(el);
    src.connect(ch.gain);
    ch.el = el;
    ch.kind = 'file';
    return new Promise((resolve, reject) => {
      let done = false;
      el.addEventListener('playing', () => { if (!done) { done = true; resolve(); } }, { once: true });
      el.addEventListener('error', () => { if (!done) { done = true; reject(new Error('audio error')); } }, { once: true });
      const p = el.play();
      if (p && p.catch) p.catch((e) => { if (!done) { done = true; reject(e); } });
    });
  }

  /* ---------- źródło: zastępczy syntezator ---------- */

  function synthSource(ch, p, seed) {
    const cfg = p.synth;
    const r = rng(seed * 9301 + p.n.charCodeAt(1));
    const transpose = [0, 2, -3, 5, -2, 3, -5, 7][seed % 8];
    const cutoff = cfg.cutoff * (0.85 + r() * 0.3);
    const out = ch.gain;
    const nodes = [];
    const t0 = ctx.currentTime + 0.05;
    const step = 60 / cfg.bpm / 4;
    const barDur = step * 16;
    const chords = cfg.chords.map((c) => c.map((m) => m + transpose));

    // Pad: 5 głosów × 2 odstrojone oscylatory → filtr LP z LFO
    const padF = ctx.createBiquadFilter();
    padF.type = 'lowpass'; padF.frequency.value = cutoff; padF.Q.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = cfg.lfo;
    const lfoG = ctx.createGain(); lfoG.gain.value = cutoff * 0.4;
    lfo.connect(lfoG); lfoG.connect(padF.frequency); lfo.start(t0); nodes.push(lfo);
    const padG = ctx.createGain(); padG.gain.value = cfg.wave === 'sawtooth' ? 0.045 : 0.075;
    padF.connect(padG); padG.connect(out);
    const send = ctx.createGain(); send.gain.value = cfg.bells ? 0.9 : 0.4;
    padG.connect(send); send.connect(reverb);
    const voices = [];
    for (let v = 0; v < 5; v++) {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = cfg.wave; o.detune.value = det + (r() - 0.5) * 4;
        o.frequency.value = mtof(chords[0][v]);
        o.connect(padF); o.start(t0); nodes.push(o); voices.push({ o, v });
      });
    }

    const drumBus = ctx.createGain(); drumBus.gain.value = 0.55; drumBus.connect(out);
    const fxSend = ctx.createGain(); fxSend.gain.value = 0.25; fxSend.connect(reverb);

    if (cfg.crackle) {
      const cr = ctx.createBufferSource(); cr.buffer = crackleBuf; cr.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const cg = ctx.createGain(); cg.gain.value = 0.5;
      cr.connect(hp); hp.connect(cg); cg.connect(out); cr.start(t0); nodes.push(cr);
    }

    function env(g, t, peak, attack, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function kick(t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      env(g, t, 0.9, 0.004, 0.36); o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.45);
    }
    function noise(t, type, freq, q, peak, decay, wet) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); env(g, t, peak, 0.002, decay);
      s.connect(f); f.connect(g); g.connect(drumBus); if (wet) g.connect(fxSend);
      s.start(t, r() * 0.5); s.stop(t + decay + 0.05);
    }
    function tone(t, midi, type, peak, decay, cut, dest) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = type; o.frequency.value = mtof(midi);
      f.type = 'lowpass'; f.frequency.value = cut;
      env(g, t, peak, 0.006, decay);
      o.connect(f); f.connect(g); g.connect(dest || out); g.connect(fxSend);
      o.start(t); o.stop(t + decay + 0.1);
    }

    // Sekwencer z wyprzedzeniem (lookahead), 16 kroków na takt
    let nextStep = 0, nextTime = t0, stopped = false, chordIdx = -1, bellAt = t0 + 2;
    const pat = cfg.drums || {};
    const hit = (name, s) => pat[name] && pat[name][s % 16] === 'x';

    function schedule() {
      if (stopped) return;
      while (nextTime < ctx.currentTime + 0.15) {
        const s = nextStep % 16;
        const bar = Math.floor(nextStep / 16);
        const t = nextTime + (s % 2 ? (cfg.swing || 0) * step : 0);
        const ci = Math.floor(bar / cfg.barsPerChord) % chords.length;
        const chord = chords[ci];
        if (s === 0 && ci !== chordIdx) {
          chordIdx = ci;
          voices.forEach(({ o, v }) => o.frequency.setTargetAtTime(mtof(chord[v]), t, 0.12));
        }
        if (hit('kick', s)) kick(t);
        if (hit('snare', s)) noise(t, 'bandpass', 1700, 0.8, 0.32, 0.18, true);
        if (hit('hat', s)) noise(t, 'highpass', 7500, 0.7, s % 4 === 2 ? 0.12 : 0.07, 0.05, false);
        if (cfg.bass && hit('bass', s)) {
          const root = chord[0] >= 40 ? chord[0] - 12 : chord[0];
          tone(t, root + (cfg.arp && s % 4 === 2 ? 12 : 0), 'triangle', 0.32, step * 3, 500, drumBus);
        }
        if (cfg.keys && hit('keys', s)) chord.slice(1).forEach((m, i) => tone(t + i * 0.012, m + 12, 'sine', 0.05, 1.6, 2600));
        if (cfg.stab && hit('stab', s)) chord.slice(1).forEach((m) => tone(t, m, 'sawtooth', 0.035, 0.28, 1300));
        if (cfg.arp) tone(t, chord[1 + (s % 4)] + 12, 'square', 0.028, step * 0.9, 1800);
        if (cfg.bells && t > bellAt) {
          tone(t, chord[1 + Math.floor(r() * 4)] + 24, 'sine', 0.035, 4.5, 4000);
          bellAt = t + 3 + r() * 6;
        }
        nextStep++; nextTime += step;
      }
    }
    schedule();
    const timer = setInterval(schedule, 25);

    ch.kind = 'synth';
    ch.duration = 150 + Math.floor(r() * 90); // udawana długość „utworu” w prototypie
    ch.stop = (when) => {
      stopped = true; clearInterval(timer);
      nodes.forEach((n) => { try { n.stop(when); } catch (e) { /* już zatrzymany */ } });
    };
    return Promise.resolve();
  }

  /* ---------- kanały ---------- */

  // opts.playlist – lista plików (odtwarzacz); bez niej: assets/audio/{slug}.mp3
  function play(slug, opts) {
    opts = opts || {};
    unlock();
    const p = window.AURA.bySlug[slug];
    if (current && current.slug === slug && !opts.next) {
      if (state === 'paused') resume();
      return Promise.resolve(current.track);
    }
    const list = opts.playlist || (probe[slug] === false ? null : ['assets/audio/' + slug + '.mp3']);
    const size = list ? list.length : p.titles.length;
    const idx = nextFromBag(slug + (list ? ':f' : ':s'), size);

    const ch = { slug, gain: ctx.createGain(), ramp: null, opts };
    ch.gain.gain.value = 0.0001;
    ch.gain.connect(bus);
    const old = current;
    current = ch;

    const titles = list && p.playlistTitles && opts.playlist ? p.playlistTitles : p.titles;
    ch.track = { slug, index: idx, title: titles[idx % titles.length], number: String(((idx * 37 + p.n.charCodeAt(1) * 11) % 90) + 10).padStart(3, '0') };

    const start = list
      ? fileSource(ch, list[idx]).catch(() => {
          console.warn('AURA / audio: nie udało się odtworzyć ' + list[idx] + ', przełączam na syntezator.');
          probe[slug] = false;
          return synthSource(ch, p, idx);
        })
      : synthSource(ch, p, idx);

    return start.then(() => {
      if (current !== ch) return ch.track; // w międzyczasie wybrano inny kanał
      ch.startedAt = ctx.currentTime;
      if (state === 'paused') { bus.gain.cancelScheduledValues(0); bus.gain.setTargetAtTime(1, ctx.currentTime, 0.1); }
      fade(ch, 1, opts.instant ? 0.3 : XFADE);
      if (old) retire(old);
      setState('playing');
      emit('track', ch.track);
      ensureTick();
      return ch.track;
    });
  }

  function retire(ch) {
    fade(ch, 0.0001, XFADE);
    const at = ctx.currentTime + XFADE + 0.1;
    setTimeout(() => {
      if (ch.el) { ch.el.pause(); ch.el.removeAttribute('src'); ch.el.load(); }
      if (ch.stop) ch.stop(at);
      try { ch.gain.disconnect(); } catch (e) { /* ok */ }
    }, (XFADE + 0.2) * 1000);
  }

  // Automatyczne przejście do następnego utworu (crossfade przed końcem)
  function ensureTick() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!current || state !== 'playing' || current.advancing) return;
      const pos = position();
      if (pos.duration && pos.duration - pos.time < XFADE + 0.2) {
        current.advancing = true;
        next();
      }
    }, 250);
  }

  function next() {
    if (!current) return Promise.resolve();
    return play(current.slug, Object.assign({}, current.opts, { next: true }));
  }

  function position() {
    if (!current || !ctx) return { time: 0, duration: 0 };
    if (current.kind === 'file' && current.el) {
      return { time: current.el.currentTime || 0, duration: isFinite(current.el.duration) ? current.el.duration : 0 };
    }
    return { time: Math.max(0, ctx.currentTime - (current.startedAt || ctx.currentTime)) - (current.pausedFor || 0), duration: current.duration || 0 };
  }

  function pause() {
    if (!ctx || state !== 'playing') return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(0);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + 0.35);
    setState('paused');
    const ch = current;
    ch && (ch.pausedAt = now);
    setTimeout(() => {
      if (state !== 'paused') return;
      if (ch && ch.el) ch.el.pause();
      ctx.suspend();
    }, 380);
  }

  function resume() {
    if (!ctx || !current) return;
    unlock();
    const ch = current;
    if (ch.el) ch.el.play();
    const now = ctx.currentTime;
    if (ch.pausedAt != null) { ch.pausedFor = (ch.pausedFor || 0) + (now - ch.pausedAt); ch.pausedAt = null; }
    bus.gain.cancelScheduledValues(0);
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(1, now + 0.6);
    setState('playing');
  }

  function stop() {
    if (!ctx) return;
    if (current) { retire(current); current = null; }
    setState('idle');
  }

  function setState(s) {
    if (s === state) return;
    state = s;
    emit('state', s);
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : volume * volume, ctx.currentTime, 0.05); // krzywa ~logarytmiczna
    emit('volume', { volume, muted });
  }
  function setMuted(m) {
    muted = !!m;
    setVolume(volume);
  }

  /* ---------- analiza dla wizualizacji ---------- */

  const lv = { rms: 0, low: 0, mid: 0, high: 0, kick: 0, lowAvg: 0 };
  let lvStamp = 0;
  function levels() {
    const now = performance.now();
    if (now - lvStamp < 8) return lv; // kilka wizualizacji w jednej klatce → jedno odczytanie
    lvStamp = now;
    if (!ctx || state !== 'playing') {
      lv.rms *= 0.92; lv.low *= 0.92; lv.mid *= 0.92; lv.high *= 0.92; lv.kick *= 0.85;
      return lv;
    }
    analyser.getByteFrequencyData(freqData);
    analyser.getFloatTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
    const rms = Math.min(1, Math.sqrt(sum / timeData.length) * 3.2);
    const band = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freqData[i]; return s / (b - a) / 255; };
    const low = band(1, 7), mid = band(7, 46), high = band(46, 200);
    const sm = (o, n, up, down) => o + (n - o) * (n > o ? up : down);
    lv.rms = sm(lv.rms, rms, 0.5, 0.08);
    lv.low = sm(lv.low, low, 0.6, 0.1);
    lv.mid = sm(lv.mid, mid, 0.4, 0.08);
    lv.high = sm(lv.high, high * 1.6, 0.5, 0.1);
    lv.lowAvg = lv.lowAvg * 0.96 + low * 0.04;
    const onset = low - lv.lowAvg;
    lv.kick = onset > 0.06 ? Math.min(1, onset * 5) : lv.kick * 0.86;
    return lv;
  }

  window.AuraAudio = {
    XFADE, init, unlock, play, next, pause, resume, stop, setVolume, setMuted, levels, position,
    toggle() { state === 'playing' ? pause() : current ? resume() : null; },
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    get state() { return state; },
    get slug() { return current ? current.slug : null; },
    get track() { return current ? current.track : null; },
    get volume() { return volume; },
    get muted() { return muted; },
    get probe() { return probe; },
  };
})();
