"use client";

import { FormEvent, useState } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "");
  const [privateLink, setPrivateLink] = useState("");
  const [notice, setNotice] = useState<{ title: string; copy: string } | null>(null);

  function updatePrivateLink(value: string) {
    setPrivateLink(value);
    try {
      const pasted = value.trim();
      const parsedToken = /^[a-f0-9]{64}$/.test(pasted)
        ? pasted
        : new URL(pasted, window.location.origin).searchParams.get("token") || "";
      setToken(/^[a-f0-9]{64}$/.test(parsedToken) ? parsedToken : "");
    } catch {
      setToken("");
    }
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice(null);
    const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, token }) });
    const result = await response.json();
    if (result.state === "upcoming") {
      const available = new Intl.DateTimeFormat("en", { timeZone: "Europe/Skopje", dateStyle: "long", timeStyle: "short" }).format(new Date(result.availableAt));
      setNotice({ title: `We look forward to welcoming you, ${result.guest}.`, copy: `Your apartment guide will be available from ${available}.` }); setLoading(false); return;
    }
    if (result.state === "expired") {
      setNotice({ title: `Thank you for staying with us, ${result.guest}.`, copy: "Your stay has ended and this guest access code is no longer active." }); setLoading(false); return;
    }
    if (!response.ok) {
      setError(result.error ?? "We couldn't verify this code.");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="gate-page">
      <div className="gate-image" />
      <section className="gate-panel">
        <a className="brand gate-brand" href="/access"><span className="brand-mark">K</span><span>KONIOS HOUSE</span></a>
        <div className="gate-content">
          <p className="eyebrow">Private guest access</p>
          <h1>Welcome to<br />your stay.</h1>
          {notice ? <div className="access-notice"><h2>{notice.title}</h2><p>{notice.copy}</p><button onClick={() => { setNotice(null); setCode(""); }}>Try another code</button></div> : <>
            <p>{token ? "Enter the five-digit PIN sent with your private reservation link." : "Paste the private reservation link sent by your host, then enter your five-digit PIN."}</p>
            <form onSubmit={unlock}>
              {!token && <label className="private-link-label">Private reservation link<input className="private-link-input" required value={privateLink} onChange={(event) => updatePrivateLink(event.target.value)} placeholder="Paste your private link here" autoComplete="url" /></label>}
              <label>Guest PIN<input required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Five-digit PIN" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="one-time-code" /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button" disabled={loading || code.length !== 5}>{loading ? "Checking…" : "Enter apartment guide"}<span>→</span></button>
            </form>
          </>}
        </div>
        <p className="gate-note">Need help? Contact your host directly.</p>
      </section>
    </main>
  );
}
