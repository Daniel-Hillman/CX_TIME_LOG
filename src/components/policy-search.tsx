'use client';

import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Search, Upload, FileText, AlertCircle, CalendarClock, Receipt } from 'lucide-react'; // Added CalendarClock, Receipt

// Define the structure for policy information extracted from the CSV
type PolicyInfo = {
  policyNumber: string;
  status: string; // e.g., 'TEMPORARILY_LAPSED', 'PERMANENTLY_LAPSED', 'ON_RISK', 'CANCELLED'
  missedPayments: string[]; // Store valid, non-empty dates
  cancellationReason?: string; // Optional: Reason for cancellation/lapse
  potentialCancellationDate?: string; // Optional: Calculated cancellation date for specific 'ON_RISK' cases
  currentGrossPremiumPerFrequency?: string; // Optional: Monthly premium amount
  maxNextPremiumCollectionDate?: string; // Optional: Next payment date
};

// Type for the efficient lookup map
type PolicyDataMap = Map<string, PolicyInfo>;

// Helper function to parse dd/MM/yyyy (or dd/MM/yyyy HH:mm:ss) and add 30 days
function calculatePotentialCancellationDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Handle potential time part by splitting on space
  const datePart = dateStr.split(' ')[0];
  const parts = datePart.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // Month is 1-based in the string
    const year = parseInt(parts[2], 10);

    // Basic validation of parsed parts
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
       // Ensure year looks reasonable, e.g., not too far in the past or future
       if (year < 1900 || year > 2100) {
           console.warn("Unlikely year encountered during date parsing:", year);
           return null;
       }
      try {
        // Create date (month is 0-based in Date constructor)
        const date = new Date(year, month - 1, day);
         // Double check the constructed date matches the input parts to catch invalid dates like 31/02/yyyy
         if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            console.warn("Invalid date components:", dateStr);
            return null; // Date constructor might have adjusted an invalid date
         }

        // Add 30 days
        date.setDate(date.getDate() + 30);
        // Format back to dd/MM/yyyy (using 'en-GB' locale)
        return date.toLocaleDateString('en-GB');
      } catch (e) {
        console.error("Error calculating cancellation date for:", dateStr, e);
        return null; // Handle potential errors during date manipulation
      }
    } else {
        console.warn("Parsed date components seem invalid:", { day, month, year }, "from", dateStr);
    }
  }
  console.warn("Could not parse date for cancellation calculation:", dateStr);
  return null; // Return null if parsing fails
}


