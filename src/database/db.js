const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Функции для работы с профилем
async function getUserProfile(chatId) {
    const result = await pool.query('SELECT * FROM newtable WHERE chat_id = $1', [chatId]);
    return result.rows[0];
}

async function updateUserProfile(chatId, field, value) {
    const query = `UPDATE newtable SET ${field} = $1 WHERE chat_id = $2 RETURNING *`;
    const result = await pool.query(query, [value, chatId]);
    return result.rows[0];
}

module.exports = {
    pool,
    getUserProfile,
    updateUserProfile
}; 