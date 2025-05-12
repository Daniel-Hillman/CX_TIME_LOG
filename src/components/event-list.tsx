
'use client';

// Removed Task from import
import type { LoggedEvent, Advisor, StandardEventType } from '@/types'; // Import StandardEventType
import * as React from 'react';
import { useState, useMemo } from 'react';
// Add getTodayDate function
import { format, parseISO, isWithinInterval, compareAsc, startOfDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
// Add icons for new buttons if desired (e.g., CalendarCheck, List)
import { Trash2, ArrowUpDown, Loader2, Pencil, Search, CalendarCheck, List } from 'lucide-react';
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
  AlertDialogTrigger, // Keep AlertDialogTrigger import
} from "@/components/ui/alert-dialog";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

// Get today's date in YYYY-MM-DD format
const getTodayDateString = (): string => {
    return format(new Date(), 'yyyy-MM-dd');
};

interface EventListProps {
  events: LoggedEvent[];
  advisors: Advisor[];
  // Removed tasks prop
  // tasks: Task[];
  onDeleteEvent: (eventId: string) => Promise<void>;
  // Ensure onEditEvent expects a LoggedEvent
  onEditEvent: (event: LoggedEvent) => void;
  deletingId: string | null;
}

// Remove 'task' sort criteria
type SortCriteria = 'date' | 'advisor' | 'eventType' | 'loggedTime';
type SortDirection = 'asc' | 'desc';

