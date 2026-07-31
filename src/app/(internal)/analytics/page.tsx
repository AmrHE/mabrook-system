import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

const AnalyticsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value;

  if (role !== userRoles.ADMIN) redirect("/");

  return <AnalyticsClient userToken={userToken} />;
};

export default AnalyticsPage;
