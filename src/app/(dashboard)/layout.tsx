import { CollapsibleSidebar } from "@/components/layout/CollapsibleSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0d17] text-white">
      <CollapsibleSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
