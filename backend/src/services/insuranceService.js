/**
 * Issue #150: Smart Insurance Service
 * Manages insurance providers, patient policies, and eligibility verification.
 */

const db = require('../config/db');

class InsuranceService {
    constructor() {
        // Ensure methods are bound to this instance
        this.getProviders = this.getProviders.bind(this);
        this.getPatientInsurance = this.getPatientInsurance.bind(this);
        this.saveInsurance = this.saveInsurance.bind(this);
        this.verifyEligibility = this.verifyEligibility.bind(this);
        this._mockVerify = this._mockVerify.bind(this);
        this._realVerify = this._realVerify.bind(this);
        this.getAllPolicies = this.getAllPolicies.bind(this);
        this.getAdminStats = this.getAdminStats.bind(this);
    }

    /**
     * Get all active insurance providers
     */
    async getProviders() {
        const [providers] = await db.query(
            'SELECT id, name, contact_email FROM insurance_providers WHERE is_active = TRUE ORDER BY name ASC'
        );
        return providers;
    }

    /**
     * Get insurance details for a patient
     */
    async getPatientInsurance(patientId) {
        const [insurance] = await db.query(
            `SELECT pi.*, ip.name as provider_name 
             FROM patient_insurance pi
             JOIN insurance_providers ip ON pi.provider_id = ip.id
             WHERE pi.patient_id = ?`,
            [patientId]
        );
        return insurance;
    }

    /**
     * Save or update patient insurance
     */
    async saveInsurance(patientId, insuranceData) {
        const {
            providerId,
            memberId,
            groupId,
            planType,
            policyHolderName
        } = insuranceData;

        // Check if insurance already exists for this patient and provider
        const [existing] = await db.query(
            'SELECT id FROM patient_insurance WHERE patient_id = ? AND provider_id = ?',
            [patientId, providerId]
        );

        if (existing.length > 0) {
            // Fetch current status to check authority
            const [statusCheck] = await db.query('SELECT status, patient_id FROM patient_insurance WHERE id = ?', [existing[0].id]);
            
            // If already verified, we restrict updates to encourage Admin oversight as per request.
            if (statusCheck[0].status === 'VERIFIED') {
                throw new Error('This policy is already verified and locked. Please contact administration for any changes.');
            }

            // Update
            await db.query(
                `UPDATE patient_insurance 
                 SET member_id = ?, group_id = ?, plan_type = ?, policy_holder_name = ?, status = 'PENDING'
                 WHERE id = ?`,
                [memberId, groupId, planType, policyHolderName, existing[0].id]
            );
            return { id: existing[0].id, action: 'UPDATED' };
        } else {
            // Insert
            const [result] = await db.query(
                `INSERT INTO patient_insurance 
                    (patient_id, provider_id, member_id, group_id, plan_type, policy_holder_name, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
                [patientId, providerId, memberId, groupId, planType, policyHolderName]
            );
            return { id: result.insertId, action: 'CREATED' };
        }
    }

    /**
     * Verify insurance eligibility
     * Uses a Strategy Pattern approach (Mock vs Real API)
     */
    async verifyEligibility(insuranceId) {
        // Fetch insurance and provider details
        const [insurance] = await db.query(
            `SELECT pi.*, ip.api_endpoint, ip.api_key_env_var, ip.name as provider_name
             FROM patient_insurance pi
             JOIN insurance_providers ip ON pi.provider_id = ip.id
             WHERE pi.id = ?`,
            [insuranceId]
        );

        if (insurance.length === 0) {
            throw new Error('Insurance record not found');
        }

        const policy = insurance[0];
        const useMock = process.env.INSURANCE_PROVIDER_MODE !== 'PRODUCTION';

        let verificationResult;

        if (useMock) {
            verificationResult = await this._mockVerify(policy);
        } else {
            verificationResult = await this._realVerify(policy);
        }

        // Update status in DB
        await db.query(
            `UPDATE patient_insurance 
             SET status = ?, last_verified_at = NOW() 
             WHERE id = ?`,
            [verificationResult.status, insuranceId]
        );

        return {
            ...verificationResult,
            provider: policy.provider_name,
            memberId: policy.member_id
        };
    }

    /**
     * Mock verification logic for development
     */
    async _mockVerify(policy) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const memberId = policy.member_id.toUpperCase();
        
        // Mock rules:
        // IDs ending in '99' are EXPIRED
        // IDs starting with 'ERR' fail
        // All others are ACTIVE
        
        if (memberId.startsWith('ERR')) {
            return { status: 'PENDING', message: 'Verification service unavailable', verified: false };
        }

        if (memberId.endsWith('99')) {
            return { status: 'EXPIRED', message: 'Policy expired on 2024-01-01', verified: true };
        }

        return { 
            status: 'VERIFIED', 
            message: 'Policy active. Copay: $25.00', 
            verified: true,
            details: {
                copay: 25.00,
                deductibleRemaining: 450.00,
                isPrimary: true
            }
        };
    }

    /**
     * Placeholder for real API integration (e.g., Change Healthcare)
     */
    async _realVerify(policy) {
        // This would use axios to call policy.api_endpoint with policy.api_key_env_var
        // For now, it defaults to a message
        return { status: 'PENDING', message: 'Real API integration not configured', verified: false };
    }

    /**
     * Get all insurance policies (Admin only)
     */
    async getAllPolicies() {
        const [policies] = await db.query(`
            SELECT pi.*, ip.name as provider_name, 
                   CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM patient_insurance pi
            JOIN insurance_providers ip ON pi.provider_id = ip.id
            JOIN patients p ON pi.patient_id = p.id
            ORDER BY pi.created_at DESC
        `);
        return policies;
    }

    /**
     * Get insurance analytics/stats (Admin only)
     */
    async getAdminStats() {
        const [providerStats] = await db.query(`
            SELECT ip.name, COUNT(pi.id) as count
            FROM insurance_providers ip
            LEFT JOIN patient_insurance pi ON ip.id = pi.provider_id
            GROUP BY ip.id
        `);

        const [statusStats] = await db.query(`
            SELECT status, COUNT(*) as count
            FROM patient_insurance
            GROUP BY status
        `);

        const [recentVerifications] = await db.query(`
            SELECT pi.last_verified_at, ip.name as provider_name, 
                   CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                   pi.status
            FROM patient_insurance pi
            JOIN insurance_providers ip ON pi.provider_id = ip.id
            JOIN patients p ON pi.patient_id = p.id
            WHERE pi.last_verified_at IS NOT NULL
            ORDER BY pi.last_verified_at DESC
            LIMIT 5
        `);

        return {
            byProvider: providerStats,
            byStatus: statusStats,
            recentVerifications
        };
    }
}

module.exports = new InsuranceService();
