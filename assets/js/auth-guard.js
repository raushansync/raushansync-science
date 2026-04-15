/**
 * auth-guard.js
 * Global authentication guard for automatic page protection.
 * 
 * This script should be included on ALL pages in the <head> or early in <body>.
 * It automatically enforces authentication on protected routes.
 * 
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
 *   <script src="/assets/js/auth-config.js"></script>
 *   <script src="/assets/js/auth-guard.js"></script>
 * 
 * Features:
 * - Automatically redirects unauthenticated users to login
 * - Prevents page flash by hiding content during auth check
 * - Automatically redirects authenticated users away from auth pages
 * - Works seamlessly with existing auth system
 * - Non-blocking error handling
 */

(function authGuard() {
    // Early return if auth-config not loaded
    if (typeof window.whenAuthReady !== 'function') {
        console.warn('auth-guard.js: auth-config.js not loaded. Include auth-config.js before auth-guard.js');
        return;
    }

    const isAuthPage = () => {
        const pathname = window.location.pathname;
        const authPages = ['/login.html', '/signup.html'];
        return authPages.some(page => pathname === page || pathname.endsWith(page));
    };

    const isProtectedPage = () => {
        if (typeof window.isProtectedPath !== 'function') {
            console.warn('auth-guard.js: isProtectedPath not available');
            return false;
        }
        return window.isProtectedPath(window.location.pathname);
    };

    const markAuthReady = () => {
        if (typeof window.markAuthReady === 'function') {
            window.markAuthReady();
        }
    };

    const handleAuthCheck = async () => {
        try {
            // Wait for auth to initialize
            const session = await window.whenAuthReady();

            // Case 1: Protected page without authentication
            if (isProtectedPage() && !session) {
                if (typeof window.redirectToLogin === 'function') {
                    window.redirectToLogin();
                    return; // Exit to prevent further execution
                }
            }

            // Case 2: Auth page with active session
            if (isAuthPage() && session) {
                // Redirect authenticated user away from login/signup
                const fallback = typeof window.AUTH_ROUTE_DASHBOARD !== 'undefined' 
                    ? window.AUTH_ROUTE_DASHBOARD 
                    : '/dashboard.html';
                
                if (typeof window.redirectToPath === 'function') {
                    window.redirectToPath(fallback, { replace: true });
                    return; // Exit to prevent further execution
                }
            }

            // Case 3: All other cases - mark auth as ready and show content
            markAuthReady();

        } catch (error) {
            console.error('auth-guard.js: Unexpected error during auth check', error);
            // On error, mark auth as ready to show content (assume user should see login page if needed)
            markAuthReady();
        }
    };

    // Initiate auth check when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleAuthCheck);
    } else {
        // DOM already loaded (e.g., script included late)
        handleAuthCheck();
    }

    // Safety timeout: if auth check doesn't complete within 5 seconds, show content anyway
    // This prevents permanent page hiding if auth service fails
    setTimeout(() => {
        if (!document.documentElement.classList.contains('auth-ready')) {
            console.warn('auth-guard.js: Auth check timeout, showing content');
            markAuthReady();
        }
    }, 5000);
})();
