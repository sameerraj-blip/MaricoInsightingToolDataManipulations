import { Request, Response } from "express";
import {
  addChartToDashboardRequestSchema,
  createDashboardRequestSchema,
  removeChartFromDashboardRequestSchema,
} from "../../shared/schema.js";
import {
  addChartToDashboard,
  createDashboard,
  deleteDashboard,
  getDashboardById,
  getUserDashboards,
  removeChartFromDashboard,
} from "../lib/cosmosDB.js";

export const createDashboardController = async (req: Request, res: Response) => {
  try {
    const username = (req.body.username || req.headers['x-user-email'] || 'anonymous@example.com') as string;
    const parsed = createDashboardRequestSchema.parse(req.body);
    const dashboard = await createDashboard(username, parsed.name, parsed.charts || []);
    res.status(201).json(dashboard);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create dashboard' });
  }
};

export const listDashboardsController = async (req: Request, res: Response) => {
  try {
    const username = (req.query.username || req.headers['x-user-email'] || 'anonymous@example.com') as string;
    const dashboards = await getUserDashboards(username);
    res.json({ dashboards });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch dashboards' });
  }
};

export const deleteDashboardController = async (req: Request, res: Response) => {
  try {
    const username = (req.body.username || req.headers['x-user-email'] || 'anonymous@example.com') as string;
    const { dashboardId } = req.params as { dashboardId: string };
    const existing = await getDashboardById(dashboardId, username);
    if (!existing) return res.status(404).json({ error: 'Dashboard not found' });
    await deleteDashboard(dashboardId, username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete dashboard' });
  }
};

export const addChartToDashboardController = async (req: Request, res: Response) => {
  try {
    const username = (req.body.username || req.headers['x-user-email'] || 'anonymous@example.com') as string;
    const { dashboardId } = req.params as { dashboardId: string };
    const parsed = addChartToDashboardRequestSchema.parse(req.body);
    const updated = await addChartToDashboard(dashboardId, username, parsed.chart);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to add chart' });
  }
};

export const removeChartFromDashboardController = async (req: Request, res: Response) => {
  try {
    const username = (req.body.username || req.headers['x-user-email'] || 'anonymous@example.com') as string;
    const { dashboardId } = req.params as { dashboardId: string };
    const parsed = removeChartFromDashboardRequestSchema.parse(req.body);
    const updated = await removeChartFromDashboard(dashboardId, username, parsed);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to remove chart' });
  }
};



