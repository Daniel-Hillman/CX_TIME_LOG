
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
import NextClearedBatch from '@/components/next-cleared-batch';
import { WholeOfMarketSection } from '@/components/whole-of-market-section'; // Import new section
import { LoginForm } from '@/components/auth/login-form';
import { SignUpForm } from '@/components/auth/signup-form';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, AreaChart, FileSearch, FileCheck2, LogOut, Loader2, Building2, ShieldAlert } from 'lucide-react'; // Added Building2 and ShieldAlert

// Types
import { Advisor, LoggedEvent, StandardEventType, standardEventTypes } from '@/types';
import { PolicyDataMap } from '@/components/policy-search';

// --- Constants for Firestore Collection Names ---
const ADVISORS_COLLECTION = 'advisors';
const EVENTS_COLLECTION = 'loggedEvents';

const ADMIN_USERS = ['lauren.jackson@clark.io', 'james.smith@clark.io', 'danielhillman94@hotmail.co.uk'];

export default function Home() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(true);

  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('time-log');
  const [eventToEdit, setEventToEdit] = useState<LoggedEvent | null>(null);
  const [isProcessingForm, setIsProcessingForm] = useState<boolean>(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const [policyData, setPolicyData] = useState<PolicyDataMap>(new Map());
  const [policyFileName, setPolicyFileName] = useState<string | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState<boolean>(false);
  const [policyParseError, setPolicyParseError] = useState<string | null>(null);

  const currentUserEmail = user?.email || '';
  const isCurrentUserAdmin = ADMIN_USERS.includes(currentUserEmail);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      if (!currentUser) {
          setIsLoadingData(false);
          setAdvisors([]);
          setLoggedEvents([]);
          setEventToEdit(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsLoadingData(false);
      return;
    }

    console.log("User logged in, fetching Firestore data...");
    setIsLoadingData(true);

    const advisorsQuery = query(collection(db, ADVISORS_COLLECTION));
    const unsubscribeAdvisors = onSnapshot(advisorsQuery, (querySnapshot) => {
      const advisorsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advisor));
      setAdvisors(advisorsData);
      console.log("Advisors fetched: ", advisorsData.length);
    }, (error) => {
        console.error("Error fetching advisors: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch advisors." });
        setIsLoadingData(false);
    });

    const eventsQuery = query(collection(db, EVENTS_COLLECTION));
    const unsubscribeEvents = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const event: LoggedEvent = {
              id: doc.id,
              ...data,
              timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
              date: data.date,
          } as LoggedEvent; // Initial cast

           // Validate eventType before setting state
           if (!event.eventType || !standardEventTypes.includes(event.eventType as StandardEventType)) {
            console.warn('Event with id ' + event.id + ' has invalid eventType: ' + event.eventType + '. Setting to "Other".');
            event.eventType = 'Other';
          }
          return event as LoggedEvent & { eventType: StandardEventType }; // Assert after validation
      });
      setLoggedEvents(eventsData);
      setIsLoadingData(false);
      console.log("Events fetched: ", eventsData.length);
    }, (error) => {
        console.error("Error fetching logged events: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch time logs." });
        setIsLoadingData(false);
    });

    return () => {
      console.log("Cleaning up Firestore listeners.");
      unsubscribeAdvisors();
      unsubscribeEvents();
    };
  }, [user, toast]);


  const handleEditEvent = useCallback((event: LoggedEvent) => {
    if (typeof event.eventType !== 'string' || !standardEventTypes.includes(event.eventType as StandardEventType)) {
        console.warn('Attempting to edit event with non-standard type: ' + event.eventType + '. Treating as "Other".');
        setEventToEdit({ ...event, eventType: 'Other' });
    } else {
         setEventToEdit(event as LoggedEvent & { eventType: StandardEventType });
    }
    setActiveTab('time-log');
    document.getElementById('time-log-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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


  const addTimeLog = useCallback(async (eventData: Omit<LoggedEvent, 'id' | 'timestamp' | 'userId'>) => {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to add logs." });
        return;
    }
    setIsProcessingForm(true);
    try {
      const newEvent = {
        ...eventData,
        userId: user.uid, 
        timestamp: Timestamp.fromDate(new Date()),
      };
      await addDoc(collection(db, EVENTS_COLLECTION), newEvent);
    } catch (error) {
      console.error("Error adding time log: ", error);
    } finally {
        setIsProcessingForm(false);
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
      setIsProcessingForm(true);
      try {
          const eventRef = doc(db, EVENTS_COLLECTION, updatedEvent.id);
          const dataToUpdate: Partial<Omit<LoggedEvent, 'id'>> = {
              advisorId: updatedEvent.advisorId,
              date: updatedEvent.date,
              eventType: updatedEvent.eventType,
              eventDetails: updatedEvent.eventDetails,
              loggedTime: updatedEvent.loggedTime,
              timestamp: Timestamp.fromDate(new Date()),
          };

          Object.keys(dataToUpdate).forEach(key => {
              const typedKey = key as keyof typeof dataToUpdate;
              if (dataToUpdate[typedKey] === undefined) {
                  delete dataToUpdate[typedKey];
              }
          });

          if (dataToUpdate.eventType !== 'Other' && dataToUpdate.hasOwnProperty('eventDetails')) {
              dataToUpdate.eventDetails = null;
          }

          await updateDoc(eventRef, dataToUpdate);
          setEventToEdit(null);
      } catch (error) {
          console.error("Error editing log entry: ", error);
      } finally {
          setIsProcessingForm(false);
      }
  }, [user, toast]);


  const addAdvisor = useCallback(async (name: string) => {
    if (!user) {
        return;
    }
    if (!isCurrentUserAdmin) {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You do not have permission to add users.",
        });
        throw new Error("Permission Denied");
    }
    const trimmedName = name.trim();
    try {
        const newAdvisor = { name: trimmedName, userId: user.uid }; 
        await addDoc(collection(db, ADVISORS_COLLECTION), newAdvisor);
        toast({ title: "Success", description: "Advisor '" + trimmedName + "' added." });
    } catch (error) {
        console.error("Error adding advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to add advisor." });
        throw error;
    }
  }, [user, toast, isCurrentUserAdmin]);

  const removeAdvisor = useCallback(async (id: string) => {
    if (!user) {
      return;
    }
    if (!isCurrentUserAdmin) {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You do not have permission to delete users.",
        });
        throw new Error("Permission Denied"); 
    }

    const advisorToRemove = advisors.find(a => a.id === id);

    if (loggedEvents.some(event => event.advisorId === id)) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Cannot delete advisor '" + (advisorToRemove?.name || 'this advisor') + "' as they have logged time entries. Please reassign or delete the logs first.",
            duration: 7000,
        });
        throw new Error("Advisor has logged events");
    }

    try {
        await deleteDoc(doc(db, ADVISORS_COLLECTION, id));
        toast({ title: "Success", description: "Advisor '" + (advisorToRemove?.name || 'Advisor') + "' removed." });
    } catch (error) {
        console.error("Error removing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove advisor." });
        throw error;
    }
}, [advisors, loggedEvents, user, toast, isCurrentUserAdmin]);


  const editAdvisor = useCallback(async (id: string, newName: string) => {
    if (!user) {
      return;
    }
    if (!isCurrentUserAdmin) {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You do not have permission to edit users.",
        });
        throw new Error("Permission Denied");
    }
    const trimmedNewName = newName.trim();
    const originalAdvisor = advisors.find(a => a.id === id);

    try {
        const advisorRef = doc(db, ADVISORS_COLLECTION, id);
        await updateDoc(advisorRef, { name: trimmedNewName });
        toast({ title: "Success", description: "Advisor '" + (originalAdvisor?.name || 'Advisor') + "' renamed to '" + trimmedNewName + "'." });
    } catch (error) {
        console.error("Error editing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to rename advisor." });
        throw error;
    }
}, [advisors, user, toast, isCurrentUserAdmin]);

  const clearAllLogs = useCallback(async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }
    if (!isCurrentUserAdmin) {
        toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "You do not have permission to clear all logs.",
        });
        return;
    }
    if (loggedEvents.length === 0) {
        toast({ variant: "default", title: "Info", description: "There are no time logs to clear." });
        return;
    }
    console.warn("User " + user.email + " (Admin: " + isCurrentUserAdmin + ") initiated Clear All Logs. Deleting " + loggedEvents.length + " entries...");
    try {
        const batch = writeBatch(db);
        loggedEvents.forEach(event => {
            const eventRef = doc(db, EVENTS_COLLECTION, event.id);
            batch.delete(eventRef);
        });
        await batch.commit();
        toast({ title: "Success", description: "All time log entries cleared." });
    } catch (error) {
        console.error("Error clearing all logs: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to clear all time logs." });
    }
  }, [loggedEvents, user, toast, isCurrentUserAdmin]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      setLoggedEvents([]);
      setAdvisors([]);
      setEventToEdit(null);
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred during logout." });
    }
  };


  if (isLoadingAuth) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            Loading Authentication...
        </div>
    );
  }

  if (!user) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
             <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
                 <header className="flex justify-center items-center relative mb-8 pb-4 border-b w-full max-w-4xl">
                    <div className="text-5xl font-designer font-bold text-blue-500">
                       Tempo
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

  const ManageAdvisorsTrigger = isCurrentUserAdmin ? (
    <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
        <Users className="mr-2 h-4 w-4" /> Manage Advisors
    </TabsTrigger>
  ) : null;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
     <div className="min-h-screen bg-background text-foreground">
       <div className="container mx-auto p-4 md:p-8">

         <header className="flex justify-center items-center relative mb-8 pb-4 border-b">
            <div className="text-5xl font-designer font-bold text-blue-500">
                Tempo
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
                 <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap justify-center gap-2 mb-12 p-1 h-auto">
                     <TabsTrigger value="time-log" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <Clock className="mr-2 h-4 w-4" /> Time Log
                     </TabsTrigger>
                     {isCurrentUserAdmin ? (
                        <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Calendar className="mr-2 h-4 w-4" /> Summary
                        </TabsTrigger>
                     ) : null}
                     <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <AreaChart className="mr-2 h-4 w-4" /> Reports
                     </TabsTrigger>
                     {isCurrentUserAdmin ? (
                        <TabsTrigger value="visualizations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <AreaChart className="mr-2 h-4 w-4" /> Visualizations
                        </TabsTrigger>
                     ) : null}
                     <TabsTrigger value="policy-search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <FileSearch className="mr-2 h-4 w-4" /> Policy Search
                     </TabsTrigger>
                     <TabsTrigger value="next-cleared-batch" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <FileCheck2 className="mr-2 h-4 w-4" /> Next Cleared Batch
                     </TabsTrigger>
                     <TabsTrigger value="whole-of-market" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                         <Building2 className="mr-2 h-4 w-4" /> Whole Of Market
                     </TabsTrigger>
                     {ManageAdvisorsTrigger}
                 </TabsList>

                 <TabsContent value="time-log">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         <div className="lg:col-span-1">
                             <TimeLogForm
                                 advisors={advisors}
                                 onLogEvent={addTimeLog}
                                 onUpdateEvent={(eventId, eventData) => {
                                      const fullEventData = { ...eventData, id: eventId };
                                      editLogEntry(fullEventData as LoggedEvent & { eventType: StandardEventType });
                                  }}
                                 onCancelEdit={handleCancelEdit}
                                 eventToEdit={eventToEdit}
                                 isSubmitting={isProcessingForm}
                                 currentUserIsAdmin={isCurrentUserAdmin} 
                             />
                         </div>
                         <div className="lg:col-span-2">
                             <EventList
                                 events={loggedEvents}
                                 advisors={advisors}
                                 onDeleteEvent={handleDeleteEvent}
                                 onEditEvent={handleEditEvent}
                                 deletingId={deletingEventId}
                                 currentUser={user} 
                                 currentUserIsAdmin={isCurrentUserAdmin} 
                             />
                         </div>
                     </div>
                 </TabsContent>

                {isCurrentUserAdmin ? (
                    <TabsContent value="summary">
                        <TimeLogSummary loggedEvents={loggedEvents} advisors={advisors} />
                    </TabsContent>
                ) : (
                    <TabsContent value="summary">
                        <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view this section.</p>
                        </div>
                    </TabsContent>
                )}

                 <TabsContent value="reports">
                     <ReportSection loggedEvents={loggedEvents} advisors={advisors} currentUserIsAdmin={isCurrentUserAdmin} />
                 </TabsContent>

                {isCurrentUserAdmin ? (
                    <TabsContent value="visualizations">
                        <VisualizationsSection loggedEvents={loggedEvents} advisors={advisors} />
                    </TabsContent>
                ) : (
                    <TabsContent value="visualizations">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view this section.</p>
                        </div>
                    </TabsContent>
                )}

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

                <TabsContent value="whole-of-market">
                    <WholeOfMarketSection />
                </TabsContent>

                {isCurrentUserAdmin && (
                     <TabsContent value="manage-advisors">
                         <AdvisorManager
                             advisors={advisors}
                             onAddAdvisor={addAdvisor}
                             onRemoveAdvisor={removeAdvisor}
                             onEditAdvisor={editAdvisor}
                             currentUserIsAdmin={isCurrentUserAdmin}
                         />
                     </TabsContent>
                )}
             </Tabs>
         )}
       </div>
     </div>
    </ThemeProvider>
  );
}
