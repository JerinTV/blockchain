import { useState } from "react";
import { FaCube, FaBoxes, FaSearch, FaDatabase } from "react-icons/fa";
import BackButton from "../components/BackButton";
import { getRawProductOnChain, getRawBoxOnChain } from "../trustChain";
import "../blockchain-data.css";

export default function BlockchainData() {
  const role = String(localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";

  const [productId, setProductId] = useState("");
  const [boxId, setBoxId] = useState("");
  const [productData, setProductData] = useState(null);
  const [boxData, setBoxData] = useState(null);
  const [status, setStatus] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadingBox, setLoadingBox] = useState(false);

  if (!isAdmin) {
    return (
      <div className="chain-page">
        <BackButton to="/roles" />
        <div className="chain-shell">
          <h1><FaDatabase /> Blockchain Data Explorer</h1>
          <div className="chain-status">Access denied. Only admin can view blockchain explorer.</div>
        </div>
      </div>
    );
  }

  const handleFetchProduct = async () => {
    setStatus("");
    setProductData(null);
    try {
      setLoadingProduct(true);
      const data = await getRawProductOnChain(productId);
      setProductData(data);
    } catch (err) {
      setStatus(err?.message || "Failed to fetch product on-chain data");
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleFetchBox = async () => {
    setStatus("");
    setBoxData(null);
    try {
      setLoadingBox(true);
      const data = await getRawBoxOnChain(boxId);
      setBoxData(data);
    } catch (err) {
      setStatus(err?.message || "Failed to fetch box on-chain data");
    } finally {
      setLoadingBox(false);
    }
  };

  return (
    <div className="chain-page">
      <BackButton />

      <div className="chain-shell">
        <h1><FaDatabase /> Blockchain Data Explorer</h1>
        <p>Read product and box information directly from smart contract state.</p>

        <div className="chain-grid">
          <section className="chain-card">
            <h2><FaCube /> Product Data</h2>
            <div className="chain-row">
              <input
                placeholder="Enter Product ID (e.g., P3000)"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              />
              <button onClick={handleFetchProduct} disabled={loadingProduct}>
                {loadingProduct ? "Loading..." : <><FaSearch /> Fetch</>}
              </button>
            </div>

            {productData && (
              <pre className="chain-output">{JSON.stringify(productData, null, 2)}</pre>
            )}
          </section>

          <section className="chain-card">
            <h2><FaBoxes /> Box Data</h2>
            <div className="chain-row">
              <input
                placeholder="Enter Box ID (e.g., BOX-300)"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
              />
              <button onClick={handleFetchBox} disabled={loadingBox}>
                {loadingBox ? "Loading..." : <><FaSearch /> Fetch</>}
              </button>
            </div>

            {boxData && (
              <pre className="chain-output">{JSON.stringify(boxData, null, 2)}</pre>
            )}
          </section>
        </div>

        {status && <div className="chain-status">{status}</div>}
      </div>
    </div>
  );
}
