'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import type { Advisor, LoggedEvent } from '@/types';
// import useLocalStorage from '@/hooks/use-local-storage'; // We will replace this with Firestore
import { AdvisorManager } from '@/components/advisor-manager';
import { TimeLogForm } from '@/components/time-log-form';
import { EventList } from '@/components/event-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ListChecks, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, runTransaction } from 'firebase/firestore'; // Import runTransaction

import { LoginForm } from '@/components/auth/login-form';
import { SignUpForm } from '@/components/auth/signup-form'; // Corrected import path

export default function Home() {
  // const [advisors, setAdvisors] = useLocalStorage<Advisor[]>('cx-advisors', []);
  // const [loggedEvents, setLoggedEvents] = useLocalStorage<LoggedEvent[]>('cx-loggedEvents', []);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loggedEvents, setLoggedEvents] = useState<LoggedEvent[]>([]);

  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsLoading(true);
        await fetchUserData(currentUser.uid);
        setIsLoading(false);
      } else {
        setAdvisors([]);
        setLoggedEvents([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const advisorsCollectionRef = collection(db, 'advisors');
      const advisorQuery = query(advisorsCollectionRef, where('userId', '==', userId));
      const advisorSnapshot = await getDocs(advisorQuery);
      const fetchedAdvisors = advisorSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advisor));
      setAdvisors(fetchedAdvisors);

      const eventsCollectionRef = collection(db, 'loggedEvents');
      const eventQuery = query(eventsCollectionRef, where('userId', '==', userId));
      const eventSnapshot = await getDocs(eventQuery);
      const fetchedEvents = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoggedEvent));
      setLoggedEvents(fetchedEvents);

    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleAddAdvisor = async (name: string) => {
    if (!user) return; // Ensure user is logged in

    try {
      // Add advisor to Firestore. Firestore generates the ID.
      await addDoc(collection(db, 'advisors'), { name, userId: user.uid });
      // After adding, re-fetch data to update state with the new advisor (including its Firestore ID).
      await fetchUserData(user.uid);
    } catch (error) {
      console.error('Error adding advisor:', error);
      throw error; // Re-throw to allow AdvisorManager to handle error toast
    }
  };

  const handleRemoveAdvisor = async (advisorIdToRemove: string) => {
      if (!user) return; // Ensure user is logged in

      try {
          // Use a transaction to ensure atomicity: delete advisor and its logs
          await runTransaction(db, async (transaction) => {
              // Delete advisor
              const advisorRef = doc(db, 'advisors', advisorIdToRemove);
              transaction.delete(advisorRef);

              // Find and delete associated logged events
              const associatedEventsQuery = query(collection(db, 'loggedEvents'), where('advisorId', '==', advisorIdToRemove), where('userId', '==', user.uid));
              const associatedEventsSnapshot = await getDocs(associatedEventsQuery);
              associatedEventsSnapshot.docs.forEach(eventDoc => {
                  transaction.delete(eventDoc.ref);
              });
          });

          // After deletion, re-fetch data to update state
          await fetchUserData(user.uid);

      } catch (error) {
          console.error('Error removing advisor and logs:', error);
          throw error; // Re-throw to allow AdvisorManager to handle error toast
      }
  };


  const handleLogEvent = async (newEvent: Omit<LoggedEvent, 'userId'>) => {
    if (!user) return; // Ensure user is logged in

    try {
      // Add event to Firestore
      // Omit the temporary id generated in TimeLogForm if it exists,
      // Firestore will generate the actual ID.
      const eventToAdd = { ...newEvent, userId: user.uid };
      // If newEvent might have a temporary 'id' from client-side generation,
      // explicitly remove it before sending to Firestore to ensure Firestore generates the ID.
      // delete eventToAdd.id; // Uncomment this line if TimeLogForm still generates a temporary ID
      await addDoc(collection(db, 'loggedEvents'), eventToAdd);

      // After adding, re-fetch data to update state
      await fetchUserData(user.uid);
    } catch (error) {
      console.error('Error adding log event:', error);
    }
  };

   const handleDeleteEvent = async (eventIdToDelete: string) => {
        if (!user) return; // Ensure user is logged in
        try {
            // Delete event from Firestore
            await deleteDoc(doc(db, 'loggedEvents', eventIdToDelete));
             // After deleting, re-fetch data to update state
            await fetchUserData(user.uid);
        } catch (error) {
            console.error('Error deleting log event:', error);
        }
    };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };


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
                  Don't have an account?{' '}
                  <Button variant="link" onClick={() => setAuthMode('signup')} className="p-0 h-auto align-baseline">Sign up</Button>
               </p>
            </div>
         ) : (
             <div className="text-center">
               {/* Assuming you have a SignUpForm component or similar */}
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

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8 text-center flex justify-between items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-2">
          <Clock className="h-8 w-8" /> CX Time Logger
        </h1>
         <Button variant="outline" onClick={handleLogout} className="flex items-center">
            <LogOut className="mr-2 h-4 w-4" /> Logout
         </Button>
      </header>
       <p className="text-muted-foreground mt-2 text-center">Cheeky lil time log</p>

      <Tabs defaultValue="log-time" className="w-full mt-8">
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
          {/* Pass specific add/remove handlers */}
          <AdvisorManager advisors={advisors} onAddAdvisor={handleAddAdvisor} onRemoveAdvisor={handleRemoveAdvisor} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
