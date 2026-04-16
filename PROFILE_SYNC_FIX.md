# Supabase Profile Sync Fix

## Issues Fixed

### 1. **INSERT Logic Bug** ✅ FIXED
**File**: [assets/js/auth-config.js](assets/js/auth-config.js) (Line 144)

**Problem**: When creating new profiles, the code was setting `patch.id = seed.id`, but the `id` column is auto-generated. This caused inserts to fail or create incorrect records.

**Solution**: Changed to `patch.user_id = seed.id` to correctly link the profile to the authenticated user.

**Before**:
```javascript
if (!existingProfile) {
    // Creating new profile
    patch.id = seed.id;  // ❌ WRONG: id is auto-generated
```

**After**:
```javascript
if (!existingProfile) {
    // Creating new profile
    patch.user_id = seed.id;  // ✅ CORRECT: links to auth.users(id)
```

---

### 2. **AUTO-UPDATE `updated_at` Timestamp** ⚠️ NEEDS SQL TRIGGER

**Problem**: The `updated_at` column never updates when profiles are modified. There's no database trigger to auto-update this field.

**Solution**: Add a PostgreSQL trigger to automatically update `updated_at` on any modification:

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION update_student_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_student_profiles_updated_at ON student_profiles;
CREATE TRIGGER trigger_update_student_profiles_updated_at
BEFORE UPDATE ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION update_student_profiles_updated_at();
```

**How to apply**:
1. Go to Supabase dashboard → SQL Editor
2. Copy and run the SQL above
3. This will auto-update `updated_at` on every profile modification

---

### 3. **Column Reference Verification** ✅ VERIFIED

The following functions correctly use `user_id` for queries and updates:

- **[fetchProfileForSession()](assets/js/auth-config.js)**: Uses `.eq('user_id', session.user.id)` ✅
- **[syncUserProfile()](assets/js/auth-config.js)**: 
  - UPDATE: Uses `.eq('user_id', seed.id)` ✅
  - INSERT: Now correctly uses `patch.user_id = seed.id` ✅ (FIXED)

---

## Code Flow Summary

### When a NEW profile is created (signup):
```
signup.html
  → auth.signUp()
  ↓
auth state change event
  ↓
auth-config.js: initializeAuth() → syncUserProfile()
  ↓
buildProfilePatch() [existingProfile is null]
  → patch.user_id = seed.id ✅
  → patch.email, full_name, grade_class, school_name
  ↓
INSERT into student_profiles (user_id, email, ...)
  ✅ Success - id auto-generates, user_id is set correctly
```

### When an EXISTING profile is updated (dashboard edit):
```
dashboard.html: handleEditFormSubmit()
  → auth.updateUser() [updates email & metadata]
  ↓
syncUserProfile({ explicitProfile: {...} })
  ↓
buildProfilePatch() [existingProfile exists]
  → Only includes changed fields
  → Does NOT include id (already exists)
  ↓
UPDATE student_profiles WHERE user_id = seed.id
  → Trigger auto-updates updated_at ✅
  ✅ Success
```

---

## Testing Checklist

- [ ] Create new account → Profile inserts with `user_id` set correctly
- [ ] Edit profile → Record updates without errors
- [ ] Check `updated_at` → Changes timestamp when profile is modified
- [ ] View profile → All fields display correctly
- [ ] Multiple updates → `updated_at` increments each time

---

## Related Files

- [assets/js/auth-config.js](assets/js/auth-config.js) - Profile sync logic (FIXED)
- [dashboard.html](dashboard.html) - Profile edit form submission
- Database table: `student_profiles`

## Schema (Reference)

```sql
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  grade_class INTEGER,
  school_name TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```
