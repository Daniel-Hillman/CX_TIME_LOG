'use client';

import type { LoggedEvent, Advisor, StandardEventType } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, compareAsc, startOfDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowUpDown, Loader2, Pencil, Search, CalendarCheck, List, ChevronDown, ChevronUp, EyeOff } from 'lucide-react'; // Added EyeOff
import { cn } from "@/lib/utils";
import { TimeLogSummary } from '@/components/time-log-summary';
// import { useToast } from "@/hooks/use-toast"; // No longer directly used here, consider removing if not needed by sub-components not visible here
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { standardEventTypes } from "@/types";
import { User } from 'firebase/auth'; // Added User import

const getTodayDateString = (): string => {
    return format(new Date(), 'yyyy-MM-dd');
};

interface EventListProps {
  events: LoggedEvent[];
  advisors: Advisor[];
  onDeleteEvent: (eventId: string) => Promise<void>;
  onEditEvent: (event: LoggedEvent) => void;
  deletingId: string | null;
  currentUser: User | null; // Added from page.tsx
  currentUserIsAdmin: boolean; // Added from page.tsx
}

type SortCriteria = 'date' | 'advisor' | 'eventType' | 'loggedTime';
type SortDirection = 'asc' | 'desc';

const eventTypeColorMap: Record<StandardEventType | string, string> = {
  "Meeting": "bg-blue-500 hover:bg-blue-600",
  "Training": "bg-green-500 hover:bg-green-600",
  "Doctor": "bg-red-500 hover:bg-red-600",
  "Dentist": "bg-purple-500 hover:bg-purple-600",
  "Family care": "bg-yellow-500 hover:bg-yellow-600 text-black",
  "Learning": "bg-indigo-500 hover:bg-indigo-600",
  "Exam/Study": "bg-pink-500 hover:bg-pink-600",
  "Task work": "bg-teal-500 hover:bg-teal-600",
  "Charity": "bg-orange-500 hover:bg-orange-600",
  "Other": "bg-gray-500 hover:bg-gray-600",
  "default": "bg-gray-400 hover:bg-gray-500",
};

const getEventTypeColor = (eventType: StandardEventType | string): string => {
  return eventTypeColorMap[eventType] || eventTypeColorMap.default;
};

const TRUNCATE_LENGTH = 70;

