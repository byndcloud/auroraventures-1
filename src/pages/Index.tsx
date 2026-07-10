import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { BeyondPower } from "@/components/landing/BeyondPower";
import { VerticalsSection } from "@/components/landing/VerticalsSection";
import { OriginationSection } from "@/components/landing/OriginationSection";
import { SolutionsSection } from "@/components/landing/SolutionsSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { BenefitsSection, Footer } from "@/components/landing/BenefitsFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <BeyondPower />
      <VerticalsSection />
      <OriginationSection />
      <SolutionsSection />
      <RoadmapSection />
      <BenefitsSection />
      <Footer />
    </div>
  );
};

export default Index;
