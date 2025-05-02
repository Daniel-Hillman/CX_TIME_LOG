'use client';

// Removed Task from import
import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from "react-day-picker";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

import { ExportVisualizationLayout } from './export-visualization-layout';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
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
  Filler
);

// --- Remove tasks prop ---
interface VisualizationsSectionProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
  // tasks: Task[]; // Removed
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


export function VisualizationsSection({ loggedEvents, advisors }: VisualizationsSectionProps) { // Removed tasks prop
  const exportLayoutRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('week');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  // --- State for Event Type Filter ---
  const [selectedEventType, setSelectedEventType] = useState<string | 'all'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [renderExportLayout, setRenderExportLayout] = useState(false);

  // --- Map for Advisors ---
  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  // --- Get Unique Event Types ---
  const uniqueEventTypes = useMemo(() => {
    const types = new Set<string>();
    loggedEvents.forEach(event => {
        if (event.eventType && event.eventType.trim() !== '') {
            types.add(event.eventType.trim());
        }
    });
    return Array.from(types).sort(); // Return sorted array
  }, [loggedEvents]);


  // --- Update Filtering Logic ---
  const filteredEvents = useMemo(() => {
     let filtered = loggedEvents;
     const now = new Date();
     let start: Date | undefined;
     let end: Date | undefined = endOfDay(now);

     // Filter by date
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

     // Filter by advisor
     if (selectedAdvisorId !== 'all') {
       filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
     }

     // *** Filter by Event Type ***
     if (selectedEventType !== 'all') {
         filtered = filtered.filter(event => event.eventType === selectedEventType);
     }

     return filtered;
  // Add selectedEventType dependency
  }, [loggedEvents, timeRange, customDateRange, selectedAdvisorId, selectedEventType]);


  // Chart data calculations
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
    return { labels, datasets: [{ label: 'Time Logged Daily (minutes)', data: times, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.1 }] };
  }, [filteredEvents]);

  // --- Update Clear Filters ---
  const clearFilters = () => {
      setTimeRange('week');
      setCustomDateRange(undefined);
      setSelectedAdvisorId('all');
      setSelectedEventType('all'); // Reset event type filter
  };

  // --- Update Filter Text ---
  const currentFiltersText = useMemo(() => {
    const timeLabel = getTimeRangeLabel(timeRange);
    const dateRangeText = timeRange === 'custom' ? formatDateRange(customDateRange) : timeLabel;
    const advisorName = selectedAdvisorId === 'all' ? 'All Advisors' : (advisorMap[selectedAdvisorId] || 'Unknown');
    const eventTypeLabel = selectedEventType === 'all' ? 'All Event Types' : selectedEventType; // Get event type label
    // Update text to include Event Type
    return `Filters: Date: ${dateRangeText} | Advisor: ${advisorName} | Event Type: ${eventTypeLabel}`;
  // Added selectedEventType dependency, removed taskMap
  }, [timeRange, customDateRange, selectedAdvisorId, selectedEventType, advisorMap]);

  // --- Update Export Function ---
  const handleExport = async () => {
      if (isExporting) return;
      setIsExporting(true);
      setRenderExportLayout(true);
      setTimeout(async () => {
        if (exportLayoutRef.current) {
            try {
                const canvas = await html2canvas(exportLayoutRef.current, { scale: 2, logging: false, useCORS: true, backgroundColor: '#ffffff' });
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                const advisorName = selectedAdvisorId === 'all' ? 'all_advisors' : (advisorMap[selectedAdvisorId] || 'unknown').replace(/\s+/g, '_').toLowerCase();
                // Include event type in filename
                const eventTypeFileName = selectedEventType === 'all' ? 'all_events' : selectedEventType.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const rangeLabel = (timeRange === 'custom' ? formatDateRange(customDateRange) : getTimeRangeLabel(timeRange)).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                // Updated filename format
                link.download = `time_viz_${advisorName}_${eventTypeFileName}_${rangeLabel}.png`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            } catch (error) { console.error("Error exporting visualization:", error); }
             finally { setRenderExportLayout(false); setIsExporting(false); }
        } else { console.error("Export layout ref not found."); setRenderExportLayout(false); setIsExporting(false); }
    }, 100);
  };

  return (
    <> 
        <Card className="w-full shadow-lg">
            <CardHeader className="flex flex-col space-y-4 pb-4">
                {/* Filter Row */} 
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <CardTitle className="text-xl font-semibold text-primary whitespace-nowrap">Visualizations</CardTitle>
                    {/* Filter Controls Group */} 
                    <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
                        {/* --- Event Type Filter UI --- */} 
                         <Select onValueChange={setSelectedEventType} value={selectedEventType}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by Event Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Event Types</SelectItem>
                                {uniqueEventTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Advisor Filter */} 
                        <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by Advisor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Advisors</SelectItem>
                                {advisors.map(advisor => ( <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem> ))}
                            </SelectContent>
                        </Select>
                        {/* Clear Button */} 
                        {/* Update clear condition */} 
                        {(timeRange !== 'week' || selectedAdvisorId !== 'all' || selectedEventType !== 'all') && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
                        )}
                        {/* Export Button */} 
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export PNG
                        </Button>
                    </div>
                </div>
                {/* Time Range Buttons */} 
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium mr-2 whitespace-nowrap">Date Range:</span>
                    {timeRangePresets.map((preset) => (<Button key={preset.value} variant={timeRange === preset.value ? 'secondary' : 'outline'} size="sm" onClick={() => setTimeRange(preset.value)} className={cn("h-8", timeRange === 'custom' && preset.value === 'custom' && 'ring-2 ring-primary')} > {preset.label} </Button>))}
                </div>
                {/* Custom Date Range Picker */} 
                {timeRange === 'custom' && (<div className="mt-2"> <DateRangePicker date={customDateRange} onDateChange={setCustomDateRange} /> </div>)}
                {/* Filter Text Display (Updated) */} 
                <div className="text-xs text-muted-foreground pt-3 mt-3 border-t border-dashed"> {currentFiltersText} </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-4">
                {/* Charts */} 
                 <div>
                    <h3 className="text-lg font-semibold text-center mb-4">Time Logged Per Advisor</h3>
                    {filteredEvents.length > 0 ? <Bar data={advisorTimeData} options={{ responsive: true, maintainAspectRatio: true, animation: { duration: 1000 } }} /> : <p className="text-center text-muted-foreground">No data for selected filters.</p>}
                </div>
                <Separator />
                <div>
                    <h3 className="text-lg font-semibold text-center mb-4">Time Breakdown by Advisor</h3>
                    {filteredEvents.length > 0 ? <div className="flex justify-center"><div className="relative h-64 w-64 md:h-80 md:w-80"><Doughnut data={advisorTimeBreakdownData} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 1000 } }}/></div></div> : <p className="text-center text-muted-foreground">No data for selected filters.</p>}
                </div>
                <Separator />
                <div>
                    <h3 className="text-lg font-semibold text-center mb-4">Daily Time Log Trend</h3>
                    {filteredEvents.length > 0 ? <Line data={timeTrendData} options={{ responsive: true, maintainAspectRatio: true, animation: { duration: 1000 } }} /> : <p className="text-center text-muted-foreground">No data for selected filters.</p>}
                </div>
            </CardContent>
        </Card>

        {/* Conditionally Rendered Hidden Layout for Export */} 
        {renderExportLayout && (
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -10 }}> 
                <ExportVisualizationLayout
                    ref={exportLayoutRef}
                    advisorTimeData={advisorTimeData}
                    advisorTimeBreakdownData={advisorTimeBreakdownData}
                    timeTrendData={timeTrendData}
                    currentFiltersText={currentFiltersText} // Pass updated text
                />
            </div>
        )}
    </> 
  );
}
