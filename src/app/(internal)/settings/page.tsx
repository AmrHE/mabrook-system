import { requireServerSession } from "@/utils/auth/serverSession.server";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

const SettingsPage = async () => {
  const { userToken, payload } = await requireServerSession();
  const role = payload.role;

  if (role !== userRoles.ADMIN) redirect("/");

  return <SettingsClient userToken={userToken} />;
};

export default SettingsPage;
