require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('./database/db');
const ProfileHandler = require('./handlers/profileHandler');
const UtilizationHandler = require('./handlers/utilizationHandler');
const UserUtilizationsHandler = require('./handlers/userUtilizationsHandler');
const AwardsHandler = require('./handlers/awardsHandler');
const StatisticsHandler = require('./handlers/statisticsHandler');
const ShopHandler = require('./handlers/shopHandler');

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Инициализация обработчиков
const profileHandler = new ProfileHandler(bot);

// Проверка подключения к базе данных и структуры таблицы
async function checkDatabaseConnection() {
    let client;
    try {
        client = await pool.connect();
        console.log('Успешное подключение к базе данных');

        // Создаем таблицу пользователей
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                chat_id BIGINT NOT NULL UNIQUE,
                fio VARCHAR(255) NOT NULL,
                age INTEGER NOT NULL,
                location VARCHAR(255) NOT NULL,
                photo_id TEXT,
                points INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Создаем таблицу наград
        await client.query(`
            CREATE TABLE IF NOT EXISTS awards (
                id SERIAL PRIMARY KEY,
                chat_id BIGINT NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
            );
        `);

        // Создаем таблицу городов
        await client.query(`
            CREATE TABLE IF NOT EXISTS cities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            );
        `);

        // Создаем таблицу пунктов приема
        await client.query(`
            CREATE TABLE IF NOT EXISTS collection_points (
                id SERIAL PRIMARY KEY,
                city_id INTEGER REFERENCES cities(id),
                address VARCHAR(255) NOT NULL,
                is_default BOOLEAN DEFAULT TRUE,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_visible_to_all BOOLEAN DEFAULT FALSE
            );
        `);

        // Создаем таблицу типов отходов
        await client.query(`
            CREATE TABLE IF NOT EXISTS waste_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                points_per_kg INTEGER NOT NULL DEFAULT 10
            );
        `);

        // Создаем таблицу утилизаций
        await client.query(`
            CREATE TABLE IF NOT EXISTS utilizations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                collection_point_id INTEGER REFERENCES collection_points(id),
                waste_type_id INTEGER REFERENCES waste_types(id),
                weight DECIMAL(10,2) NOT NULL,
                date_utilized DATE NOT NULL DEFAULT CURRENT_DATE,
                time_utilized TIME NOT NULL DEFAULT CURRENT_TIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Проверяем наличие данных в таблице городов
        const citiesCount = await client.query('SELECT COUNT(*) FROM cities');
        if (citiesCount.rows[0].count === '0') {
            // Заполняем города
            await client.query(`
                INSERT INTO cities (name) VALUES
                ('Москва'),
                ('Санкт-Петербург'),
                ('Новосибирск'),
                ('Екатеринбург'),
                ('Казань'),
                ('Нижний Новгород'),
                ('Челябинск'),
                ('Самара'),
                ('Омск'),
                ('Ростов-на-Дону');
            `);
        }

        // Проверяем наличие данных в таблице пунктов приема
        const pointsCount = await client.query('SELECT COUNT(*) FROM collection_points WHERE is_default = TRUE');
        if (pointsCount.rows[0].count === '0') {
            // Получаем список городов
            const cities = await client.query('SELECT id FROM cities');
            
            // Для каждого города добавляем 15 пунктов приема
            for (const city of cities.rows) {
                await client.query(`
                    INSERT INTO collection_points (city_id, address, is_default, is_visible_to_all) VALUES
                    ($1, 'ул. Ленина, 15', TRUE, TRUE),
                    ($1, 'пр. Мира, 78', TRUE, TRUE),
                    ($1, 'ул. Гагарина, 42', TRUE, TRUE),
                    ($1, 'ул. Пушкина, 23', TRUE, TRUE),
                    ($1, 'пр. Победы, 91', TRUE, TRUE),
                    ($1, 'ул. Космонавтов, 55', TRUE, TRUE),
                    ($1, 'ул. Советская, 127', TRUE, TRUE),
                    ($1, 'пр. Металлургов, 83', TRUE, TRUE),
                    ($1, 'ул. Строителей, 64', TRUE, TRUE),
                    ($1, 'ул. Заводская, 31', TRUE, TRUE),
                    ($1, 'ул. Первомайская, 12', TRUE, TRUE),
                    ($1, 'пр. Комсомольский, 45', TRUE, TRUE),
                    ($1, 'ул. Революции, 89', TRUE, TRUE),
                    ($1, 'ул. Молодежная, 56', TRUE, TRUE),
                    ($1, 'пр. Энтузиастов, 73', TRUE, TRUE)
                `, [city.id]);
            }
        }

        // Проверяем наличие данных в таблице типов отходов
        const typesCount = await client.query('SELECT COUNT(*) FROM waste_types');
        if (typesCount.rows[0].count === '0') {
            // Заполняем типы отходов
            await client.query(`
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
            `);
        }

        // Перенос данных из старой таблицы в новую
        const oldTableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'newtable'
            );
        `);

        if (oldTableExists.rows[0].exists) {
            // Переносим данные из старой таблицы в новую
            await client.query(`
                INSERT INTO users (chat_id, fio, age, location, photo_id)
                SELECT chat_id, fio, age, location, photo_id
                FROM newtable
                ON CONFLICT (chat_id) DO NOTHING;
            `);

            // Удаляем старую таблицу
            await client.query('DROP TABLE IF EXISTS newtable;');
        }

        console.log('Структура базы данных успешно обновлена');
    } catch (err) {
        console.error('Ошибка при проверке базы данных:', err);
    } finally {
        if (client) {
            await client.release();
        }
    }
}

