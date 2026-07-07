const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');
const adminDepartmentService = require('../services/adminDepartmentService');
const logger = require('../config/logger');

const addDepartmentSchema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(1000).allow('', null)
});

// All admin department routes require authenticate + requireRole('ADMIN')
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /api/admin/departments
router.get('/departments', async (req, res) => {
    try {
        const result = await adminDepartmentService.getDepartments();
        res.json(result);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/departments
router.post('/departments', validateRequest(addDepartmentSchema), async (req, res) => {
    try {
        const result = await adminDepartmentService.addDepartment(req.body);
        res.status(201).json(result);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Department already exists' });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/departments/:id
router.delete('/departments/:id', async (req, res) => {
    try {
        await adminDepartmentService.deleteDepartment(parseInt(req.params.id));
        res.json({ message: 'Department deleted successfully' });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            return res.status(400).json({ message: 'Cannot delete department. There are doctors assigned to it.' });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
