import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'لوحة القيادة — اللَّبنة',
  robots: { index: false, follow: false },
}

/** الـBack-office بالعربية فقط — فضاء داخلي لفريق اللَّبنة. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
