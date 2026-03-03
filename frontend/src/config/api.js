// Central API base URL.
// Set VITE_API_URL in your .env file to point to the correct backend.
// Falls back to localhost:5001 for local development so nothing breaks without a .env.
export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
