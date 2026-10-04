import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';
import User from './user.model.js';

export { User };

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

// Ассоциации
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

User.belongsTo(Technician, { foreignKey: 'technician_id', as: 'technician' });
Technician.hasOne(User, { foreignKey: 'technician_id', as: 'user' });

export default sequelize;
