# 📋 HealthSync Premium - Project Overview

## 🎯 Mission Statement

**Eliminate patient wait times in hospitals through intelligent appointment scheduling, predictive analytics, and real-time queue management.**

> "A hospital system where patients see doctors on time, doctors have optimal schedules, and administrators operate systems at peak efficiency."

---

## 📊 Project Statistics

### Codebase Snapshot
```
├─ Files:           105 total
├─ Frontend Code:   ~6,000 lines (React + Vite)
├─ Backend Code:    ~9,000 lines (Node.js + Express)
├─ Routes:          17 API endpoint files
├─ Services:        26 business logic modules
├─ Pages:           28 React components
├─ Test Coverage:   0% (⚠️ Critical issue - Target: 80%+)
└─ API Endpoints:   80+ endpoints across all routes
```

### Performance Metrics
```
API Response Time:     <200ms (target)
Page Load Time:        <2 seconds
Queue Update (SSE):    <500ms real-time
Database Connection:   Pool size: 10
Current Deployment:    Local/Docker
Users Supported:       100-1000 concurrent (estimated)
```

### Team Structure
```
Maintainers:        1 (Archit Mittal)
Active Contributors: 0 (Growing! 🎉)
Issues Created:     22 (organized by week)
Target Sprint:      2-3 weeks per phase
```

---

## 🏗️ Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│              📱 PRESENTATION LAYER                  │
│         (React + Vite Frontend)                     │
│   - Patient Portal                                  │
│   - Doctor Portal                                   │
│   - Admin Dashboard                                 │
│   - Analytics Hub                                   │
└────────────────────┬────────────────────────────────┘
                     │ JSON REST + SSE
                     ▼
┌─────────────────────────────────────────────────────┐
│              🔌 APPLICATION LAYER                   │
│         (Express.js API Server)                     │
│   - API Routes (17 files)                           │
│   - Authentication & Authorization                  │
│   - Business Logic Services (26 services)           │
│   - Real-time SSE Manager                           │
│   - Middleware Stack                                │
└────────────────────┬────────────────────────────────┘
                     │ SQL Queries
                     ▼
