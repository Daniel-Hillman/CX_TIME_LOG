'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Calendar, Clock, Users, AreaChart, FileSearch, FileCheck2, LogOut, Loader2, Building2, ShieldAlert, Brain, ChevronLeft, ChevronRight, Home as HomeIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

import { Advisor, LoggedEvent, StandardEventType, standardEventTypes, AdvisorPermissions } from '@/types';
import { addAdvisor as addAdvisorService, updateAdvisorPermissions, getDefaultPermissions, updateAdvisorRole, dismissAdminDayFlag } from '@/lib/firestoreService';
import { PolicyDataMap } from '@/components/policy-search';
import AgentPage from '@/app/agent/page';
import { updateAllAdvisorsMeetingHours } from '@/lib/adminDayUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const currentAdvisor = advisors.find(a => a.firebaseUid === user?.uid);
  const currentAdvisorId = currentAdvisor?.id || '';

  // Find if current user is eligible for Admin Day
  const isEligibleForAdminDay = currentAdvisor?.admin_day_earned;

  // Add state for self-admin-day dialog
  const [showAdminDayDialog, setShowAdminDayDialog] = useState(false);
  const [isTakingAdminDay, setIsTakingAdminDay] = useState(false);

  const isMobile = useIsMobile();
  const tabOptions = ([
    userPermissions?.canAccessTimeLog ? { value: 'time-log', label: 'Time Log', icon: <Clock className="mr-2 h-4 w-4" /> } : undefined,
    (userPermissions?.canAccessSummary || isCurrentUserAdmin) ? { value: 'summary', label: 'Summary', icon: <Calendar className="mr-2 h-4 w-4" /> } : undefined,
    (userPermissions?.canAccessReports || isCurrentUserAdmin) ? { value: 'reports', label: 'Reports', icon: <AreaChart className="mr-2 h-4 w-4" /> } : undefined,
    (userPermissions?.canAccessVisualisations || isCurrentUserAdmin) ? { value: 'visualizations', label: 'Visualizations', icon: <AreaChart className="mr-2 h-4 w-4" /> } : undefined,
    userPermissions?.canAccessPolicySearch ? { value: 'policy-search', label: 'Policy Search', icon: <FileSearch className="mr-2 h-4 w-4" /> } : undefined,
    userPermissions?.canAccessNextClearedBatch ? { value: 'next-cleared-batch', label: 'Next Cleared Batch', icon: <FileCheck2 className="mr-2 h-4 w-4" /> } : undefined,
    userPermissions?.canAccessWholeOfMarket ? { value: 'whole-of-market', label: 'Whole Of Market', icon: <Building2 className="mr-2 h-4 w-4" /> } : undefined,
    userPermissions?.canAccessAgentTools ? { value: 'agent', label: 'Agent Tools', icon: <Brain className="mr-2 h-4 w-4" /> } : undefined,
    (userPermissions?.canManageAdvisors || isCurrentUserAdmin) ? { value: 'manage-advisors', label: 'Manage Advisors', icon: <Users className="mr-2 h-4 w-4" /> } : undefined,
  ] as const).filter((tab): tab is { value: string; label: string; icon: JSX.Element } => !!tab);

  const visibleTabs = tabOptions;

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
              timestamp:
                data.timestamp && typeof data.timestamp.toDate === 'function'
                  ? data.timestamp.toDate().toISOString()
                  : (typeof data.timestamp === 'string'
                      ? data.timestamp
                      : new Date().toISOString()),
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
          // Fetch latest events and advisors before updating eligibility
          const eventsSnapshot = await getDocs(collection(db, EVENTS_COLLECTION));
          const advisorsSnapshot = await getDocs(collection(db, ADVISORS_COLLECTION));
          const latestEvents = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as LoggedEvent));
          const latestAdvisors = advisorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Advisor));
          await updateAllAdvisorsMeetingHours(latestEvents, latestAdvisors);
      } catch (error) {
          console.error("Error deleting log entry: ", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to delete log entry." });
      } finally {
          setDeletingEventId(null);
      }
  }, [user, loggedEvents, isCurrentUserAdmin, toast]);


  const addTimeLog = useCallback(async (eventData: Omit<LoggedEvent, 'id' | 'timestamp' | 'userId'>): Promise<void> => {
    if (!user || !userPermissions?.canAccessTimeLog) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to log time." });
        return;
    }
    setIsProcessingForm(true);
    try {
      const newEvent = {
        ...eventData,
        userId: user.uid,
        timestamp: new Date().toISOString(),
      };
      await addDoc(collection(db, EVENTS_COLLECTION), newEvent);
      toast({ title: "Success", description: "Time logged successfully."});
      setEventToEdit(null);
      // Fetch latest events and advisors before updating eligibility
      const eventsSnapshot = await getDocs(collection(db, EVENTS_COLLECTION));
      const advisorsSnapshot = await getDocs(collection(db, ADVISORS_COLLECTION));
      const latestEvents = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as LoggedEvent));
      const latestAdvisors = advisorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Advisor));
      await updateAllAdvisorsMeetingHours(latestEvents, latestAdvisors);
    } catch (error) {
      console.error("Error adding time log: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to log time." });
    } finally {
        setIsProcessingForm(false);
    }
  }, [user, userPermissions, toast]);

  const editLogEntry = useCallback(async (updatedEvent: LoggedEvent): Promise<void> => {
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
              timestamp: new Date().toISOString(),
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
          // Fetch latest events and advisors before updating eligibility
          const eventsSnapshot = await getDocs(collection(db, EVENTS_COLLECTION));
          const advisorsSnapshot = await getDocs(collection(db, ADVISORS_COLLECTION));
          const latestEvents = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as LoggedEvent));
          const latestAdvisors = advisorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Advisor));
          await updateAllAdvisorsMeetingHours(latestEvents, latestAdvisors);
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

  // Add handler for updating advisor role
  const handleUpdateAdvisorRole = async (advisorId: string, newRole: 'Standard' | 'Senior' | 'Captain') => {
    await updateAdvisorRole(advisorId, newRole);
    await updateAllAdvisorsMeetingHours(loggedEvents, advisors);
  };

  // Add handler for dismissing Admin Day flag
  const handleDismissAdminDayFlag = async (advisorId: string, adminUid: string, adminName: string) => {
    await dismissAdminDayFlag(advisorId, adminUid, adminName);
    // Optionally, refresh advisors list here if not using real-time updates
  };

  // Handler for self-dismiss
  const handleTakeAdminDay = async () => {
    if (!currentAdvisor || !user) return;
    setIsTakingAdminDay(true);
    try {
      await dismissAdminDayFlag(currentAdvisor.id, user.uid, user.displayName || user.email || '');
      toast({ title: 'Admin Day Taken', description: 'You have taken your Admin Day for this month.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to take Admin Day.', variant: 'destructive' });
    } finally {
      setIsTakingAdminDay(false);
      setShowAdminDayDialog(false);
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
                 <Button 
                     variant="outline" 
                     size="icon" 
                     onClick={() => setActiveTab('time-log')} 
                     title="Home"
                     className="hover:bg-primary hover:text-primary-foreground"
                 >
                     <HomeIcon className="h-5 w-5" />
                 </Button>
                 <ThemeToggle />
                 <Button variant="outline" size="icon" onClick={handleLogout} title="Logout">
                     <LogOut className="h-5 w-5" />
                 </Button>
             </div>
         </header>

         {/* Admin Day Banner/Badge for eligible users or admins */}
         {(isEligibleForAdminDay &&
           ((currentAdvisor?.firebaseUid === user?.uid && (currentAdvisor?.role === 'Senior' || currentAdvisor?.role === 'Captain')) || isCurrentUserAdmin)
         ) && (
           <div className="flex flex-col items-center mb-6">
             <Badge variant="destructive" className="text-lg px-4 py-2 mb-2">
               🎉 You are eligible for an Admin Day this month!
             </Badge>
             {/* Self-take button for eligible Seniors/Captains */}
             {(currentAdvisor?.firebaseUid === user?.uid && (currentAdvisor?.role === 'Senior' || currentAdvisor?.role === 'Captain')) && (
               <>
                 <AlertDialog open={showAdminDayDialog} onOpenChange={setShowAdminDayDialog}>
                   <AlertDialogTrigger asChild>
                     <Button variant="outline" className="mb-2" onClick={() => setShowAdminDayDialog(true)} disabled={isTakingAdminDay}>
                       Take Admin Day
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Take Admin Day?</AlertDialogTitle>
                       <AlertDialogDescription>
                         Are you sure you want to take your Admin Day for this month? This action cannot be undone until you earn it again next month.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel disabled={isTakingAdminDay}>Cancel</AlertDialogCancel>
                       <AlertDialogAction onClick={handleTakeAdminDay} disabled={isTakingAdminDay}>
                         {isTakingAdminDay ? 'Processing...' : 'Yes, Take Admin Day'}
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
                 {/* Admin Day History Accordion */}
                 {Array.isArray(currentAdvisor?.admin_day_history) && currentAdvisor.admin_day_history.length > 0 && (
                   <Accordion type="single" collapsible className="w-full max-w-md mx-auto mt-2">
                     <AccordionItem value="history">
                       <AccordionTrigger className="text-base font-medium">View Admin Day History</AccordionTrigger>
                       <AccordionContent>
                         <ul className="space-y-2">
                           {currentAdvisor.admin_day_history.slice().reverse().map((entry, idx) => (
                             <li key={idx} className="border rounded p-2 bg-muted/50">
                               <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                                 <span><span className="font-semibold">Granted:</span> {new Date(entry.grantedDate).toLocaleDateString()}</span>
                                 <span className="text-xs text-muted-foreground">by {entry.grantedBy}</span>
                               </div>
                               {entry.usedDate && (
                                 <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-1">
                                   <span><span className="font-semibold">Taken:</span> {new Date(entry.usedDate).toLocaleDateString()}</span>
                                   <span className="text-xs text-muted-foreground">by {entry.usedBy}</span>
                                 </div>
                               )}
                               {entry.notes && <div className="mt-1 text-xs italic">{entry.notes}</div>}
                             </li>
                           ))}
                         </ul>
                       </AccordionContent>
                     </AccordionItem>
                   </Accordion>
                 )}
               </>
             )}
           </div>
         )}

         {isLoadingData ? (
             <div className="flex justify-center items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading App Data...
            </div>
         ) : (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                 <div className="w-full mb-12">
                   <TabsList className="flex flex-row rounded-xl shadow-lg bg-card/80 border p-2 gap-2 h-auto w-full items-center overflow-x-hidden hover:overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-primary/50 [&::-webkit-scrollbar-thumb]:rounded-full [&:not(:hover)]:overflow-x-hidden [&:hover]:overflow-x-auto [&:hover]:overflow-y-hidden">
                     {visibleTabs.map(tab => (
                       <TabsTrigger key={tab.value} value={tab.value} className="nav-tab data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center px-4 py-2 rounded-md font-medium whitespace-nowrap">
                         {tab.icon}
                         {tab.label}
                       </TabsTrigger>
                     ))}
                   </TabsList>
                 </div>

                {userPermissions?.canAccessTimeLog ? (
                 <TabsContent value="time-log">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         <div className="lg:col-span-1">
                             <TimeLogForm
                                 advisors={advisors.filter(a => a.status === 'active')}
                                 onLogEvent={addTimeLog}
                                 onUpdateEvent={async (eventId, eventData) => {
                                      const fullEventData = { ...eventData, id: eventId };
                                      await editLogEntry(fullEventData as LoggedEvent & { eventType: StandardEventType });
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
                         <ReportSection loggedEvents={loggedEvents} advisors={advisors} advisorId={currentAdvisorId} />
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
                             onUpdateAdvisorRole={handleUpdateAdvisorRole}
                             onDismissAdminDayFlag={handleDismissAdminDayFlag}
                             currentUser={user}
                             isAdmin={isCurrentUserAdmin}
                             hasTopAccess={userPermissions?.hasTopAccess}
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

    