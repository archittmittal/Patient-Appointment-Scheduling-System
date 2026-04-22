-- Create doctor_profiles table (missing from Issue #43)
CREATE TABLE IF NOT EXISTS doctor_profiles (
    doctor_id INT PRIMARY KEY,
    specialty VARCHAR(100),
    floor_number INT,
    building VARCHAR(50),
    room_number VARCHAR(20),
    bio TEXT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Seed missing profiles if any doctors exist
INSERT IGNORE INTO doctor_profiles (doctor_id, specialty, floor_number, building, room_number)
SELECT id, specialty, 1, 'A', location_room FROM doctors;
