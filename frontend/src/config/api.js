// Central API base URL.
// Priority: Localhost/127.0.0.1 override (Highest priority, respects VITE_LOCAL_PORT fallback to 7860)
//           → VITE_API_URL env var (REQUIRED in production)
//
// In production VITE_API_URL must be set at build time (see .env / deployment config).
// We deliberately do NOT bake in a hardcoded deployment URL — that couples the
// build to a single host and silently masks a missing env var.
const localPort = import.meta.env.VITE_LOCAL_PORT || '7860';
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (!isLocal && !import.meta.env.VITE_API_URL) {
     
    console.error('[api] VITE_API_URL is not set — production build will fail to reach the API. Set it in your deployment environment.');
}

export const API = isLocal
    ? `http://localhost:${localPort}`
    : (import.meta.env.VITE_API_URL || '');

export const API_URL = `${API}/api`;

/** Returns headers for an authenticated request.
 *  Pass body=true when sending JSON to also include Content-Type. */
export function authedHeaders(body = false) {
    const token = localStorage.getItem('hs_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return headers;
}
