/**
 * Issue #40: API Response Hardening Utility
 * Centralized fault-tolerant wrapper for clinical telemetry sync.
 */

export const safeFetch = async (url, options = {}, defaultValue = []) => {
    try {
        const response = await fetch(url, options);
        
        // Protocol Guard: Handle maintenance or missing node states explicitly
        if (!response.ok) {
            console.warn(`[Registry] Node access failure at ${url}: ${response.status} ${response.statusText}`);
            try {
                const errorData = await response.json();
                return { ...errorData, error: true, status: response.status };
            } catch (e) {
                return { error: true, message: `Server error: ${response.status}`, status: response.status };
            }
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`[Registry] Non-JSON response from ${url} (interpreted as HTML/Text)`);
            return defaultValue;
        }

        const data = await response.json();
        
        // Payload Guard: Ensure non-null data returns
        if (data === null || data === undefined) {
            return defaultValue;
        }

        return data;
    } catch (error) {
        console.error(`[Registry] Network telemetry drop: ${url}`, error);
        return defaultValue;
    }
};
