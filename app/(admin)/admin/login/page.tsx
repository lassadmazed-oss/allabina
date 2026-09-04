import AdminLogin from '@/components/AdminLogin'

export const metadata = { title: 'دخول — لوحة القيادة' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <AdminLogin next={next} />
}
