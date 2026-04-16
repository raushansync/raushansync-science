# RaushanSync Science Codebase Overview - Step 4 Implementation Planning

**Date**: April 16, 2026  
**Status**: Ready for Step 4 implementation  
**Phase**: Progress Tick System + Practice Score Persistence

---

## 1. progress-tracker.js - COMPLETE FILE CONTENT

**Location**: `assets/js/progress-tracker.js`

### Key Functions:

#### `startQuestion(questionId)`
- Tracks when a question interaction begins
- Stores start time in Map for elapsed time calculation

#### `getElapsedTime(questionId)`
- Returns elapsed time in seconds since `startQuestion()` was called
- Used for practice timing analytics

#### `saveAttempt(attemptData)`
- **Signature**: `async saveAttempt(attemptData)`
- **Input**: `{ is_correct: boolean, practice_url: string | quiz_url: string }`
- **Output**: `boolean` (success/failure)
- **Database target**: `practice_scores` table with upsert on `(user_id, site, practice_path)`
- Converts boolean `is_correct` to score (100 for correct, 0 for incorrect)
- Sanitizes and validates all data before saving
- Returns false if user not authenticated or data invalid

#### `getAttemptHistory(filters = {})`
- **Signature**: `async getAttemptHistory(filters = {})`
- **Filters**: `{ practice_path: string, limit: number }`
- **Output**: `Array<{ id, practice_path, score, updated_at }>`
- Queries `practice_scores` table ordered by newest first
- Default limit: 10 attempts max

#### `getPracticeStats(practicePath)`
- **Signature**: `async getPracticeStats(practicePath)`
- **Output**: `{ total_attempts, average_score, highest_score, passing: 'Yes'|'No' }`
- Calculates aggregate statistics for a single practice
- Passing = average_score >= 70

#### `getOverallStats()`
- **Signature**: `async getOverallStats()`
- **Output**:
  ```javascript
  {
    total_practices: number,      // Total practice entries
    unique_practices: number,     // Unique practice_paths
    average_score: number,        // 0-100
    passing_practices: number,    // count with score >= 70
    failing_practices: number     // count with score < 70
  }
  ```
- Queries ALL `practice_scores` for current user
- Used on dashboard for overall progress display

#### `deleteAllAttempts()`
- **Signature**: `async deleteAllAttempts()`
- Requires confirmation dialog
- Deletes all `practice_scores` entries for current user

#### `getQuizStats(quizUrl)` [DEPRECATED]
- Kept for backward compatibility
- Calls `getPracticeStats()` internally
- Will be removed in next version

### Helper Functions (Internal):

- `sanitizeText(value, maxLength)` - Removes control chars, validates strings
- `clampInteger(value, min, max, fallback)` - Validates integer ranges
- `normalizeQuizUrl(rawUrl)` - Normalizes URL to max 500 chars
- `normalizeQuestionNumber(value)` - Validates question numbers >= 1

### Current Limitations:
- Does NOT track page views (will be added in Step 4)
- Does NOT track reading time for articles
- Binary scoring only (0 or 100) - no partial credit tracking

### Ready for Step 4:
✅ All functions prepared  
✅ Database fields align with new schema  
✅ Error handling robust  
✅ Needs: page view tracking addition

---

## 2. script.js - CURRENT PAGE LOAD FLOW

**Location**: `assets/js/script.js`

### On Document Ready (`DOMContentLoaded`):

1. **Dark Mode Setup**
   - Reads `theme` from localStorage
   - Applies saved theme or respects OS preference
   - Updates browser theme color meta tag

2. **Mobile Navigation**
   - Sets up hamburger menu toggle
   - Closes menu on link click
   - Highlights active navigation links

3. **Navigation Auto-Hide on Scroll**
   - Uses RAF for performance
   - Hides header on scroll down, shows on scroll up
   - Threshold: 12px scroll delta

4. **Service Worker Registration**
   - Registers `/service-worker.js` if browser supports
   - Catches errors silently

5. **Component Loading** (Async Pattern)
   ```javascript
   // Attempts multiple candidate paths for each component
   - /components/nav.html
   - /components/footer.html
   - /components/support-cta.html
   
   // Falls back to relative paths if absolute fails
   ```

6. **Navbar Setup** (After Components Load)
   - Hamburger menu binding
   - Active link highlighting
   - User info display (if logged in)
   - Sign-out button handlers

