// Ludo Board Renderer — Standard Layout
// Red=top-left, Yellow=top-right, Blue=bottom-right, Green=bottom-left

class LudoBoard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 15;
        this.cellSize = 0;
        this.boardSize = 0;
        
        this.colors = {
            red: '#e74c3c',
            blue: '#3498db',
            green: '#2ecc71',
            yellow: '#f1c40f',
            white: '#faf8f5',
            dark: '#ede6d8',
            path: '#fff'
        };
        
        this.layout = this.createLayout();
        this.safeSquares = [0, 8, 13, 21, 26, 34, 39, 47];
        this.editMode = false;
        this.selectedCell = null;
        
        this.setupEditor();
        this.updateThemeColors();
        this.deferredResize();
        window.addEventListener('resize', () => this.resize());
    }

    updateThemeColors() {
        const style = getComputedStyle(document.documentElement);
        this.colors.dark = style.getPropertyValue('--canvas-bg').trim() || '#ede6d8';
        this.colors.path = style.getPropertyValue('--dice-bg').trim() || '#fff';
        this.colors.white = style.getPropertyValue('--surface-alt').trim() || '#faf8f5';
    }
    
    setupEditor() {
        this.canvas.addEventListener('click', (e) => {
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
                const typeNames = { 0: 'Empty', 1: 'Path', 2: 'Home Base', 3: 'Home Column', 4: 'Center' };
                const info = `Row ${r}, Col ${c} | Type: ${typeNames[this.layout[r][c]]}${trackPos >= 0 ? ' | Track: ' + trackPos : ''}`;
                document.getElementById('tile-info').textContent = info;
                document.getElementById('tile-editor').style.display = 'block';
                document.getElementById('tile-color').value = this.getCellColor(r, c);
                document.getElementById('tile-type').value = this.layout[r][c];
            }
        });
        
        document.getElementById('tile-color').addEventListener('input', () => {
            if (!this.selectedCell) return;
            this.applyEdit();
        });
        
        document.getElementById('tile-type').addEventListener('change', () => {
            if (!this.selectedCell) return;
            this.applyEdit();
        });
        
        document.getElementById('save-board-btn').addEventListener('click', () => {
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
        fetch('/save-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: layout }) })
            .then(function(r) { return r.json(); })
            .then(function(data) { alert(data.success ? 'Saved! Restart server.' : 'Save failed: ' + data.error); });
    }
    
    getCellColor(r, c) {
        const type = this.layout[r][c];
        switch (type) {
            case 2: return this.getHomeBaseColor(r, c);
            case 3: return this.getHomeColumnColor(r, c);
            case 1: return this.colors.path;
            case 0: return this.colors.dark;
            default: return '#ffffff';
        }
    }
    
    applyEdit() {
        const { r, c } = this.selectedCell;
        this.layout[r][c] = parseInt(document.getElementById('tile-type').value);
        if (this.layout[r][c] === 1) {
            this.colors.path = document.getElementById('tile-color').value;
        }
        this.draw();
        this.highlightSelected();
    }
    
    highlightSelected() {
        if (!this.selectedCell) return;
        const { r, c } = this.selectedCell;
        const ctx = this.ctx;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
    }
    
    toggleEditMode() {
        this.editMode = !this.editMode;
        this.canvas.style.cursor = this.editMode ? 'crosshair' : 'default';
        this.canvas.style.pointerEvents = this.editMode ? 'auto' : 'none';
        if (!this.editMode) {
            document.getElementById('tile-editor').style.display = 'none';
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
        var grid = Array(15).fill(null).map(function() { return Array(15).fill(0); });
        grid[0][0] = 2;
        grid[0][1] = 2;
        grid[0][2] = 2;
        grid[0][3] = 2;
        grid[0][6] = 1;
        grid[0][7] = 1;
        grid[0][8] = 1;
        grid[0][11] = 2;
        grid[0][12] = 2;
        grid[0][13] = 2;
        grid[0][14] = 2;
        grid[1][0] = 2;
        grid[1][1] = 2;
        grid[1][2] = 2;
        grid[1][3] = 2;
        grid[1][6] = 1;
        grid[1][7] = 3;
        grid[1][8] = 1;
        grid[1][11] = 2;
        grid[1][12] = 2;
        grid[1][13] = 2;
        grid[1][14] = 2;
        grid[2][0] = 2;
        grid[2][1] = 2;
        grid[2][2] = 2;
        grid[2][3] = 2;
        grid[2][6] = 1;
        grid[2][7] = 3;
        grid[2][8] = 1;
        grid[2][11] = 2;
        grid[2][12] = 2;
        grid[2][13] = 2;
        grid[2][14] = 2;
        grid[3][0] = 2;
        grid[3][1] = 2;
        grid[3][2] = 2;
        grid[3][3] = 2;
        grid[3][6] = 1;
        grid[3][7] = 3;
        grid[3][8] = 1;
        grid[3][11] = 2;
        grid[3][12] = 2;
        grid[3][13] = 2;
        grid[3][14] = 2;
        grid[4][6] = 1;
        grid[4][7] = 3;
        grid[4][8] = 1;
        grid[5][6] = 1;
        grid[5][7] = 3;
        grid[5][8] = 1;
        grid[6][0] = 1;
        grid[6][1] = 1;
        grid[6][2] = 1;
        grid[6][3] = 1;
        grid[6][4] = 1;
        grid[6][5] = 1;
        grid[6][6] = 4;
        grid[6][7] = 4;
        grid[6][8] = 4;
        grid[6][9] = 1;
        grid[6][10] = 1;
        grid[6][11] = 1;
        grid[6][12] = 1;
        grid[6][13] = 1;
        grid[6][14] = 1;
        grid[7][0] = 1;
        grid[7][1] = 3;
        grid[7][2] = 3;
        grid[7][3] = 3;
        grid[7][4] = 3;
        grid[7][5] = 3;
        grid[7][6] = 4;
        grid[7][7] = 4;
        grid[7][8] = 4;
        grid[7][9] = 3;
        grid[7][10] = 3;
        grid[7][11] = 3;
        grid[7][12] = 3;
        grid[7][13] = 3;
        grid[7][14] = 1;
        grid[8][0] = 1;
        grid[8][1] = 1;
        grid[8][2] = 1;
        grid[8][3] = 1;
        grid[8][4] = 1;
        grid[8][5] = 1;
        grid[8][6] = 4;
        grid[8][7] = 4;
        grid[8][8] = 4;
        grid[8][9] = 1;
        grid[8][10] = 1;
        grid[8][11] = 1;
        grid[8][12] = 1;
        grid[8][13] = 1;
        grid[8][14] = 1;
        grid[9][6] = 1;
        grid[9][7] = 3;
        grid[9][8] = 1;
        grid[10][6] = 1;
        grid[10][7] = 3;
        grid[10][8] = 1;
        grid[11][0] = 2;
        grid[11][1] = 2;
        grid[11][2] = 2;
        grid[11][3] = 2;
        grid[11][6] = 1;
        grid[11][7] = 3;
        grid[11][8] = 1;
        grid[11][11] = 2;
        grid[11][12] = 2;
        grid[11][13] = 2;
        grid[11][14] = 2;
        grid[12][0] = 2;
        grid[12][1] = 2;
        grid[12][2] = 2;
        grid[12][3] = 2;
        grid[12][6] = 1;
        grid[12][7] = 3;
        grid[12][8] = 1;
        grid[12][11] = 2;
        grid[12][12] = 2;
        grid[12][13] = 2;
        grid[12][14] = 2;
        grid[13][0] = 2;
        grid[13][1] = 2;
        grid[13][2] = 2;
        grid[13][3] = 2;
        grid[13][6] = 1;
        grid[13][7] = 3;
        grid[13][8] = 1;
        grid[13][11] = 2;
        grid[13][12] = 2;
        grid[13][13] = 2;
        grid[13][14] = 2;
        grid[14][0] = 2;
        grid[14][1] = 2;
        grid[14][2] = 2;
        grid[14][3] = 2;
        grid[14][6] = 1;
        grid[14][7] = 1;
        grid[14][8] = 1;
        grid[14][11] = 2;
        grid[14][12] = 2;
        grid[14][13] = 2;
        grid[14][14] = 2;
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
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        
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
                    case 0: ctx.fillStyle = this.colors.dark; break;
                    case 1: ctx.fillStyle = this.colors.path; break;
                    case 2: ctx.fillStyle = this.getHomeBaseColor(r, c); break;
                    case 3: ctx.fillStyle = this.getHomeColumnColor(r, c); break;
                    case 4: ctx.fillStyle = this.colors.dark; break;
                }
                
                ctx.fillRect(x, y, cellSize, cellSize);
                
                // Cell border
                ctx.strokeStyle = this.colors.dark;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellSize, cellSize);
                
                // Safe squares (small subtle dot, clearly not a player token)
                if (type === 1 && this.isSafeSquare(r, c)) {
                    this.drawStar(ctx, x + cellSize/2, y + cellSize/2, 5, cellSize * 0.2, cellSize * 0.1);
                }
            }
        }
        
        // Draw center triangles
        this.drawCenter();
        
        // Draw START arrows, HOME labels, BACK labels
        this.drawLabels();
    }
    
    getHomeBaseColor(r, c) {
        if (r < 4 && c < 4) {           // Top-left (Red)
            if (r >= 1 && r <= 2 && c >= 1 && c <= 2) return this.colors.white;
            return this.colors.red;
        }
        if (r < 4 && c > 10) {          // Top-right (Yellow)
            if (r >= 1 && r <= 2 && c >= 12 && c <= 13) return this.colors.white;
            return this.colors.yellow;
        }
        if (r > 10 && c > 10) {         // Bottom-right (Blue)
            if (r >= 12 && r <= 13 && c >= 12 && c <= 13) return this.colors.white;
            return this.colors.blue;
        }
        if (r > 10 && c < 4) {          // Bottom-left (Green)
            if (r >= 12 && r <= 13 && c >= 1 && c <= 2) return this.colors.white;
            return this.colors.green;
        }
        return this.colors.dark;
    }
    
    getHomeColumnColor(r, c) {
        if (c === 7 && r >= 1 && r <= 5) return this.colors.red;      // Top → center (stops before row 6)
        if (r === 7 && c >= 9 && c <= 13) return this.colors.yellow;   // Right → center (stops before col 8)
        if (c === 7 && r >= 9 && r <= 13) return this.colors.blue;     // Bottom → center (stops before row 8)
        if (r === 7 && c >= 1 && c <= 5) return this.colors.green;     // Left → center (stops before col 6)
        return this.colors.white;
    }
    
    isSafeSquare(r, c) {
        const trackPos = this.gridToTrack(r, c);
        return this.safeSquares.includes(trackPos);
    }
    
    gridToTrack(r, c) {
        // Clockwise track: Red starts at 0 (top-left), Yellow at 13, Blue at 26, Green at 39
        if (r === 0 && c === 6) return 0;
        if (r === 0 && c === 7) return 1;
        if (r === 0 && c === 8) return 2;
        if (r === 1 && c === 8) return 3;
        if (r === 2 && c === 8) return 4;
        if (r === 3 && c === 8) return 5;
        if (r === 4 && c === 8) return 6;
        if (r === 5 && c === 8) return 7;
        if (r === 6 && c === 9) return 8;
        if (r === 6 && c === 10) return 9;
        if (r === 6 && c === 11) return 10;
        if (r === 6 && c === 12) return 11;
        if (r === 6 && c === 13) return 12;
        if (r === 6 && c === 14) return 13;
        if (r === 7 && c === 14) return 14;
        if (r === 8 && c === 14) return 15;
        if (r === 8 && c === 13) return 16;
        if (r === 8 && c === 12) return 17;
        if (r === 8 && c === 11) return 18;
        if (r === 8 && c === 10) return 19;
        if (r === 8 && c === 9) return 20;
        if (r === 9 && c === 8) return 21;
        if (r === 10 && c === 8) return 22;
        if (r === 11 && c === 8) return 23;
        if (r === 12 && c === 8) return 24;
        if (r === 13 && c === 8) return 25;
        if (r === 14 && c === 8) return 26;
        if (r === 14 && c === 7) return 27;
        if (r === 14 && c === 6) return 28;
        if (r === 13 && c === 6) return 29;
        if (r === 12 && c === 6) return 30;
        if (r === 11 && c === 6) return 31;
        if (r === 10 && c === 6) return 32;
        if (r === 9 && c === 6) return 33;
        if (r === 8 && c === 5) return 34;
        if (r === 8 && c === 4) return 35;
        if (r === 8 && c === 3) return 36;
        if (r === 8 && c === 2) return 37;
        if (r === 8 && c === 1) return 38;
        if (r === 8 && c === 0) return 39;
        if (r === 7 && c === 0) return 40;
        if (r === 6 && c === 0) return 41;
        if (r === 6 && c === 1) return 42;
        if (r === 6 && c === 2) return 43;
        if (r === 6 && c === 3) return 44;
        if (r === 6 && c === 4) return 45;
        if (r === 6 && c === 5) return 46;
        if (r === 5 && c === 6) return 47;
        if (r === 4 && c === 6) return 48;
        if (r === 3 && c === 6) return 49;
        if (r === 2 && c === 6) return 50;
        if (r === 1 && c === 6) return 51;
        
        return -1;
    }
    
    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
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
        ctx.fillStyle = '#f39c12';
        ctx.fill();
        ctx.strokeStyle = '#e67e22';
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
        ctx.fillStyle = this.colors.red;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + sz, oy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
        
        // Yellow triangle (top-right quadrant)
        ctx.fillStyle = this.colors.yellow;
        ctx.beginPath();
        ctx.moveTo(ox + sz, oy);
        ctx.lineTo(ox + sz, oy + sz);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
        
        // Blue triangle (bottom-right quadrant)
        ctx.fillStyle = this.colors.blue;
        ctx.beginPath();
        ctx.moveTo(ox + sz, oy + sz);
        ctx.lineTo(ox, oy + sz);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
        
        // Green triangle (bottom-left quadrant)
        ctx.fillStyle = this.colors.green;
        ctx.beginPath();
        ctx.moveTo(ox, oy + sz);
        ctx.lineTo(ox, oy);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
    }
    
    drawLabels() {
        const ctx = this.ctx;
        const cs = this.cellSize;
        
        // START labels — inside each home base (centered in 4x4)
        ctx.font = `bold ${cs * 0.65}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        
        // Red START (top-left base, center of 4x4)
        ctx.fillText('START', 2 * cs, 3.5 * cs);
        
        // Yellow START (top-right base, center of 4x4)
        ctx.fillText('START', 13 * cs, 3.5 * cs);
        
        // Blue START (bottom-right base, center of 4x4)
        ctx.fillText('START', 13 * cs, 11.5 * cs);
        
        // Green START (bottom-left base, center of 4x4)
        ctx.fillText('START', 2 * cs, 11.5 * cs);
        
        // HOME labels — on home columns near center
        ctx.font = `bold ${cs * 0.45}px Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        
        // Red HOME (col 7, row 6)
        ctx.fillText('HOME', 7.5 * cs, 6.5 * cs);
        
        // Yellow HOME (row 7, col 8)
        ctx.save();
        ctx.translate(8.5 * cs, 7.5 * cs);
        ctx.fillText('HOME', 0, 0);
        ctx.restore();
        
        // Blue HOME (col 7, row 8)
        ctx.fillText('HOME', 7.5 * cs, 8.5 * cs);
        
        // Green HOME (row 7, col 6)
        ctx.save();
        ctx.translate(6.5 * cs, 7.5 * cs);
        ctx.fillText('HOME', 0, 0);
        ctx.restore();
        
        // BACK labels — at home column entry points
        ctx.font = `bold ${cs * 0.4}px Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        
        // Red BACK (top of home column at row 1)
        ctx.fillText('BACK', 7.5 * cs, 1.5 * cs);
        
        // Yellow BACK (right of home column at col 13)
        ctx.save();
        ctx.translate(13.5 * cs, 7.5 * cs);
        ctx.fillText('BACK', 0, 0);
        ctx.restore();
        
        // Blue BACK (bottom of home column at row 13)
        ctx.fillText('BACK', 7.5 * cs, 13.5 * cs);
        
        // Green BACK (left of home column at col 1)
        ctx.save();
        ctx.translate(1.5 * cs, 7.5 * cs);
        ctx.fillText('BACK', 0, 0);
        ctx.restore();
    }
    
    drawArrow(ctx, x1, y1, x2, y2) {
        // Simplified — just draw a small triangle indicator
        const size = this.cellSize * 0.15;
        ctx.fillStyle = '#fff';
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
        
        if (trackPos.type === 'track') {
            const gridPos = this.trackToGrid(trackPos.position);
            x = gridPos.c * cellSize + cellSize / 2;
            y = gridPos.r * cellSize + cellSize / 2;
        } else if (trackPos.type === 'home') {
            const basePos = this.getHomeBasePosition(trackPos.base, trackPos.index);
            x = basePos.c * cellSize + cellSize / 2;
            y = basePos.r * cellSize + cellSize / 2;
        } else if (trackPos.type === 'homeColumn') {
            const colPos = this.getHomeColumnPosition(trackPos.base, trackPos.position);
            x = colPos.c * cellSize + cellSize / 2;
            y = colPos.r * cellSize + cellSize / 2;
        } else if (trackPos.type === 'finished') {
            const centerPos = this.getCenterPosition(trackPos.base, trackPos.index);
            x = centerPos.c * cellSize + cellSize / 2;
            y = centerPos.r * cellSize + cellSize / 2;
        }
        
        ctx.beginPath();
        ctx.arc(x, y, cellSize * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = this.colors[color];
        ctx.fill();
        
        ctx.strokeStyle = isSelected ? '#fff' : '#333';
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
            {r: 0, c: 6}, {r: 0, c: 7}, {r: 0, c: 8}, {r: 1, c: 8},
            {r: 2, c: 8}, {r: 3, c: 8}, {r: 4, c: 8}, {r: 5, c: 8},
            {r: 6, c: 9}, {r: 6, c: 10}, {r: 6, c: 11}, {r: 6, c: 12},
            {r: 6, c: 13}, {r: 6, c: 14}, {r: 7, c: 14}, {r: 8, c: 14},
            {r: 8, c: 13}, {r: 8, c: 12}, {r: 8, c: 11}, {r: 8, c: 10},
            {r: 8, c: 9}, {r: 9, c: 8}, {r: 10, c: 8}, {r: 11, c: 8},
            {r: 12, c: 8}, {r: 13, c: 8}, {r: 14, c: 8}, {r: 14, c: 7},
            {r: 14, c: 6}, {r: 13, c: 6}, {r: 12, c: 6}, {r: 11, c: 6},
            {r: 10, c: 6}, {r: 9, c: 6}, {r: 8, c: 5}, {r: 8, c: 4},
            {r: 8, c: 3}, {r: 8, c: 2}, {r: 8, c: 1}, {r: 8, c: 0},
            {r: 7, c: 0}, {r: 6, c: 0}, {r: 6, c: 1}, {r: 6, c: 2},
            {r: 6, c: 3}, {r: 6, c: 4}, {r: 6, c: 5}, {r: 5, c: 6},
            {r: 4, c: 6}, {r: 3, c: 6}, {r: 2, c: 6}, {r: 1, c: 6}
        ];
        
        return trackMap[position] || {r: 0, c: 0};
    }
    
    getHomeBasePosition(playerIndex, tokenIndex) {
        // playerIndex: 0=Red(TL), 1=Yellow(TR), 2=Blue(BR), 3=Green(BL)
        // 4x4 home bases with 2x2 token arrangement
        const bases = [
            [{r: 1, c: 1}, {r: 1, c: 2}, {r: 2, c: 1}, {r: 2, c: 2}],          // Red (inner 2x2 TL)
            [{r: 1, c: 12}, {r: 1, c: 13}, {r: 2, c: 12}, {r: 2, c: 13}],      // Yellow (inner 2x2 TR)
            [{r: 12, c: 12}, {r: 12, c: 13}, {r: 13, c: 12}, {r: 13, c: 13}],  // Blue (inner 2x2 BR)
            [{r: 12, c: 1}, {r: 12, c: 2}, {r: 13, c: 1}, {r: 13, c: 2}]       // Green (inner 2x2 BL)
        ];
        
        return bases[playerIndex][tokenIndex];
    }
    
    getHomeColumnPosition(playerIndex, position) {
        // playerIndex: 0=Red, 1=Yellow, 2=Blue, 3=Green
        // position: 0 = first square after entering, 5 = last square before center
        // Home columns end ONE cell before center area (rows 6-8, cols 6-8)
        const columns = [
            [{r: 1, c: 7}, {r: 2, c: 7}, {r: 3, c: 7}, {r: 4, c: 7}, {r: 5, c: 7}, {r: 5, c: 7}],  // Red (top → center, last pos overlaps at row 5)
            [{r: 7, c: 13}, {r: 7, c: 12}, {r: 7, c: 11}, {r: 7, c: 10}, {r: 7, c: 9}, {r: 7, c: 9}], // Yellow (right → center, last pos overlaps at col 9)
            [{r: 13, c: 7}, {r: 12, c: 7}, {r: 11, c: 7}, {r: 10, c: 7}, {r: 9, c: 7}, {r: 9, c: 7}], // Blue (bottom → center, last pos overlaps at row 9)
            [{r: 7, c: 1}, {r: 7, c: 2}, {r: 7, c: 3}, {r: 7, c: 4}, {r: 7, c: 5}, {r: 7, c: 5}]   // Green (left → center, last pos overlaps at col 5)
        ];
        
        return columns[playerIndex][position];
    }
    
    getCenterPosition(playerIndex, tokenIndex) {
        // playerIndex: 0=Red(TL), 1=Yellow(TR), 2=Blue(BR), 3=Green(BL)
        const center = [
            {r: 6.5, c: 6.5}, // Red (top-left)
            {r: 6.5, c: 7.5}, // Yellow (top-right)
            {r: 7.5, c: 7.5}, // Blue (bottom-right)
            {r: 7.5, c: 6.5}  // Green (bottom-left)
        ];
        
        return center[playerIndex];
    }
    
    getCellFromPixel(x, y) {
        const c = Math.floor(x / this.cellSize);
        const r = Math.floor(y / this.cellSize);
        return { r, c };
    }
}