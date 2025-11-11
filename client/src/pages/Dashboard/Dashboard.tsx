import React, { useState } from 'react';
import { useDashboardContext } from './context/DashboardContext';
import { DashboardData } from './modules/useDashboardState';
import { DashboardList } from './Components/DashboardList';
import { DashboardView } from './Components/DashboardView';

export default function Dashboard() {
  const { 
    dashboards, 
    currentDashboard, 
    setCurrentDashboard, 
    deleteDashboard,
    removeChartFromDashboard,
    status,
    refetch,
  } = useDashboardContext();

  const handleViewDashboard = (dashboard: DashboardData) => {
    setCurrentDashboard(dashboard);
  };

  const handleBackToList = () => {
    setCurrentDashboard(null);
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    if (confirm('Are you sure you want to delete this dashboard? This action cannot be undone.')) {
      await deleteDashboard(dashboardId);
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

  return (
    <DashboardList
      dashboards={dashboards}
      isLoading={status.isLoading}
      isRefreshing={status.refreshing}
      onViewDashboard={handleViewDashboard}
      onDeleteDashboard={handleDeleteDashboard}
    />
  );
}