# 🛠️ Patient Appointment Scheduling System — GitHub Issues Log

This document contains the converted issues from the codebase audit report. These issues are fully structured and formatted to be pasted directly into GitHub.

---
## Issue title
[PHASE-1] [BUG-001] Prevent double-booking with DB transaction and FOR UPDATE lock

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: bug, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The booking endpoint performs no slot overlap or conflict checking. Two users can simultaneously book the same doctor at the same date and time slot, which bypasses the doctor's capacity limit. This will lead to double-booked doctors and severely compromised scheduling integrity.

### Evidence
```js
// appointments.js L84-127 — Directly inserts without checking existing bookings
router.post('/book', authenticate, validateRequest(bookSchema), async (req, res) => {
    // ...
    [result] = await db.query(
        'INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, ...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [patientId, doctorId, date, timeSlot, symptoms || null, 'confirmed', ...]
    );
    // NO check for existing appointments at this slot
    // NO check for max_patients_per_slot
    // NO transaction wrapping the check + insert
```

### Acceptance criteria
- [ ] Querying the appointments table during booking must use a `FOR UPDATE` lock.
- [ ] A concurrent booking attempt for a full slot must return a `409 Conflict` HTTP status code.
- [ ] Run a concurrent execution script booking the same slot simultaneously — only the first request succeeds, while the rest are safely rolled back.

### Fix approach
Wrap the booking logic in a database transaction. Perform a lock query using `SELECT COUNT(*) ... FOR UPDATE` on active appointments for the specified doctor, date, and slot, and compare the count against the doctor's `max_patients_per_slot`. Commit only if slot capacity is not exceeded, else roll back.

### Estimated effort
4h

### References
Audit finding: BUG-001 | File: backend/src/routes/appointments.js:84-179
---
## Issue title
[PHASE-1] [BUG-002] Restrict appointment bookings to future dates

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: bug, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
There is no validation on the appointment date to prevent historical booking. A user can book an appointment for any date in the past, and the backend will silently accept it. This corrupts historical reporting and breaks scheduling workflows.

### Evidence
```js
const bookSchema = Joi.object({
    doctorId: Joi.number().required(),
    date: Joi.string().isoDate().required(), // No .min('now') equivalent
    timeSlot: Joi.string().required(),
    symptoms: Joi.string().allow('', null)
});
```

### Acceptance criteria
- [ ] Booking requests with dates before the current date must fail with `400 Bad Request`.
- [ ] Booking requests with today's date or future dates must successfully pass validation.
- [ ] Attempt to POST `/api/appointments/book` with `date: "2020-01-01"` — server must return `400` with the custom Joi error message "Cannot book appointments in the past".

### Fix approach
Add a custom Joi validation rule to the `bookSchema` in `backend/src/routes/appointments.js` to ensure the input date is greater than or equal to today's date.

### Estimated effort
1h

### References
Audit finding: BUG-002 | File: backend/src/routes/appointments.js:84-92
---
## Issue title
[PHASE-1] [HC-001] Remove hardcoded JWT secret from environment configuration

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The JWT secret key is hardcoded in the `.env` file template. Since this file is committed or exposed, an attacker can easily sign valid JWTs to impersonate any user. This compromises all authentication and authorization across the entire platform.

### Evidence
```js
JWT_SECRET=hs_jwt_super_secret_change_in_production_2024
```

### Acceptance criteria
- [ ] Ensure that a cryptographically secure 64+ character JWT secret is loaded from a real environment variable.
- [ ] The fallback secret must not match the hardcoded string.
- [ ] Attempt to access `/api/appointments/book` using a JWT signed with the default hardcoded secret — server must return 401 Unauthorized.

### Fix approach
Modify `backend/src/config/auth.js` to fail-safe or refuse startup if a production JWT secret is set to the default placeholder. Use a secure env variable generated dynamically at deployment.

### Estimated effort
1h

### References
Audit finding: HC-001 | File: backend/.env:7
---
## Issue title
[PHASE-1] [HC-002] Remove hardcoded database password from environment template

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The database password is hardcoded as `Archit@123` in the committed `.env` file. Any attacker with repository access can obtain credentials to log into the database server, leading to complete database theft or destruction.

### Evidence
```js
DB_PASSWORD=Archit@123
```

### Acceptance criteria
- [ ] Verify that `.env` is listed in `.gitignore` and no secrets are committed.
- [ ] Ensure database password is loaded via a secure runtime environment variable.
- [ ] Attempt to access the database without configuring `DB_PASSWORD` in env — server startup must crash and fail gracefully.

### Fix approach
Update `.gitignore` to ensure `.env` files are never tracked, rotate the database password across all environments, and configure the deployment platform to inject the database password at runtime.

### Estimated effort
1h

### References
Audit finding: HC-002 | File: backend/.env:4
---
## Issue title
[PHASE-1] [SEC-001] Remove and rotate exposed credentials in backend environment configuration

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
Sensitive credentials (database password and JWT secret) are directly exposed in the `.env` configuration file. An attacker can leverage this sensitive data exposure to gain root access to the database and generate arbitrary admin tokens.

### Evidence
```js
DB_PASSWORD=Archit@123
JWT_SECRET=hs_jwt_super_secret_change_in_production_2024
```

### Acceptance criteria
- [ ] Rotate all database passwords and generate a new random 64-character JWT secret.
- [ ] Ensure that `.env` is fully untracked from Git history using git-filter-repo or a similar tool.
- [ ] Attempt to sign a JWT using the leaked secret and make an API request — the server must reject it with a 401.

### Fix approach
Add `.env` to `.gitignore`, run a Git history scrubbing command, rotate all compromised secrets, and utilize a secure credential vault or container environment variables in production.

### Estimated effort
2h

### References
Audit finding: SEC-001 | File: backend/.env:4,7
---
## Issue title
[PHASE-1] [SEC-003] Implement Stripe webhook signature verification

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The Stripe payment webhook endpoint does not verify the signature of incoming webhooks. An attacker can send a crafted HTTP POST request to `/api/payments/webhook` with a fake payload to mark any unpaid appointment as fully paid. This allows patients to obtain free appointments.

### Evidence
```js
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    // In a real app, verify Stripe signature here
    try {
        await paymentService.handleWebhook(req.body);
```

### Acceptance criteria
- [ ] Implement signature validation using `stripe.webhooks.constructEvent()` inside the webhook route.
- [ ] Webhook payloads without a valid `stripe-signature` header must fail with `400 Bad Request`.
- [ ] Attempt to POST to `/api/payments/webhook` with a mock payload and a fake signature — the server must return 400.

### Fix approach
Import `stripe` SDK, load `STRIPE_WEBHOOK_SECRET` from environment variables, extract the signature header, and verify the raw body payload before executing `paymentService.handleWebhook()`.

### Estimated effort
3h

### References
Audit finding: SEC-003 | File: backend/src/routes/payments.js:72-81
---
## Issue title
[PHASE-1] [SEC-005] Prevent self-registration as ADMIN or DOCTOR

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The Joi registration schema accepts a `role` parameter and permits users to select `ADMIN` or `DOCTOR` at registration. If the registration logic or a future refactor uses this parameter directly, any unauthenticated attacker can escalate their privileges to Admin. This presents a critical privilege escalation risk.

### Evidence
```js
const registerSchema = Joi.object({
    // ...
    role: Joi.string().valid('PATIENT', 'DOCTOR', 'ADMIN').default('PATIENT'),
```

### Acceptance criteria
- [ ] The `registerSchema` must restrict user roles to `PATIENT` only, or remove the `role` field entirely.
- [ ] Admin/Doctor role creation must be isolated to a dedicated authenticated admin panel.
- [ ] Attempt to POST `/api/auth/register` with `role: "ADMIN"` in the payload — the server must return a `400 Bad Request` or ignore the role and register them as a `PATIENT` only.

