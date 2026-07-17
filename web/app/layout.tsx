import type { Metadata } from "next";
import SiteByteling from "@/components/byteling/SiteByteling";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byteling — your computer, made visible",
  description:
    "A desktop pet hatched from your own hardware. It gets hot when your GPU does, hungry when your disk fills up, and tired when you never reboot.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteByteling />
        {children}
      </body>
    </html>
  );
}