export function EventList({
    events,
    advisors,
    // tasks, // Removed
    onDeleteEvent,
    onEditEvent,
    deletingId
}: EventListProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  // Removed Task Filter State
  // const [selectedTaskId, setSelectedTaskId] = useState<string | 'all'>('all');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlyToday, setShowOnlyToday] = useState<boolean>(false); // State for Today's view
  const { toast } = useToast();

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  // Removed taskMap

  const filteredEvents = useMemo(() => {
    let filtered = events;
    const todayDateStr = getTodayDateString();

    if (showOnlyToday) {
        // --- Today's Logs View ---
        filtered = events.filter(event => event.date === todayDateStr);
    } else {
        // --- Regular Filtering ---
        // Filter by Date Range
        if (dateRange?.from) {
            filtered = filtered.filter(event => {
                try {
                    // Ensure event.date is treated as a string before parsing
                    const eventDate = parseISO(String(event.date));
                    // Use startOfDay for accurate comparison with date picker
                    const start = startOfDay(dateRange.from!);
                    const end = dateRange.to ? startOfDay(dateRange.to) : startOfDay(dateRange.from!);
                    end.setHours(23, 59, 59, 999); // Ensure end of day is included
                    return isWithinInterval(eventDate, { start, end });
                } catch (e) {
                    console.error("Error parsing date or filtering:", event.date, e);
                    return false;
                }
            });
        }

        // Filter by Advisor
        if (selectedAdvisorId !== 'all') {
            filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
        }

        // Filter by Search Term
        if (searchTerm.trim() !== '') {
          const lowerCaseSearchTerm = searchTerm.toLowerCase();
          filtered = filtered.filter(event => {
            const advisorName = advisorMap[event.advisorId]?.toLowerCase() || '';
            // Removed task name search
            const eventType = event.eventType?.toLowerCase() || '';
            const eventDetails = event.eventDetails?.toLowerCase() || '';
            return (
              advisorName.includes(lowerCaseSearchTerm) ||
              // Removed taskName search
              eventType.includes(lowerCaseSearchTerm) ||
              eventDetails.includes(lowerCaseSearchTerm)
            );
          });
        }
    } // End of regular filtering block

    return filtered;
    // Update dependencies: Add showOnlyToday, remove task related ones
  }, [events, dateRange, selectedAdvisorId, searchTerm, advisorMap, showOnlyToday]);

  const sortedEvents = useMemo(() => {
     if (!Array.isArray(filteredEvents)) return [];
     const sorted = [...filteredEvents].sort((a, b) => {
        let comparison = 0;
        try {
            // Removed 'task' case
            switch (sortCriteria) {
                case 'date':
                    // Ensure dates are treated as strings before parsing
                    const dateA = parseISO(String(a.date || '')).getTime();
                    const dateB = parseISO(String(b.date || '')).getTime();
                    comparison = compareAsc(isNaN(dateA) ? 0 : dateA, isNaN(dateB) ? 0 : dateB);
                    break;
                case 'advisor':
                    const advisorNameA = advisorMap[a.advisorId] || '';
                    const advisorNameB = advisorMap[b.advisorId] || '';
                    comparison = advisorNameA.localeCompare(advisorNameB);
                    break;
                // Removed 'task' sort case
                case 'eventType':
                    comparison = String(a.eventType || '').localeCompare(String(b.eventType || ''));
                    break;
                case 'loggedTime':
                    comparison = (a.loggedTime || 0) - (b.loggedTime || 0);
                    break;
            }
        } catch (e) {
            console.error("Error during sorting:", e, a, b);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
     });
     return sorted;
     // Update dependencies: remove taskMap
  }, [filteredEvents, sortCriteria, sortDirection, advisorMap]);

   const getEventDisplayTitle = (event: LoggedEvent): string => {
      if (event.eventType === 'Other' && event.eventDetails) {
          return `Other (${event.eventDetails.substring(0, 30)}${event.eventDetails.length > 30 ? '...' : ''})`;
      }
      // Use the eventType itself if not 'Other' or no details
      return typeof event.eventType === 'string' ? event.eventType : 'Unknown Event';
   };

  const handleDelete = async (event: LoggedEvent) => {
    if (deletingId) return;
    const displayTitle = getEventDisplayTitle(event);
    try {
        await onDeleteEvent(event.id);
        // Toast is handled in the parent component now
        // toast({ title: "Success", description: `Event "${displayTitle}" deleted.` });
    } catch (error) { console.error("Error calling onDeleteEvent from EventList:", error); }
  }

  const handleEdit = (event: LoggedEvent) => {
      if (deletingId) return;
      // Pass the full event object to the parent handler
      onEditEvent(event);
  }

  const toggleSortDirection = () => {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Handler for "View Today's Logs" button
  const handleShowToday = () => {
      setShowOnlyToday(true);
      // Clear other filters to ensure only today's logs are shown unfiltered
      setDateRange(undefined);
      setSelectedAdvisorId('all');
      setSearchTerm('');
      // Optionally reset sort? Maybe keep current sort.
      // setSortCriteria('date');
      // setSortDirection('desc');
  };

  // Handler for "Show All Logs" button
  const handleShowAll = () => {
      setShowOnlyToday(false);
      // Filters remain cleared until user reapplies them
  };


  // Update clearFilters
  const clearFilters = () => {
      setDateRange(undefined);
      setSelectedAdvisorId('all');
      // Removed task filter reset
      setSearchTerm('');
      // Also ensure we switch back from "Today" view if clearing
      setShowOnlyToday(false);
  };

  // Determine if any regular filters are active
  const regularFiltersActive = dateRange?.from || selectedAdvisorId !== 'all' || searchTerm !== '';

  return (
    <TooltipProvider>
        <Card className="w-full shadow-lg">
        <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
            <CardTitle className="text-xl font-semibold text-primary">Logged Events</CardTitle>
            {/* Filter Section */}
            <div className="flex flex-col md:flex-row items-center gap-2 flex-wrap">
                {/* Search Input (remains the same) */}
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search events..." className="pl-8 w-full md:w-[180px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={showOnlyToday} /> {/* Disable search in Today view */}
                </div>
                {/* Date Range Picker (disable in Today view) */}
                <DateRangePicker date={dateRange} onDateChange={setDateRange} disabled={showOnlyToday} />
                {/* Advisor Filter (disable in Today view) */}
                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId} disabled={showOnlyToday}>
                    <SelectTrigger className="w-full md:w-[160px]">
                        <SelectValue placeholder="Filter Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Advisors</SelectItem>
                        {advisors.map(advisor => ( <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem> ))}
                    </SelectContent>
                </Select>
                {/* Removed Task Filter */}
                {/* Sorting Controls */}
                <div className="flex items-center gap-2">
                    {/* Remove 'task' sort option */}
                    <Select onValueChange={(value: SortCriteria) => setSortCriteria(value)} value={sortCriteria}>
                        <SelectTrigger className="w-auto"> <SelectValue placeholder="Sort by..." /> </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="advisor">Advisor</SelectItem>
                            {/* Removed task sort option */}
                            <SelectItem value="eventType">Event Type</SelectItem>
                            <SelectItem value="loggedTime">Time Logged</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={toggleSortDirection} aria-label="Toggle sort direction"> <ArrowUpDown className="h-4 w-4" /> </Button>
                </div>
                {/* View Today / Show All Buttons */}
                 <div className="flex items-center gap-2">
                    {showOnlyToday ? (
                        <Button variant="secondary" size="sm" onClick={handleShowAll}> <List className="mr-2 h-4 w-4" /> Show All Logs </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleShowToday}> <CalendarCheck className="mr-2 h-4 w-4" /> View Today's Logs </Button>
                    )}
                     {/* Clear Filters Button (only show if regular filters are active AND not in Today view) */}
                    {regularFiltersActive && !showOnlyToday && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
                    )}
                 </div>
            </div>
        </CardHeader>
        <CardContent>
            {/* Add explanation text when Today's view is active */}
             {showOnlyToday && (
                 <p className="text-sm text-muted-foreground mb-4 italic">Showing all logs for today ({format(new Date(), 'MMM dd, yyyy')}). Sorting is still applied.</p>
             )}
            <ScrollArea className="h-[400px] border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-secondary z-10">
                <TableRow>
                    {/* Remove Task Header */}
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead>Advisor</TableHead>
                    {/* Removed Task Header */}
                    <TableHead>Event Type / Details</TableHead>
                    <TableHead className="w-[100px] text-right">Time (min)</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {sortedEvents.length === 0 ? (
                    <TableRow>
                    {/* Updated colSpan */}
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {showOnlyToday
                            ? 'No events logged today yet.'
                            : (regularFiltersActive ? 'No events found for the selected filters.' : 'No events logged yet.')
                        }
                    </TableCell>
                    </TableRow>
                ) : (
                    sortedEvents.map((event) => {
                        const isDeletingThis = deletingId === event.id;
                        const displayTitle = getEventDisplayTitle(event);
                        // Removed taskName variable

                        return (
                        <TableRow key={event.id} className={cn(isDeletingThis && "opacity-50")}>
                            {/* Ensure date is formatted correctly */}
                            <TableCell> {event.date ? format(parseISO(String(event.date)), 'MMM dd, yyyy') : 'Invalid Date'} </TableCell>
                            <TableCell>{advisorMap[event.advisorId] || 'Unknown Advisor'}</TableCell>
                            {/* Removed Task Cell */}
                            <TableCell>
                                {event.eventType === 'Other' && event.eventDetails ? (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger className="cursor-help underline decoration-dotted"> {event.eventType}* </TooltipTrigger>
                                        <TooltipContent className="max-w-xs break-words"> <p>{event.eventDetails}</p> </TooltipContent>
                                    </Tooltip>
                                ) : ( typeof event.eventType === 'string' ? event.eventType : 'N/A' )}
                            </TableCell>
                            <TableCell className="text-right">{event.loggedTime || 0} min</TableCell>
                            <TableCell className="text-right space-x-1">
                                {/* Action buttons */}
                                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 h-8 w-8" onClick={() => handleEdit(event)} disabled={!!deletingId} aria-label="Edit Event"> <Pencil className="h-4 w-4" /> </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" disabled={!!deletingId} aria-label="Delete Event">
                                            {isDeletingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader> <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle> <AlertDialogDescription> This action cannot be undone. This will permanently delete the event: "<span className="font-semibold">{displayTitle}</span>". </AlertDialogDescription> </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeletingThis}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(event)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeletingThis}> {isDeletingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                        );
                    })
                )}
                </TableBody>
            </Table>
            </ScrollArea>
            {/* Removed tasks prop from TimeLogSummary */}
            <div className='mt-8'>
                <TimeLogSummary loggedEvents={sortedEvents} advisors={advisors} />
            </div>
        </CardContent>
        </Card>
    </TooltipProvider>
  );
}