### Fix approach
Edit `backend/src/routes/auth.js` to remove `DOCTOR` and `ADMIN` from the `role` enum validation list in `registerSchema`.

### Estimated effort
1h

### References
Audit finding: SEC-005 | File: backend/src/routes/auth.js:15
---
## Issue title
[PHASE-1] [SEC-008] Restrict CORS whitelist to exact origins

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: security, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The backend CORS configuration allows all subdomains ending with `.vercel.app` and `.hf.space`. Since these platforms allow free and instant deployment of unverified web applications, any attacker can deploy a malicious script to their own Vercel app to make cross-origin requests to this API. This allows session-jacking or unauthorized data extraction.

### Evidence
```js
// 3. Allow all Vercel and Hugging Face deployments
if (/.vercel.app$/.test(origin) || /.hf.space$/.test(origin)) {
    return callback(null, true);
}
```

### Acceptance criteria
- [ ] Whitelist only precise, explicit domain origins via the backend config.
- [ ] Disallow wildcards or regex sweeps on open-hosting services.
- [ ] Attempt to trigger an OPTIONS preflight request from `evil-site.vercel.app` — the server must reject the origin or fail to return CORS allowance headers.

### Fix approach
Update `backend/src/server.js` to verify origin against a strict whitelist array specified in `process.env.ALLOWED_ORIGINS`.

### Estimated effort
2h

### References
Audit finding: SEC-008 | File: backend/src/server.js:124-127
---
## Issue title
[PHASE-1] [DB-001] Add unique key constraint to prevent duplicate bookings

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: schema, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The database `appointments` table lacks a unique constraint to prevent duplicate slots. Multiple records can exist for the same doctor, date, and time slot simultaneously. This allows double-bookings at the database level.

### Evidence
```js
CREATE TABLE IF NOT EXISTS appointments (
    -- No UNIQUE KEY on (doctor_id, appointment_date, time_slot)
    -- No UNIQUE KEY on (patient_id, doctor_id, appointment_date, time_slot)
```

### Acceptance criteria
- [ ] The `appointments` table must enforce slot uniqueness.
- [ ] An insert of a duplicate active booking must fail with a database driver error (duplicate key).
- [ ] Execute a manual insert SQL query twice for the same doctor, date, and slot — the second statement must fail with `ER_DUP_ENTRY`.

### Fix approach
Create a database migration script that adds a `UNIQUE KEY unique_booking (doctor_id, appointment_date, time_slot)` constraint (while considering only non-cancelled appointments if possible, or add unique constraint across active slots).

### Estimated effort
2h

### References
Audit finding: DB-001 | File: backend/database/schema.sql:45-65
---
## Issue title
[PHASE-1] [DB-004] Wrap appointment booking and queue insertion in a database transaction

## Labels (comma-separated, lowercase-kebab)
severity: critical, type: performance, phase: 1, blocking-deployment

## Milestone
Phase 1 — Critical Hotfixes

## Description
### Problem
The appointment insertion and the live queue insertion run as separate, independent queries without an enclosing transaction. If the live queue insertion fails due to an error, the database remains in an inconsistent state with a booked appointment but no live queue tracking record.

### Evidence
```js
[result] = await db.query('INSERT INTO appointments ...');
// Queue insert on L157 (no transaction!)
await db.query('INSERT INTO live_queue ...');
```

### Acceptance criteria
- [ ] Implement a full transaction flow for the booking endpoint.
- [ ] A failure during queue insertion must rollback the created appointment.
- [ ] Trigger an artificial error in `live_queue` insertion during booking — verify that the corresponding appointment does not get committed to the database.

### Fix approach
Use `db.getConnection()`, invoke `beginTransaction()`, run both queries on the acquired connection, and call `commit()` only when both succeed. Implement `rollback()` in the `catch` block.

### Estimated effort
3h

### References
Audit finding: DB-004 | File: backend/src/routes/appointments.js:84-179
---
## Issue title
[PHASE-2] [BUG-003] Prevent cancellation of historical appointments

## Labels (comma-separated, lowercase-kebab)
severity: high, type: bug, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The appointment cancellation endpoint does not check if the appointment's scheduled date has already passed. A patient can "cancel" a completed-in-the-past appointment as long as its status is still 'CONFIRMED' or 'PENDING', potentially corrupting historical medical and financial records.

### Evidence
```js
router.patch('/:id/cancel', authenticate, async (req, res) => {
    // Checks status but NOT date
    if (!['CONFIRMED', 'PENDING', 'confirmed', 'pending', 'scheduled'].includes(appt.status)) {
        return res.status(400).json({ message: `Cannot cancel appointment with status ${appt.status}` });
    }
    // No check: if (appt.appointment_date < today) ...
```

### Acceptance criteria
- [ ] Verify that attempting to cancel an appointment scheduled in the past returns a `400 Bad Request` HTTP status.
- [ ] Ensure cancelling active, future appointments remains fully operational and functional.
- [ ] Send a PATCH request to cancel an appointment whose date is "2020-01-01" — server must return 400 and message "Cannot cancel a past appointment".

### Fix approach
Add a date check in `/api/appointments/:id/cancel` that compares `appt.appointment_date` against the current date, and rejects the request if the appointment date is in the past.

### Estimated effort
2h

### References
Audit finding: BUG-003 | File: backend/src/routes/appointments.js:596-646
---
## Issue title
[PHASE-2] [BUG-006] Validate patient ID ownership and authorization during booking

## Labels (comma-separated, lowercase-kebab)
severity: high, type: bug, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
A non-PATIENT user (like DOCTOR or ADMIN) can book an appointment for *any* patientId by passing it in the request body. However, there is no ownership check or verification that the provided patientId represents a valid patient, allowing unauthorized bookings on behalf of arbitrary patients.

### Evidence
```js
const patientId = req.user.role === 'PATIENT' ? req.user.id : req.body.patientId;
// A DOCTOR can set req.body.patientId to ANY integer, no ownership check
```

### Acceptance criteria
- [ ] Verify that a PATIENT role cannot override their `patientId` using the request body.
- [ ] Verify that DOCTOR/ADMIN roles booking on behalf of others must provide a valid `patientId` that exists in the database.
- [ ] Attempt to book an appointment by a PATIENT with a different `patientId` in the body — verify that the resulting appointment is booked for the actual logged-in user's ID.

### Fix approach
If the caller has the role of DOCTOR or ADMIN, query the database to verify the `patientId` exists and is a valid patient role. Add clear access authorization rules.

### Estimated effort
3h

### References
Audit finding: BUG-006 | File: backend/src/routes/appointments.js:87
---
## Issue title
[PHASE-2] [BUG-008] Align backend appointment status inserts with uppercase schema ENUM

## Labels (comma-separated, lowercase-kebab)
severity: high, type: bug, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The morning cron job checks for appointments with `status = 'CONFIRMED'` (uppercase), but the booking route inserts appointments with status 'confirmed' (lowercase). While MySQL ENUM comparison might succeed case-insensitively, this creates a severe inconsistency that causes reminder jobs to break on binary collation databases.

### Evidence
```js
WHERE a.appointment_date = CURDATE() AND a.status = 'CONFIRMED'
```

### Acceptance criteria
- [ ] All appointment inserts must store the status as uppercase `CONFIRMED`.
- [ ] All cron/query operations must inspect uppercase status values.
- [ ] Insert a new appointment via the API, then query the database directly using `SELECT status` — verify the status is saved as 'CONFIRMED'.

### Fix approach
Modify the booking insert query in `appointments.js` to use the uppercase string 'CONFIRMED'. Establish uppercase statuses across all endpoints.

