/**
 * auth-config.js
 * Shared Supabase configuration and auth helpers for the platform.
 *
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
 *   <script src="/assets/js/auth-config.js"></script>
 */

const DEFAULT_SUPABASE_URL = 'https://vqchjavjcfrewulqpjcl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxY2hqYXZqY2ZyZXd1bHFwamNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjgxMTEsImV4cCI6MjA5MTg0NDExMX0.g_yEVDMl-jiOow8KcOcCyVWCdzVq1yDoGPrmRdEy_4M';

const AUTH_ROUTE_LOGIN = '/login.html';
const AUTH_ROUTE_SIGNUP = '/signup.html';
const AUTH_ROUTE_DASHBOARD = '/dashboard.html';

const DEBUG_AUTH =
    Boolean(window.__AUTH_DEBUG__) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const runtimeConfig =
    typeof window.__SUPABASE_CONFIG__ === 'object' && window.__SUPABASE_CONFIG__ !== null
        ? window.__SUPABASE_CONFIG__
        : {};

const SUPABASE_URL = runtimeConfig.url || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = runtimeConfig.anonKey || DEFAULT_SUPABASE_ANON_KEY;

const AUTH_PAGE_PATHS = new Set([
    AUTH_ROUTE_LOGIN,
    AUTH_ROUTE_SIGNUP,
    AUTH_ROUTE_DASHBOARD
]);

const PROTECTED_PATH_PREFIXES = [
    AUTH_ROUTE_DASHBOARD,
    '/practice/',
    '/practice-advanced/'
];

let authState = {
    initialized: false,
    session: null
};

// Expose authState on window so other scripts can read initial/updated auth state
window.authState = authState;

let authReadyResolved = false;
let resolveAuthReady;

const authReadyPromise = new Promise((resolve) => {
    resolveAuthReady = resolve;
});

function resolveAuthReadyOnce(session) {
    if (authReadyResolved) {
        return;
    }

    authReadyResolved = true;
    resolveAuthReady(session || null);
}

function matchesProtectedPath(pathname, prefix) {
    if (prefix.endsWith('.html')) {
        return pathname === prefix;
    }

    return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
}

function isProtectedPath(pathname = window.location.pathname) {
    return PROTECTED_PATH_PREFIXES.some((prefix) => matchesProtectedPath(pathname, prefix));
}

function isSensitivePath(pathname = window.location.pathname) {
    return AUTH_PAGE_PATHS.has(pathname) || isProtectedPath(pathname);
}

function sanitizeText(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }

    const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    return normalized.slice(0, maxLength);
}

function normalizeGradeClass(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 6 || parsed > 12) {
        return null;
    }

    return parsed;
}

function getProfileSeed(session) {
    const user = session?.user;
    if (!user?.id) {
        return null;
    }

    return {
        id: user.id,
        email: sanitizeText(user.email || '', 255).toLowerCase() || null,
        full_name: sanitizeText(user.user_metadata?.full_name || '', 120) || null,
        grade_class: normalizeGradeClass(user.user_metadata?.grade_class),
        school_name: sanitizeText(user.user_metadata?.school_name || '', 160) || null
    };
}

function buildProfilePatch(existingProfile, seed, updateLastLogin) {
    const patch = {};

    if (!existingProfile) {
        patch.id = seed.id;

        if (seed.email) {
            patch.email = seed.email;
        }
        if (seed.full_name) {
            patch.full_name = seed.full_name;
        }
        if (seed.grade_class !== null) {
            patch.grade_class = seed.grade_class;
        }
        if (seed.school_name) {
            patch.school_name = seed.school_name;
        }
    } else {
        if (!existingProfile.email && seed.email) {
            patch.email = seed.email;
        }
        if (!existingProfile.full_name && seed.full_name) {
            patch.full_name = seed.full_name;
        }
        if ((existingProfile.grade_class === null || existingProfile.grade_class === undefined) && seed.grade_class !== null) {
            patch.grade_class = seed.grade_class;
        }
        if (!existingProfile.school_name && seed.school_name) {
            patch.school_name = seed.school_name;
        }
    }

    if (updateLastLogin) {
        patch.last_login = new Date().toISOString();
    }

    return patch;
}

