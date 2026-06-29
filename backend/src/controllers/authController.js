const authService = require('../services/authService');
const logger = require('../config/logger');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);
            res.json(result);
        } catch (error) {
            logger.error('[Login Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async register(req, res) {
        try {
            const result = await authService.registerPatient(req.body);
            res.status(201).json(result);
        } catch (error) {
            logger.error('[Registration Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const result = await authService.forgotPassword(email);
            res.json(result);
        } catch (error) {
            logger.error('[Forgot Password Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { email, otp, newPassword } = req.body;
            const result = await authService.resetPassword(email, otp, newPassword);
            res.json(result);
        } catch (error) {
            logger.error('[Reset Password Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }

    async googleLogin(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ message: 'Google token is required' });
            }
            const result = await authService.googleLogin(token);
            res.json(result);
        } catch (error) {
            logger.error('[Google Login Error]', error);
            res.status(error.status || 500).json({ message: error.message || 'Server error' });
        }
    }
}

module.exports = new AuthController();
