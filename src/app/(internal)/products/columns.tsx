// columns.tsx
import { ColumnDef } from "@tanstack/react-table"

type Product = {
  id: string;
  name: string;
  // imageUrl: string;
  size: string;
  totalQuantity: number;
  warehouseQuantity: number;
  hospitalsQuantity: number;
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "id",
    header: "رقم المنتج",
  },
  {
    accessorKey: "name",
    header: "اسم المنتج",
  },
  // {
  //   accessorKey: "imageUrl",
  //   header: "الجنسية",
  // },
  {
    accessorKey: "size",
    header: "الحجم",
  },
  {
    accessorKey: "totalQuantity",
    header: "اجمالي الكمية",
  },
  {
    accessorKey: "warehouseQuantity",
    header: "كمية المخزن",
  },
  {
    accessorKey: "hospitalsQuantity",
    header: "كمية المستشفيات",
  }
]
