import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import "./ExpenseSplitter.css";

/**
 * UX geliştirmeleri:
 * - Yükleniyor / hata durumları için banner & skeleton
 * - Form: submit ile Enter desteği, alan etiketleri, erişilebilirlik
 * - Validasyon: amount/notes trim, weight number, buton disabled mantığı
 * - API baseURL env üzerinden (fallback localhost)
 * - Liste/sıralama (created_at varsa, yoksa id ile)
 * - Küçük performans iyileştirmeleri (useMemo/useCallback)
 */

const API_BASE =
  import.meta?.env?.VITE_API_BASE_URL ||
  process.env?.REACT_APP_API_BASE_URL ||
  "http://localhost:3001";

const ExpenseSplitter = ({ eventId, userId }) => {
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [totalAmount, setTotalAmount] = useState(0);

  const [newExpense, setNewExpense] = useState({
    amount: "",
    notes: "",
    weight: 1.0,
  });

  const [loading, setLoading] = useState(false); // add expense loading
  const [isFetching, setIsFetching] = useState(true); // initial fetch loading
  const [error, setError] = useState(null);

  const formatCurrency = useCallback((amount) => {
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${Number(amount || 0).toFixed(2)} ₺`;
    }
  }, []);

  const getBalanceClass = (balance) => {
    if (balance > 0) return "positive";
    if (balance < 0) return "negative";
    return "neutral";
  };

  const getBalanceText = (balance) => {
    if (balance > 0) return `+${formatCurrency(balance)} alacak`;
    if (balance < 0) return `${formatCurrency(Math.abs(balance))} verecek`;
    return `${formatCurrency(0)} eşit`;
  };

  const fetchExpenses = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const url = `${API_BASE}/events/${eventId}/summary`;
      const response = await axios.get(url, { timeout: 15000 });

      const exp = response?.data?.expenses || {};
      setExpenses(exp.items || []);
      setBalances(exp.balances || {});
      setTotalAmount(exp.total || 0);
    } catch (err) {
      console.error("Error fetching expenses:", err);
      setError("Veriler alınırken bir sorun oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsFetching(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // created_at varsa tarihe göre, yoksa expense_id'ye göre sırala
  const sortedExpenses = useMemo(() => {
    const items = Array.isArray(expenses) ? expenses.slice() : [];
    return items.sort((a, b) => {
      const aT = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (aT !== bT) return bT - aT;
      // fallback id sıralaması
      const aId = String(a?.expense_id ?? "");
      const bId = String(b?.expense_id ?? "");
      return bId.localeCompare(aId);
    });
  }, [expenses]);

  const canSubmit = useMemo(() => {
    const amt = parseFloat(String(newExpense.amount).replace(",", "."));
    const notes = String(newExpense.notes || "").trim();
    const weight = Number(newExpense.weight);
    return (
      !loading &&
      !isFetching &&
      !Number.isNaN(amt) &&
      amt > 0 &&
      notes.length > 0 &&
      Number.isFinite(weight)
    );
  }, [newExpense, loading, isFetching]);

  const handleAddExpense = async (e) => {
    e?.preventDefault?.();

    const amt = parseFloat(String(newExpense.amount).replace(",", "."));
    const notes = String(newExpense.notes || "").trim();
    const weight = Number(newExpense.weight);

    if (!notes || Number.isNaN(amt) || amt <= 0) {
      alert("Lütfen geçerli bir tutar ve açıklama girin!");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/events/${eventId}/expense`, {
        user_id: userId,
        amount: amt,
        notes,
        weight: Number.isFinite(weight) ? weight : 1.0,
      });

      setNewExpense({ amount: "", notes: "", weight: 1.0 });
      await fetchExpenses();
    } catch (err) {
      console.error("Error adding expense:", err);
      setError("Gider eklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="expense-splitter" role="region" aria-labelledby="es-title">
      <div className="header">
        <h2 id="es-title">💰 Masraf Paylaşımı</h2>
        <p>Giderleri paylaşın ve bakiyeleri görün</p>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
          <button
            className="link"
            onClick={fetchExpenses}
            aria-label="Yeniden dene"
            type="button"
          >
            Yeniden dene
          </button>
        </div>
      )}

      <div className="total-card" aria-live="polite">
        <p className="total-label">Toplam Harcama</p>
        <h2 className="total-amount">
          {isFetching ? "…" : formatCurrency(totalAmount)}
        </h2>
      </div>

      <div className="section">
        <h3>Giderler</h3>

        {isFetching ? (
          <div className="skeleton-list" aria-hidden="true">
            <div className="skeleton item" />
            <div className="skeleton item" />
            <div className="skeleton item" />
          </div>
        ) : sortedExpenses.length === 0 ? (
          <div className="empty-message">
            <p>Henüz gider eklenmemiş</p>
          </div>
        ) : (
          <div className="expenses-list">
            {sortedExpenses.map((expense) => (
              <div
                key={expense.expense_id ?? expense.notes}
                className="expense-item"
              >
                <div className="expense-info">
                  <h4 className="expense-notes">{expense.notes}</h4>
                  <p className="expense-meta">
                    <span className="expense-user">
                      {expense.user_id ?? "Bilinmeyen"} ödedi
                    </span>
                    {expense.created_at && <span className="dot">•</span>}
                    {expense.created_at && (
                      <time dateTime={expense.created_at}>
                        {new Date(expense.created_at).toLocaleString("tr-TR")}
                      </time>
                    )}
                  </p>
                </div>
                <div className="expense-amount">
                  {formatCurrency(expense.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Bakiyeler</h3>

        {isFetching ? (
          <div className="skeleton-list" aria-hidden="true">
            <div className="skeleton row" />
            <div className="skeleton row" />
          </div>
        ) : !balances || Object.keys(balances).length === 0 ? (
          <div className="empty-message">
            <p>Bakiye bilgisi yok</p>
          </div>
        ) : (
          <div className="balances-list">
            {Object.entries(balances).map(([user, data]) => {
              const bal = Number(data?.balance || 0);
              return (
                <div
                  key={user}
                  className={`balance-item ${getBalanceClass(bal)}`}
                >
                  <div className="balance-user">
                    <span className="user-icon" aria-hidden="true">
                      👤
                    </span>
                    <span className="user-name">{user}</span>
                  </div>
                  <div className="balance-amount">{getBalanceText(bal)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="add-expense">
        <h3>Yeni Gider Ekle</h3>
        <form className="input-group" onSubmit={handleAddExpense} noValidate>
          <label className="sr-only" htmlFor="amount-input">
            Tutar (₺)
          </label>
          <input
            id="amount-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Tutar (₺)"
            value={newExpense.amount}
            onChange={(e) =>
              setNewExpense((s) => ({ ...s, amount: e.target.value }))
            }
            required
          />

          <label className="sr-only" htmlFor="notes-input">
            Açıklama
          </label>
          <input
            id="notes-input"
            type="text"
            placeholder="Açıklama (ör: Pizza, İçecekler)"
            value={newExpense.notes}
            onChange={(e) =>
              setNewExpense((s) => ({ ...s, notes: e.target.value }))
            }
            maxLength={120}
            required
          />

          <label className="sr-only" htmlFor="weight-select">
            Paylaşım ağırlığı
          </label>
          <select
            id="weight-select"
            value={newExpense.weight}
            onChange={(e) =>
              setNewExpense((s) => ({
                ...s,
                weight: parseFloat(e.target.value),
              }))
            }
            title="Paylaşım ağırlığı"
          >
            <option value={1.0}>Normal paylaşım (1x)</option>
            <option value={0.5}>Yarım paylaşım (0.5x)</option>
            <option value={0}>Paylaşıma katılmıyor (0x)</option>
            <option value={2.0}>Çift paylaşım (2x)</option>
          </select>

          <button
            className="btn-primary"
            type="submit"
            disabled={!canSubmit}
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? "Ekleniyor..." : "+ Gider Ekle"}
          </button>
        </form>

        <p className="form-hint">
          İpucu: Tutarı yazıp <kbd>Enter</kbd>’a basarak hızlı ekleme
          yapabilirsiniz.
        </p>
      </div>
    </div>
  );
};

export default ExpenseSplitter;
