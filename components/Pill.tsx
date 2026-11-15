import Icon, { type IconName } from '@/components/Icon'

/**
 * شارة حالة — الواجهة واللوحة تستعملانها.
 *
 * اللون يقول ما يقوله النصّ لا أكثر: الذهبي لما ينتظر فعلاً منّا،
 * والأزرق لما يجري، والأخضر لما تمّ، والرمادي لما توقّف، والأحمر للمنع.
 * ولا شارة بلا نصّ: اللون وحده لا يُقرأ لمن لا يميّز الألوان.
 */
export type Tone = 'gold' | 'blue' | 'green' | 'gray' | 'red'

const TONE: Record<Tone, string> = {
  gold: 'bg-gold-soft text-gold',
  blue: 'bg-brand-soft text-brand',
  green: 'bg-[#e4f1ea] text-[#1d6b45]',
  gray: 'bg-surface-2 text-muted',
  red: 'bg-[#fdeaea] text-[#8a2020]',
}

export default function Pill({
  children,
  tone = 'gray',
  icon,
}: {
  children: React.ReactNode
  tone?: Tone
  icon?: IconName
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={1.8} />}
      {children}
    </span>
  )
}
