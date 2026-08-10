"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { GuestGuide, MessageTemplate } from "@/lib/guest-guide";

export default function TemplateManager({ onUpdate, propertyId = "konios-house" }: { onUpdate?: () => void; propertyId?: string }) {
  const [guide, setGuide] = useState<GuestGuide | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [status, setStatus] = useState("Loading templates…");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // New template form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newContent, setNewContent] = useState("");

  // Editing template state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editContent, setEditContent] = useState("");

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
          const tpls = data.guide.messageTemplates || [];
          setTemplates(tpls);
          if (tpls.length > 0) setActiveTemplateId(tpls[0].id);
          setStatus("");
        }
      })
      .catch(() => live && setStatus("Could not load message templates."));
    return () => {
      live = false;
    };
  }, [propertyId]);

  async function persist(updatedTemplates: MessageTemplate[]) {
    if (!guide) return;
    setStatus("Saving changes…");
    const updatedGuide: GuestGuide = {
      ...guide,
      messageTemplates: updatedTemplates,
    };
    const res = await fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGuide),
    });
    if (res.ok) {
      setGuide(updatedGuide);
      setTemplates(updatedTemplates);
      setStatus("Saved automatically.");
      onUpdate?.();
      setTimeout(() => setStatus(""), 2000);
    } else {
      setStatus("Failed to save changes. Please try again.");
    }
  }

  function handleCopy(tpl: MessageTemplate) {
    navigator.clipboard.writeText(tpl.content);
    setCopiedId(tpl.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const newTpl: MessageTemplate = {
      id: `tpl-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || "General",
      content: newContent.trim(),
    };
    const updated = [newTpl, ...templates];
    setNewTitle("");
    setNewCategory("General");
    setNewContent("");
    setIsAdding(false);
    setActiveTemplateId(newTpl.id);
    persist(updated);
  }

  function startEdit(tpl: MessageTemplate) {
    setEditingId(tpl.id);
    setEditTitle(tpl.title);
    setEditCategory(tpl.category);
    setEditContent(tpl.content);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    const updated = templates.map((t) =>
      t.id === editingId
        ? {
            ...t,
            title: editTitle.trim(),
            category: editCategory.trim() || "General",
            content: editContent.trim(),
          }
        : t
    );
    setEditingId(null);
    persist(updated);
  }

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete template "${title}"?`)) return;
    const updated = templates.filter((t) => t.id !== id);
    if (activeTemplateId === id) {
      const remaining = updated[0]?.id || null;
      setActiveTemplateId(remaining);
    }
    persist(updated);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category || "General"));
    return ["All", ...Array.from(set)];
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchesCategory = selectedCategory === "All" || (t.category || "General") === selectedCategory;
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, search]);

  const activeTemplate = useMemo(() => {
    return filtered.find((t) => t.id === activeTemplateId) || filtered[0] || null;
  }, [filtered, activeTemplateId]);

  if (!guide) return <div className="guide-loading">{status}</div>;

  return (
    <div className="tm-container">
      {/* Header */}
      <div className="tm-header">
        <div>
          <p className="eyebrow">Host communication desk</p>
          <h2>Guest Message Templates</h2>
          <p className="tm-subtitle">
            Manage pre-written messages for WhatsApp, Airbnb, or SMS. Click any template to inspect, edit, or copy.
          </p>
        </div>
        <button
          type="button"
          className="tm-btn-create"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? "Cancel" : "＋ Create Template"}
        </button>
      </div>

      {status ? <div className="status-toast">{status}</div> : null}

      {/* New Template Modal/Form */}
      {isAdding && (
        <form className="tm-create-card" onSubmit={handleAdd}>
          <h3>Add New Message Template</h3>
          <div className="tm-form-row">
            <label>
              Title / Shortcut Name
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Tourist Tax in Lockbox"
              />
            </label>
            <label>
              Category
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Payment & Tax, Arrival, Departure"
              />
            </label>
          </div>
          <label>
            Message Content
            <textarea
              required
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your template message here..."
            />
          </label>
          <div className="tm-form-actions">
            <button type="submit" className="tm-btn-primary">
              Save Template ↗
            </button>
            <button
              type="button"
              className="tm-btn-secondary"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Category Pills & Search Bar */}
      <div className="tm-bar">
        <div className="tm-categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`tm-cat-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="tm-search-box">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search templates..."
          />
        </div>
      </div>

      {/* Split-Pane Communication Desk */}
      <div className="tm-split-pane">
        {/* Left Column: Compact Quick-Select List */}
        <div className="tm-list-column">
          <div className="tm-list-header">
            <span>TEMPLATES ({filtered.length})</span>
          </div>
          <div className="tm-list-scroll">
            {filtered.length === 0 ? (
              <div className="tm-empty-list">No templates match filters.</div>
            ) : (
              filtered.map((tpl) => {
                const isActive = activeTemplate?.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={`tm-list-item ${isActive ? "active" : ""}`}
                    onClick={() => setActiveTemplateId(tpl.id)}
                  >
                    <div className="tm-item-top">
                      <strong className="tm-item-title">{tpl.title}</strong>
                      <span className="tm-item-cat">{tpl.category}</span>
                    </div>
                    <p className="tm-item-preview">{tpl.content}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Inspector & Editor */}
        <div className="tm-detail-column">
          {activeTemplate ? (
            editingId === activeTemplate.id ? (
              /* Inline Edit Mode */
              <form onSubmit={saveEdit} className="tm-editor-card">
                <div className="tm-editor-header">
                  <h3>Edit Template</h3>
                </div>
                <div className="tm-form-row">
                  <label>
                    Title
                    <input
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Message Content
                  <textarea
                    required
                    rows={8}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                </label>
                <div className="tm-form-actions">
                  <button type="submit" className="tm-btn-primary">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="tm-btn-secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Preview & Copy Mode */
              <div className="tm-inspector-card">
                <div className="tm-inspector-top">
                  <div>
                    <span className="tm-badge-cat">{activeTemplate.category}</span>
                    <h3 className="tm-inspector-title">{activeTemplate.title}</h3>
                  </div>
                  <div className="tm-inspector-actions">
                    <button
                      type="button"
                      className="tm-btn-icon"
                      title="Edit template"
                      onClick={() => startEdit(activeTemplate)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className="tm-btn-icon danger"
                      title="Delete template"
                      onClick={() => handleDelete(activeTemplate.id, activeTemplate.title)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                <div className="tm-message-box">
                  <pre className="tm-message-text">{activeTemplate.content}</pre>
                </div>

                <div className="tm-inspector-foot">
                  <button
                    type="button"
                    className={`tm-btn-copy ${copiedId === activeTemplate.id ? "copied" : ""}`}
                    onClick={() => handleCopy(activeTemplate)}
                  >
                    {copiedId === activeTemplate.id ? "✓ Copied to Clipboard" : "⧉ Copy Message Text"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="tm-no-selection">
              <p>Select a template on the left to read, edit, or copy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
