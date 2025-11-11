import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardData } from '../modules/useDashboardState';
import { useToast } from '@/hooks/use-toast';
import * as htmlToImage from 'html-to-image';
import PptxGenJS from 'pptxgenjs';
import { DashboardSection, DashboardTile } from '../types';
import { DashboardHeader } from './DashboardHeader';
import { DashboardFilters } from './DashboardFilters';
import { DashboardSectionNav } from './DashboardSectionNav';
import { DashboardTiles } from './DashboardTiles';
import { ActiveChartFilters, hasActiveFilters, summarizeChartFilters } from '@/lib/chartFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, FileText, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '../context/DashboardContext';

interface DashboardViewProps {
  dashboard: DashboardData;
  onBack: () => void;
  onDeleteChart: (chartIndex: number) => void;
  isRefreshing?: boolean;
  onRefresh?: () => Promise<any>;
}

const PPT_LAYOUT = 'LAYOUT_16x9';

export function DashboardView({ dashboard, onBack, onDeleteChart, isRefreshing = false, onRefresh }: DashboardViewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [isSheetSidebarOpen, setIsSheetSidebarOpen] = useState(true);
  const [tileFilters, setTileFilters] = useState<Record<string, ActiveChartFilters>>({});
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState('');
  const { toast } = useToast();
  const { renameDashboard, renameSheet, refetch: refetchDashboards } = useDashboardContext();

  // Get sheets or create default from charts (backward compatibility)
  const sheets = useMemo(() => {
    if (dashboard.sheets && dashboard.sheets.length > 0) {
      return dashboard.sheets.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    // Backward compatibility: create default sheet from charts
    return [{
      id: 'default',
      name: 'Overview',
      charts: dashboard.charts,
      order: 0,
    }];
  }, [dashboard.sheets, dashboard.charts]);

  // Set active sheet on mount
  useEffect(() => {
    if (!activeSheetId && sheets.length > 0) {
      setActiveSheetId(sheets[0].id);
    }
  }, [activeSheetId, sheets]);

  const activeSheet = sheets.find(s => s.id === activeSheetId) || sheets[0];
  
  // Ensure activeSheetId is always set when we have sheets
  const currentSheetId = activeSheetId || (sheets.length > 0 ? sheets[0].id : null);

  const sections = useMemo<DashboardSection[]>(() => {
    if (!activeSheet) return [];
    
    const baseTiles: DashboardTile[] = activeSheet.charts.flatMap((chart, index) => {
      const chartId = `chart-${index}`;
      const tiles: DashboardTile[] = [
        {
          kind: 'chart',
          id: chartId,
          title: chart.title || `Chart ${index + 1}`,
          chart,
          index,
          metadata: {
            lastUpdated: dashboard.updatedAt,
          },
        },
      ];

      if (chart.keyInsight) {
        tiles.push({
          kind: 'insight',
          id: `insight-${index}`,
          title: 'Key Insight',
          narrative: chart.keyInsight,
          relatedChartId: chartId,
        });
      }

      if (chart.recommendation) {
        tiles.push({
          kind: 'action',
          id: `action-${index}`,
          title: 'Recommended Action',
          recommendation: chart.recommendation,
          relatedChartId: chartId,
        });
      }

      return tiles;
    });

    // Always return a section, even if there are no tiles (empty sheet)
    return [
      {
        id: activeSheet.id,
        title: activeSheet.name,
        description: `Charts and insights for ${activeSheet.name}`,
        tiles: baseTiles,
      },
    ];
  }, [activeSheet, dashboard.updatedAt]);

  const chartTiles = useMemo(
    () => sections.flatMap((section) => section.tiles).filter((tile): tile is DashboardTile & { kind: 'chart' } => tile.kind === 'chart'),
    [sections]
  );

  const insightMap = useMemo(() => {
    const map = new Map<string, DashboardTile>();
    sections.forEach((section) => {
      section.tiles.forEach((tile) => {
        if ((tile.kind === 'insight' || tile.kind === 'action') && tile.relatedChartId) {
          map.set(`${tile.kind}-${tile.relatedChartId}`, tile);
        }
      });
    });
    return map;
  }, [sections]);

  const activeSection = sections.find((section) => section.id === activeSheetId) ?? sections[0];

  useEffect(() => {
    const validIds = new Set(
      sections.flatMap((section) => section.tiles.map((tile) => tile.id))
    );
    setTileFilters((prev) => {
      let changed = false;
      const next: Record<string, ActiveChartFilters> = {};
      Object.entries(prev).forEach(([tileId, filters]) => {
        if (validIds.has(tileId)) {
          next[tileId] = filters;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [sections]);

  useEffect(() => {
    setTileFilters({});
  }, [dashboard.id, activeSheetId]);

  const handleTileFiltersChange = useCallback((tileId: string, filters: ActiveChartFilters) => {
    setTileFilters((prev) => {
      const next = { ...prev };
      if (hasActiveFilters(filters)) {
        next[tileId] = filters;
      } else {
        delete next[tileId];
      }
      return next;
    });
  }, []);

  const dashboardFilterSummary = useMemo(() => {
    const summary: string[] = [];
    sections.forEach((section) => {
      section.tiles.forEach((tile) => {
        if (tile.kind !== 'chart') return;
        const filters = tileFilters[tile.id];
        if (!filters || !hasActiveFilters(filters)) return;
        const chipSummaries = summarizeChartFilters(filters);
        if (chipSummaries.length === 0) return;
        summary.push(`${tile.title}: ${chipSummaries.join(' • ')}`);
      });
    });
    return summary;
  }, [sections, tileFilters]);

  const handleResetAllFilters = useCallback(async () => {
    setTileFilters({});
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const handleExport = async () => {
    if (isExporting) return;
    if (chartTiles.length === 0) {
      toast({ title: 'Nothing to export', description: 'This dashboard has no content yet.' });
      return;
    }

    setIsExporting(true);

    try {
      const chartNodes = Array.from(document.querySelectorAll('[data-dashboard-chart-node]')) as HTMLElement[];
      if (chartNodes.length === 0) {
        toast({ title: 'No charts found', description: 'Try refreshing the page and exporting again.' });
        return;
      }

      const pptx = new PptxGenJS();
      pptx.layout = PPT_LAYOUT;

      const totalSlides = Math.min(chartTiles.length, chartNodes.length);

      for (let index = 0; index < totalSlides; index++) {
        const chartTile = chartTiles[index];
        const chartNode = chartNodes[index];
        const slide = pptx.addSlide();

        let imgData: string | undefined;
        if (chartNode) {
          imgData = await htmlToImage.toPng(chartNode, {
            cacheBust: true,
            backgroundColor: '#FFFFFF',
            style: { boxShadow: 'none' },
          });
        }

        const leftPad = 0.5;
        const topPad = 0.6;
        const imgW = 7.0;
        const imgH = 4.0;

        if (imgData) {
          slide.addImage({ data: imgData, x: leftPad, y: topPad, w: imgW, h: imgH });
        }

        const rightX = leftPad + imgW + 0.4;
        const colW = 3.2;

        slide.addText(chartTile.title, {
          x: rightX,
          y: topPad,
          w: colW,
          fontSize: 16,
          bold: true,
          color: '1F2937',
        });

        const insight = insightMap.get(`insight-${chartTile.id}`);
        if (insight && insight.kind === 'insight') {
          slide.addText('Key Insight', {
            x: rightX,
            y: topPad + 0.4,
            w: colW,
            fontSize: 12,
            bold: true,
            color: '0B63F6',
          });
          slide.addText(insight.narrative, {
            x: rightX,
            y: topPad + 0.7,
            w: colW,
            h: 2.0,
            fontSize: 11,
            color: '111827',
            wrap: true,
          });
        }

        const recommendation = insightMap.get(`action-${chartTile.id}`);
        if (recommendation && recommendation.kind === 'action') {
          const recY = topPad + 2.9;
          slide.addText('Recommendation', {
            x: rightX,
            y: recY,
            w: colW,
            fontSize: 12,
            bold: true,
            color: '059669',
          });
          slide.addText(recommendation.recommendation, {
            x: rightX,
            y: recY + 0.3,
            w: colW,
            h: 1.8,
            fontSize: 11,
            color: '111827',
            wrap: true,
          });
        }
      }

      await pptx.writeFile({ fileName: `${dashboard.name || 'dashboard'}.pptx` });
      toast({ title: 'Export complete', description: 'Your PowerPoint has been downloaded.' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Export failed',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-muted/30 h-[calc(100vh-72px)] flex flex-col overflow-y-auto">
      <div className="flex-shrink-0 px-4 pt-8 pb-4 lg:px-8">
        <DashboardHeader
          name={dashboard.name}
          createdAt={dashboard.createdAt}
          chartCount={dashboard.charts.length}
          isExporting={isExporting}
          onBack={onBack}
          onExport={handleExport}
          onRename={async (newName) => {
            try {
              await renameDashboard(dashboard.id, newName);
              await refetch?.();
              await refetchDashboards();
            } catch (error: any) {
              toast({
                title: 'Error',
                description: error?.message || 'Failed to rename dashboard',
                variant: 'destructive',
              });
              throw error;
            }
          }}
        />

        <div className="mt-6">
          <DashboardFilters
            isLoading={isExporting || isRefreshing}
            onReset={handleResetAllFilters}
            appliedFilters={dashboardFilterSummary}
            hasActiveFilters={dashboardFilterSummary.length > 0}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Collapsible Sheet Sidebar */}
        {sheets.length > 1 && (
          <>
            <div
              className={cn(
                "flex-shrink-0 bg-background border-r border-border transition-all duration-300 ease-in-out overflow-hidden",
                isSheetSidebarOpen ? "w-64" : "w-0"
              )}
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-sm text-foreground">Sheets</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsSheetSidebarOpen(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {sheets.map((sheet) => {
                      const isActive = activeSheetId === sheet.id;
                      const isEditing = editingSheetId === sheet.id;
                      
                      const handleStartEdit = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setEditingSheetId(sheet.id);
                        setEditSheetName(sheet.name);
                      };

                      const handleSaveSheet = async (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (!editSheetName.trim() || editSheetName.trim() === sheet.name) {
                          setEditingSheetId(null);
                          return;
                        }
                        try {
                          await renameSheet(dashboard.id, sheet.id, editSheetName.trim());
                          setEditingSheetId(null);
                          await refetch?.();
                          await refetchDashboards();
                        } catch (error: any) {
                          toast({
                            title: 'Error',
                            description: error?.message || 'Failed to rename sheet',
                            variant: 'destructive',
                          });
                        }
                      };

                      const handleCancelEdit = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setEditingSheetId(null);
                        setEditSheetName('');
                      };

                      const handleKeyDown = (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveSheet(e as any);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelEdit(e as any);
                        }
                      };

                      return (
                        <div
                          key={sheet.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 rounded-md transition-colors group",
                            isActive && !isEditing
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <FileText className={cn("h-4 w-4 flex-shrink-0", isActive && !isEditing ? "text-primary-foreground" : "text-muted-foreground")} />
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-1">
                              <Input
                                value={editSheetName}
                                onChange={(e) => setEditSheetName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-sm"
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSaveSheet}
                                className="h-6 w-6"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                                className="h-6 w-6"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setActiveSheetId(sheet.id)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className={cn("font-medium text-sm truncate", isActive && "text-primary-foreground")}>
                                  {sheet.name}
                                </div>
                                <div className={cn("text-xs truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                  {sheet.charts.length} chart{sheet.charts.length !== 1 ? 's' : ''}
                                </div>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleStartEdit}
                                className={cn("h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0", isActive && "text-primary-foreground")}
                                aria-label="Rename sheet"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Collapsed Sidebar Toggle Button */}
            {!isSheetSidebarOpen && (
              <div className="flex-shrink-0 border-r border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-full w-8 rounded-none"
                  onClick={() => setIsSheetSidebarOpen(true)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        <div className="flex-1 min-h-0 flex flex-col gap-8 px-4 pb-8 lg:px-8 overflow-hidden">
          <div className="flex-shrink-0">
            <DashboardSectionNav
              sections={sections.map((section) => ({
                id: section.id,
                title: section.title,
                count: section.tiles.length,
              }))}
              activeSectionId={activeSection?.id || sheets[0]?.id || 'overview'}
              onSelect={(sectionId) => setActiveSheetId(sectionId)}
            />
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
            {activeSection ? (
              <section
                key={activeSection.id}
                id={`section-${activeSection.id}`}
                className="space-y-4"
                data-dashboard-section={activeSection.id}
              >
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{activeSection.title}</h2>
                  {activeSection.description && (
                    <p className="text-sm text-muted-foreground">{activeSection.description}</p>
                  )}
                </div>

                <DashboardTiles
                  dashboardId={dashboard.id}
                  tiles={activeSection.tiles}
                  onDeleteChart={(chartIndex) => {
                    const sheetIdToUse = currentSheetId || (sheets.length > 0 ? sheets[0].id : undefined);
                    console.log('Deleting chart:', { chartIndex, sheetId: sheetIdToUse, activeSheetId, sheets });
                    onDeleteChart(chartIndex, sheetIdToUse || undefined);
                  }}
                  filtersByTile={tileFilters}
                  onTileFiltersChange={handleTileFiltersChange}
                />
              </section>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                Select a section to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
