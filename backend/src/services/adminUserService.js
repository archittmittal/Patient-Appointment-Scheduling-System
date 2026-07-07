const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { bcryptRounds } = require('../config/auth');

const BCRYPT_ROUNDS = bcryptRounds || 10;

const ALLOWED_SORT = {
    id: 'u.id',
    name: "COALESCE(p.first_name, d.first_name, 'Admin')",
    created_at: 'u.created_at',
    role: 'u.role'
};

async function listPatients(cursor, limit) {
    const [rows] = await db.query(
        `SELECT id, CONCAT(first_name, ' ', last_name) AS name
         FROM patients
         WHERE id > ?
         ORDER BY id ASC
         LIMIT ?`,
        [cursor, limit + 1]
    );
    const hasMore = rows.length > limit;
    const nextCursor = hasMore ? rows[limit - 1].id : null;
    return { data: hasMore ? rows.slice(0, limit) : rows, nextCursor };
}

async function listUsers({ page, limit, role, sort_by, order: orderRaw }) {
    const offset = (page - 1) * limit;
    const sortColumn = ALLOWED_SORT[sort_by] || ALLOWED_SORT.id;
    let order = 'ASC';
    if (orderRaw && typeof orderRaw === 'string') {
        const orderUpper = orderRaw.toUpperCase();
        if (orderUpper === 'DESC') {
            order = 'DESC';
        }
    }

    let whereClause = '';
    const filterParams = [];

    if (role && role !== 'ALL') {
        whereClause = 'WHERE u.role = ?';
        filterParams.push(role);
    }

    const orderByClause = sortColumn === ALLOWED_SORT.role
        ? `ORDER BY ${sortColumn} ${order}, u.id ASC`
        : `ORDER BY ${sortColumn} ${order}`;

    const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;
    const [countResult] = await db.query(countQuery, filterParams);
    const total = countResult[0].total;

    const dataQuery = `
        SELECT 
            u.id, u.email, u.role, u.created_at,
            p.first_name AS p_first, p.last_name AS p_last, p.phone, p.blood_group,
            d.first_name AS d_first, d.last_name AS d_last, d.specialty, d.location_room
        FROM users u
        LEFT JOIN patients p ON u.id = p.id
        LEFT JOIN doctors d ON u.id = d.id
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
    `;

    const dataParams = [...filterParams, limit, offset];
    const [rows] = await db.query(dataQuery, dataParams);

    const users = rows.map(row => {
        let name = 'Admin';
        let extra = {};
        if (row.role === 'PATIENT') {
            name = `${row.p_first || ''} ${row.p_last || ''}`.trim();
            extra = {
                first_name: row.p_first,
                last_name: row.p_last,
                phone: row.phone,
                blood_group: row.blood_group
            };
        } else if (row.role === 'DOCTOR') {
            name = `${row.d_first || ''} ${row.d_last || ''}`.trim();
            extra = {
                first_name: row.d_first,
                last_name: row.d_last,
                specialty: row.specialty,
                location_room: row.location_room
            };
        }
        return {
            id: row.id,
            email: row.email,
            role: row.role,
            created_at: row.created_at,
            name: name || 'Unknown',
            ...extra
        };
    });

    return {
        data: users,
        meta: {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit)
        }
    };
}

async function addDoctor({ email, password, first_name, last_name, specialty, degree, experience_years, location_room }) {
    const conn = await db.getConnection();
    try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, passwordHash, 'DOCTOR']
        );
        const newId = userResult.insertId;

        const defaultAvailability = {
            monday: { open: true, from: '09:00', to: '17:00' },
            tuesday: { open: true, from: '09:00', to: '17:00' },
            wednesday: { open: true, from: '09:00', to: '17:00' },
            thursday: { open: true, from: '09:00', to: '17:00' },
            friday: { open: true, from: '09:00', to: '17:00' },
            saturday: { open: false, from: '', to: '' },
            sunday: { open: false, from: '', to: '' }
        };

        await conn.query(
            'INSERT INTO doctors (id, first_name, last_name, specialty, degree, experience_years, location_room, image_url, availability, consultation_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, first_name, last_name, specialty, degree || '', experience_years || 0, location_room || '',
             `https://ui-avatars.com/api/?name=${encodeURIComponent(first_name + '+' + last_name)}&background=random`,
             JSON.stringify(defaultAvailability), 0.00]
        );

        await conn.commit();
        return newId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function deleteDoctor(id) {
    await db.query('DELETE FROM users WHERE id = ? AND role = ?', [id, 'DOCTOR']);
}

async function addPatient({ email, password, first_name, last_name, dob, phone, blood_group, address }) {
    const conn = await db.getConnection();
    try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await conn.beginTransaction();

        const [userResult] = await conn.query(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, passwordHash, 'PATIENT']
        );
        const newId = userResult.insertId;

        await conn.query(
            'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newId, first_name, last_name, dob || null, phone || '', blood_group || '', address || '']
        );

        await conn.commit();
        return newId;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function deletePatient(id) {
    await db.query('DELETE FROM users WHERE id = ? AND role = ?', [id, 'PATIENT']);
}

async function searchPatients(query) {
    if (typeof query !== 'string') {
        query = '';
    }
    if (!query || query.length < 2) return [];

    const [patients] = await db.query(`
        SELECT p.id, p.first_name, p.last_name, p.phone, p.blood_group, u.email
        FROM patients p
        JOIN users u ON p.id = u.id
        WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ?
        LIMIT 10
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);

    return patients;
}

module.exports = {
    listPatients,
    listUsers,
    addDoctor,
    deleteDoctor,
    addPatient,
    deletePatient,
    searchPatients
};
