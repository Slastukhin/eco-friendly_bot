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

            // Получаем количество наград пользователя
            const awardsResult = await pool.query(
                'SELECT COUNT(*) as count FROM awards WHERE chat_id = $1',
                [chatId]
            );
            const userPoints = parseInt(awardsResult.rows[0].count);

            // Обновляем points в таблице users
            await pool.query(
                'UPDATE users SET points = $1 WHERE chat_id = $2',
                [userPoints, chatId]
            );

            // Получаем все доступные стикерпаки
            const stickerPacks = await pool.query(`
                SELECT sp.*, 
                       CASE WHEN usp.id IS NOT NULL THEN true ELSE false END as is_purchased
                FROM sticker_packs sp
                LEFT JOIN user_sticker_packs usp ON sp.id = usp.sticker_pack_id AND usp.user_id = $1
                ORDER BY sp.price ASC
            `, [userId]);

            let message = `🎨 Магазин стикеров\n\nУ вас ${userPoints}🏆 наград\n\nДоступные стикерпаки:\n\n`;
            const keyboard = [];

            for (const pack of stickerPacks.rows) {
                message += `${pack.name}\n${pack.description}\nЦена: ${pack.price}🏆\n`;
                if (pack.is_purchased) {
                    message += '✅ Уже приобретен\n';
                }
                message += '\n';

                const row = [];
                
                // Добавляем кнопку предпросмотра
                row.push({ 
                    text: '👁 Посмотреть стикеры', 
                    callback_data: `preview_sticker_pack:${pack.id}` 
                });

                // Добавляем кнопку покупки, если пак еще не куплен
                if (!pack.is_purchased) {
                    row.push({ 
                        text: `Купить (${pack.price}🏆)`, 
                        callback_data: `buy_sticker_pack:${pack.id}` 
                    });
                }
                
                keyboard.push(row);
            }

            keyboard.push([{ text: '« Назад в профиль', callback_data: 'back_to_profile' }]);

            await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Ошибка при отображении магазина:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при загрузке магазина. Пожалуйста, попробуйте позже.');
        }
    }

    static async handlePreviewPack(bot, chatId, packId) {
        try {
            // Получаем информацию о стикерпаке
            const packResult = await pool.query('SELECT * FROM sticker_packs WHERE id = $1', [packId]);
            
            if (packResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Стикерпак не найден.');
                return;
            }

            const pack = packResult.rows[0];

            // Отправляем сообщение с превью стикеров
            await bot.sendMessage(chatId, 
                `🎨 Предпросмотр стикерпака "${pack.name}"\n\n` +
                `${pack.description}\n\n` +
                `Стоимость: ${pack.price}🏆\n\n` +
                `Нажмите на ссылку, чтобы посмотреть стикеры:\n` +
                `${pack.pack_url}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Купить стикерпак', callback_data: `buy_sticker_pack:${packId}` },
                                { text: '« Назад в магазин', callback_data: 'shop' }
                            ]
                        ]
                    }
                }
            );

            // Если есть превью-стикер, отправляем его
            if (pack.preview_sticker_file_id) {
                await bot.sendSticker(chatId, pack.preview_sticker_file_id);
            }

        } catch (error) {
            console.error('Ошибка при показе превью стикерпака:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при загрузке превью. Пожалуйста, попробуйте позже.');
        }
    }

    static async handleBuyPack(bot, chatId, packId) {
        try {
            // Получаем информацию о пользователе
            const userResult = await pool.query('SELECT id, points FROM users WHERE chat_id = $1', [chatId]);
            
            if (userResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Пользователь не найден.');
                return;
            }

            const userId = userResult.rows[0].id;
            const userPoints = userResult.rows[0].points || 0;

            // Получаем информацию о стикерпаке
            const packResult = await pool.query('SELECT * FROM sticker_packs WHERE id = $1', [packId]);
            
            if (packResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Стикерпак не найден.');
                return;
            }

            const pack = packResult.rows[0];

            // Проверяем, не куплен ли уже этот стикерпак
            const purchaseCheck = await pool.query(
                'SELECT id FROM user_sticker_packs WHERE user_id = $1 AND sticker_pack_id = $2',
                [userId, packId]
            );

            if (purchaseCheck.rows.length > 0) {
                await bot.sendMessage(chatId, 'Вы уже приобрели этот стикерпак.');
                return;
            }

            // Проверяем достаточно ли наград
            if (userPoints < pack.price) {
                await bot.sendMessage(chatId, 
                    `У вас недостаточно наград для покупки.\n` +
                    `Необходимо: ${pack.price}🏆\n` +
                    `У вас есть: ${userPoints}🏆`
                );
                return;
            }

            // Начинаем транзакцию
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Списываем награды
                await client.query(
                    'UPDATE users SET points = points - $1 WHERE id = $2',
                    [pack.price, userId]
                );

                // Записываем покупку
                await client.query(
                    'INSERT INTO user_sticker_packs (user_id, sticker_pack_id) VALUES ($1, $2)',
                    [userId, packId]
                );

                await client.query('COMMIT');

                // Отправляем сообщение об успешной покупке
                await bot.sendMessage(chatId, 
                    `✅ Поздравляем с покупкой стикерпака "${pack.name}"!\n\n` +
                    `Чтобы добавить стикеры, перейдите по ссылке:\n` +
                    `${pack.pack_url}\n\n` +
                    `Оставшиеся награды: ${userPoints - pack.price}🏆`,
                    {
                        reply_markup: {
                            inline_keyboard: [
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
            await bot.sendMessage(chatId, 'Произошла ошибка при покупке. Пожалуйста, попробуйте позже.');
        }
    }
}

module.exports = ShopHandler; 