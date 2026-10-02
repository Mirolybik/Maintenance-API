#!/bin/bash
set -e

echo "🧹 1. Полная очистка старой истории Git и временных файлов..."
# Сохраняем URL удаленного репозитория, если он был настроен
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")

rm -rf .git .sequelizerc
rm -rf node_modules coverage reports

git init -b main
if [ -n "$ORIGIN_URL" ]; then
  git remote add origin "$ORIGIN_URL"
  echo "🔗 Восстановлен remote origin: $ORIGIN_URL"
fi

echo "📦 2. Базовая инициализация package.json и конфигов качества кода..."

cat << 'EOF' > package.json
{
  "name": "maintenance-api",
  "version": "1.0.0",
  "description": "REST API сервис учёта заявок на обслуживание оборудования",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write \"src/**/*.js\"",
    "db:migrate": "sequelize-cli db:migrate --config src/config/database.cjs --migrations-path src/migrations",
    "db:migrate:undo": "sequelize-cli db:migrate:undo:all --config src/config/database.cjs --migrations-path src/migrations",
    "db:seed": "sequelize-cli db:seed:all --config src/config/database.cjs --seeders-path src/seeders",
    "db:seed:undo": "sequelize-cli db:seed:undo:all --config src/config/database.cjs --seeders-path src/seeders"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "express-rate-limit": "^7.4.1",
    "helmet": "^8.0.0",
    "pg": "^8.13.1",
    "pg-hstore": "^2.3.4",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "sequelize": "^6.37.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/js": "^9.14.0",
    "eslint": "^9.14.0",
    "jest": "^29.7.0",
    "prettier": "^3.3.3",
    "sequelize-cli": "^6.6.2",
    "supertest": "^7.0.0"
  },
  "jest": {
    "transform": {},
    "testEnvironment": "node"
  }
}
EOF

cat << 'EOF' > eslint.config.js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortController: "readonly"
      }
    },
    rules: {
      "no-console": "error",
      "no-unused-vars": "warn",
      "prefer-const": "error",
      "eqeqeq": "error"
    }
  }
];
EOF

cat << 'EOF' > .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
EOF

cat << 'EOF' > .gitignore
node_modules/
.env
coverage/
.DS_Store
EOF

cat << 'EOF' > .env.example
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
WEATHER_API_URL=https://api.open-meteo.com/v1/forecast
REQUEST_TIMEOUT_MS=5000

# Параметры подключения к PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maintenance_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
EOF

cp .env.example .env

# Базовые директории
mkdir -p src/{config,controllers,errors,middlewares,migrations,models,repositories,routes,seeders,services,utils,validators} tests docs/postman public

# Утилиты и обработчики
cat << 'EOF' > src/utils/catchAsync.js
export const catchAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
EOF

cat << 'EOF' > src/errors/index.js
export class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
export class NotFoundError extends AppError {
  constructor(message) { super(message, 404, 'NOT_FOUND'); }
}
export class ValidationError extends AppError {
  constructor(message, details = null) { super(message, 422, 'VALIDATION_ERROR', details); }
}
export class ConflictError extends AppError {
  constructor(message) { super(message, 409, 'CONFLICT'); }
}
EOF

cat << 'EOF' > src/middlewares/logger.js
import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';

export const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customProps: (req) => ({ requestId: req.id }),
  autoLogging: { ignore: (req) => req.url === '/api/health' }
});
EOF

cat << 'EOF' > src/middlewares/validate.js
import { ValidationError } from '../errors/index.js';

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;
    next();
  } catch (error) {
    const details = error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
    next(new ValidationError('Некорректные данные запроса', details));
  }
};
EOF

cat << 'EOF' > src/services/weather.service.js
import { AppError } from '../errors/index.js';

