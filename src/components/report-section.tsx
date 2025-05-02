
'use client';

// Removed Task type import
import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfDay } from 'date-fns'; // Import startOfDay
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
  // Removed tasks prop
  // tasks: Task[];
}

type GroupingCriteria = 'advisor' | 'date';

// Removed tasks prop from function signature
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

  // Removed taskMap

  const filteredEvents = useMemo(() => {
    let filtered = loggedEvents;

    // Filter by date range
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from); // Ensure comparison starts from the beginning of the day
      // If 'to' date exists, use it, otherwise use the 'from' date.
      // Use startOfDay for 'to' date as well to ensure we capture the whole day when setting time later.
      const toDate = dateRange.to ? startOfDay(dateRange.to) : fromDate;
      toDate.setHours(23, 59, 59, 999); // Set time to end of the day

      filtered = filtered.filter(event => {
          try {
             const eventDate = parseISO(event.date);
             // Check if eventDate is valid
             if (isNaN(eventDate.getTime())) {
                 console.warn("Skipping event with invalid date:", event);
                 return false;
             }

             // Use the pre-calculated start and end dates
             return isWithinInterval(eventDate, { start: fromDate, end: toDate });
          } catch (error) {
              console.error("Error parsing or filtering date:", event.date, error);
              return false;
          }
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
        const totalTime = events.reduce((sum, event) => sum + (event.loggedTime || 0), 0);
        let groupLabel = '';
        if (grouping === 'advisor') {
            groupLabel = advisorMap[key] || 'Unknown Advisor';
        } else if (grouping === 'date') {
            try {
                // Ensure key is valid before parsing
                const parsedDate = parseISO(key);
                if (!isNaN(parsedDate.getTime())) {
                    groupLabel = format(parsedDate, 'MMM dd, yyyy');
                } else {
                    groupLabel = 'Invalid Date';
                }
            } catch (e) {
                console.error("Error parsing date key for grouping label:", key, e);
                groupLabel = 'Invalid Date';
            }
        }
        return { key, label: groupLabel, totalTime, events };
    });

     // Sort groups
     if (grouping === 'date') {
         return summarizedGroups.sort((a, b) => {
            try {
               const timeA = parseISO(a.key).getTime();
               const timeB = parseISO(b.key).getTime();
               return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
            } catch {
               return 0;
            }
         });
     } else {
        return summarizedGroups.sort((a, b) => a.label.localeCompare(b.label));
     }

  }, [filteredEvents, grouping, advisorMap]);


  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-primary">Reports</CardTitle>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
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
            <Select onValueChange={(value: GroupingCriteria) => setGrouping(value)} defaultValue={grouping}>
              <SelectTrigger className="w-[150px]">
                 <SelectValue placeholder="Group by..." />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="advisor">Advisor</SelectItem>
                 <SelectItem value="date">Date</SelectItem>
              </SelectContent>
           </Select>
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
