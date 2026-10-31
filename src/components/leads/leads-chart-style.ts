/**
 * Recharts ships its own look: a white tooltip, a light grid, and axis lines in
 * a default grey. This app has exactly one theme, so every chart receives the
 * same token-based overrides instead of repeating inline colours.
 *
 * Colours are CSS custom properties as strings (`var(--primary)`), never hex:
 * the palette lives in `globals.css` and nowhere else.
 */
export const CHART_GRID_STROKE = "var(--border)";

export const CHART_AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 12,
} as const;

export const CHART_AXIS_LINE = { stroke: "var(--border)" } as const;

export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
} as const;

export const CHART_TOOLTIP_ITEM_STYLE = {
  color: "var(--popover-foreground)",
} as const;

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: "var(--muted-foreground)",
} as const;

export const CHART_CURSOR = { fill: "var(--accent)", opacity: 0.4 } as const;
