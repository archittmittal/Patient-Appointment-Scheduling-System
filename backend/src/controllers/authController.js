const authService = require('../services/authService');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            res.json(result);
        } catch (error) {
            console.error('[Login Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async register(req, res) {
        try {
            const result = await authService.registerPatient(req.body);
            res.status(201).json(result);
        } catch (error) {
            console.error('[Registration Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const result = await authService.forgotPassword(email);
            res.json(result);
        } catch (error) {
            console.error('[Forgot Password Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { email, otp, newPassword } = req.body;
            const result = await authService.resetPassword(email, otp, newPassword);
            res.json(result);
        } catch (error) {
            console.error('[Reset Password Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }
}

module.exports = new AuthController();
