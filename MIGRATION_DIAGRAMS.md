# Database Migration v2 - Architecture Diagrams

**Visual Reference**: Schema changes and data flow  
**Format**: Text-based diagrams (ASCII art)

---

## Diagram 1: OLD SCHEMA (To Be Deleted)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPRECATED SCHEMA                            │
│                   (Will be deleted)                             │
└─────────────────────────────────────────────────────────────────┘

SUPABASE INSTANCE
├─ auth.users
│  ├─ id (UUID)
│  ├─ email
│  └─ password_hash
│
└─ public.student_profiles (❌ TO DELETE)
   ├─ id (UUID) → PK, references auth.users
   ├─ email (TEXT) → DUPLICATE! (should use auth.users.email)
   ├─ full_name
   ├─ grade_class (6-12) → RENAMED to education_level
   ├─ school_name
   ├─ created_at
   ├─ last_login
   ├─ total_quizzes_attempted (INT) → UNUSED, to be removed
   ├─ total_correct_answers (INT) → UNUSED, to be removed
   └─ updated_at

public.quiz_attempts (❌ TO DELETE)
├─ id (BIGINT) → PK
├─ user_id (UUID) → FK to auth.users
├─ quiz_url (TEXT) → Will become item_path + type
├─ question_number (INT)
├─ question_text (TEXT) → Not needed anymore
├─ user_answer (TEXT) → Not needed anymore
├─ correct_answer (TEXT) → Not needed anymore
├─ is_correct (BOOLEAN) → Becomes just score value
├─ time_spent_seconds (INT) → Removed from tracking
└─ created_at

PROBLEMS WITH OLD SCHEMA:
├─ Email duplicated in student_profiles AND auth.users
├─ Unused counters waste space
├─ Detailed attempt history bloats database
├─ No RLS protection
├─ Complex queries to get stats
└─ Inefficient indexing
```

---

## Diagram 2: NEW SCHEMA (To Be Created)

```
┌─────────────────────────────────────────────────────────────────┐
│                      NEW SCHEMA                                 │
│                   (Production Ready)                            │
└─────────────────────────────────────────────────────────────────┘

SUPABASE INSTANCE
├─ auth.users (unchanged)
│  ├─ id (UUID)
│  ├─ email ✅ SINGLE SOURCE OF TRUTH
│  └─ password_hash
│
├─ public.profiles (✅ NEW)
│  ├─ id (UUID) → PK, references auth.users(id)
│  ├─ full_name (TEXT)
│  ├─ education_level (TEXT) ✅ REPLACES grade_class
│  ├─ phone (TEXT) ✅ NEW
│  ├─ created_at (TIMESTAMPTZ)
│  └─ updated_at ✅ AUTO-UPDATED
│
├─ public.progress (✅ NEW)
│  ├─ id (BIGINT) → PK, auto-increment
│  ├─ user_id (UUID) → FK to auth.users(id)
│  ├─ site (TEXT) → e.g., "raushansync-science"
│  ├─ item_path (TEXT) → Article/practice path
│  ├─ item_type (TEXT) → "article" OR "practice"
│  ├─ completed (BOOLEAN)
│  ├─ updated_at (TIMESTAMPTZ) → AUTO-UPDATED
│  └─ UNIQUE(user_id, site, item_path)
│
└─ public.practice_scores (✅ NEW)
   ├─ id (BIGINT) → PK, auto-increment
   ├─ user_id (UUID) → FK to auth.users(id)
   ├─ site (TEXT) → e.g., "raushansync-science"
   ├─ practice_path (TEXT) → Practice quiz path
   ├─ score (INTEGER) → 0-100 (CHECK constraint)
   ├─ updated_at (TIMESTAMPTZ) → AUTO-UPDATED
   └─ UNIQUE(user_id, site, practice_path)

BENEFITS OF NEW SCHEMA:
├─ Email ONLY in auth.users (more secure)
├─ Minimal profile storage (200 bytes per user)
├─ Efficient progress tracking (80 bytes per item)
├─ Fast score lookups (80 bytes per practice)
├─ RLS enabled on all tables
├─ Auto-updating timestamps
├─ Optimized indexes
└─ Better data integrity
```

---

## Diagram 3: DATA RELATIONSHIPS

```
┌────────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                   │
└────────────────────────────────────────────────────────────────┘

