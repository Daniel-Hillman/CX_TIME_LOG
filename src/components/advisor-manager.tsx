
'use client';

import type { Advisor } from '@/types';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Loader2, Pencil, Mail, ShieldCheck, ShieldAlert } from 'lucide-react'; // Added Mail, ShieldCheck, ShieldAlert
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
import { Badge } from '@/components/ui/badge';


interface AdvisorManagerProps {
  advisors: Advisor[];
  onAddAdvisor: (name: string, email: string) => Promise<void>; // Updated to accept email
  onRemoveAdvisor: (id: string) => Promise<void>;
  onEditAdvisor: (id: string, newName: string, newEmail?: string) => Promise<void>; // Allow email editing
}

export function AdvisorManager({ advisors, onAddAdvisor, onRemoveAdvisor, onEditAdvisor }: AdvisorManagerProps) {
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [newAdvisorEmail, setNewAdvisorEmail] = useState(''); // State for new advisor's email
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState(''); // State for editing advisor's email
  const [isLoading, setIsLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  const addNameInputRef = useRef<HTMLInputElement>(null);
  const addEmailInputRef = useRef<HTMLInputElement>(null); // Ref for email input
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editEmailInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!isLoading && !editingAdvisorId && addNameInputRef.current) {
       setTimeout(() => addNameInputRef.current?.focus(), 0);
    }
  }, [isLoading, editingAdvisorId]);

  useEffect(() => {
      if (editingAdvisorId && editNameInputRef.current) {
          setTimeout(() => editNameInputRef.current?.focus(), 0);
      }
  }, [editingAdvisorId]);


  const handleAdd = async () => {
    if (isLoading || editingAdvisorId) return;
    const trimmedName = newAdvisorName.trim();
    const trimmedEmail = newAdvisorEmail.trim().toLowerCase();

    if (trimmedName === '') {
      toast({ title: "Error", description: "Advisor name cannot be empty.", variant: "destructive" });
      addNameInputRef.current?.focus();
      return;
    }
    if (trimmedEmail === '') {
      toast({ title: "Error", description: "Advisor email cannot be empty.", variant: "destructive" });
      addEmailInputRef.current?.focus();
      return;
    }
    if (!trimmedEmail.endsWith('@clark.io')) {
      toast({ title: "Error", description: "Advisor email must end with @clark.io.", variant: "destructive" });
      addEmailInputRef.current?.focus();
      return;
    }
    if (advisors.some(advisor => advisor.name.toLowerCase() === trimmedName.toLowerCase())) {
       toast({ title: "Error", description: "Advisor with this name already exists.", variant: "destructive" });
       addNameInputRef.current?.focus();
       return;
    }
    if (advisors.some(advisor => advisor.email.toLowerCase() === trimmedEmail.toLowerCase())) {
       toast({ title: "Error", description: "Advisor with this email already exists.", variant: "destructive" });
       addEmailInputRef.current?.focus();
       return;
    }

    setIsLoading(true);
    try {
      await onAddAdvisor(trimmedName, trimmedEmail);
      setNewAdvisorName('');
      setNewAdvisorEmail('');
    } catch (error: any) {
      console.error("Error adding advisor:", error);
      // Toast is handled by parent, but if specific error message exists from onAddAdvisor
      if (error.message) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to add advisor.", variant: "destructive" });
      }
      addNameInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (idToRemove: string) => {
    if (isLoading || editingAdvisorId) return;
    setRemovingId(idToRemove);
    setIsLoading(true);
    try {
       await onRemoveAdvisor(idToRemove);
    } catch (error: any) {
       console.error("Error removing advisor:", error);
       toast({ title: "Error", description: error.message || "Failed to remove advisor.", variant: "destructive" });
    } finally {
       setIsLoading(false);
       setRemovingId(null);
    }
  };

  const startEditing = (advisor: Advisor) => {
      if (isLoading) return;
      setEditingAdvisorId(advisor.id);
      setEditingName(advisor.name);
      setEditingEmail(advisor.email);
  };

  const cancelEditing = () => {
      setEditingAdvisorId(null);
      setEditingName('');
      setEditingEmail('');
      setTimeout(() => addNameInputRef.current?.focus(), 0);
  };

  const handleEdit = async () => {
      if (!editingAdvisorId || isLoading) return;
      const trimmedName = editingName.trim();
      const trimmedEmail = editingEmail.trim().toLowerCase();
      const originalAdvisor = advisors.find(a => a.id === editingAdvisorId);

      if (!originalAdvisor) return;

      if (trimmedName === '') {
        toast({ title: "Error", description: "Advisor name cannot be empty.", variant: "destructive" });
        editNameInputRef.current?.focus();
        return;
      }
      if (trimmedEmail === '') {
        toast({ title: "Error", description: "Advisor email cannot be empty.", variant: "destructive" });
        editEmailInputRef.current?.focus();
        return;
      }
      if (!trimmedEmail.endsWith('@clark.io')) {
        toast({ title: "Error", description: "Advisor email must end with @clark.io.", variant: "destructive" });
        editEmailInputRef.current?.focus();
        return;
      }

      const nameChanged = originalAdvisor.name !== trimmedName;
      const emailChanged = originalAdvisor.email.toLowerCase() !== trimmedEmail;

      if (!nameChanged && !emailChanged) {
          cancelEditing();
          return;
      }

      if (advisors.some(a => a.id !== editingAdvisorId && a.name.toLowerCase() === trimmedName.toLowerCase())) {
          toast({ title: "Error", description: `Advisor name '${trimmedName}' already exists.`, variant: "destructive" });
          editNameInputRef.current?.focus();
          return;
      }
      if (advisors.some(a => a.id !== editingAdvisorId && a.email.toLowerCase() === trimmedEmail.toLowerCase())) {
          toast({ title: "Error", description: `Advisor email '${trimmedEmail}' already exists.`, variant: "destructive" });
          editEmailInputRef.current?.focus();
          return;
      }

      setIsLoading(true);
      try {
        await onEditAdvisor(editingAdvisorId, trimmedName, trimmedEmail);
        cancelEditing();
      } catch (error: any) {
        console.error("Error editing advisor:", error);
        toast({ title: "Error", description: error.message || "Failed to save changes.", variant: "destructive" });
        editNameInputRef.current?.focus();
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
        <div className="space-y-3 mb-6">
          <Input
            ref={addNameInputRef}
            type="text"
            placeholder="New advisor name"
            value={newAdvisorName}
            onChange={(e) => setNewAdvisorName(e.target.value)}
            aria-label="New advisor name"
            disabled={isLoading || !!editingAdvisorId}
          />
          <Input
            ref={addEmailInputRef}
            type="email"
            placeholder="New advisor email (@clark.io)"
            value={newAdvisorEmail}
            onChange={(e) => setNewAdvisorEmail(e.target.value)}
            aria-label="New advisor email"
            disabled={isLoading || !!editingAdvisorId}
             onKeyDown={(e) => !isLoading && !editingAdvisorId && e.key === 'Enter' && handleAdd()}
          />
          <Button
            onClick={handleAdd}
            aria-label="Add Advisor"
            variant="outline"
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
            disabled={isLoading || !!editingAdvisorId}
          >
            {isLoading && !removingId && !editingAdvisorId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isLoading && !removingId && !editingAdvisorId ? 'Adding...' : 'Add Advisor'}
          </Button>
        </div>

        <ScrollArea className="h-[280px] border rounded-md p-2 bg-secondary/30">
          {advisors.length === 0 ? (
             <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
          ) : (
            <ul className="space-y-2">
              {advisors.map((advisor) => {
                const isRemovingThis = removingId === advisor.id;
                const isEditingThis = editingAdvisorId === advisor.id;
                const isSomeoneLoading = isLoading && !isRemovingThis && !isEditingThis;

                return (
                   <li key={advisor.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-background rounded shadow-sm group">
                     {isEditingThis ? (
                        <div className="flex-grow space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2 mr-2 w-full mb-2 sm:mb-0">
                            <Input
                                ref={editNameInputRef}
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-8 flex-grow"
                                disabled={isLoading && !isEditingThis}
                            />
                            <Input
                                ref={editEmailInputRef}
                                type="email"
                                value={editingEmail}
                                onChange={(e) => setEditingEmail(e.target.value)}
                                className="h-8 flex-grow"
                                disabled={(isLoading && !isEditingThis) || advisor.status === 'active'}
                                title={advisor.status === 'active' ? "Email cannot be changed for active advisors" : ""}
                            />
                             <div className="flex gap-2 justify-end sm:justify-start">
                                <Button variant="ghost" size="sm" onClick={handleEdit} disabled={isLoading && !isEditingThis}>Save</Button>
                                <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isLoading && !isEditingThis}>Cancel</Button>
                             </div>
                        </div>
                     ) : (
                        <>
                            <div className="flex-grow mb-2 sm:mb-0">
                                <div className="flex items-center">
                                    <span className={cn("text-foreground font-medium", (isRemovingThis || isSomeoneLoading) && "opacity-50")}>
                                        {advisor.name}
                                    </span>
                                    {advisor.status === 'active' ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <ShieldCheck className="ml-2 h-4 w-4 text-green-500" />
                                            </TooltipTrigger>
                                            <TooltipContent><p>Active</p></TooltipContent>
                                        </Tooltip>
                                    ) : (
                                         <Tooltip>
                                            <TooltipTrigger asChild>
                                                <ShieldAlert className="ml-2 h-4 w-4 text-yellow-500" />
                                            </TooltipTrigger>
                                            <TooltipContent><p>Pending Sign-up</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground mt-1">
                                     <Mail className="mr-1.5 h-3 w-3" />
                                    {advisor.email}
                                </div>
                            </div>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity self-start sm:self-center">
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditing(advisor)}
                                  aria-label={`Edit ${advisor.name}`}
                                  className="text-primary hover:bg-primary/10 h-7 w-7"
                                  disabled={isLoading || !!editingAdvisorId}
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
                                        disabled={isLoading || !!editingAdvisorId}
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
                                                Are you sure you want to remove advisor '{advisor.name}' ({advisor.email})?
                                                {advisor.status === 'active' && " This advisor has an active account."}
                                                This action cannot be undone.
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

