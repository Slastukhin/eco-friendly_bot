const { pool } = require('../database/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class UserUtilizationsHandler {
    static async handleMyUtilizations(bot, chatId) {
        try {
            // Сначала проверяем существование пользователя
            const userCheck = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            if (userCheck.rows.length === 0) {
                await bot.sendMessage(chatId, 'Для просмотра утилизаций необходимо зарегистрироваться.');
                return;
            }

            console.log('Fetching utilizations for chat_id:', chatId);
            
            // Получаем 6 последних утилизаций (5 для отображения + 1 для проверки наличия дополнительных)
            const result = await pool.query(`
                SELECT 
                    u.date_utilized,
                    u.time_utilized,
                    c.name as city_name,
                    cp.address,
                    wt.name as waste_type,
                    u.weight
                FROM utilizations u
                JOIN users usr ON u.user_id = usr.id
                JOIN collection_points cp ON u.collection_point_id = cp.id
                JOIN cities c ON cp.city_id = c.id
                JOIN waste_types wt ON u.waste_type_id = wt.id
                WHERE usr.chat_id = $1
                ORDER BY u.date_utilized DESC, u.time_utilized DESC
                LIMIT 6
            `, [chatId]);

            console.log('Query result:', result.rows);

            if (result.rows.length === 0) {
                await bot.sendMessage(chatId, 'У вас пока нет записей об утилизации.');
                return;
            }

            // Формируем сообщение с последними 5 утилизациями
            let message = '🗂 Ваши последние утилизации:\n\n';
            const utilizationsToShow = result.rows.slice(0, 5);

            for (const util of utilizationsToShow) {
                const date = new Date(util.date_utilized).toLocaleDateString('ru-RU');
                const time = util.time_utilized ? util.time_utilized.slice(0, 5) : '00:00';
                message += `📅 ${date} ${time}\n`;
                message += `📍 ${util.city_name}, ${util.address}\n`;
                message += `🗑 ${util.waste_type}\n`;
                message += `⚖️ ${util.weight} кг\n\n`;
            }

            // Если есть больше 5 утилизаций, добавляем кнопку "Смотреть всё"
            const keyboard = result.rows.length > 5 ? {
                inline_keyboard: [
                    [{ text: 'Смотреть всё', callback_data: 'view_all_utilizations' }]
                ]
            } : undefined;

            await bot.sendMessage(chatId, message, {
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Ошибка при получении утилизаций:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при получении данных об утилизациях.');
        }
    }

    static async handleViewAllUtilizations(bot, query) {
        const chatId = query.message.chat.id;

        try {
            // Сначала проверяем существование пользователя
            const userCheck = await pool.query('SELECT id FROM users WHERE chat_id = $1', [chatId]);
            if (userCheck.rows.length === 0) {
                await bot.sendMessage(chatId, 'Для просмотра утилизаций необходимо зарегистрироваться.');
                return;
            }

            console.log('Fetching all utilizations for chat_id:', chatId);

            // Получаем все утилизации пользователя
            const result = await pool.query(`
                SELECT 
                    u.date_utilized,
                    u.time_utilized,
                    c.name as city_name,
                    cp.address,
                    wt.name as waste_type,
                    u.weight
                FROM utilizations u
                JOIN users usr ON u.user_id = usr.id
                JOIN collection_points cp ON u.collection_point_id = cp.id
                JOIN cities c ON cp.city_id = c.id
                JOIN waste_types wt ON u.waste_type_id = wt.id
                WHERE usr.chat_id = $1
                ORDER BY u.date_utilized DESC, u.time_utilized DESC
            `, [chatId]);

            console.log('Query result:', result.rows);

            if (result.rows.length === 0) {
                await bot.sendMessage(chatId, 'У вас нет записей об утилизации.');
                return;
            }

            // Создаем Excel файл
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Утилизации');

            // Добавляем заголовки
            worksheet.columns = [
                { header: 'Дата', key: 'date', width: 12 },
                { header: 'Время', key: 'time', width: 10 },
                { header: 'Город', key: 'city', width: 20 },
                { header: 'Адрес', key: 'address', width: 30 },
                { header: 'Тип отходов', key: 'waste_type', width: 20 },
                { header: 'Вес (кг)', key: 'weight', width: 15 }
            ];

            // Добавляем данные
            for (const util of result.rows) {
                worksheet.addRow({
                    date: new Date(util.date_utilized).toLocaleDateString('ru-RU'),
                    time: util.time_utilized ? util.time_utilized.slice(0, 5) : '00:00',
                    city: util.city_name,
                    address: util.address,
                    waste_type: util.waste_type,
                    weight: util.weight
                });
            }

            // Создаем директорию для файлов, если её нет
            const uploadsDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Сохраняем файл
            const fileName = `utilizations_${chatId}_${Date.now()}.xlsx`;
            const filePath = path.join(uploadsDir, fileName);
            await workbook.xlsx.writeFile(filePath);

            // Отправляем файл
            await bot.sendDocument(chatId, filePath, {
                caption: '📊 Отчет по всем вашим утилизациям'
            });

            // Удаляем файл после отправки
            fs.unlinkSync(filePath);

        } catch (error) {
            console.error('Ошибка при создании отчета:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при создании отчета.');
        }
    }
}

module.exports = UserUtilizationsHandler; 