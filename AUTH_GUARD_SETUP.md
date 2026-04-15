# Global Authentication Protection - Implementation Guide

This guide explains how to implement **global authentication protection** across your website using the new `auth-guard.js` script.

## Overview

The auth protection system consists of two main components:

1. **auth-config.js** - Core authentication setup and session management
2. **auth-guard.js** - Automatic page protection and redirect logic

With these scripts in place, your website will:
- ✅ Automatically redirect unauthenticated users to login
- ✅ Prevent page content from flashing before auth check
- ✅ Redirect authenticated users away from login/signup pages
- ✅ Maintain session persistence across page loads
- ✅ Handle errors gracefully without breaking the site

## Quick Start

### 1. Include Scripts in Page `<head>`

Add these scripts to **all pages** in this exact order:

```html
<head>
    <!-- ... other head content ... -->
    
    <!-- Supabase Library -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    
    <!-- Auth Configuration -->
    <script src="/assets/js/auth-config.js"></script>
    
    <!-- Auth Guard (Automatic Protection) -->
    <script src="/assets/js/auth-guard.js"></script>
    
    <!-- ... rest of your scripts ... -->
</head>
```

### 2. Add Auth-Pending CSS (Optional but Recommended)

To prevent content flash, add this to your page's `<style>` tag:

```html
<style>
    html.auth-pending body > * {
        visibility: hidden;
    }

    html.auth-pending body::before {
        content: "Loading...";
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-color);
        color: var(--primary-color);
        font: 600 1.125rem/1.4 "Poppins", sans-serif;
        visibility: visible;
        z-index: 9999;
    }
</style>
```

### 3. Initialize Auth on Page Load (Already in body)

Make sure your page includes the auth initialization in the body script. The auth-guard will handle everything automatically:

```html
<body>
    <!-- Your page content -->
    
    <script>
        // No need to manually check auth anymore!
        // auth-guard.js handles it automatically
    </script>
</body>
```

## How It Works

### For Protected Pages (e.g., `/dashboard.html`, `/practice/...`)

1. **Page loads** → auth-guard checks if user is logged in
2. **If not logged in** → Redirects to `/login.html` with redirect parameter
3. **If logged in** → Shows "auth-pending" message briefly, then reveals page content

### For Auth Pages (e.g., `/login.html`, `/signup.html`)

1. **Page loads** → auth-guard checks if user is already logged in
2. **If logged in** → Redirects to `/dashboard.html`
3. **If not logged in** → Shows login/signup form normally

### For Public Pages (e.g., `/index.html`, `/about/`)

1. **Page loads** → No special handling
2. **Content is shown immediately**
3. **User can still access even if not logged in** (customize as needed)

## Configuration

### Protected Paths

By default, these paths are protected and require authentication:

```javascript
// From auth-config.js
PROTECTED_PATH_PREFIXES = [
    '/dashboard.html',
    '/practice/',
    '/practice-advanced/'
];
```

To add more protected paths, edit `auth-config.js` and add to `PROTECTED_PATH_PREFIXES`:

```javascript
const PROTECTED_PATH_PREFIXES = [
    '/dashboard.html',
    '/practice/',
    '/practice-advanced/',
    '/your-protected-path/'    // ← Add your path here
];
```

### Auth Pages

Pages that should NOT require authentication:

```javascript
// From auth-config.js
const AUTH_PAGE_PATHS = new Set([
    '/login.html',
    '/signup.html',
    '/dashboard.html'
]);
```

## Advanced Usage

### 1. Manual Authentication Check

If you need to check authentication status in your page script:

```javascript
// Check if user is authenticated
if (await window.isAuthenticated()) {
    console.log('User is logged in');
}

// Get current session
const session = await window.getCurrentSession();
if (session) {
    console.log('User ID:', session.user.id);
}

// Get user profile
const profile = await window.getUserProfile();
console.log('Full name:', profile?.full_name);
```

### 2. Logout Function

Provide a logout button that clears session and redirects to login:

