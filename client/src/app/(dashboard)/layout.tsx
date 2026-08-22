import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 lg:px-8">
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
