# ⚠️ DATABASE MIGRATION v2 - BACKUP & EXECUTION GUIDE

**Date**: April 16, 2026  
**Status**: PRODUCTION-READY SQL ONLY  
**Scope**: Database schema replacement (NO app code changes yet)

---

## 🔴 CRITICAL: BACKUP BEFORE EXECUTION

### Step 1: Export Current Database

**This WILL destroy old tables.** Back up everything first.

#### Option A: Supabase Dashboard (Recommended)
```
1. Go to: https://app.supabase.com/project/[YOUR_PROJECT_ID]/database/backups
2. Click "Create Backup"
3. Wait for completion (usually 2-5 minutes)
4. Download backup file if needed
```

#### Option B: SQL Export (Manual)
```sql
-- Run this in Supabase SQL Editor BEFORE the migration:

-- Export student_profiles data
SELECT * FROM public.student_profiles;

-- Export quiz_attempts data  
SELECT * FROM public.quiz_attempts;

-- Save the output as CSV/JSON
```

---

## 📋 WHAT THIS MIGRATION DOES

### Removes (Destructive)
```sql
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.student_profiles CASCADE;
```

### Creates (New Schema)
```
profiles (user metadata)
├── id (PK)
├── full_name
├── education_level
├── phone
└── created_at

progress (completion tracking)
├── id (PK)
├── user_id (FK)
├── site
├── item_path
├── item_type ('article' | 'practice')
├── completed (boolean)
└── updated_at (auto)

practice_scores (quiz scores)
├── id (PK)
├── user_id (FK)
├── site
├── practice_path
├── score (0-100)
└── updated_at (auto)
```

### Features Added
- ✅ RLS (Row Level Security) - users see only own data
- ✅ Auto-updating timestamps on all tables
- ✅ Optimized indexes for performance
- ✅ Data integrity constraints (UNIQUE, CHECK)
- ✅ Auto-profile creation on signup
- ✅ Free-tier compatible

---

## ⚡ EXECUTION STEPS

### Step 1: Open Supabase SQL Editor
```
1. Go to: https://app.supabase.com/project/[YOUR_PROJECT_ID]
2. Click "SQL Editor" in left sidebar
3. Click "New Query"
```

### Step 2: Copy Full Migration Script
- File: `SUPABASE_MIGRATION_v2.sql` (this repo)
- Copy entire contents

### Step 3: Paste Into SQL Editor
- Paste into Supabase SQL editor
- Do NOT modify anything yet

### Step 4: Review (Optional)
- Scan for your project specifics
- Check table names match expectations

### Step 5: Execute Migration
- Click "Run" button
- **Status**: Should show "Success" with no errors
- **Time**: Usually 5-15 seconds

### Step 6: Verify Tables Created
```sql
-- Run this query to verify:

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected output:
-- profiles
-- progress
-- practice_scores
```

### Step 7: Check Policies Enabled
```sql
-- Verify RLS is active:

SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'progress', 'practice_scores');

-- Expected: all should show "true"
```

---

## ⚠️ WHAT HAPPENS TO OLD DATA

### Old Tables
- `student_profiles` - **DELETED** (contains user metadata)
- `quiz_attempts` - **DELETED** (contains attempt history)

### Data Loss Warning
- ❌ User profiles will be lost (email stays in auth.users)
- ❌ Quiz attempt history will be lost
- ❌ Progress counters will be lost

**Options:**
1. **Production**: Backup first, migrate data separately
2. **Development**: Safe to lose old data
3. **Hybrid**: Export old data before migration if needed

---

## ✅ POST-MIGRATION CHECKLIST

After migration completes, verify:

- [ ] Run verification queries above - all pass
- [ ] No error messages in SQL editor
- [ ] 3 new tables exist in database
- [ ] Can see tables in Supabase Table Editor
- [ ] RLS policies show as enabled
- [ ] Auth trigger is active

### Optional: Test Insert
```sql
-- This should fail (RLS blocks you):
INSERT INTO profiles (id, full_name) 
VALUES ('test-uuid', 'Test User');

-- Should show: "new row violates row-level security policy"
-- This is expected and correct!
```

---

## 🔄 ROLLBACK PROCEDURE

If migration fails or you need to rollback:

### Option 1: Restore from Backup
```
1. Supabase Dashboard → Database → Backups
2. Select backup before migration
3. Click "Restore"
4. Confirm (will overwrite current database)
```

### Option 2: Manual Cleanup (if needed)
```sql
-- Drop new tables if migration failed partway:
DROP TABLE IF EXISTS public.practice_scores CASCADE;
DROP TABLE IF EXISTS public.progress CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- You can then re-run the migration or restore from backup
```

---

## 📝 WHAT'S NEXT (After Migration)

**Do NOT run yet.** Next phase:

1. Update frontend code to use new schema
   - `profiles` instead of `student_profiles`
   - `progress` instead of `quiz_attempts`
   - `practice_scores` (new table)

2. Rename quiz files to practice files
   - `quiz1.html` → `practice1.html`
   - Update all references

3. Update JavaScript
   - `.from('quiz_attempts')` → `.from('practice_scores')`
   - Rename context fields
   - Update API calls

4. Update documentation
   - Schema diagrams
   - API reference
   - Code examples

**This migration is database-only. App code changes are STEP 3.**

---

## ❓ FAQ

**Q: Can I test this on development first?**  
A: Yes! Use a separate Supabase project or a dev branch.

**Q: How long does migration take?**  
A: 5-15 seconds typically. Should be instant.

**Q: What if I have active users?**  
A: Logout everyone first (clear sessions). They'll re-authenticate and create new profiles automatically.

**Q: Can I keep the old tables?**  
A: No, they conflict. But you can export them first.

**Q: Will this break the live site?**  
A: Yes, until app code is updated (Step 3).

**Q: Do I need to deploy anything?**  
A: Just run this SQL. Your Supabase database will be updated immediately.

---

## 🔐 SECURITY NOTES

- ✅ RLS prevents users from viewing others' data
- ✅ Email stays in auth.users (more secure)
- ✅ Service role key still works for admin operations
- ✅ Anon key can only access own data (verified by RLS)
- ✅ All triggers use SECURITY DEFINER (trusted)

---

**Ready to run migration?** Execute the SQL in Supabase SQL Editor when you're ready!

Backup file: [SUPABASE_MIGRATION_v2.sql](SUPABASE_MIGRATION_v2.sql)
