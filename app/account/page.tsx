"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { LoaderOverlay, PageLoader } from "@/components/PageLoader";
import { countries } from "@/lib/places";
import { readJson } from "@/lib/readJson";
import { postImageUpload } from "@/lib/prepare-image";
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

const CARD = "rounded-2xl border border-brass/25 bg-ink-2/70 p-5 sm:p-6";
const EYEBROW = "text-[11px] uppercase tracking-[0.18em] text-brass";

function StatusPill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
        ok ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-500"}`} />
      {ok ? yes : no}
    </span>
  );
}

function OtpInput({ value, onChange, onComplete, disabled }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const commit = (next: string) => {
    onChange(next);
    if (next.length === 6) onComplete(next);
  };
  const type = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    const next = (value.slice(0, i) + d).slice(0, 6);
    commit(next);
    refs.current[Math.min(next.length, 5)]?.focus();
  };
  const key = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d) {
      commit(d);
      refs.current[Math.min(d.length, 5)]?.focus();
    }
  };

  return (
    <div className="flex gap-2" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={d}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-10 rounded-xl border border-brass/30 bg-ink/40 text-center text-lg font-semibold text-sand outline-none focus:border-brass focus:ring-2 focus:ring-brass/30 sm:w-11"
          onChange={(e) => type(i, e.target.value)}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export default function AccountPage() {
  const { status } = useSession();
  const router = useRouter();
  const { lang, setLang, theme, setTheme } = useSerai();
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Account | null>(null);
  const [savedEmail, setSavedEmail] = useState("");
  const [overlay, setOverlay] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [otp, setOtp] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [emailWait, setEmailWait] = useState(0);
  const [phoneWait, setPhoneWait] = useState(0);
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
    setSavedEmail(next.email);
    if (next.phoneVerified) {
      setOtpSent(false);
      setOtpPreview("");
      setEditingPhone(false);
    }
    if (d.preferences?.lang === "en" || d.preferences?.lang === "ur") setLang(d.preferences.lang);
    if (d.preferences?.theme === "light" || d.preferences?.theme === "dark") setTheme(d.preferences.theme);
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/account");
    if (status === "authenticated") void load();
  }, [status]);

  // one ticking clock for both resend countdowns
  useEffect(() => {
    if (emailWait <= 0 && phoneWait <= 0) return;
    const t = setInterval(() => {
      setEmailWait((n) => Math.max(0, n - 1));
      setPhoneWait((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [emailWait > 0, phoneWait > 0]);

  if (status === "loading" || !me) return <PageLoader label="Opening your account" />;

  const emailChanged = me.email.trim().toLowerCase() !== savedEmail.toLowerCase();
  const verifiedCount = Number(me.emailVerified) + Number(me.phoneVerified);
  const initials = me.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

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
    if (emailChanged) {
      setEmailWait(45);
      setEmailMsg({ text: d?.preview ? `Saved. Demo link: ${d.preview}` : `We sent a confirmation link to ${me.email}. Open it to verify the new address.`, ok: true });
    }
    setNotice("Profile saved.");
    await load();
  };

  const photo = async (file: File) => {
    setProfileError("");
    setOverlay("Uploading photo");
    try {
      const d = await postImageUpload(file);
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
    } catch (err) {
      setOverlay(null);
      setProfileError(err instanceof Error ? err.message : "Could not upload photo.");
    }
  };

  const sendEmailLink = async () => {
    setEmailMsg(null);
    setOverlay("Sending verification email");
    const res = await fetch("/api/account/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await readJson<{ preview?: string; error?: string; retryAfter?: number }>(res);
    setOverlay(null);
    if (!res.ok) {
      if (d?.retryAfter) setEmailWait(d.retryAfter);
      setEmailMsg({ text: d?.error || "Could not send the email.", ok: false });
      return;
    }
    setEmailWait(45);
    setEmailMsg({
      text: d?.preview ? `Demo link (email is not set up here): ${d.preview}` : `Sent to ${savedEmail}. Open the link in that email. Check your spam folder if it does not arrive.`,
      ok: true,
    });
  };

  const sendOtp = async () => {
    setPhoneMsg(null);
    setOverlay("Sending code");
    const res = await fetch("/api/account/phone/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: me.phone }),
    });
    const d = await readJson<{ preview?: string; error?: string; phone?: string; retryAfter?: number; cooldown?: number }>(res);
    setOverlay(null);
    if (!res.ok) {
      if (d?.retryAfter) setPhoneWait(d.retryAfter);
      setPhoneMsg({ text: d?.error || "Could not send the code.", ok: false });
      return;
    }
    if (d?.phone) setMe({ ...me, phone: d.phone, phoneVerified: false });
    setOtp("");
    setOtpSent(true);
    setPhoneWait(d?.cooldown ?? 45);
    setOtpPreview(d?.preview || "");
    setPhoneMsg({ text: d?.preview ? "SMS is not set up on this server, so the code is shown below for testing." : `We texted a 6-digit code to ${d?.phone ?? me.phone}.`, ok: true });
  };

  const verifyOtp = async (code = otp) => {
    if (code.length !== 6) {
      setPhoneMsg({ text: "Enter all 6 digits.", ok: false });
      return;
    }
    setPhoneMsg(null);
    setOverlay("Checking code");
    const res = await fetch("/api/account/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await readJson<{ error?: string }>(res);
    setOverlay(null);
    if (!res.ok) {
      setOtp("");
      setPhoneMsg({ text: d?.error || "Could not verify.", ok: false });
      return;
    }
    setOtp("");
    setOtpSent(false);
    setOtpPreview("");
    setEditingPhone(false);
    setPhoneMsg({ text: "Phone number verified.", ok: true });
    await load();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setNotice("");
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

  const msg = (m: { text: string; ok: boolean } | null) =>
    m ? <p className={`mt-2 break-all rounded-lg px-3 py-2 text-xs ${m.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-rose/10 text-rose"}`}>{m.text}</p> : null;

  const phoneLocked = me.phoneVerified && !editingPhone;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 pb-28">
      <LoaderOverlay show={Boolean(overlay)} label={overlay ?? "Updating"} />

      <div className="flex flex-wrap items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-brass/40 bg-ink-2">
          {me.image ? <Image src={me.image} alt="" fill sizes="80px" className="object-cover" /> : <span className="grid h-full place-items-center font-display text-2xl text-brass">{initials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className={EYEBROW}>Account</p>
          <h1 className="font-display mt-0.5 truncate text-3xl sm:text-4xl">{me.name || "Your profile"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill ok={me.emailVerified} yes="Email verified" no="Email not verified" />
            <StatusPill ok={me.phoneVerified} yes="Phone verified" no="Phone not verified" />
          </div>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} />
          <button type="button" className="btn-ghost px-4! py-2! text-sm!" onClick={() => fileRef.current?.click()}>
            {me.image ? "Change photo" : "Add photo"}
          </button>
        </div>
      </div>

      {verifiedCount < 2 && (
        <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-sand/90">
          Verify your {!me.emailVerified && !me.phoneVerified ? "email and phone" : !me.emailVerified ? "email" : "phone number"} so we can reach you about bookings and keep your account safe.
        </p>
      )}
      {notice && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">{notice}</p>}
      {profileError && <p className="mt-4 rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">{profileError}</p>}

      <form id="profile-form" onSubmit={saveProfile} className="mt-6 space-y-6">
        <section className={CARD}>
          <h2 className="font-display text-xl">Personal details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="auth-label sm:col-span-2">
              Full name
              <input className="auth-field" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} required />
            </label>
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
              Residency (city, country)
              <input className="auth-field" placeholder="Karachi, Pakistan" value={me.residency} onChange={(e) => setMe({ ...me, residency: e.target.value })} />
            </label>
            <label className="auth-label sm:col-span-2">
              Preferences
              <input
                className="auth-field"
                placeholder="Quiet rooms, aisle seats…"
                value={me.preferences?.notes ?? ""}
                onChange={(e) => setMe({ ...me, preferences: { ...me.preferences, notes: e.target.value } })}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-mist">Language and theme follow the header controls and are saved with your profile.</p>
        </section>

        <section className={CARD}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Contact & verification</h2>
            <p className="text-xs text-mist">{verifiedCount} of 2 verified</p>
          </div>

          {/* Email */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="acct-email" className="text-[11px] uppercase tracking-[0.16em] text-brass">
                Email
              </label>
              <StatusPill ok={me.emailVerified && !emailChanged} yes="Verified" no={emailChanged ? "Unsaved change" : "Not verified"} />
            </div>
            <input id="acct-email" className="auth-field" type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} required />
            {emailChanged ? (
              <p className="mt-2 text-xs text-mist">Save your profile below and we will email a confirmation link to this new address.</p>
            ) : !me.emailVerified ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary px-4! py-2! text-sm!" disabled={emailWait > 0} onClick={() => void sendEmailLink()}>
                  {emailWait > 0 ? `Resend in ${emailWait}s` : emailMsg?.ok ? "Resend verification email" : "Send verification email"}
                </button>
                <span className="text-xs text-mist">We will email a link to {savedEmail}.</span>
              </div>
            ) : null}
            {msg(emailMsg)}
          </div>

          <div className="my-5 border-t border-brass/10" />

          {/* Phone */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="acct-phone" className="text-[11px] uppercase tracking-[0.16em] text-brass">
                Mobile number
              </label>
              <StatusPill ok={me.phoneVerified && !editingPhone} yes="Verified" no="Not verified" />
            </div>
            <div className="flex gap-2">
              <input
                id="acct-phone"
                className="auth-field"
                placeholder="+92 300 1234567"
                inputMode="tel"
                value={me.phone}
                disabled={phoneLocked || otpSent}
                onChange={(e) => {
                  setOtpSent(false);
                  setPhoneMsg(null);
                  setMe({ ...me, phone: e.target.value, phoneVerified: false });
                }}
              />
              {phoneLocked && (
                <button type="button" className="btn-ghost mt-[0.45rem]! shrink-0 px-4! py-2! text-sm!" onClick={() => setEditingPhone(true)}>
                  Change
                </button>
              )}
            </div>
            {!me.phoneVerified && !otpSent && (
              <>
                <p className="mt-2 text-xs text-mist">Include your country code, for example +92 300 1234567. Pakistani numbers can start with 03.</p>
                <div className="mt-3">
                  <button type="button" className="btn-primary px-4! py-2! text-sm!" disabled={phoneWait > 0 || !me.phone.trim()} onClick={() => void sendOtp()}>
                    {phoneWait > 0 ? `Resend in ${phoneWait}s` : "Send verification code"}
                  </button>
                </div>
              </>
            )}
            {otpSent && !me.phoneVerified && (
              <div className="mt-4 rounded-xl border border-brass/20 bg-ink/25 p-4">
                <p className="text-sm text-sand">Enter the 6-digit code we sent to {me.phone}</p>
                <div className="mt-3">
                  <OtpInput value={otp} onChange={setOtp} onComplete={(v) => void verifyOtp(v)} />
                </div>
                {otpPreview && <p className="mt-3 text-xs text-brass">Testing code: <span className="font-semibold tracking-[0.2em]">{otpPreview}</span></p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-primary px-4! py-2! text-sm!" disabled={otp.length !== 6} onClick={() => void verifyOtp()}>
                    Verify
                  </button>
                  <button type="button" className="btn-ghost px-4! py-2! text-sm!" disabled={phoneWait > 0} onClick={() => void sendOtp()}>
                    {phoneWait > 0 ? `Resend in ${phoneWait}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="btn-subtle px-3! py-2! text-sm!"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setOtpPreview("");
                      setPhoneMsg(null);
                    }}
                  >
                    Change number
                  </button>
                </div>
              </div>
            )}
            {msg(phoneMsg)}
          </div>
        </section>
      </form>

      <form onSubmit={changePassword} className={`${CARD} mt-6`}>
        <h2 className="font-display text-xl">{me.hasPassword ? "Change password" : "Set a password"}</h2>
        {me.google && <p className="mt-1 text-sm text-mist">This account can also sign in with Google.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {me.hasPassword && (
            <label className="auth-label">
              Current password
              <input className="auth-field" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
          )}
          <label className="auth-label">
            New password
            <input className="auth-field" type="password" autoComplete="new-password" minLength={6} required placeholder="At least 6 characters" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-primary mt-4 px-4! py-2! text-sm!">
          Update password
        </button>
      </form>

      <section className="mt-6 rounded-2xl border border-rose/30 p-5 sm:p-6">
        <h2 className="font-display text-xl text-rose">Delete account</h2>
        <p className="mt-1 text-sm text-mist">Removes your profile, listings, reviews and bookings. This cannot be undone.</p>
        <button type="button" className="mt-4 rounded-xl border border-rose/40 px-4 py-2 text-sm text-rose transition-colors hover:bg-rose/10" onClick={() => void destroy()}>
          Delete my account
        </button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brass/25 bg-ink/95 px-5 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          {emailChanged && <span className="text-xs text-amber-500">Email changed. Save to verify it.</span>}
          <button type="submit" form="profile-form" className="btn-primary">
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}