```html
<button id="logout-btn">Logout</button>

<script>
    document.getElementById('logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await window.signOut();
            // User is automatically redirected to login
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
</script>
```

### 3. Redirect After Login

The login page should redirect authenticated users:

```javascript
// In login.html script section
async function checkAndRedirect() {
    const isAuth = await window.isAuthenticated();
    if (isAuth) {
        const redirectPath = window.getPostAuthRedirectPath('/dashboard.html');
        window.redirectToPath(redirectPath, { replace: true });
    }
}

// Call after form handling
checkAndRedirect();
```

### 4. Require Auth Manually

For specific actions that require authentication:

```javascript
async function downloadDocument() {
    const isAuthenticated = await window.requireAuth();
    if (!isAuthenticated) {
        return; // User is redirected; function exits
    }
    
    // Document download logic here
    console.log('Downloading...');
}
```

## Browser console debugging

Enable debug mode by adding this before including auth-config.js:

```html
<script>
    window.__AUTH_DEBUG__ = true;
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
<script src="/assets/js/auth-config.js"></script>
<script src="/assets/js/auth-guard.js"></script>
```

This will log all auth state changes to the browser console.

## Troubleshooting

### Issue: Users not being redirected to login

**Solution:** 
- Ensure `auth-guard.js` is included AFTER `auth-config.js`
- Check browser console for errors
- Verify path is in `PROTECTED_PATH_PREFIXES`

### Issue: Page flashing before redirect

**Solution:**
- Add the `auth-pending` CSS styles to your page
- The auth check happens in ~100-200ms; CSS hides content during this time

### Issue: Infinite redirect loop

**Solution:**
- Ensure `/login.html` is NOT in `PROTECTED_PATH_PREFIXES`
- Check that `AUTH_ROUTE_LOGIN` is set correctly to `/login.html`
- Clear browser cache and try again

### Issue: Session lost on refresh

**Solution:**
- Supabase stores session in localStorage by default
- Check browser DevTools → Application → Local Storage
- Ensure no code is clearing localStorage on page load

## File Locations

- **auth-config.js** → `/assets/js/auth-config.js` (main config, DO NOT modify)
- **auth-guard.js** → `/assets/js/auth-guard.js` (new global guard)
- **Auth CSS** → Add to your page's `<style>` tag

## Minimal Implementation Example

Here's the **minimum code** needed for a protected page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Protected Page</title>
    
    <!-- Auth Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <script src="/assets/js/auth-guard.js"></script>
    
    <style>
        html.auth-pending body > * { visibility: hidden; }
        html.auth-pending body::before {
            content: "Loading...";
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            color: #3b82f6;
            font: 600 1.125rem "Poppins", sans-serif;
            visibility: visible;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <h1>Welcome to Protected Page</h1>
    <p>Only authenticated users can see this.</p>
</body>
</html>
```

## Performance Notes

- **Auth check time:** ~50-150ms (depends on network)
- **Session persistence:** Uses browser localStorage (built-in)
- **No duplicate checks:** Auth-guard only runs once per page load
- **Minimal bundle size:** auth-guard.js is ~2KB gzipped

## Security Considerations

✅ **Already provided by Supabase:**
- Session tokens are stored securely
- Auto-refresh of expired tokens
- XSS protection via httpOnly cookies option
- CSRF protection

✅ **What auth-guard.js does:**
- Prevents access to protected routes without auth token
- Handles redirect logic safely using window.location
- No sensitive data stored in client code

⚠️ **Remember:**
- Never use client-side auth for sensitive operations
- Always validate permissions on the server
- Use HTTPS in production (required by Supabase)

## Next Steps

1. Add `auth-guard.js` script tag to all pages
2. Add CSS for `auth-pending` state
3. Test by logging out and trying to access `/dashboard.html`
4. Test by logging in and visiting `/login.html`
5. Check browser console for debug logs (enable `__AUTH_DEBUG__`)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Session Management](https://supabase.com/docs/guides/auth/managing-user-sessions)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
