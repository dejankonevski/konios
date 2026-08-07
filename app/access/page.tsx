"use client";

import { FormEvent, useState } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = await response.json();
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
          <p>Enter the private code sent by your host to open the apartment guide.</p>
          <form onSubmit={unlock}>
            <label>Guest access code<textarea required value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste your code here" rows={4} autoComplete="one-time-code" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" disabled={loading}>{loading ? "Checking…" : "Enter apartment guide"}<span>→</span></button>
          </form>
        </div>
        <p className="gate-note">Need help? Contact your host directly.</p>
      </section>
    </main>
  );
}
