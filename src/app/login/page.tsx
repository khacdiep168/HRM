"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldAlert, ShieldCheck, QrCode } from "lucide-react";
import { getSupabaseBrowserAuthClient } from "@/lib/supabase/client";

type MfaStep = "IDLE" | "NEED_MFA_CHALLENGE" | "NEED_MFA_ENROLL" | "VERIFIED";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvgDataUrl, setQrSvgDataUrl] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState<MfaStep>("IDLE");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-supabase-anon-key"
  );

  useEffect(() => {
    const client = getSupabaseBrowserAuthClient();
    if (!client) return;

    client.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data?.currentLevel === "aal2") {
        setMfaStep("VERIFIED");
      } else if (data?.nextLevel === "aal2") {
        client.auth.mfa.listFactors().then(({ data: factors }) => {
          const verified = factors?.totp?.find((f) => f.status === "verified");
          if (verified) {
            setFactorId(verified.id);
            setMfaStep("NEED_MFA_CHALLENGE");
          }
        });
      }
    });
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const client = getSupabaseBrowserAuthClient();
    if (!client) {
      setErrorMsg("Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / ANON_KEY trong .env.local.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setStatusMsg("Đăng nhập thành công!");
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleEnrollTotp() {
    setErrorMsg(null);
    const client = getSupabaseBrowserAuthClient();
    if (!client) return;

    setBusy(true);
    try {
      const { data: existing } = await client.auth.mfa.listFactors();
      const staleUnverified = (existing?.all ?? []).filter(
        (f) => f.factor_type === "totp" && f.status !== "verified"
      );
      for (const stale of staleUnverified) {
        await client.auth.mfa.unenroll({ factorId: stale.id });
      }

      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TKV-HRM-Authenticator",
      });
      if (error || !data) {
        setErrorMsg(error?.message ?? "Không thể khởi tạo MFA TOTP.");
        return;
      }
      setFactorId(data.id);
      setQrSvgDataUrl(data.totp.qr_code);
      setMfaStep("NEED_MFA_ENROLL");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const client = getSupabaseBrowserAuthClient();
    if (!client || !factorId) return;

    setBusy(true);
    try {
      const { data: challenge, error: chErr } = await client.auth.mfa.challenge({
        factorId,
      });
      if (chErr || !challenge) {
        setErrorMsg(chErr?.message ?? "Không thể tạo challenge MFA.");
        return;
      }

      const { error: verErr } = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode.trim(),
      });
      if (verErr) {
        setErrorMsg(verErr.message);
        return;
      }

      setMfaStep("VERIFIED");
      setStatusMsg("Xác thực MFA AAL2 thành công!");
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-amber-600" />
          <h1 className="text-lg font-bold text-slate-900">
            Đăng nhập Thế Kỷ Vàng HRM
          </h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Đăng nhập bằng email công ty và mật khẩu (không bắt buộc MFA TOTP).
        </p>

        {!supabaseReady && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Chưa cấu hình khóa Supabase
            </div>
            <p className="mt-1">
              Sao chép <code className="font-mono">.env.example</code> thành{" "}
              <code className="font-mono">.env.local</code> và điền khóa của project{" "}
              <code className="font-mono">xtswzywqbizunynahmvl</code> để đăng nhập.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            {statusMsg}
          </div>
        )}

        {(mfaStep === "IDLE" || mfaStep === "VERIFIED") && (
          <form onSubmit={handlePasswordLogin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Email công ty
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten.nv@thekyvang.vn"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Mật khẩu</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !supabaseReady}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Đang xác thực..." : "Đăng nhập"}
            </button>
          </form>
        )}

        {(mfaStep === "NEED_MFA_CHALLENGE" || mfaStep === "NEED_MFA_ENROLL") && (
          <form onSubmit={handleVerifyTotp} className="mt-5 space-y-4">
            {qrSvgDataUrl && (
              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <QrCode className="h-4 w-4" />
                  Quét mã QR bằng Google / Microsoft Authenticator
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSvgDataUrl}
                  alt="MFA QR Code"
                  className="mt-3 h-40 w-40 rounded border bg-white p-1"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Mã xác thực 6 chữ số (TOTP)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "Đang kiểm tra OTP..." : "Xác nhận MFA (AAL2)"}
            </button>
          </form>
        )}

        {supabaseReady && mfaStep === "IDLE" && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleEnrollTotp}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline"
            >
              <ShieldCheck className="h-4 w-4" />
              Đã đăng nhập AAL1? Thiết lập MFA TOTP mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