┌─────────────────────────────────────────────────────┐
│              💾 DATA LAYER                          │
│         (TiDB/MySQL Database)                       │
│   - Users (Patients, Doctors, Admins)               │
│   - Appointments                                    │
│   - Queue Management                                │
│   - Analytics Data                                  │
│   - System Logs                                     │
└─────────────────────────────────────────────────────┘
```

### Key Services (26 Total)

| Service | Purpose | Status |
|---------|---------|--------|
| `appointmentService` | Core booking/cancellation logic | ✅ Live |
| `queueService` | Priority queue management | ✅ Live |
| `predictionService` | ML-based ETAs | ✅ Live |
| `smartArrivalService` | Intelligent arrival calculation | ✅ Live |
| `notificationService` | Multi-channel alerts (Email/SMS) | ✅ Live (⚠️ Needs decomposition) |
| `authService` | JWT + OTP authentication | ✅ Live |
| `userService` | User CRUD operations | ✅ Live |
| `doctorService` | Doctor profile & schedule | ✅ Live |
| `analyticsService` | Dashboard metrics | ✅ Live (⚠️ Limited) |
| `vitalsService` | Patient health data | 🔄 Partial (Needs completion) |
| And 16 more... | Various utilities | 🔄 Mixed |

---

## 📁 Directory Structure Deep Dive

### Frontend (`/frontend`)

```
frontend/src/
├── pages/                      # 28 React page components
│   ├── PatientPortal.jsx       # Patient booking interface
│   ├── DoctorDashboard.jsx     # Doctor queue management
│   ├── AdminPanel.jsx          # Admin CRUD & settings
│   ├── QueueView.jsx           # Real-time queue display
│   ├── AnalyticsPage.jsx       # KPI dashboard
│   ├── DoctorAnalytics.jsx     # ⚠️ Orphaned (not routed)
│   └── [24 more pages]         # Various portals & features
│
├── components/                 # Reusable UI components
│   ├── QueueCard.jsx           # Individual queue item
│   ├── AppointmentForm.jsx     # Booking form
│   ├── LoadingSpinner.jsx      # Loading state
│   └── [30+ more components]   # Layout, forms, widgets
│
├── contexts/                   # React Context API
│   ├── AuthContext.jsx         # 🔴 GOD NODE (25 edges)
│   │                           # Mixes auth + user data fetching
│   │                           # Causes unnecessary re-renders
│   └── ThemeContext.jsx        # Dark/light mode
│
├── hooks/                      # Custom React hooks
│   ├── useAuth.jsx             # Auth state (should be split)
│   ├── useQueue.jsx            # Queue updates
│   ├── useAppointments.jsx     # Appointment management
│   └── [5+ more hooks]         # Various utilities
│
├── services/                   # API communication
│   ├── appointmentAPI.js       # Appointment endpoints
│   ├── queueAPI.js             # Queue endpoints
│   ├── authAPI.js              # Auth endpoints
│   └── [10+ more services]     # Other API calls
│
├── utils/                      # Helper functions
│   ├── dateFormatter.js        # Date utilities
│   ├── validators.js           # Input validation
│   ├── constants.js            # App constants
│   └── [5+ more utilities]     # Various helpers
│
├── App.jsx                     # Main app component
└── main.jsx                    # Entry point
```

### Backend (`/backend`)

```
backend/src/
├── routes/                     # 17 API route files
│   ├── auth.js                 # Authentication endpoints
│   ├── appointments.js         # Appointment CRUD + booking logic
│   ├── queue.js                # Queue management endpoints
│   ├── doctors.js              # Doctor profile & availability
│   ├── admin.js                # ⚠️ Has N+1 query problem
│   ├── users.js                # User management
│   ├── analytics.js            # Dashboard metrics
│   ├── notifications.js        # Alert management
│   ├── payments.js             # Stripe integration (partial)
│   ├── vitals.js               # Patient vitals (stub)
│   └── [7+ more route files]   # Other features
│
├── services/                   # 26 Business logic files
│   ├── appointmentService.js   # Core booking algorithm
│   ├── queueService.js         # Queue state machine
│   ├── predictionService.js    # ML predictions (consultation time)
│   ├── smartArrivalService.js  # Smart arrival calculation
│   ├── notificationService.js  # ⚠️ MONOLITHIC (14KB, 18 functions)
│   │                           # Handles preferences, templates, transport, quiet hours
│   │                           # NEEDS DECOMPOSITION into:
│   │                           #  - preferenceService.js
│   │                           #  - templateService.js
│   │                           #  - transportService.js
│   ├── authService.js          # JWT validation
│   ├── userService.js          # User operations
│   ├── doctorService.js        # Doctor operations
│   ├── analyticsService.js     # Metrics calculation
│   └── [16+ more services]     # Other business logic
│
├── middleware/                 # Express middleware
│   ├── authenticate.js         # 🔴 CRITICAL: Hardcoded JWT secret fallback
│   │                           # "JWT_SECRET || 'dev_secret_change_in_production'"
│   │                           # If env var missing, tokens become predictable!
│   └── [1 file only]           # ⚠️ MISSING: rate limiting, validation, logging
│
├── config/                     # Configuration
│   ├── database.js             # MySQL connection pool
│   ├── constants.js            # App constants
│   └── logger.js               # Logging setup
│
├── migrations/                 # Database schema
│   ├── 001_users.sql           # User table
│   ├── 002_appointments.sql    # Appointment table
│   ├── 003_queue_state.sql     # Queue tracking
│   └── [14+ more migrations]   # Other tables
│
├── server.js                   # Entry point
└── __tests__/                  # Test files
    ├── auth.test.js            # 3 trivial tests only
    └── [0 other test files]    # ⚠️ CRITICAL: No other tests
```

### Database Migrations (17 SQL files)

```sql
-- Core Tables
001_users.sql               -- Patients, Doctors, Admins
002_appointments.sql        -- Appointment records
003_queue_state.sql         -- Real-time queue status
004_doctors_schedule.sql    -- Doctor availability

-- Features
005_notifications.sql       -- Notification preferences
006_vitals.sql              -- Patient health metrics
007_prescriptions.sql       -- Medication records
008_payments.sql            -- Transaction tracking

-- Analytics
009_analytics_events.sql    -- User action tracking
010_performance_logs.sql    -- System metrics

-- [7+ more tables]
```

---

## 🔄 Data Flow Examples

### Use Case 1: Book an Appointment

```
1. Patient clicks "Book Appointment"
   └─ PatientPortal.jsx → BookingForm component

2. Form submitted with:
   └─ { doctorId, date, time, notes }

