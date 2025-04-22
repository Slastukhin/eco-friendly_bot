-- Создаем таблицу для превью стикеров
CREATE TABLE IF NOT EXISTS sticker_previews (
    id SERIAL PRIMARY KEY,
    sticker_pack_id INTEGER REFERENCES sticker_packs(id) ON DELETE CASCADE,
    file_id VARCHAR(255) NOT NULL, -- Telegram file_id стикера
    order_number INTEGER NOT NULL, -- Порядковый номер стикера в паке
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sticker_pack_id, order_number)
);

-- Индекс для быстрого поиска превью по sticker_pack_id
CREATE INDEX idx_sticker_previews_pack_id ON sticker_previews(sticker_pack_id); 