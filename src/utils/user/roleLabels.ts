import { userRoles } from "@/models/enum.constants";

/**
 * Arabic labels for `userRoles`, shared by the reports (role column + facet) and
 * any UI that shows a role. The strings match the ones already used inline in
 * `CreateNewEmployee` / `EditEmployeeForm`.
 */
export const USER_ROLE_AR: Record<string, string> = {
  [userRoles.EMPLOYEE]: "موظف",
  [userRoles.ADMIN]: "مدير",
  [userRoles.WAREHOUSE]: "مسؤول المخزن",
};

export const userRoleLabel = (role?: string) => (role ? USER_ROLE_AR[role] ?? role : "—");
