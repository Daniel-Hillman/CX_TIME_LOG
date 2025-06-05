'use client';

import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Loader2, FileCheck2, CheckCircle, Copy, Eraser, FileText, FileType, Info } from 'lucide-react';
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
  startingDate?: string;
  [key: string]: any;
};

const POLICY_NUMBER_COL = 'Policy Number';
const STATUS_COL = 'Policy Status';
const MISSED_PAYMENT_1_COL = 'Due Date of 1st Arrear';
const MISSED_PAYMENT_2_COL = 'Due Date of 2nd Arrear';
const MISSED_PAYMENT_3_COL = 'Due Date of 3rd Arrear';
const CANCELLATION_REASON_COL = 'Cancellation Reason';
const CURRENT_GROSS_PREMIUM_COL = 'Current Gross Premium Per Frequency';
const NEXT_PREMIUM_DATE_COL = 'Max. Next Premium Collection Date';
const STARTING_DATE_COL = 'Starting Date';

const UNWANTED_HEADERS = [
    'Distribution Partner',
    'Product Name',
    'Sales Channel',
    'Broker ID',
    'Sold Date',
    'Exit Date',
    'Cancellation Type',
    'Policy Type',
    'LOAP Consent',
    'Premium Escalation Type',
    'Benefit Escalation Type',
    'Current Sum Sumassured',
    'Current Gross Premium Annualized',
    'Premium Frequency',
    'Blank',
    'Number Of Paid Premiums',
    'Number Of Unpaid Premiums',
    'Value Of Premiums Collected',
];

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

function extractPolicyNumberNumeric(policyNumber: string): number {
  const match = policyNumber.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

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
        clearedPolicyNumbers = new Set(clearedBatchText.split(/\r?\n/).map(line => line.trim()).filter(line => line && line.length > 0));
      }

      if (clearedPolicyNumbers.size === 0) {
        toast({ title: "No Policies in Batch", description: "The cleared batch file is empty or contains no policy numbers.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      Papa.parse(dashboardDataText as any, {
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
                startingDate: row[STARTING_DATE_COL]?.trim()?.split(' ')[0],
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
        transformHeader: (header: string) => header.trim(),
        onError: (error: Papa.ParseError) => {
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
       headersToInclude
        .filter(header => !UNWANTED_HEADERS.includes(header))
        .forEach(header => {
            if (header === 'missedPayments') {
                report += `Missed Payments: ${policy.missedPayments.length > 0 ? policy.missedPayments.join(', ') : 'None'}\n`;
            } else {
                const value = policy[header] ?? 'N/A';
                report += `${header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}\n`;
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

    const csvHeaders = dashboardHeaders.length > 0 ? dashboardHeaders : (processedData.length > 0 ? Object.keys(processedData[0]) : []);
    let fileContent: string;
    let mimeType: string;
    let fileName: string;

    const textReportHeaders = [
      POLICY_NUMBER_COL,
      STATUS_COL,
      'missedPayments',
      NEXT_PREMIUM_DATE_COL,
      CURRENT_GROSS_PREMIUM_COL,
      STARTING_DATE_COL,
    ].filter(header => !UNWANTED_HEADERS.includes(header));

    switch (format) {
      case 'txt':
        fileContent = generateTextReport(processedData, textReportHeaders);
        mimeType = 'text/plain;charset=utf-8;';
        fileName = `next_cleared_batch_report.txt`;
        break;
      case 'pdf':
      case 'csv':
        fileContent = Papa.unparse({
            fields: csvHeaders,
            data: processedData.map(policy => {
                return csvHeaders.map(header => {
                    const value = policy[header];
                    return Array.isArray(value) ? value.join('; ') : (value ?? '');
                });
            })
        });
        mimeType = 'text/csv;charset=utf-8;';
        if (format === 'pdf') {
            fileName = 'next_cleared_batch_report_for_sheets.csv';
        } else {
            fileName = 'next_cleared_batch_data.csv';
        }
        break;
      default:
        toast({ title: "Error", description: "Invalid download format selected.", variant: "destructive" });
        return;
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

  const accordionDisplayHeaders = [
      STATUS_COL,
      'missedPayments',
      NEXT_PREMIUM_DATE_COL,
      STARTING_DATE_COL,
  ].filter(h => !UNWANTED_HEADERS.includes(h));

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
                    CSV for Sheets
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
                            {policy[CURRENT_GROSS_PREMIUM_COL] && (
                                <span className="ml-2 text-xs text-muted-foreground">(£{policy[CURRENT_GROSS_PREMIUM_COL]})</span>
                            )}
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
                      {accordionDisplayHeaders.map(headerKey => {
                        if (headerKey === 'missedPayments') {
                          return (
                            <p key={headerKey}>
                              <strong>Missed Payments:</strong>
                              {policy.missedPayments.length > 0 ? policy.missedPayments.join(', ') : 'None'}
                            </p>
                          );
                        }
                        const displayName = headerKey
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/_/g, ' ')
                            .replace(/^./, str => str.toUpperCase());

                        if (policy[headerKey] !== undefined && policy[headerKey] !== null && String(policy[headerKey]).trim() !== '') {
                          return (
                            <p key={headerKey}>
                              <strong>{displayName}:</strong> {policy[headerKey]}
                            </p>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
        <div className="pt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="instructions">
              <AccordionTrigger>
                <div className="flex items-center">
                  <Info className="mr-2 h-4 w-4" />
                  How to use this feature
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Step 1:</strong> Upload the Daily Dashboard as a .csv file in the first box.</p>
                  <p><strong>Step 2:</strong> Filter your individual tracker (spreadsheet) to remove leads that are not back on risk, lapsed, TBL (To Be Lapsed), etc.</p>
                  <p><strong>Step 3:</strong> In your filtered tracker, click on the top of the column containing policy numbers to select all policy numbers you are actively working. Copy this selection (Ctrl+C or Cmd+C).</p>
                  <p><strong>Step 4:</strong> Open a new spreadsheet (e.g., File &gt; New &gt; Spreadsheet in Google Sheets or Excel).</p>
                  <p><strong>Step 5:</strong> Paste (Ctrl+V or Cmd+V) all the active policy numbers into the first column of the newly created spreadsheet.</p>
                  <p><strong>Step 6:</strong> Export this new spreadsheet as a CSV file (e.g., File &gt; Download &gt; .csv). Name it something like "[Your Name] Policies to Check.csv".</p>
                  <p><strong>Step 7:</strong> Upload this newly created CSV file to the 'Cleared Batch File' input box on this page.</p>
                  <p><strong>Step 8:</strong> Press the "Process Files" button and wait a few seconds for the results.</p>
                  <p><strong>Step 9:</strong> You can then download the results as a TXT file (or CSV for Sheets). Save this file to your computer for easy access and work through the identified cases.</p>
                  <p><strong>NOTE:</strong> Always double-check the missed payments and other details to ensure you can actually work the lead and put it back on risk. The algorithm has high accuracy but may occasionally make mistakes.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
};

export default NextClearedBatch;

    

    