package com.hospital;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Patient Appointment Scheduling System
 * 
 * A DSA-based healthcare scheduling system using:
 * - Greedy Algorithm (Activity Selection) for optimal slot allocation
 * - Priority Queue (Min-Heap) for real-time patient queue management
 * - Dynamic Programming for wait time prediction
 * - Predictive Model for no-show probability estimation
 * - Load Balancing (Greedy) for even doctor utilization
 * - Hash Map for O(1) patient UID verification
 * - Interval Scheduling for conflict detection
 *
 * @author Archit Mittal
 */
@SpringBootApplication
@EnableScheduling
public class AppointmentSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(AppointmentSystemApplication.class, args);
    }
}
