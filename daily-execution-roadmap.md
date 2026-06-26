# Daily Execution Roadmap: Patient Appointment Scheduling System

This roadmap breaks down the **Market Readiness Plan** into daily shippable increments. Each day has a clear scope, files involved, and a verification step to ensure progress is concrete.

---

## Phase 1: Security & Compliance Hardening (Days 1–5)

### 🗓️ Day 1: Secret Management & Setup Validation
* **Scope:** Eliminate hardcoded credentials and ensure environment variables are validated at startup.
* **Tasks:**
  * [ ] Create `.env.example` with clear placeholders.
  * [ ] Add a runtime startup validator in `backend/src/config/db.js` or `backend/src/app.js` to ensure all required secrets (`JWT_SECRET`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`) are present.
  * [ ] Add `.env` to `.gitignore`.
  * [ ] Verify that the application fails to start with a clean error message if any secret is missing.
* **Verification:** Run `npm start` without `.env` and verify it prints validation errors.

### 🗓️ Day 2: Authentication Hardening & Rate Limiting
* **Scope:** Strengthen JWT generation and protect authentication endpoints from brute-force attacks.
* **Tasks:**
  * [ ] Add `express-rate-limit` middleware to `/api/auth/login` and `/api/auth/register`.
  * [ ] Implement token signature verification with high entropy in `backend/src/config/auth.js`.
  * [ ] Remove authentication token query parameter support from `backend/src/middleware/authenticate.js` (except for SSE routes).
* **Verification:** Try logging in with a tool like Postman 100 times in under a minute to trigger rate-limiting (HTTP 429).

### 🗓️ Day 3: Payment Webhook Verification & Intent Ownership
* **Scope:** Protect payment completion logic from spoofing and validation bypasses.
* **Tasks:**
  * [ ] Add Stripe webhook signature verification using `stripe.webhooks.constructEvent` inside `backend/src/routes/payments.js`.
  * [ ] Validate that the current authenticated user owns the appointment before processing any payment intent.
* **Verification:** Trigger the webhook endpoint with mock headers and confirm it returns HTTP 400 (signature verification failed).

### 🗓️ Day 4: Consent Management (DPDP Act 2023)
* **Scope:** Establish compliant logging and controls for sensitive personal health data.
* **Tasks:**
  * [ ] Create `consent_logs` table in `backend/src/database/schema.sql`.
  * [ ] Implement a reusable middleware `backend/src/middleware/verifyConsent.js` that checks if a patient has consented to share their vitals/records with a doctor.
  * [ ] Expose an API endpoint to log/revoke patient consent.
* **Verification:** Attempt to access patient vitals via doctor credentials without active consent and verify it returns HTTP 403.

### 🗓️ Day 5: ABHA ID Integration Foundations
* **Scope:** Build backend fields and service stubs to support India's national health IDs.
* **Tasks:**
  * [ ] Create database migration to add `abha_id` and `abha_number` columns to the `patients` table.
  * [ ] Write a mock validation service `backend/src/services/abhaService.js` to simulate verification of ABHA IDs with the national registry.
* **Verification:** Call the mock verification endpoint with a valid-format ABHA ID and verify successful registration.

---

## Phase 2: Performance & Architecture (Days 6–8)

### 🗓️ Day 6: Database Optimization & Indexing
* **Scope:** Eliminate slow queries by adding required indexes.
* **Tasks:**
  * [ ] Run migration adding indexes for foreign keys: `doctor_id`, `patient_id`, `appointment_date`, and `status`.
  * [ ] Audit database execution plans using `EXPLAIN` on core query patterns.
* **Verification:** Run the seed script and verify index usage for appointment fetches using `EXPLAIN`.

### 🗓️ Day 7: Pagination, N+1 Fixes, & Redis Caching
* **Scope:** Prevent high load on OPD queue fetches and paginated dashboard listings.
* **Tasks:**
  * [ ] Implement cursor-based pagination for patient list and audit log endpoints (limit 50).
  * [ ] Fix N+1 queries inside doctor schedule/appointment retrievals.
  * [ ] Implement Redis-based caching in `backend/src/services/queueService.js` for real-time OPD waiting list status.
* **Verification:** Measure queue fetch response times; cached hits should execute in under 10ms.

### 🗓️ Day 8: Service Decomposition & God-Node Refactoring
* **Scope:** Refactor frontend and backend monolithic files to follow SOLID principles.
* **Tasks:**
  * [ ] Decompose `notificationService.js` into `preferenceService.js`, `templateService.js`, and `transportService.js`.
  * [ ] Refactor React frontend's `useAuth()` context to separate user state management from basic session verification.
* **Verification:** Ensure frontend and backend compile cleanly with no runtime errors.

---

## Phase 3: Test Coverage (Days 9–11)

### 🗓️ Day 9: Core Backend Test Suite
* **Scope:** Write robust unit tests for booking and queue state changes.
* **Tasks:**
  * [ ] Write Jest tests for booking transactions, cancellations, and doctor queue prioritizations.
  * [ ] Setup backend integration tests using a local test database.
* **Verification:** Run `npm run test:backend` and ensure all tests pass.

### 🗓️ Day 10: Frontend Component Testing
* **Scope:** Ensure user interaction logic is safe from UI regressions.
* **Tasks:**
  * [ ] Build React component unit tests for login/auth flow, appointment booking modal, and doctor dashboard.
* **Verification:** Run `npm run test:frontend` and ensure all tests pass.

### 🗓️ Day 11: Concurrency and Load Testing Prep
* **Scope:** Build testing profiles to simulate peak OPD rushes.
* **Tasks:**
  * [ ] Write K6 or Artillery performance testing scripts to simulate 1,000+ concurrent requests on appointment and queue routes.
* **Verification:** Execute a mini dry-run load test with 50 concurrent users.

---

## Phase 4: Test Data & Interoperability (Days 12–13)

### 🗓️ Day 12: Automated Seed Scripts & HL7 FHIR Support
* **Scope:** Provide robust test data and export medical records into standardized formats.
* **Tasks:**
  * [ ] Complete `backend/src/scripts/seed.js` generating 1 Admin, 2 Doctors, 1 Patient, and a series of past/future appointments.
  * [ ] Implement FHIR mappings inside `backend/src/services/fhirService.js` to serialize prescriptions and vitals payloads.
* **Verification:** Run `npm run seed` and query the `/api/prescriptions/:id/fhir` endpoint to verify compliant HL7 FHIR JSON layout.

### 🗓️ Day 13: WhatsApp Notification Integration
* **Scope:** Connect patient notifications to the most utilized communication channel in India.
* **Tasks:**
  * [ ] Create a WhatsApp notification service wrapper `backend/src/services/whatsappService.js` supporting provider fallbacks.
  * [ ] Hook queue delays and appointment confirmations to trigger WhatsApp updates.
* **Verification:** Trigger an appointment booking and inspect logs to confirm a WhatsApp API call was dispatched.

---

## Phase 5: Deployment & Validation (Day 14)

### 🗓️ Day 14: Health Monitoring, Final Audit, & Launch
* **Scope:** Prepare deployment checklists, document APIs, and run stress tests.
* **Tasks:**
  * [ ] Add `/healthz` endpoints exposing health status for DB and Redis connections.
  * [ ] Document all API endpoints using Swagger OpenAPI standards.
  * [ ] Run the 1,000+ user load test on a staging-like environment and tune DB connection pool sizes.
* **Verification:** Ensure the system sustains 1,000+ concurrent users with zero database timeouts.
