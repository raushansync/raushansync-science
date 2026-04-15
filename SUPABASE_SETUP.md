# Supabase Setup Guide for RaushanSYNC Science

## Step 1: Create a Supabase Project

1. Go to https://supabase.com
2. Create a new project.
3. Save the database password somewhere secure.
4. Choose the region closest to your users.

## Step 2: Copy the Project Credentials

In **Project Settings -> API**, copy:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

Only the anon key belongs in the frontend. Never expose the service key in browser code.

## Step 3: Configure Auth URLs

In **Authentication -> URL Configuration**:

- Set **Site URL** to your production origin, for example `https://science.raushansync.com`
- Add `https://science.raushansync.com/login.html` to **Redirect URLs**
- Add your local login page, for example `http://localhost:8000/login.html`, to **Redirect URLs** for development

This is required for email confirmation links to return users to the login page safely.

## Step 4: Run the SQL Setup

Open **SQL Editor**, create a new query, and run this script:

```sql
CREATE TABLE IF NOT EXISTS public.student_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    grade_class INTEGER CHECK (grade_class >= 6 AND grade_class <= 12),
    school_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    total_quizzes_attempted INTEGER DEFAULT 0,
    total_correct_answers INTEGER DEFAULT 0,
    CONSTRAINT email_matches_user CHECK (email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    quiz_url TEXT NOT NULL,
    question_number INTEGER,
    question_text TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.student_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.student_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.student_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own attempts" ON public.quiz_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attempts" ON public.quiz_attempts
    FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.student_profiles (id, email, full_name, grade_class, school_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'grade_class', '')::INTEGER,
        NULLIF(new.raw_user_meta_data->>'school_name', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(student_profiles.full_name, ''), EXCLUDED.full_name),
        grade_class = COALESCE(student_profiles.grade_class, EXCLUDED.grade_class),
        school_name = COALESCE(student_profiles.school_name, EXCLUDED.school_name);

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON public.quiz_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_url ON public.quiz_attempts(quiz_url);

GRANT SELECT, INSERT, UPDATE ON public.student_profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.quiz_attempts TO authenticated;
```

## Step 5: Update the Frontend Configuration

Update `assets/js/auth-config.js` with your real project URL and anon key, or inject them through `window.__SUPABASE_CONFIG__` before loading that script.

## Step 6: Test the Connection

Run this in the browser console:

```javascript
const client = supabase.createClient(
  'https://your-project.supabase.co',
  'your-anon-key-here'
);

const { data, error } = await client.auth.getSession();
console.log({ data, error });
```

## Notes

- New users are provisioned from `raw_user_meta_data`, so the frontend should not insert into `student_profiles` during signup.
- Email confirmation returns users to `login.html`, where the app resumes the normal sign-in flow.
- If you later add privileged backend operations, keep them behind the service key on the server only.
