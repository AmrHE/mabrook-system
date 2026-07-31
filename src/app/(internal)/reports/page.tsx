import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

const ReportsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value;

  if (role !== userRoles.ADMIN) redirect("/");

  return <ReportsClient userToken={userToken} />;
};

export default ReportsPage;
