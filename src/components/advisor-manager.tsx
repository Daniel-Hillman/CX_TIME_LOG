'use client';

import type { Advisor } from '@/types';
import * as React from 'react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdvisorManagerProps {
  advisors: Advisor[];
  onAdvisorsChange: (advisors: Advisor[]) => void;
}

export function AdvisorManager({ advisors, onAdvisorsChange }: AdvisorManagerProps) {
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const { toast } = useToast();

  const handleAddAdvisor = () => {
    const trimmedName = newAdvisorName.trim();
    if (trimmedName === '') {
      toast({
        title: "Error",
        description: "Advisor name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (advisors.some(advisor => advisor.name.toLowerCase() === trimmedName.toLowerCase())) {
       toast({
        title: "Error",
        description: "Advisor with this name already exists.",
        variant: "destructive",
      });
      return;
    }

    const newAdvisor: Advisor = { id: uuidv4(), name: trimmedName };
    onAdvisorsChange([...advisors, newAdvisor]);
    setNewAdvisorName('');
     toast({
      title: "Success",
      description: `Advisor "${trimmedName}" added.`,
    });
  };

  const handleRemoveAdvisor = (idToRemove: string) => {
    const advisorToRemove = advisors.find(a => a.id === idToRemove);
    if (advisorToRemove) {
       onAdvisorsChange(advisors.filter((advisor) => advisor.id !== idToRemove));
       toast({
         title: "Success",
         description: `Advisor "${advisorToRemove.name}" removed.`,
       });
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
            type="text"
            placeholder="New advisor name"
            value={newAdvisorName}
            onChange={(e) => setNewAdvisorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAdvisor()}
            aria-label="New advisor name"
            className="flex-grow"
          />
          <Button onClick={handleAddAdvisor} aria-label="Add Advisor" variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <UserPlus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        <ScrollArea className="h-[200px] border rounded-md p-2 bg-secondary/30">
          {advisors.length === 0 ? (
             <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
          ) : (
            <ul className="space-y-2">
              {advisors.map((advisor) => (
                <li key={advisor.id} className="flex justify-between items-center p-2 bg-background rounded shadow-sm">
                  <span className="text-foreground">{advisor.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAdvisor(advisor.id)}
                    aria-label={`Remove ${advisor.name}`}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
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
