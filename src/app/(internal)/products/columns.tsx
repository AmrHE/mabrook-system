// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Product = {
  id: string;
  name: string;
  totalQuantity: number;
  hospitalsQuantity: number;
  stockLabel: string;
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "اسم الصندوق",
  },
  {
    accessorKey: "totalQuantity",
    header: "إجمالي المخزون",
  },
  {
    accessorKey: "stockLabel",
    header: "حالة المخزون",
  }
]
