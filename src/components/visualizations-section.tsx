'use client';

import type { LoggedEvent, Advisor } from '@/types';
import * as React from 'react';
import { useState, useMemo } from 'react';
// Import subDays and ensure all necessary date-fns functions are present
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays } from 'date-fns'; 
import { DateRange } from "react-day-picker";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button'; 
import { cn } from "@/lib/utils"; // Import cn for conditional styling

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js'; 
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
  LineElement,
  Filler
);

interface VisualizationsSectionProps {
  loggedEvents: LoggedEvent[];
  advisors: Advisor[];
}

// Define more specific time range identifiers
type TimeRangePreset = 'day' | 'week' | 'last7' | 'last30' | 'month' | 'year' | 'custom';

const timeRangePresets: { label: string; value: TimeRangePreset }[] = [
    { label: "Today", value: "day" },
    { label: "This Week", value: "week" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "month" },
    { label: "This Year", value: "year" },
    { label: "Custom", value: "custom" },
];

export function VisualizationsSection({ loggedEvents, advisors }: VisualizationsSectionProps) {
  // Use the new TimeRangePreset type
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('week'); 
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
    let end: Date | undefined = endOfDay(now); // End defaults to end of today for relative ranges

    // *** UPDATE Filter logic for new time ranges ***
    if (timeRange === 'day') {
       start = startOfDay(now);
    } else if (timeRange === 'week') {
      start = startOfWeek(now, { weekStartsOn: 1 }); 
      end = endOfWeek(now, { weekStartsOn: 1 }); // Week needs specific end
    } else if (timeRange === 'last7') {
      start = startOfDay(subDays(now, 6)); // Today + 6 days ago = 7 days
    } else if (timeRange === 'last30') {
      start = startOfDay(subDays(now, 29)); // Today + 29 days ago = 30 days
    } else if (timeRange === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now); // Month needs specific end
    } else if (timeRange === 'year') {
      start = startOfYear(now);
      end = endOfYear(now); // Year needs specific end
    } else if (timeRange === 'custom' && customDateRange?.from) {
       start = startOfDay(customDateRange.from); // Use start of day for consistency
       // End date should be end of day
       end = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
    }

    // Apply date range filter only if start and end are valid
    if (start && end) {
         filtered = filtered.filter(event => {
             try {
                const eventDate = parseISO(event.date); // Assume date is stored as YYYY-MM-DD
                 // Ensure the event date is valid before comparing
                 if (isNaN(eventDate.getTime())) return false; 
                 return isWithinInterval(eventDate, { start: start!, end: end! });
             } catch (e) {
                 console.error("Error parsing event date or checking interval:", event.date, e);
                 return false;
             }
         });
    }

    // Filter by advisor
    if (selectedAdvisorId !== 'all') {
      filtered = filtered.filter(event => event.advisorId === selectedAdvisorId);
    }

    return filtered;
  }, [loggedEvents, timeRange, customDateRange, selectedAdvisorId]);

   // --- Chart data generation (remains the same) ---
   const advisorTimeData = useMemo(() => {
      if (filteredEvents.length === 0) {
          return { labels: [], datasets: [] };
      }
      const data: Record<string, number> = {};
      filteredEvents.forEach(event => {
          if (!data[event.advisorId]) { data[event.advisorId] = 0; }
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

   const advisorTimeBreakdownData = useMemo(() => {
        if (filteredEvents.length === 0) {
            return { labels: [], datasets: [] };
        }
       const data: Record<string, number> = {};
       filteredEvents.forEach(event => {
           if (!data[event.advisorId]) { data[event.advisorId] = 0; }
           data[event.advisorId] += event.loggedTime;
       });
       const labels = Object.keys(data).map(advisorId => advisorMap[advisorId] || 'Unknown Advisor');
       const times = Object.values(data);
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

    const timeTrendData = useMemo(() => {
         if (filteredEvents.length === 0) {
            return { labels: [], datasets: [] };
         }
        const dailyData: Record<string, number> = {};
        filteredEvents.forEach(event => {
            const dateKey = event.date; // Use YYYY-MM-DD directly
            if (!dailyData[dateKey]) { dailyData[dateKey] = 0; }
            dailyData[dateKey] += event.loggedTime;
        });
        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(dateKey => format(parseISO(dateKey), 'MMM dd'));
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
    
  // *** Function to handle clearing filters ***
  const clearFilters = () => {
      setTimeRange('week'); // Reset to default range
      setCustomDateRange(undefined);
      setSelectedAdvisorId('all');
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-col space-y-4 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
             <CardTitle className="text-xl font-semibold text-primary whitespace-nowrap">Visualizations</CardTitle>
            {/* *** Advisor Filter (moved up slightly for layout) *** */}
            <div className="flex items-center gap-2">
                <Select onValueChange={setSelectedAdvisorId} value={selectedAdvisorId}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Filter by Advisor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Advisors</SelectItem>
                        {advisors.map(advisor => (
                            <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {/* *** Conditionally show Clear Filters button *** */} 
                 {(timeRange !== 'week' || selectedAdvisorId !== 'all') && (
                     <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
                 )}
            </div>
        </div>
         {/* *** Time Range Buttons *** */}
         <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium mr-2">Date Range:</span>
             {timeRangePresets.map((preset) => (
                <Button
                   key={preset.value}
                   variant={timeRange === preset.value ? 'secondary' : 'outline'} // Highlight active
                   size="sm"
                   onClick={() => setTimeRange(preset.value)}
                   className={cn(timeRange === 'custom' && preset.value === 'custom' && 'ring-2 ring-primary')} // Add ring for custom when active
                 >
                   {preset.label}
                 </Button>
             ))}
         </div>
        {/* Custom Date Range Picker (conditionally rendered) */}
        {timeRange === 'custom' && (
            <div className="mt-2">
                <DateRangePicker date={customDateRange} onDateChange={setCustomDateRange} />
             </div>
         )}
      </CardHeader>
      <CardContent className="space-y-8 pt-4">
          {/* Bar Chart: Time per Advisor */}
          <div>
              <h3 className="text-lg font-semibold text-center mb-4">Time Logged Per Advisor</h3>
              {filteredEvents.length > 0 ? (
                 <Bar data={advisorTimeData} options={{ responsive: true, maintainAspectRatio: true }} />
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
                    <div className="relative h-64 w-64 md:h-80 md:w-80">
                      <Doughnut data={advisorTimeBreakdownData} options={{ responsive: true, maintainAspectRatio: false }}/>
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
                 <Line data={timeTrendData} options={{ responsive: true, maintainAspectRatio: true }} />
              ) : (
                 <p className="text-center text-muted-foreground">No data to display for this period/filter.</p>
              )}
           </div>

      </CardContent>
    </Card>
  );
}
