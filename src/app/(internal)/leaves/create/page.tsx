import { cookies } from 'next/headers';
import AddNewLeaveForm from '@/components/AddNewLeaveForm';
import { addDaysToDayKey, riyadhDayKey } from '@/utils/date/range';
import { getSettings } from '@/utils/settings/getSettings';
import { initDb } from '@/lib/mongoose';

export const dynamic = 'force-dynamic';

/**
 * New leave/permit request. Open to every role.
 *
 * "Today" and the earliest allowed date are computed server-side in Riyadh time so
 * the date inputs can't be widened by a device with a skewed clock or a different
 * timezone — the API enforces the same bounds regardless.
 */
const CreateLeavePage = async () => {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('access_token')?.value;

  await initDb();
  const settings = await getSettings();
  const today = riyadhDayKey(new Date());
  const minDay = addDaysToDayKey(today, -settings.leaveMaxRetroDays);

  return (
    <div>
      <h1 className="text-3xl font-bold p-4 mb-6">طلب استئذان جديد</h1>
      <AddNewLeaveForm userToken={userToken} today={today} minDay={minDay} />
    </div>
  );
};

export default CreateLeavePage;
