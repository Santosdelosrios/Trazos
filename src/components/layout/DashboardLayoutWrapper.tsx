"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

export default function DashboardLayoutWrapper({
  children,
  plan = "free",
}: {
  children: React.ReactNode;
  plan?: "free" | "premium";
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} plan={plan} />
      
      {/* Overlay for mobile only */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-surface-900/20 backdrop-blur-sm md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className={cn(
        "flex flex-1 flex-col w-full transition-all duration-500 ease-in-out",
        isSidebarOpen ? "md:pl-64" : "md:pl-0"
      )}>
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

