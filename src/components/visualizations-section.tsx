
'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from "react-day-picker";
import { useTheme } from "next-themes"; // Import useTheme

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FilterX } from 'lucide-react';
import { cn } from "@/lib/utils";

import { ExportVisualizationLayout } from './export-visualization-layout';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  ChartDataLabels
);

interface VisualizationsSectionProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

type TimeRangePreset = 'day' | 'week' | 'last7' | 'last30' | 'month' | 'year' | 'custom';

const timeRangePresets: { label: string; value: TimeRangePreset }[] = [
    { label: "Today", value: "day" },
    { label: "This Week", value: "week" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "month" },
    { label: "This Year", value: "year" },
    { label: "Custom", value: "custom" },
];

const getTimeRangeLabel = (value: TimeRangePreset): string => {
  const preset = timeRangePresets.find(p => p.value === value);
  return preset ? preset.label : 'Unknown';
};

const formatDateRange = (range: DateRange | undefined): string => {
  if (!range || !range.from) return 'Not Set';
  const fromStr = format(range.from, 'dd/MM/yyyy');
  const toStr = range.to ? format(range.to, 'dd/MM/yyyy') : fromStr;
  if (fromStr === toStr) return fromStr;
  return `${fromStr} - ${toStr}`;
};

const formatMinutesToHours = (totalMinutes: number): string => {
    if (totalMinutes < 0) return "0 min";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = "";
    if (hours > 0) {
        result += `${hours}h`;
        if (minutes > 0) result += ` ${minutes}m`;
    } else {
        result += `${minutes}m`;
    }
    return `${totalMinutes} min${hours > 0 ? ` (${result})` : ''}`;
};

