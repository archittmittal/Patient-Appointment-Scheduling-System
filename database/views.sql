-- ============================================================================
-- Patient Appointment Scheduling System - Database Views
-- Optimized views for DSA algorithm operations
-- ============================================================================

USE hospital_db;

-- ============================================================================
-- SLOT AVAILABILITY VIEWS (For Greedy Algorithm)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Available slots for a doctor (sorted for Greedy first-fit)
-- Usage: Greedy slot allocation - find first available slot
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_available_slots AS
SELECT 
    ts.slot_id,
    ts.doctor_id,
    d.first_name AS doctor_first_name,
    d.last_name AS doctor_last_name,
    d.specialization,
    dept.department_name,
    ts.slot_date,
    ts.start_time,
    ts.end_time,
    ts.slot_duration,
    ts.slot_status
FROM time_slots ts
JOIN doctors d ON ts.doctor_id = d.doctor_id
JOIN departments dept ON d.department_id = dept.department_id
WHERE ts.slot_status = 'AVAILABLE'
  AND ts.slot_date >= CURDATE()
  AND d.is_active = TRUE
ORDER BY ts.slot_date, ts.start_time;  -- Sorted for Greedy algorithm

-- ----------------------------------------------------------------------------
-- View: Doctor's daily schedule with slot status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_doctor_daily_schedule AS
SELECT 
    ts.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    ts.slot_date,
    ts.start_time,
    ts.end_time,
    ts.slot_status,
    a.appointment_id,
    CASE WHEN a.patient_id IS NOT NULL 
         THEN CONCAT(p.first_name, ' ', p.last_name) 
         ELSE NULL 
    END AS patient_name,
    a.appointment_type,
    a.priority_level,
    a.case_complexity
FROM time_slots ts
JOIN doctors d ON ts.doctor_id = d.doctor_id
LEFT JOIN appointments a ON ts.slot_id = a.slot_id AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
LEFT JOIN patients p ON a.patient_id = p.patient_id
ORDER BY ts.doctor_id, ts.slot_date, ts.start_time;

-- ============================================================================
-- PRIORITY QUEUE VIEWS (For Heap Operations)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Live queue with priority (for Extract-Min operation)
-- Lower priority_score = Higher priority (Min-Heap)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_live_queue_priority AS
SELECT 
    lq.queue_id,
    lq.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    lq.appointment_id,
    lq.patient_id,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.patient_uid,
    lq.queue_position,
    lq.priority_score,
    lq.urgency_level,
    lq.token_number,
    lq.checkin_time,
    TIMESTAMPDIFF(MINUTE, lq.checkin_time, NOW()) AS wait_time_so_far,
    lq.estimated_wait_minutes,
    lq.queue_status,
    a.appointment_type,
    a.case_complexity
FROM live_queue lq
JOIN doctors d ON lq.doctor_id = d.doctor_id
JOIN patients p ON lq.patient_id = p.patient_id
JOIN appointments a ON lq.appointment_id = a.appointment_id
WHERE lq.queue_status = 'WAITING'
ORDER BY lq.doctor_id, lq.priority_score ASC;  -- Min-Heap order

-- ----------------------------------------------------------------------------
-- View: Queue summary per doctor
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_queue_summary AS
SELECT 
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    dept.department_name,
    COUNT(CASE WHEN lq.queue_status = 'WAITING' THEN 1 END) AS waiting_count,
    COUNT(CASE WHEN lq.queue_status = 'IN_CONSULTATION' THEN 1 END) AS in_consultation,
    MIN(CASE WHEN lq.queue_status = 'WAITING' THEN lq.priority_score END) AS next_priority_score,
    AVG(CASE WHEN lq.queue_status = 'WAITING' 
        THEN TIMESTAMPDIFF(MINUTE, lq.checkin_time, NOW()) END) AS avg_wait_time,
    MAX(CASE WHEN lq.queue_status = 'WAITING' 
        THEN TIMESTAMPDIFF(MINUTE, lq.checkin_time, NOW()) END) AS max_wait_time
FROM doctors d
JOIN departments dept ON d.department_id = dept.department_id
LEFT JOIN live_queue lq ON d.doctor_id = lq.doctor_id
WHERE d.is_active = TRUE
GROUP BY d.doctor_id, d.first_name, d.last_name, dept.department_name;

