// Ludo Board Renderer — Standard Layout
// Red=top-left, Yellow=top-right, Blue=bottom-right, Green=bottom-left

class LudoBoard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.gridSize = 15;
    this.cellSize = 0;
    this.boardSize = 0;

    this.colors = {
      red: "#e74c3c",
      blue: "#3498db",
      green: "#2ecc71",
      yellow: "#f1c40f",
      white: "#faf8f5",
      dark: "#ede6d8",
      path: "#fff",
    };

    this.layout = this.createLayout();
    this.safeSquares = [8, 21, 34, 47];
    this.editMode = false;
    this.selectedCell = null;

    this.setupEditor();
    this.updateThemeColors();
    this.deferredResize();
    window.addEventListener("resize", () => this.resize());
  }

  updateThemeColors() {
    const style = getComputedStyle(document.documentElement);
    this.colors.dark =
      style.getPropertyValue("--canvas-bg").trim() || "#ede6d8";
    this.colors.path = style.getPropertyValue("--dice-bg").trim() || "#fff";
    this.colors.white =
      style.getPropertyValue("--surface-alt").trim() || "#faf8f5";
  }

  setupEditor() {
    this.canvas.addEventListener("click", (e) => {
      if (!this.editMode) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / this.cellSize);
      const r = Math.floor(y / this.cellSize);
      if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
        this.selectedCell = { r, c };
        this.draw();
        this.highlightSelected();
        const trackPos = this.gridToTrack(r, c);
        const typeNames = {
          0: "Empty",
          1: "Path",
          2: "Home Base",
          3: "Home Column",
          4: "Center",
        };
        const info = `Row ${r}, Col ${c} | Type: ${typeNames[this.layout[r][c]]}${trackPos >= 0 ? " | Track: " + trackPos : ""}`;
        document.getElementById("tile-info").textContent = info;
        document.getElementById("tile-editor").style.display = "block";
        document.getElementById("tile-color").value = this.getCellColor(r, c);
        document.getElementById("tile-type").value = this.layout[r][c];
      }
    });

    document.getElementById("tile-color").addEventListener("input", () => {
      if (!this.selectedCell) return;
      this.applyEdit();
    });

    document.getElementById("tile-type").addEventListener("change", () => {
      if (!this.selectedCell) return;
      this.applyEdit();
    });

    document.getElementById("save-board-btn").addEventListener("click", () => {
      this.saveLayout();
    });
  }

  saveLayout() {
    var layout = [];
    for (var r = 0; r < this.gridSize; r++) {
      layout[r] = [];
      for (var c = 0; c < this.gridSize; c++) {
        layout[r][c] = this.layout[r][c];
      }
    }
    fetch("/save-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: layout }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        alert(
          data.success
            ? "Saved! Restart server."
            : "Save failed: " + data.error,
        );
      });
  }

  getCellColor(r, c) {
    const type = this.layout[r][c];
    switch (type) {
      case 2:
        return this.getHomeBaseColor(r, c);
      case 3:
        return this.getHomeColumnColor(r, c);
      case 1:
        return this.colors.path;
      case 0:
        return this.colors.dark;
      default:
        return "#ffffff";
    }
  }

  applyEdit() {
    const { r, c } = this.selectedCell;
    this.layout[r][c] = parseInt(document.getElementById("tile-type").value);
    if (this.layout[r][c] === 1) {
      this.colors.path = document.getElementById("tile-color").value;
    }
    this.draw();
    this.highlightSelected();
  }

  highlightSelected() {
    if (!this.selectedCell) return;
    const { r, c } = this.selectedCell;
    const ctx = this.ctx;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      c * this.cellSize,
      r * this.cellSize,
      this.cellSize,
      this.cellSize,
    );
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    this.canvas.style.cursor = this.editMode ? "crosshair" : "default";
    this.canvas.style.pointerEvents = this.editMode ? "auto" : "none";
    if (!this.editMode) {
      document.getElementById("tile-editor").style.display = "none";
      this.selectedCell = null;
    }
    this.draw();
  }

  deferredResize() {
    if (this.canvas.parentElement.clientWidth > 0) {
      this.resize();
      return;
    }
    requestAnimationFrame(() => this.deferredResize());
  }

  createLayout() {
    var grid = Array(15)
      .fill(null)
      .map(function () {
        return Array(15).fill(0);
      });

    // Top arm: rows 0-5, cols 6-8
    for (var r = 0; r <= 5; r++) {
      grid[r][6] = 1;
      grid[r][8] = 1;
    }
    for (var r = 1; r <= 5; r++) {
      grid[r][7] = 3; // Yellow home column
    }
    grid[0][7] = 1;

    // Left arm: rows 6-8, cols 0-5
    for (var c = 0; c <= 5; c++) {
      grid[6][c] = 1;
      grid[8][c] = 1;
    }
    for (var c = 1; c <= 5; c++) {
      grid[7][c] = 3; // Red home column
    }
    grid[7][0] = 1;

    // Right arm: rows 6-8, cols 9-14
    for (var c = 9; c <= 14; c++) {
      grid[6][c] = 1;
      grid[8][c] = 1;
    }
    for (var c = 9; c <= 13; c++) {
      grid[7][c] = 3; // Blue home column
    }
    grid[7][14] = 1;

    // Bottom arm: rows 9-14, cols 6-8
    for (var r = 9; r <= 14; r++) {
      grid[r][6] = 1;
      grid[r][8] = 1;
    }
    for (var r = 9; r <= 13; r++) {
      grid[r][7] = 3; // Green home column
    }
    grid[14][7] = 1;

    // Center: rows 6-8, cols 6-8
    for (var r = 6; r <= 8; r++) {
      for (var c = 6; c <= 8; c++) {
        grid[r][c] = 4;
      }
    }

    // Home bases — 4x4 corner blocks (traditional)
    // Red (top-left)
    for (var r = 0; r <= 3; r++) {
      for (var c = 0; c <= 3; c++) {
        grid[r][c] = 2;
      }
    }
    // Yellow (top-right)
    for (var r = 0; r <= 3; r++) {
      for (var c = 11; c <= 14; c++) {
        grid[r][c] = 2;
      }
    }
    // Blue (bottom-right)
    for (var r = 11; r <= 14; r++) {
      for (var c = 11; c <= 14; c++) {
        grid[r][c] = 2;
      }
    }
    // Green (bottom-left)
    for (var r = 11; r <= 14; r++) {
      for (var c = 0; c <= 3; c++) {
        grid[r][c] = 2;
      }
    }

    // Colored start tiles on the track (override path → player color)
    grid[6][1] = 2; // Red start
    grid[1][8] = 2; // Yellow start
    grid[8][13] = 2; // Blue start
    grid[13][6] = 2; // Green start

    return grid;
  }
  resize() {
    const wrapper = this.canvas.parentElement;
    const width = wrapper.clientWidth || wrapper.offsetWidth;
    const height = wrapper.clientHeight || wrapper.offsetHeight || width;
    const size = Math.min(width, height) || 300; // fallback 300px

    this.boardSize = size;
    this.cellSize = size / this.gridSize;

    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.width = size + "px";
    this.canvas.style.height = size + "px";

    this.draw();
    if (this.onResize) this.onResize();
  }

  draw() {
    const ctx = this.ctx;
    const cellSize = this.cellSize;

    // Clear canvas
    ctx.fillStyle = this.colors.dark;
    ctx.fillRect(0, 0, this.boardSize, this.boardSize);

    // Draw grid
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const type = this.layout[r][c];

        switch (type) {
          case 0:
            ctx.fillStyle = this.colors.dark;
            break;
          case 1:
            ctx.fillStyle = this.colors.path;
            break;
          case 2:
            ctx.fillStyle = this.getHomeBaseColor(r, c);
            break;
          case 3:
            ctx.fillStyle = this.getHomeColumnColor(r, c);
            break;
          case 4:
            ctx.fillStyle = this.colors.dark;
            break;
        }

        ctx.fillRect(x, y, cellSize, cellSize);

        // Cell border
        ctx.strokeStyle = this.colors.dark;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Safe squares (small subtle dot, clearly not a player token)
        if (type === 1 && this.isSafeSquare(r, c)) {
          this.drawStar(
            ctx,
            x + cellSize / 2,
            y + cellSize / 2,
            5,
            cellSize * 0.2,
            cellSize * 0.1,
          );
        }
      }
    }

    // Draw center triangles
    this.drawCenter();
  }

  getHomeBaseColor(r, c) {
    // Colored start tiles on the cross arms
    if (r === 6 && c === 1) return this.colors.red;
    if (r === 1 && c === 8) return this.colors.yellow;
    if (r === 8 && c === 13) return this.colors.blue;
    if (r === 13 && c === 6) return this.colors.green;

    // 4x4 corner home bases
    if (r < 4 && c < 4) {
      if (r >= 1 && r <= 2 && c >= 1 && c <= 2) return this.colors.white;
      return this.colors.red;
    }
    if (r < 4 && c > 10) {
      if (r >= 1 && r <= 2 && c >= 12 && c <= 13) return this.colors.white;
      return this.colors.yellow;
    }
    if (r > 10 && c > 10) {
      if (r >= 12 && r <= 13 && c >= 12 && c <= 13) return this.colors.white;
      return this.colors.blue;
    }
    if (r > 10 && c < 4) {
      if (r >= 12 && r <= 13 && c >= 1 && c <= 2) return this.colors.white;
      return this.colors.green;
    }
    return this.colors.dark;
  }

  getHomeColumnColor(r, c) {
    if (r === 7 && c >= 1 && c <= 5) return this.colors.red; // Red: horizontal left
    if (c === 7 && r >= 1 && r <= 5) return this.colors.yellow; // Yellow: vertical top
    if (r === 7 && c >= 9 && c <= 13) return this.colors.blue; // Blue: horizontal right
    if (c === 7 && r >= 9 && r <= 13) return this.colors.green; // Green: vertical bottom
    return this.colors.white;
  }

  isSafeSquare(r, c) {
    const trackPos = this.gridToTrack(r, c);
    return this.safeSquares.includes(trackPos);
  }

  gridToTrack(r, c) {
    // Clockwise track: Red starts at 0 (row6,col1), Yellow at 13 (row1,col8),
    // Blue at 26 (row8,col13), Green at 39 (row13,col6)
    if (r === 6 && c === 1) return 0;
    if (r === 6 && c === 2) return 1;
    if (r === 6 && c === 3) return 2;
    if (r === 6 && c === 4) return 3;
    if (r === 6 && c === 5) return 4;
    if (r === 5 && c === 6) return 5;
    if (r === 4 && c === 6) return 6;
    if (r === 3 && c === 6) return 7;
    if (r === 2 && c === 6) return 8;
    if (r === 1 && c === 6) return 9;
    if (r === 0 && c === 6) return 10;
    if (r === 0 && c === 7) return 11;
    if (r === 0 && c === 8) return 12;
    if (r === 1 && c === 8) return 13;
    if (r === 2 && c === 8) return 14;
    if (r === 3 && c === 8) return 15;
    if (r === 4 && c === 8) return 16;
    if (r === 5 && c === 8) return 17;
    if (r === 6 && c === 9) return 18;
    if (r === 6 && c === 10) return 19;
    if (r === 6 && c === 11) return 20;
    if (r === 6 && c === 12) return 21;
    if (r === 6 && c === 13) return 22;
    if (r === 6 && c === 14) return 23;
    if (r === 7 && c === 14) return 24;
    if (r === 8 && c === 14) return 25;
    if (r === 8 && c === 13) return 26;
    if (r === 8 && c === 12) return 27;
    if (r === 8 && c === 11) return 28;
    if (r === 8 && c === 10) return 29;
    if (r === 8 && c === 9) return 30;
    if (r === 9 && c === 8) return 31;
    if (r === 10 && c === 8) return 32;
    if (r === 11 && c === 8) return 33;
    if (r === 12 && c === 8) return 34;
    if (r === 13 && c === 8) return 35;
    if (r === 14 && c === 8) return 36;
    if (r === 14 && c === 7) return 37;
    if (r === 14 && c === 6) return 38;
    if (r === 13 && c === 6) return 39;
    if (r === 12 && c === 6) return 40;
    if (r === 11 && c === 6) return 41;
    if (r === 10 && c === 6) return 42;
    if (r === 9 && c === 6) return 43;
    if (r === 8 && c === 5) return 44;
    if (r === 8 && c === 4) return 45;
    if (r === 8 && c === 3) return 46;
    if (r === 8 && c === 2) return 47;
    if (r === 8 && c === 1) return 48;
    if (r === 8 && c === 0) return 49;
    if (r === 7 && c === 0) return 50;
    if (r === 6 && c === 0) return 51;

    return -1;
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = "#f39c12";
    ctx.fill();
    ctx.strokeStyle = "#e67e22";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawCenter() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    // Center is the 3x3 area at rows 6-8, cols 6-8
    const ox = 6 * cs;
    const oy = 6 * cs;
    const sz = 3 * cs;
    const cx = ox + sz / 2;
    const cy = oy + sz / 2;

    // Red triangle (top-left quadrant)
    ctx.fillStyle = this.colors.yellow;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + sz, oy);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Yellow triangle (top-right quadrant)
    ctx.fillStyle = this.colors.blue;
    ctx.beginPath();
    ctx.moveTo(ox + sz, oy);
    ctx.lineTo(ox + sz, oy + sz);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Blue triangle (bottom-right quadrant)
    ctx.fillStyle = this.colors.green;
    ctx.beginPath();
    ctx.moveTo(ox + sz, oy + sz);
    ctx.lineTo(ox, oy + sz);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Green triangle (bottom-left quadrant)
    ctx.fillStyle = this.colors.red;
    ctx.beginPath();
    ctx.moveTo(ox, oy + sz);
    ctx.lineTo(ox, oy);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }

  drawArrow(ctx, x1, y1, x2, y2) {
    // Simplified — just draw a small triangle indicator
    const size = this.cellSize * 0.15;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size, y2 - size);
    ctx.lineTo(x2 + size, y2 - size);
    ctx.closePath();
    ctx.fill();
  }

  // Draw token on board
  drawToken(trackPos, color, tokenIndex, isSelected = false) {
    const ctx = this.ctx;
    const cellSize = this.cellSize;

    let x, y;

    if (trackPos.type === "track") {
      const gridPos = this.trackToGrid(trackPos.position);
      x = gridPos.c * cellSize + cellSize / 2;
      y = gridPos.r * cellSize + cellSize / 2;
    } else if (trackPos.type === "home") {
      const basePos = this.getHomeBasePosition(trackPos.base, trackPos.index);
      x = basePos.c * cellSize + cellSize / 2;
      y = basePos.r * cellSize + cellSize / 2;
    } else if (trackPos.type === "homeColumn") {
      const colPos = this.getHomeColumnPosition(
        trackPos.base,
        trackPos.position,
      );
      x = colPos.c * cellSize + cellSize / 2;
      y = colPos.r * cellSize + cellSize / 2;
    } else if (trackPos.type === "finished") {
      const centerPos = this.getCenterPosition(trackPos.base, trackPos.index);
      x = centerPos.c * cellSize + cellSize / 2;
      y = centerPos.r * cellSize + cellSize / 2;
    }

    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = this.colors[color];
    ctx.fill();

    ctx.strokeStyle = isSelected ? "#fff" : "#333";
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    if (isSelected) {
      ctx.shadowColor = this.colors[color];
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, cellSize * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  trackToGrid(position) {
    const trackMap = [
      { r: 6, c: 1 },
      { r: 6, c: 2 },
      { r: 6, c: 3 },
      { r: 6, c: 4 },
      { r: 6, c: 5 },
      { r: 5, c: 6 },
      { r: 4, c: 6 },
      { r: 3, c: 6 },
      { r: 2, c: 6 },
      { r: 1, c: 6 },
      { r: 0, c: 6 },
      { r: 0, c: 7 },
      { r: 0, c: 8 },
      { r: 1, c: 8 },
      { r: 2, c: 8 },
      { r: 3, c: 8 },
      { r: 4, c: 8 },
      { r: 5, c: 8 },
      { r: 6, c: 9 },
      { r: 6, c: 10 },
      { r: 6, c: 11 },
      { r: 6, c: 12 },
      { r: 6, c: 13 },
      { r: 6, c: 14 },
      { r: 7, c: 14 },
      { r: 8, c: 14 },
      { r: 8, c: 13 },
      { r: 8, c: 12 },
      { r: 8, c: 11 },
      { r: 8, c: 10 },
      { r: 8, c: 9 },
      { r: 9, c: 8 },
      { r: 10, c: 8 },
      { r: 11, c: 8 },
      { r: 12, c: 8 },
      { r: 13, c: 8 },
      { r: 14, c: 8 },
      { r: 14, c: 7 },
      { r: 14, c: 6 },
      { r: 13, c: 6 },
      { r: 12, c: 6 },
      { r: 11, c: 6 },
      { r: 10, c: 6 },
      { r: 9, c: 6 },
      { r: 8, c: 5 },
      { r: 8, c: 4 },
      { r: 8, c: 3 },
      { r: 8, c: 2 },
      { r: 8, c: 1 },
      { r: 8, c: 0 },
      { r: 7, c: 0 },
      { r: 6, c: 0 },
    ];

    return trackMap[position] || { r: 0, c: 0 };
  }

  getHomeBasePosition(playerIndex, tokenIndex) {
    // 4x4 home bases with inner 2x2 token spots
    const bases = [
      [
        { r: 1, c: 1 },
        { r: 1, c: 2 },
        { r: 2, c: 1 },
        { r: 2, c: 2 },
      ], // Red (TL)
      [
        { r: 1, c: 12 },
        { r: 1, c: 13 },
        { r: 2, c: 12 },
        { r: 2, c: 13 },
      ], // Yellow (TR)
      [
        { r: 12, c: 12 },
        { r: 12, c: 13 },
        { r: 13, c: 12 },
        { r: 13, c: 13 },
      ], // Blue (BR)
      [
        { r: 12, c: 1 },
        { r: 12, c: 2 },
        { r: 13, c: 1 },
        { r: 13, c: 2 },
      ], // Green (BL)
    ];
    return bases[playerIndex][tokenIndex];
  }

  getHomeColumnPosition(playerIndex, position) {
    // position: 0 = entry, 4 = last before center, 5 = same as 4 (arrival)
    const columns = [
      // Red: row 7, cols 1→5 (left to center)
      [
        { r: 7, c: 1 },
        { r: 7, c: 2 },
        { r: 7, c: 3 },
        { r: 7, c: 4 },
        { r: 7, c: 5 },
        { r: 7, c: 5 },
      ],
      // Yellow: col 7, rows 1→5 (top to center)
      [
        { r: 1, c: 7 },
        { r: 2, c: 7 },
        { r: 3, c: 7 },
        { r: 4, c: 7 },
        { r: 5, c: 7 },
        { r: 5, c: 7 },
      ],
      // Blue: row 7, cols 13→9 (right to center)
      [
        { r: 7, c: 13 },
        { r: 7, c: 12 },
        { r: 7, c: 11 },
        { r: 7, c: 10 },
        { r: 7, c: 9 },
        { r: 7, c: 9 },
      ],
      // Green: col 7, rows 13→9 (bottom to center)
      [
        { r: 13, c: 7 },
        { r: 12, c: 7 },
        { r: 11, c: 7 },
        { r: 10, c: 7 },
        { r: 9, c: 7 },
        { r: 9, c: 7 },
      ],
    ];

    return columns[playerIndex][position];
  }

  getCenterPosition(playerIndex, tokenIndex) {
    // playerIndex: 0=Red(TL), 1=Yellow(TR), 2=Blue(BR), 3=Green(BL)
    const center = [
      { r: 6.5, c: 6.5 }, // Red (top-left)
      { r: 6.5, c: 7.5 }, // Yellow (top-right)
      { r: 7.5, c: 7.5 }, // Blue (bottom-right)
      { r: 7.5, c: 6.5 }, // Green (bottom-left)
    ];

    return center[playerIndex];
  }

  getCellFromPixel(x, y) {
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    return { r, c };
  }
}
