"use client";

import { FormEvent, useState } from "react";

type Generated = { code: string; guest: string; checkIn: string; checkOut: string };

export default function HostPage() {
  const [result, setResult] = useState<Generated | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Unable to generate a code.");
    setResult(data);
    setCopied(false);
  }

  async function copyCode() {
    if (!result) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
  }

  return (
    <main className="host-page">
      <header><a className="brand" href="/"><span className="brand-mark">K</span><span>KONIOS HOUSE</span></a><span>HOST DESK</span></header>
      <section>
        <div className="host-intro"><p className="eyebrow">Guest access</p><h1>Create a<br />stay code.</h1><p>Generate a private code that remains active through the guest&apos;s check-out date.</p></div>
        <div className="host-card">
          {!result ? (
            <form onSubmit={generate}>
              <label>Host password<input name="password" required type="password" autoComplete="current-password" /></label>
              <div className="host-name-row"><label>First name<input name="firstName" required /></label><label>Surname<input name="lastName" required /></label></div>
              <div className="host-name-row"><label>Check in<input name="checkIn" required type="date" /></label><label>Check out<input name="checkOut" required type="date" /></label></div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button">Generate guest code<span>↗</span></button>
            </form>
          ) : (
            <div className="generated-code">
              <span className="success-tick">✓</span><p className="eyebrow">Code ready</p><h2>{result.guest}</h2><p>{result.checkIn} — {result.checkOut}</p>
              <textarea readOnly value={result.code} rows={5} aria-label="Generated guest code" />
              <button className="submit-button" onClick={copyCode}>{copied ? "Copied" : "Copy guest code"}<span>{copied ? "✓" : "⧉"}</span></button>
              <button className="text-reset" onClick={() => setResult(null)}>Create another code</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
