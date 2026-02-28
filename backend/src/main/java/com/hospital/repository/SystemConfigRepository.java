package com.hospital.repository;

import com.hospital.model.SystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SystemConfigRepository extends JpaRepository<SystemConfig, Integer> {

    /**
     * Lookup algorithm configuration parameter by key.
     * Keys include: URGENCY_WEIGHT, WAIT_TIME_WEIGHT, EMERGENCY_PRIORITY,
     * PREDICTION_CURRENT_WEIGHT, PREDICTION_HISTORY_WEIGHT, NOSHOW_THRESHOLD, etc.
     */
    Optional<SystemConfig> findByConfigKey(String configKey);
}
