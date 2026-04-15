# RaushanSYNC Science - Authentication & Progress Tracking Implementation Guide

## Overview

This guide walks you through implementing the complete authentication and progress tracking system on RaushanSYNC Science platform.

## Quick Start (5-10 minutes)

### Step 1: Setup Supabase (5 min)

1. Visit https://supabase.com and create free account
2. Create new project named "raushansync-science"
3. Wait for project initialization
4. Go to **Project Settings** â†’ **API**
5. Copy your keys:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)

### Step 2: Run SQL Setup (2 min)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open file: [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
4. Copy the SQL code inside
5. Paste into Supabase and click **Run**

### Step 3: Update Configuration (1 min)

Open [assets/js/auth-config.js](assets/js/auth-config.js) and replace:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

With your actual credentials from Step 1.

**That's it!** The system is now live. ðŸŽ‰

---

## File Structure

New files created:

```
/
â”œâ”€â”€ login.html                          # Student login page
â”œâ”€â”€ signup.html                         # Student signup page
â”œâ”€â”€ dashboard.html                      # Student progress dashboard
â”œâ”€â”€ SUPABASE_SETUP.md                   # SQL setup instructions
â”œâ”€â”€ assets/js/
â”‚   â”œâ”€â”€ auth-config.js                  # Supabase initialization & auth utilities
â”‚   â”œâ”€â”€ progress-tracker.js             # Quiz attempt tracking & statistics
â”‚   â””â”€â”€ [existing style.js, script.js]
â”œâ”€â”€ practice/class06/.../index.html     # âœ… Updated with auth + tracking
â””â”€â”€ practice-advanced/class06/.../index.html  # âœ… Updated with auth + tracking
```

---

## Features Implemented

### 1. **Authentication System**

#### Sign Up (`/signup.html`)
- Email-based registration
- Password requirements: 8+ chars, uppercase, lowercase, number
- Auto-created student profile
- Class selection (6-12)
- Optional school name

#### Login (`/login.html`)
- Email + password authentication
- Auto-redirect to dashboard after login
- Query parameter support for redirect after login (e.g., `/login.html?redirect=/practice/...`)
- "Stay logged in" via Supabase session management

#### Automatic Redirects
- **Non-authenticated users** trying to access quiz pages â†’ redirected to login
- **Authenticated users** visiting login/signup â†’ redirected to dashboard
- **After quiz completion** â†’ stays on quiz page but progress saved

### 2. **Progress Tracking**

#### Automatic Saving
Each time a student answers a quiz question:
- Answer is checked
- Result (correct/incorrect) is saved to Supabase
- Data includes:
  - Quiz URL
  - Question text
  - Student's answer
  - Correct answer
  - Time spent
  - Timestamp

#### Data Security
- Row-level security (RLS) ensures students only see their own data
- Authentication required to save attempts
- Data tagged with student's user ID automatically

### 3. **Student Dashboard** (`/dashboard.html`)

Shows:
- **Overall Statistics**
  - Total quiz attempts
  - Accuracy percentage
  - Total correct answers
  - Time spent learning

- **Profile Information**
  - Full name
  - Email
  - Class/Grade
  - School name

- **Recent Attempts** (last 10)
  - Quiz name
  - Result (âœ… Correct / âŒ Incorrect)
  - Timestamp

- **Quick Links**
  - Resume learning buttons
  - Sign out option

---

## How to Extend

### Add Auth to Other Quiz Pages

1. Open the quiz HTML file
2. Add these script imports before closing `</body>`:

```html
<!-- Supabase & Auth -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
<script src="/assets/js/auth-config.js"></script>
<script src="/assets/js/progress-tracker.js"></script>
```

3. Add this JavaScript at the start of your `<script>` section:

```javascript
// Require authentication
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await window.requireAuth();
    if (!isAuthenticated) {
        return;
    }

    window.markAuthReady();
});
```

4. In your answer-checking function, add:

```javascript
// After determining isCorrect
await window.ProgressTracker.saveAttempt({
    quiz_url: window.location.href,
    question_number: questionNumber,
    question_text: questionText,
    user_answer: studentAnswer,
    correct_answer: correctAnswer,
    is_correct: isCorrect,
    time_spent_seconds: elapsedTime  // optional
});
```

### Create Different Dashboard Views

See the `window.ProgressTracker` module in [assets/js/progress-tracker.js](assets/js/progress-tracker.js) for methods:

```javascript
// Get stats for specific quiz
const stats = await window.ProgressTracker.getQuizStats(quizUrl);

// Get all attempts for user
const attempts = await window.ProgressTracker.getAttemptHistory({ limit: 50 });

// Get overall stats
const overall = await window.ProgressTracker.getOverallStats();
```

### Access Current User Profile

```javascript
const session = await window.getCurrentSession();
const profile = await window.getUserProfile();

console.log(session.user.email);
console.log(profile.full_name);
console.log(profile.grade_class);
```

---

## API Reference

### Auth Functions (Global)

| Function | Returns | Purpose |
|----------|---------|---------|
| `isAuthenticated()` | `boolean` | Check if user logged in |
| `getCurrentSession()` | `{user, session}` | Get current user |
| `getUserProfile()` | `{id, email, full_name, grade_class, ...}` | Get student profile |
| `signOut()` | void | Logout user |
| `requireAuth()` | `boolean` | Redirect if not auth |

### Progress Tracker Methods

| Method | Parameters | Returns |
|--------|-----------|---------|
| `saveAttempt(data)` | `{quiz_url, is_correct, ...}` | `boolean` - success |
| `getAttemptHistory(filters)` | `{quiz_url?, limit?}` | `Array<attempt>` |
| `getQuizStats(quizUrl)` | `string` | `{total_attempts, accuracy, ...}` |
| `getOverallStats()` | none | `{total_attempts, accuracy, ...}` |
| `deleteAllAttempts()` | none | `boolean` |

---

## Database Schema Ref

### `student_profiles` Table

```
Column              Type        Description
id                  UUID PK     User ID (auto-linked)
email              TEXT        Student email (unique)
full_name          TEXT        Student name
grade_class        INT         Class 6-12
school_name        TEXT        School (optional)
created_at         TIMESTAMP   Registration date
last_login         TIMESTAMP   Last login
total_quizzes_attempted INT     Counter
total_correct_answers   INT     Counter
```

### `quiz_attempts` Table

```
Column              Type        Description
id                  INT PK      Auto-increment
user_id             UUID FK     References student_profiles.id
quiz_url            TEXT        Full URL of quiz
question_number     INT         Question number
question_text       TEXT        The question text
user_answer         TEXT        What student answered
correct_answer      TEXT        Expected answer
is_correct          BOOLEAN     Correct or not
time_spent_seconds  INT         Duration
created_at          TIMESTAMP   When answered
```

---

## Troubleshooting

### Issue: "Supabase client not initialized"

**Solution:** Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` in [assets/js/auth-config.js](assets/js/auth-config.js) are correct

### Issue: Signup not working

**Solution:** 
1. Check browser console for error messages
2. Verify Supabase project is running
3. Check that SQL setup was run successfully

### Issue: Progress not saving

**Solution:**
1. Open DevTools â†’ Network tab
2. Try checking an answer
3. Look for failed requests to Supabase
4. Check console for error messages

### Issue: Dashboard shows no data

**Solution:**
1. Make sure at least one quiz attempt was saved
2. Wait ~2 seconds for Supabase to sync
3. Refresh page (F5)
4. Check browser's Local Storage for auth token

---

## Next Steps

### Optional Enhancement 1: Email Verification
- Supabase supports email verification via magic links
- Add email confirmation step in signup

### Optional Enhancement 2: Analytics Dashboard (Admin)
- Create `/admin/analytics.html`
- Query aggregated stats across all students
- Show class-wise performance metrics

### Optional Enhancement 3: Progress Email Notifications
- Send weekly progress emails to students
- Use Supabase functions + Resend API
- Highlight improvement areas

### Optional Enhancement 4: Leaderboard
- Display top students by accuracy/attempts
- Add optional public leaderboard
- Gamify learning with badges

---

## Security Notes

âœ… **What's Protected:**
- User data is private (RLS policies enforce this)
- Passwords hashed with bcrypt (Supabase default)
- API keys are public-safe (anon key only used for auth, not admin operations)
- CORS prevents cross-origin attacks

âš ï¸ **What You Should Audit:**
- If adding teacher admin features, use separate `service_key` (never expose on frontend)
- Consider rate limiting on signup
- Monitor failed login attempts
- Require email verification for production use

---

## Support

For issues with:
- **Supabase**: https://supabase.com/docs
- **Authentication**: https://supabase.com/docs/guides/auth
- **Database**: https://supabase.com/docs/guides/database
- **RLS**: https://supabase.com/docs/guides/database/postgres/row-level-security

---

**Last Updated:** April 2026  
**Status:** âœ… Production Ready  
**Version:** 1.0