-- ============================================================================
-- WAIT TIME PREDICTION VIEWS (For DP Algorithm)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Historical wait time statistics by doctor, day, hour
-- Used for wait time prediction algorithm
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_wait_time_stats AS
SELECT 
    doctor_id,
    day_of_week,
    hour_of_day,
    appointment_type,
    COUNT(*) AS sample_count,
    AVG(wait_time_minutes) AS avg_wait_time,
    STDDEV(wait_time_minutes) AS stddev_wait_time,
    MIN(wait_time_minutes) AS min_wait_time,
    MAX(wait_time_minutes) AS max_wait_time,
    AVG(consultation_minutes) AS avg_consultation_time,
    AVG(queue_size_at_checkin) AS avg_queue_size
FROM queue_history
WHERE queue_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)  -- Last 90 days
GROUP BY doctor_id, day_of_week, hour_of_day, appointment_type;

-- ----------------------------------------------------------------------------
-- View: Doctor average consultation times
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_doctor_avg_times AS
SELECT 
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    d.avg_consultation_time AS configured_avg,
    COALESCE(
        AVG(qh.consultation_minutes), 
        d.avg_consultation_time
    ) AS actual_avg,
    COUNT(qh.history_id) AS sample_count
FROM doctors d
LEFT JOIN queue_history qh ON d.doctor_id = qh.doctor_id 
    AND qh.queue_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE d.is_active = TRUE
GROUP BY d.doctor_id, d.first_name, d.last_name, d.avg_consultation_time;

-- ============================================================================
-- LOAD BALANCING VIEWS (For Greedy Distribution)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Doctor load distribution (for load balancing algorithm)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_doctor_load_distribution AS
SELECT 
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    dept.department_name,
    d.max_patients_per_day,
    COALESCE(dl.booked_slots, 0) AS booked_today,
    COALESCE(dl.total_slots, d.max_patients_per_day) AS total_slots,
    d.max_patients_per_day - COALESCE(dl.booked_slots, 0) AS remaining_capacity,
    COALESCE(dl.utilization_percentage, 0) AS utilization_pct,
    d.avg_consultation_time
FROM doctors d
JOIN departments dept ON d.department_id = dept.department_id
LEFT JOIN doctor_load dl ON d.doctor_id = dl.doctor_id AND dl.load_date = CURDATE()
WHERE d.is_active = TRUE
ORDER BY dl.utilization_percentage ASC;  -- Least loaded first for balancing

-- ----------------------------------------------------------------------------
-- View: Department-wise load
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_department_load AS
SELECT 
    dept.department_id,
    dept.department_name,
    COUNT(DISTINCT d.doctor_id) AS active_doctors,
    SUM(COALESCE(dl.booked_slots, 0)) AS total_booked,
    SUM(d.max_patients_per_day) AS total_capacity,
    ROUND(
        SUM(COALESCE(dl.booked_slots, 0)) * 100.0 / 
        NULLIF(SUM(d.max_patients_per_day), 0), 2
    ) AS avg_utilization_pct
FROM departments dept
JOIN doctors d ON dept.department_id = d.department_id AND d.is_active = TRUE
LEFT JOIN doctor_load dl ON d.doctor_id = dl.doctor_id AND dl.load_date = CURDATE()
GROUP BY dept.department_id, dept.department_name;

-- ============================================================================
-- NO-SHOW PREDICTION VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Patient no-show history
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_patient_noshow_stats AS
SELECT 
    p.patient_id,
    p.patient_uid,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.total_appointments,
    p.noshow_count,
    p.noshow_rate,
    CASE 
        WHEN p.noshow_rate >= 0.5 THEN 'HIGH_RISK'
        WHEN p.noshow_rate >= 0.25 THEN 'MEDIUM_RISK'
        ELSE 'LOW_RISK'
    END AS risk_category
FROM patients p
WHERE p.total_appointments > 0;

-- ----------------------------------------------------------------------------
-- View: High-risk appointments (need reminders)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_high_risk_appointments AS
SELECT 
    a.appointment_id,
    a.patient_id,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.phone,
    p.email,
    a.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    a.appointment_date,
    a.start_time,
    a.noshow_probability,
    p.noshow_rate AS patient_noshow_rate,
    DATEDIFF(a.appointment_date, a.booked_at) AS advance_booking_days,
    a.reminder_sent
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
JOIN doctors d ON a.doctor_id = d.doctor_id
WHERE a.status IN ('SCHEDULED', 'CONFIRMED')
  AND a.appointment_date >= CURDATE()
  AND a.noshow_probability >= 0.3
