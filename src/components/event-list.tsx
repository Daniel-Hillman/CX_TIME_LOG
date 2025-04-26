'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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


interface EventListProps {
  events: LoggedEvent[];
  advisors: Advisor[];
  onDeleteEvent: (eventId: string) => void;
}

export function EventList({ events, advisors, onDeleteEvent }: EventListProps) {
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const filteredEvents = useMemo(() => {
    if (!filterDate) {
      return events;
    }
    const formattedFilterDate = format(filterDate, 'yyyy-MM-dd');
    return events.filter(event => event.date === formattedFilterDate);
  }, [events, filterDate]);

  // Sort events by date descending (most recent first)
  const sortedEvents = useMemo(() => {
     return [...filteredEvents].sort((a, b) => {
        const dateA = parseISO(a.date).getTime();
        const dateB = parseISO(b.date).getTime();
        // Sort by date descending
        if (dateB !== dateA) {
            return dateB - dateA;
        }
        // If dates are same, maybe sort by logged time or title? Let's keep original order for now.
        return 0;
     });
  }, [filteredEvents]);

  const handleDelete = (eventId: string, eventTitle: string) => {
    onDeleteEvent(eventId);
    toast({
        title: "Success",
        description: `Event "${eventTitle}" deleted.`
    });
  }


  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-primary">Logged Events</CardTitle>
        <div className="flex items-center gap-2">
         <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !filterDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDate ? format(filterDate, "PPP") : <span>Filter by date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={setFilterDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {filterDate && (
              <Button variant="ghost" size="sm" onClick={() => setFilterDate(undefined)}>Clear Filter</Button>
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
                    {filterDate ? 'No events logged for this date.' : 'No events logged yet.'}
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
          <TimeLogSummary loggedEvents={events} advisors={advisors} />
        </div>
      </CardContent>
    </Card>
  );
}