export const WeatherService = {
  getForecast: async (lat, lon) => {
    const url = new URL(process.env.WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', lat.toString());
    url.searchParams.append('longitude', lon.toString());
    url.searchParams.append('current', 'precipitation,wind_speed_10m');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), parseInt(process.env.REQUEST_TIMEOUT_MS || '5000', 10));

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Weather API returned ${res.status}`);

      const data = await res.json();
      const precip = data.current.precipitation;
      const wind = data.current.wind_speed_10m;
      const suitable = precip === 0 && wind < 10;

      return { current: data.current, windowSuitable: suitable };
    } catch (error) {
      clearTimeout(timeoutId);
      throw new AppError('Не удалось получить данные о погоде', 503, 'WEATHER_UNAVAILABLE');
    }
  }
};
EOF

git add .
git commit -m "chore: инициализация проекта, структуры директорий и базовых утилит"

# ==============================================================================
# ВЕТКА 1: feat/db-schema-migrations (PostgreSQL, Docker, Миграции и Сиды)
# ==============================================================================
echo "🌿 3. Создаем ветку feat/db-schema-migrations..."
git checkout -b feat/db-schema-migrations

cat << 'EOF' > docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    container_name: maintenance_postgres
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME:-maintenance_db}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-maintenance_db}"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    container_name: maintenance_api
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${PORT:-3000}:3000"
    env_file: .env
    environment:
      DB_HOST: db

volumes:
  pgdata:
EOF

cat << 'EOF' > src/config/database.cjs
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'maintenance_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: 30000,
      idle: 10000
    }
  }
};
EOF

cat << 'EOF' > src/config/db.js
import { Sequelize } from 'sequelize';
import { logger } from '../middlewares/logger.js';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'maintenance_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;
EOF

# Миграция создания всех 7 таблиц
cat << 'EOF' > src/migrations/20261001000001-create-all-tables.cjs
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sites', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      region: { type: Sequelize.STRING(100), allowNull: false },
      lat: { type: Sequelize.DOUBLE, allowNull: false },
      lon: { type: Sequelize.DOUBLE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('equipment', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      site_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: { type: Sequelize.STRING(100), allowNull: false },
      type: {
        type: Sequelize.ENUM('turbine', 'inverter', 'sensor', 'substation'),
        allowNull: false
      },
      serial_number: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      location: { type: Sequelize.JSONB, allowNull: false },
      status: {
        type: Sequelize.ENUM('operational', 'maintenance', 'fault', 'decommissioned'),
        allowNull: false,
        defaultValue: 'operational'
      },
      installed_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('equipment_passports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      equipment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'equipment', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      manufacturer: { type: Sequelize.STRING(100), allowNull: false },
      model: { type: Sequelize.STRING(100), allowNull: false },
      nominal_power: { type: Sequelize.DOUBLE, allowNull: false },
      last_inspection_date: { type: Sequelize.DATEONLY, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('maintenance_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      equipment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'equipment', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      title: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.STRING(2000), allowNull: false },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
      },
      status: {
        type: Sequelize.ENUM('new', 'in_progress', 'done', 'rejected'),
        allowNull: false,
        defaultValue: 'new'
      },
      planned_at: { type: Sequelize.DATE, allowNull: true },
      author: { type: Sequelize.STRING(100), allowNull: false, defaultValue: 'system' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('request_status_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'maintenance_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      from_status: { type: Sequelize.STRING(50), allowNull: true },
      to_status: { type: Sequelize.STRING(50), allowNull: false },
      changed_by: { type: Sequelize.STRING(100), allowNull: false, defaultValue: 'system' },
      comment: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('technicians', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      full_name: { type: Sequelize.STRING(150), allowNull: false },
      specialization: { type: Sequelize.STRING(100), allowNull: false },
      employee_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('request_assignees', {
      request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'maintenance_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      technician_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'technicians', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.ENUM('lead', 'member'),
        allowNull: false,
        defaultValue: 'member'
      },
      hours: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('request_assignees');
    await queryInterface.dropTable('technicians');
    await queryInterface.dropTable('request_status_history');
    await queryInterface.dropTable('maintenance_requests');
    await queryInterface.dropTable('equipment_passports');
    await queryInterface.dropTable('equipment');
    await queryInterface.dropTable('sites');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_equipment_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_equipment_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_maintenance_requests_priority";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_maintenance_requests_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_request_assignees_role";');
  }
};
EOF

# Сиды демонстрационных данных
cat << 'EOF' > src/seeders/20261001000002-demo-data.cjs
'use strict';
const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const site1 = crypto.randomUUID();
    const site2 = crypto.randomUUID();

    await queryInterface.bulkInsert('sites', [
      { id: site1, name: 'Ветропарк Северный', code: 'WIND-NORTH', region: 'Мурманская область', lat: 68.97, lon: 33.08 },
      { id: site2, name: 'Солнечная станция Южная', code: 'SOLAR-SOUTH', region: 'Краснодарский край', lat: 45.03, lon: 38.97 }
    ]);

    const techIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await queryInterface.bulkInsert('technicians', [
      { id: techIds[0], full_name: 'Иванов Иван Иванович', specialization: 'Главный механик', employee_number: 'EMP-001' },
      { id: techIds[1], full_name: 'Петров Петр Сергеевич', specialization: 'Электромонтер', employee_number: 'EMP-002' },
      { id: techIds[2], full_name: 'Сидоров Алексей Михайлович', specialization: 'Инженер АСУ ТП', employee_number: 'EMP-003' },
      { id: techIds[3], full_name: 'Смирнов Дмитрий Павлович', specialization: 'Техник-диагност', employee_number: 'EMP-004' },
      { id: techIds[4], full_name: 'Кузнецов Артем Игоревич', specialization: 'Монтажник ВЛЭП', employee_number: 'EMP-005' }
    ]);

    const equipIds = [];
    const equipData = [
      { name: 'Турбина ВЭУ-1', type: 'turbine', sn: 'TRB-001', site: site1, lat: 68.97, lon: 33.08 },
      { name: 'Турбина ВЭУ-2', type: 'turbine', sn: 'TRB-002', site: site1, lat: 68.98, lon: 33.09 },
      { name: 'Инверторная подстанция 1', type: 'inverter', sn: 'INV-101', site: site1, lat: 68.96, lon: 33.07 },
      { name: 'Датчик метеорологический', type: 'sensor', sn: 'SNS-501', site: site2, lat: 45.03, lon: 38.97 },
      { name: 'Инвертор Солнечный СИ-1', type: 'inverter', sn: 'INV-201', site: site2, lat: 45.04, lon: 38.98 },
      { name: 'Главная трансформаторная подстанция', type: 'substation', sn: 'SUB-901', site: site2, lat: 45.02, lon: 38.96 }
    ];

    const passports = [];
    for (const e of equipData) {
      const id = crypto.randomUUID();
      equipIds.push(id);
      passports.push({
        id: crypto.randomUUID(),
        equipment_id: id,
        manufacturer: 'Siemens Energy / Vestas',
        model: 'Model-X2026',
        nominal_power: 2500.0,
        last_inspection_date: '2026-05-15'
      });
    }

    await queryInterface.bulkInsert('equipment', equipData.map((e, idx) => ({
      id: equipIds[idx],
      site_id: e.site,
      name: e.name,
      type: e.type,
      serial_number: e.sn,
      location: JSON.stringify({ lat: e.lat, lon: e.lon }),
      status: 'operational',
      installed_at: new Date('2024-01-15')
    })));

    await queryInterface.bulkInsert('equipment_passports', passports);

    const requests = [];
    const history = [];
    const assignees = [];
    const statuses = ['new', 'in_progress', 'done', 'rejected'];
    const priorities = ['low', 'medium', 'high', 'critical'];

    for (let i = 1; i <= 24; i++) {
      const reqId = crypto.randomUUID();
      const eqId = equipIds[i % equipIds.length];
      const status = statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];

      requests.push({
        id: reqId,
        equipment_id: eqId,
        title: `Регламентная заявка #${i} на обслуживание`,
        description: `Проведение комплексного планового ТО согласно регламенту #${i}.`,
        priority,
        status,
        author: 'Диспетчер Смены',
        created_at: new Date(Date.now() - (30 - i) * 86400000),
        updated_at: new Date()
      });

      history.push({
        id: crypto.randomUUID(),
        request_id: reqId,
        from_status: null,
        to_status: 'new',
        changed_by: 'system',
        comment: 'Автоматическая регистрация заявки'
      });

      if (status !== 'new') {
        history.push({
          id: crypto.randomUUID(),
          request_id: reqId,
          from_status: 'new',
          to_status: status,
          changed_by: 'Оператор',
          comment: `Перевод в статус ${status}`
        });

        assignees.push({
          request_id: reqId,
          technician_id: techIds[0],
          role: 'lead',
          hours: 8.5
        });
        assignees.push({
          request_id: reqId,
          technician_id: techIds[1],
          role: 'member',
          hours: 6.0
        });
      }
    }

    await queryInterface.bulkInsert('maintenance_requests', requests);
    await queryInterface.bulkInsert('request_status_history', history);
    await queryInterface.bulkInsert('request_assignees', assignees);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('request_assignees', null, {});
    await queryInterface.bulkDelete('request_status_history', null, {});
    await queryInterface.bulkDelete('maintenance_requests', null, {});
    await queryInterface.bulkDelete('equipment_passports', null, {});
    await queryInterface.bulkDelete('equipment', null, {});
    await queryInterface.bulkDelete('technicians', null, {});
    await queryInterface.bulkDelete('sites', null, {});
  }
};
EOF

