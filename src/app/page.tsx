'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth'; // Renamed User to FirebaseUser to avoid conflict
import { auth, db } from '@/lib/firebase';
import {
  collection,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  writeBatch,
  where,
  getDocs,
} from "firebase/firestore";

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
import { ReportSection } from '@/components/report-section';
import { VisualizationsSection } from '@/components/visualizations-section';
import { PolicySearch } from '@/components/policy-search';
import NextClearedBatch from '@/components/next-cleared-batch';
import { WholeOfMarketSection } from '@/components/whole-of-market-section';
import { LoginForm } from '@/components/auth/login-form';
import { SignUpForm } from '@/components/auth/signup-form';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, AreaChart, FileSearch, FileCheck2, LogOut, Loader2, Building2, ShieldAlert, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


import { Advisor, LoggedEvent, StandardEventType, standardEventTypes, AdvisorPermissions } from '@/types';
import { addAdvisor as addAdvisorService, updateAdvisorPermissions, getDefaultPermissions } from '@/lib/firestoreService';
import { PolicyDataMap } from '@/components/policy-search';
import AgentPage from '@/app/agent/page';

const ADVISORS_COLLECTION = 'advisors';
const EVENTS_COLLECTION = 'loggedEvents';

// Updated ADMIN_USERS_EMAILS list
const ADMIN_USERS_EMAILS = ['lauren.jackson@clark.io', 'james.smith@clark.io', 'daniel.hillman@clark.io', 'danielhillman94@hotmail.co.uk'];

