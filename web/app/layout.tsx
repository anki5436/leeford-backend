import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leeford Healthcare Admin Portal",
  description: "Secure administration portal for Leeford Healthcare",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
