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
  src: './fonts/Minecraft.ttf', 
  variable: '--font-minecraft', 
  display: 'swap',            
});

// Load custom Designer font
const designer = localFont({
  src: './fonts/Designer.otf',
  variable: '--font-designer',
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
      <body className={`${inter.variable} ${minecraft.variable} ${designer.variable} font-sans antialiased`}>
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