### Estimated effort
1h

### References
Audit finding: BUG-008 | File: backend/src/jobs/reminderJobs.js:38, 72
---
## Issue title
[PHASE-2] [HC-003] Throw runtime exception when fallback Stripe key is used

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The payment service contains a hardcoded fallback API key of `'sk_test_mock'` if no Stripe key is set in the environment. This results in silent failure to mock mode rather than crashing safely, which could mask configuration issues in production.

### Evidence
```js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
```

### Acceptance criteria
- [ ] Ensure the server refuses to startup or throw a configuration error if `STRIPE_SECRET_KEY` is missing in production.
- [ ] Do not allow fallback test keys in staging or production environments.
- [ ] Set `NODE_ENV=production` and remove `STRIPE_SECRET_KEY` — verify that initializing the payment service immediately throws a configuration exception.

### Fix approach
Modify `paymentService.js` to check for `process.env.STRIPE_SECRET_KEY`. If undefined, throw a detailed initialization error rather than falling back to `'sk_test_mock'`.

### Estimated effort
1h

### References
Audit finding: HC-003 | File: backend/src/services/paymentService.js:1
---
## Issue title
[PHASE-2] [HC-004] Replace hardcoded doctor consultation fee with database field

## Labels (comma-separated, lowercase-kebab)
severity: high, type: bug, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The Stripe payment integration uses a hardcoded payment amount of `5000` cents ($50.00) for all appointments. This makes it impossible to configure custom fees per doctor or support varying pricing structures.

### Evidence
```js
const paymentIntent = await stripe.paymentIntents.create({
    amount: 5000, // $50.00 hardcoded
    currency: 'usd',
```

### Acceptance criteria
- [ ] Retrieve the doctor's consultation fee from the database during payment intent creation.
- [ ] Ensure Stripe payment intents are initialized with the exact consultation fee associated with the booking's doctor.
- [ ] Create an appointment for a doctor with a $75.00 fee — verify the Stripe payment intent is initialized with exactly `7500` cents.

### Fix approach
Add a `consultation_fee` column to the `doctors` database schema, query this value when creating a payment intent in `paymentService.js`, and pass it as the amount to Stripe.

### Estimated effort
3h

### References
Audit finding: HC-004 | File: backend/src/services/paymentService.js:12
---
## Issue title
[PHASE-2] [HC-007] Remove hardcoded Hugging Face Space URL fallback from frontend configuration

## Labels (comma-separated, lowercase-kebab)
severity: high, type: cleanup, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The frontend API configuration hardcodes `'https://archittmittal-backend-patientappointment.hf.space'` as a fallback URL. This leaks developer testing environments and creates risks of pointing production builds to a stale or compromised backend.

### Evidence
```js
const API_URL = import.meta.env.VITE_API_URL || 'https://archittmittal-backend-patientappointment.hf.space';
```

### Acceptance criteria
- [ ] The fallback URL must be removed or fall back to the current origin.
- [ ] Throw an explicit build-time or run-time error if `VITE_API_URL` is undefined in production.
- [ ] Build the frontend without `VITE_API_URL` set — verify it falls back to the current hosting origin dynamically.

### Fix approach
Modify `frontend/src/config/api.js` to remove the hardcoded Hugging Face URL. Fall back to relative paths or the window's host origin if the env variable is missing.

### Estimated effort
1h

### References
Audit finding: HC-007 | File: frontend/src/config/api.js:4
---
## Issue title
[PHASE-2] [SEC-002] Disable authentication token retrieval from query parameters

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The JWT authentication middleware permits tokens to be passed via the `token` URL query parameter. This allows credentials to be leaked in server log files, browser history, reverse proxy records, and HTTP Referer headers.

### Evidence
```js
} else if (req.query.token) {
    token = req.query.token;
}
```

### Acceptance criteria
- [ ] The middleware must strictly ignore JWT tokens supplied via query parameters.
- [ ] Only tokens passed inside the standard HTTP `Authorization` header must be verified.
- [ ] Attempt to GET `/api/appointments` with `?token=VALID_JWT` — the server must reject the request with `401 Unauthorized`.
- [ ] Attempt to GET `/api/appointments` using `Authorization: Bearer VALID_JWT` — the request must succeed.

### Fix approach
Remove the `else if (req.query.token)` block in `backend/src/middleware/authenticate.js` to ensure the middleware only processes the Authorization header.

### Estimated effort
1h

### References
Audit finding: SEC-002 | File: backend/src/middleware/authenticate.js:14-16
---
## Issue title
[PHASE-2] [SEC-004] Add ownership validation to payment intent creation

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The payment intent route accepts an `appointmentId` but does not verify whether the currently authenticated user owns or is associated with that appointment. This allows Patient A to generate payment intents for Patient B's appointments, exposing sensitive medical IDs.

### Evidence
```js
router.post('/create-intent', authenticate, async (req, res, next) => {
    const { appointmentId } = req.body;
    // No check that req.user.id owns this appointment
    const data = await paymentService.createPaymentIntent(appointmentId, req.user.id);
```

### Acceptance criteria
- [ ] Ensure the application verifies that the `patient_id` of the appointment matches `req.user.id` before calling Stripe.
- [ ] Reject unauthorized payment intent generation with a `403 Forbidden` status.
- [ ] Attempt to POST `/api/payments/create-intent` with an `appointmentId` belonging to another patient — the server must return 403.

### Fix approach
Query the `appointments` table to fetch the appointment by ID, verify `appointment.patient_id === req.user.id`, and return a 403 error if the check fails.

### Estimated effort
2h

### References
Audit finding: SEC-004 | File: backend/src/routes/payments.js:40-52
---
## Issue title
[PHASE-2] [SEC-006] Secure forgot password endpoint against email enumeration and weak OTP generation

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The forgot password service returns a `404` status code if the queried email does not exist, enabling email enumeration. Furthermore, the OTP is generated using `Math.random()`, which is a non-cryptographically secure pseudo-random number generator that is vulnerable to prediction attacks.

### Evidence
```js
async forgotPassword(email) {
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;  // LEAKS whether email exists
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
```

### Acceptance criteria
- [ ] The password reset endpoint must return a standard success message even if the requested email is not registered.
- [ ] OTP generation must use `crypto.randomInt()`.
- [ ] Attempt to POST `/api/auth/forgot-password` with a non-existent email — the server must return 200 OK.
- [ ] Verify that the OTP code generated is cryptographically random.

### Fix approach
Modify `forgotPassword` in `authService.js` to return a success payload regardless of user existence. Replace `Math.random()` with `crypto.randomInt(100000, 999999)`.

### Estimated effort
2h

### References
Audit finding: SEC-006 | File: backend/src/services/authService.js:88-106
---
## Issue title
[PHASE-2] [SEC-007] Implement rate limiting and lockout mechanism for OTP verification

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The password reset and OTP verification endpoints have no attempt rate limiting. An attacker can brute-force the 6-digit numeric OTP (1,000,000 combinations) in a very short time window and take over any patient or doctor account.

### Evidence
```js
async resetPassword(email, otp, newPassword) {
    const [users] = await db.query(
        'SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expiry > NOW()',
        [email, otp]
    );
    // No rate limiting on OTP attempts — brute-force possible
```

### Acceptance criteria
- [ ] Limit password reset attempts to a maximum of 5 failures per email before temporary lockout.
- [ ] Verify that exceeding the maximum failed attempts returns a `429 Too Many Requests` status code and locks the account.
- [ ] Attempt to POST `/api/auth/reset-password` 10 times consecutively with invalid OTP codes — the server must reject with 429 after 5 failures and lock the OTP verification.

