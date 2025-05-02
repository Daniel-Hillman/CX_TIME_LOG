import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google'; // Import Inter
import './globals.css';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Setup Inter font
const inter = Inter({
  variable: '--font-sans', // Use standard variable name for Tailwind integration
  subsets: ['latin'],
});

// Keep Geist Mono for monospace, or replace if desired
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Tempo', // Updated title here too for consistency
  description: 'Track your time effectively', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Apply font variables to the body */}
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
         <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
         </ThemeProvider>
      </body>
    </html>
  );
}
