// Central API base URL.
// Priority: Localhost/127.0.0.1 override (Highest priority, respects VITE_LOCAL_PORT fallback to 7860)
//           → VITE_API_URL env var if not local
//           → Production Hugging Face Space fallback
const PRODUCTION_API = 'https://archittmittal-backend-patientappointment.hf.space';

const localPort = import.meta.env.VITE_LOCAL_PORT || '7860';
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API = isLocal
    ? `http://localhost:${localPort}`
    : (import.meta.env.VITE_API_URL || PRODUCTION_API);

export const API_URL = `${API}/api`;

/** Returns headers for an authenticated request.
 *  Pass body=true when sending JSON to also include Content-Type. */
export function authedHeaders(body = false) {
    const token = localStorage.getItem('hs_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return headers;
}
