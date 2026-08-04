import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ReactQueryProvider } from "@/components/ReactQueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "REN Monitor",
  description: "Dashboard REN-Dashboard",
  icons: {
    icon: "/logoren.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="antialiased h-full" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <ReactQueryProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
