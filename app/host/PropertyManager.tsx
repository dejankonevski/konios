"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Property } from "@/lib/portfolio";

type SafeAdmin = { id: string; username: string; propertyIds: string[]; active: boolean; createdAt: number };

export default function PropertyManager({ role, properties, onPropertiesChanged }: { role: "master" | "property-admin"; properties: Property[]; onPropertiesChanged: () => Promise<void> }) {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [status, setStatus] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, string[]>>({});

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

  return <div className="property-admin-page">
    <div className="property-admin-hero"><div><p className="eyebrow">Access & portfolio</p><h2>{role === "master" ? "Properties and managers" : "Your property access"}</h2><p>{role === "master" ? "Create properties, assign managers and control every password from one place." : "You can manage only the properties assigned to your account."}</p></div><strong>{properties.length} {properties.length === 1 ? "property" : "properties"}</strong></div>
    {status ? <p className="property-admin-status" role="status">{status}</p> : null}
    <div className="property-admin-grid">
      {role === "master" ? <>
        <form className="property-admin-card" onSubmit={createProperty}><h3>Add property</h3><label>Property name<input name="name" required placeholder="City Centre Apartment" /></label><label>URL name<input name="slug" placeholder="city-centre-apartment" /></label><label>Address<input name="address" required placeholder="Full street address" /></label><label>Currency<input name="currency" defaultValue="EUR" maxLength={3} /></label><button>Create property</button></form>
        <form className="property-admin-card" onSubmit={createAdmin}><h3>Create property manager</h3><label>Username<input name="username" required autoComplete="off" /></label><label>Temporary password<input name="password" required type="password" minLength={12} autoComplete="new-password" /></label><fieldset className="property-checklist"><legend>Property access</legend><p>Choose every property this manager can open.</p>{properties.map((property) => <label key={property.id}><input type="checkbox" name="propertyIds" value={property.id} defaultChecked={properties.length === 1} /><span><b>{property.name}</b><small>/{property.slug}</small></span></label>)}</fieldset><button>Create manager</button></form>
      </> : null}
      <form className="property-admin-card" onSubmit={changeOwnPassword}><h3>Change my password</h3><label>Current password<input name="currentPassword" required type="password" autoComplete="current-password" /></label><label>New password<input name="newPassword" required type="password" minLength={12} autoComplete="new-password" /></label><small>Use at least 12 characters.</small><button>Update my password</button></form>
    </div>
    <section className="property-list-panel"><div><h3>Properties</h3><p>Select a property in the dashboard header to edit its guide, timings and bookings.</p></div><div className="property-list-grid">{properties.map((property) => <article key={property.id}><span>{property.active ? "Active" : "Inactive"}</span><h4>{property.name}</h4><p>{property.address}</p><small>/{property.slug} · {property.currency}</small></article>)}</div></section>
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
