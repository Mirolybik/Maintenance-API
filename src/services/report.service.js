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
