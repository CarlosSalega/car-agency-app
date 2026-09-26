"use client";

import type { PaginationProps } from "@/components/pagination/pagination";
import type { ReactNode } from "react";

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { WithPagination } from "@/components/pagination/with-pagination";

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /**
   * Applied to the header **and** every body cell for this column, so a
   * `text-right` header keeps its values aligned under it.
   */
  className?: string;
}

interface AdminTableProps<T> {
  data?: T[];
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  errorState?: ReactNode;
  pagination?: PaginationProps;
  className?: string;
}

export function AdminTable<T>({
  data = [],
  columns,
  rowKey,
  isLoading,
  error,
  emptyState,
  loadingState,
  errorState,
  pagination,
  className,
}: AdminTableProps<T>) {
  const colSpan = columns.length;

  return (
    <div
      className={`h-full overflow-hidden rounded-lg border border-gray-300 shadow-xl/30 ${className ?? ""}`}
    >
      <Table className="bg-card overflow-hidden rounded-lg">
        <TableHeader className="hover:bg-card/80 focus:bg-card/80">
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} className={col.className}>
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {}
          {isLoading && (
            <TableRow>
              <TableCell colSpan={colSpan}>
                {loadingState ?? "Cargando..."}
              </TableCell>
            </TableRow>
          )}

          {}
          {!isLoading && error && (
            <TableRow>
              <TableCell colSpan={colSpan}>{errorState ?? error}</TableCell>
            </TableRow>
          )}

          {}
          {!isLoading && !error && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan}>
                {emptyState ?? "Sin resultados"}
              </TableCell>
            </TableRow>
          )}

          {}
          {!isLoading &&
            !error &&
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>

        {pagination && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={colSpan} className="p-0">
                <WithPagination pagination={pagination} />
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
