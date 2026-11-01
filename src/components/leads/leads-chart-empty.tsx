interface LeadsChartEmptyProps {
  /** What is missing, in one short sentence a dealership owner can read. */
  message: string;
}

/**
 * The body a chart renders when there is nothing to plot.
 *
 * A chart with no data is not an empty chart: recharts would draw axes over
 * nothing and the screen would read as broken. The reserved height keeps the
 * card from collapsing, so the page does not jump around once the first
 * inquiry arrives.
 */
export function LeadsChartEmpty({ message }: LeadsChartEmptyProps) {
  return (
    <p className="text-muted-foreground flex h-32 items-center justify-center px-4 text-center text-sm">
      {message}
    </p>
  );
}
