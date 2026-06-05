## Issue title
[FEATURE] [AUTH-001] Integrate Google Authentication for Patients, Doctors, and Admins

## Labels (comma-separated, lowercase-kebab)
enhancement, type: feature, phase: 3

## Milestone
Phase 3 — Feature Completion

## Description
### Problem
The current authentication system only supports traditional email/password login and OTP verification. Adding Google Auth will reduce friction, improve user adoption, and enhance security. We need to implement Google Auth while strictly enforcing role-based access control for our three distinct user types:
- **Patients**: Should be able to auto-register and log in.
- **Doctors**: Only pre-registered doctors can log in (no auto-registration).
- **Admin**: Only the single predefined admin can log in (no auto-registration).

Because the application uses a **unified login page** for all roles, we need to decide the best architecture for resolving a user's role when they click "Sign in with Google."

### Proposed Architectural Approaches

#### Approach A: Backend-Driven Role Inference (Recommended)
The frontend simply sends the Google token. The backend extracts the email and queries the database.
- If the email exists, the backend reads their DB role (ADMIN, DOCTOR, PATIENT) and issues the matching JWT.
- If the email does NOT exist, the backend safely assumes this is a new patient, auto-registers them as `PATIENT`, and issues a PATIENT JWT.
- **Pros**: Completely unified login page, highly secure, zero frontend routing complexity.
- **Cons**: Overloads the login endpoint with automatic registration logic.

#### Approach B: Frontend-Driven Explicit Login Type
The login page provides a toggle or tab (e.g., "Login as Patient", "Login as Staff"). The frontend sends the Google token along with an explicit `loginType` parameter.
- The backend verifies that the existing user matches the requested `loginType`.
- If a user tries to log in as DOCTOR but doesn't exist, it explicitly rejects them.
- **Pros**: Explicit intent, cleaner separation of concerns.
- **Cons**: Requires UI changes to the unified login page to capture user intent before they click the Google button.

### Acceptance criteria
**Database:**
- [ ] A new SQL migration script is created to update the `users` table.
- [ ] The `password_hash` column is modified to `NULL` to support SSO users.
- [ ] New columns `auth_provider` (ENUM/VARCHAR) and `google_id` (VARCHAR) are added.

**Backend:**
- [ ] `google-auth-library` dependency is added to `backend/package.json`.
- [ ] Backend provides a `POST /api/auth/google` endpoint.
- [ ] Token verification is securely handled using `OAuth2Client.verifyIdToken`.
- [ ] Enforces strict role checks to prevent unauthorized Admin/Doctor access.

**Frontend:**
- [ ] `@react-oauth/google` dependency is added to `frontend/package.json`.
- [ ] A functional "Sign in with Google" button is integrated.
- [ ] JWT payload determines post-login redirection to the appropriate dashboard.

### Fix approach (Database Migration)
```sql
ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'LOCAL';
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
```

### Estimated effort
4h-6h

### References
- **Files to modify**: `backend/src/routes/auth.js`, `backend/src/services/authService.js`, `backend/database/schema.sql`, `frontend/src/main.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/services/authService.js`
- **Libraries**: [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs), [@react-oauth/google](https://github.com/MomenSherif/react-oauth)
