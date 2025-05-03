import React from 'react';
import { cn } from "@/lib/utils";

interface TempoLogoProps extends React.SVGProps<SVGSVGElement> {}

export function TempoLogo({ className, ...props }: TempoLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 40" // Adjust viewBox based on logo aspect ratio
      className={cn("fill-current text-primary", className)} // Use primary color from theme
      {...props}
    >
      {/* Text Part */}
      <text
        x="10" // Start slightly indented
        y="28" // Vertically center (adjust based on font)
        fontFamily="Arial, sans-serif" // Choose a suitable font
        fontSize="24" // Adjust font size
        fontWeight="bold"
      >
        TEMPO
      </text>
      {/* ECG Line Part */}
      <path
        d="M 115 20 L 125 20 L 130 10 L 140 30 L 145 20 L 185 20" // Simplified path coordinates, adjust precisely
        stroke="currentColor" // Use the same color as text fill
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
