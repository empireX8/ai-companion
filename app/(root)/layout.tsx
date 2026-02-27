import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { UndoToastContainer } from "@/components/undo/UndoToastContainer"

const RootGroupLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <>
      <Navbar />

      <div className="relative flex h-full pt-16">
        <div className="fixed top-16 inset-y-0 z-40 hidden w-20 flex-col md:flex">
          <Sidebar />
        </div>

        <main className="relative z-10 min-h-screen flex-1 px-6 pt-0 md:ml-20">
          {children}
        </main>
      </div>

      <UndoToastContainer />
    </>
  )
}

export default RootGroupLayout
