# Database Migration - Validation & Testing

**Purpose**: Verify migration success and test new schema  
**Run After**: SQL migration completes

---

## Part 1: Verification Queries (Run in Supabase SQL Editor)

### 1.1 Verify All Tables Exist

```sql
-- Should return 3 rows: profiles, progress, practice_scores
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected Output:**
```
profiles
practice_scores
progress
```

---

### 1.2 Verify Old Tables Are Deleted

```sql
-- Should return 0 rows (no student_profiles, no quiz_attempts)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('student_profiles', 'quiz_attempts');
```

**Expected Output:** (empty)

---

### 1.3 Verify RLS Is Enabled

```sql
-- Should return 3 rows, all with "true"
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'progress', 'practice_scores');
```

**Expected Output:**
```
public  | profiles          | t
public  | practice_scores   | t
public  | progress          | t
```

---

### 1.4 Verify All Indexes Created

```sql
-- Should return 5 rows (all indexes)
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('progress', 'practice_scores')
ORDER BY indexname;
```

**Expected Output:**
```
idx_practice_scores_user_id
idx_practice_scores_user_id_site
idx_progress_user_id
idx_progress_user_id_item_type
idx_progress_user_id_site
```

---

### 1.5 Verify Triggers Exist

```sql
-- Should return 3 rows (auto-update triggers + signup trigger)
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;
```

**Expected Output:**
```
on_auth_user_created                    | INSERT | users
trigger_update_practice_scores_updated_at | UPDATE | practice_scores
trigger_update_progress_updated_at      | UPDATE | progress
```

---

### 1.6 Column Structure Verification

```sql
-- Verify profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected columns: id, full_name, education_level, phone, created_at

-- Verify progress table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'progress'
ORDER BY ordinal_position;

-- Expected columns: id, user_id, site, item_path, item_type, completed, updated_at

-- Verify practice_scores table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'practice_scores'
ORDER BY ordinal_position;

-- Expected columns: id, user_id, site, practice_path, score, updated_at
```

---

## Part 2: RLS Security Testing

⚠️ **These tests require an authenticated user session**

### 2.1 Test Insert as Authenticated User

```javascript
// In browser console (logged in as user):

const { data, error } = await supabase
  .from('profiles')
  .insert({
    id: supabase.auth.user().id,
    full_name: 'Test User',
    education_level: 'Class 7'
  });

console.log({ data, error });

// Expected: Either success or "duplicate key" if profile exists
// If RLS working: will only insert own profile
```

### 2.2 Test Cross-User Access (Should Fail)

```javascript
// Get any UUID from database (not your user)
// Then try to access it:

const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'someone-else-uuid');

console.log({ data, error });

// Expected: Empty data array (RLS filtered out)
```

### 2.3 Test Insert to Progress

```javascript
// In browser console (logged in):

const { data, error } = await supabase
  .from('progress')
  .insert({
    user_id: supabase.auth.user().id,
    site: 'raushansync-science',
    item_path: '/notes/class07/chapter01/',
    item_type: 'article',
    completed: true
  });

console.log({ data, error });

// Expected: Success (insert own progress)
```

### 2.4 Test Insert to Practice Scores

```javascript
// In browser console (logged in):

const { data, error } = await supabase
  .from('practice_scores')
  .insert({
    user_id: supabase.auth.user().id,
    site: 'raushansync-science',
    practice_path: '/practice/class07/chapter01/',
    score: 85
  });

console.log({ data, error });

// Expected: Success (insert own score)
```

---

## Part 3: Auto-Feature Testing

### 3.1 Test Auto-Profile Creation

```javascript
// Sign up a new test user
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'TestPassword123!',
  options: {
    data: {
      full_name: 'Test Student',
      education_level: 'Class 6'
    }
  }
});

// Then check if profile was auto-created:
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log('Auto-created profile:', profile);

// Expected: Profile row exists with full_name and education_level
```

### 3.2 Test Auto-Update Timestamps

```javascript
// Insert a progress record
const { data: insert1 } = await supabase
  .from('progress')
  .insert({
    user_id: supabase.auth.user().id,
    site: 'raushansync-science',
    item_path: '/test/path1/',
    item_type: 'article',
    completed: false
  })
  .select();

const timestamp1 = insert1[0].updated_at;
console.log('First insert, updated_at:', timestamp1);

// Wait 2 seconds
await new Promise(resolve => setTimeout(resolve, 2000));

// Update the record
const { data: update } = await supabase
  .from('progress')
  .update({ completed: true })
  .eq('id', insert1[0].id)
  .select();

const timestamp2 = update[0].updated_at;
console.log('After update, updated_at:', timestamp2);

