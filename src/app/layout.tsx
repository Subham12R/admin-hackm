import type { Metadata } from "next"
import { Geist, Geist_Mono, Geist_Pixel } from "next/font/google"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import { themeScript } from "@/lib/theme"

import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const geistPixel = Geist_Pixel({
  subsets: ["latin"],
  axes: ["ELSH"],
  variable: "--font-geist-pixel",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HackMatrix Admin",
  description: "HackMatrix administration dashboard",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${geistPixel.variable} overscroll-none antialiased font-sans`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="overscroll-none">
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-pixel-square tracking-tighter" }} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
