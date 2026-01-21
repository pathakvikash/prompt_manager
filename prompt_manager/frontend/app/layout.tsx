import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

import { AuthProvider } from "@/components/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prompt Manager",
  description: "Manage and optimize your LLM prompts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-900 text-gray-100 min-h-screen`}>
        <AuthProvider>
          <Header />
          <main className="container mx-auto p-4 md:p-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
