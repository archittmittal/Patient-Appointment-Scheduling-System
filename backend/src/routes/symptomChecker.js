const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authenticate');
const dailyOptimizerService = require('../services/dailyOptimizerService');
const logger = require('../config/logger');

// Keyword Mapping Rules for Specialties
const SPECIALTY_MAPPINGS = {
    'Cardiologist': {
        primary: ['chest pain', 'heart', 'palpitations', 'shortness of breath', 'chest tightness'],
        secondary: ['breathing', 'dizziness', 'cardio', 'hypertension', 'blood pressure', 'pulse', 'racing pulse']
    },
    'Dermatologist': {
        primary: ['rash', 'skin', 'acne', 'itch', 'itchy', 'mole', 'eczema', 'hives'],
        secondary: ['burn', 'dryness', 'allergy', 'redness', 'lesion', 'spots']
    },
    'General Physician': {
        primary: ['fever', 'cold', 'cough', 'flu', 'sore throat', 'stomach ache', 'headache'],
        secondary: ['stomach', 'nausea', 'vomiting', 'diarrhea', 'fatigue', 'insomnia', 'body ache', 'weakness', 'routine', 'checkup', 'throat']
    }
};

/**
 * Helper: Extract clean words from text
 */
function cleanTextWords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z\s-]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
}

/**
 * POST /api/symptom-checker/analyze
 * Analyzes symptom description, maps it to a specialty, and suggests doctors with workloads
 */
router.post('/analyze', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Access denied. Only patients can analyze symptoms.' });
        }
        const { symptoms } = req.body;
        const patientId = req.user.id;

        if (!symptoms || symptoms.trim().length === 0) {
            return res.status(400).json({ error: 'Symptoms text is required' });
        }

        const words = cleanTextWords(symptoms);
        const textLower = symptoms.toLowerCase();

        // Initialize scores
        const scores = {
            'Cardiologist': 0,
            'Dermatologist': 0,
            'General Physician': 0
        };

        // Score based on exact primary phrases first
        for (const [specialty, keywords] of Object.entries(SPECIALTY_MAPPINGS)) {
            // Check primary phrases
            keywords.primary.forEach(phrase => {
                if (textLower.includes(phrase)) {
                    scores[specialty] += 5; // Higher weight for primary phrases
                }
            });

            // Check individual words
            words.forEach(word => {
                if (keywords.secondary.includes(word)) {
                    scores[specialty] += 2;
                }
            });
        }

        // Determine mapped specialty
        let mappedSpecialty = 'General Physician';
        let maxScore = 0;

        for (const [specialty, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                mappedSpecialty = specialty;
            }
        }

        // Generate dynamic explanation based on matched terms
        let matchedTerms = [];
        const keywordsList = [...SPECIALTY_MAPPINGS[mappedSpecialty].primary, ...SPECIALTY_MAPPINGS[mappedSpecialty].secondary];
        
        keywordsList.forEach(keyword => {
            if (textLower.includes(keyword) && !matchedTerms.includes(keyword)) {
                matchedTerms.push(keyword);
            }
        });

        const explanation = matchedTerms.length > 0
            ? `Matched symptoms (${matchedTerms.join(', ')}). We recommend consulting a ${mappedSpecialty}.`
            : `Symptoms matched general health patterns. We recommend starting with a ${mappedSpecialty}.`;

        // Log search telemetry in database
        await db.query(
            'INSERT INTO symptom_checker_logs (patient_id, symptoms_text, mapped_specialty) VALUES (?, ?, ?)',
            [patientId, symptoms, mappedSpecialty]
        );

        // Fetch doctors and their workloads
        const workloads = await dailyOptimizerService.getDoctorWorkloads();
        
        // Fetch matching doctors from DB (inc consultation_fee, rating, room details)
        const [docs] = await db.query(
            'SELECT id, first_name, last_name, specialty, rating, consultation_fee, location_room FROM doctors WHERE specialty = ?',
            [mappedSpecialty]
        );

        // Map workload details to recommended doctor records
        const suggestedDoctors = docs.map(doc => {
            const load = workloads.find(w => w.doctorId === doc.id);
            return {
                id: doc.id,
                name: `Dr. ${doc.first_name} ${doc.last_name}`,
                specialty: doc.specialty,
                rating: parseFloat(doc.rating || 0),
                consultationFee: parseFloat(doc.consultation_fee || 0),
                locationRoom: doc.location_room,
                estimatedWaitMins: load ? load.estimatedTotalMins : 0,
                queueLength: load ? load.patientCount : 0
            };
        }).sort((a, b) => a.estimatedWaitMins - b.estimatedWaitMins); // Sort by lowest wait time

        res.json({
            mappedSpecialty,
            explanation,
            suggestedDoctors
        });

    } catch (error) {
        logger.error('Symptom analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze symptoms' });
    }
});

/**
 * GET /api/symptom-checker/admin-stats
 * Admin telemetry data on symptom search logs and keywords
 */
router.get('/admin-stats', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        // 1. Specialty Distribution Stats
        const [specialtyDistribution] = await db.query(`
            SELECT mapped_specialty as specialty, COUNT(*) as count 
            FROM symptom_checker_logs 
            GROUP BY mapped_specialty
            ORDER BY count DESC
        `);

        // 2. Recent Search Logs
        const [recentLogs] = await db.query(`
            SELECT l.id, l.symptoms_text, l.mapped_specialty, l.created_at, 
                   CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM symptom_checker_logs l
            LEFT JOIN patients p ON l.patient_id = p.id
            ORDER BY l.created_at DESC
            LIMIT 15
        `);

        // 3. Keyword Frequency Extraction
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [allLogs] = await db.query(
            'SELECT symptoms_text FROM symptom_checker_logs WHERE created_at >= ? LIMIT 1000',
            [thirtyDaysAgo]
        );
        const keywordFreq = {};

        allLogs.forEach(log => {
            const words = cleanTextWords(log.symptoms_text);
            words.forEach(word => {
                // Ignore extremely common stop words
                const stopWords = ['and', 'the', 'for', 'with', 'have', 'from', 'this', 'was', 'that'];
                if (stopWords.includes(word)) return;
                
                keywordFreq[word] = (keywordFreq[word] || 0) + 1;
            });
        });

        const topKeywords = Object.entries(keywordFreq)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json({
            specialtyDistribution,
            recentLogs,
            topKeywords
        });

    } catch (error) {
        logger.error('Failed to get symptom checker admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch admin statistics' });
    }
});

module.exports = router;
