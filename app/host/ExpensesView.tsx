"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Booking } from "@/lib/bookings";
import { EUR_TO_MKD, EXPENSE_CATEGORIES, Expense, ExpenseCategory } from "@/lib/expenses";

export default function ExpensesView({ bookings, propertyId = "konios-house" }: { bookings: Booking[]; propertyId?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("Supplies & Amenities");
  const [amountEur, setAmountEur] = useState<string>("");
  const [amountMkd, setAmountMkd] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState("");

  const [filterCategory, setFilterCategory] = useState<string>("All");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/host/expenses?propertyId=${encodeURIComponent(propertyId)}`);
        if (res.ok) {
          const data = await res.json();
          setExpenses(data.expenses || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [propertyId]);

  function handleEurChange(val: string) {
    setAmountEur(val);
    if (val === "" || isNaN(Number(val))) {
      setAmountMkd("");
    } else {
      setAmountMkd(String(Math.round(Number(val) * EUR_TO_MKD)));
    }
  }

  function handleMkdChange(val: string) {
    setAmountMkd(val);
    if (val === "" || isNaN(Number(val))) {
      setAmountEur("");
    } else {
      setAmountEur((Number(val) / EUR_TO_MKD).toFixed(2));
    }
  }

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    setError("");
    const eurVal = parseFloat(amountEur) || 0;
    const mkdVal = parseFloat(amountMkd) || 0;

    if (eurVal <= 0 && mkdVal <= 0) {
      setError("Please enter a valid expense amount in EUR or MKD.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/host/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          category,
          amountEur: eurVal,
          amountMkd: mkdVal,
          notes,
          bookingId: bookingId || undefined,
          propertyId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save expense entry");
      }

      setAmountEur("");
      setAmountMkd("");
      setNotes("");
      setBookingId("");
      const fetchRes = await fetch(`/api/host/expenses?propertyId=${encodeURIComponent(propertyId)}`);
      if (fetchRes.ok) {
        const data = await fetchRes.json();
        setExpenses(data.expenses || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save expense.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const res = await fetch(`/api/host/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExpenses(expenses.filter((e) => e.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  }

  const filteredExpenses = expenses.filter(
    (exp) => filterCategory === "All" || exp.category === filterCategory
  );

  const totalExpenseEur = expenses.reduce((sum, e) => sum + (e.amountEur || 0), 0);
  const totalExpenseMkd = Math.round(totalExpenseEur * EUR_TO_MKD);

  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + (e.amountEur || 0), 0);
    return { category: cat, totalEur: total, totalMkd: Math.round(total * EUR_TO_MKD) };
  });

  return (
    <div className="expenses-view-container">
      <div className="expenses-top-header">
        <div>
          <span className="eyebrow">Financial Deductions</span>
          <h2>Property Expense Manager</h2>
          <p className="expenses-subhead">
            Log operational costs (cleaning agencies, supplies, utilities, repairs) to deduct them from revenue and track your true net profit.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="expense-kpi-grid">
        <div className="expense-kpi-card total-card">
          <span className="kpi-label">TOTAL OPERATIONAL EXPENSES</span>
          <strong className="kpi-value-main">
            {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(totalExpenseEur)}
          </strong>
          <span className="kpi-sub-mkd">≈ {totalExpenseMkd.toLocaleString()} MKD</span>
        </div>

        {categoryTotals.slice(0, 3).map((ct) => (
          <div key={ct.category} className="expense-kpi-card">
            <span className="kpi-label">{ct.category.toUpperCase()}</span>
            <strong className="kpi-value-sec">
              {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(ct.totalEur)}
            </strong>
            <span className="kpi-sub-mkd">{ct.totalMkd.toLocaleString()} MKD</span>
          </div>
        ))}
      </div>

      {/* Main Layout: New Expense Form & Table */}
      <div className="expense-content-grid">
        {/* Form */}
        <div className="expense-form-card">
          <h3>+ Log New Expense</h3>
          <form onSubmit={handleAddExpense} className="expense-form">
            <div className="expense-form-group">
              <label htmlFor="exp-date">Expense Date</label>
              <input
                id="exp-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="expense-form-group">
              <label htmlFor="exp-category">Category</label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="expense-dual-amount">
              <div className="expense-form-group">
                <label htmlFor="exp-eur">Amount (€ EUR)</label>
                <input
                  id="exp-eur"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 50"
                  value={amountEur}
                  onChange={(e) => handleEurChange(e.target.value)}
                />
              </div>

              <div className="expense-form-group">
                <label htmlFor="exp-mkd">Amount (MKD)</label>
                <input
                  id="exp-mkd"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 3075"
                  value={amountMkd}
                  onChange={(e) => handleMkdChange(e.target.value)}
                />
              </div>
            </div>

            <div className="expense-form-group">
              <label htmlFor="exp-notes">Description / Notes</label>
              <input
                id="exp-notes"
                type="text"
                placeholder="e.g. Agency cleaning fee, Detergent & towels..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="expense-form-group">
              <label htmlFor="exp-booking">Link to Reservation (Optional)</label>
              <select
                id="exp-booking"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              >
                <option value="">General Property Expense</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.firstName} {b.lastName} ({b.checkIn} to {b.checkOut})
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="submit-button" disabled={saving}>
              {saving ? "Saving Expense..." : "Save Expense Record →"}
            </button>
          </form>
        </div>

        {/* Expenses List Table */}
        <div className="expense-table-card">
          <div className="expense-table-header">
            <h3>Recorded Expenses</h3>
            <div className="expense-filter-pills">
              <button
                type="button"
                className={`exp-pill ${filterCategory === "All" ? "active" : ""}`}
                onClick={() => setFilterCategory("All")}
              >
                All ({expenses.length})
              </button>
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`exp-pill ${filterCategory === cat ? "active" : ""}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <span>Loading expense records...</span>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="empty-state">
              <strong>No expenses logged yet.</strong>
              <span>Use the form on the left to add operational costs.</span>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="analytics-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount (€)</th>
                    <th>Amount (MKD)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => {
                    const linkedBooking = bookings.find((b) => b.id === exp.bookingId);
                    return (
                      <tr key={exp.id}>
                        <td>
                          <strong>{exp.date}</strong>
                        </td>
                        <td>
                          <span className={`category-tag cat-${exp.category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                            {exp.category}
                          </span>
                        </td>
                        <td>
                          <span>{exp.notes || "—"}</span>
                          {linkedBooking ? (
                            <small className="linked-booking-sub">
                              🔗 {linkedBooking.firstName} {linkedBooking.lastName}
                            </small>
                          ) : null}
                        </td>
                        <td className="col-gross">
                          <strong>
                            {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(exp.amountEur)}
                          </strong>
                        </td>
                        <td>
                          <span>{exp.amountMkd ? `${exp.amountMkd} MKD` : "—"}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-del-expense"
                            title="Delete expense entry"
                            onClick={() => handleDeleteExpense(exp.id)}
                          >
                            🗑 Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
