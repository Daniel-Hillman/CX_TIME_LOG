'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, HelpCircle, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { auth } from '../../lib/firebase'; // Adjusted path if necessary, should be correct
import { onAuthStateChanged, User } from 'firebase/auth';

const PROVIDER_OPTIONS = ['TOM', 'POLLY', 'WINSTON'] as const;
type ProviderOption = typeof PROVIDER_OPTIONS[number];

const AgentPage = () => { // Renamed component
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // State for Message Enhancer
  const [draftMessage, setDraftMessage] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>(PROVIDER_OPTIONS[0]);
  const [enhancedMessage, setEnhancedMessage] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // State for Business Q&A
  const [businessQuestion, setBusinessQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleEnhanceMessage = async () => {
    if (!draftMessage.trim()) {
      setEnhanceError('Draft message cannot be empty.');
      return;
    }
    if (!selectedProvider) {
      setEnhanceError('Please select a provider.');
      return;
    }
    setIsEnhancing(true);
    setEnhanceError(null);
    setEnhancedMessage('');
    try {
      const response = await fetch('/api/enhance-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftMessage, provider: selectedProvider }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const advisorName = currentUser?.displayName || currentUser?.email || "Advisor";
      const signOff = `

Kind regards,
${advisorName}
${selectedProvider}`;
      setEnhancedMessage(data.aiImprovedBody + signOff);
    } catch (error: any) {
      setEnhanceError(error.message || 'Failed to enhance message.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!businessQuestion.trim()) {
      setAskError('Question cannot be empty.');
      return;
    }
    setIsAsking(true);
    setAskError(null);
    setAiAnswer('');
    try {
      const response = await fetch('/api/ask-business-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessQuestion }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setAiAnswer(data.answer);
    } catch (error: any) {
      setAskError(error.message || 'Failed to get answer.');
    } finally {
      setIsAsking(false);
    }
  };

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
          <CardTitle className="flex items-center"><Wand2 className="mr-2 h-6 w-6 text-primary" /> Enhance Your Message</CardTitle>
          <CardDescription>
            Hello {currentUser?.displayName || currentUser?.email || "Advisor"}! Select a provider, then draft your customer message (email or SMS) below. Our AI will help refine it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="provider-select" className="block text-sm font-medium text-muted-foreground mb-1">Provider</label>
            <Select value={selectedProvider} onValueChange={(value: ProviderOption) => setSelectedProvider(value)}>
              <SelectTrigger id="provider-select" className="w-full md:w-1/2 lg:w-1/3">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map(provider => (
                  <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Type your draft message here..."
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            rows={8}
            disabled={isEnhancing || !currentUser}
          />
          <Button onClick={handleEnhanceMessage} disabled={isEnhancing || !draftMessage.trim() || !selectedProvider || !currentUser}>
            {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} 
            Enhance Message
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><HelpCircle className="mr-2 h-6 w-6 text-primary" /> Ask a Business Question</CardTitle>
          <CardDescription>
            Ask questions about business processes, policies, or any job-related queries. The AI will answer based on its training data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your business question here..."
            value={businessQuestion}
            onChange={(e) => setBusinessQuestion(e.target.value)}
            rows={5}
            disabled={isAsking || !currentUser}
          />
          <Button onClick={handleAskQuestion} disabled={isAsking || !businessQuestion.trim() || !currentUser}>
            {isAsking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HelpCircle className="mr-2 h-4 w-4" />} 
            Get Answer
          </Button>
          {askError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{askError}</AlertDescription>
            </Alert>
          )}
          {aiAnswer && (
            <div className="space-y-2 pt-4">
              <h3 className="text-lg font-semibold">Answer:</h3>
              <Textarea
                value={aiAnswer}
                readOnly
                rows={8}
                className="bg-muted"
              />
              <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(aiAnswer, 'AI Answer')} className="mt-2">
                <Copy className="mr-2 h-4 w-4" /> Copy Answer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentPage; // Exporting the renamed component
