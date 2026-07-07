const db = require('../config/db');

async function getDepartments() {
    const [rows] = await db.query(`
        SELECT 
            dep.id, dep.name, dep.description, dep.created_at,
            COUNT(d.id) AS doctor_count,
            JSON_ARRAYAGG(
                IF(d.id IS NOT NULL, 
                   JSON_OBJECT('id', d.id, 'name', CONCAT('Dr. ', d.first_name, ' ', d.last_name)), 
                   NULL)
            ) AS doctors
        FROM departments dep
        LEFT JOIN doctors d ON dep.name = d.specialty
        GROUP BY dep.id
        ORDER BY dep.name
    `);
    
    return rows.map(r => {
        let docs = [];
        try {
            const parsedDocs = typeof r.doctors === 'string' ? JSON.parse(r.doctors) : r.doctors;
            docs = Array.isArray(parsedDocs) ? parsedDocs.filter(Boolean) : [];
        } catch (e) {
            docs = [];
        }
        return {
            id: r.id,
            name: r.name,
            description: r.description,
            created_at: r.created_at,
            doctor_count: r.doctor_count,
            doctors: docs
        };
    });
}

async function addDepartment({ name, description }) {
    const [result] = await db.query(
        'INSERT INTO departments (name, description) VALUES (?, ?)',
        [name, description || null]
    );
    return { id: result.insertId, name, description };
}

async function deleteDepartment(id) {
    const [depRows] = await db.query('SELECT name FROM departments WHERE id = ?', [id]);
    if (depRows.length === 0) {
        throw { status: 404, message: 'Department not found' };
    }
    const depName = depRows[0].name;

    const [docRows] = await db.query('SELECT id FROM doctors WHERE specialty = ?', [depName]);
    if (docRows.length > 0) {
        throw { status: 400, message: 'Cannot delete department. There are doctors assigned to it.' };
    }

    await db.query('DELETE FROM departments WHERE id = ?', [id]);
}

module.exports = {
    getDepartments,
    addDepartment,
    deleteDepartment
};
