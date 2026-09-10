/**
 * تسميات العقارات في لوحة الإدارة — مصدر واحد للقائمة وصفحة العقار.
 */

export const PROPERTY_KIND_AR: Record<string, string> = {
  land: 'أرض',
  house: 'دار',
  apartment: 'شقة',
  building: 'عمارة',
  other: 'أخرى',
}

export const PROPERTY_STATUS_AR: Record<string, string> = {
  pending: 'تنتظر المراجعة',
  approved: 'مراجَع',
  rejected: 'مرفوض',
  reserved: 'محجوز',
  sold: 'خرج من السوق',
}

export const PROPERTY_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gold-soft text-gold ring-gold/30',
  approved: 'bg-[#e6f0e9] text-[#1f6b3f] ring-[#1f6b3f]/20',
  rejected: 'bg-[#fbeeeb] text-[#8c2f22] ring-[#8c2f22]/20',
  reserved: 'bg-brand-soft text-brand ring-brand/20',
  sold: 'bg-surface-2 text-muted ring-line-strong',
}

export const PROPERTY_CONDITION_AR: Record<string, string> = {
  new: 'جديد',
  good: 'جيّد',
  to_refresh: 'يحتاج تحسيناً',
  to_renovate: 'يحتاج ترميماً',
}

export const PROPERTY_LEGAL_AR: Record<string, string> = {
  titled: 'رسم عقاري',
  in_progress: 'في طور التسوية',
  undivided: 'على الشياع',
  unregistered: 'غير مسجّل',
  other: 'وضعية أخرى',
}

/** الوضعية القانونية بلون: الرسم أخضر، ما يحتاج تسوية ذهبي، غير المسجّل أحمر */
export const PROPERTY_LEGAL_TONE: Record<string, string> = {
  titled: 'text-[#1f6b3f]',
  in_progress: 'text-gold',
  undivided: 'text-gold',
  unregistered: 'text-[#8c2f22]',
  other: 'text-muted',
}

/** صورة توضيحية حسب النوع حين لا يرفع المالك صوراً — تُوسَم «توضيحية» دائماً */
export const PROPERTY_KIND_IMAGE: Record<string, string> = {
  land: '/properties/land.jpg',
  house: '/properties/house.jpg',
  apartment: '/properties/apartment.jpg',
  building: '/properties/building.jpg',
  other: '/properties/house.jpg',
}

/** العقارات التجريبية تحمل هذا الوصف في البذرة — لتمييزها عن عروض حقيقية */
export const isDemoProperty = (description: string | null | undefined) =>
  Boolean(description && description.startsWith('عقار تجريبي'))
