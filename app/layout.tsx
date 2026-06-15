import type { Metadata } from "next";
import { Cormorant_Garamond, Spectral } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Scriptorium — Session Studio",
  description:
    "A session-prep companion for tabletop RPG dungeon masters. Draft your session, let the Scribe surface what's missing, and finish prepared.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${spectral.variable}`}>
      <body>{children}</body>
    </html>
  );
}