### Auth State Listeners:
- Listens for `rs:auth-state-change` event from auth-config.js
- Updates user display with full name or email
- Shows/hides sign-out buttons based on auth state

### Current Missing:
⚠️ **NO page view tracking currently implemented**  
⚠️ **NO progress tracker calls on page load**

### Ready for Step 4 Addition:
```javascript
// Will add this pattern after existing code:
if (window.ProgressTracker && window.isUserLoggedIn?.()) {
    window.ProgressTracker.trackPageView({
        site: window.getCurrentSite?.(),
        item_path: window.getCurrentPath?.(),
        item_type: determinePageType() // 'article' or 'practice'
    });
}
```

---

## 3. service-worker.js - CORE_ASSETS ARRAY WITH QUIZ PATHS

**Location**: `service-worker.js` (lines 1-50)

### Cache Strategy:
- **CORE_CACHE**: Static assets cached at install
- **RUNTIME_CACHE**: Dynamic content (max 60 entries)
- **Offline fallback**: `/offline.html`

### CORE_ASSETS Array (Relevant for Step 4 Renaming):

**Current Quiz File Paths** (will rename to practice*.html in Step 4):
```javascript
'/notes/class07/chapter01-nutrition-in-plants/core-concept-1/quiz1.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-2/quiz2.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-3/quiz3.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-4/quiz4.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-5/quiz5.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-6/quiz6.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-7/quiz7.html',
'/notes/class07/chapter01-nutrition-in-plants/core-concept-8/quiz8.html'
```

### Fetch Strategies:
1. **Sensitive documents** (auth pages, protected routes):
   - `networkOnlyDocument()` - always fresh
   - Includes: `/login.html`, `/signup.html`, `/dashboard.html`, `/practice/*`

2. **Static assets** (CSS, JS, images):
   - `cacheFirst()` - use cache, fallback to network
   - Includes: `/assets/`, fonts, icons

3. **Notes and practice content**:
   - `cacheFirst()` - cache preferred for offline support
   - Includes: `/notes/`, `/practice/`, `/practice-advanced/`, `/video-lessons/`

4. **Document requests** (pages):
   - `networkFirst()` - try network first, fallback to cache
   - Ensures latest content when online

### Step 4 Impact:
Will need to update all `quiz*.html` paths → `practice*.html` paths in CORE_ASSETS array

---

## 4. dashboard.html - STATS DISPLAY SECTION

**Location**: `dashboard.html` (lines 575-600 for stats grid)

### Stats Grid HTML Structure:
```html
<div class="stats-grid">
  <div class="stat-card accent-1">
    <div class="stat-label">Account Status</div>
    <div class="stat-value">✓</div>
    <div class="stat-meta">Active</div>
  </div>
  
  <div class="stat-card accent-2">
    <div class="stat-label">Learned Hours</div>
    <div class="stat-value" id="learnedHours">0h</div>
    <div class="stat-meta" id="learnedMeta">Lifetime Total</div>
  </div>
  
  <div class="stat-card accent-3">
    <div class="stat-label">Profile Status</div>
    <div class="stat-value" id="profileStatus">–</div>
    <div class="stat-meta" id="profileStatusMeta">Checking...</div>
  </div>
</div>
```

### Current Stats Calculation (Step 3):
```javascript
async function loadProgressStats() {
  // Queries 'progress' table
  const articleProgress = await supabase
    .from('progress')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('item_type', 'article')
    .eq('completed', true);
  
  const practiceProgress = await supabase
    .from('progress')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('item_type', 'practice')
    .eq('completed', true);
  
  // Displays articles completed (repurposed "Learned Hours" card)
  document.getElementById("learnedHours").textContent = articlesCompleted;
  document.getElementById("learnedMeta").textContent = "Articles Completed";
}
```

### Profile Section HTML:
```html
<div class="section">
  <h2 class="section-title">Your Profile</h2>
  <div class="profile-grid">
    <div class="profile-item">
      <div class="profile-label">Full Name</div>
      <div class="profile-value" id="profileFullName">–</div>
    </div>
    <div class="profile-item">
      <div class="profile-label">Email</div>
      <div class="profile-value" id="profileEmail">–</div>
    </div>
    <div class="profile-item">
      <div class="profile-label">Education Level</div>
      <div class="profile-value" id="profileClass">–</div>
    </div>
  </div>
</div>
```

