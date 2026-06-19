class AbhaService {
    /**
     * Validate the format of an ABHA Number (14 digits, optional hyphens)
     */
    validateAbhaNumber(number) {
        if (!number) return false;
        // Strip hyphens and check if it's 14 digits
        const stripped = number.replace(/-/g, '');
        if (!/^\d{14}$/.test(stripped)) {
            return false;
        }
        // If it had hyphens, ensure it strictly matches the XX-XXXX-XXXX-XXXX format
        if (number.includes('-')) {
            return /^\d{2}-\d{4}-\d{4}-\d{4}$/.test(number);
        }
        return true;
    }

    /**
     * Validate the format of an ABHA Address/ID (e.g. username@abdm)
     */
    validateAbhaAddress(address) {
        if (!address) return false;
        // ABDM standard suffix domains: @abdm, @ndhm, @sbx (sandbox)
        return /^[a-zA-Z0-9_\-\.]+@(abdm|ndhm|sbx)$/.test(address);
    }

    /**
     * Simulate verification with national ABDM registry
     */
    async verifyWithRegistry(abhaId, abhaNumber) {
        // If both are provided, both must be valid. If only one, that one must be valid.
        if (!abhaId && !abhaNumber) {
            return { verified: false, error: 'At least ABHA ID or ABHA Number must be provided' };
        }

        if (abhaId && !this.validateAbhaAddress(abhaId)) {
            return { verified: false, error: 'Invalid ABHA ID format' };
        }

        if (abhaNumber && !this.validateAbhaNumber(abhaNumber)) {
            return { verified: false, error: 'Invalid ABHA Number format' };
        }

        // Mock verification response
        // In a real sandbox, this would request the ABDM API
        return {
            verified: true,
            abhaId: abhaId || null,
            abhaNumber: abhaNumber || null,
            demographics: {
                name: 'John Doe',
                gender: 'M',
                dob: '1990-05-15',
                phone: '+919999999999'
            }
        };
    }
}

module.exports = new AbhaService();
