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
    <TooltipProvider>
      <div className="flex flex-col gap-8 w-full">
        {/* Add Advisor Section */}
        <Card className="w-full max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Add New Advisor</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Fill in the details to add a new advisor to your team.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <Input
                ref={addNameInputRef}
                type="text"
                placeholder="Name"
                value={newAdvisorName}
                onChange={(e) => setNewAdvisorName(e.target.value)}
                aria-label="New advisor name"
                disabled={isLoading || !!editingAdvisorId}
                className="sm:w-48"
              />
              <Input
                ref={addEmailInputRef}
                type="email"
                placeholder="Email (@clark.io)"
                value={newAdvisorEmail}
                onChange={(e) => setNewAdvisorEmail(e.target.value)}
                aria-label="New advisor email"
                disabled={isLoading || !!editingAdvisorId}
                onKeyDown={(e) => !isLoading && !editingAdvisorId && e.key === 'Enter' && handleAdd()}
                className="sm:w-64"
              />
              <Button
                onClick={handleAdd}
                aria-label="Add Advisor"
                variant="default"
                className="w-full sm:w-auto"
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
          </CardContent>
        </Card>

        {/* Advisor List Section */}
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Manage Advisors</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">View, edit, and manage permissions for all advisors.</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-450px)] min-h-[280px] border rounded-md p-2 bg-secondary/30">
              {advisors.length === 0 ? (
                <p className="text-center text-muted-foreground p-4">No advisors added yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground border-b">
                    <div className="col-span-2">Advisor</div>
                    <div className="col-span-2">Email</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-3">Permissions</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {advisors.map((advisor) => {
                    const isRemovingThis = removingId === advisor.id;
                    const isEditingThis = editingAdvisorId === advisor.id;
                    const currentPermissions = advisor.permissions || {} as AdvisorPermissions;
                    // Avatar/Initials
                    const initials = advisor.name.split(' ').map(n => n[0]).join('').toUpperCase();
                    return (
                      <div key={advisor.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-card rounded-lg p-3 group border hover:shadow-md transition-all">
                        {/* Advisor Avatar & Name */}
                        <div className="flex items-center gap-3 col-span-2">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-primary">{advisor.name}</div>
                            <div className="md:hidden text-xs text-muted-foreground">{advisor.email}</div>
                          </div>
                        </div>
                        {/* Email */}
                        <div className="hidden md:block col-span-2 text-xs text-muted-foreground">{advisor.email}</div>
                        {/* Status */}
                        <div className="col-span-1">
                          {advisor.status === 'active' ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Pending</Badge>
                          )}
                        </div>
                        {/* Role */}
                        <div className="col-span-2 flex items-center gap-2">
                          <Badge variant={advisor.role === 'Captain' ? 'default' : advisor.role === 'Senior' ? 'secondary' : 'outline'} className="capitalize">
                            {advisor.role || 'Standard'}
                          </Badge>
                          {isAdmin && (
                            <Select
                              value={advisor.role || 'Standard'}
                              onValueChange={async (role) => {
                                await onUpdateAdvisorRole(advisor.id, role as 'Standard' | 'Senior' | 'Captain');
                              }}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
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
                        {/* Permissions */}
                        <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(currentPermissions).map(([key, checked]) => (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 p-1 min-w-0">
                                  <Switch
                                    checked={checked}
                                    onCheckedChange={(value) => handlePermissionChange(advisor.id, key as keyof AdvisorPermissions, value)}
                                    disabled={isLoading || !isAdmin}
                                    className="scale-90"
                                  />
                                  <Label className="text-xs cursor-pointer break-words truncate max-w-[120px]" title={permissionLabels[key as keyof AdvisorPermissions] || key}>
                                    {permissionLabels[key as keyof AdvisorPermissions] || key}
                                  </Label>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {permissionLabels[key as keyof AdvisorPermissions] || key}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="col-span-2 flex justify-end gap-1">
                          {isEditingThis ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={handleEdit} disabled={isLoading && !isEditingThis}>Save</Button>
                              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isLoading && !isEditingThis}>Cancel</Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
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
                                      Are you sure you want to remove advisor '{advisor.name}' ({advisor.email})?
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
                      </div>
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
      </div>
    </TooltipProvider>
  );
}

