"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import type { GalleryItem, GuestGuide } from "@/lib/guest-guide";

export default function GalleryManager({ propertyId = "konios-house" }: { propertyId?: string }) {
  const [guide, setGuide] = useState<GuestGuide | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState("Loading gallery…");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" })
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
  }, [propertyId]);

  async function persist(updatedGallery: GalleryItem[]) {
    if (!guide) return;
    setStatus("Saving changes…");
    const updatedGuide: GuestGuide = {
      ...guide,
      gallery: updatedGallery,
    };
    const res = await fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`, {
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

async function compressImageFile(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = document.createElement("img");
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            quality
          );
        } else {
          resolve(file);
        }
      };
    };
    reader.readAsDataURL(file);
  });
}

  async function handleFileUpload(rawFile: File, isEdit = false) {
    setUploading(true);
    setStatus("Uploading image file…");
    try {
      const file = await compressImageFile(rawFile);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/host/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      if (isEdit) {
        setEditUrl(data.url);
      } else {
        setNewUrl(data.url);
        if (!newTitle) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          setNewTitle(nameWithoutExt.replace(/[-_]/g, " "));
        }
      }
      setStatus("Image uploaded successfully.");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Failed to upload image file.");
    } finally {
      setUploading(false);
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

  async function handleShareImageFile(photo: GalleryItem) {
    try {
      setStatus("Preparing image file for sharing…");
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const mime = blob.type || "image/jpeg";
      const ext = mime.split("/")[1] || "jpg";
      const cleanTitle = photo.title.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `${cleanTitle}.${ext}`;
      const file = new File([blob], filename, { type: mime });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: photo.title,
          text: `${photo.title} - ${guide?.propertyName || "Konios House"}`,
          files: [file],
        });
        setStatus("");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setStatus("Image downloaded! You can now send the image file.");
        setTimeout(() => setStatus(""), 3500);
      }
    } catch {
      setStatus("Could not share image file directly.");
      setTimeout(() => setStatus(""), 3000);
    }
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
            Upload high-resolution apartment photos, edit titles/categories, and share actual image files directly.
          </p>
        </div>
        <button className="quick-add" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "Cancel" : "＋ Upload photo"}
        </button>
      </div>

      {status ? <div className="status-toast">{status}</div> : null}

      {isAdding && (
        <form className="template-form gallery-upload-card" onSubmit={handleAdd}>
          <h3>Upload new apartment photo</h3>
          
          <div className="upload-dropzone">
            <label className="file-picker-label">
              <span>📷 Select image file from your device</span>
              <small>Supports JPG, PNG, WebP (up to 10MB)</small>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                disabled={uploading}
              />
            </label>
            {uploading ? <p className="uploading-txt">Uploading image file…</p> : null}
            {newUrl ? (
              <div className="upload-preview">
                <Image
                  src={newUrl}
                  alt="Preview"
                  width={140}
                  height={90}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                  unoptimized
                />
                <span className="preview-ok">✓ Image ready</span>
              </div>
            ) : null}
          </div>

          <div className="host-name-row">
            <label>
              Photo title / caption
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Sunny Balcony with City View"
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
            Or paste image URL / path directly
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="e.g. /gallery/balcony.jpg or https://..."
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={uploading || !newUrl}>
              Save photo to gallery ↗
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
            <span>Upload a photo above to populate the apartment gallery.</span>
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
                    <label className="edit-file-picker">
                      <span>📷 Replace image file</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, true);
                        }}
                      />
                    </label>
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
                      <button
                        className="quick-share-link primary-share-file"
                        onClick={() => handleShareImageFile(photo)}
                        title="Share actual image file via Viber, WhatsApp, SMS, or Save"
                      >
                        🖼️ Share Image File
                      </button>
                      <a
                        className="quick-share-link whatsapp"
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Photo of ${guide.propertyName} (${photo.title}): ${getFullUrl(photo.url)}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Share link on WhatsApp"
                      >
                        WhatsApp
                      </a>
                      <a
                        className="quick-share-link viber"
                        href={`viber://forward?text=${encodeURIComponent(`Photo of ${guide.propertyName} (${photo.title}): ${getFullUrl(photo.url)}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Share link on Viber"
                      >
                        Viber
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
