import AdminDashboard from "@/components/Home/Admin";
import EmployeeDashboard from "@/components/Home/Employee";
import { userRoles } from "@/models/enum.constants";
import { requireServerSession } from "@/utils/auth/serverSession.server";
import { getCurrentState } from "@/utils/shift/currentState";

// The shift/visit state is read live from Mongo on every load; caching it would
// reintroduce exactly the staleness the cookies used to cause.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { userToken, payload } = await requireServerSession();

  if (payload.role === userRoles.ADMIN) {
    return <AdminDashboard />;
  }

  const state = await getCurrentState(payload._id);

  return <EmployeeDashboard userToken={userToken} initialState={state} />;
}
