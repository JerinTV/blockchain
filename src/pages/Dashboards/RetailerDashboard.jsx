import React, { useState } from "react";
import {
  getProduct,
  getProductIdsByBox,
  getBoxDetails,
  verifyBox,
  saleComplete,
  getProductDetails,
  markProductSoldInBackend
} from "../../trustChain";
import {
  FaBoxOpen,
  FaSearch,
  FaShieldAlt,
  FaQrcode,
  FaCheckCircle,
  FaTimesCircle,
  FaShoppingCart,
  FaTag,
  FaBoxes,
  FaMobileAlt,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaEye,
  FaPalette,
  FaCube,
  FaCalendarAlt,
  FaClipboardCheck,
  FaTruck
} from "react-icons/fa";
import "../../dash.css";
import BackButton from "../../components/BackButton";

const RetailerDashboard = () => {
  const retailerId =
    localStorage.getItem("retailerId") ||
    localStorage.getItem("authEmail") ||
    "Retailer";

  const [status, setStatus] = useState("");
  const [activeAction, setActiveAction] = useState("verifyBox");

  const [boxId, setBoxId] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);
  const [boxSummary, setBoxSummary] = useState(null);
  const [isVerifyingBox, setIsVerifyingBox] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isViewingProduct, setIsViewingProduct] = useState(false);

  const [scanProductId, setScanProductId] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [isVerifyingSeal, setIsVerifyingSeal] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [saleReceipt, setSaleReceipt] = useState(null);

  const handleFetchBox = async () => {
    setStatus("");
    setBoxProducts([]);
    setBoxSummary(null);
    setSelectedProduct(null);
    try {
      const bid = String(boxId || "").trim();
      if (!bid) {
        setStatus("Enter a Box ID first.");
        return;
      }

      const ids = await getProductIdsByBox(bid);
      const products = await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await getProduct(id);
            return {
              productId: p.productId || id,
              name: p.name || "(no name)",
              verifiedByRetailer: !!p.verifiedByRetailer,
              sold: !!p.sold
            };
          } catch {
            return { productId: id, name: "(fetch failed)", verifiedByRetailer: false, sold: false };
          }
        })
      );

      const summary = await getBoxDetails(bid).catch(() => null);
      setBoxSummary(summary);
      setBoxProducts(products);
    } catch (e) {
      setStatus("Fetch box failed: " + (e?.message || e));
    }
  };

  const handleVerifyBox = async () => {
    if (!boxProducts.length) {
      setStatus("No products loaded. Search by Box ID first.");
      return;
    }
    setIsVerifyingBox(true);
    setStatus("");
    try {
      const bid = String(boxId || "").trim();
      const verifyResult = await verifyBox(bid);

      // Refresh box + product statuses after successful verify sync.
      const summary = await getBoxDetails(bid).catch(() => null);
      const refreshed = await Promise.all(
        boxProducts.map(async (x) => {
          try {
            const p = await getProduct(x.productId);
            return {
              productId: p.productId || x.productId,
              name: p.name || x.name,
              verifiedByRetailer: !!p.verifiedByRetailer,
              sold: !!p.sold
            };
          } catch {
            return x;
          }
        })
      );
      setBoxSummary(summary);
      setBoxProducts(refreshed);
      if (verifyResult?.alreadyVerified) {
        setStatus(`Box ${bid} is already verified. Status refreshed.`);
      } else if (verifyResult?.backendSynced) {
        setStatus(`Verification completed for box ${bid}. All statuses synced.`);
      } else {
        setStatus(`Verification completed for box ${bid}. Blockchain updated.`);
      }
    } catch (e) {
      setStatus("Verify box failed: " + (e?.message || e));
    } finally {
      setIsVerifyingBox(false);
    }
  };

  const handleViewProduct = async (productId) => {
    setStatus("");
    if (selectedProduct?.productId === productId) {
      setSelectedProduct(null);
      return;
    }
    setIsViewingProduct(true);
    try {
      const p = await getProduct(productId);
      setSelectedProduct(p);
    } catch (e) {
      setSelectedProduct(null);
      setStatus("View product failed: " + (e?.message || e));
    } finally {
      setIsViewingProduct(false);
    }
  };

  const handleVerifySeal = async () => {
    const pid = String(scanProductId || "").trim();
    setSaleReceipt(null);
    setBuyerEmail("");
    setScanResult(null);
    setStatus("");
    setIsVerifyingSeal(true);
    try {
      const provided = String(secretKeyInput || "").trim();
      if (!pid) {
        setStatus("Enter Product ID.");
        return;
      }
      if (!provided) {
        setStatus("Enter product secret key.");
        return;
      }

      const details = await getProductDetails(pid);
      const chain = await getProduct(pid).catch(() => null);
      const expectedSecret = String(details?.productSecret || "").trim();
      if (!expectedSecret) {
        setStatus("No product secret available for this product.");
        return;
      }
      const matched = expectedSecret.toLowerCase() === provided.toLowerCase();

      const mergedProduct = {
        ...details,
        shipped: Boolean(chain?.shipped || details?.shipped),
        verifiedByRetailer: Boolean(chain?.verifiedByRetailer || details?.verified),
        sold: Boolean(chain?.sold || details?.sold),
        manufacturer: details?.manufacturerId || chain?.manufacturer || "-"
      };

      setScanResult({
        ok: matched,
        message: matched
          ? "Secret key matches this product. Product is genuine."
          : "Product is FAKE. The entered secret key does not match this product.",
        product: mergedProduct
      });
    } catch (e) {
      const message = String(e?.message || e || "");
      if (message.toLowerCase().includes("product not found")) {
        setScanResult({
          ok: false,
          message: "Product is FAKE. Product ID was not found in TrustChain records.",
          product: {
            productId: pid || "-",
            boxId: "-",
            batchId: "-",
            name: "-",
            modelNumber: "-",
            manufacturer: "-",
            manufacturerDate: "-",
            serialNumber: "-",
            color: "-",
            warrantyPeriod: "-",
            retailerId: "-",
            retailerLocation: "-",
            price: "-",
            shipped: false,
            verifiedByRetailer: false,
            sold: false
          }
        });
        setStatus("");
      } else {
        setStatus("Seal verification failed: " + message);
      }
    } finally {
      setIsVerifyingSeal(false);
    }
  };

  const handleMarkSold = async (productIdToSell) => {
    try {
      const email = String(buyerEmail || "").trim();
      if (!email) {
        setStatus("Enter buyer email before selling.");
        return;
      }
      setStatus("Marking as sold...");

      let saleTxHash = "";
      let soldOnChain = false;

      try {
        const saleTx = await saleComplete(productIdToSell);
        saleTxHash = saleTx?.txHash || "";
        soldOnChain = true;
      } catch (chainErr) {
        const chainMessage = String(chainErr?.message || chainErr || "");
        // If already sold on-chain, continue with backend sync/email.
        if (!chainMessage.toLowerCase().includes("already sold")) {
          throw chainErr;
        }
        soldOnChain = true;
      }

      try {
        const backendResult = await markProductSoldInBackend({
          productId: productIdToSell,
          buyerEmail: email,
          txHash: saleTxHash
        });
        setSaleReceipt(backendResult?.sale || null);
        setStatus(
          backendResult?.email?.sent
            ? "Product sold and confirmation email sent."
            : `Product sold. Email not sent: ${backendResult?.email?.reason || "Email service not configured"}`
        );
      } catch (backendErr) {
        const backendMessage = String(backendErr?.message || backendErr || "Backend sync failed");
        if (soldOnChain) {
          setStatus(`Product sold on-chain. Backend sync/email pending: ${backendMessage}`);
        } else {
          throw backendErr;
        }
      }

      if (scanResult?.product?.productId === productIdToSell) {
        const p = await getProductDetails(productIdToSell);
        setScanResult((prev) => ({ ...prev, product: p }));
      }
    } catch (e) {
      setStatus("Mark sold failed: " + (e?.message || e));
    }
  };

  const verifiedProductsCount = boxProducts.filter((p) => p.verifiedByRetailer).length;
  const pendingProductsCount = Math.max(boxProducts.length - verifiedProductsCount, 0);

  return (
    <div className="dashboard retailer-theme manufacturer-theme">
      <BackButton to="/login/retailer" />
      <div className="sidebar">
        <div className="sidebar-brand">
          <img src="/bc1.png" alt="TrustChain Logo" className="sidebar-brand-logo" />
          <h2 className="logo-gradient">TrustChain</h2>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{(retailerId || "R")[0].toUpperCase()}</div>
          <div className="profile-meta">
            <div className="profile-name">Retailer</div>
            <div className="profile-id">ID: {retailerId}</div>
          </div>
        </div>

        <div
          className={`sidebar-btn ${activeAction === "verifyBox" ? "active" : ""}`}
          onClick={() => setActiveAction("verifyBox")}
        >
          <FaBoxOpen /> Verify Box
        </div>

        <div
          className={`sidebar-btn ${activeAction === "verifySeal" ? "active" : ""}`}
          onClick={() => setActiveAction("verifySeal")}
        >
          <FaShieldAlt /> Verify Seal
        </div>

      </div>

      <div className="dashboard-right retailer-right">
        {activeAction === "verifyBox" && (
          <div className="premium-card retailer-verify-card">
            <h2 className="section-title"><FaBoxOpen /> Verify by Box ID</h2>
            <div className="verifyx-searchbar">
              <div className="verifyx-input-wrap">
                <FaSearch />
                <input
                  placeholder="Enter / scan Box ID"
                  value={boxId}
                  onChange={(e) => setBoxId(e.target.value)}
                />
              </div>
              <button className="verifyx-search-btn" onClick={handleFetchBox}>
                Search Box
              </button>
            </div>

            {boxSummary && (
              <div className="verifyx-summary">
                <div className="verifyx-stat"><span>Batch</span><strong>{boxSummary.batchId || "-"}</strong></div>
                <div className="verifyx-stat"><span>Box ID</span><strong>{boxSummary.boxId || boxId}</strong></div>
                <div className="verifyx-stat"><span>Total Products</span><strong>{boxSummary.totalProducts ?? boxProducts.length}</strong></div>
                <div className="verifyx-stat verified"><span>Verified</span><strong>{verifiedProductsCount}</strong></div>
                <div className="verifyx-stat pending"><span>Pending</span><strong>{pendingProductsCount}</strong></div>
              </div>
            )}

            {boxProducts.length > 0 && (
              <div className="verifyx-main">
                <section className="verifyx-panel verifyx-left">
                  <h3>Products in Box</h3>
                  <div className="verifyx-list">
                    {boxProducts.map((p) => (
                      <div key={p.productId} className="verifyx-row">
                        <div className="verifyx-row-text">
                          <strong>{p.name}</strong>
                          <span>{p.productId}</span>
                        </div>
                        <div className="verifyx-row-actions">
                          <span className={`verifyx-pill ${p.sold ? "sold" : p.verifiedByRetailer ? "ok" : "pending"}`}>
                            {p.sold ? "Sold" : p.verifiedByRetailer ? "Verified" : "Not Verified"}
                          </span>
                          <button
                            className="verifyx-eye"
                            onClick={() => handleViewProduct(p.productId)}
                            title="View Product"
                            aria-label="View Product"
                          >
                            <FaEye />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="verifyx-footer">
                    <button
                      className="verifyx-verify-btn"
                      onClick={handleVerifyBox}
                      disabled={isVerifyingBox}
                    >
                      {isVerifyingBox
                        ? "Verifying..."
                        : boxSummary?.verified
                          ? "Verified (Sync/Refresh)"
                          : `Verify Box (${boxProducts.length})`}
                    </button>
                  </div>
                </section>

                <section className="verifyx-panel verifyx-right">
                  {isViewingProduct && <div className="verifyx-empty">Loading product details...</div>}

                  {!selectedProduct && !isViewingProduct && (
                    <div className="verifyx-empty">
                      <FaEye />
                      <p>Select a product using the eye icon to preview details.</p>
                    </div>
                  )}

                  {selectedProduct && !isViewingProduct && (
                    <div className="verifyx-preview">
                      <div className="product-card premium-product-card retailer-product-card">
                        <div className="product-media">
                          <div className={`retailer-product-image-wrap ${selectedProduct.sold ? "is-sold" : ""}`}>
                            <img src={selectedProduct.image || "/mob.jpg"} alt={selectedProduct.name || "Product"} />
                            {selectedProduct.sold && (
                              <img src="/sold.png" alt="Sold Product" className="retailer-sold-overlay" />
                            )}
                          </div>
                        </div>
                        <div className="product-details-col">
                          <div className="product-info-grid">
                            <div className="detail-item"><FaTag /><span><strong>Product ID:</strong> {selectedProduct.productId || "-"}</span></div>
                            <div className="detail-item"><FaMobileAlt /><span><strong>Name:</strong> {selectedProduct.name || "-"}</span></div>
                            <div className="detail-item"><FaInfoCircle /><span><strong>Model:</strong> {selectedProduct.modelNumber || "-"}</span></div>
                            <div className="detail-item"><FaPalette /><span><strong>Color:</strong> {selectedProduct.color || "-"}</span></div>
                            <div className="detail-item"><FaTag /><span><strong>Manufacturer:</strong> {selectedProduct.manufacturer || selectedProduct.manufacturerId || "-"}</span></div>
                            <div className="detail-item"><FaMapMarkerAlt /><span><strong>Location:</strong> {selectedProduct.manufacturePlace || "-"}</span></div>
                            <div className="detail-item"><FaCube /><span><strong>Batch:</strong> {selectedProduct.batchId || selectedProduct.batchNumber || "-"}</span></div>
                            <div className="detail-item"><FaBoxes /><span><strong>Box:</strong> {selectedProduct.boxId || "-"}</span></div>
                            <div className="detail-item"><FaCalendarAlt /><span><strong>Warranty:</strong> {selectedProduct.warrantyPeriod || "-"}</span></div>
                            <div className="detail-item"><FaMoneyBillWave /><span><strong>Price:</strong> Rs {selectedProduct.price || "-"}</span></div>
                          </div>

                          <div className="status-row">
                            <div className="status-card">
                              <div className="status-head">
                                <span className="status-top-icon"><FaClipboardCheck /></span>
                                <span>Registered</span>
                              </div>
                              {selectedProduct.registered ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                            </div>
                            <div className="status-card">
                              <div className="status-head">
                                <span className="status-top-icon"><FaTruck /></span>
                                <span>Shipped</span>
                              </div>
                              {selectedProduct.shipped ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                            </div>
                            <div className="status-card">
                              <div className="status-head">
                                <span className="status-top-icon"><FaShieldAlt /></span>
                                <span>Verified</span>
                              </div>
                              {(selectedProduct.verified || selectedProduct.verifiedByRetailer) ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                            </div>
                            <div className="status-card">
                              <div className="status-head">
                                <span className="status-top-icon"><FaShoppingCart /></span>
                                <span>Sold</span>
                              </div>
                              {selectedProduct.sold ? <FaCheckCircle className="status-icon ok" /> : <FaTimesCircle className="status-icon no" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}

        {activeAction === "verifySeal" && (
          <div className="premium-card">
            <h2 className="section-title"><FaQrcode /> Product Authenticity (Secret Key)</h2>

            <div className="retailer-seal-form">
              <div className="form-group">
                <label>Product ID</label>
                <div className="input-icon">
                  <FaTag />
                  <input
                    placeholder="Enter Product ID"
                    value={scanProductId}
                    onChange={(e) => setScanProductId(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Secret Key</label>
                <div className="input-icon">
                  <FaInfoCircle />
                  <input
                    placeholder="Paste product secret key"
                    value={secretKeyInput}
                    onChange={(e) => setSecretKeyInput(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn-primary fetch-btn-inline retailer-btn-secondary"
                onClick={handleVerifySeal}
                disabled={isVerifyingSeal}
              >
                {isVerifyingSeal ? "Checking..." : "Verify Authenticity"}
              </button>
            </div>

            {scanResult && (
              <div className={scanResult.ok ? "product-card premium-product-card retailer-product-card" : "retailer-auth-result-full"}>
                {scanResult.ok && (
                  <div className="product-media">
                    <div className={`retailer-product-image-wrap ${scanResult.product?.sold ? "is-sold" : ""}`}>
                      {scanResult.product?.image ? (
                        <img src={scanResult.product.image} alt={scanResult.product.name} />
                      ) : (
                        <div className="retailer-no-image">No image</div>
                      )}
                      {scanResult.product?.sold && (
                        <img src="/sold.png" alt="Sold Product" className="retailer-sold-overlay" />
                      )}
                    </div>
                    {!scanResult.product?.sold && (
                      <img src="/ver.png" alt="Verified Genuine" className="retailer-auth-badge-img genuine" />
                    )}
                  </div>
                )}

                <div className="product-details-col">
                  {scanResult.ok && (
                    <div className="product-info-grid">
                      <div className="detail-item"><FaTag /><span><strong>Product ID:</strong> {scanResult.product?.productId}</span></div>
                      <div className="detail-item"><FaBoxes /><span><strong>Box ID:</strong> {scanResult.product?.boxId || "-"}</span></div>
                      <div className="detail-item"><FaCube /><span><strong>Batch ID:</strong> {scanResult.product?.batchId || "-"}</span></div>
                      <div className="detail-item"><FaMobileAlt /><span><strong>Name:</strong> {scanResult.product?.name || "-"}</span></div>
                      <div className="detail-item"><FaInfoCircle /><span><strong>Model:</strong> {scanResult.product?.modelNumber || "-"}</span></div>
                      <div className="detail-item"><FaMapMarkerAlt /><span><strong>Manufacturer:</strong> {scanResult.product?.manufacturer || "-"}</span></div>
                      <div className="detail-item"><FaCalendarAlt /><span><strong>Mfg Date:</strong> {scanResult.product?.manufacturerDate || "-"}</span></div>
                      <div className="detail-item"><FaInfoCircle /><span><strong>Serial:</strong> {scanResult.product?.serialNumber || "-"}</span></div>
                      <div className="detail-item"><FaPalette /><span><strong>Color:</strong> {scanResult.product?.color || "-"}</span></div>
                      <div className="detail-item"><FaInfoCircle /><span><strong>Warranty:</strong> {scanResult.product?.warrantyPeriod || "-"}</span></div>
                      <div className="detail-item"><FaTag /><span><strong>Retailer ID:</strong> {scanResult.product?.retailerId || "-"}</span></div>
                      <div className="detail-item"><FaMapMarkerAlt /><span><strong>Retailer Location:</strong> {scanResult.product?.retailerLocation || "-"}</span></div>
                      <div className="detail-item"><FaMoneyBillWave /><span><strong>Price:</strong> Rs {scanResult.product?.price || "-"}</span></div>
                    </div>
                  )}

                  <div className={`retailer-seal-row ${scanResult.ok && scanResult.product?.sold ? "is-sold" : ""}`}>
                    <div className="retailer-seal-result">
                      {scanResult.ok ? (
                        <div className="retailer-seal-valid">
                          <div className="retailer-seal-head">
                            <span className="retailer-seal-icon">
                              <FaCheckCircle />
                            </span>
                            <span>GENUINE</span>
                          </div>
                          {!scanResult.product?.sold && <small>{scanResult.message}</small>}
                        </div>
                      ) : (
                        <div className="retailer-seal-invalid">
                          <div className="retailer-seal-head">
                            <span className="retailer-seal-icon">
                              <FaTimesCircle />
                            </span>
                            <span>FAKE</span>
                          </div>
                          <small>{scanResult.message}</small>
                        </div>
                      )}
                    </div>

                    {scanResult.ok && scanResult.product?.sold && (
                      <div className="retailer-warning retailer-sold-warning">
                        This product is already sold.
                      </div>
                    )}
                  </div>

                  {!scanResult.ok && (
                    <div className="retailer-fake-actions">
                      <img src="/rej.png" alt="Rejected Fake" className="retailer-auth-badge-img fake" />
                      <div className="retailer-fake-text">
                        <p>Check Product ID and Secret Key once more.</p>
                        <p>If still FAKE, do not sell this product.</p>
                      </div>
                    </div>
                  )}

                  {scanResult.ok && !scanResult.product?.sold && scanResult.product?.shipped && scanResult.product?.verifiedByRetailer && (
                    <div className="retailer-sell-form">
                      <div className="input-icon">
                        <FaInfoCircle />
                        <input
                          type="email"
                          placeholder="Buyer email (required for sale receipt)"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                        />
                      </div>
                      <button
                        className="btn-primary retailer-btn-sold"
                        onClick={() => handleMarkSold(scanResult.product.productId)}
                      >
                        <FaShoppingCart /> Mark as Sold
                      </button>
                    </div>
                  )}

                  {scanResult.ok && (!scanResult.product?.shipped || !scanResult.product?.verifiedByRetailer) && (
                    <div className="retailer-warning">
                      Product can be sold only after shipping and retailer verification.
                    </div>
                  )}

                  {saleReceipt && (
                    <div className="retailer-sale-info">
                      <h4>Sale Details</h4>
                      <div><strong>Product:</strong> {saleReceipt.name} ({saleReceipt.productId})</div>
                      <div><strong>Batch/Box:</strong> {saleReceipt.batchId} / {saleReceipt.boxId}</div>
                      <div><strong>Retailer:</strong> {saleReceipt.retailerId} ({saleReceipt.retailerLocation})</div>
                      <div><strong>Buyer Email:</strong> {buyerEmail}</div>
                      <div><strong>Transaction:</strong> {saleReceipt.txHash}</div>
                      <div><strong>Sold At:</strong> {saleReceipt.soldAt}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {status && <p className="register-status retailer-status">{status}</p>}
      </div>

    </div>
  );
};

export default RetailerDashboard;
