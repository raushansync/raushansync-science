/**
 * progress-tracker.js
 * Tracks student quiz attempts and saves them to Supabase.
 */

window.ProgressTracker = (() => {
    const startTimes = new Map();

    function sanitizeText(value, maxLength) {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
        if (!normalized) {
            return null;
        }

        return normalized.slice(0, maxLength);
    }

    function clampInteger(value, min, max, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed)) {
            return fallback;
        }

        return Math.min(max, Math.max(min, parsed));
    }

    function normalizeQuizUrl(rawUrl) {
        const fallbackPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        try {
            const url = new URL(typeof rawUrl === 'string' ? rawUrl : fallbackPath, window.location.origin);
            if (url.origin !== window.location.origin) {
                return fallbackPath;
            }

            return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
        } catch (error) {
            return fallbackPath;
        }
    }

    function normalizeQuestionNumber(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return null;
        }

        return parsed;
    }

    return {
        startQuestion(questionId) {
            const normalizedId = sanitizeText(questionId, 120);
            if (!normalizedId) {
                return;
            }

            startTimes.set(normalizedId, Date.now());
        },

        getElapsedTime(questionId) {
            const normalizedId = sanitizeText(questionId, 120);
            if (!normalizedId) {
                return 0;
            }

            const startTime = startTimes.get(normalizedId);
            if (!startTime) {
                return 0;
            }

            return Math.max(0, Math.round((Date.now() - startTime) / 1000));
        },

        async saveAttempt(attemptData) {
            try {
                if (!window.supabaseClient) {
                    console.error('Cannot save quiz attempt: Supabase client not initialized.');
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    console.warn('Cannot save attempt: user is not authenticated.');
                    return false;
                }

                if (typeof attemptData?.is_correct !== 'boolean') {
                    console.error('Invalid attempt data:', attemptData);
                    return false;
                }

                const sanitizedData = {
                    user_id: session.user.id,
                    quiz_url: normalizeQuizUrl(attemptData.quiz_url),
                    question_number: normalizeQuestionNumber(attemptData.question_number),
                    question_text: sanitizeText(attemptData.question_text, 500),
                    user_answer: sanitizeText(attemptData.user_answer, 1000),
                    correct_answer: sanitizeText(attemptData.correct_answer, 1000),
                    is_correct: attemptData.is_correct,
                    time_spent_seconds: clampInteger(attemptData.time_spent_seconds, 0, 7200)
                };

                const { error } = await window.supabaseClient
                    .from('quiz_attempts')
                    .insert(sanitizedData);

                if (error) {
                    console.error('Failed to save quiz attempt:', error);
                    return false;
                }

                window.logEvent('Quiz attempt saved');
                return true;
            } catch (error) {
                console.error('Unexpected error saving attempt:', error);
                return false;
            }
        },

        async getAttemptHistory(filters = {}) {
            try {
                if (!window.supabaseClient) {
                    return [];
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return [];
                }

                let query = window.supabaseClient
                    .from('quiz_attempts')
                    .select('id, quiz_url, question_number, is_correct, time_spent_seconds, created_at')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (filters.quiz_url) {
                    query = query.eq('quiz_url', normalizeQuizUrl(filters.quiz_url));
                }
                if (filters.limit) {
                    query = query.limit(clampInteger(filters.limit, 1, 100, 10));
                }

                const { data, error } = await query;
                if (error) {
                    console.error('Failed to fetch attempts:', error);
                    return [];
                }

                return data || [];
            } catch (error) {
                console.error('Unexpected error fetching attempts:', error);
                return [];
            }
        },

        async getQuizStats(quizUrl) {
            try {
                const attempts = await this.getAttemptHistory({ quiz_url: quizUrl });
                const correctAnswers = attempts.filter((attempt) => attempt.is_correct).length;
                const totalAttempts = attempts.length;
                const averageTime = totalAttempts
                    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.time_spent_seconds || 0), 0) / totalAttempts)
                    : 0;

                return {
                    total_attempts: totalAttempts,
                    correct_answers: correctAnswers,
                    incorrect_answers: totalAttempts - correctAnswers,
                    accuracy: totalAttempts ? `${((correctAnswers / totalAttempts) * 100).toFixed(1)}%` : '0%',
                    average_time: `${averageTime}s`
                };
            } catch (error) {
                console.error('Failed to calculate quiz stats:', error);
                return null;
            }
        },

        async getOverallStats() {
            try {
                if (!window.supabaseClient) {
                    return null;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return null;
                }

                const { data: attempts, error } = await window.supabaseClient
                    .from('quiz_attempts')
                    .select('quiz_url, is_correct, time_spent_seconds')
                    .eq('user_id', session.user.id);

                if (error) {
                    console.error('Failed to fetch attempts:', error);
                    return null;
                }

                const safeAttempts = attempts || [];
                const totalAttempts = safeAttempts.length;
                const totalCorrect = safeAttempts.filter((attempt) => attempt.is_correct).length;
                const totalTimeMinutes = totalAttempts
                    ? Math.round(safeAttempts.reduce((sum, attempt) => sum + (attempt.time_spent_seconds || 0), 0) / 60)
                    : 0;

                return {
                    total_attempts: totalAttempts,
                    total_correct: totalCorrect,
                    total_incorrect: totalAttempts - totalCorrect,
                    overall_accuracy: totalAttempts ? `${((totalCorrect / totalAttempts) * 100).toFixed(1)}%` : '0%',
                    unique_quizzes: new Set(safeAttempts.map((attempt) => attempt.quiz_url)).size,
                    total_time_spent: `${totalTimeMinutes} min`
                };
            } catch (error) {
                console.error('Failed to calculate overall stats:', error);
                return null;
            }
        },

        async deleteAllAttempts() {
            if (!window.confirm('Are you sure? This will delete all of your quiz attempts.')) {
                return false;
            }

            try {
                if (!window.supabaseClient) {
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return false;
                }

                const { error } = await window.supabaseClient
                    .from('quiz_attempts')
                    .delete()
                    .eq('user_id', session.user.id);

                if (error) {
                    console.error('Failed to delete attempts:', error);
                    return false;
                }

                window.logEvent('All quiz attempts deleted');
                return true;
            } catch (error) {
                console.error('Unexpected error deleting attempts:', error);
                return false;
            }
        }
    };
})();

window.logEvent('Progress tracker loaded');
