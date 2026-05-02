(function () {
    const SCHOOL_LEVEL_PATHS = {
        'class 06': '/class06/',
        'class 07': '/class07/',
        'class 08': '/class08/',
        'class 09': '/class09/',
        'class 10': '/class10/',
        'class 11': '/class11/',
        'class 12': '/class12/'
    };

    const ADVANCED_LEVEL_PATH = '/future-content/';

    const SCHOOL_QUOTES = [
        'Curiosity first.',
        'Think from first principles.',
        'Ask better questions.',
        'Observe, then reason.',
        'Wonder leads learning.',
        'Clarity beats memorizing.',
        'Small questions matter.',
        'Understand, don\'t rush.',
        'Science starts with why.',
        'Reason opens worlds.',
        'Learn deeply.',
        'Discover step by step.',
        'Patience grows insight.',
        'Let evidence guide you.',
        'Make every fact count.',
        'Stay curious.',
        'Build understanding.',
        'Truth needs thought.',
        'Notice. Test. Learn.',
        'Questions are doors.'
    ];

    const ADVANCED_QUOTES = [
        'Depth is a discipline.',
        'Go beyond the surface.',
        'Think farther.',
        'Insight takes patience.',
        'Model, test, refine.',
        'Clarity grows slowly.',
        'Mastery loves repetition.',
        'Keep digging deeper.',
        'Big ideas need calm.',
        'Reason before reach.',
        'The next layer matters.',
        'Study with purpose.',
        'Understand the pattern.',
        'Go where questions lead.'
    ];

    const LOCKED_QUOTES = [
        'Begin where you are.',
        'Set the direction.',
        'Build the foundation.',
        'Prepare the next step.',
        'Start with clarity.',
        'Align the path first.',
        'Every journey begins.',
        'Structure creates freedom.',
        'Make the map.',
        'The climb starts here.'
    ];

    const state = {
        profile: null,
        educationLevel: '',
        trackType: 'guest'
    };

    const elements = {};

    function normalizeEducationLevel(value) {
        return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
    }

    function formatLevelLabel(level) {
        const normalized = normalizeEducationLevel(level);

        if (!normalized) {
            return '';
        }

        const schoolMatch = normalized.match(/^class\s*(\d{1,2})$/);
        if (schoolMatch) {
            return 'Class ' + schoolMatch[1].padStart(2, '0');
        }

        if (normalized === 'undergraduate') {
            return 'Undergraduate';
        }

        if (normalized === 'postgraduate') {
            return 'Postgraduate';
        }

        if (normalized === 'phd') {
            return 'PhD';
        }

        return normalized;
    }

    function getTrackType(level) {
        if (SCHOOL_LEVEL_PATHS[level]) {
            return 'school';
        }

        if (level === 'undergraduate' || level === 'postgraduate' || level === 'phd') {
            return 'advanced';
        }

        return 'locked';
    }

    function getLearningPath(level) {
        if (SCHOOL_LEVEL_PATHS[level]) {
            return SCHOOL_LEVEL_PATHS[level];
        }

        if (level === 'undergraduate' || level === 'postgraduate' || level === 'phd') {
            return ADVANCED_LEVEL_PATH + '?track=' + encodeURIComponent(level);
        }

        return '';
    }

    function pickRandomQuote(quotes) {
        if (!Array.isArray(quotes) || !quotes.length) {
            return 'Keep learning.';
        }

        if (window.crypto && typeof window.crypto.getRandomValues === 'function' && quotes.length > 1) {
            const randomValues = new Uint32Array(1);
            window.crypto.getRandomValues(randomValues);
            return quotes[randomValues[0] % quotes.length];
        }

        return quotes[Math.floor(Math.random() * quotes.length)] || quotes[0];
    }

    function getQuoteForTrack(trackType) {
        if (trackType === 'school') {
            return pickRandomQuote(SCHOOL_QUOTES);
        }

        if (trackType === 'advanced') {
            return pickRandomQuote(ADVANCED_QUOTES);
        }

        return pickRandomQuote(LOCKED_QUOTES);
    }

    function buildCardCopy(level, trackType) {
        if (trackType === 'school') {
            const label = formatLevelLabel(level);
            return {
                badge: label,
                title: getQuoteForTrack(trackType),
                copy: 'Continue from your selected class, open your dashboard, or ask RaushanSYNC AI for guidance.'
            };
        }

        if (trackType === 'advanced') {
            const label = formatLevelLabel(level);
            return {
                badge: label,
                title: getQuoteForTrack(trackType),
                copy: 'Your preferred content opens a roadmap preview while the dashboard and AI support stay available.'
            };
        }

        return {
            badge: 'Profile incomplete',
            title: getQuoteForTrack(trackType),
            copy: 'Choose your class or study track in the dashboard first. That unlocks Start Learning, Dashboard access, and AI support.'
        };
    }

    function openProfileHelpModal() {
        if (!elements.profileModal) {
            return;
        }

        elements.profileModal.hidden = false;
        elements.profileModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('ai-chat-open');

        if (elements.profileDismiss && window.matchMedia('(pointer: fine)').matches) {
            elements.profileDismiss.focus();
        }
    }

    function closeProfileHelpModal() {
        if (!elements.profileModal) {
            return;
        }

        elements.profileModal.hidden = true;
        elements.profileModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ai-chat-open');
    }

    function blockLearningAction() {
        openProfileHelpModal();
    }

    function openDashboard() {
        if (state.trackType === 'locked') {
            blockLearningAction();
            return;
        }

        window.location.assign('/dashboard');
    }

    function startLearning() {
        if (state.trackType === 'locked') {
            blockLearningAction();
            return;
        }

        const path = getLearningPath(state.educationLevel);
        if (!path) {
            blockLearningAction();
            return;
        }

        window.location.assign(path);
    }

    function askRaushanSyncAI() {
        if (typeof window.initAIChat !== 'function') {
            window.alert('AI assistant is not available right now. Please refresh and try again.');
            return;
        }

        window.initAIChat(
            {
                practiceTitle: 'Student Support',
                questionText: 'General learning support',
                userAnswer: 'Home page student support',
                correctAnswer: 'Not provided',
                explanation: 'General academic guidance, study planning, exam preparation, and motivation.',
                pageUrl: window.location.href
            },
            {
                mode: 'student-support',
                title: 'RaushanSYNC AI Assistant',
                subtitle: 'Ask for help with your selected class, study routine, or general student support.',
                assistantGreeting: 'Hi! I can help with your class, study planning, exam preparation, career guidance, and general student questions.',
                inputLabel: 'Ask RaushanSYNC AI',
                inputPlaceholder: 'Ask about your class, notes, practice, or study plan...',
                showContext: false
            }
        );
    }

    async function loadProfileState() {
        if (typeof window.getCurrentSession !== 'function') {
            return null;
        }

        try {
            const session = await window.getCurrentSession();
            if (!session?.user) {
                return null;
            }

            if (typeof window.getUserProfile === 'function') {
                const profile = await window.getUserProfile({ sync: false });
                if (profile) {
                    return profile;
                }
            }

            return {
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || '',
                education_level: session.user.user_metadata?.education_level || '',
                phone: session.user.user_metadata?.phone || null
            };
        } catch (error) {
            if (window.console && typeof window.console.warn === 'function') {
                window.console.warn('Unable to load homepage profile state:', error);
            }
            return null;
        }
    }

    function renderGuestState() {
        if (elements.guestButtons) {
            elements.guestButtons.style.display = 'flex';
        }

        if (elements.userCard) {
            elements.userCard.style.display = 'none';
        }
    }

    function renderLoggedInState(profile) {
        const educationLevel = normalizeEducationLevel(profile?.education_level || '');
        const trackType = getTrackType(educationLevel);
        const cardCopy = buildCardCopy(educationLevel, trackType);

        state.profile = profile;
        state.educationLevel = educationLevel;
        state.trackType = trackType;

        if (elements.guestButtons) {
            elements.guestButtons.style.display = 'none';
        }

        if (elements.userCard) {
            elements.userCard.style.display = 'flex';
            elements.userCard.classList.toggle('home-learning-card--locked', trackType === 'locked');
        }

        if (elements.badge) {
            elements.badge.textContent = cardCopy.badge;
        }

        if (elements.title) {
            elements.title.textContent = cardCopy.title;
        }

        if (elements.copy) {
            elements.copy.textContent = cardCopy.copy;
        }
    }

    async function renderHomepageState() {
        const profile = await loadProfileState();

        if (!profile) {
            state.profile = null;
            state.educationLevel = '';
            state.trackType = 'guest';
            renderGuestState();
            return;
        }

        renderLoggedInState(profile);
    }

    function bindEvents() {
        if (elements.startButton) {
            elements.startButton.addEventListener('click', startLearning);
        }

        if (elements.dashboardButton) {
            elements.dashboardButton.addEventListener('click', openDashboard);
        }

        if (elements.aiButton) {
            elements.aiButton.addEventListener('click', askRaushanSyncAI);
        }

        if (elements.profileClose) {
            elements.profileClose.addEventListener('click', closeProfileHelpModal);
        }

        if (elements.profileDismiss) {
            elements.profileDismiss.addEventListener('click', closeProfileHelpModal);
        }

        if (elements.profileModal) {
            elements.profileModal.addEventListener('click', (event) => {
                const target = event.target;
                if (target instanceof HTMLElement && target.hasAttribute('data-profile-help-close')) {
                    closeProfileHelpModal();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && elements.profileModal && !elements.profileModal.hidden) {
                closeProfileHelpModal();
            }
        });

        window.addEventListener('rs:auth-state-change', () => {
            renderHomepageState();
        });
    }

    function cacheElements() {
        elements.guestButtons = document.getElementById('auth-buttons-guest');
        elements.userCard = document.getElementById('auth-buttons-user');
        elements.badge = document.getElementById('home-learning-badge');
        elements.title = document.getElementById('home-learning-title');
        elements.copy = document.getElementById('home-learning-copy');
        elements.startButton = document.getElementById('home-start-learning');
        elements.dashboardButton = document.getElementById('home-dashboard-link');
        elements.aiButton = document.getElementById('home-ask-ai');
        elements.profileModal = document.getElementById('profile-help-modal');
        elements.profileClose = document.getElementById('profile-help-close');
        elements.profileDismiss = document.getElementById('profile-help-dismiss');
    }

    async function initializeHomepageHero() {
        cacheElements();
        bindEvents();

        if (typeof window.whenAuthReady === 'function') {
            await window.whenAuthReady();
        }

        await renderHomepageState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeHomepageHero);
    } else {
        initializeHomepageHero();
    }
})();