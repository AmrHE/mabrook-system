// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Hospital = {
  id: string;
  name: string;
  city: string;
  district: string;
  employeeEmail: string;
  employeeName: string;
}

export const columns: ColumnDef<Hospital>[] = [
  {
    accessorKey: "id",
    header: "رقم المستشفى",
  },
  {
    accessorKey: "name",
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
    accessorKey: "employeeEmail",
    header: "ايميل الموظف",
  },
  {
    accessorKey: "employeeName",
    header: "اسم الموظف",
  },
]
