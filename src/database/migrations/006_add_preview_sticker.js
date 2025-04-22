const { pool } = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Добавляем колонку для превью-стикера, если её ещё нет
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'sticker_packs' 
                    AND column_name = 'preview_sticker_file_id'
                ) THEN 
                    ALTER TABLE sticker_packs 
                    ADD COLUMN preview_sticker_file_id VARCHAR(255);
                END IF;
            END $$;
        `);

        console.log('Миграция успешно выполнена');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при выполнении миграции:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Выполняем миграцию
migrate().catch(console.error); 