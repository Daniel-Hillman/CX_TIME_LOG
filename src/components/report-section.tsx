'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from "react-day-picker";
import Papa from 'papaparse'; // Import papaparse
import { formatMinutesToHours } from './visualizations-section';
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FilterX, Loader2 } from 'lucide-react'; // Added Download, FilterX, Loader2
import { ChartContainer } from './ui/chart';
import { eventTypeColorMap, getEventTypeColor } from './event-list';

interface ReportSectionProps {
    loggedEvents: LoggedEvent[];
    advisors: Advisor[];
}

type TimeRangePreset = 'day' | 'week' | 'last7' | 'last30' | 'month' | 'year' | 'all' | 'custom';

const timeRangePresets: { label: string; value: TimeRangePreset }[] = [
    { label: "Today", value: "day" },
    { label: "This Week", value: "week" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "month" },
    { label: "This Year", value: "year" },
    { label: "All Time", value: "all" },
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

// Add new interfaces for enhanced reporting
interface ReportSummary {
  totalTimeLogged: number;
  averageTimePerEvent: number;
  mostCommonEventType: string;
  totalEvents: number;
  timeByEventType: Record<string, number>;
  timeByAdvisor: Record<string, number>;
}

// Add new export format options
type ExportFormat = 'csv' | 'json';

// Theme-aware color palette for charts
const pastelPalette = [ '#a1c9f4', '#ffb482', '#8de5a1', '#ff9f9b', '#d0bbff', '#fcfcd4', '#c7ceff', '#f9c0c0', '#b5e8d8' ];
const getColor = (idx: number) => pastelPalette[idx % pastelPalette.length];

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

export function ReportSection({ loggedEvents, advisors }: ReportSectionProps) {
    const [timeRange, setTimeRange] = useState<TimeRangePreset>('week');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
    const [selectedEventType, setSelectedEventType] = useState<string | 'all'>('all');
    const [isExporting, setIsExporting] = useState(false); // State for export loading

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

    const filteredAndSortedEvents = useMemo(() => {
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
        else if (timeRange === 'all') { start = undefined; end = undefined; } // No date filter for 'all'

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

        // Filter by Event Type
        if (selectedEventType !== 'all') {
            filtered = filtered.filter(event => event.eventType === selectedEventType);
        }

        // Sort by date, newest first
        return filtered.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    }, [loggedEvents, timeRange, customDateRange, selectedAdvisorId, selectedEventType]);

    const clearFilters = () => {
        setTimeRange('week');
        setCustomDateRange(undefined);
        setSelectedAdvisorId('all');
        setSelectedEventType('all');
    };

    const isFiltered = timeRange !== 'week' || selectedAdvisorId !== 'all' || selectedEventType !== 'all';

    const currentFiltersText = useMemo(() => {
        const timeLabel = getTimeRangeLabel(timeRange);
        const dateRangeText = timeRange === 'custom' ? formatDateRange(customDateRange) : timeLabel;
        const advisorName = selectedAdvisorId === 'all' ? 'All Advisors' : (advisorMap[selectedAdvisorId] || 'Unknown');
        const eventTypeLabel = selectedEventType === 'all' ? 'All Event Types' : selectedEventType;
        return `Filters Active: Date: ${dateRangeText} | Advisor: ${advisorName} | Event Type: ${eventTypeLabel}`;
    }, [timeRange, customDateRange, selectedAdvisorId, selectedEventType, advisorMap]);

    // Enhanced export function
    const handleExport = async (format: ExportFormat) => {
        if (isExporting || filteredAndSortedEvents.length === 0) return;
        setIsExporting(true);

        try {
            // Generate summary statistics
            const summary: ReportSummary = {
                totalTimeLogged: filteredAndSortedEvents.reduce((sum, event) => sum + event.loggedTime, 0),
                averageTimePerEvent: 0,
                mostCommonEventType: '',
                totalEvents: filteredAndSortedEvents.length,
                timeByEventType: {},
                timeByAdvisor: {}
            };

            // Calculate additional metrics
            const eventTypeCounts: Record<string, number> = {};
            filteredAndSortedEvents.forEach(event => {
                // Time by event type
                if (!summary.timeByEventType[event.eventType]) {
                    summary.timeByEventType[event.eventType] = 0;
                }
                summary.timeByEventType[event.eventType] += event.loggedTime;

                // Time by advisor
                if (!summary.timeByAdvisor[event.advisorId]) {
                    summary.timeByAdvisor[event.advisorId] = 0;
                }
                summary.timeByAdvisor[event.advisorId] += event.loggedTime;

                // Event type counts
                eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
            });

            // Calculate averages and find most common
            summary.averageTimePerEvent = summary.totalTimeLogged / summary.totalEvents;
            summary.mostCommonEventType = Object.entries(eventTypeCounts)
                .sort(([,a], [,b]) => b - a)[0][0];

            // Export based on format
            switch (format) {
                case 'csv':
                    exportCSV(filteredAndSortedEvents, summary);
                    break;
                case 'json':
                    exportJSON(filteredAndSortedEvents, summary);
                    break;
            }
        } catch (error) {
            console.error("Error generating export:", error);
            toast({
                title: "Export Error",
                description: "Failed to generate export. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsExporting(false);
        }
    };

    // --- Export Helpers ---
    function exportCSV(events: LoggedEvent[], summary: ReportSummary) {
      const dataToExport = events.map(event => ({
        Date: format(parseISO(event.date), 'yyyy-MM-dd'),
        Advisor: advisorMap[event.advisorId] || 'Unknown',
        EventType: event.eventType || 'N/A',
        LoggedTimeMinutes: event.loggedTime,
        Notes: event.eventDetails || ''
      }));
      const csv = Papa.unparse(dataToExport, { header: true });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `report_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }

    function exportJSON(events: LoggedEvent[], summary: ReportSummary) {
      const blob = new Blob([
        JSON.stringify({ summary, events }, null, 2)
      ], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `report_export_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }

    // --- Summary Calculation ---
    const summary: ReportSummary = useMemo(() => {
      const totalTimeLogged = filteredAndSortedEvents.reduce((sum, event) => sum + event.loggedTime, 0);
      const totalEvents = filteredAndSortedEvents.length;
      const eventTypeCounts: Record<string, number> = {};
      const timeByEventType: Record<string, number> = {};
      const timeByAdvisor: Record<string, number> = {};
      filteredAndSortedEvents.forEach(event => {
        eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
        timeByEventType[event.eventType] = (timeByEventType[event.eventType] || 0) + event.loggedTime;
        timeByAdvisor[event.advisorId] = (timeByAdvisor[event.advisorId] || 0) + event.loggedTime;
      });
      const averageTimePerEvent = totalEvents > 0 ? totalTimeLogged / totalEvents : 0;
      const mostCommonEventType = Object.entries(eventTypeCounts).sort(([,a],[,b]) => b-a)[0]?.[0] || 'N/A';
      return {
        totalTimeLogged,
        averageTimePerEvent,
        mostCommonEventType,
        totalEvents,
        timeByEventType,
        timeByAdvisor
      };
    }, [filteredAndSortedEvents]);

    const { resolvedTheme } = useTheme();

    // Prepare chart data for event type bar/doughnut
    const eventTypeLabels = Object.keys(summary.timeByEventType);
    const eventTypeData = Object.values(summary.timeByEventType);
    const eventTypeColors = eventTypeLabels.map((_, idx) => getColor(idx));

    // Prepare chart data for advisor bar
    const advisorLabels = Object.keys(summary.timeByAdvisor).map(id => advisorMap[id] || id);
    const advisorData = Object.values(summary.timeByAdvisor);
    const advisorColors = advisorLabels.map((_, idx) => getColor(idx));

    // Prepare chart data for time trend line
    const timeTrend = (() => {
      const dayMap: Record<string, number> = {};
      filteredAndSortedEvents.forEach(event => {
        const day = format(parseISO(event.date), 'yyyy-MM-dd');
        dayMap[day] = (dayMap[day] || 0) + event.loggedTime;
      });
      const sorted = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
      return {
        labels: sorted.map(([date]) => date),
        data: sorted.map(([_, time]) => time)
      };
    })();

    // Chart options (theme-aware)
    const chartTextColor = resolvedTheme === 'dark' ? 'hsl(210 20% 95%)' : 'hsl(222.2 84% 4.9%)';
    const barChartOptions = {
      responsive: true,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: chartTextColor,
          anchor: 'end',
          align: 'top',
          font: { weight: 'bold', size: 12 },
          formatter: (value: number) => value > 0 ? formatMinutesToHours(value) : null,
          offset: 4,
          padding: 0
        }
      },
      scales: {
        x: { ticks: { color: chartTextColor }, grid: { color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
        y: { ticks: { color: chartTextColor }, grid: { color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
      }
    };
    const doughnutChartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { color: chartTextColor } },
        tooltip: { enabled: true }
      }
    };
    const lineChartOptions = {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { ticks: { color: chartTextColor }, grid: { color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
        y: { ticks: { color: chartTextColor }, grid: { color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
      }
    };

    return (
        <Card className="w-full shadow-lg">
            <CardHeader className="pb-4">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <CardTitle className="text-xl font-semibold text-primary mb-2 sm:mb-0">Report Data</CardTitle>
                     {/* Action Buttons: Clear, Export */}
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
                        <Select onValueChange={(value) => handleExport(value as ExportFormat)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Export Format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="csv">CSV</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="space-y-4">
                    {/* Row 1: Date Range Selection */}
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

                     {/* Row 2: Content Filters */}
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-grow flex flex-col sm:flex-row gap-3">
                             {/* Event Type Filter */}
                             <div className="flex-1 min-w-[160px]">
                                 <label htmlFor="report-event-type-filter" className="text-sm font-medium block mb-1.5">Event Type</label>
                                <Select onValueChange={setSelectedEventType} value={selectedEventType} >
                                    <SelectTrigger id="report-event-type-filter" className="w-full">
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
                            {/* Advisor Filter */}
                            <div className="flex-1 min-w-[160px]">
                                 <label htmlFor="report-advisor-filter" className="text-sm font-medium block mb-1.5">Advisor</label>
                                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId} >
                                    <SelectTrigger id="report-advisor-filter" className="w-full">
                                        <SelectValue placeholder="Filter by Advisor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Advisors</SelectItem>
                                        {advisors.map(advisor => ( <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem> ))}\
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                     </div>
                </div>

                {/* Filter Text Display */}
                <div className="text-xs text-muted-foreground pt-3 mt-4 border-t border-dashed">
                    {currentFiltersText} - {filteredAndSortedEvents.length} entries found.
                 </div>

            </CardHeader>
            <CardContent className="pt-4">
                {/* --- Visualization Panel --- */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Visualizations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Bar Chart: Time by Event Type */}
                        <div className="bg-card rounded-lg p-4 shadow-sm border">
                            <h3 className="font-medium mb-2">Time by Event Type (Bar)</h3>
                            <Bar
                                data={{
                                    labels: eventTypeLabels,
                                    datasets: [{ label: 'Minutes', data: eventTypeData, backgroundColor: eventTypeColors }]
                                }}
                                options={barChartOptions}
                                plugins={[ChartDataLabels]}
                            />
                        </div>
                        {/* Bar Chart: Time by Advisor */}
                        <div className="bg-card rounded-lg p-4 shadow-sm border">
                            <h3 className="font-medium mb-2">Time by Advisor (Bar)</h3>
                            <Bar
                                data={{
                                    labels: advisorLabels,
                                    datasets: [{ label: 'Minutes', data: advisorData, backgroundColor: advisorColors }]
                                }}
                                options={barChartOptions}
                                plugins={[ChartDataLabels]}
                            />
                        </div>
                        {/* Doughnut Chart: Event Type Share */}
                        <div className="bg-card rounded-lg p-4 shadow-sm border">
                            <h3 className="font-medium mb-2">Event Type Share (Pie)</h3>
                            <Doughnut
                                data={{
                                    labels: eventTypeLabels,
                                    datasets: [{ data: eventTypeData, backgroundColor: eventTypeColors }]
                                }}
                                options={doughnutChartOptions}
                            />
                        </div>
                        {/* Line Chart: Time Trend */}
                        <div className="bg-card rounded-lg p-4 shadow-sm border">
                            <h3 className="font-medium mb-2">Time Trend (Line)</h3>
                            <Line
                                data={{
                                    labels: timeTrend.labels,
                                    datasets: [{ label: 'Minutes', data: timeTrend.data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', fill: true }]
                                }}
                                options={lineChartOptions}
                            />
                        </div>
                    </div>
                </div>
                {/* --- Summary Cards --- */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {/* Total Time Logged */}
                    <Card className="bg-card border shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-2 pb-2">
                            <span className="text-primary"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <CardTitle className="text-sm font-medium">Total Time Logged</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatMinutesToHours(summary.totalTimeLogged)}</div>
                        </CardContent>
                    </Card>
                    {/* Average Time Per Event */}
                    <Card className="bg-card border shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-2 pb-2">
                            <span className="text-primary"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
                            <CardTitle className="text-sm font-medium">Average Time Per Event</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatMinutesToHours(summary.averageTimePerEvent)}</div>
                        </CardContent>
                    </Card>
                    {/* Most Common Event Type */}
                    <Card className="bg-card border shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-2 pb-2">
                            <span className="text-primary"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                            <CardTitle className="text-sm font-medium">Most Common Event Type</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.mostCommonEventType}</div>
                        </CardContent>
                    </Card>
                    {/* Total Events */}
                    <Card className="bg-card border shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-2 pb-2">
                            <span className="text-primary"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
                            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.totalEvents}</div>
                        </CardContent>
                    </Card>
                </div>
                {/* --- Event Type Breakdown --- */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold mb-2">Event Type Breakdown</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.timeByEventType).map(([type, time]) => (
                      <div key={type} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                        {type}: {formatMinutesToHours(time)}
                      </div>
                    ))}
                  </div>
                </div>
                <ScrollArea className="h-[400px] md:h-[500px] border rounded-md"> {/* Added fixed height and border */}
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10"> {/* Make header sticky */}
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Advisor</TableHead>
                                <TableHead>Event Type</TableHead>
                                <TableHead className="text-right w-[120px]">Time (mins)</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedEvents.length > 0 ? (
                                filteredAndSortedEvents.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{format(parseISO(event.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{advisorMap[event.advisorId] || 'Unknown Advisor'}</TableCell>
                                        <TableCell>{event.eventType || 'N/A'}</TableCell>
                                        <TableCell className="text-right">{event.loggedTime}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]"> {/* Limit note width */}
                                            {event.eventDetails}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No report data available for the selected filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                 <div className="text-xs text-muted-foreground pt-2 text-right">
                    Total Logged Time: {filteredAndSortedEvents.reduce((acc, event) => acc + event.loggedTime, 0)} minutes
                </div>
            </CardContent>
        </Card>
    );
}