ORDER BY a.noshow_probability DESC, a.appointment_date;

-- ----------------------------------------------------------------------------
-- View: Day/hour no-show patterns
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_noshow_patterns AS
SELECT 
    day_of_week,
    hour_of_day,
    COUNT(*) AS total_appointments,
    SUM(CASE WHEN was_noshow THEN 1 ELSE 0 END) AS noshow_count,
    ROUND(
        SUM(CASE WHEN was_noshow THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2
    ) AS noshow_rate_pct
FROM queue_history
WHERE queue_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
GROUP BY day_of_week, hour_of_day
ORDER BY day_of_week, hour_of_day;

-- ============================================================================
-- CONFLICT DETECTION VIEW (For Interval Scheduling)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Potential scheduling conflicts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_scheduling_conflicts AS
SELECT 
    a1.appointment_id AS appointment1_id,
    a2.appointment_id AS appointment2_id,
    a1.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    a1.appointment_date,
    a1.start_time AS apt1_start,
    a1.end_time AS apt1_end,
    a2.start_time AS apt2_start,
    a2.end_time AS apt2_end,
    'OVERLAP' AS conflict_type
FROM appointments a1
JOIN appointments a2 ON a1.doctor_id = a2.doctor_id 
    AND a1.appointment_date = a2.appointment_date
    AND a1.appointment_id < a2.appointment_id
JOIN doctors d ON a1.doctor_id = d.doctor_id
WHERE a1.status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
  AND a2.status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
  AND a1.start_time < a2.end_time 
  AND a2.start_time < a1.end_time;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Daily appointment statistics
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_daily_stats AS
SELECT 
    appointment_date,
    COUNT(*) AS total_appointments,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
    SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_shows,
    SUM(CASE WHEN status IN ('SCHEDULED', 'CONFIRMED') THEN 1 ELSE 0 END) AS upcoming,
    AVG(actual_wait_time) AS avg_wait_time,
    AVG(actual_consultation_time) AS avg_consultation_time
FROM appointments
WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY appointment_date
ORDER BY appointment_date DESC;

-- ----------------------------------------------------------------------------
-- View: Doctor utilization report
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_doctor_utilization AS
SELECT 
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    d.specialization,
    COUNT(DISTINCT a.appointment_date) AS working_days,
    COUNT(a.appointment_id) AS total_appointments,
    SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN a.status = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_shows,
    ROUND(
        SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0 / 
        NULLIF(COUNT(a.appointment_id), 0), 2
    ) AS completion_rate,
    AVG(a.actual_consultation_time) AS avg_consultation_time,
    SUM(a.actual_consultation_time) AS total_consultation_minutes
FROM doctors d
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id 
    AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE d.is_active = TRUE
GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialization;

-- ============================================================================
-- WAITLIST VIEW
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: Active waitlist with patient details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_active_waitlist AS
SELECT 
    w.waitlist_id,
    w.patient_id,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.phone,
    w.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
    w.preferred_date,
    w.preferred_time_start,
    w.preferred_time_end,
    w.priority,
    w.status,
    w.created_at,
    TIMESTAMPDIFF(HOUR, w.created_at, NOW()) AS hours_waiting
FROM waitlist w
JOIN patients p ON w.patient_id = p.patient_id
JOIN doctors d ON w.doctor_id = d.doctor_id
WHERE w.status = 'WAITING'
  AND w.preferred_date >= CURDATE()
ORDER BY w.priority DESC, w.created_at ASC;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Views Created: 17
--
-- Greedy Algorithm:
--   - vw_available_slots (sorted for first-fit)
--   - vw_doctor_daily_schedule
--
-- Priority Queue (Heap):
--   - vw_live_queue_priority (ordered by priority_score)
--   - vw_queue_summary
--
-- Wait Time Prediction (DP):
--   - vw_wait_time_stats
--   - vw_doctor_avg_times
--
-- Load Balancing:
--   - vw_doctor_load_distribution
--   - vw_department_load
--
-- No-show Prediction:
--   - vw_patient_noshow_stats
--   - vw_high_risk_appointments
--   - vw_noshow_patterns
--
-- Conflict Detection:
--   - vw_scheduling_conflicts
--
-- Analytics:
--   - vw_daily_stats
--   - vw_doctor_utilization
--
-- Waitlist:
--   - vw_active_waitlist
-- ============================================================================
