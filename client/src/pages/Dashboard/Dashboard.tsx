import React, { useState } from 'react';
import { useDashboardContext } from './context/DashboardContext';
import { DashboardData } from './modules/useDashboardState';
import { DashboardList } from './Components/DashboardList';
import { DashboardView } from './Components/DashboardView';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { 
    dashboards, 
    currentDashboard, 
    setCurrentDashboard, 
    deleteDashboard,
    removeChartFromDashboard,
    fetchDashboardById,
    status,
    refetch,
  } = useDashboardContext();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<string | null>(null);

  const handleViewDashboard = async (dashboard: DashboardData) => {
    // Fetch fresh dashboard data to get updated lastOpenedAt
    try {
      const freshDashboard = await fetchDashboardById(dashboard.id);
      setCurrentDashboard(freshDashboard);
    } catch (error) {
      // Fallback to cached dashboard if fetch fails
      console.error('Failed to fetch dashboard:', error);
    setCurrentDashboard(dashboard);
    }
  };

  const handleBackToList = () => {
    setCurrentDashboard(null);
  };

  const handleDeleteClick = (dashboardId: string) => {
    setDashboardToDelete(dashboardId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (dashboardToDelete) {
      await deleteDashboard(dashboardToDelete);
      setDeleteConfirmOpen(false);
      setDashboardToDelete(null);
    }
  };

  const handleDeleteChart = async (chartIndex: number, sheetId?: string) => {
    console.log('Delete chart clicked:', { chartIndex, sheetId, currentDashboard: currentDashboard?.id });
    if (currentDashboard) {
      console.log('Proceeding with chart deletion');
      const updatedDashboard = await removeChartFromDashboard(currentDashboard.id, chartIndex, sheetId);
      setCurrentDashboard(updatedDashboard);
      await refetch();
    }
  };

  if (currentDashboard) {
    return (
      <DashboardView
        dashboard={currentDashboard}
        onBack={handleBackToList}
        onDeleteChart={handleDeleteChart}
        isRefreshing={status.refreshing}
        onRefresh={refetch}
      />
    );
  }

  const dashboardToDeleteName = dashboardToDelete 
    ? dashboards.find(d => d.id === dashboardToDelete)?.name 
    : null;

  return (
    <>
      <DashboardList
        dashboards={dashboards}
        isLoading={status.isLoading}
        isRefreshing={status.refreshing}
        onViewDashboard={handleViewDashboard}
        onDeleteDashboard={handleDeleteClick}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dashboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{dashboardToDeleteName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDashboardToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}