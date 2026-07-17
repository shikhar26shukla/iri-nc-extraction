"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

interface SkillBaseTableProps<T extends object> {
  data: T[];
  columns: { key: keyof T & string; header: string }[];
}

export function SkillBaseTable<T extends object>({
  data,
  columns,
}: SkillBaseTableProps<T>) {
  const [filter, setFilter] = useState("");

  const colDefs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.key as string,
        header: col.header,
        cell: (info) => String(info.getValue() ?? ""),
      })),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: colDefs,
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search skill base…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 text-left font-medium"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} entries
      </p>
    </div>
  );
}
