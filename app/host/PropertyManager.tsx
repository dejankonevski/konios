"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Property } from "@/lib/portfolio";

type SafeAdmin = { id: string; username: string; propertyIds: string[]; active: boolean; createdAt: number };

export default function PropertyManager({ role, properties, onPropertiesChanged }: { role: "master" | "property-admin"; properties: Property[]; onPropertiesChanged: () => Promise<void> }) {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [status, setStatus] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  async function loadAdmins() {
    if (role !== "master") return;
    const response = await fetch("/api/host/property-admins", { cache: "no-store" });
    if (response.ok) setAdmins((await response.json()).admins || []);
  }

  useEffect(() => {
    if (role !== "master") return;
    let live = true;
    fetch("/api/host/property-admins", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (live && data?.admins) setAdmins(data.admins); })
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
    const response = await fetch("/api/host/property-admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password"), propertyIds: [form.get("propertyId")] }) });
    const data = await response.json();
    setStatus(response.ok ? "Property manager created." : data.error || "Could not create manager.");
    if (response.ok) { event.currentTarget.reset(); await loadAdmins(); }
  }

  async function updateAdmin(admin: SafeAdmin, updates: { password?: string; active?: boolean }) {
    const response = await fetch("/api/host/property-admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username, propertyIds: admin.propertyIds, active: updates.active ?? admin.active, password: updates.password || undefined }) });
    const data = await response.json();
    setStatus(response.ok ? "Manager updated." : data.error || "Could not update manager.");
    if (response.ok) { setResetPasswords((current) => ({ ...current, [admin.username]: "" })); await loadAdmins(); }
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
        <form className="property-admin-card" onSubmit={createAdmin}><h3>Create property manager</h3><label>Username<input name="username" required autoComplete="off" /></label><label>Temporary password<input name="password" required type="password" minLength={12} autoComplete="new-password" /></label><label>Assigned property<select name="propertyId" required>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button>Create manager</button></form>
      </> : null}
      <form className="property-admin-card" onSubmit={changeOwnPassword}><h3>Change my password</h3><label>Current password<input name="currentPassword" required type="password" autoComplete="current-password" /></label><label>New password<input name="newPassword" required type="password" minLength={12} autoComplete="new-password" /></label><small>Use at least 12 characters.</small><button>Update my password</button></form>
    </div>
    <section className="property-list-panel"><div><h3>Properties</h3><p>Select a property in the dashboard header to edit its guide, timings and bookings.</p></div><div className="property-list-grid">{properties.map((property) => <article key={property.id}><span>{property.active ? "Active" : "Inactive"}</span><h4>{property.name}</h4><p>{property.address}</p><small>/{property.slug} · {property.currency}</small></article>)}</div></section>
    {role === "master" ? <section className="property-list-panel"><div><h3>Property managers</h3><p>Reset a password or disable access immediately.</p></div><div className="manager-list">{admins.length ? admins.map((admin) => <article key={admin.id}><div><strong>{admin.username}</strong><small>{admin.propertyIds.map((id) => properties.find((property) => property.id === id)?.name || id).join(", ")}</small></div><input type="password" minLength={12} placeholder="New password" value={resetPasswords[admin.username] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [admin.username]: event.target.value }))} /><button disabled={(resetPasswords[admin.username] || "").length < 12} onClick={() => updateAdmin(admin, { password: resetPasswords[admin.username] })}>Reset password</button><button className={admin.active ? "danger-soft" : ""} onClick={() => updateAdmin(admin, { active: !admin.active })}>{admin.active ? "Disable" : "Enable"}</button></article>) : <p>No property managers yet.</p>}</div></section> : null}
  </div>;
}
