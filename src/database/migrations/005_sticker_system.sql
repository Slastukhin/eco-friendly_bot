-- Удаляем существующие таблицы если они есть
DROP TABLE IF EXISTS user_sticker_packs;
DROP TABLE IF EXISTS sticker_packs;

-- Создаем таблицу стикерпаков
CREATE TABLE sticker_packs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price BETWEEN 1 AND 5), -- Цена в наградах (от 1 до 5)
    pack_url VARCHAR(255) NOT NULL, -- Ссылка на стикерпак в Telegram
    preview_sticker_file_id VARCHAR(255), -- ID превью-стикера для показа в каталоге
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу купленных стикерпаков
CREATE TABLE user_sticker_packs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    sticker_pack_id INTEGER REFERENCES sticker_packs(id),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sticker_pack_id)
);

-- Добавляем стикерпаки
INSERT INTO sticker_packs (name, description, price, pack_url) VALUES
    ('Милые Котики', 'Самые милые котики для любителей животных!', 1, 'https://t.me/addstickers/Cat_sticker_pack_slast'),
    ('Разноцветные Квадраты', 'Интересные разноцветные квадраты', 2, 'https://t.me/addstickers/Rectangle_Colors_Stickers'); 