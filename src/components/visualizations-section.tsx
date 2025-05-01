'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { DateRange } from "react-day-picker";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Separator } from '@/components/ui/separator';

// Install react-chartjs-2 and chart.js if you haven't already:
// npm install react-chartjs-2 chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface VisualizationsSectionProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

type TimeRange = 'day' | 'week' | 'month' | 'year' | 'custom';

export function VisualizationsSection({ loggedEvents, advisors }: VisualizationsSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week'); // Default to week
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');

  const advisorMap = useMemo(() => {
    return advisors.reduce((map, advisor) => {
      map[advisor.id] = advisor.name;
      return map;
    }, {} as Record<string, string>);
  }, [advisors]);

  const filteredEvents = useMemo(() => {
    let filtered = loggedEvents;
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    if (timeRange === 'day') {
      start = startOfWeek(now, { weekStartsOn: 1 }); // This might be incorrect for 'day', should be startOfDay
      end = endOfWeek(now, { weekStartsOn: 1 }); // This might be incorrect for 'day', should be endOfDay
       // Correcting for 'day'
       start = new Date(); // Start of today
       start.setHours(0, 0, 0, 0);
       end = new Date(); // End of today
       end.setHours(23, 59, 59, 999);
    } else if (timeRange === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (timeRange === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (timeRange === 'year') {
      start = startOfYear(now);
      end = endOfYear(now);
    } else if (timeRange === 'custom' && customDateRange?.from) {
       start = customDateRange.from;
       // Add 1 day to the end date to include the entire end day in the interval
       end = customDateRange.to ? new Date(customDateRange.to) : new Date(customDateRange.from);
       if (customDateRange.to) end.setDate(end.getDate() + 1);
        // Ensure custom date range has an end if only start is selected
        if (!customDateRange.to) {
             end = new Date(start);
             end.setDate(end.getDate() + 1); // Include the selected day
         }
    }

    // Apply date range filter
    if (start && end) {
         filtered = filtered.filter(event => {
            const eventDate = parseISO(event.date);
             return isWithinInterval(eventDate, { start: start!, end: end! });
         });
    }

    // Filter by advisor
    if (selectedAdvisorId !== 'all') {
      filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
    }

    return filtered;
  }, [loggedEvents, timeRange, customDateRange, selectedAdvisorId]);

   // Data for Bar Chart: Time logged per advisor in the selected period
   const advisorTimeData = useMemo(() => {
      const data: Record<string, number> = {};

      filteredEvents.forEach(event => {
          if (!data[event.advisorId]) {
              data[event.advisorId] = 0;
          }
          data[event.advisorId] += event.loggedTime;
      });

      const labels = Object.keys(data).map(advisorId => advisorMap[advisorId] || 'Unknown Advisor');
      const times = Object.values(data);

      return {
         labels,
         datasets: [
            {
               label: 'Time Logged (minutes)',
               data: times,
               backgroundColor: 'rgba(75, 192, 192, 0.6)',
               borderColor: 'rgba(75, 192, 192, 1)',
               borderWidth: 1,
            },
         ],
      };
   }, [filteredEvents, advisorMap]);

   // Data for Doughnut Chart: Time logged breakdown by advisor
   const advisorTimeBreakdownData = useMemo(() => {
       const data: Record<string, number> = {};

       filteredEvents.forEach(event => {
           if (!data[event.advisorId]) {
               data[event.advisorId] = 0;
           }
           data[event.advisorId] += event.loggedTime;
       });

       const labels = Object.keys(data).map(advisorId => advisorMap[advisorId] || 'Unknown Advisor');
       const times = Object.values(data);

       // Generate a color for each advisor
       const backgroundColors = labels.map((_, index) => `hsl(${index * 60 % 360}, 70%, 60%)`);

       return {
          labels,
          datasets: [
             {
                label: 'Time Logged (minutes)',
                data: times,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 2,
             },
          ],
       };
   }, [filteredEvents, advisorMap]);

    // Data for Line Chart: Time logged over time (e.g., daily trend within the selected range)
    const timeTrendData = useMemo(() => {
        const dailyData: Record<string, number> = {};

        filteredEvents.forEach(event => {
            // Use the event date as the key (YYYY-MM-DD)
            if (!dailyData[event.date]) {
                dailyData[event.date] = 0;
            }
            dailyData[event.date] += event.loggedTime;
        });

        // Sort dates for the line chart
        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(dateKey => format(parseISO(dateKey), 'MMM dd')); // Format for display
        const times = sortedDates.map(dateKey => dailyData[dateKey]);

        return {
            labels,
            datasets: [
                {
                    label: 'Time Logged Daily (minutes)',
                    data: times,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.3,
                },
            ],
        };
    }, [filteredEvents]);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-primary">Visualizations</CardTitle>
        <div className="flex flex-col md:flex-row items-center gap-4">
           {/* Time Range Select */}
           <Select onValueChange={(value: TimeRange) => setTimeRange(value)} defaultValue={timeRange}>
              <SelectTrigger className="w-[150px]">
                 <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="day">Today</SelectItem>
                 <SelectItem value="week">This Week</SelectItem>
                 <SelectItem value="month">This Month</SelectItem>
                 <SelectItem value="year">This Year</SelectItem>
                 <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
           </Select>

          {/* Custom Date Range Picker (conditionally rendered) */}
          {timeRange === 'custom' && (
             <DateRangePicker date={customDateRange} onDateChange={setCustomDateRange} />
          )}

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

          {/* Clear Filters Button */}
          {(timeRange !== 'week' || selectedAdvisorId !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => {setTimeRange('week'); setCustomDateRange(undefined); setSelectedAdvisorId('all');}}>Clear Filters</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
          {/* Bar Chart: Time per Advisor */}
          <div>
              <h3 className="text-lg font-semibold text-center mb-4">Time Logged Per Advisor</h3>
              {filteredEvents.length > 0 ? (
                 <Bar data={advisorTimeData} />
              ) : (
                 <p className="text-center text-muted-foreground">No data to display for this period/filter.</p>
              )}
          </div>

          <Separator />

           {/* Doughnut Chart: Time Breakdown by Advisor */}
          <div>
              <h3 className="text-lg font-semibold text-center mb-4">Time Breakdown by Advisor</h3>
              {filteredEvents.length > 0 ? (
                 <div className="flex justify-center">
                   {/* Adjust container size as needed */}
                    <div className="relative h-64 w-64">
                      <Doughnut data={advisorTimeBreakdownData} />
                   </div>
                 </div>
              ) : (
                 <p className="text-center text-muted-foreground">No data to display for this period/filter.</p>
              )}
          </div>

          <Separator />

           {/* Line Chart: Daily Time Trend */}
           <div>
              <h3 className="text-lg font-semibold text-center mb-4">Daily Time Log Trend</h3>
               {filteredEvents.length > 0 ? (
                 <Line data={timeTrendData} />
              ) : (
                 <p className="text-center text-muted-foreground">No data to display for this period/filter.</p>
              )}
           </div>

      </CardContent>
    </Card>
  );
}