# Patient Appointment Scheduling System

A DSA-based healthcare appointment scheduling system that minimizes patient wait times using Greedy Algorithms, Dynamic Programming, Priority Queues, and Predictive Analytics.

## 📋 Problem Statement

Manual patient appointment scheduling in healthcare facilities leads to long wait times, scheduling conflicts, inefficient doctor utilization, and poor emergency handling. This results in patient dissatisfaction, wasted resources, and potential health risks for urgent cases.

### Research-Backed Problems

#### A. Patient-Facing Problems (Primary Stakeholder)

| Problem | Source/Evidence | Impact | Our Solution |
|---------|-----------------|--------|---------------|
| Long waiting times | WHO: "Workflow disruptions affect patient care delivery" | HIGH | Wait time prediction (DP) |
| No-show uncertainty | Studies show 15-30% no-show rates in OPDs | HIGH | Predictive rescheduling + SMS reminders |
| Manual queue guessing | Receptionists estimate times incorrectly | MEDIUM | Real-time wait estimation algorithm |
| Emergency delays | Non-priority based queues delay urgent cases | CRITICAL | Priority Queue with emergency override |
| Multiple visits for booking | Lack of real-time slot visibility | MEDIUM | Online slot availability (Binary Search) |
| Communication gaps | WHO: "Communication breakdown among healthcare workers and patients" | HIGH | Automated SMS/Email notifications |
| Patient misidentification | WHO reports 12.3% of sentinel events | MEDIUM | Unique Patient ID (UID) verification |

#### B. Receptionist/Admin Problems (Secondary Stakeholder)

| Problem | Evidence | Our Solution |
|---------|----------|---------------|
| Overbooking conflicts | Manual systems can't detect overlaps | Interval conflict detection (Greedy) |
| No-show management | Empty slots waste doctor time | Predictive no-show model + waitlist |
| Emergency insertion chaos | Disrupts entire day's schedule | Priority Queue with dynamic reheapify |
| Uneven doctor distribution | Some doctors overloaded, others idle | Load balancing algorithm |
| 25% time on admin tasks | NCBI: "Average nurse spends 25% on administrative activities" | Automation reduces manual work |
| Paper-based errors | EHR studies show paper systems increase errors | Digital scheduling system |

#### C. Doctor-Facing Problems

| Problem | Impact | Our Solution |
|---------|--------|---------------|
| Rushed consultations | Poor patient outcomes | Buffer time allocation (Greedy) |
| Idle time between patients | Lost productivity | Optimal slot packing (DP) |
| No visibility into schedule | Can't prepare for complex cases | Real-time dashboard |
| Variable case complexity | 10-min vs 45-min appointments mixed poorly | Weighted job scheduling |

#### D. Indian Healthcare Context (IBEF & WHO Reports)

| Challenge | Statistic | Relevance |
|-----------|-----------|------------|
| Doctor shortage | 1 doctor per 1,445 people (WHO recommends 1:1000) | High patient load per doctor |
| Bed shortage | Need 3M additional beds by 2025 | Queue management critical |
| Rural-urban divide | 70% population rural, 60% doctors urban | Telemedicine scheduling needed |
| OPD overcrowding | Government hospitals see 1000+ patients/day | Queue optimization essential |

## 🎯 Solution

Algorithmic approach to optimize scheduling:

### Core Algorithms

| Algorithm | DSA Concept | Problem Solved |
|-----------|-------------|----------------|
| **Greedy Algorithm** | Activity Selection | Optimal slot allocation, buffer time |
| **Dynamic Programming** | Interval Partitioning | Minimize total wait time, optimal doctor assignment |
| **Priority Queue (Heap)** | Min-Heap | Emergency handling, dynamic priority queue |
| **Hash Maps** | Hash Table | O(1) patient lookup, UID verification |
| **Weighted Job Scheduling** | DP + Sorting | Variable case complexity handling |
| **Load Balancing** | Greedy Distribution | Even patient distribution across doctors |
| **Predictive Model** | Historical DP | No-show prediction, wait time estimation |

