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

export interface ChannelChartPoint {
  /** `utm_source`, or `Directo` when the visitor arrived with no campaign. */
  channel: string;
  count: number;
}

interface LeadsChannelChartProps {
  data: ChannelChartPoint[];
}

/**
 * Where the inquiries come from, as horizontal bars: channel names are words,
 * and a word reads horizontally.
 *
 * No pie: comparing slices of different angles is guesswork, and the owner is
 * here to compare numbers.
 */
export function LeadsChannelChart({ data }: LeadsChannelChartProps) {
  const hasData = data.some((point) => point.count > 0);

  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle>Cómo llegan</CardTitle>
        <CardDescription>Canal de origen de las consultas</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div
            className="w-full"
            // The row count is data, so the height has to follow it.
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
                  dataKey="channel"
                  width={120}
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
                  fill="var(--chart-5)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <LeadsChartEmpty message="Todavía no hay canales para mostrar." />
        )}
      </CardContent>
    </Card>
  );
}
