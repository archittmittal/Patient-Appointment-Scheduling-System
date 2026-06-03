// Central API base URL.
// Priority: VITE_API_URL env var → production HF Space → localhost fallback for dev
const PRODUCTION_API = 'https://archittmittal-backend-patientappointment.hf.space';

export const API = import.meta.env.VITE_API_URL
    || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? PRODUCTION_API
        : 'http://localhost:7860');

export const API_URL = `${API}/api`;

/** Returns headers for an authenticated request.
 *  Pass body=true when sending JSON to also include Content-Type. */
export function authedHeaders(body = false) {
    const token = localStorage.getItem('hs_token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    return headers;
}
