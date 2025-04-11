const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { pool } = require('../database/db');

class StatisticsHandler {
    static async handleStatisticsMenu(bot, chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📊 Статистика по городам', callback_data: 'stats_cities' }],
                [{ text: '📍 Статистика по пунктам приёма', callback_data: 'stats_points' }],
                [{ text: '🗑️ Статистика по материалам', callback_data: 'stats_materials' }],
                [{ text: '« Назад в профиль', callback_data: 'back_to_profile' }]
            ]
        };

        await bot.sendMessage(chatId, 
            '📈 Выберите тип статистики для просмотра:',
            { reply_markup: keyboard }
        );
    }

    static async handleCitiesStats(bot, chatId) {
        let statusMessage;
        try {
            // Отправляем сообщение о начале создания графика
            statusMessage = await bot.sendMessage(chatId, '🔄 Формирую статистику по городам...');

            // Получаем статистику по городам
            const result = await pool.query(`
                SELECT c.name as city, COUNT(*) as count
                FROM utilizations u
                JOIN users usr ON u.user_id = usr.id
                JOIN collection_points cp ON u.collection_point_id = cp.id
                JOIN cities c ON cp.city_id = c.id
                WHERE usr.chat_id = $1
                GROUP BY c.name
                ORDER BY count DESC
            `, [chatId]);

            if (result.rows.length === 0) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
                await bot.sendMessage(chatId, 'У вас пока нет утилизаций для построения статистики.');
                return;
            }

            const chartData = {
                labels: result.rows.map(row => row.city),
                values: result.rows.map(row => parseInt(row.count))
            };

            const buffer = await this.createBarChart(
                'Статистика утилизаций по городам',
                chartData.labels,
                chartData.values,
                'Количество утилизаций'
            );

            // Удаляем сообщение о создании графика
            await bot.deleteMessage(chatId, statusMessage.message_id);

            await bot.sendPhoto(chatId, buffer, {
                caption: '📊 Статистика утилизаций по городам',
                filename: 'cities_stats.png',
                contentType: 'image/png'
            });
        } catch (error) {
            console.error('Ошибка при создании статистики по городам:', error);
            // Если сообщение о создании графика существует, удаляем его
            if (statusMessage) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
            }
            await bot.sendMessage(chatId, 
                '❌ Не удалось создать статистику по городам.\n' +
                'Пожалуйста, попробуйте позже или обратитесь в поддержку.'
            );
        }
    }

    static async handlePointsStats(bot, chatId) {
        let statusMessage;
        try {
            // Отправляем сообщение о начале создания графика
            statusMessage = await bot.sendMessage(chatId, '🔄 Формирую статистику по пунктам приёма...');

            // Получаем статистику по пунктам приема
            const result = await pool.query(`
                SELECT cp.address, COUNT(*) as count
                FROM utilizations u
                JOIN users usr ON u.user_id = usr.id
                JOIN collection_points cp ON u.collection_point_id = cp.id
                WHERE usr.chat_id = $1
                GROUP BY cp.address
                ORDER BY count DESC
                LIMIT 10
            `, [chatId]);

            if (result.rows.length === 0) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
                await bot.sendMessage(chatId, 'У вас пока нет утилизаций для построения статистики.');
                return;
            }

            const chartData = {
                labels: result.rows.map(row => row.address.substring(0, 20) + '...'),
                values: result.rows.map(row => parseInt(row.count))
            };

            const buffer = await this.createBarChart(
                'Топ-10 пунктов приема',
                chartData.labels,
                chartData.values,
                'Количество утилизаций'
            );

            // Удаляем сообщение о создании графика
            await bot.deleteMessage(chatId, statusMessage.message_id);

            await bot.sendPhoto(chatId, buffer, {
                caption: '📍 Статистика утилизаций по пунктам приема',
                filename: 'points_stats.png',
                contentType: 'image/png'
            });
        } catch (error) {
            console.error('Ошибка при создании статистики по пунктам приема:', error);
            // Если сообщение о создании графика существует, удаляем его
            if (statusMessage) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
            }
            await bot.sendMessage(chatId, 
                '❌ Не удалось создать статистику по пунктам приёма.\n' +
                'Пожалуйста, попробуйте позже или обратитесь в поддержку.'
            );
        }
    }

    static async handleMaterialsStats(bot, chatId) {
        let statusMessage;
        try {
            // Отправляем сообщение о начале создания графика
            statusMessage = await bot.sendMessage(chatId, '🔄 Формирую статистику по материалам...');

            // Получаем статистику по материалам
            const result = await pool.query(`
                SELECT wt.name as material, COUNT(*) as count
                FROM utilizations u
                JOIN users usr ON u.user_id = usr.id
                JOIN waste_types wt ON u.waste_type_id = wt.id
                WHERE usr.chat_id = $1
                GROUP BY wt.name
                ORDER BY count DESC
            `, [chatId]);

            if (result.rows.length === 0) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
                await bot.sendMessage(chatId, 'У вас пока нет утилизаций для построения статистики.');
                return;
            }

            const chartData = {
                labels: result.rows.map(row => row.material),
                values: result.rows.map(row => parseInt(row.count))
            };

            const buffer = await this.createBarChart(
                'Статистика по типам материалов',
                chartData.labels,
                chartData.values,
                'Количество утилизаций'
            );

            // Удаляем сообщение о создании графика
            await bot.deleteMessage(chatId, statusMessage.message_id);

            await bot.sendPhoto(chatId, buffer, {
                caption: '🗑️ Статистика утилизаций по типам материалов',
                filename: 'materials_stats.png',
                contentType: 'image/png'
            });
        } catch (error) {
            console.error('Ошибка при создании статистики по материалам:', error);
            // Если сообщение о создании графика существует, удаляем его
            if (statusMessage) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
            }
            await bot.sendMessage(chatId, 
                '❌ Не удалось создать статистику по материалам.\n' +
                'Пожалуйста, попробуйте позже или обратитесь в поддержку.'
            );
        }
    }

    static async createBarChart(title, labels, data, yAxisLabel) {
        const width = 800;
        const height = 400;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
            width, 
            height,
            plugins: {
                modern: ['chartjs-plugin-datalabels']
            }
        });

        const configuration = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: yAxisLabel,
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value,
                        font: {
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisLabel,
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 20
                    }
                }
            }
        };

        const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
        return buffer;
    }
}

module.exports = StatisticsHandler; 