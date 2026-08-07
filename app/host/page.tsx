"use client";

import { FormEvent, PointerEvent, useMemo, useRef, useState } from "react";

type Generated = { code: string; guest: string; checkIn: string; checkOut: string };

const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => new Date(year, monthIndex, index + 1))];
}

function formatShort(value?: string) {
  if (!value) return "Select date";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export default function HostPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [start, setStart] = useState<string>();
  const [end, setEnd] = useState<string>();
  const [selecting, setSelecting] = useState(false);
  const [result, setResult] = useState<Generated | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const anchor = useRef<string | undefined>(undefined);
  const dragged = useRef(false);

  const months = useMemo(() => {
    const current = new Date();
    return [0, 1].map((delta) => new Date(current.getFullYear(), current.getMonth() + monthOffset + delta, 1));
  }, [monthOffset]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/host/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    setUnlocked(true);
    setPassword("");
  }

  function beginRange(value: string, event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = false;
    setSelecting(true);
    if (start && !end) anchor.current = start;
    else { anchor.current = value; setStart(value); setEnd(undefined); }
  }

  function moveRange(event: PointerEvent<HTMLButtonElement>) {
    if (!selecting || !anchor.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-date]");
    const value = target?.dataset.date;
    if (!value || value === anchor.current) return;
    dragged.current = true;
    const [first, last] = [anchor.current, value].sort();
    setStart(first); setEnd(last);
  }

  function finishRange(value: string) {
    if (!anchor.current) return;
    if (!dragged.current && start && !end) {
      const [first, last] = [start, value].sort();
      setStart(first); setEnd(last);
    }
    setSelecting(false);
    anchor.current = undefined;
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start || !end) return setError("Select the complete stay period on the calendar.");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form), checkIn: start, checkOut: end }) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) setUnlocked(false);
      return setError(data.error ?? "Unable to generate a code.");
    }
    setResult(data); setCopied(false);
  }

  async function copyCode() {
    if (!result) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
  }

  if (!unlocked) return (
    <main className="host-lock">
      <a className="brand" href="/"><span className="brand-mark">K</span><span>KONIOS HOUSE</span></a>
      <form onSubmit={login}>
        <p className="eyebrow">Private host desk</p><h1>Host access.</h1><p>Enter the host password to manage guest stay codes.</p>
        <label>Password<input autoFocus required type="password" inputMode="numeric" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button">Continue<span>→</span></button>
      </form>
    </main>
  );

  return (
    <main className="host-page">
      <header><a className="brand" href="/"><span className="brand-mark">K</span><span>KONIOS HOUSE</span></a><span>HOST DESK</span></header>
      <section>
        <div className="host-intro"><p className="eyebrow">Guest access</p><h1>Create a<br />stay code.</h1><p>Add the guest, then drag across their stay dates. On a phone, tap the arrival and departure dates.</p></div>
        <div className="host-card host-card-wide">
          {!result ? (
            <form onSubmit={generate}>
              <div className="host-name-row"><label>First name<input name="firstName" required /></label><label>Surname<input name="lastName" required /></label></div>
              <div className="range-summary"><div><span>Check in</span><strong>{formatShort(start)}</strong></div><div><span>Check out</span><strong>{formatShort(end)}</strong></div></div>
              <div className="calendar-shell" onPointerLeave={() => selecting && setSelecting(false)}>
                <button type="button" className="month-arrow prev-month" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Previous month">←</button>
                <button type="button" className="month-arrow next-month" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="Next month">→</button>
                {months.map((month) => <div className="calendar-month" key={dateKey(month)}>
                  <h3>{monthNames[month.getMonth()]} {month.getFullYear()}</h3>
                  <div className="weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="calendar-grid">{monthDays(month).map((date, index) => date ? (() => {
                    const value = dateKey(date); const selected = start === value || end === value; const inRange = !!start && !!end && value > start && value < end;
                    return <button type="button" data-date={value} key={value} className={`${selected ? "selected " : ""}${inRange ? "in-range" : ""}`} onPointerDown={(event) => beginRange(value, event)} onPointerMove={moveRange} onPointerUp={() => finishRange(value)}>{date.getDate()}</button>;
                  })() : <span key={`blank-${index}`} />)}</div>
                </div>)}
              </div>
              <p className="calendar-help">Drag from arrival to departure · Tap twice on mobile</p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="submit-button">Generate guest code<span>↗</span></button>
            </form>
          ) : (
            <div className="generated-code"><span className="success-tick">✓</span><p className="eyebrow">Code ready</p><h2>{result.guest}</h2><p>{result.checkIn} — {result.checkOut}</p><textarea readOnly value={result.code} rows={5} aria-label="Generated guest code" /><button className="submit-button" onClick={copyCode}>{copied ? "Copied" : "Copy guest code"}<span>{copied ? "✓" : "⧉"}</span></button><button className="text-reset" onClick={() => { setResult(null); setStart(undefined); setEnd(undefined); }}>Create another code</button></div>
          )}
        </div>
      </section>
    </main>
  );
}
