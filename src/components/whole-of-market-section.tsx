
'use client';

import *
as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// ScrollArea removed
import { Badge } from '@/components/ui/badge'; 

interface InsurerInfoEntry {
  insurer: string;
  contactInformation: string;
  autoRecollection: string;
  missedPaymentsToLapse: string;
  cancelOnBehalf: string;
  canReinstateDD: string;
  otherRetentionsInfo: string;
  emailPassword?: string;
  bankDetails?: string;
}

// Data extracted from the prompt
const insurerDataArray: InsurerInfoEntry[] = [
  {
    insurer: "SOURCE HOME INSURANCE",
    contactInformation: "02920 105 400",
    autoRecollection: "",
    missedPaymentsToLapse: "",
    cancelOnBehalf: "",
    canReinstateDD: "",
    otherRetentionsInfo: "",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Aegon (now Royal London)",
    contactInformation: "345 610 0037",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "",
    cancelOnBehalf: "No",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 7 working days\n▪ 4+ missed payments = Declaration of Health required\n▪ Customer can send bank transfer to make up payment\n▪ Can set up double/triple collection on behalf of client\n▪ 'Refer to payer' - currently attempting recollection. ",
    emailPassword: "UsL1PzrhI5-T",
    bankDetails: "",
  },
  {
    insurer: "AIG Life",
    contactInformation: "345 600 6820",
    autoRecollection: "No",
    missedPaymentsToLapse: "3",
    cancelOnBehalf: "Yes - via portal",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ PORTAL\n ▪ Payment clearance - 4 working days\n▪ Portal - can reattempt 3-5 day collection on portal, can set up double collection, can change bank details & payment dates & reinstate policy if less than 3 payments missed.\n▪ AIG would have reattempted BEFORE sending notification to us",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Aviva",
    contactInformation: "800 056 5499",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "", // Lapses after - 60 days of 1st missed DD
    cancelOnBehalf: "Yes - via portal",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ PORTAL\n ▪ Clearance - 5 working days\n▪ Lapses after - 60 days of 1st missed DD\n▪ Can cancel on portal/change bank details\n▪ Can reinstate DD on portal\n▪ \"DD REJECTION\" - currently recollecting. ",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Canada Life",
    contactInformation: "3456060708",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "", // Lapses after - 60 days of 1st missed DD
    cancelOnBehalf: "No",
    canReinstateDD: "No",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 10 working days\n▪ Lapses after - 60 days of 1st missed DD\n▪ \"1 missed payment\" - currently recollecting.\n▪ Customer can bank transfer arrears.\n▪ Canada Life will attempt next month premium as normal even when 1 missed payment on the account - if this fails DD suspends.\n▪ We cannot set up anything on behalf of client- they have to call to do this. ",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Cignpost Life",
    contactInformation: "330 123 3747",
    autoRecollection: "No",
    missedPaymentsToLapse: "4",
    cancelOnBehalf: "Yes - Cancellation form to IPTIQ",
    canReinstateDD: "No",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 4 working days\n▪ 4+ missed payments = Declaration of Health required & all arrears to be cleared.\n▪ Can miss up to 2 payments\n▪ iptiq_serviceops@swissre.com for any cancellations/adhoc recollection/payment link.",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "ESMI",
    contactInformation: "330 123 10 30",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3", // 3 missed payments - policy lapse
    cancelOnBehalf: "Yes - Email Isobel",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 5 working days\n▪ smith@getesmi.co.uk to check on payments/cancel policy/reinstate DD.\n▪ Customer can send bank transfer to ESMI to make up arrears.\n▪  \"0213  -  REFER TO PAYER\" Automatic double collection when DD is active\n▪ 3 missed payments - policy lapse",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Guardian",
    contactInformation: "808 133 1821",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3", // 3 missed payments - policy lapse
    cancelOnBehalf: "No",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 5 working days\n▪  Automatic double collection when DD is active & reattempt 7 days after missed premium.\n▪  We can reinstate DD for customer - can't do manual payments.\n▪ 3 missed payments - policy lapse",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "HSBC",
    contactInformation: "333 207 5563",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "", // Lapse 90 days after missed payment
    cancelOnBehalf: "Yes",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Check with HSBC before calling customer for the status of the policy\n▪ Clearance - 7-10 working days\n▪ Lapse 90 days after missed payment.\n▪ Can reinstate DD and set up double collection or recollection. Can also cancel policy on behalf of customer.\n▪ Sometimes recollecting when 'Policy in arrears' - call HSBC to check. They keep recollecting until DD suspends.\n▪Customer can bank transfer arrears\n▪ HSBC sometimes recollect premium which causes next month to skip - they will then take a premium as normal the month after if the DD is still active.  - ▪ Can cancel on behalf ",
    emailPassword: "x=f=Alpha40",
    bankDetails: "",
  },
  {
    insurer: "Legal & General",
    contactInformation: "370 010 4080",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3+", // 3+ missed payments = Lapse
    cancelOnBehalf: "No",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ PORTAL\n ▪ Clearance - 11 working days\n▪ 3+ missed payments = Lapse\n▪ Can reinstate DD and set up double on portal if you get clients bank details.\n▪ Alternatively, customer can call to make up payment manually/set up a recollection.\n▪'Reinstatement not required' - L&G recollecting, no need to call. Wait for payment clearance. If it fails the DD auto-cancels.\n▪ Can't cancel on behalf of client.",
    emailPassword: "Candidinsuranceservices1!",
    bankDetails: "",
  },
  {
    insurer: "LV=",
    contactInformation: "800 678 1906",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3+", // 3+ missed payments = Declaration of Health required
    cancelOnBehalf: "No",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Payment clearance - 5 working days\n▪ 3+ missed payments = Declaration of Health required\n▪ Can set up double/triple collection on behalf of client\n▪ Can set up 3-5 working day collection on behalf of client\n ▪ \"DD Reject/ Refer to payer\" - currently reattempting",
    emailPassword: "wNP!TpRv",
    bankDetails: "",
  },
  {
    insurer: "Polly/Tom/Winston",
    contactInformation: "800 048 8866",
    autoRecollection: "No",
    missedPaymentsToLapse: "Claims number: 800 031 8672 (option 2)", // This was in the 'missed payments' column
    cancelOnBehalf: "Yes - Cancellation form to IPTIQ",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n▪ Clearance - 8 working days\n▪ Cancellation 30 days after 3rd miss payment\n▪ Can miss 2 payments and retain cover. \n▪ iptiq_serviceops@swissre.com - email for any payment queries/cancellations/NT forms/dd reinstatements etc. ",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Royal London",
    contactInformation: "345 609 4500",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3", // 3 missed payments - policy lapse
    cancelOnBehalf: "No",
    canReinstateDD: "No",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 5 working days\n▪ Can't cancel policy on behalf of client\n▪ \"1 missed\" -  Automatic double collection when 1 missed payment.\n▪ 3 missed payments - policy lapse\n▪ Customer has to call to make payments.",
    emailPassword: "Candid123",
    bankDetails: "",
  },
  {
    insurer: "Scottish Widows",
    contactInformation: "345 030 6240",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "", // Depends on how many missed
    cancelOnBehalf: "Yes - Call Insurer Directly",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 5 working days\n▪  \"DD OPEN - 2 PAYMENTS DUE NEXT PAYMENT\" Automatic double/triple collection when DD is active depending on how many payments missed.\n▪ Can set up a 14 day recollection ",
    emailPassword: "ON962Y",
    bankDetails: "",
  },
  {
    insurer: "Shepherd's Friendly",
    contactInformation: "161 495 6495",
    autoRecollection: "No",
    missedPaymentsToLapse: "3", // Lapses after 3 missed payments
    cancelOnBehalf: "No",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n▪ Clearance - 5 working days\n▪  Can do payment links, manual payments and we can set up double collection\n▪ Lapses after 3 missed payments. ",
    emailPassword: "C&*d1dSf!",
    bankDetails: "",
  },
  {
    insurer: "The Exeter",
    contactInformation: "300 123 3203",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3", // 3 missed payments - lapses the policy
    cancelOnBehalf: "No", // Based on "Can cancel on behalf of the client." being "No" for similar entries, assumed "No" was missing
    canReinstateDD: "No", // Assuming based on the prompt for other insurers. The source says "Can cancel on behalf of the client." but not for reinstating DD. Adjust if needed.
    otherRetentionsInfo: "▪ NO PORTAL\n▪ Clearance - 4 working days\n▪ 3 missed payments - lapses the policy\n▪ Can set up 7 working day recollection/double collection on behalf of client. \n▪ Can cancel on behalf of the client.\n▪ Customer can be transferred to make manual payment \n▪ Automatic 9 working day recollection is in place when 'Refer to payer' ",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Vitality",
    contactInformation: "345 602 3523",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "3", // Lapses after 3 missed payments
    cancelOnBehalf: "Yes",
    canReinstateDD: "Yes",
    otherRetentionsInfo: "▪ NO PORTAL\n ▪ Clearance - 5 working days\n ▪ \"1 missing\"-  Auto-recollection 14 days after missed premium.\n▪  Customer needs to call to make up premium over the phone\n ▪ Lapses after 3 missed payments. ",
    emailPassword: "VitalityEWR2022",
    bankDetails: "",
  },
  {
    insurer: "Zurich",
    contactInformation: "370 850 4419",
    autoRecollection: "Yes",
    missedPaymentsToLapse: "2", // Lapses after 2 missed payments
    cancelOnBehalf: "No",
    canReinstateDD: "No",
    otherRetentionsInfo: "▪ NO PORTAL\n▪ Clearance - 5 working days\n▪  Customer needs to call to make up premium\n▪ Lapses after 2 missed payments. ",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Square Health",
    contactInformation: "3451403000",
    autoRecollection: "",
    missedPaymentsToLapse: "",
    cancelOnBehalf: "",
    canReinstateDD: "",
    otherRetentionsInfo: "CM can only amend the clients email address (Square Health will need to do everything else)",
    emailPassword: "",
    bankDetails: "",
  },
  {
    insurer: "Metlife",
    contactInformation: "2077152000",
    autoRecollection: "?",
    missedPaymentsToLapse: "?",
    cancelOnBehalf: "No",
    canReinstateDD: "?",
    otherRetentionsInfo: "?",
    emailPassword: "?",
    bankDetails: "?",
  },
];

