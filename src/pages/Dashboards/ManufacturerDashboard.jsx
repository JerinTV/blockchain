import { useEffect, useMemo, useState } from "react";
import {
  connectBlockchain,
  registerBatch,
  shipBox,
  getProduct,
  getProductIdsByBox
} from "../../trustChain";
import "../../index2.css";
import "../../manufacturer.css";
import { fetchManufacturerDashboardSummary, fetchProductDetail } from "../../services/api";

const defaultBatch = {
  batchId: "BATCH-567",
  boxId: "BOX-001",
  batchSize: 5,
  startProductId: "P1001",
  name: "Smartphone X",
  category: "Smartphone",
  manufacturer: "TechCorp Ltd.",
  manufacturerDate: "2025-12-10",
  manufacturePlace: "Bangalore, India",
  modelNumber: "X1000",
  warrantyPeriod: "24 months",
  color: "Black",
  price: 65000,
  image: "/mob.jpg"
};

const getStatusTone = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return "info";
  if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found")) return "error";
  if (text.includes("⚠") || text.includes("required") || text.includes("mismatch")) return "warning";
  if (text.includes("⏳") || text.includes("loading") || text.includes("fetching") || text.includes("registering")) return "info";
  if (text.includes("✅") || text.includes("connected") || text.includes("success")) return "success";
  return "info";
};

