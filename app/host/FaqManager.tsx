"use client";

import { FormEvent, useEffect, useState } from "react";
import type { FaqItem, GuestGuide } from "@/lib/guest-guide";

export default function FaqManager() {
  const [guide, setGuide] = useState<GuestGuide | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [status, setStatus] = useState("Loading FAQs…");
  const [search, setSearch] = useState("");

  // New FAQ state
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("General");

  // Edit FAQ state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
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
          setFaqs(data.guide.faqs || []);
          setStatus("");
        }
      })
      .catch(() => live && setStatus("Could not load FAQs."));
    return () => {
      live = false;
    };
  }, []);

  async function persist(updatedFaqs: FaqItem[]) {
    if (!guide) return;
    setStatus("Saving changes…");
    const updatedGuide: GuestGuide = {
      ...guide,
      faqs: updatedFaqs,
    };
    const res = await fetch("/api/host/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGuide),
    });
    if (res.ok) {
      setGuide(updatedGuide);
      setFaqs(updatedFaqs);
      setStatus("Saved automatically.");
      setTimeout(() => setStatus(""), 2000);
    } else {
      setStatus("Failed to save changes. Please try again.");
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const item: FaqItem = {
      id: `faq-${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory.trim() || "General",
    };
    const updated = [item, ...faqs];
    setNewQuestion("");
    setNewAnswer("");
    setNewCategory("General");
    setIsAdding(false);
    persist(updated);
  }

  function startEdit(faq: FaqItem) {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
    setEditCategory(faq.category || "General");
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editQuestion.trim() || !editAnswer.trim()) return;
    const updated = faqs.map((f) =>
      f.id === editingId
        ? {
            ...f,
            question: editQuestion.trim(),
            answer: editAnswer.trim(),
            category: editCategory.trim() || "General",
          }
        : f
    );
    setEditingId(null);
    persist(updated);
  }

  function handleDelete(id: string, question: string) {
    if (!window.confirm(`Delete question "${question}"?`)) return;
    const updated = faqs.filter((f) => f.id !== id);
    persist(updated);
  }

  const filtered = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase()) ||
      (f.category && f.category.toLowerCase().includes(search.toLowerCase()))
  );

  if (!guide) return <div className="guide-loading">{status}</div>;

  return (
    <div className="faq-manager">
      <div className="faq-header">
        <div>
          <p className="eyebrow">Guest self-service</p>
          <h2>Frequent answers & FAQs</h2>
          <p>
            Add answers to common guest questions (parking, tap water, check-in rules).
            These appear directly in the digital guest guide.
          </p>
        </div>
        <button className="quick-add" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "Cancel" : "＋ Add FAQ"}
        </button>
      </div>

      {status ? <div className="status-toast">{status}</div> : null}

      {isAdding && (
        <form className="faq-form host-card" onSubmit={handleAdd}>
          <h3>Add new frequent answer</h3>
          <div className="host-name-row">
            <label>
              Question
              <input
                required
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Is parking free and reserved?"
              />
            </label>
            <label>
              Category
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Parking, Access, Amenities"
              />
            </label>
          </div>
          <label>
            Answer / Response
            <textarea
              required
              rows={3}
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="e.g. Yes, we have a dedicated outdoor parking space marked 32..."
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="submit-button">
              Save FAQ ↗
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
          Search FAQs
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or answers…"
          />
        </label>
      </div>

      <div className="faq-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>No FAQs found.</strong>
            <span>Add your first frequent answer above.</span>
          </div>
        ) : (
          filtered.map((faq) => (
            <article key={faq.id} className="faq-card">
              {editingId === faq.id ? (
                <form onSubmit={saveEdit} className="faq-edit-form">
                  <input
                    required
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="edit-q-input"
                  />
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="edit-cat-input"
                  />
                  <textarea
                    required
                    rows={3}
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
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
                  <div className="faq-card-head">
                    {faq.category ? (
                      <span className="category-tag">{faq.category}</span>
                    ) : null}
                    <div className="faq-card-actions">
                      <button onClick={() => startEdit(faq)}>✏️ Edit</button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(faq.id, faq.question)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
