import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlogSite Admin",
  description: "Admin dashboard for BlogSite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
