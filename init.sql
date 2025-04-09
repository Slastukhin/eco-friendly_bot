CREATE TABLE IF NOT EXISTS newtable (
    id SERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    fio VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'newtable'; 

-- Добавляем поле photo_id в существующую таблицу
ALTER TABLE IF EXISTS newtable 
ADD COLUMN IF NOT EXISTS photo_id TEXT; 