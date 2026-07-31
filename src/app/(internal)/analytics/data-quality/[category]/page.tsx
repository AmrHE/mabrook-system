import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import { DQ_BY_SLUG } from "@/utils/analytics/dataQualityCategories";
import DataQualityDrilldownClient from "./DataQualityDrilldownClient";

export const dynamic = "force-dynamic";

const DataQualityCategoryPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value;

  if (role !== userRoles.ADMIN) redirect("/");

  const { category } = await params;
  const cfg = DQ_BY_SLUG[category];
  if (!cfg) notFound();

  const { from, to } = await searchParams;

  return (
    <DataQualityDrilldownClient
      category={cfg.slug}
      titleAr={cfg.titleAr}
      subtitleAr={cfg.subtitleAr}
      columns={cfg.columns}
      filename={cfg.filename}
      from={from}
      to={to}
      userToken={userToken}
    />
  );
};

export default DataQualityCategoryPage;
