import crypto from 'crypto';
const db = new Map();

export const RequestRepo = {
  findAll: async ({ skip, limit }) => {
    const all = Array.from(db.values());
    return { total: all.length, data: all.slice(skip, skip + limit) };
  },
  findById: async (id) => db.get(id) || null,
  findByEquipment: async (eqId) => Array.from(db.values()).filter(r => r.equipmentId === eqId),
  create: async (data) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newReq = { id, status: 'new', ...data, createdAt: now, updatedAt: now };
    db.set(id, newReq);
    return newReq;
  },
  update: async (id, data) => {
    const existing = db.get(id);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    db.set(id, updated);
    return updated;
  },
  delete: async (id) => db.delete(id)
};
