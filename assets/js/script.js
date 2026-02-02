document.addEventListener('DOMContentLoaded', () => {

    // --- Dark Mode Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    const applySavedTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            root.classList.add('dark-mode');
        } else {
            root.classList.remove('dark-mode');
        }
    };

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = root.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    applySavedTheme();

    // --- Mobile Navigation ---
    const hamburgerBtn = document.getElementById('hamburger');
    const navLinksContainer = document.querySelector('.nav-links');

    if (hamburgerBtn && navLinksContainer) {
        hamburgerBtn.addEventListener('click', () => {
            const isOpen = navLinksContainer.classList.toggle('active');
            hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        });

        navLinksContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'A') {
                navLinksContainer.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- Active Navbar Link Highlighter ---
    const currentPagePath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        if (
            linkPath !== '/' &&
            (currentPagePath === linkPath || currentPagePath.startsWith(linkPath + '/'))
        ) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });

    // --- Footer component loader ---
    // Loads /components/footer.html into the element with id "footer".
    // Tries absolute root first, then relative paths based on current URL depth.
    async function loadFooter() {
        const mount = document.getElementById('footer');
        if (!mount) return;

        const candidates = [];
        // try absolute path first (works on most static hosts when site root is used)
        candidates.push('/components/footer.html');

        // build relative attempts like 'components/footer.html', '../components/footer.html', '../../components/footer.html', ...
        const segments = window.location.pathname.split('/').filter(Boolean);
        // if the last segment looks like a file (contains a dot), don't count it as a directory
        let depth = segments.length;
        if (segments.length && segments[segments.length - 1].includes('.')) depth = Math.max(0, depth - 1);

        for (let i = 0; i <= depth; i++) {
            const rel = (i === 0 ? 'components/footer.html' : '../'.repeat(i) + 'components/footer.html');
            if (!candidates.includes(rel)) candidates.push(rel);
        }

        for (const url of candidates) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) continue;
                const html = await res.text();
                mount.innerHTML = html;
                return;
            } catch (e) {
                // try next candidate
            }
        }
    }

    // load footer after DOM-ready UI wiring
    loadFooter();
});
