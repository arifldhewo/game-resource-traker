import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Rajdhani } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/layout/store-hydrator";
import { Topbar } from "@/components/layout/topbar";
import { Footer } from "@/components/layout/footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://forecast.arifldhewo.my.id"),
  title: {
    default: "PRTS Forecast",
    template: "%s · PRTS Forecast",
  },
  description:
    "Arknights gacha forecast: project per spending tier whether you reach your target potential before the banner deadline. No backend.",
  openGraph: {
    title: "PRTS Forecast",
    description: "Know your pulls before the banner ends.",
    type: "website",
    url: "https://forecast.arifldhewo.my.id/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${rajdhani.variable} ${jetbrains.variable}`}
    >
      <body>
        <StoreHydrator />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Topbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
