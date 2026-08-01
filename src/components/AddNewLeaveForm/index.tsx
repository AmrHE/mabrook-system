'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { toast } from 'sonner'
import { leaveType } from '@/models/enum.constants'
import { LEAVE_TYPE_OPTIONS } from '@/utils/leave/labels'

const PERMIT_TYPES: string[] = [leaveType.DELAY_PERMIT, leaveType.EARLY_LEAVE]
// Only a vacation may cover more than one day; the rest are single-day by definition.
const MULTI_DAY_TYPES: string[] = [leaveType.VACATION]

const HINTS: Record<string, string> = {
  [leaveType.DELAY_PERMIT]: 'إذن بالحضور متأخرًا في يوم واحد. لن يُحسب تأخيرًا إذا وصلت خلال المدة المطلوبة.',
  [leaveType.EARLY_LEAVE]: 'إذن بالانصراف قبل نهاية الدوام في يوم واحد.',
  [leaveType.CASUAL]: 'يوم عارض كامل.',
  [leaveType.VACATION]: 'إجازة ليوم أو أكثر. حدّد تاريخ البداية والنهاية.',
}

/**
 * Request time off. Available to every role — employees, warehouse staff and
 * admins alike. An admin's own request still needs a different admin to decide it.
 *
 * Dates are plain `YYYY-MM-DD` calendar days (`<input type="date">`, matching
 * DateRangeFilter — the project has no calendar component), which is exactly the
 * shape the API stores, so nothing can drift across the Riyadh timezone boundary.
 */
const AddNewLeaveForm = ({
  userToken,
  today,
  minDay,
}: {
  userToken: string | undefined
  /** Today in Riyadh, `YYYY-MM-DD` — computed server-side so a device with a wrong clock can't shift it. */
  today: string
  /** Earliest day still inside the retroactive window. */
  minDay: string
}) => {
  const router = useRouter()

  const [type, setType] = useState<string>('')
  const [startDay, setStartDay] = useState(today)
  const [endDay, setEndDay] = useState(today)
  const [minutes, setMinutes] = useState<number>(60)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isPermit = PERMIT_TYPES.includes(type)
  const isMultiDay = MULTI_DAY_TYPES.includes(type)

  // Keep the (hidden) end date in step for the single-day types, so the payload is
  // always coherent even though the server re-derives it anyway.
  const onStartDayChange = (value: string) => {
    setStartDay(value)
    if (!isMultiDay || value > endDay) setEndDay(value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!type) {
      toast.error('الرجاء اختيار نوع الطلب')
      return
    }
    if (!startDay) {
      toast.error('الرجاء تحديد التاريخ')
      return
    }
    if (isMultiDay && endDay < startDay) {
      toast.error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية')
      return
    }
    if (isPermit && (!minutes || minutes < 15 || minutes > 120)) {
      toast.error('مدة الاستئذان يجب أن تكون بين 15 و 120 دقيقة')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/leave/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          type,
          startDay,
          endDay: isMultiDay ? endDay : startDay,
          minutes: isPermit ? minutes : undefined,
          reason,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.message || data.error || 'حدث خطأ أثناء إرسال الطلب')
        setIsLoading(false)
        return
      }

      toast.success(data.message || 'تم إرسال الطلب بنجاح')
      router.push(`/leaves/${data.leave._id}`)
      router.refresh()
    } catch {
      toast.error('حدث خطأ أثناء إرسال الطلب')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 lg:max-w-1/2">
      <div className="grid gap-1.5">
        <Label htmlFor="type">نوع الطلب</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="type">
            <SelectValue placeholder="اختر نوع الطلب" />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {type && <p className="text-xs text-gray-400">{HINTS[type]}</p>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="startDay">{isMultiDay ? 'من تاريخ' : 'التاريخ'}</Label>
        <Input
          id="startDay"
          type="date"
          required
          min={minDay}
          value={startDay}
          onChange={(e) => onStartDayChange(e.target.value)}
          className="max-w-xs"
        />
        <p className="text-xs text-gray-400">
          {minDay === today
            ? 'لا يمكن تقديم طلب عن تاريخ ماضٍ'
            : `يمكن تقديم الطلب عن تاريخ ماضٍ حتى ${minDay}`}
        </p>
      </div>

      {isMultiDay && (
        <div className="grid gap-1.5">
          <Label htmlFor="endDay">إلى تاريخ</Label>
          <Input
            id="endDay"
            type="date"
            required
            min={startDay}
            value={endDay}
            onChange={(e) => setEndDay(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

      {isPermit && (
        <div className="grid gap-1.5">
          <Label htmlFor="minutes">المدة (دقائق)</Label>
          <Input
            id="minutes"
            type="number"
            required
            min={15}
            max={120}
            step={15}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-gray-400">من 15 إلى 120 دقيقة</p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="reason">السبب</Label>
        <textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="اكتب سبب الطلب ليتمكن المدير من مراجعته"
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      </div>

      <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
        سيُراجع الطلب من قِبل أحد المديرين، وهو من يحدّد ما إذا كان مدفوعًا أو غير مدفوع. الإجازة غير المدفوعة تُخصم كيوم
        كامل، والاستئذان غير المدفوع يُخصم بربع يوم.
      </div>

      <Button type="submit" disabled={isLoading} className="bg-[#5570F1] hover:bg-[#3250e9] max-w-xs">
        {isLoading ? 'جاري الإرسال...' : 'إرسال الطلب'}
      </Button>
    </form>
  )
}

export default AddNewLeaveForm
