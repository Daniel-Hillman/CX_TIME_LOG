"use client";

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
// Removed unused format, isSameDay from date-fns
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, isWithinInterval } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
// Removed unused cn import

interface TimeLogSummaryProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

export function TimeLogSummary({ loggedEvents, advisors }: TimeLogSummaryProps) {
    // Removed unused advisorMap variable
    const advisorTimeLogs = React.useMemo(() => {
        const logs: Record<string, { name: string; day: number; week: number; month: number }> = {};

        advisors.forEach(advisor => {
          logs[advisor.id] = { name: advisor.name, day: 0, week: 0, month: 0 };
        });

        loggedEvents.forEach(event => {
          try {
            const eventDate = new Date(event.date);
            if (isNaN(eventDate.getTime())) {
              console.warn("Skipping event with invalid date:", event);
              return; // Skip this event
            }

            const eventTime = event.loggedTime || 0; // Default to 0 if undefined

            const now = new Date();
            const todayStart = startOfDay(now);
            const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Assuming week starts on Monday
            const monthStart = startOfMonth(now);

            const todayEnd = endOfDay(now);
            const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
            const monthEnd = endOfMonth(now);

            // Ensure advisor exists in logs before adding time
            if (!logs[event.advisorId]) {
               console.warn("Event found for unknown advisor:", event.advisorId);
               return; // Skip event if advisor is not in the current list
            }

            if (isWithinInterval(eventDate, { start: todayStart, end: todayEnd })) {
               logs[event.advisorId].day += eventTime;
            }

            if (isWithinInterval(eventDate, { start: weekStart, end: weekEnd })) {
               logs[event.advisorId].week += eventTime;
            }

            if (isWithinInterval(eventDate, { start: monthStart, end: monthEnd })) {
               logs[event.advisorId].month += eventTime;
            }
          } catch (e) {
              console.error("Error processing event date in summary:", event.date, e);
          }
        });

        return logs;
      }, [loggedEvents, advisors]);

    return (
        <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Time Log Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] border rounded-md">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Advisor</TableHead>
              <TableHead className="w-[100px] text-right">Today</TableHead>
              <TableHead className="w-[100px] text-right">This Week</TableHead>
              <TableHead className="w-[100px] text-right">This Month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {advisors.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No advisor data to summarize.
                    </TableCell>
                </TableRow>
             ) : Object.entries(advisorTimeLogs).length === 0 ? (
                <TableRow>
                     <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                         No time logged for the current periods.
                     </TableCell>
                </TableRow>
             ) : (
                 Object.entries(advisorTimeLogs).map(([advisorId, timeLogs]) => (
                  <TableRow key={advisorId}>
                    <TableCell>{timeLogs.name}</TableCell>
                    <TableCell className="text-right">{timeLogs.day} min</TableCell>
                    <TableCell className="text-right">{timeLogs.week} min</TableCell>
                    <TableCell className="text-right">{timeLogs.month} min</TableCell>
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