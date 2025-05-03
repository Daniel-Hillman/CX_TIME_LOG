'use client';

import React from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';

// Register ChartJS components (important for rendering)
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

interface ChartData {
  labels: string[];
  datasets: any[]; // Simplified type, adjust if needed
}

interface ExportVisualizationLayoutProps {
  advisorTimeData: ChartData;
  advisorTimeBreakdownData: ChartData;
  timeTrendData: ChartData;
  currentFiltersText: string;
}

// ForwardRef allows the parent component to pass a ref down to the DOM element
export const ExportVisualizationLayout = React.forwardRef<HTMLDivElement, ExportVisualizationLayoutProps>((
  { advisorTimeData, advisorTimeBreakdownData, timeTrendData, currentFiltersText },
  ref
) => {

  // Define fixed dimensions for landscape aspect ratio (e.g., 1200x675 for 16:9)
  const exportWidth = 1200;
  const exportHeight = 750; // Slightly taller to accommodate filters/titles better

  // Chart options for export (no animation)
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow charts to fill their containers
    animation: { duration: 0 }, // No animation for static export
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false, // We'll add titles separately
      },
    },
  };

  return (
    // Apply fixed size, background, padding, and layout using Tailwind
    <div
      ref={ref} // Attach the forwarded ref here
      className="bg-white text-black p-6 shadow-lg grid grid-cols-2 grid-rows-[auto_1fr_1fr] gap-6"
      style={{ width: `${exportWidth}px`, height: `${exportHeight}px` }}
    >
      {/* Header Section - Spanning both columns */}
      <div className="col-span-2 border-b pb-4 mb-2">
        <h1 className="text-2xl font-bold text-center mb-2">Time Log Visualization</h1>
        <p className="text-sm text-gray-600 text-center">{currentFiltersText}</p>
      </div>

      {/* Chart 1: Time Logged Per Advisor (Bar) - Top Left */}
      <div className="border rounded-lg p-4 flex flex-col" style={{ height: '300px' }}>
        <h3 className="text-lg font-semibold text-center mb-2">Time Logged Per Advisor</h3>
        <div className="flex-grow relative">
          {advisorTimeData && advisorTimeData.datasets.length > 0 ? ( // Added check for advisorTimeData
            <Bar data={advisorTimeData} options={commonChartOptions} />
          ) : (
            <p className="text-center text-gray-500">No data</p>
          )}
        </div>
      </div>

      {/* Chart 2: Time Breakdown (Doughnut) - Top Right */}
      <div className="border rounded-lg p-4 flex flex-col" style={{ height: '300px' }}>
        <h3 className="text-lg font-semibold text-center mb-2">Time Breakdown by Advisor</h3>
        <div className="flex-grow relative flex justify-center items-center">
          {advisorTimeBreakdownData && advisorTimeBreakdownData.datasets.length > 0 ? ( // Added check for advisorTimeBreakdownData
            <div className="relative w-full h-full max-w-[250px] max-h-[250px]">
                <Doughnut data={advisorTimeBreakdownData} options={{...commonChartOptions, maintainAspectRatio: true}} />
            </div>
          ) : (
            <p className="text-center text-gray-500">No data</p>
          )}
        </div>
      </div>

      {/* Chart 3: Daily Time Trend (Line) - Bottom, Spanning both columns */}
      <div className="col-span-2 border rounded-lg p-4 flex flex-col" style={{ height: '300px' }}>
        <h3 className="text-lg font-semibold text-center mb-2">Daily Time Log Trend</h3>
        <div className="flex-grow relative">
          {timeTrendData && timeTrendData.datasets.length > 0 ? ( // Added check for timeTrendData
            <Line data={timeTrendData} options={commonChartOptions} />
          ) : (
            <p className="text-center text-gray-500">No data</p>
          )}
        </div>
      </div>
    </div>
  );
});

// Set display name for debugging
ExportVisualizationLayout.displayName = 'ExportVisualizationLayout';
