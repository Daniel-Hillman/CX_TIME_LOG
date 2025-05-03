'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from "react-day-picker";
import Papa from 'papaparse'; // Import papaparse

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FilterX, Loader2 } from 'lucide-react'; // Added Download, FilterX, Loader2
import { cn } from "@/lib/utils";

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

    // --- CSV Export Function ---
    const handleExport = () => {
        if (isExporting || filteredAndSortedEvents.length === 0) return;
        setIsExporting(true);

        try {
            // 1. Prepare data for CSV
            const dataToExport = filteredAndSortedEvents.map(event => ({
                Date: format(parseISO(event.date), 'yyyy-MM-dd'), // Standard date format
                Advisor: advisorMap[event.advisorId] || 'Unknown',
                EventType: event.eventType || 'N/A',
                LoggedTimeMinutes: event.loggedTime,
                Notes: event.notes || ''
            }));

            // 2. Convert to CSV string using Papaparse
            const csv = Papa.unparse(dataToExport, {
                header: true, // Include headers from the object keys
            });

            // 3. Create Blob and Download Link
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);

            // Generate filename
            const advisorName = selectedAdvisorId === 'all' ? 'all_advisors' : (advisorMap[selectedAdvisorId] || 'unknown').replace(/\s+/g, '_').toLowerCase();
            const eventTypeFileName = selectedEventType === 'all' ? 'all_events' : (typeof selectedEventType === 'string' ? selectedEventType.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'unknown_event');
            const rangeLabel = (timeRange === 'custom' ? formatDateRange(customDateRange).replace(/\s*-\s*/g, '_') : getTimeRangeLabel(timeRange)).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
            const timestamp = format(new Date(), 'yyyyMMddHHmm');
            link.setAttribute('download', `report_${advisorName}_${eventTypeFileName}_${rangeLabel}_${timestamp}.csv`);

            link.style.visibility = 'hidden';
            document.body.appendChild(link);

            // 4. Trigger Download & Cleanup
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error generating CSV export:", error);
            // Optionally: show a user-facing error message here
        } finally {
            setIsExporting(false); // Reset loading state
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
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isExporting || filteredAndSortedEvents.length === 0}
                            aria-label="Export Report as CSV"
                        >
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export CSV
                        </Button>
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
                                            {event.notes}
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