// Вызываем функцию проверки при запуске
checkDatabaseConnection();

// Устанавливаем команды бота
bot.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'profile', description: 'Исследовать профиль' },
    { command: 'utilization', description: 'Записать утилизацию' },
    { command: 'shop', description: 'Магазин стикеров' }
]);

// Объект для хранения состояния пользователей и ID сообщений
const userStates = {};

// Приветственное сообщение
const welcomeMessage = `Добро пожаловать в бота экологического мониторинга! 🌱

Я помогу вам:
- Отслеживать вашу экологическую активность
- Записывать утилизацию отходов
- Просматривать статистику

Для начала работы, пожалуйста, зарегистрируйтесь.`;

// Функция для удаления предыдущего сообщения
async function deletePreviousMessage(chatId) {
    if (userStates[chatId] && userStates[chatId].lastMessageId) {
        try {
            await bot.deleteMessage(chatId, userStates[chatId].lastMessageId);
        } catch (error) {
            console.error('Ошибка при удалении сообщения:', error);
        }
    }
}

// Обработчик команды /profile
bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        // Проверяем, зарегистрирован ли пользователь
        const result = await pool.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        
        if (result.rows.length === 0) {
            await bot.sendMessage(chatId, 'Для доступа к профилю необходимо зарегистрироваться.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Регистрация', callback_data: 'register' }]
                    ]
                }
            });
            return;
        }

        // Показываем меню профиля
        await bot.sendMessage(chatId, 'Выберите действие:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Мой профиль', callback_data: 'my_profile' }],
                    [{ text: 'Редактировать профиль', callback_data: 'edit_profile' }],
                    [{ text: 'Мои награды', callback_data: 'my_awards' }],
                    [{ text: 'Мои утилизации', callback_data: 'my_utilizations' }],
                    [{ text: 'Моя статистика', callback_data: 'my_statistics' }]
                ]
            }
        });
    } catch (error) {
        console.error('Ошибка при проверке профиля:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении данных профиля.');
    }
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log('Получена команда /start от пользователя:', chatId);

    // Очищаем состояние пользователя
    userStates[chatId] = {};

    // Проверяем, зарегистрирован ли пользователь
    try {
        const result = await pool.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        if (result.rows.length > 0) {
            // Показываем главное меню для зарегистрированного пользователя
            await bot.sendMessage(chatId, 'Выберите действие:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🗑 Утилизировать', callback_data: 'utilization' },
                            { text: '📊 Мои утилизации', callback_data: 'my_utilizations' }
                        ],
                        [
                            { text: '👤 Мой профиль', callback_data: 'my_profile' },
                            { text: '🎨 Магазин стикеров', callback_data: 'shop' }
                        ],
                        [
                            { text: '📋 О сервисе', callback_data: 'about' }
                        ]
                    ]
                }
            });
            return;
        }
    } catch (error) {
        console.error('Ошибка при проверке регистрации:', error);
    }

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Регистрация', callback_data: 'register' }]
            ]
        }
    };

    try {
        const sentMessage = await bot.sendMessage(chatId, welcomeMessage, keyboard);
        userStates[chatId].lastMessageId = sentMessage.message_id;
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
    }
});

// Обработчик команды /utilization
bot.onText(/\/utilization/, async (msg) => {
    const chatId = msg.chat.id;
    await UtilizationHandler.handleUtilizationCommand(bot, chatId);
});

