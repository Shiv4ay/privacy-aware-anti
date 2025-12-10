/**
 * Forcefully clears all session data and redirects to login.
 * Used to ensure a clean slate when critical account changes occur
 * or when purging old/invalid tokens.
 */
export const resetSession = () => {
    console.log('[Session] Force clearing all local/session storage...');

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear cookies (simple attempt for root domain)
    document.cookie.split(";").forEach((c) => {
        document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Force hard redirect to login
    window.location.href = '/login';
};
