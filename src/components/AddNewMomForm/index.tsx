 
 
'use client'

import React, { useState, useRef } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useParams, useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import SignatureCanvas from 'react-signature-canvas'
import Image from 'next/image'

const AddNewMomForm = ({ userToken, visit }: { userToken: string | undefined, visit?: string | undefined }) => {
  const router = useRouter()
  const params = useParams()
  const visitId = (params.id as string) || visit

  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [address, setAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [allowFutureCom, setAllowFutureCom] = useState(true)
  const [numberOfKids, setNumberOfKids] = useState<number | null>(0)
  const [numberOfnewborns, setNumberOfnewborns] = useState(0)
  const [numberOfMales, setNumberOfMales] = useState<number | null>(0)
  const [numberOfFemales, setNumberOfFemales] = useState<number | null>(0)
  const [genderOfNewborns, setGenderOfNewborns] = useState<string[]>([])
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [responseMessage, setResponseMessage] = useState<string | null>("")
  const sigCanvas = useRef<SignatureCanvas>(null)

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
    setIsLoading(true)
    e.preventDefault()

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
        nationality,
        address,
        numberOfKids,
        numberOfnewborns,
        numberOfMales,
        numberOfFemales,
        genderOfNewborns,
        phoneNumber,
        allowFutureCom,
        signature: uploadedSignatureUrl, // ✅ save Cloudinary URL instead of base64
      }),
    })

      const data = await res.json()

      if (!res.ok) {
        alert('حدث خطأ ما أثناء إضافة الام. الرجاء المحاولة مرة أخرى.');
        setIsLoading(false);
        setResponseMessage(data.message || 'حدث خطأ ما أثناء إضافة الام. الرجاء المحاولة مرة أخرى.');
      }
      alert('تمت إضافة الام بنجاح!');
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

      <div className='flex gap-3'>
        <Checkbox
          id="allowFutureCom"
          checked={allowFutureCom}
          onCheckedChange={(checked) => setAllowFutureCom(!!checked)}
        />
        <Label htmlFor="allowFutureCom">هل ترغبي في التواصل مستقبلياً؟</Label>
      </div>

      <Label htmlFor="nationality">الجنسية</Label>
      <Input
        placeholder="جنسية الام"
        id="nationality"
        required
        value={nationality}
        onChange={(e) => setNationality(e.target.value)}
      />

      <Label htmlFor="address">العنوان</Label>
      <Input
        placeholder="عنوان الام"
        id="address"
        required
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <Label htmlFor="numberOfKids">عدد الاطفال</Label>
      <Input
        placeholder="عدد الاطفال"
        id="numberOfKids"
        required
        value={numberOfKids ?? ''}
        onChange={(e) => setNumberOfKids(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfnewborns">عدد الاطفال حديثي الولادة</Label>
      <Input
        placeholder="عدد الاطفال حديثي الولادة"
        id="numberOfnewborns"
        required
        value={numberOfnewborns}
        onChange={handleNewbornCountChange}
      />

      <Label htmlFor="numberOfMales">عدد الاطفال الذكور</Label>
      <Input
        placeholder="عدد الاطفال الذكور"
        id="numberOfMales"
        required
        value={numberOfMales ?? ''}
        onChange={(e) => setNumberOfMales(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfFemales">عدد الاطفال الاناث</Label>
      <Input
        placeholder="عدد الاطفال الاناث"
        id="numberOfFemales"
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
