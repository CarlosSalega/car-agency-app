"use client";

import type { LeadStatus } from "@generated/prisma/enums";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export interface StatusChartPoint {
  status: LeadStatus;
  /** Spanish label, taken from the same map the badges use. */
  label: string;
  count: number;
}

interface LeadsStatusChartProps {
  data: StatusChartPoint[];
}

/**
 * The same colours the status badges use, so a status means the same thing on
 * every screen of the panel.
 */
const STATUS_FILL: Record<LeadStatus, string> = {
  NEW: "var(--info)",
  CONTACTED: "var(--warning)",
  NEGOTIATING: "var(--primary)",
  WON: "var(--success)",
  LOST: "var(--muted-foreground)",
};

/**
 * How the inquiries are distributed across the pipeline, in the order staff
 * walk them. A bar per status instead of a pie: five slices of a circle are
 * read by eye, five bars are read by number.
 */
export function LeadsStatusChart({ data }: LeadsStatusChartProps) {
  const hasData = data.some((point) => point.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>En qué estado están</CardTitle>
        <CardDescription>Todas las consultas recibidas</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div
            className="w-full"
            style={{ height: Math.max(160, data.length * 40) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID_STROKE}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={CHART_AXIS_LINE}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={CHART_AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={CHART_CURSOR}
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  formatter={(value) => [`${value}`, "Consultas"]}
                />
                <Bar
                  dataKey="count"
                  name="Consultas"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                >
                  {data.map((point) => (
                    <Cell key={point.status} fill={STATUS_FILL[point.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <LeadsChartEmpty message="Todavía no hay estados para mostrar." />
        )}
      </CardContent>
    </Card>
  );
}
