(function () {
  'use strict';

  const COLORS = {
    U: { name: 'Amarelo', short: 'A', hex: '#ffd500' },
    R: { name: 'Vermelho', short: 'V', hex: '#ed1c24' },
    F: { name: 'Azul', short: 'Az', hex: '#006fe6' },
    D: { name: 'Branco', short: 'B', hex: '#f2f2ef' },
    L: { name: 'Laranja', short: 'L', hex: '#ff6a00' },
    B: { name: 'Verde', short: 'Vd', hex: '#00b94f' }
  };

  const SERIAL_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  const NET_FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'];
  const FACE_META = {
    U: { label: 'Cima', center: 'amarelo' },
    R: { label: 'Direita', center: 'vermelho' },
    F: { label: 'Frente', center: 'azul' },
    D: { label: 'Base', center: 'branco' },
    L: { label: 'Esquerda', center: 'laranja' },
    B: { label: 'Trás', center: 'verde' }
  };

  const PHOTO_FACE_ORDER = ['F', 'R', 'B', 'L', 'U', 'D'];
  const PHOTO_FACE_META = {
    F: { title: 'Face frontal', top: 'U' },
    R: { title: 'Face direita', top: 'U' },
    B: { title: 'Face traseira', top: 'U' },
    L: { title: 'Face esquerda', top: 'U' },
    U: { title: 'Face superior', top: 'B' },
    D: { title: 'Face inferior', top: 'F' }
  };

  const POSITION_NAMES = [
    'superior esquerda', 'superior central', 'superior direita',
    'central esquerda', 'centro', 'central direita',
    'inferior esquerda', 'inferior central', 'inferior direita'
  ];

  const EXAMPLE_SCRAMBLE = "R U2 F' L2 D B' R2 U F2 D' L B2 U' R F' D2";

  const elements = {};
  const state = {
    faces: createBlankFaces(),
    selectedColor: 'U',
    solverReady: false,
    solverMode: null,
    solverInitStarted: false,
    solution: [],
    solutionString: '',
    solutionIndex: 0,
    inputString: '',
    playing: false,
    busy: false,
    tutorialBusy: false,
    activeTab: 'resolver',
    // Cores medidas nas fotos (Lab) por quadrado: ajudam a escolher a correção mais provável.
    photo: null,
    fixChoice: 0
  };

  const photoState = {
    step: 0,
    captures: {},
    stream: null,
    sourceCanvas: null,
    previewSamples: null,
    result: null
  };

  let mainCube = null;
  let tutorialCube = null;
  let resolveSolverReady;
  const solverReadyPromise = new Promise((resolve) => {
    resolveSolverReady = resolve;
  });

  function createBlankFaces() {
    const faces = {};
    SERIAL_FACE_ORDER.forEach((face) => {
      faces[face] = Array(9).fill(null);
      faces[face][4] = face;
    });
    return faces;
  }

  function cacheElements() {
    [
      'solver-readiness', 'color-palette', 'color-counts', 'face-net',
      'clear-cube', 'solved-cube', 'example-cube', 'reset-camera',
      'webgl-fallback', 'validation-card', 'validation-title',
      'validation-message', 'solve-button', 'playback', 'move-counter',
      'move-code', 'move-instruction', 'solution-progress',
      'cube-move-hud', 'cube-move-code', 'cube-move-counter',
      'cube-move-direction', 'cube-move-arrow', 'cube-move-degrees',
      'solution-progress-bar', 'restart-solution', 'previous-move',
      'play-solution', 'next-move', 'finish-solution', 'animation-speed',
      'move-sequence', 'tutorial-reset', 'tutorial-demo-move',
      'fix-card', 'fix-title', 'fix-text', 'fix-changes', 'fix-apply', 'fix-next', 'fix-retake',
      'open-help', 'help-dialog', 'toast-region', 'open-photo-reader',
      'photo-dialog', 'photo-close', 'photo-capture-view', 'photo-progress',
      'photo-progress-bar', 'photo-face-name', 'photo-instruction', 'photo-input',
      'photo-center-dot', 'photo-center-label', 'photo-top-square', 'photo-top-label',
      'photo-take', 'photo-camera-stage', 'photo-video', 'photo-canvas',
      'photo-camera-placeholder', 'photo-camera-message', 'photo-detected-grid',
      'photo-face-rail', 'photo-back', 'photo-scan', 'photo-manual',
      'photo-corner-help', 'photo-confirm-actions', 'photo-retake',
      'photo-confirm-face', 'photo-review-view',
      'photo-review-summary', 'photo-review-grid', 'photo-restart', 'photo-apply'
    ].forEach((id) => {
      elements[toCamelCase(id)] = document.getElementById(id);
    });
  }

  function toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function init() {
    const savedSession = readSession();
    cacheElements();
    renderPalette();
    renderFaceNet();
    updateEditor();
    bindEvents();
    initMainCube();
    initSolver();
    registerWebMCPTools();
    restoreSession(savedSession).catch(() => {});

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    const hash = window.location.hash;
    if (hash.startsWith('#passo-') || hash === '#tutorial') {
      switchTab('tutorial', false);
    }
  }

  function initMainCube() {
    const stage = document.getElementById('cube-stage');
    mainCube = new Cube3D(stage);
    if (!mainCube.available) {
      elements.webglFallback.hidden = false;
      return;
    }

    // Mantém o cubo fora da área coberta pelo painel do movimento atual.
    if ('ResizeObserver' in window) {
      const hud = elements.cubeMoveHud;
      const syncInset = () => mainCube.setBottomInset(hud.hidden ? 0 : hud.offsetHeight + 12);
      new ResizeObserver(syncInset).observe(hud);
    }
  }

  function initTutorialCube() {
    if (tutorialCube) {
      tutorialCube.resize();
      return;
    }
    tutorialCube = new Cube3D(document.getElementById('tutorial-stage'), { compact: true });
  }

  function renderPalette() {
    elements.colorPalette.replaceChildren();
    SERIAL_FACE_ORDER.forEach((color) => {
      const button = document.createElement('button');
      button.className = 'color-swatch';
      button.type = 'button';
      button.dataset.color = color;
      button.style.setProperty('--swatch', COLORS[color].hex);
      button.setAttribute('aria-label', 'Selecionar ' + COLORS[color].name);
      button.setAttribute('aria-pressed', String(state.selectedColor === color));
      button.title = COLORS[color].name;
      elements.colorPalette.appendChild(button);
    });

    const eraser = document.createElement('button');
    eraser.className = 'color-swatch';
    eraser.type = 'button';
    eraser.dataset.color = 'X';
    eraser.setAttribute('aria-label', 'Apagar cor');
    eraser.setAttribute('aria-pressed', 'false');
    eraser.title = 'Apagar';
    elements.colorPalette.appendChild(eraser);
    updatePaletteSelection();
  }

  function updatePaletteSelection() {
    elements.colorPalette.querySelectorAll('.color-swatch').forEach((button) => {
      const selected = button.dataset.color === state.selectedColor;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderFaceNet() {
    elements.faceNet.replaceChildren();
    NET_FACE_ORDER.forEach((face) => {
      const card = document.createElement('section');
      card.className = 'face-card';
      card.dataset.face = face;
      card.setAttribute('aria-label', 'Face ' + FACE_META[face].label);

      const label = document.createElement('div');
      label.className = 'face-label';
      label.innerHTML = '<b>' + face + '</b><span>' + FACE_META[face].label + '</span>';

      const grid = document.createElement('div');
      grid.className = 'face-grid';
      grid.dataset.faceGrid = face;

      for (let index = 0; index < 9; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sticker-button';
        button.dataset.face = face;
        button.dataset.index = String(index);
        if (index === 4) {
          button.disabled = true;
          button.classList.add('is-center');
        }
        grid.appendChild(button);
      }

      card.append(label, grid);
      elements.faceNet.appendChild(card);
    });
  }

  function updateFaceNet() {
    elements.faceNet.querySelectorAll('.sticker-button').forEach((button) => {
      const face = button.dataset.face;
      const index = Number(button.dataset.index);
      const color = state.faces[face][index];
      button.style.setProperty('--sticker', color ? COLORS[color].hex : 'var(--cube-empty)');
      button.setAttribute(
        'aria-label',
        'Face ' + FACE_META[face].label + ', posição ' + POSITION_NAMES[index] + ', ' +
        (color ? COLORS[color].name : 'vazia')
      );
    });
  }

  function getColorCounts() {
    const counts = Object.fromEntries(SERIAL_FACE_ORDER.map((color) => [color, 0]));
    SERIAL_FACE_ORDER.forEach((face) => {
      state.faces[face].forEach((color) => {
        if (color && counts[color] !== undefined) counts[color] += 1;
      });
    });
    return counts;
  }

  function updateColorCounts() {
    const counts = getColorCounts();
    elements.colorCounts.replaceChildren();
    SERIAL_FACE_ORDER.forEach((color) => {
      const item = document.createElement('span');
      item.className = 'color-count';
      item.style.setProperty('--swatch', COLORS[color].hex);
      item.textContent = counts[color] + '/9';
      item.title = COLORS[color].name + ': ' + counts[color] + ' de 9';
      item.classList.toggle('is-complete', counts[color] === 9);
      item.classList.toggle('is-over', counts[color] > 9);
      elements.colorCounts.appendChild(item);
    });
  }

  function updateEditor() {
    updateFaceNet();
    updateColorCounts();
    updateValidation();
    updateDiagnosis();
    saveSession();
  }

  // Guarda as cores e o ponto da solução para continuar depois de fechar a aba.
  const SESSION_KEY = 'cubo-sessao';

  function saveSession() {
    if (state.restoring) return;
    const data = {
      v: 1,
      faces: serializeFaces(),
      solution: state.solutionString,
      index: state.solutionIndex,
      input: state.inputString
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (error) {}
  }

  function readSession() {
    try {
      const data = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!data || data.v !== 1 || !/^[URFDLB?]{54}$/.test(data.faces)) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  async function restoreSession(data) {
    if (!data) return;
    state.restoring = true;
    try {
      SERIAL_FACE_ORDER.forEach((face, faceIndex) => {
        state.faces[face] = data.faces.slice(faceIndex * 9, faceIndex * 9 + 9).split('').map((color) => color === '?' ? null : color);
      });
      updateEditor();

      const solution = typeof data.solution === 'string' ? data.solution.trim() : '';
      if (!solution || data.input !== serializeFaces() || !validateCube().valid) return;

      const moves = window.Cube3DMoves.parseAlgorithm(solution);
      const index = Math.max(0, Math.min(moves.length, Number(data.index) || 0));
      state.solutionString = solution;
      state.solution = moves;
      state.inputString = data.input;
      state.solutionIndex = index;
      if (mainCube && mainCube.available) {
        await mainCube.loadFromSolution(solution);
        await mainCube.applyAlgorithm(moves.slice(0, index).join(' '), { duration: 0 });
        mainCube.setAnimationDuration(Number(elements.animationSpeed.value));
      }
      renderSolution({ scroll: false });
      elements.solveButton.textContent = 'Recalcular solução';
      setValidationState('Solução encontrada', moves.length + ' movimentos. Use os controles abaixo.', 'valid');
      if (index > 0 && index < moves.length) {
        showToast('Continuando de onde parou: movimento ' + (index + 1) + ' de ' + moves.length + '.');
      }
    } finally {
      state.restoring = false;
      updateValidationButtonOnly();
      saveSession();
    }
  }

  function serializeFaces() {
    return SERIAL_FACE_ORDER.map((face) => state.faces[face].map((color) => color || '?').join('')).join('');
  }

  function setFacesFromString(facelets) {
    if (!/^[URFDLB]{54}$/.test(facelets)) {
      throw new Error('O estado precisa ter 54 letras usando U, R, F, D, L e B.');
    }
    SERIAL_FACE_ORDER.forEach((face, faceIndex) => {
      state.faces[face] = facelets.slice(faceIndex * 9, faceIndex * 9 + 9).split('');
    });
    state.photo = null;
    clearSolution({ resetVisual: true, silent: true });
    updateEditor();
  }

  function permutationParity(values) {
    let parity = 0;
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        if (values[left] > values[right]) parity ^= 1;
      }
    }
    return parity;
  }

  function isUniqueRange(values, size) {
    return values.length === size &&
      values.every((value) => Number.isInteger(value) && value >= 0 && value < size) &&
      new Set(values).size === size;
  }

  function validateCube() {
    const wrongCenter = SERIAL_FACE_ORDER.find((face) => state.faces[face][4] !== face);
    if (wrongCenter) {
      return invalidResult('Os seis centros precisam permanecer nas faces indicadas.');
    }

    const counts = getColorCounts();
    const totalFilled = Object.values(counts).reduce((total, value) => total + value, 0);
    const badCount = SERIAL_FACE_ORDER.find((color) => counts[color] !== 9);

    if (totalFilled < 54 || badCount) {
      const remaining = Math.max(0, 54 - totalFilled);
      return {
        valid: false,
        incomplete: true,
        title: remaining ? 'Ainda faltam ' + remaining + ' quadrados' : 'Revise a quantidade de cores',
        message: 'Cada cor precisa aparecer exatamente nove vezes.'
      };
    }

    const facelets = serializeFaces();
    const problem = faceletProblem(facelets);
    if (problem) return invalidResult(problem);
    const cube = Cube.fromString(facelets);

    return {
      valid: true,
      incomplete: false,
      title: cube.isSolved() ? 'O cubo já está montado' : 'Cores válidas',
      message: cube.isSolved()
        ? 'A posição informada já está resolvida.'
        : 'A posição existe e está pronta para calcular.',
      cube: cube,
      facelets: facelets
    };
  }

  // Devolve o motivo pelo qual a posição não existe, ou null se ela é válida.
  function faceletProblem(facelets) {
    let data;
    try {
      data = Cube.fromString(facelets).toJSON();
    } catch (error) {
      return 'Não foi possível ler essa combinação de cores.';
    }
    if (!isUniqueRange(data.cp, 8) || !isUniqueRange(data.ep, 12)) {
      return 'Existe uma peça com combinação de cores impossível ou repetida.';
    }
    if (data.co.some((value) => !Number.isInteger(value)) || data.co.reduce((sum, value) => sum + value, 0) % 3 !== 0) {
      return 'Um canto parece estar girado de forma impossível.';
    }
    if (data.eo.some((value) => !Number.isInteger(value)) || data.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0) {
      return 'Uma borda parece estar invertida.';
    }
    if (permutationParity(data.cp) !== permutationParity(data.ep)) {
      return 'Duas peças parecem trocadas.';
    }
    return null;
  }

  /* ---------- Diagnóstico: onde está o erro e qual a correção mais provável ---------- */

  // Posições das peças na string URFDLB (mesma numeração do cube.js).
  const CORNER_SLOTS = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11], [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
  const CORNER_PIECES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  const EDGE_SLOTS = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];
  const EDGE_PIECES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
  // Ordem dos 8 quadrados ao redor do centro, no sentido horário (para girar uma face).
  const FACE_RING = [0, 1, 2, 5, 8, 7, 6, 3];

  const keyOf = (position) => SERIAL_FACE_ORDER[Math.floor(position / 9)] + '-' + (position % 9);

  function identifyPiece(colors, pieces) {
    for (let piece = 0; piece < pieces.length; piece += 1) {
      for (let twist = 0; twist < colors.length; twist += 1) {
        let match = true;
        for (let n = 0; n < colors.length; n += 1) {
          if (colors[(twist + n) % colors.length] !== pieces[piece][n]) { match = false; break; }
        }
        if (match) return piece;
      }
    }
    return -1;
  }

  // Quadrados de peças que não existem (cores impossíveis) ou que aparecem duas vezes.
  function findSuspectStickers(facelets) {
    const suspects = new Set();
    [[CORNER_SLOTS, CORNER_PIECES], [EDGE_SLOTS, EDGE_PIECES]].forEach(([slots, pieces]) => {
      const seen = new Map();
      slots.forEach((slot) => {
        const piece = identifyPiece(slot.map((position) => facelets[position]), pieces);
        if (piece < 0) {
          slot.forEach((position) => suspects.add(position));
          return;
        }
        if (!seen.has(piece)) seen.set(piece, []);
        seen.get(piece).push(slot);
      });
      seen.forEach((found) => {
        if (found.length > 1) found.forEach((slot) => slot.forEach((position) => suspects.add(position)));
      });
    });
    return suspects;
  }

  function changeCost(position, from, to, suspects) {
    const evidence = state.photo && state.photo.labs[keyOf(position)];
    if (evidence) {
      const protos = state.photo.prototypes;
      return 2 + Math.max(0, labDistance(evidence, protos[to]) - labDistance(evidence, protos[from]));
    }
    return suspects.has(position) ? 6 : 14;
  }

  // Procura as menores alterações que tornam a posição possível e ordena pela
  // mais provável (com fotos: a que menos contraria as cores medidas).
  function findFixes(facelets) {
    const chars = facelets.split('');
    const suspects = findSuspectStickers(facelets);
    const found = new Map();
    // fixedCost: usado quando as cores medidas não pesam (a face inteira girada leva as cores junto).
    const tryChanges = (changes, kind, extraCost, fixedCost, detail) => {
      const next = chars.slice();
      changes.forEach((change) => { next[change.position] = change.to; });
      const text = next.join('');
      if (text === facelets || found.has(text) || faceletProblem(text)) return;
      const cost = fixedCost !== undefined
        ? fixedCost
        : extraCost + changes.reduce((total, change) => total + changeCost(change.position, chars[change.position], change.to, suspects), 0);
      found.set(text, { kind: kind, changes: changes, cost: cost, facelets: text, detail: detail });
    };
    const positions = chars.map((_, position) => position).filter((position) => position % 9 !== 4);
    const swap = (a, b) => [{ position: a, to: chars[b] }, { position: b, to: chars[a] }];

    // 1) Trocar a cor de dois quadrados (erro típico de leitura: vermelho/laranja, branco/amarelo).
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        if (chars[positions[i]] !== chars[positions[j]]) tryChanges(swap(positions[i], positions[j]), 'swap', 0);
      }
    }
    // 2) Face fotografada girada.
    SERIAL_FACE_ORDER.forEach((face, faceIndex) => {
      [2, 4, 6].forEach((steps) => {
        const changes = FACE_RING.map((cell, ringIndex) => ({
          position: faceIndex * 9 + cell,
          to: chars[faceIndex * 9 + FACE_RING[(ringIndex - steps + 8) % 8]]
        })).filter((change) => change.to !== chars[change.position]);
        if (changes.length) tryChanges(changes, 'rotate', 0, 6 + changes.length * 0.5, { face: face, degrees: steps === 4 ? 180 : 90 });
      });
    });
    // 3) Canto girado ou borda invertida.
    CORNER_SLOTS.forEach((slot) => {
      [1, 2].forEach((turn) => tryChanges(slot.map((position, n) => ({ position: position, to: chars[slot[(n + turn) % 3]] })), 'twist', 3));
    });
    EDGE_SLOTS.forEach((slot) => tryChanges(swap(slot[0], slot[1]), 'flip', 3));

    // 4) Sem correção simples: duas trocas entre os quadrados mais suspeitos.
    if (!found.size) {
      let candidates = Array.from(suspects);
      if (state.photo) candidates = candidates.concat(state.photo.uncertain.filter((position) => !suspects.has(position)));
      candidates = candidates.filter((position) => position % 9 !== 4).slice(0, 14);
      const pairs = [];
      candidates.forEach((a) => positions.forEach((b) => {
        if (a !== b && chars[a] !== chars[b]) pairs.push([a, b]);
      }));
      const limited = pairs.slice(0, 260);
      for (let i = 0; i < limited.length; i += 1) {
        for (let j = i + 1; j < limited.length; j += 1) {
          const [a, b] = limited[i];
          const [c, d] = limited[j];
          if (new Set([a, b, c, d]).size < 4) continue;
          tryChanges(swap(a, b).concat(swap(c, d)), 'double', 2);
        }
      }
    }

    return { suspects: suspects, fixes: Array.from(found.values()).sort((a, b) => a.cost - b.cost).slice(0, 3) };
  }

  const positionOfKey = (key) => SERIAL_FACE_ORDER.indexOf(key[0]) * 9 + Number(key.slice(2));

  function forgetPhotoSticker(face, index) {
    if (state.photo) delete state.photo.labs[SERIAL_FACE_ORDER.indexOf(face) * 9 + index];
  }

  function describePosition(position) {
    const face = SERIAL_FACE_ORDER[Math.floor(position / 9)];
    return FACE_META[face].label + ', ' + POSITION_NAMES[position % 9];
  }

  // Todas as 54 posições preenchidas, mas uma cor sobrando e outra faltando:
  // testa trocar um quadrado da cor sobrando pela que falta.
  function findRecolorFixes(facelets) {
    const counts = getColorCounts();
    const over = SERIAL_FACE_ORDER.filter((color) => counts[color] === 10);
    const under = SERIAL_FACE_ORDER.filter((color) => counts[color] === 8);
    if (over.length !== 1 || under.length !== 1) return [];
    const fixes = [];
    facelets.split('').forEach((color, position) => {
      if (color !== over[0] || position % 9 === 4) return;
      const next = facelets.slice(0, position) + under[0] + facelets.slice(position + 1);
      if (faceletProblem(next)) return;
      const suspects = new Set();
      fixes.push({ kind: 'recolor', changes: [{ position: position, to: under[0] }], cost: changeCost(position, color, under[0], suspects), facelets: next });
    });
    return fixes.sort((a, b) => a.cost - b.cost).slice(0, 3);
  }

  let diagnosisCache = { facelets: null, result: null };

  function updateDiagnosis() {
    const buttons = elements.faceNet.querySelectorAll('.sticker-button');
    buttons.forEach((button) => button.classList.remove('is-suspect', 'is-fix'));
    const facelets = serializeFaces();
    const complete = !facelets.includes('?');
    const validation = validateCube();
    if (!complete || validation.valid) {
      elements.fixCard.hidden = true;
      return;
    }

    if (diagnosisCache.facelets !== facelets) {
      const recolor = validation.incomplete ? findRecolorFixes(facelets) : [];
      const result = validation.incomplete
        ? { suspects: new Set(), fixes: recolor }
        : findFixes(facelets);
      diagnosisCache = { facelets: facelets, result: result };
      state.fixChoice = 0;
    }
    const { suspects, fixes } = diagnosisCache.result;
    if (validation.incomplete && !fixes.length) {
      elements.fixCard.hidden = true;
      return;
    }

    const fix = fixes.length ? fixes[state.fixChoice % fixes.length] : null;
    const byPosition = (position) => elements.faceNet.querySelector(
      '.sticker-button[data-face="' + SERIAL_FACE_ORDER[Math.floor(position / 9)] + '"][data-index="' + (position % 9) + '"]'
    );
    suspects.forEach((position) => { const button = byPosition(position); if (button) button.classList.add('is-suspect'); });
    if (fix) fix.changes.forEach((change) => { const button = byPosition(change.position); if (button) button.classList.add('is-fix'); });

    elements.fixCard.hidden = false;
    const list = elements.fixChanges;
    list.replaceChildren();
    const colorName = (color) => COLORS[color].name.toLocaleLowerCase('pt-BR');

    if (fix) {
      const titles = {
        swap: 'Provável erro de leitura em 2 quadrados',
        double: 'Provável erro de leitura em 4 quadrados',
        recolor: 'Um quadrado parece estar com a cor errada',
        twist: 'Um canto parece girado',
        flip: 'Uma borda parece invertida',
        rotate: 'Uma foto parece ter sido tirada girada'
      };
      elements.fixTitle.textContent = titles[fix.kind];
      if (fix.kind === 'rotate') {
        elements.fixText.textContent = 'A face ' + FACE_META[fix.detail.face].label + ' ficaria correta girada ' + fix.detail.degrees + '°. Confira qual cor estava no topo dessa foto.';
      } else {
        elements.fixText.textContent = fix.kind === 'twist' || fix.kind === 'flip'
          ? 'Se as fotos estão certas, confira essa peça no cubo real: ela pode ter sido montada invertida.'
          : 'Confira no cubo real os quadrados marcados em laranja' +
            (suspects.size ? ' (em vermelho, as outras cores das peças afetadas):' : ':');
        fix.changes.forEach((change) => {
          const item = document.createElement('li');
          const from = serializeFaces()[change.position];
          item.innerHTML = '<span class="fix-dot" style="--from:' + COLORS[from].hex + '"></span>' +
            describePosition(change.position) + ': <b>' + colorName(from) + ' → ' + colorName(change.to) + '</b>' +
            '<span class="fix-dot" style="--from:' + COLORS[change.to].hex + '"></span>';
          list.appendChild(item);
        });
      }
    } else {
      elements.fixTitle.textContent = 'Não achei uma correção simples';
      elements.fixText.textContent = suspects.size
        ? 'Os quadrados com contorno vermelho formam peças que não existem. Confira-os no cubo real ou refaça a foto dessas faces.'
        : validation.message + ' Nenhuma troca pequena resolve: confira se alguma foto foi tirada com a face errada no topo.';
    }

    elements.fixApply.hidden = !fix;
    elements.fixNext.hidden = fixes.length < 2;
    elements.fixNext.textContent = 'Outra sugestão (' + ((state.fixChoice % Math.max(1, fixes.length)) + 1) + '/' + fixes.length + ')';

    // Refazer só as fotos das faces envolvidas, se as fotos ainda estão na memória.
    elements.fixRetake.replaceChildren();
    const hasPhotos = PHOTO_FACE_ORDER.every((face) => photoState.captures[face]);
    if (hasPhotos) {
      const positions = fix ? fix.changes.map((change) => change.position) : Array.from(suspects);
      const faces = Array.from(new Set(positions.map((position) => SERIAL_FACE_ORDER[Math.floor(position / 9)]))).slice(0, 3);
      faces.forEach((face) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button button-ghost';
        button.textContent = 'Refotografar ' + FACE_META[face].label;
        button.addEventListener('click', () => retakeSingleFace(face));
        elements.fixRetake.appendChild(button);
      });
    }
  }

  function applySuggestedFix() {
    const fixes = diagnosisCache.result ? diagnosisCache.result.fixes : [];
    if (!fixes.length) return;
    const fix = fixes[state.fixChoice % fixes.length];
    fix.changes.forEach((change) => {
      const face = SERIAL_FACE_ORDER[Math.floor(change.position / 9)];
      state.faces[face][change.position % 9] = change.to;
      forgetPhotoSticker(face, change.position % 9);
    });
    clearSolution({ resetVisual: true, silent: true });
    updateEditor();
    showToast(validateCube().valid ? 'Correção aplicada. Agora é só resolver.' : 'Correção aplicada, mas ainda há algo a revisar.');
  }

  // Abre a câmera direto na face escolhida, mantendo as outras cinco fotos.
  function retakeSingleFace(face) {
    photoState.step = PHOTO_FACE_ORDER.indexOf(face);
    photoState.singleFace = true;
    photoState.result = null;
    clearPhotoPreview();
    elements.photoCaptureView.hidden = false;
    elements.photoReviewView.hidden = true;
    renderPhotoStep();
    elements.photoDialog.showModal();
    window.requestAnimationFrame(() => startPhotoCamera());
  }

  function invalidResult(message) {
    return {
      valid: false,
      incomplete: false,
      title: 'Essa posição não é possível',
      message: message
    };
  }

  function updateValidation() {
    const validation = validateCube();
    elements.validationCard.classList.remove('is-neutral', 'is-valid', 'is-error');
    elements.validationCard.classList.add(validation.valid ? 'is-valid' : validation.incomplete ? 'is-neutral' : 'is-error');
    elements.validationCard.querySelector('.validation-icon').textContent = validation.valid ? '✓' : validation.incomplete ? '○' : '!';
    elements.validationTitle.textContent = validation.title;
    elements.validationMessage.textContent = validation.message;
    elements.solveButton.disabled = !validation.valid || !state.solverReady || state.busy;
    updateMobileActionState(validation);
    return validation;
  }

  function updateMobileActionState(validation) {
    const ready = validation.valid && state.solverReady && !state.busy && state.solution.length === 0;
    document.body.classList.toggle('is-cube-ready', ready);
  }

  function bindEvents() {
    elements.colorPalette.addEventListener('click', (event) => {
      const button = event.target.closest('.color-swatch');
      if (!button) return;
      state.selectedColor = button.dataset.color;
      updatePaletteSelection();
    });

    elements.faceNet.addEventListener('click', (event) => {
      const button = event.target.closest('.sticker-button');
      if (!button || button.disabled) return;
      paintSticker(button.dataset.face, Number(button.dataset.index));
    });

    elements.faceNet.addEventListener('contextmenu', (event) => {
      const button = event.target.closest('.sticker-button');
      if (!button || button.disabled) return;
      event.preventDefault();
      state.faces[button.dataset.face][Number(button.dataset.index)] = null;
      forgetPhotoSticker(button.dataset.face, Number(button.dataset.index));
      clearSolution({ resetVisual: true, silent: true });
      updateEditor();
    });

    elements.clearCube.addEventListener('click', () => {
      state.faces = createBlankFaces();
      state.photo = null;
      clearSolution({ resetVisual: true, silent: true });
      updateEditor();
      showToast('Campos limpos. Os seis centros foram mantidos.');
    });

    elements.solvedCube.addEventListener('click', () => {
      const solved = SERIAL_FACE_ORDER.map((face) => face.repeat(9)).join('');
      setFacesFromString(solved);
      showToast('Estado montado carregado.');
    });

    elements.exampleCube.addEventListener('click', () => {
      const example = new Cube();
      example.move(EXAMPLE_SCRAMBLE);
      setFacesFromString(example.asString());
      showToast('Exemplo carregado. Agora toque em Resolver cubo.');
    });

    elements.solveButton.addEventListener('click', () => {
      solveCurrentCube().catch((error) => handleActionError(error));
    });

    elements.resetCamera.addEventListener('click', () => mainCube && mainCube.resetCamera());
    elements.animationSpeed.addEventListener('change', () => {
      if (mainCube) mainCube.setAnimationDuration(Number(elements.animationSpeed.value));
    });
    elements.nextMove.addEventListener('click', () => nextMove().catch(handleActionError));
    elements.previousMove.addEventListener('click', () => previousMove().catch(handleActionError));
    elements.restartSolution.addEventListener('click', () => restartSolution().catch(handleActionError));
    elements.finishSolution.addEventListener('click', () => finishSolution().catch(handleActionError));
    elements.playSolution.addEventListener('click', togglePlayback);

    bindStageTap();

    elements.fixApply.addEventListener('click', applySuggestedFix);
    elements.fixNext.addEventListener('click', () => {
      state.fixChoice += 1;
      updateDiagnosis();
    });

    // Setas e espaço controlam a solução no computador.
    document.addEventListener('keydown', (event) => {
      if (state.activeTab !== 'resolver' || state.solution.length === 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest('input, select, textarea, dialog, [role="tablist"]')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!state.playing) nextMove().catch(handleActionError);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!state.playing) previousMove().catch(handleActionError);
      } else if (event.key === ' ' && !event.target.closest('button')) {
        event.preventDefault();
        togglePlayback();
      }
    });

    elements.moveSequence.addEventListener('click', (event) => {
      const chip = event.target.closest('.move-chip');
      if (!chip) return;
      jumpToMove(Number(chip.dataset.index) + 1).catch(handleActionError);
    });

    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
      const tabs = Array.from(document.querySelectorAll('[data-tab]'));
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      let target = current;
      if (event.key === 'ArrowRight') target = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[target].focus();
      tabs[target].click();
    });

    document.querySelector('.brand').addEventListener('click', () => switchTab('resolver', false));

    elements.openHelp.addEventListener('click', () => elements.helpDialog.showModal());
    elements.openPhotoReader.addEventListener('click', openPhotoReader);
    elements.photoClose.addEventListener('click', () => elements.photoDialog.close());
    elements.photoTake.addEventListener('click', () => elements.photoInput.click());
    elements.photoInput.addEventListener('change', handlePhotoFile);
    elements.photoScan.addEventListener('click', scanPhotoFace);
    elements.photoRetake.addEventListener('click', retakePhotoFace);
    elements.photoConfirmFace.addEventListener('click', confirmPhotoFace);
    elements.photoBack.addEventListener('click', previousPhotoFace);
    elements.photoManual.addEventListener('click', useManualPhotoEntry);
    elements.photoRestart.addEventListener('click', restartPhotoReader);
    elements.photoApply.addEventListener('click', applyPhotoResult);
    elements.photoDialog.addEventListener('close', stopPhotoCamera);

    elements.tutorialReset.addEventListener('click', () => {
      initTutorialCube();
      if (!state.tutorialBusy) tutorialCube.createSolvedCube();
    });

    elements.tutorialDemoMove.addEventListener('click', () => {
      runTutorialAlgorithm(elements.tutorialDemoMove.dataset.algorithm);
    });

    document.querySelectorAll('[data-demo]').forEach((button) => {
      button.addEventListener('click', () => runTutorialAlgorithm(button.dataset.demo));
    });

    document.addEventListener('keydown', (event) => {
      const number = Number(event.key);
      if (number >= 1 && number <= 6 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        state.selectedColor = SERIAL_FACE_ORDER[number - 1];
        updatePaletteSelection();
      }
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#passo-') || window.location.hash === '#tutorial') {
        switchTab('tutorial', false);
      } else if (window.location.hash === '#resolver') {
        switchTab('resolver', false);
      }
    });
  }

  // Toque rápido no cubo: avança (ou volta, no terço esquerdo). Arrastar continua girando a câmera.
  function bindStageTap() {
    const stage = document.getElementById('cube-stage');
    const pointers = new Map();
    let tap = null;

    stage.addEventListener('pointerdown', (event) => {
      pointers.set(event.pointerId, true);
      tap = pointers.size === 1 ? { x: event.clientX, y: event.clientY, time: performance.now() } : null;
    });

    const release = (event) => {
      pointers.delete(event.pointerId);
      if (event.type !== 'pointerup' || !tap) return;
      const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
      const quick = performance.now() - tap.time < 350;
      tap = null;
      if (moved > 10 || !quick) return;

      if (state.solution.length === 0) {
        hintTapBeforeSolution();
        return;
      }
      if (state.playing) {
        togglePlayback();
        return;
      }
      const rect = stage.getBoundingClientRect();
      const back = event.clientX - rect.left < rect.width / 3;
      flashTapHint(back ? 'stage-tap-prev' : 'stage-tap-next');
      if (back) previousMove().catch(handleActionError);
      else nextMove().catch(handleActionError);
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
  }

  // Sem solução ainda, o toque explica o que falta em vez de não fazer nada.
  let lastTapHint = -Infinity;
  function hintTapBeforeSolution() {
    const now = performance.now();
    if (now - lastTapHint < 6000) return;
    lastTapHint = now;
    const validation = validateCube();
    if (validation.valid && state.solverReady) {
      showToast('Cubo pronto. Toque em “Resolver cubo” e depois toque aqui para avançar.');
    } else {
      showToast('Primeiro copie as cores no passo 1. Depois de resolver, toque aqui para avançar.');
    }
  }

  function flashTapHint(id) {
    const hint = document.getElementById(id);
    if (!hint) return;
    hint.classList.remove('is-flash');
    void hint.offsetWidth;
    hint.classList.add('is-flash');
  }

  function openPhotoReader() {
    resetPhotoReader();
    elements.photoDialog.showModal();
    window.requestAnimationFrame(() => startPhotoCamera());
  }

  function resetPhotoReader() {
    photoState.singleFace = false;
    photoState.step = 0;
    photoState.captures = {};
    photoState.result = null;
    clearPhotoPreview();
    elements.photoCaptureView.hidden = false;
    elements.photoReviewView.hidden = true;
    renderPhotoStep();
  }

  async function restartPhotoReader() {
    stopPhotoCamera();
    resetPhotoReader();
    await startPhotoCamera();
  }

  function clearPhotoPreview() {
    photoState.sourceCanvas = null;
    photoState.previewSamples = null;
    if (!elements.photoCanvas) return;
    elements.photoCanvas.hidden = true;
    elements.photoDetectedGrid.hidden = true;
    elements.photoConfirmActions.hidden = true;
    elements.photoVideo.hidden = !photoState.stream;
    elements.photoScan.disabled = !photoState.stream;
    elements.photoCornerHelp.textContent = 'Encaixe os nove quadrados dentro da grade.';
    elements.photoInput.value = '';
  }

  async function startPhotoCamera() {
    elements.photoCameraPlaceholder.hidden = false;
    elements.photoCameraMessage.textContent = 'Abrindo a câmera…';
    elements.photoVideo.hidden = true;
    elements.photoScan.disabled = true;

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      elements.photoCameraMessage.textContent = 'A câmera não abriu aqui. Escolha uma foto da galeria.';
      return;
    }

    try {
      photoState.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 }
        }
      });
      if (!elements.photoDialog.open) {
        photoState.stream.getTracks().forEach((track) => track.stop());
        photoState.stream = null;
        return;
      }
      elements.photoVideo.srcObject = photoState.stream;
      await elements.photoVideo.play();
      elements.photoCameraPlaceholder.hidden = true;
      elements.photoVideo.hidden = false;
      elements.photoScan.disabled = false;
      elements.photoCornerHelp.textContent = 'Encaixe os nove quadrados dentro da grade.';
    } catch (error) {
      photoState.stream = null;
      elements.photoCameraMessage.textContent = 'Permita o uso da câmera ou escolha uma foto da galeria.';
      elements.photoCameraPlaceholder.hidden = false;
      elements.photoCornerHelp.textContent = 'A leitura também funciona com uma foto da galeria.';
    }
  }

  function stopPhotoCamera() {
    if (photoState.stream) {
      photoState.stream.getTracks().forEach((track) => track.stop());
    }
    photoState.stream = null;
    if (elements.photoVideo) {
      elements.photoVideo.srcObject = null;
      elements.photoVideo.hidden = true;
    }
    photoState.sourceCanvas = null;
    photoState.previewSamples = null;
  }

  function renderPhotoStep() {
    const face = PHOTO_FACE_ORDER[photoState.step];
    const meta = PHOTO_FACE_META[face];
    const position = photoState.step + 1;
    elements.photoProgress.textContent = position + ' / 6';
    elements.photoProgressBar.style.width = ((position / PHOTO_FACE_ORDER.length) * 100) + '%';
    elements.photoFaceName.textContent = meta.title;
    elements.photoCenterLabel.textContent = COLORS[face].name.toLocaleUpperCase('pt-BR');
    elements.photoTopLabel.textContent = COLORS[meta.top].name.toLocaleUpperCase('pt-BR');
    elements.photoCenterDot.style.setProperty('--guide-color', COLORS[face].hex);
    elements.photoTopSquare.style.setProperty('--guide-color', COLORS[meta.top].hex);
    elements.photoBack.disabled = photoState.step === 0 || photoState.singleFace;
    renderPhotoFaceRail();
    clearPhotoPreview();

    if (!photoState.stream) {
      elements.photoCameraPlaceholder.hidden = false;
      elements.photoCameraMessage.textContent = 'Escolha uma foto ou permita o uso da câmera.';
    } else {
      elements.photoCameraPlaceholder.hidden = true;
      elements.photoVideo.hidden = false;
      elements.photoScan.disabled = false;
    }
  }

  function renderPhotoFaceRail() {
    const labels = { F: 'Frente', R: 'Direita', B: 'Trás', L: 'Esquerda', U: 'Cima', D: 'Baixo' };
    elements.photoFaceRail.replaceChildren();
    PHOTO_FACE_ORDER.forEach((face, index) => {
      const step = document.createElement('div');
      step.className = 'photo-face-step';
      step.classList.toggle('is-current', index === photoState.step);

      const name = document.createElement('span');
      name.textContent = labels[face];
      const mini = document.createElement('span');
      mini.className = 'photo-face-mini';
      const samples = photoState.captures[face];
      for (let cellIndex = 0; cellIndex < 9; cellIndex += 1) {
        const cell = document.createElement('i');
        if (samples) {
          const sample = samples[cellIndex];
          cell.style.setProperty('--mini-color', 'rgb(' + sample.r + ' ' + sample.g + ' ' + sample.b + ')');
        } else if (cellIndex === 4) {
          cell.style.setProperty('--mini-color', COLORS[face].hex);
        }
        mini.appendChild(cell);
      }
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      step.append(name, mini, number);
      elements.photoFaceRail.appendChild(step);
    });
  }

  function drawCoverToCanvas(source, sourceWidth, sourceHeight) {
    const stageRect = elements.photoCameraStage.getBoundingClientRect();
    const width = 900;
    const height = Math.max(600, Math.round(width * stageRect.height / Math.max(stageRect.width, 1)));
    const canvas = elements.photoCanvas;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    if (sourceRatio > targetRatio) {
      cropWidth = sourceHeight * targetRatio;
      sourceX = (sourceWidth - cropWidth) / 2;
    } else {
      cropHeight = sourceWidth / targetRatio;
      sourceY = (sourceHeight - cropHeight) / 2;
    }
    context.drawImage(source, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
    photoState.sourceCanvas = canvas;
  }

  function sampleFixedPhotoGrid() {
    const canvas = photoState.sourceCanvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const stageRect = elements.photoCameraStage.getBoundingClientRect();
    const guideRect = elements.photoCameraStage.querySelector('.photo-face-guide').getBoundingClientRect();
    const scaleX = canvas.width / stageRect.width;
    const scaleY = canvas.height / stageRect.height;
    const left = (guideRect.left - stageRect.left) * scaleX;
    const top = (guideRect.top - stageRect.top) * scaleY;
    const width = guideRect.width * scaleX;
    const height = guideRect.height * scaleY;
    const radius = Math.max(3, Math.round(Math.min(width, height) / 42));
    const samples = [];

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const centerX = left + width * ((column + .5) / 3);
        const centerY = top + height * ((row + .5) / 3);
        const sampleLeft = Math.max(0, Math.round(centerX) - radius);
        const sampleTop = Math.max(0, Math.round(centerY) - radius);
        const sampleWidth = Math.min(canvas.width - sampleLeft, radius * 2 + 1);
        const sampleHeight = Math.min(canvas.height - sampleTop, radius * 2 + 1);
        const data = context.getImageData(sampleLeft, sampleTop, sampleWidth, sampleHeight).data;
        const channels = [[], [], []];
        for (let pixel = 0; pixel < data.length; pixel += 4) {
          channels[0].push(data[pixel]);
          channels[1].push(data[pixel + 1]);
          channels[2].push(data[pixel + 2]);
        }
        channels.forEach((values) => values.sort((a, b) => a - b));
        const middle = Math.floor(channels[0].length / 2);
        samples.push({ r: channels[0][middle], g: channels[1][middle], b: channels[2][middle] });
      }
    }
    return samples;
  }

  function showPhotoPreview(samples) {
    photoState.previewSamples = samples;
    elements.photoDetectedGrid.replaceChildren();
    samples.forEach((sample) => {
      const cell = document.createElement('span');
      cell.className = 'photo-detected-cell';
      cell.style.setProperty('--sample-rgb', sample.r + ', ' + sample.g + ', ' + sample.b);
      elements.photoDetectedGrid.appendChild(cell);
    });
    elements.photoVideo.hidden = true;
    elements.photoCanvas.hidden = false;
    elements.photoDetectedGrid.hidden = false;
    elements.photoConfirmActions.hidden = false;
    elements.photoScan.disabled = true;
    elements.photoCornerHelp.textContent = 'Confira se cada amostra está sobre um quadrado do cubo.';
  }

  function scanPhotoFace() {
    const video = elements.photoVideo;
    if (!photoState.stream || !video.videoWidth || !video.videoHeight) {
      showToast('A câmera ainda não está pronta.', true);
      return;
    }
    try {
      drawCoverToCanvas(video, video.videoWidth, video.videoHeight);
      showPhotoPreview(sampleFixedPhotoGrid());
    } catch (error) {
      showToast('Não consegui ler essa imagem. Tente novamente com mais luz.', true);
    }
  }

  async function handlePhotoFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Escolha uma imagem da câmera ou da galeria.', true);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Não foi possível abrir essa foto.'));
        image.src = objectUrl;
      });
      drawCoverToCanvas(image, image.naturalWidth, image.naturalHeight);
      elements.photoCameraPlaceholder.hidden = true;
      showPhotoPreview(sampleFixedPhotoGrid());
    } catch (error) {
      showToast(error.message || 'Não foi possível abrir essa foto.', true);
    } finally {
      URL.revokeObjectURL(objectUrl);
      elements.photoInput.value = '';
    }
  }

  function retakePhotoFace() {
    clearPhotoPreview();
    if (photoState.stream) {
      elements.photoCameraPlaceholder.hidden = true;
      elements.photoVideo.hidden = false;
      elements.photoScan.disabled = false;
    } else {
      elements.photoCameraPlaceholder.hidden = false;
    }
  }

  function previousPhotoFace() {
    if (photoState.step === 0) return;
    photoState.step -= 1;
    delete photoState.captures[PHOTO_FACE_ORDER[photoState.step]];
    renderPhotoStep();
  }

  function useManualPhotoEntry() {
    elements.photoDialog.close();
    document.querySelector('.editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Entrada manual aberta. Escolha a cor e toque nos quadrados.');
  }

  function confirmPhotoFace() {
    if (!photoState.previewSamples) return;
    const face = PHOTO_FACE_ORDER[photoState.step];
    photoState.captures[face] = photoState.previewSamples.map((sample) => Object.assign({}, sample));
    photoState.step += 1;
    if (photoState.singleFace) {
      photoState.singleFace = false;
      photoState.result = classifyPhotoColors(photoState.captures);
      renderPhotoReview();
    } else if (photoState.step < PHOTO_FACE_ORDER.length) {
      renderPhotoStep();
    } else {
      photoState.result = classifyPhotoColors(photoState.captures);
      renderPhotoReview();
    }
  }

  function rgbToLab(rgb) {
    const linear = [rgb.r, rgb.g, rgb.b].map((value) => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : Math.pow((channel + .055) / 1.055, 2.4);
    });
    const x = (linear[0] * .4124 + linear[1] * .3576 + linear[2] * .1805) / .95047;
    const y = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    const z = (linear[0] * .0193 + linear[1] * .1192 + linear[2] * .9505) / 1.08883;
    const convert = (value) => value > .008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116);
    const fx = convert(x);
    const fy = convert(y);
    const fz = convert(z);
    return { l: (116 * fy) - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function labDistance(first, second) {
    return Math.hypot(first.l - second.l, first.a - second.a, first.b - second.b);
  }

  function hungarian(costs) {
    const rows = costs.length;
    const columns = costs[0].length;
    const u = Array(rows + 1).fill(0);
    const v = Array(columns + 1).fill(0);
    const p = Array(columns + 1).fill(0);
    const way = Array(columns + 1).fill(0);

    for (let row = 1; row <= rows; row += 1) {
      p[0] = row;
      let column0 = 0;
      const minimum = Array(columns + 1).fill(Infinity);
      const used = Array(columns + 1).fill(false);
      do {
        used[column0] = true;
        const row0 = p[column0];
        let delta = Infinity;
        let column1 = 0;
        for (let column = 1; column <= columns; column += 1) {
          if (used[column]) continue;
          const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
          if (current < minimum[column]) {
            minimum[column] = current;
            way[column] = column0;
          }
          if (minimum[column] < delta) {
            delta = minimum[column];
            column1 = column;
          }
        }
        for (let column = 0; column <= columns; column += 1) {
          if (used[column]) {
            u[p[column]] += delta;
            v[column] -= delta;
          } else {
            minimum[column] -= delta;
          }
        }
        column0 = column1;
      } while (p[column0] !== 0);

      do {
        const column1 = way[column0];
        p[column0] = p[column1];
        column0 = column1;
      } while (column0 !== 0);
    }

    const assignment = Array(rows).fill(-1);
    for (let column = 1; column <= columns; column += 1) {
      if (p[column]) assignment[p[column] - 1] = column - 1;
    }
    return assignment;
  }

  function classifyPhotoColors(captures) {
    const prototypes = Object.fromEntries(SERIAL_FACE_ORDER.map((face) => [face, rgbToLab(captures[face][4])]));
    const items = [];
    SERIAL_FACE_ORDER.forEach((face) => {
      captures[face].forEach((rgb, index) => {
        if (index !== 4) items.push({ face: face, index: index, lab: rgbToLab(rgb) });
      });
    });
    const slots = [];
    SERIAL_FACE_ORDER.forEach((face) => {
      for (let count = 0; count < 8; count += 1) slots.push(face);
    });
    const costs = items.map((item) => slots.map((face) => labDistance(item.lab, prototypes[face])));
    const assignment = hungarian(costs);
    const faces = createBlankFaces();
    const uncertain = new Set();

    items.forEach((item, itemIndex) => {
      const color = slots[assignment[itemIndex]];
      faces[item.face][item.index] = color;
      const distances = SERIAL_FACE_ORDER.map((face) => ({ face: face, value: labDistance(item.lab, prototypes[face]) }))
        .sort((left, right) => left.value - right.value);
      const assignedDistance = labDistance(item.lab, prototypes[color]);
      const other = distances.find((entry) => entry.face !== color);
      if (assignedDistance > 34 || !other || other.value - assignedDistance < 6) {
        uncertain.add(item.face + '-' + item.index);
      }
    });
    const labs = {};
    items.forEach((item) => { labs[item.face + '-' + item.index] = item.lab; });
    return { faces: faces, uncertain: uncertain, labs: labs, prototypes: prototypes };
  }

  function renderPhotoReview() {
    stopPhotoCamera();
    elements.photoCaptureView.hidden = true;
    elements.photoReviewView.hidden = false;
    elements.photoReviewGrid.replaceChildren();
    const uncertainCount = photoState.result.uncertain.size;
    const readFacelets = SERIAL_FACE_ORDER.map((face) => photoState.result.faces[face].join('')).join('');
    const problem = faceletProblem(readFacelets);
    elements.photoReviewSummary.textContent = problem
      ? 'Essa leitura não forma um cubo possível. Toque em usar: vou apontar o quadrado provável e sugerir a correção, sem refazer tudo.'
      : uncertainCount
        ? uncertainCount + ' quadrado(s) com contorno amarelo merecem uma conferida.'
        : 'As cores ficaram bem separadas. Confira as seis faces antes de usar.';

    PHOTO_FACE_ORDER.forEach((face) => {
      const card = document.createElement('section');
      card.className = 'photo-review-face';
      const header = document.createElement('header');
      header.innerHTML = '<span>' + face + ' · ' + FACE_META[face].label + '</span><span>' + COLORS[face].name + '</span>';
      const grid = document.createElement('div');
      grid.className = 'photo-review-cells';
      photoState.result.faces[face].forEach((color, index) => {
        const cell = document.createElement('span');
        cell.className = 'photo-review-cell';
        cell.style.setProperty('--sticker', COLORS[color].hex);
        if (photoState.result.uncertain.has(face + '-' + index)) cell.classList.add('is-uncertain');
        cell.title = COLORS[color].name;
        grid.appendChild(cell);
      });
      card.append(header, grid);
      elements.photoReviewGrid.appendChild(card);
    });
  }

  function applyPhotoResult() {
    if (!photoState.result) return;
    state.faces = Object.fromEntries(SERIAL_FACE_ORDER.map((face) => [face, photoState.result.faces[face].slice()]));
    state.photo = {
      labs: Object.fromEntries(Object.entries(photoState.result.labs).map(([key, lab]) => [positionOfKey(key), lab])),
      prototypes: photoState.result.prototypes,
      uncertain: Array.from(photoState.result.uncertain).map(positionOfKey)
    };
    state.fixChoice = 0;
    clearSolution({ resetVisual: true, silent: true });
    updateEditor();
    const validation = validateCube();
    elements.photoDialog.close();
    if (validation.valid) {
      document.querySelector('.editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Cores reconhecidas. O cubo está pronto para resolver.');
    } else {
      // Rola até a planificação: os quadrados marcados precisam aparecer junto com o cartão.
      elements.faceNet.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('A posição lida não existe. Veja a correção sugerida.', true);
    }
  }

  function paintSticker(face, index) {
    const newColor = state.selectedColor === 'X' ? null : state.selectedColor;
    const oldColor = state.faces[face][index];
    if (newColor && newColor !== oldColor) {
      const counts = getColorCounts();
      if (counts[newColor] >= 9) {
        showToast(COLORS[newColor].name + ' já aparece nove vezes.', true);
        return;
      }
    }
    state.faces[face][index] = newColor;
    forgetPhotoSticker(face, index);
    clearSolution({ resetVisual: true, silent: true });
    updateEditor();
  }

  function setReadiness(text, kind) {
    const dot = elements.solverReadiness.querySelector('.status-dot');
    dot.classList.remove('is-loading', 'is-error');
    if (kind === 'loading') dot.classList.add('is-loading');
    if (kind === 'error') dot.classList.add('is-error');
    elements.solverReadiness.querySelector('span:last-child').textContent = text;
  }

  function initSolver() {
    if (state.solverInitStarted) return;
    state.solverInitStarted = true;
    setReadiness('Preparando o resolvedor…', 'loading');

    const useWorker = location.protocol !== 'file:' && Cube.asyncOK;
    if (!useWorker) {
      initSolverOnMainThread();
      return;
    }

    let settled = false;
    const finishWorker = () => {
      if (settled) return;
      settled = true;
      markSolverReady('worker');
    };

    try {
      Cube.asyncInit('./vendor/cubejs/worker.js', finishWorker);
      if (Cube._worker) {
        Cube._worker.addEventListener('error', () => {
          if (!settled) {
            settled = true;
            initSolverOnMainThread();
          }
        }, { once: true });
      }
      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          initSolverOnMainThread();
        }
      }, 18000);
    } catch (error) {
      initSolverOnMainThread();
    }
  }

  function initSolverOnMainThread() {
    setReadiness('Preparando no aparelho…', 'loading');
    window.setTimeout(() => {
      try {
        Cube.initSolver();
        markSolverReady('sync');
      } catch (error) {
        setReadiness('Resolvedor indisponível', 'error');
        elements.validationMessage.textContent = 'Não foi possível iniciar o cálculo neste navegador.';
      }
    }, 60);
  }

  function markSolverReady(mode) {
    if (state.solverReady) return;
    state.solverReady = true;
    state.solverMode = mode;
    setReadiness('Resolvedor pronto', 'ready');
    resolveSolverReady();
    updateValidation();
  }

  function solveWithCurrentMode(cube) {
    if (state.solverMode === 'worker') {
      return new Promise((resolve, reject) => {
        // Se o worker travar, calcula no próprio aparelho em vez de esperar para sempre.
        const fallback = window.setTimeout(() => {
          try {
            if (!state.mainThreadTablesReady) {
              Cube.initSolver();
              state.mainThreadTablesReady = true;
            }
            resolve(cube.solve().trim());
          } catch (error) { reject(error); }
        }, 20000);
        try {
          cube.asyncSolve((algorithm) => {
            window.clearTimeout(fallback);
            if (typeof algorithm !== 'string') reject(new Error('O cálculo não retornou uma solução.'));
            else resolve(algorithm.trim());
          });
        } catch (error) {
          window.clearTimeout(fallback);
          reject(error);
        }
      });
    }
    return Promise.resolve(cube.solve().trim());
  }

  async function solveCurrentCube() {
    const validation = validateCube();
    if (!validation.valid) {
      updateValidation();
      throw new Error(validation.message);
    }

    await solverReadyPromise;
    state.busy = true;
    state.playing = false;
    document.body.classList.remove('is-cube-ready');
    elements.solveButton.disabled = true;
    elements.solveButton.textContent = 'Calculando…';
    setValidationState('Calculando a solução', 'O processo acontece no próprio navegador.', 'neutral');

    try {
      const algorithm = validation.cube.isSolved() ? '' : await solveWithCurrentMode(validation.cube);
      state.solutionString = algorithm;
      state.solution = window.Cube3DMoves.parseAlgorithm(algorithm);
      state.solutionIndex = 0;
      state.inputString = validation.facelets;

      if (mainCube && mainCube.available) {
        await mainCube.loadFromSolution(algorithm);
        mainCube.setAnimationDuration(Number(elements.animationSpeed.value));
        const visualState = mainCube.getFaceletString();
        if (visualState && visualState !== validation.facelets) {
          console.warn('A orientação visual não corresponde à entrada.', { visualState: visualState, input: validation.facelets });
        }
      }

      renderSolution();
      if (state.solution.length === 0) {
        setValidationState('Cubo já resolvido', 'Nenhum movimento é necessário.', 'valid');
        showToast('Esse cubo já está montado.');
      } else {
        setValidationState('Solução encontrada', state.solution.length + ' movimentos. Use os controles abaixo.', 'valid');
        showToast('Solução pronta: ' + state.solution.length + ' movimentos.');
        showControlsTipOnce();
      }
      return algorithm;
    } catch (error) {
      setValidationState('Não foi possível calcular', error && error.message ? error.message : 'Revise as cores e tente novamente.', 'error');
      throw error;
    } finally {
      state.busy = false;
      elements.solveButton.textContent = 'Recalcular solução';
      updatePlayback();
      updateValidationButtonOnly();
    }
  }

  function showControlsTipOnce() {
    try {
      if (localStorage.getItem('cubo-dica-controles')) return;
      localStorage.setItem('cubo-dica-controles', '1');
    } catch (error) {
      return;
    }
    const touch = window.matchMedia('(pointer: coarse)').matches;
    window.setTimeout(() => showToast(touch
      ? 'Dica: toque no cubo para avançar. No lado esquerdo, volta.'
      : 'Dica: setas ← → avançam e voltam; espaço reproduz.'), 1200);
  }

  function setValidationState(title, message, kind) {
    elements.validationCard.classList.remove('is-neutral', 'is-valid', 'is-error');
    elements.validationCard.classList.add(kind === 'valid' ? 'is-valid' : kind === 'error' ? 'is-error' : 'is-neutral');
    elements.validationCard.querySelector('.validation-icon').textContent = kind === 'valid' ? '✓' : kind === 'error' ? '!' : '○';
    elements.validationTitle.textContent = title;
    elements.validationMessage.textContent = message;
  }

  function updateValidationButtonOnly() {
    const validation = validateCube();
    elements.solveButton.disabled = !validation.valid || !state.solverReady || state.busy;
    updateMobileActionState(validation);
  }

  function renderSolution(options) {
    const settings = Object.assign({ scroll: true }, options || {});
    elements.moveSequence.replaceChildren();
    state.solution.forEach((move, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'move-chip';
      button.dataset.index = String(index);
      button.textContent = move;
      button.setAttribute('aria-label', 'Ir até o movimento ' + (index + 1) + ': ' + moveInstruction(move));
      elements.moveSequence.appendChild(button);
    });
    elements.playback.hidden = state.solution.length === 0;
    document.body.classList.toggle('has-solution', state.solution.length > 0);
    updatePlayback();

    if (settings.scroll && state.solution.length > 0 && window.matchMedia('(max-width: 820px)').matches) {
      window.requestAnimationFrame(() => {
        document.getElementById('cube-stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function moveInstruction(move) {
    const face = move[0];
    const modifier = move.slice(1);
    const names = {
      U: 'face de cima', R: 'face da direita', F: 'face da frente',
      D: 'face de baixo', L: 'face da esquerda', B: 'face de trás'
    };
    if (modifier === '2') return 'Gire a ' + names[face] + ' duas vezes ¼ de volta (meia-volta, 180°). O sentido não importa.';
    if (modifier === "'") return 'Gire a ' + names[face] + ' ¼ de volta no sentido anti-horário.';
    return 'Gire a ' + names[face] + ' ¼ de volta no sentido horário.';
  }

  function inverseMove(move) {
    if (move.endsWith('2')) return move;
    return move.endsWith("'") ? move[0] : move + "'";
  }

  function updateCubeMoveHud(move, index, total) {
    if (!move || total === 0) {
      elements.cubeMoveHud.hidden = true;
      return;
    }

    const faceNames = {
      U: 'Topo', R: 'Direita', F: 'Frente',
      D: 'Base', L: 'Esquerda', B: 'Trás'
    };
    const modifier = move.slice(1);
    const direction = modifier === '2'
      ? '2 giros de 90°'
      : modifier === "'" ? 'anti-horário' : 'horário';

    elements.cubeMoveHud.hidden = false;
    elements.cubeMoveCode.textContent = move;
    elements.cubeMoveCounter.textContent = 'Movimento ' + (index + 1) + ' de ' + total;
    elements.cubeMoveDirection.textContent = faceNames[move[0]] + ' · ' + direction;
    elements.cubeMoveDegrees.textContent = modifier === '2' ? '2×90°' : '90°';
    elements.cubeMoveHud.classList.remove('is-step-1', 'is-step-2');
    elements.cubeMoveArrow.classList.toggle('is-prime', modifier === "'");
    elements.cubeMoveArrow.classList.toggle('is-half', modifier === '2');
  }

  // Durante a meia-volta o painel conta os dois giros: "giro 1 de 2", "giro 2 de 2".
  const HUD_FACE_NAMES = {
    U: 'Topo', R: 'Direita', F: 'Frente',
    D: 'Base', L: 'Esquerda', B: 'Trás'
  };

  function showHalfTurnStep(step) {
    const face = elements.cubeMoveCode.textContent[0];
    if (!HUD_FACE_NAMES[face]) return;
    elements.cubeMoveDirection.textContent = HUD_FACE_NAMES[face] + ' · giro ' + step + ' de 2';
    elements.cubeMoveHud.classList.remove('is-step-1', 'is-step-2');
    void elements.cubeMoveHud.offsetWidth;
    elements.cubeMoveHud.classList.add('is-step-' + step);
  }

  function updatePlayback() {
    saveSession();
    const total = state.solution.length;
    const complete = total > 0 && state.solutionIndex >= total;
    const current = complete ? null : state.solution[state.solutionIndex];

    if (total === 0) {
      document.body.classList.remove('is-solution-complete');
      elements.playback.hidden = true;
      updateCubeMoveHud(null, 0, 0);
      return;
    }

    updateCubeMoveHud(current, state.solutionIndex, total);

    elements.playback.hidden = false;
    document.body.classList.toggle('is-solution-complete', complete);
    elements.moveCounter.textContent = complete
      ? 'Concluído'
      : (state.solutionIndex + 1) + ' de ' + total;
    elements.moveCode.textContent = complete ? '✓' : current;
    elements.moveInstruction.textContent = complete
      ? 'Cubo resolvido. Todas as faces estão completas.'
      : moveInstruction(current) + ' Olhe diretamente para essa face.';

    const progress = total ? Math.round((state.solutionIndex / total) * 100) : 0;
    elements.solutionProgress.setAttribute('aria-valuenow', String(progress));
    elements.solutionProgressBar.style.width = progress + '%';

    elements.previousMove.disabled = state.busy || state.solutionIndex === 0;
    elements.restartSolution.disabled = state.busy || state.solutionIndex === 0;
    elements.nextMove.disabled = state.busy || complete;
    elements.finishSolution.disabled = state.busy || complete;
    elements.playSolution.disabled = state.busy && !state.playing;
    elements.playSolution.classList.toggle('is-playing', state.playing);
    elements.playSolution.setAttribute('aria-label', state.playing ? 'Pausar solução' : 'Reproduzir solução');
    elements.playSolution.title = state.playing ? 'Pausar' : 'Reproduzir';

    elements.moveSequence.querySelectorAll('.move-chip').forEach((chip, index) => {
      chip.classList.toggle('is-done', index < state.solutionIndex);
      chip.classList.toggle('is-current', index === state.solutionIndex && !complete);
      chip.disabled = state.busy;
    });
  }

  async function nextMove(options) {
    const settings = Object.assign({ duration: Number(elements.animationSpeed.value), internal: false }, options || {});
    if (state.busy || state.solutionIndex >= state.solution.length) return;
    state.busy = true;
    updatePlayback();
    try {
      await mainCube.turn(state.solution[state.solutionIndex], settings.duration, showHalfTurnStep);
      state.solutionIndex += 1;
      if (state.solutionIndex === state.solution.length && !settings.internal) {
        showToast('Cubo resolvido.');
      }
    } finally {
      state.busy = false;
      updatePlayback();
    }
  }

  async function previousMove(options) {
    const settings = Object.assign({ duration: Number(elements.animationSpeed.value) }, options || {});
    if (state.busy || state.solutionIndex <= 0) return;
    state.busy = true;
    updatePlayback();
    try {
      const move = inverseMove(state.solution[state.solutionIndex - 1]);
      await mainCube.turn(move, settings.duration);
      state.solutionIndex -= 1;
    } finally {
      state.busy = false;
      updatePlayback();
    }
  }

  async function restartSolution() {
    if (state.busy || !state.solutionString) return;
    state.playing = false;
    state.busy = true;
    updatePlayback();
    try {
      await mainCube.loadFromSolution(state.solutionString);
      state.solutionIndex = 0;
    } finally {
      state.busy = false;
      updatePlayback();
    }
  }

  async function finishSolution() {
    if (state.busy) return;
    state.playing = false;
    while (state.solutionIndex < state.solution.length) {
      await nextMove({ duration: 145, internal: true });
    }
    showToast('Cubo resolvido.');
  }

  async function jumpToMove(target) {
    if (state.busy || !Number.isInteger(target)) return;
    state.playing = false;
    const clamped = Math.max(0, Math.min(state.solution.length, target));
    while (state.solutionIndex < clamped) await nextMove({ duration: 150, internal: true });
    while (state.solutionIndex > clamped) await previousMove({ duration: 150 });
  }

  function togglePlayback() {
    if (state.playing) {
      state.playing = false;
      updatePlayback();
      return;
    }
    if (state.solutionIndex >= state.solution.length) {
      restartSolution().then(togglePlayback).catch(handleActionError);
      return;
    }
    state.playing = true;
    updatePlayback();
    playLoop().catch(handleActionError);
  }

  async function playLoop() {
    while (state.playing && state.solutionIndex < state.solution.length) {
      await nextMove({ duration: Number(elements.animationSpeed.value), internal: true });
      await wait(80);
    }
    const completed = state.solutionIndex >= state.solution.length;
    state.playing = false;
    updatePlayback();
    if (completed) showToast('Cubo resolvido.');
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function clearSolution(options) {
    const settings = Object.assign({ resetVisual: false, silent: false }, options || {});
    state.playing = false;
    state.busy = false;
    state.solution = [];
    state.solutionString = '';
    state.solutionIndex = 0;
    state.inputString = '';
    document.body.classList.remove('has-solution', 'is-cube-ready', 'is-solution-complete');
    elements.playback.hidden = true;
    elements.cubeMoveHud.hidden = true;
    elements.moveSequence.replaceChildren();
    elements.solveButton.textContent = 'Resolver cubo';
    if (settings.resetVisual && mainCube) mainCube.createSolvedCube();
    if (!settings.silent) updateValidation();
  }

  function switchTab(tab, updateHash) {
    const shouldUpdateHash = updateHash !== false;
    state.activeTab = tab === 'tutorial' ? 'tutorial' : 'resolver';
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const selected = button.dataset.tab === state.activeTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.getElementById('panel-resolver').hidden = state.activeTab !== 'resolver';
    document.getElementById('panel-tutorial').hidden = state.activeTab !== 'tutorial';

    if (state.activeTab === 'tutorial') {
      initTutorialCube();
      requestAnimationFrame(() => tutorialCube && tutorialCube.resize());
      if (shouldUpdateHash && !window.location.hash.startsWith('#passo-')) history.replaceState(null, '', '#tutorial');
    } else {
      requestAnimationFrame(() => mainCube && mainCube.resize());
      if (shouldUpdateHash) history.replaceState(null, '', '#resolver');
    }
  }

  async function runTutorialAlgorithm(algorithm) {
    initTutorialCube();
    if (!tutorialCube.available || state.tutorialBusy) return;
    state.tutorialBusy = true;
    document.querySelectorAll('[data-demo], #tutorial-demo-move, #tutorial-reset').forEach((button) => {
      button.disabled = true;
    });
    try {
      tutorialCube.createSolvedCube();
      await tutorialCube.applyAlgorithm(algorithm, { duration: 330 });
    } finally {
      state.tutorialBusy = false;
      document.querySelectorAll('[data-demo], #tutorial-demo-move, #tutorial-reset').forEach((button) => {
        button.disabled = false;
      });
    }
  }

  function showToast(message, isError) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' is-error' : '');
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3800);
  }

  function handleActionError(error) {
    state.playing = false;
    state.busy = false;
    updatePlayback();
    const message = error && error.message ? error.message : 'Não foi possível concluir essa ação.';
    showToast(message, true);
  }

  function registerWebMCPTools() {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== 'function') return;

    const lifecycle = new AbortController();
    const register = (tool) => {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      } catch (error) {
        // O navegador pode expor uma implementação parcial. A interface visível continua funcionando.
      }
    };

    register({
      name: 'configure_cube_state',
      title: 'Configurar cores do cubo',
      description: 'Preenche as 54 posições do cubo usando a ordem URFDLB e atualiza a planificação visível.',
      inputSchema: {
        type: 'object',
        properties: {
          facelets: {
            type: 'string',
            pattern: '^[URFDLB]{54}$',
            description: '54 letras, nove por face, na ordem U, R, F, D, L, B.'
          }
        },
        required: ['facelets'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input.facelets !== 'string' || !/^[URFDLB]{54}$/.test(input.facelets)) {
          throw new Error('facelets deve conter exatamente 54 letras URFDLB.');
        }
        setFacesFromString(input.facelets);
        const validation = validateCube();
        return { configured: true, valid: validation.valid, message: validation.message };
      }
    });

    register({
      name: 'solve_configured_cube',
      title: 'Resolver cubo configurado',
      description: 'Valida as cores atuais, calcula a solução e prepara a animação 3D visível.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute() {
        const algorithm = await solveCurrentCube();
        return { solved: true, moveCount: state.solution.length, algorithm: algorithm };
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
