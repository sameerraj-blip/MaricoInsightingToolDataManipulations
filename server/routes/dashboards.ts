import { Router } from "express";
import {
  addChartToDashboardController,
  addSheetToDashboardController,
  createDashboardController,
  deleteDashboardController,
  listDashboardsController,
  removeChartFromDashboardController,
  removeSheetFromDashboardController,
  renameSheetController,
  renameDashboardController,
} from "../controllers/index.js";

const router = Router();

// Dashboards
router.post('/dashboards', createDashboardController);
router.get('/dashboards', listDashboardsController);
router.patch('/dashboards/:dashboardId', renameDashboardController);
router.delete('/dashboards/:dashboardId', deleteDashboardController);

// Charts in a dashboard
router.post('/dashboards/:dashboardId/charts', addChartToDashboardController);
router.delete('/dashboards/:dashboardId/charts', removeChartFromDashboardController);

// Sheets in a dashboard
router.post('/dashboards/:dashboardId/sheets', addSheetToDashboardController);
router.delete('/dashboards/:dashboardId/sheets/:sheetId', removeSheetFromDashboardController);
router.patch('/dashboards/:dashboardId/sheets/:sheetId', renameSheetController);

export default router;



