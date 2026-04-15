# Auth Guard - Quick Reference

## Files Overview

| File | Purpose | Required? | Location |
|------|---------|-----------|----------|
| `auth-config.js` | Session mgmt, Supabase setup | ✅ All pages | `/assets/js/auth-config.js` |
| `auth-guard.js` | Auto-redirect for protection | ✅ Protected pages only | `/assets/js/auth-guard.js` |
| `auth-logout-handler.js` | Logout button handler | ❌ Optional | `/assets/js/auth-logout-handler.js` |

---

## For Protected Pages (Dashboard, Practice, etc.)

### Minimum HTML Template

```html
<!DOCTYPE html>
<html>
<head>
    <title>Protected Page</title>
    
    <!-- Auth Scripts (order matters!) -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <script src="/assets/js/auth-guard.js"></script>
    
    <!-- Hide content during auth check -->
    <script>
        document.documentElement.classList.add("auth-pending");
    </script>
    <style>
        html.auth-pending body > * { visibility: hidden; }
        html.auth-pending body::before {
            content: "Loading...";
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f3f4f6;
            color: #3b82f6;
            font: 600 1.125rem "Poppins", sans-serif;
            visibility: visible;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <h1>Protected Content</h1>
    <!-- Your content -->
</body>
</html>
```

---

## For Public Pages (Index, About, etc.)

### Minimum HTML Template

```html
<!DOCTYPE html>
<html>
<head>
    <title>Public Page</title>
    
    <!-- Only auth-config, NO auth-guard -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <!-- auth-guard NOT included here -->
</head>
<body>
    <h1>Public Content</h1>
    <p>Anyone can see this page.</p>
    
    <!-- Check auth state to show different UI -->
    <script>
        window.whenAuthReady().then(session => {
            if (session) {
                console.log('User is logged in');
            } else {
                console.log('User is not logged in');
            }
        });
    </script>
</body>
</html>
```

---

## Common Code Snippets

### Logout Button

```html
<button data-action="logout">Sign Out</button>
<script src="/assets/js/auth-logout-handler.js"></script>
```

### Check If User Is Logged In

```javascript
if (await window.isAuthenticated()) {
    console.log('User is logged in');
}
```

### Get Current User

```javascript
const user = await window.getCurrentUser();
console.log('Email:', user?.email);
```

### Get User Profile

```javascript
const profile = await window.getUserProfile();
console.log('Name:', profile?.full_name);
console.log('Grade:', profile?.grade_class);
```

### Handle Login in Form

```javascript
const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'password123'
});

if (error) {
    console.error('Login failed:', error.message);
} else {
    window.location.replace('/dashboard.html');
}
```

### Require Auth for an Action

```javascript
async function doSomethingProtected() {
    const isAuthenticated = await window.requireAuth();
    if (!isAuthenticated) return; // User redirected
    
    // Safe to proceed - user is authenticated
    console.log('Doing protected action...');
}
```

---

## Browser Console Commands (Debug Mode)

Enable first:
```javascript
window.__AUTH_DEBUG__ = true;
```

Then check:
```javascript
// Is auth initialized?
console.log(window.authState.initialized);

// Is user logged in?
console.log(window.authState.session);

// Get current session
await window.getCurrentSession();

// Get user profile
await window.getUserProfile();

// Manual redirect to login
window.redirectToLogin();
```

---

## Auth Pages Exception

**These pages should NOT include auth-guard:**
- `/login.html` - Unauthenticated users need to see this
- `/signup.html` - Unauthenticated users need to see this

If a logged-in user visits these pages, auth-guard will automatically redirect them to dashboard.

---

## Protected Paths (Default)

Pages under these paths require login:
- `/dashboard.html`
- `/practice/*`
- `/practice-advanced/*`

To add more protected paths, edit `auth-config.js` and update `PROTECTED_PATH_PREFIXES`:

```javascript
const PROTECTED_PATH_PREFIXES = [
    '/dashboard.html',
    '/practice/',
    '/practice-advanced/',
    '/your-path/'  // Add your protected path
];
```

---

## Redirect Logic

| Scenario | Action |
|----------|--------|
| User not logged in + visits `/dashboard.html` | Redirected to `/login.html` |
| User logged in + visits `/login.html` | Redirected to `/dashboard.html` |
| User logged in + visits public page | No action, page loads normally |
| User not logged in + visits public page | No action, page loads normally |

---

## Event Listening

Listen for auth state changes:

```javascript
window.addEventListener('rs:auth-state-change', (event) => {
    const session = event.detail.session;
    console.log('Auth state changed:', session ? 'Logged in' : 'Logged out');
});

// Or check ready state:
window.whenAuthReady().then(session => {
    console.log('Auth is ready, session:', session);
});
```

---

## CSS Classes

| Class | Meaning | When Applied |
|-------|---------|--------------|
| `auth-pending` | Auth check in progress | Page load → Auth check complete |
| `auth-ready` | Auth check complete | After redirect or content reveal |

Use in CSS:
```css
html.auth-pending body > * {
    visibility: hidden; /* Hide content during check */
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Auth check takes too long | Normal (50-150ms). Check network speed. |
| Page flashes before redirect | Add `auth-pending` CSS. |
| Redirect loop | Don't put auth-guard in login.html. |
| Session lost on refresh | Check localStorage. Supabase handles persistence. |
| "Supabase not loaded" error | Add Supabase script BEFORE auth-config.js |

---

## Global Functions Available

After auth-config loads, these are available:

```javascript
// Session & User
await window.getCurrentSession()       // Get active session
await window.getCurrentUser()          // Get current user object
await window.isAuthenticated()         // Boolean: is logged in?

// Auth flow
await window.requireAuth()             // Redirect to login if not auth
async window.signOut()                 // Sign out user
await window.redirectAuthenticatedUser() // Redirect logged in users away

// Profiles
await window.getUserProfile()          // Get user profile with sync
await window.syncUserProfile()         // Update user profile

// Routing
window.redirectToLogin(targetPath)     // Redirect to login
window.redirectToPath(path)            // Safe redirect to path
window.getPostAuthRedirectPath()       // Get redirect after login

// Utilities
window.markAuthReady()                 // Remove auth-pending class
window.whenAuthReady()                 // Promise for auth ready
window.clearSensitiveCaches()          // Clear auth caches
```

---

## Testing Checklist

- [ ] Can access `/dashboard.html` when logged in
- [ ] Redirects to `/login.html` when not logged in
- [ ] Can access `/login.html` when not logged in
- [ ] Redirects to `/dashboard.html` when logged in + visit `/login.html`
- [ ] Logout button shows confirmation and redirects to login
- [ ] Page doesn't flash before redirect
- [ ] Refresh doesn't lose session
- [ ] Browser console has no auth errors
