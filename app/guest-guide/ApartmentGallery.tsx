"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { GalleryItem } from "@/lib/guest-guide";
import { defaultGallery } from "@/lib/guest-guide";

type Props = {
  gallery: GalleryItem[];
  propertyName: string;
};

export default function ApartmentGallery({ gallery, propertyName }: Props) {
  const valid = (gallery || []).filter(
    (item) => item && typeof item.url === "string" && item.url.trim().length > 0
  );
  const items = valid.length > 0 ? valid : defaultGallery;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "ArrowRight")
        setActiveIndex((prev) => (prev + 1) % items.length);
      if (e.key === "ArrowLeft")
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, items.length]);

  const currentPhoto = items[activeIndex] || items[0];

  function getFullImageUrl(url: string) {
    if (url.startsWith("http")) return url;
    return typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  }

  function getShareText(photo: GalleryItem) {
    const fullUrl = getFullImageUrl(photo.url);
    return `Check out this photo of ${propertyName} (${photo.title}): ${fullUrl}`;
  }



  async function handleShareImageFile(photo: GalleryItem) {
    try {
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
          text: `${photo.title} - ${propertyName}`,
          files: [file],
        });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      }
    } catch (err) {
      console.error("Image file share failed:", err);
    }
  }

  function handleCopyLink(photo: GalleryItem) {
    const fullUrl = getFullImageUrl(photo.url);
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const primaryPhoto = items[0];
  const sidePhotos = items.slice(1, 5);

  return (
    <section className="manual-section gallery-section" id="gallery">
      <div className="manual-heading">
        <p className="eyebrow">Apartment Photos</p>
        <h2>Explore {propertyName}.</h2>
        <p>Browse high-resolution room photos and share them with family or travel companions.</p>
      </div>

      <div className="airbnb-mosaic" onClick={() => setIsOpen(true)}>
        <div className="mosaic-main">
          <Image
            src={primaryPhoto.url}
            alt={primaryPhoto.title}
            fill
            sizes="(max-width: 900px) 100vw, 60vw"
            priority
            unoptimized
          />
          <div className="mosaic-caption">
            <span>{primaryPhoto.category || "Featured"}</span>
            <strong>{primaryPhoto.title}</strong>
          </div>
        </div>

        <div className="mosaic-stack">
          {sidePhotos.map((photo, i) => (
            <div
              key={photo.id || i}
              className="mosaic-sub"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(i + 1);
                setIsOpen(true);
              }}
            >
              <Image
                src={photo.url}
                alt={photo.title}
                fill
                sizes="(max-width: 900px) 50vw, 20vw"
                unoptimized
              />
              <span className="mosaic-sub-title">{photo.title}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="open-gallery-badge"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          📷 View all {items.length} photos
        </button>
      </div>

      {isOpen && (
        <div className="lightbox-overlay" onClick={() => setIsOpen(false)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setIsOpen(false)}
              title="Close gallery (Esc)"
            >
              ✕
            </button>

            <div className="lightbox-stage">
              <button
                className="lightbox-nav prev"
                onClick={() =>
                  setActiveIndex((prev) => (prev - 1 + items.length) % items.length)
                }
              >
                ‹
              </button>

              <div className="lightbox-image-wrap">
                <Image
                  src={currentPhoto.url}
                  alt={currentPhoto.title}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "contain" }}
                  unoptimized
                />
              </div>

              <button
                className="lightbox-nav next"
                onClick={() => setActiveIndex((prev) => (prev + 1) % items.length)}
              >
                ›
              </button>
            </div>

            <div className="lightbox-bar">
              <div className="lightbox-meta">
                {currentPhoto.category ? (
                  <span className="lightbox-cat">{currentPhoto.category}</span>
                ) : null}
                <h4>{currentPhoto.title}</h4>
                <small>
                  Photo {activeIndex + 1} of {items.length}
                </small>
              </div>

              <div className="lightbox-actions">
                <button
                  className="share-trigger-btn"
                  onClick={() => setShowShareModal(!showShareModal)}
                >
                  📤 Share photo
                </button>
              </div>
            </div>

            {showShareModal && (
              <div className="share-popover">
                <div className="share-popover-head">
                  <h5>Share photo with guests</h5>
                  <button onClick={() => setShowShareModal(false)}>✕</button>
                </div>

                <div className="share-options-grid">
                  <button
                    className="share-opt primary-share-opt"
                    onClick={() => handleShareImageFile(currentPhoto)}
                  >
                    🖼️ Share Actual Image File
                  </button>

                  <a
                    className="share-opt whatsapp"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText(currentPhoto))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 WhatsApp Link
                  </a>

                  <a
                    className="share-opt viber"
                    href={`viber://forward?text=${encodeURIComponent(getShareText(currentPhoto))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🟣 Viber Link
                  </a>

                  <button
                    className="share-opt link"
                    onClick={() => handleCopyLink(currentPhoto)}
                  >
                    {copied ? "Link Copied ✓" : "🔗 Copy Direct Link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
