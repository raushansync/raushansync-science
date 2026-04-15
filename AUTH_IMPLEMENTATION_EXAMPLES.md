# Auth Guard Implementation - Practical Examples

This document shows real-world examples of how to implement auth protection on different types of pages.

## Example 1: Protected Dashboard Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#3b82f6">
    <title>Dashboard - RaushanSync Science</title>

    <!-- Fonts & Stylesheets -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/style.css">

    <!-- Supabase & Auth -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <script src="/assets/js/auth-guard.js"></script>

    <!-- Auth-pending styles to prevent flash -->
    <script>
        document.documentElement.classList.add("auth-pending");
    </script>

    <style>
        /* Hide content while auth check is running */
        html.auth-pending body > * {
            visibility: hidden;
        }

        /* Show loading message */
        html.auth-pending body::before {
            content: "Loading your dashboard...";
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
</head>
<body>
    <header>
        <nav>
            <h1>Dashboard</h1>
            <button data-action="logout">Sign Out</button>
        </nav>
    </header>

    <main>
        <h2>Welcome back!</h2>
        <p>Your dashboard content here.</p>
    </main>

    <!-- Logout handler (optional but recommended) -->
    <script src="/assets/js/auth-logout-handler.js"></script>

    <!-- Page-specific scripts -->
    <script src="/assets/js/script.js"></script>
</body>
</html>
```

**Key points:**
- ✅ Supabase and auth-config loaded first
- ✅ auth-guard loaded immediately after
- ✅ auth-pending class prevents content flash
- ✅ Logout button uses `data-action="logout"` attribute
- ✅ Page-specific scripts loaded last

---

## Example 2: Public Home Page (No Auth Required)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home - RaushanSync Science</title>

    <link rel="stylesheet" href="/assets/css/style.css">

    <!-- Supabase & Auth (for optional features) -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <!-- NOTE: NO auth-guard.js here - public pages don't need automatic protection -->
</head>
<body>
    <header>
        <nav>
            <h1>RaushanSync Science</h1>
            <div id="user-info"></div>
        </nav>
    </header>

    <main>
        <h2>Welcome to Our Platform</h2>
        <p>Learn science from first principles.</p>
    </main>

    <script>
        // Optional: Show different content if user is logged in
        window.whenAuthReady().then((session) => {
            const userInfo = document.getElementById('user-info');
            if (session) {
                userInfo.innerHTML = `
                    <span>Welcome, ${session.user.email}</span>
                    <a href="/dashboard.html">Dashboard</a>
                    <button data-action="logout">Sign Out</button>
                `;
            } else {
                userInfo.innerHTML = `
                    <a href="/login.html">Login</a>
                    <a href="/signup.html">Sign Up</a>
                `;
            }
        });
    </script>

    <!-- Logout handler (optional) -->
    <script src="/assets/js/auth-logout-handler.js"></script>
</body>
</html>
```

**Key points:**
- ⚠️ **No auth-guard.js** - public pages shouldn't require login
- ✅ Auth-config included for optional features
- ✅ Using `whenAuthReady()` to conditionally show login/logout
- ✅ Responsive to user's auth state

---

## Example 3: Login Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - RaushanSync Science</title>

    <link rel="stylesheet" href="/assets/css/style.css">

    <!-- Supabase & Auth -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <script src="/assets/js/auth-guard.js"></script>
    <!-- auth-guard will automatically redirect logged-in users to dashboard -->

    <style>
        /* Simple loading state for login page */
        html.auth-pending main {
            display: none;
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
            font: 600 1.125rem "Poppins", sans-serif;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <main>
        <div class="auth-container">
            <div class="auth-card">
                <h1>Login</h1>
                
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required>
                    </div>

                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required>
                    </div>

                    <div id="errorMessage" class="error"></div>
                    <div id="loading" class="loading" style="display: none;">Signing in...</div>

                    <button type="submit" id="loginBtn">Sign In</button>
                </form>

                <p>Don't have an account? <a href="/signup.html">Sign up</a></p>
            </div>
        </div>
    </main>

    <script>
        async function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const errorDiv = document.getElementById("errorMessage");
            const loginBtn = document.getElementById("loginBtn");

            if (!email || !password) {
                errorDiv.textContent = "Please fill in all fields.";
                errorDiv.classList.add("show");
                return;
            }

            loginBtn.disabled = true;
            errorDiv.classList.remove("show");

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    errorDiv.textContent = error.message || "Login failed. Please try again.";
                    errorDiv.classList.add("show");
                    loginBtn.disabled = false;
                    return;
                }

                if (data.session) {
                    // Get redirect URL or go to dashboard
                    const redirectPath = window.getPostAuthRedirectPath('/dashboard.html');
                    window.location.replace(redirectPath);
                }
            } catch (err) {
                errorDiv.textContent = "An error occurred. Please try again.";
                errorDiv.classList.add("show");
                loginBtn.disabled = false;
            }
        }

        document.getElementById("loginForm").addEventListener("submit", handleLogin);

        // Show "signed out" message if redirected from logout
        window.addEventListener("load", () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get("message") === "signed-out") {
                document.getElementById("errorMessage").textContent = "You have been signed out successfully.";
                document.getElementById("errorMessage").classList.add("show");
            }
        });
    </script>