### Current Dashboard Initialization:
```javascript
async function initializeDashboard() {
  // 1. Auth check
  const session = await supabase.auth.getSession();
  if (!session) redirect to login;
  
  // 2. Display user info (from session metadata)
  fullName = session.user.user_metadata?.full_name
  email = session.user.email
  educationLevel = session.user.user_metadata?.education_level
  
  // 3. Load and display progress stats
  await loadProgressStats();
  
  // 4. Update profile completion status
  updateProfileStatus();
  
  // 5. Show dashboard, hide loading
  document.getElementById("loading").style.display = "none";
  document.getElementById("dashboardContent").style.display = "block";
}
```

### Profile Edit Modal:
- Opens on "Edit Profile" button click
- Contains form for: full name, email, education level (class)
- Saves updates to Supabase auth user metadata

### Step 4 Enhancements Needed:
⚠️ Add real-time practice stats:
- Total practices completed
- Average score across all practices
- Number of passing/failing practices
- Link to `practice_scores` table via `getOverallStats()`

---

## 5. Quiz Page Example - `/notes/class07/chapter01-nutrition-in-plants/core-concept-1/quiz1.html`

**Location**: `/notes/class07/chapter01-nutrition-in-plants/core-concept-1/quiz1.html`

### Page Structure:

#### Header Section:
```html
<h1>Core Concept 1 – Why All Living Organisms Need Food</h1>
<p>Class 7 · Chapter 1 · Nutrition in Plants</p>
<p>RaushanSYNC — Learning from First Principles.</p>
```

#### Breadcrumb Navigation:
```html
<nav class="breadcrumb">
  Home > Class 7 > Chapter 1: Nutrition in Plants > Core Concept 1
</nav>
```

#### Important Notice Section:
```html
<section class="palette important">
  <h3>Important:</h3> Attempt every question before checking the answer.
</section>
```

### Quiz Question Structure (MCQ Format):
```html
<div class="quiz-card" 
     data-type="mcq" 
     data-answer="c"
     data-reason="Food supplies both usable energy for life processes and materials required to build and repair the body.">
  
  <h3>1. Why do all living organisms require food?</h3>
  
  <div class="quiz-options">
    <label class="quiz-option">
      <input type="radio" name="q1" value="a"> a) Only to remove hunger
    </label>
    <label class="quiz-option">
      <input type="radio" name="q1" value="b"> b) Only for growth
    </label>
    <label class="quiz-option">
      <input type="radio" name="q1" value="c"> c) To obtain energy and building materials
    </label>
    <label class="quiz-option">
      <input type="radio" name="q1" value="d"> d) Only to stay warm
    </label>
  </div>
  
  <button class="quiz-btn" type="button">Check Answer</button>
  <button class="quiz-btn discuss-ai-btn" type="button" hidden>Ask AI</button>
  
  <div class="quiz-feedback" aria-live="polite"></div>
</div>
```

### Quiz Card Data Attributes:
- `data-type="mcq"` - Question type
- `data-answer="c"` - Correct answer option
- `data-reason="..."` - Explanation text shown on reveal

### Current Quiz1.html Quiz Count:
- **5 questions total** in this page
- Questions 1-5 cover Core Concept 1 fundamentals

### AI Chat Integration:
```html
<button class="quiz-btn discuss-ai-btn">Ask AI</button>
```
- Hidden by default (`hidden` attribute)
- Calls `window.initAIChat(context)` when clicked
- Passes question context to AI tutor

### Page Features:
✅ Structured MCQs with proper data attributes  
✅ AI tutor "Ask AI" buttons  
✅ Breadcrumb navigation  
✅ Important notice section  
✅ Feedback div (aria-live for accessibility)  

### Missing in Current Version:
⚠️ No automatic progress tracking on page load  
⚠️ No automatic tracking on "Check Answer" click  
⚠️ No score calculation and storage  
⚠️ No "Ask AI" button visibility logic

### Step 4 Integration Points:
1. On page load: `window.ProgressTracker.trackPageView()`
2. On "Check Answer": 
   - Calculate score
   - Call `window.ProgressTracker.saveAttempt()`
   - Show AI button if user logged in
3. Track in `progress` table as 'practice'

---

## 6. ai-chat.js - CURRENT QUIZ/PRACTICE CONTEXT HANDLING

**Location**: `ai-chat.js` (main implementation file)

