document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    const themeButtons = document.querySelectorAll('.theme-opt-btn');
    
    // Helper to apply theme
    function applyTheme(theme) {
        // Remove existing overrides
        html.classList.remove('dark', 'light');
        
        if (theme === 'system') {
            localStorage.removeItem('theme');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                html.classList.add('dark');
            }
        } else {
            localStorage.setItem('theme', theme);
            html.classList.add(theme);
        }
        
        updateActiveButton(theme);
    }

    function updateActiveButton(activeTheme) {
        // If no theme in localstorage, it is 'system'
        const current = activeTheme || localStorage.getItem('theme') || 'system';
        
        themeButtons.forEach(btn => {
            // Check if button's data-theme matches current setting
            // We need to handle the case where 'system' was passed but localstorage is null
            let btnTheme = btn.dataset.theme;
            
            if (btnTheme === current) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Initial Load
    const savedTheme = localStorage.getItem('theme') || 'system';
    applyTheme(savedTheme);

    // Event Listeners
    themeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Prevent menu from closing immediately if logic was doing that
            e.stopPropagation(); 
            const theme = e.currentTarget.dataset.theme;
            applyTheme(theme);
        });
    });

    // Listen for system changes if in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) html.classList.add('dark');
            else html.classList.remove('dark');
        }
    });
});