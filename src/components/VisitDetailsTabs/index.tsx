// 'use client'
// import React, { useState } from 'react'
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
// import AddNewMomForm from '../AddNewMomForm'

// const VisitDetailsTabs = ({ visit }: { visit: any }) => {
//     const [activeTab, setActiveTab] = useState("visitDetails");

//   return (
//     <Tabs dir='rtl' defaultValue="visitDetails" value={activeTab} onValueChange={setActiveTab} className="w-full">
//       <TabsList className="grid w-full grid-cols-3">
//         <TabsTrigger value="visitDetails" className='cursor-pointer'>تفاصيل الزيارة</TabsTrigger>
//         <TabsTrigger value="moms" className='cursor-pointer'>تفاصيل الامهات</TabsTrigger>
//         <TabsTrigger value="addNewMom" className='cursor-pointer'>اضافة ام جديدة</TabsTrigger>
//       </TabsList>
//       <TabsContent value="visitDetails">
//         <h4 className='mt-8 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل الزيارة</h4>
//         <div className='flex max-w-[300px] justify-between'>
//           <div className='flex flex-col gap-5'>
//             <p>التاريخ</p>
//             <p>رقم الزيارة</p>
//             <p>توقيت البدأ</p>
//             <p>اسم الموظف</p>
//           </div>
//           <div className='flex flex-col gap-5'>
//             <p>{new Date(visit.visit.startTime).toDateString()}</p>
//             <p className='max-w-28 truncate'>{visit.visit._id}</p>
//             <p>{new Date(visit.visit.startTime).toLocaleTimeString()}</p>
//             <p>{`${visit.visit.createdBy.firstName} ${visit.visit.createdBy.lastName}`}</p>
//           </div>
//         </div>

//         <h4 className='mt-16 mb-4 font-semibold text-gray-700 text-xl'>تفاصيل المستشفى</h4>
//         <div className='flex max-w-[300px] justify-between'>
//           <div className='flex flex-col gap-5'>
//             <p>اسم المستشفى</p>
//             <p>المدينة</p>
//             <p>الحي</p>
//             <p>الموقع الجغرافي</p>
//           </div>
//           <div className='flex flex-col gap-5'>
//             <p>{visit.visit.hospitalId.name}</p>
//             <p>{visit.visit.hospitalId.city}</p>
//             <p>{visit.visit.hospitalId.district}</p>
//             <a
//             className='text-blue-500 hover:underline'
//               target="_blank"
//               rel="noopener noreferrer"
//               href={`https://www.google.com/maps/?q=${visit.visit.hospitalId.location.lat},${visit.visit.hospitalId.location.lng}`}
//             >Open In Google Maps</a>
//           </div>
//         </div>

//       </TabsContent>
//       <TabsContent value="moms">
        
//       </TabsContent>
//       <TabsContent value="addNewMom">
//         <AddNewMomForm />
//       </TabsContent>
//     </Tabs>
//   )
// }

// export default VisitDetailsTabs