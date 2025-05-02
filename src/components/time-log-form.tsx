
'use client';

import { standardEventTypes } from '@/types';
// Removed Task type import
import type { Advisor, LoggedEvent, StandardEventType } from '@/types';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { FirebaseError } from 'firebase/app';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
// Removed ListTodo icon
import { CalendarIcon, Clock, PlusCircle, Loader2, Save, X, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Zod schema updated to remove taskId
const formSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  advisorId: z.string({ required_error: "Please select an advisor." }).min(1, "Please select an advisor."),
  // Removed taskId field
  // taskId: z.string().optional(),
  eventType: z.enum(standardEventTypes, { required_error: "Please select an event type." }),
  eventDetails: z.string().optional(),
  loggedTime: z.number({ required_error: "Please select logged time." }).min(1, { message: "Time must be at least 1 minute." }),
}).refine(data => {
  if (data.eventType === 'Other') {
    return !!data.eventDetails && typeof data.eventDetails === 'string' && data.eventDetails.trim().length > 0;
  }
  return true;
}, {
  message: "Please provide details for the 'Other' event type.",
  path: ['eventDetails'],
});

type TimeLogFormData = z.infer<typeof formSchema>;

interface TimeLogFormProps {
  advisors: Advisor[];
  // Removed tasks prop
  // tasks: Task[];
  onLogEvent: (event: Omit<LoggedEvent, 'userId' | 'id' | 'eventType' | 'taskId'> & { eventType: StandardEventType; /* taskId?: string */ }) => Promise<void>;
  onUpdateEvent: (eventId: string, eventData: Omit<LoggedEvent, 'userId' | 'id' | 'eventType' | 'taskId'> & { eventType: StandardEventType; /* taskId?: string */ }) => Promise<void>;
  onCancelEdit: () => void;
  eventToEdit?: Omit<LoggedEvent, 'eventType'> & { eventType: StandardEventType } | null;
  isSubmitting: boolean;
}

const logTimeOptions = [5, 10, 15, 30, 45, 60, 90, 120];

// *** Updated initial default values to remove taskId ***
const initialDefaultValues: Omit<TimeLogFormData, 'date'> & { date: Date | undefined } = {
    date: undefined, // Will be set to new Date() later
    advisorId: '',
    // taskId: undefined, // Removed
    eventType: standardEventTypes[0],
    eventDetails: '',
    loggedTime: 0,
};