3. Frontend validates input
   └─ appointmentAPI.post('/appointments/book', data)

4. Backend receives request
   └─ POST /api/appointments/book

5. appointmentService processes:
   a. Check doctor availability ✅
   b. Check for conflicts ✅
   c. Calculate smart arrival time 🤖
   d. Insert into database 💾
   e. Add to queue ⏳
   f. Send confirmation notification 📧

6. Frontend receives response
   └─ SSE updates real-time queue position

7. Patient sees:
   └─ Confirmation page + Queue position + Smart arrival time
```

### Use Case 2: Real-Time Queue Update

```
Doctor calls next patient
    ↓
queueService.updateStatus(appointmentId, 'IN_PROGRESS')
    ↓
Database updated: queue_state table
    ↓
SSE broadcasts to all connected clients
    ↓
Doctor's dashboard: Shows NEXT patient
    ↓
Patient's app: Position updated (e.g., 5 → 4 → 3...)
    ↓
Patient receives notification: "It's almost your turn"
```

---

## 🔐 Security Architecture

### Authentication Flow

```
Patient enters credentials
    ↓
POST /auth/login with { email, password }
    ↓
authService validates against database
    ↓
JWT generated with payload:
{
  userId: '123',
  role: 'patient',
  exp: Date.now() + 24h
}
    ↓
Token sent to frontend (httpOnly cookie)
    ↓
All subsequent requests include token
    ↓
authenticate.js middleware validates
    ↓
