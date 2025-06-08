// AgentPage: contains "Improve Your Message" and "Ask a Question" features for advisors, with OpenAI integration and brand sign-off.

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, HelpCircle, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getAdvisorByFirebaseUid, getAdvisorByEmail } from '@/lib/firestoreService';

const BRAND_OPTIONS = ['Polly', 'Tom', 'Winston', 'Custom'] as const;
type BrandOption = typeof BRAND_OPTIONS[number];

const AgentPage = () => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [advisorName, setAdvisorName] = useState<string>("");

  // State for Message Enhancer
  const [draftMessage, setDraftMessage] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<BrandOption>('Polly');
  const [customBrand, setCustomBrand] = useState<string>('');
  const [enhancedMessage, setEnhancedMessage] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // State for Business Q&A - Retained for potential future use but UI will be disabled
  const [businessQuestion, setBusinessQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        let advisorDoc = await getAdvisorByFirebaseUid(user.uid);
        if (!advisorDoc && user.email) {
          advisorDoc = await getAdvisorByEmail(user.email);
        }
        console.log('Fetched advisorDoc:', advisorDoc, 'for uid:', user.uid, 'and email:', user.email);
        setAdvisorName(advisorDoc?.name || "Advisor");
      } else {
        setAdvisorName("");
      }
    });
    return () => unsubscribe();
  }, []);

  const getBrandForSignOff = () => {
    return selectedBrand === 'Custom' && customBrand.trim() ? customBrand.trim() : selectedBrand;
  };

  const handleEnhanceMessage = async () => {
    if (!draftMessage.trim()) {
      setEnhanceError('Draft message cannot be empty.');
      return;
    }
    if (!selectedBrand) {
      setEnhanceError('Please select a brand.');
      return;
    }
    if (selectedBrand === 'Custom' && !customBrand.trim()) {
      setEnhanceError('Please enter a custom brand name.');
      return;
    }
    setIsEnhancing(true);
    setEnhanceError(null);
    setEnhancedMessage('');
    try {
      const response = await fetch('/api/enhance-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftMessage, provider: getBrandForSignOff(), advisorName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setEnhancedMessage(data.aiImprovedBody);
    } catch (error: any) {
      setEnhanceError(error.message || 'Failed to enhance message.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // handleAskQuestion is no longer called from the UI but logic retained for future
  // const handleAskQuestion = async () => { ... };

  const handleCopyToClipboard = (textToCopy: string, type: string) => {
    if (navigator.clipboard && textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          toast({
            title: "Copied!",
            description: `${type} copied to clipboard.`,
            duration: 3000,
          });
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          toast({
            title: "Error",
            description: "Failed to copy to clipboard.",
            variant: "destructive",
            duration: 3000,
          });
        });
    } else if (textToCopy) {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
            title: "Copied!",
            description: `${type} copied to clipboard.`,
            duration: 3000,
          });
      } catch (err) {
        console.error('Fallback copy failed: ', err);
         toast({
            title: "Error",
            description: "Failed to copy to clipboard.",
            variant: "destructive",
            duration: 3000,
          });
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Wand2 className="mr-2 h-6 w-6 text-primary" /> Improve Your Message</CardTitle>
          <CardDescription>
            Hello {currentUser?.displayName || currentUser?.email || "Advisor"}! Select a brand, then draft your customer message (email or SMS) below. Our AI will help refine it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="brand-select" className="block text-sm font-medium text-muted-foreground mb-1">Brand</label>
            <Select value={selectedBrand} onValueChange={(value: BrandOption) => setSelectedBrand(value)} disabled={!currentUser}>
              <SelectTrigger id="brand-select" className="w-full md:w-1/2 lg:w-1/3">
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_OPTIONS.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBrand === 'Custom' && (
              <input
                type="text"
                className="mt-2 block w-full md:w-1/2 lg:w-1/3 border rounded px-2 py-1 text-sm"
                placeholder="Enter custom brand name"
                value={customBrand}
                onChange={e => setCustomBrand(e.target.value)}
                maxLength={40}
                aria-label="Custom brand name"
                disabled={!currentUser}
              />
            )}
          </div>
          <Textarea
            placeholder="Type your draft message here..."
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            rows={8}
            disabled={isEnhancing || !currentUser}
          />
          <Button 
            onClick={handleEnhanceMessage} 
            disabled={isEnhancing || !draftMessage.trim() || !selectedBrand || (selectedBrand === 'Custom' && !customBrand.trim()) || !currentUser}
          >
            {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} 
            Generate
          </Button>
          {enhanceError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{enhanceError}</AlertDescription>
            </Alert>
          )}
          {enhancedMessage && (
            <div className="space-y-2 pt-4">
              <h3 className="text-lg font-semibold">Suggested Improvement:</h3>
              <Textarea
                value={enhancedMessage}
                readOnly
                rows={10}
                className="bg-muted border-green-500 focus:ring-green-500"
              />
               <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(enhancedMessage, 'Enhanced message')} className="mt-2">
                 <Copy className="mr-2 h-4 w-4" /> Copy to Clipboard
               </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="opacity-60 pointer-events-none select-none">
        <CardHeader>
          <CardTitle className="flex items-center"><HelpCircle className="mr-2 h-6 w-6 text-primary" /> Ask a Question</CardTitle>
          <CardDescription>
            This agent is currently being trained, check back soon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col items-center justify-center min-h-[200px]">
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <HelpCircle className="mx-auto h-12 w-12 text-primary/70 mb-4" />
            <p className="text-2xl font-semibold text-foreground">Coming soon...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Our AI is undergoing advanced training. This feature will be available shortly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentPage;
// End of AgentPage
