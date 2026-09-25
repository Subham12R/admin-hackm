import type { Metadata } from "next"
import { Geist, Geist_Mono, Geist_Pixel } from "next/font/google"
import type { ReactNode } from "react"

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
    >
      <body className="overscroll-none">{children}</body>
    </html>
  )
}
