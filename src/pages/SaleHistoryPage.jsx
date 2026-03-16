import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/SaleHistoryPage.css";
import api from "../api/api.js";
import EP from "../api/apiEndpoints.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-PK");
const SHOP = "Asim Electric and Electronic Store";

// ── Date helpers ──────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};
const fmtDate = (s) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};

const DATE_PRESETS = [
  { label: "Today", key: "today", from: today, to: today },
  { label: "Yesterday", key: "yest", from: yesterday, to: yesterday },
  { label: "Last 7d", key: "7d", from: () => daysAgo(6), to: today },
  { label: "Last 30d", key: "30d", from: () => daysAgo(29), to: today },
  { label: "All", key: "all", from: () => "", to: () => "" },
];

// ── Print single invoice ──────────────────────────────────────────────────────
function printInvoice(sale) {
  const rows = (sale.items || [])
    .map(
      (it, i) =>
        `<tr><td>${i + 1}</td><td>${it.description}</td><td>${it.measurement || ""}</td>
    <td align="right">${it.qty}</td><td align="right">${Number(it.rate).toLocaleString()}</td>
    <td align="right">${it.disc || 0}%</td><td align="right"><b>${Number(it.amount).toLocaleString()}</b></td></tr>`,
    )
    .join("");
  const win = window.open("", "_blank", "width=820,height=640");
  win.document
    .write(`<!DOCTYPE html><html><head><title>${sale.invoiceNo}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;padding:18px}
  h2{text-align:center;font-size:18px}h3{text-align:center;color:#555;font-size:11px;margin:2px 0 10px}
  .meta{display:flex;justify-content:space-between;border:1px solid #ccc;padding:6px 10px;margin:8px 0;flex-wrap:wrap;gap:4px;background:#f8f8f8}
  table{width:100%;border-collapse:collapse}th{background:#2a5faa;color:#fff;padding:5px 7px;border:1px solid #1a3f7a}
  td{border:1px solid #ccc;padding:4px 7px}tr:nth-child(even) td{background:#f5f5ff}
  .tots{float:right;min-width:210px;border:1px solid #ccc;padding:8px 12px;background:#f8f8f8;margin-top:10px}
  .tr{display:flex;justify-content:space-between;padding:2px 0;font-size:12px}
  .tr.b{font-weight:bold;font-size:14px;border-top:2px solid #333;margin-top:4px}
  .red{color:red}.green{color:green}
  .footer{text-align:center;margin-top:24px;color:#888;font-size:11px;clear:both;border-top:1px solid #ddd;padding-top:8px}
  @media print{body{padding:5mm}}</style></head><body>
  <h2>${SHOP}</h2><h3>SALE INVOICE</h3>
  <div class="meta">
    <span><b>Invoice:</b> ${sale.invoiceNo}</span>
    <span><b>Date:</b> ${fmtDate(sale.invoiceDate)}</span>
    <span><b>Customer:</b> ${sale.customerName || "COUNTER SALE"}</span>
    ${sale.customerPhone ? `<span><b>Phone:</b> ${sale.customerPhone}</span>` : ""}
    <span><b>Payment:</b> ${sale.paymentMode}</span>
  </div>
  <table><thead><tr><th>#</th><th>Description</th><th>Meas</th><th align="right">Qty</th><th align="right">Rate</th><th align="right">Disc%</th><th align="right">Amount</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="tots">
    <div class="tr"><span>Sub Total</span><span>${Number(sale.subTotal || 0).toLocaleString()}</span></div>
    ${(sale.discAmount || 0) > 0 ? `<div class="tr red"><span>Discount</span><span>-${Number(sale.discAmount).toLocaleString()}</span></div>` : ""}
    <div class="tr b"><span>Net Total</span><span>${Number(sale.netTotal || 0).toLocaleString()}</span></div>
    ${(sale.prevBalance || 0) > 0 ? `<div class="tr"><span>Prev Balance</span><span>${Number(sale.prevBalance).toLocaleString()}</span></div>` : ""}
    <div class="tr green"><span>Paid</span><span>${Number(sale.paidAmount || 0).toLocaleString()}</span></div>
    ${(sale.balance || 0) > 0 ? `<div class="tr b red"><span>Balance</span><span>${Number(sale.balance).toLocaleString()}</span></div>` : ""}
  </div>
  ${sale.remarks ? `<p style="clear:both;margin-top:8px;font-size:11px;color:#555"><b>Remarks:</b> ${sale.remarks}</p>` : ""}
  <div class="footer">Thank you! — ${SHOP}</div></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── WhatsApp share ────────────────────────────────────────────────────────────
function shareWA(sale) {
  const lines = (sale.items || [])
    .map(
      (it, i) =>
        `${i + 1}. ${it.description}${it.measurement ? " (" + it.measurement + ")" : ""}  ${it.qty}×${Number(it.rate).toLocaleString()} = *${Number(it.amount).toLocaleString()}*`,
    )
    .join("\n");
  const msg =
    `*${SHOP}*\n🧾 *Invoice #${sale.invoiceNo}*\n📅 ${fmtDate(sale.invoiceDate)}\n` +
    `👤 ${sale.customerName || "COUNTER SALE"}` +
    (sale.customerPhone ? `  📞 ${sale.customerPhone}` : "") +
    "\n" +
    `${"─".repeat(26)}\n${lines}\n${"─".repeat(26)}\n` +
    `*Net Total: Rs. ${Number(sale.netTotal || 0).toLocaleString()}*\n` +
    ((sale.balance || 0) > 0
      ? `⚠️ Balance: Rs. ${Number(sale.balance).toLocaleString()}\n`
      : "") +
    `_Thank you!_`;
  const ph = sale.customerPhone?.replace(/[^0-9]/g, "");
  const url = ph
    ? `https://wa.me/92${ph.replace(/^0/, "")}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function SaleHistoryPage() {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selSale, setSelSale] = useState(null);
  const [selIdx, setSelIdx] = useState(-1);

  // Filters
  const [preset, setPreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState(""); // Cash/Credit/Bank/Cheque
  const [filterSale, setFilterSale] = useState(""); // sale/return
  const [activeCard, setActiveCard] = useState(""); // which card is clicked

  const searchRef = useRef(null);
  const tableRef = useRef(null);
  const searchTimer = useRef(null);

  // Initial load — today
  useEffect(() => {
    applyPreset("today");
  }, []);

  const applyPreset = (key) => {
    setPreset(key);
    setActiveCard("");
    const p = DATE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    const f = typeof p.from === "function" ? p.from() : p.from;
    const t = typeof p.to === "function" ? p.to() : p.to;
    setDateFrom(f);
    setDateTo(t);
    fetchData(f, t, search, filterType, filterSale);
  };

  const fetchData = useCallback(
    async (
      from = dateFrom,
      to = dateTo,
      q = search,
      type = filterType,
      saleT = filterSale,
    ) => {
      setLoading(true);
      setSelSale(null);
      setSelIdx(-1);
      try {
        const params = new URLSearchParams();
        if (from) params.set("dateFrom", from);
        if (to) params.set("dateTo", to);
        if (q) params.set("search", q);
        if (type) params.set("paymentMode", type);
        if (saleT) params.set("saleType", saleT);

        const [salesRes, sumRes] = await Promise.all([
          api.get(`${EP.SALES.GET_ALL}?${params}`),
          api.get(
            `${EP.SALES.SUMMARY}?dateFrom=${from || ""}&dateTo=${to || ""}`,
          ),
        ]);

        if (salesRes.data.success) setSales(salesRes.data.data);
        if (sumRes.data.success) setSummary(sumRes.data.data);
      } catch {}
      setLoading(false);
    },
    [],
  );

  // Debounced search
  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => fetchData(dateFrom, dateTo, v, filterType, filterSale),
      350,
    );
  };

  // Card click → filter by type
  const handleCardClick = (cardKey) => {
    const isActive = activeCard === cardKey;
    setActiveCard(isActive ? "" : "");
    let type = "",
      saleT = "";
    if (!isActive) {
      if (cardKey === "debit") type = "Credit";
      if (cardKey === "cash") type = "Cash";
      if (cardKey === "bank") type = "Bank";
      if (cardKey === "cheque") type = "Cheque";
      if (cardKey === "ret") saleT = "return";
      if (cardKey === "all") {
        type = "";
        saleT = "";
      }
    }
    setFilterType(type);
    setFilterSale(saleT);
    setActiveCard(isActive ? "" : cardKey);
    fetchData(dateFrom, dateTo, search, type, saleT);
  };

  // Keyboard navigation in table
  const handleTableKey = (e) => {
    if (!sales.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.min(selIdx + 1, sales.length - 1);
      setSelIdx(ni);
      setSelSale(sales[ni]);
      tableRef.current
        ?.querySelectorAll("tbody tr")
        ?.[ni]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.max(selIdx - 1, 0);
      setSelIdx(ni);
      setSelSale(sales[ni]);
      tableRef.current
        ?.querySelectorAll("tbody tr")
        ?.[ni]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && selSale) {
      // expand/collapse detail
      setSelSale((prev) => (prev?._id === selSale._id ? null : selSale));
    }
    if (e.key === "Delete" && selSale) handleDelete(selSale._id);
    if (e.key === "p" || e.key === "P") {
      if (selSale) printInvoice(selSale);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sale record?")) return;
    try {
      await api.delete(EP.SALES.DELETE(id));
      setSales((prev) => prev.filter((s) => s._id !== id));
      setSelSale(null);
      setSelIdx(-1);
      fetchData(dateFrom, dateTo, search, filterType, filterSale);
    } catch {}
  };

  const s = summary;
  const totalSales = s ? s.all?.total || 0 : 0;

  return (
    <div
      className="sh-page"
      onKeyDown={handleTableKey}
      tabIndex={0}
      style={{ outline: "none" }}
    >
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="sh-topbar">
        <div className="sh-title">
          <i className="bi bi-clock-history"></i> Sale History
        </div>

        {/* Quick date presets */}
        <div className="sh-date-btns">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              className={`sh-dbtn ${preset === p.key ? "active" : ""}`}
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="sh-custom-range">
          <i
            className="bi bi-calendar3"
            style={{ color: "rgba(255,255,255,0.7)" }}
          ></i>
          <input
            type="date"
            className="sh-date-input"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPreset("custom");
            }}
          />
          <span>to</span>
          <input
            type="date"
            className="sh-date-input"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPreset("custom");
            }}
          />
          <button
            className="sh-apply-btn"
            onClick={() =>
              fetchData(dateFrom, dateTo, search, filterType, filterSale)
            }
          >
            <i className="bi bi-funnel-fill"></i> Apply
          </button>
        </div>

        {/* Search */}
        <div className="sh-search-wrap">
          <div className="sh-search-box">
            <i className="bi bi-search sh-search-icon"></i>
            <input
              ref={searchRef}
              className="sh-search-input"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Invoice / Customer / Phone…"
            />
          </div>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────── */}
      <div className="sh-cards">
        {[
          {
            key: "all",
            label: "Total Sales",
            icon: "bi-bag-check",
            val: s?.all?.total || 0,
            count: s?.all?.count || 0,
            cls: "",
          },
          {
            key: "cash",
            label: "Cash Sales",
            icon: "bi-cash-coin",
            val: s?.cash?.total || 0,
            count: s?.cash?.count || 0,
            cls: "cash",
          },
          {
            key: "debit",
            label: "Credit (Due)",
            icon: "bi-person-badge",
            val: s?.debit?.balance || 0,
            count: s?.debit?.count || 0,
            cls: "debit",
          },
          {
            key: "bank",
            label: "Bank Transfer",
            icon: "bi-bank",
            val: s?.bank?.total || 0,
            count: s?.bank?.count || 0,
            cls: "credit",
          },
          {
            key: "cheque",
            label: "Cheque",
            icon: "bi-file-earmark-text",
            val: s?.cheque?.total || 0,
            count: s?.cheque?.count || 0,
            cls: "credit",
          },
          {
            key: "ret",
            label: "Returns",
            icon: "bi-arrow-return-left",
            val: s?.returns?.total || 0,
            count: s?.returns?.count || 0,
            cls: "ret",
          },
        ].map((card) => (
          <div
            key={card.key}
            className={`sh-card ${card.cls} ${activeCard === card.key ? "active" : ""}`}
            onClick={() => handleCardClick(card.key)}
            title="Click to filter"
          >
            <div className="sh-card-label">
              <i className={`bi ${card.icon}`}></i> {card.label}
            </div>
            <div className="sh-card-val">Rs. {fmt(card.val)}</div>
            <div className="sh-card-count">
              {card.count} invoice{card.count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────── */}
      <div className="sh-filterbar">
        <span className="sh-filter-label">
          <i className="bi bi-filter"></i> Type:
        </span>
        <select
          className="sh-filter-select"
          value={filterSale}
          onChange={(e) => {
            setFilterSale(e.target.value);
            fetchData(dateFrom, dateTo, search, filterType, e.target.value);
          }}
        >
          <option value="">All Types</option>
          <option value="sale">Sale</option>
          <option value="return">Return</option>
        </select>

        <span className="sh-filter-label">Payment:</span>
        <select
          className="sh-filter-select"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            fetchData(dateFrom, dateTo, search, e.target.value, filterSale);
          }}
        >
          <option value="">All Modes</option>
          <option value="Cash">Cash</option>
          <option value="Credit">Credit</option>
          <option value="Bank">Bank</option>
          <option value="Cheque">Cheque</option>
        </select>

        {(filterType || filterSale || search) && (
          <button
            className="sh-btn"
            onClick={() => {
              setFilterType("");
              setFilterSale("");
              setSearch("");
              setActiveCard("");
              fetchData(dateFrom, dateTo, "", "", "");
            }}
          >
            <i className="bi bi-x-circle"></i> Clear Filters
          </button>
        )}

        <span className="sh-result-count">
          {loading ? (
            <>
              <i className="bi bi-hourglass-split"></i> Loading…
            </>
          ) : (
            <>
              <i className="bi bi-list-ul"></i> {sales.length} record
              {sales.length !== 1 ? "s" : ""}
            </>
          )}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      <div className="sh-table-wrap" ref={tableRef}>
        <table className="sh-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} className="c">
                #
              </th>
              <th style={{ width: 105 }}>Invoice</th>
              <th style={{ width: 90 }}>Date</th>
              <th>Customer</th>
              <th style={{ width: 80 }}>Payment</th>
              <th style={{ width: 50 }} className="c">
                Items
              </th>
              <th className="r" style={{ width: 95 }}>
                Net Total
              </th>
              <th className="r" style={{ width: 80 }}>
                Paid
              </th>
              <th className="r" style={{ width: 85 }}>
                Balance
              </th>
              <th style={{ width: 55 }} className="c">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="sh-empty">
                  <i className="bi bi-hourglass-split"></i> Loading…
                </td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={10} className="sh-empty">
                  <i className="bi bi-inbox"></i> No sales found for this period
                </td>
              </tr>
            )}
            {sales.map((s, i) => (
              <tr
                key={s._id}
                className={
                  selSale?._id === s._id
                    ? "sh-row-sel"
                    : i % 2 === 0
                      ? "sh-row-even"
                      : "sh-row-odd"
                }
                onClick={() => {
                  setSelSale((prev) => (prev?._id === s._id ? null : s));
                  setSelIdx(i);
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    setSelSale((prev) => (prev?._id === s._id ? null : s));
                  }
                }}
              >
                <td className="c" style={{ fontSize: 11, color: "#888" }}>
                  {i + 1}
                </td>
                <td className="blue bold">{s.invoiceNo}</td>
                <td>{fmtDate(s.invoiceDate)}</td>
                <td
                  style={{
                    maxWidth: 180,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.customerName || "COUNTER SALE"}
                  {s.customerPhone && (
                    <span
                      style={{ color: "#888", fontSize: 10, marginLeft: 4 }}
                    >
                      {s.customerPhone}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`sh-badge ${s.paymentMode}`}>
                    {s.paymentMode}
                  </span>
                </td>
                <td className="c">{(s.items || []).length}</td>
                <td className="r bold">{fmt(s.netTotal)}</td>
                <td className="r green">{fmt(s.paidAmount)}</td>
                <td
                  className={`r bold ${(s.balance || 0) > 0 ? "red" : "green"}`}
                >
                  {fmt(s.balance)}
                </td>
                <td className="c">
                  <span className={`sh-badge ${s.saleType}`}>{s.saleType}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Panel ────────────────────────────────── */}
      <div className={`sh-detail ${selSale ? "" : "hidden"}`}>
        {selSale && (
          <>
            <div className="sh-detail-header">
              <span className="sh-detail-inv">
                <i className="bi bi-receipt"></i> {selSale.invoiceNo}
              </span>
              <span className="sh-detail-customer">
                <i className="bi bi-person"></i>{" "}
                {selSale.customerName || "Counter Sale"}
                {selSale.customerPhone && (
                  <>
                    {" "}
                    &nbsp; <i className="bi bi-telephone"></i>{" "}
                    {selSale.customerPhone}
                  </>
                )}
              </span>
              <span style={{ fontSize: 11, color: "#666" }}>
                <i className="bi bi-calendar3"></i>{" "}
                {fmtDate(selSale.invoiceDate)}
                &nbsp;&nbsp;
                <span className={`sh-badge ${selSale.paymentMode}`}>
                  {selSale.paymentMode}
                </span>
              </span>
              <div className="sh-detail-actions">
                <button
                  className="sh-btn print"
                  onClick={() => printInvoice(selSale)}
                >
                  <i className="bi bi-printer"></i> Print
                </button>
                <button className="sh-btn wa" onClick={() => shareWA(selSale)}>
                  <i className="bi bi-whatsapp"></i> WA
                </button>
                <button
                  className="sh-btn danger"
                  onClick={() => handleDelete(selSale._id)}
                >
                  <i className="bi bi-trash"></i> Delete
                </button>
                <button className="sh-btn" onClick={() => setSelSale(null)}>
                  <i className="bi bi-x"></i>
                </button>
              </div>
            </div>

            <table className="sh-det-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Description</th>
                  <th style={{ width: 80 }}>Meas.</th>
                  <th className="r" style={{ width: 50 }}>
                    Qty
                  </th>
                  <th className="r" style={{ width: 75 }}>
                    Rate
                  </th>
                  <th className="r" style={{ width: 50 }}>
                    Disc%
                  </th>
                  <th className="r" style={{ width: 85 }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(selSale.items || []).map((it, i) => (
                  <tr key={i}>
                    <td className="c">{i + 1}</td>
                    <td>{it.description}</td>
                    <td>{it.measurement}</td>
                    <td className="r">{it.qty}</td>
                    <td className="r">{fmt(it.rate)}</td>
                    <td className="r">{it.disc || 0}%</td>
                    <td className="r bold">{fmt(it.amount)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#e8f0e8" }}>
                  <td colSpan={5}></td>
                  <td className="r bold" style={{ fontSize: 11 }}>
                    Net Total:
                  </td>
                  <td className="r bold">{fmt(selSale.netTotal)}</td>
                </tr>
                {(selSale.balance || 0) > 0 && (
                  <tr style={{ background: "#ffe8e8" }}>
                    <td colSpan={5}></td>
                    <td className="r bold red" style={{ fontSize: 11 }}>
                      Balance:
                    </td>
                    <td className="r bold red">{fmt(selSale.balance)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {selSale.remarks && (
              <div
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#666",
                  borderTop: "1px solid #ddd",
                }}
              >
                <i className="bi bi-chat-left-text"></i> {selSale.remarks}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
