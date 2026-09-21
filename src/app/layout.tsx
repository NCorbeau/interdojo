import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interdojo",
  description: "Fast, active drills for technical and interview readiness.",
  applicationName: "Interdojo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Interdojo",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
