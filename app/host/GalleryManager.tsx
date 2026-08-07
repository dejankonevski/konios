"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import type { GalleryItem, GuestGuide } from "@/lib/guest-guide";

export default function GalleryManager() {
  const [guide, setGuide] = useState<GuestGuide | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState("Loading gallery…");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Interior");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/host/guide", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (live && data.guide) {
          setGuide(data.guide);
          setGallery(data.guide.gallery || []);
          setStatus("");
        }
      })
      .catch(() => live && setStatus("Could not load gallery."));
    return () => {
      live = false;
    };
  }, []);

  async function persist(updatedGallery: GalleryItem[]) {
    if (!guide) return;
    setStatus("Saving changes…");
    const updatedGuide: GuestGuide = {
      ...guide,
      gallery: updatedGallery,
    };
    const res = await fetch("/api/host/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGuide),
    });
    if (res.ok) {
      setGuide(updatedGuide);
      setGallery(updatedGallery);
      setStatus("Saved automatically.");
      setTimeout(() => setStatus(""), 2000);
    } else {
      setStatus("Failed to save changes. Please try again.");
    }
  }

  function getFullUrl(url: string) {
    if (url.startsWith("http")) return url;
    return typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  }

  function handleCopyUrl(photo: GalleryItem) {
    const full = getFullUrl(photo.url);
    navigator.clipboard.writeText(full);
    setCopiedId(photo.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newUrl.trim() || !newTitle.trim()) return;
    const item: GalleryItem = {
      id: `gal-${Date.now()}`,
      url: newUrl.trim(),
      title: newTitle.trim(),
      category: newCategory.trim() || "Interior",
    };
    const updated = [item, ...gallery];
    setNewUrl("");
    setNewTitle("");
    setNewCategory("Interior");
    setIsAdding(false);
    persist(updated);
  }

  function startEdit(photo: GalleryItem) {
    setEditingId(photo.id);
    setEditUrl(photo.url);
    setEditTitle(photo.title);
    setEditCategory(photo.category || "Interior");
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editUrl.trim() || !editTitle.trim()) return;
    const updated = gallery.map((item) =>
      item.id === editingId
        ? {
            ...item,
            url: editUrl.trim(),
            title: editTitle.trim(),
            category: editCategory.trim() || "Interior",
          }
        : item
    );
    setEditingId(null);
    persist(updated);
  }

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete photo "${title}"?`)) return;
    const updated = gallery.filter((item) => item.id !== id);
    persist(updated);
  }

  const filtered = gallery.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(search.toLowerCase()))
  );

  if (!guide) return <div className="guide-loading">{status}</div>;

  return (
    <div className="gallery-manager">
      <div className="template-header">
        <div>
          <p className="eyebrow">Apartment showcase</p>
          <h2>Apartment Photo Gallery</h2>
          <p>
            Manage high-resolution apartment photos. Share direct image links with
            guests via WhatsApp, Viber, or SMS.
          </p>
        </div>
        <button className="quick-add" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "Cancel" : "＋ Add photo"}
        </button>
      </div>

      {status ? <div className="status-toast">{status}</div> : null}

      {isAdding && (
        <form className="template-form host-card" onSubmit={handleAdd}>
          <h3>Add new apartment photo</h3>
          <div className="host-name-row">
            <label>
              Photo URL / path
              <input
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="e.g. /gallery/balcony.jpg or https://..."
              />
            </label>
            <label>
              Category
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Living Room, Bedroom, Balcony"
              />
            </label>
          </div>
          <label>
            Photo caption / title
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Sunny Balcony with City View"
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="submit-button">
              Save photo ↗
            </button>
            <button
              type="button"
              className="text-reset"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="booking-tools">
        <label>
          Filter photos
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles or categories…"
          />
        </label>
      </div>

      <div className="gallery-admin-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>No photos found.</strong>
            <span>Add a photo above to populate the apartment gallery.</span>
          </div>
        ) : (
          filtered.map((photo) => (
            <article key={photo.id} className="gallery-admin-card">
              <div className="gallery-admin-thumb">
                <Image
                  src={photo.url}
                  alt={photo.title}
                  fill
                  sizes="300px"
                  style={{ objectFit: "cover" }}
                  unoptimized
                />
              </div>

              <div className="gallery-admin-content">
                {editingId === photo.id ? (
                  <form onSubmit={saveEdit} className="template-edit-form">
                    <input
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                    />
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="Category"
                    />
                    <input
                      required
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="Image URL"
                    />
                    <div className="card-edit-actions">
                      <button type="submit" className="save-chip">
                        Save
                      </button>
                      <button
                        type="button"
                        className="cancel-chip"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="template-card-top">
                      {photo.category ? (
                        <span className="category-tag">{photo.category}</span>
                      ) : null}
                      <div className="template-card-actions">
                        <button onClick={() => startEdit(photo)}>✏️ Edit</button>
                        <button
                          className="danger"
                          onClick={() => handleDelete(photo.id, photo.title)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <h3>{photo.title}</h3>

                    <div className="host-share-bar">
                      <a
                        className="quick-share-link whatsapp"
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Photo of ${guide.propertyName} (${photo.title}): ${getFullUrl(photo.url)}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Share on WhatsApp"
                      >
                        WhatsApp
                      </a>
                      <a
                        className="quick-share-link viber"
                        href={`viber://forward?text=${encodeURIComponent(`Photo of ${guide.propertyName} (${photo.title}): ${getFullUrl(photo.url)}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Share on Viber"
                      >
                        Viber
                      </a>
                      <a
                        className="quick-share-link sms"
                        href={`sms:?&body=${encodeURIComponent(`Photo of ${guide.propertyName} (${photo.title}): ${getFullUrl(photo.url)}`)}`}
                        title="Share via iMessage / SMS"
                      >
                        SMS
                      </a>
                      <button
                        className="quick-share-link copy"
                        onClick={() => handleCopyUrl(photo)}
                      >
                        {copiedId === photo.id ? "Copied ✓" : "Copy Link"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
