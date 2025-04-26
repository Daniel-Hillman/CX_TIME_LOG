'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, compareAsc, compareDesc } from 'date-fns'; // Import compareAsc, compareDesc
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Trash2, ArrowUpDown } from 'lucide-react'; // Import ArrowUpDown icon
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TimeLogSummary } from '@/components/time-log-summary';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface EventListProps {
  events: LoggedEvent[];
  advisors: Advisor[];
  onDeleteEvent: (eventId: string) => void;
}

type SortCriteria = 'date' | 'advisor' | 'loggedTime';
type SortDirection = 'asc' | 'desc';

export function EventList({ events, advisors, onDeleteEvent }: EventListProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('date'); // Default sort by date
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // Default sort descending

  const { toast } = useToast();

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by date range
    if (dateRange?.from) {
      filtered = filtered.filter(event => {
        const eventDate = parseISO(event.date);
        if (dateRange.to) {
          return isWithinInterval(eventDate, { start: dateRange.from!, end: dateRange.to! });
        } else {
          return isWithinInterval(eventDate, { start: dateRange.from!, end: dateRange.from! });
        }
      });
    }

    // Filter by advisor
    if (selectedAdvisorId !== 'all') {
      filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
    }

    return filtered;
  }, [events, dateRange, selectedAdvisorId]);

  const sortedEvents = useMemo(() => {
     const sorted = [...filteredEvents].sort((a, b) => {
        let comparison = 0;

        if (sortCriteria === 'date') {
            const dateA = parseISO(a.date).getTime();
            const dateB = parseISO(b.date).getTime();
            comparison = compareAsc(dateA, dateB); // compare dates ascending initially
        } else if (sortCriteria === 'advisor') {
            const nameA = advisorMap[a.advisorId] || '';
            const nameB = advisorMap[b.advisorId] || '';
            comparison = nameA.localeCompare(nameB); // compare advisor names
        } else if (sortCriteria === 'loggedTime') {
            comparison = a.loggedTime - b.loggedTime; // compare logged time numerically
        }

        // Apply sorting direction
        return sortDirection === 'asc' ? comparison : -comparison;
     });
     return sorted;
  }, [filteredEvents, sortCriteria, sortDirection, advisorMap]);

  const handleDelete = (eventId: string, eventTitle: string) => {
    onDeleteEvent(eventId);
    toast({
        title: "Success",
        description: `Event "${eventTitle}" deleted.`
    });
  }

  const toggleSortDirection = () => {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-primary">Logged Events</CardTitle>
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

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
                 <Select onValueChange={(value: SortCriteria) => setSortCriteria(value)} defaultValue={sortCriteria}>
                    <SelectTrigger className="w-[150px]">
                       <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="date">Date</SelectItem>
                       <SelectItem value="advisor">Advisor</SelectItem>
                       <SelectItem value="loggedTime">Time Logged</SelectItem>
                    </SelectContent>
                 </Select>
                <Button variant="outline" size="icon" onClick={toggleSortDirection} aria-label="Toggle sort direction">
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            </div>

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
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Event Title</TableHead>
                <TableHead className="w-[150px] text-right">Time Logged</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {dateRange?.from || selectedAdvisorId !== 'all' ? 'No events found for the selected filters.' : 'No events logged yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{format(parseISO(event.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{advisorMap[event.advisorId] || 'Unknown Advisor'}</TableCell>
                    <TableCell>{event.eventTitle}</TableCell>
                    <TableCell className="text-right">{event.loggedTime} min</TableCell>
                     <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the event
                                "<span className="font-semibold">{event.eventTitle}</span>".
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleDelete(event.id, event.eventTitle)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className='mt-8'>
          <TimeLogSummary loggedEvents={sortedEvents} advisors={advisors} />
        </div>
      </CardContent>
    </Card>
  );
}
