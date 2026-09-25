/* AURA · dane 7 profili (kanałów). Wspólne dla landingu i odtwarzacza.
 * [ROBOCZE] opisy nastroju, sugerowane miejsca, tempo i tytuły utworów.
 * Ikony: z aura/src/config/icons.ts (viewBox 0 0 48 48, stroke = currentColor).
 */
(function () {
  'use strict';

  // Parametry wizualizacji (js/visual.js):
  // speed – tempo ruchu, amp – wysokość fal, freq – gęstość fal, pulse – reakcja na stopę,
  // flutter – drżenie (lo-fi), asym – nieregularność krzywych, grid – siatka perspektywy, rings – pulsujące łuki
  const profiles = [
    {
      n: '01', slug: 'ambient', name: 'Ambient',
      mood: 'Szerokie plamy dźwięku bez rytmu. Spokój, który nie usypia.',
      places: 'gabinet, spa, poczekalnia',
      bpm: '50–70', tracks: '75+',
      accent: '#9FB8C8',
      icon: '<path d="M15 25a9 9 0 0 1 18 0"/><path d="M9 25h30"/><path d="M13 30h22"/><path d="M18 35h12"/>',
      visual: { speed: 0.35, amp: 0.9, freq: 0.7, pulse: 0.15, flutter: 0, asym: 0.1, grid: 0, rings: 0 },
      synth: {
        bpm: 60, wave: 'sine', cutoff: 1500, lfo: 0.05, barsPerChord: 4, bells: true,
        chords: [[48, 55, 62, 64, 71], [45, 52, 59, 60, 67], [41, 48, 57, 64, 69], [43, 50, 57, 62, 71]],
      },
      titles: ['Mgła nad wodą', 'Biały szum miasta', 'Powolne światło', 'Zatoka', 'Pierwsza godzina', 'Szkło i kamień', 'Długi oddech', 'Pusta sala'],
    },
    {
      n: '02', slug: 'lofi', name: 'Lo-fi',
      mood: 'Ciepłe, lekko przybrudzone bity. Skupienie bez rozpraszania.',
      places: 'kawiarnia, coworking, księgarnia',
      bpm: '70–90', tracks: '75+',
      accent: '#C9A27E',
      icon: '<rect x="9" y="14" width="30" height="21" rx="3"/><rect x="14.5" y="18.5" width="19" height="8" rx="2"/><circle cx="19.5" cy="22.5" r="2"/><circle cx="28.5" cy="22.5" r="2"/><path d="M15 35l2.5-4.5h13L33 35"/>',
      visual: { speed: 0.55, amp: 0.7, freq: 1.1, pulse: 0.45, flutter: 1, asym: 0.25, grid: 0, rings: 0 },
      // Odtwarzacz gra całą listę (losowo bez powtórzeń). Landing gra próbkę lofi.mp3.
      playlist: ['assets/audio/10_lofi_70bpm.mp3', 'assets/audio/26_lofi_76bpm.mp3', 'assets/audio/75_lofi_90bpm.mp3'],
      playlistTitles: ['Ranek przy oknie · 70 BPM', 'Druga kawa · 76 BPM', 'Kurz na płycie · 90 BPM'],
      synth: {
        bpm: 78, wave: 'triangle', cutoff: 1100, lfo: 0.08, barsPerChord: 1, swing: 0.14, keys: true, crackle: true, bass: true,
        chords: [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 53, 57, 60, 64], [36, 52, 55, 59, 64]],
        drums: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x......x..x.....', keys: 'x.........x.....' },
      },
      titles: ['Ranek przy oknie', 'Druga kawa', 'Kurz na płycie', 'Deszcz na Kazimierzu', 'Notatki', 'Zielona lampa', 'Tramwaj 8', 'Popołudnie'],
    },
    {
      n: '03', slug: 'hiphop', name: 'Hip hop',
      mood: 'Instrumentalny groove z charakterem. Bez słów, z energią.',
      places: 'barber, streetwear, bistro',
      bpm: '85–95', tracks: '75+',
      accent: '#D98B5F',
      icon: '<path d="M10 30c0-8.3 5.8-14 13-14 7.4 0 12 5.6 12 12.5"/><path d="M10 30h26c3.5 0 6.5 1 6.5 2.5 0 .8-.7 1.5-1.8 1.5H12c-1.2 0-2-.9-2-2.1V30z"/><path d="M23 16c-2.2 3.3-3 8-3 14"/><path d="M23 16c3 2.8 4.8 7.5 5 12.5"/>',
      visual: { speed: 0.7, amp: 0.8, freq: 1.0, pulse: 1.0, flutter: 0.2, asym: 0.3, grid: 0, rings: 0 },
      synth: {
        bpm: 88, wave: 'sawtooth', cutoff: 750, lfo: 0.1, barsPerChord: 2, swing: 0.08, bass: true, keys: true,
        chords: [[45, 55, 60, 64, 67], [38, 53, 57, 60, 65], [40, 55, 59, 62, 67], [41, 53, 57, 60, 64]],
        drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', bass: 'x.....x.x.......', keys: 'x.......' + '........' },
      },
      titles: ['Blok 7', 'Winyl z piwnicy', 'Szybki cień', 'Na rogu', 'Nocna zmiana', 'Brzytwa', 'Asfalt po deszczu', 'Kaseta 90'],
    },
    {
      n: '04', slug: 'chillout', name: 'Chillout',
      mood: 'Lekkie, płynne brzmienia, które niosą przez cały dzień.',
      places: 'hotel, restauracja, salon',
      bpm: '90–110', tracks: '75+',
      accent: '#7FC4B8',
      icon: '<path d="M9 18c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0 5 2.5 7.5 0"/><path d="M9 24.5c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0 5 2.5 7.5 0"/><path d="M9 31c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0 5 2.5 7.5 0"/>',
      visual: { speed: 0.5, amp: 1.0, freq: 0.55, pulse: 0.35, flutter: 0, asym: 0.15, grid: 0, rings: 0 },
      synth: {
        bpm: 96, wave: 'triangle', cutoff: 1900, lfo: 0.06, barsPerChord: 2, bass: true, keys: true,
        chords: [[40, 52, 56, 59, 63], [37, 49, 56, 59, 64], [45, 52, 56, 59, 61], [42, 54, 57, 61, 64]],
        drums: { kick: 'x.......x.......', hat: '..x...x...x...x.', bass: 'x.......x.....x.', keys: 'x...............' },
      },
      titles: ['Taras', 'Ciepły wiatr', 'Lobby o piątej', 'Linia brzegowa', 'Lniana koszula', 'Po sezonie', 'Słońce w szkle', 'Leżak'],
    },
    {
      n: '05', slug: 'smooth-jazz', name: 'Smooth jazz',
      mood: 'Miękkie pianino i saksofon. Elegancja przy stoliku.',
      places: 'restauracja, wine bar, butik',
      bpm: '80–110', tracks: '75+',
      accent: '#D4B26A',
      icon: '<path d="M32 8.5c-2 0-3.8 1.1-4.4 2.8"/><path d="M27.6 11.3v17.2a6.3 6.3 0 0 1-12.6 0v-2.8"/><path d="M11.5 22.2h7.4"/><path d="M12.2 22.2l2.8 3.5M18.2 22.2 15 25.7"/><circle cx="25" cy="15.5" r=".9"/><circle cx="25" cy="19.5" r=".9"/><circle cx="25" cy="23.5" r=".9"/>',
      visual: { speed: 0.45, amp: 0.85, freq: 0.9, pulse: 0.3, flutter: 0, asym: 1.0, grid: 0, rings: 0 },
      synth: {
        bpm: 92, wave: 'sine', cutoff: 2200, lfo: 0.07, barsPerChord: 1, swing: 0.2, bass: true, keys: true,
        chords: [[38, 53, 57, 60, 64], [43, 53, 59, 64, 65], [36, 52, 55, 59, 62], [45, 55, 58, 61, 64]],
        drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', bass: 'x...x...x...x...', keys: 'x.....x.....x...' },
      },
      titles: ['Stolik przy oknie', 'Czerwone wino', 'Aksamit', 'Późna kolacja', 'Mosiądz', 'Wieczór na Mokotowie', 'Druga butelka', 'Szeptem'],
    },
    {
      n: '06', slug: 'synthwave', name: 'Synthwave',
      mood: 'Analogowe syntezatory i nocne miasto. Nostalgia z pulsem.',
      places: 'bar koktajlowy, studio tatuażu, gaming',
      bpm: '95–115', tracks: '75+',
      accent: '#B58CD9',
      icon: '<path d="M14 23a10 10 0 0 1 20 0"/><path d="M15.4 19.5h17.2"/><path d="M18 16h12"/><path d="M7 23h34"/><path d="M24 23v14M19.5 23 14 37M28.5 23 34 37"/><path d="M10.5 28h27M8.5 33h31"/>',
      visual: { speed: 0.6, amp: 0.55, freq: 0.8, pulse: 0.6, flutter: 0, asym: 0.1, grid: 1, rings: 0 },
      synth: {
        bpm: 100, wave: 'sawtooth', cutoff: 1500, lfo: 0.09, barsPerChord: 2, bass: true, arp: true,
        chords: [[45, 57, 60, 64, 69], [41, 53, 57, 60, 65], [48, 55, 60, 64, 67], [43, 55, 59, 62, 67]],
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.x.x.x.x.x.x.x.' },
      },
      titles: ['Neon 1986', 'Autostrada', 'Kaseta VHS', 'Chrom', 'Ostatni pociąg', 'Zachód nad blokami', 'Kod dostępu', 'Nocny dyżur'],
    },
    {
      n: '07', slug: 'deephouse', name: 'Deephouse',
      mood: 'Równy, głęboki puls. Energia bez pośpiechu.',
      places: 'butik, salon beauty, showroom',
      bpm: '118–124', tracks: '75+',
      accent: '#6F8FE0',
      icon: '<circle cx="24" cy="24" r="14"/><ellipse cx="24" cy="24" rx="6" ry="14"/><path d="M10 24h28"/><path d="M12 17h24M12 31h24"/><path d="M24 10v28"/>',
      visual: { speed: 0.55, amp: 0.6, freq: 0.75, pulse: 0.8, flutter: 0, asym: 0.2, grid: 0, rings: 1 },
      synth: {
        bpm: 122, wave: 'sawtooth', cutoff: 950, lfo: 0.06, barsPerChord: 2, bass: true, stab: true,
        chords: [[41, 56, 60, 63, 67], [37, 53, 56, 60, 65], [39, 55, 58, 62, 65], [44, 56, 60, 63, 67]],
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '..x...x...x...x.', stab: '...x.....x..x...' },
      },
      titles: ['Showroom', 'Jedwab', 'Głęboka woda', 'Przymierzalnia', '122', 'Betonowa podłoga', 'Wieczorny drop', 'Satyna'],
    },
  ];

  const ui = {
    play: '<path d="M9 6.8v10.4L17.5 12z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9.5 7v10M14.5 7v10"/>',
    volume: '<path d="M4.5 10v4h3l4.5 3.5v-11L7.5 10z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M17.8 7.2a6.8 6.8 0 0 1 0 9.6"/>',
    mute: '<path d="M4.5 10v4h3l4.5 3.5v-11L7.5 10z"/><path d="M16 10l4 4M20 10l-4 4"/>',
    external: '<path d="M13.5 5H19v5.5"/><path d="M19 5l-8 8"/><path d="M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 13h10v7H7z"/>',
    next: '<path d="M7 6.8v10.4L14 12z" fill="currentColor" stroke="none"/><path d="M17 7v10"/>',
  };

  function icon(paths, size, view) {
    const v = view || 48;
    return '<svg class="icon" width="' + (size || 24) + '" height="' + (size || 24) + '" viewBox="0 0 ' + v + ' ' + v +
      '" fill="none" stroke="currentColor" stroke-width="' + (v === 48 ? 1.6 : 1.5) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  window.AURA = {
    profiles,
    bySlug: Object.fromEntries(profiles.map((p) => [p.slug, p])),
    ui,
    profileIcon: (p, size) => icon(p.icon, size, 48),
    uiIcon: (name, size) => icon(ui[name], size, 24),
    hexToRgb(hex) {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    },
    // Ustawia akcent profilu na <html> (CSS: --accent, przejście 1,5 s przez @property)
    applyAccent(p) {
      document.documentElement.style.setProperty('--accent', p.accent);
      document.documentElement.dataset.profile = p.slug;
    },
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
  };
})();
