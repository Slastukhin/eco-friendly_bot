const pool = require('../database/db');

class Achievement {
    static async create(userId, type, points) {
        const query = 'INSERT INTO achievements (user_id, type, points) VALUES ($1, $2, $3) RETURNING *';
        const values = [userId, type, points];
        
        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating achievement:', error);
            throw error;
        }
    }

    static async getUserAchievements(userId) {
        const query = 'SELECT * FROM achievements WHERE user_id = $1';
        
        try {
            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting user achievements:', error);
            throw error;
        }
    }

    static async checkAchievement(userId, type) {
        const query = 'SELECT * FROM achievements WHERE user_id = $1 AND type = $2';
        
        try {
            const result = await pool.query(query, [userId, type]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error checking achievement:', error);
            throw error;
        }
    }
}

module.exports = Achievement; 