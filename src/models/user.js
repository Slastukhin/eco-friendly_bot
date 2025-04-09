const pool = require('../database/db');

class User {
    static async create(chatId, username) {
        const query = 'INSERT INTO users (chat_id, username) VALUES ($1, $2) RETURNING *';
        const values = [chatId, username];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async findByChatId(chatId) {
        const query = 'SELECT * FROM users WHERE chat_id = $1';
        
        try {
            const result = await pool.query(query, [chatId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error finding user:', error);
            throw error;
        }
    }

    static async updatePoints(chatId, points) {
        const query = 'UPDATE users SET points = points + $1 WHERE chat_id = $2 RETURNING *';
        
        try {
            const result = await pool.query(query, [points, chatId]);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating user points:', error);
            throw error;
        }
    }

    static async getLeaderboard() {
        const query = 'SELECT * FROM users ORDER BY points DESC LIMIT 10';
        
        try {
            const result = await pool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            throw error;
        }
    }
}

module.exports = User; 