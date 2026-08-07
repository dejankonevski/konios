"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { GalleryItem } from "@/lib/guest-guide";

type Props = {
  gallery: GalleryItem[];
  propertyName: string;
};

export default function ApartmentGallery({ gallery, propertyName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "ArrowRight")
        setActiveIndex((prev) => (prev + 1) % gallery.length);
      if (e.key === "ArrowLeft")
        setActiveIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, gallery.length]);

  if (!gallery || gallery.length === 0) return null;

  const currentPhoto = gallery[activeIndex] || gallery[0];

  function getFullImageUrl(url: string) {
    if (url.startsWith("http")) return url;
    return typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  }

  function getShareText(photo: GalleryItem) {
    const fullUrl = getFullImageUrl(photo.url);
    return `Check out this photo of ${propertyName} (${photo.title}): ${fullUrl}`;
  }

  async function handleNativeShare(photo: GalleryItem) {
    const shareText = getShareText(photo);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${propertyName} - ${photo.title}`,
          text: shareText,
          url: getFullImageUrl(photo.url),
        });
      } catch {
        // User cancelled share
      }
    } else {
      setShowShareModal(true);
    }
  }

  function handleCopyLink(photo: GalleryItem) {
    const fullUrl = getFullImageUrl(photo.url);
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const primaryPhoto = gallery[0];
  const sidePhotos = gallery.slice(1, 5);

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
          📷 View all {gallery.length} photos
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
                  setActiveIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
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
                />
              </div>

              <button
                className="lightbox-nav next"
                onClick={() => setActiveIndex((prev) => (prev + 1) % gallery.length)}
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
                  Photo {activeIndex + 1} of {gallery.length}
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
                  <a
                    className="share-opt whatsapp"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareText(currentPhoto))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    💬 WhatsApp
                  </a>

                  <a
                    className="share-opt viber"
                    href={`viber://forward?text=${encodeURIComponent(getShareText(currentPhoto))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🟣 Viber
                  </a>

                  <a
                    className="share-opt imessage"
                    href={`sms:?&body=${encodeURIComponent(getShareText(currentPhoto))}`}
                  >
                    💬 iMessage / SMS
                  </a>

                  <button
                    className="share-opt link"
                    onClick={() => handleCopyLink(currentPhoto)}
                  >
                    {copied ? "Link Copied ✓" : "🔗 Copy Direct Link"}
                  </button>

                  <button
                    className="share-opt native"
                    onClick={() => handleNativeShare(currentPhoto)}
                  >
                    📱 System Share
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
