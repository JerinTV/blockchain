// src/components/ManufacturerDashboard.jsx

import { useEffect, useState } from "react";
import {
  registerBatch,
  shipBox,
  getRecentHistory,
  getBoxDetails,
  getProductDetails
} from "../../trustChain";

import {
  FaBoxes,
  FaTruck,
  FaSearch,
  FaCube,
  FaPalette,
  FaTag,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaMobileAlt,
  FaIdBadge,
  FaInfoCircle,
  FaCheckCircle,
  FaMoneyBillWave,
  FaTimesCircle,
  FaCopy,
  FaCheck,
  FaQrcode,
  FaClipboardCheck,
  FaShieldAlt,
  FaShoppingCart
} from "react-icons/fa";

import "../../dash.css";
import BackButton from "../../components/BackButton";

/* ================= DEFAULT DATA ================= */

const defaultBatch = {
  batchId: "BATCH-567",
  boxId: "BOX-001",
  batchSize: 5,
  startProductId: "P1000",

  name: "Smartphone X",
  category: "Smartphone",
  modelNumber: "X1000",
  color: "Black",
  warrantyPeriod: "24 months",
  price: 65000,
  manufacturerDate: new Date().toISOString().slice(0, 10),
  manufacturePlace: "Kochi",

  retailerName: "Smart Retail Pvt Ltd",
  retailerLocation: "Kochi"
};