### Initialization Function:
```javascript
window.initAIChat = function(context) {
  bindUI();
  
  state.context = sanitizeContext(context);
  state.history = [];
  
  ui.history.innerHTML = '';
  renderContext();
  addTutorGreeting();
  openModal();
}
```

### Context Sanitization:
```javascript
function sanitizeContext(context) {
  return {
    practiceTitle: getText(ctx.practiceTitle || ctx.quizTitle, 'Practice Discussion'),
    questionText: getText(ctx.questionText, 'Question unavailable'),
    userAnswer: getText(ctx.userAnswer, 'No answer selected yet'),
    correctAnswer: getText(ctx.correctAnswer, 'Correct answer unavailable'),
    explanation: getText(ctx.explanation, 'No explanation available'),
    pageUrl: getText(ctx.pageUrl, window.location.href)
  };
}
```

### Context Display in Modal:
```javascript
function renderContext() {
  const contextLine = [
    'Topic: ' + state.context.practiceTitle,
    'Question: ' + state.context.questionText,
    'Your answer: ' + state.context.userAnswer,
    'Correct answer: ' + state.context.correctAnswer
  ].join(' | ');
  
  ui.context.textContent = contextLine;
}
```

### AI Worker Communication:
```javascript
async function sendToWorker(userMessage) {
  // Validates origin (only HTTPS production or localhost)
  
  const payload = {
    message: userMessage,
    context: state.context,
    history: state.history.slice(-10)  // Last 10 messages for context
  };
  
  // Posts to: https://quiz-ai-tutor.raushanguptaicloud.workers.dev/
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

### Message Rendering:
```javascript
function renderAssistantMarkdown(text) {
  // Converts markdown to HTML:
  // **bold** → <strong>
  // *italic* → <em>
  // `code` → <code>
  // - lists → <ul>
  // 1. ordered → <ol>
  // Paragraphs by blank lines
}
```

### Modal UI Elements:
- `#ai-chat-modal` - Main modal container
- `#ai-chat-context` - Displays question context
- `#ai-chat-history` - Chat message history
- `#ai-chat-form` - Message input form
- `#ai-chat-input` - Text input field
- `#ai-chat-send` - Send button
- `#ai-chat-close` - Close button

### Origin Validation:
```javascript
// Allowed:
- https://science.raushansync.com (production)
- localhost:* (development)
- 127.0.0.1:* (development)
- null origin (local file preview)

// Blocked:
- Any other HTTPS domain
- HTTP non-local domains
```

### Current Usage Pattern (in quiz pages):
```javascript
// On "Ask AI" button click:
window.initAIChat({
  practiceTitle: "Core Concept 1",
  questionText: "Why do all living organisms require food?",
  userAnswer: "Only for growth",
  correctAnswer: "To obtain energy and building materials",
  explanation: "Food supplies both usable energy...",
  pageUrl: window.location.href
});
```

### Ready for Step 4:
✅ Function signature ready  
✅ Context sanitization working  
✅ Modal UI complete  
✅ Origin validation secure  
✅ Markdown rendering functional

---

## 7. auth-config.js - HELPER FUNCTIONS VERIFICATION

**Location**: `assets/js/auth-config.js`

### CONFIRMED: Helper Functions Present ✅

#### Site/Path Helpers (Added in Step 3):
```javascript
window.getCurrentSite() → Returns:
  // 'science.raushansync.com' on production
  // 'localhost' on development
  
window.getCurrentPath() → Returns:
  // window.location.pathname + search + hash
  
window.normalizePath(path) → Returns:
  // Normalized path (0-500 chars) or current path
```

#### Auth State Helpers:
```javascript
window.isUserLoggedIn() → boolean
  // Returns: authState && authState.session && authState.session.user

window.getCurrentSession() → Promise<Session | null>
  // Waits for auth ready if needed
  
window.getCurrentUser() → Promise<User | null>
  // Gets user object from current session
```

#### Profile Helpers:
```javascript
window.getUserProfile(options = {}) → Promise<Profile | null>
  // Options: { sync: boolean, updateLastLogin: boolean }
  // Returns: { id, full_name, education_level, phone, created_at }

window.syncUserProfile(options = {}) → Promise<Profile | null>
  // Options: { session, profile, explicitProfile }
  // Upserts to 'profiles' table
```

#### Auth Flow Helpers:
```javascript
window.redirectToLogin(targetPath)
  // Saves current path in redirect param
  
window.redirectToPath(path, options = {})
  // Safe redirect with validation
  
window.getPostAuthRedirectPath(fallback)
  // Gets redirect URL from query params
  
window.buildLoginRedirectUrl(targetPath)
  // Constructs full login redirect URL
```