### Fix approach
Add an `otp_attempts` column to the `users` table. Increment it on failed validation, and reject/lock the user once it exceeds a threshold. Clear the attempts on success.

### Estimated effort
3h

### References
Audit finding: SEC-007 | File: backend/src/services/authService.js:108-127
---
## Issue title
[PHASE-2] [SEC-009] Verify active appointment relationship before allowing messages

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The messaging endpoint lets any authenticated user send messages to any other `receiverId` without checking if there is an active doctor-patient relationship or shared appointment. This allows spam, harassment, and data probing across the platform.

### Evidence
```js
router.post('/', authenticate, async (req, res, next) => {
    const { receiverId, content, appointmentId } = req.body;
    // No check: Can I send to this receiverId?
    // Any authenticated user can message ANY other user
```

### Acceptance criteria
- [ ] The message endpoint must verify that the sender and receiver are connected via an active appointment.
- [ ] Reject unauthorized message attempts with `403 Forbidden`.
- [ ] Attempt to POST `/api/messages` to send a message to a random user ID — the server must return 403 Forbidden.

### Fix approach
Query the `appointments` table in `messages.js` to ensure there is a booking containing both the sender's and receiver's user IDs before completing the message insertion.

### Estimated effort
2h

### References
Audit finding: SEC-009 | File: backend/src/routes/messages.js:46-62
---
## Issue title
[PHASE-2] [SEC-012] Enforce authentication and rate limiting on QR check-in scan route

## Labels (comma-separated, lowercase-kebab)
severity: high, type: security, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The QR scan endpoint `/api/express-checkin/scan` completely lacks authentication middleware. Anyone with a guest token or guessable appointment details can check in patients, bypassing physical validation or staff authorization.

### Evidence
```js
router.post('/scan', async (req, res) => {
    // NO authenticate middleware — completely open endpoint
```

### Acceptance criteria
- [ ] Add authentication verification (e.g., API key or basic auth for kiosk tablets) to the scan endpoint.
- [ ] Attach a strict rate limiter to prevent scanning brute-force tokens.
- [ ] Attempt to POST to `/api/express-checkin/scan` without any authorization headers — server must return a `401 Unauthorized` status.

### Fix approach
Create a specific api-key middleware or apply the `authenticate` middleware to `/scan`. Add an express-rate-limit instance to this route.

### Estimated effort
2h

### References
Audit finding: SEC-012 | File: backend/src/routes/expressCheckin.js:110
---
## Issue title
[PHASE-2] [DB-002] Add database indexes for foreign keys and query filters

## Labels (comma-separated, lowercase-kebab)
severity: high, type: schema, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The schema is missing explicit indexes on heavily queried columns like `patient_id`, `doctor_id`, `appointment_date`, and `status`. This forces MySQL/TiDB to execute costly full-table scans for basic daily scheduling lookups and analytics.

### Evidence
```js
-- Missing indexes:
-- appointments.patient_id (FK exists but no explicit index for queries)
-- appointments.doctor_id (FK exists but no explicit index for queries)
```

### Acceptance criteria
- [ ] Create high-efficiency indexes for frequently filtered combinations.
- [ ] Verify that database query execution plans (`EXPLAIN`) utilize indexes rather than executing full-table scans.
- [ ] Run `EXPLAIN SELECT * FROM appointments WHERE doctor_id = 1 AND appointment_date = CURDATE()` — output must show an index scan.

### Fix approach
Create a database migration script containing SQL index creation statements for `appointments(doctor_id, appointment_date)`, `appointments(patient_id, appointment_date)`, `appointments(status)`, and `live_queue(appointment_id)`.

### Estimated effort
2h

### References
Audit finding: DB-002 | File: backend/database/schema.sql:all
---
## Issue title
[PHASE-2] [DB-003] Implement pagination limits on admin appointments fetch endpoint

## Labels (comma-separated, lowercase-kebab)
severity: high, type: performance, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The admin panel's appointment endpoint fetches the entire database of appointments without any LIMIT or offset logic. As the volume of bookings grows, this query will degrade, consume massive system memory, and potentially cause server Out-Of-Memory (OOM) crashes.

### Evidence
```js
// admin.js L506-517 — NO LIMIT on appointments query
router.get('/appointments', async (req, res) => {
    const [rows] = await db.query(`
        SELECT a.id, a.appointment_date, ...
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        ORDER BY a.appointment_date DESC, a.created_at DESC
    `);  // NO LIMIT
```

### Acceptance criteria
- [ ] The endpoint must accept `page` and `limit` query parameters, defaulting to safe limits (e.g. 50 per page).
- [ ] The response payload must include pagination metadata (total count, pages).
- [ ] Request GET `/api/admin/appointments?limit=10` — verify that exactly 10 appointment records are returned.

### Fix approach
Add Joi validation for `page` and `limit` query params. Modify the SQL query in `admin.js` to include `LIMIT ? OFFSET ?` using calculated offset values.

### Estimated effort
2h

### References
Audit finding: DB-003 | File: backend/src/routes/admin.js:506-523
---
## Issue title
[PHASE-2] [DEAD-007] Secure the unauthenticated QR scan route against token scanning abuse

## Labels (comma-separated, lowercase-kebab)
severity: high, type: cleanup, phase: 2

## Milestone
Phase 2 — High Priority Fixes

## Description
### Problem
The QR scan endpoint `/api/express-checkin/scan` permits unauthenticated clients to check in patients. While designed for physical lobby kiosks, having this route completely open to the internet allows remote script scanners to brute-force valid patient tokens.

### Evidence
```js
// QR scan endpoint (POST /scan) has no authentication
router.post('/scan', async (req, res) => {
```

### Acceptance criteria
- [ ] Enforce an authorization layer (like a secret Kiosk API key) for lobby check-in tablets.
- [ ] Rate limit this endpoint to a maximum of 5 requests per minute per IP.
- [ ] Attempt to post a mock check-in token without authorization headers — the server must reject it with 401.

### Fix approach
Define a middleware in `expressCheckin.js` that checks for a kiosk API key in headers, and apply a strict rate limiter to the route.

### Estimated effort
2h

### References
Audit finding: DEAD-007 | File: backend/src/routes/expressCheckin.js:110
---
## Issue title
[PHASE-3] [BUG-004] Standardize status comparison checks and enforce uppercase in DB

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: bug, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The appointment status comparison uses an array that contains a mix of lowercase and uppercase strings (e.g. `'confirmed'` vs `'CONFIRMED'`). If database collation rules change or case-insensitive query evaluations are altered, this inconsistency will trigger silent failures.

### Evidence
```js
if (!['CONFIRMED', 'PENDING', 'confirmed', 'pending', 'scheduled'].includes(appt.status)) {
```

### Acceptance criteria
- [ ] All status value arrays and check logic must utilize strict uppercase matches.
- [ ] Ensure the database ENUM values are uppercase only.
- [ ] Add a unit test ensuring that calling cancellation with lowercase values fails validation or standardizes to uppercase before matching.

### Fix approach
Update the `appointments.js` checks to only include `['CONFIRMED', 'PENDING', 'SCHEDULED']` and ensure matching inserts use uppercase values.

### Estimated effort
1h

### References
Audit finding: BUG-004 | File: backend/src/routes/appointments.js:612
---
## Issue title
[PHASE-3] [BUG-005] Fix case sensitivity discrepancy in admin statistics SQL metrics

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: bug, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
Admin statistics are queried using uppercase status constants (`status = 'CONFIRMED'`), but booking operations write lowercase status values (`'confirmed'`). If case-sensitive collations or custom MySQL configurations are applied, these admin counts will silently return 0.

