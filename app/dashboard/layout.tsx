import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

import { getAgency } from "@/features/storefront/lib/agency";

export async function generateMetadata(): Promise<Metadata> {
  const name = (await getAgency()).name || "Travel agency";
  return { title: `${name} staff`, description: `Staff dashboard for ${name}.` };
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