export function PolicySearch() {
  const [policyData, setPolicyData] = useState<PolicyDataMap>(new Map());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResult, setSearchResult] = useState<PolicyInfo | null | 'not_found'> (null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // --- CSV Column Header Constants --- (Using actual headers from user CSV)
  const POLICY_NUMBER_COL = 'Policy Number';
  const STATUS_COL = 'Policy Status';
  const MISSED_PAYMENT_1_COL = 'Due Date of 1st Arrear';
  const MISSED_PAYMENT_2_COL = 'Due Date of 2nd Arrear';
  const MISSED_PAYMENT_3_COL = 'Due Date of 3rd Arrear';
  const CANCELLATION_REASON_COL = 'Cancellation Reason'; // Focus on this column for the reason text
  const CURRENT_GROSS_PREMIUM_COL = 'Current Gross Premium Per Frequency'; // New column for monthly premium
  const NEXT_PREMIUM_DATE_COL = 'Max. Next Premium Collection Date'; // New column for next collection date
  // --- End Constants ---

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoading(true);
    setParseError(null);
    setPolicyData(new Map()); // Clear previous data
    setSearchResult(null); // Clear previous search result
    setFileName(file.name);

    Papa.parse<any>(file, {
      header: true, // Assumes first row is header
      skipEmptyLines: true,
      complete: (results) => {
        const dataMap: PolicyDataMap = new Map();
        if (results.errors.length > 0) {
            console.error("CSV Parsing Errors:", results.errors);
            setParseError(`Error parsing CSV: ${results.errors[0].message} on row ${results.errors[0].row}`);
            setIsLoading(false);
            setFileName(null);
            return;
        }

        if (!results.data || results.data.length === 0) {
            setParseError("CSV file is empty or has no data rows.");
            setIsLoading(false);
            setFileName(null);
            return;
        }

        // Keep base columns mandatory, others optional
        const requiredBaseColumns = [POLICY_NUMBER_COL, STATUS_COL, MISSED_PAYMENT_1_COL, MISSED_PAYMENT_2_COL, MISSED_PAYMENT_3_COL];
        const actualHeaders = Object.keys(results.data[0] || {});
        const missingColumns = requiredBaseColumns.filter(col => !actualHeaders.includes(col));

        if (missingColumns.length > 0) {
            const expectedHeaders = `'${requiredBaseColumns.join("', '")}'`;
            const optionalHeaders = `'${CANCELLATION_REASON_COL}', '${CURRENT_GROSS_PREMIUM_COL}', '${NEXT_PREMIUM_DATE_COL}'`;
            setParseError(`Missing required columns in CSV: ${missingColumns.join(', ')}. Expected: ${expectedHeaders}. Optional: ${optionalHeaders}.`);
            setIsLoading(false);
            setFileName(null);
            return;
        }

        // Check for optional columns
        const hasCancellationColumn = actualHeaders.includes(CANCELLATION_REASON_COL);
        const hasPremiumColumn = actualHeaders.includes(CURRENT_GROSS_PREMIUM_COL);
        const hasNextDateColumn = actualHeaders.includes(NEXT_PREMIUM_DATE_COL);


        results.data.forEach((row) => {
          const policyNumber = row[POLICY_NUMBER_COL]?.trim();
          if (policyNumber) {
            const missedPayments = [
              row[MISSED_PAYMENT_1_COL]?.trim(),
              row[MISSED_PAYMENT_2_COL]?.trim(),
              row[MISSED_PAYMENT_3_COL]?.trim(),
            ].filter((date): date is string => !!date && date.trim() !== ''); // Filter out empty/null/whitespace dates

            const status = row[STATUS_COL]?.trim() || 'UNKNOWN';

            // --- Calculate Cancellation Reason ---
            let cancellationReason: string | undefined = undefined;
            if (hasCancellationColumn) {
                const reasonValue = row[CANCELLATION_REASON_COL];
                if (typeof reasonValue === 'string') {
                    const trimmedReason = reasonValue.trim();
                    if (trimmedReason.length > 0) {
                        cancellationReason = trimmedReason;
                    }
                }
            }
            // --- End Calculate Cancellation Reason ---

             // --- Extract Monthly Premium ---
             let currentGrossPremiumPerFrequency: string | undefined = undefined;
             if (hasPremiumColumn) {
                 const premiumValue = row[CURRENT_GROSS_PREMIUM_COL];
                 if (typeof premiumValue === 'string' || typeof premiumValue === 'number') {
                     const trimmedPremium = String(premiumValue).trim();
                     if (trimmedPremium.length > 0) {
                         currentGrossPremiumPerFrequency = trimmedPremium;
                     }
                 }
             }
             // --- End Extract Monthly Premium ---

             // --- Extract Next Premium Collection Date ---
             let maxNextPremiumCollectionDate: string | undefined = undefined;
             if (hasNextDateColumn) {
                 const nextDateValue = row[NEXT_PREMIUM_DATE_COL];
                 if (typeof nextDateValue === 'string') {
                     const trimmedNextDate = nextDateValue.trim();
                     if (trimmedNextDate.length > 0) {
                        // Basic attempt to format if it includes time
                        maxNextPremiumCollectionDate = trimmedNextDate.split(' ')[0];
                     }
                 }
             }
             // --- End Extract Next Premium Collection Date ---

            // --- Calculate Potential Cancellation Date ---
            let potentialCancellationDate: string | undefined = undefined;
            const statusUpper = status.toUpperCase();
            // Check if status is ON_RISK (allowing for variations) and exactly 3 missed payments
            if ((statusUpper === 'ON_RISK' || statusUpper === 'ON RISK') && missedPayments.length === 3) {
                 const thirdMissedPaymentDateStr = missedPayments[2];
                 const calculatedDate = calculatePotentialCancellationDate(thirdMissedPaymentDateStr);
                 if (calculatedDate) {
                    potentialCancellationDate = calculatedDate;
                 }
            }
            // --- End Calculate Potential Cancellation Date ---


            dataMap.set(policyNumber, {
              policyNumber: policyNumber,
              status: status,
              missedPayments: missedPayments,
              cancellationReason: cancellationReason,
              potentialCancellationDate: potentialCancellationDate, // Add calculated date here
              currentGrossPremiumPerFrequency: currentGrossPremiumPerFrequency, // Add premium
              maxNextPremiumCollectionDate: maxNextPremiumCollectionDate, // Add next collection date
            });
          }
        });

        setPolicyData(dataMap);
        setIsLoading(false);
      },
      error: (error: Error) => {
        console.error("CSV Parsing Failed:", error);
        setParseError(`Failed to parse CSV: ${error.message}`);
        setIsLoading(false);
        setFileName(null);
      },
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchTerm) {
      setSearchResult(null);
      return;
    }
    const result = policyData.get(searchTerm.trim());
    setSearchResult(result || 'not_found');
  }, [searchTerm, policyData]);

  // Updated to handle specific statuses from the CSV
  const getStatusColor = (status: string): string => {
    const upperStatus = status.toUpperCase(); // Standardize to uppercase for comparison
    if (upperStatus === 'ON_RISK' || upperStatus === 'ON RISK') {
      return 'text-green-600';
    }
    // Consider lapse AND cancelled statuses as red
    if (isLapsedStatus(status) || upperStatus === 'CANCELLED') { // Added check for 'CANCELLED'
      return 'text-red-600';
    }
    return 'text-muted-foreground'; // Default for other statuses like 'UNKNOWN'
  };

   // Helper to check if a status indicates lapse
  const isLapsedStatus = (status: string): boolean => {
    const upperStatus = status.toUpperCase();
    // Define all statuses that should be considered 'lapsed' or equivalent (red)
    return [
        'LAPSED',
        'TEMPORARILY_LAPSED',
        'PERMANENTLY_LAPSED'
        // Add any other status variations that mean lapsed here
    ].includes(upperStatus);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5"/> Policy Search</CardTitle>
        <CardDescription>Upload a daily CSV policy sheet and search by policy number.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-2">
          <label htmlFor="policy-csv-upload" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Upload Policy CSV
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="policy-csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isLoading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          {fileName && !isLoading && !parseError && <p className="text-sm text-muted-foreground">Loaded: {fileName} ({policyData.size} policies)</p>}
          {parseError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Error</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Search Section - Enabled only after successful upload */}
        {policyData.size > 0 && !isLoading && !parseError && (
          <div className="space-y-2">
            <label htmlFor="policy-search-input" className="text-sm font-medium">Search Policy Number</label>
            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input
                id="policy-search-input"
                type="text"
                placeholder="Enter policy number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()} // Allow Enter key search
              />
              <Button type="button" onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>
          </div>
        )}

        {/* Search Results Section */}
        {searchResult && (
          <div className="pt-4">
            <h3 className="text-lg font-semibold mb-2">Search Result</h3>
            {searchResult === 'not_found' ? (
              <p className="text-muted-foreground">Policy number "{searchTerm}" not found in the uploaded data.</p>
            ) : (
              <Card className="bg-secondary/50">
                <CardContent className="p-4 space-y-2">
                  <p><strong>Policy Number:</strong> {searchResult.policyNumber}</p>
                  <p><strong>Status:</strong> <span className={`font-semibold ${getStatusColor(searchResult.status)}`}>{searchResult.status.replace(/_/g, ' ').toUpperCase()}</span></p>

                  {/* Display Monthly Premium */}
                  {searchResult.currentGrossPremiumPerFrequency && (
                    <p className="flex items-center">
                        <Receipt className="mr-2 h-4 w-4 text-blue-600"/>
                        <strong>Monthly Premium:</strong>
                        <span className="ml-1 font-semibold text-blue-700">£{searchResult.currentGrossPremiumPerFrequency}</span>
                    </p>
                  )}

                  {/* Conditionally display Next Premium Collection Date only if status is not lapsed or cancelled */}
                  {!(isLapsedStatus(searchResult.status) || searchResult.status.toUpperCase() === 'CANCELLED') && searchResult.maxNextPremiumCollectionDate && (
                     <p className="flex items-center">
                         <CalendarClock className="mr-2 h-4 w-4 text-gray-600"/>
                         <strong>Next Premium Collection:</strong>
                         <span className="ml-1">{searchResult.maxNextPremiumCollectionDate}</span>
                     </p>
                  )}

                  {/* Conditionally display Cancellation Reason for lapsed or cancelled policies */}
                  {(isLapsedStatus(searchResult.status) || searchResult.status.toUpperCase() === 'CANCELLED') && searchResult.cancellationReason && (
                    <p><strong>Reason:</strong> <span className="text-muted-foreground">{searchResult.cancellationReason}</span></p>
                  )}

                  {/* Conditionally display Potential Cancellation Date */}
                   {searchResult.potentialCancellationDate && (
                    <p className="flex items-center">
                        <CalendarClock className="mr-2 h-4 w-4 text-orange-600"/>
                        <strong>Potential Cancellation Date:</strong>
                        <span className="ml-1 text-orange-600 font-semibold">{searchResult.potentialCancellationDate}</span>
                    </p>
                  )}

                  <p><strong>Missed Payments ({searchResult.missedPayments.length}):</strong></p>
                  {searchResult.missedPayments.length > 0 ? (
                    <ul className="list-disc list-inside text-muted-foreground pl-4">
                      {searchResult.missedPayments.map((date, index) => (
                        <li key={index}>{date}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">No missed payments recorded.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
