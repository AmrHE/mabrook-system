import { cookies } from "next/headers";
import ShiftsClient from "./ShiftsClient";

export const dynamic = "force-dynamic";

/**
 * Shifts page. Open to any authenticated user: admins see all shifts, everyone
 * else sees only their own (enforced server-side by /api/analytics/shifts-rows).
 */
const ShiftsPage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value;

  return <ShiftsClient userToken={userToken} userRole={role} />;
};

export default ShiftsPage;
