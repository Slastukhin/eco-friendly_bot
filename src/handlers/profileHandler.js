const { getUserProfile, updateUserProfile } = require('../database/db');

class ProfileHandler {
    constructor(bot) {
        this.bot = bot;
        this.userStates = {};
    }

    // Форматирование профиля пользователя
    formatProfile(profile) {
        return `📋 *Ваш профиль:*\n\n` +
               `👤 *ФИО:* ${profile.fio}\n` +
               `🎂 *Возраст:* ${profile.age} лет\n` +
               `📍 *Местоположение:* ${profile.location}\n`;
    }

    // Показать профиль пользователя
    async showProfile(chatId) {
        try {
            const profile = await getUserProfile(chatId);
            if (!profile) {
                await this.bot.sendMessage(chatId, 'Профиль не найден.');
                return;
            }

            // Отправляем фото и информацию о профиле
            await this.bot.sendPhoto(chatId, profile.photo_id, {
                caption: this.formatProfile(profile),
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('Ошибка при получении профиля:', error);
            await this.bot.sendMessage(chatId, 'Произошла ошибка при получении данных профиля.');
        }
    }

    // Показать меню редактирования профиля
    async showEditMenu(chatId) {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Изменить ФИО', callback_data: 'edit_fio' }],
                    [{ text: 'Изменить возраст', callback_data: 'edit_age' }],
                    [{ text: 'Изменить местоположение', callback_data: 'edit_location' }],
                    [{ text: 'Изменить фото', callback_data: 'edit_photo' }],
                    [{ text: '« Назад', callback_data: 'back_to_profile' }]
                ]
            }
        };

        await this.bot.sendMessage(chatId, 'Выберите, что хотите изменить:', keyboard);
    }

    // Начать процесс редактирования поля
    async startFieldEdit(chatId, field) {
        const messages = {
            fio: 'Введите новое ФИО (только русские буквы):',
            age: 'Введите новый возраст (от 1 до 100):',
            location: 'Введите новое местоположение:',
            photo: 'Отправьте новую фотографию:'
        };

        this.userStates[chatId] = { 
            isEditing: true, 
            field: field 
        };

        await this.bot.sendMessage(chatId, messages[field]);
    }

    // Обработка редактирования полей
    async handleEdit(msg) {
        const chatId = msg.chat.id;
        const state = this.userStates[chatId];

        if (!state || !state.isEditing) return;

        try {
            let value;
            let isValid = true;
            const text = msg.text;
            const photo = msg.photo;

            switch (state.field) {
                case 'fio':
                    if (!/^[а-яА-ЯёЁ\s]+$/.test(text)) {
                        await this.bot.sendMessage(chatId, 'Пожалуйста, введите ФИО только русскими буквами:');
                        isValid = false;
                    }
                    value = text;
                    break;

                case 'age':
                    if (!/^\d+$/.test(text) || parseInt(text) < 1 || parseInt(text) > 100) {
                        await this.bot.sendMessage(chatId, 'Пожалуйста, введите корректный возраст (от 1 до 100):');
                        isValid = false;
                    }
                    value = parseInt(text);
                    break;

                case 'location':
                    value = text;
                    break;

                case 'photo':
                    if (!photo) {
                        await this.bot.sendMessage(chatId, 'Пожалуйста, отправьте фотографию:');
                        isValid = false;
                        break;
                    }
                    value = photo[photo.length - 1].file_id;
                    break;
            }

            if (!isValid) return;

            // Обновляем данные в базе
            await updateUserProfile(chatId, state.field, value);
            
            // Очищаем состояние
            delete this.userStates[chatId];

            // Отправляем сообщение об успехе
            await this.bot.sendMessage(chatId, 'Данные успешно обновлены!');
            
            // Показываем обновленный профиль
            await this.showProfile(chatId);

        } catch (error) {
            console.error('Ошибка при обновлении данных:', error);
            await this.bot.sendMessage(chatId, 'Произошла ошибка при обновлении данных. Пожалуйста, попробуйте снова.');
        }
    }

    // Обработчик callback query для профиля
    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const action = query.data;

        switch (action) {
            case 'my_profile':
                await this.showProfile(chatId);
                break;

            case 'edit_profile':
                await this.showEditMenu(chatId);
                break;

            case 'edit_fio':
                await this.startFieldEdit(chatId, 'fio');
                break;

            case 'edit_age':
                await this.startFieldEdit(chatId, 'age');
                break;

            case 'edit_location':
                await this.startFieldEdit(chatId, 'location');
                break;

            case 'edit_photo':
                await this.startFieldEdit(chatId, 'photo');
                break;

            case 'back_to_profile':
                // Показываем основное меню профиля
                await this.bot.sendMessage(chatId, 'Выберите действие:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Мой профиль', callback_data: 'my_profile' }],
                            [{ text: 'Редактировать профиль', callback_data: 'edit_profile' }],
                            [{ text: 'Мои награды', callback_data: 'my_awards' }],
                            [{ text: 'Мои утилизации', callback_data: 'my_utilizations' }],
                            [{ text: 'Моя статистика', callback_data: 'my_statistics' }],
                            [{ text: '🎨 Магазин стикеров', callback_data: 'shop' }]
                        ]
                    }
                });
                break;
        }
    }
}

module.exports = ProfileHandler; 