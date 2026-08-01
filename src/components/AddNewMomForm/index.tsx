 
 
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useParams, useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import SignatureCanvas from 'react-signature-canvas'
import Image from 'next/image'
import { toast } from 'sonner'
import NationalitySelect from '@/components/NationalitySelect'
import AppMultiSelect from '@/components/AppMultiSelect'

const AddNewMomForm = ({ userToken, visit, isAdmin }: { userToken: string | undefined, visit?: string | undefined, isAdmin?: boolean }) => {
  const router = useRouter()
  const params = useParams()
  const visitId = (params.id as string) || visit

  const [name, setName] = useState('')
  const [age, setAge] = useState<number | null>(null)
  const [nationality, setNationality] = useState('')
  const [address, setAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [allowFutureCom, setAllowFutureCom] = useState(true)
  const [numberOfKids, setNumberOfKids] = useState<number | null>(0)
  const [numberOfnewborns, setNumberOfnewborns] = useState(0)
  const [numberOfMales, setNumberOfMales] = useState<number | null>(0)
  const [numberOfFemales, setNumberOfFemales] = useState<number | null>(0)
  const [genderOfNewborns, setGenderOfNewborns] = useState<string[]>([])
  const [installedApp, setInstalledApp] = useState<string[]>([])
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [responseMessage, setResponseMessage] = useState<string | null>("")
  const sigCanvas = useRef<SignatureCanvas>(null)

  // Boxes available at this visit's hospital + the ones the employee is handing
  // out. A mom may receive several boxes, so this is a checklist, not a picker.
  const [boxes, setBoxes] = useState<{ productId: string; name: string; quantity: number }[]>([])
  const [boxIds, setBoxIds] = useState<string[]>([])
  const outOfStockSelected = boxes.filter((b) => boxIds.includes(b.productId) && b.quantity <= 0)

  const toggleBox = (productId: string) => {
    setBoxIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    )
  }

  useEffect(() => {
    if (!visitId) return
    fetch(`/api/product/hospital-stock?visitId=${visitId}`, {
      headers: { authorization: `Bearer ${userToken}` },
    })
      .then((r) => r.json())
      .then((j) => setBoxes(Array.isArray(j.boxes) ? j.boxes : []))
      .catch(() => setBoxes([]))
  }, [visitId, userToken])

  const handleGenderChange = (index: number, value: string) => {
    const updatedGenders = [...genderOfNewborns]
    updatedGenders[index] = value
    setGenderOfNewborns(updatedGenders)
  }

  const handleNewbornCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value) || 0
    setNumberOfnewborns(count)
    setGenderOfNewborns(Array(count).fill(''))
  }

  const clearSignature = () => {
    sigCanvas.current?.clear()
    setSignatureData(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!nationality) {
      toast.error('الرجاء اختيار الجنسية')
      return
    }
    if (boxIds.length === 0) {
      toast.error('الرجاء اختيار صندوق واحد على الأقل')
      return
    }
    setIsLoading(true)

    const signatureImage = sigCanvas.current?.isEmpty()
      ? null
      : sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png')

    let uploadedSignatureUrl;

    if (signatureImage && !uploadedSignatureUrl) {
      const uploadRes = await fetch('/api/cloudinary/upload-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureImage }),
      })

      const uploadData = await uploadRes.json()
      if (uploadRes.ok) {
        uploadedSignatureUrl = uploadData.url
      } else {
        throw new Error(uploadData.error || 'Failed to upload signature')
      }
    }

    // Then submit mom data with signature URL
    const res = await fetch('/api/mom/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        visitId,
        name,
        age,
        nationality,
        address,
        numberOfKids,
        numberOfnewborns,
        numberOfMales,
        numberOfFemales,
        genderOfNewborns,
        phoneNumber,
        allowFutureCom,
        installedApp,
        boxIds,
        signature: uploadedSignatureUrl, // ✅ save Cloudinary URL instead of base64
      }),
    })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.message || data.error || 'حدث خطأ ما أثناء إضافة الام. الرجاء المحاولة مرة أخرى.');
        setIsLoading(false);
        setResponseMessage(data.message || data.error || 'حدث خطأ ما أثناء إضافة الام. الرجاء المحاولة مرة أخرى.');
        return;
      }
      toast.success('تمت إضافة الام بنجاح!');
      router.push(`/moms/${data.mom._id}`)
  }

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3' onSubmit={handleSubmit}>
      <Label htmlFor="name">الاسم</Label>
      <Input
        placeholder="اسم الام"
        id="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Label htmlFor="phoneNumber">رقم الجوال</Label>
      <Input
        placeholder="رقم الجوال"
        id="phoneNumber"
        minLength={10}
        maxLength={10}
        required
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />

      <Label htmlFor="age">العمر (اختياري)</Label>
      <Input
        placeholder="عمر الام"
        id="age"
        type="number"
        min={0}
        max={120}
        value={age ?? ''}
        onChange={(e) => setAge(e.target.value === '' ? null : Number(e.target.value))}
      />

      <div className='flex gap-3'>
        <Checkbox
          id="allowFutureCom"
          checked={allowFutureCom}
          onCheckedChange={(checked) => setAllowFutureCom(!!checked)}
        />
        <Label htmlFor="allowFutureCom">هل ترغبي في التواصل مستقبلياً؟</Label>
      </div>

      <Label htmlFor="nationality">الجنسية</Label>
      <NationalitySelect
        value={nationality}
        onChange={setNationality}
        userToken={userToken}
        isAdmin={isAdmin}
      />

      <Label htmlFor="address">العنوان</Label>
      <Input
        placeholder="عنوان الام"
        id="address"
        required
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <Label>التطبيقات المثبّتة (اختياري)</Label>
      <AppMultiSelect value={installedApp} onChange={setInstalledApp} />

      <Label>الصناديق الموزّعة (يمكن اختيار أكثر من صندوق)</Label>
      <div className='rounded-md border bg-white'>
        <div className='flex items-center justify-between gap-2 border-b p-2'>
          <span className='text-sm text-muted-foreground'>اختر الصناديق التي تم تسليمها</span>
          <div className='flex shrink-0 items-center gap-2'>
            <span className='text-xs text-muted-foreground'>{boxIds.length} محدد</span>
            {boxIds.length > 0 && (
              <button
                type='button'
                onClick={() => setBoxIds([])}
                className='text-xs text-[#5570F1] hover:underline'
              >
                مسح
              </button>
            )}
          </div>
        </div>
        <div className='max-h-56 space-y-1 overflow-y-auto p-1'>
          {boxes.length === 0 ? (
            <p className='py-3 text-center text-sm text-muted-foreground'>لا توجد صناديق</p>
          ) : (
            boxes.map((b) => (
              <label
                key={b.productId}
                className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted'
              >
                <Checkbox
                  checked={boxIds.includes(b.productId)}
                  onCheckedChange={() => toggleBox(b.productId)}
                />
                <span className='text-sm'>{b.name}</span>
                <span className='text-xs text-muted-foreground'>(المتبقي: {b.quantity})</span>
              </label>
            ))
          )}
        </div>
      </div>
      {outOfStockSelected.length > 0 && (
        <p className='text-amber-600 text-sm'>
          تنبيه: الصناديق التالية نفدت من مخزون هذا المستشفى؛ سيصبح المخزون بالسالب عند الحفظ:{' '}
          {outOfStockSelected.map((b) => b.name).join('، ')}
        </p>
      )}

      <Label htmlFor="numberOfKids">عدد الاطفال</Label>
      <Input
        placeholder="عدد الاطفال"
        id="numberOfKids"
        type="number"
        min={0}
        required
        value={numberOfKids ?? ''}
        onChange={(e) => setNumberOfKids(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfnewborns">عدد الاطفال حديثي الولادة</Label>
      <Input
        placeholder="عدد الاطفال حديثي الولادة"
        id="numberOfnewborns"
        type="number"
        min={0}
        required
        value={numberOfnewborns}
        onChange={handleNewbornCountChange}
      />

      <Label htmlFor="numberOfMales">عدد الاطفال الذكور</Label>
      <Input
        placeholder="عدد الاطفال الذكور"
        id="numberOfMales"
        type="number"
        min={0}
        required
        value={numberOfMales ?? ''}
        onChange={(e) => setNumberOfMales(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfFemales">عدد الاطفال الاناث</Label>
      <Input
        placeholder="عدد الاطفال الاناث"
        id="numberOfFemales"
        type="number"
        min={0}
        required
        value={numberOfFemales ?? ''}
        onChange={(e) => setNumberOfFemales(e.target.value === '' ? null : Number(e.target.value))}
      />

      {Array.from({ length: numberOfnewborns }, (_, index) => (
        <div key={index} className='flex items-center gap-12'>
          <Label className="block font-medium mb-1">جنس المولود رقم {index + 1}</Label>
          <Select
            required
            value={genderOfNewborns[index] || ''}
            onValueChange={(value) => handleGenderChange(index, value)}
          >
            <SelectTrigger className='w-32'>
              <SelectValue placeholder="اختار النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">ولد</SelectItem>
              <SelectItem value="Female">بنت</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* 🖊️ Signature Section */}
      <div className="mt-6">
        <Label className="mb-2 block">توقيع الام (للموافقة على السياسة)</Label>
        {/* <div className="border rounded-md p-2 bg-white"> */}
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{
              width: 375,
              height: 200,
              className: 'signatureCanvas bg-white border border-gray-300 rounded-md w-full',
            }}
          />
        {/* </div> */}
        <div className="flex justify-between mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearSignature}
          >
            مسح التوقيع
          </Button>
          <Button
            type="button"
            onClick={() =>{
              setSignatureData(sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || null)
            }}
          >
            حفظ التوقيع
          </Button>
        </div>
        {signatureData && (
          <div className="mt-3">
            <Label>التوقيع المحفوظ:</Label>
            <Image
              src={signatureData}
              alt="Saved signature preview"
              className="w-full border mt-1 rounded-md"
              width={200}
              height={200}
            />
          </div>
        )}
      </div>

      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit' disabled={isLoading}>
          {isLoading ? 'جاري الحفظ...' : 'اضف الام'}
        </Button>
      </div>

      {responseMessage && (
        <p className="text-center text-sm mt-2">{responseMessage}</p>
      )}
    </form>
  )
}

export default AddNewMomForm