### Evidence
```js
COUNT(CASE WHEN appointment_date = CURDATE() AND status = 'CONFIRMED' THEN 1 END) AS today_confirmed,
```

### Acceptance criteria
- [ ] Verify admin queries successfully aggregate data regardless of database collation settings.
- [ ] All admin stats aggregations must match standard uppercase statuses.
- [ ] Manually set a test database collation to case-sensitive — verify the dashboard statistics display exact counts.

### Fix approach
Update all status-related conditional aggregations inside the admin dashboard router `admin.js` to match the uppercase values, aligning with the core ENUM definitions.

### Estimated effort
2h

### References
Audit finding: BUG-005 | File: backend/src/routes/admin.js:549-553
---
## Issue title
[PHASE-3] [BUG-007] Add request payload validation to virtual check-in status endpoint

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: bug, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The endpoint `/api/virtual-checkin/:appointmentId/status` invokes `status.toUpperCase()` without verify that a `status` was actually passed in the request body. If the property is missing, the server will crash with a `TypeError`.

### Evidence
```js
// Line 134
status.toUpperCase(),
// No validation middleware on this route:
router.post('/:appointmentId/status', authenticate, async (req, res) => {
    const { status, etaMinutes, message } = req.body;
```

### Acceptance criteria
- [ ] The virtual check-in endpoint must be protected by a Joi request body validation schema.
- [ ] Requests missing the `status` field must fail immediately with a `400 Bad Request` code.
- [ ] Attempt to POST `/api/virtual-checkin/1/status` with an empty JSON body — verify that the server returns `400` instead of crashing.

### Fix approach
Create a validation schema requiring `status` to be in `['WAITING', 'CHECKED_IN', 'DELAYED']` and attach `validateRequest` middleware to this route in `virtualCheckin.js`.

### Estimated effort
1h

### References
Audit finding: BUG-007 | File: backend/src/routes/virtualCheckin.js:134
---
## Issue title
[PHASE-3] [BUG-009] Disable verbose request logger in production environment

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: performance, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
A debug middleware is active across all application environments, printing every single request and URL path directly to `console.log`. This degrades request processing speed and floods log storage in production.

### Evidence
```js
// Debug Logger — no environment guard
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
```

### Acceptance criteria
- [ ] Verify that console logging is fully disabled during production execution.
- [ ] Enable the debug logger ONLY in local development or debug mode.
- [ ] Run the application with `NODE_ENV=production` and trigger an API request — verify that no verbose request logs are printed to standard output.

### Fix approach
Wrap the request logger middleware in `backend/src/server.js` within an `if (process.env.NODE_ENV !== 'production')` conditional check.

### Estimated effort
1h

### References
Audit finding: BUG-009 | File: backend/src/server.js:33-39
---
## Issue title
[PHASE-3] [HC-005] Extract Swagger documentation server URL into environment variables

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The Swagger documentation configuration hardcodes `'http://localhost:7860'` as the target server URL. If deployed to production, client interactive test requests will try to reach localhost instead of the real deployment, rendering the documentation useless.

### Evidence
```js
url: 'http://localhost:7860',
```

### Acceptance criteria
- [ ] Load the Swagger target server URL from the environment configuration.
- [ ] The default fallback should be the active server's URL context.
- [ ] Access the Swagger UI in a production environment — verify that the listed target server matches the production domain.

### Fix approach
Replace the hardcoded URL in `backend/src/server.js` with `process.env.APP_URL || 'http://localhost:7860'`.

### Estimated effort
1h

### References
Audit finding: HC-005 | File: backend/src/server.js:60
---
## Issue title
[PHASE-3] [HC-008] Move hardcoded bcrypt rounds value to centralized authentication config

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The number of hashing rounds for passwords is hardcoded as `BCRYPT_ROUNDS = 10` inside the admin creation routes. This is duplicated logic that should be managed by a central configuration file to allow easy adjustments if security standards change.

### Evidence
```js
const BCRYPT_ROUNDS = 10;
```

### Acceptance criteria
- [ ] The admin routing code must import the crypt hashing settings from standard configuration modules.
- [ ] Verify that hashing functions use this central variable.
- [ ] Modify the central configuration to use a different cost factor (e.g. 12) — verify that new password hashes are generated using the updated factor.

### Fix approach
Import `bcryptRounds` from the centralized config module in `admin.js` and remove the redundant locally defined variable.

### Estimated effort
1h

### References
Audit finding: HC-008 | File: backend/src/routes/admin.js:9
---
## Issue title
[PHASE-3] [HC-009] Resolve database port setting mismatch in database configuration module

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The database connection configuration hardcodes `4000` (the standard TiDB port) as a fallback, whereas the `.env` template indicates port `3306`. This creates a confusing port mismatch that complicates local configuration.

### Evidence
```js
port: process.env.DB_PORT || 4000,
```

### Acceptance criteria
- [ ] The fallback database port must align with standard MySQL defaults (3306) to ensure consistent local setups.
- [ ] Verify that database connection logic works with environment variables.
- [ ] Run the application without `DB_PORT` set — verify it connects successfully to a local database server running on the standard port 3306.

### Fix approach
Edit `backend/src/config/db.js` to change the default fallback port value to `3306`.

### Estimated effort
1h

### References
Audit finding: HC-009 | File: backend/src/config/db.js:9
---
## Issue title
[PHASE-3] [HC-014] Extract hardcoded seed passwords to environment variables

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The system database seeding script hardcodes standard development passwords like `'password123'` and `'admin123'`. This creates a risk where these default passwords could be loaded into staging or production databases by accident.

### Evidence
```js
password: 'password123',
role: 'ADMIN'
```

### Acceptance criteria
- [ ] Ensure seed passwords are loaded from the environment variables (e.g., `SEED_ADMIN_PASSWORD`).
- [ ] The seeding process must throw an error if executed in a production environment without explicit configuration.
- [ ] Run the seed script in production mode without setting a password env var — verify the execution halts and raises a safety exception.

### Fix approach
Modify `backend/seed.js` to retrieve seed passwords from `process.env` and throw a safety error if `NODE_ENV === 'production'`.

### Estimated effort
1h

### References
Audit finding: HC-014 | File: backend/seed.js:11
---
## Issue title
[PHASE-3] [HC-015] Extract hardcoded email fallback URL to configuration variables

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The notification service templates use a hardcoded domain of `'http://localhost:5173'` for password reset and notification links. As a result, emails sent in staging or production environments will contain broken localhost URLs.

### Evidence
```js
const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
```

### Acceptance criteria
- [ ] Ensure email templates dynamically build action links using the base address configured in environment variables.
- [ ] The configuration must require this variable to be set when executing in non-development modes.
- [ ] Trigger a password reset email from a staging server — verify that the action links inside the email point to the staging domain instead of localhost.

### Fix approach
Add a check that throws an error if `FRONTEND_URL` is missing when `NODE_ENV` is not development, and ensure all notification service templates use this variable.

### Estimated effort
1h

### References
Audit finding: HC-015 | File: backend/src/services/notificationService.js:142
---
## Issue title
[PHASE-3] [DEAD-001] Rename shadowed status variable within the waiting list processing loop

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The variable `status` is re-declared inside a `for` loop in `appointments.js`, shadowing the outer `status` parameter fetched from the request body. This shadowing makes the code difficult to read and introduces risks of incorrect status assignments during refactoring.

### Evidence
```js
for (const p of waitingPatients) {
    const status = await virtualCheckinService.getWaitingRoomStatus(p.appointment_id, p.patient_id);
```

### Acceptance criteria
- [ ] The shadowed variable must be renamed to a unique name.
- [ ] The functional logic must continue working correctly after the rename.
- [ ] Run the waiting room status test suite — verify all status lookup assertions pass without variable shadowing warnings.