# Модели Sequelize
cat << 'EOF' > src/models/index.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export const Site = sequelize.define('Site', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  region: { type: DataTypes.STRING, allowNull: false },
  lat: { type: DataTypes.DOUBLE, allowNull: false },
  lon: { type: DataTypes.DOUBLE, allowNull: false }
}, { tableName: 'sites', underscored: true });

export const Equipment = sequelize.define('Equipment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  siteId: { type: DataTypes.UUID, field: 'site_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('turbine', 'inverter', 'sensor', 'substation'), allowNull: false },
  serialNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'serial_number' },
  location: { type: DataTypes.JSONB, allowNull: false },
  status: { type: DataTypes.ENUM('operational', 'maintenance', 'fault', 'decommissioned'), defaultValue: 'operational' },
  installedAt: { type: DataTypes.DATE, allowNull: false, field: 'installed_at' }
}, { tableName: 'equipment', underscored: true });

export const EquipmentPassport = sequelize.define('EquipmentPassport', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  equipmentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'equipment_id' },
  manufacturer: { type: DataTypes.STRING, allowNull: false },
  model: { type: DataTypes.STRING, allowNull: false },
  nominalPower: { type: DataTypes.DOUBLE, allowNull: false, field: 'nominal_power' },
  lastInspectionDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'last_inspection_date' }
}, { tableName: 'equipment_passports', underscored: true });

export const MaintenanceRequest = sequelize.define('MaintenanceRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  equipmentId: { type: DataTypes.UUID, allowNull: false, field: 'equipment_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('new', 'in_progress', 'done', 'rejected'), defaultValue: 'new' },
  plannedAt: { type: DataTypes.DATE, field: 'planned_at' },
  author: { type: DataTypes.STRING, defaultValue: 'system' }
}, { tableName: 'maintenance_requests', underscored: true });

export const RequestStatusHistory = sequelize.define('RequestStatusHistory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requestId: { type: DataTypes.UUID, allowNull: false, field: 'request_id' },
  fromStatus: { type: DataTypes.STRING, field: 'from_status' },
  toStatus: { type: DataTypes.STRING, allowNull: false, field: 'to_status' },
  changedBy: { type: DataTypes.STRING, defaultValue: 'system', field: 'changed_by' },
  comment: { type: DataTypes.STRING }
}, { tableName: 'request_status_history', underscored: true, updatedAt: false });

export const Technician = sequelize.define('Technician', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fullName: { type: DataTypes.STRING, allowNull: false, field: 'full_name' },
  specialization: { type: DataTypes.STRING, allowNull: false },
  employeeNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'employee_number' }
}, { tableName: 'technicians', underscored: true });

export const RequestAssignee = sequelize.define('RequestAssignee', {
  requestId: { type: DataTypes.UUID, primaryKey: true, field: 'request_id' },
  technicianId: { type: DataTypes.UUID, primaryKey: true, field: 'technician_id' },
  role: { type: DataTypes.ENUM('lead', 'member'), defaultValue: 'member' },
  hours: { type: DataTypes.DOUBLE, defaultValue: 0 }
}, { tableName: 'request_assignees', underscored: true });

// Настройка связей
Site.hasMany(Equipment, { foreignKey: 'site_id', as: 'equipment' });
Equipment.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });

Equipment.hasOne(EquipmentPassport, { foreignKey: 'equipment_id', as: 'passport' });
EquipmentPassport.belongsTo(Equipment, { foreignKey: 'equipment_id', as: 'equipment' });

