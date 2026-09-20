(function () {
  'use strict';

  const COLORS = {
    U: { name: 'Branco', short: 'B', hex: '#f4f7fb' },
    R: { name: 'Vermelho', short: 'V', hex: '#ef3340' },
    F: { name: 'Verde', short: 'Vd', hex: '#18b65b' },
    D: { name: 'Amarelo', short: 'A', hex: '#ffd500' },
    L: { name: 'Laranja', short: 'L', hex: '#ff7a00' },
    B: { name: 'Azul', short: 'Az', hex: '#1688e8' }
  };

  const SERIAL_FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  const NET_FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'];
  const FACE_META = {
    U: { label: 'Cima', center: 'branco' },
    R: { label: 'Direita', center: 'vermelho' },
    F: { label: 'Frente', center: 'verde' },
    D: { label: 'Base', center: 'amarelo' },
    L: { label: 'Esquerda', center: 'laranja' },
    B: { label: 'Trás', center: 'azul' }
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
    activeTab: 'resolver'
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
      'solution-progress-bar', 'restart-solution', 'previous-move',
      'play-solution', 'next-move', 'finish-solution', 'animation-speed',
      'move-sequence', 'tutorial-reset', 'tutorial-demo-move',
      'open-help', 'help-dialog', 'toast-region'
    ].forEach((id) => {
      elements[toCamelCase(id)] = document.getElementById(id);
    });
  }

  function toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function init() {
    cacheElements();
    renderPalette();
    renderFaceNet();
    updateEditor();
    bindEvents();
    initMainCube();
    initSolver();
    registerWebMCPTools();

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
    let cube;
    try {
      cube = Cube.fromString(facelets);
    } catch (error) {
      return invalidResult('Não foi possível ler essa combinação de cores.');
    }

    const data = cube.toJSON();
    if (!isUniqueRange(data.cp, 8) || !isUniqueRange(data.ep, 12)) {
      return invalidResult('Existe uma peça com combinação de cores impossível ou repetida.');
    }
    if (data.co.some((value) => !Number.isInteger(value)) || data.co.reduce((sum, value) => sum + value, 0) % 3 !== 0) {
      return invalidResult('Um ou mais cantos parecem estar girados de forma impossível.');
    }
    if (data.eo.some((value) => !Number.isInteger(value)) || data.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0) {
      return invalidResult('Uma das bordas parece estar invertida. Confira as fotos e a orientação.');
    }
    if (permutationParity(data.cp) !== permutationParity(data.ep)) {
      return invalidResult('Duas peças parecem trocadas. Essa posição não existe sem desmontar o cubo.');
    }

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
    return validation;
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
      clearSolution({ resetVisual: true, silent: true });
      updateEditor();
    });

    elements.clearCube.addEventListener('click', () => {
      state.faces = createBlankFaces();
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
        try {
          cube.asyncSolve((algorithm) => {
            if (typeof algorithm !== 'string') reject(new Error('O cálculo não retornou uma solução.'));
            else resolve(algorithm.trim());
          });
        } catch (error) {
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
  }

  function renderSolution() {
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
    updatePlayback();
  }

  function moveInstruction(move) {
    const face = move[0];
    const modifier = move.slice(1);
    const names = {
      U: 'face de cima', R: 'face da direita', F: 'face da frente',
      D: 'face de baixo', L: 'face da esquerda', B: 'face de trás'
    };
    if (modifier === '2') return 'Gire a ' + names[face] + ' meia-volta (180°).';
    if (modifier === "'") return 'Gire a ' + names[face] + ' ¼ de volta no sentido anti-horário.';
    return 'Gire a ' + names[face] + ' ¼ de volta no sentido horário.';
  }

  function inverseMove(move) {
    if (move.endsWith('2')) return move;
    return move.endsWith("'") ? move[0] : move + "'";
  }

  function updatePlayback() {
    const total = state.solution.length;
    const complete = total > 0 && state.solutionIndex >= total;
    const current = complete ? null : state.solution[state.solutionIndex];

    if (total === 0) {
      elements.playback.hidden = true;
      return;
    }

    elements.playback.hidden = false;
    elements.moveCounter.textContent = complete
      ? 'Todos os ' + total + ' movimentos concluídos'
      : 'Movimento ' + (state.solutionIndex + 1) + ' de ' + total;
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
      await mainCube.turn(state.solution[state.solutionIndex], settings.duration);
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
    elements.playback.hidden = true;
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
