'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { DateRange } from "react-day-picker";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReportSectionProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

type GroupingCriteria = 'advisor' | 'date';

export function ReportSection({ loggedEvents, advisors }: ReportSectionProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [grouping, setGrouping] = useState<GroupingCriteria>('advisor'); // Default grouping by advisor

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const filteredEvents = useMemo(() => {
    let filtered = loggedEvents;

    // Filter by date range
    if (dateRange?.from) {
      filtered = filtered.filter(event => {
        const eventDate = parseISO(event.date);
        // Adjust date range to include the entire end day
        const start = dateRange.from!;
        const end = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
        if (dateRange.to) end.setDate(end.getDate() + 1);

        return isWithinInterval(eventDate, { start, end });
      });
    }

    // Filter by advisor
    if (selectedAdvisorId !== 'all') {
      filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
    }

    return filtered;
  }, [loggedEvents, dateRange, selectedAdvisorId]);

  const groupedData = useMemo(() => {
    const groups: Record<string, LoggedEvent[]> = {};

    filteredEvents.forEach(event => {
      let key = '';
      if (grouping === 'advisor') {
        key = event.advisorId;
      } else if (grouping === 'date') {
        key = event.date; // Group by date string (YYYY-MM-DD)
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });

    // Calculate totals for each group and sort
    const summarizedGroups = Object.entries(groups).map(([key, events]) => {
        const totalTime = events.reduce((sum, event) => sum + event.loggedTime, 0);
        let groupLabel = '';
        if (grouping === 'advisor') {
            groupLabel = advisorMap[key] || 'Unknown Advisor';
        } else if (grouping === 'date') {
            groupLabel = format(parseISO(key), 'MMM dd, yyyy');
        }
        return { key, label: groupLabel, totalTime, events }; // Keep events array for potential future use
    });

     // Sort groups
     if (grouping === 'date') {
        // Sort dates chronologically
         return summarizedGroups.sort((a, b) => parseISO(a.key).getTime() - parseISO(b.key).getTime());
     } else {
        // Sort advisors alphabetically by name
        return summarizedGroups.sort((a, b) => a.label.localeCompare(b.label));
     }

  }, [filteredEvents, grouping, advisorMap]);

   const handleExportCsv = () => {
    const csvRows = [];
    // Add header row
    csvRows.push(['Date', 'Advisor Name', 'Event Title', 'Time Logged (minutes)', 'Advisor ID', 'Event ID'].join(','));

    // Add data rows (from filtered events, providing detailed raw data)
    filteredEvents.forEach(event => {
        const date = format(parseISO(event.date), 'yyyy-MM-dd');
        const advisorName = advisorMap[event.advisorId] || 'Unknown Advisor';
        // Basic CSV escaping for titles that might contain commas or quotes
        const eventTitle = `"${event.eventTitle.replace(/"/g, '""')}"`;
        const loggedTime = event.loggedTime;
        const advisorId = event.advisorId;
        const eventId = event.id;
        csvRows.push([date, advisorName, eventTitle, loggedTime, advisorId, eventId].join(','));
    });

    // Create a CSV string and trigger download
    const csvString = csvRows.join('\\n'); // Corrected newline escape sequence
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'time_log_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-primary">Reports</CardTitle>
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Date Range Picker */}
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />

          {/* Advisor Filter */}
           <Select onValueChange={setSelectedAdvisorId} defaultValue={selectedAdvisorId}>
              <SelectTrigger className="w-[180px]">
                 <SelectValue placeholder="Filter by Advisor" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all">All Advisors</SelectItem>
                 {advisors.map(advisor => (
                    <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>
                 ))}
              </SelectContent>
           </Select>

           {/* Grouping Select */}
            <Select onValueChange={(value: GroupingCriteria) => setGrouping(value)} defaultValue={grouping}>
              <SelectTrigger className="w-[150px]">
                 <SelectValue placeholder="Group by..." />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="advisor">Advisor</SelectItem>
                 <SelectItem value="date">Date</SelectItem>
              </SelectContent>
           </Select>

          {/* Export Button */}
          <Button onClick={handleExportCsv} disabled={filteredEvents.length === 0}>Export CSV</Button>

          {/* Clear Filters Button */}
          {(dateRange?.from || selectedAdvisorId !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => {setDateRange(undefined); setSelectedAdvisorId('all');}}>Clear Filters</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] border rounded-md">
           <Table>
              <TableHeader className="sticky top-0 bg-secondary z-10">
                 <TableRow>
                    <TableHead>{grouping === 'advisor' ? 'Advisor' : 'Date'}</TableHead>
                    <TableHead className="text-right">Total Time Logged (minutes)</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {groupedData.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                          No data found for the selected filters.
                       </TableCell>
                    </TableRow>
                 ) : (
                    groupedData.map(group => (
                       <TableRow key={group.key}>
                          <TableCell>{group.label}</TableCell>
                          <TableCell className="text-right">{group.totalTime} min</TableCell>
                       </TableRow>
                    ))
                 )}
              </TableBody>
           </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}