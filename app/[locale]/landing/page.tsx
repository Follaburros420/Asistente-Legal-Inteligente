"use client"

import CTA from "@/components/landing/CTA"
import FAQs from "@/components/landing/FAQs"
import Features from "@/components/landing/Features"
import Hero from "@/components/landing/Hero"
import Layout from "@/components/landing/Layout"
import Pricing from "@/components/landing/Pricing"
import Testimonials from "@/components/landing/Testimonials"
import VisualFeatures from "@/components/landing/VisualFeatures"

export default function LandingPage() {
  return (
    <Layout>
      <Hero />
      <VisualFeatures />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQs />
      <CTA />
    </Layout>
  )
}
