package com.hospital.repository;

import com.hospital.model.User;
import com.hospital.model.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    Optional<User> findByUsernameAndIsActiveTrue(String username);

    Optional<User> findByEmailAndIsActiveTrue(String email);

    Optional<User> findByRoleAndReferenceId(UserRole role, Integer referenceId);

    boolean existsByUsername(String username);
}
