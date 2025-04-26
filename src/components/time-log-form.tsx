'use client';

import type { Advisor, LoggedEvent } from '@/types';
import * as React from 'react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { CalendarIcon, Clock, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TimeLogFormProps {
  advisors: Advisor[];
  onLogEvent: (event: LoggedEvent) => void;
}

const logTimeOptions = [10, 20, 30, 45, 60, 90, 120]; // Time options in minutes

const formSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  advisorId: z.string({ required_error: "Please select an advisor." }).min(1, "Please select an advisor."),
  eventTitle: z.string().min(1, { message: 'Event title is required.' }),
  loggedTime: z.string({ required_error: "Please select logged time." }).min(1, "Please select logged time."), // Store as string initially from select
});

export function TimeLogForm({ advisors, onLogEvent }: TimeLogFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      advisorId: '',
      eventTitle: '',
      loggedTime: '',
    },
  });

   function onSubmit(values: z.infer<typeof formSchema>) {
    const newEvent: LoggedEvent = {
      id: uuidv4(),
      date: format(values.date, 'yyyy-MM-dd'),
      advisorId: values.advisorId,
      eventTitle: values.eventTitle,
      loggedTime: parseInt(values.loggedTime, 10), // Convert logged time string to number
    };
    onLogEvent(newEvent);
    form.reset({
        date: new Date(), // Reset date to today
        advisorId: '', // Keep advisor selection or clear based on preference
        eventTitle: '',
        loggedTime: ''
    }); // Reset form after submission
     toast({
      title: "Success",
      description: "Time logged successfully.",
    });
  }

  return (
    <Card className="w-full shadow-lg mb-6">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Log New Time Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="advisorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advisor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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

            <FormField
              control={form.control}
              name="eventTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title or task description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="loggedTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Logged (minutes)</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                           <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select time duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

            <CardFooter className="p-0 pt-4">
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={advisors.length === 0}>
                 <PlusCircle className="mr-2 h-4 w-4" /> Log Time
              </Button>
            </CardFooter>
             {advisors.length === 0 && (
                 <p className="text-sm text-destructive text-center mt-2">Please add an advisor before logging time.</p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
