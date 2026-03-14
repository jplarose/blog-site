import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlogSite",
  description: "A personal blog powered by BlogSite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
