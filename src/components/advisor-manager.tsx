'use client';

import type { Advisor, AdvisorPermissions } from '@/types'; // Added AdvisorPermissions
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserPlus, Loader2, Pencil, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';
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
import { Switch } from "@/components/ui/switch"; // Added Switch import
import { Label } from "@/components/ui/label";   // Added Label import
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Ensure TooltipProvider if not already global
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Timestamp } from "firebase/firestore";

interface AdvisorManagerProps {
  advisors: Advisor[];
  onAddAdvisor: (name: string, email: string) => Promise<void>;
  onRemoveAdvisor: (id: string) => Promise<void>;
  onEditAdvisor: (id: string, newName: string, newEmail?: string) => Promise<void>;
  onUpdateAdvisorPermissions: (advisorId: string, permissions: Partial<AdvisorPermissions>) => Promise<void>;
  onUpdateAdvisorRole: (advisorId: string, newRole: 'Standard' | 'Senior' | 'Captain') => Promise<void>;
  onDismissAdminDayFlag: (advisorId: string, adminUid: string, adminName: string) => Promise<void>;
  currentUser: any;
  isAdmin: boolean;
  hasTopAccess: boolean | undefined;
}

const permissionLabels: { [K in keyof AdvisorPermissions]?: string } = {
    canAccessTimeLog: "Time Log",
    canAccessPolicySearch: "Policy Search",
    canAccessNextClearedBatch: "Next Cleared Batch",
    canAccessWholeOfMarket: "Whole of Market",
    canAccessAgentTools: "Agent Tools",
    canAccessVisualisations: "Visualisations",
    canAccessSummary: "Summary",
    canAccessReports: "Reports",
    canManageAdvisors: "Manage Advisors",
    hasTopAccess: "Top Access (Grants All)",
    canViewAllEvents: "View all logged events",
};

const defaultPermissionKeys: (keyof AdvisorPermissions)[] = [
    'canAccessTimeLog',
    'canAccessPolicySearch',
    'canAccessNextClearedBatch',
    'canAccessWholeOfMarket',
    'canAccessAgentTools'
];

const advancedPermissionKeys: (keyof AdvisorPermissions)[] = [
    'canAccessVisualisations',
    'canAccessSummary',
    'canAccessReports',
    'canManageAdvisors'
];

export function AdvisorManager({
  advisors,
  onAddAdvisor,
  onRemoveAdvisor,
  onEditAdvisor,
  onUpdateAdvisorPermissions,
  onUpdateAdvisorRole,
  onDismissAdminDayFlag,
  currentUser,
  isAdmin,
  hasTopAccess
}: AdvisorManagerProps) {
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [newAdvisorEmail, setNewAdvisorEmail] = useState('');
  const [editingAdvisorId, setEditingAdvisorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false); // This can be used for permission updates too
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  const addNameInputRef = useRef<HTMLInputElement>(null);
  const addEmailInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editEmailInputRef = useRef<HTMLInputElement>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const currentUserId = currentUser?.uid || '';

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

  const handlePermissionChange = async (advisorId: string, permissionKey: keyof AdvisorPermissions, checked: boolean) => {
    setIsLoading(true);
    try {
      await onUpdateAdvisorPermissions(advisorId, { [permissionKey]: checked });
      toast({
        title: "Permissions Updated",
        description: `Permission '${permissionLabels[permissionKey] || permissionKey}' for advisor has been ${checked ? 'enabled' : 'disabled'}.`,
      });
    } catch (caughtError: any) {
      console.error("Error updating permissions:", caughtError);
      toast({ title: "Error", description: caughtError.message || "Failed to update permissions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
    <TooltipProvider> {/* Added TooltipProvider for context */} 
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

        <ScrollArea className="h-[calc(100vh-450px)] min-h-[280px] border rounded-md p-2 bg-secondary/30">
          {advisors.length === 0 ? (
             <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
          ) : (
            <div className="space-y-4">
              {advisors.map((advisor) => {
                const isRemovingThis = removingId === advisor.id;
                const isEditingThis = editingAdvisorId === advisor.id;
                const currentPermissions = advisor.permissions || {} as AdvisorPermissions;

                return (
                  <Card key={advisor.id} className="p-4 border rounded-md">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold text-primary">{advisor.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{advisor.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {advisor.status === 'active' ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Pending</Badge>
                          )}
                        </p>
                      </div>
                      <div className="space-y-2 mt-4">
                        {Object.entries(currentPermissions).map(([key, checked]) => (
                          <div key={key}>
                            <Switch
                              checked={checked}
                              onCheckedChange={(value) => handlePermissionChange(advisor.id, key as keyof AdvisorPermissions, value)}
                              disabled={isLoading || !isAdmin}
                            />
                            <Label>{permissionLabels[key as keyof AdvisorPermissions] || key}</Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {isAdmin && (
                          <Select
                            value={advisor.role || 'Standard'}
                            onValueChange={async (role) => {
                              await onUpdateAdvisorRole(advisor.id, role as 'Standard' | 'Senior' | 'Captain');
                            }}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Standard">Standard</SelectItem>
                              <SelectItem value="Senior">Senior</SelectItem>
                              <SelectItem value="Captain">Captain</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {(advisor.admin_day_earned && (isAdmin || advisor.firebaseUid === currentUserId)) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="cursor-pointer">Admin Day</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>This advisor is eligible for an Admin Day this month.</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {(advisor.admin_day_earned && hasTopAccess) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="ml-2" onClick={async () => {
                                await onDismissAdminDayFlag(advisor.id, currentUser?.uid, currentUser?.displayName || currentUser?.email);
                              }}>Dismiss</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Grant Admin Day?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to mark this Admin Day as granted for {advisor.name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  // TODO: Call backend to dismiss flag
                                  toast({ title: 'Admin Day Granted', description: `Admin Day granted for ${advisor.name}` });
                                }}>Grant</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {(isAdmin || advisor.firebaseUid === currentUserId) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedHistory(expandedHistory === advisor.id ? null : advisor.id)}
                            aria-label="Toggle history"
                          >
                            {expandedHistory === advisor.id ? <ChevronUp /> : <ChevronDown />}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isEditingThis ? (
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={handleEdit} disabled={isLoading && !isEditingThis}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isLoading && !isEditingThis}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity self-start">
                            <Button variant="ghost" size="icon" onClick={() => startEditing(advisor)} aria-label={`Edit ${advisor.name}`} className="text-primary hover:bg-primary/10 h-7 w-7" disabled={isLoading || !!editingAdvisorId}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Remove ${advisor.name}`} className="text-destructive hover:bg-destructive/10 h-7 w-7" disabled={isLoading || !!editingAdvisorId}>
                                  {isRemovingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>
                                    Are you sure you want to remove advisor '${advisor.name}' ({advisor.email})?
                                    {advisor.status === 'active' && " This advisor has an active account."}
                                    This action cannot be undone.
                                </AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(advisor.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                                        {isRemovingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
       <CardFooter className="text-sm text-muted-foreground pt-4">
        Total Advisors: {advisors.length}
      </CardFooter>
    </Card>
    </TooltipProvider>
  );
}

