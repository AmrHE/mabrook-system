import { requireServerSession } from "@/utils/auth/serverSession.server";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

const ReportsPage = async () => {
  const { userToken, payload } = await requireServerSession();
  const role = payload.role;

  if (role !== userRoles.ADMIN) redirect("/");

  return <ReportsClient userToken={userToken} />;
};

export default ReportsPage;