const renderBooleanBadge = (value: string) => {
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'yes') {
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Yes</Badge>;
  }
  if (lowerValue === 'no') {
    return <Badge variant="destructive">No</Badge>;
  }
  if (lowerValue === '?') {
    return <Badge variant="secondary">?</Badge>;
  }
  return value || '-'; // Display value or hyphen if empty
};


export function WholeOfMarketSection() {
  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">
          Whole of Market Insurer Information
        </CardTitle>
        <CardDescription>
          Quick reference for insurer contact details, recollection options, and retention information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* This div now defines the height and enables scrolling for the Table component */}
        <div className="h-[70vh] w-full overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[150px]">Insurer</TableHead>
                <TableHead className="min-w-[130px]">Contact Info</TableHead>
                <TableHead className="min-w-[100px] text-center">Auto Recollect?</TableHead>
                <TableHead className="min-w-[150px]">Lapse (Missed Pmts)</TableHead>
                <TableHead className="min-w-[120px] text-center">Cancel for Cust.?</TableHead>
                <TableHead className="min-w-[100px] text-center">Reinstate DD?</TableHead>
                <TableHead className="min-w-[300px]">Retentions Notes</TableHead>
                <TableHead className="min-w-[150px]">Login Details</TableHead>
                <TableHead className="min-w-[150px]">Bank Details (DD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurerDataArray.map((insurer) => (
                <TableRow key={insurer.insurer}>
                  <TableCell className="font-medium">{insurer.insurer}</TableCell>
                  <TableCell>{insurer.contactInformation || '-'}</TableCell>
                  <TableCell className="text-center">{renderBooleanBadge(insurer.autoRecollection)}</TableCell>
                  <TableCell>{insurer.missedPaymentsToLapse || '-'}</TableCell>
                  <TableCell className="text-center">{renderBooleanBadge(insurer.cancelOnBehalf)}</TableCell>
                  <TableCell className="text-center">{renderBooleanBadge(insurer.canReinstateDD)}</TableCell>
                  <TableCell className="whitespace-pre-line text-xs">
                    {insurer.otherRetentionsInfo || '-'}
                  </TableCell>
                  <TableCell>{insurer.emailPassword || '-'}</TableCell>
                  <TableCell>{insurer.bankDetails || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
