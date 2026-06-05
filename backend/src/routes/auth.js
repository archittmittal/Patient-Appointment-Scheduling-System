const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    // [SEC-005] Role field removed from public registration.
    // All self-registrations are PATIENT-only. ADMIN/DOCTOR accounts
    // must be provisioned through a dedicated admin panel.
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    phone: Joi.string().required(),
    dob: Joi.string().allow('', null),
    blood_group: Joi.string().allow('', null),
    address: Joi.string().allow('', null)
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and registration
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to the system
 *     tags: [Auth]
 */
router.post('/login', validateRequest(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new patient
 *     tags: [Auth]
 */
router.post('/register', validateRequest(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send OTP for password reset
 *     tags: [Auth]
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login with Google
 *     tags: [Auth]
 */
router.post('/google', validateRequest(Joi.object({ token: Joi.string().min(1).required() })), authController.googleLogin);

module.exports = router;