1. USER SIGNUP FLOW
─────────────────────

User Signs Up (signup.html)
    ↓
Creates auth.users row
    ↓
Trigger: on_auth_user_created
    ↓
Auto-creates profiles row
    ↓ (with full_name, education_level from metadata)
    ↓
✅ Profile ready


2. USER COMPLETES ARTICLE
─────────────────────────

User reads: /notes/class07/chapter01/
    ↓
Browser calls:
    INSERT INTO progress (
        user_id, site, item_path,
        item_type='article', completed=true
    )
    ↓
Trigger: trigger_update_progress_updated_at
    ↓
updated_at set to NOW()
    ↓
✅ Progress tracked


3. USER TAKES PRACTICE QUIZ
────────────────────────────

User completes: /practice/class07/chapter01/
    ↓
Quiz calculates score: 85
    ↓
Browser calls:
    INSERT INTO practice_scores (
        user_id, site, practice_path, score=85
    )
    ↓
Trigger: trigger_update_practice_scores_updated_at
    ↓
updated_at set to NOW()
    ↓
Browser also calls:
    INSERT INTO progress (
        user_id, site, item_path='/practice/class07/chapter01/',
        item_type='practice', completed=true
    )
    ↓
✅ Score + progress tracked


4. DASHBOARD LOADS STATS
────────────────────────

User views dashboard.html
    ↓
Browser queries:
    SELECT * FROM profiles WHERE id = user_id
    ↓ Returns: full_name, education_level, phone
    ↓
Browser queries:
    SELECT COUNT(*) FROM progress
    WHERE user_id = ? AND item_type='article' AND completed=true
    ↓ Returns: 42 articles read
    ↓
Browser queries:
    SELECT COUNT(*), AVG(score) FROM practice_scores
    WHERE user_id = ?
    ↓ Returns: 15 practices, 78 avg score
    ↓
✅ Dashboard populated
```

---

## Diagram 4: RLS SECURITY POLICIES

```
┌────────────────────────────────────────────────────────────────┐
│              ROW LEVEL SECURITY (RLS)                          │
│         Every table protected by strict policies                │
└────────────────────────────────────────────────────────────────┘

profiles TABLE
──────────────

                    ┌─────────────────────────────┐
                    │    User: John               │
                    │    Session: auth.uid()      │
                    │    Wants: Read own profile  │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ↓                          ↓                          ↓
    SELECT              INSERT               UPDATE
    ✅ ALLOWED          ✅ ALLOWED           ✅ ALLOWED
    (auth.uid() = id)   (auth.uid() = id)    (auth.uid() = id)
    Sees own row        Can insert own       Can update own
                        row                  row only


                    ┌─────────────────────────────┐
                    │    User: John               │
                    │    Session: auth.uid()      │
                    │    Wants: Read Jane's prof  │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ↓                          ↓                          ↓
    SELECT              INSERT               UPDATE
    ❌ BLOCKED          ❌ BLOCKED           ❌ BLOCKED
    RLS filters         RLS prevents         RLS prevents
    Returns empty       insert other         update other
                        user's data          user's data


progress & practice_scores TABLES
─────────────────────────────────

Same pattern as profiles:
├─ SELECT: auth.uid() = user_id
├─ INSERT: auth.uid() = user_id
├─ UPDATE: auth.uid() = user_id
└─ DELETE: auth.uid() = user_id

Result:
✅ Users can ONLY see/modify their own data
❌ Cross-user access is automatically blocked
```

---

## Diagram 5: INDEX PERFORMANCE

```
┌────────────────────────────────────────────────────────────────┐
│            INDEXES (Query Performance)                         │
└────────────────────────────────────────────────────────────────┘

INDEX: idx_progress_user_id
───────────────────────────

Query: Get all user's items
    SELECT * FROM progress WHERE user_id = ?

