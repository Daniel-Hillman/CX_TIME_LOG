'use client';

import * as React from 'react';
import { useState, useCallback, useRef } from 'react'; // Added useRef
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Loader2, FileCheck2, CheckCircle, Copy, Eraser } from 'lucide-react'; // Added Eraser
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

type PolicyInfo = {
  policyNumber: string;
  status: string;
  missedPayments: string[];
  cancellationReason?: string;
  potentialCancellationDate?: string;
  currentGrossPremiumPerFrequency?: string;
  maxNextPremiumCollectionDate?: string;
  [key: string]: any;
};

// --- CSV Column Header Constants ---
const POLICY_NUMBER_COL = 'Policy Number';
const STATUS_COL = 'Policy Status';
const MISSED_PAYMENT_1_COL = 'Due Date of 1st Arrear';
const MISSED_PAYMENT_2_COL = 'Due Date of 2nd Arrear';
const MISSED_PAYMENT_3_COL = 'Due Date of 3rd Arrear';
const CANCELLATION_REASON_COL = 'Cancellation Reason';
const CURRENT_GROSS_PREMIUM_COL = 'Current Gross Premium Per Frequency';
const NEXT_PREMIUM_DATE_COL = 'Max. Next Premium Collection Date';

// --- Helper Functions ---

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split(' ')[0];
  const parts = datePart.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      try {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
          return date;
        } else {
          console.warn("Invalid date components created invalid Date object:", dateStr);
          return null;
        }
      } catch (e) {
        console.error("Error parsing date:", dateStr, e);
        return null;
      }
    } else {
      console.warn("Parsed date components seem invalid:", { day, month, year }, "from", dateStr);
    }
  }
  console.warn("Could not parse date string:", dateStr);
  return null;
}

function isLapsedStatus(status: string): boolean {
  const upperStatus = status.toUpperCase();
  return [
      'LAPSED',
      'TEMPORARILY_LAPSED',
      'PERMANENTLY_LAPSED'
  ].includes(upperStatus);
}

function checkNextPaymentCleared(policy: PolicyInfo): boolean {
  if (isLapsedStatus(policy.status)) {
    return false;
  }
  if (!(policy.missedPayments.length > 0 && policy.missedPayments.length < 3)) {
    return false;
  }
  const lastMissedPaymentDateStr = policy.missedPayments[policy.missedPayments.length - 1];
  const lastMissedPaymentDate = parseDate(lastMissedPaymentDateStr);
  if (!lastMissedPaymentDate) {
    console.warn("Could not parse lastMissedPaymentDate for 'cleared' check:", lastMissedPaymentDateStr);
    return false;
  }
  const clearedPaymentDueDate = new Date(lastMissedPaymentDate);
  clearedPaymentDueDate.setUTCMonth(clearedPaymentDueDate.getUTCMonth() + 1);

  if (!policy.maxNextPremiumCollectionDate) {
    return false;
  }
  const nextScheduledDueDate = parseDate(policy.maxNextPremiumCollectionDate);
  if (!nextScheduledDueDate) {
    console.warn("Could not parse maxNextPremiumCollectionDate for 'cleared' check:", policy.maxNextPremiumCollectionDate);
    return false;
  }
  if (nextScheduledDueDate.getTime() <= clearedPaymentDueDate.getTime()) {
    return false;
  }
  const currentDate = new Date();
  const currentUTCDate = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
  const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;
  const clearedDatePlus5Days = clearedPaymentDueDate.getTime() + fiveDaysInMillis;
  return currentUTCDate >= clearedDatePlus5Days;
}
// --- End Helper Functions ---

interface NextClearedBatchProps {}

