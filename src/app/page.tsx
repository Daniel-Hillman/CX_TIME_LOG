'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Advisor, LoggedEvent, Task } from '@/types'; // *** Import Task type ***
import { AdvisorManager } from '@/components/advisor-manager';
import { TaskManager } from '@/components/task-manager'; // *** Import TaskManager ***
import { TimeLogForm } from '@/components/time-log-form';
import { EventList } from '@/components/event-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ListChecks, Clock, LogOut, BarChart2, AreaChart, ListTodo } from 'lucide-react'; // *** Import ListTodo icon ***
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, runTransaction, updateDoc } from 'firebase/firestore'; 

import { LoginForm } from '@/components/auth/login-form';
import { SignUpForm } from '@/components/auth/signup-form';
import { ReportSection } from '@/components/report-section';
import { VisualizationsSection } from '@/components/visualizations-section';

export default function Home() {
  // State for Advisors and Events
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);
  // *** State for Tasks ***
  const [tasks, setTasks] = useState<Task[]>([]);

  // Auth and Loading State
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(true);
  
  // State for UI interaction statuses
  const [isProcessingEvent, setIsProcessingEvent] = useState(false);
  const [isAddingAdvisor, setIsAddingAdvisor] = useState(false);
  const [removingAdvisorId, setRemovingAdvisorId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  // *** Task interaction statuses ***
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);

  const { toast } = useToast();

  // State for editing events and managing tabs
  const [eventToEdit, setEventToEdit] = useState<LoggedEvent | null>(null);
  const [activeTab, setActiveTab] = useState('log-time');
  const timeLogFormRef = useRef<HTMLDivElement>(null);

  // *** Updated fetchUserData to include Tasks ***
  const fetchUserData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      // Fetch Advisors
      const advisorsQuery = query(collection(db, 'advisors'), where('userId', '==', userId));
      const advisorSnapshot = await getDocs(advisorsQuery);
      const fetchedAdvisors = advisorSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advisor));
      setAdvisors(fetchedAdvisors);

      // Fetch Tasks
      const tasksQuery = query(collection(db, 'tasks'), where('userId', '==', userId));
      const taskSnapshot = await getDocs(tasksQuery);
      const fetchedTasks = taskSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(fetchedTasks);

      // Fetch Logged Events
      const eventsQuery = query(collection(db, 'loggedEvents'), where('userId', '==', userId));
      const eventSnapshot = await getDocs(eventsQuery);
      const fetchedEvents = eventSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as LoggedEvent))
          .sort((a, b) => b.date.localeCompare(a.date)); 
      setLoggedEvents(fetchedEvents);

    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({ title: "Error Fetching Data", description: "Could not load user data.", variant: "destructive" });
       // Reset state on error to avoid partial data display
       setAdvisors([]);
       setTasks([]);
       setLoggedEvents([]);
    } finally {
        setIsLoading(false);
    }
  }, [toast]); 

  useEffect(() => {
    setIsClient(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid);
      } else {
        // Reset all user-specific state on logout
        setAdvisors([]);
        setTasks([]); // Reset tasks
        setLoggedEvents([]);
        setIsLoading(false);
        setEventToEdit(null); 
        setActiveTab('log-time'); 
      }
    });
    return () => unsubscribe();
  }, [fetchUserData]);

  // --- Advisor Handlers ---
  const handleAddAdvisor = async (name: string) => {
    if (!user || isAddingAdvisor) return;
    setIsAddingAdvisor(true);
    try {
      await addDoc(collection(db, 'advisors'), { name, userId: user.uid });
      await fetchUserData(user.uid); 
    } catch (error) {
      console.error('Error adding advisor:', error);
      toast({ title: "Error", description: "Failed to add advisor.", variant: "destructive" });
    } finally {
      setIsAddingAdvisor(false);
    }
  };

  const handleRemoveAdvisor = async (advisorIdToRemove: string) => {
      if (!user || removingAdvisorId) return;
      setRemovingAdvisorId(advisorIdToRemove);
      try {
          await runTransaction(db, async (transaction) => {
              const advisorRef = doc(db, 'advisors', advisorIdToRemove);
              transaction.delete(advisorRef);
              // Note: Transactionally updating/deleting associated events based on advisorId
              // can be complex and might hit transaction limits if many events exist.
              // Consider if just removing the advisor is sufficient, or handle cleanup differently.
              // The current implementation only removes the advisor document.
          });
          // Refresh local state after successful delete
          setAdvisors(prev => prev.filter(a => a.id !== advisorIdToRemove));
          // Update events locally to remove the advisor association if needed, or just rely on refetch.
          // For simplicity, we rely on fetchUserData or manual refresh if strict consistency is needed immediately.
          // Consider adding a specific event query/update here if advisor removal needs instant event cleanup.
          
          toast({ title: "Success", description: "Advisor removed." });
          // Optionally refetch all data, or just update advisors locally
          // await fetchUserData(user.uid); // Could refetch everything
      } catch (error) {
          console.error('Error removing advisor:', error);
          toast({ title: "Error", description: "Failed to remove advisor.", variant: "destructive" });
      } finally {
          setRemovingAdvisorId(null);
      }
  };

  // *** Task Handlers ***
  const handleAddTask = async (name: string) => {
    if (!user || isAddingTask) return;
    setIsAddingTask(true);
    try {
      await addDoc(collection(db, 'tasks'), { name, userId: user.uid });
      await fetchUserData(user.uid); // Refresh all data
      toast({ title: "Success", description: `Task "${name}" added.` });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({ title: "Error", description: "Failed to add task.", variant: "destructive" });
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleRemoveTask = async (taskIdToRemove: string) => {
      if (!user || removingTaskId) return;
      setRemovingTaskId(taskIdToRemove);
      try {
          const taskRef = doc(db, 'tasks', taskIdToRemove);
          await deleteDoc(taskRef);
          // Refresh local state
          setTasks(prev => prev.filter(t => t.id !== taskIdToRemove));
          // Events associated with this task will keep the taskId, but it will no longer resolve to a name.
          // Consider if you need to update events to remove the taskId upon task deletion.
          toast({ title: "Success", description: "Task removed." });
          // await fetchUserData(user.uid); // Optionally refetch
      } catch (error) {
          console.error('Error removing task:', error);
          toast({ title: "Error", description: "Failed to remove task.", variant: "destructive" });
      } finally {
          setRemovingTaskId(null);
      }
  };

  // --- Event Handlers (Create, Update, Delete, Edit) ---
  const handleLogEvent = async (newEvent: Omit<LoggedEvent, 'userId' | 'id'>): Promise<void> => {
    if (!user || isProcessingEvent) return Promise.reject("Already processing or not logged in");
    setIsProcessingEvent(true);
    try {
      const eventToAdd = { ...newEvent, userId: user.uid };
      await addDoc(collection(db, 'loggedEvents'), eventToAdd);
      await fetchUserData(user.uid); 
    } catch (error) {
      console.error('Error adding log event:', error);
      throw error; // Re-throw for form handling
    } finally {
      setIsProcessingEvent(false);
    }
  };

  const handleUpdateEvent = async (eventId: string, eventData: Omit<LoggedEvent, 'userId' | 'id'>): Promise<void> => {
      if (!user || isProcessingEvent) return Promise.reject("Already processing or not logged in");
      setIsProcessingEvent(true);
      try {
          const eventRef = doc(db, 'loggedEvents', eventId);
          const dataToUpdate = { ...eventData, userId: user.uid }; // Ensure userId is included
          await updateDoc(eventRef, dataToUpdate);
          await fetchUserData(user.uid); 
          setEventToEdit(null); 
      } catch (error) {
          console.error('Error updating event:', error);
          throw error; // Re-throw for form handling
      } finally {
          setIsProcessingEvent(false);
      }
  };

   const handleDeleteEvent = async (eventIdToDelete: string): Promise<void> => {
        if (!user || deletingEventId) return Promise.reject("Already deleting or not logged in");
        setDeletingEventId(eventIdToDelete);
        try {
            const eventRef = doc(db, 'loggedEvents', eventIdToDelete);
            await deleteDoc(eventRef);
            setLoggedEvents(prevEvents => prevEvents.filter(event => event.id !== eventIdToDelete));
            // Toast is handled in EventList upon promise resolution
        } catch (error) {
            console.error('handleDeleteEvent: Error during delete:', error);
            toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
            throw error; // Re-throw for list handling
        } finally {
            setDeletingEventId(null);
        }
    };

   const handleEditEventStart = (event: LoggedEvent) => {
       setEventToEdit(event);
       setActiveTab('log-time'); 
       setTimeout(() => {
           timeLogFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
       }, 100);
   };

   const handleCancelEdit = () => {
       setEventToEdit(null);
   };

  // --- Auth Handlers ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // State reset is handled by onAuthStateChanged
    } catch (error) {
      console.error('Logout Error:', error);
      toast({ title: "Logout Error", description: "An error occurred during logout.", variant: "destructive" });
    }
  };

  // --- Render Logic ---
  if (!isClient || isLoading) {
    return (
         <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
         </div>
    );
  }

  if (!user) {
    return (
      <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-screen">
         {authMode === 'login' ? (
            <div className="text-center">
               <LoginForm />
               <p className="text-center text-sm mt-4">
                  Don&apos;t have an account?{' '}
                  <Button variant="link" onClick={() => setAuthMode('signup')} className="p-0 h-auto align-baseline">Sign up</Button>
               </p>
            </div>
         ) : (
             <div className="text-center">
               <SignUpForm />
                 <p className="text-center text-sm mt-4">
                  Already have an account?{' '}
                  <Button variant="link" onClick={() => setAuthMode('login')} className="p-0 h-auto align-baseline">Login</Button>
               </p>
            </div>
         )}
      </main>
    );
  }

  // --- Main Authenticated View ---
  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-4 relative flex justify-center items-center pt-2 pb-2">
         <div className="text-center">
           <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-2">
             <Clock className="h-8 w-8" /> CX Time Logger
           </h1>
           <p className="text-muted-foreground mt-1 text-center">Track your time effectively.</p>
        </div>
         <div className="absolute right-0 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
           <ThemeToggle />
           <Button variant="outline" onClick={handleLogout} className="flex items-center">
              <LogOut className="mr-2 h-4 w-4" /> Logout
           </Button>
         </div>
      </header>

      {/* *** Update grid columns for new Task tab *** */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-6 bg-secondary rounded-lg p-1"> {/* Changed grid-cols-5 to grid-cols-6 */} 
          <TabsTrigger value="log-time" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <Clock className="mr-2 h-4 w-4" /> {eventToEdit ? 'Edit Event' : 'Log Time'}
          </TabsTrigger>
          <TabsTrigger value="view-logs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <ListChecks className="mr-2 h-4 w-4" /> View Logs
          </TabsTrigger>
           <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart2 className="mr-2 h-4 w-4" /> Reports
           </TabsTrigger>
           <TabsTrigger value="visualizations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <AreaChart className="mr-2 h-4 w-4" /> Visualizations
           </TabsTrigger>
          <TabsTrigger value="manage-advisors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
             <Users className="mr-2 h-4 w-4" /> Manage Advisors
          </TabsTrigger>
           {/* *** Add Manage Tasks Tab Trigger *** */}
           <TabsTrigger value="manage-tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ListTodo className="mr-2 h-4 w-4" /> Manage Tasks
           </TabsTrigger>
        </TabsList>

        {/* Log Time / Edit Time Tab */}
        <TabsContent value="log-time">
           <div ref={timeLogFormRef}>
             <TimeLogForm
               advisors={advisors}
               tasks={tasks} // *** Pass tasks to TimeLogForm ***
               onLogEvent={handleLogEvent}
               onUpdateEvent={handleUpdateEvent} 
               onCancelEdit={handleCancelEdit}   
               eventToEdit={eventToEdit}       
               isSubmitting={isProcessingEvent} 
             />
           </div>
        </TabsContent>

        {/* View Logs Tab */}
        <TabsContent value="view-logs">
           <EventList
             events={loggedEvents}
             advisors={advisors}
             tasks={tasks} // *** Pass tasks to EventList ***
             onDeleteEvent={handleDeleteEvent}
             onEditEvent={handleEditEventStart} 
             deletingId={deletingEventId}
           />
        </TabsContent>

        {/* Reports Tab */}
         <TabsContent value="reports">
             <ReportSection 
                loggedEvents={loggedEvents} 
                advisors={advisors} 
                tasks={tasks} // *** Pass tasks to ReportSection ***
              />
         </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations">
            <VisualizationsSection 
                loggedEvents={loggedEvents} 
                advisors={advisors} 
                tasks={tasks} // *** Pass tasks to VisualizationsSection ***
            />
         </TabsContent>

        {/* Manage Advisors Tab */}
        <TabsContent value="manage-advisors">
          <AdvisorManager
            advisors={advisors}
            onAddAdvisor={handleAddAdvisor}
            onRemoveAdvisor={handleRemoveAdvisor}
            isAdding={isAddingAdvisor}
            removingId={removingAdvisorId}
          />
        </TabsContent>

        {/* *** Add Manage Tasks Tab Content *** */}
        <TabsContent value="manage-tasks">
            <TaskManager
                tasks={tasks}
                onAddTask={handleAddTask}
                onRemoveTask={handleRemoveTask}
                isAdding={isAddingTask}
                removingId={removingTaskId}
            />
        </TabsContent>
      </Tabs>
    </main>
  );
}
