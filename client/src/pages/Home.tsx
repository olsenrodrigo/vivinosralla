import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/brand/HeroSection";
import CollectionsGrid from "@/components/brand/CollectionsGrid";
import NewArrivals from "@/components/brand/NewArrivals";
import AboutTeaser from "@/components/brand/AboutTeaser";
import SocialProof from "@/components/brand/SocialProof";
import WhatsAppCta from "@/components/brand/WhatsAppCta";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <NewArrivals chapeu="Selecionadas a dedo" titulo="Favoritas da estação" destaques />
        <CollectionsGrid />
        <AboutTeaser />
        <NewArrivals chapeu="Acabou de chegar" titulo="Novidades no provador" />
        <SocialProof />
        <WhatsAppCta />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
