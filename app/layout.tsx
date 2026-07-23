import type { Metadata } from "next";
import "./globals.css";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Card-based AI itinerary generator. Plan trips by dragging cards onto a timeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Always-visible version badge so you can confirm which build is
            running on any deployment (local / TrueNAS). */}
        <div
          className="pointer-events-none fixed bottom-1 right-2 z-[100] rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white/80"
          aria-label={`app version ${APP_VERSION}`}
        >
          v{APP_VERSION}
        </div>
      </body>
    </html>
  );
}
