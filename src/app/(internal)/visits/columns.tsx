// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Visit = {
  id: string
  hospitalName: string
  city: string
  district: string
  momsCount: number
  employeeName: string
}

export const columns: ColumnDef<Visit>[] = [
  {
    accessorKey: "id",
    header: "رقم الزيارة",
  },
  {
    accessorKey: "hospitalName",
    header: "اسم المستشفى",
  },
  {
    accessorKey: "city",
    header: "المدينة",
  },
  {
    accessorKey: "district",
    header: "الحي",
  },
  {
    accessorKey: "momsCount",
    header: "عدد الأمهات",
  },
  {
    accessorKey: "employeeName",
    header: "اسم الموظف",
  },
]