### Problem-to-Algorithm Mapping

```
┌────────────────────────┐     ┌─────────────────────────┐
│  PROBLEM               │     │  DSA SOLUTION           │
├────────────────────────┤     ├─────────────────────────┤
│ Long wait times        │────▶│ Wait Prediction (DP)    │
│ Overbooking            │────▶│ Interval Detection      │
│ Emergency delays       │────▶│ Priority Queue (Heap)   │
│ No-shows               │────▶│ Predictive Scheduling   │
│ Uneven distribution    │────▶│ Load Balancing (Greedy) │
│ Variable complexity    │────▶│ Weighted Job Scheduling │
│ Slot allocation        │────▶│ Activity Selection      │
│ Patient lookup         │────▶│ Hash Map O(1)           │
│ Conflict detection     │────▶│ Interval Tree O(log n)  │
└────────────────────────┘     └─────────────────────────┘
```

## 🗃️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   DEPARTMENTS   │       │     DOCTORS     │       │    PATIENTS     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ department_id PK│◄──────│ department_id FK│       │ patient_id   PK │
│ department_name │       │ doctor_id    PK │       │ patient_uid     │
│ description     │       │ first_name      │       │ first_name      │
│ floor_number    │       │ specialization  │       │ last_name       │
└─────────────────┘       │ avg_consult_time│       │ phone           │
                          │ max_patients/day│       │ email           │
                          └────────┬────────┘       └────────┬────────┘
                                   │                         │
                                   │                         │
         ┌─────────────────────────┴─────────────────────────┤
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ DOCTOR_SCHEDULES│       │   APPOINTMENTS  │       │   TIME_SLOTS    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ schedule_id  PK │       │ appointment_id PK│◄─────│ slot_id      PK │
│ doctor_id    FK │       │ patient_id    FK│       │ doctor_id    FK │
│ day_of_week     │       │ doctor_id     FK│       │ slot_date       │
│ morning_start   │       │ slot_id       FK│       │ start_time      │
│ morning_end     │       │ appointment_date│       │ end_time        │
│ afternoon_start │       │ start_time      │       │ slot_status     │
│ afternoon_end   │       │ priority_level  │──┐    │ slot_duration   │
└─────────────────┘       │ status          │  │    └─────────────────┘
                          └────────┬────────┘  │
                                   │           │
                                   ▼           │
                          ┌─────────────────┐  │    ┌─────────────────┐
                          │   LIVE_QUEUE    │  │    │  QUEUE_HISTORY  │
                          ├─────────────────┤  │    ├─────────────────┤
                          │ queue_id     PK │  │    │ history_id   PK │
                          │ appointment_id FK│  │    │ doctor_id    FK │
                          │ doctor_id    FK │  │    │ wait_time_mins  │
                          │ queue_position  │◄─┘    │ consultation_min│
                          │ priority_score  │       │ day_of_week     │
                          │ urgency_level   │       │ hour_of_day     │
                          │ estimated_wait  │       └─────────────────┘
                          │ queue_status    │           Used for
                          └─────────────────┘       Wait Time Prediction
                              Used for
                           Priority Queue
