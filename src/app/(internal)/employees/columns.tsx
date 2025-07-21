// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
} 

export const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "id",
    header: "رقم الموظف",
  },
  {
    accessorKey: "firstName",
    header: "الاسم الأول",
  },
  {
    accessorKey: "lastName",
    header: "الاسم الأخير",
  },
  {
    accessorKey: "email",
    header: "البريد الإلكتروني",
  },
  {
    accessorKey: "phoneNumber",
    header: "رقم الهاتف",
  },
  {
    accessorKey: "role",
    header: "الدور الوظيفي",
  },
]
