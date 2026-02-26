-- ============================================================================
-- Patient Appointment Scheduling System - Stored Procedures
-- DSA Algorithm Implementations in SQL
-- ============================================================================

USE hospital_db;

DELIMITER //

-- ============================================================================
-- SLOT GENERATION (Pre-compute slots for Binary Search)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Generate time slots for a doctor for a date range
-- Purpose: Pre-generate slots based on doctor's weekly schedule
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_generate_time_slots(
    IN p_doctor_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    DECLARE v_current_date DATE;
    DECLARE v_day_name VARCHAR(10);
    DECLARE v_morning_start TIME;
    DECLARE v_morning_end TIME;
    DECLARE v_afternoon_start TIME;
    DECLARE v_afternoon_end TIME;
    DECLARE v_slot_duration INT;
    DECLARE v_current_time TIME;
    DECLARE v_buffer_time INT;
    
    -- Get doctor's preferred buffer time
    SELECT preferred_buffer_time INTO v_buffer_time 
    FROM doctors WHERE doctor_id = p_doctor_id;
    
    SET v_current_date = p_start_date;
    
    WHILE v_current_date <= p_end_date DO
        SET v_day_name = UPPER(DAYNAME(v_current_date));
        
        -- Get schedule for this day
        SELECT morning_start, morning_end, afternoon_start, afternoon_end, slot_duration
        INTO v_morning_start, v_morning_end, v_afternoon_start, v_afternoon_end, v_slot_duration
        FROM doctor_schedules
        WHERE doctor_id = p_doctor_id AND day_of_week = v_day_name AND is_available = TRUE;
        
        IF v_morning_start IS NOT NULL THEN
            -- Generate morning slots
            SET v_current_time = v_morning_start;
            WHILE ADDTIME(v_current_time, SEC_TO_TIME(v_slot_duration * 60)) <= v_morning_end DO
                INSERT IGNORE INTO time_slots (doctor_id, slot_date, start_time, end_time, slot_duration, slot_status)
                VALUES (
                    p_doctor_id,
                    v_current_date,
                    v_current_time,
                    ADDTIME(v_current_time, SEC_TO_TIME(v_slot_duration * 60)),
                    v_slot_duration,
                    'AVAILABLE'
                );
                -- Add buffer time between slots
                SET v_current_time = ADDTIME(v_current_time, SEC_TO_TIME((v_slot_duration + v_buffer_time) * 60));
            END WHILE;
            
            -- Generate afternoon slots
            IF v_afternoon_start IS NOT NULL THEN
                SET v_current_time = v_afternoon_start;
                WHILE ADDTIME(v_current_time, SEC_TO_TIME(v_slot_duration * 60)) <= v_afternoon_end DO
                    INSERT IGNORE INTO time_slots (doctor_id, slot_date, start_time, end_time, slot_duration, slot_status)
                    VALUES (
                        p_doctor_id,
                        v_current_date,
                        v_current_time,
                        ADDTIME(v_current_time, SEC_TO_TIME(v_slot_duration * 60)),
                        v_slot_duration,
                        'AVAILABLE'
                    );
                    SET v_current_time = ADDTIME(v_current_time, SEC_TO_TIME((v_slot_duration + v_buffer_time) * 60));
                END WHILE;
            END IF;
        END IF;
        
        SET v_current_date = DATE_ADD(v_current_date, INTERVAL 1 DAY);
    END WHILE;
END //

-- ============================================================================
-- GREEDY ALGORITHM: Optimal Slot Allocation (Activity Selection)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Find optimal available slot (Greedy first-fit)
-- Algorithm: Activity Selection - O(n) where n = slots for that day
-- Returns: First available slot that fits the requested duration
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_find_optimal_slot(
    IN p_doctor_id INT,
    IN p_date DATE,
    IN p_duration_needed INT,
    OUT p_slot_id INT,
    OUT p_start_time TIME,
    OUT p_end_time TIME
)
BEGIN
    -- Greedy approach: Select FIRST available slot (sorted by start_time)
    -- This is optimal for earliest appointment scheduling
    SELECT slot_id, start_time, end_time
    INTO p_slot_id, p_start_time, p_end_time
    FROM time_slots
    WHERE doctor_id = p_doctor_id
      AND slot_date = p_date
      AND slot_status = 'AVAILABLE'
      AND slot_duration >= p_duration_needed
    ORDER BY start_time ASC  -- Greedy: earliest first
    LIMIT 1;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Find optimal slot with load balancing
-- Algorithm: Greedy load balancing + First-fit slot selection
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_find_optimal_slot_load_balanced(
    IN p_department_id INT,
    IN p_date DATE,
    IN p_duration_needed INT,
    OUT p_doctor_id INT,
    OUT p_slot_id INT,
    OUT p_start_time TIME
)
BEGIN
    -- Step 1: Find least loaded doctor in department (Greedy load balance)
    -- Step 2: Find first available slot for that doctor (Greedy first-fit)
    SELECT d.doctor_id, ts.slot_id, ts.start_time
    INTO p_doctor_id, p_slot_id, p_start_time
    FROM doctors d
    JOIN time_slots ts ON d.doctor_id = ts.doctor_id
    LEFT JOIN doctor_load dl ON d.doctor_id = dl.doctor_id AND dl.load_date = p_date
    WHERE d.department_id = p_department_id
      AND d.is_active = TRUE
      AND ts.slot_date = p_date
      AND ts.slot_status = 'AVAILABLE'
      AND ts.slot_duration >= p_duration_needed
    ORDER BY COALESCE(dl.utilization_percentage, 0) ASC,  -- Least loaded doctor first
             ts.start_time ASC                              -- Then earliest slot
    LIMIT 1;
END //

-- ============================================================================
-- PRIORITY QUEUE (MIN-HEAP) OPERATIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Calculate priority score
-- Formula: base - (urgency_weight × urgency) + (wait_weight × wait_time)
-- Lower score = Higher priority (Min-Heap)
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_calculate_priority(
    p_base_priority INT,
    p_urgency_level INT,
    p_wait_minutes INT
) RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE v_urgency_weight DECIMAL(5,2);
    DECLARE v_wait_weight DECIMAL(5,2);
    DECLARE v_priority DECIMAL(10,2);
    
    -- Get weights from config
    SELECT CAST(config_value AS DECIMAL(5,2)) INTO v_urgency_weight
    FROM system_config WHERE config_key = 'URGENCY_WEIGHT';
    
    SELECT CAST(config_value AS DECIMAL(5,2)) INTO v_wait_weight
    FROM system_config WHERE config_key = 'WAIT_TIME_WEIGHT';
    
    -- Priority formula: lower value = higher priority
    SET v_priority = p_base_priority 
                   - (v_urgency_weight * p_urgency_level) 
                   + (v_wait_weight * p_wait_minutes);
    
    RETURN v_priority;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Patient Check-in (Heap Insert) - O(log n)
-- Algorithm: Insert into priority queue and maintain heap property
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_checkin_patient(
    IN p_appointment_id INT,
    OUT p_queue_position INT,
    OUT p_token_number VARCHAR(10),
    OUT p_estimated_wait INT
)
BEGIN
    DECLARE v_doctor_id INT;
    DECLARE v_patient_id INT;
    DECLARE v_urgency INT;
    DECLARE v_base_priority INT;
    DECLARE v_priority_score DECIMAL(10,2);
    DECLARE v_queue_count INT;
    
    -- Get appointment details
    SELECT doctor_id, patient_id, urgency_level, priority_level
    INTO v_doctor_id, v_patient_id, v_urgency, v_base_priority
    FROM appointments
    WHERE appointment_id = p_appointment_id;
    
    -- Calculate initial priority score (wait time = 0 at check-in)
    SET v_priority_score = fn_calculate_priority(v_base_priority, v_urgency, 0);
    
    -- Get current queue count for this doctor
    SELECT COUNT(*) + 1 INTO v_queue_count
    FROM live_queue
    WHERE doctor_id = v_doctor_id AND queue_status = 'WAITING';
    
    -- Generate token number
    SET p_token_number = CONCAT('T', LPAD(v_queue_count, 3, '0'));
    
    -- Estimate wait time
    CALL sp_estimate_wait_time(v_doctor_id, p_estimated_wait);
    
    -- Insert into queue (Heap Insert)
    INSERT INTO live_queue (
        appointment_id, doctor_id, patient_id,
        queue_position, priority_score, base_priority, urgency_level,
        checkin_time, estimated_wait_minutes, token_number
    ) VALUES (
        p_appointment_id, v_doctor_id, v_patient_id,
        v_queue_count, v_priority_score, v_base_priority, v_urgency,
        NOW(), p_estimated_wait, p_token_number
    );
    
    -- Update appointment status
    UPDATE appointments 
    SET status = 'CHECKED_IN', checkin_time = NOW()
    WHERE appointment_id = p_appointment_id;
    
    -- Rebalance queue (Heapify)
    CALL sp_reorder_queue(v_doctor_id);
    
    -- Return final position after reordering
    SELECT queue_position INTO p_queue_position
    FROM live_queue
    WHERE appointment_id = p_appointment_id;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Reorder Queue (Heapify) - O(n log n)
-- Algorithm: Recalculate priorities and reorder queue
-- Called after: check-in, priority change, time updates
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_reorder_queue(
    IN p_doctor_id INT
)
BEGIN
    DECLARE v_position INT DEFAULT 0;
    
    -- Recalculate priorities based on current wait times
    UPDATE live_queue lq
    SET priority_score = fn_calculate_priority(
        lq.base_priority,
        lq.urgency_level,
        TIMESTAMPDIFF(MINUTE, lq.checkin_time, NOW())
    )
    WHERE lq.doctor_id = p_doctor_id AND lq.queue_status = 'WAITING';
    
    -- Reassign positions based on priority (lower score = earlier position)
    -- This simulates heap reordering
    SET @row_num = 0;
    UPDATE live_queue
    SET queue_position = (@row_num := @row_num + 1)
    WHERE doctor_id = p_doctor_id AND queue_status = 'WAITING'
    ORDER BY priority_score ASC;  -- Min-Heap: lowest priority_score first
END //

-- ----------------------------------------------------------------------------
-- Procedure: Call Next Patient (Extract-Min) - O(log n)
-- Algorithm: Extract patient with minimum priority_score (highest priority)
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_call_next_patient(
    IN p_doctor_id INT,
    OUT p_appointment_id INT,
    OUT p_patient_name VARCHAR(100),
    OUT p_patient_uid VARCHAR(20),
    OUT p_token_number VARCHAR(10),
    OUT p_wait_time_minutes INT
)
BEGIN
    DECLARE v_queue_id INT;
    DECLARE v_patient_id INT;
    
    -- First, reorder queue to account for wait time changes
    CALL sp_reorder_queue(p_doctor_id);
    
    -- Extract-Min: Get patient with lowest priority_score (position 1)
    SELECT 
        lq.queue_id,
        lq.appointment_id,
        lq.patient_id,
        CONCAT(p.first_name, ' ', p.last_name),
        p.patient_uid,
        lq.token_number,
        TIMESTAMPDIFF(MINUTE, lq.checkin_time, NOW())
    INTO 
        v_queue_id,
        p_appointment_id,
        v_patient_id,
        p_patient_name,
        p_patient_uid,
        p_token_number,
        p_wait_time_minutes
    FROM live_queue lq
    JOIN patients p ON lq.patient_id = p.patient_id
    WHERE lq.doctor_id = p_doctor_id AND lq.queue_status = 'WAITING'
    ORDER BY lq.priority_score ASC
    LIMIT 1;
    
    IF v_queue_id IS NOT NULL THEN
        -- Update queue entry
        UPDATE live_queue
        SET queue_status = 'CALLED',
            called_at = NOW(),
            actual_wait_minutes = p_wait_time_minutes
        WHERE queue_id = v_queue_id;
        
        -- Update appointment
        UPDATE appointments
        SET status = 'IN_PROGRESS',
            consultation_start = NOW(),
            actual_wait_time = p_wait_time_minutes
        WHERE appointment_id = p_appointment_id;
        
        -- Reorder remaining queue
        CALL sp_reorder_queue(p_doctor_id);
    END IF;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Insert Emergency (Priority Boost) - O(log n)
-- Algorithm: Insert with extreme negative priority for instant queue top
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_insert_emergency(
    IN p_patient_id INT,
    IN p_doctor_id INT,
    IN p_reason TEXT,
    OUT p_appointment_id INT,
    OUT p_queue_position INT
)
BEGIN
    DECLARE v_emergency_priority INT;
    DECLARE v_slot_id INT;
    DECLARE v_token VARCHAR(10);
    DECLARE v_estimated_wait INT;
    
    -- Get emergency priority from config
    SELECT CAST(config_value AS SIGNED) INTO v_emergency_priority
    FROM system_config WHERE config_key = 'EMERGENCY_PRIORITY';
    
    -- Create emergency appointment
    INSERT INTO appointments (
        patient_id, doctor_id, appointment_date, start_time, end_time,
        appointment_type, priority_level, urgency_level, status, reason_for_visit
    ) VALUES (
        p_patient_id, p_doctor_id, CURDATE(), CURTIME(), ADDTIME(CURTIME(), '00:30:00'),
        'EMERGENCY', 1, 5, 'CHECKED_IN', p_reason
    );
    
    SET p_appointment_id = LAST_INSERT_ID();
    
    -- Generate emergency token
    SET v_token = CONCAT('E', LPAD(p_appointment_id, 3, '0'));
    
    -- Insert directly into queue with emergency priority
    INSERT INTO live_queue (
        appointment_id, doctor_id, patient_id,
        queue_position, priority_score, base_priority, urgency_level,
        checkin_time, estimated_wait_minutes, token_number, queue_status
    ) VALUES (
        p_appointment_id, p_doctor_id, p_patient_id,
        0, v_emergency_priority, 1, 5,  -- Emergency priority score
        NOW(), 2, v_token, 'WAITING'
    );
    
    -- Reorder queue - emergency will be at top due to negative priority
    CALL sp_reorder_queue(p_doctor_id);
    
    -- Get final position (should be 1)
    SELECT queue_position INTO p_queue_position
    FROM live_queue
    WHERE appointment_id = p_appointment_id;
END //

-- ============================================================================
-- WAIT TIME PREDICTION (DP + Historical Data)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Estimate Wait Time
-- Algorithm: Hybrid - Current queue state + Historical patterns (DP)
-- Time Complexity: O(1) with pre-computed statistics
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_estimate_wait_time(
    IN p_doctor_id INT,
    OUT p_estimated_minutes INT
)
BEGIN
    DECLARE v_queue_size INT;
    DECLARE v_avg_consultation DECIMAL(5,2);
    DECLARE v_current_estimate DECIMAL(10,2);
    DECLARE v_historical_avg DECIMAL(10,2);
    DECLARE v_current_weight DECIMAL(3,2);
    DECLARE v_history_weight DECIMAL(3,2);
    DECLARE v_day_name VARCHAR(10);
    DECLARE v_hour INT;
    
    -- Get weights from config
    SELECT CAST(config_value AS DECIMAL(3,2)) INTO v_current_weight
    FROM system_config WHERE config_key = 'PREDICTION_CURRENT_WEIGHT';
    
    SELECT CAST(config_value AS DECIMAL(3,2)) INTO v_history_weight
    FROM system_config WHERE config_key = 'PREDICTION_HISTORY_WEIGHT';
    
    -- Current state calculation
    SELECT COUNT(*) INTO v_queue_size
    FROM live_queue
    WHERE doctor_id = p_doctor_id AND queue_status = 'WAITING';
    
    SELECT COALESCE(AVG(actual_consultation_time), avg_consultation_time)
    INTO v_avg_consultation
    FROM doctors d
    LEFT JOIN appointments a ON d.doctor_id = a.doctor_id 
        AND a.status = 'COMPLETED' 
        AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    WHERE d.doctor_id = p_doctor_id
    GROUP BY d.doctor_id;
    
    SET v_current_estimate = v_queue_size * COALESCE(v_avg_consultation, 15);
    
    -- Historical prediction (DP lookup)
    SET v_day_name = UPPER(DAYNAME(CURDATE()));
    SET v_hour = HOUR(NOW());
    
    SELECT COALESCE(AVG(wait_time_minutes), v_current_estimate)
    INTO v_historical_avg
    FROM queue_history
    WHERE doctor_id = p_doctor_id
      AND day_of_week = v_day_name
      AND hour_of_day = v_hour
      AND queue_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
    
    -- Weighted average (60% current, 40% historical by default)
    SET p_estimated_minutes = ROUND(
        v_current_weight * v_current_estimate + 
        v_history_weight * v_historical_avg
    );
END //

-- ----------------------------------------------------------------------------
-- Function: Estimate wait time (for query use)
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_estimate_wait_time(
    p_doctor_id INT
) RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_result INT;
    CALL sp_estimate_wait_time(p_doctor_id, v_result);
    RETURN COALESCE(v_result, 15);
END //

-- ============================================================================
-- NO-SHOW PREDICTION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Predict no-show probability
-- Algorithm: Weighted feature combination
-- Time Complexity: O(1) with pre-computed features
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_predict_noshow(
    p_appointment_id INT
) RETURNS DECIMAL(3,2)
READS SQL DATA
BEGIN
    DECLARE v_patient_rate DECIMAL(3,2);
    DECLARE v_day_rate DECIMAL(3,2);
    DECLARE v_hour_rate DECIMAL(3,2);
    DECLARE v_advance_days INT;
    DECLARE v_advance_factor DECIMAL(3,2);
    DECLARE v_probability DECIMAL(3,2);
    DECLARE v_day_name VARCHAR(10);
    DECLARE v_hour INT;
    
    -- Get appointment details
    SELECT 
        p.noshow_rate,
        DATEDIFF(a.appointment_date, DATE(a.booked_at)),
        UPPER(DAYNAME(a.appointment_date)),
        HOUR(a.start_time)
    INTO v_patient_rate, v_advance_days, v_day_name, v_hour
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    WHERE a.appointment_id = p_appointment_id;
    
    -- Get day-of-week no-show rate
    SELECT COALESCE(
        SUM(CASE WHEN was_noshow THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        0.20
    ) INTO v_day_rate
    FROM queue_history
    WHERE day_of_week = v_day_name;
    
    -- Get hour no-show rate
    SELECT COALESCE(
        SUM(CASE WHEN was_noshow THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        0.20
    ) INTO v_hour_rate
    FROM queue_history
    WHERE hour_of_day = v_hour;
    
    -- Advance booking factor (more days = higher risk)
    SET v_advance_factor = LEAST(v_advance_days / 30.0, 1.0) * 0.3;
    
    -- Weighted probability calculation
    SET v_probability = 
        0.4 * COALESCE(v_patient_rate, 0.20) +
        0.2 * COALESCE(v_day_rate, 0.20) +
        0.2 * COALESCE(v_hour_rate, 0.20) +
        0.2 * v_advance_factor;
    
    RETURN LEAST(v_probability, 1.0);
END //

-- ----------------------------------------------------------------------------
-- Procedure: Update no-show predictions for upcoming appointments
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_update_noshow_predictions()
BEGIN
    UPDATE appointments
    SET noshow_probability = fn_predict_noshow(appointment_id)
    WHERE status IN ('SCHEDULED', 'CONFIRMED')
      AND appointment_date >= CURDATE()
      AND appointment_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY);
END //

-- ============================================================================
-- LOAD BALANCING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Get least loaded doctor in department
-- Algorithm: Greedy - select doctor with minimum utilization
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_get_least_loaded_doctor(
    IN p_department_id INT,
    IN p_date DATE,
    OUT p_doctor_id INT,
    OUT p_utilization DECIMAL(5,2)
)
BEGIN
    SELECT d.doctor_id, COALESCE(dl.utilization_percentage, 0)
    INTO p_doctor_id, p_utilization
    FROM doctors d
    LEFT JOIN doctor_load dl ON d.doctor_id = dl.doctor_id AND dl.load_date = p_date
    WHERE d.department_id = p_department_id
      AND d.is_active = TRUE
    ORDER BY COALESCE(dl.utilization_percentage, 0) ASC
    LIMIT 1;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Update doctor load statistics
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_update_doctor_load(
    IN p_doctor_id INT,
    IN p_date DATE
)
BEGIN
    DECLARE v_total_slots INT;
    DECLARE v_booked INT;
    DECLARE v_completed INT;
    DECLARE v_total_minutes INT;
    
    -- Count slots
    SELECT COUNT(*) INTO v_total_slots
    FROM time_slots
    WHERE doctor_id = p_doctor_id AND slot_date = p_date;
    
    -- Count booked
    SELECT COUNT(*) INTO v_booked
    FROM time_slots
    WHERE doctor_id = p_doctor_id AND slot_date = p_date AND slot_status = 'BOOKED';
    
    -- Count completed
    SELECT COUNT(*), COALESCE(SUM(actual_consultation_time), 0)
    INTO v_completed, v_total_minutes
    FROM appointments
    WHERE doctor_id = p_doctor_id AND appointment_date = p_date AND status = 'COMPLETED';
    
    -- Upsert load record
    INSERT INTO doctor_load (
        doctor_id, load_date, total_slots, booked_slots, 
        completed_appointments, total_consultation_minutes, utilization_percentage
    ) VALUES (
        p_doctor_id, p_date, v_total_slots, v_booked,
        v_completed, v_total_minutes,
        CASE WHEN v_total_slots > 0 THEN (v_booked * 100.0 / v_total_slots) ELSE 0 END
    )
    ON DUPLICATE KEY UPDATE
        total_slots = v_total_slots,
        booked_slots = v_booked,
        completed_appointments = v_completed,
        total_consultation_minutes = v_total_minutes,
        utilization_percentage = CASE WHEN v_total_slots > 0 THEN (v_booked * 100.0 / v_total_slots) ELSE 0 END;
END //

-- ============================================================================
-- CONSULTATION COMPLETION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Complete consultation and record metrics
-- Updates: queue history, patient stats, doctor load
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_complete_consultation(
    IN p_appointment_id INT,
    IN p_consultation_notes TEXT
)
BEGIN
    DECLARE v_doctor_id INT;
    DECLARE v_patient_id INT;
    DECLARE v_wait_time INT;
    DECLARE v_consultation_time INT;
    DECLARE v_queue_size INT;
    DECLARE v_day_name VARCHAR(10);
    DECLARE v_hour INT;
    DECLARE v_apt_type VARCHAR(20);
    
    -- Get appointment details
    SELECT doctor_id, patient_id, appointment_type,
           TIMESTAMPDIFF(MINUTE, checkin_time, consultation_start),
           TIMESTAMPDIFF(MINUTE, consultation_start, NOW())
    INTO v_doctor_id, v_patient_id, v_apt_type, v_wait_time, v_consultation_time
    FROM appointments
    WHERE appointment_id = p_appointment_id;
    
    -- Update appointment
    UPDATE appointments
    SET status = 'COMPLETED',
        consultation_end = NOW(),
        actual_consultation_time = v_consultation_time,
        doctor_notes = p_consultation_notes
    WHERE appointment_id = p_appointment_id;
    
    -- Update queue
    UPDATE live_queue
    SET queue_status = 'COMPLETED'
    WHERE appointment_id = p_appointment_id;
    
    -- Record in history (for prediction model training)
    SET v_day_name = UPPER(DAYNAME(CURDATE()));
    SET v_hour = HOUR(NOW());
    
    SELECT COUNT(*) INTO v_queue_size
    FROM live_queue WHERE doctor_id = v_doctor_id AND queue_status = 'WAITING';
    
    INSERT INTO queue_history (
        doctor_id, appointment_id, patient_id, queue_date,
        day_of_week, hour_of_day, appointment_type,
        wait_time_minutes, consultation_minutes, queue_size_at_checkin
    ) VALUES (
        v_doctor_id, p_appointment_id, v_patient_id, CURDATE(),
        v_day_name, v_hour, v_apt_type,
        COALESCE(v_wait_time, 0), v_consultation_time, v_queue_size
    );
    
    -- Update doctor load
    CALL sp_update_doctor_load(v_doctor_id, CURDATE());
    
    -- Update patient total appointments
    UPDATE patients
    SET total_appointments = total_appointments + 1
    WHERE patient_id = v_patient_id;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Mark no-show
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_mark_noshow(
    IN p_appointment_id INT
)
BEGIN
    DECLARE v_patient_id INT;
    DECLARE v_doctor_id INT;
    DECLARE v_day_name VARCHAR(10);
    DECLARE v_hour INT;
    
    SELECT patient_id, doctor_id INTO v_patient_id, v_doctor_id
    FROM appointments WHERE appointment_id = p_appointment_id;
    
    -- Update appointment
    UPDATE appointments
    SET status = 'NO_SHOW'
    WHERE appointment_id = p_appointment_id;
    
    -- Update slot
    UPDATE time_slots ts
    JOIN appointments a ON ts.slot_id = a.slot_id
    SET ts.slot_status = 'AVAILABLE'
    WHERE a.appointment_id = p_appointment_id;
    
    -- Update patient no-show count
    UPDATE patients
    SET noshow_count = noshow_count + 1,
        total_appointments = total_appointments + 1,
        noshow_rate = (noshow_count + 1) / (total_appointments + 1)
    WHERE patient_id = v_patient_id;
    
    -- Record in history
    SET v_day_name = UPPER(DAYNAME(CURDATE()));
    SET v_hour = HOUR(NOW());
    
    INSERT INTO queue_history (
        doctor_id, appointment_id, patient_id, queue_date,
        day_of_week, hour_of_day, wait_time_minutes, 
        consultation_minutes, was_noshow
    ) VALUES (
        v_doctor_id, p_appointment_id, v_patient_id, CURDATE(),
        v_day_name, v_hour, 0, 0, TRUE
    );
    
    -- Notify waitlist patients
    CALL sp_notify_waitlist(v_doctor_id, CURDATE());
END //

-- ============================================================================
-- WAITLIST MANAGEMENT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Procedure: Notify waitlist patients about available slot
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_notify_waitlist(
    IN p_doctor_id INT,
    IN p_date DATE
)
BEGIN
    DECLARE v_waitlist_id INT;
    DECLARE v_patient_id INT;
    DECLARE v_slot_id INT;
    
    -- Find first waiting patient for this doctor/date
    SELECT w.waitlist_id, w.patient_id, ts.slot_id
    INTO v_waitlist_id, v_patient_id, v_slot_id
    FROM waitlist w
    JOIN time_slots ts ON w.doctor_id = ts.doctor_id 
        AND w.preferred_date = ts.slot_date
        AND ts.slot_status = 'AVAILABLE'
        AND ts.start_time >= COALESCE(w.preferred_time_start, '00:00:00')
        AND ts.end_time <= COALESCE(w.preferred_time_end, '23:59:59')
    WHERE w.doctor_id = p_doctor_id
      AND w.preferred_date = p_date
      AND w.status = 'WAITING'
    ORDER BY w.priority DESC, w.created_at ASC
    LIMIT 1;
    
    IF v_waitlist_id IS NOT NULL THEN
        -- Update waitlist entry
        UPDATE waitlist
        SET status = 'OFFERED', offered_slot_id = v_slot_id
        WHERE waitlist_id = v_waitlist_id;
        
        -- Create notification
        INSERT INTO notifications (
            patient_id, notification_type, message, scheduled_time
        ) VALUES (
            v_patient_id, 'RESCHEDULE',
            CONCAT('A slot has become available for your preferred date. Please book within 1 hour.'),
            NOW()
        );
    END IF;
END //

-- ============================================================================
-- PATIENT UID VERIFICATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Verify patient UID (Hash lookup) - O(1)
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_verify_patient_uid(
    p_uid VARCHAR(20)
) RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_patient_id INT;
    
    SELECT patient_id INTO v_patient_id
    FROM patients
    WHERE patient_uid = p_uid AND is_active = TRUE;
    
    RETURN v_patient_id;
END //

-- ----------------------------------------------------------------------------
-- Procedure: Check-in with UID verification
-- ----------------------------------------------------------------------------
CREATE PROCEDURE sp_checkin_with_verification(
    IN p_appointment_id INT,
    IN p_patient_uid VARCHAR(20),
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(200),
    OUT p_queue_position INT,
    OUT p_token VARCHAR(10)
)
BEGIN
    DECLARE v_expected_patient_id INT;
    DECLARE v_provided_patient_id INT;
    DECLARE v_estimated_wait INT;
    
    -- Get expected patient from appointment
    SELECT patient_id INTO v_expected_patient_id
    FROM appointments
    WHERE appointment_id = p_appointment_id;
    
    -- Verify UID
    SET v_provided_patient_id = fn_verify_patient_uid(p_patient_uid);
    
    IF v_provided_patient_id IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'Invalid Patient UID';
    ELSEIF v_provided_patient_id != v_expected_patient_id THEN
        SET p_success = FALSE;
        SET p_message = 'Patient UID does not match appointment record';
        
        -- Log security event
        INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value)
        VALUES ('VERIFICATION_FAILED', 'APPOINTMENT', p_appointment_id, 
                v_expected_patient_id, p_patient_uid);
    ELSE
        -- Verification successful, proceed with check-in
        CALL sp_checkin_patient(p_appointment_id, p_queue_position, p_token, v_estimated_wait);
        SET p_success = TRUE;
        SET p_message = CONCAT('Check-in successful. Estimated wait: ', v_estimated_wait, ' minutes');
    END IF;
END //

-- ============================================================================
-- CONFLICT DETECTION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Check for scheduling conflicts (Interval overlap)
-- ----------------------------------------------------------------------------
CREATE FUNCTION fn_has_conflict(
    p_doctor_id INT,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_appointment_id INT
) RETURNS BOOLEAN
READS SQL DATA
BEGIN
    DECLARE v_conflict_count INT;
    
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND appointment_id != COALESCE(p_exclude_appointment_id, 0)
      AND status NOT IN ('CANCELLED', 'NO_SHOW')
      AND start_time < p_end_time
      AND end_time > p_start_time;
    
    RETURN v_conflict_count > 0;
END //

DELIMITER ;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Procedures & Functions Created: 20
--
-- Slot Generation:
--   - sp_generate_time_slots
--
-- Greedy Algorithm:
--   - sp_find_optimal_slot (Activity Selection)
--   - sp_find_optimal_slot_load_balanced
--
-- Priority Queue (Heap):
--   - fn_calculate_priority
--   - sp_checkin_patient (Heap Insert)
--   - sp_reorder_queue (Heapify)
--   - sp_call_next_patient (Extract-Min)
--   - sp_insert_emergency (Priority Boost)
--
-- Wait Time Prediction (DP):
--   - sp_estimate_wait_time
--   - fn_estimate_wait_time
--
-- No-show Prediction:
--   - fn_predict_noshow
--   - sp_update_noshow_predictions
--
-- Load Balancing:
--   - sp_get_least_loaded_doctor
--   - sp_update_doctor_load
--
-- Consultation:
--   - sp_complete_consultation
--   - sp_mark_noshow
--
-- Waitlist:
--   - sp_notify_waitlist
--
-- Verification:
--   - fn_verify_patient_uid (Hash O(1))
--   - sp_checkin_with_verification
--
-- Conflict Detection:
--   - fn_has_conflict (Interval overlap)
-- ============================================================================
