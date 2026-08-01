import { requireServerSession } from "@/utils/auth/serverSession.server";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

const AnalyticsPage = async () => {
  const { userToken, payload } = await requireServerSession();
  const role = payload.role;

  if (role !== userRoles.ADMIN) redirect("/");

  return <AnalyticsClient userToken={userToken} />;
};

export default AnalyticsPage;
