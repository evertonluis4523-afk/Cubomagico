(function () {
  'use strict';

  const MOVE_DEFS = {
    U: { axis: 'y', layer: 1, angle: -Math.PI / 2 },
    R: { axis: 'x', layer: 1, angle: -Math.PI / 2 },
    F: { axis: 'z', layer: 1, angle: -Math.PI / 2 },
    D: { axis: 'y', layer: -1, angle: Math.PI / 2 },
    L: { axis: 'x', layer: -1, angle: Math.PI / 2 },
    B: { axis: 'z', layer: -1, angle: Math.PI / 2 }
  };

  const FACE_COLORS = {
    U: 0xffd500,
    R: 0xed1c24,
    F: 0x006fe6,
    D: 0xf2f2ef,
    L: 0xff6a00,
    B: 0x00b94f
  };

  function createRoundedSquareShape(size, radius) {
    const half = size / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-half + radius, -half);
    shape.lineTo(half - radius, -half);
    shape.quadraticCurveTo(half, -half, half, -half + radius);
    shape.lineTo(half, half - radius);
    shape.quadraticCurveTo(half, half, half - radius, half);
    shape.lineTo(-half + radius, half);
    shape.quadraticCurveTo(-half, half, -half, half - radius);
    shape.lineTo(-half, -half + radius);
    shape.quadraticCurveTo(-half, -half, -half + radius, -half);
    return shape;
  }

  function createRoundedStickerGeometry(size, radius) {
    const shape = createRoundedSquareShape(size, radius);
    return new THREE.ShapeBufferGeometry(shape, 2);
  }

  function createRoundedCubieGeometry(size, radius) {
    const bevel = 0.035;
    const depth = size - bevel * 2;
    const shape = createRoundedSquareShape(size - bevel * 2, radius - bevel);
    const geometry = new THREE.ExtrudeBufferGeometry(shape, {
      depth: depth,
      steps: 1,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function easeInOutCubic(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function parseAlgorithm(algorithm) {
    if (Array.isArray(algorithm)) return algorithm.filter(Boolean);
    return String(algorithm || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function parseMove(move) {
    const match = /^([URFDLB])([2']?)$/.exec(String(move || '').trim());
    if (!match) throw new Error('Movimento inválido: ' + move);
    const def = MOVE_DEFS[match[1]];
    const modifier = match[2];
    let angle = def.angle;
    if (modifier === "'") angle *= -1;
    if (modifier === '2') angle *= 2;
    return { face: match[1], axis: def.axis, layer: def.layer, angle: angle };
  }

  class Cube3D {
    constructor(container, options) {
      this.container = container;
      this.options = Object.assign({ compact: false }, options || {});
      this.spacing = 1.01;
      this.cubies = [];
      this.isTurning = false;
      this.motionId = 0;
      this.animationDuration = 560;
      this.bottomInset = 0;
      this.available = false;

      if (!container || !window.THREE) return;

      try {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      } catch (error) {
        return;
      }

      this.available = true;
      this.renderer.setClearColor(getComputedStyle(container).backgroundColor || '#0b0e12', 1);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.setAttribute('aria-label', 'Visualização tridimensional do cubo mágico');
      this.renderer.domElement.setAttribute('role', 'img');
      container.appendChild(this.renderer.domElement);

      this.lastTouchEnd = 0;
      this.preventDoubleClick = (event) => event.preventDefault();
      this.preventDoubleTap = (event) => {
        if (event.touches.length !== 0 || event.changedTouches.length !== 1) {
          this.lastTouchEnd = 0;
          return;
        }
        const now = event.timeStamp || performance.now();
        if (now - this.lastTouchEnd < 360) {
          event.preventDefault();
          event.stopPropagation();
        }
        this.lastTouchEnd = now;
      };
      container.addEventListener('dblclick', this.preventDoubleClick, { passive: false });
      container.addEventListener('touchend', this.preventDoubleTap, { passive: false });

      this.root = new THREE.Group();
      this.root.rotation.y = 0;
      this.scene.add(this.root);

      this.pivot = new THREE.Group();
      this.root.add(this.pivot);

      this._buildMaterials();
      this._buildScene();
      this.createSolvedCube();

      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.075;
      this.controls.enablePan = false;
      this.controls.minDistance = this.options.compact ? 5.4 : 5.2;
      this.controls.maxDistance = 12;
      this.controls.rotateSpeed = 0.72;
      this.controls.zoomSpeed = 0.8;
      this.controls.target.set(0, 0, 0);

      this.resetCamera();
      this.resize();

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this._animate = this._animate.bind(this);
      this.frameId = requestAnimationFrame(this._animate);
    }

    _buildMaterials() {
      this.bodyGeometry = createRoundedCubieGeometry(0.95, 0.105);
      this.stickerGeometry = createRoundedStickerGeometry(0.81, 0.095);
      this.bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x050607,
        roughness: 0.28,
        metalness: 0.12
      });
      this.stickerMaterials = {};
      Object.keys(FACE_COLORS).forEach((face) => {
        this.stickerMaterials[face] = new THREE.MeshBasicMaterial({
          color: FACE_COLORS[face],
          side: THREE.FrontSide
        });
      });
    }

    _buildScene() {
      const ambient = new THREE.AmbientLight(0xffffff, 0.82);
      this.scene.add(ambient);

      const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
      frontLight.position.set(5, 1.2, 6);
      frontLight.castShadow = true;
      frontLight.shadow.mapSize.set(1024, 1024);
      frontLight.shadow.camera.left = -5;
      frontLight.shadow.camera.right = 5;
      frontLight.shadow.camera.top = 5;
      frontLight.shadow.camera.bottom = -5;
      this.scene.add(frontLight);

      const backLight = new THREE.DirectionalLight(0xffffff, 0.24);
      backLight.position.set(-4, -1, -5);
      this.scene.add(backLight);

      const floorMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 });
      const floor = new THREE.Mesh(new THREE.CircleBufferGeometry(3.25, 64), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.72;
      floor.receiveShadow = true;
      this.scene.add(floor);
    }

    _createSticker(face) {
      const sticker = new THREE.Mesh(this.stickerGeometry, this.stickerMaterials[face]);
      const offset = 0.486;
      sticker.userData.isSticker = true;
      sticker.userData.colorFace = face;
      sticker.castShadow = false;
      sticker.receiveShadow = true;

      if (face === 'F') {
        sticker.position.z = offset;
      } else if (face === 'B') {
        sticker.position.z = -offset;
        sticker.rotation.y = Math.PI;
      } else if (face === 'R') {
        sticker.position.x = offset;
        sticker.rotation.y = Math.PI / 2;
      } else if (face === 'L') {
        sticker.position.x = -offset;
        sticker.rotation.y = -Math.PI / 2;
      } else if (face === 'U') {
        sticker.position.y = offset;
        sticker.rotation.x = -Math.PI / 2;
      } else if (face === 'D') {
        sticker.position.y = -offset;
        sticker.rotation.x = Math.PI / 2;
      }
      return sticker;
    }

    _createCubie(x, y, z) {
      const cubie = new THREE.Group();
      cubie.position.set(x * this.spacing, y * this.spacing, z * this.spacing);
      cubie.userData.coord = new THREE.Vector3(x, y, z);

      const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      cubie.add(body);

      if (x === 1) cubie.add(this._createSticker('R'));
      if (x === -1) cubie.add(this._createSticker('L'));
      if (y === 1) cubie.add(this._createSticker('U'));
      if (y === -1) cubie.add(this._createSticker('D'));
      if (z === 1) cubie.add(this._createSticker('F'));
      if (z === -1) cubie.add(this._createSticker('B'));

      return cubie;
    }

    createSolvedCube() {
      this.motionId += 1;
      this.isTurning = false;

      if (!this.root) return;

      this.cubies.forEach((cubie) => {
        cubie.traverse((object) => {
          if (object.isMesh && object.geometry !== this.bodyGeometry && object.geometry !== this.stickerGeometry) {
            object.geometry.dispose();
          }
        });
        this.root.remove(cubie);
        this.pivot.remove(cubie);
      });
      this.cubies = [];
      this.pivot.rotation.set(0, 0, 0);

      for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
          for (let z = -1; z <= 1; z += 1) {
            const cubie = this._createCubie(x, y, z);
            this.cubies.push(cubie);
            this.root.add(cubie);
          }
        }
      }
    }

    setAnimationDuration(milliseconds) {
      const parsed = Number(milliseconds);
      if (Number.isFinite(parsed)) this.animationDuration = Math.max(80, parsed);
    }

    resetCamera() {
      if (!this.camera) return;
      const scale = this.options.compact ? 1.04 : 1;
      this.camera.position.set(5.8 * scale, 4.5 * scale, 6.7 * scale);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    }

    resize() {
      if (!this.available) return;
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      // Reserva a faixa inferior coberta pelo painel do movimento: a câmera
      // mostra a metade de baixo de um quadro mais alto (o centro sobe) e o
      // zoom reduz o cubo na mesma proporção da área que continua visível.
      const inset = Math.min(this.bottomInset, height * 0.4);
      this.camera.aspect = width / (height + inset);
      this.camera.zoom = (height - inset) / (height + inset);
      if (inset > 0) this.camera.setViewOffset(width, height + inset, 0, inset, width, height);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    syncBackground() {
      if (!this.available) return;
      this.renderer.setClearColor(getComputedStyle(this.container).backgroundColor, 1);
    }

    setBottomInset(pixels) {
      const next = Math.max(0, Math.round(Number(pixels) || 0));
      if (next === this.bottomInset) return;
      this.bottomInset = next;
      this.resize();
    }

    _animate() {
      if (!this.available) return;
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this._animate);
    }

    _snapQuaternion(object) {
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(object.quaternion);
      const elements = matrix.elements;
      [0, 1, 2, 4, 5, 6, 8, 9, 10].forEach((index) => {
        elements[index] = Math.round(elements[index]);
      });
      object.quaternion.setFromRotationMatrix(matrix).normalize();
    }

    _finishTurn(selected) {
      this.pivot.updateMatrixWorld(true);
      selected.forEach((cubie) => {
        this.root.attach(cubie);
        cubie.position.set(
          Math.round(cubie.position.x / this.spacing) * this.spacing,
          Math.round(cubie.position.y / this.spacing) * this.spacing,
          Math.round(cubie.position.z / this.spacing) * this.spacing
        );
        cubie.userData.coord.set(
          Math.round(cubie.position.x / this.spacing),
          Math.round(cubie.position.y / this.spacing),
          Math.round(cubie.position.z / this.spacing)
        );
        this._snapQuaternion(cubie);
      });
      this.pivot.rotation.set(0, 0, 0);
      this.isTurning = false;
    }

    // Meia-volta ("U2") vira dois giros de 90° com uma pausa, para não parecer um
    // movimento só. Em velocidades de salto (< 250 ms) continua um giro direto.
    turn(move, duration, onStep) {
      const turnDuration = duration === undefined ? this.animationDuration : Math.max(0, Number(duration));
      const half = /^[URFDLB]2$/.test(String(move || '').trim());
      if (!half || turnDuration < 250 || !this.available) return this._turnOnce(move, turnDuration);

      const quarter = String(move).trim()[0];
      return (async () => {
        if (onStep) onStep(1);
        await this._turnOnce(quarter, turnDuration);
        const motion = this.motionId;
        await new Promise((resolve) => setTimeout(resolve, Math.min(260, turnDuration * 0.4)));
        if (motion !== this.motionId) return;
        if (onStep) onStep(2);
        await this._turnOnce(quarter, turnDuration);
      })();
    }

    _turnOnce(move, duration) {
      if (!this.available) return Promise.resolve();
      if (this.isTurning) return Promise.reject(new Error('O cubo ainda está girando.'));

      const parsed = parseMove(move);
      const selected = this.cubies.filter((cubie) => Math.round(cubie.userData.coord[parsed.axis]) === parsed.layer);
      const turnDuration = duration === undefined ? this.animationDuration : Math.max(0, Number(duration));
      const currentMotion = ++this.motionId;

      this.isTurning = true;
      this.pivot.rotation.set(0, 0, 0);
      selected.forEach((cubie) => this.pivot.attach(cubie));

      if (turnDuration === 0) {
        this.pivot.rotation[parsed.axis] = parsed.angle;
        this._finishTurn(selected);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const start = performance.now();
        const frame = (now) => {
          if (currentMotion !== this.motionId) {
            this.isTurning = false;
            resolve();
            return;
          }
          const progress = Math.min(1, (now - start) / turnDuration);
          this.pivot.rotation[parsed.axis] = parsed.angle * easeInOutCubic(progress);
          if (progress < 1) {
            requestAnimationFrame(frame);
          } else {
            this.pivot.rotation[parsed.axis] = parsed.angle;
            this._finishTurn(selected);
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    }

    async applyAlgorithm(algorithm, options) {
      const settings = Object.assign({ duration: 0 }, options || {});
      const moves = parseAlgorithm(algorithm);
      for (let index = 0; index < moves.length; index += 1) {
        await this.turn(moves[index], settings.duration);
      }
    }

    async loadFromSolution(solution) {
      this.createSolvedCube();
      const inverse = window.Cube ? Cube.inverse(solution || '') : '';
      await this.applyAlgorithm(inverse, { duration: 0 });
    }

    getFaceletString() {
      if (!this.available) return '';
      const facelets = {
        U: Array(9), R: Array(9), F: Array(9),
        D: Array(9), L: Array(9), B: Array(9)
      };
      const normal = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();

      this.cubies.forEach((cubie) => {
        const coord = cubie.userData.coord;
        cubie.children.forEach((child) => {
          if (!child.userData.isSticker) return;
          child.getWorldQuaternion(quaternion);
          normal.set(0, 0, 1).applyQuaternion(quaternion);

          let face;
          if (Math.abs(normal.x) > 0.8) face = normal.x > 0 ? 'R' : 'L';
          else if (Math.abs(normal.y) > 0.8) face = normal.y > 0 ? 'U' : 'D';
          else face = normal.z > 0 ? 'F' : 'B';

          let row;
          let column;
          if (face === 'U') {
            row = coord.z + 1;
            column = coord.x + 1;
          } else if (face === 'D') {
            row = 1 - coord.z;
            column = coord.x + 1;
          } else if (face === 'F') {
            row = 1 - coord.y;
            column = coord.x + 1;
          } else if (face === 'B') {
            row = 1 - coord.y;
            column = 1 - coord.x;
          } else if (face === 'R') {
            row = 1 - coord.y;
            column = 1 - coord.z;
          } else {
            row = 1 - coord.y;
            column = coord.z + 1;
          }
          facelets[face][row * 3 + column] = child.userData.colorFace;
        });
      });

      return ['U', 'R', 'F', 'D', 'L', 'B'].map((face) => facelets[face].join('')).join('');
    }

    destroy() {
      this.motionId += 1;
      if (this.frameId) cancelAnimationFrame(this.frameId);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.controls) this.controls.dispose();
      if (this.container) {
        this.container.removeEventListener('dblclick', this.preventDoubleClick);
        this.container.removeEventListener('touchend', this.preventDoubleTap);
      }
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.domElement.remove();
      }
    }
  }

  window.Cube3D = Cube3D;
  window.Cube3DMoves = {
    parseAlgorithm: parseAlgorithm,
    parseMove: parseMove
  };
})();
