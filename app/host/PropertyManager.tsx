"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Property, Unit } from "@/lib/portfolio";

type SafeAdmin = { id: string; username: string; propertyIds: string[]; active: boolean; createdAt: number };
type StripeStatus = { configured: boolean; last4: string | null; mode: "test" | "live" | null; source: "admin" | "environment" | null; updatedAt: number | null };

export default function PropertyManager({ role, properties, onPropertiesChanged }: { role: "master" | "property-admin"; properties: Property[]; onPropertiesChanged: () => Promise<void> }) {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [status, setStatus] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, string[]>>({});
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeSaving, setStripeSaving] = useState(false);

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
    setStatus(response.ok ? "Property created. You can now open its guest-guide settings." : data.error || "Could not create property.");
    if (response.ok) { event.currentTarget.reset(); await onPropertiesChanged(); }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/property-admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password"), propertyIds: form.getAll("propertyIds") }) });
    const data = await response.json();
    setStatus(response.ok ? "Property manager created." : data.error || "Could not create manager.");
    if (response.ok) { event.currentTarget.reset(); await loadAdmins(); }
  }

  async function updateAdmin(admin: SafeAdmin, updates: { password?: string; active?: boolean; propertyIds?: string[] }) {
    const response = await fetch("/api/host/property-admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username, propertyIds: updates.propertyIds ?? admin.propertyIds, active: updates.active ?? admin.active, password: updates.password || undefined }) });
    const data = await response.json();
    setStatus(response.ok ? "Manager updated." : data.error || "Could not update manager.");
    if (response.ok) { setResetPasswords((current) => ({ ...current, [admin.username]: "" })); await loadAdmins(); }
  }

  async function resetLoginAttempts(admin: SafeAdmin) {
    const response = await fetch("/api/host/property-admins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username }) });
    const data = await response.json();
    setStatus(response.ok ? `Login attempts reset for ${admin.username}. They can sign in immediately.` : data.error || "Could not reset login attempts.");
  }

  async function changeOwnPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json();
    setStatus(response.ok ? "Your password was changed successfully." : data.error || "Could not change password.");
    if (response.ok) { event.currentTarget.reset(); window.setTimeout(() => window.location.reload(), 900); }
  }

  async function saveStripeKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStripeSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/stripe", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secretKey: form.get("secretKey") }) });
    const data = await response.json();
    setStatus(response.ok ? "Stripe key verified and saved securely." : data.error || "Could not save Stripe settings.");
    if (response.ok) {
      setStripeStatus(data.stripe);
      event.currentTarget.reset();
    }
    setStripeSaving(false);
  }

  const [syncingPropertyId, setSyncingPropertyId] = useState<string | null>(null);
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);

  async function handleSaveIcal(event: FormEvent<HTMLFormElement>, propertyId: string) {
    event.preventDefault();
    setSavingPropertyId(propertyId);
    setStatus("Saving iCal URLs...");
    
    const form = new FormData(event.currentTarget);
    const airbnbIcalUrl = form.get("airbnbIcalUrl")?.toString().trim() || "";
    const bookingIcalUrl = form.get("bookingIcalUrl")?.toString().trim() || "";

    try {
      const response = await fetch("/api/host/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: propertyId, airbnbIcalUrl, bookingIcalUrl })
      });
      const data = await response.json();
      if (response.ok) {
        setStatus("iCal URLs saved successfully.");
        await onPropertiesChanged();
      } else {
        setStatus(data.error || "Failed to save iCal URLs.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setSavingPropertyId(null);
    }
  }

  async function handleSyncNow(propertyId: string) {
    setSyncingPropertyId(propertyId);
    setStatus("Syncing with Airbnb and Booking.com...");

    try {
      const response = await fetch("/api/host/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const { added, updated, removed, errors } = data.results;
        let msg = `Sync complete! Synced: ${added} added, ${updated} updated, ${removed} removed.`;
        if (errors.length > 0) {
          msg += ` Errors: ${errors.join(", ")}`;
        }
        setStatus(msg);
        await onPropertiesChanged();
      } else {
        setStatus(data.error || "Failed to sync iCal calendars.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setSyncingPropertyId(null);
    }
  }

  return <div className="property-admin-page">
    <div className="property-admin-hero"><div><p className="eyebrow">Access & portfolio</p><h2>{role === "master" ? "Properties and managers" : "Your property access"}</h2><p>{role === "master" ? "Create properties, assign managers and control every password from one place." : "You can manage only the properties assigned to your account."}</p></div><strong>{properties.length} {properties.length === 1 ? "property" : "properties"}</strong></div>
    {status ? <p className="property-admin-status" role="status">{status}</p> : null}
    <div className="property-admin-grid">
      {role === "master" ? <>
        <form className="property-admin-card" onSubmit={createProperty}><h3>Add property</h3><label>Property name<input name="name" required placeholder="City Centre Apartment" /></label><label>URL name<input name="slug" placeholder="city-centre-apartment" /></label><label>Address<input name="address" required placeholder="Full street address" /></label><label>Currency<input name="currency" defaultValue="EUR" maxLength={3} /></label><button>Create property</button></form>
        <form className="property-admin-card" onSubmit={createAdmin}><h3>Create property manager</h3><label>Username<input name="username" required autoComplete="off" /></label><label>Temporary password<input name="password" required type="password" minLength={12} autoComplete="new-password" /></label><fieldset className="property-checklist"><legend>Property access</legend><p>Choose every property this manager can open.</p>{properties.map((property) => <label key={property.id}><input type="checkbox" name="propertyIds" value={property.id} defaultChecked={properties.length === 1} /><span><b>{property.name}</b><small>/{property.slug}</small></span></label>)}</fieldset><button>Create manager</button></form>
        <form className="property-admin-card stripe-settings-card" onSubmit={saveStripeKey}><div className="stripe-settings-heading"><h3>Stripe payments</h3><span className={`stripe-mode-badge ${stripeStatus?.mode || "off"}`}>{stripeStatus?.configured ? `${stripeStatus.mode} mode` : "Not configured"}</span></div><p>Guests with an outstanding balance can pay through secure Stripe Checkout. The key remains server-only and is never displayed again.</p>{stripeStatus?.configured ? <div className="stripe-key-status"><span>Connected secret key</span><strong>•••• •••• •••• {stripeStatus.last4}</strong><small>{stripeStatus.source === "admin" ? "Saved from this admin page" : "Configured in the secure deployment environment"}</small></div> : null}<label>Replace secret key<input name="secretKey" required type="password" placeholder="sk_test_…" autoComplete="off" /></label><small>Only the master administrator can replace this credential.</small><button disabled={stripeSaving}>{stripeSaving ? "Verifying with Stripe…" : stripeStatus?.configured ? "Verify & replace key" : "Verify & connect Stripe"}</button></form>
      </> : null}
      <form className="property-admin-card" onSubmit={changeOwnPassword}><h3>Change my password</h3><label>Current password<input name="currentPassword" required type="password" autoComplete="current-password" /></label><label>New password<input name="newPassword" required type="password" minLength={12} autoComplete="new-password" /></label><small>Use at least 12 characters.</small><button>Update my password</button></form>
    </div>
    <section className="property-list-panel">
      <div>
        <h3>Properties</h3>
        <p>Select a property in the dashboard header to edit its guide, timings and bookings.</p>
      </div>
      <div className="property-list-grid">
        {properties.map((property) => (
          <article key={property.id} className="property-card-item">
            <span>{property.active ? "Active" : "Inactive"}</span>
            <h4>{property.name}</h4>
            <p>{property.address}</p>
            <small>/{property.slug} · {property.currency}</small>

            <form className="property-sync-form" onSubmit={(e) => handleSaveIcal(e, property.id)}>
              <h4>iCal Calendar Sync</h4>
              <label>
                Airbnb iCal Feed URL
                <input
                  type="url"
                  name="airbnbIcalUrl"
                  defaultValue={property.airbnbIcalUrl || ""}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                />
              </label>
              <label>
                Booking.com iCal Feed URL
                <input
                  type="url"
                  name="bookingIcalUrl"
                  defaultValue={property.bookingIcalUrl || ""}
                  placeholder="https://ical.booking.com/v1/..."
                />
              </label>
              <div className="sync-buttons">
                <button type="submit" className="save-btn" disabled={savingPropertyId === property.id}>
                  {savingPropertyId === property.id ? "Saving..." : "Save URLs"}
                </button>
                <button
                  type="button"
                  className="sync-btn"
                  onClick={() => handleSyncNow(property.id)}
                  disabled={syncingPropertyId === property.id}
                >
                  {syncingPropertyId === property.id ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </form>

            <div className="property-export-ical">
              <h5>Export iCal Feeds (for Airbnb & Booking.com)</h5>
              <div className="ical-export-list">
                {units
                  .filter((unit) => unit.propertyId === property.id)
                  .map((unit) => {
                    const exportUrl = typeof window !== "undefined"
                      ? `${window.location.protocol}//${window.location.host}/api/ical/${unit.id}`
                      : `/api/ical/${unit.id}`;
                    return (
                      <div key={unit.id} className="ical-export-item">
                        <span>{unit.name}</span>
                        <div className="ical-link-copy">
                          <input type="text" readOnly value={exportUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(exportUrl);
                              setStatus(`Copied iCal link for ${unit.name}!`);
                            }}
                          >
                            Copy Link
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
    {role === "master" ? <section className="property-list-panel"><div><h3>Property managers</h3><p>Assign one or many properties, reset passwords, or disable access immediately.</p></div><div className="manager-list">{admins.length ? admins.map((admin) => {
      const draft = propertyDrafts[admin.username] || admin.propertyIds;
      const changed = [...draft].sort().join(",") !== [...admin.propertyIds].sort().join(",");
      return <article key={admin.id}>
        <div className="manager-identity"><span>{admin.active ? "Active manager" : "Access disabled"}</span><strong>{admin.username}</strong><small>{admin.propertyIds.length} {admin.propertyIds.length === 1 ? "property" : "properties"} assigned</small></div>
        <fieldset className="property-checklist manager-property-checklist"><legend>Can manage</legend>{properties.map((property) => <label key={property.id}><input type="checkbox" checked={draft.includes(property.id)} onChange={(event) => setPropertyDrafts((current) => ({ ...current, [admin.username]: event.target.checked ? [...draft, property.id] : draft.filter((id) => id !== property.id) }))} /><span><b>{property.name}</b><small>/{property.slug}</small></span></label>)}</fieldset>
        <button className="manager-save-access" disabled={!changed || draft.length === 0} onClick={() => updateAdmin(admin, { propertyIds: draft })}>{changed ? "Save property access" : "Access up to date"}</button>
        <div className="manager-security"><input type="password" minLength={12} placeholder="New password" value={resetPasswords[admin.username] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [admin.username]: event.target.value }))} /><button disabled={(resetPasswords[admin.username] || "").length < 12} onClick={() => updateAdmin(admin, { password: resetPasswords[admin.username] })}>Reset password</button><button className="reset-attempts-btn" onClick={() => resetLoginAttempts(admin)}>Reset login attempts</button><button className={admin.active ? "danger-soft" : ""} onClick={() => updateAdmin(admin, { active: !admin.active })}>{admin.active ? "Disable" : "Enable"}</button></div>
      </article>;
    }) : <p>No property managers yet.</p>}</div></section> : null}
  </div>;
}
