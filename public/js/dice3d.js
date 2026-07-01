// Ludo Dice 3D — Three.js dice cube

class LudoDice3D {
    constructor() {
        this.value = 0;
        this.isRolling = false;
        this.isMultiplayer = false;
        this.container = document.getElementById('dice');
        this.valueEl = document.getElementById('dice-value');

        if (!this.container || typeof THREE === 'undefined') return;

        // Scene
        this.scene = new THREE.Scene();

        // Camera — perspective so the cube has depth
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        this.camera.position.set(0, 0, 4.2);

        // Renderer
        this.size = 120;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.size, this.size);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(2, 4, 5);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.3);
        fill.position.set(-3, -1, 2);
        this.scene.add(fill);

        // Build the cube
        this.buildDice();
        this.scene.add(this.cube);

        // Initial render
        this.animId = null;
        this.render();

        // Theme-observe: re-read pip color on toggle
        this.darkPip = this.getPipColor();

        // Click handler on the container (simpler than raycasting)
        this.container.style.cursor = 'pointer';
        this.container.addEventListener('click', () => this.handleClick());

        // Resize observer — keep canvas square
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
    }

    getPipColor() {
        const style = getComputedStyle(document.documentElement);
        return style.getPropertyValue('--dice-dot').trim() || '#2d1b0e';
    }

    buildDice() {
        const s = 1.6; // cube size
        const geo = new THREE.BoxGeometry(s, s, s);

        // Create 6 face materials with pip textures
        // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
        // Our mapping:      2    5    3    4    1    6
        const faceValues = [2, 5, 3, 4, 1, 6];
        const mats = faceValues.map(v => new THREE.MeshStandardMaterial({
            map: this.createPipTexture(v),
            roughness: 0.35,
            metalness: 0.02,
        }));

        this.cube = new THREE.Mesh(geo, mats);
        // Default position: face 1 (+Z) toward camera
        this.cube.position.set(0, 0, 0);
    }

    createPipTexture(value) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Dice face background — warm white
        ctx.fillStyle = '#f5efe8';
        ctx.fillRect(0, 0, size, size);

        // Subtle rounded border
        const r = 20;
        ctx.strokeStyle = '#e0d6c8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(4, 4, size - 8, size - 8, r);
        ctx.stroke();

        // Pips
        const pipColor = this.darkPip || '#2d1b0e';
        ctx.fillStyle = pipColor;
        const pr = size * 0.07;
        const positions = this.getPipPositions(value, size);
        positions.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, pr, 0, Math.PI * 2);
            ctx.fill();
            // Subtle highlight for depth
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(x - pr * 0.2, y - pr * 0.2, pr * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = pipColor;
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        return tex;
    }

    getPipPositions(value, size) {
        const c = size / 2;
        const o = size * 0.28;
        const map = {
            1: [[c, c]],
            2: [[c - o, c - o], [c + o, c + o]],
            3: [[c - o, c + o], [c, c], [c + o, c - o]],
            4: [[c - o, c - o], [c + o, c - o], [c - o, c + o], [c + o, c + o]],
            5: [[c - o, c - o], [c + o, c - o], [c, c], [c - o, c + o], [c + o, c + o]],
            6: [[c - o, c - o], [c + o, c - o], [c - o, c], [c + o, c], [c - o, c + o], [c + o, c + o]],
        };
        return map[value] || map[1];
    }

    // Rotation that brings a given face value toward the camera (+Z)
    // BoxGeometry face order: +X(2) -X(5) +Y(3) -Y(4) +Z(1) -Z(6)
    targetRotation(value) {
        // Values are Euler angles in radians
        const angles = {
            1: { x: 0, y: 0, z: 0 },
            2: { x: 0, y: -Math.PI / 2, z: 0 },
            3: { x: Math.PI / 2, y: 0, z: 0 },
            4: { x: -Math.PI / 2, y: 0, z: 0 },
            5: { x: 0, y: Math.PI / 2, z: 0 },
            6: { x: 0, y: Math.PI, z: 0 },
        };
        return angles[value] || angles[1];
    }

    // ─── Public API (matches LudoDice) ────────────────────────────────

    handleClick() {
        if (this.isRolling) return;
        if (this.isMultiplayer && window.ui?.socketClient) {
            window.ui.socketClient.rollDice();
        }
    }

    // Local roll — random value with animation
    roll() {
        if (this.isRolling) return;
        const value = Math.floor(Math.random() * 6) + 1;
        this.animateToValue(value);
        return value;
    }

    // Animate to a specific server-determined value
    animateToValue(value) {
        if (this.isRolling || !this.cube) return;
        this.isRolling = true;
        if (this.valueEl) this.valueEl.textContent = '⋯';

        const target = this.targetRotation(value);
        const start = {
            x: this.cube.rotation.x,
            y: this.cube.rotation.y,
            z: this.cube.rotation.z,
        };

        // Add random extra full spins for tumbling feel
        const spins = 1 + Math.floor(Math.random() * 1); // 1-2 full spins
        const end = {
            x: target.x + (Math.random() > 0.5 ? 1 : -1) * spins * Math.PI * 2,
            y: target.y + (Math.random() > 0.5 ? 1 : -1) * spins * Math.PI * 2,
            z: target.z + (Math.random() > 0.5 ? 1 : -1) * Math.floor(spins / 2) * Math.PI * 2,
        };

        const duration = 1200 + Math.random() * 400; // 1200-1600ms
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Cubic ease-out: fast start, slow settle
            const eased = 1 - Math.pow(1 - t, 3);

            this.cube.rotation.x = start.x + (end.x - start.x) * eased;
            this.cube.rotation.y = start.y + (end.y - start.y) * eased;
            this.cube.rotation.z = start.z + (end.z - start.z) * eased;
            this.render();

            if (t < 1) {
                this.animId = requestAnimationFrame(animate);
            } else {
                // Snap to exact target (clean up any floating-point drift)
                this.cube.rotation.x = target.x;
                this.cube.rotation.y = target.y;
                this.cube.rotation.z = target.z;
                this.render();
                this.finishRoll(value);
            }
        };

        this.animId = requestAnimationFrame(animate);
    }

    finishRoll(value) {
        this.value = value;
        if (this.valueEl) this.valueEl.textContent = value;
        this.isRolling = false;

        const event = new CustomEvent('diceRoll', { detail: { value } });
        document.dispatchEvent(event);
    }

    // Immediately show a value (no animation)
    showValue(value) {
        if (!this.cube) return;
        this.value = value;
        const t = this.targetRotation(value);
        this.cube.rotation.x = t.x;
        this.cube.rotation.y = t.y;
        this.cube.rotation.z = t.z;
        if (this.valueEl) this.valueEl.textContent = value;
        this.isRolling = false;
        this.render();
    }

    setValue(value) {
        this.showValue(value);
    }

    reset() {
        this.value = 0;
        this.showValue(1); // reset to face 1
        if (this.valueEl) this.valueEl.textContent = '';
    }

    disable() {
        this.container.style.pointerEvents = 'none';
        this.container.style.opacity = '0.5';
    }

    enable() {
        this.container.style.pointerEvents = 'auto';
        this.container.style.opacity = '1';
    }

    setMultiplayer(enabled) {
        this.isMultiplayer = enabled;
    }

    // ─── Internal ────────────────────────────────────────────

    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    resize() {
        if (!this.container || !this.renderer) return;
        const rect = this.container.getBoundingClientRect();
        const px = Math.round(rect.width * (window.devicePixelRatio || 1));
        if (px > 0 && px !== this.renderer.domElement.width) {
            this.renderer.setSize(px, px, false);
            this.render();
        }
    }

    // Cleanup
    dispose() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.renderer) {
            this.renderer.dispose();
            const canvas = this.renderer.domElement;
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        }
    }
}