Equipment.hasMany(MaintenanceRequest, { foreignKey: 'equipment_id', as: 'requests' });
MaintenanceRequest.belongsTo(Equipment, { foreignKey: 'equipment_id', as: 'equipment' });

MaintenanceRequest.hasMany(RequestStatusHistory, { foreignKey: 'request_id', as: 'history' });
RequestStatusHistory.belongsTo(MaintenanceRequest, { foreignKey: 'request_id', as: 'request' });

MaintenanceRequest.belongsToMany(Technician, {
  through: RequestAssignee,
  foreignKey: 'request_id',
  otherKey: 'technician_id',
  as: 'assignees'
});
Technician.belongsToMany(MaintenanceRequest, {
  through: RequestAssignee,
  foreignKey: 'technician_id',
  otherKey: 'request_id',
  as: 'requests'
});

export default sequelize;
EOF

cat << 'EOF' > src/server.js
import 'dotenv/config';
import app from './app.js';
import sequelize from './config/db.js';
import { logger } from './middlewares/logger.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Успешное подключение к PostgreSQL через Sequelize');

    const server = app.listen(PORT, () => {
      logger.info(`Сервер запущен на порту ${PORT}`);
    });

    const shutdown = async () => {
      logger.info('Завершение работы сервиса...');
      server.close(async () => {
        await sequelize.close();
        logger.info('Пул соединений с БД закрыт');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.fatal({ err: error }, 'Не удалось подключиться к базе данных');
    process.exit(1);
  }
}

start();
EOF

git add .
git commit -m "feat: инфраструктура PostgreSQL, Docker Compose, модели, миграции и сиды"

# ==============================================================================
# ВЕТКА 2: feat/sequelize-repositories (Репозитории Sequelize, изоляция доступа)
# ==============================================================================
echo "🌿 4. Создаем ветку feat/sequelize-repositories..."
git checkout -b feat/sequelize-repositories

cat << 'EOF' > src/repositories/equipment.repo.js
import { Equipment, EquipmentPassport } from '../models/index.js';

export const EquipmentRepo = {
  findAll: async ({ skip = 0, limit = 10, where = {}, order = [['created_at', 'DESC']] }) => {
    const { count, rows } = await Equipment.findAndCountAll({
      where,
      offset: skip,
      limit,
      order,
      include: [{ model: EquipmentPassport, as: 'passport', attributes: { exclude: ['createdAt', 'updatedAt'] } }]
    });
    return { total: count, data: rows };
  },

  findById: async (id) => {
    return await Equipment.findByPk(id, {
      include: [{ model: EquipmentPassport, as: 'passport', attributes: { exclude: ['createdAt', 'updatedAt'] } }]
    });
  },

  findBySerial: async (serialNumber) => {
    return await Equipment.findOne({ where: { serialNumber } });
  },

  create: async (data, options = {}) => {
    return await Equipment.create(data, options);
  },

  update: async (id, data, options = {}) => {
    const item = await Equipment.findByPk(id);
    if (!item) return null;
    return await item.update(data, options);
  },

  delete: async (id, options = {}) => {
    return await Equipment.destroy({ where: { id }, ...options });
  }
};
EOF

cat << 'EOF' > src/repositories/request.repo.js
import { MaintenanceRequest, Technician } from '../models/index.js';

export const RequestRepo = {
  findAll: async ({ skip = 0, limit = 10, where = {}, order = [['created_at', 'DESC']] }) => {
    const { count, rows } = await MaintenanceRequest.findAndCountAll({
      where,
      offset: skip,
      limit,
      order,
      include: [
        {
          model: Technician,
          as: 'assignees',
          through: { attributes: ['role', 'hours'] },
          attributes: ['id', 'fullName', 'specialization', 'employeeNumber']
        }
      ]
    });
    return { total: count, data: rows };
  },

  findById: async (id, options = {}) => {
    return await MaintenanceRequest.findByPk(id, {
      include: [
        {
          model: Technician,
          as: 'assignees',
          through: { attributes: ['role', 'hours'] },
          attributes: ['id', 'fullName', 'specialization', 'employeeNumber']
        }
      ],
      ...options
    });
  },

  findByEquipment: async (equipmentId) => {
    return await MaintenanceRequest.findAll({ where: { equipmentId } });
  },

  create: async (data, options = {}) => {
    return await MaintenanceRequest.create(data, options);
  },

  update: async (id, data, options = {}) => {
    const item = await MaintenanceRequest.findByPk(id, options);
    if (!item) return null;
    return await item.update(data, options);
  },

  delete: async (id, options = {}) => {
    return await MaintenanceRequest.destroy({ where: { id }, ...options });
  }
};
EOF

cat << 'EOF' > src/services/equipment.service.js
import { EquipmentRepo } from '../repositories/equipment.repo.js';
import { RequestRepo } from '../repositories/request.repo.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

export const EquipmentService = {
  getAll: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const { total, data } = await EquipmentRepo.findAll({ skip, limit });
    return { data, meta: { total, page, limit } };
  },

  getById: async (id) => {
    const item = await EquipmentRepo.findById(id);
    if (!item) throw new NotFoundError('Оборудование не найдено');
    return item;
  },

  create: async (data) => {
    const existing = await EquipmentRepo.findBySerial(data.serialNumber);
    if (existing) throw new ConflictError('Серийный номер уже используется');
    return await EquipmentRepo.create(data);
  },

  update: async (id, data) => {
    await EquipmentService.getById(id);
    if (data.serialNumber) {
      const existing = await EquipmentRepo.findBySerial(data.serialNumber);
      if (existing && existing.id !== id) throw new ConflictError('Серийный номер уже используется');
    }
    return await EquipmentRepo.update(id, data);
  },

  delete: async (id) => {
    await EquipmentService.getById(id);
    const reqs = await RequestRepo.findByEquipment(id);
    if (reqs.some(r => r.status === 'new' || r.status === 'in_progress')) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками');
    }
    await EquipmentRepo.delete(id);
  }
};
EOF

