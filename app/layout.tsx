import "./globals.css"
import { Toaster } from "sonner"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { ProModal } from "@/components/pro-modal"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider dynamic>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* NAVBAR */}
            <Navbar />

            <ProModal />

            {/* WRAPPER */}
            <div className="flex h-full pt-16 relative">

              {/* Sidebar */}
              <div className="hidden md:flex w-20 fixed top-16 inset-y-0 flex-col z-40">
                <Sidebar />
              </div>

              {/* MAIN CONTENT */}
              <main
                className="
                  flex-1
                  md:ml-20
                  min-h-screen
                  pt-0
                  px-6
                  relative
                  z-10
                "
              >
                {children}
              </main>
            </div>

            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
