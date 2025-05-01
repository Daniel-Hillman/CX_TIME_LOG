'use client';

import type { LoggedEvent, Advisor, Task } from '@/types'; // *** IMPORT Task ***
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, compareAsc } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowUpDown, Loader2, Pencil, Search, ListTodo } from 'lucide-react'; // *** IMPORT ListTodo ***
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

interface EventListProps {
  events: LoggedEvent[];
  advisors: Advisor[];
  tasks: Task[]; // *** ADD tasks prop ***
  onDeleteEvent: (eventId: string) => Promise<void>;
  onEditEvent: (event: LoggedEvent) => void;
  deletingId: string | null;
}

// *** ADD 'task' to SortCriteria ***
type SortCriteria = 'date' | 'advisor' | 'task' | 'eventType' | 'loggedTime';
type SortDirection = 'asc' | 'desc';

export function EventList({
    events,
    advisors,
    tasks, // *** Destructure tasks ***
    onDeleteEvent,
    onEditEvent,
    deletingId
}: EventListProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | 'all'>('all'); // *** ADD Task Filter State ***
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  // *** ADD taskMap ***
  const taskMap = useMemo(() => {
    return tasks.reduce((map, task) => {
        map[task.id] = task.name;
        return map;
    }, {} as Record<string, string>);
  }, [tasks]);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by Date Range
    if (dateRange?.from) {
        filtered = filtered.filter(event => {
            try {
                const eventDate = parseISO(event.date);
                const start = dateRange.from!;
                const end = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from!);             
                end.setHours(23, 59, 59, 999);
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

    // *** Filter by Task ***
    if (selectedTaskId !== 'all') {
        filtered = filtered.filter(event => event.taskId === selectedTaskId);
    }

    // *** Filter by Search Term (include Task Name) ***
    if (searchTerm.trim() !== '') {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(event => {
        const advisorName = advisorMap[event.advisorId]?.toLowerCase() || '';
        const taskName = event.taskId ? taskMap[event.taskId]?.toLowerCase() || '' : ''; // Get task name for search
        const eventType = event.eventType?.toLowerCase() || '';
        const eventDetails = event.eventDetails?.toLowerCase() || '';
        return (
          advisorName.includes(lowerCaseSearchTerm) ||
          taskName.includes(lowerCaseSearchTerm) || // Search in task name
          eventType.includes(lowerCaseSearchTerm) ||
          eventDetails.includes(lowerCaseSearchTerm)
        );
      });
    }

    return filtered;
    // *** ADD selectedTaskId, taskMap to dependencies ***
  }, [events, dateRange, selectedAdvisorId, selectedTaskId, searchTerm, advisorMap, taskMap]);

  const sortedEvents = useMemo(() => {
     if (!Array.isArray(filteredEvents)) return [];
     const sorted = [...filteredEvents].sort((a, b) => {
        let comparison = 0;
        try {
            // *** UPDATE Sorting logic ***
            switch (sortCriteria) {
                case 'date':
                    const dateA = parseISO(a.date || '').getTime();
                    const dateB = parseISO(b.date || '').getTime();
                    comparison = compareAsc(isNaN(dateA) ? 0 : dateA, isNaN(dateB) ? 0 : dateB);
                    break;
                case 'advisor':
                    const advisorNameA = advisorMap[a.advisorId] || '';
                    const advisorNameB = advisorMap[b.advisorId] || '';
                    comparison = advisorNameA.localeCompare(advisorNameB);
                    break;
                case 'task': // *** Sort by Task Name ***
                    const taskNameA = a.taskId ? taskMap[a.taskId] || '' : '';
                    const taskNameB = b.taskId ? taskMap[b.taskId] || '' : '';
                    comparison = taskNameA.localeCompare(taskNameB);
                    break;
                case 'eventType':
                    comparison = (a.eventType || '').localeCompare(b.eventType || '');
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
     // *** ADD taskMap to sort dependencies ***
  }, [filteredEvents, sortCriteria, sortDirection, advisorMap, taskMap]);

   const getEventDisplayTitle = (event: LoggedEvent): string => {
      if (event.eventType === 'Other' && event.eventDetails) {
          return `Other (${event.eventDetails.substring(0, 30)}${event.eventDetails.length > 30 ? '...' : ''})`;
      }
      return event.eventType;
   };

  const handleDelete = async (event: LoggedEvent) => {
    if (deletingId) return;
    const displayTitle = getEventDisplayTitle(event);
    try {
        await onDeleteEvent(event.id);
        toast({
            title: "Success",
            description: `Event &quot;${displayTitle}&quot; deleted.`
        });
    } catch (error) {
        // Error toast is handled in page.tsx now by re-throwing
        console.error("Error calling onDeleteEvent from EventList:", error);
    }
  }

  const handleEdit = (event: LoggedEvent) => {
      if (deletingId) return;
      onEditEvent(event);
  }

  const toggleSortDirection = () => {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // *** UPDATE clearFilters to reset task filter ***
  const clearFilters = () => {
      setDateRange(undefined);
      setSelectedAdvisorId('all');
      setSelectedTaskId('all'); // Reset task filter
      setSearchTerm('');
  };

  return (
    <TooltipProvider>
        <Card className="w-full shadow-lg">
        <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
            <CardTitle className="text-xl font-semibold text-primary">Logged Events</CardTitle>
            {/* *** Updated Filter Section *** */}
            <div className="flex flex-col md:flex-row items-center gap-2 flex-wrap"> 
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search events..." 
                        className="pl-8 w-full md:w-[180px]" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                {/* Advisor Filter */}
                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId}> 
                    <SelectTrigger className="w-full md:w-[160px]"> 
                        <SelectValue placeholder="Filter Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Advisors</SelectItem>
                        {advisors.map(advisor => (
                            <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 {/* *** Task Filter *** */}
                <Select onValueChange={setSelectedTaskId} value={selectedTaskId}> 
                    <SelectTrigger className="w-full md:w-[160px]"> 
                        <ListTodo className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter Task" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        {tasks.map(task => (
                            <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {/* Sorting Controls */}
                <div className="flex items-center gap-2">
                    <Select onValueChange={(value: SortCriteria) => setSortCriteria(value)} value={sortCriteria}> 
                        <SelectTrigger className="w-auto"> 
                        <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="advisor">Advisor</SelectItem>
                        <SelectItem value="task">Task</SelectItem> {/* Add Task Sort Option */} 
                        <SelectItem value="eventType">Event Type</SelectItem> 
                        <SelectItem value="loggedTime">Time Logged</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={toggleSortDirection} aria-label="Toggle sort direction">
                        <ArrowUpDown className="h-4 w-4" />
                    </Button>
                </div>
                {/* *** Update Condition for Clear Filters Button *** */}
                {(dateRange?.from || selectedAdvisorId !== 'all' || selectedTaskId !== 'all' || searchTerm !== '') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
                )}
            </div>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[400px] border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-secondary z-10">
                <TableRow>
                    {/* *** ADD Task Header *** */}
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead>Advisor</TableHead>
                    <TableHead>Task</TableHead> 
                    <TableHead>Event Type / Details</TableHead>
                    <TableHead className="w-[100px] text-right">Time (min)</TableHead> 
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {sortedEvents.length === 0 ? (
                    <TableRow>
                    {/* *** Update colSpan *** */}
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {dateRange?.from || selectedAdvisorId !== 'all' || selectedTaskId !== 'all' || searchTerm !== '' 
                         ? 'No events found for the selected filters.' 
                         : 'No events logged yet.'}
                    </TableCell>
                    </TableRow>
                ) : (
                    sortedEvents.map((event) => {
                        const isDeletingThis = deletingId === event.id;
                        const displayTitle = getEventDisplayTitle(event);
                        const taskName = event.taskId ? taskMap[event.taskId] : null; // Get task name

                        return (
                        <TableRow key={event.id} className={cn(isDeletingThis && "opacity-50")}>
                            <TableCell>
                               {event.date ? format(parseISO(event.date), 'MMM dd, yyyy') : 'Invalid Date'}
                            </TableCell>
                            <TableCell>{advisorMap[event.advisorId] || 'Unknown Advisor'}</TableCell>
                            {/* *** ADD Task Cell *** */}
                            <TableCell>
                                {taskName ? (
                                    <span title={taskName} className="truncate">{taskName}</span>
                                ) : (
                                    <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {event.eventType === 'Other' && event.eventDetails ? (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger className="cursor-help underline decoration-dotted">
                                            {event.eventType}*
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs break-words">
                                            <p>{event.eventDetails}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    event.eventType || 'N/A' 
                                )}
                            </TableCell>
                            <TableCell className="text-right">{event.loggedTime || 0} min</TableCell>
                            <TableCell className="text-right space-x-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-primary hover:bg-primary/10"
                                onClick={() => handleEdit(event)}
                                disabled={!!deletingId} 
                                aria-label="Edit Event"
                            >
                                    <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        disabled={!!deletingId} 
                                        aria-label="Delete Event"
                                    >
                                    {isDeletingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the event:
                                        &quot;<span className="font-semibold">{displayTitle}</span>&quot;.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeletingThis}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => handleDelete(event)} 
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={isDeletingThis}
                                    >
                                        {isDeletingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Delete
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
            {/* Pass tasks to TimeLogSummary if needed, otherwise keep as is */}
            <div className='mt-8'>
            <TimeLogSummary loggedEvents={sortedEvents} advisors={advisors} tasks={tasks} />
            </div>
        </CardContent>
        </Card>
    </TooltipProvider>
  );
}