cat << 'EOF' > src/validators/equipment.validator.js
import { z } from 'zod';

export const createEquipmentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100),
    type: z.enum(['turbine', 'inverter', 'sensor', 'substation']),
    serialNumber: z.string().min(1),
    location: z.object({ lat: z.number(), lon: z.number() }).strict(),
    status: z.enum(['operational', 'maintenance', 'fault', 'decommissioned']),
    siteId: z.string().uuid().optional(),
    installedAt: z.string().datetime().optional()
  }).strict()
});

export const updateEquipmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createEquipmentSchema.shape.body.partial().strict()
});

export const getEquipmentSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  }).passthrough()
});
EOF

cat << 'EOF' > src/controllers/equipment.controller.js
import { EquipmentService } from '../services/equipment.service.js';
import { WeatherService } from '../services/weather.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getEquipments = catchAsync(async (req, res) => {
  res.json(await EquipmentService.getAll(req.query.page, req.query.limit));
});

export const getEquipment = catchAsync(async (req, res) => {
  res.json(await EquipmentService.getById(req.params.id));
});

export const createEquipment = catchAsync(async (req, res) => {
  const item = await EquipmentService.create(req.body);
  res.status(201).location(`/api/equipment/${item.id}`).json(item);
});

export const updateEquipment = catchAsync(async (req, res) => {
  res.json(await EquipmentService.update(req.params.id, req.body));
});

export const deleteEquipment = catchAsync(async (req, res) => {
  await EquipmentService.delete(req.params.id);
  res.status(204).send();
});

export const getWeather = catchAsync(async (req, res) => {
  const eq = await EquipmentService.getById(req.params.id);
  const weather = await WeatherService.getForecast(eq.location.lat, eq.location.lon);
  res.json(weather);
});
EOF

cat << 'EOF' > src/routes/equipment.routes.js
import { Router } from 'express';
import * as Ctrl from '../controllers/equipment.controller.js';
import { validate } from '../middlewares/validate.js';
import * as V from '../validators/equipment.validator.js';

const router = Router();
router.get('/', validate(V.listQuerySchema), Ctrl.getEquipments);
router.post('/', validate(V.createEquipmentSchema), Ctrl.createEquipment);
router.get('/:id', validate(V.getEquipmentSchema), Ctrl.getEquipment);
router.patch('/:id', validate(V.updateEquipmentSchema), Ctrl.updateEquipment);
router.delete('/:id', validate(V.getEquipmentSchema), Ctrl.deleteEquipment);
router.get('/:id/weather', validate(V.getEquipmentSchema), Ctrl.getWeather);

export default router;
EOF

cat << 'EOF' > src/middlewares/errorHandler.js
import { AppError } from '../errors/index.js';
import { UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    err = new AppError('Некорректный синтаксис JSON', 400, 'BAD_REQUEST');
  }

  if (err instanceof UniqueConstraintError) {
    const details = err.errors.map(e => ({ field: e.path, message: e.message }));
    err = new AppError('Конфликт уникальности данных', 409, 'CONFLICT', details);
  }

  if (err instanceof ForeignKeyConstraintError) {
    err = new AppError('Нарушение ссылочной целостности внешнего ключа', 409, 'FOREIGN_KEY_VIOLATION');
  }

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  const response = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 && isProd ? 'Внутренняя ошибка сервера' : err.message,
      details: err.details || undefined,
      requestId: req.id
    }
  };

  if (statusCode >= 500) {
    req.log.error({ err, requestId: req.id }, 'Внутренняя ошибка');
  } else {
    req.log.warn({ err: err.message, requestId: req.id }, 'Клиентская ошибка');
  }

  res.status(statusCode).json(response);
};
EOF

git add .
git commit -m "feat: перевод слоя репозиториев на Sequelize и обработка ошибок базы данных"

# ==============================================================================
# ВЕТКА 3: feat/transactions-assignees (Транзакции, история статусов и бригады)
# ==============================================================================
echo "🌿 5. Создаем ветку feat/transactions-assignees..."
git checkout -b feat/transactions-assignees

cat << 'EOF' > src/services/request.service.js
import sequelize, { MaintenanceRequest, RequestStatusHistory, RequestAssignee, Technician } from '../models/index.js';
import { EquipmentService } from './equipment.service.js';
import { RequestRepo } from '../repositories/request.repo.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/index.js';

const STATUS_FLOW = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: []
};

