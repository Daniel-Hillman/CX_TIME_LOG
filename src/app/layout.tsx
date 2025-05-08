import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
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
  // Corrected path assuming font is in src/app/fonts/
  src: './fonts/Minecraft.ttf', 
  variable: '--font-minecraft', 
  display: 'swap',            
});

export const metadata: Metadata = {
  title: 'Tempo', 
  description: 'Track your time effectively', 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Apply font variables to the body or html */}
      {/* Use the font-sans utility which includes --font-sans (Inter) */}
      {/* Tailwind will pick up --font-minecraft via the config for font-minecraft class */}
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
