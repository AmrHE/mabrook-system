import AdminDashboard from "@/components/Home/Admin";
import EmployeeDashboard from "@/components/Home/Employee";
import { userRoles } from "@/models/enum.constants";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const shiftStatus = cookieStore.get('shiftStatus')?.value;
  const userRole = cookieStore.get('role')?.value;

  return (
    <>
    {userRole === userRoles.ADMIN ? (
      <AdminDashboard />
    ) : 
    (
      <EmployeeDashboard userToken={userToken} currentShift={shiftStatus} />
    )}
    </>
  );
}
