'use client';

import type { Advisor } from '@/types';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react'; // Import useRef, useEffect
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

interface AdvisorManagerProps {
  advisors: Advisor[];
  onAddAdvisor: (name: string) => Promise<void>;
  onRemoveAdvisor: (id: string) => Promise<void>;
  isAdding: boolean;
  removingId: string | null;
}

export function AdvisorManager({ advisors, onAddAdvisor, onRemoveAdvisor, isAdding, removingId }: AdvisorManagerProps) {
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null); // Ref for the input element

  // Effect to focus input after adding is finished
  useEffect(() => {
    if (!isAdding && inputRef.current) {
        // Check if focus was lost due to the button click, re-focus if needed
        // This might need adjustment depending on exact browser behavior
         setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isAdding]);

  const handleAddAdvisor = async () => {
    if (isAdding) return;
    const trimmedName = newAdvisorName.trim();
    if (trimmedName === '') {
      toast({ title: "Error", description: "Advisor name cannot be empty.", variant: "destructive" });
      return;
    }
    if (advisors.some(advisor => advisor.name.toLowerCase() === trimmedName.toLowerCase())) {
       toast({ title: "Error", description: "Advisor with this name already exists.", variant: "destructive" });
       return;
    }

    try {
      await onAddAdvisor(trimmedName);
      setNewAdvisorName('');
      toast({ title: "Success", description: `Advisor "${trimmedName}" added.` });
      // Focus handled by useEffect now
    } catch {
      // Error already logged in parent, just show generic toast
      toast({ title: "Error", description: "Failed to add advisor.", variant: "destructive" });
    }
  };

  const handleRemoveAdvisor = async (idToRemove: string) => {
    if (removingId) return;
    const advisorToRemove = advisors.find(a => a.id === idToRemove);
    if (!advisorToRemove) return;

    try {
       await onRemoveAdvisor(idToRemove);
       // Success toast handled in parent where data is refreshed
    } catch {
       // Error already logged in parent, just show generic toast
       toast({ title: "Error", description: "Failed to remove advisor.", variant: "destructive" });
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Manage Advisors</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            ref={inputRef} // Assign ref to the input
            type="text"
            placeholder="New advisor name"
            value={newAdvisorName}
            onChange={(e) => setNewAdvisorName(e.target.value)}
            onKeyDown={(e) => !isAdding && e.key === 'Enter' && handleAddAdvisor()}
            aria-label="New advisor name"
            className="flex-grow"
            disabled={isAdding || !!removingId}
          />
          <Button onClick={handleAddAdvisor} aria-label="Add Advisor" variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isAdding || !!removingId}>
            {isAdding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </div>
        <ScrollArea className="h-[200px] border rounded-md p-2 bg-secondary/30">
          {advisors.length === 0 ? (
             <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
          ) : (
            <ul className="space-y-2">
              {advisors.map((advisor) => {
                const isRemovingThis = removingId === advisor.id;
                return (
                   <li key={advisor.id} className="flex justify-between items-center p-2 bg-background rounded shadow-sm">
                     <span className={cn("text-foreground", isRemovingThis && "opacity-50")}>{advisor.name}</span>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => handleRemoveAdvisor(advisor.id)}
                       aria-label={`Remove ${advisor.name}`}
                       className="text-destructive hover:bg-destructive/10"
                       disabled={!!removingId}
                     >
                       {isRemovingThis ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <Trash2 className="h-4 w-4" />
                       )}
                     </Button>
                   </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
       <CardFooter className="text-sm text-muted-foreground">
        Total Advisors: {advisors.length}
      </CardFooter>
    </Card>
  );
}
