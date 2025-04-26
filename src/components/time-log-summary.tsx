"use client";

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, isSameDay, isWithinInterval } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TimeLogSummaryProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

export function TimeLogSummary({ loggedEvents, advisors }: TimeLogSummaryProps) {
    const advisorMap = React.useMemo(() => {
        return advisors.reduce((map, advisor) => {
          map[advisor.id] = advisor.name;
          return map;
        }, {} as Record<string, string>);
      }, [advisors]);
    const advisorTimeLogs = React.useMemo(() => {
        const logs: Record<string, { name: string; day: number; week: number; month: number }> = {};
        
        advisors.forEach(advisor => {
          logs[advisor.id] = { name: advisor.name, day: 0, week: 0, month: 0 };
        });
    
        loggedEvents.forEach(event => {
          const eventDate = new Date(event.date);
          const eventTime = event.loggedTime; 
    
          const todayStart = startOfDay(new Date());
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
          const monthStart = startOfMonth(new Date());
    
          const todayEnd = endOfDay(new Date());
          const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
          const monthEnd = endOfMonth(new Date());
    
           if (isWithinInterval(eventDate, { start: todayStart, end: todayEnd })) {
                logs[event.advisorId].day += eventTime;
            }
          
            if (isWithinInterval(eventDate, { start: weekStart, end: weekEnd })) {
                logs[event.advisorId].week += eventTime;
            }
           if (isWithinInterval(eventDate, { start: monthStart, end: monthEnd })) {
                logs[event.advisorId].month += eventTime;
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
            {Object.entries(advisorTimeLogs).map(([advisorId, timeLogs]) => (
              <TableRow key={advisorId}>
                <TableCell>{timeLogs.name}</TableCell>
                <TableCell className="text-right">{timeLogs.day} min</TableCell>
                <TableCell className="text-right">{timeLogs.week} min</TableCell>
                <TableCell className="text-right">{timeLogs.month} min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </ScrollArea>
        </CardContent>
      </Card>
    );
  }