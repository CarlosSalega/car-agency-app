import {
  Pagination,
  PaginationProps,
} from "@/components/pagination/pagination";
import React from "react";

interface WithPaginationProps {
  pagination?: PaginationProps;
  children?: React.ReactNode;
  containerClassName?: string;
  contentClassName?: string;
}

export function WithPagination({
  pagination,
  children,
  containerClassName = "flex flex-col",
  contentClassName = "flex-1",
}: WithPaginationProps) {
  return (
    <div className={containerClassName}>
      {children && <div className={contentClassName}>{children}</div>}

      {pagination && (
        <div className="p-4">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}