</body>
</html>
```

**Key points:**
- ✅ auth-guard will redirect already-logged-in users to dashboard
- ✅ Form handles login submission
- ✅ Respects redirect query parameter
- ✅ Shows logout confirmation message

---

## Example 4: Protected Practice Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Practice - Chapter 1</title>

    <link rel="stylesheet" href="/assets/css/style.css">

    <!-- Supabase & Auth -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <script src="/assets/js/auth-guard.js"></script>
    <!-- auth-guard protects this page automatically -->

    <style>
        html.auth-pending body > * {
            visibility: hidden;
        }

        html.auth-pending body::before {
            content: "Loading practice materials...";
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--background-color);
            color: var(--primary-color);
            font: 600 1.125rem "Poppins", sans-serif;
            visibility: visible;
            z-index: 9999;
        }
    </style>
</head>
<body>
    <div id="quiz-container">
        <h1>Practice Quiz</h1>
        <!-- Quiz content loaded here -->
    </div>

    <script src="/assets/js/script.js"></script>
    <script src="/assets/js/auth-logout-handler.js"></script>

    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            // Note: auth-guard already checked auth before this runs
            // We can safely assume user is authenticated here
            
            // Get user profile if needed
            try {
                const profile = await window.getUserProfile();
                console.log('User:', profile?.full_name);
            } catch (error) {
                console.error('Failed to load profile:', error);
            }

            // Initialize quiz when auth and auth-pending are ready
            window.addEventListener('rs:auth-state-change', () => {
                initializePage();
            });

            // Or check if auth is already ready
            if (window.authState?.initialized && window.authState?.session) {
                initializePage();
            }
        });

        function initializePage() {
            console.log('Page is now protected and user is authenticated');
            // Load quiz questions, etc.
        }
    </script>
</body>
</html>
```

**Key points:**
- ✅ auth-guard ensures only authenticated users see this
- ✅ Page can safely assume user is logged in
- ✅ Can use `window.authState` to check session
- ✅ Can listen to `rs:auth-state-change` event if needed

---

## Example 5: Modal with Login Prompt (Optional Auth)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Article - RaushanSync Science</title>

    <link rel="stylesheet" href="/assets/css/style.css">

    <!-- Supabase & Auth -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
    <script src="/assets/js/auth-config.js"></script>
    <!-- NOTE: NO auth-guard.js - this is a public page -->
</head>
<body>
    <article>
        <h1>Understanding Photosynthesis</h1>
        <p>Public content visible to everyone...</p>

        <button id="downloadBtn">Download PDF</button>
    </article>

    <!-- Login prompt modal (hidden by default) -->
    <div id="loginModal" style="display: none;">
        <div class="modal-content">
            <h2>Sign In Required</h2>
            <p>You need to be logged in to download this document.</p>
            <a href="/login.html">Go to Login</a>
            <button onclick="document.getElementById('loginModal').style.display='none'">Cancel</button>
        </div>
    </div>

    <script>
        // Check auth state when user tries to download
        document.getElementById('downloadBtn').addEventListener('click', async (e) => {
            e.preventDefault();

            const isAuthenticated = await window.isAuthenticated();

            if (!isAuthenticated) {
                // Show login prompt instead of redirecting
                document.getElementById('loginModal').style.display = 'block';
                return;
            }

            // User is authenticated - proceed with download
            console.log('Downloading...');
            // Download logic here
        });
    </script>
</body>
</html>
```

**Key points:**
- ✅ No auth-guard - page is publicly accessible
- ✅ Uses `window.isAuthenticated()` for specific actions
- ✅ Shows modal instead of auto-redirecting
- ✅ Better UX for optional features

---

## Checklist for Adding Auth Protection to a Page

When adding auth-guard to a new page:

- [ ] Add Supabase script: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>`
- [ ] Add auth-config: `<script src="/assets/js/auth-config.js"></script>`
- [ ] Add auth-guard: `<script src="/assets/js/auth-guard.js"></script>` (only if page should be protected)
- [ ] Add auth-pending class to `<html>`: `<script>document.documentElement.classList.add("auth-pending");</script>`
- [ ] Add CSS to hide content during auth check
- [ ] Test by logging out and accessing the page
- [ ] Test by logging in and accessing the page
- [ ] Check browser console for any errors

---

## Common Patterns

### Pattern 1: Show Different Content Based on Auth

```javascript
window.whenAuthReady().then((session) => {
    if (session) {
        // Show authenticated content
        document.getElementById('authenticated-section').style.display = 'block';
        document.getElementById('login-section').style.display = 'none';
    } else {
        // Show public content
        document.getElementById('authenticated-section').style.display = 'none';
        document.getElementById('login-section').style.display = 'block';
    }
});
```

### Pattern 2: Require Auth for Specific Action

```javascript
async function shareContent() {
    if (!await window.requireAuth()) {
        return; // User was redirected to login
    }
    
    // User is authenticated - proceed
    console.log('Sharing content...');
}
```

### Pattern 3: Logout Button

```html
<!-- Simple logout button using data-action -->
<button data-action="logout">Sign Out</button>

<!-- Include the logout handler -->
<script src="/assets/js/auth-logout-handler.js"></script>
```

### Pattern 4: Programmatic Logout

```javascript
async function endSession() {
    try {
        await window.signOut();
        // Automatically redirects to login page with message
    } catch (error) {
        console.error('Could not sign out:', error);
    }
}
```