export const RequestService = {
  getAll: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const { total, data } = await RequestRepo.findAll({ skip, limit });
    return { data, meta: { total, page, limit } };
  },

  getById: async (id) => {
    const req = await RequestRepo.findById(id);
    if (!req) throw new NotFoundError('Заявка не найдена');
    return req;
  },

  getByEquipment: async (eqId) => await RequestRepo.findByEquipment(eqId),

  create: async (data) => {
    await EquipmentService.getById(data.equipmentId);
    return await sequelize.transaction(async (t) => {
      const created = await RequestRepo.create(data, { transaction: t });
      await RequestStatusHistory.create({
        requestId: created.id,
        fromStatus: null,
        toStatus: 'new',
        changedBy: data.author || 'system',
        comment: 'Создание заявки'
      }, { transaction: t });
      return created;
    });
  },

  update: async (id, data) => {
    await RequestService.getById(id);
    return await RequestRepo.update(id, data);
  },

  changeStatus: async (id, newStatus, user = 'operator', comment = '') => {
    return await sequelize.transaction(async (t) => {
      const req = await MaintenanceRequest.findByPk(id, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!req) throw new NotFoundError('Заявка не найдена');

      if (!STATUS_FLOW[req.status].includes(newStatus)) {
        throw new ConflictError(`Недопустимый переход статуса из ${req.status} в ${newStatus}`);
      }

      if (newStatus === 'in_progress') {
        const count = await RequestAssignee.count({ where: { requestId: id }, transaction: t });
        if (count === 0) {
          throw new ConflictError('Нельзя перевести заявку в статус in_progress без назначенной бригады');
        }
      }

      const prevStatus = req.status;
      await req.update({ status: newStatus }, { transaction: t });

      await RequestStatusHistory.create({
        requestId: id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        changedBy: user,
        comment
      }, { transaction: t });

      return req;
    });
  },

  setAssignees: async (requestId, assignees) => {
    return await sequelize.transaction(async (t) => {
      const req = await MaintenanceRequest.findByPk(requestId, { transaction: t });
      if (!req) throw new NotFoundError('Заявка не найдена');

      const leads = assignees.filter(a => a.role === 'lead');
      if (leads.length !== 1) {
        throw new ValidationError('Бригада должна содержать ровно одного ведущего специалиста (lead)', [
          { field: 'assignees', message: 'Требуется ровно 1 специалист с ролью lead' }
        ]);
      }

      const techIds = assignees.map(a => a.technicianId || a.userId);
      const existingTechs = await Technician.findAll({ where: { id: techIds }, transaction: t });
      if (existingTechs.length !== techIds.length) {
        throw new NotFoundError('Один или несколько указанных специалистов не найдены');
      }

      await RequestAssignee.destroy({ where: { requestId }, transaction: t });

      const records = assignees.map(a => ({
        requestId,
        technicianId: a.technicianId || a.userId,
        role: a.role,
        hours: a.hours || 0
      }));

      await RequestAssignee.bulkCreate(records, { transaction: t });
      return await RequestRepo.findById(requestId, { transaction: t });
    });
  },

  removeAssignee: async (requestId, technicianId) => {
    const deleted = await RequestAssignee.destroy({ where: { requestId, technicianId } });
    if (!deleted) throw new NotFoundError('Специалист не назначен на данную заявку');
    return { success: true };
  },

  getHistory: async (requestId) => {
    await RequestService.getById(requestId);
    return await RequestStatusHistory.findAll({
      where: { requestId },
      order: [['created_at', 'ASC']]
    });
  },

  delete: async (id) => {
    await RequestService.getById(id);
    await RequestRepo.delete(id);
  }
};
EOF

cat << 'EOF' > src/validators/request.validator.js
import { z } from 'zod';

export const createRequestSchema = z.object({
  body: z.object({
    equipmentId: z.string().uuid(),
    title: z.string().min(5).max(120),
    description: z.string().max(2000),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    plannedAt: z.string().datetime().optional()
  }).strict()
});

export const updateRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(5).max(120).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    plannedAt: z.string().datetime().optional()
  }).strict()
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.enum(['new', 'in_progress', 'done', 'rejected']) }).strict()
});

export const getRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const setAssigneesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    assignees: z.array(z.object({
      technicianId: z.string().uuid(),
      role: z.enum(['lead', 'member']),
      hours: z.number().min(0).max(1000).default(0)
    }).strict()).min(1)
  }).strict()
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  }).passthrough()
});
EOF

cat << 'EOF' > src/controllers/request.controller.js
import { RequestService } from '../services/request.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getReqs = catchAsync(async (req, res) => res.json(await RequestService.getAll(req.query.page, req.query.limit)));
export const getReq = catchAsync(async (req, res) => res.json(await RequestService.getById(req.params.id)));
export const createReq = catchAsync(async (req, res) => {
  const item = await RequestService.create(req.body);
  res.status(201).location(`/api/requests/${item.id}`).json(item);
});
export const updateReq = catchAsync(async (req, res) => res.json(await RequestService.update(req.params.id, req.body)));
export const changeStatus = catchAsync(async (req, res) => res.json(await RequestService.changeStatus(req.params.id, req.body.status)));
export const deleteReq = catchAsync(async (req, res) => {
  await RequestService.delete(req.params.id);
  res.status(204).send();
});
export const getByEquip = catchAsync(async (req, res) => res.json(await RequestService.getByEquipment(req.params.id)));
export const setAssignees = catchAsync(async (req, res) => res.json(await RequestService.setAssignees(req.params.id, req.body.assignees)));
export const removeAssignee = catchAsync(async (req, res) => res.json(await RequestService.removeAssignee(req.params.id, req.params.userId)));
export const getHistory = catchAsync(async (req, res) => res.json(await RequestService.getHistory(req.params.id)));
EOF

cat << 'EOF' > src/routes/request.routes.js
import { Router } from 'express';
import * as Ctrl from '../controllers/request.controller.js';
import { validate } from '../middlewares/validate.js';
import * as V from '../validators/request.validator.js';

const router = Router();
router.get('/', validate(V.listQuerySchema), Ctrl.getReqs);
router.post('/', validate(V.createRequestSchema), Ctrl.createReq);
router.get('/:id', validate(V.getRequestSchema), Ctrl.getReq);
router.patch('/:id', validate(V.updateRequestSchema), Ctrl.updateReq);
router.patch('/:id/status', validate(V.updateStatusSchema), Ctrl.changeStatus);
router.delete('/:id', validate(V.getRequestSchema), Ctrl.deleteReq);