const NextClearedBatch: React.FC<NextClearedBatchProps> = () => {
  const { toast } = useToast();
  const [dashboardFile, setDashboardFile] = useState<File | null>(null);
  const [clearedBatchFile, setClearedBatchFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<PolicyInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dashboardHeaders, setDashboardHeaders] = useState<string[]>([]);

  // Refs for file inputs
  const dashboardInputRef = useRef<HTMLInputElement>(null);
  const clearedBatchInputRef = useRef<HTMLInputElement>(null);

  const handleCopyToClipboard = useCallback(async (textToCopy: string) => {
    if (!navigator.clipboard) {
      toast({
        title: "Clipboard API Not Available",
        description: "Copying to clipboard is not supported or not allowed in this browser/context.",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: "Copied!", description: "Policy number copied to clipboard." });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      let description = "Could not copy policy number. Check browser console for details.";
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        description = "Clipboard access was denied. This may be due to browser permissions or security settings in this environment.";
      }
      toast({ 
        title: "Copy Failed", 
        description: description,
        variant: "destructive" 
      });
    }
  }, [toast]);

  const handleClearFiles = useCallback(() => {
    setDashboardFile(null);
    setClearedBatchFile(null);
    setProcessedData([]);
    setDashboardHeaders([]);
    if (dashboardInputRef.current) {
      dashboardInputRef.current.value = '';
    }
    if (clearedBatchInputRef.current) {
      clearedBatchInputRef.current.value = '';
    }
    toast({ title: "Inputs Cleared", description: "File inputs and results have been cleared." });
  }, [toast]);

  const handleDashboardFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setDashboardFile(file);
        setProcessedData([]); // Reset results when a new file is selected
      } else {
        toast({ title: "Invalid File Type", description: "Please upload a CSV file for the daily dashboard.", variant: "destructive" });
        event.target.value = '';
      }
    }
  }, [toast]);

  const handleClearedBatchFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.type === 'text/plain' || file.name.endsWith('.txt')) {
        setClearedBatchFile(file);
        setProcessedData([]); // Reset results when a new file is selected
      } else {
        toast({ title: "Invalid File Type", description: "Please upload a CSV or TXT file for the cleared batch.", variant: "destructive" });
        event.target.value = '';
      }
    }
  }, [toast]);

  const processFiles = useCallback(async () => {
    if (!dashboardFile || !clearedBatchFile) {
      toast({ title: "Files Missing", description: "Please upload both the daily dashboard and cleared batch files.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setProcessedData([]);
    setDashboardHeaders([]); // Also clear headers on new process

    try {
      const dashboardDataText = await dashboardFile.text();
      const clearedBatchText = await clearedBatchFile.text();

      let clearedPolicyNumbers = new Set<string>();
      if (clearedBatchFile.name.endsWith('.csv')) {
        Papa.parse(clearedBatchText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const firstHeader = results.meta.fields?.[0];
            results.data.forEach((row: any) => {
              const policyNumberValue = row[POLICY_NUMBER_COL] || (firstHeader ? row[firstHeader] : null);
              if (policyNumberValue && String(policyNumberValue).trim()) {
                clearedPolicyNumbers.add(String(policyNumberValue).trim());
              }
            });
          }
        });
      } else {
        clearedPolicyNumbers = new Set(clearedBatchText.replace(new RegExp('\x0D\x0A', 'g'), '\x0A').split('\x0A').map(line => line.trim()).filter(line => line));
      }
      
      if (clearedPolicyNumbers.size === 0) {
        toast({ title: "No Policies in Batch", description: "The cleared batch file is empty or contains no policy numbers.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      Papa.parse(dashboardDataText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const actualHeaders = results.meta.fields || [];
          setDashboardHeaders(actualHeaders);
          const policies: PolicyInfo[] = [];
          results.data.forEach((row: any) => {
            const policyNumber = row[POLICY_NUMBER_COL]?.trim();
            if (policyNumber && clearedPolicyNumbers.has(policyNumber)) {
              const policyEntry: PolicyInfo = {
                policyNumber,
                status: row[STATUS_COL]?.trim() || 'UNKNOWN',
                missedPayments: [
                  row[MISSED_PAYMENT_1_COL]?.trim(),
                  row[MISSED_PAYMENT_2_COL]?.trim(),
                  row[MISSED_PAYMENT_3_COL]?.trim(),
                ].filter((date): date is string => !!date && date.trim() !== ''),
                cancellationReason: row[CANCELLATION_REASON_COL]?.trim(),
                currentGrossPremiumPerFrequency: row[CURRENT_GROSS_PREMIUM_COL]?.trim(),
                maxNextPremiumCollectionDate: row[NEXT_PREMIUM_DATE_COL]?.trim()?.split(' ')[0],
              };

              actualHeaders.forEach(header => {
                if (!policyEntry.hasOwnProperty(header) && row[header] !== undefined) {
                    policyEntry[header] = String(row[header]); 
                }
              });

              if (checkNextPaymentCleared(policyEntry)) {
                policies.push(policyEntry);
              }
            }
          });
          setProcessedData(policies);
          if (policies.length > 0) {
            toast({ title: "Processing Complete", description: `${policies.length} matching and cleared policies found.` });
          } else {
            toast({ title: "No Matches Found", description: "No policies from the dashboard matched the cleared batch OR met the 'next payment cleared' criteria.", variant: "default" }); 
          }
        },
        error: (error) => {
          console.error("Error parsing dashboard CSV:", error);
          toast({ title: "Parsing Error", description: `Failed to parse dashboard CSV: ${error.message}`, variant: "destructive" });
        }
      });

    } catch (error) {
      console.error("Error processing files:", error);
      toast({ title: "Processing Error", description: "An unexpected error occurred while processing the files.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [dashboardFile, clearedBatchFile, toast]);

  const downloadResults = useCallback(() => {
    if (processedData.length === 0) {
      toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
      return;
    }
    const headers = dashboardHeaders.length > 0 ? dashboardHeaders : Object.keys(processedData[0] || {});
    const csvContent = Papa.unparse({
        fields: headers,
        data: processedData.map(policy => {
            return headers.map(header => policy[header] ?? ''); 
        })
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'next_cleared_batch_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: "The results file is being downloaded." });
  }, [processedData, dashboardHeaders, toast]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Next Cleared Batch Processing</CardTitle>
        <CardDescription>
          Upload the daily dashboard CSV and the cleared batch file (CSV or TXT)
          to find policies that have their next payment cleared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="dashboard-file-next-cleared" className="block text-sm font-medium text-gray-700">
            Daily Dashboard File (CSV)
          </label>
          <Input
            ref={dashboardInputRef} // Added ref
            id="dashboard-file-next-cleared" 
            type="file"
            accept=".csv"
            onChange={handleDashboardFileChange}
            className="mt-1"
          />
          {dashboardFile && <p className="text-xs text-gray-500 mt-1">Selected: {dashboardFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="cleared-batch-file-next-cleared" className="block text-sm font-medium text-gray-700">
            Cleared Batch File (CSV or TXT with policy numbers)
          </label>
          <Input
            ref={clearedBatchInputRef} // Added ref
            id="cleared-batch-file-next-cleared" 
            type="file"
            accept=".csv,.txt"
            onChange={handleClearedBatchFileChange}
            className="mt-1"
          />
          {clearedBatchFile && <p className="text-xs text-gray-500 mt-1">Selected: {clearedBatchFile.name}</p>}
        </div>

        <div className="flex space-x-2"> {/* Flex container for buttons */}
            <Button onClick={processFiles} disabled={isLoading || !dashboardFile || !clearedBatchFile} className="flex-grow">
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <FileCheck2 className="mr-2 h-4 w-4" />
            )}
            Process Files
            </Button>
            <Button onClick={handleClearFiles} variant="outline" disabled={isLoading && (!dashboardFile && !clearedBatchFile && processedData.length === 0 )}> {/* Disable if no files or results */}
                <Eraser className="mr-2 h-4 w-4" />
                Clear
            </Button>
        </div>

        {processedData.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-medium">Processed Results ({processedData.length} Matching & Cleared)</h3>
            <Button onClick={downloadResults} className="w-full mb-4" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download Results (CSV)
            </Button>

            <Accordion type="single" collapsible className="w-full">
              {processedData.map((policy) => (
                <AccordionItem 
                  value={policy.policyNumber} 
                  key={policy.policyNumber} 
                  className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 rounded-md mb-2"
                >
                  <AccordionTrigger className="text-green-700 dark:text-green-400 font-semibold hover:text-green-800 dark:hover:text-green-300 hover:no-underline px-3 py-3 text-sm">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center min-w-0"> {/* Added min-w-0 for truncate to work in flex */}
                            <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0" /> 
                            <span className="truncate">{policy.policyNumber}</span>
                        </div>
                        <Button 
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0 ml-2"
                            onClick={(e) => {
                                e.stopPropagation(); 
                                handleCopyToClipboard(policy.policyNumber);
                            }}
                            aria-label="Copy policy number"
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-3 px-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="space-y-1 pl-2 border-l-2 border-green-500 dark:border-green-700 ml-2">
                      <p>
                        <strong>Status:</strong> <span className="font-medium">{policy.status.replace(/_/g, ' ').toUpperCase()}</span>
                      </p>
                      <p>
                        <strong>Missed Payments:</strong> 
                        {policy.missedPayments.length > 0 ? policy.missedPayments.join(', ') : 'None'}
                      </p>
                      {policy.maxNextPremiumCollectionDate && (
                        <p>
                          <strong>Next Premium Collection:</strong> {policy.maxNextPremiumCollectionDate}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NextClearedBatch;