If valid: Allow request ✅
If invalid: Return 401 ❌
```

### ⚠️ Security Issues Found

| Issue | Severity | Details | Fix |
|-------|----------|---------|-----|
| JWT Secret Hardcoding | 🔴 Critical | Fallback to `'dev_secret_change_in_production'` | Issue #130 |
| No Rate Limiting | 🟠 High | Brute force attacks possible | Issue #127 |
| No Input Validation | 🟠 High | SQL injection, XSS possible | Issue #128 |
| Wide CORS | 🟠 High | `cors()` with no origin whitelist | Issue #129 |
| No Global Error Handler | 🟠 High | Stack traces leaked to users | Issue #131 |

---

## 🧪 Testing Strategy

### Current State: 🚨 **0% Coverage**

**Critical Issues:**
- Only 1 test file: `auth.test.js` with 3 trivial tests
- No tests for core booking/cancellation flows
- No tests for queue state machine
- Frontend has zero component tests
- No integration tests

### Target: 80%+ Coverage by Week 2

**Phase 1 - Critical Path Tests (Issue #132)**
```
✅ Appointment booking flow
✅ Appointment cancellation
✅ Appointment rescheduling
✅ Error handling
```

**Phase 2 - Queue Management Tests (Issue #133)**
```
✅ State transitions (WAITING → IN_PROGRESS → COMPLETED)
✅ Priority calculation
✅ Walk-in handling
✅ Late arrivals
```

**Phase 3 - Auth Flow Tests (Issue #134)**
```
✅ Registration
✅ Login
✅ JWT validation
✅ OTP password reset
✅ Session timeout
```

**Phase 4 - Component Tests (Issue #135)**
```
✅ React component rendering
✅ User interactions
✅ Error states
✅ Loading states
```

---

## 📈 Performance Analysis

### Current Bottlenecks

| Issue | Impact | Status | Solution |
|-------|--------|--------|----------|
| N+1 Queries (Admin) | 30+ sec load time | 🔴 Open | Issue #138 |
| useAuth() God Node | Tight coupling | 🔴 Open | Issue #140 |
| No caching strategy | Repeated queries | 🔴 Open | Issue #141 |
| Monolithic services | Memory overhead | 🔴 Open | Issue #137 |
| No database indexes | Slow queries | 🔴 Open | Issue #142 |

### Performance Goals

```
Current State          →    Target State
─────────────────────────────────────────
Admin users: 35s       →    Admin users: 200ms
API avg: 500ms         →    API avg: <200ms
Page load: 5s          →    Page load: <2s
Queue update: 2s       →    Queue update: <500ms
```

---

## 🗺️ 22-Week Roadmap

### Week 1: 🔵 Security Foundation (5 Issues)
- Issue #127: Rate Limiting
- Issue #128: Input Validation
- Issue #129: CORS Hardening
- Issue #130: Fix JWT Secret
- Issue #131: Error Handler

**Goal:** Secure all endpoints against common attacks

### Week 2: 🟣 Test Coverage (4 Issues)
- Issue #132: Appointment Tests
- Issue #133: Queue Tests
- Issue #134: Auth Tests
- Issue #135: Component Tests

**Goal:** Achieve 80%+ code coverage

### Week 3: 🌸 Architecture Refactoring (7 Issues)
- Issue #136: Fix DoctorAnalytics Route
- Issue #137: Decompose NotificationService
- Issue #138: Fix N+1 Queries
- Issue #139: Swagger Documentation
- Issue #140: Decouple useAuth()
- Issue #141: DB Pool Monitoring
- Issue #142: Database Seeding

**Goal:** Clean up technical debt

### Week 4+: 🔷 Feature Completion (6 Issues)
- Issue #143: Cron Scheduler
- Issue #144: SSE Reconnection
- Issue #145: Medical Record Export
- Issue #146: Vitals/Prescriptions
- Issue #147: Analytics Dashboard
- Issue #148: Verify Known Issues

**Goal:** Complete remaining features

---

## 🎯 Key Metrics to Track

### Code Quality
```
Test Coverage:        0% → 80%+
Linting Errors:       0 (maintain)
Code Duplication:     Monitor
Cyclomatic Complexity: Avg per function
```

### Performance
```
API Response Time:    <200ms
Page Load Time:       <2s
Database Query Time:  <100ms
Bundle Size:          Monitor growth
```

### User Engagement
```
Appointment Booking:  Track conversion
Queue Wait Time:      Reduce by 40%
No-Show Rate:         Track reduction
User Satisfaction:    Survey after MVP
```

### Team Velocity
```
Issues Closed/Week:   Track consistency
PR Review Time:       Target: <24h
Deploy Frequency:     Weekly
Incident Response:    <1h
```

---

## 💡 Key Insights from Codebase Analysis

### Strengths ✅
- **Well-organized services** (26 focused modules)
- **Clean API design** (RESTful conventions)
- **Real-time capabilities** (SSE implementation)
- **Multi-role support** (Patient, Doctor, Admin)
- **Scalable database** (TiDB with connection pooling)

### Weaknesses ❌
- **Zero test coverage** (healthcare system needs 80%+)
- **God node architecture** (useAuth with 25 dependencies)
- **Monolithic services** (notificationService: 14KB)
- **Performance issues** (N+1 queries, no caching)
- **Security gaps** (JWT hardcoding, no rate limiting)

### Quick Wins (Low Effort, High Value)
```
1. Fix JWT secret hardcoding     (1h)    → CRITICAL security fix
2. Fix DoctorAnalytics typo      (30min) → Complete orphaned feature
3. Add rate limiting            (2-4h)   → Protect auth endpoints
4. Add basic test suite         (8-12h)  → Foundation for coverage
5. Decompose notificationService (4-6h)  → Reduce complexity
```

---

## 🤝 Contributing Quick Links

### For First-Time Contributors
1. Read [README.md](README.md) - Project overview
2. Read [CONTRIBUTING.md](CONTRIBUTING.md) - Guidelines
3. Look for issues labeled `good first issue`
4. Start with Issue #136 (DoctorAnalytics - 1h) or Issue #130 (JWT - 1h)

### For Experienced Developers
1. Review [GITHUB_ISSUES_SUMMARY.md](GITHUB_ISSUES_SUMMARY.md)
2. Pick from Week 1-2 issues (security + testing priority)
3. Follow [CONTRIBUTING.md](CONTRIBUTING.md) workflow
4. Set up development environment (5 min)
5. Create feature branch and start coding

### For Test Infrastructure
1. Review current test setup in `__tests__/` folders
2. Start with Issue #132 (Appointment Tests)
3. Set up Jest + Supertest for backend
4. Set up React Testing Library for frontend
5. Aim for 80%+ coverage by Issue #135

---

## 📞 Support & Questions

**Questions about:**
- 🏗️ Architecture? → Read this document
- 🐛 Specific bugs? → Check relevant issue
- 💻 Setup help? → See [README.md](README.md)
- 📝 Contributing? → See [CONTRIBUTING.md](CONTRIBUTING.md)
- 🆘 Something else? → Open a GitHub discussion

---

**Last Updated:** 28 April 2026  
**Status:** Active Development  
**Next Review:** After Week 1 completion  
**Maintained By:** Archit Mittal
