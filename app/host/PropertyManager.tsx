"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Property, Unit, TelegramSummaryConfig } from "@/lib/portfolio";
import { defaultSummaryConfig } from "@/lib/portfolio";

type SafeAdmin = { id: string; username: string; propertyIds: string[]; active: boolean; createdAt: number };
type StripeStatus = { configured: boolean; last4: string | null; mode: "test" | "live" | null; source: "admin" | "environment" | null; updatedAt: number | null };
type Section = "properties" | "team" | "settings";

export default function PropertyManager({ role, properties, onPropertiesChanged }: { role: "master" | "property-admin"; properties: Property[]; onPropertiesChanged: () => Promise<void> }) {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [status, setStatus] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, string[]>>({});
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("properties");
  const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({});
  const [telegramTestingId, setTelegramTestingId] = useState<string | null>(null);
  const [syncingPropertyId, setSyncingPropertyId] = useState<string | null>(null);
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [summaryConfigs, setSummaryConfigs] = useState<Record<string, TelegramSummaryConfig>>({});

  // Initialize summary configs from properties
  useEffect(() => {
    const configs: Record<string, TelegramSummaryConfig> = {};
    for (const p of properties) {
      configs[p.id] = { ...defaultSummaryConfig, ...p.telegramSummaryConfig };
    }
    setSummaryConfigs(configs);
  }, [properties]);

  // Auto-clear status toast
  useEffect(() => {
    if (status) { const t = setTimeout(() => setStatus(""), 5000); return () => clearTimeout(t); }
  }, [status]);

  function toggleAccordion(propertyId: string, section: string) {
    setExpandedSections((prev) => {
      const next = { ...prev };
      const current = new Set(prev[propertyId] || []);
      if (current.has(section)) current.delete(section); else current.add(section);
      next[propertyId] = current;
      return next;
    });
  }

  function isAccordionOpen(propertyId: string, section: string) {
    return expandedSections[propertyId]?.has(section) || false;
  }

  function applyAdmins(nextAdmins: SafeAdmin[]) {
    setAdmins(nextAdmins);
    setPropertyDrafts(Object.fromEntries(nextAdmins.map((admin) => [admin.username, admin.propertyIds])));
  }

  async function loadAdmins() {
    if (role !== "master") return;
    const response = await fetch("/api/host/property-admins", { cache: "no-store" });
    if (response.ok) applyAdmins((await response.json()).admins || []);
  }

  useEffect(() => {
    if (role !== "master") return;
    let live = true;
    fetch("/api/host/property-admins", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (live && data?.admins) applyAdmins(data.admins); })
      .catch(() => {});
    return () => { live = false; };
  }, [role]);

  useEffect(() => {
    let live = true;
    fetch("/api/host/properties", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (live && data?.units) setUnits(data.units); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (role !== "master") return;
    fetch("/api/host/stripe", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.stripe) setStripeStatus(data.stripe); })
      .catch(() => {});
  }, [role]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json();
    setStatus(response.ok ? "✅ Property created successfully." : data.error || "Could not create property.");
    if (response.ok) { event.currentTarget.reset(); await onPropertiesChanged(); }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/property-admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password"), propertyIds: form.getAll("propertyIds") }) });
    const data = await response.json();
    setStatus(response.ok ? "✅ Property manager created." : data.error || "Could not create manager.");
    if (response.ok) { event.currentTarget.reset(); await loadAdmins(); }
  }

  async function updateAdmin(admin: SafeAdmin, updates: { password?: string; active?: boolean; propertyIds?: string[] }) {
    const response = await fetch("/api/host/property-admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username, propertyIds: updates.propertyIds ?? admin.propertyIds, active: updates.active ?? admin.active, password: updates.password || undefined }) });
    const data = await response.json();
    setStatus(response.ok ? "✅ Manager updated." : data.error || "Could not update manager.");
    if (response.ok) { setResetPasswords((current) => ({ ...current, [admin.username]: "" })); await loadAdmins(); }
  }

  async function resetLoginAttempts(admin: SafeAdmin) {
    const response = await fetch("/api/host/property-admins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username }) });
    const data = await response.json();
    setStatus(response.ok ? `✅ Login attempts reset for ${admin.username}.` : data.error || "Could not reset login attempts.");
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json();
    setStatus(response.ok ? "✅ Your password was changed successfully." : data.error || "Could not change password.");
    if (response.ok) { event.currentTarget.reset(); window.setTimeout(() => window.location.reload(), 900); }
  }

  async function saveStripeKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStripeSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/stripe", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secretKey: form.get("secretKey") }) });
    const data = await response.json();
    setStatus(response.ok ? "✅ Stripe key verified and saved securely." : data.error || "Could not save Stripe settings.");
    if (response.ok) { setStripeStatus(data.stripe); event.currentTarget.reset(); }
    setStripeSaving(false);
  }

  async function handleSavePropertySettings(event: FormEvent<HTMLFormElement>, propertyId: string) {
    event.preventDefault();
    setSavingPropertyId(propertyId);
    setStatus("Saving...");
    const form = new FormData(event.currentTarget);
    const airbnbIcalUrl = form.get("airbnbIcalUrl")?.toString().trim() || "";
    const bookingIcalUrl = form.get("bookingIcalUrl")?.toString().trim() || "";
    const telegramBotToken = form.get("telegramBotToken")?.toString().trim() || "";
    const telegramChatId = form.get("telegramChatId")?.toString().trim() || "";
    const telegramEnabled = form.get("telegramEnabled") === "on";
    const telegramSummaryConfig = summaryConfigs[propertyId] || defaultSummaryConfig;
    try {
      const response = await fetch("/api/host/properties", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: propertyId, airbnbIcalUrl, bookingIcalUrl, telegramBotToken, telegramChatId, telegramEnabled, telegramSummaryConfig }) });
      const data = await response.json();
      setStatus(response.ok ? "✅ Settings saved." : data.error || "Failed to save settings.");
      if (response.ok) await onPropertiesChanged();
    } catch (err: any) { setStatus(`Error: ${err.message}`); }
    finally { setSavingPropertyId(null); }
  }

  async function handleTestTelegram(property: Property) {
    setTelegramTestingId(property.id);
    setStatus(`Sending test message for ${property.name}...`);
    try {
      const response = await fetch("/api/host/telegram/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: property.telegramBotToken, chatId: property.telegramChatId, propertyName: property.name }) });
      const data = await response.json();
      setStatus(response.ok && data.success ? `✅ Test sent for ${property.name}! Check Telegram.` : data.error || "Could not send test message.");
    } catch (err: any) { setStatus(`Error: ${err.message}`); }
    finally { setTelegramTestingId(null); }
  }

  async function handleSyncNow(propertyId: string) {
    setSyncingPropertyId(propertyId);
    setStatus("Syncing calendars...");
    try {
      const response = await fetch("/api/host/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId }) });
      const data = await response.json();
      if (response.ok && data.success) {
        const { added, updated, removed, errors } = data.results;
        let msg = `✅ Sync complete: ${added} added, ${updated} updated, ${removed} removed.`;
        if (errors.length > 0) msg += ` Errors: ${errors.join(", ")}`;
        setStatus(msg);
        await onPropertiesChanged();
      } else { setStatus(data.error || "Failed to sync iCal calendars."); }
    } catch (err: any) { setStatus(`Error: ${err.message}`); }
    finally { setSyncingPropertyId(null); }
  }

  async function handleSendReport(propertyId: string) {
    setSendingReportId(propertyId);
    setStatus("📨 Sending today's report...");
    try {
      const response = await fetch(`/api/host/morning-summary?propertyId=${propertyId}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.results?.length > 0) {
        setStatus(`✅ Report sent for ${data.results.map((r: any) => r.propertyName).join(", ")}!`);
      } else if (response.ok && data.results?.length === 0) {
        setStatus("No report sent — Telegram is not configured/enabled, or there are no arrivals or departures today.");
      } else {
        setStatus(data.error || "Failed to send report.");
      }
    } catch (err: any) { setStatus(`Error: ${err.message}`); }
    finally { setSendingReportId(null); }
  }

  function updateSummaryConfig(propertyId: string, key: keyof TelegramSummaryConfig, value: any) {
    setSummaryConfigs((prev) => ({
      ...prev,
      [propertyId]: { ...(prev[propertyId] || defaultSummaryConfig), [key]: value }
    }));
  }

  const tabs: { key: Section; label: string; icon: string; masterOnly?: boolean }[] = [
    { key: "properties", label: "Properties", icon: "🏢" },
    { key: "team", label: "Team", icon: "👥", masterOnly: true },
    { key: "settings", label: "Settings", icon: "⚙️", masterOnly: true },
  ];

  return (
    <div className="pm-page">
      {/* Status Toast */}
      {status && (
        <div className={`pm-toast ${status.startsWith("✅") ? "pm-toast--success" : status.startsWith("Error") ? "pm-toast--error" : ""}`}>
          <span>{status}</span>
          <button onClick={() => setStatus("")} className="pm-toast-close">✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="pm-tabs">
        {tabs
          .filter((tab) => !tab.masterOnly || role === "master")
          .map((tab) => (
            <button
              key={tab.key}
              className={`pm-tab ${activeSection === tab.key ? "pm-tab--active" : ""}`}
              onClick={() => setActiveSection(tab.key)}
            >
              <span className="pm-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        <div className="pm-tab-counter">{properties.length} {properties.length === 1 ? "property" : "properties"}</div>
      </nav>

      {/* ═══ PROPERTIES SECTION ═══ */}
      {activeSection === "properties" && (
        <div className="pm-properties">
          {properties.map((property) => (
            <article key={property.id} className="pm-property-card">
              <div className="pm-property-header">
                <div className="pm-property-info">
                  <div className="pm-property-title-row">
                    <h3>{property.name}</h3>
                    <span className={`pm-badge ${property.active ? "pm-badge--active" : "pm-badge--inactive"}`}>
                      {property.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="pm-property-address">{property.address}</p>
                  <div className="pm-property-meta">
                    <span>/{property.slug}</span>
                    <span className="pm-meta-dot">·</span>
                    <span>{property.currency}</span>
                    {property.telegramEnabled && (
                      <>
                        <span className="pm-meta-dot">·</span>
                        <span className="pm-feature-pill">🔔 Telegram</span>
                      </>
                    )}
                    {(property.airbnbIcalUrl || property.bookingIcalUrl) && (
                      <>
                        <span className="pm-meta-dot">·</span>
                        <span className="pm-feature-pill">📅 iCal Synced</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <form className="pm-property-form" onSubmit={(e) => handleSavePropertySettings(e, property.id)}>
                {/* Calendar Sync Accordion */}
                <div className="pm-accordion">
                  <button type="button" className="pm-accordion-trigger" onClick={() => toggleAccordion(property.id, "calendar")}>
                    <span>📅 Calendar Sync</span>
                    <span className={`pm-accordion-arrow ${isAccordionOpen(property.id, "calendar") ? "pm-accordion-arrow--open" : ""}`}>›</span>
                  </button>
                  {isAccordionOpen(property.id, "calendar") && (
                    <div className="pm-accordion-content">
                      <div className="pm-form-group">
                        <label className="pm-label">Airbnb iCal Feed URL</label>
                        <input className="pm-input" type="url" name="airbnbIcalUrl" defaultValue={property.airbnbIcalUrl || ""} placeholder="https://www.airbnb.com/calendar/ical/..." />
                      </div>
                      <div className="pm-form-group">
                        <label className="pm-label">Booking.com iCal Feed URL</label>
                        <input className="pm-input" type="url" name="bookingIcalUrl" defaultValue={property.bookingIcalUrl || ""} placeholder="https://ical.booking.com/v1/..." />
                      </div>
                      <button
                        type="button"
                        className="pm-btn pm-btn--secondary"
                        onClick={() => handleSyncNow(property.id)}
                        disabled={syncingPropertyId === property.id}
                      >
                        {syncingPropertyId === property.id ? "⏳ Syncing..." : "🔄 Sync Now"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Telegram Alerts Accordion */}
                <div className="pm-accordion">
                  <button type="button" className="pm-accordion-trigger" onClick={() => toggleAccordion(property.id, "telegram")}>
                    <span>🔔 Telegram Alerts</span>
                    <span className={`pm-accordion-arrow ${isAccordionOpen(property.id, "telegram") ? "pm-accordion-arrow--open" : ""}`}>›</span>
                  </button>
                  {isAccordionOpen(property.id, "telegram") && (
                    <div className="pm-accordion-content">
                      <p className="pm-hint">Get daily check-in &amp; checkout summaries on Telegram for this property.</p>

                      {/* Connection */}
                      <div className="pm-section-label">Connection</div>
                      <div className="pm-form-group">
                        <label className="pm-label">Bot Token</label>
                        <input className="pm-input" type="password" name="telegramBotToken" defaultValue={property.telegramBotToken || ""} placeholder="123456:ABC-DEF..." />
                      </div>
                      <div className="pm-form-group">
                        <label className="pm-label">Chat ID</label>
                        <input className="pm-input" type="text" name="telegramChatId" defaultValue={property.telegramChatId || ""} placeholder="987654321" />
                      </div>
                      <label className="pm-checkbox">
                        <input type="checkbox" name="telegramEnabled" defaultChecked={Boolean(property.telegramEnabled)} />
                        <span>Enable daily summaries</span>
                      </label>

                      {/* Greeting */}
                      <div className="pm-section-label">Greeting</div>
                      <div className="pm-form-group">
                        <label className="pm-label">Custom greeting</label>
                        <input
                          className="pm-input"
                          type="text"
                          value={summaryConfigs[property.id]?.greeting ?? "Hey Dejan"}
                          onChange={(e) => updateSummaryConfig(property.id, "greeting", e.target.value)}
                          placeholder="Hey Dejan"
                        />
                      </div>

                      {/* Summary Content */}
                      <div className="pm-section-label">Summary Content</div>
                      <div className="pm-toggle-grid">
                        {([
                          ["showArrivals", "Show arrivals"],
                          ["showDepartures", "Show departures"],
                          ["showGuestName", "Guest name"],
                          ["showPhone", "Phone number"],
                          ["showSource", "Booking source"],
                          ["showPrice", "Total price"],
                          ["showNights", "Number of nights"],
                          ["showArrivalTime", "Arrival time"],
                          ["showCheckoutTime", "Checkout time"],
                          ["showGapNights", "Summary stats"],
                          ["showQuietDayNote", "Quiet day note"],
                        ] as [keyof TelegramSummaryConfig, string][]).map(([key, label]) => (
                          <label key={key} className="pm-checkbox">
                            <input
                              type="checkbox"
                              checked={summaryConfigs[property.id]?.[key] !== false}
                              onChange={(e) => updateSummaryConfig(property.id, key, e.target.checked)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>

                      {/* Schedule */}
                      <div className="pm-section-label">Schedule</div>
                      <div className="pm-form-group">
                        <label className="pm-label">Timezone</label>
                        <select
                          className="pm-input"
                          value={summaryConfigs[property.id]?.timezone || "Europe/Skopje"}
                          onChange={(e) => updateSummaryConfig(property.id, "timezone", e.target.value)}
                        >
                          {[
                            "Europe/Skopje", "Europe/Berlin", "Europe/London", "Europe/Paris",
                            "Europe/Rome", "Europe/Madrid", "Europe/Athens", "Europe/Istanbul",
                            "Europe/Amsterdam", "Europe/Vienna", "Europe/Zurich", "Europe/Belgrade",
                            "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
                            "Asia/Tokyo", "Asia/Dubai", "Australia/Sydney", "UTC"
                          ].map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <div className="pm-form-group">
                        <label className="pm-label">Send times (up to 3)</label>
                        <div className="pm-time-slots">
                          {(summaryConfigs[property.id]?.scheduleTimes || ["08:00"]).map((time, idx) => (
                            <div key={idx} className="pm-time-slot">
                              <input
                                className="pm-input pm-input--sm"
                                type="time"
                                value={time}
                                onChange={(e) => {
                                  const times = [...(summaryConfigs[property.id]?.scheduleTimes || ["08:00"])];
                                  times[idx] = e.target.value;
                                  updateSummaryConfig(property.id, "scheduleTimes", times);
                                }}
                              />
                              {(summaryConfigs[property.id]?.scheduleTimes || ["08:00"]).length > 1 && (
                                <button
                                  type="button"
                                  className="pm-btn pm-btn--danger pm-btn--sm"
                                  onClick={() => {
                                    const times = [...(summaryConfigs[property.id]?.scheduleTimes || ["08:00"])];
                                    times.splice(idx, 1);
                                    updateSummaryConfig(property.id, "scheduleTimes", times);
                                  }}
                                >✕</button>
                              )}
                            </div>
                          ))}
                          {(summaryConfigs[property.id]?.scheduleTimes || ["08:00"]).length < 3 && (
                            <button
                              type="button"
                              className="pm-btn pm-btn--secondary pm-btn--sm"
                              onClick={() => {
                                const times = [...(summaryConfigs[property.id]?.scheduleTimes || ["08:00"]), "14:00"];
                                updateSummaryConfig(property.id, "scheduleTimes", times);
                              }}
                            >+ Add Time</button>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pm-btn-row">
                        <button
                          type="button"
                          className="pm-btn pm-btn--secondary"
                          onClick={() => handleTestTelegram(property)}
                          disabled={telegramTestingId === property.id}
                        >
                          {telegramTestingId === property.id ? "⏳ Sending..." : "🔔 Send Test"}
                        </button>
                        <button
                          type="button"
                          className="pm-btn pm-btn--secondary"
                          onClick={() => handleSendReport(property.id)}
                          disabled={sendingReportId === property.id}
                        >
                          {sendingReportId === property.id ? "⏳ Sending..." : "📨 Send Report Now"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Export Feed Accordion */}
                <div className="pm-accordion">
                  <button type="button" className="pm-accordion-trigger" onClick={() => toggleAccordion(property.id, "export")}>
                    <span>📤 Export Feed</span>
                    <span className={`pm-accordion-arrow ${isAccordionOpen(property.id, "export") ? "pm-accordion-arrow--open" : ""}`}>›</span>
                  </button>
                  {isAccordionOpen(property.id, "export") && (
                    <div className="pm-accordion-content">
                      <p className="pm-hint">Add this URL to Airbnb or Booking.com to export your system calendar.</p>
                      {(() => {
                        const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
                        if (propertyUnits.length > 0) return propertyUnits;
                        const defaultId = property.id === "konios-house" ? "konios-house-32" : `${property.id}-unit`;
                        return [{ id: defaultId, propertyId: property.id, name: property.name, guideKey: property.id, active: true }];
                      })().map((unit) => {
                        const exportUrl = typeof window !== "undefined"
                          ? `${window.location.protocol}//${window.location.host}/api/ical/${unit.id}`
                          : `/api/ical/${unit.id}`;
                        return (
                          <div key={unit.id} className="pm-export-row">
                            <input className="pm-input pm-input--mono" type="text" readOnly value={exportUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
                            <button
                              type="button"
                              className="pm-btn pm-btn--secondary"
                              onClick={() => { navigator.clipboard.writeText(exportUrl); setStatus(`✅ Copied iCal link for ${unit.name}!`); }}
                            >
                              📋 Copy
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button type="submit" className="pm-btn pm-btn--primary pm-btn--full" disabled={savingPropertyId === property.id}>
                  {savingPropertyId === property.id ? "Saving..." : "💾 Save All Settings"}
                </button>
              </form>
            </article>
          ))}
        </div>
      )}

      {/* ═══ TEAM SECTION ═══ */}
      {activeSection === "team" && role === "master" && (
        <div className="pm-team">
          <div className="pm-team-forms">
            <form className="pm-card" onSubmit={createProperty}>
              <h3>🏢 Add Property</h3>
              <div className="pm-form-group"><label className="pm-label">Property name</label><input className="pm-input" name="name" required placeholder="City Centre Apartment" /></div>
              <div className="pm-form-group"><label className="pm-label">URL slug</label><input className="pm-input" name="slug" placeholder="city-centre-apartment" /></div>
              <div className="pm-form-group"><label className="pm-label">Address</label><input className="pm-input" name="address" required placeholder="Full street address" /></div>
              <div className="pm-form-group"><label className="pm-label">Currency</label><input className="pm-input" name="currency" defaultValue="EUR" maxLength={3} /></div>
              <button className="pm-btn pm-btn--primary pm-btn--full">Create Property</button>
            </form>

            <form className="pm-card" onSubmit={createAdmin}>
              <h3>👤 Create Manager</h3>
              <div className="pm-form-group"><label className="pm-label">Username</label><input className="pm-input" name="username" required autoComplete="off" /></div>
              <div className="pm-form-group"><label className="pm-label">Temporary password</label><input className="pm-input" name="password" required type="password" minLength={12} autoComplete="new-password" /></div>
              <fieldset className="pm-checklist">
                <legend>Property Access</legend>
                <p className="pm-hint">Choose which properties this manager can access.</p>
                {properties.map((property) => (
                  <label key={property.id} className="pm-checkbox">
                    <input type="checkbox" name="propertyIds" value={property.id} defaultChecked={properties.length === 1} />
                    <span><strong>{property.name}</strong> <small>/{property.slug}</small></span>
                  </label>
                ))}
              </fieldset>
              <button className="pm-btn pm-btn--primary pm-btn--full">Create Manager</button>
            </form>
          </div>

          {/* Existing Managers */}
          <div className="pm-card">
            <h3>👥 Property Managers</h3>
            <p className="pm-hint">Assign properties, reset passwords, or disable access.</p>
            {admins.length ? (
              <div className="pm-manager-list">
                {admins.map((admin) => {
                  const draft = propertyDrafts[admin.username] || admin.propertyIds;
                  const changed = [...draft].sort().join(",") !== [...admin.propertyIds].sort().join(",");
                  return (
                    <article key={admin.id} className="pm-manager-row">
                      <div className="pm-manager-identity">
                        <div className="pm-manager-name-row">
                          <strong>{admin.username}</strong>
                          <span className={`pm-badge pm-badge--sm ${admin.active ? "pm-badge--active" : "pm-badge--inactive"}`}>
                            {admin.active ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <small>{admin.propertyIds.length} {admin.propertyIds.length === 1 ? "property" : "properties"} assigned</small>
                      </div>
                      <fieldset className="pm-checklist pm-checklist--inline">
                        <legend>Can manage</legend>
                        {properties.map((property) => (
                          <label key={property.id} className="pm-checkbox">
                            <input type="checkbox" checked={draft.includes(property.id)} onChange={(event) => setPropertyDrafts((current) => ({ ...current, [admin.username]: event.target.checked ? [...draft, property.id] : draft.filter((id) => id !== property.id) }))} />
                            <span>{property.name}</span>
                          </label>
                        ))}
                      </fieldset>
                      <div className="pm-manager-actions">
                        <button className="pm-btn pm-btn--primary pm-btn--sm" disabled={!changed || draft.length === 0} onClick={() => updateAdmin(admin, { propertyIds: draft })}>{changed ? "Save Access" : "Up to date"}</button>
                        <div className="pm-manager-security">
                          <input className="pm-input pm-input--sm" type="password" minLength={12} placeholder="New password" value={resetPasswords[admin.username] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [admin.username]: event.target.value }))} />
                          <button className="pm-btn pm-btn--secondary pm-btn--sm" disabled={(resetPasswords[admin.username] || "").length < 12} onClick={() => updateAdmin(admin, { password: resetPasswords[admin.username] })}>Reset pwd</button>
                          <button className="pm-btn pm-btn--secondary pm-btn--sm" onClick={() => resetLoginAttempts(admin)}>Reset attempts</button>
                          <button className={`pm-btn pm-btn--sm ${admin.active ? "pm-btn--danger" : "pm-btn--secondary"}`} onClick={() => updateAdmin(admin, { active: !admin.active })}>{admin.active ? "Disable" : "Enable"}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="pm-empty">No property managers yet.</p>}
          </div>
        </div>
      )}

      {/* ═══ SETTINGS SECTION ═══ */}
      {activeSection === "settings" && role === "master" && (
        <div className="pm-settings">
          <form className="pm-card" onSubmit={saveStripeKey}>
            <div className="pm-card-header">
              <h3>💳 Stripe Payments</h3>
              <span className={`pm-badge pm-badge--sm ${stripeStatus?.configured ? (stripeStatus.mode === "live" ? "pm-badge--active" : "pm-badge--test") : "pm-badge--inactive"}`}>
                {stripeStatus?.configured ? `${stripeStatus.mode} mode` : "Not configured"}
              </span>
            </div>
            <p className="pm-hint">Guests with an outstanding balance can pay through secure Stripe Checkout.</p>
            {stripeStatus?.configured && (
              <div className="pm-stripe-status">
                <span>Connected key</span>
                <strong>•••• •••• •••• {stripeStatus.last4}</strong>
                <small>{stripeStatus.source === "admin" ? "Saved from admin page" : "Configured via environment"}</small>
              </div>
            )}
            <div className="pm-form-group"><label className="pm-label">Secret key</label><input className="pm-input" name="secretKey" required type="password" placeholder="sk_test_…" autoComplete="off" /></div>
            <small className="pm-hint">The key is stored server-side and never displayed again.</small>
            <button className="pm-btn pm-btn--primary pm-btn--full" disabled={stripeSaving}>{stripeSaving ? "Verifying..." : stripeStatus?.configured ? "Verify & Replace Key" : "Verify & Connect Stripe"}</button>
          </form>

          <form className="pm-card" onSubmit={changeOwnPassword}>
            <h3>🔒 Change My Password</h3>
            <div className="pm-form-group"><label className="pm-label">Current password</label><input className="pm-input" name="currentPassword" required type="password" autoComplete="current-password" /></div>
            <div className="pm-form-group"><label className="pm-label">New password</label><input className="pm-input" name="newPassword" required type="password" minLength={12} autoComplete="new-password" /></div>
            <small className="pm-hint">Use at least 12 characters.</small>
            <button className="pm-btn pm-btn--primary pm-btn--full">Update My Password</button>
          </form>
        </div>
      )}
    </div>
  );
}
