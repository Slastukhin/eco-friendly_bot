const { pool } = require('../database/db');
const Award = require('../models/award');

class UtilizationHandler {
    static async handleUtilizationCommand(bot, chatId) {
        try {
            // Проверяем, зарегистрирован ли пользователь
            const userResult = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            if (userResult.rows.length === 0) {
                await bot.sendMessage(chatId, 'Для записи утилизации необходимо зарегистрироваться.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Регистрация', callback_data: 'register' }]
                        ]
                    }
                });
                return;
            }

            const welcomeMessage = `Спасибо, что вы заботитесь об экологии! 🌱

Ваш вклад в раздельный сбор мусора помогает сохранить нашу планету чистой для будущих поколений. 

Давайте запишем информацию о вашей утилизации:`;

            await bot.sendMessage(chatId, welcomeMessage);
            await this.showCitiesList(bot, chatId);
        } catch (error) {
            console.error('Ошибка при обработке команды утилизации:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    }

    static async showCitiesList(bot, chatId) {
        try {
            // Получаем список городов
            const cities = await pool.query('SELECT * FROM cities ORDER BY name');
            
            // Создаем клавиатуру с городами (3 колонки)
            const keyboard = [];
            const citiesData = cities.rows;
            
            for (let i = 0; i < citiesData.length; i += 3) {
                const row = [];
                for (let j = 0; j < 3 && i + j < citiesData.length; j++) {
                    row.push({
                        text: citiesData[i + j].name,
                        callback_data: `city_${citiesData[i + j].id}`
                    });
                }
                keyboard.push(row);
            }

            await bot.sendMessage(chatId, 'Выберите город:', {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        } catch (error) {
            console.error('Ошибка при отображении списка городов:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    }

    static async handleCitySelection(bot, query) {
        const chatId = query.message.chat.id;
        const cityId = query.data.split('_')[1];

        try {
            // Получаем адреса для выбранного города
            const points = await pool.query(
                `SELECT * FROM collection_points WHERE city_id = $1 ORDER BY address`,
                [cityId]
            );
            
            // Создаем клавиатуру с адресами (2 колонки)
            const keyboard = [];
            const pointsData = points.rows;
            
            for (let i = 0; i < pointsData.length; i += 2) {
                const row = [];
                for (let j = 0; j < 2 && i + j < pointsData.length; j++) {
                    row.push({
                        text: pointsData[i + j].address,
                        callback_data: `point_${pointsData[i + j].id}`
                    });
                }
                keyboard.push(row);
            }

            // Добавляем кнопку "Назад"
            keyboard.push([{ text: '« Назад к городам', callback_data: 'back_to_cities' }]);

            await bot.editMessageText('Выберите пункт приема:', {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        } catch (error) {
            console.error('Ошибка при выборе города:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    }

    static async handleBackToCities(bot, query) {
        const chatId = query.message.chat.id;
        await this.showCitiesList(bot, chatId);
    }

    static async handlePointSelection(bot, query) {
        const chatId = query.message.chat.id;
        const pointId = query.data.split('_')[1];
        
        // Сохраняем выбранный пункт в состоянии
        if (!bot.utilizationState) bot.utilizationState = {};
        bot.utilizationState[chatId] = {
            pointId: pointId,
            step: 'type'
        };

        const keyboard = {
            inline_keyboard: [
                [
                    { text: 'Пластик', callback_data: 'type_plastic' },
                    { text: 'Бумага', callback_data: 'type_paper' }
                ],
                [
                    { text: 'Стекло', callback_data: 'type_glass' },
                    { text: 'Металл', callback_data: 'type_metal' }
                ],
                [
                    { text: 'Батарейки', callback_data: 'type_batteries' }
                ],
                [{ text: '« Назад к пунктам', callback_data: 'back_to_points' }]
            ]
        };

        await bot.editMessageText('Выберите тип отходов:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: keyboard
        });
    }

    static async handleTypeSelection(bot, query) {
        const chatId = query.message.chat.id;
        const type = query.data.split('_')[1];
        
        try {
            // Преобразуем тип отходов в название из базы данных
            const typeMapping = {
                'plastic': 'Пластик (PET)',
                'paper': 'Бумага',
                'glass': 'Стекло',
                'metal': 'Металл (алюминий)',
                'batteries': 'Батарейки'
            };

            // Сохраняем тип в состоянии
            if (!bot.utilizationState[chatId]) bot.utilizationState[chatId] = {};
            bot.utilizationState[chatId].type = typeMapping[type];
            bot.utilizationState[chatId].step = 'weight';

            await bot.editMessageText('Введите вес отходов в килограммах (например: 1.5):', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        } catch (error) {
            console.error('Error selecting waste type:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при выборе типа отходов. Пожалуйста, попробуйте позже.');
        }
    }

    static async handleWeightInput(bot, msg) {
        const chatId = msg.chat.id;
        const weight = parseFloat(msg.text);

        if (!bot.utilizationState || !bot.utilizationState[chatId]) {
            await bot.sendMessage(chatId, 'Пожалуйста, начните процесс утилизации заново с помощью команды /utilization');
            return;
        }

        const state = bot.utilizationState[chatId];

        if (isNaN(weight) || weight <= 0) {
            await bot.sendMessage(chatId, 'Пожалуйста, введите корректный вес в килограммах (например: 2.5)');
            return;
        }

        try {
            // Получаем id пользователя
            const userResult = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            if (userResult.rows.length === 0) {
                throw new Error('Пользователь не найден');
            }
            const userId = userResult.rows[0].id;

            // Получаем id типа отходов
            const wasteTypeResult = await pool.query('SELECT id FROM waste_types WHERE name = $1', [state.type]);
            if (wasteTypeResult.rows.length === 0) {
                throw new Error('Тип отходов не найден');
            }
            const wasteTypeId = wasteTypeResult.rows[0].id;

            // Начинаем транзакцию
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Записываем утилизацию в базу данных
                const result = await client.query(
                    `INSERT INTO utilizations 
                    (user_id, collection_point_id, waste_type_id, weight, date_utilized, time_utilized) 
                    VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME)
                    RETURNING *`,
                    [userId, state.pointId, wasteTypeId, weight]
                );

                console.log('Utilization created:', result.rows[0]);

                // Обновляем количество points у пользователя
                await client.query(
                    'UPDATE users SET points = points + 1 WHERE chat_id = $1',
                    [chatId]
                );

                // Создаем награду за утилизацию
                await client.query(
                    'INSERT INTO awards (chat_id, name, description) VALUES ($1, $2, $3)',
                    [chatId, '🏆 Награда за утилизацию', `Утилизация ${weight} кг ${state.type}`]
                );

                // Получаем общее количество наград пользователя
                const awardsCount = await client.query(
                    'SELECT COUNT(*) as count FROM awards WHERE chat_id = $1',
                    [chatId]
                );

                await client.query('COMMIT');

                // Отправляем сообщение об успехе
                await bot.sendMessage(chatId, 
                    `✅ Отлично! Утилизация записана:\n` +
                    `Тип отходов: ${state.type}\n` +
                    `Вес: ${weight} кг\n\n` +
                    `За эту сдачу мусора вам начислено 1🏆, всего у вас ${awardsCount.rows[0].count}🏆 наград.\n` +
                    `Все награды вы можете посмотреть в профиле.\n\n` +
                    `Спасибо за вклад в защиту экологии! 🌍`
                );

                // Очищаем состояние
                delete bot.utilizationState[chatId];

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error recording utilization:', error);
                await bot.sendMessage(chatId, 'Произошла ошибка при записи утилизации. Пожалуйста, попробуйте позже.');
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error recording utilization:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при записи утилизации. Пожалуйста, попробуйте позже.');
        }
    }

    static getWasteTypeName(type) {
        const types = {
            'plastic': 'Пластик',
            'paper': 'Бумага',
            'glass': 'Стекло',
            'metal': 'Металл',
            'batteries': 'Батарейки'
        };
        return types[type] || type;
    }

    static async getUserId(chatId) {
        const result = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        return result.rows[0].id;
    }
}

module.exports = UtilizationHandler; 