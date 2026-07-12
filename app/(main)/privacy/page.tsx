"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function PrivacyPage() {
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
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF", margin: 0, fontFamily: "var(--font-display, Syne, sans-serif)" }}>Privacy Policy</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Effective: July 2026 · Chillz Nigeria</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 24 }}>

        <div style={{ backgroundColor: "#F7F5FA", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.7, margin: 0 }}>
            Your privacy matters to us. This policy explains what data Chillz collects, why we collect it, how we use it, and what rights you have over it. We keep this simple and honest.
          </p>
        </div>

        {[
          {
            title: "1. Who This Applies To",
            body: `This Privacy Policy applies to all users of the Chillz platform — including guests who book experiences and Vendors who list their businesses. It covers our mobile app, web app, and any related services operated by Chillz Nigeria.`,
          },
          {
            title: "2. What We Collect",
            body: `We collect information you give us directly: your full name, email address, phone number, and password when you register. For Vendors, we also collect your business name, business type, venue details, bank account information (for payouts), and any images or content you upload.\n\nWe collect information automatically when you use Chillz: your device type, browser, IP address, pages visited, features used, and time spent. We use this to understand how the app is used and to improve it.\n\nWhen you make a booking or purchase a ticket, we collect payment information. All payment data is handled by Paystack — Chillz does not store your card details.\n\nIf you connect via Google Sign-In, we receive your name, email address, and profile picture from Google, subject to your Google privacy settings.`,
          },
          {
            title: "3. How We Use Your Data",
            body: `We use your data to: create and manage your account; process bookings and payments; send booking confirmations, receipts, and notifications; match you with relevant venues and events based on your activity; resolve disputes between users and Vendors; improve the platform based on usage patterns; comply with legal obligations; and communicate with you about changes to the service.\n\nWe do not sell your personal data to third parties. We do not use your data for targeted advertising outside of Chillz.`,
          },
          {
            title: "4. Cookies and Tracking",
            body: `Chillz uses cookies and similar technologies to keep you logged in, remember your preferences, and measure how you use the app. Essential cookies are required for the app to function and cannot be declined. Non-essential cookies (analytics and preference cookies) can be declined via the cookie consent prompt when you first use the app.\n\nWe use Supabase for authentication and data storage, which may set session cookies on your device. These cookies expire when your session ends or after 7 days of inactivity, whichever comes first.`,
          },
          {
            title: "5. Data Sharing",
            body: `We share limited data only where necessary:\n\n• With Vendors: when you make a booking, the Vendor receives your name, booking details, and contact information necessary to provide the service.\n\n• With Paystack: to process payments. Paystack is PCI-DSS compliant and governed by its own privacy policy.\n\n• With Supabase: our database and authentication provider, which stores your account and booking data on secure servers.\n\n• With law enforcement: only if required by valid legal process or to protect the safety of users.\n\nWe do not share your data with advertisers, data brokers, or any party not listed above.`,
          },
          {
            title: "6. Data Storage and Security",
            body: `Your data is stored on Supabase infrastructure hosted in the EU (West Europe, London). We use industry-standard encryption in transit (TLS) and at rest. Access to user data is restricted to authorised Chillz team members on a need-to-know basis.\n\nDespite our security measures, no system is completely secure. If a data breach occurs that affects your rights and freedoms, we will notify affected users within 72 hours of becoming aware.`,
          },
          {
            title: "7. Data Retention",
            body: `We retain your account data for as long as your account is active. If you delete your account, we remove your personal data within 30 days, except where we are legally required to retain records (e.g. financial transaction records, which we retain for 7 years as required by Nigerian financial regulations).\n\nBooking history and receipts are retained for the legally required period and then permanently deleted.`,
          },
          {
            title: "8. Your Rights",
            body: `You have the right to: access the personal data we hold about you; correct inaccurate data; request deletion of your account and data; withdraw consent for non-essential data processing at any time; and receive a copy of your data in a portable format.\n\nTo exercise any of these rights, contact us via the Support tab in the app or at support@chillz.app. We will respond within 14 days. Some requests may be subject to identity verification before we can action them.`,
          },
          {
            title: "9. Children's Privacy",
            body: `Chillz is not intended for users under 18 years of age. We do not knowingly collect personal data from anyone under 18. If we become aware that a user is under 18, we will delete their account and associated data immediately. If you believe a minor has registered on our platform, please contact us.`,
          },
          {
            title: "10. Third-Party Links",
            body: `Chillz may display links to Vendor websites, Instagram pages, or external event pages. These are not governed by this privacy policy. We encourage you to read the privacy policies of any third-party sites you visit through our platform. Chillz is not responsible for the privacy practices of external sites.`,
          },
          {
            title: "11. Changes to This Policy",
            body: `We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this page and, for significant changes, notify you via in-app notification or email. Your continued use of Chillz after changes take effect means you accept the updated policy.`,
          },
          {
            title: "12. Contact Us",
            body: `If you have any questions, concerns, or requests about your privacy, please contact us:\n\nEmail: support@chillz.app\nSupport: Available in-app under the Support tab\nResponse time: Within 48 hours on business days\n\nChillz Nigeria, Lagos, Nigeria.`,
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0A0A0A", margin: "0 0 8px", fontFamily: "var(--font-display, Syne, sans-serif)" }}>{title}</h2>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.8, margin: 0, whiteSpace: "pre-line" }}>{body}</p>
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