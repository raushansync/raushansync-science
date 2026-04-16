# STEP 3 → STEP 4 TRANSITION

**Current Status**: STEP 3 COMPLETE ✅  
**Next Phase**: STEP 4 - Progress Tick System + Practice Score Persistence

---

## What Was Done in Step 3

✅ Database schema fully integrated (profiles, progress, practice_scores)  
✅ Old references removed (student_profiles, quiz_attempts, learned_hours)  
✅ Profile system updated (education_level replaces grade_class)  
✅ Dashboard stats redesigned (articles completed tracking)  
✅ Progress tracking refactored (practice_scores table)  
✅ Helper functions prepared (getCurrentSite, getCurrentPath, etc.)  
✅ Quiz→Practice terminology standardized in code  
✅ Auth flows preserved and working

---

## What Needs to Happen in Step 4

### Phase 4A: Page-Level Progress Tracking
Tasks:
1. Implement page view detection system
2. Call `window.ProgressTracker.trackPageView()` or similar when user visits a page
3. Log to `progress` table:
   - user_id
   - site
   - item_path (current page path)
   - item_type ('article' or 'practice')
   - completed (boolean)

### Phase 4B: Practice Completion Tracking
Tasks:
1. When user completes a practice (submits answers), call progress tracker
2. Set progress.completed = true for that practice
3. Save practice_scores with the score (0-100)
4. Update dashboard stats in real-time

### Phase 4C: File System Restructuring
Tasks:
1. Rename 8 quiz files to practice files:
   - quiz1.html → practice1.html (in /core-concept-1/)
   - quiz2.html → practice2.html (in /core-concept-2/)
   - ... up to quiz8.html → practice8.html
   
2. Update all links pointing to these files:
   - service-worker.js CORE_ASSETS
   - Any HTML nav links
   - Navigation components
   - Other scripts referencing quiz paths

3. Update any hardcoded quiz references in HTML/JS to practice

---

## Files That Will Need Changes in Step 4

| File | Change | Reason |
|------|--------|--------|
| progress-tracker.js | Add trackPageView(), trackCompletion() methods | Page-level tracking |
| service-worker.js | Update quiz*.html → practice*.html paths | File renaming |
| quiz*.html (8 files) | Rename files and update internal calls | Terminology standardization |
| dashboard.html | Add real-time stats updates | Show live progress |
| script.js | Add page-level tracking calls | Auto-track page views |
| components/nav.html | Update quiz links if present | Maintain navigation |
| ARCHITECTURE.md | Update documentation | Reflect new system |

---

## Code Patterns for Step 4

### Pattern 1: Track Page View
```javascript
// When page loads
if (window.ProgressTracker && window.isUserLoggedIn()) {
    const site = window.getCurrentSite();
    const path = window.getCurrentPath();
    
    ProgressTracker.trackPageView({
        site: site,
        item_path: path,
        item_type: 'article' // or 'practice'
    });
}
```

### Pattern 2: Track Practice Completion
```javascript
// When user submits practice
if (window.ProgressTracker && window.isUserLoggedIn()) {
    const score = calculateScore(); // 0-100
    
    ProgressTracker.savePracticeScore({
        practice_url: window.location.href,
        score: score,
        completed: true
    });
}
```

### Pattern 3: Update Progress Display
```javascript
// After saving, update stats
async function updateProgressDisplay() {
    if (window.ProgressTracker) {
        const stats = await window.ProgressTracker.getOverallStats();
        document.getElementById('articlesCompleted').textContent = stats.total_practices;
    }
}
```

---

## Database Queries Already Written

### Get User's Progress (Step 4 will use these)
```sql
-- All completed articles for this user
SELECT * FROM progress 
WHERE user_id = 'uuid' 
AND item_type = 'article' 
AND completed = true;

-- All completed practices
SELECT * FROM progress 
WHERE user_id = 'uuid' 
AND item_type = 'practice' 
AND completed = true;

-- Practice scores for a specific practice
SELECT * FROM practice_scores 
WHERE user_id = 'uuid' 
AND practice_path = '/notes/class07/...';
```

---

## Testing Checklist for Step 4

- [ ] User visits a page → progress tracked in DB
- [ ] User completes a practice → score saved
- [ ] Dashboard stats update in real-time
- [ ] Progress carries across sessions
- [ ] File renames don't break links
- [ ] Service worker caches new file names
- [ ] Statistics display correctly
- [ ] No duplicate progress entries (upsert working)

---

## Performance Considerations for Step 4

⚠️ Watch out for:
- Too many database writes (debounce/throttle page views)
- Slow dashboard stats queries (use indexes)
- Memory leaks in event listeners
- Cache conflicts after file renames

---

## Success Criteria for Step 4

✅ All page views logged to progress table  
✅ All practice completions logged with scores  
✅ Dashboard shows live progress  
✅ File renames complete without breaking links  
✅ No console errors  
✅ All tests pass  
✅ Database has 1000+ progress entries (from testing)  
✅ Users can see their learning journey

---

## Timeline Estimate for Step 4

| Task | Time | Dependencies |
|------|------|--------------|
| Add page tracking | 2-3 hours | None |
| Add completion tracking | 1-2 hours | Page tracking |
| Test and verify | 1-2 hours | Both implementations |
| File renaming | 1 hour | All testing complete |
| Final verification | 30 min | File renaming |
| Deployment prep | 1 hour | All complete |

**Total: ~7-9 hours**

---

## Commands to Run After Step 4

```bash
# Verify all pages track progress
SELECT COUNT(*) FROM progress WHERE created_at > now() - interval '1 hour';

# Check for any orphaned references
SELECT * FROM practice_scores WHERE updated_at > now() - interval '1 day';

# Verify cache busting worked
# Check Service Worker version in Chrome DevTools > Application > Cache Storage
```

---

## Questions to Clarify for Step 4

1. Should page views be tracked on every load or only on first visit?
2. Should there be a loading indicator while saving progress?
3. Should users be notified when stats update?
4. Should the system track time spent per page?
5. Should there be a "resume" feature for incomplete practices?

---

**Last Updated**: April 16, 2026  
**Status**: Preparation document for next phase  
**Next Review**: Before starting Step 4
