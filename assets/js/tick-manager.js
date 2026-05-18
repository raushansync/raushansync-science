/**
 * tick-manager.js
 * STEP 4: Progress Tick System
 * 
 * Manages the UI and interactions for progress completion ticks.
 * - Green tick = completed
 * - Blue tick = incomplete
 * - Toggleable by user click
 * - Persistent across sessions
 * - Syncs with Supabase progress table
 */

window.TickManager = (() => {
    const TICK_STATES = {
        COMPLETED: 'completed',
        INCOMPLETE: 'incomplete',
        LOADING: 'loading',
        ERROR: 'error'
    };

    const TICK_SYMBOLS = {
        completed: '✓',
        incomplete: '○'
    };

    // DOM element cache
    const tickElements = new Map();

    /**
     * Create a tick element
     * @param {string} id - Unique identifier for this tick
     * @param {string} state - Initial state (completed/incomplete)
     * @returns {HTMLElement} Tick element
     */
    function createTickElement(id, state = TICK_STATES.INCOMPLETE) {
        const tick = document.createElement('button');
        tick.className = `progress-tick ${state}`;
        tick.id = `tick-${id}`;
        tick.setAttribute('aria-label', state === TICK_STATES.COMPLETED ? 'Mark as incomplete' : 'Mark as complete');
        tick.setAttribute('type', 'button');
        tick.textContent = TICK_SYMBOLS[state] || '○';
        tick.dataset.tickId = id;
        
        return tick;
    }

    /**
     * Update tick visual state
     * @param {HTMLElement} tickElement - Tick DOM element
     * @param {string} newState - New state
     */
    function updateTickState(tickElement, newState) {
        // Remove all state classes
        Object.values(TICK_STATES).forEach(state => {
            tickElement.classList.remove(state);
        });

        // Add new state class
        tickElement.classList.add(newState);

        // Update symbol
        tickElement.textContent = TICK_SYMBOLS[newState] || '○';

        // Update aria label
        if (newState === TICK_STATES.COMPLETED) {
            tickElement.setAttribute('aria-label', 'Mark as incomplete');
        } else if (newState === TICK_STATES.INCOMPLETE) {
            tickElement.setAttribute('aria-label', 'Mark as complete');
        }
    }

    /**
     * Handle tick click event
     * @param {Event} event - Click event
     */
    async function handleTickClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const tickElement = event.currentTarget;
        const tickId = tickElement.dataset.tickId;

        if (!tickId) {
            window.logEvent('Tick error: ID not found on element');
            return;
        }

        // Check if user is logged in
        if (!window.isUserLoggedIn || !window.isUserLoggedIn()) {
            // Redirect directly to login with return path using the site's redirect helper
            if (window.redirectToLogin) {
                window.redirectToLogin(window.location.pathname + window.location.search + window.location.hash);
            } else {
                window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
            }
            return;
        }

        // Show loading state
        updateTickState(tickElement, TICK_STATES.LOADING);

        try {
            // Get progress tracker
            if (!window.ProgressTracker) {
                throw new Error('ProgressTracker not initialized');
            }

            // Get current values from data attributes
            const site = tickElement.dataset.site || (window.getCurrentSite ? window.getCurrentSite() : window.location.hostname);
            const itemPath = tickElement.dataset.itemPath || (window.getCurrentPath ? window.getCurrentPath() : window.location.pathname);
            const itemType = tickElement.dataset.itemType || window.ProgressTracker.detectItemType(itemPath);

            // Toggle progress
            const success = await window.ProgressTracker.toggleProgress(site, itemPath, itemType);

            if (!success) {
                throw new Error('Failed to toggle progress');
            }

            // Get updated progress state
            const progress = await window.ProgressTracker.getProgress(site, itemPath);
            const newState = progress?.completed ? TICK_STATES.COMPLETED : TICK_STATES.INCOMPLETE;

            // Update UI
            updateTickState(tickElement, newState);

            // Trigger dashboard update if function exists
            if (window.updateProgressDisplay && typeof window.updateProgressDisplay === 'function') {
                window.updateProgressDisplay();
            }

            // Log success
            window.logEvent('Progress tick toggled', { site, itemPath, itemType, completed: progress?.completed });

        } catch (error) {
            console.error('Error toggling tick:', error);
            updateTickState(tickElement, TICK_STATES.ERROR);
            
            // Revert to previous state after delay
            setTimeout(() => {
                const currentState = tickElement.classList.contains(TICK_STATES.COMPLETED) 
                    ? TICK_STATES.INCOMPLETE 
                    : TICK_STATES.COMPLETED;
                updateTickState(tickElement, currentState);
            }, 2000);

            window.logEvent('Error toggling tick', { error: error.message });
        }
    }

    return {
        /**
         * Initialize tick on a page
         * @param {string} containerId - ID of element where tick should be added
         * @param {object} options - Configuration
         *   - site: site identifier
         *   - itemPath: path to item
         *   - itemType: 'article' or 'practice'
         *   - position: 'header' or 'inline' (default)
         *   - className: additional CSS classes
         */
        async initTick(containerId, options = {}) {
            try {
                const container = document.getElementById(containerId);
                if (!container) {
                    window.logEvent('Tick error: Container not found', { containerId });
                    return null;
                }

                // Set defaults
                const site = options.site || (window.getCurrentSite ? window.getCurrentSite() : window.location.hostname);
                const itemPath = options.itemPath || (window.getCurrentPath ? window.getCurrentPath() : window.location.pathname);
                const itemType = options.itemType || (window.ProgressTracker ? window.ProgressTracker.detectItemType(itemPath) : 'article');
                const position = options.position || 'inline';
                const customClass = options.className || '';

                // Generate unique ID for this tick
                const tickId = `${site}-${itemPath}`.replace(/[^\w-]/g, '_');

                // Check if already initialized
                if (tickElements.has(tickId)) {
                    return tickElements.get(tickId);
                }

                // Create tick element
                let initialState = TICK_STATES.INCOMPLETE;
                let tick = createTickElement(tickId, initialState);

                // Set data attributes
                tick.dataset.site = site;
                tick.dataset.itemPath = itemPath;
                tick.dataset.itemType = itemType;

                // Add custom classes
                if (customClass) {
                    tick.classList.add(customClass);
                }

                // Add position-specific classes
                if (position === 'header') {
                    tick.classList.add('page-header-tick');
                } else if (position === 'section') {
                    tick.classList.add('section-tick');
                } else if (position === 'item') {
                    tick.classList.add('item-tick');
                }

                // Add click handler
                tick.addEventListener('click', handleTickClick);

                // Cache the element immediately to avoid duplicate creation
                // when multiple init calls run concurrently (race condition).
                if (!tickElements.has(tickId)) {
                    tickElements.set(tickId, tick);
                }

                // Load current progress state (async)
                if (window.isUserLoggedIn && window.isUserLoggedIn()) {
                    if (window.ProgressTracker) {
                        const progress = await window.ProgressTracker.getProgress(site, itemPath);
                        if (progress?.completed) {
                            initialState = TICK_STATES.COMPLETED;
                            updateTickState(tick, initialState);
                        }
                    }
                }

                // Append to container if not already present
                if (!container.contains(tick)) {
                    container.appendChild(tick);
                }

                return tick;

            } catch (error) {
                console.error('Error initializing tick:', error);
                window.logEvent('Tick initialization error', { error: error.message });
                return null;
            }
        },

        /**
         * Initialize ticks for all elements with tick-container data attribute
         * Should be called on page load
         */
        async initializePageTicks() {
            try {
                const tickContainers = document.querySelectorAll('[data-tick-container]');
                
                for (const container of tickContainers) {
                    // Skip containers we've already initialized (idempotent)
                    if (container.dataset.tickInitialized === 'true') {
                        continue;
                    }

                    // Safety: if container already contains a progress-tick element,
                    // mark it initialized and skip to avoid duplicates (possible
                    // when initializePageTicks is called multiple times).
                    if (container.querySelector && container.querySelector('.progress-tick')) {
                        container.dataset.tickInitialized = 'true';
                        continue;
                    }

                    const options = {
                        position: container.dataset.tickPosition || 'inline',
                        className: container.dataset.tickClass || ''
                    };

                    // Get custom site/path if specified
                    if (container.dataset.tickSite) {
                        options.site = container.dataset.tickSite;
                    }
                    if (container.dataset.tickPath) {
                        options.itemPath = container.dataset.tickPath;
                    }
                    if (container.dataset.tickType) {
                        options.itemType = container.dataset.tickType;
                    }

                    await this.initTick(container.id, options);
                    // Mark container as initialized so future calls are no-ops
                    container.dataset.tickInitialized = 'true';
                }

                // NEW: Dynamically process article/practice "cards" across the hub pages
                const cards = document.querySelectorAll('article.card');
                let cardCounter = 0;

                for (const card of cards) {
                    if (card.dataset.tickInitialized === 'true') continue;

                    const btn = card.querySelector('.btn-row a.btn');
                    const statusEl = card.querySelector('.status');
                    
                    if (!btn || !statusEl) continue;
                    
                    const href = btn.getAttribute('href');
                    if (!href) continue;

                    // Resolve the absolute path of the destination linked in the card
                    const a = document.createElement('a');
                    a.href = href; 
                    const itemPath = a.pathname;

                    // Determine if it represents a practice or article based on URL
                    const itemType = window.ProgressTracker 
                        ? window.ProgressTracker.detectItemType(itemPath) 
                        : (itemPath.includes('/practice/') ? 'practice' : 'article');

                    // Look for existing tick container if re-running
                    let container = card.querySelector('.card-tick-container');
                    
                    if (!container) {
                        container = document.createElement('div');
                        container.className = 'card-tick-container';
                        
                        // Generate a pseudo-unique ID required by initTick logic
                        container.id = 'card-tick-' + Date.now().toString(36) + '-' + (cardCounter++);
                        
                        container.dataset.tickSite = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
                        container.dataset.tickPath = itemPath;
                        container.dataset.tickType = itemType;
                        container.dataset.tickPosition = 'item';
                        // Provide the data-tick-container attribute so CSS/Logic treats it normally
                        container.setAttribute('data-tick-container', 'true');

                        // Create a unified Flex layout for status + tick to live on same row
                        const flexWrap = document.createElement('div');
                        flexWrap.className = 'card-header-flex';
                        flexWrap.style.display = 'flex';
                        flexWrap.style.justifyContent = 'space-between';
                        flexWrap.style.alignItems = 'center';
                        flexWrap.style.marginBottom = '0.4rem';
                        
                        card.insertBefore(flexWrap, statusEl);
                        flexWrap.appendChild(statusEl);
                        
                        // Append tick directly into flexWrap next to status
                        flexWrap.appendChild(container);
                        
                        // Nullify previous margin on status string to perfect alignment
                        statusEl.style.marginBottom = '0';
                    }

                    // Spin up the tick component
                    await this.initTick(container.id, {
                        site: container.dataset.tickSite,
                        itemPath: container.dataset.tickPath,
                        itemType: container.dataset.tickType,
                        position: 'item' // uses item-tick class which has small margins mapping
                    });

                    card.dataset.tickInitialized = 'true';
                }

                window.logEvent('Page ticks initialized');

            } catch (error) {
                console.error('Error initializing page ticks:', error);
                window.logEvent('Page ticks initialization error', { error: error.message });
            }
        },

        /**
         * Get tick element by ID
         */
        getTick(tickId) {
            return tickElements.get(tickId) || null;
        },

        /**
         * Update multiple ticks (useful for dashboard updates)
         */
        async updateAllTicks() {
            try {
                for (const [tickId, tickElement] of tickElements) {
                    if (!tickElement.parentElement) {
                        // Element was removed from DOM
                        tickElements.delete(tickId);
                        continue;
                    }

                    // Skip if currently loading or in error state
                    if (tickElement.classList.contains(TICK_STATES.LOADING) ||
                        tickElement.classList.contains(TICK_STATES.ERROR)) {
                        continue;
                    }

                    // Get fresh progress
                    const site = tickElement.dataset.site;
                    const itemPath = tickElement.dataset.itemPath;

                    if (window.ProgressTracker) {
                        const progress = await window.ProgressTracker.getProgress(site, itemPath);
                        const newState = progress?.completed ? TICK_STATES.COMPLETED : TICK_STATES.INCOMPLETE;
                        updateTickState(tickElement, newState);
                    }
                }
            } catch (error) {
                console.error('Error updating all ticks:', error);
                window.logEvent('Ticks update error', { error: error.message });
            }
        },

        /**
         * Clear all cached ticks (useful for logout)
         */
        clearAll() {
            tickElements.clear();
        },

        // Expose states for external use
        STATES: TICK_STATES,
        SYMBOLS: TICK_SYMBOLS
    };
})();

// Auto-initialize ticks when page loads (if ProgressTracker is ready)
window.addEventListener('load', async () => {
    if (window.TickManager && window.isUserLoggedIn && window.isUserLoggedIn()) {
        await window.TickManager.initializePageTicks();
    }
});

// Cleanup on logout - listen to auth state changes
if (window.addEventListener) {
    // Primary: listen for auth state change events from auth-config.js
    window.addEventListener('rs:auth-state-change', (event) => {
        const session = event.detail?.session;
        if (!session || !session.user) {
            // User logged out - clear all tick UI and listeners
            if (window.TickManager && typeof window.TickManager.clearAll === 'function') {
                window.TickManager.clearAll();
            }
        }
    });
    
    // Fallback: also handle custom user-logout event for backward compatibility
    document.addEventListener('user-logout', () => {
        if (window.TickManager && typeof window.TickManager.clearAll === 'function') {
            window.TickManager.clearAll();
        }
    });
}

window.logEvent('Tick manager loaded');
