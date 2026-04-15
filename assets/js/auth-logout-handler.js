/**
 * auth-logout-handler.js
 * Simple utility to handle logout functionality on any page.
 * 
 * Usage in your page:
 *   <script src="/assets/js/auth-logout-handler.js"></script>
 * 
 *   Then add data-action="logout" to any button:
 *   <button data-action="logout">Sign Out</button>
 * 
 * Or call programmatically:
 *   window.handleLogout();
 */

(function logoutHandler() {
    // Handler for logout action
    window.handleLogout = async function (options = {}) {
        const { quiet = false } = options;

        if (!quiet) {
            const confirmed = window.confirm('Are you sure you want to sign out?');
            if (!confirmed) {
                return false;
            }
        }

        try {
            await window.signOut();
            // signOut() automatically redirects to login, so we won't reach here
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            if (!quiet) {
                alert('Logout failed. Please try again.');
            }
            return false;
        }
    };

    // Attach event listeners to all elements with data-action="logout"
    document.addEventListener('click', async (event) => {
        if (event.target.getAttribute('data-action') === 'logout') {
            event.preventDefault();
            await window.handleLogout();
        }
    });

    // Support for form submission
    document.addEventListener('submit', async (event) => {
        if (event.target.getAttribute('data-action') === 'logout') {
            event.preventDefault();
            await window.handleLogout();
        }
    });
})();
