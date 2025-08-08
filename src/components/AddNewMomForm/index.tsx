/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import React, { useState } from 'react'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';


const AddNewMomForm = ({userToken, visit}: {userToken: string | undefined, visit?: string | undefined}) => {
  const router = useRouter()
  const params = useParams();
  const visitId = params.id as string ? params.id : visit;
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('')
  const [address, setAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [allowFutureCom, setAllowFutureCom] = useState(true)
  const [numberOfKids, setNumberOfKids] = useState<number | null>(null)
  const [numberOfnewborns, setNumberOfnewborns] = useState(0)
  const [numberOfMales, setNumberOfMales] = useState<number | null>(null)
  const [numberOfFemales, setNumberOfFemales] = useState<number | null>(null)
  const [genderOfNewborns, setGenderOfNewborns] = useState<string[]>([]);
  const [responseMessage, setResponseMessage] = useState('');

  const handleGenderChange = (index: number, value: string) => {
    const updatedGenders = [...genderOfNewborns];
    updatedGenders[index] = value;
    setGenderOfNewborns(updatedGenders);
  };

  const handleNewbornCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value) || 0;
    setNumberOfnewborns(count);
    setGenderOfNewborns(Array(count).fill('')); // reset or resize genders array
  }
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
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
          allowFutureCom
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      router.push(`/moms/${data.mom._id}`)
      setResponseMessage('Mom submitted successfully!');
    } catch (error: any) {
      setResponseMessage(`Error: ${error.message}`);
    }
  };

  return (
    <form className='flex flex-col gap-5 lg:max-w-1/3' onSubmit={handleSubmit}>
      <Label htmlFor="name">
        الاسم
      </Label>
      <Input
        placeholder="اسم الام"
        id="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      
      <Label htmlFor="phoneNumber">
        رقم الجوال
      </Label>
      <Input
        placeholder="رقم الجوال"
        id="phoneNumber"
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

      <Label htmlFor="nationality">
        الجنسية
      </Label>
      <Input
        placeholder="جنسية الام"
        id="nationality"
        required
        value={nationality}
        onChange={(e) => setNationality(e.target.value)}
      />

      <Label htmlFor="address">
        العنوان
      </Label>
      <Input
        placeholder="عنوان الام"
        id="address"
        required
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <Label htmlFor="numberOfKids">
        عدد الاطفال
      </Label>
      <Input
        placeholder="عدد الاطفال"
        id="numberOfKids"
        required
        value={numberOfKids !== null ? numberOfKids : ''}
        onChange={(e) => setNumberOfKids(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfnewborns">
        عدد الاطفال حديثي الولادة
      </Label>
      <Input
        placeholder="عدد الاطفال حديثي الولادة"
        id="numberOfnewborns"
        required
        value={numberOfnewborns}
        onChange={handleNewbornCountChange}
      />

      <Label htmlFor="numberOfMales">
        عدد الاطفال الذكور
      </Label>
      <Input
        placeholder="عدد الاطفال الذكور"
        id="numberOfMales"
        required
        value={numberOfMales !== null ? numberOfMales : ''}
        onChange={(e) => setNumberOfMales(e.target.value === '' ? null : Number(e.target.value))}
      />

      <Label htmlFor="numberOfFemales">
        عدد الاطفال الاناث
      </Label>
      <Input
        placeholder="عدد الاطفال الاناث"
        id="numberOfFemales"
        required
        value={numberOfFemales !== null ? numberOfFemales : ''}
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
      <div className='flex items-center justify-center w-full mt-4'>
        <Button className='lg:w-2/3 w-full text-center py-6 text-xl font-semibold' type='submit'>اضافة الام</Button>
      </div>
    </form>
  )
}

export default AddNewMomForm