import { ReportService } from '../services/report.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getSiteSummary = catchAsync(async (req, res) => {
  res.json(await ReportService.getSiteSummary(req.params.id));
});

export const getEquipmentLoad = catchAsync(async (req, res) => {
  res.json(await ReportService.getEquipmentLoadReport(req.query));
});
