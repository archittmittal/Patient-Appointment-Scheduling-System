const pool = require('../config/db');

/**
 * Handles notification templates and string processing
 */
const templateService = {
    /**
     * Get notification templates from database
     */
    async getTemplate(type) {
        const [[template]] = await pool.query(
            'SELECT * FROM notification_templates WHERE type = ?',
            [type]
        );
        return template;
    },

    /**
     * Replace template variables with actual values
     */
    processTemplate(template, data) {
        if (!template) return template;
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    }
};

module.exports = templateService;
