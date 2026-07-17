"use client";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

export default function ConfirmEmailPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F7F5FA", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#EDE0F7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Mail size={36} style={{ color: "#5B0EA6" }} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0A0A0A", margin: "0 0 12px", fontFamily: "var(--font-display,Syne,sans-serif)" }}>
        Check your email
      </h1>
      <p style={{ fontSize: 14, color: "#6B6B6B", margin: "0 0 8px", lineHeight: 1.6 }}>
        We sent a confirmation link to your email address.
      </p>
      <p style={{ fontSize: 13, color: "#9E9E9E", margin: "0 0 32px", lineHeight: 1.6 }}>
        Click the link in the email to activate your account then sign in.
      </p>
      <button onClick={() => router.push("/login")}
        style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#5B0EA6,#7B2FBE)", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Go to Sign In
      </button>
    </div>
  );
}