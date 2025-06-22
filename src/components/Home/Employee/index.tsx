'use client';
import CallToActionCard from '@/components/CallToActionCard';
import hand from '../../../../public/hand.svg';
import { shiftStatus } from '@/models/enum.constants';
import { Plus, ArrowLeftFromLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ShiftType } from '@/types/types';
import AddNewVisitDialog from '@/components/AddNewVisitDialog';

export default function EmployeeDashboard({userToken, currentShift}: {userToken: string | undefined; currentShift: string | undefined;}) {
  const [shift, setShift] = useState<ShiftType | null>(null);
  const currentShiftStatus = shift?.status || currentShift;

  const handleClick = async () => {
    if (currentShiftStatus !== shiftStatus.IN_PROGRESS) {
      const res = await fetch('/api/shift/create', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });
      const data = await res.json();
      setShift(data.shift);
    } else {
      const res = await fetch('/api/shift/endShift', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });
      const data = await res.json();
      setShift(data.shift);
    }
  };

  useEffect(() => {
    if (!shift && currentShiftStatus === shiftStatus.IN_PROGRESS) {
      const getCurrentShift = async () => {
        const res = await fetch('/api/shift/getCurrentShift', {
          method: 'GET',
          headers: {
            authorization: `Bearer ${userToken}`,
          },
        });
        const data = await res.json();
        setShift(data.shift);
      };
      getCurrentShift();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <CallToActionCard
        cta={
          currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? 'بدأ الدوام'
            : 'إنهاء الدوام'
        }
        CtaIcon={
          currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? Plus
            : ArrowLeftFromLine
        }
        text={
          currentShiftStatus !== shiftStatus.IN_PROGRESS
            ? 'من فضلك قم بالضغط على بدأ الدوام ثم قم بادخال الزيارة'
            : 'لا تنسى ضغط زر انهاء الدوام عند انتهاء ساعات العمل'
        }
        title="اهلا بك في حملة مبروك!"
        icon={hand}
        action={handleClick}
      />

      {shift && currentShiftStatus === shiftStatus.IN_PROGRESS && (
        <div className="flex items-center justify-between bg-white rounded-xl p-10 border-t border-solid border-gray-200">
          <div className="flex items-center px-10 gap-4 divide-gray-300">
            <div className="space-y-4 text-center me-20">
              <p className="text-gray-500">تاريخ الدوام</p>
              <h1 className="font-medium text-xl">
                {new Date(shift.startTime).toDateString()}
              </h1>
            </div>
            <div className="space-y-4 text-center me-20">
              <p className="text-gray-500">توقيت البدأ</p>
              <h1 className="font-medium text-xl">
                {new Date(shift.startTime).toLocaleTimeString()}
              </h1>
            </div>
          </div>

          {userToken && (
            <AddNewVisitDialog userToken={userToken} shiftId={shift._id} />
          )}
        </div>
      )}
    </div>
  );
}
