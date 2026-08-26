import { HistoricalForwardIvCone } from "./HistoricalForwardIvCone";

interface VolatilityConeChartProps {
  spot: number;
  iv: number; // e.g. 0.32
  dte?: number;
  symbol?: string;
  className?: string;
}

export function VolatilityConeChart({
  spot,
  iv,
  symbol = "NFLX",
  className = "",
}: VolatilityConeChartProps) {
  return (
    <HistoricalForwardIvCone
      symbol={symbol}
      spot={spot}
      iv={iv}
      className={className}
    />
  );
}