router.post('/:id/assignees', validate(V.setAssigneesSchema), Ctrl.setAssignees);
router.delete('/:id/assignees/:userId', Ctrl.removeAssignee);
router.get('/:id/history', validate(V.getRequestSchema), Ctrl.getHistory);

export default router;
EOF

git add .
git commit -m "feat: транзакционная смена статуса с блокировкой строки и управление исполнителями"

# ==============================================================================
# ВЕТКА 4: feat/reports-analytics (Raw SQL аналитика, агрегаты, сводка площадок)
# ==============================================================================
echo "🌿 6. Создаем ветку feat/reports-analytics..."
git checkout -b feat/reports-analytics

cat << 'EOF' > src/services/report.service.js
import sequelize from '../config/db.js';
import { NotFoundError } from '../errors/index.js';

export const ReportService = {
  getSiteSummary: async (siteId) => {
    const [siteExists] = await sequelize.query(
      'SELECT id, name FROM sites WHERE id = :siteId',
      { replacements: { siteId } }
    );
    if (!siteExists || siteExists.length === 0) {
      throw new NotFoundError('Площадка не найдена');
    }

    const [statusStats] = await sequelize.query(`
      SELECT r.status, COUNT(r.id)::int AS count
      FROM maintenance_requests r
      JOIN equipment e ON e.id = r.equipment_id
      WHERE e.site_id = :siteId
      GROUP BY r.status
    `, { replacements: { siteId } });

    const [priorityStats] = await sequelize.query(`
      SELECT r.priority, COUNT(r.id)::int AS count
      FROM maintenance_requests r
      JOIN equipment e ON e.id = r.equipment_id
      WHERE e.site_id = :siteId
      GROUP BY r.priority
    `, { replacements: { siteId } });

    const [avgClose] = await sequelize.query(`
      SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (h.created_at - r.created_at)) / 3600)::numeric, 2), 0) AS avg_hours_to_close
      FROM maintenance_requests r
      JOIN equipment e ON e.id = r.equipment_id
      JOIN request_status_history h ON h.request_id = r.id AND h.to_status = 'done'
      WHERE e.site_id = :siteId
    `, { replacements: { siteId } });

    return {
      site: siteExists[0],
      byStatus: statusStats,
      byPriority: priorityStats,
      avgHoursToClose: parseFloat(avgClose[0]?.avg_hours_to_close || 0)
    };
  },

  getEquipmentLoadReport: async ({ from, to, minRequests = 0, sortBy = 'totalRequests', order = 'DESC' }) => {
    const allowedSortColumns = {
      totalRequests: 'total_requests',
      closedRequests: 'closed_requests',
      totalHours: 'total_planned_hours',
      lastMaintenanceDate: 'last_maintenance_date'
    };

    const sortColumn = allowedSortColumns[sortBy] || 'total_requests';
    const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let dateFilter = '';
    const replacements = { minRequests: parseInt(minRequests, 10) || 0 };

    if (from) {
      dateFilter += ' AND r.created_at >= :from';
      replacements.from = new Date(from);
    }
    if (to) {
      dateFilter += ' AND r.created_at <= :to';
      replacements.to = new Date(to);
    }

    const query = `
      SELECT
        e.id AS "equipmentId",
        e.name AS "equipmentName",
        e.serial_number AS "serialNumber",
        COUNT(r.id)::int AS "totalRequests",
        COUNT(CASE WHEN r.status = 'done' THEN 1 END)::int AS "closedRequests",
        COALESCE(SUM(ra.hours), 0)::float AS "totalPlannedHours",
        MAX(CASE WHEN r.status = 'done' THEN r.updated_at END) AS "lastMaintenanceDate"
      FROM equipment e
      LEFT JOIN maintenance_requests r ON r.equipment_id = e.id ${dateFilter}
      LEFT JOIN request_assignees ra ON ra.request_id = r.id
      GROUP BY e.id, e.name, e.serial_number
      HAVING COUNT(r.id) >= :minRequests
      ORDER BY "${sortColumn}" ${sortDirection}
    `;

    const [rows] = await sequelize.query(query, { replacements });
    return rows;
  }
};
EOF

cat << 'EOF' > src/validators/report.validator.js
import { z } from 'zod';

export const reportQuerySchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    minRequests: z.coerce.number().min(0).default(0),
    sortBy: z.enum(['totalRequests', 'closedRequests', 'totalHours', 'lastMaintenanceDate']).default('totalRequests'),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC')
  }).strict()
});
EOF

cat << 'EOF' > src/controllers/report.controller.js
import { ReportService } from '../services/report.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getSiteSummary = catchAsync(async (req, res) => {
  res.json(await ReportService.getSiteSummary(req.params.id));
});

export const getEquipmentLoad = catchAsync(async (req, res) => {
  res.json(await ReportService.getEquipmentLoadReport(req.query));
});
EOF

cat << 'EOF' > src/routes/report.routes.js
import { Router } from 'express';
import * as Ctrl from '../controllers/report.controller.js';
import { validate } from '../middlewares/validate.js';
import { reportQuerySchema } from '../validators/report.validator.js';

const router = Router();
router.get('/equipment-load', validate(reportQuerySchema), Ctrl.getEquipmentLoad);
export default router;
EOF

cat << 'EOF' > src/routes/site.routes.js
import { Router } from 'express';
import * as Ctrl from '../controllers/report.controller.js';

const router = Router();
router.get('/:id/summary', Ctrl.getSiteSummary);
export default router;
EOF

cat << 'EOF' > src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { httpLogger } from './middlewares/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './errors/index.js';

