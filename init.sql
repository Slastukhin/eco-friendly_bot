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

-- Таблица пунктов приема
CREATE TABLE IF NOT EXISTS collection_points (
    id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL
);

-- Таблица типов отходов
CREATE TABLE IF NOT EXISTS waste_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    points_per_kg INTEGER NOT NULL DEFAULT 10
);

-- Таблица утилизаций пользователей
CREATE TABLE IF NOT EXISTS utilizations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    collection_point_id INTEGER REFERENCES collection_points(id),
    waste_type_id INTEGER REFERENCES waste_types(id),
    weight DECIMAL(10,2) NOT NULL,
    date_utilized DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Заполняем пункты приема
INSERT INTO collection_points (address) VALUES
    ('ул. Ленина, 15'),
    ('пр. Мира, 78'),
    ('ул. Гагарина, 42'),
    ('ул. Пушкина, 23'),
    ('пр. Победы, 91'),
    ('ул. Космонавтов, 55'),
    ('ул. Советская, 127'),
    ('пр. Металлургов, 83'),
    ('ул. Строителей, 64'),
    ('ул. Заводская, 31');

-- Заполняем типы отходов
INSERT INTO waste_types (name, points_per_kg) VALUES
    ('Бумага', 10),
    ('Картон', 8),
    ('Пластик (PET)', 15),
    ('Пластик (HDPE)', 12),
    ('Стекло', 5),
    ('Металл (алюминий)', 20),
    ('Металл (жесть)', 15),
    ('Батарейки', 30),
    ('Электроника', 25),
    ('Текстиль', 10); 