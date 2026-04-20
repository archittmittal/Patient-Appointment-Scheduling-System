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


module.exports = { authSchemas, appointmentSchemas };
