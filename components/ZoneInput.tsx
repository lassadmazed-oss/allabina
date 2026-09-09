'use client'

import { useId } from 'react'
import type { Locale } from '@/lib/i18n'

export type Zone = {
  id: number
  gov_code: string
  delegation_id: number | null
  name_ar: string
  name_fr: string | null
}

/**
 * خانة موقع باقتراحات. الحريف ما يقولش «عمادة»، يقول «قرمدة» و«طريق تنيور».
 *
 * القائمة اقتراح لا قيد: datalist تسمح بالكتابة الحرّة، فمنطقة غير مذكورة
 * تتكتب كما هي. كي تكون المعتمدية مختارة والمناطق مربوطة بيها، نضيّقو
 * القائمة عليها — وإلّا عرضناها كاملة.
 */
export default function ZoneInput({
  name,
  zones,
  govCode,
  delegationId,
  locale,
  className,
  placeholder,
  defaultValue,
  value,
  onChange,
}: {
  name: string
  zones: Zone[]
  govCode: string
  delegationId?: string
  locale: Locale
  className?: string
  placeholder?: string
  defaultValue?: string
  /** مرّر value و onChange للحقل المتحكَّم فيه، أو defaultValue وحده */
  value?: string
  onChange?: (v: string) => void
}) {
  const listId = useId()
  const inGov = zones.filter((z) => z.gov_code === govCode)

  const scoped = delegationId
    ? inGov.filter((z) => z.delegation_id === null || String(z.delegation_id) === delegationId)
    : inGov

  const options = scoped.length > 0 ? scoped : inGov

  return (
    <>
      <input
        type="text"
        name={name}
        list={listId}
        className={className}
        placeholder={placeholder}
        {...(onChange
          ? { value: value ?? '', onChange: (e) => onChange(e.target.value) }
          : { defaultValue })}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((z) => (
          <option key={z.id} value={z.name_ar}>
            {locale === 'fr' && z.name_fr ? z.name_fr : ''}
          </option>
        ))}
      </datalist>
    </>
  )
}
