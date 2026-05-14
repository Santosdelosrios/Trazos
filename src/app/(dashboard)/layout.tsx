import { Suspense } from "react";
import DashboardLayoutWrapper from "@/components/layout/DashboardLayoutWrapper";
import TizaChatWrapper from "@/components/asistente/TizaChatWrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayoutWrapper>
      {children}
      <Suspense fallback={null}>
        <TizaChatWrapper />
      </Suspense>
    </DashboardLayoutWrapper>
  );
}
