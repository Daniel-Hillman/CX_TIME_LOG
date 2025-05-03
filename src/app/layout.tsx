import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Removed Geist_Mono
import localFont from 'next/font/local'; // Import localFont
import './globals.css';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Setup Inter font
const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Load Minecraft font using localFont
const minecraft = localFont({
  src: './Minecraft.ttf',       // Path relative to the layout file
  variable: '--font-minecraft', // Assign a CSS variable
  display: 'swap',            // Use swap for better performance
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
      {/* Apply font variables to the body or html */}
      {/* Added minecraft.variable */}
      <body className={`${inter.variable} ${minecraft.variable} font-sans antialiased`}>
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
