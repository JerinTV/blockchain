import { useState } from "react";
import {
  FaShieldAlt,
  FaSearch,
  FaMobileAlt,
  FaQrcode,
  FaInfoCircle,
  FaTag,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaTruck,
  FaShoppingCart,
  FaBoxes,
  FaCube,
  FaCalendarAlt,
  FaPalette,
  FaMoneyBillWave,
  FaCheckDouble
} from "react-icons/fa";
import { getProductDetails } from "../../trustChain";
import BackButton from "../../components/BackButton";
import "../../dash.css";

export default function UserDashboard() {
  const userId = localStorage.getItem("authEmail") || "User";

  const [activeSection, setActiveSection] = useState("verify");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [product, setProduct] = useState(null);
  const [searching, setSearching] = useState(false);
  const [productId, setProductId] = useState("");

  const searchProductId = productId.trim();
  const isVerified = Boolean(product?.verifiedByRetailer || product?.verified);

  const handleSearchProduct = async () => {
    if (!searchProductId) {
      setStatus("Please enter a Product ID.");
      setStatusTone("error");
      return;
    }

    try {
      setSearching(true);
      setStatus("Searching product details...");
      setStatusTone("info");
      setProduct(null);

      const result = await getProductDetails(searchProductId);
      setProduct(result);
      setStatus("Product details loaded from TrustChain records.");
      setStatusTone("success");
    } catch {
      setStatus("Product not found.");
      setStatusTone("error");
      setProduct(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="dashboard user-theme manufacturer-theme">
      <BackButton to="/login/user" />

      <div className="sidebar">
        <div className="sidebar-brand">
          <img src="/bc1.png" alt="TrustChain Logo" className="sidebar-brand-logo" />
          <h2 className="logo-gradient">TrustChain</h2>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(userId || "U")[0].toUpperCase()}</div>
          <div className="profile-meta">
            <div className="profile-name">User</div>
            <div className="profile-id">ID: {userId}</div>
          </div>
        </div>

        <div
          className={`sidebar-btn ${activeSection === "verify" ? "active" : ""}`}
          onClick={() => setActiveSection("verify")}
        >
          <FaQrcode /> Verify Product
        </div>

        <div
          className={`sidebar-btn ${activeSection === "about" ? "active" : ""}`}
          onClick={() => setActiveSection("about")}
        >
          <FaInfoCircle /> How It Works
        </div>
      </div>

      <div className="dashboard-right user-right">
        {activeSection === "verify" && (
          <div className="premium-card user-verify-card">
            <h2 className="section-title"><FaShieldAlt /> Product Verification Portal</h2>
            <p className="user-subtext">
              Enter a product ID and search complete product details from trusted blockchain-backed records.
            </p>

            <div className="user-highlight-row">
              <span className="user-highlight-chip">Blockchain Traceability</span>
              <span className="user-highlight-chip">Retailer Linked</span>
              <span className="user-highlight-chip">Lifecycle Visibility</span>
            </div>

            <div className="user-verify-row">
              <div className="input-icon user-id-input">
                <FaSearch />
                <input
                  type="text"
                  placeholder="Enter Product ID"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                />
              </div>
              <button
                className="btn-primary fetch-btn-inline user-verify-btn"
                onClick={handleSearchProduct}
                disabled={searching}
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            {status && <div className={`user-status ${statusTone}`}>{status}</div>}

            <div className="user-buy-checklist">
              <h4><FaCheckDouble /> Quick Buyer Checklist</h4>
              <p>Check product ID, verify retailer details, and confirm not already sold before purchase.</p>
            </div>

            {product && (
              <div className="product-card premium-product-card user-product-card">
                <div className="product-media">
                  <div className={`user-product-image-wrap ${product.sold ? "is-sold" : ""}`}>
                    <img src={product.image || "/mob.jpg"} alt={product.name || "Product"} />
                    {product.sold && <img src="/sold.png" alt="Sold Product" className="user-sold-overlay" />}
                  </div>
                  {!product.sold && (
                    <img src="/ver.png" alt="Verified Genuine" className="user-verified-badge-img" />
                  )}
                </div>

                <div className="product-details-col">
                  <div className={`user-result-banner ${product.sold ? "sold" : isVerified ? "verified" : "pending"}`}>
                    {product.sold
                      ? "Status: Previously sold product"
                      : isVerified
                        ? "Status: Verified distribution record"
                        : "Status: Pending full verification"}
                  </div>

                  <div className="product-info-grid">
                    <div className="detail-item"><FaTag /><span><strong>Product ID:</strong> {product.productId || "-"}</span></div>
                    <div className="detail-item"><FaBoxes /><span><strong>Box ID:</strong> {product.boxId || "-"}</span></div>
                    <div className="detail-item"><FaCube /><span><strong>Batch ID:</strong> {product.batchId || "-"}</span></div>
                    <div className="detail-item"><FaMobileAlt /><span><strong>Name:</strong> {product.name || "-"}</span></div>
                    <div className="detail-item"><FaTag /><span><strong>Model:</strong> {product.modelNumber || "-"}</span></div>
                    <div className="detail-item"><FaTag /><span><strong>Serial:</strong> {product.serialNumber || "-"}</span></div>
                    <div className="detail-item"><FaMapMarkerAlt /><span><strong>Manufacturer:</strong> {product.manufacturer || "-"}</span></div>
                    <div className="detail-item"><FaMapMarkerAlt /><span><strong>Manufacture Place:</strong> {product.manufacturePlace || "-"}</span></div>
                    <div className="detail-item"><FaCalendarAlt /><span><strong>Mfg Date:</strong> {product.manufacturerDate || "-"}</span></div>
                    <div className="detail-item"><FaPalette /><span><strong>Color:</strong> {product.color || "-"}</span></div>
                    <div className="detail-item"><FaInfoCircle /><span><strong>Warranty:</strong> {product.warrantyPeriod || "-"}</span></div>
                    <div className="detail-item"><FaTag /><span><strong>Retailer ID:</strong> {product.retailerId || "-"}</span></div>
                    <div className="detail-item"><FaMapMarkerAlt /><span><strong>Retailer Location:</strong> {product.retailerLocation || "-"}</span></div>
                    <div className="detail-item"><FaMoneyBillWave /><span><strong>Price:</strong> Rs {product.price || "-"}</span></div>
                  </div>

                  <div className="status-row user-status-row">
                    <div className="status-card">
                      <div className="status-head"><span className="status-top-icon"><FaTruck /></span><span>Shipped</span></div>
                      {product.shipped ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                    </div>
                    <div className="status-card">
                      <div className="status-head"><span className="status-top-icon"><FaShieldAlt /></span><span>Verified</span></div>
                      {(product.verifiedByRetailer || product.verified) ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                    </div>
                    <div className="status-card">
                      <div className="status-head"><span className="status-top-icon"><FaShoppingCart /></span><span>Sold</span></div>
                      {product.sold ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "about" && (
          <div className="premium-card user-about-card">
            <h2 className="section-title"><FaInfoCircle /> About TrustChain Verification</h2>
            <div className="user-about-list">
              <div className="user-about-item">
                <span className="user-about-icon"><FaTag /></span>
                <h3>1. Product ID Input</h3>
                <p>You enter a product ID to locate the item in blockchain-backed records.</p>
              </div>
              <div className="user-about-item">
                <span className="user-about-icon"><FaSearch /></span>
                <h3>2. Search by Product ID</h3>
                <p>The dashboard fetches complete lifecycle details for the product from trusted records.</p>
              </div>
              <div className="user-about-item">
                <span className="user-about-icon"><FaBoxes /></span>
                <h3>3. Full Transparency</h3>
                <p>View manufacturing, retailer, shipping, verification, and sale status in one place.</p>
              </div>
              <div className="user-about-item">
                <span className="user-about-icon"><FaShieldAlt /></span>
                <h3>4. Transparent Status</h3>
                <p>You can see whether the product is shipped, verified, or already sold before buying.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
