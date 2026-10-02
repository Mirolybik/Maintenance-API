# Maintenance API (Кейс 3: PostgreSQL, Sequelize & Transactions)

REST API сервис учёта заявок на техническое обслуживание оборудования. В Кейсе 3 сервис переведён на персистентное хранилище PostgreSQL с сохранением внешнего контракта API, транзакционной моделью и аналитическими отчетами.

## 🗄️ Схема данных и связи (3НФ)
* `sites` (1:N) `equipment` — площадки объединяют оборудование (внешний ключ `site_id` в таблице `equipment`).
* `equipment` (1:1) `equipment_passports` — технический паспорт с уникальным внешним ключом `equipment_id`.
* `equipment` (1:N) `maintenance_requests` — заявки привязаны к оборудованию (`equipment_id`).
* `maintenance_requests` (1:N) `request_status_history` — иммутабельный журнал аудита статусов (записи только вставляются).
* `maintenance_requests` (N:M) `technicians` — назначение бригады через связующую таблицу `request_assignees` с составным первичным ключом `(request_id, technician_id)` и полями `role` (`lead` | `member`) и `hours`.

## 🚀 Порядок запуска с нуля
1. Запуск БД в Docker:
   ```bash
   docker compose up -d db
Применение миграций:

Bash
npm run db:migrate
Наполнение базы сидами (демо-данные):

Bash
npm run db:seed
Запуск сервера:

Bash
npm run dev
🔄 Порядок отката миграций
Для демонстрации полного цикла отката и повторного применения выполните:

Bash
npm run db:migrate:undo
npm run db:migrate
npm run db:seed
🛡️ Безопасность и защита от SQL-инъекций
Все Raw SQL запросы используют строгую параметризацию (replacements).

Сортировка проверяется по белому списку полей (totalRequests, closedRequests, totalHours, lastMaintenanceDate).

Значения параметров limit, minRequests валидируются через Zod (.strict()).

📊 Новые эндпоинты Кейса 3
POST /api/requests/:id/assignees — назначение бригады (транзакция, ровно 1 lead).

DELETE /api/requests/:id/assignees/:userId — снятие специалиста с заявки.

GET /api/requests/:id/history — аудит-лог изменения статусов заявки.

GET /api/sites/:id/summary — сводка по площадке со средним временем закрытия заявок.

GET /api/reports/equipment-load — параметризованный аналитический SQL-отчет по нагрузке.
