'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import type { Advisor, LoggedEvent } from '@/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { AdvisorManager } from '@/components/advisor-manager';
import { TimeLogForm } from '@/components/time-log-form';
import { EventList } from '@/components/event-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ListChecks, Clock } from 'lucide-react'; // Import icons

export default function Home() {
  const [advisors, setAdvisors] = useLocalStorage<Advisor[]>('cx-advisors', []);
  const [loggedEvents, setLoggedEvents] = useLocalStorage<LoggedEvent[]>('cx-loggedEvents', []);
  const [isClient, setIsClient] = useState(false); // State to track if component is mounted

  useEffect(() => {
    setIsClient(true); // Component has mounted
  }, []);

  const handleAdvisorsChange = (updatedAdvisors: Advisor[]) => {
     // Check if an advisor being removed is used in any logged events
    const removedAdvisorIds = advisors
      .filter(oldAdvisor => !updatedAdvisors.some(newAdvisor => newAdvisor.id === oldAdvisor.id))
      .map(a => a.id);

    if (removedAdvisorIds.length > 0) {
      const eventsUsingRemovedAdvisors = loggedEvents.filter(event => removedAdvisorIds.includes(event.advisorId));
      if (eventsUsingRemovedAdvisors.length > 0) {
         // Optionally: prevent deletion or handle cascade deletion/update
         // For now, we just update the advisors list. Events will show 'Unknown Advisor'
         console.warn("Deleting advisors used in existing logs. Events will show 'Unknown Advisor'.");
      }
    }
    setAdvisors(updatedAdvisors);
  };

  const handleLogEvent = (newEvent: LoggedEvent) => {
    setLoggedEvents((prevEvents) => [...prevEvents, newEvent]);
  };

   const handleDeleteEvent = (eventIdToDelete: string) => {
        setLoggedEvents((prevEvents) => prevEvents.filter(event => event.id !== eventIdToDelete));
    };

  if (!isClient) {
    // Render loading state or null on the server
    return (
         <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
         </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-2">
          <Clock className="h-8 w-8" /> CX Time Logger
        </h1>
        <p className="text-muted-foreground mt-2">Log and manage your team's time efficiently.</p>
      </header>

      <Tabs defaultValue="log-time" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary rounded-lg p-1">
          <TabsTrigger value="log-time" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <Clock className="mr-2 h-4 w-4" /> Log Time
          </TabsTrigger>
          <TabsTrigger value="view-logs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <ListChecks className="mr-2 h-4 w-4" /> View Logs
          </TabsTrigger>
          <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <Users className="mr-2 h-4 w-4" /> Manage Advisors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log-time">
          <TimeLogForm advisors={advisors} onLogEvent={handleLogEvent} />
        </TabsContent>

        <TabsContent value="view-logs">
           <EventList events={loggedEvents} advisors={advisors} onDeleteEvent={handleDeleteEvent} />
        </TabsContent>

        <TabsContent value="manage-advisors">
          <AdvisorManager advisors={advisors} onAdvisorsChange={handleAdvisorsChange} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
