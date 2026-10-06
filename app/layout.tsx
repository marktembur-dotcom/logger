import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GC Command Center",
  description: "Gold futures options reaction-level dashboard",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