```

### Core Tables

| Table | Purpose | DSA Connection |
|-------|---------|----------------|
| `appointments` | Core booking records | Interval scheduling |
| `time_slots` | Pre-generated slots | Binary search for availability |
| `live_queue` | Real-time queue | Priority Queue (Heap) |
| `queue_history` | Historical metrics | Wait time prediction |
| `doctor_schedules` | Weekly availability | Slot generation |

### Key Stored Procedures

| Procedure | Algorithm | Purpose |
|-----------|-----------|---------|
| `sp_checkin_patient` | Heap Insert | Add to priority queue |
| `sp_reorder_queue` | Heapify | Rebalance queue by priority |
| `sp_call_next_patient` | Extract-Min | Get highest priority patient |
| `sp_find_optimal_slot` | Greedy | Find best available slot |
| `sp_insert_emergency` | Priority Boost | Handle emergency cases |
| `fn_estimate_wait_time` | DP + Historical | Calculate expected wait |
| `sp_predict_noshow` | Predictive Model | Estimate no-show probability |
| `sp_load_balance` | Greedy Distribution | Distribute patients across doctors |
| `sp_weighted_schedule` | Weighted Job DP | Handle variable case complexity |
| `sp_verify_patient_uid` | Hash Lookup | Patient identification verification |
| `sp_allocate_buffer` | Greedy Interval | Add buffer between appointments |

## 📁 Project Structure

```
├── database/
│   ├── schema.sql        # Table definitions
│   ├── views.sql         # Query views for algorithms
│   ├── procedures.sql    # Stored procedures (DSA logic)
│   └── sample_data.sql   # Test data
├── src/                  # Java source code (coming)
└── README.md
```

## 🔧 Tech Stack

- **Backend**: Java + Spring Boot
- **Database**: MySQL
- **Frontend**: React/Thymeleaf (planned)
- **Notifications**: JavaMail / Twilio SMS

## 📊 Expected Outcomes

| Metric | Current State | Target with System | Improvement |
|--------|---------------|--------------------|--------------|
| Avg Wait Time | 60-120 mins | < 30 mins | 50-75% reduction |
| Scheduling Conflicts | 5-10% | 0% | 100% elimination |
| Emergency Response | 15-30 mins | < 2 mins | 90% faster |
| Doctor Utilization | 60-70% | > 85% | 20-25% increase |
| No-show Rate | 15-30% | < 10% | 50% reduction |
| Patient Satisfaction | ~60% | > 85% | 25% increase |
| Admin Task Time | 25% of staff time | < 10% | 60% reduction |
| Patient Misidentification | 12.3% events | < 1% | 90% reduction |

## 🚀 Setup

```bash
# Create database
mysql -u root -p < database/schema.sql

# Load views and procedures
mysql -u root -p hospital_db < database/views.sql
mysql -u root -p hospital_db < database/procedures.sql

