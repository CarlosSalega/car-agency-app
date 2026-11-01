"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_LINE,
  CHART_AXIS_TICK,
  CHART_CURSOR,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
} from "@/components/leads/leads-chart-style";
import { LeadsChartEmpty } from "@/components/leads/leads-chart-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface WeeklyChartPoint {
  /** Short day/month label, already formatted in Argentina time. */
  label: string;
  count: number;
}

interface LeadsWeeklyChartProps {
  /** Twelve zero-filled weeks, oldest first. */
  data: WeeklyChartPoint[];
}

/**
 * Inquiries per week. The zeros are kept on purpose: a month with no inquiries
 * has to look flat, not like a shorter chart.
 */
export function LeadsWeeklyChart({ data }: LeadsWeeklyChartProps) {
  const hasData = data.some((point) => point.count > 0);

  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle>Consultas por semana</CardTitle>
        <CardDescription>Últimas 12 semanas</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID_STROKE}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={CHART_AXIS_LINE}
                  minTickGap={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={CHART_CURSOR}
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  labelFormatter={(label) => `Semana del ${label}`}
                  formatter={(value) => [`${value}`, "Consultas"]}
                />
                <Bar
                  dataKey="count"
                  name="Consultas"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <LeadsChartEmpty message="Todavía no hay consultas en las últimas 12 semanas." />
        )}
      </CardContent>
    </Card>
  );
}