const ManufacturerDashboard = () => {
  const [batch, setBatch] = useState(defaultBatch);
  const [status, setStatus] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [activeAction, setActiveAction] = useState("register");
  const [batchCreated, setBatchCreated] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const [boxId, setBoxId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [retailerEmail, setRetailerEmail] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);

  const [searchProductId, setSearchProductId] = useState("");
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [dbProductDetail, setDbProductDetail] = useState(null);

  const formatNumber = (value) =>
    new Intl.NumberFormat("en-IN").format(Number(value || 0));

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const availableBatchIds = useMemo(() => {
    const batches = new Set();
    (dashboardSummary?.recentBoxes || []).forEach((box) => {
      if (box.batchId) {
        batches.add(box.batchId);
      }
    });
    return Array.from(batches);
  }, [dashboardSummary]);

  const loadDashboardSummary = async (batchId) => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const data = await fetchManufacturerDashboardSummary(batchId);
      setDashboardSummary(data);
    } catch (err) {
      setDashboardError(err.message || "Failed to load analytics data");
      setDashboardSummary(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeAction !== "analytics") return;
    loadDashboardSummary(selectedBatchId);
  }, [activeAction, selectedBatchId]);

  useEffect(() => {
    loadDashboardSummary("");
  }, []);

  const summaryTotals = dashboardSummary?.summary || {};
  const totalProducts = summaryTotals.totalProducts || 0;
  const shippedProducts = summaryTotals.shippedProducts || 0;
  const verifiedProducts = summaryTotals.verifiedProducts || 0;
  const soldProducts = summaryTotals.soldProducts || 0;
  const totalBoxes = summaryTotals.totalBoxes || 0;
  const pendingProducts =
    summaryTotals.pendingProducts ?? Math.max(0, totalProducts - soldProducts);
  const recentBoxes = dashboardSummary?.recentBoxes || [];
  const shippedRate = totalProducts ? Math.min(100, (shippedProducts / totalProducts) * 100) : 0;
  const verifiedRate = totalProducts ? Math.min(100, (verifiedProducts / totalProducts) * 100) : 0;
  const soldRate = totalProducts ? Math.min(100, (soldProducts / totalProducts) * 100) : 0;
  const qualityYield = shippedProducts ? Math.min(100, (verifiedProducts / shippedProducts) * 100) : 0;
  const sellThrough = shippedProducts ? Math.min(100, (soldProducts / shippedProducts) * 100) : 0;
  const throughputScore =
    totalProducts && shippedProducts
      ? Math.min(100, ((shippedProducts + verifiedProducts + soldProducts) / (totalProducts * 3)) * 100)
      : 0;
  const averageBoxSize = totalBoxes ? Math.round(totalProducts / totalBoxes) : 0;
  const backlogRate = totalProducts ? Math.min(100, (pendingProducts / totalProducts) * 100) : 0;
  const recentMaxProducts =
    recentBoxes.length > 0 ? Math.max(...recentBoxes.map((box) => box._count?.products || 0), averageBoxSize || 1) : 1;

  const lastRegisteredText = useMemo(() => {
    if (!recentBoxes.length) return "";
    const box = recentBoxes[0];
    return `${box.batchId || "-"} • ${box.boxId} • ${box._count?.products || 0} product(s)`;
  }, [recentBoxes]);

  const handleConnect = async () => {
    try {
      const address = await connectBlockchain();
      setWalletConnected(true);
      setWalletAddress(address || "");
      setStatus(`✅ Wallet connected: ${address || "-"}`);
    } catch (err) {
      console.error(err);
      setWalletAddress("");
      setStatus("❌ Wallet connection failed");
    }
  };

  const handleCreateBatch = async () => {
    if (!walletConnected) {
      setStatus("❌ Connect wallet first before creating/registering a batch.");
      return;
    }
    setStatus("⏳ Registering batch...");

    const result = await registerBatch(batch);

    if (!result.success) {
      setStatus(`❌ ${result.message}`);
      return;
    }

    setBatchCreated(true);
    const start = parseInt(batch.startProductId.replace(/\D/g, ""), 10);
    const end = start + batch.batchSize - 1;

    setStatus(`✅ Batch registered successfully.\nProducts created: P${start} → P${end}`);
    loadDashboardSummary("");
  };

  const handleFetchBox = async () => {
    try {
      setStatus("⏳ Fetching box...");
      const ids = await getProductIdsByBox(boxId);
      const products = [];

      for (const pid of ids) {
        const p = await getProduct(pid);
        products.push(p);
      }

      setBoxProducts(products);
      setStatus(`📦 Box ${boxId} contains ${products.length} products`);
    } catch {
      setBoxProducts([]);
      setStatus("❌ Box not found");
    }
  };

  const handleShipBox = async () => {
    if (!walletConnected) {
      setStatus("❌ Connect wallet first before shipping.");
      return;
    }
    if (!shippingAddress.trim()) {
      setStatus("⚠ Shipping address is required before shipping.");
      return;
    }
    if (!retailerEmail.trim()) {
      setStatus("⚠ Retailer email is required before shipping.");
      return;
    }
    try {
      setStatus("⏳ Shipping box...");
      await shipBox(boxId, null, shippingAddress, retailerEmail.trim());
      setStatus("✅ Box shipped successfully");
    } catch (err) {
      console.error(err);
      setStatus(`❌ Shipping failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleFetchProduct = async () => {
    try {
      setFetchError("");
      const p = await getProduct(searchProductId);
      setFetchedProduct(p);
      try {
        const detail = await fetchProductDetail(searchProductId);
        setDbProductDetail(detail?.product || null);
      } catch (err) {
        console.error("Product detail fetch failed:", err);
        setDbProductDetail(null);
      }
      setStatus("");
    } catch {
      setFetchedProduct(null);
      setFetchError("❌ Product not found");
      setStatus("");
    }
  };

  return (
    <div className="manufacturer-page">
      <aside className="manufacturer-sidebar">
        <div className="manufacturer-brand">
          <img src="/bc1.png" alt="TrustChain" />
          <div>
            <h2>TrustChain</h2>
            <p>Manufacturer Console</p>
          </div>
        </div>

        <button
          className={`manufacturer-nav ${activeAction === "register" ? "active" : ""}`}
          onClick={() => setActiveAction("register")}
        >
          Register Batch
        </button>
        <button
          className={`manufacturer-nav ${activeAction === "ship" ? "active" : ""}`}
          onClick={() => setActiveAction("ship")}
        >
          Ship Box
        </button>
        <button
          className={`manufacturer-nav ${activeAction === "fetch" ? "active" : ""}`}
          onClick={() => setActiveAction("fetch")}
        >
          Fetch Product
        </button>
        <button
          className={`manufacturer-nav ${activeAction === "analytics" ? "active" : ""}`}
          onClick={() => setActiveAction("analytics")}
        >
          Analytics
        </button>

        <div className="manufacturer-sidebar-foot">
          <button
            className="btn-primary"
            onClick={handleConnect}
            style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
          >
            {walletConnected ? "Connected" : "Connect Wallet"}
          </button>
          {walletConnected && (
            <p className="wallet-note">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
            </p>
          )}
          {lastRegisteredText && (
            <p className="wallet-note">Last: {lastRegisteredText}</p>
          )}
        </div>
      </aside>

      <main className="manufacturer-main">
        {activeAction === "register" && (
          <section className="manufacturer-card">
            <h2>Register Batch</h2>

            <div className="product-form" style={{ paddingTop: "1px" }}>
              <h3>Batch Details</h3>
              <div className="form-row" style={{ paddingBottom: "4px" }}>
                <div className="form-group">
                  <label>Batch ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Batch ID"
                    value={batch.batchId}
                    onChange={(e) => setBatch({ ...batch, batchId: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Box ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Box ID"
                    value={batch.boxId}
                    onChange={(e) => setBatch({ ...batch, boxId: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Box Size</label>
                  <input
                    disabled={batchCreated}
                    type="number"
                    placeholder="Batch Size"
                    value={batch.batchSize}
                    onChange={(e) => setBatch({ ...batch, batchSize: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Start Product ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Start Product ID"
                    value={batch.startProductId}
                    onChange={(e) => setBatch({ ...batch, startProductId: e.target.value })}
                  />
                </div>
              </div>

              <h3>Product Template</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Product Name"
                    value={batch.name}
                    onChange={(e) => setBatch({ ...batch, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Category"
                    value={batch.category}
                    onChange={(e) => setBatch({ ...batch, category: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Model Number</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Model Number"
                    value={batch.modelNumber}
                    onChange={(e) => setBatch({ ...batch, modelNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Color"
                    value={batch.color}
                    onChange={(e) => setBatch({ ...batch, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Warranty</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Warranty"
                    value={batch.warrantyPeriod}
                    onChange={(e) => setBatch({ ...batch, warrantyPeriod: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input
                    disabled={batchCreated}
                    type="number"
                    placeholder="Price"
                    value={batch.price}
                    onChange={(e) => setBatch({ ...batch, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                className="btn-primary"
                disabled={batchCreated}
                onClick={handleCreateBatch}
                style={{ marginTop: "16px" }}
              >
                Create & Register Batch
              </button>
            </div>

            {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
          </section>
        )}

        {activeAction === "ship" && (
          <section className="manufacturer-card">
            <h2>Ship Box</h2>
            <div className="manufacturer-register-layout">
              <div className="product-form" style={{ paddingTop: "1px" }}>
                <div className="form-row" style={{ paddingBottom: "4px" }}>
                  <div className="form-group">
                    <label>Box ID</label>
                    <input
                      placeholder="Enter Box ID"
                      value={boxId}
                      onChange={(e) => setBoxId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Shipping Address</label>
                    <input
                      placeholder="Enter shipping address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row" style={{ paddingBottom: "4px" }}>
                  <div className="form-group">
                    <label>Retailer Email</label>
                    <input
                      placeholder="Retailer email"
                      value={retailerEmail}
                      onChange={(e) => setRetailerEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: "12px" }}>
                  <button className="btn-outline" onClick={handleFetchBox}>
                    Fetch Box
                  </button>
                </div>
                {boxProducts.length > 0 && (
                  <div className="form-row" style={{ marginBottom: "12px" }}>
                    <button className="btn-primary" onClick={handleShipBox}>
                      Ship All ({boxProducts.length})
                    </button>
                  </div>
                )}
                {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
              </div>

              <div className="manufacturer-history-card">
                <h3>Active Chain Inventory</h3>
                {!recentBoxes.length && <p>No synced boxes found on the current deployment.</p>}
                {recentBoxes.map((box) => (
                  <div className="manufacturer-history-item" key={`${box.boxId}-${box.createdAt}`}>
                    <strong>{box.batchId || "-"}</strong>
                    <span>Box: {box.boxId}</span>
                    <span>Products: {box._count?.products || 0}</span>
                    <span>{formatDate(box.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeAction === "analytics" && (
          <section className="manufacturer-card manufacturer-analytics-card">
            <div className="manufacturer-analytics-head">
              <div>
                <h2>Production Analytics</h2>
                <p className="manufacturer-analytics-subtitle">
                  {selectedBatchId ? `Batch ${selectedBatchId}` : "Overview of every batch you registered"}
                </p>
              </div>
              <div className="manufacturer-analytics-filter">
                <label htmlFor="manufacturer-analytics-batch">Batch</label>
                <select
                  id="manufacturer-analytics-batch"
                  className="login-input"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  <option value="">All batches</option>
                  {availableBatchIds.map((batchId) => (
                    <option key={batchId} value={batchId}>{batchId}</option>
                  ))}
                </select>
              </div>
            </div>

            {dashboardLoading ? (
              <p className="products-loading">Loading analytics...</p>
            ) : (
              <>
                <div className="manufacturer-analytics-grid">
                  <div className="manufacturer-analytics-kpi">
                    <span>Manufactured</span>
                    <strong>{formatNumber(totalProducts)}</strong>
                    <small>{formatNumber(totalBoxes)} boxes</small>
                  </div>
                  <div className="manufacturer-analytics-kpi">
                    <span>Shipped</span>
                    <strong>{formatNumber(shippedProducts)}</strong>
                    <small>{shippedRate.toFixed(1)}% of factory output</small>
                  </div>
                  <div className="manufacturer-analytics-kpi">
                    <span>Verified</span>
                    <strong>{formatNumber(verifiedProducts)}</strong>
                    <small>Quality checks completed</small>
                  </div>
                  <div className="manufacturer-analytics-kpi">
                    <span>Sold</span>
                    <strong>{formatNumber(soldProducts)}</strong>
                    <small>{soldRate.toFixed(1)}% sold</small>
                  </div>
                  <div className="manufacturer-analytics-kpi">
                    <span>Pending</span>
                    <strong>{formatNumber(pendingProducts)}</strong>
                    <small>Awaiting retail sync</small>
                  </div>
                </div>

                <div className="manufacturer-analytics-insights">
                  <article className="manufacturer-insight-card">
                    <span>Quality yield</span>
                    <strong>{qualityYield.toFixed(1)}%</strong>
                    <small>Verified / shipped</small>
                  </article>
                  <article className="manufacturer-insight-card">
                    <span>Sell-through</span>
                    <strong>{sellThrough.toFixed(1)}%</strong>
                    <small>Sold / shipped</small>
                  </article>
                  <article className="manufacturer-insight-card">
                    <span>Throughput score</span>
                    <strong>{throughputScore.toFixed(1)}%</strong>
                    <small>Goal: move product fast</small>
                  </article>
                  <article className="manufacturer-insight-card">
                    <span>Average box size</span>
                    <strong>{formatNumber(averageBoxSize)}</strong>
                    <small>Products per box</small>
                  </article>
                  <article className="manufacturer-insight-card">
                    <span>Pending backlog</span>
                    <strong>{formatNumber(pendingProducts)}</strong>
                    <small>{backlogRate.toFixed(1)}% pending</small>
                  </article>
                </div>

                <div className="manufacturer-analytics-progress">
                  <div className="manufacturer-analytics-progress-row">
                    <div>
                      <strong>Shipped vs Manufactured</strong>
                      <small>
                        {formatNumber(shippedProducts)} / {formatNumber(totalProducts)} shipped
                      </small>
                    </div>
                    <div className="manufacturer-analytics-progress-track">
                      <i style={{ width: `${shippedRate}%` }} />
                    </div>
                  </div>
                  <div className="manufacturer-analytics-progress-row">
                    <div>
                      <strong>Verified coverage</strong>
                      <small>
                        {formatNumber(verifiedProducts)} / {formatNumber(totalProducts)} verified
                      </small>
                    </div>
                    <div className="manufacturer-analytics-progress-track">
                      <i style={{ width: `${verifiedRate}%` }} />
                    </div>
                  </div>
                  <div className="manufacturer-analytics-progress-row">
                    <div>
                      <strong>Sell-through</strong>
                      <small>
                        {formatNumber(soldProducts)} / {formatNumber(totalProducts)} sold
                      </small>
                    </div>
                    <div className="manufacturer-analytics-progress-track">
                      <i style={{ width: `${soldRate}%` }} />
                    </div>
                  </div>
                </div>

                <div className="manufacturer-analytics-trend">
                  <h4>Recent box volume</h4>
                  <div className="manufacturer-analytics-trend-bars">
                    {recentBoxes.length === 0 && <p className="products-loading">Waiting for boxes to sync...</p>}
                    {recentBoxes.map((box) => {
                      const productCount = box._count?.products || 0;
                      const widthPercent = Math.max(
                        8,
                        Math.round((productCount / (recentMaxProducts || 1)) * 100)
                      );
                      return (
                        <div key={`${box.boxId}-${box.createdAt}`} className="manufacturer-analytics-trend-bar">
                          <div className="manufacturer-analytics-trend-row">
                            <span>{box.boxId}</span>
                            <span>{formatDate(box.createdAt)}</span>
                          </div>
                          <div className="manufacturer-analytics-trend-track">
                            <i style={{ width: `${widthPercent}%` }} />
                          </div>
                          <small>{formatNumber(productCount)} products</small>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="manufacturer-analytics-recent">
                  <h4>Recent Boxes</h4>
                  {recentBoxes.length === 0 && (
                    <p className="products-loading">No boxes synced yet.</p>
                  )}
                  {recentBoxes.map((box) => (
                    <div key={`${box.boxId}-${box.createdAt}`} className="manufacturer-analytics-box">
                      <div>
                        <strong>{box.boxId}</strong>
                        <span>Batch {box.batchId || "-"}</span>
                      </div>
                      <div className="manufacturer-analytics-box-meta">
                        <span>{formatNumber(box._count?.products || 0)} products</span>
                        <span>{formatDate(box.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {dashboardError && (
              <div className="status-banner status-error" style={{ marginTop: "12px" }}>
                {dashboardError}
              </div>
            )}
          </section>
        )}

        {activeAction === "fetch" && (
          <section className="manufacturer-card">
            <h2>Fetch Product</h2>
            <div className="product-form" style={{ paddingTop: "1px" }}>
              <div className="form-row" style={{ paddingBottom: "4px" }}>
                <div className="form-group">
                  <label>Product ID</label>
                  <input
                    placeholder="Enter Product ID"
                    value={searchProductId}
                    onChange={(e) => setSearchProductId(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: "12px" }}>
                <button className="btn-outline" onClick={handleFetchProduct}>
                  Fetch
                </button>
              </div>
              {fetchError && <div className="status-banner status-error">{fetchError}</div>}
              {fetchedProduct && (
                <div className="manufacturer-product-card">
                  <div className="manufacturer-product-media">
                    <img src={fetchedProduct.image || "/mob.jpg"} alt={fetchedProduct.name || "Product"} />
                  </div>
                  <div className="manufacturer-product-body">
                    <h3>{fetchedProduct.name || "Unnamed Product"}</h3>
                    <div className="manufacturer-product-grid">
                      <div><strong>Product ID:</strong> {fetchedProduct.productId || "-"}</div>
                      <div><strong>Batch ID:</strong> {fetchedProduct.batchNumber || "-"}</div>
                      <div><strong>Box ID:</strong> {fetchedProduct.boxId || "-"}</div>
                      <div><strong>Manufacturer:</strong> {fetchedProduct.manufacturer || "-"}</div>
                      <div><strong>Model Number:</strong> {fetchedProduct.modelNumber || "-"}</div>
                      <div><strong>Serial Number:</strong> {fetchedProduct.serialNumber || "-"}</div>
                      <div><strong>Warranty:</strong> {fetchedProduct.warrantyPeriod || "-"}</div>
                      <div><strong>Price:</strong> {fetchedProduct.price || "-"}</div>
                    </div>
                  <div className="manufacturer-status-row">
                    <span className={`status-banner ${fetchedProduct.shipped ? "status-success" : "status-warning"}`}>Shipped: {fetchedProduct.shipped ? "Yes" : "No"}</span>
                    <span className={`status-banner ${fetchedProduct.verifiedByRetailer ? "status-success" : "status-warning"}`}>Verified: {fetchedProduct.verifiedByRetailer ? "Yes" : "No"}</span>
                    <span className={`status-banner ${fetchedProduct.sold ? "status-error" : "status-info"}`}>Sold: {fetchedProduct.sold ? "Yes" : "No"}</span>
                  </div>
                  {dbProductDetail && (
                    <div className="manufacturer-product-meta">
                      <div><strong>Retailer:</strong> {dbProductDetail.box?.retailer?.username || dbProductDetail.box?.retailerEmail || "–"}</div>
                      <div><strong>Retailer email:</strong> {dbProductDetail.box?.retailer?.email || dbProductDetail.box?.retailerEmail || "–"}</div>
                      <div><strong>Shipping address:</strong> {dbProductDetail.box?.shippingAddress || "TBD"}</div>
                      <div><strong>Sold to:</strong> {dbProductDetail.soldToEmail || "Not sold yet"}</div>
                      <div><strong>Sold at:</strong> {formatDate(dbProductDetail.soldAt)}</div>
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ManufacturerDashboard;
