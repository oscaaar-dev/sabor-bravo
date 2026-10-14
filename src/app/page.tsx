import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Demos } from "@/components/sections/Demos";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { FinalCta } from "@/components/sections/FinalCta";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Plans } from "@/components/sections/Plans";
import { Problem } from "@/components/sections/Problem";

export default function HomePage() {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:bg-blanco focus:p-3 focus:font-extrabold"
      >
        Saltar al contenido
      </a>
      <Nav />
      <main id="contenido">
        <Hero />
        <Problem />
        <Features />
        <Demos />
        <HowItWorks />
        <Plans />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