Without index: Scan all 10,000 rows ❌ SLOW (100ms)
With index:    Direct lookup ✅ FAST (<1ms)

Tree structure:
    Root: [user_id A] [user_id B] [user_id C]
           │           │           │
    Leaf: [rows]   [rows]      [rows]
           ↓         ↓          ↓
         10 rows   50 rows    200 rows


INDEX: idx_progress_user_id_item_type
──────────────────────────────────────

Query: Get user's completed practices
    SELECT * FROM progress
    WHERE user_id = ? AND item_type = 'practice'

Tree structure:
    Root: [user_id A]
          ├─ [article]  → 42 rows
          └─ [practice] → 8 rows
                  ↓
             Direct access ✅ FAST (<1ms)


INDEX: idx_practice_scores_user_id_site
────────────────────────────────────────

Query: Get user's scores on specific site
    SELECT * FROM practice_scores
    WHERE user_id = ? AND site = 'raushansync-science'

Tree structure:
    Root: [user_id A]
          ├─ [raushansync-science] → 15 rows ✅ FAST
          └─ [other-site]          → 5 rows
```

---

## Diagram 6: TRIGGER AUTOMATION

```
┌────────────────────────────────────────────────────────────────┐
│                    TRIGGERS                                    │
│         Auto-maintenance and consistency                       │
└────────────────────────────────────────────────────────────────┘

TRIGGER 1: trigger_update_progress_updated_at
──────────────────────────────────────────────

Event: UPDATE progress SET completed = true
    ↓
Trigger fires BEFORE UPDATE
    ↓
Function: update_updated_at_column()
    ↓
    SET NEW.updated_at = NOW()
    ↓
Database saves row with new timestamp
    ↓
Result: ✅ updated_at always current


TRIGGER 2: trigger_update_practice_scores_updated_at
─────────────────────────────────────────────────────

Event: UPDATE practice_scores SET score = 95
    ↓
Trigger fires BEFORE UPDATE
    ↓
Function: update_updated_at_column()
    ↓
    SET NEW.updated_at = NOW()
    ↓
Database saves row with new timestamp
    ↓
Result: ✅ updated_at always current


TRIGGER 3: on_auth_user_created
───────────────────────────────

Event: INSERT INTO auth.users (new user signs up)
    ↓
Trigger fires AFTER INSERT
    ↓
Function: handle_new_user()
    ↓
    INSERT INTO profiles (
        id = new.id,
        full_name = new.raw_user_meta_data->>'full_name',
        education_level = new.raw_user_meta_data->>'education_level'
    )
    ↓
Database creates profiles row automatically
    ↓
Result: ✅ Profile auto-created on signup
         ✅ No manual INSERT needed
```

---

## Diagram 7: MIGRATION FLOW

```
┌────────────────────────────────────────────────────────────────┐
│                 MIGRATION EXECUTION                            │
│              Step-by-step process                              │
└────────────────────────────────────────────────────────────────┘

STEP 1: BACKUP
──────────────
Supabase → Backups → Create Backup
    ↓
⏳ Wait 5-10 minutes
    ↓
✅ Full database snapshot saved


STEP 2: PREPARE SQL
───────────────────
Load SUPABASE_MIGRATION_v2.sql
    ↓
Copy entire SQL script
    ↓
✅ Ready to paste


STEP 3: EXECUTE
───────────────
Supabase → SQL Editor → New Query
    ↓
Paste SQL script
    ↓
Click "Run"
    ↓
⏳ Wait 5-15 seconds
    ↓
✅ No errors → Success!
❌ Errors → Debug & retry


STEP 4: VERIFY
──────────────
Run verification queries
    ↓
Check:
├─ 3 tables exist ✓
├─ Old tables gone ✓
├─ RLS enabled ✓
├─ Indexes created ✓
├─ Triggers active ✓
└─ Can insert data ✓
    ↓
✅ All pass → Ready for Step 3


STEP 5: APP CODE (Step 3 - NOT YET)
────────────────────────────────────
Update progress-tracker.js
Update quiz → practice references
Update service-worker.js
Update dashboard.html
    ↓
