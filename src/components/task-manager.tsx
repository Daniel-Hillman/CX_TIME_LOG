'use client';

import * as React from 'react';
import { useState } from 'react';
import type { Task } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Loader2, ListTodo } from 'lucide-react'; // Added ListTodo icon
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
import { cn } from "@/lib/utils";

interface TaskManagerProps {
  tasks: Task[];
  onAddTask: (name: string) => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
  isAdding: boolean;
  removingId: string | null;
}

export function TaskManager({ tasks, onAddTask, onRemoveTask, isAdding, removingId }: TaskManagerProps) {
  const [newTaskName, setNewTaskName] = useState('');

  const handleAddClick = async () => {
    if (!newTaskName.trim() || isAdding) return;
    await onAddTask(newTaskName.trim());
    setNewTaskName(''); // Clear input after adding
  };

  const handleRemoveClick = async (taskId: string) => {
      await onRemoveTask(taskId);
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListTodo className="mr-2 h-5 w-5 text-primary" /> Manage Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="New task name"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            disabled={isAdding || !!removingId}
          />
          <Button onClick={handleAddClick} disabled={!newTaskName.trim() || isAdding || !!removingId}>
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Task
          </Button>
        </div>
        <ScrollArea className="h-[200px] border rounded-md p-2">
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No tasks added yet.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                  <span className="flex-1 mr-2 truncate" title={task.name}>{task.name}</span>
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={removingId === task.id || isAdding}
                            aria-label={`Delete task ${task.name}`}
                           >
                              {removingId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                           </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                             This action cannot be undone. This will permanently delete the task &quot;<span className="font-semibold">{task.name}</span>&quot;.
                             Deleting a task will <span className="font-bold">not</span> delete existing time log entries associated with it, but they will no longer show the task name.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={removingId === task.id}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveClick(task.id)}
                            className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                            disabled={removingId === task.id}
                          >
                            {removingId === task.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete Task
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
