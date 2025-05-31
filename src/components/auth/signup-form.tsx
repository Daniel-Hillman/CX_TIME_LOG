
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, UserCredential } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react'; // Added Loader2

const ADVISORS_COLLECTION = 'advisors';

const passwordValidation = new RegExp(
  /^(?=.*[A-Z])(?=.*\d).{6,}$/
);

const formSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address.' })
    .refine(email => email.toLowerCase().endsWith('@clark.io'), { // Ensure emails are checked case-insensitively for domain
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
  const [isSubmitting, setIsSubmitting] = React.useState(false); // Loading state

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const lowerCaseEmail = values.email.toLowerCase();

    try {
      // 1. Check if email is pre-approved and pending
      const advisorsRef = collection(db, ADVISORS_COLLECTION);
      const q = query(advisorsRef, where("email", "==", lowerCaseEmail), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          title: 'Sign Up Failed',
          description: 'This email address is not authorized for sign-up or has already been activated. Please contact an administrator.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Assuming email is unique in advisors collection, so only one doc should be found
      const advisorDoc = querySnapshot.docs[0];

      // 2. Create Firebase Auth user
      let userCredential: UserCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, lowerCaseEmail, values.password);
      } catch (authError) {
        console.error('Firebase Auth Error:', authError);
        let errorMessage = 'An error occurred during sign up with Firebase Authentication.';
        if (authError instanceof FirebaseError) {
          if (authError.code === 'auth/email-already-in-use') {
            // This case might mean the advisor was pre-approved, tried to sign up, failed, and admin didn't reset them.
            // Or, someone else used that @clark.io email.
            // For now, we treat it as a general auth error, but could be more specific.
            errorMessage = 'This email is already registered in Firebase Authentication. If you believe this is an error, contact an administrator.';
             // Potentially update the advisor doc to 'active' if the email matches and there's an existing firebaseUid
             // This is complex recovery logic, for now, just error out.
          } else {
            errorMessage = authError.message;
          }
        } else if (authError instanceof Error) {
          errorMessage = authError.message;
        }
        toast({ title: 'Sign Up Failed', description: errorMessage, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      // 3. Update advisor document in Firestore
      const advisorDocRef = doc(db, ADVISORS_COLLECTION, advisorDoc.id);
      await updateDoc(advisorDocRef, {
        status: 'active',
        firebaseUid: userCredential.user.uid,
      });

      toast({
        title: 'Sign Up Successful',
        description: 'Your account has been created and activated. Please log in.',
      });
      form.reset();

    } catch (error) {
      console.error('Sign Up Process Error:', error);
      let errorMessage = 'An unexpected error occurred during sign up.';
       if (error instanceof FirebaseError) { // Firestore or other Firebase errors
          errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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
                    <Input type="email" placeholder="advisor@clark.io" {...field} disabled={isSubmitting} />
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
                    <Input type="password" placeholder="Min. 6 chars, 1 uppercase, 1 number" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Signing Up...' : 'Sign Up'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
