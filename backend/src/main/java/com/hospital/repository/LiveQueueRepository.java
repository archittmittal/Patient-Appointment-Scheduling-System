package com.hospital.repository;

import com.hospital.model.LiveQueue;
import com.hospital.model.enums.QueueStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveQueueRepository extends JpaRepository<LiveQueue, Integer> {

    /**
     * Extract-Min operation — find the patient with the LOWEST priority score.
     * In a Min-Heap, the root node has the minimum key.
     * Lower priority_score = Higher priority (emergency = -100).
     *
     * DSA: Priority Queue Extract-Min — O(log n) conceptually, O(1) with SQL ORDER BY + LIMIT.
     */
    Optional<LiveQueue> findFirstByDoctor_DoctorIdAndQueueStatusOrderByPriorityScoreAsc(
            Integer doctorId, QueueStatus status);

    /**
     * Get all waiting patients for a doctor ordered by priority (Min-Heap order).
     * This represents the full heap contents, ordered.
     */
    List<LiveQueue> findByDoctor_DoctorIdAndQueueStatusOrderByPriorityScoreAsc(
            Integer doctorId, QueueStatus status);

    /** Find queue entry by appointment ID */
    Optional<LiveQueue> findByAppointment_AppointmentId(Integer appointmentId);

    /** Count waiting patients for a doctor (queue size) */
    long countByDoctor_DoctorIdAndQueueStatus(Integer doctorId, QueueStatus status);

    /** Find patient currently in consultation */
    Optional<LiveQueue> findByDoctor_DoctorIdAndQueueStatus(Integer doctorId, QueueStatus status);

    /**
     * Heapify — reassign queue positions based on priority score order.
     * After any priority change (check-in, emergency, time-based aging),
     * this effectively rebuilds the heap.
     *
     * DSA: Heapify operation — O(n log n) rebuild of the priority queue.
     * We fetch all waiting entries, recalculate priorities, and reassign positions.
     */
    List<LiveQueue> findByDoctor_DoctorIdAndQueueStatusOrderByQueuePositionAsc(
            Integer doctorId, QueueStatus status);

    /** Check if appointment is already in queue */
    boolean existsByAppointment_AppointmentId(Integer appointmentId);
}
