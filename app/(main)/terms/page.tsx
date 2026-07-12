"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #3D0066 0%, #5B0EA6 55%, #7B2FBE 100%)", padding: "52px 20px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,200,83,0.2), transparent 70%)" }} />
        <button onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", marginBottom: 20 }}>
          <ArrowLeft size={16} style={{ color: "#FFFFFF" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>Back</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            <Image src="/chillz-icon.png" alt="Chillz" width={44} height={44} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Terms of Service</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Effective: July 2026 · Chillz Nigeria</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: 0 }}>
            Welcome to Chillz. By creating an account and using our platform, you agree to the following terms. Please read them carefully. These terms govern your use of the Chillz mobile and web application, operated by Chillz Nigeria.
          </p>
        </div>

        {[
          {
            title: "1. Who We Are",
            body: `Chillz is a lifestyle discovery and booking platform designed for users in Lagos and Port Harcourt, Nigeria. We connect guests with venues, event organizers, hotels, restaurants, car rental providers, and apartment hosts (collectively "Vendors"). Chillz acts as an intermediary — we facilitate bookings and payments but are not a party to the service contract between you and any Vendor.`,
          },
          {
            title: "2. Eligibility",
            body: `You must be at least 18 years old to create an account and use Chillz. By registering, you confirm that the information you provide is accurate and up to date. You are responsible for maintaining the security of your account credentials. Do not share your password with anyone.`,
          },
          {
            title: "3. User Accounts",
            body: `When you create an account, you agree to provide accurate personal information including your full name and a valid email address. You are solely responsible for all activity that occurs under your account. Chillz reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform.`,
          },
          {
            title: "4. Bookings and Payments",
            body: `All bookings made through Chillz are subject to availability and confirmation by the Vendor. Payments are processed via Paystack, a PCI-compliant payment gateway. When you make a booking, your payment is held in escrow and only released to the Vendor after your experience is confirmed complete. Chillz deducts a 5% platform fee from Vendor earnings. Prices are displayed in Nigerian Naira (₦). Chillz does not charge users a service fee on standard bookings, though ticket purchases and specific packages may include processing fees disclosed at checkout.`,
          },
          {
            title: "5. Cancellations and Refunds",
            body: `Cancellation policies vary by Vendor. If a Vendor rejects or cancels your booking, your reserved amount is automatically refunded to your Chillz wallet within 24 hours. Wallet funds can be used on future bookings. If you dispute a completed booking, Chillz support will review within 8 hours and mediate a resolution. Chillz's decision on disputes is final. Refunds to original payment methods are subject to Paystack processing timelines.`,
          },
          {
            title: "6. Vendor Responsibilities",
            body: `Vendors on Chillz agree to provide accurate descriptions of their services, maintain the quality of service offered, honour confirmed bookings, and respond to disputes in good faith. Vendors who repeatedly cancel bookings, provide misleading information, or receive sustained negative reviews may be suspended or permanently removed from the platform. Vendors must comply with all applicable Nigerian laws and regulations in the operation of their businesses.`,
          },
          {
            title: "7. Tickets and Events",
            body: `Tickets purchased through Chillz are non-transferable unless stated otherwise by the Event Organizer. Tickets are tied to the purchasing account and verified via QR code at entry. Chillz is not liable for event cancellations by the organizer, though we will facilitate refunds where applicable. Resale of tickets obtained through Chillz is strictly prohibited.`,
          },
          {
            title: "8. Prohibited Conduct",
            body: `You agree not to: use Chillz for any unlawful purpose; attempt to gain unauthorized access to any part of the platform; post false reviews or manipulate ratings; use automated tools to scrape, copy, or misuse platform data; impersonate any person or entity; harass, threaten, or abuse other users or Vendors; or attempt to circumvent Chillz's escrow payment system by arranging off-platform payments. Violations may result in immediate account termination and legal action where appropriate.`,
          },
          {
            title: "9. Intellectual Property",
            body: `All content on Chillz — including the name, logo, interface design, and code — is the intellectual property of Chillz Nigeria. Vendors retain ownership of images and content they upload, but grant Chillz a non-exclusive licence to display such content on the platform. You may not reproduce, distribute, or create derivative works from any Chillz content without written permission.`,
          },
          {
            title: "10. Liability Limitations",
            body: `Chillz provides the platform on an "as is" basis. We do not guarantee uninterrupted access or that every Vendor will meet your expectations. Chillz is not liable for any direct, indirect, or consequential loss arising from your use of the platform, including loss arising from Vendor conduct, cancelled events, or technical issues beyond our reasonable control. Our aggregate liability to you for any claim shall not exceed the total amount you paid through Chillz in the 30 days preceding the claim.`,
          },
          {
            title: "11. Governing Law",
            body: `These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from these terms or your use of Chillz shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria. If any provision of these terms is found to be unenforceable, the remaining provisions remain in full force.`,
          },
          {
            title: "12. Changes to These Terms",
            body: `Chillz reserves the right to update these terms at any time. We will notify you of significant changes via in-app notification or email. Continued use of Chillz after changes take effect constitutes acceptance of the updated terms. The current effective date is always displayed at the top of this page.`,
          },
          {
            title: "13. Contact",
            body: `For questions about these terms, please contact us at support@chillz.app or through the Support tab in the Chillz app. We aim to respond to all inquiries within 48 hours on business days.`,
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{title}</h2>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.8, margin: 0 }}>{body}</p>
          </div>
        ))}

        <div style={{ height: 1, backgroundColor: "#F2EEF9" }} />

        <p style={{ fontSize: 12, color: "#9E9E9E", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
          Chillz Nigeria · Lagos & Port Harcourt{"\n"}
          Last updated: July 2026
        </p>
      </div>
    </div>
  );
}