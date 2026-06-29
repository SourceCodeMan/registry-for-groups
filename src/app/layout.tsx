import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Shared gift registries for families and groups — make wishlists, claim gifts, and never spoil a surprise.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://registryforgroups.com",
  ),
  title: {
    default: "Registry for Groups — gift registries for families & groups",
    template: "%s · Registry for Groups",
  },
  description,
  openGraph: {
    title: "Registry for Groups",
    description,
    type: "website",
    siteName: "Registry for Groups",
  },
  twitter: { card: "summary_large_image", title: "Registry for Groups", description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
