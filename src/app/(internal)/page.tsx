import EmployeeDashboard from "@/components/Home/Employee";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;
  const shiftStatus = cookieStore.get('shiftStatus')?.value;

  return (
    <EmployeeDashboard userToken={userToken} currentShift={shiftStatus}>
    </EmployeeDashboard>
  );
}
