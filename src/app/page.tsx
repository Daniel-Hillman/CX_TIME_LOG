'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Keep useState
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle"; // Fixed import name
import { AdvisorManager } from '@/components/advisor-manager';
import { EventList } from '@/components/event-list';
import { TimeLogForm } from '@/components/time-log-form';
import { TimeLogSummary } from '@/components/time-log-summary';
import { ExportVisualizationLayout } from '@/components/export-visualization-layout';
import { ReportSection } from '@/components/report-section';
import { VisualizationsSection } from '@/components/visualizations-section';
import { PolicySearch } from '@/components/policy-search'; // Import PolicySearch
import { Calendar, Clock, Users, BookOpen, AreaChart, FileSearch } from 'lucide-react'; // Removed ListTodo
import { Advisor, LoggedEvent } from '@/types'; // Removed Task type
import useLocalStorage from '@/hooks/use-local-storage'; // Changed to default import
import { useToast } from "@/hooks/use-toast";

import { PolicyDataMap } from '@/components/policy-search'; // Import necessary type

// Import the new logo component
import { TempoLogo } from '@/components/tempo-logo';

export default function Home() {
  const { toast } = useToast();
  const [loggedEvents, setLoggedEvents] = useLocalStorage<LoggedEvent[]>('timeLogEvents', []);
  // Removed tasks state
  // const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', []);
  const [advisors, setAdvisors] = useLocalStorage<Advisor[]>('advisors', []);
  const [activeTab, setActiveTab] = useState('time-log');

  // Lifted state for PolicySearch persistence
  const [policyData, setPolicyData] = useState<PolicyDataMap>(new Map());
  const [policyFileName, setPolicyFileName] = useState<string | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState<boolean>(false);
  const [policyParseError, setPolicyParseError] = useState<string | null>(null);


  // Function to add a new time log event
  const addTimeLog = useCallback((event: Omit<LoggedEvent, 'id' | 'timestamp'>) => {
    const newEvent: LoggedEvent = {
      ...event,
      id: Date.now().toString(), // Simple unique ID
      timestamp: new Date().toISOString(),
    };
    setLoggedEvents(prevEvents => [...prevEvents, newEvent]);
    toast({ title: "Success", description: "Time log entry added." });
  }, [setLoggedEvents, toast]);

  // Add a new advisor
  const addAdvisor = (name: string) => {
    if (name && !advisors.find(a => a.name === name)) {
      const newAdvisor: Advisor = { id: Date.now().toString(), name };
      setAdvisors(prev => [...prev, newAdvisor]);
      toast({ title: "Success", description: `Advisor '${name}' added.` });
    } else if (advisors.find(a => a.name === name)) {
      toast({ variant: "destructive", title: "Error", description: `Advisor '${name}' already exists.` });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Advisor name cannot be empty." });
    }
  };

  // Remove an advisor
  const removeAdvisor = (id: string) => {
    const advisorToRemove = advisors.find(a => a.id === id);
    // Prevent deletion if advisor is associated with logged events
    if (loggedEvents.some(event => event.advisorId === id)) {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Cannot delete advisor '${advisorToRemove?.name}' as they have logged time entries.`,
      });
      return; // Stop the deletion process
    }

    setAdvisors(prev => prev.filter(a => a.id !== id));
    if (advisorToRemove) {
       toast({ title: "Success", description: `Advisor '${advisorToRemove.name}' removed.` });
    } else {
         toast({ variant: "warning", title: "Not Found", description: `Advisor not found.` });
    }
  };

  // Edit an advisor's name
  const editAdvisor = (id: string, newName: string) => {
    if (!newName.trim()) {
       toast({ variant: "destructive", title: "Error", description: "Advisor name cannot be empty." });
       return;
    }
     // Check if the new name already exists (case-insensitive)
    if (advisors.some(a => a.id !== id && a.name.toLowerCase() === newName.trim().toLowerCase())) {
        toast({ variant: "destructive", title: "Error", description: `Advisor name '${newName.trim()}' already exists.` });
        return;
    }

    let advisorName = '';
    setAdvisors(prev => prev.map(a => {
      if (a.id === id) {
        advisorName = a.name; // Store original name for toast message
        return { ...a, name: newName.trim() };
      }
      return a;
    }));
     toast({ title: "Success", description: `Advisor '${advisorName}' renamed to '${newName.trim()}'.` });
  };

   // Clear all logged events
   const clearAllLogs = () => {
       if (loggedEvents.length === 0) {
           toast({ variant: "default", title: "Info", description: "There are no time logs to clear." });
           return;
       }
       // Add confirmation dialog here if desired
       setLoggedEvents([]);
       toast({ title: "Success", description: "All time log entries cleared." });
   };

   // Delete a specific time log event
   const deleteLogEntry = (id: string) => {
       const entryExists = loggedEvents.some(event => event.id === id);
       if (!entryExists) {
           toast({ variant: "destructive", title: "Error", description: "Log entry not found." });
           return;
       }
       setLoggedEvents(prevEvents => prevEvents.filter(event => event.id === id));
       toast({ title: "Success", description: "Log entry deleted." });
   };

   // Edit a specific time log event
   const editLogEntry = (updatedEvent: LoggedEvent) => {
       const index = loggedEvents.findIndex(event => event.id === updatedEvent.id);
       if (index === -1) {
           toast({ variant: "destructive", title: "Error", description: "Log entry not found for editing." });
           return;
       }
       setLoggedEvents(prevEvents => {
           const newEvents = [...prevEvents];
           newEvents[index] = updatedEvent;
           return newEvents;
       });
       toast({ title: "Success", description: "Log entry updated." });
   };

    // --- Task Management Functions (Removed) ---


  // Handle active tab state for potential styling or conditional rendering
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // console.log("Active Tab:", value);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
     <div className="min-h-screen bg-background text-foreground">
       <div className="container mx-auto p-4 md:p-8">
          {/* Header Section */}
         <header className="flex justify-between items-center mb-6 pb-4 border-b">
           {/* Replaced h1 content with TempoLogo component */}
           <div className="flex items-center"> {/* Wrapper div for logo */}
              <TempoLogo className="h-8 w-auto" /> {/* Adjust size as needed */}
           </div>
           <ThemeToggle /> {/* Fixed component name */}
         </header>

         {/* Main Content Area with Tabs */}
         <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
           {/* Changed from grid to flex-wrap for better responsiveness */}
           {/* Added margin-bottom to create space */}
           <TabsList className="flex flex-wrap h-auto justify-center gap-2 mb-8 p-1">
             <TabsTrigger value="time-log" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
               <Clock className="mr-2 h-4 w-4" /> Time Log
             </TabsTrigger>
             <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
               <Calendar className="mr-2 h-4 w-4" /> Summary
             </TabsTrigger>
              {/* Added Reports Tab Trigger */}
              <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                 <AreaChart className="mr-2 h-4 w-4" /> Reports
              </TabsTrigger>
             {/* Added Visualizations Tab Trigger */}
             <TabsTrigger value="visualizations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                <AreaChart className="mr-2 h-4 w-4" /> Visualizations
             </TabsTrigger>
             {/* Add Policy Search Tab Trigger */}
             <TabsTrigger value="policy-search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                <FileSearch className="mr-2 h-4 w-4" /> Policy Search
             </TabsTrigger>
             {/* Removed Manage Tasks Tab Trigger */}
             <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
               <Users className="mr-2 h-4 w-4" /> Manage Advisors
             </TabsTrigger>
           </TabsList>

           {/* Tab Content Sections */}
           <TabsContent value="time-log">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-1">
                 {/* Removed tasks prop */}
                 <TimeLogForm
                     advisors={advisors}
                     // Placeholder functions/props for eventToEdit handling
                     // You'll need to manage the state for eventToEdit in the parent component
                     // eventToEdit={null} // Pass actual event or null
                     // onUpdateEvent={async () => {}} // Implement update logic
                     // onCancelEdit={() => {}} // Implement cancel logic
                     onLogEvent={addTimeLog} // Use the existing addTimeLog
                     isSubmitting={false} // Manage submission state if needed
                     onUpdateEvent={async (id, data) => editLogEntry({...data, id })}
                     onCancelEdit={() => {/* Add logic to reset edit state if needed */}}
                     eventToEdit={null} // Pass the actual event to edit here if applicable
                     // isSubmitting={false} // Manage submitting state here
                 />
               </div>
               <div className="lg:col-span-2">
                 <EventList
                    events={loggedEvents}
                    advisors={advisors}
                    // Removed tasks prop
                    onDeleteEvent={async (id) => deleteLogEntry(id)} // Pass delete function
                    onEditEvent={(event) => { /* Add logic to set the eventToEdit state */ }} // Pass edit function
                    deletingId={null} // Pass deleting state if needed
                   />
               </div>
             </div>
           </TabsContent>

           <TabsContent value="summary">
              {/* Updated ExportVisualizationLayout usage */}
              {/* Assuming ExportVisualizationLayout is self-contained or context-driven now */}
              <TimeLogSummary loggedEvents={loggedEvents} advisors={advisors} />
           </TabsContent>

           {/* Reports Tab */}
           <TabsContent value="reports">
               <ReportSection
                  loggedEvents={loggedEvents}
                  advisors={advisors}
                />
           </TabsContent>

           {/* Visualizations Tab */}
           <TabsContent value="visualizations">
               <VisualizationsSection
                   loggedEvents={loggedEvents}
                   advisors={advisors}
               />
            </TabsContent>

           {/* Policy Search Tab */}
           <TabsContent value="policy-search">
               <PolicySearch
                  policyData={policyData}
                  setPolicyData={setPolicyData}
                  fileName={policyFileName}
                  setFileName={setPolicyFileName}
                  isLoading={isPolicyLoading}
                  setIsLoading={setIsPolicyLoading}
                  parseError={policyParseError}
                  setParseError={setPolicyParseError} />
           </TabsContent>

           {/* Removed Manage Tasks Tab Content */}

           <TabsContent value="manage-advisors">
              {/* Removed isAdding/removingId props as they are handled internally now */}
              <AdvisorManager advisors={advisors} onAddAdvisor={addAdvisor} onRemoveAdvisor={removeAdvisor} onEditAdvisor={editAdvisor} />
           </TabsContent>
         </Tabs>
       </div>
     </div>
    </ThemeProvider>
  );
}