### Fix approach
Rename the loop-scoped `status` variable to `waitingRoomStatus` or `patientQueueStatus` inside `backend/src/routes/appointments.js`.

### Estimated effort
1h

### References
Audit finding: DEAD-001 | File: backend/src/routes/appointments.js:574
---
## Issue title
[PHASE-3] [DEAD-002] Secure production logging by removing raw request logging middleware

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: cleanup, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The server executes raw request logging middleware in all environments. This prints patient information and URL patterns to the application logs in production, which violates security standards for healthcare applications.

### Evidence
```js
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
```

### Acceptance criteria
- [ ] Ensure request logs are completely removed from standard output in production mode.
- [ ] Use a structured logger (like Winston) for managed logging.
- [ ] Start the server with `NODE_ENV=production` and trigger multiple API calls — verify that no raw console log lines are printed.

### Fix approach
Either remove the raw logging block entirely or wrap it inside a strict `if (process.env.NODE_ENV !== 'production')` check.

### Estimated effort
1h

### References
Audit finding: DEAD-002 | File: backend/src/server.js:36-39
---
## Issue title
[PHASE-3] [DEAD-003] Restrict database connection pool monitoring logs to development mode

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: performance, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The database client setup registers connection pool event listeners (`acquire`, `release`, `enqueue`) that write to `console.log` in all non-testing environments. In high-traffic production environments, this creates extreme log volume and degrades request processing performance.

### Evidence
```js
pool.on('acquire', (connection) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('Connection %d acquired', connection.threadId);
    }
});
```

### Acceptance criteria
- [ ] Verify connection pool logs are not written during standard production execution.
- [ ] Ensure logs are only enabled in development or troubleshooting environments.
- [ ] Run database queries in production mode — verify that no pool thread connection messages are output to the logs.

### Fix approach
Modify `backend/src/config/db.js` to wrap pool connection logging listeners inside an environment check `process.env.NODE_ENV === 'development'`.

### Estimated effort
1h

### References
Audit finding: DEAD-003 | File: backend/src/config/db.js:33-49
---
## Issue title
[PHASE-3] [SEC-010] Sanitize global error handler responses to prevent implementation leakage

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: security, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The global error handling middleware returns `err.message` to clients in all environments. When a system failure or database error occurs, this can leak internal database table names, query structures, or code logic details to potential attackers.

### Evidence
```js
...(process.env.NODE_ENV === 'development' && { stack: err.stack })
```

### Acceptance criteria
- [ ] Ensure the server returns a standard, generic error message in production.
- [ ] Keep detailed error messages and stack traces restricted to development mode.
- [ ] Trigger a database connection failure on the API in production mode — verify the response JSON contains "Internal Server Error" without exposing database-specific messages.

### Fix approach
Modify `errorHandler.js` to return a generic message like "An internal error occurred" when running in production mode, while logging the actual error internally.

### Estimated effort
1h

### References
Audit finding: SEC-010 | File: backend/src/middleware/errorHandler.js:22
---
## Issue title
[PHASE-3] [SEC-011] Remove raw database error details from appointment booking endpoint response

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: security, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The booking route contains a `try-catch` block that directly returns `error.message` as a `detail` parameter in the response. If the query fails (e.g. due to database errors or foreign key constraint issues), the raw system error details will be exposed to patients.

### Evidence
```js
res.status(500).json({ message: 'Server error booking appointment', detail: error.message });
```

### Acceptance criteria
- [ ] Ensure that error payloads returned to the client never include database error details.
- [ ] Log the raw system error details internally for troubleshooting.
- [ ] Submit a malformed booking request that triggers a database error — verify the response payload does not contain the `detail` key.

### Fix approach
Remove the `detail` key from the HTTP 500 error response payload in `appointments.js`. Log the raw error instead.

### Estimated effort
1h

### References
Audit finding: SEC-011 | File: backend/src/routes/appointments.js:177
---
## Issue title
[PHASE-3] [SEC-013] Restrict Server-Sent Events CORS header to allowed origins only

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: security, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The Server-Sent Events (SSE) manager hardcodes the `Access-Control-Allow-Origin` header to `'*'`. This lets any malicious third-party site open an event connection, bypass standard CORS constraints, and listen to real-time patient queue updates.

### Evidence
```js
'Access-Control-Allow-Origin': '*'
```

### Acceptance criteria
- [ ] The SSE connection header must be restricted to match the application's CORS policy.
- [ ] Wildcards must not be used on active event connection streams.
- [ ] Make an event connection request from `unauthorized-domain.com` — verify the connection is rejected by the server.

### Fix approach
Modify the response headers in `sseManager.js` to dynamically set the origin based on a strict whitelist of allowed domains.

### Estimated effort
1h

### References
Audit finding: SEC-013 | File: backend/src/services/sseManager.js:44
---
## Issue title
[PHASE-3] [DB-005] Replace correlated subquery in doctor list with JOIN statement to avoid N+1 query performance hits

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: performance, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The doctor list endpoint runs a correlated subquery to count today's appointments for each doctor. This subquery will run once for every single doctor record in the database, leading to serious performance degradation as the doctor directory grows.

### Evidence
```js
(SELECT COUNT(*) FROM appointments WHERE doctor_id = d.id AND appointment_date = CURDATE()) AS doc_total_today
```

### Acceptance criteria
- [ ] The doctor list query must not use correlated subqueries inside the select clause.
- [ ] Verify that database lookups run in a single high-efficiency query using `LEFT JOIN` and `GROUP BY`.
- [ ] Run the doctor list query with 100 doctor records — verify that the database executes a single execution step instead of 100 separate lookups.

### Fix approach
Rewrite the SQL query in `admin.js` to join the appointments table with a group by statement, or use a Common Table Expression (CTE) to fetch the statistics.

### Estimated effort
2h

### References
Audit finding: DB-005 | File: backend/src/routes/admin.js:596-612
---
## Issue title
[PHASE-3] [DB-006] Add ON DELETE CASCADE rules to patient and doctor foreign keys

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: schema, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The `appointments` table has foreign keys for `patient_id` and `doctor_id` without any specified `ON DELETE` rules. This means deleting a user or doctor profile will trigger constraint errors, or leave orphaned appointment records.

### Evidence
```js
FOREIGN KEY (patient_id) REFERENCES patients(id),
FOREIGN KEY (doctor_id) REFERENCES doctors(id)
```

### Acceptance criteria
- [ ] Ensure the database schema has strict `ON DELETE` cascading rules.
- [ ] Deleting a patient record must automatically delete or anonymize all associated appointment records.
- [ ] Delete a test patient record from the database — verify that all corresponding appointments are automatically removed.

### Fix approach
Create a database migration script that drops the old foreign key constraints and recreates them with the `ON DELETE CASCADE` rule.

### Estimated effort
2h

### References
Audit finding: DB-006 | File: backend/database/schema.sql:63-64
---
## Issue title
[PHASE-3] [DB-007] Restrict doctor list query columns to prevent fetching large JSON/TEXT fields

## Labels (comma-separated, lowercase-kebab)
severity: medium, type: performance, phase: 3

## Milestone
Phase 3 — Technical Debt & Security Hardening

## Description
### Problem
The doctors directory list endpoint uses `SELECT *` to retrieve all columns, including massive availability configuration JSON blocks and description text fields. Transferring these large data blocks for every doctor degrades list loading performance and wastes bandwidth.

### Evidence
```js
const [rows] = await db.query('SELECT * FROM doctors');
```

### Acceptance criteria
- [ ] The doctors list endpoint must only return the specific fields needed for list displays (name, specialty, photo, reviews).
- [ ] Verify that heavy availability JSON blocks are only retrieved on detail fetch endpoints.
- [ ] Request GET `/api/doctors` — verify that the response objects do not contain large text blocks or complex availability arrays.

