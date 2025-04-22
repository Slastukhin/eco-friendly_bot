const { pool } = require('../database/db');

class ShopHandler {
    static async handleShopMenu(bot, chatId) {
        try {
            console.log('Начинаем загрузку магазина для chatId:', chatId);
            
            // Проверяем, зарегистрирован ли пользователь
            const userResult = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            console.log('Результат проверки пользователя:', userResult.rows);
            
            if (userResult.rows.length === 0) {
                console.log('Пользователь не зарегистрирован');
                await bot.sendMessage(chatId, 'Для доступа к магазину необходимо зарегистрироваться.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Регистрация', callback_data: 'register' }]
                        ]
                    }
                });
                return;
            }

            const userId = userResult.rows[0].id;
            console.log('ID пользователя:', userId);

            // Проверяем существование таблицы sticker_packs
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'sticker_packs'
                );
            `);
            console.log('Проверка существования таблицы sticker_packs:', tableCheck.rows[0].exists);

            if (!tableCheck.rows[0].exists) {
                console.log('Таблица sticker_packs не существует, создаем...');
                // Создаем таблицу если она не существует
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sticker_packs (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        price INTEGER NOT NULL CHECK (price BETWEEN 1 AND 5),
                        pack_url VARCHAR(255) NOT NULL,
                        preview_sticker_file_id VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS user_sticker_packs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        sticker_pack_id INTEGER REFERENCES sticker_packs(id),
                        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, sticker_pack_id)
                    );

                    -- Добавляем первый стикерпак если таблица пуста
                    INSERT INTO sticker_packs (name, description, price, pack_url)
                    SELECT 'Милые Котики', 'Самые милые котики для любителей животных!', 3, 'https://t.me/addstickers/Cat_sticker_pack_slast'
                    WHERE NOT EXISTS (SELECT 1 FROM sticker_packs);
                `);
            }

            // Получаем все доступные стикерпаки
            const stickerPacks = await pool.query('SELECT * FROM sticker_packs ORDER BY price ASC');
            console.log('Найдено стикерпаков:', stickerPacks.rows.length);
            
            // Получаем количество наград пользователя
            const userAwards = await pool.query(
                'SELECT COUNT(*) as count FROM awards WHERE chat_id = $1',
                [chatId]
            );
            const awardsCount = parseInt(userAwards.rows[0].count);
            console.log('Количество наград у пользователя:', awardsCount);
            
            const purchasedPacks = await pool.query(
                'SELECT sticker_pack_id FROM user_sticker_packs WHERE user_id = $1',
                [userId]
            );
            const purchasedPackIds = new Set(purchasedPacks.rows.map(row => row.sticker_pack_id));
            console.log('Купленные стикерпаки:', Array.from(purchasedPackIds));

            // Формируем сообщение магазина
            let message = `🎨 *Магазин стикеров*\n\n`;
            message += `У вас ${awardsCount}🏆 наград\n\n`;
            message += `Доступные стикерпаки:\n`;

            // Создаем клавиатуру с стикерпаками
            const keyboard = {
                inline_keyboard: []
            };

            for (const pack of stickerPacks.rows) {
                const isPurchased = purchasedPackIds.has(pack.id);
                message += `\n*${pack.name}*\n`;
                message += `${pack.description}\n`;
                message += `Цена: ${pack.price}🏆\n`;
                
                if (isPurchased) {
                    message += '✅ Уже приобретен\n';
                    keyboard.inline_keyboard.push([
                        {
                            text: '➕ Добавить стикеры к себе',
                            url: pack.pack_url
                        }
                    ]);
                } else {
                    keyboard.inline_keyboard.push([
                        {
                            text: `Купить ${pack.name} (${pack.price}🏆)`,
                            callback_data: `buy_sticker_pack:${pack.id}`
                        }
                    ]);
                }
            }

            keyboard.inline_keyboard.push([
                { text: '« Назад в профиль', callback_data: 'back_to_profile' }
            ]);

            console.log('Отправляем сообщение с магазином');
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            console.log('Сообщение с магазином успешно отправлено');
        } catch (error) {
            console.error('Детальная ошибка при открытии магазина:', error);
            console.error('Stack trace:', error.stack);
            await bot.sendMessage(chatId, 'Произошла ошибка при загрузке магазина стикеров.');
        }
    }

    static async handleBuyPack(bot, chatId, packId) {
        try {
            // Получаем информацию о стикерпаке
            const packResult = await pool.query(
                'SELECT * FROM sticker_packs WHERE id = $1',
                [packId]
            );
            
            if (packResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Стикерпак не найден.');
                return;
            }

            const pack = packResult.rows[0];

            // Получаем id пользователя
            const userResult = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            if (userResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Необходимо зарегистрироваться.');
                return;
            }
            const userId = userResult.rows[0].id;

            // Проверяем, не куплен ли уже этот стикерпак
            const purchaseCheck = await pool.query(
                'SELECT id FROM user_sticker_packs WHERE user_id = $1 AND sticker_pack_id = $2',
                [userId, packId]
            );

            if (purchaseCheck.rows.length > 0) {
                await bot.sendMessage(chatId, 'Вы уже приобрели этот стикерпак!');
                return;
            }

            // Проверяем количество наград
            const awardsCount = await pool.query(
                'SELECT COUNT(*) as count FROM awards WHERE chat_id = $1',
                [chatId]
            );

            const userAwards = parseInt(awardsCount.rows[0].count);

            if (userAwards < pack.price) {
                await bot.sendMessage(
                    chatId,
                    `❌ У вас недостаточно наград для покупки.\nНеобходимо: ${pack.price}🏆\nУ вас есть: ${userAwards}🏆`
                );
                return;
            }

            // Начинаем транзакцию
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Списываем награды (удаляем самые старые)
                await client.query(
                    'DELETE FROM awards WHERE id IN (SELECT id FROM awards WHERE chat_id = $1 ORDER BY id ASC LIMIT $2)',
                    [chatId, pack.price]
                );

                // Записываем покупку
                await client.query(
                    'INSERT INTO user_sticker_packs (user_id, sticker_pack_id) VALUES ($1, $2)',
                    [userId, packId]
                );

                await client.query('COMMIT');

                // Отправляем сообщение об успешной покупке
                await bot.sendMessage(
                    chatId,
                    `✅ Поздравляем с приобретением стикерпака "${pack.name}"!\n\n` +
                    `Нажмите на ссылку ниже, чтобы добавить стикеры:\n${pack.pack_url}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Добавить стикеры', url: pack.pack_url }],
                                [{ text: '« Назад в магазин', callback_data: 'shop' }]
                            ]
                        }
                    }
                );
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Ошибка при покупке стикерпака:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при покупке стикерпака.');
        }
    }
}

module.exports = ShopHandler; 