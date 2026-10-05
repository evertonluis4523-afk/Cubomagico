'use strict';

// Jogos de lógica para crianças pequenas (a partir de 4–5 anos).
// Tudo é gerado na hora: não há lista fixa de perguntas, então elas não acabam.
// A criança não precisa ler: cada instrução é falada pela voz do aparelho.
(() => {
  const STORE_KEY = 'logica-progresso-v1';
  const MAX_LEVEL = 10;

  // ---------- Utilidades ----------
  const rand = (n) => Math.floor(Math.random() * n);
  const randInt = (min, max) => min + rand(max - min + 1);
  const pick = (arr) => arr[rand(arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (arr, k) => shuffle(arr).slice(0, k);
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const $ = (id) => document.getElementById(id);

  // ---------- Formas e cores ----------
  const COLORS = {
    vermelho: { hex: '#ef3b3b', m: 'vermelho', f: 'vermelha' },
    azul: { hex: '#2f7ff0', m: 'azul', f: 'azul' },
    amarelo: { hex: '#ffc61a', m: 'amarelo', f: 'amarela' },
    verde: { hex: '#22b35e', m: 'verde', f: 'verde' },
    roxo: { hex: '#9b5de5', m: 'roxo', f: 'roxa' },
    laranja: { hex: '#ff8a1f', m: 'laranja', f: 'laranja' }
  };
  const COLOR_KEYS = Object.keys(COLORS);

  const starPoints = range(10).map((i) => {
    const r = i % 2 ? 19 : 45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(53 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  // Escurece uma cor (para o contorno e a sombra das formas).
  const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f)
    .toString(16).padStart(2, '0')).join('');
  const SHAPES = {
    circulo: { name: 'círculo', fem: false, geom: '<circle cx="50" cy="50" r="40"/>' },
    quadrado: { name: 'quadrado', fem: false, geom: '<rect x="12" y="12" width="76" height="76" rx="14"/>' },
    triangulo: { name: 'triângulo', fem: false, geom: '<path d="M50 10 L91 86 L9 86 Z"/>' },
    estrela: { name: 'estrela', fem: true, geom: `<polygon points="${starPoints}"/>` },
    coracao: { name: 'coração', fem: false, geom: '<path d="M50 87 C20 65 7 47 7 31 C7 18 17 9 30 9 C39 9 46 14 50 22 C54 14 61 9 70 9 C83 9 93 18 93 31 C93 47 80 65 50 87 Z"/>' },
    losango: { name: 'losango', fem: false, geom: '<path d="M50 6 L90 50 L50 94 L10 50 Z"/>' }
  };
  const SHAPE_KEYS = Object.keys(SHAPES);

  const itemKey = (it) => `${it.shape}|${it.color}|${it.size || 1}`;
  const itemLabel = (it) => {
    const s = SHAPES[it.shape];
    const c = COLORS[it.color];
    const small = it.size && it.size < 1 ? (s.fem ? ' pequena' : ' pequeno') : '';
    return `${s.name} ${s.fem ? c.f : c.m}${small}`;
  };
  // Forma com volume: cor cheia, sombra embaixo e brilho em cima (recortados pela própria forma).
  let clipSeq = 0;
  const shapeSVG = (it) => {
    const hex = COLORS[it.color].hex;
    const geom = SHAPES[it.shape].geom;
    const id = `cl${++clipSeq}`;
    const body = `<clipPath id="${id}">${geom}</clipPath>
      <g fill="${hex}">${geom}</g>
      <g clip-path="url(#${id})">
        <ellipse cx="50" cy="100" rx="60" ry="30" fill="#000" opacity=".14"/>
        <ellipse cx="34" cy="22" rx="30" ry="16" fill="#fff" opacity=".42"/>
      </g>
      <g fill="none" stroke="${shade(hex, 0.72)}" stroke-width="5" stroke-linejoin="round">${geom}</g>`;
    const s = it.size || 1;
    const g = s === 1 ? body : `<g transform="translate(50 50) scale(${s}) translate(-50 -50)">${body}</g>`;
    return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${g}</svg>`;
  };

  // Mascote: um cubinho mágico com rosto. As classes is-happy / is-oops trocam a boca.
  // Frente amarela (uma face resolvida) para o rosto ficar legível.
  const mascotSVG = () => `<svg class="mascot-svg" viewBox="0 14 120 110" aria-hidden="true">
    <ellipse class="m-shadow" cx="60" cy="119" rx="36" ry="5" fill="#000" opacity=".16"/>
    <g class="m-body">
      <rect x="30" y="106" width="16" height="10" rx="5" fill="#241b36"/>
      <rect x="74" y="106" width="16" height="10" rx="5" fill="#241b36"/>
      <rect x="8" y="20" width="104" height="90" rx="22" fill="#241b36"/>
      ${range(9).map((i) => `<rect x="${15 + (i % 3) * 31}" y="${27 + Math.floor(i / 3) * 27}" width="28" height="24" rx="8" fill="#ffc61a"/>`).join('')}
      <rect x="15" y="27" width="90" height="8" rx="4" fill="#fff" opacity=".35"/>
      <g class="m-eyes">
        <ellipse cx="41" cy="60" rx="13" ry="14" fill="#fff" stroke="#241b36" stroke-width="3.5"/>
        <ellipse cx="79" cy="60" rx="13" ry="14" fill="#fff" stroke="#241b36" stroke-width="3.5"/>
        <circle cx="43" cy="63" r="7" fill="#241b36"/><circle cx="81" cy="63" r="7" fill="#241b36"/>
        <circle cx="46" cy="59" r="2.6" fill="#fff"/><circle cx="84" cy="59" r="2.6" fill="#fff"/>
      </g>
      <ellipse cx="24" cy="82" rx="7" ry="4.5" fill="#ff6f91" opacity=".75"/>
      <ellipse cx="96" cy="82" rx="7" ry="4.5" fill="#ff6f91" opacity=".75"/>
      <g class="m-smile">
        <path d="M46 82 Q60 100 74 82 Z" fill="#8a1f3a" stroke="#241b36" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M52 90 Q60 96 68 90 Q60 86 52 90 Z" fill="#ff7a9a"/>
      </g>
      <path class="m-oops" d="M49 91 Q60 82 71 91" fill="none" stroke="#241b36" stroke-width="4.5" stroke-linecap="round"/>
    </g>
  </svg>`;

  const randomItem = () => ({ shape: pick(SHAPE_KEYS), color: pick(COLOR_KEYS) });

  // Objetos para contar (com plural e gênero para a frase falada).
  const OBJECTS = [
    { e: '🍎', p: 'maçãs', f: true }, { e: '🐶', p: 'cachorrinhos' }, { e: '🐱', p: 'gatinhos' },
    { e: '⭐', p: 'estrelas', f: true }, { e: '🐟', p: 'peixinhos' }, { e: '🚗', p: 'carrinhos' },
    { e: '🎈', p: 'balões' }, { e: '🐞', p: 'joaninhas', f: true }, { e: '🌸', p: 'flores', f: true },
    { e: '🍌', p: 'bananas', f: true }, { e: '🦆', p: 'patinhos' }, { e: '🐸', p: 'sapinhos' }
  ];
  const emojiGroup = (e, n, cls = '') => `<div class="emoji-group ${cls} n${Math.min(n, 10)}">${`<span>${e}</span>`.repeat(n)}</div>`;

  // ---------- Jogos ----------
  // Cada make(level) devolve uma pergunta:
  //   { prompt, stage, options: [{ html, label, correct }], layout, onCorrect }
  // ou, para perguntas com vários passos, { prompt, setup(ctx) }.

  const GAMES = {
    sequencia: {
      theme: ['#9b6bff', '#6d3fe0'],
      title: 'O que vem depois?',
      icon: () => [{ shape: 'circulo', color: 'vermelho' }, { shape: 'quadrado', color: 'azul' }, { shape: 'circulo', color: 'vermelho' }]
        .map(shapeSVG).join('') + '<span class="q-mark">?</span>',
      rounds: 5,
      make(level) {
        const PATTERNS = [
          ['AB'], ['AB'], ['AB', 'AAB'], ['AAB', 'ABB'], ['ABC', 'AAB'],
          ['ABC', 'ABB'], ['AABB', 'ABC'], ['AABB', 'ABC', 'ABCC'], ['ABCC', 'AABB', 'ABAC'], ['ABAC', 'ABCD', 'AABB']
        ];
        const pattern = pick(PATTERNS[level - 1]);
        const letters = [...new Set(pattern)];
        const n = letters.length;
        // Fácil: muda forma e cor. Difícil: muda só a cor ou só a forma.
        const mode = level <= 3 ? 'both' : pick(level <= 6 ? ['both', 'color', 'shape'] : ['color', 'shape']);
        let units;
        if (mode === 'color') {
          const s = pick(SHAPE_KEYS);
          units = sample(COLOR_KEYS, n).map((c) => ({ shape: s, color: c }));
        } else if (mode === 'shape') {
          const c = pick(COLOR_KEYS);
          units = sample(SHAPE_KEYS, n).map((s) => ({ shape: s, color: c }));
        } else {
          const colors = sample(COLOR_KEYS, n);
          units = sample(SHAPE_KEYS, n).map((s, i) => ({ shape: s, color: colors[i] }));
        }
        const unitOf = Object.fromEntries(letters.map((l, i) => [l, units[i]]));
        const L = pattern.length;
        const total = Math.min(7, L * 2 + rand(L));
        const seq = range(total).map((i) => unitOf[pattern[i % L]]);
        const answer = unitOf[pattern[total % L]];

        const want = Math.max(level <= 4 ? 3 : 4, n);
        const opts = units.slice();
        const used = new Set(opts.map(itemKey));
        while (opts.length < want) {
          let extra;
          if (mode === 'color') extra = { shape: units[0].shape, color: pick(COLOR_KEYS) };
          else if (mode === 'shape') extra = { shape: pick(SHAPE_KEYS), color: units[0].color };
          else extra = randomItem();
          if (!used.has(itemKey(extra))) { used.add(itemKey(extra)); opts.push(extra); }
        }
        return {
          prompt: 'O que vem depois?',
          stage: `<div class="seq board" style="--n:${total + 1}">${seq.map((it) => `<div class="seq-cell">${shapeSVG(it)}</div>`).join('')}<div class="seq-cell is-slot" id="slot">?</div></div>`,
          options: shuffle(opts).map((it) => ({ html: shapeSVG(it), label: itemLabel(it), correct: itemKey(it) === itemKey(answer) })),
          onCorrect(stage) {
            const slot = stage.querySelector('#slot');
            slot.classList.add('is-filled');
            slot.innerHTML = shapeSVG(answer);
          }
        };
      }
    },

    contar: {
      theme: ['#ff9a3d', '#ec5f12'],
      title: 'Vamos contar',
      icon: () => '<span class="icon-emoji">🍎🍎🍎</span><span class="icon-num">3</span>',
      rounds: 5,
      make(level) {
        const maxN = [3, 4, 5, 6, 7, 8, 9, 10, 10, 10][level - 1];
        const minN = level >= 8 ? 5 : 1;
        const n = randInt(minN, maxN);
        const obj = pick(OBJECTS);
        const others = shuffle([n - 1, n + 1].filter((x) => x >= 1))
          .concat(shuffle([n - 2, n + 2].filter((x) => x >= 1)));
        const nums = shuffle([n, others[0], others[1]]);
        return {
          prompt: `Quant${obj.f ? 'as' : 'os'} ${obj.p} tem aqui?`,
          stage: emojiGroup(obj.e, n, 'count board'),
          options: nums.map((x) => ({ html: `<span class="num">${x}</span>`, label: String(x), correct: x === n }))
        };
      }
    },

    diferente: {
      theme: ['#25c4b0', '#0e8a7b'],
      title: 'Qual é diferente?',
      icon: () => ['azul', 'azul', 'vermelho', 'azul'].map((c) => shapeSVG({ shape: 'circulo', color: c })).join(''),
      rounds: 5,
      make(level) {
        const KINDS = [['color'], ['color'], ['color', 'shape'], ['color', 'shape'], ['shape'],
          ['shape'], ['shape', 'size'], ['shape', 'size'], ['size', 'shape'], ['size', 'shape']];
        const kind = pick(KINDS[level - 1]);
        const count = level <= 6 ? 4 : 6;
        const base = { ...randomItem(), size: 1 };
        let odd;
        if (kind === 'color') odd = { ...base, color: pick(COLOR_KEYS.filter((c) => c !== base.color)) };
        else if (kind === 'shape') odd = { ...base, shape: pick(SHAPE_KEYS.filter((s) => s !== base.shape)) };
        else odd = { ...base, size: 0.6 };
        const oddAt = rand(count);
        const items = range(count).map((i) => (i === oddAt ? odd : base));
        return {
          prompt: 'Qual é diferente?',
          layout: count === 6 ? 'grid-3' : 'grid-2',
          options: items.map((it, i) => ({ html: shapeSVG(it), label: itemLabel(it), correct: i === oddAt }))
        };
      }
    },

    igual: {
      theme: ['#ff6fa3', '#d93a78'],
      title: 'Ache o igual',
      icon: () => shapeSVG({ shape: 'estrela', color: 'amarelo' }) + '<span class="icon-eq">=</span>' + shapeSVG({ shape: 'estrela', color: 'amarelo' }),
      rounds: 5,
      make(level) {
        const model = { ...randomItem(), size: 1 };
        const want = level <= 3 ? 3 : 4;
        const used = new Set([itemKey(model)]);
        const opts = [model];
        let guard = 0;
        while (opts.length < want && guard++ < 200) {
          let d;
          if (level <= 3) d = { ...randomItem(), size: 1 };
          else {
            const ways = level <= 6 ? ['color', 'shape'] : ['color', 'shape', 'size'];
            const w = pick(ways);
            if (w === 'color') d = { ...model, color: pick(COLOR_KEYS) };
            else if (w === 'shape') d = { ...model, shape: pick(SHAPE_KEYS) };
            else d = { ...model, size: 0.6 };
          }
          // No nível fácil o distrator não pode dividir forma nem cor com o modelo.
          if (level <= 3 && (d.shape === model.shape || d.color === model.color)) continue;
          if (!used.has(itemKey(d))) { used.add(itemKey(d)); opts.push(d); }
        }
        return {
          prompt: 'Toque no que é igual a este.',
          stage: `<div class="model board">${shapeSVG(model)}</div>`,
          layout: opts.length === 4 ? 'grid-2' : '',
          options: shuffle(opts).map((it) => ({ html: shapeSVG(it), label: itemLabel(it), correct: itemKey(it) === itemKey(model) }))
        };
      }
    },

    mais: {
      theme: ['#5fd36f', '#2f9a45'],
      title: 'Onde tem mais?',
      icon: () => '<span class="icon-emoji small">🐟</span><span class="icon-vs">|</span><span class="icon-emoji small">🐟🐟🐟</span>',
      rounds: 5,
      make(level) {
        const diff = level <= 2 ? randInt(3, 5) : level <= 4 ? randInt(2, 3) : level <= 7 ? 2 : 1;
        const cap = level <= 3 ? 7 : 10;
        const small = randInt(1, cap - diff);
        const big = small + diff;
        const askLess = level >= 5 && Math.random() < 0.4;
        const bigLeft = Math.random() < 0.5;
        const o1 = pick(OBJECTS);
        // Mais difícil: cada lado com um objeto diferente.
        const o2 = level >= 7 ? pick(OBJECTS.filter((o) => o !== o1)) : o1;
        const sides = bigLeft ? [[big, o1], [small, o2]] : [[small, o1], [big, o2]];
        return {
          prompt: askLess ? 'Onde tem menos?' : 'Onde tem mais?',
          layout: 'groups',
          options: sides.map(([n, o]) => ({
            html: emojiGroup(o.e, n),
            label: `${n} ${o.p}`,
            correct: askLess ? n === small : n === big
          }))
        };
      }
    },

    quadrado: {
      theme: ['#4fb0ff', '#1f74d6'],
      title: 'Quadrado mágico',
      icon: () => '<span class="mini-grid">' + ['vermelho', 'azul', 'amarelo', 'azul', 'amarelo', 'vermelho', 'amarelo', 'vermelho', null]
        .map((c) => (c ? `<i style="background:${COLORS[c].hex}"></i>` : '<i class="empty">?</i>')).join('') + '</span>',
      rounds: 4,
      make(level) {
        const n = level <= 8 ? 3 : 4;
        const blanks = level <= 3 ? 1 : level <= 6 ? 2 : n === 3 ? 3 : 2 + (level - 9);
        const SYMBOLS = [
          { shape: 'circulo', color: 'vermelho' }, { shape: 'quadrado', color: 'azul' },
          { shape: 'triangulo', color: 'amarelo' }, { shape: 'estrela', color: 'verde' }
        ].slice(0, n);
        const rows = shuffle(range(n));
        const cols = shuffle(range(n));
        const sym = shuffle(range(n));
        const grid = range(n).map((r) => range(n).map((c) => sym[(rows[r] + cols[c]) % n]));
        // Linhas e colunas diferentes para cada vazio: sempre dá para deduzir pela fileira.
        // Prefere vazios com símbolos diferentes (senão a resposta vira sempre a mesma).
        let holes;
        for (let tries = 0; tries < 30; tries++) {
          const blankCols = sample(range(n), blanks);
          holes = sample(range(n), blanks).map((r, i) => ({ r, c: blankCols[i] })).sort((a, b) => a.r - b.r);
          if (new Set(holes.map((h) => grid[h.r][h.c])).size === blanks) break;
        }

        return {
          prompt: 'Em cada fileira tem um de cada. Qual está faltando?',
          setup(ctx) {
            let step = 0;
            const isHole = (r, c) => holes.findIndex((h) => h.r === r && h.c === c);
            ctx.stage.innerHTML = `<div class="magic n${n}">${range(n).map((r) => range(n).map((c) => {
              const h = isHole(r, c);
              return h >= 0
                ? `<div class="magic-cell is-hole" data-hole="${h}">?</div>`
                : `<div class="magic-cell">${shapeSVG(SYMBOLS[grid[r][c]])}</div>`;
            }).join('')).join('')}</div>`;
            const holeEls = [...ctx.stage.querySelectorAll('[data-hole]')]
              .sort((a, b) => a.dataset.hole - b.dataset.hole);
            const mark = () => {
              holeEls.forEach((el, i) => el.classList.toggle('is-current', i === step));
              const h = holes[step];
              ctx.stage.querySelectorAll('.magic-cell').forEach((el, i) => {
                el.classList.toggle('is-row', Math.floor(i / n) === h.r);
              });
            };
            mark();
            ctx.options.className = 'options';
            SYMBOLS.forEach((s, idx) => {
              const btn = ctx.button(shapeSVG(s), itemLabel(s));
              btn.addEventListener('click', () => {
                if (ctx.locked()) return;
                const h = holes[step];
                if (grid[h.r][h.c] !== idx) { ctx.wrong(btn, false); return; }
                const el = holeEls[step];
                el.classList.remove('is-current');
                el.classList.add('is-filled');
                el.innerHTML = shapeSVG(s);
                step++;
                if (step >= holes.length) {
                  ctx.stage.querySelectorAll('.is-row').forEach((x) => x.classList.remove('is-row'));
                  ctx.right(btn);
                } else {
                  sfx('tick');
                  mark();
                }
              });
            });
          }
        };
      }
    }
  };

  // ---------- Progresso ----------
  const defaults = () => ({ stars: 0, sound: true, games: {} });
  let state;
  try {
    state = { ...defaults(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    state = defaults();
  }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* sem armazenamento */ } };
  const levelOf = (id) => (state.games[id] && state.games[id].level) || 1;

  // ---------- Voz e sons ----------
  let voice = null;
  const pickVoice = () => {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /^pt[-_]BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang)) || null;
  };
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }
  function say(text) {
    if (!state.sound || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 0.92;
    u.pitch = 1.1;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  let audio = null;
  function tone(freq, start, dur, type = 'sine', vol = 0.18) {
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function sfx(kind) {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      if (kind === 'right') { tone(523, 0, 0.18); tone(659, 0.1, 0.18); tone(784, 0.2, 0.3); }
      else if (kind === 'wrong') { tone(220, 0, 0.25, 'triangle', 0.14); }
      else if (kind === 'tick') { tone(660, 0, 0.12); }
      else if (kind === 'win') { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25)); }
    } catch { /* sem áudio */ }
  }

  const PRAISE = ['Muito bem!', 'Isso!', 'Acertou!', 'Que legal!', 'Parabéns!', 'Mandou bem!'];
  const TRY_AGAIN = ['Ops! Tenta de novo.', 'Quase! Tenta outro.', 'Hum, não é esse. Tenta de novo.'];

  // ---------- Telas ----------
  const screens = { home: $('screen-home'), play: $('screen-play'), end: $('screen-end') };
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => { el.hidden = k !== name; });
    window.scrollTo(0, 0);
  }

  function renderHome() {
    $('star-total').textContent = state.stars;
    $('sound-toggle').textContent = state.sound ? '🔊' : '🔇';
    $('sound-toggle').setAttribute('aria-pressed', String(state.sound));
    $('sound-toggle').setAttribute('aria-label', state.sound ? 'Som ligado' : 'Som desligado');
    $('game-grid').innerHTML = Object.entries(GAMES).map(([id, g]) => {
      const lv = levelOf(id);
      return `<button class="game-card" type="button" data-game="${id}" style="--c1:${g.theme[0]};--c2:${g.theme[1]}">
        <span class="game-icon" aria-hidden="true">${g.icon()}</span>
        <span class="game-name">${g.title}</span>
        <span class="game-level">Nível ${lv}</span>
      </button>`;
    }).join('');
  }

  // ---------- Rodada ----------
  let cur = null;
  let nextTimer = 0;

  function startGame(id) {
    clearTimeout(nextTimer);
    cur = { id, game: GAMES[id], level: levelOf(id), index: 0, mistakes: 0, lastPrompt: null, q: null, locked: false };
    for (const el of [screens.play, screens.end]) {
      el.style.setProperty('--c1', cur.game.theme[0]);
      el.style.setProperty('--c2', cur.game.theme[1]);
    }
    show('play');
    renderDots();
    nextQuestion();
  }

  function renderDots() {
    $('dots').innerHTML = range(cur.game.rounds)
      .map((i) => `<i class="${i < cur.index ? 'done' : i === cur.index ? 'now' : ''}"></i>`).join('');
  }

  // Reação do mascote: pula quando acerta, balança quando erra.
  let mascotTimer = 0;
  function react(kind) {
    const m = $('mascot');
    clearTimeout(mascotTimer);
    m.classList.remove('is-happy', 'is-oops');
    void m.offsetWidth;
    m.classList.add(kind === 'right' ? 'is-happy' : 'is-oops');
    mascotTimer = setTimeout(() => m.classList.remove('is-happy', 'is-oops'), 1100);
  }

  function nextQuestion() {
    if (cur.index >= cur.game.rounds) { finish(); return; }
    renderDots();
    const q = cur.game.make(cur.level);
    cur.q = q;
    cur.locked = false;
    const stage = $('stage');
    const options = $('options');
    $('prompt').textContent = q.prompt;
    stage.classList.toggle('is-empty', !q.stage && !q.setup);
    stage.innerHTML = q.stage || '';
    options.innerHTML = '';
    options.className = `options ${q.layout || ''}`;
    if (q.prompt !== cur.lastPrompt) say(q.prompt);
    cur.lastPrompt = q.prompt;

    const ctx = {
      stage,
      options,
      locked: () => cur.locked,
      button(html, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option';
        btn.innerHTML = html;
        btn.setAttribute('aria-label', label);
        options.appendChild(btn);
        return btn;
      },
      right(btn) { questionDone(btn); },
      // disable=false mantém o botão (no quadrado mágico o mesmo símbolo serve para outro vazio).
      wrong(btn, disable = true) {
        cur.mistakes++;
        sfx('wrong');
        react('wrong');
        say(pick(TRY_AGAIN));
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        if (disable) { btn.classList.add('is-wrong'); btn.disabled = true; }
      }
    };

    if (q.setup) { q.setup(ctx); return; }
    q.options.forEach((o) => {
      const btn = ctx.button(o.html, o.label);
      btn.addEventListener('click', () => {
        if (cur.locked) return;
        if (o.correct) {
          q.onCorrect?.(stage);
          questionDone(btn);
        } else {
          ctx.wrong(btn);
        }
      });
    });
  }

  function questionDone(btn) {
    cur.locked = true;
    btn.classList.add('is-right');
    sfx('right');
    react('right');
    say(pick(PRAISE));
    cur.index++;
    renderDots();
    nextTimer = setTimeout(nextQuestion, 1400);
  }

  function finish() {
    const stars = cur.mistakes === 0 ? 3 : cur.mistakes <= 2 ? 2 : 1;
    const before = cur.level;
    const g = state.games[cur.id] || (state.games[cur.id] = { level: 1 });
    if (stars >= 2) g.level = Math.min(MAX_LEVEL, g.level + 1);
    state.stars += stars;
    save();

    $('end-title').textContent = stars === 3 ? 'Perfeito!' : stars === 2 ? 'Muito bem!' : 'Você conseguiu!';
    $('end-stars').innerHTML = range(3).map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.25}s">${shapeSVG({ shape: 'estrela', color: 'amarelo' })}</span>`).join('');
    $('end-stars').setAttribute('aria-label', `${stars} de 3 estrelas`);
    $('end-level').textContent = g.level > before ? `Subiu para o nível ${g.level}!` : before === MAX_LEVEL ? 'Nível máximo!' : `Nível ${g.level}`;
    show('end');
    sfx('win');
    say(`${$('end-title').textContent} Você ganhou ${stars} ${stars === 1 ? 'estrela' : 'estrelas'}!`);
    confetti();
  }

  function confetti() {
    const box = $('confetti');
    const colors = Object.values(COLORS).map((c) => c.hex);
    box.innerHTML = range(40).map(() => `<i style="left:${rand(100)}%;background:${pick(colors)};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s;transform:rotate(${rand(360)}deg)"></i>`).join('');
  }

  // ---------- Navegação ----------
  // O botão "voltar" do celular sai do jogo para a tela inicial, sem fechar o app.
  function goHome() {
    clearTimeout(nextTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    cur = null;
    renderHome();
    show('home');
  }
  function leaveGame() {
    if (history.state && history.state.jogo) history.back();
    else goHome();
  }
  window.addEventListener('popstate', () => { if (!history.state || !history.state.jogo) goHome(); });

  $('game-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-game]');
    if (!card) return;
    history.pushState({ jogo: card.dataset.game }, '');
    startGame(card.dataset.game);
  });
  $('go-home').addEventListener('click', leaveGame);
  $('end-home').addEventListener('click', leaveGame);
  $('play-again').addEventListener('click', () => startGame(cur.id));
  $('repeat-prompt').addEventListener('click', () => { if (cur && cur.q) say(cur.q.prompt); });
  $('mascot').addEventListener('click', () => { if (cur && cur.q) say(cur.q.prompt); });
  $('sound-toggle').addEventListener('click', () => {
    state.sound = !state.sound;
    if (!state.sound && 'speechSynthesis' in window) speechSynthesis.cancel();
    save();
    renderHome();
    if (state.sound) say('Som ligado');
  });
  $('reset-progress').addEventListener('click', () => {
    if (!confirm('Apagar as estrelas e voltar todos os jogos para o nível 1?')) return;
    state = { ...defaults(), sound: state.sound };
    save();
    renderHome();
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  }

  for (const el of document.querySelectorAll('.mascot-slot')) el.innerHTML = mascotSVG();

  // Abrir direto num jogo (ex.: recarregar a página no meio) volta para o início.
  if (history.state && history.state.jogo) history.replaceState(null, '');
  renderHome();
  show('home');
})();