### Fix approach
Modify the SQL query in `doctors.js` to explicitly select the required list fields instead of using `SELECT *`.

### Estimated effort
1h

### References
Audit finding: DB-007 | File: backend/src/routes/doctors.js:88-96
---
## Issue title
[PHASE-4] [BUG-010] Replace loose comparison with strict type checking in queue verification

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The queue verification comparison uses the loose inequality operator (`!=`), which can pass unexpectedly if there are type differences between user IDs and queue row doctor IDs.

### Evidence
```js
if (req.user.id != queueRow.doctor_id) {
```

### Acceptance criteria
- [ ] The ID check must use the strict inequality operator (`!==`).
- [ ] Ensure both values are parsed to the same type (like integer) before the comparison.
- [ ] Execute the routing code with one string ID and one integer ID — verify that the comparison evaluates correctly and strictly.

### Fix approach
Modify `appointments.js` to convert both variables to integers using `parseInt()` and perform a strict `!==` comparison.

### Estimated effort
1h

### References
Audit finding: BUG-010 | File: backend/src/routes/appointments.js:370
---
## Issue title
[PHASE-4] [HC-006] Extract hardcoded localhost origins into environment CORS whitelist configuration

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The local developer origins `'http://localhost:5173'` and `'http://127.0.0.1:5173'` are hardcoded directly into the CORS configuration. These should be loaded from the environment configurations so developer origins are not hardcoded in the codebase.

### Evidence
```js
'http://localhost:5173', 'http://127.0.0.1:5173'
```

### Acceptance criteria
- [ ] Load all CORS allowed origins from the backend environment configuration.
- [ ] Ensure that local dev environments read these settings from local environment files.
- [ ] Start the server without these hardcoded values in code — verify local development builds can connect if the origins are configured in the environment file.

### Fix approach
Rewrite `server.js` to parse CORS origins from a comma-separated env variable, defaulting to standard dev origins in local development mode.

### Estimated effort
1h

### References
Audit finding: HC-006 | File: backend/src/server.js:105-106
---
## Issue title
[PHASE-4] [HC-010] Extract default predicted consultation duration to constants

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The default consultation fallback duration of `15` minutes is hardcoded inside the booking error handler. This creates scattered magic numbers that make it difficult to adjust default scheduling parameters globally.

### Evidence
```js
predictedDuration: 15
```

### Acceptance criteria
- [ ] Move the default consultation duration value to a centralized constant file.
- [ ] Verify that all fallback cases use this imported constant.
- [ ] Change the constant to 20 — verify that new bookings without duration predictions fall back to 20 minutes.

### Fix approach
Define the default duration in `backend/src/config/constants.js` and import it for fallback handling in `appointments.js`.

### Estimated effort
1h

### References
Audit finding: HC-010 | File: backend/src/routes/appointments.js:105
---
## Issue title
[PHASE-4] [HC-011] Move fallback doctor slot capacity to centralized configuration parameters

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The doctor query handler hardcodes a fallback slot capacity of `15` patients when the field `max_patients_per_slot` is missing. This should be managed by a central configuration file to make adjustments easier.

### Evidence
```js
max_patients_per_slot ?? 15
```

### Acceptance criteria
- [ ] Verify that doctor capacity fallbacks are imported from the main configurations.
- [ ] Remove hardcoded fallbacks from query endpoints.
- [ ] Update the central configuration setting — verify that doctor profiles without specified limits utilize the new capacity value.

### Fix approach
Import `DEFAULT_MAX_PATIENTS_PER_SLOT` from the config parameters and replace the double question mark fallback in `doctors.js`.

### Estimated effort
1h

### References
Audit finding: HC-011 | File: backend/src/routes/doctors.js:370
---
## Issue title
[PHASE-4] [HC-012] Extract hardcoded express rate limiter values to environment configuration

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The global rate limiter config (15 minutes window and 100 max requests) is hardcoded in the server configuration. This makes it difficult to adjust limits based on environment traffic needs.

### Evidence
```js
windowMs: 15 * 60 * 1000,
max: 100
```

### Acceptance criteria
- [ ] Load the rate limiter window size and request limits from environment configurations.
- [ ] Ensure the limiter falls back to safe defaults if settings are not defined.
- [ ] Set `RATE_LIMIT_MAX=10` in environment settings — verify that client requests get blocked after 10 calls.

### Fix approach
Update `backend/src/server.js` to parse `RATE_LIMIT_WINDOW_MINS` and `RATE_LIMIT_MAX` from environment variables.

### Estimated effort
1h

### References
Audit finding: HC-012 | File: backend/src/server.js:140-141
---
## Issue title
[PHASE-4] [HC-013] Remove hardcoded user IDs from schema seed data statements

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The database schema files use hardcoded ID keys (such as `1`, `2`, `3`) to seed developer testing records. This creates database conflict risks if the schema is run in environment contexts with existing user records.

### Evidence
```js
INSERT INTO users (id, email, password, ...) VALUES (1, 'doctor@system.com', ...)
```

### Acceptance criteria
- [ ] Verify that seed data inserts let the database automatically increment keys instead of forcing exact IDs.
- [ ] Ensure references to seeded IDs are handled dynamically.
- [ ] Execute the schema file twice — verify it does not trigger duplicate key errors on seed statement executions.

### Fix approach
Modify seed data SQL commands in `schema.sql` to omit the explicit `id` column, allowing the database to assign IDs automatically.

### Estimated effort
1h

### References
Audit finding: HC-013 | File: backend/database/schema.sql:90-94
---
## Issue title
[PHASE-4] [DEAD-004] Clean up placeholder comments and vestigial files from patient routing modules

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The patient route files contain placeholder comments like `// ... (existing routes)` that serve no structural purpose, clutter the code, and indicate a lack of final code cleanup.

### Evidence
```js
// ... (existing routes)
```

### Acceptance criteria
- [ ] Ensure all placeholder comments are removed from patient route files.
- [ ] The functional endpoint routing must remain unchanged.
- [ ] Run the application code linter — verify there are no warnings about formatting or unused comments.

### Fix approach
Open `backend/src/routes/patients.js` and delete the redundant comment blocks.

### Estimated effort
1h

### References
Audit finding: DEAD-004 | File: backend/src/routes/patients.js:166
---
## Issue title
[PHASE-4] [DEAD-005] Remove orphaned utility and testing scripts from the backend root directory

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The backend root folder contains multiple temporary scripts (such as `audit_db.js`, `check_schema.js`, `cleanup_non_demos.js`) that were used during development. Leaving these files in the root increases clutter and risks having team members run outdated scripts.

### Evidence
```js
Multiple backend root files: audit_db.js, check_schema.js, cleanup_non_demos.js, test_endpoints.js, test_eta.js, test_tidb.js
```

### Acceptance criteria
- [ ] Remove all orphaned scripts from the backend root directory.
- [ ] If any scripts are still needed, move them to a dedicated `/scripts` subdirectory.
- [ ] List the backend root directory — verify that only standard project setup files remain.

### Fix approach
Delete the development scripts from the root directory or move them to `backend/scripts/`.

### Estimated effort
1h

### References
Audit finding: DEAD-005 | File: backend/:root
---
## Issue title
[PHASE-4] [DEAD-006] Remove deprecated commented ALTER statements from database schema file

## Labels (comma-separated, lowercase-kebab)
severity: low, type: cleanup, phase: 4

## Milestone
Phase 4 — Code Cleanup & Optimization

## Description
### Problem
The database schema files contain commented-out historical `ALTER TABLE` statements at the bottom. Since these modifications are already part of the core table definitions, these comments serve no purpose and make the schema harder to read.

