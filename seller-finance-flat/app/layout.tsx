import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seller Finance Auto Offers",
  description: "Analyze Zillow listings and generate intelligent creative financing offers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
