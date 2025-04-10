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
    const result = await pool.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
    return result.rows[0];
}

async function updateUserProfile(chatId, field, value) {
    let query;
    let values;

    // Преобразуем имя поля из интерфейса в имя поля в базе данных
    const fieldMapping = {
        'fio': 'fio',
        'age': 'age',
        'location': 'location',
        'photo': 'photo_id'
    };

    const dbField = fieldMapping[field];
    if (!dbField) {
        throw new Error('Неверное имя поля');
    }

    query = `UPDATE users SET ${dbField} = $1 WHERE chat_id = $2 RETURNING *`;
    values = [value, chatId];

    const result = await pool.query(query, values);
    return result.rows[0];
}

module.exports = {
    pool,
    getUserProfile,
    updateUserProfile
}; 