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
    U: 0xf4f7fb,
    R: 0xef3340,
    F: 0x18b65b,
    D: 0xffd500,
    L: 0xff7a00,
    B: 0x1688e8
  };

  function createRoundedStickerGeometry(size, radius) {
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
    return new THREE.ShapeBufferGeometry(shape, 2);
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
      this.spacing = 1.03;
      this.cubies = [];
      this.isTurning = false;
      this.motionId = 0;
      this.animationDuration = 560;
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
      this.renderer.setClearColor(0x0b0e12, 1);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.setAttribute('aria-label', 'Visualização tridimensional do cubo mágico');
      this.renderer.domElement.setAttribute('role', 'img');
      container.appendChild(this.renderer.domElement);

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
      this.bodyGeometry = new THREE.BoxBufferGeometry(0.95, 0.95, 0.95, 1, 1, 1);
      this.stickerGeometry = createRoundedStickerGeometry(0.79, 0.085);
      this.bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x080a0d,
        roughness: 0.62,
        metalness: 0.08
      });
      this.stickerMaterials = {};
      Object.keys(FACE_COLORS).forEach((face) => {
        this.stickerMaterials[face] = new THREE.MeshStandardMaterial({
          color: FACE_COLORS[face],
          roughness: 0.42,
          metalness: 0.02,
          side: THREE.FrontSide
        });
      });
    }

    _buildScene() {
      const hemisphere = new THREE.HemisphereLight(0xffffff, 0x17202a, 1.12);
      this.scene.add(hemisphere);

      const key = new THREE.DirectionalLight(0xffffff, 1.55);
      key.position.set(4.8, 7, 5.6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -5;
      key.shadow.camera.right = 5;
      key.shadow.camera.top = 5;
      key.shadow.camera.bottom = -5;
      this.scene.add(key);

      const rim = new THREE.DirectionalLight(0x5fa8ff, 0.75);
      rim.position.set(-5, 2, -4);
      this.scene.add(rim);

      const warm = new THREE.PointLight(0xff7a1a, 0.55, 18);
      warm.position.set(4, -1, 3);
      this.scene.add(warm);

      const floorMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 });
      const floor = new THREE.Mesh(new THREE.CircleBufferGeometry(3.25, 64), floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.72;
      floor.receiveShadow = true;
      this.scene.add(floor);
    }

    _createSticker(face) {
      const sticker = new THREE.Mesh(this.stickerGeometry, this.stickerMaterials[face]);
      const offset = 0.482;
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
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
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

    turn(move, duration) {
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
