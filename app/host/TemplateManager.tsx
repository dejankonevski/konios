"use client";

import { FormEvent, useEffect, useState } from "react";
import type { GuestGuide, MessageTemplate } from "@/lib/guest-guide";

export default function TemplateManager() {
  const [guide, setGuide] = useState<GuestGuide | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [status, setStatus] = useState("Loading templates…");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    fetch("/api/host/guide", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (live && data.guide) {
          setGuide(data.guide);
          setTemplates(data.guide.messageTemplates || []);
          setStatus("");
        }
      })
      .catch(() => live && setStatus("Could not load message templates."));
    return () => {
      live = false;
    };
  }, []);

  async function persist(updatedTemplates: MessageTemplate[]) {
    if (!guide) return;
    setStatus("Saving changes…");
    const updatedGuide: GuestGuide = {
      ...guide,
      messageTemplates: updatedTemplates,
    };
    const res = await fetch("/api/host/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGuide),
    });
    if (res.ok) {
      setGuide(updatedGuide);
      setTemplates(updatedTemplates);
      setStatus("Saved automatically.");
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
    persist(updated);
  }

  const filtered = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
  );

  if (!guide) return <div className="guide-loading">{status}</div>;

  return (
    <div className="template-manager">
      <div className="template-header">
        <div>
          <p className="eyebrow">Host communication desk</p>
          <h2>Guest message templates</h2>
          <p>
            Quickly copy pre-written messages for WhatsApp, Airbnb, or SMS. Add,
            edit, or remove templates to fit your hospitality workflow.
          </p>
        </div>
        <button
          className="quick-add"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? "Cancel" : "＋ Create template"}
        </button>
      </div>

      {status ? <div className="status-toast">{status}</div> : null}

      {isAdding && (
        <form className="template-form host-card" onSubmit={handleAdd}>
          <h3>Add new message template</h3>
          <div className="host-name-row">
            <label>
              Title / Shortcut name
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
                placeholder="e.g. Payment & Tax, Arrival, Advice"
              />
            </label>
          </div>
          <label>
            Message content
            <textarea
              required
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your template message here..."
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="submit-button">
              Save template ↗
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
          Filter templates
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates or categories…"
          />
        </label>
      </div>

      <div className="template-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>No templates found.</strong>
            <span>Create a template above to get started.</span>
          </div>
        ) : (
          filtered.map((tpl) => (
            <article key={tpl.id} className="template-card">
              {editingId === tpl.id ? (
                <form onSubmit={saveEdit} className="template-edit-form">
                  <input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="edit-title-input"
                  />
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="edit-cat-input"
                  />
                  <textarea
                    required
                    rows={4}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
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
                    <span className="category-tag">{tpl.category}</span>
                    <div className="template-card-actions">
                      <button
                        title="Edit template"
                        onClick={() => startEdit(tpl)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        title="Delete template"
                        className="danger"
                        onClick={() => handleDelete(tpl.id, tpl.title)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <h3>{tpl.title}</h3>
                  <p className="template-body">{tpl.content}</p>
                  <button
                    className={`copy-template-btn ${copiedId === tpl.id ? "copied" : ""}`}
                    onClick={() => handleCopy(tpl)}
                  >
                    {copiedId === tpl.id ? "Copied to clipboard ✓" : "Copy message text ⧉"}
                  </button>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
