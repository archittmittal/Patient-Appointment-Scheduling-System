# Frontend Authentication Documentation

## Overview
This document outlines how authentication is implemented on the frontend of the Patient Appointment Scheduling System.

## Google Authentication Integration
The frontend utilizes the `@react-oauth/google` library to seamlessly integrate Google Sign-In for patients. 

### Prerequisites
1. Ensure `VITE_GOOGLE_CLIENT_ID` is set in the Vercel Environment Variables.
2. The Vercel URL must be added to the Authorized JavaScript origins in the Google Cloud Console.

### Flow
1. User clicks the "Sign in with Google" button.
2. The `GoogleLogin` component handles the OAuth popup.
3. Upon success, a Google ID token is returned.
4. The token is sent to the backend (`/api/auth/google`) for verification.
5. The backend validates the token, determines the user's role (auto-registering Patients if they don't exist), and issues a standard JWT.
6. The frontend saves the JWT and redirects the user to their respective dashboard.

### Fallbacks
If the `VITE_GOOGLE_CLIENT_ID` is missing, the frontend will automatically hide the Google Login button and fallback strictly to email/password authentication to prevent React crashes.