// Expected: timestamp2 > timestamp1 (auto-updated!)
console.log('Timestamps different?', new Date(timestamp2) > new Date(timestamp1));
```

---

## Part 4: Data Integrity Testing

### 4.1 Test UNIQUE Constraint (progress)

```javascript
// Try to insert duplicate
const userId = supabase.auth.user().id;

const { error } = await supabase
  .from('progress')
  .insert({
    user_id: userId,
    site: 'raushansync-science',
    item_path: '/test/path/',
    item_type: 'article',
    completed: true
  });

// Try same insert again
const { error: error2 } = await supabase
  .from('progress')
  .insert({
    user_id: userId,
    site: 'raushansync-science',
    item_path: '/test/path/',
    item_type: 'article',
    completed: false
  });

console.log('Error on duplicate:', error2?.message);

// Expected: "duplicate key" error (UNIQUE constraint works)
```

### 4.2 Test CHECK Constraint (score range)

```javascript
// Try invalid score (> 100)
const { error } = await supabase
  .from('practice_scores')
  .insert({
    user_id: supabase.auth.user().id,
    site: 'raushansync-science',
    practice_path: '/practice/test/',
    score: 150  // Invalid!
  });

console.log('Error on invalid score:', error?.message);

// Expected: CHECK constraint error (score must be 0-100)
```

### 4.3 Test CHECK Constraint (item_type)

```javascript
// Try invalid item_type
const { error } = await supabase
  .from('progress')
  .insert({
    user_id: supabase.auth.user().id,
    site: 'raushansync-science',
    item_path: '/test/',
    item_type: 'invalid_type',  // Should be 'article' or 'practice'
    completed: true
  });

console.log('Error on invalid item_type:', error?.message);

// Expected: CHECK constraint error
```

---

## Part 5: Performance Testing (Optional)

### 5.1 Test Index Performance

```sql
-- This should be very fast (< 1ms) thanks to index
EXPLAIN ANALYZE
SELECT * FROM progress
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
AND item_type = 'article';

-- Look for "Index Scan" in output (fast!)
-- Look for cost numbers (should be low)
```

### 5.2 Bulk Insert Test

```javascript
// Generate 100 sample rows
const userId = supabase.auth.user().id;
const rows = [];

for (let i = 0; i < 100; i++) {
  rows.push({
    user_id: userId,
    site: 'raushansync-science',
    item_path: `/test/path${i}/`,
    item_type: i % 2 === 0 ? 'article' : 'practice',
    completed: Math.random() > 0.5
  });
}

// Insert all at once
console.time('Bulk insert 100 rows');
const { error } = await supabase
  .from('progress')
  .insert(rows);
console.timeEnd('Bulk insert 100 rows');

// Expected: Should complete in < 500ms
```

---

## Part 6: Comparison: Old vs New Schema

| Feature | Old | New |
|---------|-----|-----|
| **User Table** | `student_profiles` | `profiles` |
| **Attempt History** | `quiz_attempts` (all attempts stored) | ❌ Not stored (only final score) |
| **Progress Tracking** | Quiz URL only | Article + Practice paths |
| **Counters** | `total_quizzes_attempted`, `total_correct_answers` (stored) | ❌ Calculated on-demand |
| **Score Storage** | Each attempt logged | Final score only |
| **Email** | In database | Auth.users only (more secure) |
| **Complexity** | 2 tables + 1 trigger | 3 tables + 3 triggers |
| **Size per User** | ~1KB+ (grows with attempts) | ~200 bytes base + 80 bytes per item |
| **Performance** | Slower (sums required) | Fast (direct lookup) |

---

## Checklist: All Tests Pass?

- [ ] Verification Query 1.1 - 3 tables exist
- [ ] Verification Query 1.2 - Old tables deleted
- [ ] Verification Query 1.3 - RLS enabled
- [ ] Verification Query 1.4 - 5 indexes created
- [ ] Verification Query 1.5 - 3 triggers exist
- [ ] Verification Query 1.6 - All columns correct structure
- [ ] RLS Test 2.1 - Can insert own profile
- [ ] RLS Test 2.2 - Cannot see other users' data
- [ ] RLS Test 2.3 - Can insert own progress
- [ ] RLS Test 2.4 - Can insert own scores
- [ ] Auto Feature 3.1 - Profile auto-created on signup
- [ ] Auto Feature 3.2 - Timestamps auto-update
- [ ] Data Integrity 4.1 - UNIQUE constraint works
- [ ] Data Integrity 4.2 - Score CHECK constraint works
- [ ] Data Integrity 4.3 - Item type CHECK constraint works

---

**✅ All tests pass? Ready for Step 3: App Code Migration!**
