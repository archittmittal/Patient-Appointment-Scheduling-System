const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');
const adminUserService = require('../services/adminUserService');
const logger = require('../config/logger');

const addDoctorSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().max(50).required(),
    last_name: Joi.string().max(50).required(),
    specialty: Joi.string().max(100).required(),
    degree: Joi.string().max(100).allow('', null),
    experience_years: Joi.number().min(0).max(100).allow('', null),
    location_room: Joi.string().max(20).allow('', null)
});

const addPatientSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().max(50).required(),
    last_name: Joi.string().max(50).required(),
    dob: Joi.string().isoDate().allow('', null),
    phone: Joi.string().max(20).allow('', null),
    blood_group: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').allow('', null),
    address: Joi.string().max(255).allow('', null)
});

const usersQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('PATIENT', 'DOCTOR', 'ADMIN', 'ALL').default('ALL'),
    sort_by: Joi.string().valid('id', 'name', 'created_at', 'role').default('id'),
    order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC')
});

const patientsListQuerySchema = Joi.object({
    cursor: Joi.number().integer().min(0).default(0),
    limit: Joi.number().integer().min(1).max(50).default(50)
});

const searchPatientsQuerySchema = Joi.object({
    q: Joi.string().allow('', null).default('')
});

// All admin user routes require authenticate + requireRole('ADMIN')
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/admin/patients/list
router.get('/patients/list', validateRequest(patientsListQuerySchema, 'query'), async (req, res) => {
    try {
        const { cursor, limit } = req.query;
        const result = await adminUserService.listPatients(parseInt(cursor), parseInt(limit));
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/users
router.get('/users', validateRequest(usersQuerySchema, 'query'), async (req, res) => {
    try {
        const { page, limit, role, sort_by, order } = req.query;
        const result = await adminUserService.listUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            role,
            sort_by,
            order
        });
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/doctors
router.post('/doctors', validateRequest(addDoctorSchema), async (req, res) => {
    try {
        const newId = await adminUserService.addDoctor(req.body);
        res.status(201).json({ message: 'Doctor added successfully', id: newId });
    } catch (error) {
        logger.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/doctors/:id
router.delete('/doctors/:id', async (req, res) => {
    try {
        await adminUserService.deleteDoctor(parseInt(req.params.id));
        res.json({ message: 'Doctor removed' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/patients
router.post('/patients', validateRequest(addPatientSchema), async (req, res) => {
    try {
        const newId = await adminUserService.addPatient(req.body);
        res.status(201).json({ message: 'Patient added successfully', id: newId });
    } catch (error) {
        logger.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/patients/:id
router.delete('/patients/:id', async (req, res) => {
    try {
        await adminUserService.deletePatient(parseInt(req.params.id));
        res.json({ message: 'Patient removed' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/patients/search
router.get('/patients/search', validateRequest(searchPatientsQuerySchema, 'query'), async (req, res) => {
    try {
        const query = req.query.q || '';
        const results = await adminUserService.searchPatients(query);
        res.json(results);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
