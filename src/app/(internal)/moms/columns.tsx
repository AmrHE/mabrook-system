// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Mom = {
  id: string;
  name: string;
  nationality: string;
  address: string;
  numberOfKids: number;
  numberOfnewborns: number;
  numberOfMales: number;
  numberOfFemales: number;
}

export const columns: ColumnDef<Mom>[] = [
  {
    accessorKey: "id",
    header: "رقم الأم",
  },
  {
    accessorKey: "name",
    header: "اسم الأم",
  },
  {
    accessorKey: "nationality",
    header: "الجنسية",
  },
  {
    accessorKey: "address",
    header: "العنوان",
  },
  {
    accessorKey: "numberOfKids",
    header: "عدد الأطفال",
  },
  {
    accessorKey: "numberOfnewborns",
    header: "عدد المواليد الجدد",
  },
  {
    accessorKey: "numberOfMales",
    header: "عدد الذكور",
  },
  {
    accessorKey: "numberOfFemales",
    header: "عدد الإناث",
  },
]
