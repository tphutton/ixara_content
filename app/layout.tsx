import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Ops AI",
  description: "AI-native content operations workspace for editorial teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('ixara-content-theme');var d=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch(e){document.documentElement.dataset.theme='dark'}`,
            }}
          />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
