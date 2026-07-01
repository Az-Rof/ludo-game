// Ludo Game Main Entry Point

// Theme management
(function initTheme() {
    const html = document.documentElement;
    const saved = localStorage.getItem('ludo-theme');

    if (saved) {
        html.setAttribute('data-theme', saved);
    }
    // no saved preference → dark mode is default (no data-theme attribute needed)

    // Update toggle button icon to match current theme
    function updateToggleIcon() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const theme = html.getAttribute('data-theme');
        btn.textContent = theme === 'light' ? '☀️' : '🌙';
    }

    // Wait for DOM, then set icon and wire toggle
    document.addEventListener('DOMContentLoaded', () => {
        updateToggleIcon();

        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const current = html.getAttribute('data-theme');
                const next = current === 'light' ? '' : 'light';
                if (next) {
                    html.setAttribute('data-theme', next);
                } else {
                    html.removeAttribute('data-theme');
                }
                localStorage.setItem('ludo-theme', next || 'dark');
                updateToggleIcon();

                // Re-render board if it exists (canvas colors)
                if (window.board) {
                    window.board.updateThemeColors();
                    window.board.draw();
                }
            });
        }

        console.log('Ludo Game initializing...');
        window.ui = new LudoUI();
        console.log('Ludo Game ready!');
    });
})();
