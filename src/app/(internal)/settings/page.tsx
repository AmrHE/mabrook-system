import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userRoles } from "@/models/enum.constants";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

const SettingsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value;

  if (role !== userRoles.ADMIN) redirect("/");

  return <SettingsClient userToken={userToken} />;
};

export default SettingsPage;