// Обработка callback запросов
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
        // Обработка утилизации
        if (data.startsWith('city_')) {
            await UtilizationHandler.handleCitySelection(bot, query);
        } else if (data === 'back_to_cities') {
            await UtilizationHandler.handleBackToCities(bot, query);
        } else if (data.startsWith('point_')) {
            await UtilizationHandler.handlePointSelection(bot, query);
        } else if (data.startsWith('type_')) {
            await UtilizationHandler.handleTypeSelection(bot, query);
        } else if (data === 'view_all_utilizations') {
            await UserUtilizationsHandler.handleViewAllUtilizations(bot, query);
        } else if (data === 'my_utilizations') {
            await UserUtilizationsHandler.handleMyUtilizations(bot, chatId);
        } else if (data === 'utilization') {
            await UtilizationHandler.handleUtilizationCommand(bot, chatId);
        } else if (data === 'my_awards' || data === 'refresh_awards') {
            await AwardsHandler.handleMyAwards(bot, chatId);
        } else if (data === 'download_awards') {
            await AwardsHandler.handleDownloadAwards(bot, chatId);
        } else if (data === 'my_statistics') {
            await StatisticsHandler.handleStatisticsMenu(bot, chatId);
        } else if (data === 'stats_cities') {
            await StatisticsHandler.handleCitiesStats(bot, chatId);
        } else if (data === 'stats_points') {
            await StatisticsHandler.handlePointsStats(bot, chatId);
        } else if (data === 'stats_materials') {
            await StatisticsHandler.handleMaterialsStats(bot, chatId);
        } else if (data === 'about') {
            const aboutMessage = `🌍 *Добро пожаловать в ECO Friendly Bot!*

🌱 *Наша миссия:* 
Помогаем делать мир чище, превращая сортировку отходов в увлекательный и полезный процесс!

♻️ *Что умеет наш бот:*
• Запись и отслеживание ваших утилизаций
• Удобный поиск ближайших пунктов приема
• Подробная статистика в Excel
• Простой и понятный интерфейс

📊 *Поддерживаемые типы отходов:*
• Пластик
• Бумага
• Стекло
• Металл
• Батарейки

🏆 *Почему именно мы:*
• Работаем в 10 крупнейших городах России
• Более 150 пунктов приема отходов
• Детальная история всех утилизаций
• Экспорт данных в Excel

🤝 *Присоединяйтесь к нам:*
Вместе мы делаем нашу планету чище! Каждая ваша утилизация - это вклад в будущее экологии.

🎯 *Начните прямо сейчас:*
Нажмите кнопку "Утилизировать" и внесите свой вклад в защиту окружающей среды!`;

            await bot.sendMessage(chatId, aboutMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🗑 Утилизировать', callback_data: 'utilization' }]
                    ]
                }
            });
        } else if (data === 'shop') {
            await ShopHandler.handleShopMenu(bot, chatId);
        } else if (data.startsWith('preview_sticker_pack:')) {
            const packId = parseInt(data.split(':')[1]);
            await ShopHandler.handlePreviewPack(bot, chatId, packId);
        } else if (data.startsWith('buy_sticker_pack:')) {
            const packId = parseInt(data.split(':')[1]);
            await ShopHandler.handleBuyPack(bot, chatId, packId);
        }
        // Обработка профиля
        else if (['my_profile', 'edit_profile', 'edit_fio', 'edit_age', 'edit_location', 'edit_photo', 'back_to_profile'].includes(data)) {
            await profileHandler.handleCallbackQuery(query);
        }
        // Обработка регистрации
        else if (data === 'register') {
            await deletePreviousMessage(chatId);
            userStates[chatId] = { step: 'fio', isRegistering: true };
            const sentMessage = await bot.sendMessage(chatId, 'Введите ФИО (только русские буквы):');
            userStates[chatId].lastMessageId = sentMessage.message_id;
        }
    } catch (error) {
        console.error('Ошибка при обработке callback запроса:', error);
    }
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;

    if (text && text.startsWith('/')) return; // Пропускаем обработку команд

    if (text === '📊 Мои утилизации') {
        await UserUtilizationsHandler.handleMyUtilizations(bot, chatId);
        return;
    }

    // Проверяем, ожидаем ли мы ввод веса для утилизации
    if (bot.utilizationState && bot.utilizationState[chatId] && bot.utilizationState[chatId].step === 'weight') {
        await UtilizationHandler.handleWeightInput(bot, msg);
        return;
    }

    // Проверяем, редактируется ли профиль
    if (profileHandler.userStates[chatId] && profileHandler.userStates[chatId].isEditing) {
        await profileHandler.handleEdit(msg);
        return;
    }

    // Проверяем регистрацию
    if (userStates[chatId] && userStates[chatId].isRegistering) {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            console.error('Ошибка при удалении сообщения пользователя:', error);
        }

        switch (userStates[chatId].step) {
            case 'fio':
                if (!/^[а-яА-ЯёЁ\s]+$/.test(text)) {
                    await deletePreviousMessage(chatId);
                    const sentMessage = await bot.sendMessage(chatId, 'Пожалуйста, введите ФИО только русскими буквами:');
                    userStates[chatId].lastMessageId = sentMessage.message_id;
                    return;
                }
                userStates[chatId].fio = text;
                userStates[chatId].step = 'age';
                await deletePreviousMessage(chatId);
                const ageMessage = await bot.sendMessage(chatId, 'Введите ваш возраст (от 1 до 100):');
                userStates[chatId].lastMessageId = ageMessage.message_id;
                break;

            case 'age':
                if (!/^\d+$/.test(text) || parseInt(text) < 1 || parseInt(text) > 100) {
                    await deletePreviousMessage(chatId);
                    const sentMessage = await bot.sendMessage(chatId, 'Пожалуйста, введите корректный возраст (от 1 до 100):');
                    userStates[chatId].lastMessageId = sentMessage.message_id;
                    return;
                }
                userStates[chatId].age = text;
                userStates[chatId].step = 'location';
                await deletePreviousMessage(chatId);
                const locationMessage = await bot.sendMessage(chatId, 'Введите ваше местоположение:');
                userStates[chatId].lastMessageId = locationMessage.message_id;
                break;

            case 'location':
                userStates[chatId].location = text;
                userStates[chatId].step = 'photo';
                await deletePreviousMessage(chatId);
                const photoMessage = await bot.sendMessage(chatId, 'Пожалуйста, отправьте вашу фотографию:');
                userStates[chatId].lastMessageId = photoMessage.message_id;
                break;

            case 'photo':
                if (!photo) {
                    await deletePreviousMessage(chatId);
                    const sentMessage = await bot.sendMessage(chatId, 'Пожалуйста, отправьте фотографию:');
                    userStates[chatId].lastMessageId = sentMessage.message_id;
                    return;
                }

                // Берем последнюю (самую качественную) версию фотографии
                const photoId = photo[photo.length - 1].file_id;
                
                try {
                    const result = await pool.query(
                        'INSERT INTO users (chat_id, fio, age, location, photo_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                        [chatId, userStates[chatId].fio, userStates[chatId].age, userStates[chatId].location, photoId]
                    );
                    
                    console.log('Данные успешно записаны:', result.rows[0]);

                    await deletePreviousMessage(chatId);
                    await bot.sendMessage(
                        chatId,
                        'Ваш профиль успешно зарегистрирован! Используйте меню слева (☰) для доступа к функциям бота.'
                    );
                    delete userStates[chatId];
                } catch (error) {
                    console.error('Ошибка при сохранении в базу данных:', error);
                    await deletePreviousMessage(chatId);
                    const errorMessage = await bot.sendMessage(
                        chatId,
                        'Произошла ошибка при регистрации. Пожалуйста, попробуйте еще раз, написав команду /start'
                    );
                    userStates[chatId].lastMessageId = errorMessage.message_id;
                }
                break;
        }
        return;
    }

    // Если дошли до этой точки, значит это "случайное" сообщение
    // Проверяем, зарегистрирован ли пользователь
    try {
        const result = await pool.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);
        const message = result.rows.length > 0 
            ? 'Извините, я не совсем понимаю, что от меня требуется, предлагаю воспользоваться доступным функционалом! Загляните в меню для более широкой выборки действий!'
            : 'Для использования бота необходимо зарегистрироваться:';

        const keyboard = result.rows.length > 0 
            ? {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🗑 Утилизировать', callback_data: 'utilization' },
                            { text: '📊 Мои утилизации', callback_data: 'my_utilizations' }
                        ],
                        [
                            { text: '👤 Мой профиль', callback_data: 'my_profile' },
                            { text: '🎨 Магазин стикеров', callback_data: 'shop' }
                        ],
                        [
                            { text: '📋 О сервисе', callback_data: 'about' }
                        ]
                    ]
                }
            }
            : {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Регистрация', callback_data: 'register' }]
                    ]
                }
            };

        await bot.sendMessage(chatId, message, keyboard);
    } catch (error) {
        console.error('Ошибка при проверке регистрации:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Добавляем обработчик команды /shop
bot.onText(/\/shop/, async (msg) => {
    const chatId = msg.chat.id;
    await ShopHandler.handleShopMenu(bot, chatId);
});

// Обработка ошибок бота
bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

console.log('Бот запущен и ожидает сообщений...'); 