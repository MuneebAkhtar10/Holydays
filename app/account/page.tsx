"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { countries } from "@/lib/places";
import { readJson } from "@/lib/readJson";
import { useSerai } from "@/lib/store";

type Account = {
  name: string;
  email: string;
  image: string | null;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  nationality: string;
  residency: string;
  hasPassword: boolean;
  google: boolean;
  preferences: { lang?: string; theme?: string; notes?: string };
};

function emptyAccount(d: Partial<Account> = {}): Account {
  return {
    name: d.name ?? "",
    email: d.email ?? "",
    image: d.image ?? null,
    phone: d.phone ?? "",
    phoneVerified: Boolean(d.phoneVerified),
    emailVerified: Boolean(d.emailVerified),
    nationality: d.nationality ?? "",
    residency: d.residency ?? "",
    hasPassword: Boolean(d.hasPassword),
    google: Boolean(d.google),
    preferences: { notes: d.preferences?.notes ?? "", lang: d.preferences?.lang, theme: d.preferences?.theme },
  };
}

export default function AccountPage() {
  const { status } = useSession();
  const router = useRouter();
  const { lang, setLang, theme, setTheme } = useSerai();
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Account | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  const load = async () => {
    const res = await fetch("/api/account", { cache: "no-store" });
    const d = await readJson<Account & { error?: string }>(res);
    if (!res.ok || !d) {
      setMe(null);
      return;
    }
    const next = emptyAccount(d);
    setMe(next);
    setOtpSent(false);
    if (next.phoneVerified) setOtpPreview("");
    if (d.preferences?.lang === "en" || d.preferences?.lang === "ur") setLang(d.preferences.lang);
    if (d.preferences?.theme === "light" || d.preferences?.theme === "dark") setTheme(d.preferences.theme);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/account");
    if (status === "authenticated") void load();
  }, [status]);

  if (status === "loading" || !me) return <PageLoader label="Opening your account" />;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setNotice("");
    setOverlay("Saving profile");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: me.name,
        email: me.email,
        image: me.image,
        nationality: me.nationality,
        residency: me.residency,
        preferences: { lang, theme, notes: me.preferences?.notes ?? "" },
      }),
    });
    const d = await readJson<{ error?: string; preview?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setProfileError(d?.error || "Could not save.");
      return;
    }
    setNotice(d?.preview ? `Saved. Verify your new email: ${d.preview}` : "Profile saved.");
    await load();
  };

  const photo = async (file: File) => {
    setProfileError("");
    setOverlay("Uploading photo");
    const body = new FormData();
    body.set("file", file);
    const up = await fetch("/api/uploads", { method: "POST", body });
    const d = await readJson<{ url?: string; error?: string }>(up);
    if (!up.ok || !d?.url) {
      setOverlay(null);
      setProfileError(d?.error || "Could not upload photo.");
      return;
    }
    const saved = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: d.url }),
    });
    setOverlay(null);
    if (!saved.ok) {
      setProfileError("Photo uploaded but profile did not save.");
      return;
    }
    setMe({ ...me, image: d.url });
    setNotice("Photo updated.");
  };

  const resendEmail = async () => {
    setProfileError("");
    setOverlay("Sending verification");
    const res = await fetch("/api/account/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await readJson<{ preview?: string; error?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setProfileError(d?.error || "Could not send verification email.");
      return;
    }
    setEmailSent(true);
    setNotice(d?.preview ? `Open this demo link to verify: ${d.preview}` : "Verification email sent.");
  };

  const sendOtp = async () => {
    setPhoneError("");
    setNotice("");
    setOverlay("Sending code");
    const res = await fetch("/api/account/phone/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: me.phone }),
    });
    const d = await readJson<{ preview?: string; error?: string; phone?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setPhoneError(d?.error || "Could not send code.");
      return;
    }
    if (d?.phone) setMe({ ...me, phone: d.phone, phoneVerified: false });
    setOtp("");
    setOtpSent(true);
    setOtpPreview(d?.preview || "");
    setNotice(d?.preview ? `Code sent. For this demo, your OTP is ${d.preview}.` : "Code sent to your phone.");
  };

  const verifyOtp = async () => {
    setPhoneError("");
    setOverlay("Checking code");
    const res = await fetch("/api/account/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: otp }),
    });
    const d = await readJson<{ error?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setPhoneError(d?.error || "Could not verify.");
      return;
    }
    setNotice("Phone verified.");
    setOtp("");
    setOtpSent(false);
    setOtpPreview("");
    await load();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setOverlay("Updating password");
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword }),
    });
    const d = await readJson<{ error?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setProfileError(d?.error || "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setNextPassword("");
    setNotice("Password updated.");
    await load();
  };

  const destroy = async () => {
    if (!confirm("Delete your HolyDays account and bookings? This cannot be undone.")) return;
    setOverlay("Deleting account");
    const res = await fetch("/api/account", { method: "DELETE" });
    setOverlay(null);
    if (!res.ok) {
      setProfileError("Could not delete account.");
      return;
    }
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 pb-28">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />
      <p className="text-[11px] uppercase tracking-[0.3em] text-brass">Account</p>
      <h1 className="font-display mt-2 text-5xl">Your profile</h1>
      <p className="mt-3 text-mist">Email, phone, photo, nationality, password, and preferences.</p>
      {notice && <p className="mt-4 break-all rounded-xl border border-brass/30 bg-ink-2 px-4 py-3 text-sm text-sand">{notice}</p>}
      {profileError && <p className="mt-3 text-sm text-rose">{profileError}</p>}

      <form id="profile-form" onSubmit={saveProfile} className="mt-8 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border border-brass/30 bg-ink-2">
            {me.image ? <Image src={me.image} alt="" fill className="object-cover" /> : <span className="grid h-full place-items-center text-mist">Photo</span>}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} />
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
              {me.image ? "Change photo" : "Add profile photo"}
            </button>
          </div>
        </div>
        <label className="auth-label">
          Name
          <input className="auth-field" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} required />
        </label>
        <label className="auth-label">
          Email {me.emailVerified ? "· verified" : "· not verified"}
          <input className="auth-field" type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} required />
        </label>
        {!me.emailVerified && (
          <button type="button" className="btn-ghost text-sm" onClick={() => void resendEmail()}>
            {emailSent ? "Resend verification email" : "Send verification email"}
          </button>
        )}
        <label className="auth-label">
          Nationality
          <select className="auth-field" value={me.nationality} onChange={(e) => setMe({ ...me, nationality: e.target.value })}>
            <option value="">Select</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-label">
          Residency (city / country)
          <input className="auth-field" placeholder="Karachi, Pakistan" value={me.residency} onChange={(e) => setMe({ ...me, residency: e.target.value })} />
        </label>
        <label className="auth-label">
          Preferences note
          <input className="auth-field" placeholder="Quiet rooms, aisle seats…" value={me.preferences?.notes ?? ""} onChange={(e) => setMe({ ...me, preferences: { ...me.preferences, notes: e.target.value } })} />
        </label>
        <p className="text-sm text-mist">Language and theme follow the header controls and are saved with your profile.</p>
      </form>

      <section className="mt-12">
        <h2 className="font-display text-3xl">Phone</h2>
        <p className="mt-2 text-sm text-mist">
          {me.phoneVerified ? "This number is verified." : "Enter a Pakistani mobile, then send a 6-digit OTP."}
        </p>
        {phoneError && <p className="mt-2 text-sm text-rose">{phoneError}</p>}
        <label className="auth-label mt-4">
          Mobile
          <input
            className="auth-field"
            placeholder="03xx xxxxxxx"
            value={me.phone}
            disabled={otpSent && !me.phoneVerified}
            onChange={(e) => {
              setOtpSent(false);
              setMe({ ...me, phone: e.target.value, phoneVerified: false });
            }}
          />
        </label>
        {!me.phoneVerified && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={otpSent ? "btn-ghost" : "btn-primary"} onClick={() => void sendOtp()}>
              {otpSent ? "Resend code" : "Send OTP"}
            </button>
            {otpSent && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                  setOtpPreview("");
                }}
              >
                Change number
              </button>
            )}
          </div>
        )}
        {otpSent && !me.phoneVerified && (
          <div className="mt-4 space-y-3">
            <label className="auth-label">
              OTP code
              <input className="auth-field" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            </label>
            {otpPreview && <p className="text-sm text-brass">Demo code: {otpPreview}</p>}
            <button type="button" className="btn-primary" onClick={() => void verifyOtp()}>
              Verify phone
            </button>
          </div>
        )}
      </section>

      <form onSubmit={changePassword} className="mt-12 space-y-4">
        <h2 className="font-display text-3xl">{me.hasPassword ? "Change password" : "Set a password"}</h2>
        {me.google && <p className="text-sm text-mist">This account can also sign in with Google.</p>}
        {me.hasPassword && (
          <label className="auth-label">
            Current password
            <input className="auth-field" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
        )}
        <label className="auth-label">
          New password
          <input className="auth-field" type="password" minLength={6} required value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">
          Update password
        </button>
      </form>

      <section className="mt-16 border-t border-brass/20 pt-8">
        <h2 className="font-display text-3xl text-rose">Delete account</h2>
        <p className="mt-2 text-sm text-mist">Removes your profile, listings, reviews, and bookings.</p>
        <button type="button" className="btn-ghost mt-4 text-rose" onClick={() => void destroy()}>
          Delete my account
        </button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brass/25 bg-ink/95 px-5 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl justify-end">
          <button type="submit" form="profile-form" className="btn-primary">
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}
