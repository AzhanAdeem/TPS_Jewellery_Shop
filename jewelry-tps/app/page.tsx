"use client";

import React, { useState, useEffect } from "react";

export default function JewelryTPSDashboard() {
  const [data, setData] = useState({
    inventory: [],
    rates: [],
    parties: [],
    dailyCashflow: [],
    transactions: [],
    auditLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new_txn");
  const [banner, setBanner] = useState(null); // { type: 'success' | 'error', text: '' }

  // 1. New Transaction Form State (FR-1, FR-2, FR-3, FR-10)
  const [txnForm, setTxnForm] = useState({
    txn_type: "SALE",
    party_id: "",
    rate_id: "",
    weight: "",
    applied_rate_per_unit: "",
    amount_paid: "",
    payment_method: "CASH",
    notes: "",
    simulate_failure: false,
  });

  // 2. Partial Payment / Udhaar Wasooli State (FR-7)
  const [payForm, setPayForm] = useState({
    transaction_id: "",
    party_id: "",
    installment_amount: "",
    payment_method: "CASH",
  });

  // 3. New Customer / Shopkeeper State (FR-5, FR-6)
  const [partyForm, setPartyForm] = useState({
    party_type: "CUSTOMER",
    name: "",
    contact: "",
    address: "",
  });

  // 4. Daily Rate Form State (FR-4)
  const [rateForm, setRateForm] = useState({
    metal_type: "GOLD",
    purity: "24K",
    unit: "TOLA",
    rate_per_unit: "",
  });

  // 5. History Filters (FR-8)
  const [filterParty, setFilterParty] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");

  // Database se saara live data mangwane ka function
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json);
        // Default selections set karna
        if (json.rates.length > 0 && !txnForm.rate_id) {
          setTxnForm((prev) => ({
            ...prev,
            rate_id: json.rates[0].rate_id,
            applied_rate_per_unit: json.rates[0].rate_per_unit,
          }));
        }
        if (json.parties.length > 0 && !txnForm.party_id) {
          setTxnForm((prev) => ({ ...prev, party_id: json.parties[0].party_id }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Jab user Metal Rate change kare toh Applied Rate khud fill ho jaye
  const handleRateSelect = (selectedRateId) => {
    const found = data.rates.find((r) => String(r.rate_id) === String(selectedRateId));
    setTxnForm({
      ...txnForm,
      rate_id: selectedRateId,
      applied_rate_per_unit: found ? found.rate_per_unit : "",
    });
  };

  // Live Total aur Remaining Balance Calculation
  const calculatedTotal =
    (parseFloat(txnForm.weight || 0) * parseFloat(txnForm.applied_rate_per_unit || 0)).toFixed(2);
  const calculatedRemaining = (
    parseFloat(calculatedTotal) - parseFloat(txnForm.amount_paid || 0)
  ).toFixed(2);

  // Submit Handlers
  const handleTxnSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(txnForm),
    });
    const result = await res.json();
    if (result.success) {
      setBanner({ type: "success", text: result.message });
      setTxnForm({ ...txnForm, weight: "", amount_paid: "", notes: "", simulate_failure: false });
      fetchDashboardData();
    } else {
      setBanner({ type: "error", text: result.error });
      fetchDashboardData();
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payForm),
    });
    const result = await res.json();
    if (result.success) {
      setBanner({ type: "success", text: result.message });
      setPayForm({ transaction_id: "", party_id: "", installment_amount: "", payment_method: "CASH" });
      fetchDashboardData();
    } else {
      setBanner({ type: "error", text: result.error });
    }
  };

  const handlePartySubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partyForm),
    });
    const result = await res.json();
    if (result.success) {
      setBanner({ type: "success", text: result.message });
      setPartyForm({ party_type: "CUSTOMER", name: "", contact: "", address: "" });
      fetchDashboardData();
    } else {
      setBanner({ type: "error", text: result.error });
    }
  };

  const handleRateSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rateForm),
    });
    const result = await res.json();
    if (result.success) {
      setBanner({ type: "success", text: result.message });
      setRateForm({ ...rateForm, rate_per_unit: "" });
      fetchDashboardData();
    } else {
      setBanner({ type: "error", text: result.error });
    }
  };

  // Unpaid/Partial transactions list for Udhaar Wasooli dropdown
  const creditTransactions = data.transactions.filter(
    (t) => t.payment_status === "PARTIAL" || t.payment_status === "UNPAID"
  );

  // Filtered History (FR-8)
  const filteredTransactions = data.transactions.filter((t) => {
    const matchParty = filterParty === "ALL" || String(t.party_id) === String(filterParty);
    const matchDate =
      !filterDate || new Date(t.txn_timestamp).toISOString().slice(0, 10) === filterDate;
    return matchParty && matchDate;
  });

  const todaySummary = data.dailyCashflow[0] || {
    total_transactions: 0,
    total_sales_value: 0,
    total_purchases_value: 0,
    total_cash_received: 0,
    total_cash_paid: 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-amber-500/30 px-6 py-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-extrabold px-2.5 py-1 rounded text-xs tracking-wider">
                ACID COMPLIANT TPS
              </span>
              <span className="text-xs text-slate-400 font-mono">
                PostgreSQL 3NF • EER Supertype/Subtype • Active Triggers
              </span>
            </div>
            <h1 className="text-2xl font-bold text-amber-400 mt-1">
              Al-Burhan TPS by Mirza Abdul Rafay  
            </h1>
          </div>

          {/* LIVE TIJORI STOCK PILLS */}
          <div className="flex flex-wrap gap-2">
            {data.inventory.map((inv) => (
              <div
                key={inv.inventory_id}
                className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs"
              >
                <span className="text-slate-400 block">
                  {inv.metal_type} ({inv.purity}) Stock
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  {Number(inv.available_weight).toFixed(3)} {inv.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* LIVE SARAFA RATES BAR (FR-4) */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Aaj Ka Karachi Sarafa Association Rate (metal_rates)
            </h2>
            <button
              onClick={fetchDashboardData}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300"
            >
              ↻ Refresh DB
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.rates.slice(0, 4).map((r) => (
              <div
                key={r.rate_id}
                className="bg-slate-950 border border-amber-500/20 rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <span className="text-xs text-slate-400 block">{r.metal_type}</span>
                  <span className="text-lg font-extrabold text-amber-300">{r.purity}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-white block">
                    PKR {Number(r.rate_per_unit).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400">per {r.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DAILY TOTALS VIEW CARDS (FR-9: vw_daily_cashflow) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400">Aaj Ki Kul Sales (FR-9 View)</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              PKR {Number(todaySummary.total_sales_value || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400">Aaj Ki Kul Purchases</span>
            <p className="text-xl font-bold text-amber-400 mt-1">
              PKR {Number(todaySummary.total_purchases_value || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400">Galla Cash Aaya (Received)</span>
            <p className="text-xl font-bold text-cyan-400 mt-1">
              PKR {Number(todaySummary.total_cash_received || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-xs text-slate-400">Galla Cash Gaya (Paid)</span>
            <p className="text-xl font-bold text-rose-400 mt-1">
              PKR {Number(todaySummary.total_cash_paid || 0).toLocaleString()}
            </p>
          </div>
        </section>

        {/* ALERT / ACID ROLLBACK BANNER */}
        {banner && (
          <div
            className={`p-4 rounded-xl border font-medium text-sm flex justify-between items-center ${
              banner.type === "success"
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                : "bg-rose-950/90 border-rose-500 text-rose-200"
            }`}
          >
            <div>
              <strong className="block text-base mb-0.5">
                {banner.type === "success"
                  ? "✓ DATABASE TRANSACTION COMMITTED"
                  : "⚠ DATABASE TRANSACTION ROLLED BACK (ACID PROTECTION)"}
              </strong>
              {banner.text}
            </div>
            <button onClick={() => setBanner(null)} className="text-xs underline ml-4">
              Close
            </button>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: "new_txn", label: "1. Nayi Parchi (Sale / Purchase / B2B)" },
            { id: "udhaar_khata", label: "2. Udhaar Khata & Qist Wasooli (FR-5,6,7)" },
            { id: "history", label: "3. Roznamcha History (FR-8)" },
            { id: "rates_audit", label: "4. Sarafa Rate Update & CCTV Audit Trigger" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================================================================
            TAB 1: NEW SALE / PURCHASE / B2B TRANSACTION (FR-1, FR-2, FR-3, FR-10)
           =================================================================== */}
        {activeTab === "new_txn" && (
          <div className="grid md:grid-cols-3 gap-6">
            <form
              onSubmit={handleTxnSubmit}
              className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">
                New Receipt (ACID Atomic Transaction)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={txnForm.txn_type}
                    onChange={(e) => setTxnForm({ ...txnForm, txn_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                  >
                    <option value="SALE">SALE (Gold/Silver - FR-1)</option>
                    <option value="PURCHASE">
                      PURCHASE (Buy Gold FR-2)
                    </option>
                    <option value="B2B_SALE">
                      B2B SALE (Sell Shop to shop FR-3)
                    </option>
                    <option value="B2B_PURCHASE">
                      B2B PURCHASE (Buy from Shop - FR-3)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Select Party (Customer / B2B Shopkeeper)
                  </label>
                  <select
                    value={txnForm.party_id}
                    onChange={(e) => setTxnForm({ ...txnForm, party_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    required
                  >
                    {data.parties.map((p) => (
                      <option key={p.party_id} value={p.party_id}>
                        [{p.party_type}] {p.display_name} (Balance: PKR{" "}
                        {Number(p.running_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Metal & Purity (Sarafa Rate)
                  </label>
                  <select
                    value={txnForm.rate_id}
                    onChange={(e) => handleRateSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    required
                  >
                    {data.rates.map((r) => (
                      <option key={r.rate_id} value={r.rate_id}>
                        {r.metal_type} {r.purity} — Official Rate: PKR{" "}
                        {Number(r.rate_per_unit).toLocaleString()} / {r.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Tay Shuda Rate (Applied Rate per Unit in PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={txnForm.applied_rate_per_unit}
                    onChange={(e) =>
                      setTxnForm({ ...txnForm, applied_rate_per_unit: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    placeholder="Purchase par kam rate lagayein"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    (Weight in Tola / Gram)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={txnForm.weight}
                    onChange={(e) => setTxnForm({ ...txnForm, weight: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    placeholder="e.g. 1.500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    (Amount Paid Now in PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={txnForm.amount_paid}
                    onChange={(e) => setTxnForm({ ...txnForm, amount_paid: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    placeholder="Udhaar ho toh kam ya 0 likhein"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={txnForm.payment_method}
                    onChange={(e) =>
                      setTxnForm({ ...txnForm, payment_method: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER / Online</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Notes of Receipt 
                  </label>
                  <input
                    type="text"
                    value={txnForm.notes}
                    onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    placeholder="e.g. 22K Haar Set"
                  />
                </div>
              </div>

              {/* VIVA DEMO: ACID ROLLBACK SIMULATOR */}
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-lg p-3.5 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="sim_fail"
                  checked={txnForm.simulate_failure}
                  onChange={(e) =>
                    setTxnForm({ ...txnForm, simulate_failure: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-rose-500"
                />
                <label htmlFor="sim_fail" className="text-xs text-rose-200 cursor-pointer">
                  <strong className="block text-rose-400">
                    Simulate Mid-Transaction Crash (Test FR-10 ACID Rollback)
                  </strong>
                  Is par tick lagane se PostgreSQL Step 1 (`transactions` insert), Step 2 (`payments` insert), aur Step 3 (`customers` udhaar update) chala dega, lekin Step 4 se pehle crash simulate karega aur poori transaction ko{" "}
                  <code className="bg-rose-900 px-1 rounded">ROLLBACK</code> kar dega!
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-lg transition shadow-lg"
              >
                Save & Execute ACID Transaction (BEGIN → COMMIT)
              </button>
            </form>

            {/* LIVE PARCHI PREVIEW CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  Live Record Preview
                </h4>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kul Raqam (Total Bill):</span>
                    <span className="font-bold text-white text-base">
                      PKR {Number(calculatedTotal).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Abhi Wasool / Pay:</span>
                    <span className="font-bold text-emerald-400">
                      PKR {Number(txnForm.amount_paid || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between">
                    <span className="text-slate-400">Baaqi Udhaar (Credit Balance):</span>
                    <span
                      className={`font-extrabold text-base ${
                        Number(calculatedRemaining) > 0 ? "text-amber-400" : "text-slate-300"
                      }`}
                    >
                      PKR {Number(calculatedRemaining).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mt-6 text-xs text-slate-400 space-y-1.5">
                <strong className="text-slate-200 block">
                  Behind the Scenes (4-Table Atomic SQL):
                </strong>
                <p>1. INSERT INTO transactions ...</p>
                <p>2. INSERT INTO payments ...</p>
                <p>3. UPDATE customers/shopkeepers (Udhaar) ...</p>
                <p>4. UPDATE metal_inventory (Tijori Stock) ...</p>
                <p className="text-amber-400 font-semibold pt-1">
                  Agar Stock se zyada wazan becha toh DB CHECK constraint khud ROLLBACK kar dega!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: UDHAAR KHATA & PARTIAL PAYMENT WASOOLI (FR-5, FR-6, FR-7)
           =================================================================== */}
        {activeTab === "udhaar_khata" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* FORM A: UDHAAR QIST WASOOLI (FR-7) */}
              <form
                onSubmit={handlePaySubmit}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-lg font-bold text-emerald-400 border-b border-slate-800 pb-2">
                  Udhaar Ki Qist Wasool Karein (FR-7 Partial Payment)
                </h3>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Udhaar Wali Parchi Select Karein
                  </label>
                  <select
                    value={payForm.transaction_id}
                    onChange={(e) => {
                      const found = creditTransactions.find(
                        (t) => String(t.transaction_id) === String(e.target.value)
                      );
                      setPayForm({
                        ...payForm,
                        transaction_id: e.target.value,
                        party_id: found ? found.party_id : "",
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    required
                  >
                    <option value="">-- Select Unpaid / Partial Transaction --</option>
                    {creditTransactions.map((t) => (
                      <option key={t.transaction_id} value={t.transaction_id}>
                        Parchi #{t.transaction_id} — {t.party_name} (Total: PKR{" "}
                        {Number(t.total_amount).toLocaleString()} | Status: {t.payment_status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      (Installment Amount PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={payForm.installment_amount}
                      onChange={(e) =>
                        setPayForm({ ...payForm, installment_amount: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                      placeholder="e.g. 15000"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Method</label>
                    <select
                      value={payForm.payment_method}
                      onChange={(e) =>
                        setPayForm({ ...payForm, payment_method: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      <option value="CASH">CASH</option>
                      <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-lg transition"
                >
                  Qist Jama Karein & Udhaar Kam Karein
                </button>
              </form>

              {/* FORM B: ADD NEW CUSTOMER OR SHOPKEEPER (FR-5, FR-6 EER Subtypes) */}
              <form
                onSubmit={handlePartySubmit}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">
                  Naya Gahak / B2B Dukaandar Khate Mein Dalein (EER Subtype)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Party Type</label>
                    <select
                      value={partyForm.party_type}
                      onChange={(e) =>
                        setPartyForm({ ...partyForm, party_type: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    >
                      <option value="CUSTOMER">CUSTOMER (Walk-in Gahak)</option>
                      <option value="SHOPKEEPER">SHOPKEEPER (B2B Jeweller)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Naam / Dukaan Ka Naam
                    </label>
                    <input
                      type="text"
                      value={partyForm.name}
                      onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                      placeholder="e.g. Sheikh Rasheed"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Phone / Contact (Unique)
                    </label>
                    <input
                      type="text"
                      value={partyForm.contact}
                      onChange={(e) => setPartyForm({ ...partyForm, contact: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                      placeholder="0300-1234567"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Address</label>
                    <input
                      type="text"
                      value={partyForm.address}
                      onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                      placeholder="Saddar, Karachi"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg transition"
                >
                  Save Party (Supertype + Subtype Insert)
                </button>
              </form>
            </div>

            {/* DIRECTORY VIEW TABLE (vw_party_directory) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-3">
                Tamam Customers & Shopkeepers Khata Directory (SQL View: vw_party_directory)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="p-3">Party ID</th>
                      <th className="p-3">Type (Subtype)</th>
                      <th className="p-3">Naam / Shop</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Address</th>
                      <th className="p-3 text-right">Running Udhaar / Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.parties.map((p) => (
                      <tr key={p.party_id} className="hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-xs">#{p.party_id}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              p.party_type === "CUSTOMER"
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-700"
                                : "bg-purple-950 text-purple-300 border border-purple-700"
                            }`}
                          >
                            {p.party_type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">{p.display_name}</td>
                        <td className="p-3 text-slate-400">{p.contact_number}</td>
                        <td className="p-3 text-slate-400">{p.address}</td>
                        <td className="p-3 text-right font-bold text-amber-400">
                          PKR {Number(p.running_balance).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: ROZNAMCHA TRANSACTION HISTORY (FR-8)
           =================================================================== */}
        {activeTab === "history" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-amber-400">
                Roznamcha Transaction History (FR-8)
              </h3>
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterParty}
                  onChange={(e) => setFilterParty(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="ALL">Tamam Parties (All Customers & B2B)</option>
                  {data.parties.map((p) => (
                    <option key={p.party_id} value={p.party_id}>
                      {p.display_name} ({p.party_type})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
                />
                {(filterParty !== "ALL" || filterDate) && (
                  <button
                    onClick={() => {
                      setFilterParty("ALL");
                      setFilterDate("");
                    }}
                    className="text-xs text-amber-400 underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Party</th>
                    <th className="p-3">Metal</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Applied Rate</th>
                    <th className="p-3">Total Bill</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTransactions.map((t) => (
                    <tr key={t.transaction_id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-xs">#{t.transaction_id}</td>
                      <td className="p-3 text-xs text-slate-400">
                        {new Date(t.txn_timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-xs">{t.txn_type}</td>
                      <td className="p-3 font-semibold">{t.party_name}</td>
                      <td className="p-3">
                        {t.metal_type} ({t.purity})
                      </td>
                      <td className="p-3 font-mono">
                        {t.weight} {t.unit}
                      </td>
                      <td className="p-3">
                        PKR {Number(t.applied_rate_per_unit).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-white">
                        PKR {Number(t.total_amount).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            t.payment_status === "PAID"
                              ? "bg-emerald-950 text-emerald-300"
                              : "bg-amber-950 text-amber-300"
                          }`}
                        >
                          {t.payment_status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: SARAFA RATE UPDATE (FR-4) & CCTV AUDIT LOGS (TRIGGER)
           =================================================================== */}
        {activeTab === "rates_audit" && (
          <div className="grid md:grid-cols-2 gap-6">
            <form
              onSubmit={handleRateSubmit}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-amber-400 border-b border-slate-800 pb-2">
                Aaj Ka Sarafa Rate Update Karein (FR-4 UPSERT Query)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Metal</label>
                  <select
                    value={rateForm.metal_type}
                    onChange={(e) => {
                      const m = e.target.value;
                      setRateForm({
                        ...rateForm,
                        metal_type: m,
                        purity: m === "GOLD" ? "24K" : "999",
                        unit: m === "GOLD" ? "TOLA" : "GRAM",
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                  >
                    <option value="GOLD">GOLD (Sona)</option>
                    <option value="SILVER">SILVER (Chandi)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Purity</label>
                  <select
                    value={rateForm.purity}
                    onChange={(e) => setRateForm({ ...rateForm, purity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                  >
                    {rateForm.metal_type === "GOLD" ? (
                      <>
                        <option value="24K">24K (Biscuit / Rawa)</option>
                        <option value="22K">22K (Standard Jewelry)</option>
                        <option value="21K">21K</option>
                        <option value="18K">18K</option>
                      </>
                    ) : (
                      <>
                        <option value="999">999 Pure Chandi</option>
                        <option value="925">925 Sterling</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={rateForm.unit}
                    readOnly
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Naya Rate (PKR per {rateForm.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rateForm.rate_per_unit}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, rate_per_unit: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm"
                    placeholder="e.g. 280000"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg transition"
              >
                Update Today&apos;s Rate (ON CONFLICT DO UPDATE)
              </button>
            </form>

            {/* POSTGRESQL TRIGGER AUDIT LOGS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-cyan-400 border-b border-slate-800 pb-2">
                Automated Database Trigger Logs (trg_customer_credit_audit)
              </h3>
              <p className="text-xs text-slate-400 mt-2 mb-4">
                Jab bhi kisi Customer ka Udhaar Balance badalta hai, PostgreSQL ka internal Trigger bina किसी JavaScript code ke khud purani aur nayi raqam yahan mehfooz kar leta hai.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase">
                    <tr>
                      <th className="p-2.5">Log ID</th>
                      <th className="p-2.5">Customer ID</th>
                      <th className="p-2.5">Purana Udhaar (OLD)</th>
                      <th className="p-2.5">Naya Udhaar (NEW)</th>
                      <th className="p-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-500">
                          Abhi tak koi udhaar change nahi hua. Ek udhaar sale ya qist daal kar dekhein!
                        </td>
                      </tr>
                    ) : (
                      data.auditLogs.map((log) => (
                        <tr key={log.log_id}>
                          <td className="p-2.5 font-mono">#{log.log_id}</td>
                          <td className="p-2.5 font-bold">Customer #{log.record_id}</td>
                          <td className="p-2.5 text-rose-300">
                            PKR {Number(log.old_value).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-emerald-300 font-bold">
                            PKR {Number(log.new_value).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-400">
                            {new Date(log.changed_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}