# New Database Schema - Quick Reference

**Status**: Ready for Supabase SQL Editor  
**Supabase-Compatible**: ✅ Yes (PostgreSQL 15+)

---

## Table 1: `profiles`

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    education_level TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Purpose**: User account metadata  
**Rows per user**: 1  
**Size**: ~100-200 bytes per user  

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "Raushan Kumar",
  "education_level": "Class 7",
  "phone": "+91-9876543210",
  "created_at": "2026-04-16T12:00:00+00:00"
}
```

**Access Pattern**:
```javascript
// Get user profile
await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Update profile
await supabase
  .from('profiles')
  .update({ full_name: 'New Name' })
  .eq('id', userId);
```

---

## Table 2: `progress`

```sql
CREATE TABLE progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site TEXT NOT NULL,
    item_path TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('article', 'practice')),
    completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, site, item_path)
)
```

**Purpose**: Track completion of articles and practice problems  
**Rows per user**: Up to 500+ (one per unique item)  
**Size**: ~80 bytes per row  

**Example**:
```json
{
  "id": 1,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "site": "raushansync-science",
  "item_path": "/notes/class07/chapter01-nutrition-in-plants/core-concept-1/",
  "item_type": "article",
  "completed": true,
  "updated_at": "2026-04-16T12:05:00+00:00"
}
```

**Allowed Values**:
- `item_type`: `'article'` or `'practice'` only
- `site`: lowercase with hyphens (e.g., `'raushansync-science'`)
- `item_path`: full path from URL root (e.g., `'/notes/class07/...'`)

**Access Patterns**:
```javascript
// Mark article as completed
await supabase
  .from('progress')
  .upsert({
    user_id: userId,
    site: 'raushansync-science',
    item_path: '/notes/class07/chapter01/',
    item_type: 'article',
    completed: true
  });

// Get all completed practices
const { data } = await supabase
  .from('progress')
  .select('item_path')
  .eq('user_id', userId)
  .eq('item_type', 'practice')
  .eq('completed', true);

// Check if user completed specific item
const { data } = await supabase
  .from('progress')
  .select('completed')
  .eq('user_id', userId)
  .eq('site', 'raushansync-science')
  .eq('item_path', '/notes/class07/chapter01/')
  .single();
```

---

## Table 3: `practice_scores`

```sql
CREATE TABLE practice_scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site TEXT NOT NULL,
    practice_path TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, site, practice_path)
)
```

**Purpose**: Store quiz/practice scores (0-100)  
**Rows per user**: Up to 100+ (one per practice quiz)  
**Size**: ~80 bytes per row  

**Example**:
```json
{
  "id": 1,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "site": "raushansync-science",
  "practice_path": "/notes/class07/chapter01-nutrition-in-plants/core-concept-1/practice/",
  "score": 85,
  "updated_at": "2026-04-16T12:10:00+00:00"
}
```

**Allowed Values**:
- `score`: integer from 0 to 100 (percent)
- `practice_path`: full path to practice quiz

**Access Patterns**:
```javascript
// Save practice score
await supabase
  .from('practice_scores')
  .upsert({
    user_id: userId,
    site: 'raushansync-science',
    practice_path: '/notes/class07/chapter01/.../practice/',
    score: 85
  });

// Get user's best scores
const { data } = await supabase
  .from('practice_scores')
  .select('practice_path, score')
  .eq('user_id', userId)
  .eq('site', 'raushansync-science')
  .order('score', { ascending: false });

// Calculate average score
const { data } = await supabase
  .from('practice_scores')
  .select('score')
  .eq('user_id', userId);
// Then: const avg = data.reduce((a,b) => a+b.score, 0) / data.length;

// Get score for specific practice
const { data } = await supabase
  .from('practice_scores')
  .select('score')
  .eq('user_id', userId)
  .eq('practice_path', '/notes/class07/chapter01/.../practice/')
  .single();
```

---

## Indexes (Optimized)

```sql
✅ idx_progress_user_id
   ON progress(user_id)
   → Fast: Get all user's progress

✅ idx_progress_user_id_item_type
   ON progress(user_id, item_type)
   → Fast: Get all user's articles OR practices

✅ idx_progress_user_id_site
   ON progress(user_id, site)
   → Fast: Get all user's progress on specific site

✅ idx_practice_scores_user_id
   ON practice_scores(user_id)
   → Fast: Get all user's scores

✅ idx_practice_scores_user_id_site
   ON practice_scores(user_id, site)
   → Fast: Get all scores on specific site
```

---

## Triggers (Auto-Maintenance)

```sql
✅ trigger_update_progress_updated_at
   → Automatically sets updated_at = NOW() on update

✅ trigger_update_practice_scores_updated_at
   → Automatically sets updated_at = NOW() on update

✅ on_auth_user_created
   → Automatically creates profile row when user signs up
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own rows:

```sql
✅ Users can SELECT their own rows
✅ Users can INSERT their own rows
✅ Users can UPDATE their own rows
✅ Users can DELETE their own rows
✅ Users CANNOT see others' data
✅ Service role key bypasses RLS (admin operations)
```

**Testing RLS**:
```javascript
// This works (authenticated user sees own data):
const { data } = await supabase
  .from('progress')
  .select('*'); // Only returns current user's rows

// This fails (RLS blocks cross-user access):
const { data } = await supabase
  .from('progress')
  .select('*')
  .eq('user_id', 'someone-elses-id'); // Empty result (RLS filtered)
```

---

## Sample Queries for Application Code

### Dashboard Stats
```javascript
async function getDashboardStats(userId) {
  // Get user profile
  const profile = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Get completion counts
  const { count: articlesRead } = await supabase
    .from('progress')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('item_type', 'article')
    .eq('completed', true);

  const { count: practicesAttempted } = await supabase
    .from('progress')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('item_type', 'practice')
    .eq('completed', true);

  // Get average practice score
  const { data: scores } = await supabase
    .from('practice_scores')
    .select('score')
    .eq('user_id', userId);

  const avgScore = scores.length 
    ? Math.round(scores.reduce((a,b) => a+b.score, 0) / scores.length)
    : 0;

  return {
    profile,
    stats: {
      articlesRead: articlesRead || 0,
      practicesAttempted: practicesAttempted || 0,
      averageScore: avgScore
    }
  };
}
```

### Mark Item Complete
```javascript
async function markItemComplete(userId, site, itemPath, itemType) {
  return await supabase
    .from('progress')
    .upsert({
      user_id: userId,
      site: site,
      item_path: itemPath,
      item_type: itemType,
      completed: true
    });
}
```

### Save Practice Score
```javascript
async function savePracticeScore(userId, site, practicePath, score) {
  return await supabase
    .from('practice_scores')
    .upsert({
      user_id: userId,
      site: site,
      practice_path: practicePath,
      score: Math.min(100, Math.max(0, score)) // Clamp 0-100
    });
}
```

---

## Migration Checklist

- [ ] Database migration SQL executed
- [ ] Tables verified in Supabase
- [ ] RLS policies confirmed active
- [ ] Test queries pass
- [ ] Ready for app code refactor

**Next**: Update application code to use new schema