### Evidence
```js
-- ALTER TABLE appointments ADD COLUMN symptoms TEXT AFTER time_slot;
-- ALTER TABLE appointments ADD COLUMN diagnosis VARCHAR(255) AFTER status;
```

### Acceptance criteria
- [ ] Remove all deprecated ALTER statement comments from the database schema files.
- [ ] Ensure the active table structure remains identical.
- [ ] Import the clean schema file into a new test database — verify the tables are created with identical structures.

### Fix approach
Open `backend/database/schema.sql` and delete the commented-out ALTER commands from the bottom of the file.

### Estimated effort
1h

### References
Audit finding: DEAD-006 | File: backend/database/schema.sql:114-127
---

## 📊 Audit Finding Summary Table

| Phase | Issue ID | Title | Labels | Effort |
|-------|----------|-------|--------|--------|
| Phase 1 | BUG-001 | Prevent double-booking with DB transaction and FOR UPDATE lock | severity: critical, type: bug, phase: 1, blocking-deployment | 4h |
| Phase 1 | BUG-002 | Restrict appointment bookings to future dates | severity: critical, type: bug, phase: 1, blocking-deployment | 1h |
| Phase 1 | HC-001 | Remove hardcoded JWT secret from environment configuration | severity: critical, type: security, phase: 1, blocking-deployment | 1h |
| Phase 1 | HC-002 | Remove hardcoded database password from environment template | severity: critical, type: security, phase: 1, blocking-deployment | 1h |
| Phase 1 | SEC-001 | Remove and rotate exposed credentials in backend environment configuration | severity: critical, type: security, phase: 1, blocking-deployment | 2h |
| Phase 1 | SEC-003 | Implement Stripe webhook signature verification | severity: critical, type: security, phase: 1, blocking-deployment | 3h |
| Phase 1 | SEC-005 | Prevent self-registration as ADMIN or DOCTOR | severity: critical, type: security, phase: 1, blocking-deployment | 1h |
| Phase 1 | SEC-008 | Restrict CORS whitelist to exact origins | severity: critical, type: security, phase: 1, blocking-deployment | 2h |
| Phase 1 | DB-001 | Add unique key constraint to prevent duplicate bookings | severity: critical, type: schema, phase: 1, blocking-deployment | 2h |
| Phase 1 | DB-004 | Wrap appointment booking and queue insertion in a database transaction | severity: critical, type: performance, phase: 1, blocking-deployment | 3h |
| Phase 2 | BUG-003 | Prevent cancellation of historical appointments | severity: high, type: bug, phase: 2 | 2h |
| Phase 2 | BUG-006 | Validate patient ID ownership and authorization during booking | severity: high, type: bug, phase: 2 | 3h |
| Phase 2 | BUG-008 | Align backend appointment status inserts with uppercase schema ENUM | severity: high, type: bug, phase: 2 | 1h |
| Phase 2 | HC-003 | Throw runtime exception when fallback Stripe key is used | severity: high, type: security, phase: 2 | 1h |
| Phase 2 | HC-004 | Replace hardcoded doctor consultation fee with database field | severity: high, type: bug, phase: 2 | 3h |
| Phase 2 | HC-007 | Remove hardcoded Hugging Face Space URL fallback from frontend configuration | severity: high, type: cleanup, phase: 2 | 1h |
| Phase 2 | SEC-002 | Disable authentication token retrieval from query parameters | severity: high, type: security, phase: 2 | 1h |
| Phase 2 | SEC-004 | Add ownership validation to payment intent creation | severity: high, type: security, phase: 2 | 2h |
| Phase 2 | SEC-006 | Secure forgot password endpoint against email enumeration and weak OTP generation | severity: high, type: security, phase: 2 | 2h |
| Phase 2 | SEC-007 | Implement rate limiting and lockout mechanism for OTP verification | severity: high, type: security, phase: 2 | 3h |
| Phase 2 | SEC-009 | Verify active appointment relationship before allowing messages | severity: high, type: security, phase: 2 | 2h |
| Phase 2 | SEC-012 | Enforce authentication and rate limiting on QR check-in scan route | severity: high, type: security, phase: 2 | 2h |
| Phase 2 | DB-002 | Add database indexes for foreign keys and query filters | severity: high, type: schema, phase: 2 | 2h |
| Phase 2 | DB-003 | Implement pagination limits on admin appointments fetch endpoint | severity: high, type: performance, phase: 2 | 2h |
| Phase 2 | DEAD-007 | Secure the unauthenticated QR scan route against token scanning abuse | severity: high, type: cleanup, phase: 2 | 2h |
| Phase 3 | BUG-004 | Standardize status comparison checks and enforce uppercase in DB | severity: medium, type: bug, phase: 3 | 1h |
| Phase 3 | BUG-005 | Fix case sensitivity discrepancy in admin statistics SQL metrics | severity: medium, type: bug, phase: 3 | 2h |
| Phase 3 | BUG-007 | Add request payload validation to virtual check-in status endpoint | severity: medium, type: bug, phase: 3 | 1h |
| Phase 3 | BUG-009 | Disable verbose request logger in production environment | severity: medium, type: performance, phase: 3 | 1h |
| Phase 3 | HC-005 | Extract Swagger documentation server URL into environment variables | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | HC-008 | Move hardcoded bcrypt rounds value to centralized authentication config | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | HC-009 | Resolve database port setting mismatch in database configuration module | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | HC-014 | Extract hardcoded seed passwords to environment variables | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | HC-015 | Extract hardcoded email fallback URL to configuration variables | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | DEAD-001 | Rename shadowed status variable within the waiting list processing loop | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | DEAD-002 | Secure production logging by removing raw request logging middleware | severity: medium, type: cleanup, phase: 3 | 1h |
| Phase 3 | DEAD-003 | Restrict database connection pool monitoring logs to development mode | severity: medium, type: performance, phase: 3 | 1h |
| Phase 3 | SEC-010 | Sanitize global error handler responses to prevent implementation leakage | severity: medium, type: security, phase: 3 | 1h |
| Phase 3 | SEC-011 | Remove raw database error details from appointment booking endpoint response | severity: medium, type: security, phase: 3 | 1h |
| Phase 3 | SEC-013 | Restrict Server-Sent Events CORS header to allowed origins only | severity: medium, type: security, phase: 3 | 1h |
| Phase 3 | DB-005 | Replace correlated subquery in doctor list with JOIN statement to avoid N+1 query performance hits | severity: medium, type: performance, phase: 3 | 2h |
| Phase 3 | DB-006 | Add ON DELETE CASCADE rules to patient and doctor foreign keys | severity: medium, type: schema, phase: 3 | 2h |
| Phase 3 | DB-007 | Restrict doctor list query columns to prevent fetching large JSON/TEXT fields | severity: medium, type: performance, phase: 3 | 1h |
| Phase 4 | BUG-010 | Replace loose comparison with strict type checking in queue verification | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | HC-006 | Extract hardcoded localhost origins into environment CORS whitelist configuration | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | HC-010 | Extract default predicted consultation duration to constants | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | HC-011 | Move fallback doctor slot capacity to centralized configuration parameters | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | HC-012 | Extract hardcoded express rate limiter values to environment configuration | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | HC-013 | Remove hardcoded user IDs from schema seed data statements | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | DEAD-004 | Clean up placeholder comments and vestigial files from patient routing modules | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | DEAD-005 | Remove orphaned utility and testing scripts from the backend root directory | severity: low, type: cleanup, phase: 4 | 1h |
| Phase 4 | DEAD-006 | Remove deprecated commented ALTER statements from database schema file | severity: low, type: cleanup, phase: 4 | 1h |