import equipmentRoutes from './routes/equipment.routes.js';
import requestRoutes from './routes/request.routes.js';
import siteRoutes from './routes/site.routes.js';
import reportRoutes from './routes/report.routes.js';

const app = express();

app.use(httpLogger);
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');
app.use(cors({ origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) cb(null, true);
  else cb(new Error('CORS Error'));
}}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Превышен лимит запросов' } }
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', db: 'connected' }));
app.use('/api/equipment', equipmentRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res, next) => next(new NotFoundError('Маршрут не найден')));
app.use(errorHandler);

export default app;
EOF

git add .
git commit -m "feat: аналитические SQL-отчеты по оборудованию и сводки по площадкам"

# ==============================================================================
# ВЕТКА 5: docs/case3-documentation (README, ER-диаграмма, тесты Postman)
# ==============================================================================
echo "🌿 7. Создаем ветку docs/case3-documentation..."
git checkout -b docs/case3-documentation

cat << 'EOF' > README.md
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
EOF

cat << 'EOF' > docs/postman/collection.json
{
"info": {
"name": "Maintenance API (Case 3: PostgreSQL & Transactions)",
"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
},
"item": [
{
"name": "Reports & Analytics",
"item": [
{
"name": "Отчет по нагрузке оборудования (Raw SQL)",
"event": [
{
"listen": "test",
"script": {
"exec": [
"pm.test("Status code is 200", function () { pm.response.to.have.status(200); });",
"pm.test("Body is array", function () { var d = pm.response.json(); pm.expect(Array.isArray(d)).to.be.true; });"
],
"type": "text/javascript"
}
}
],
"request": {
"method": "GET",
"url": "{{baseUrl}}/reports/equipment-load?minRequests=1&sortBy=totalHours&order=DESC"
},
"response": [
{
"name": "Пример успешного отчета 200",
"originalRequest": {
"method": "GET",
"url": "{{baseUrl}}/reports/equipment-load?minRequests=1&sortBy=totalHours&order=DESC"
},
"status": "OK",
"code": 200,
"_postman_previewlanguage": "json",
"body": "[\n  {\n    "equipmentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",\n    "equipmentName": "Турбина ВЭУ-1",\n    "serialNumber": "TRB-001",\n    "totalRequests": 4,\n    "closedRequests": 2,\n    "totalPlannedHours": 29,\n    "lastMaintenanceDate": "2026-09-20T10:00:00.000Z"\n  }\n]"
}
]
},
{
"name": "Сводка по площадке",
"request": {
"method": "GET",
"url": "{{baseUrl}}/sites/{{siteId}}/summary"
}
}
]
},
{
"name": "Assignees & Transactions",
"item": [
{
"name": "Назначение бригады (Успех 200)",
"request": {
"method": "POST",
"url": "{{baseUrl}}/requests/{{reqId}}/assignees",
"header": [{ "key": "Content-Type", "value": "application/json" }],
"body": {
"mode": "raw",
"raw": "{\n  "assignees": [\n    { "technicianId": "{{techId1}}", "role": "lead", "hours": 8 },\n    { "technicianId": "{{techId2}}", "role": "member", "hours": 4 }\n  ]\n}"
}
}
},
{
"name": "Ошибка назначения: нет lead (422)",
"request": {
"method": "POST",
"url": "{{baseUrl}}/requests/{{reqId}}/assignees",
"header": [{ "key": "Content-Type", "value": "application/json" }],
"body": {
"mode": "raw",
"raw": "{\n  "assignees": [\n    { "technicianId": "{{techId1}}", "role": "member", "hours": 8 }\n  ]\n}"
}
},
"response": [
{
"name": "Ошибка валидации 422: нет lead",
"status": "Unprocessable Entity",
"code": 422,
"_postman_previewlanguage": "json",
"body": "{\n  "error": {\n    "code": "VALIDATION_ERROR",\n    "message": "Бригада должна содержать ровно одного ведущего специалиста (lead)",\n    "details": [ { "field": "assignees", "message": "Требуется ровно 1 специалист с ролью lead" } ],\n    "requestId": "a1b2c3d4"\n  }\n}"
}
]
},
{
"name": "Смена статуса на in_progress без бригады (409)",
"request": {
"method": "PATCH",
"url": "{{baseUrl}}/requests/{{reqIdNew}}/status",
"header": [{ "key": "Content-Type", "value": "application/json" }],
"body": {
"mode": "raw",
"raw": "{\n  "status": "in_progress"\n}"
}
},
"response": [
{
"name": "Ошибка 409 Conflict: нет исполнителей",
"status": "Conflict",
"code": 409,
"_postman_previewlanguage": "json",
"body": "{\n  "error": {\n    "code": "CONFLICT",\n    "message": "Нельзя перевести заявку в статус in_progress без назначенной бригады",\n    "requestId": "a1b2c3d4"\n  }\n}"
}
]
}
]
}
],
"variable": [
{ "key": "baseUrl", "value": "http://localhost:3000/api" },
{ "key": "siteId", "value": "" },
{ "key": "reqId", "value": "" },
{ "key": "reqIdNew", "value": "" },
{ "key": "techId1", "value": "" },
{ "key": "techId2", "value": "" }
]
}
EOF

git add .
git commit -m "docs: документация Кейса 3, ER-диаграмма связей, порядок отката и Postman-тесты"

echo "🎉 Все файлы и ветки сгенерированы идеально!"
echo "📦 Устанавливаем зависимости..."
npm install

echo "👉 Следующие шаги:"
echo "1. Запустите БД: docker compose up -d db"
echo "2. Накатите миграции и сиды: npm run db:migrate && npm run db:seed"
echo "3. Отправьте все ветки на GitHub:"
echo "   git push --all -u origin --force"