# Load sample data
mysql -u root -p hospital_db < database/sample_data.sql
```

## 📈 Algorithm Complexity

| Operation | Time | Space | Problem Solved |
|-----------|------|-------|----------------|
| Check-in (Heap Insert) | O(log n) | O(1) | Queue management |
| Call Next (Extract-Min) | O(log n) | O(1) | Priority handling |
| Find Slot (Greedy) | O(n) | O(1) | Slot allocation |
| Detect Conflicts | O(n log n) | O(n) | Overbooking prevention |
| Wait Time Prediction | O(1) | O(k) | Patient communication |
| No-show Prediction | O(1) | O(m) | Slot optimization |
| Load Balancing | O(d × p) | O(d) | Even distribution |
| Weighted Scheduling | O(n log n) | O(n) | Variable complexity |
| Patient UID Lookup | O(1) | O(p) | Misidentification prevention |
| Buffer Allocation | O(n) | O(1) | Rushed consultation prevention |

---

## 🎨 Features by User Role

### 👤 Patient Features
| Feature | Description | Algorithm Used |
|---------|-------------|----------------|
| Book Appointment | Select doctor, date, time slot | Greedy (first available) |
| View Queue Position | Real-time position in queue | Priority Queue |
| Estimated Wait Time | Predicted wait based on history | DP + Historical data |
| Receive Notifications | SMS/Email for booking, reminders | Scheduled triggers |
| Cancel/Reschedule | Modify existing appointments | Interval adjustment |
| View History | Past appointments and reports | - |
| Patient UID Verification | Secure identity check at check-in | Hash Map O(1) |
| No-show Risk Alert | Warning if high no-show probability | Predictive model |

### 👩‍⚕️ Receptionist Features
| Feature | Description | Algorithm Used |
|---------|-------------|----------------|
| Patient Check-in | Add to live queue with UID verification | Heap Insert O(log n) + Hash lookup |
| Call Next Patient | Get highest priority patient | Extract-Min O(log n) |
| Handle Emergency | Insert with priority boost | Priority update + Heapify |
| View All Queues | Dashboard for all doctors | - |
| Manual Override | Adjust queue order | Re-heapify |
| Generate Reports | Daily/weekly statistics | Aggregation queries |
| No-show Management | Fill cancelled slots from waitlist | Predictive rescheduling |
| Load Balance View | See doctor utilization distribution | Load balancing metrics |

### 🩺 Doctor Features
| Feature | Description | Algorithm Used |
|---------|-------------|----------------|
| View Schedule | Today's appointments with complexity tags | Sorted intervals |
| Call Next Patient | From their queue | Extract-Min |
| Complete Consultation | Record duration, notes | Updates prediction model |
| View Patient History | Previous visits | - |
| Block Time Slots | Mark unavailable | Interval removal |
| Buffer Time Config | Set prep time between appointments | Greedy buffer allocation |
| Case Complexity Tag | Mark expected consultation duration | Weighted job input |

### 🔧 Admin Features
| Feature | Description | Algorithm Connection |
|---------|-------------|----------------------|
| Manage Doctors | Add, edit, deactivate | Load balancing recalc |
| Manage Departments | Configure specializations | - |
| System Configuration | Algorithm parameters (weights, thresholds) | Tune prediction models |
| Analytics Dashboard | Utilization, wait times, no-show rates | All metrics |
| User Management | Roles and permissions | - |
| Load Balancing Config | Set max patients per doctor | Greedy distribution |
| No-show Threshold | Configure prediction sensitivity | Predictive model |

---

## 🔌 REST API Design

### Authentication
```
POST   /api/auth/login          # User login
POST   /api/auth/register       # Patient registration
POST   /api/auth/logout         # Logout
```

### Patient APIs
```
GET    /api/patients/{id}                    # Get patient details
PUT    /api/patients/{id}                    # Update patient info
GET    /api/patients/{id}/appointments       # Patient's appointments
GET    /api/patients/{id}/history            # Medical history
```

### Doctor APIs
```
GET    /api/doctors                          # List all doctors
GET    /api/doctors/{id}                     # Doctor details
GET    /api/doctors/{id}/schedule            # Weekly schedule
GET    /api/doctors/{id}/slots?date=YYYY-MM-DD  # Available slots
GET    /api/doctors/department/{deptId}      # Doctors by department
```

### Appointment APIs
```
POST   /api/appointments                     # Book new appointment
GET    /api/appointments/{id}                # Get appointment details
PUT    /api/appointments/{id}                # Update appointment
DELETE /api/appointments/{id}                # Cancel appointment
PUT    /api/appointments/{id}/reschedule     # Reschedule
```

### Queue APIs (Real-time)
```
POST   /api/queue/checkin/{appointmentId}    # Patient check-in
GET    /api/queue/doctor/{doctorId}          # Get doctor's queue
POST   /api/queue/call-next/{doctorId}       # Call next patient
GET    /api/queue/position/{appointmentId}   # Get queue position
POST   /api/queue/emergency                  # Insert emergency
PUT    /api/queue/complete/{appointmentId}   # Mark consultation done
GET    /api/queue/wait-time/{doctorId}       # Estimated wait time
```

### Slot Management APIs
```
GET    /api/slots/available                  # Find available slots
POST   /api/slots/generate                   # Generate slots for date range
PUT    /api/slots/{id}/block                 # Block a slot
```

### No-show & Load Balancing APIs
```
GET    /api/noshow/predict/{appointmentId}   # Get no-show probability
GET    /api/noshow/high-risk?date=YYYY-MM-DD # List high-risk appointments
POST   /api/noshow/send-reminder/{id}        # Send reminder to patient
GET    /api/load/distribution                # Doctor load distribution
POST   /api/load/rebalance                   # Trigger load rebalancing
GET    /api/load/doctor/{doctorId}           # Single doctor load metrics
```

### Patient Verification APIs
```
GET    /api/verify/patient/{uid}             # Verify patient by UID
POST   /api/verify/checkin                   # Check-in with UID verification
```

---

## 📱 UI Screens

### Patient Portal
```
┌─────────────────────────────────────────────────────────┐
│  🏥 Patient Dashboard                          [Logout] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 📅 Book     │  │ 📋 My       │  │ ⏰ Queue    │     │
│  │ Appointment │  │ Appointments│  │ Status      │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Today's Appointment                               │ │
│  │ Dr. Rajesh Sharma - 10:30 AM                      │ │
│  │ Queue Position: 3  |  Est. Wait: ~25 mins         │ │
│  │ [Check-in]  [Cancel]  [Reschedule]                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Upcoming Appointments                                  │
│  ├─ Feb 22 - Dr. Priya Patel (Cardiology)             │
│  └─ Mar 05 - Dr. Amit Verma (Follow-up)               │
└─────────────────────────────────────────────────────────┘
```

### Receptionist Queue Screen
```
┌─────────────────────────────────────────────────────────┐
│  🏥 Queue Management - Dr. Rajesh Sharma       [Today] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Currently With Doctor: Rahul Mehta (Token #12)        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                         │
│  Waiting Queue (8 patients)                             │
│  ┌─────┬────────────────┬──────────┬─────────┬───────┐ │
│  │ Pos │ Patient        │ Type     │Priority │ Wait  │ │
│  ├─────┼────────────────┼──────────┼─────────┼───────┤ │
│  │ 1   │ 🚨 Arun K.     │ Emergency│ ★★★★★  │ 2 min │ │
│  │ 2   │ Anjali Desai   │ New      │ ★★★☆☆  │ 15min │ │
│  │ 3   │ Sanjay Nair    │ Follow-up│ ★★☆☆☆  │ 22min │ │
│  │ 4   │ Meera Iyer     │ Checkup  │ ★☆☆☆☆  │ 35min │ │
│  └─────┴────────────────┴──────────┴─────────┴───────┘ │
│                                                         │
│  [📢 Call Next]  [🚨 Add Emergency]  [🔄 Refresh]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Booking Flow
```
Step 1: Select Department     Step 2: Select Doctor
┌─────────────────────┐      ┌─────────────────────┐
│ ○ General Medicine  │      │ ○ Dr. Rajesh Sharma │
│ ○ Cardiology        │  →   │   ⭐4.8 | 15yr exp  │
│ ○ Orthopedics       │      │ ○ Dr. Kavita Joshi  │
│ ○ Dermatology       │      │   ⭐4.6 | 11yr exp  │
└─────────────────────┘      └─────────────────────┘
         ↓
Step 3: Select Date          Step 4: Select Time Slot
┌─────────────────────┐      ┌─────────────────────┐
│    February 2026    │      │ Morning             │
│ Su Mo Tu We Th Fr Sa│  →   │ [09:00] [09:20] ✓   │
│        1  2  3  4  5│      │ [09:40] [10:00]     │
│  6  7  8  9 10 11 12│      │ Afternoon           │
│ 13 14 15 16 17 18 19│      │ [14:00] [14:20]     │
│ 20 21 [22] ...      │      │ [14:40] [15:00]     │
└─────────────────────┘      └─────────────────────┘
         ↓
Step 5: Confirm Booking
┌─────────────────────────────────────┐
│ ✅ Appointment Confirmed!           │
│                                     │
│ Dr. Rajesh Sharma                   │
│ Feb 22, 2026 at 09:20 AM            │
│ Token: APT-2026-000156              │
│                                     │
│ You will receive SMS confirmation   │
│ [Download PDF] [Add to Calendar]    │
└─────────────────────────────────────┘
```

---

## 🧮 Algorithm Pseudocode

### 1. Greedy Slot Allocation (Activity Selection)
```python
def find_optimal_slot(doctor_id, date, duration_needed):
    """
    Greedy approach: Select first available slot
    Time: O(n) where n = slots for that day
    """
    slots = get_available_slots(doctor_id, date)
    slots.sort(by=start_time)  # Already sorted in DB
    
    for slot in slots:
        if slot.duration >= duration_needed:
            return slot  # First fit = optimal for earliest appointment
    
    return None  # No slot available
```

### 2. Priority Queue Operations (Min-Heap)
```python
class PatientQueue:
    """
    Min-Heap where lower priority_score = higher priority
    priority_score = base - (urgency_weight × urgency) + (wait_weight × wait_time)
    """
    
    def check_in(self, appointment):
        """Insert into heap - O(log n)"""
        priority = calculate_priority(appointment)
        heap_insert(self.queue, (priority, appointment))
        self.rebalance()
    
    def call_next(self):
        """Extract minimum priority (highest priority patient) - O(log n)"""
        return heap_extract_min(self.queue)
    
    def insert_emergency(self, appointment):
        """Emergency gets extreme negative priority"""
        appointment.priority_score = -100  # Guaranteed top
        self.check_in(appointment)
    
    def calculate_priority(self, apt):
        base = apt.base_priority
        urgency = get_urgency(apt.type)  # Emergency=5, New=3, Follow-up=2
        wait = minutes_since_checkin(apt)
        
        return base - (URGENCY_WEIGHT * urgency) + (WAIT_WEIGHT * wait)
```

### 3. Wait Time Prediction
```python
def estimate_wait_time(doctor_id, appointment_type):
    """
    Hybrid approach: Current queue + Historical average
    Time: O(1) with pre-computed stats
    """
    # Current state
    queue_size = count_waiting_patients(doctor_id)
    avg_consultation = get_doctor_avg_time(doctor_id)
    current_estimate = queue_size * avg_consultation
    
    # Historical data for same day/hour
    day = get_day_of_week()
    hour = get_current_hour()
    historical_avg = query_historical_wait(doctor_id, day, hour, appointment_type)
    
    # Weighted average (60% current, 40% historical)
    return 0.6 * current_estimate + 0.4 * historical_avg
```

### 4. Interval Partitioning (DP for Multi-Doctor)
```python
def assign_patient_to_doctor(patient_request, available_doctors):
    """
    DP approach to minimize overall wait time
    Time: O(d × s) where d=doctors, s=slots per doctor
    """
    best_assignment = None
    min_total_wait = infinity
    
    for doctor in available_doctors:
        slots = get_available_slots(doctor, patient_request.date)
        
        for slot in slots:
            # Calculate impact on existing queue
            current_wait = estimate_wait_if_assigned(doctor, slot)
            impact_on_others = calculate_queue_impact(doctor, slot)
            total_wait = current_wait + impact_on_others
            
            if total_wait < min_total_wait:
                min_total_wait = total_wait
                best_assignment = (doctor, slot)
    
    return best_assignment
```

### 5. No-show Prediction Model
```python
def predict_noshow_probability(appointment):
    """
    Predictive model based on historical patterns
    Time: O(1) with pre-computed features
    """
    # Feature extraction
    patient_history = get_patient_noshow_rate(appointment.patient_id)
    day_factor = get_day_noshow_rate(appointment.day_of_week)
    time_factor = get_time_noshow_rate(appointment.hour)
    advance_booking_days = (appointment.date - appointment.booked_on).days
    
    # Weighted probability calculation
    base_probability = 0.20  # Average no-show rate
    
    probability = (
        0.4 * patient_history +      # Patient's own history (40% weight)
        0.2 * day_factor +           # Day of week pattern (20% weight)
        0.2 * time_factor +          # Time of day pattern (20% weight)
        0.2 * advance_booking_factor(advance_booking_days)  # Longer advance = higher risk
    )
    
    return min(probability, 1.0)

def handle_predicted_noshow(appointment):
    """Actions for high no-show probability"""
    if predict_noshow_probability(appointment) > 0.5:
        send_reminder_sms(appointment)
        add_to_waitlist_candidates(appointment.slot)
```

### 6. Load Balancing Algorithm
```python
def balance_load_across_doctors(appointments_to_assign, doctors):
    """
    Greedy load balancing to distribute patients evenly
    Time: O(n log d) where n=appointments, d=doctors
    """
    # Min-heap of (current_load, doctor_id)
    doctor_heap = [(get_current_load(d), d.id) for d in doctors]
    heapify(doctor_heap)
    
    assignments = []
    
    for appointment in appointments_to_assign:
        # Get doctor with minimum load
        min_load, doctor_id = heap_pop(doctor_heap)
        
        # Assign appointment
        assignments.append((appointment, doctor_id))
        
        # Update load and push back
        new_load = min_load + appointment.expected_duration
        heap_push(doctor_heap, (new_load, doctor_id))
    
    return assignments
```

### 7. Weighted Job Scheduling (Variable Complexity)
```python
def schedule_weighted_appointments(appointments, doctor):
    """
    DP approach for variable case complexity
    Time: O(n log n) for sorting + O(n) for DP
    """
    # Sort by end time
    appointments.sort(key=lambda x: x.expected_end_time)
    
    n = len(appointments)
    dp = [0] * (n + 1)  # dp[i] = max value scheduling first i appointments
    
    for i in range(1, n + 1):
        apt = appointments[i-1]
        
        # Find last non-conflicting appointment
        j = binary_search_last_compatible(appointments, i-1)
        
        # Include current: value + dp[compatible]
        include = apt.priority_value + dp[j+1]
        
        # Exclude current: dp[i-1]
        exclude = dp[i-1]
        
        dp[i] = max(include, exclude)
    
    return reconstruct_schedule(dp, appointments)

def allocate_buffer_time(schedule, doctor):
    """
    Greedy buffer allocation between appointments
    Prevents rushed consultations
    """
    buffer_minutes = doctor.preferred_buffer  # e.g., 5 mins
    
    adjusted_schedule = []
    for i, apt in enumerate(schedule):
        if i > 0:
            # Add buffer after previous appointment
            apt.start_time = max(
                apt.start_time,
                adjusted_schedule[-1].end_time + buffer_minutes
            )
        adjusted_schedule.append(apt)
    
    return adjusted_schedule
```

---

## 📅 Project Milestones

### Week 1: Foundation
- [x] Problem analysis and research
- [x] Database schema design
- [ ] Create SQL files (schema, procedures)
- [ ] Set up Java Spring Boot project

### Week 2: Core Backend
- [ ] Entity classes (Patient, Doctor, Appointment)
- [ ] Repository layer (JPA)
- [ ] Implement Priority Queue in Java
- [ ] Basic REST APIs

### Week 3: Algorithms
- [ ] Greedy slot allocation
- [ ] Wait time prediction
- [ ] Emergency handling
- [ ] Queue management APIs

### Week 4: Frontend
- [ ] Patient booking UI
- [ ] Receptionist queue dashboard
- [ ] Doctor schedule view
- [ ] Real-time queue updates (WebSocket)

### Week 5: Polish
- [ ] SMS/Email notifications
- [ ] Testing with sample data
- [ ] Performance optimization
- [ ] Documentation and demo prep

---

## 📚 References

1. WHO Patient Safety Guidelines - Patient misidentification, communication gaps
2. WHO Global Health Statistics - Doctor shortage ratios (1:1445 in India)
3. NCBI - "25% of nursing time on administrative tasks"
4. IBEF Healthcare Report - Indian healthcare challenges, OPD statistics
5. "Outpatient Appointment Scheduling" - Operations Research literature
6. CLRS - Introduction to Algorithms (Greedy, DP, Heaps, Interval Scheduling)
7. Spring Boot Documentation
8. MySQL Stored Procedures Guide
9. HealthIT.gov - EHR implementation best practices
10. No-show prediction research papers - Patient behavior modeling

---

## 👥 Contributors

**Project Lead:** Archit Mittal
- PBL Team - DAA Project 2026