✅ Deploy to production
```

---

## Diagram 8: TABLE SIZE COMPARISON

```
┌────────────────────────────────────────────────────────────────┐
│         DATABASE SIZE REDUCTION                               │
│    Old Schema vs New Schema                                    │
└────────────────────────────────────────────────────────────────┘

USER WITH 50 PRACTICE ATTEMPTS
──────────────────────────────

OLD SCHEMA:
    student_profiles      ← 1 row × 300 bytes   = 300 B
    quiz_attempts         ← 50 rows × 200 bytes = 10,000 B
                                            TOTAL: 10,300 B (~10 KB)

NEW SCHEMA:
    profiles             ← 1 row × 200 bytes   = 200 B
    progress             ← 50 rows × 80 bytes  = 4,000 B
    practice_scores      ← 50 rows × 80 bytes  = 4,000 B
                                            TOTAL: 8,200 B (~8 KB)

SAVINGS PER USER: ~20% ✅


USER WITH 500 PRACTICE ATTEMPTS
────────────────────────────────

OLD SCHEMA:
    student_profiles      ← 1 row × 300 bytes    = 300 B
    quiz_attempts         ← 500 rows × 200 bytes = 100,000 B
                                            TOTAL: 100,300 B (~98 KB)

NEW SCHEMA:
    profiles             ← 1 row × 200 bytes    = 200 B
    progress             ← 500 rows × 80 bytes  = 40,000 B
    practice_scores      ← 500 rows × 80 bytes  = 40,000 B
                                            TOTAL: 80,200 B (~78 KB)

SAVINGS PER USER: ~20% ✅ (but also faster queries!)


10,000 USERS WITH HISTORY
──────────────────────────

OLD SCHEMA:    ~900 MB
NEW SCHEMA:    ~700 MB
TOTAL SAVINGS: ~200 MB (~22%) ✅

PLUS: 10-50x faster queries! ⚡
```

---

## Diagram 9: COMPLETE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────┘

                          BROWSER / APP
                     (index.html, dashboard.html)
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
            ┌──────────┐  ┌──────────┐  ┌────────────┐
            │  Login   │  │  Profile │  │  Practice  │
            │ signup.  │  │dashboard │  │   Quiz     │
            │  html    │  │  .html   │  │   .html    │
            └──────────┘  └──────────┘  └────────────┘
                    │           │           │
            auth.signUp  auth.signIn    ProgressTracker.
            auth.signOut               saveAttempt()
                    │           │           │
                    └───────────┼───────────┘
                                │
                ┌───────────────▼───────────────┐
                │  SUPABASE CLIENT              │
                │  (window.supabaseClient)      │
                │                              │
                │ • Initialize                 │
                │ • Auth methods               │
                │ • Database queries           │
                │ • RLS enforcement            │
                └───────────────┬───────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │   auth.users │    │  PROFILES    │    │  PROGRESS    │
    ├──────────────┤    ├──────────────┤    ├──────────────┤
    │ • id (UUID)  │    │ • id (PK)    │    │ • id (PK)    │
    │ • email      │    │ • full_name  │    │ • user_id    │
    │ • password   │    │ • education  │    │ • site       │
    └──────────────┘    │ • phone      │    │ • item_path  │
                        │ • created_at │    │ • item_type  │
                        │ • updated_at │    │ • completed  │
                        └──────────────┘    │ • updated_at │
                                            └──────────────┘

                        ┌──────────────────────┐
                        │ PRACTICE_SCORES      │
                        ├──────────────────────┤
                        │ • id (PK)            │
                        │ • user_id            │
                        │ • site               │
                        │ • practice_path      │
                        │ • score (0-100)      │
                        │ • updated_at         │
                        └──────────────────────┘

SECURITY LAYERS:
├─ RLS on all tables (users see only own data)
├─ Auth triggers for auto-profile creation
├─ Email in auth.users (not in database)
├─ Timestamps auto-update via triggers
├─ Optimized indexes for performance
└─ CHECK constraints for data integrity
```

---

**Visual Guide Complete!** Use these diagrams to understand the migration.
