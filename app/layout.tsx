import "./globals.css";
import { Suspense } from "react";
import ClientShell from "../components/ClientShell";
import RouteNav from "../components/RouteNav";
import { StudentProvider } from "../components/StudentContext";
import AppShell from "../components/AppShell";
import GlobalParticles from "../components/GlobalParticles";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#05070B", color: "white" }}>
        <GlobalParticles />
        <StudentProvider>
          <div style={{ position: "relative", zIndex: 1 }}>
            <AppShell>
              <Suspense fallback={null}>
                <RouteNav />
              </Suspense>
              <Suspense fallback={null}>
                <ClientShell>{children}</ClientShell>
              </Suspense>
            </AppShell>
          </div>
        </StudentProvider>
      </body>
    </html>
  );
}
