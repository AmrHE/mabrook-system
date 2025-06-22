"use client"

import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from './data-table'

interface ClientDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function ClientDataTable<TData extends { id: string }, TValue>({
  columns,
  data,
}: ClientDataTableProps<TData, TValue>) {
  const router = useRouter()

  const handleRowClick = (row: TData) => {
    router.push(`/visits/${row.id}`)
  }

  return (
    <DataTable 
      columns={columns} 
      data={data} 
      onRowClick={handleRowClick}
    />
  )
}