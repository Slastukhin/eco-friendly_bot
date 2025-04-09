require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('./database/db');
const ProfileHandler = require('./handlers/profileHandler');

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Инициализация обработчиков
const profileHandler = new ProfileHandler(bot);

// Проверка подключения к базе данных и структуры таблицы
async function checkDatabaseConnection() {
    try {
        const client = await pool.connect();
        console.log('Успешное подключение к базе данных');

        // Проверяем существование таблицы
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'newtable'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            // Создаем таблицу только если она не существует
            await client.query(`
                CREATE TABLE newtable (
                    id SERIAL PRIMARY KEY,
                    chat_id BIGINT NOT NULL,
                    fio VARCHAR(255) NOT NULL,
                    age INTEGER NOT NULL,
                    location VARCHAR(255) NOT NULL,
                    photo_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('Таблица newtable создана');
        } else {
            console.log('Таблица newtable уже существует');
        }

        client.release();
    } catch (err) {
        console.error('Ошибка при проверке базы данных:', err);
    }
}

// Вызываем функцию проверки при запуске
checkDatabaseConnection();

// Устанавливаем команды бота
bot.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'profile', description: 'Исследовать профиль' },
    { command: 'utilization', description: 'Записать утилизацию' },
    { command: 'statistics', description: 'Статистика' }
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
        const result = await pool.query('SELECT * FROM newtable WHERE chat_id = $1', [chatId]);
        
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
        const result = await pool.query('SELECT * FROM newtable WHERE chat_id = $1', [chatId]);
        if (result.rows.length > 0) {
            await bot.sendMessage(chatId, 'Вы уже зарегистрированы. Используйте меню слева для доступа к функциям бота.');
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

// Обработчик нажатия на inline кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    // Передаем обработку профильных действий в ProfileHandler
    if (['my_profile', 'edit_profile', 'edit_fio', 'edit_age', 'edit_location', 'edit_photo', 'back_to_profile'].includes(query.data)) {
        await profileHandler.handleCallbackQuery(query);
        return;
    }

    switch (query.data) {
        case 'register':
            await deletePreviousMessage(chatId);
            userStates[chatId] = { step: 'fio', isRegistering: true };
            const sentMessage = await bot.sendMessage(chatId, 'Введите ФИО (только русские буквы):');
            userStates[chatId].lastMessageId = sentMessage.message_id;
            break;
            
        case 'my_awards':
        case 'my_utilizations':
        case 'my_statistics':
            await bot.sendMessage(chatId, 'Функционал находится в разработке. Пожалуйста, попробуйте позже.');
            break;
    }
});

// Обработчик сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;

    if (text && text.startsWith('/')) return; // Пропускаем обработку команд

    // Проверяем, редактируется ли профиль
    if (profileHandler.userStates[chatId] && profileHandler.userStates[chatId].isEditing) {
        await profileHandler.handleEdit(msg);
        return;
    }

    console.log('Получено сообщение:', text, 'от пользователя:', chatId);

    // Удаляем сообщение пользователя только во время регистрации
    if (userStates[chatId] && userStates[chatId].isRegistering) {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            console.error('Ошибка при удалении сообщения пользователя:', error);
        }
    }

    if (userStates[chatId] && userStates[chatId].isRegistering) {
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
                        'INSERT INTO newtable (chat_id, fio, age, location, photo_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
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
    }
});

// Обработка ошибок бота
bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

console.log('Бот запущен и ожидает сообщений...'); 