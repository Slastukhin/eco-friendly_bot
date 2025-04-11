# 🌱 ECO Friendly Bot

Telegram-бот для учета экологичной утилизации отходов. Помогает пользователям вести статистику сдачи различных типов отходов, находить пункты приема и получать награды за вклад в защиту окружающей среды.

## 🚀 Функциональность

- **👤 Профиль пользователя**
  - Регистрация и управление личными данными
  - Просмотр статистики утилизации
  - Система наград и достижений

- **♻️ Утилизация отходов**
  - Запись новых утилизаций
  - Выбор города и пункта приема
  - Указание типа и веса отходов

- **📊 Статистика**
  - Визуализация данных через графики
  - Статистика по городам
  - Статистика по пунктам приема
  - Статистика по типам материалов

- **🏆 Система наград**
  - Награды за утилизацию
  - Отслеживание прогресса
  - Экспорт истории утилизаций

## 🛠 Технические требования

- Node.js (версия 14 или выше)
- PostgreSQL (версия 12 или выше)
- npm или yarn

## ⚙️ Установка и запуск

1. **Клонирование репозитория**
   ```bash
   git clone https://github.com/your-username/eco-friendly_bot.git
   cd eco-friendly_bot
   ```

2. **Установка зависимостей**
   ```bash
   npm install
   ```

3. **Настройка базы данных**
   - Создайте базу данных PostgreSQL
   - Выполните SQL-скрипты из папки `src/database/migrations`
   ```bash
   psql -U your_username -d your_database -f src/database/migrations/init.sql
   ```

4. **Настройка конфигурации**
   - Создайте файл `.env` в корневой директории
   - Укажите необходимые переменные окружения:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_db_name
   ```

5. **Запуск бота**
   ```bash
   npm start
   ```

## 🤖 Команды бота

- `/start` - Начать работу с ботом
- `/profile` - Исследовать профиль
- `/utilization` - Записать утилизацию

## 📝 Структура проекта

```
eco-friendly_bot/
├── src/
│   ├── config/
│   ├── database/
│   │   └── migrations/
│   ├── handlers/
│   └── models/
├── .env
├── package.json
└── README.md
```

## 🔧 Разработка

1. Создайте новую ветку для разработки:
   ```bash
   git checkout -b feature/your-feature
   ```

2. Внесите необходимые изменения

3. Отправьте изменения в репозиторий:
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin feature/your-feature
   ```

## 📄 Лицензия

MIT License
