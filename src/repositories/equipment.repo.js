import crypto from 'crypto';
const db = new Map();

export const EquipmentRepo = {
  findAll: async ({ skip, limit }) => {
    const all = Array.from(db.values());
    return { total: all.length, data: all.slice(skip, skip + limit) };
  },
  findById: async (id) => db.get(id) || null,
  findBySerial: async (serialNumber) => Array.from(db.values()).find(e => e.serialNumber === serialNumber) || null,
  create: async (data) => {
    const id = crypto.randomUUID();
    const newEq = { id, ...data, installedAt: new Date().toISOString() };
    db.set(id, newEq);
    return newEq;
  },
  update: async (id, data) => {
    const existing = db.get(id);
    const updated = { ...existing, ...data };
    db.set(id, updated);
    return updated;
  },
  delete: async (id) => db.delete(id)
};
