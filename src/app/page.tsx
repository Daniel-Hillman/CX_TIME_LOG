

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Import db for Firestore
import {
  collection, // Function to get a collection reference
  query, // Function to create a query
  // where, // We are fetching all data, so where clause isn't needed *yet*
  addDoc, // Function to add a new document
  updateDoc, // Function to update an existing document
  deleteDoc, // Function to delete a document
  doc, // Function to get a document reference
  onSnapshot, // Function for real-time updates
  Timestamp, // Firestore Timestamp type
  writeBatch // Function for atomic batch writes
} from "firebase/firestore";

// UI Components
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdvisorManager } from '@/components/advisor-manager';
import { EventList } from '@/components/event-list';
import { TimeLogForm } from '@/components/time-log-form';
import { TimeLogSummary } from '@/components/time-log-summary';
// import { ExportVisualizationLayout } from '@/components/export-visualization-layout'; // Not currently used
import { ReportSection } from '@/components/report-section';
import { VisualizationsSection } from '@/components/visualizations-section';
import { PolicySearch } from '@/components/policy-search';
import NextClearedBatch from '@/components/next-cleared-batch'; // <-- Import the new component
import { LoginForm } from '@/components/auth/login-form';
import { SignUpForm } from '@/components/auth/signup-form';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, AreaChart, FileSearch, FileCheck2, LogOut, Loader2 } from 'lucide-react'; // Added FileCheck2 & Loader2
import Image from 'next/image'; // Import NextImage

// Types
import { Advisor, LoggedEvent, StandardEventType } from '@/types';
import { PolicyDataMap } from '@/components/policy-search';

// --- Constants for Firestore Collection Names ---
const ADVISORS_COLLECTION = 'advisors';
const EVENTS_COLLECTION = 'loggedEvents';

