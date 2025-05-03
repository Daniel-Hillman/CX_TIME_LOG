'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Password validation regex: checks for minimum length, one uppercase, one number
const passwordValidation = new RegExp(
  /^(?=.*[A-Z])(?=.*\d).{6,}$/
);

const formSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address.' })
    .refine(email => email.endsWith('@clark.io'), {
      message: 'Sign up requires a @clark.io email address.',
    }),
  password: z.string()
    .min(6, { message: 'Password must be at least 6 characters.' })
    .regex(passwordValidation, {
      message: 'Password must contain at least one uppercase letter and one number.',
    })
});

export function SignUpForm() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Domain and password complexity checks are handled by Zod schema validation
    try {
      await createUserWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'Sign Up Successful',
        description: 'Your account has been created. Please log in.',
      });
      form.reset();
    } catch (error) {
      console.error('Sign Up Error:', error);
      let errorMessage = 'An error occurred during sign up.';

      if (error instanceof FirebaseError) {
          // Handle specific Firebase errors like email already in use
          if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'This email address is already registered.';
          } else {
              errorMessage = error.message; // Use other Firebase error messages
          }
      } else if (error instanceof Error) {
          errorMessage = error.message;
      }

      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Sign Up</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (@clark.io only)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="advisor@clark.io" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Min. 6 chars, 1 uppercase, 1 number" {...field} />
                  </FormControl>
                  <FormMessage /> {/* Zod error message will appear here */}
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Sign Up
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
