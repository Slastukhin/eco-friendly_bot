const db = require('../database/db');

class Award {
    /**
     * Создает новую награду для пользователя
     * @param {number} chatId - ID чата пользователя
     * @param {string} name - Название награды
     * @param {string} description - Описание награды
     * @returns {Promise<Object>} Созданная награда
     */
    static async create(chatId, name, description) {
        try {
            const query = `
                INSERT INTO awards (chat_id, name, description)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            const result = await db.pool.query(query, [chatId, name, description]);
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка при создании награды:', error);
            throw error;
        }
    }

    /**
     * Получает все награды конкретного пользователя
     * @param {number} chatId - ID чата пользователя
     * @returns {Promise<Array>} Массив наград пользователя
     */
    static async getUserAwards(chatId) {
        try {
            const query = `
                SELECT *
                FROM awards
                WHERE chat_id = $1
                ORDER BY awarded_at DESC
            `;
            const result = await db.pool.query(query, [chatId]);
            return result.rows;
        } catch (error) {
            console.error('Ошибка при получении наград пользователя:', error);
            throw error;
        }
    }

    /**
     * Проверяет, есть ли у пользователя определенная награда
     * @param {number} chatId - ID чата пользователя
     * @param {string} awardName - Название награды для проверки
     * @returns {Promise<Object|null>} Награда, если найдена, или null
     */
    static async findUserAward(chatId, awardName) {
        try {
            const query = `
                SELECT *
                FROM awards
                WHERE chat_id = $1 AND name = $2
                LIMIT 1
            `;
            const result = await db.pool.query(query, [chatId, awardName]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Ошибка при поиске награды пользователя:', error);
            throw error;
        }
    }
}

module.exports = Award; 