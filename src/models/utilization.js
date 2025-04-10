const pool = require('../database/db');

class Utilization {
    static async create(userId, collectionPointId, wasteTypeId, weight, dateUtilized, timeUtilized) {
        try {
            const result = await pool.query(
                'INSERT INTO utilizations (user_id, collection_point_id, waste_type_id, weight, date_utilized, time_utilized) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [userId, collectionPointId, wasteTypeId, weight, dateUtilized, timeUtilized]
            );
            return result.rows[0];
        } catch (error) {
            console.error('Error creating utilization:', error);
            throw error;
        }
    }
}

module.exports = Utilization; 