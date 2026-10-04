import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

export const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
  role: { type: DataTypes.ENUM('viewer', 'technician', 'admin'), defaultValue: 'viewer' },
  technicianId: { type: DataTypes.UUID, field: 'technician_id' }
}, { tableName: 'users', underscored: true });

export default User;
