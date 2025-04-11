const User = require('../models/user');
const Award = require('../models/award');
const ExcelJS = require('exceljs');

class AwardsHandler {
    static async handleMyAwards(bot, chatId) {
        try {
            const awards = await Award.getUserAwards(chatId);
            
            if (awards.length === 0) {
                await bot.sendMessage(chatId, 
                    'У вас пока нет наград. Сдавайте отходы на переработку, чтобы получать награды! 🌱'
                );
                return;
            }

            // Получаем только последние 5 наград
            const recentAwards = awards.slice(0, 5);

            const message = `🏆 Ваши награды (всего ${awards.length}):\n\n` +
                recentAwards.map((award, index) => 
                    `${index + 1}. ${award.name}\n` +
                    `   ${award.description}\n` +
                    `   Получена: ${new Date(award.awarded_at).toLocaleDateString('ru-RU')}`
                ).join('\n\n');

            // Добавляем кнопку для выгрузки всех наград, если их больше 5
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📥 Выгрузить все награды', callback_data: 'download_awards' }],
                    [{ text: '« Назад в профиль', callback_data: 'back_to_profile' }]
                ]
            };

            await bot.sendMessage(chatId, message, { reply_markup: keyboard });
        } catch (error) {
            console.error('Ошибка при получении наград пользователя:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при получении наград. Пожалуйста, попробуйте позже.');
        }
    }

    static async handleDownloadAwards(bot, chatId) {
        try {
            const awards = await Award.getUserAwards(chatId);

            if (awards.length === 0) {
                await bot.sendMessage(chatId, 'У вас пока нет наград для выгрузки.');
                return;
            }

            // Создаем новую рабочую книгу Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Награды');

            // Устанавливаем заголовки
            worksheet.columns = [
                { header: '№', key: 'number', width: 5 },
                { header: 'Награда', key: 'name', width: 30 },
                { header: 'Описание', key: 'description', width: 40 },
                { header: 'Дата получения', key: 'awarded_at', width: 20 }
            ];

            // Добавляем данные
            awards.forEach((award, index) => {
                worksheet.addRow({
                    number: index + 1,
                    name: award.name,
                    description: award.description,
                    awarded_at: new Date(award.awarded_at).toLocaleDateString('ru-RU')
                });
            });

            // Стилизуем заголовки
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Создаем буфер с файлом
            const buffer = await workbook.xlsx.writeBuffer();

            // Отправляем файл с правильным именем и типом
            await bot.sendDocument(chatId, buffer, {
                filename: 'awards.xlsx',
                caption: '📊 Ваши награды',
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }, {
                // Явно указываем, что это файл
                filename: 'awards.xlsx',
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

        } catch (error) {
            console.error('Ошибка при создании Excel-файла:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при создании файла. Пожалуйста, попробуйте позже.');
        }
    }

    static async checkAndAwardUser(bot, chatId, points) {
        try {
            const user = await User.findByChatId(chatId);
            if (!user) return;

            const totalPoints = user.points;
            
            // Проверяем достижения на основе общего количества баллов
            const awards = [
                { points: 100, name: '🌱 Эко-новичок', description: 'Набрано 100 баллов' },
                { points: 500, name: '🌿 Эко-энтузиаст', description: 'Набрано 500 баллов' },
                { points: 1000, name: '🌳 Защитник природы', description: 'Набрано 1000 баллов' },
                { points: 5000, name: '🌍 Эко-герой', description: 'Набрано 5000 баллов' },
                { points: 10000, name: '⭐ Эко-легенда', description: 'Набрано 10000 баллов' }
            ];

            for (const award of awards) {
                if (totalPoints >= award.points) {
                    // Проверяем, есть ли уже такая награда у пользователя
                    const existingAward = await Award.findUserAward(chatId, award.name);
                    if (!existingAward) {
                        // Создаем новую награду
                        await Award.create(chatId, award.name, award.description);
                        
                        // Отправляем уведомление пользователю
                        await bot.sendMessage(chatId, 
                            `🎉 Поздравляем! Вы получили новую награду:\n\n${award.name}\n${award.description}`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🏆 Посмотреть все награды', callback_data: 'my_awards' }]
                                ]
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error in checkAndAwardUser:', error);
        }
    }
}

module.exports = AwardsHandler; 