#### Logout Function:
```javascript
window.signOut() → Promise<void>
  // Signs out user
  // Clears sensitive caches
  // Redirects to login
```

#### Protected Path Detection:
```javascript
window.isProtectedPath(pathname) → boolean
  // Checks if path requires authentication

PROTECTED_PATH_PREFIXES = [
  '/dashboard.html',
  '/practice/',
  '/practice-advanced/',
  '/notes/',
  '/video-lessons/',
  '/class06/', through '/class12/'
]
```

#### Auth Ready Promise:
```javascript
window.whenAuthReady() → Promise<Session | null>
  // Waits for auth initialization
  // Use for: await window.whenAuthReady()
```

#### Other Utilities:
```javascript
window.clearSensitiveCaches() → Promise<void>
  // Clears auth-sensitive cache entries

window.requireAuth() → Promise<boolean>
  // Redirects to login if not authenticated

window.isAuthenticated() → Promise<boolean>
  // Returns current auth status

window.markAuthReady()
  // Removes 'auth-pending' class, adds 'auth-ready'
```

### Database Integration:
```javascript
// Supabase client initialized as:
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Tables accessed:
- profiles (read/write)
- auth.users (read/auth operations)
```

### Step 3 Schema Updates:
✅ `profiles` table integration complete:
  - id (UUID)
  - full_name (string, 120 chars max)
  - education_level (string, 50 chars max)
  - phone (string, 20 chars max)
  - created_at (timestamp)

✅ Old fields removed:
  - grade_class → education_level
  - school_name removed

### Ready for Step 4:
✅ All helper functions present and working  
✅ Site/path detection functions available  
✅ Auth state management robust  
✅ Suitable for progress tracking integration

---

## Summary: Current State vs Step 4 Requirements

| Component | Current Status | Step 4 Need |
|-----------|----------------|------------|
| **progress-tracker.js** | ✅ Complete, functions ready | Add `trackPageView()` method |
| **script.js** | ✅ Page load working | Add tracking calls on load |
| **service-worker.js** | ✅ Caching working | Update quiz→practice paths |
| **dashboard.html** | ✅ Stats display working | Real-time updates from practice_scores |
| **quiz1.html** | ✅ Structure complete | Auto-track completion, rename to practice1.html |
| **ai-chat.js** | ✅ AI tutor working | Integrate with quiz context tracking |
| **auth-config.js** | ✅ All helpers present | Use for progress tracking calls |

---

## Critical Code Patterns Ready for Implementation

### Pattern 1: Page View Tracking
```javascript
// Add to script.js after component load
if (window.ProgressTracker && window.isUserLoggedIn?.()) {
    const site = window.getCurrentSite?.();
    const path = window.getCurrentPath?.();
    
    // Determine if article or practice
    const isArticle = path.includes('/notes/');
    const isPractice = path.includes('/quiz') || path.includes('/practice');
    
    window.ProgressTracker.trackPageView({
        site: site,
        item_path: path,
        item_type: isArticle ? 'article' : (isPractice ? 'practice' : 'other'),
        completed: false  // Will be set true when practice completed
    });
}
```

### Pattern 2: Practice Completion Tracking
```javascript
// Add to quiz page script after "Check Answer"
async function trackPracticeCompletion(score, isCorrect) {
    if (!window.ProgressTracker || !window.isUserLoggedIn?.()) return;
    
    const saved = await window.ProgressTracker.saveAttempt({
        practice_url: window.location.href,
        is_correct: isCorrect,
        score: score,
        completed: true
    });
    
    if (saved) {
        // Update dashboard if open
        updateProgressDisplay();
    }
}
```

### Pattern 3: Dashboard Real-Time Updates
```javascript
// Replace loadProgressStats() in dashboard.html
async function loadProgressStats() {
    if (!window.ProgressTracker) return;
    
    const stats = await window.ProgressTracker.getOverallStats();
    
    // Update stats display
    document.getElementById("learnedHours").textContent = 
        stats.total_practices || 0;
    document.getElementById("learnedMeta").textContent = 
        "Practices Completed";
    
    // Optional: Show additional stats
    document.getElementById("avgScore").textContent = 
        stats.average_score + "%";
    document.getElementById("passingCount").textContent = 
        stats.passing_practices;
}
```

