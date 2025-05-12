'use client';

import * as React from 'react';
import { useState, useCallback, useRef } from 'react'; // Added useRef
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Loader2, FileCheck2, CheckCircle, Copy, Eraser, FileText, FileType } from 'lucide-react'; // Added Eraser, FileText, FileType
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
  startingDate?: string; // Add Starting Date field
  [key: string]: any; // Allows for any other fields from the CSV
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
const STARTING_DATE_COL = 'Starting Date'; // Constant for Starting Date

// --- Unwanted Header Constants for Filtering Output ---
const UNWANTED_HEADERS = [
    'Distribution Partner',
    'Product Name',
    'Sales Channel',
    'Sold Date'
];

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

// Helper to extract numeric part of policy number for sorting
function extractPolicyNumberNumeric(policyNumber: string): number {
  const match = policyNumber.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
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
        setProcessedData([]);
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
        setProcessedData([]);
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
    setDashboardHeaders([]);

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
        // Use correct regex to split by newline (\n) or carriage return + newline (\r\n)
        clearedPolicyNumbers = new Set(clearedBatchText.split(/\r?\n/).map(line => line.trim()).filter(line => line && line.length > 0));
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
                startingDate: row[STARTING_DATE_COL]?.trim()?.split(' ')[0], // Extract Starting Date
              };

              // Dynamically add all other headers from the CSV to the policy object
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

          // Sort policies numerically based on the number part of the policy number
          policies.sort((a, b) => {
            const numA = extractPolicyNumberNumeric(a.policyNumber);
            const numB = extractPolicyNumberNumeric(b.policyNumber);
            return numA - numB;
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

  const generateTextReport = (data: PolicyInfo[], headersToInclude: string[]): string => {
    let report = "Next Cleared Batch Report\n";
    report += "=====================================\n\n";
    data.forEach((policy, index) => {
      report += `Policy #${index + 1}\n`;
      report += `-------------------------------------\n`;
       // Filter headers before iterating for the report
       headersToInclude
        .filter(header => !UNWANTED_HEADERS.includes(header)) // Exclude unwanted headers
        .forEach(header => {
            // Handle array missedPayments specifically for text report
            if (header === 'missedPayments') {
                report += `Missed Payments: ${policy.missedPayments.length > 0 ? policy.missedPayments.join(', ') : 'None'}\n`;
            } else {
                const value = policy[header] ?? 'N/A';
                report += `${header}: ${value}\n`;
            }
       });
      report += "\n";
    });
    return report;
  };

  const downloadResults = useCallback((format: 'csv' | 'txt' | 'pdf') => {
    if (processedData.length === 0) {
      toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
      return;
    }

    // Determine headers for the CSV based on the original file
    const csvHeaders = dashboardHeaders.length > 0 ? dashboardHeaders : (processedData.length > 0 ? Object.keys(processedData[0]) : []);

    let fileContent: string;
    let mimeType: string;
    let fileName: string;

    // Define specific headers for the TXT/PDF report, EXCLUDING unwanted ones
    const textReportHeaders = [
      POLICY_NUMBER_COL,
      STATUS_COL,
      'missedPayments', // Use the key name for the array
      NEXT_PREMIUM_DATE_COL,
      CURRENT_GROSS_PREMIUM_COL,
      // Add any other relevant headers *except* those in UNWANTED_HEADERS
      // For example, if 'Policy Type' was relevant, add it here.
      // We don't need to explicitly add all here, just the core ones.
      // The generateTextReport function will use this list.
    ].filter(header => !UNWANTED_HEADERS.includes(header)); // Ensure unwanted are filtered out here too

    switch (format) {
      case 'txt':
      case 'pdf': // For now, PDF will be a text file
        fileContent = generateTextReport(processedData, textReportHeaders);
        mimeType = 'text/plain;charset=utf-8;';
        fileName = `next_cleared_batch_results.${format}`;
        break;
      case 'csv':
      default:
        // CSV will contain all original headers from the input file
        fileContent = Papa.unparse({
            fields: csvHeaders, // Use all original headers
            data: processedData.map(policy => {
                return csvHeaders.map(header => {
                     // Join array fields for CSV, leave others as is
                    const value = policy[header];
                    return Array.isArray(value) ? value.join('; ') : (value ?? '');
                });
            })
        });
        mimeType = 'text/csv;charset=utf-8;';
        fileName = 'next_cleared_batch_results.csv';
        break;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: `The results file (${fileName}) is being downloaded.` });
  }, [processedData, dashboardHeaders, toast]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Next Cleared Batch Processing</CardTitle>
        <CardDescription>
          Upload the daily dashboard CSV and the cleared batch file (CSV or TXT)
          to find policies that have their next payment cleared. Results are sorted by policy number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="dashboard-file-next-cleared" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Daily Dashboard File (CSV)
          </label>
          <Input
            ref={dashboardInputRef}
            id="dashboard-file-next-cleared"
            type="file"
            accept=".csv"
            onChange={handleDashboardFileChange}
            className="mt-1"
          />
          {dashboardFile && <p className="text-xs text-muted-foreground mt-1">Selected: {dashboardFile.name}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="cleared-batch-file-next-cleared" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Cleared Batch File (CSV or TXT with policy numbers)
          </label>
          <Input
            ref={clearedBatchInputRef}
            id="cleared-batch-file-next-cleared"
            type="file"
            accept=".csv,.txt"
            onChange={handleClearedBatchFileChange}
            className="mt-1"
          />
          {clearedBatchFile && <p className="text-xs text-muted-foreground mt-1">Selected: {clearedBatchFile.name}</p>}
        </div>

        <div className="flex space-x-2">
            <Button onClick={processFiles} disabled={isLoading || !dashboardFile || !clearedBatchFile} className="flex-grow">
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <FileCheck2 className="mr-2 h-4 w-4" />
            )}
            Process Files
            </Button>
            <Button onClick={handleClearFiles} variant="outline" disabled={isLoading && (!dashboardFile && !clearedBatchFile && processedData.length === 0 )}>
                <Eraser className="mr-2 h-4 w-4" />
                Clear
            </Button>
        </div>

        {processedData.length > 0 && (
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-medium">Processed Results ({processedData.length} Matching &amp; Cleared)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button onClick={() => downloadResults('csv')} className="w-full" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                </Button>
                <Button onClick={() => downloadResults('txt')} className="w-full" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Download TXT
                </Button>
                <Button onClick={() => downloadResults('pdf')} className="w-full" variant="outline">
                    <FileType className="mr-2 h-4 w-4" />
                    Download PDF (Text)
                </Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {processedData.map((policy) => (
                <AccordionItem
                  value={policy.policyNumber}
                  key={policy.policyNumber}
                  className="border-b rounded-md mb-2"
                >
                  <AccordionTrigger
                    className="font-semibold hover:no-underline px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center min-w-0">
                            <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-500" />
                            <span className="truncate">{policy.policyNumber}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
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
                  <AccordionContent className="pt-2 pb-3 px-3 text-sm text-foreground">
                    <div className="space-y-1 pl-2 border-l-2 border-muted dark:border-muted-foreground/30 ml-2">
                      {/* Status */}
                      <p>
                        <strong>Status:</strong> <span className="font-medium">{policy.status.replace(/_/g, ' ').toUpperCase()}</span>
                      </p>
                      {/* Missed Payments */}
                      <p>
                        <strong>Missed Payments:</strong>
                        {policy.missedPayments.length > 0 ? policy.missedPayments.join(', ') : 'None'}
                      </p>
                      {/* Next Premium Collection */}
                      {policy.maxNextPremiumCollectionDate && (
                        <p>
                          <strong>Next Premium Collection:</strong> {policy.maxNextPremiumCollectionDate}
                        </p>
                      )}
                      {/* Starting Date */}
                       {policy.startingDate && (
                        <p>
                            <strong>Starting Date:</strong> {policy.startingDate}
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
