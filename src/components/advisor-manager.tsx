'use client';

import type { Advisor } from '@/types';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react'; // Import useRef, useEffect
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Loader2, Pencil } from 'lucide-react'; // Added Pencil
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface AdvisorManagerProps {
  advisors: Advisor[];
  // Simplified props: Callbacks now handle their own state/toasts
  onAddAdvisor: (name: string) => void;
  onRemoveAdvisor: (id: string) => void;
  onEditAdvisor: (id: string, newName: string) => void; // Added edit callback
}

export function AdvisorManager({ advisors, onAddAdvisor, onRemoveAdvisor, onEditAdvisor }: AdvisorManagerProps) {
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Unified loading state
  const [removingId, setRemovingId] = useState<string | null>(null); // Specific state for removal spinner
  const { toast } = useToast();
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Effect to focus add input when not loading/editing
  useEffect(() => {
    if (!isLoading && !editingAdvisorId && addInputRef.current) {
       setTimeout(() => addInputRef.current?.focus(), 0);
    }
  }, [isLoading, editingAdvisorId]);

  // Effect to focus edit input when editing starts
  useEffect(() => {
      if (editingAdvisorId && editInputRef.current) {
          setTimeout(() => editInputRef.current?.focus(), 0);
      }
  }, [editingAdvisorId]);


  const handleAdd = async () => {
    if (isLoading || editingAdvisorId) return;
    const trimmedName = newAdvisorName.trim();
    if (trimmedName === '') {
      toast({ title: "Error", description: "Advisor name cannot be empty.", variant: "destructive" });
      addInputRef.current?.focus();
      return;
    }
    // Check for duplicates (case-insensitive)
    if (advisors.some(advisor => advisor.name.toLowerCase() === trimmedName.toLowerCase())) {
       toast({ title: "Error", description: "Advisor with this name already exists.", variant: "destructive" });
       addInputRef.current?.focus();
       return;
    }

    setIsLoading(true);
    try {
      await onAddAdvisor(trimmedName);
      // Success toast handled in parent (page.tsx)
      setNewAdvisorName('');
      // Focus will be handled by useEffect
    } catch (error) {
      console.error("Error adding advisor:", error);
      toast({ title: "Error", description: "Failed to add advisor.", variant: "destructive" });
      addInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (idToRemove: string) => {
    if (isLoading || editingAdvisorId) return;
    const advisorToRemove = advisors.find(a => a.id === idToRemove);
    if (!advisorToRemove) return;

    setRemovingId(idToRemove); // Set removing spinner specifically
    setIsLoading(true);
    try {
       await onRemoveAdvisor(idToRemove);
       // Success toast handled in parent (page.tsx)
    } catch (error) {
       console.error("Error removing advisor:", error);
       toast({ title: "Error", description: "Failed to remove advisor.", variant: "destructive" });
    } finally {
       setIsLoading(false);
       setRemovingId(null);
    }
  };

  const startEditing = (advisor: Advisor) => {
      if (isLoading) return;
      setEditingAdvisorId(advisor.id);
      setEditingName(advisor.name);
      // Focus handled by useEffect
  };

  const cancelEditing = () => {
      setEditingAdvisorId(null);
      setEditingName('');
      // Focus add input after cancelling
      setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const handleEdit = async () => {
      if (!editingAdvisorId || isLoading) return;
      const trimmedName = editingName.trim();
      const originalAdvisor = advisors.find(a => a.id === editingAdvisorId);

      if (trimmedName === '') {
        toast({ title: "Error", description: "Advisor name cannot be empty.", variant: "destructive" });
        editInputRef.current?.focus();
        return;
      }

      // Check if name changed
      if (originalAdvisor && originalAdvisor.name === trimmedName) {
          cancelEditing(); // No change, just cancel edit mode
          return;
      }

      // Check for duplicates (case-insensitive, excluding self)
      if (advisors.some(a => a.id !== editingAdvisorId && a.name.toLowerCase() === trimmedName.toLowerCase())) {
          toast({ title: "Error", description: `Advisor name '${trimmedName}' already exists.`, variant: "destructive" });
          editInputRef.current?.focus();
          return;
      }

      setIsLoading(true);
      try {
        await onEditAdvisor(editingAdvisorId, trimmedName);
        // Success toast handled in parent (page.tsx)
        cancelEditing();
      } catch (error) {
        console.error("Error editing advisor:", error);
        toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        editInputRef.current?.focus();
      } finally {
        setIsLoading(false);
      }
    };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Manage Advisors</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add New Advisor Form */}
        <div className="flex gap-2 mb-6">
          <Input
            ref={addInputRef}
            type="text"
            placeholder="New advisor name"
            value={newAdvisorName}
            onChange={(e) => setNewAdvisorName(e.target.value)}
            onKeyDown={(e) => !isLoading && !editingAdvisorId && e.key === 'Enter' && handleAdd()}
            aria-label="New advisor name"
            className="flex-grow"
            disabled={isLoading || !!editingAdvisorId} // Disable if loading or editing another
          />
          <Button
            onClick={handleAdd}
            aria-label="Add Advisor"
            variant="outline"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isLoading || !!editingAdvisorId} // Disable if loading or editing another
          >
            {isLoading && !removingId && !editingAdvisorId ? ( // Show spinner only when adding
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isLoading && !removingId && !editingAdvisorId ? 'Adding...' : 'Add'}
          </Button>
        </div>

        {/* Advisor List */}
        <ScrollArea className="h-[250px] border rounded-md p-2 bg-secondary/30">
          {advisors.length === 0 ? (
             <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
          ) : (
            <ul className="space-y-2">
              {advisors.map((advisor) => {
                const isRemovingThis = removingId === advisor.id;
                const isEditingThis = editingAdvisorId === advisor.id;
                const isSomeoneLoading = isLoading && !isRemovingThis && !isEditingThis;

                return (
                   <li key={advisor.id} className="flex justify-between items-center p-2 bg-background rounded shadow-sm group">
                     {isEditingThis ? (
                        <div className="flex-grow flex items-center gap-2 mr-2">
                            <Input
                                ref={editInputRef}
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                }}
                                className="h-8 flex-grow"
                                disabled={isLoading && !isEditingThis} // Only disable if global loading is active but not for *this* edit save
                            />
                             <Button variant="ghost" size="sm" onClick={handleEdit} disabled={isLoading && !isEditingThis}>Save</Button>
                             <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isLoading && !isEditingThis}>Cancel</Button>
                        </div>
                     ) : (
                        <>
                            <span className={cn("text-foreground", (isRemovingThis || isSomeoneLoading) && "opacity-50")}>
                                {advisor.name}
                            </span>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditing(advisor)}
                                  aria-label={`Edit ${advisor.name}`}
                                  className="text-primary hover:bg-primary/10 h-7 w-7"
                                  disabled={isLoading || !!editingAdvisorId} // Disable if loading or someone else is being edited
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove ${advisor.name}`}
                                        className="text-destructive hover:bg-destructive/10 h-7 w-7"
                                        disabled={isLoading || !!editingAdvisorId} // Disable if loading or someone else is being edited
                                        >
                                        {isRemovingThis ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to remove advisor '{advisor.name}'? This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleRemove(advisor.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                disabled={isLoading}>
                                                {isRemovingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                       </>
                     )}
                   </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
       <CardFooter className="text-sm text-muted-foreground pt-4">
        Total Advisors: {advisors.length}
      </CardFooter>
    </Card>
  );
}