export default function Home() {
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(true);

  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [userPermissions, setUserPermissions] = useState<AdvisorPermissions | null>(null);

  const [activeTab, setActiveTab] = useState('time-log');
  const [eventToEdit, setEventToEdit] = useState<LoggedEvent | null>(null);
  const [isProcessingForm, setIsProcessingForm] = useState<boolean>(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const [policyData, setPolicyData] = useState<PolicyDataMap>(new Map());
  const [policyFileName, setPolicyFileName] = useState<string | null>(null);
  const [isPolicyLoading, setIsPolicyLoading] = useState<boolean>(false);
  const [policyParseError, setPolicyParseError] = useState<string | null>(null);

  // isCurrentUserAdmin now correctly prioritizes fetched permissions, then falls back to email list.
  const isCurrentUserAdmin = userPermissions?.hasTopAccess || (user?.email && ADMIN_USERS_EMAILS.includes(user.email)) || false;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);

      if (currentUser) {
        setIsLoadingPermissions(true);
        try {
          const advisorsQuery = query(collection(db, ADVISORS_COLLECTION), where("firebaseUid", "==", currentUser.uid));
          const advisorDocsSnapshot = await getDocs(advisorsQuery);

          let advisorData: Advisor | null = null;
          if (!advisorDocsSnapshot.empty) {
            advisorData = advisorDocsSnapshot.docs[0].data() as Advisor;
            // Ensure permissions are always an object, defaulting if necessary
            const currentPerms = advisorData.permissions || {};
            setUserPermissions({ ...getDefaultPermissions(), ...currentPerms });
          } else {
            // Fallback if no advisor document found for the UID
            if (currentUser.email && ADMIN_USERS_EMAILS.includes(currentUser.email)) {
              const adminPerms = getDefaultPermissions();
              Object.keys(adminPerms).forEach(key => (adminPerms as any)[key] = true);
              adminPerms.hasTopAccess = true; // Explicitly set for email-based admins
              setUserPermissions(adminPerms);
            } else {
              setUserPermissions(getDefaultPermissions());
            }
          }
        } catch (error) {
          console.error("Error fetching user permissions:", error);
          toast({
            variant: "destructive",
            title: "Permissions Error",
            description: "Could not load user permissions. Applying default access.",
          });
          setUserPermissions(getDefaultPermissions());
        } finally {
          setIsLoadingPermissions(false);
        }
      } else {
        setUser(null);
        setIsLoadingData(false);
        setIsLoadingPermissions(false);
        setUserPermissions(null);
        setAdvisors([]);
        setLoggedEvents([]);
        setEventToEdit(null);
        setPolicyData(new Map());
        setPolicyFileName(null);
      }
    });
    return () => unsubscribeAuth();
  }, [toast]); // toast is stable

  useEffect(() => {
    if (!user || !userPermissions) {
      setAdvisors([]);
      setLoggedEvents([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    let advisorsAttemptedLoad = false;
    let eventsAttemptedLoad = false;

    const trySetLoadingFalse = () => {
      if (advisorsAttemptedLoad && eventsAttemptedLoad) {
        setIsLoadingData(false);
      }
    };

    const advisorsQuery = query(collection(db, ADVISORS_COLLECTION));
    const unsubscribeAdvisors = onSnapshot(advisorsQuery, (querySnapshot) => {
      const advisorsData = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Advisor));
      setAdvisors(advisorsData);
      advisorsAttemptedLoad = true;
      trySetLoadingFalse();
    }, (error) => {
        console.error("Error fetching advisors: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch advisors." });
        advisorsAttemptedLoad = true;
        trySetLoadingFalse();
    });

    // --- LOGGED EVENTS QUERY ---
    let eventsQuery;
    if (userPermissions.canViewAllEvents || isCurrentUserAdmin) {
      eventsQuery = query(collection(db, EVENTS_COLLECTION));
    } else {
      eventsQuery = query(collection(db, EVENTS_COLLECTION), where("userId", "==", user.uid));
    }
    const unsubscribeEvents = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const event: LoggedEvent = {
              id: docSnap.id,
              ...data,
              timestamp: data.timestamp?.toDate().toISOString() ?? new Date().toISOString(),
              date: data.date,
          } as LoggedEvent;

           if (!event.eventType || !standardEventTypes.includes(event.eventType as StandardEventType)) {
            event.eventType = 'Other';
          }
          return event as LoggedEvent & { eventType: StandardEventType };
      });
      setLoggedEvents(eventsData);
      eventsAttemptedLoad = true;
      trySetLoadingFalse();
    }, (error) => {
        console.error("Error fetching logged events: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch time logs." });
        eventsAttemptedLoad = true;
        trySetLoadingFalse();
    });

    return () => {
      unsubscribeAdvisors();
      unsubscribeEvents();
    };
  }, [user, userPermissions, toast]);


  const handleEditEvent = useCallback((event: LoggedEvent) => {
    const canEdit = event.userId === user?.uid || isCurrentUserAdmin;
    if (!canEdit) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot edit this log entry." });
        return;
    }
    if (typeof event.eventType !== 'string' || !standardEventTypes.includes(event.eventType as StandardEventType)) {
        setEventToEdit({ ...event, eventType: 'Other' });
    } else {
         setEventToEdit(event as LoggedEvent & { eventType: StandardEventType });
    }
    setActiveTab('time-log');
    document.getElementById('time-log-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [user, isCurrentUserAdmin, toast]);

  const handleCancelEdit = useCallback(() => {
    setEventToEdit(null);
  }, []);


  const handleDeleteEvent = useCallback(async (id: string) => {
      if (!user) {
          toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
          return;
      }
      const eventToDelete = loggedEvents.find(e => e.id === id);
      const canDelete = eventToDelete?.userId === user.uid || isCurrentUserAdmin;
      if (!canDelete) {
          toast({ variant: "destructive", title: "Permission Denied", description: "You cannot delete this log entry." });
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
  }, [user, loggedEvents, isCurrentUserAdmin, toast]);


  const addTimeLog = useCallback(async (eventData: Omit<LoggedEvent, 'id' | 'timestamp' | 'userId'>) => {
    if (!user || !userPermissions?.canAccessTimeLog) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to log time." });
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
      toast({ title: "Success", description: "Time logged successfully."});
      setEventToEdit(null);
    } catch (error) {
      console.error("Error adding time log: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to log time." });
    } finally {
        setIsProcessingForm(false);
    }
  }, [user, userPermissions, toast]);

  const editLogEntry = useCallback(async (updatedEvent: LoggedEvent) => {
      if (!user) {
          toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
          return;
      }
      const canEdit = updatedEvent.userId === user.uid || isCurrentUserAdmin;
      if (!canEdit) {
          toast({ variant: "destructive", title: "Permission Denied", description: "You cannot edit this log entry." });
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
          toast({ title: "Success", description: "Event updated successfully." });
          setEventToEdit(null);
      } catch (error) {
          console.error("Error editing log entry: ", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to update event." });
      } finally {
          setIsProcessingForm(false);
      }
  }, [user, isCurrentUserAdmin, toast]);


  const addAdvisor = useCallback(async (name: string, email: string) => {
    if (!user || !(userPermissions?.canManageAdvisors || userPermissions?.hasTopAccess)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to add advisors." });
        throw new Error("Permission Denied");
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.endsWith('@clark.io')) {
         toast({ variant: "destructive", title: "Invalid Email", description: "Email must end with @clark.io." });
         throw new Error("Invalid email domain");
    }

    const emailQuery = query(collection(db, ADVISORS_COLLECTION), where("email", "==", trimmedEmail));
    const emailQuerySnapshot = await getDocs(emailQuery);
    if (!emailQuerySnapshot.empty) {
        toast({ variant: "destructive", title: "Duplicate Email", description: "An advisor with this email already exists." });
        throw new Error("Duplicate email");
    }

    const nameQuery = query(collection(db, ADVISORS_COLLECTION), where("name", "==", trimmedName));
    const nameQuerySnapshot = await getDocs(nameQuery);
    if (!nameQuerySnapshot.empty) {
        toast({ variant: "destructive", title: "Duplicate Name", description: "An advisor with this name already exists." });
        throw new Error("Duplicate name");
    }

    try {
        await addAdvisorService({
            name: trimmedName,
            email: trimmedEmail,
            addedByAdminUid: user.uid
        });
        toast({ title: "Success", description: `Advisor '${trimmedName}' added with email '${trimmedEmail}'. They can now sign up.` });
    } catch (error: any) {
        console.error("Error in addAdvisor try block:", error);
        toast({ variant: "destructive", title: "Error Adding Advisor", description: error.message || "Failed to add advisor." });
        throw error;
    }
  }, [user, userPermissions, toast]);

  const removeAdvisor = useCallback(async (id: string) => {
    if (!user || !(userPermissions?.canManageAdvisors || userPermissions?.hasTopAccess)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to remove advisors." });
        throw new Error("Permission Denied");
    }
    const advisorToRemove = advisors.find(a => a.id === id);
    if (!advisorToRemove) {
        toast({ variant: "destructive", title: "Not Found", description: "Advisor not found." });
        throw new Error("Advisor not found");
    }

    if (advisorToRemove.status === 'active' && loggedEvents.some(event => event.advisorId === id)) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: `Cannot remove active advisor '${advisorToRemove.name}' as they have logged time entries. Please reassign or delete the logs first.`,
            duration: 7000,
        });
        throw new Error("Active advisor has logged events");
    }
     if (advisorToRemove.status === 'active' && !loggedEvents.some(event => event.advisorId === id)) {
         console.warn(`Admin ${user.email} is removing active advisor ${advisorToRemove.name} (${advisorToRemove.email}) who has no logged events.`);
     }

    try {
        await deleteDoc(doc(db, ADVISORS_COLLECTION, id));
        toast({ title: "Success", description: `Advisor '${advisorToRemove.name}' removed.` });
    } catch (error) {
        console.error("Error removing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove advisor." });
        throw error;
    }
}, [advisors, loggedEvents, user, userPermissions, toast]);


  const editAdvisor = useCallback(async (id: string, newName: string, newEmail?: string) => {
    if (!user || !(userPermissions?.canManageAdvisors || userPermissions?.hasTopAccess)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to edit advisors."});
        throw new Error("Permission Denied");
    }
    const trimmedNewName = newName.trim();
    const trimmedNewEmail = newEmail?.trim().toLowerCase();

    const originalAdvisor = advisors.find(a => a.id === id);
    if (!originalAdvisor) {
        toast({ variant: "destructive", title: "Not Found", description: "Advisor not found." });
        throw new Error("Advisor not found");
    }

    const updateData: Partial<Pick<Advisor, 'name' | 'email'>> = {};
    if (trimmedNewName !== originalAdvisor.name) {
        const nameQuery = query(collection(db, ADVISORS_COLLECTION), where("name", "==", trimmedNewName), where("id", "!=", id));
        const nameQuerySnapshot = await getDocs(nameQuery);
        if (!nameQuerySnapshot.empty) {
            toast({ variant: "destructive", title: "Duplicate Name", description: `An advisor with the name '${trimmedNewName}' already exists.` });
            throw new Error("Duplicate name");
        }
        updateData.name = trimmedNewName;
    }

    if (trimmedNewEmail && trimmedNewEmail !== originalAdvisor.email) {
        if (originalAdvisor.status === 'active') {
             toast({ variant: "destructive", title: "Update Denied", description: "Email cannot be changed for an active advisor." });
             throw new Error("Cannot change email for active advisor");
        }
        if (!trimmedNewEmail.endsWith('@clark.io')) {
             toast({ variant: "destructive", title: "Invalid Email", description: "Email must end with @clark.io." });
             throw new Error("Invalid email domain");
        }
        const emailQuery = query(collection(db, ADVISORS_COLLECTION), where("email", "==", trimmedNewEmail), where("id", "!=", id));
        const emailQuerySnapshot = await getDocs(emailQuery);
        if (!emailQuerySnapshot.empty) {
            toast({ variant: "destructive", title: "Duplicate Email", description: `An advisor with the email '${trimmedNewEmail}' already exists.` });
            throw new Error("Duplicate email");
        }
        updateData.email = trimmedNewEmail;
    }

    if (Object.keys(updateData).length === 0) {
        toast({ title: "No Changes", description: "No changes detected." });
        return;
    }

    try {
        const advisorRef = doc(db, ADVISORS_COLLECTION, id);
        await updateDoc(advisorRef, updateData);
        let successMessage = "Advisor details updated.";
        if (updateData.name && updateData.email) {
            successMessage = `Advisor '${originalAdvisor.name}' renamed to '${updateData.name}' and email updated to '${updateData.email}'.`;
        } else if (updateData.name) {
            successMessage = `Advisor '${originalAdvisor.name}' renamed to '${updateData.name}'.`;
        } else if (updateData.email) {
             successMessage = `Advisor '${originalAdvisor.name}' email updated to '${updateData.email}'.`;
        }
        toast({ title: "Success", description: successMessage });
    } catch (error) {
        console.error("Error editing advisor: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to update advisor." });
        throw error;
    }
  }, [advisors, user, userPermissions, toast]);

  const handleUpdatePermissions = useCallback(async (advisorId: string, permissionsToUpdate: Partial<AdvisorPermissions>) => {
    if (!user || !(userPermissions?.canManageAdvisors || userPermissions?.hasTopAccess)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to update advisor permissions." });
        throw new Error("Permission Denied");
    }
    try {
        await updateAdvisorPermissions(advisorId, permissionsToUpdate);
         toast({ title: "Permissions Updated", description: "Advisor permissions have been successfully updated."});
    } catch (error: any) {
        console.error("Error updating advisor permissions from page.tsx: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Failed to update advisor permissions.",
        });
        throw error;
    }
  }, [user, userPermissions, toast]);

  const clearAllLogs = useCallback(async () => {
    if (!user || !isCurrentUserAdmin) {
      toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to clear all logs." });
      return;
    }
    if (loggedEvents.length === 0) {
        toast({ variant: "default", title: "Info", description: "There are no time logs to clear." });
        return;
    }

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
  }, [loggedEvents, user, isCurrentUserAdmin, toast]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserPermissions(null);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "An error occurred during logout." });
    }
  };

  if (isLoadingAuth || (user && isLoadingPermissions)) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            {isLoadingAuth ? 'Loading Authentication...' : 'Loading User Permissions...'}
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
                    {showLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
                    </Button>
                </div>
             </div>
        </ThemeProvider>
    );
  }
  if (isLoadingPermissions) { // This check might be redundant due to the combined check above, but safe to keep
      return (
          <div className="flex justify-center items-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              Loading User Permissions...
          </div>
      );
  }


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
                Loading App Data...
            </div>
         ) : (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                 <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap justify-center gap-2 mb-12 p-1 h-auto">
                     {userPermissions?.canAccessTimeLog && (
                        <TabsTrigger value="time-log" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Clock className="mr-2 h-4 w-4" /> Time Log
                        </TabsTrigger>
                     )}
                     {(userPermissions?.canAccessSummary || isCurrentUserAdmin) && (
                        <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Calendar className="mr-2 h-4 w-4" /> Summary
                        </TabsTrigger>
                     )}
                     {(userPermissions?.canAccessReports || isCurrentUserAdmin) && (
                        <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <AreaChart className="mr-2 h-4 w-4" /> Reports
                        </TabsTrigger>
                     )}
                     {(userPermissions?.canAccessVisualisations || isCurrentUserAdmin) && (
                        <TabsTrigger value="visualizations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <AreaChart className="mr-2 h-4 w-4" /> Visualizations
                        </TabsTrigger>
                     )}
                      {userPermissions?.canAccessPolicySearch && (
                        <TabsTrigger value="policy-search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <FileSearch className="mr-2 h-4 w-4" /> Policy Search
                        </TabsTrigger>
                      )}
                      {userPermissions?.canAccessNextClearedBatch && (
                        <TabsTrigger value="next-cleared-batch" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <FileCheck2 className="mr-2 h-4 w-4" /> Next Cleared Batch
                        </TabsTrigger>
                      )}
                      {userPermissions?.canAccessWholeOfMarket && (
                        <TabsTrigger value="whole-of-market" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Building2 className="mr-2 h-4 w-4" /> Whole Of Market
                        </TabsTrigger>
                      )}
                      {userPermissions?.canAccessAgentTools && (
                        <TabsTrigger value="agent" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Brain className="mr-2 h-4 w-4" /> Agent Tools
                        </TabsTrigger>
                      )}
                     {(userPermissions?.canManageAdvisors || isCurrentUserAdmin) && (
                        <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-grow sm:flex-grow-0">
                            <Users className="mr-2 h-4 w-4" /> Manage Advisors
                        </TabsTrigger>
                     )}
                 </TabsList>

                {userPermissions?.canAccessTimeLog ? (
                 <TabsContent value="time-log">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         <div className="lg:col-span-1">
                             <TimeLogForm
                                 advisors={advisors.filter(a => a.status === 'active')}
                                 onLogEvent={addTimeLog}
                                 onUpdateEvent={(eventId, eventData) => {
                                      const fullEventData = { ...eventData, id: eventId };
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
                                 currentUser={user}
                                 currentUserIsAdmin={isCurrentUserAdmin}
                             />
                         </div>
                     </div>
                 </TabsContent>
                ) : (
                    <TabsContent value="time-log">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view Time Logs.</p>
                        </div>
                    </TabsContent>
                )}


                {(userPermissions?.canAccessSummary || isCurrentUserAdmin) ? (
                    <TabsContent value="summary">
                        <TimeLogSummary loggedEvents={loggedEvents} advisors={advisors} />
                    </TabsContent>
                ) : (
                    <TabsContent value="summary">
                        <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view the Summary.</p>
                        </div>
                    </TabsContent>
                )}

                {(userPermissions?.canAccessReports || isCurrentUserAdmin) ? (
                     <TabsContent value="reports">
                         <ReportSection loggedEvents={loggedEvents} advisors={advisors} />
                     </TabsContent>
                ) : (
                    <TabsContent value="reports">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view Reports.</p>
                        </div>
                    </TabsContent>
                )}


                {(userPermissions?.canAccessVisualisations || isCurrentUserAdmin) ? (
                    <TabsContent value="visualizations">
                        <VisualizationsSection loggedEvents={loggedEvents} advisors={advisors} />
                    </TabsContent>
                ) : (
                    <TabsContent value="visualizations">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view Visualizations.</p>
                        </div>
                    </TabsContent>
                )}

                {userPermissions?.canAccessPolicySearch ? (
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
                 ) : (
                    <TabsContent value="policy-search">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to use Policy Search.</p>
                        </div>
                    </TabsContent>
                 )}


                {userPermissions?.canAccessNextClearedBatch ? (
                    <TabsContent value="next-cleared-batch">
                        <NextClearedBatch />
                    </TabsContent>
                ) : (
                     <TabsContent value="next-cleared-batch">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to use Next Cleared Batch.</p>
                        </div>
                    </TabsContent>
                )}


                {userPermissions?.canAccessWholeOfMarket ? (
                    <TabsContent value="whole-of-market">
                        <WholeOfMarketSection />
                    </TabsContent>
                 ) : (
                    <TabsContent value="whole-of-market">
                         <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to view Whole of Market.</p>
                        </div>
                    </TabsContent>
                 )}

                {userPermissions?.canAccessAgentTools ? (
                    <TabsContent value="agent">
                        <AgentPage />
                    </TabsContent>
                 ) : (
                    <TabsContent value="agent">
                        <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to use Agent Tools.</p>
                        </div>
                    </TabsContent>
                 )}


                {(userPermissions?.canManageAdvisors || isCurrentUserAdmin) ? (
                     <TabsContent value="manage-advisors">
                         <AdvisorManager
                             advisors={advisors}
                             onAddAdvisor={addAdvisor}
                             onRemoveAdvisor={removeAdvisor}
                             onEditAdvisor={editAdvisor}
                             onUpdateAdvisorPermissions={handleUpdatePermissions}
                         />
                     </TabsContent>
                 ) : (
                    <TabsContent value="manage-advisors">
                        <div className="flex flex-col items-center justify-center p-8 border rounded-md">
                            <ShieldAlert className="h-12 w-12 text-yellow-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
                            <p className="text-muted-foreground">You do not have permission to Manage Advisors.</p>
                        </div>
                    </TabsContent>
                 )}
             </Tabs>
         )}
       </div>
     </div>
    </ThemeProvider>
  );
}

    