export function TimeLogForm({
    advisors,
    // tasks, // Removed
    onLogEvent,
    onUpdateEvent,
    onCancelEdit,
    eventToEdit,
    isSubmitting
}: TimeLogFormProps) {
  const { toast } = useToast();
  const isEditMode = !!eventToEdit;

  // *** Update defaultValues logic to remove taskId ***
  const form = useForm<TimeLogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: eventToEdit
      ? {
          date: parseISO(eventToEdit.date),
          advisorId: eventToEdit.advisorId,
          // taskId: eventToEdit.taskId || undefined, // Removed
          eventType: eventToEdit.eventType,
          eventDetails: eventToEdit.eventDetails || '',
          loggedTime: eventToEdit.loggedTime,
        }
      : { ...initialDefaultValues, date: new Date() },
    mode: 'onChange',
  });

  const watchedEventType = form.watch('eventType');

  // *** Update useEffect hook reset logic to remove taskId ***
  useEffect(() => {
    if (eventToEdit) {
      form.reset({
        date: parseISO(eventToEdit.date),
        advisorId: eventToEdit.advisorId,
        // taskId: eventToEdit.taskId || undefined, // Removed
        eventType: eventToEdit.eventType,
        eventDetails: eventToEdit.eventDetails || '',
        loggedTime: eventToEdit.loggedTime,
      });
    } else {
       form.reset({ ...initialDefaultValues, date: new Date() }); // No longer resets taskId
    }
  }, [eventToEdit, form]);

   async function onSubmit(values: TimeLogFormData) {
    if (!(values.date instanceof Date) || isNaN(values.date.getTime())) {
       toast({ title: "Invalid Date", description: "Please select a valid date.", variant: "destructive"});
       return;
    }

    // *** Update eventData to remove taskId ***
    const eventData: Omit<LoggedEvent, 'userId' | 'id' | 'eventType' | 'taskId'> & { eventType: StandardEventType; /* taskId?: string */ } = {
      date: format(values.date, 'yyyy-MM-dd'),
      advisorId: values.advisorId,
      eventType: values.eventType,
      // Removed taskId handling
      // ...(values.taskId && { taskId: values.taskId }),
      ...(values.eventType === 'Other' && values.eventDetails && typeof values.eventDetails === 'string' && { eventDetails: values.eventDetails.trim() }),
      loggedTime: values.loggedTime,
    };

    if (values.eventType !== 'Other') {
        delete (eventData as Partial<typeof eventData>).eventDetails;
    }

    // No need to explicitly delete taskId

    try {
      if (isEditMode && eventToEdit) {
        await onUpdateEvent(eventToEdit.id, eventData);
         toast({ title: "Success", description: "Event updated successfully." });
          onCancelEdit();
      } else {
        await onLogEvent(eventData);
         toast({ title: "Success", description: "Time logged successfully." });
         form.reset({ ...initialDefaultValues, date: new Date() }); // No longer resets taskId
      }

    } catch (error) {
       console.error(`Error ${isEditMode ? 'updating' : 'submitting'} time log from form:`, error);
       let errorMessage = `Failed to ${isEditMode ? 'update' : 'log'} event. Please try again.`;
       if (error instanceof FirebaseError) {
         errorMessage = error.message;
       } else if (error instanceof Error) {
         errorMessage = error.message;
       }
       toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  }

  return (
    <Card className="w-full shadow-lg mb-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">
          {isEditMode ? 'Edit Time Entry' : 'Log New Time Entry'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Date and Advisor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Field */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                     <Popover>
                       <PopoverTrigger asChild>
                         <FormControl>
                           <Button
                             variant={"outline"}
                             disabled={isSubmitting}
                             className={cn(
                               "w-full justify-start text-left font-normal",
                               !(field.value instanceof Date) && "text-muted-foreground"
                             )}
                           >
                             <CalendarIcon className="mr-2 h-4 w-4" />
                             {field.value instanceof Date && !isNaN(field.value.getTime())
                                ? format(field.value, "PPP")
                                : <span>Pick a date</span>}
                           </Button>
                         </FormControl>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="start">
                         <Calendar
                           mode="single"
                           selected={field.value instanceof Date ? field.value : undefined}
                           onSelect={field.onChange}
                           disabled={(date) => date < new Date("1900-01-01") || isSubmitting}
                           initialFocus
                         />
                       </PopoverContent>
                     </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Advisor Field */}
              <FormField
                control={form.control}
                name="advisorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advisor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an advisor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {advisors.length === 0 ? (
                           <SelectItem value="-" disabled>No advisors available</SelectItem>
                        ) : (
                           advisors.map((advisor) => (
                            <SelectItem key={advisor.id} value={advisor.id}>
                              {advisor.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

             {/* Row 2: Event Type and Logged Time (Task Removed) */}
             {/* Updated grid layout to 1 or 2 columns depending on 'Other' event type */}
             <div className={cn("grid grid-cols-1 gap-4", watchedEventType === 'Other' ? "" : "md:grid-cols-2")}>
                {/* Event Type Field */}
                <FormField
                    control={form.control}
                    name="eventType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Event Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <FormControl>
                            <SelectTrigger>
                                <ListChecks className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {standardEventTypes.map((type: StandardEventType) => (
                                <SelectItem key={type} value={type}>
                                {type}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                {/* Removed Task Field */}
                {/* <FormField ... taskId ... /> */}

                {/* Logged Time Field (Now in Row 2 if event type is not 'Other') */}
                <FormField
                  control={form.control}
                  name="loggedTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Logged (minutes)</FormLabel>
                       <Select
                           onValueChange={(value) => {
                               const parsedValue = parseInt(value, 10);
                               field.onChange(isNaN(parsedValue) ? 0 : parsedValue);
                           }}
                           value={field.value ? field.value.toString() : ''}
                           disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                               <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Select time duration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0" disabled={!isEditMode && field.value === 0}>Select time duration</SelectItem>
                            {logTimeOptions.map((time) => (
                              <SelectItem key={time} value={time.toString()}>
                                {time} min
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>

            {/* Conditional Event Details (Row 3, only if Event Type is Other) */}
            {watchedEventType === 'Other' && (
                <FormField
                    control={form.control}
                    name="eventDetails"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Details for &quot;Other&quot;</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="Please specify the details for the 'Other' event..."
                            {...field}
                            value={field.value || ''}
                            disabled={isSubmitting}
                            rows={3}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}


            {/* Footer Buttons */}
            <CardFooter className={cn("p-0 pt-4 flex gap-2", isEditMode ? "justify-between" : "justify-end")}>
              {isEditMode && (
                <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSubmitting}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              )}
              <Button
                  type="submit"
                  className={cn("bg-accent text-accent-foreground hover:bg-accent/90", isEditMode ? "" : "w-full")}
                  disabled={advisors.length === 0 || isSubmitting}
               >
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditMode ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
                 {isSubmitting ? (isEditMode ? 'Saving...' : 'Logging...') : (isEditMode ? 'Save Changes' : 'Log Time')}
              </Button>
            </CardFooter>
             {advisors.length === 0 && !isEditMode && (
                 <p className="text-sm text-destructive text-center mt-2">Please add an advisor before logging time.</p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
