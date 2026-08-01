import { requireServerSession } from "@/utils/auth/serverSession.server";
import ShiftsClient from "./ShiftsClient";

export const dynamic = "force-dynamic";

/**
 * Shifts page. Open to any authenticated user: admins see all shifts, everyone
 * else sees only their own (enforced server-side by /api/analytics/shifts-rows).
 */
const ShiftsPage = async () => {
  const { userToken, payload } = await requireServerSession();
  const role = payload.role;

  return <ShiftsClient userToken={userToken} userRole={role} />;
};

export default ShiftsPage;
