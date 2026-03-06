import React, { useEffect, useMemo, useState } from "react";
import {
  connectBlockchain,
  getProduct,
  getProductIdsByBox,
  verifyBox,
  saleComplete
} from "../../trustChain";
import BackButton from "../../components/BackButton";
import "../../index2.css";
import "../../retailer.css";
import { fetchBoxRetailerAssignment, fetchRetailerShipments } from "../../services/api";

const RetailerDashboard = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState("");
  const [activeSection, setActiveSection] = useState("box");

  const [boxId, setBoxId] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);
  const [isVerifyingBox, setIsVerifyingBox] = useState(false);
  const [boxAnalyticsHistory, setBoxAnalyticsHistory] = useState([]);
  const [saleBuyerEmail, setSaleBuyerEmail] = useState("");
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  const [retailerShipments, setRetailerShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentsSummary, setShipmentsSummary] = useState(null);

  const [scanProductId, setScanProductId] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [isVerifyingProduct, setIsVerifyingProduct] = useState(false);
  const isBoxAlreadyVerified =
    boxProducts.length > 0 &&
    boxProducts.every((p) => p.verifiedByRetailer || p.sold);
  const lastScanEntry = boxAnalyticsHistory[0] || null;
  const recentScans = boxAnalyticsHistory.slice(0, 5);
  const analyticsTotals = useMemo(
    () =>
      boxAnalyticsHistory.reduce(
        (acc, entry) => ({
          total: acc.total + (entry.total || 0),
          verified: acc.verified + (entry.verified || 0),
          sold: acc.sold + (entry.sold || 0)
        }),
        { total: 0, verified: 0, sold: 0 }
      ),
    [boxAnalyticsHistory]
  );
  const currentVerifiedCount = boxProducts.filter((p) => p.verifiedByRetailer).length;
  const currentSoldCount = boxProducts.filter((p) => p.sold).length;
  const currentPendingCount = Math.max(0, boxProducts.length - (currentVerifiedCount + currentSoldCount));
  const lastScanVerifiedRate =
    lastScanEntry && lastScanEntry.total ? (lastScanEntry.verified / lastScanEntry.total) * 100 : 0;
  const historySoldRate = analyticsTotals.total ? (analyticsTotals.sold / analyticsTotals.total) * 100 : 0;
  const formatCurrency = (value) => new Intl.NumberFormat("en-IN").format(Math.round(Math.max(0, Number(value) || 0)));
  const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");
  const loadRetailerShipments = async () => {
    setShipmentsLoading(true);
    try {
      const data = await fetchRetailerShipments();
      setShipmentsSummary(data.summary || null);
      setRetailerShipments(data.shipments || []);
    } catch (err) {
      console.error("Retailer shipments load failed:", err);
      setStatus(`Shipment feed failed: ${err?.message || "Please try again"}`);
      setRetailerShipments([]);
      setShipmentsSummary(null);
    } finally {
      setShipmentsLoading(false);
    }
  };

  const summaryBoxes = shipmentsSummary?.totalBoxes || 0;
  const summaryProducts = shipmentsSummary?.totalProducts || 0;
  const summaryShipped = shipmentsSummary?.totalShipped || 0;
  const summarySold = shipmentsSummary?.totalSold || 0;
  const summaryTopManufacturer = shipmentsSummary?.topManufacturer || "Awaiting your first box";
  const summaryBatch = shipmentsSummary?.mostRecentBatch ? `Batch ${shipmentsSummary.mostRecentBatch}` : "—";
  const summaryRevenueValue = shipmentsSummary?.estimatedRevenue || 0;
  const summaryProfitValue = shipmentsSummary?.estimatedProfit || 0;

  const inventoryProducts = useMemo(() => {
    const list = [];
    retailerShipments.forEach((shipment) => {
      const details = Array.isArray(shipment.productDetails) ? shipment.productDetails : [];
      details.forEach((product) => {
        list.push({
          ...product,
          boxId: shipment.boxId,
          batchId: shipment.batchId,
          manufacturerLabel: shipment.manufacturer?.label,
          retailerName: shipment.retailer?.name || shipment.retailer?.label || "Retailer",
          retailerEmail: shipment.retailer?.email || shipment.retailer?.label || null
        });
      });
    });
    return list;
  }, [retailerShipments]);

  const unsoldProducts = inventoryProducts.filter((product) => !product.sold);
  const soldProducts = inventoryProducts.filter((product) => product.sold);

  const getStatusTone = (message) => {
    const text = String(message || "").toLowerCase();
    if (!text) return "info";
    if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found") || text.includes("mismatch")) return "error";
    if (text.includes("⚠") || text.includes("required") || text.includes("cannot") || text.includes("already sold")) return "warning";
    if (text.includes("⏳") || text.includes("checking") || text.includes("marking") || text.includes("verifying")) return "info";
    if (text.includes("✅") || text.includes("connected") || text.includes("valid") || text.includes("found")) return "success";
    return "info";
  };

  const handleConnect = async () => {
    try {
      const address = await connectBlockchain();
      setWalletConnected(true);
      setWalletAddress(address || "");
      setStatus(`Wallet connected: ${address || "-"}`);
    } catch (e) {
      console.error(e);
      setWalletConnected(false);
      setWalletAddress("");
      setStatus("Connect failed: " + (e?.message || e));
    }
  };

  const handleFetchBox = async () => {
    setStatus("");
    setBoxProducts([]);
    try {
      const normalizedBoxId = (boxId || "").trim();
      if (!normalizedBoxId) {
        setStatus("Enter a Box ID first.");
        return;
      }

      const assignment = await fetchBoxRetailerAssignment(normalizedBoxId);
      if (!assignment.assignedToCurrent) {
        const recipient = assignment.retailerEmail || "another retailer";
        setStatus(`Box ${normalizedBoxId} is assigned to ${recipient}.`);
        setBoxProducts([]);
        return;
      }

      const ids = await getProductIdsByBox(normalizedBoxId);
      const fetched = [];
      for (const id of ids) {
        try {
          const p = await getProduct(id);
          fetched.push({
            productId: p.productId || id,
            name: p.name || "(no name)",
            verifiedByRetailer: !!p.verifiedByRetailer,
            sold: !!p.sold
          });
        } catch {
          fetched.push({
            productId: id,
            name: "(error fetching name)",
            verifiedByRetailer: false,
            sold: false
          });
        }
      }
      setBoxProducts(fetched);
      setStatus(`Box ${normalizedBoxId} — ${fetched.length} product(s) found.`);

      const verifiedCount = fetched.filter((p) => p.verifiedByRetailer).length;
      const soldCount = fetched.filter((p) => p.sold).length;
      setBoxAnalyticsHistory((prev) => {
        const entry = {
          boxId: normalizedBoxId,
          total: fetched.length,
          verified: verifiedCount,
          sold: soldCount,
          timestamp: new Date().toISOString()
        };
        const filtered = prev.filter((item) => item.boxId !== normalizedBoxId);
        return [entry, ...filtered].slice(0, 5);
      });
    } catch (e) {
      console.error(e);
      setStatus("Fetch box failed: " + (e?.message || e));
      setBoxProducts([]);
    }
  };

  const handleVerifyBox = async () => {
    if (!walletConnected) {
      setStatus("Connect wallet first before verifying box.");
      return;
    }
    if (!boxProducts || boxProducts.length === 0) {
      setStatus("No products loaded for this box. Click Search Box first.");
      return;
    }
    if (isBoxAlreadyVerified) {
      setStatus(`Box ${boxId.trim()} is already verified.`);
      return;
    }

    setIsVerifyingBox(true);
    setStatus("");
    try {
      const bid = boxId.trim();
      await verifyBox(bid);

      // Refresh product statuses immediately so UI updates without manual refresh.
      const ids = await getProductIdsByBox(bid);
      const refreshed = [];
      for (const id of ids) {
        try {
          const p = await getProduct(id);
          refreshed.push({
            productId: p.productId || id,
            name: p.name || "(no name)",
            verifiedByRetailer: !!p.verifiedByRetailer,
            sold: !!p.sold
          });
        } catch {
          refreshed.push({
            productId: id,
            name: "(error fetching name)",
            verifiedByRetailer: false,
            sold: false
          });
        }
      }
      setBoxProducts(refreshed);
      setStatus(`All ${refreshed.length} product(s) verified for box ${bid}.`);
      await loadRetailerShipments();
    } catch (e) {
      console.error(e);
      setStatus("Verify box failed: " + (e?.message || e));
    } finally {
      setIsVerifyingBox(false);
    }
  };

  const handleVerifyProduct = async () => {
    setScanResult(null);
    setStatus("");
    setIsVerifyingProduct(true);

    try {
      const pid = (scanProductId || "").trim();
      if (!pid) {
        setStatus("Enter Product ID to verify.");
        setIsVerifyingProduct(false);
        return;
      }
      const p = await getProduct(pid);
      if (!p || !p.productId) {
        setStatus("Product not found on chain.");
        setIsVerifyingProduct(false);
        return;
      }

      setScanResult({
        ok: true,
        message: "Product exists on blockchain and is genuine.",
        product: p
      });
      setStatus("✅ Genuine product found.");
    } catch (e) {
      console.error(e);
      setStatus("Product verification failed: " + (e?.message || e));
    } finally {
      setIsVerifyingProduct(false);
    }
  };

  const handleMarkSold = async (productIdToSell) => {
    if (!walletConnected) {
      setStatus("Connect wallet first before marking sold.");
      return;
    }

    const buyerEmail = (saleBuyerEmail || "").trim();
    if (!buyerEmail) {
      setStatus("Enter the buyer's email before marking sold.");
      return;
    }

    try {
      setIsMarkingSold(true);
      setStatus("Marking product sold...");
      await saleComplete(productIdToSell, null, buyerEmail);
      setSaleBuyerEmail("");
      setStatus("Product marked as SOLD on-chain.");
      if (scanResult && scanResult.product && scanResult.product.productId === productIdToSell) {
        const p = await getProduct(productIdToSell);
        setScanResult({ ...scanResult, product: p });
      }
      await loadRetailerShipments();
    } catch (e) {
      console.error(e);
      setStatus("Mark sold failed: " + (e?.message || e));
    } finally {
      setIsMarkingSold(false);
    }
  };

  useEffect(() => {
    loadRetailerShipments();
  }, []);

  return (
    <div className="retailer-page">
      <BackButton to="/roles" />
      <aside className="retailer-sidebar">
        <div className="retailer-brand">
          <img src="/bc1.png" alt="TrustChain" />
          <div>
            <h2>TrustChain</h2>
            <p>Retailer Console</p>
          </div>
        </div>

        <button
          className={`retailer-nav ${activeSection === "box" ? "active" : ""}`}
          onClick={() => setActiveSection("box")}
        >
          Verify Box
        </button>
        <button
          className={`retailer-nav ${activeSection === "product" ? "active" : ""}`}
          onClick={() => setActiveSection("product")}
        >
          Product Authenticity
        </button>
        <button
          className={`retailer-nav ${activeSection === "analytics" ? "active" : ""}`}
          onClick={() => setActiveSection("analytics")}
        >
          Retailer Analytics
        </button>

        <div className="retailer-sidebar-foot">
          <button
            className="btn-primary"
            onClick={handleConnect}
            style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
          >
            {walletConnected ? "Connected" : "Connect Wallet"}
          </button>
          {walletConnected && (
            <p className="retailer-wallet-note">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
            </p>
          )}
        </div>
      </aside>

      <main className="retailer-main">
        {activeSection === "box" && (
          <section className="retailer-card">
            <h2>Box Arrival - Scan & Verify</h2>
            <div className="retailer-search-row">
              <input
                className="retailer-input"
                placeholder="Enter / scan Box ID (e.g. BOX123456)"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
              />
              <button className="btn-outline" onClick={handleFetchBox}>
                Search Box
              </button>
              <button
                className="btn-primary"
                onClick={handleVerifyBox}
                disabled={boxProducts.length === 0 || isVerifyingBox || isBoxAlreadyVerified}
              >
                {isVerifyingBox
                  ? "Verifying..."
                  : isBoxAlreadyVerified
                    ? "Already Verified"
                    : `Verify Box (${boxProducts.length})`}
              </button>
            </div>

            {boxProducts.length > 0 && (
              <div className="retailer-list-card">
                <div className="retailer-list-head">
                  <strong>Box {boxId}</strong>
                  <span>{boxProducts.length} product(s)</span>
                </div>
                <ul>
                  {boxProducts.map((p) => (
                    <li key={p.productId}>
                      <div className="retailer-list-text">
                        <span>{p.name}</span>
                        <em>{p.productId}</em>
                      </div>
                      <div className="retailer-list-statuses">
                        <span className={`retailer-pill ${p.sold ? "sold" : p.verifiedByRetailer ? "ok" : "pending"}`}>
                          {p.sold ? "Sold" : p.verifiedByRetailer ? "Verified" : "Pending"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {activeSection === "product" && (
          <section className="retailer-card">
            <h2>Product Authenticity</h2>
            <div className="retailer-search-row">
              <input
                className="retailer-input"
                placeholder="Enter Product ID (e.g. P123456)"
                value={scanProductId}
                onChange={(e) => setScanProductId(e.target.value)}
              />
              <button className="btn-outline" onClick={handleVerifyProduct} disabled={isVerifyingProduct}>
                {isVerifyingProduct ? "Verifying..." : "Verify Product"}
              </button>
            </div>

            {scanResult && (
              <div className="retailer-product-card">
                <div className="retailer-product-media">
                  {scanResult.product?.image ? (
                    <img src={scanResult.product.image} alt={scanResult.product.name} />
                  ) : (
                    <div className="retailer-no-image">No image</div>
                  )}
                </div>

                <div className="retailer-product-body">
                  <h3>{scanResult.product?.name || "(product)"}</h3>
                  <div className="retailer-product-grid">
                    <div><strong>Product ID:</strong> {scanResult.product?.productId}</div>
                    <div><strong>Box ID:</strong> {scanResult.product?.boxId}</div>
                    <div><strong>Manufacturer:</strong> {scanResult.product?.manufacturer}</div>
                    <div><strong>Model:</strong> {scanResult.product?.modelNumber}</div>
                    <div><strong>Serial:</strong> {scanResult.product?.serialNumber}</div>
                    <div><strong>Price:</strong> ₹{scanResult.product?.price}</div>
                  </div>

                  <div className="retailer-status-row">
                    <span className={`status-banner ${scanResult.product?.shipped ? "status-success" : "status-warning"}`}>
                      Shipped: {scanResult.product?.shipped ? "Yes" : "No"}
                    </span>
                    <span className={`status-banner ${scanResult.product?.verifiedByRetailer ? "status-success" : "status-warning"}`}>
                      Verified: {scanResult.product?.verifiedByRetailer ? "Yes" : "No"}
                    </span>
                    <span className={`status-banner ${scanResult.product?.sold ? "status-error" : "status-info"}`}>
                      Sold: {scanResult.product?.sold ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="retailer-auth-check">
                    {scanResult.ok ? (
                      <div className="retailer-ok">✔ Genuine Product</div>
                    ) : (
                      <div className="retailer-bad">✖ Not authentic</div>
                    )}
                    <small>{scanResult.message}</small>
                  </div>

                  {scanResult.ok && !scanResult.product?.sold && scanResult.product?.shipped && scanResult.product?.verifiedByRetailer && (
                    <div className="retailer-product-sale-row">
                      <input
                        type="email"
                        className="retailer-input retailer-input-inline"
                        placeholder="Buyer email (required to mark sold)"
                        value={saleBuyerEmail}
                        onChange={(e) => setSaleBuyerEmail(e.target.value)}
                      />
                      <button
                        className="btn-primary retailer-sold-btn"
                        onClick={() => handleMarkSold(scanResult.product.productId)}
                        disabled={isMarkingSold}
                      >
                        {isMarkingSold ? "Marking sold..." : "Mark as Sold (seal broken)"}
                      </button>
                    </div>
                  )}

                  {(!scanResult.product?.sold && scanResult.ok) && !isMarkingSold && !saleBuyerEmail && (
                    <small className="retailer-inline-note">
                      Enter the buyer's email before marking sold.
                    </small>
                  )}
                  {scanResult.ok && scanResult.product?.sold && (
                    <div className="status-banner status-warning retailer-inline-note">
                      This product is already sold.
                    </div>
                  )}

                  {scanResult.ok && !scanResult.product?.sold && (!scanResult.product?.shipped || !scanResult.product?.verifiedByRetailer) && (
                    <div className="status-banner status-warning retailer-inline-note">
                      Product can be sold only after shipping and retailer verification.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeSection === "analytics" && (
          <section className="retailer-card retailer-analytics-card">
            <div className="retailer-analytics-head">
              <div>
                <h2>Retailer Analytics</h2>
                <p>Track your verification performance and recent box scans without leaving the retailer console.</p>
              </div>
            </div>

            <div className="retailer-analytics-grid">
              <div className="retailer-analytics-kpi">
                <span>Last Box Scanned</span>
                <strong>{lastScanEntry ? lastScanEntry.boxId : "Awaiting first scan"}</strong>
                <small>{lastScanEntry ? `${lastScanEntry.total} product(s)` : "Search a box to begin capturing metrics"}</small>
              </div>
              <div className="retailer-analytics-kpi">
                <span>Last Verified Rate</span>
                <strong>
                  {lastScanEntry ? `${lastScanEntry.verified}/${lastScanEntry.total}` : "—"}
                </strong>
                <small>{lastScanEntry ? `${lastScanVerifiedRate.toFixed(0)}% verified` : ""}</small>
              </div>
              <div className="retailer-analytics-kpi">
                <span>Current Box Sold</span>
                <strong>{boxProducts.length ? `${currentSoldCount}` : "—"}</strong>
                <small>
                  {boxProducts.length
                    ? `${currentSoldCount} sold • ${currentPendingCount} pending`
                    : "Load a box to track sales"}
                </small>
              </div>
              <div className="retailer-analytics-kpi">
                <span>History Sold Rate</span>
                <strong>{analyticsTotals.total ? `${historySoldRate.toFixed(1)}%` : "—"}</strong>
                <small>{analyticsTotals.total ? `${analyticsTotals.sold} of ${analyticsTotals.total} tracked` : "No scans logged yet"}</small>
              </div>
            </div>

            <div className="retailer-analytics-history">
              <h4>Recent Box Scans</h4>
              {recentScans.length ? (
                <ul>
                  {recentScans.map((entry) => (
                    <li key={entry.timestamp}>
                      <div className="retailer-analytics-history-row">
                        <span className="retailer-analytics-history-box">{entry.boxId}</span>
                        <span>{entry.total} items</span>
                        <span>{entry.verified} verified</span>
                        <span>{entry.sold} sold</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="retailer-history-placeholder">No scans logged yet—search a box to start building the timeline.</p>
              )}
            </div>

            <div className="retailer-analytics-summary">
              <div className="retailer-analytics-summary-grid">
                <div className="retailer-analytics-summary-card">
                  <span>Boxes delivered</span>
                  <strong>{summaryBoxes}</strong>
                  <small>{summaryBatch !== "—" ? summaryBatch : "Awaiting your first delivery"}</small>
                </div>
                <div className="retailer-analytics-summary-card">
                  <span>Products received</span>
                  <strong>{summaryProducts}</strong>
                  <small>{summaryShipped} shipped • {summarySold} sold</small>
                </div>
                <div className="retailer-analytics-summary-card highlight">
                  <span>Top partner</span>
                  <strong>{summaryTopManufacturer}</strong>
                  <small>{summaryBoxes ? `${summaryBoxes} boxes recorded` : "No boxes yet"}</small>
                </div>
                <div className="retailer-analytics-summary-card highlight">
                  <span>Estimated retail value</span>
                  <strong>₹{formatCurrency(summaryRevenueValue)}</strong>
                  <small>₹1,499 MSRP</small>
                </div>
                <div className="retailer-analytics-summary-card highlight">
                  <span>Potential profit</span>
                  <strong>₹{formatCurrency(summaryProfitValue)}</strong>
                  <small>Assumes 28% margin</small>
                </div>
              </div>
            </div>

            <div className="retailer-inventory-section">
              <div className="retailer-inventory-column">
                <div className="retailer-inventory-heading">
                  <h4>Inventory on hand</h4>
                  <span>{unsoldProducts.length} products</span>
                </div>
                {unsoldProducts.length === 0 ? (
                  <p className="retailer-history-placeholder">No pending stock—verify a box to start counting inventory.</p>
                ) : (
                  <ul className="retailer-inventory-list">
                    {unsoldProducts.slice(0, 6).map((product) => (
                      <li key={`${product.productId}-pending`} className="retailer-inventory-row">
                        <div>
                          <strong>{product.productId}</strong>
                          <small>Box {product.boxId || "—"} · {product.batchId || "—"}</small>
                          <small>Lifecycle: {product.lifecycle}</small>
                        </div>
                        <div className="retailer-inventory-status">
                          <span className={`status-banner ${product.shipped ? "status-success" : "status-warning"}`}>
                            Shipped: {product.shipped ? "Yes" : "No"}
                          </span>
                          <span className={`status-banner ${product.verified ? "status-success" : "status-warning"}`}>
                            Verified: {product.verified ? "Yes" : "No"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="retailer-inventory-column">
                <div className="retailer-inventory-heading">
                  <h4>Sold items</h4>
                  <span>{soldProducts.length} products</span>
                </div>
                {soldProducts.length === 0 ? (
                  <p className="retailer-history-placeholder">No sales yet—mark a product as sold to populate this timeline.</p>
                ) : (
                  <ul className="retailer-inventory-list">
                    {soldProducts.slice(0, 6).map((product) => (
                      <li key={`${product.productId}-sold`} className="retailer-inventory-row">
                        <div>
                          <strong>{product.productId}</strong>
                          <small>
                            Sold to: {product.buyerName || product.soldToEmail || "unknown customer"}
                          </small>
                          <small>Email: {product.soldToEmail || "—"}</small>
                          <small>Sold on {product.soldAt ? formatDateTime(product.soldAt) : "—"}</small>
                        </div>
                        <div className="retailer-inventory-status">
                          <span className="status-banner status-success">Lifecycle: {product.lifecycle}</span>
                          <span className="status-banner status-info">
                            Manufacturer: {product.manufacturerLabel}
                          </span>
                          <span className="retailer-inventory-chip">{product.retailerName}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="retailer-shipment-feed">
              <div className="retailer-shipment-feed-head">
                <h4>Shipment feed</h4>
                {shipmentsLoading && <span className="retailer-shipment-refresh">Refreshing shipment stories…</span>}
              </div>
              {shipmentsLoading ? (
                <p className="products-loading">Loading shipments...</p>
              ) : retailerShipments.length === 0 ? (
                <p className="retailer-history-placeholder">
                  No retailer shipments logged yet—pull a box into this console to begin recording the narrative.
                </p>
              ) : (
                <div className="retailer-shipment-list">
                  {retailerShipments.map((shipment) => {
                    const statusTone =
                      shipment.soldCount === shipment.productCount && shipment.productCount
                        ? "status-success"
                        : shipment.verifiedCount === shipment.productCount && shipment.productCount
                          ? "status-info"
                          : "status-warning";
                    const statusLabel =
                      shipment.soldCount === shipment.productCount && shipment.productCount
                        ? "Fully sold"
                        : shipment.verifiedCount === shipment.productCount && shipment.productCount
                          ? "Verified"
                          : "In transit";
                    return (
                      <article key={`${shipment.boxId}-${shipment.createdAt}`} className="retailer-shipment-card">
                        <header className="retailer-shipment-head">
                          <strong>Box {shipment.boxId}</strong>
                          <span>{formatDateTime(shipment.createdAt)}</span>
                          <span className={`retailer-shipment-status ${statusTone}`}>{statusLabel}</span>
                        </header>
                        <div className="retailer-shipment-meta">
                          <p>Manufacturer: {shipment.manufacturer.label}</p>
                          <p>Retailer: {shipment.retailer?.label || "Retailer"} ({shipment.retailer?.email || "no email"})</p>
                          <p>Batch: {shipment.batchId}</p>
                          <p>Delivery: {shipment.shippingAddress || "TBD"}</p>
                          <p className="retailer-shipment-meta-line">
                            {shipment.productCount} items · {shipment.shippedCount} shipped · {shipment.verifiedCount} verified · {shipment.soldCount} sold
                          </p>
                        </div>
                        <div className="retailer-shipment-products">
                          {shipment.topProducts.map((product) => (
                            <span key={product.productId} className="retailer-shipment-product-pill">
                              <strong>{product.productId}</strong>
                              <em>{product.lifecycle}</em>
                            </span>
                          ))}
                        </div>
                        <div className="retailer-shipment-footer">
                          <strong>Retailer ripple ₹{formatCurrency(shipment.estimatedProfit)}</strong>
                          <small>MSRP ₹1,499 · 28% margin</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="retailer-shipment-footnote">
                *Estimated ripple captures what this batch delivers to your topline—dispatch more to keep the feed glowing.
              </p>
            </div>
          </section>
        )}

        {status && (
          <div className={`status-banner status-${getStatusTone(status)}`}>
            {status}
          </div>
        )}
      </main>
    </div>
  );
};

export default RetailerDashboard;
