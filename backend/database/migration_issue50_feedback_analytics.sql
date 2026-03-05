-- Issue #50: Feedback Loop Analytics Migration
-- Run this to set up the Feedback Analytics tables

-- Main feedback table
CREATE TABLE IF NOT EXISTS appointment_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    ratings_json JSON NOT NULL COMMENT 'Category ratings as JSON',
    comment TEXT NULL COMMENT 'Optional text feedback',
    would_recommend BOOLEAN DEFAULT TRUE,
    improvements JSON NULL COMMENT 'Suggested improvement areas',
    weighted_score DECIMAL(3,2) DEFAULT 0 COMMENT 'Calculated weighted score 0-5',
    sentiment_score DECIMAL(3,2) DEFAULT 0.5 COMMENT 'Sentiment analysis score 0-1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_appointment_feedback (appointment_id),
    INDEX idx_doctor (doctor_id),
    INDEX idx_patient (patient_id),
    INDEX idx_created (created_at),
    INDEX idx_score (weighted_score),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Aggregated doctor ratings
CREATE TABLE IF NOT EXISTS doctor_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    avg_score DECIMAL(3,2) DEFAULT 0,
    total_reviews INT DEFAULT 0,
    recommend_rate DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentage who would recommend',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_doctor_rating (doctor_id),
    INDEX idx_score (avg_score),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Feedback response templates (for common issues)
CREATE TABLE IF NOT EXISTS feedback_response_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    trigger_score_max DECIMAL(3,2) NOT NULL COMMENT 'Show when score <= this',
    response_message TEXT NOT NULL,
    action_items JSON NULL COMMENT 'Suggested actions',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default response templates
INSERT INTO feedback_response_templates (category, trigger_score_max, response_message, action_items) VALUES
('wait_time', 2.5, 'We apologize for the long wait time. We are working to improve our scheduling.', '["Review appointment duration", "Add buffer time between appointments"]'),
('staff_behaviour', 2.5, 'We are sorry for any unprofessional behavior. This has been noted for staff training.', '["Staff training session", "Review protocols"]'),
('cleanliness', 3.0, 'Thank you for your feedback on cleanliness. We will address this immediately.', '["Increase cleaning frequency", "Inspect facility"]'),
('booking_ease', 3.0, 'We appreciate your feedback on the booking process. We are working on improvements.', '["Review booking flow", "Add more time slots"]'),
('doctor_quality', 2.5, 'We take your concerns about care quality seriously and will follow up.', '["Review case", "Follow up with patient"]'),
('overall_experience', 2.5, 'We truly apologize for your experience. We would love to make it right.', '["Manager follow-up call", "Offer priority rebooking"]')
ON DUPLICATE KEY UPDATE response_message = VALUES(response_message);

-- Initialize doctor ratings for existing doctors
INSERT IGNORE INTO doctor_ratings (doctor_id, avg_score, total_reviews, recommend_rate)
SELECT id, 0, 0, 0 FROM doctors;