export default function Home() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(true); // Toggle between Login and Sign Up

  // State for data (fetched from Firestore)
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true); // Separate loading state for data

  // UI State
  const [activeTab, setActiveTab] = useState('time-log');
  const [eventToEdit, setEventToEdit] = useState<LoggedEvent | null>(null);
  const [isProcessingForm, setIsProcessingForm] = useState<boolean>(false); // For TimeLogForm submission/update
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null); // For EventList delete button

  // Policy Search State (remains client-side)
  const [policyData, setPolicyData] = useState<PolicyDataMap>(new Map());
  const [policyFileName, setPolicyFileName] = useState<string | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState<boolean>(false);
  const [policyParseError, setPolicyParseError] = useState<string | null>(null);

  // --- Authentication Effect ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      if (!currentUser) {
          // If user logs out, immediately set data loading to false and clear data
          setIsLoadingData(false);
          setAdvisors([]);
          setLoggedEvents([]);
          setEventToEdit(null); // Clear edit state on logout
      }
      // Don't reset isLoadingData to true here, let the data fetching effect handle it
    });
    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // --- Firestore Data Fetching Effect ---
  useEffect(() => {
    // Only run if a user is logged in
    if (!user) {
      setIsLoadingData(false); // Ensure loading is false if no user
      return;
    }

    console.log("User logged in, fetching Firestore data...");
    setIsLoadingData(true); // Start loading data

    // Fetch Advisors
    const advisorsQuery = query(collection(db, ADVISORS_COLLECTION));
    const unsubscribeAdvisors = onSnapshot(advisorsQuery, (querySnapshot) => {
      const advisorsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advisor));
      setAdvisors(advisorsData);
      // Don't set loading false until both subscriptions are active and initial data is potentially received
      console.log("Advisors fetched: ", advisorsData.length);
    }, (error) => {
        console.error("Error fetching advisors: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch advisors." });
        setIsLoadingData(false); // Set loading false on error
    });

    // Fetch Logged Events
    const eventsQuery = query(collection(db, EVENTS_COLLECTION));
    const unsubscribeEvents = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const event = {
              id: doc.id,
              ...data,
              // Convert Firestore Timestamp to ISO String for components
              timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
              // Convert Firestore date string (YYYY-MM-DD) if needed, assume it's stored correctly
              date: data.date,
          } as LoggedEvent;

           // Validate eventType before setting state
           if (!event.eventType) {
            console.warn(`Event with id ${event.id} has missing eventType. Setting to 'Other'.`);
            event.eventType = 'Other'; // Assign a default or handle as needed
          }
          // Further type assertion if necessary, after validation/defaulting
          return event as LoggedEvent & { eventType: StandardEventType };

      });
      setLoggedEvents(eventsData);
      setIsLoadingData(false); // Data is ready after events arrive
      console.log("Events fetched: ", eventsData.length);
    }, (error) => {
        console.error("Error fetching logged events: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch time logs." });
        setIsLoadingData(false); // Set loading false on error
    });

    // Cleanup Firestore subscriptions
    return () => {
      console.log("Cleaning up Firestore listeners.");
      unsubscribeAdvisors();
      unsubscribeEvents();
    };
  }, [user, toast]); // Re-run when user changes


  // --- Event Handlers ---

  const handleEditEvent = useCallback((event: LoggedEvent) => {
    // Type assertion/check: Ensure eventType is StandardEventType or handle appropriately
    if (typeof event.eventType !== 'string' || !standardEventTypes.includes(event.eventType as StandardEventType)) {
        console.warn(`Attempting to edit event with non-standard type: ${event.eventType}. Treating as 'Other'.`);
        // Optionally modify the event object before setting state, or handle in TimeLogForm
        // event.eventType = 'Other'; // Example: force to 'Other' if invalid
        setEventToEdit({ ...event, eventType: 'Other' });
    } else {
         setEventToEdit(event as LoggedEvent & { eventType: StandardEventType }); // Assert type if valid
    }
    setActiveTab('time-log'); // Switch to the time log tab to show the form
    // Optionally scroll form into view
    // document.getElementById('time-log-form-card')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEventToEdit(null);
  }, []);

  const handleDeleteEvent = useCallback(async (id: string) => {
      if (!user) {
          toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
          return;
      }
      setDeletingEventId(id);
      try {
          await deleteDoc(doc(db, EVENTS_COLLECTION, id));
          toast({ title: "Success", description: "Log entry deleted." });
      } catch (error) {
          console.error("Error deleting log entry: ", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to delete log entry." });
      } finally {
          setDeletingEventId(null);
      }
  }, [user, toast]);


  // --- Firestore Data Modification Functions (Including userId) ---

  const addTimeLog = useCallback(async (eventData: Omit<LoggedEvent, 'id' | 'timestamp' | 'userId'>) => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to add logs." });
        return;
    }
    setIsProcessingForm(true); // Start loading
    try {
      const newEvent = {
        ...eventData,
        userId: user.uid, // Add the current user's ID
        timestamp: Timestamp.fromDate(new Date()), // Use Firestore Timestamp
      };
      const docRef = await addDoc(collection(db, EVENTS_COLLECTION), newEvent);
      console.log("Time log added with ID: ", docRef.id);
      toast({ title: "Success", description: "Time log entry added." });
    } catch (error) {
      console.error("Error adding time log: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add time log entry." });
    } finally {
        setIsProcessingForm(false); // Stop loading
    }
  }, [user, toast]);

  const editLogEntry = useCallback(async (updatedEvent: LoggedEvent) => {
      if (!user) {
          toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
          return;
      }
      if (!updatedEvent.id) {
          toast({ variant: "destructive", title: "Error", description: "Cannot update event without an ID." });
          return;
      }
      setIsProcessingForm(true); // Start loading
      try {
          const eventRef = doc(db, EVENTS_COLLECTION, updatedEvent.id);
          // Prepare data, ensure userId isn't accidentally overwritten if included in updatedEvent
          // Use Partial to only update fields present
          const dataToUpdate: Partial<Omit<LoggedEvent, 'id'>> = {
              advisorId: updatedEvent.advisorId,
              date: updatedEvent.date,
              eventType: updatedEvent.eventType,
              eventDetails: updatedEvent.eventDetails,
              loggedTime: updatedEvent.loggedTime,
              // Convert timestamp back to Firestore Timestamp - ONLY if it changed significantly
              // Assuming timestamp tracks the *last modified time*, so update it
              timestamp: Timestamp.fromDate(new Date()),
              // userId should generally not be changed
          };

           // Remove undefined fields to avoid overwriting with undefined in Firestore
           // Type assertion needed here because TypeScript can't infer the keys perfectly
          Object.keys(dataToUpdate).forEach(key => {
              const typedKey = key as keyof typeof dataToUpdate;
              if (dataToUpdate[typedKey] === undefined) {
                  delete dataToUpdate[typedKey];
              }
          });

          // Ensure eventDetails is explicitly set to null or removed if eventType is not 'Other'
          if (dataToUpdate.eventType !== 'Other' && dataToUpdate.hasOwnProperty('eventDetails')) {
              dataToUpdate.eventDetails = null; // Or use delete if Firestore handles field removal
          }


          await updateDoc(eventRef, dataToUpdate);
          toast({ title: "Success", description: "Log entry updated." });
          setEventToEdit(null); // Clear edit state on successful update
      } catch (error) {
          console.error("Error editing log entry: ", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to update log entry." });
      } finally {
          setIsProcessingForm(false); // Stop loading
      }
  }, [user, toast]);


  const addAdvisor = useCallback(async (name: string) => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to manage advisors." });
        return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
        toast({ variant: "destructive", title: "Error", description: "Advisor name cannot be empty." });
        return;
    }
    if (advisors.some(a => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ variant: "destructive", title: "Error", description: `Advisor '${trimmedName}' already exists.` });
      return;
    }
    try {
        const newAdvisor = {
            name: trimmedName,
            userId: user.uid // Add the current user's ID
        };
        const docRef = await addDoc(collection(db, ADVISORS_COLLECTION), newAdvisor);
        console.log("Advisor added with ID: ", docRef.id);
        toast({ title: "Success", description: `Advisor '${trimmedName}' added.` });
    } catch (error) {
        console.error("Error adding advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to add advisor." });
    }
  }, [advisors, user, toast]);

  // --- Other Firestore Functions (removeAdvisor, editAdvisor, etc.) ---
  // (Keep existing logic, ensuring user check is present)

    const removeAdvisor = useCallback(async (id: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to manage advisors." });
      return;
    }
    const advisorToRemove = advisors.find(a => a.id === id);
    if (!advisorToRemove) {
      toast({ variant: "warning", title: "Not Found", description: `Advisor not found.` });
      return;
    }

    if (loggedEvents.some(event => event.advisorId === id)) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: `Cannot delete advisor '${advisorToRemove.name}' as they have logged time entries. Please reassign or delete the logs first.`,
            duration: 5000,
        });
        return;
    }

    try {
        await deleteDoc(doc(db, ADVISORS_COLLECTION, id));
        toast({ title: "Success", description: `Advisor '${advisorToRemove.name}' removed.` });
    } catch (error) {
        console.error("Error removing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove advisor." });
    }
}, [advisors, loggedEvents, user, toast]);


  const editAdvisor = useCallback(async (id: string, newName: string) => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to manage advisors." });
      return;
    }
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      toast({ variant: "destructive", title: "Error", description: "Advisor name cannot be empty." });
      return;
    }
    const originalAdvisor = advisors.find(a => a.id === id);
    if (!originalAdvisor) {
         toast({ variant: "warning", title: "Not Found", description: `Advisor not found.` });
         return;
    }

    if (advisors.some(a => a.id !== id && a.name.toLowerCase() === trimmedNewName.toLowerCase())) {
      toast({ variant: "destructive", title: "Error", description: `Advisor name '${trimmedNewName}' already exists.` });
      return;
    }

    try {
        const advisorRef = doc(db, ADVISORS_COLLECTION, id);
        // Only update the name, leave userId untouched
        await updateDoc(advisorRef, { name: trimmedNewName });
        toast({ title: "Success", description: `Advisor '${originalAdvisor.name}' renamed to '${trimmedNewName}'.` });
    } catch (error) {
        console.error("Error editing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to rename advisor." });
    }
}, [advisors, user, toast]);

  const clearAllLogs = useCallback(async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    if (loggedEvents.length === 0) {
        toast({ variant: "default", title: "Info", description: "There are no time logs to clear." });
        return;
    }
    // TODO: Implement confirmation dialog before proceeding
    console.warn(`User ${user.email} initiated Clear All Logs. Deleting ${loggedEvents.length} entries...`);
    try {
        const batch = writeBatch(db);
        loggedEvents.forEach(event => {
            const eventRef = doc(db, EVENTS_COLLECTION, event.id);
            batch.delete(eventRef);
        });
        await batch.commit();
        console.log("Batch delete successful.");
        toast({ title: "Success", description: "All time log entries cleared." });
    } catch (error) {
        console.error("Error clearing all logs: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to clear all time logs." });
    }
  }, [loggedEvents, user, toast]);

  // --- Logout Handler ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // No need to clear state here, useEffect[user] handles it.
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred during logout." });
    }
  };

  // --- Render Logic ---

  // Initial Auth Loading Screen
  if (isLoadingAuth) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            Loading Authentication...
        </div>
    );
  }

  // Logged Out View: Show Login/Sign Up forms
  if (!user) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
             <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
                 <header className="flex justify-center items-center relative mb-8 pb-4 border-b w-full max-w-4xl">
                    {/* Logo */}
                    <div className="w-48 h-16 relative" data-ai-hint="logo company">
                         <Image
                            // src="/Tempo_logo_transparent.png" // Assuming it's in /public
                            src="https://picsum.photos/192/64" // Placeholder if logo is not in /public
                            alt="Tempo Logo"
                            fill // Use fill and let the parent div control size
                            style={{ objectFit: 'contain' }} // Ensures the logo fits without distortion
                            priority // Prioritize loading the logo
                            // Remove width/height when using fill
                            // width={192}
                            // height={64}
                         />
                    </div>
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                        <ThemeToggle />
                    </div>
                </header>
                <div className="flex flex-col items-center space-y-4 w-full">
                    {showLogin ? <LoginForm /> : <SignUpForm />}
                    <Button variant="link" onClick={() => setShowLogin(!showLogin)}>
                    {showLogin ? "Need an account? Sign Up (@clark.io only)" : "Already have an account? Login"}
                    </Button>
                </div>
             </div>
        </ThemeProvider>
    );
  }

  // Logged In View: Show main application
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
     <div className="min-h-screen bg-background text-foreground">
       <div className="container mx-auto p-4 md:p-8">

         <header className="flex justify-center items-center relative mb-8 pb-4 border-b">
             <div className="w-48 h-16 relative" data-ai-hint="logo company">
                <Image
                    // src="/Tempo_logo_transparent.png" // Assuming it's in /public
                    src="https://picsum.photos/192/64" // Placeholder if logo is not in /public
                    alt="Tempo Logo"
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                 />
            </div>
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                {user.email && <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>}
                <ThemeToggle />
                <Button variant="outline" size="icon" onClick={handleLogout} title="Logout">
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
         </header>

         {isLoadingData ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading Data...
            </div>
         ) : (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                 <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap h-auto justify-center gap-2 mb-8 p-1">
                     <TabsTrigger value="time-log" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                     <Clock className="mr-2 h-4 w-4" /> Time Log
                     </TabsTrigger>
                     <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                     <Calendar className="mr-2 h-4 w-4" /> Summary
                     </TabsTrigger>
                     <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <AreaChart className="mr-2 h-4 w-4" /> Reports
                     </TabsTrigger>
                     <TabsTrigger value="visualizations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <AreaChart className="mr-2 h-4 w-4" /> Visualizations
                     </TabsTrigger>
                     <TabsTrigger value="policy-search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <FileSearch className="mr-2 h-4 w-4" /> Policy Search
                     </TabsTrigger>
                     <TabsTrigger value="next-cleared-batch" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <FileCheck2 className="mr-2 h-4 w-4" /> Next Cleared Batch
                     </TabsTrigger>
                     <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                     <Users className="mr-2 h-4 w-4" /> Manage Advisors
                     </TabsTrigger>
                 </TabsList>

                 <TabsContent value="time-log">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         <div className="lg:col-span-1">
                             <TimeLogForm
                                 advisors={advisors}
                                 onLogEvent={addTimeLog}
                                 onUpdateEvent={(eventId, eventData) => {
                                      // Ensure eventData includes the id for editLogEntry
                                      const fullEventData = { ...eventData, id: eventId };
                                      // Type assertion: Assume eventData has StandardEventType after form validation
                                      editLogEntry(fullEventData as LoggedEvent & { eventType: StandardEventType });
                                  }}
                                 onCancelEdit={handleCancelEdit}
                                 eventToEdit={eventToEdit}
                                 isSubmitting={isProcessingForm}
                             />
                         </div>
                         <div className="lg:col-span-2">
                             <EventList
                                 events={loggedEvents}
                                 advisors={advisors}
                                 onDeleteEvent={handleDeleteEvent}
                                 onEditEvent={handleEditEvent}
                                 deletingId={deletingEventId}
                             />
                         </div>
                     </div>
                 </TabsContent>

                 <TabsContent value="summary">
                     <TimeLogSummary loggedEvents={loggedEvents} advisors={advisors} />
                 </TabsContent>

                 <TabsContent value="reports">
                     <ReportSection loggedEvents={loggedEvents} advisors={advisors} />
                 </TabsContent>

                 <TabsContent value="visualizations">
                     <VisualizationsSection loggedEvents={loggedEvents} advisors={advisors} />
                 </TabsContent>

                 <TabsContent value="policy-search">
                     <PolicySearch
                         policyData={policyData}
                         setPolicyData={setPolicyData}
                         fileName={policyFileName}
                         setFileName={setPolicyFileName}
                         isLoading={isPolicyLoading}
                         setIsLoading={setIsPolicyLoading}
                         parseError={policyParseError}
                         setParseError={setPolicyParseError}
                     />
                 </TabsContent>

                <TabsContent value="next-cleared-batch">
                    <NextClearedBatch />
                </TabsContent>

                 <TabsContent value="manage-advisors">
                     <AdvisorManager
                         advisors={advisors}
                         onAddAdvisor={addAdvisor}
                         onRemoveAdvisor={removeAdvisor}
                         onEditAdvisor={editAdvisor}
                     />
                 </TabsContent>
             </Tabs>
         )}
       </div>
     </div>
    </ThemeProvider>
  );
}