function buildFallbackProfile(seed, existingProfile) {
    if (!seed && !existingProfile) {
        return null;
    }

    return {
        id: existingProfile?.id || seed?.id || null,
        email: existingProfile?.email || seed?.email || null,
        full_name: existingProfile?.full_name || seed?.full_name || '',
        grade_class: existingProfile?.grade_class ?? seed?.grade_class ?? null,
        school_name: existingProfile?.school_name || seed?.school_name || null
    };
}

function updateAuthState(session) {
    authState = {
        initialized: true,
        session: session || null
    };
    // Mirror the authState on window for other scripts to read synchronously
    window.authState = authState;
    resolveAuthReadyOnce(authState.session);

    window.dispatchEvent(
        new CustomEvent('rs:auth-state-change', {
            detail: {
                session: authState.session
            }
        })
    );
}

function handleAuthStateChange(eventName, session) {
    updateAuthState(session);

    if (!session && isProtectedPath(window.location.pathname)) {
        window.redirectToLogin();
        return;
    }

    if (DEBUG_AUTH) {
        window.logEvent('Auth state changed', { eventName });
    }
}

async function fetchProfileForSession(session) {
    if (!window.supabaseClient || !session?.user?.id) {
        return null;
    }

    const { data, error } = await window.supabaseClient
        .from('student_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch profile:', error);
        return null;
    }

    return data || null;
}

async function initializeAuth() {
    if (!window.supabaseClient) {
        resolveAuthReadyOnce(null);
        return;
    }

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
        console.error('Failed to initialize auth state:', error);
        updateAuthState(null);
        return;
    }

    updateAuthState(data.session);

    window.supabaseClient.auth.onAuthStateChange((eventName, session) => {
        handleAuthStateChange(eventName, session);
    });

    if (DEBUG_AUTH) {
        window.logEvent('Auth system initialized');
    }
}

window.supabaseClient = (() => {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Add this script before auth-config.js.');
        return null;
    }

    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();

window.whenAuthReady = function () {
    return authReadyPromise;
};

window.logEvent = function (eventName, eventData = {}) {
    if (!DEBUG_AUTH) {
        return;
    }

    console.log(`[${new Date().toISOString()}] ${eventName}:`, eventData);
};

window.markAuthReady = function () {
    document.documentElement.classList.remove('auth-pending');
    document.documentElement.classList.add('auth-ready');
};

window.getSafeRedirectPath = function (rawValue, fallback = AUTH_ROUTE_DASHBOARD, options = {}) {
    const allowAuthPages = Boolean(options.allowAuthPages);
    const safeFallback = typeof fallback === 'string' && fallback.startsWith('/') ? fallback : AUTH_ROUTE_DASHBOARD;

    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return safeFallback;
    }

    try {
        const url = new URL(rawValue, window.location.origin);
        if (url.origin !== window.location.origin) {
            return safeFallback;
        }

        const safePath = `${url.pathname}${url.search}${url.hash}`;
        if (!safePath.startsWith('/')) {
            return safeFallback;
        }

        if (!allowAuthPages && AUTH_PAGE_PATHS.has(url.pathname)) {
            return safeFallback;
        }

        return safePath;
    } catch (error) {
        return safeFallback;
    }
};

window.getPostAuthRedirectPath = function (fallback = AUTH_ROUTE_DASHBOARD) {
    const params = new URLSearchParams(window.location.search);
    return window.getSafeRedirectPath(params.get('redirect'), fallback);
};

