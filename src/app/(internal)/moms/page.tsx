/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from 'next/headers';
import { requireServerSession } from "@/utils/auth/serverSession.server";
import { columns } from "./columns";
import FilterableTable from '@/components/FilterableTable';
import { isSaudi } from '@/utils/nationality/normalize';

type Mom = {
  id: string;
  name: string;
  nationality: string;
  address: string;
  numberOfKids: number;
  numberOfnewborns: number;
  numberOfMales: number;
  numberOfFemales: number;
  hospitalName: string;
  potential: string;
  natGroup: string;
  appInstalled: string;
  installedApps: string;
}

const MomsPage = async () => {
  const { userToken } = await requireServerSession();
  const headersList = await headers();
  const host = headersList.get('host');

  async function getMomsData(userToken: any) {
    const res = await fetch(`${process.env.NODE_ENV === "development" ? process.env.URL : `https://${host}`}/api/mom/get-moms`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
    });
    return res.json();
    }
  const moms = await getMomsData(userToken);

  const processedMoms: Mom[] = [];
  if (moms.moms.length > 0) {
    moms.moms.map((mom: any) => {
      processedMoms.push({
        id: mom._id,
        name: mom.name,
        nationality: mom.nationality,
        address: mom.address,
        numberOfKids: mom.numberOfKids,
        numberOfnewborns: mom.numberOfnewborns,
        numberOfMales: mom.numberOfMales,
        numberOfFemales: mom.numberOfFemales,
        hospitalName: mom.visitId.hospitalId.name,
        potential: mom.allowFutureCom ? 'نعم' : 'لا',
        natGroup: isSaudi(mom.nationality) ? 'سعودي' : 'غير سعودي',
        appInstalled: Array.isArray(mom.installedApp) && mom.installedApp.length > 0 ? 'نعم' : 'لا',
        installedApps: Array.isArray(mom.installedApp) ? mom.installedApp.join('، ') : '',
      });
    });
  }

  return (
    <div>
      <h1 className='text-3xl font-bold p-4 mb-6'>الأمهات</h1>
      <FilterableTable
        data={processedMoms}
        columns={columns}
        basePath="/moms"
        filename="moms.csv"
        searchKeys={['name', 'nationality', 'hospitalName']}
        searchPlaceholder="ابحث بالاسم أو الجنسية أو المستشفى"
        filters={[
          {
            key: 'potential',
            label: 'عميل محتمل',
            options: [
              { label: 'عملاء محتملون (وافقوا على التواصل)', value: 'نعم' },
              { label: 'غير مهتمين', value: 'لا' },
            ],
          },
          {
            key: 'natGroup',
            label: 'الجنسية',
            options: [
              { label: 'سعودية', value: 'سعودي' },
              { label: 'غير سعودية', value: 'غير سعودي' },
            ],
          },
          {
            key: 'appInstalled',
            label: 'تطبيق مثبّت',
            options: [
              { label: 'ثبّتوا تطبيقاً', value: 'نعم' },
              { label: 'بدون تطبيق', value: 'لا' },
            ],
          },
        ]}
        exportColumns={[
          { key: 'name', header: 'الاسم' },
          { key: 'nationality', header: 'الجنسية' },
          { key: 'address', header: 'العنوان' },
          { key: 'hospitalName', header: 'المستشفى' },
          { key: 'numberOfKids', header: 'عدد الأطفال' },
          { key: 'numberOfnewborns', header: 'عدد المواليد' },
          { key: 'numberOfMales', header: 'ذكور' },
          { key: 'numberOfFemales', header: 'إناث' },
          { key: 'potential', header: 'عميل محتمل' },
          { key: 'appInstalled', header: 'تطبيق مثبّت' },
          { key: 'installedApps', header: 'التطبيقات المثبّتة' },
        ]}
      />
    </div>
  );
};

export default MomsPage;