export function VisualizationsSection({ loggedEvents, advisors }: VisualizationsSectionProps) {
  const exportLayoutRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('week');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [selectedEventType, setSelectedEventType] = useState<string | 'all'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [renderExportLayout, setRenderExportLayout] = useState(false);
  const { resolvedTheme } = useTheme(); // Get the resolved theme

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const uniqueEventTypes = useMemo(() => {
    const types = new Set<string>();
    loggedEvents.forEach(event => {
        if (event.eventType && typeof event.eventType === 'string' && event.eventType.trim() !== '') {
            types.add(event.eventType.trim());
        }
    });
    return Array.from(types).sort();
  }, [loggedEvents]);

  const filteredEvents = useMemo(() => {
     let filtered = loggedEvents;
     const now = new Date();
     let start: Date | undefined;
     let end: Date | undefined = endOfDay(now);

     if (timeRange === 'day') { start = startOfDay(now); }
     else if (timeRange === 'week') { start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); }
     else if (timeRange === 'last7') { start = startOfDay(subDays(now, 6)); }
     else if (timeRange === 'last30') { start = startOfDay(subDays(now, 29)); }
     else if (timeRange === 'month') { start = startOfMonth(now); end = endOfMonth(now); }
     else if (timeRange === 'year') { start = startOfYear(now); end = endOfYear(now); }
     else if (timeRange === 'custom' && customDateRange?.from) { start = startOfDay(customDateRange.from); end = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from); }

     if (start && end) {
         filtered = filtered.filter(event => {
             try {
                 const eventDate = parseISO(event.date);
                 if (isNaN(eventDate.getTime())) return false;
                 return isWithinInterval(eventDate, { start: start!, end: end! });
             } catch (e) { console.error("Error parsing event date or checking interval:", event.date, e); return false; }
         });
     }

     if (selectedAdvisorId !== 'all') {
       filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
     }

     if (selectedEventType !== 'all') {
         filtered = filtered.filter(event => event.eventType === selectedEventType);
     }

     return filtered;
  }, [loggedEvents, timeRange, customDateRange, selectedAdvisorId, selectedEventType]);

  const advisorTimeData = useMemo(() => {
    if (filteredEvents.length === 0) return { labels: [], datasets: [] };
    const data: Record<string, number> = {};
    filteredEvents.forEach(event => { if (!data[event.advisorId]) data[event.advisorId] = 0; data[event.advisorId] += event.loggedTime; });
    const labels = Object.keys(data).map(advisorId => advisorMap[advisorId] || 'Unknown Advisor');
    const times = Object.values(data);
    return { labels, datasets: [{ label: 'Time Logged (minutes)', data: times, backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }] };
  }, [filteredEvents, advisorMap]);

  const advisorTimeBreakdownData = useMemo(() => {
    if (filteredEvents.length === 0) return { labels: [], datasets: [] };
    const data: Record<string, number> = {};
    filteredEvents.forEach(event => { if (!data[event.advisorId]) data[event.advisorId] = 0; data[event.advisorId] += event.loggedTime; });
    const labels = Object.keys(data).map(advisorId => advisorMap[advisorId] || 'Unknown Advisor');
    const times = Object.values(data);
    const pastelPalette = [ '#a1c9f4', '#ffb482', '#8de5a1', '#ff9f9b', '#d0bbff', '#fcfcd4', '#c7ceff', '#f9c0c0', '#b5e8d8' ];
    const backgroundColors = labels.map((_, index) => pastelPalette[index % pastelPalette.length]);
    return { labels, datasets: [{ label: 'Time Logged (minutes)', data: times, backgroundColor: backgroundColors, borderColor: 'transparent', borderWidth: 2 }] };
  }, [filteredEvents, advisorMap]);

  const timeTrendData = useMemo(() => {
    if (filteredEvents.length === 0) return { labels: [], datasets: [] };
    const dailyData: Record<string, number> = {};
    const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedEvents.forEach(event => { const dateKey = event.date; if (!dailyData[dateKey]) dailyData[dateKey] = 0; dailyData[dateKey] += event.loggedTime; });
    const sortedDates = Object.keys(dailyData).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    const labels = sortedDates.map(dateKey => format(parseISO(dateKey), 'dd MMM'));
    const times = sortedDates.map(dateKey => dailyData[dateKey]);
    // Adjust line/fill color based on theme
    const lineColor = resolvedTheme === 'dark' ? 'rgba(54, 162, 235, 0.8)' : 'rgba(54, 162, 235, 1)';
    const fillColor = resolvedTheme === 'dark' ? 'rgba(54, 162, 235, 0.3)' : 'rgba(54, 162, 235, 0.2)';
    return { labels, datasets: [{ label: 'Time Logged Daily (minutes)', data: times, borderColor: lineColor, backgroundColor: fillColor, fill: true, tension: 0.1 }] };
  }, [filteredEvents, resolvedTheme]); // Add resolvedTheme dependency

  const clearFilters = () => {
      setTimeRange('week');
      setCustomDateRange(undefined);
      setSelectedAdvisorId('all');
      setSelectedEventType('all');
  };

  const currentFiltersText = useMemo(() => {
    const timeLabel = getTimeRangeLabel(timeRange);
    const dateRangeText = timeRange === 'custom' ? formatDateRange(customDateRange) : timeLabel;
    const advisorName = selectedAdvisorId === 'all' ? 'All Advisors' : (advisorMap[selectedAdvisorId] || 'Unknown');
    const eventTypeLabel = selectedEventType === 'all' ? 'All Event Types' : selectedEventType;
    return `Filters Active: Date Range: ${dateRangeText} | Advisor: ${advisorName} | Event Type: ${eventTypeLabel}`;
  }, [timeRange, customDateRange, selectedAdvisorId, selectedEventType, advisorMap]);

  const isFiltered = timeRange !== 'week' || selectedAdvisorId !== 'all' || selectedEventType !== 'all';

  const handleExport = async () => {
      if (isExporting) return;
      setIsExporting(true);
      setRenderExportLayout(true);
      setTimeout(async () => {
        if (exportLayoutRef.current) {
            try {
                const exportOptions = {
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    backgroundColor: resolvedTheme === 'dark' ? '#1a1a1a' : '#ffffff', // Use theme-appropriate background
                     onclone: (doc: Document) => {
                        const charts = doc.querySelectorAll('canvas');
                        charts.forEach(canvas => {
                            const chartInstance = ChartJS.getChart(canvas);
                            if (chartInstance) {
                                if(chartInstance.config.type === 'bar' && chartInstance.options.plugins?.datalabels) {
                                     chartInstance.options.plugins.datalabels.display = false;
                                     chartInstance.update('none');
                                }
                                // Optionally adjust other chart colors for export background if needed
                            }
                        });
                    }
                };
                const canvas = await html2canvas(exportLayoutRef.current, exportOptions);

                // No need to re-enable labels on original chart if only the clone was modified

                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                const advisorName = selectedAdvisorId === 'all' ? 'all_advisors' : (advisorMap[selectedAdvisorId] || 'unknown').replace(/\s+/g, '_').toLowerCase();
                const eventTypeFileName = selectedEventType === 'all' ? 'all_events' : (typeof selectedEventType === 'string' ? selectedEventType.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'unknown_event');
                const rangeLabel = (timeRange === 'custom' ? formatDateRange(customDateRange).replace(/\s*-\s*/g, '_') : getTimeRangeLabel(timeRange)).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                link.download = `viz_${advisorName}_${eventTypeFileName}_${rangeLabel}_${format(new Date(), 'yyyyMMddHHmm')}.png`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            } catch (error) { console.error("Error exporting visualization:", error); }
             finally { setRenderExportLayout(false); setIsExporting(false); }
        } else { console.error("Export layout ref not found."); setRenderExportLayout(false); setIsExporting(false); }
    }, 200);
  };

  // Define chart options within the component to access resolvedTheme
  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 300 },
    scales: {
        x: {
            ticks: {
                color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)' // Adjust x-axis tick color
            },
            grid: {
                color: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' // Adjust grid line color
            }
        },
        y: {
            beginAtZero: true,
            suggestedMax: Math.max(...(advisorTimeData.datasets[0]?.data || [0])) * 1.25, // Increase padding slightly
             ticks: {
                color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)' // Adjust y-axis tick color
            },
             grid: {
                color: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' // Adjust grid line color
            }
        }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
             color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)' // Adjust legend text color
        }
      },
      tooltip: {
        enabled: true
      },
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'top' as const,
        // Use theme-appropriate color
        color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)',
        font: {
          weight: 'bold' as const,
          size: 12, // Increased font size
        },
        formatter: (value: number) => {
           if (value <= 0) {
               return null;
           }
           return formatMinutesToHours(value);
        },
        offset: 4, // Adjusted offset slightly for larger font
        padding: 0
      }
    }
  }), [resolvedTheme, advisorTimeData]); // Recompute options if theme or data changes

   // Define Doughnut options separately for clarity
   const doughnutChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)'
                }
            },
            tooltip: {
                enabled: true
            },
             // Optional: Add datalabels to Doughnut chart too
            /*
            datalabels: {
                display: true,
                color: resolvedTheme === 'dark' ? 'hsl(210 10% 15%)' : '#fff', // Contrasting color on slices
                formatter: (value: number, ctx: any) => {
                    const percentage = ((value / ctx.chart.getDatasetMeta(0).total) * 100).toFixed(1);
                    return `${percentage}%`;
                },
                 font: {
                    weight: 'bold' as const,
                    size: 11
                },
            }
            */
        }
   }), [resolvedTheme]);

    // Define Line chart options
    const lineChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 300 },
         scales: {
            x: {
                ticks: {
                    color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)'
                },
                grid: {
                    color: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
            },
            y: {
                 ticks: {
                    color: resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)'
                },
                 grid: {
                    color: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            }
        }
    }), [resolvedTheme]);


  return (
    <>
        <Card className="w-full shadow-lg">
            <CardHeader className="pb-4">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <CardTitle className="text-xl font-semibold text-primary mb-2 sm:mb-0">Visualizations</CardTitle>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            disabled={!isFiltered || isExporting}
                            aria-label="Clear Filters"
                            className={cn(!isFiltered && "text-muted-foreground")}
                        >
                           <FilterX className="mr-2 h-4 w-4" /> Clear
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting || filteredEvents.length === 0}
                            aria-label="Export Visualizations as PNG"
                        >
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export PNG
                        </Button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                         <label className="text-sm font-medium">Date Range</label>
                        <div className="flex flex-wrap items-center gap-2">
                            {timeRangePresets.map((preset) => (
                                <Button
                                    key={preset.value}
                                    variant={timeRange === preset.value ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setTimeRange(preset.value)}
                                    className={cn("h-8", timeRange === 'custom' && preset.value === 'custom' && 'ring-2 ring-primary')}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                         {timeRange === 'custom' && (
                            <div className="mt-1">
                                <DateRangePicker date={customDateRange} onDateChange={setCustomDateRange} />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-grow flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 min-w-[160px]">
                                 <label htmlFor="event-type-filter" className="text-sm font-medium block mb-1.5">Event Type</label>
                                <Select onValueChange={setSelectedEventType} value={selectedEventType} >
                                    <SelectTrigger id="event-type-filter" className="w-full">
                                        <SelectValue placeholder="Filter by Event Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Event Types</SelectItem>
                                        {uniqueEventTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="flex-1 min-w-[160px]">
                                 <label htmlFor="advisor-filter" className="text-sm font-medium block mb-1.5">Advisor</label>
                                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId} >
                                    <SelectTrigger id="advisor-filter" className="w-full">
                                        <SelectValue placeholder="Filter by Advisor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Advisors</SelectItem>
                                        {advisors.map(advisor => ( <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem> ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground pt-3 mt-4 border-t border-dashed">
                    {currentFiltersText}
                 </div>

            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                {filteredEvents.length === 0 ? (
                     <p className="text-center text-muted-foreground py-8">No data available for the selected filters.</p>
                ) : (
                    <>
                        <div id="advisor-time-bar-chart">
                            <h3 className="text-lg font-semibold text-center mb-4">Time Logged Per Advisor</h3>
                            <Bar id="advisor-time-bar-chart-canvas" data={advisorTimeData} options={barChartOptions} />
                        </div>
                        <Separator />
                        <div id="advisor-time-doughnut-chart">
                            <h3 className="text-lg font-semibold text-center mb-4">Advisor Time Distribution</h3>
                            <div className="flex justify-center">
                                <div className="relative h-64 w-64 md:h-80 md:w-80">
                                     <Doughnut data={advisorTimeBreakdownData} options={doughnutChartOptions}/>
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div id="daily-time-trend-line-chart">
                            <h3 className="text-lg font-semibold text-center mb-4">Daily Time Log Trend</h3>
                             <Line data={timeTrendData} options={lineChartOptions} />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>

        {renderExportLayout && (
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -10 }}>
                <ExportVisualizationLayout
                    ref={exportLayoutRef}
                    advisorTimeData={advisorTimeData}
                    advisorTimeBreakdownData={advisorTimeBreakdownData}
                    timeTrendData={timeTrendData}
                    currentFiltersText={currentFiltersText}
                />
            </div>
        )}
    </>
  );
}