export function EventList({
    events,
    advisors,
    onDeleteEvent,
    onEditEvent,
    deletingId,
    currentUser,
    currentUserIsAdmin
}: EventListProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlyToday, setShowOnlyToday] = useState<boolean>(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  // const { toast } = useToast(); // No direct toasts in this component currently

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    const todayDateStr = getTodayDateString();

    if (showOnlyToday) {
        filtered = events.filter(event => event.date === todayDateStr);
    } else {
        if (dateRange?.from) {
            filtered = filtered.filter(event => {
                try {
                    const eventDate = parseISO(String(event.date));
                    const start = startOfDay(dateRange.from!);
                    const end = dateRange.to ? startOfDay(dateRange.to) : startOfDay(dateRange.from!);
                    end.setHours(23, 59, 59, 999); 
                    return isWithinInterval(eventDate, { start, end });
                } catch (e) {
                    console.error("Error parsing date or filtering:", event.date, e);
                    return false;
                }
            });
        }

        if (selectedAdvisorId !== 'all') {
            filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
        }

        if (searchTerm.trim() !== '') {
          const lowerCaseSearchTerm = searchTerm.toLowerCase();
          filtered = filtered.filter(event => {
            const advisorName = advisorMap[event.advisorId]?.toLowerCase() || '';
            const eventType = event.eventType?.toLowerCase() || '';
            const eventDetails = event.eventDetails?.toLowerCase() || '';
            
            // Modify search to respect comment visibility for non-admins
            const canViewCommentForSearch = currentUserIsAdmin || (event.userId === currentUser?.uid);
            const searchableEventDetails = canViewCommentForSearch ? eventDetails : "";

            return (
              advisorName.includes(lowerCaseSearchTerm) ||
              eventType.includes(lowerCaseSearchTerm) ||
              (event.eventType === 'Other' && searchableEventDetails.includes(lowerCaseSearchTerm)) || // Only search 'Other' details if visible
              (event.eventType !== 'Other' && eventType.includes(lowerCaseSearchTerm)) // For non-'Other', search eventType
            );
          });
        }
    } 

    return filtered;
  }, [events, dateRange, selectedAdvisorId, searchTerm, advisorMap, showOnlyToday, currentUser, currentUserIsAdmin]);

  const sortedEvents = useMemo(() => {
     if (!Array.isArray(filteredEvents)) return [];
     const sorted = [...filteredEvents].sort((a, b) => {
        let comparison = 0;
        try {
            switch (sortCriteria) {
                case 'date':
                    const dateA = parseISO(String(a.date || '')).getTime();
                    const dateB = parseISO(String(b.date || '')).getTime();
                    comparison = compareAsc(isNaN(dateA) ? 0 : dateA, isNaN(dateB) ? 0 : dateB);
                    break;
                case 'advisor':
                    const advisorNameA = advisorMap[a.advisorId] || '';
                    const advisorNameB = advisorMap[b.advisorId] || '';
                    comparison = advisorNameA.localeCompare(advisorNameB);
                    break;
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
  }, [filteredEvents, sortCriteria, sortDirection, advisorMap]);

   const getEventDisplayTitle = (event: LoggedEvent): string => {
      if (event.eventType === 'Other' && event.eventDetails) {
          const canViewComment = currentUserIsAdmin || (event.userId === currentUser?.uid);
          if (canViewComment) {
            return `Other (${event.eventDetails.substring(0, 30)}${event.eventDetails.length > 30 ? '...' : ''})`;
          }
          return 'Other [comment hidden]';
      }
      return typeof event.eventType === 'string' ? event.eventType : 'Unknown Event';
   };

  const handleDelete = async (event: LoggedEvent) => {
    if (deletingId) return;
    // const displayTitle = getEventDisplayTitle(event); // Already captured in AlertDialog
    try {
        await onDeleteEvent(event.id);
    } catch (error) { console.error("Error calling onDeleteEvent from EventList:", error); }
  }

  const handleEdit = (event: LoggedEvent) => {
      if (deletingId) return;
      // Add permission check for editing: only own events or admin edits any?
      // For now, assuming if they can see it and edit button is there, they can edit.
      // This might need to be tied to the same logic as comment visibility or be more specific.
      onEditEvent(event);
  }

  const toggleSortDirection = () => {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleShowToday = () => {
      setShowOnlyToday(true);
      setDateRange(undefined);
      setSelectedAdvisorId('all');
      setSearchTerm('');
  };

  const handleShowAll = () => {
      setShowOnlyToday(false);
  };

  const clearFilters = () => {
      setDateRange(undefined);
      setSelectedAdvisorId('all');
      setSearchTerm('');
      setShowOnlyToday(false);
  };

  const regularFiltersActive = dateRange?.from || selectedAdvisorId !== 'all' || searchTerm !== '';

  return (
    <TooltipProvider>
        <Card className="w-full shadow-lg">
        <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
            <CardTitle className="text-xl font-semibold text-primary">Logged Events</CardTitle>
            <div className="flex flex-col md:flex-row items-center gap-2 flex-wrap">
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search events..." className="pl-8 w-full md:w-[180px]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={showOnlyToday} />
                </div>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId} disabled={showOnlyToday}>
                    <SelectTrigger className="w-full md:w-[160px]">
                        <SelectValue placeholder="Filter Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Advisors</SelectItem>
                        {advisors.map(advisor => ( <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem> ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Select onValueChange={(value: SortCriteria) => setSortCriteria(value)} value={sortCriteria}>
                        <SelectTrigger className="w-auto"> <SelectValue placeholder="Sort by..." /> </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="advisor">Advisor</SelectItem>
                            <SelectItem value="eventType">Event Type</SelectItem>
                            <SelectItem value="loggedTime">Time Logged</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={toggleSortDirection} aria-label="Toggle sort direction"> <ArrowUpDown className="h-4 w-4" /> </Button>
                </div>
                 <div className="flex items-center gap-2">
                    {showOnlyToday ? (
                        <Button variant="secondary" size="sm" onClick={handleShowAll}> <List className="mr-2 h-4 w-4" /> Show All Logs </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleShowToday}> <CalendarCheck className="mr-2 h-4 w-4" /> View Today's Logs </Button>
                    )}
                    {regularFiltersActive && !showOnlyToday && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
                    )}
                 </div>
            </div>
        </CardHeader>
        <CardContent>
             {showOnlyToday && (
                 <p className="text-sm text-muted-foreground mb-4 italic">Showing all logs for today ({format(new Date(), 'MMM dd, yyyy')}). Sorting is still applied.</p>
             )}
            <ScrollArea className="h-[400px] border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-secondary z-10">
                <TableRow>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead>Advisor</TableHead>
                    <TableHead>Event Type / Details</TableHead>
                    <TableHead className="w-[160px] text-right">Time (24h)</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {sortedEvents.length === 0 ? (
                    <TableRow>
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
                        const displayTitle = getEventDisplayTitle(event); // Updated to reflect hidden comments
                        const isExpanded = expandedEventId === event.id;
                        const eventDetails = event.eventDetails || "";
                        const isLongDetails = event.eventType === 'Other' && eventDetails.length > TRUNCATE_LENGTH;

                        const canViewComment = currentUserIsAdmin || (currentUser && event.userId === currentUser.uid);

                        return (
                        <TableRow key={event.id} className={cn(isDeletingThis && "opacity-50")}>
                            <TableCell> {event.date ? format(parseISO(String(event.date)), 'MMM dd, yyyy') : 'Invalid Date'} </TableCell>
                            <TableCell>{advisorMap[event.advisorId] || 'Unknown Advisor'}</TableCell>
                            <TableCell>
                                <div>
                                    <Badge className={cn("text-white", getEventTypeColor(event.eventType as StandardEventType))}>                                    
                                      {typeof event.eventType === 'string' ? event.eventType : 'N/A'}
                                    </Badge>
                                    {event.eventType === 'Other' && event.eventDetails && (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {canViewComment ? (
                                                <>
                                                    {isExpanded ? event.eventDetails : `${event.eventDetails.substring(0, TRUNCATE_LENGTH)}${isLongDetails ? '...' : ''}`}
                                                    {isLongDetails && (
                                                        <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-blue-500" onClick={() => setExpandedEventId(isExpanded ? null : event.id)}>
                                                            {isExpanded ? 'Read less' : 'Read more'}
                                                            {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                                                        </Button>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="italic flex items-center"><EyeOff className="h-3 w-3 mr-1 text-gray-400" /> Comment hidden</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {event.startTime && event.endTime
                                ? `${event.startTime} - ${event.endTime}`
                                : `${event.loggedTime} min`}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 h-8 w-8" onClick={() => handleEdit(event)} disabled={!!deletingId} aria-label="Edit Event">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Edit Event</p></TooltipContent>
                                </Tooltip>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" disabled={!!deletingId} aria-label="Delete Event">
                                            {isDeletingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                             <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                             <AlertDialogDescription> This action cannot be undone. This will permanently delete the event: "<span className="font-semibold">{displayTitle}</span>". </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeletingThis}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(event)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeletingThis}>
                                                 {isDeletingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                            </AlertDialogAction>
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
            <div className='mt-8'>
                {/* 
                    Decide if TimeLogSummary should also be admin-only or filter its data based on user. 
                    For now, it receives all sortedEvents. If it contains sensitive comment summaries, 
                    it might need `currentUser` and `currentUserIsAdmin` props as well.
                    Based on initial request, Summary TAB is admin-only, so this component is fine as is.
                */}
                <TimeLogSummary loggedEvents={sortedEvents} advisors={advisors} />
            </div>
        </CardContent>
        </Card>
    </TooltipProvider>
  );
}
