import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Apogee · the daily launch",
  description:
    "Seven prompts a day, same for everyone. Rare answers fly farther. Obvious ones barely leave the pad. How far out can you get?",
  openGraph: {
    title: "Apogee · the daily launch",
    description: "Seven prompts a day. Rare answers fly farther. How far out can you get?",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#02040a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${mono.variable} h-full`}>
      {/* Browser extensions (ColorZilla etc.) add attributes to <body> before React loads. */}
      <body className="scanlines min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
