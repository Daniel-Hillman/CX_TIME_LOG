"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types" // Restore the import

// Removed the temporary interface

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Removed the 'as any' cast, relying on the imported type
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}