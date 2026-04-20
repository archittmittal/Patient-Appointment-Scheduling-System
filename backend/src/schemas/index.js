const Joi = require('joi');

const authSchemas = {
    register: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        first_name: Joi.string().required(),
        last_name: Joi.string().required(),
        dob: Joi.date().iso().allow(null, ''),
        phone: Joi.string().allow(''),
        blood_group: Joi.string().allow(''),
        address: Joi.string().allow('')
    }),
    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    })
};


const appointmentSchemas = {
    book: Joi.object({
        doctorId: Joi.number().integer().required(),
        date: Joi.date().iso().required(),
        timeSlot: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        symptoms: Joi.string().max(500).allow(''),
        patientId: Joi.number().integer() // Required if caller is ADMIN/DOCTOR
    })
};

const patientSchemas = {
    updateProfile: Joi.object({
        first_name: Joi.string().max(50).optional(),
        last_name: Joi.string().max(50).optional(),
        phone: Joi.string().pattern(/^[0-9+ ]+$/).max(15).optional(),
        address: Joi.string().max(255).optional(),
        blood_group: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional()
    }),
    logVitals: Joi.object({
        blood_pressure: Joi.string().pattern(/^\d{2,3}\/\d{2,3}$/).optional(),
        temperature: Joi.number().min(30).max(45).optional(),
        pulse: Joi.number().integer().min(30).max(250).optional(),
        weight: Joi.number().min(1).max(500).optional(),
        height: Joi.number().min(30).max(300).optional()
    })
};

const doctorSchemas = {
    updateProfile: Joi.object({
        first_name: Joi.string().max(50).optional(),
        last_name: Joi.string().max(50).optional(),
        specialty: Joi.string().max(100).optional(),
        degree: Joi.string().max(100).optional(),
        experience_years: Joi.number().integer().min(0).optional(),
        about: Joi.string().max(1000).optional(),
        location_room: Joi.string().max(50).optional(),
        image_url: Joi.string().uri().optional(),
        max_patients_per_slot: Joi.number().integer().min(1).max(50).optional()
    }),
    updateAvailability: Joi.object({
        availability: Joi.object().required() // Flexible JSON for now
    }),
    setDelay: Joi.object({
        delayMins: Joi.number().integer().min(0).required(),
        reason: Joi.string().max(255).allow(''),
        date: Joi.date().iso().optional()
    })
};

module.exports = { authSchemas, appointmentSchemas, patientSchemas, doctorSchemas };


