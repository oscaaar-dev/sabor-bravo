import type { Metadata, Viewport } from "next";
import { Caveat, Lobster, Montserrat } from "next/font/google";
import "./globals.css";

const lobster = Lobster({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lobster",
  display: "swap",
});

/** Letra de pincel/pluma del bloque de texto del hero (muestra aportada por el cliente). */
const caveat = Caveat({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

const montserrat = Montserrat({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sabor Bravo — Menús digitales y pedidos para restaurantes",
    template: "%s · Sabor Bravo",
  },
  description:
    "Crea la carta digital de tu restaurante con QR, recibe pedidos de mesa, recojo o delivery y actualiza tu menú sin depender de un programador.",
};

export const viewport: Viewport = {
  themeColor: "#FFF9EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${lobster.variable} ${montserrat.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