---

## Files Ready for Modification in Step 4

### Ready (No dependencies):
1. ✅ `assets/js/progress-tracker.js` - Add `trackPageView()` method
2. ✅ `assets/js/script.js` - Add page tracking calls

### Dependent on above:
3. ✅ `dashboard.html` - Update stats queries to use practice_scores
4. ✅ `notes/class07/.../quiz*.html` - Add completion tracking

### Final steps:
5. ✅ `service-worker.js` - Update quiz→practice file paths
6. ✅ Rename 8 quiz files to practice files

---

## Database Tables Used

### `practice_scores` (NEW SCHEMA - Step 3)
```sql
Columns:
  - user_id (UUID, FK to auth.users)
  - site (string: 'science.raushansync.com')
  - practice_path (string: normalized URL path)
  - score (int 0-100)
  - updated_at (timestamp)

Constraint:
  - Unique: (user_id, site, practice_path) - UPSERT on this
```

### `progress` (NEW SCHEMA - Step 3)
```sql
Columns:
  - id (UUID)
  - user_id (UUID, FK to auth.users)
  - site (string)
  - item_path (string)
  - item_type (enum: 'article', 'practice')
  - completed (boolean)
  - created_at (timestamp)
  - updated_at (timestamp)

Usage in Step 4:
  - Will track ALL page views
  - Set completed=true for practices
```

### `profiles` (NEW SCHEMA - Step 3)
```sql
Columns:
  - id (UUID, PK)
  - full_name (string, 120 chars)
  - education_level (string, 50 chars)
  - phone (string, 20 chars)
  - created_at (timestamp)
```

---

## Performance Optimization Notes

⚠️ Considerations for Step 4:

1. **Debounce Page Views**
   - Don't track every scroll event
   - Track only initial page load + major navigation
   - Prevent duplicate progress entries

2. **Cache Dashboard Stats**
   - getOverallStats() queries entire practice_scores table
   - Consider caching for 5-10 seconds
   - Or paginate with limits

3. **Batch Database Writes**
   - Multiple practice completions → use batch insert
   - Track completion immediately (optimistic update)
   - Sync to DB in background

4. **Memory Management**
   - Clear event listeners on modal close
   - Prevent memory leaks in chat history
   - Limit stored history to last 10 messages

---

## Configuration Constants

### Supabase Configuration (auth-config.js):
```javascript
SUPABASE_URL = 'https://vqchjavjcfrewulqpjcl.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGc...' (JWT token)

DEBUG_AUTH = (localhost or 127.0.0.1 or __AUTH_DEBUG__ flag)
```

### Service Worker Configuration:
```javascript
CACHE_VERSION = 'science-v1.0.4'
CORE_CACHE = 'rs-core-science-v1.0.4'
RUNTIME_CACHE = 'rs-runtime-science-v1.0.4'
MAX_RUNTIME_ENTRIES = 60
```

### AI Chat Configuration (ai-chat.js):
```javascript
WORKER_URL = 'https://quiz-ai-tutor.raushanguptaicloud.workers.dev/'
SUPPORTED_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
```

---

## Testing Checklist for Step 4 Implementation

- [ ] `progress-tracker.js` trackPageView() method added and tested
- [ ] Page views logged to `progress` table on load
- [ ] Practice completions saved with scores
- [ ] Dashboard stats update in real-time
- [ ] Quiz page tracks attempts correctly
- [ ] Score calculation accurate (0-100)
- [ ] Statistics aggregate correctly (average, highest, passing)
- [ ] AI chat shows correct context
- [ ] File rename (quiz→practice) doesn't break links
- [ ] Service worker caches new file names
- [ ] No console errors on any page
- [ ] Offline mode still works with cached content
- [ ] User can see full progress journey
- [ ] Duplicate progress entries prevented (upsert working)
- [ ] Auth state properly checked before tracking

---

## Next Steps for Implementation

1. **Create Step 4 branch** if using git
2. **Add `trackPageView()` to progress-tracker.js**
3. **Add tracking calls to script.js on page load**
4. **Test page view tracking in database**
5. **Add practice completion tracking to quiz pages**
6. **Test score persistence and calculations**
7. **Update dashboard.html stats queries**
8. **Update service-worker.js paths**
9. **Rename 8 quiz files to practice files**
10. **Final testing and deployment**

---

*End of Codebase Overview - Ready for Step 4 Implementation*