export default function ManufacturerDashboard() {
  const loggedInManufacturerId =
    localStorage.getItem("manufacturerId") ||
    localStorage.getItem("authEmail") ||
    "MFG-102";

  const [batch, setBatch] = useState({
    ...defaultBatch,
    manufacturerId: loggedInManufacturerId,
    manufacturer: loggedInManufacturerId
  });
  const [activeAction, setActiveAction] = useState("register");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerStatus, setRegisterStatus] = useState("");

  const [boxId, setBoxId] = useState("");
  const [boxDetails, setBoxDetails] = useState(null);
  const [recentBoxes, setRecentBoxes] = useState([]);

  const [searchProductId, setSearchProductId] = useState("");
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [boxSecretCopied, setBoxSecretCopied] = useState(false);
  const [productSecretCopied, setProductSecretCopied] = useState(false);

  const loadRecentHistory = async () => {
    try {
      const history = await getRecentHistory(batch.manufacturerId);
      setRecentBoxes(history.boxes || []);
    } catch {
      setRecentBoxes([]);
    }
  };

  useEffect(() => {
    loadRecentHistory();
  }, []);

  /* ================= REGISTER ================= */
  const handleCreateBatch = async () => {
    setRegisterStatus("");
    if (!String(batch.batchId || "").trim()) {
      const msg = "Batch ID is required";
      setRegisterStatus(msg);
      alert(msg);
      return;
    }
    if (!String(batch.boxId || "").trim()) {
      const msg = "Box ID is required";
      setRegisterStatus(msg);
      alert(msg);
      return;
    }
    if (!String(batch.startProductId || "").trim()) {
      const msg = "Start Product ID is required";
      setRegisterStatus(msg);
      alert(msg);
      return;
    }
    if (!Number.isInteger(Number(batch.batchSize || 0)) || Number(batch.batchSize || 0) <= 0) {
      const msg = "Batch size must be a positive integer";
      setRegisterStatus(msg);
      alert(msg);
      return;
    }
    if (!String(batch.retailerName || "").trim() || !String(batch.retailerLocation || "").trim()) {
      const msg = "Retailer ID and Retailer Location are required";
      setRegisterStatus(msg);
      alert(msg);
      return;
    }
    setIsRegistering(true);

    try {
      const payload = {
        ...batch,
        manufacturer: batch.manufacturerId
      };

      const result = await registerBatch(payload);
      setRegisterStatus(
        `Batch registered from ${result.startProductId}. ${result.itemsCount} products synced to backend and blockchain.`
      );
      await loadRecentHistory();
      alert("Batch registered successfully.");
    } catch (err) {
      const message = err?.message || "Batch registration failed";
      setRegisterStatus(message);
      alert(message);
    } finally {
      setIsRegistering(false);
    }
  };

  /* ================= SHIP ================= */

  const handleFetchBox = async () => {
    try {
      setBoxSecretCopied(false);
      const details = await getBoxDetails(boxId);
      setBoxDetails(details);
    } catch (err) {
      setBoxDetails(null);
      alert(err?.message || "Failed to fetch box details");
    }
  };

  const handleShipBox = async () => {
    if (!boxDetails) {
      alert("Fetch a valid box first.");
      return;
    }
    try {
      await shipBox(boxId);
      await loadRecentHistory();
      const details = await getBoxDetails(boxId);
      setBoxDetails(details);
      alert("Shipped");
    } catch (err) {
      alert(err?.message || "Failed to ship box");
    }
  };

  /* ================= FETCH PRODUCT ================= */

  const handleFetchProduct = async () => {
    setFetchError("");
    setProductSecretCopied(false);
    try {
      const p = await getProductDetails(searchProductId);
      setFetchedProduct(p);
    } catch (err) {
      setFetchedProduct(null);
      setFetchError(err?.message || "Product not found");
    }
  };

  const handleCopyBoxSecret = async () => {
    try {
      const secret = boxDetails?.boxSecret;
      if (!secret) {
        setBoxSecretCopied(false);
        return;
      }
      await navigator.clipboard.writeText(secret);
      setBoxSecretCopied(true);
      setTimeout(() => setBoxSecretCopied(false), 1800);
    } catch {
      setBoxSecretCopied(false);
    }
  };

  const handleCopyProductSecret = async () => {
    try {
      const secret = fetchedProduct?.productSecret;
      if (!secret) {
        setProductSecretCopied(false);
        return;
      }
      await navigator.clipboard.writeText(secret);
      setProductSecretCopied(true);
      setTimeout(() => setProductSecretCopied(false), 1800);
    } catch {
      setProductSecretCopied(false);
    }
  };

  const recentHistoryRows = recentBoxes.flatMap((b) => {
    const rows = [{ key: `${b.boxCode}-registered`, boxCode: b.boxCode, status: "Registered" }];
    if (b.shipped) {
      rows.unshift({ key: `${b.boxCode}-shipped`, boxCode: b.boxCode, status: "Shipped" });
    }
    return rows;
  });

  return (
    <div className="dashboard manufacturer-theme">
      <BackButton to="/login/manufacturer" />

      {/* SIDEBAR */}
      <div className="sidebar">

        <div className="sidebar-brand">
          <img src="/bc1.png" alt="TrustChain Logo" className="sidebar-brand-logo" />
          <h2 className="logo-gradient">TrustChain</h2>
        </div>

        {/* PROFILE */}
        <div className="profile-card">
          <div className="profile-avatar">
            {(batch.manufacturerId || "M")[0].toUpperCase()}
          </div>
          <div className="profile-meta">
            <div className="profile-name">Manufacturer</div>
            <div className="profile-id">ID: {batch.manufacturerId}</div>
          </div>
        </div>

        <div
          className={`sidebar-btn ${activeAction==="register"?"active":""}`}
          onClick={()=>setActiveAction("register")}
        >
          <FaBoxes/> Register Batch
        </div>

        <div
          className={`sidebar-btn ${activeAction==="ship"?"active":""}`}
          onClick={()=>setActiveAction("ship")}
        >
          <FaTruck/> Ship Box
        </div>

        <div
          className={`sidebar-btn ${activeAction==="fetch"?"active":""}`}
          onClick={()=>setActiveAction("fetch")}
        >
          <FaSearch/> Fetch Product
        </div>

      </div>

      {/* RIGHT PANEL */}
      <div className="dashboard-right">

        {/* REGISTER BATCH */}
        {activeAction==="register" && (
          <div className="premium-card">

            <h2 className="section-title"><FaBoxes/> Register Batch</h2>

            <div className="register-layout">
              <div className="register-row register-row-4">
                <FormInput label="Batch No" icon={<FaCube/>}
                  value={batch.batchId}
                  onChange={(v)=>setBatch({...batch,batchId:v})}
                />

                <FormInput label="Box No" icon={<FaBoxes/>}
                  value={batch.boxId}
                  onChange={(v)=>setBatch({...batch,boxId:v})}
                />

                <FormInput label="Starting Product ID" icon={<FaCube/>}
                  value={batch.startProductId}
                  onChange={(v)=>setBatch({...batch,startProductId:v})}
                />

                <FormInput
                  label="No. of Products"
                  icon={<FaBoxes/>}
                  type="number"
                  value={batch.batchSize}
                  onChange={(v)=>setBatch({...batch,batchSize:Number(v) || 0})}
                />
              </div>

              <div className="register-row register-row-3">
                <FormInput
                  label="Manufacturing Date"
                  icon={<FaCalendarAlt/>}
                  type="date"
                  value={batch.manufacturerDate}
                  onChange={(v)=>setBatch({...batch,manufacturerDate:v})}
                />

                <FormInput label="Manufacturer ID" icon={<FaTag/>}
                  value={batch.manufacturerId}
                  onChange={(v)=>setBatch({...batch,manufacturerId:v,manufacturer:v})}
                />

                <FormInput label="Manufactured Location" icon={<FaMapMarkerAlt/>}
                  value={batch.manufacturePlace}
                  onChange={(v)=>setBatch({...batch,manufacturePlace:v})}
                />
              </div>

              <div className="register-row register-row-3">
                <FormInput label="Product Name" icon={<FaTag/>}
                  value={batch.name}
                  onChange={(v)=>setBatch({...batch,name:v})}
                />

                <FormInput label="Model Number" icon={<FaTag/>}
                  value={batch.modelNumber}
                  onChange={(v)=>setBatch({...batch,modelNumber:v})}
                />

                {/* COLOR DROPDOWN */}
                <div className="form-group">
                  <label>Color</label>
                  <div className="input-icon">
                    <FaPalette/>
                    <select
                      value={batch.color}
                      onChange={(e)=>setBatch({...batch,color:e.target.value})}
                    >
                      <option>Black</option>
                      <option>White</option>
                      <option>Blue</option>
                      <option>Red</option>
                      <option>Silver</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="register-row register-row-2">
                <FormInput label="Warranty" icon={<FaTag/>}
                  value={batch.warrantyPeriod}
                  onChange={(v)=>setBatch({...batch,warrantyPeriod:v})}
                />

                <FormInput label="Price" icon={<FaTag/>}
                  value={batch.price}
                  onChange={(v)=>setBatch({...batch,price:v})}
                />
              </div>

              <div className="register-row register-row-2">
                <FormInput label="Retailer Name" icon={<FaTag/>}
                  value={batch.retailerName}
                  onChange={(v)=>setBatch({...batch,retailerName:v})}
                />

                <FormInput label="Retailer Location" icon={<FaMapMarkerAlt/>}
                  value={batch.retailerLocation}
                  onChange={(v)=>setBatch({...batch,retailerLocation:v})}
                />
              </div>
            </div>

            <div className="center-btn">
              <button
                className="btn-primary btn-register-batch"
                onClick={handleCreateBatch}
                disabled={isRegistering}
              >
                {isRegistering ? "Registering..." : "Register Batch"}
              </button>
            </div>
            {registerStatus && <p className="register-status">{registerStatus}</p>}

          </div>
        )}

        {/* SHIP BOX */}
        {activeAction==="ship" && (
          <div className="premium-card">

            <h2 className="section-title"><FaTruck/> Ship Box</h2>

            <div className="ship-layout">
              <div>
                <div className="ship-search-row">
                  <input
                    className="search-inline-input ship-search-input"
                    placeholder="Enter Box ID"
                    value={boxId}
                    onChange={(e)=>setBoxId(e.target.value)}
                  />
                  <button className="btn-primary fetch-btn-inline ship-fetch-btn" onClick={handleFetchBox}>
                    Fetch Box
                  </button>
                </div>

                {boxDetails && (
                  <div className="box-details-card">
                    <h3>Box Details</h3>
                    <div className="box-details-grid">
                      <div className="box-detail-item"><FaCube className="box-detail-icon"/><span><strong>Batch ID:</strong> {boxDetails.batchId}</span></div>
                      <div className="box-detail-item"><FaBoxes className="box-detail-icon"/><span><strong>Box ID:</strong> {boxDetails.boxId}</span></div>
                      <div className="box-detail-item"><FaBoxes className="box-detail-icon"/><span><strong>Total Products:</strong> {boxDetails.totalProducts}</span></div>
                      <div className="box-detail-item"><FaTag className="box-detail-icon"/><span><strong>Manufacturer ID:</strong> {boxDetails.manufacturerId}</span></div>
                      <div className="box-detail-item"><FaTag className="box-detail-icon"/><span><strong>Retailer ID:</strong> {boxDetails.retailerId || "-"}</span></div>
                      <div className="box-detail-item"><FaMapMarkerAlt className="box-detail-icon"/><span><strong>Manufacture Location:</strong> {boxDetails.manufactureLocation || "-"}</span></div>
                      <div className="box-detail-item"><FaMapMarkerAlt className="box-detail-icon"/><span><strong>Retailer Location:</strong> {boxDetails.retailerLocation || "-"}</span></div>
                      <div className="box-detail-item"><FaClipboardCheck className="box-detail-icon"/><span><strong>Status:</strong> {boxDetails.shipped ? "Shipped" : "Registered"}</span></div>
                    </div>
                    {boxDetails.boxSecret && (
                      <div className="box-secret-premium">
                        <div className="box-secret-premium-head">
                          <span><FaQrcode/> Box Secret ID</span>
                        </div>
                        <div className="box-secret-premium-body">
                          {boxDetails.qrImageUrl && (
                            <img src={boxDetails.qrImageUrl} alt="Box Secret QR" className="box-secret-qr" />
                          )}
                          <div className="box-secret-code-row">
                            <code className="box-secret-premium-value">{boxDetails.boxSecret}</code>
                            <button
                              className={`box-secret-icon-btn ${boxSecretCopied ? "copied" : ""}`}
                              onClick={handleCopyBoxSecret}
                              aria-label={boxSecretCopied ? "Copied" : "Copy Box Secret ID"}
                              title={boxSecretCopied ? "Copied" : "Copy Box Secret ID"}
                            >
                              {boxSecretCopied ? <FaCheck/> : <FaCopy/>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="center-btn">
                      <button
                        className="btn-primary btn-register-batch"
                        onClick={handleShipBox}
                        disabled={!!boxDetails.shipped}
                      >
                        {boxDetails.shipped ? "Already Shipped" : "Ship Box"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="history-panel recent-history-card">
                  <h3>Recent History</h3>
                  {recentHistoryRows.length === 0 && <p className="muted">No history available</p>}
                  {recentHistoryRows.map((row) => (
                    <button
                      key={row.key}
                      className="history-chip history-line"
                      onClick={() => {
                        setBoxId(row.boxCode);
                        setBoxDetails(null);
                      }}
                    >
                      <span>{row.boxCode}</span>
                      <span className={`history-badge ${row.status.toLowerCase()}`}>{row.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FETCH PRODUCT */}
        {activeAction==="fetch" && (
          <div className="premium-card">

            <h2 className="section-title"><FaSearch/> Fetch Product</h2>

            <div className="fetch-search-row">
              <input
                className="search-inline-input fetch-search-input"
                placeholder="Enter Product ID"
                value={searchProductId}
                onChange={(e)=>setSearchProductId(e.target.value)}
              />

              <button className="btn-primary fetch-btn-inline" onClick={handleFetchProduct}>
                Fetch
              </button>
            </div>
            {fetchError && <p className="register-status">{fetchError}</p>}

            {fetchedProduct && (
              <div className="product-card premium-product-card">
                <div className="product-media">
                  <img src={fetchedProduct.image || "/mob.jpg"} alt={fetchedProduct.name || "Product"} />
                </div>
                <div className="product-details-col">
                  <div className="product-info-grid">
                    <div className="detail-item"><FaIdBadge/><span><strong>Product ID:</strong> {fetchedProduct.productId}</span></div>
                    <div className="detail-item"><FaMobileAlt/><span><strong>Name:</strong> {fetchedProduct.name}</span></div>
                    <div className="detail-item"><FaInfoCircle/><span><strong>Model:</strong> {fetchedProduct.modelNumber || "-"}</span></div>
                    <div className="detail-item"><FaPalette/><span><strong>Color:</strong> {fetchedProduct.color || "-"}</span></div>
                    <div className="detail-item"><FaTag/><span><strong>Manufacturer:</strong> {fetchedProduct.manufacturerId || fetchedProduct.manufacturer || "-"}</span></div>
                    <div className="detail-item"><FaMapMarkerAlt/><span><strong>Location:</strong> {fetchedProduct.manufacturePlace || "-"}</span></div>
                    <div className="detail-item"><FaCube/><span><strong>Batch:</strong> {fetchedProduct.batchId || fetchedProduct.batchNumber || "-"}</span></div>
                    <div className="detail-item"><FaBoxes/><span><strong>Box:</strong> {fetchedProduct.boxId || "-"}</span></div>
                    <div className="detail-item"><FaCalendarAlt/><span><strong>Warranty:</strong> {fetchedProduct.warrantyPeriod || "-"}</span></div>
                    <div className="detail-item"><FaMoneyBillWave/><span><strong>Price:</strong> {fetchedProduct.price}</span></div>
                  </div>

                  {fetchedProduct.productSecret && (
                    <div className="box-secret-premium">
                      <div className="box-secret-premium-head">
                        <span><FaShieldAlt/> Product Secret Key</span>
                      </div>
                      <div className="box-secret-code-row">
                        <code className="box-secret-premium-value">{fetchedProduct.productSecret}</code>
                        <button
                          className={`box-secret-icon-btn ${productSecretCopied ? "copied" : ""}`}
                          onClick={handleCopyProductSecret}
                          aria-label={productSecretCopied ? "Copied" : "Copy Product Secret Key"}
                          title={productSecretCopied ? "Copied" : "Copy Product Secret Key"}
                        >
                          {productSecretCopied ? <FaCheck/> : <FaCopy/>}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="status-row">
                    <StatusCard
                      label="Registered"
                      topIcon={<FaClipboardCheck />}
                      ok={!!fetchedProduct.registered}
                    />
                    <StatusCard
                      label="Shipped"
                      topIcon={<FaTruck />}
                      ok={!!fetchedProduct.shipped}
                    />
                    <StatusCard
                      label="Verified"
                      topIcon={<FaShieldAlt />}
                      ok={!!fetchedProduct.verified}
                    />
                    <StatusCard
                      label="Sold"
                      topIcon={<FaShoppingCart />}
                      ok={!!fetchedProduct.sold}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

/* ================= REUSABLE INPUT ================= */

function FormInput({label,icon,value,onChange,type = "text"}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="input-icon">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e)=>onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function StatusIcon({ ok }) {
  return ok ? (
    <FaCheckCircle className="status-icon ok" />
  ) : (
    <FaTimesCircle className="status-icon no" />
  );
}

function StatusCard({ label, topIcon, ok }) {
  return (
    <div className="status-card">
      <div className="status-head">
        <span className="status-top-icon">{topIcon}</span>
        <span>{label}</span>
      </div>
      <StatusIcon ok={ok} />
    </div>
  );
}