window.buildLoginRedirectUrl = function (targetPath) {
    const requestedPath =
        typeof targetPath === 'string' && targetPath.trim()
            ? targetPath
            : `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const safePath = window.getSafeRedirectPath(requestedPath, AUTH_ROUTE_DASHBOARD);
    const loginUrl = new URL(AUTH_ROUTE_LOGIN, window.location.origin);
    loginUrl.searchParams.set('redirect', safePath);
    return `${loginUrl.pathname}${loginUrl.search}`;
};

window.redirectToPath = function (path, options = {}) {
    const safePath = window.getSafeRedirectPath(
        path,
        options.fallback || AUTH_ROUTE_DASHBOARD,
        { allowAuthPages: Boolean(options.allowAuthPages) }
    );

    if (options.replace) {
        window.location.replace(safePath);
        return;
    }

    window.location.assign(safePath);
};

window.redirectToLogin = function (targetPath) {
    const loginUrl = new URL(window.buildLoginRedirectUrl(targetPath), window.location.origin);
    window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);
};

window.getCurrentSession = async function () {
    if (!window.supabaseClient) {
        return null;
    }

    if (!authState.initialized) {
        await window.whenAuthReady();
    }

    return authState.session;
};

window.getCurrentUser = async function () {
    const session = await window.getCurrentSession();
    return session?.user || null;
};

window.syncUserProfile = async function (options = {}) {
    const session = options.session || await window.getCurrentSession();
    if (!session || !window.supabaseClient) {
        return null;
    }

    const seed = getProfileSeed(session);
    if (!seed?.id) {
        return null;
    }

    const existingProfile = options.profile !== undefined
        ? options.profile
        : await fetchProfileForSession(session);

    const patch = buildProfilePatch(existingProfile, seed, Boolean(options.updateLastLogin));
    const fallbackProfile = buildFallbackProfile(seed, existingProfile);

    if (!Object.keys(patch).length) {
        return fallbackProfile;
    }

    try {
        let result;

        if (existingProfile) {
            result = await window.supabaseClient
                .from('student_profiles')
                .update(patch)
                .eq('id', seed.id)
                .select('*')
                .maybeSingle();
        } else {
            if (!patch.email) {
                return fallbackProfile;
            }

            result = await window.supabaseClient
                .from('student_profiles')
                .insert(patch)
                .select('*')
                .maybeSingle();
        }

        if (result.error) {
            console.error('Failed to sync profile:', result.error);
            return fallbackProfile;
        }

        return result.data || fallbackProfile;
    } catch (error) {
        console.error('Unexpected error while syncing profile:', error);
        return fallbackProfile;
    }
};

window.getUserProfile = async function (options = {}) {
    const session = await window.getCurrentSession();
    if (!session) {
        return null;
    }

    const existingProfile = await fetchProfileForSession(session);

    if (options.sync === false) {
        return buildFallbackProfile(getProfileSeed(session), existingProfile);
    }

    return window.syncUserProfile({
        session,
        profile: existingProfile,
        updateLastLogin: Boolean(options.updateLastLogin)
    });
};

window.clearSensitiveCaches = async function () {
    if (!('caches' in window)) {
        return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();

            await Promise.all(
                requests
                    .filter((request) => {
                        try {
                            const url = new URL(request.url);
                            return url.origin === window.location.origin && isSensitivePath(url.pathname);
                        } catch (error) {
                            return false;
                        }
                    })
                    .map((request) => cache.delete(request))
            );
        })
    );
};

window.signOut = async function () {
    if (!window.supabaseClient) {
        throw new Error('Supabase client is not initialized.');
    }

    const { error } = await window.supabaseClient.auth.signOut();
    if (error) {
        console.error('Sign out failed:', error);
        throw error;
    }

    await window.clearSensitiveCaches();

    const loginUrl = new URL(window.buildLoginRedirectUrl(), window.location.origin);
    loginUrl.searchParams.set('message', 'signed-out');
    window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);
};

window.requireAuth = async function () {
    const session = await window.getCurrentSession();
    if (!session) {
        window.redirectToLogin();
        return false;
    }

    return true;
};

window.redirectAuthenticatedUser = async function (fallback = AUTH_ROUTE_DASHBOARD) {
    const session = await window.getCurrentSession();
    if (!session) {
        return false;
    }

    const redirectPath = window.getPostAuthRedirectPath(fallback);
    window.redirectToPath(redirectPath, { replace: true });
    return true;
};

window.isAuthenticated = async function () {
    const session = await window.getCurrentSession();
    return session !== null;
};

initializeAuth();
