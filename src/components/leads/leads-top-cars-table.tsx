import type { CarBucket } from "@/lib/leads/metrics";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeadsTopCarsTableProps {
  rows: CarBucket[];
}

/**
 * Which cars generate the inquiries, as a ranked table.
 *
 * A chart would lose here: car titles are long, and a bar chart either clips
 * them or turns them into an unreadable axis. A table keeps the name legible
 * and the count aligned, which is all the owner needs to decide what to keep
 * in stock.
 */
export function LeadsTopCarsTable({ rows }: LeadsTopCarsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Autos más consultados</CardTitle>
        <CardDescription>Consultas por vehículo</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground flex h-40 items-center justify-center text-center text-sm">
            Todavía no hay autos consultados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Auto</TableHead>
                <TableHead className="text-right">Consultas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.title}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  {/* Long titles wrap instead of being clipped: the car name
                      is the whole point of the row. */}
                  <TableCell className="font-medium whitespace-normal">
                    {row.title}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
