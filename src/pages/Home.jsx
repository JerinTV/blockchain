import React, { useEffect, useState } from "react";
import "../index.css";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  MessageSquare,
  Phone,
  MapPin
} from "lucide-react";

const Home = () => {

  // -------------------------------
  // NAVIGATION
  // -------------------------------
  const navigate = useNavigate();

  // -------------------------------
  // STATES
  // -------------------------------
  const [activeSection, setActiveSection] = useState("home");

  // -------------------------------
  // NAVBAR SCROLL SPY
  // -------------------------------
  useEffect(() => {
    const sections = ["home", "about", "features", "contact"];

    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight / 3;

      for (let section of sections) {
        const elem = document.getElementById(section);
        if (!elem) continue;

        const top = elem.offsetTop;
        const bottom = top + elem.offsetHeight;

        if (scrollPos >= top && scrollPos < bottom) {
          setActiveSection(section);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // -------------------------------
  // SMOOTH SCROLL
  // -------------------------------
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const aboutText =
    "TrustChain protects your products with secure blockchain records, quick verification, and complete visibility from manufacturer to customer. It gives your team one reliable system to prevent counterfeits, build customer trust, and make better decisions.";

  // -------------------------------
  // FEATURE CARD SCROLL ANIMATION
  // -------------------------------
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.target.classList.contains("feature-card")) {
            if (entry.isIntersecting) entry.target.classList.add("show");
            else entry.target.classList.remove("show");
            return;
          }

        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );

    const observedElements = document.querySelectorAll(".feature-card");
    observedElements.forEach(card => observer.observe(card));

    return () => {
      observer.disconnect();
    };
  }, []);

  // ==================================================
  // JSX
  // ==================================================
  return (
    <div className="home-page ultra-home premium-v2">
      <div className="ultra-grid" aria-hidden="true"></div>

      {/* ================= NAVBAR ================= */}
      <nav className="navbar">
        <div className="nav-logo">
          <img src="/bc1.png" alt="Logo" className="nav-logo-img" />
          <span className="nav-brand">TRUSTCHAIN</span>
        </div>

        <ul className="nav-links">
          {["home", "about", "features", "contact"].map(link => (
            <li key={link}>
              <a
                className={activeSection === link ? "active-link" : ""}
                onClick={() => scrollTo(link)}
              >
                {link.toUpperCase()}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ================= HOME ================= */}
      <section id="home" className="container home-section">
        <div className="heading-section">
          <div className="hero-ambient" aria-hidden="true">
            <span className="hero-ambient-orb orb-a"></span>
            <span className="hero-ambient-orb orb-b"></span>
            <span className="hero-ambient-line"></span>
          </div>

          <p className="hero-eyebrow">Enterprise Product Security Layer</p>
          <div className="hero-title-row">
            <img src="/bc1.png" alt="" className="hero-title-logo" aria-hidden="true" />
            <h1>
              <span className="line1">BLOCKCHAIN BASED</span>
              <span className="line2">PRODUCT SECURITY</span>
            </h1>
          </div>

          <div className="motto-row">
            <p className="motto">
              Securing your products with
            </p>
            <div className="value-strip">
              <span className="value-chip trust">
                <img src="/bc1.png" alt="Trust logo" className="value-logo" />
                Trust
              </span>
              <span className="value-chip transparency">
                <img src="/bc1.png" alt="Transparency logo" className="value-logo" />
                Transparency
              </span>
              <span className="value-chip innovation">
                <img src="/bc1.png" alt="Innovation logo" className="value-logo" />
                Innovation
              </span>
            </div>
          </div>
          <p className="hero-subcopy">
            Premium-grade verification architecture for modern supply chains, designed for trust at scale.
          </p>

          <section className="home-premium-cta">
            <div className="home-premium-cta-shell">
              <p>Ready to secure your supply chain?</p>
              <div className="hero-cta-row">
                <button
                  className="btn-primary"
                  onClick={() => navigate("/roles")}
                >
                  Get Started
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => scrollTo("features")}
                >
                  Explore Features
                </button>
              </div>
            </div>
          </section>

        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section id="about" className="about-premium-section">
        <div className="about-premium-head">
          <p className="about-premium-kicker">About TrustChain</p>
          <h2>Secure, Simple Product Protection</h2>
          <p className="about-premium-desc">{aboutText}</p>
        </div>

        <div className="about-premium-grid">
          <article className="about-premium-card about-word-chip trust">
            <span className="about-card-key">01</span>
            <span>Secure Records</span>
          </article>
          <article className="about-premium-card about-word-chip transparency">
            <span className="about-card-key">02</span>
            <span>Instant Verify</span>
          </article>
          <article className="about-premium-card about-word-chip innovation">
            <span className="about-card-key">03</span>
            <span>Full Tracking</span>
          </article>
          <article className="about-premium-card about-word-chip assurance">
            <span className="about-card-key">04</span>
            <span>Counterfeit Free</span>
          </article>
        </div>
      </section>

      <section className="home-flow-wrap" aria-label="Product flow from manufacturer to customer">
        <div className="home-flow-track">
          <span className="home-flow-line"></span>
          <span className="home-flow-progress"></span>
          <span className="home-flow-runner"></span>

          <div className="home-flow-node node-1">
            <img src="/man.png" alt="Manufacturer" />
            <span className="home-flow-tick">✓</span>
          </div>
          <div className="home-flow-node node-2">
            <img src="/del.png" alt="Delivery" />
            <span className="home-flow-tick">✓</span>
          </div>
          <div className="home-flow-node node-3">
            <img src="/ret.png" alt="Retailer" />
            <span className="home-flow-tick">✓</span>
          </div>
          <div className="home-flow-node node-4">
            <img src="/cus.png" alt="Customer" />
            <span className="home-flow-tick">✓</span>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="section features-section">
        <img
          src="/pr1.png"
          alt="Feature Left"
          className="features-edge-art features-edge-left"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/logo1.jpg";
          }}
        />
        <img
          src="/pr2.png"
          alt="Feature Right"
          className="features-edge-art features-edge-right"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/logo2.jpg";
          }}
        />

        <div className="features-heading-wrap">
          <p className="features-kicker">Platform Capabilities</p>
          <h2 className="fade-heading">Premium Features</h2>
          <p className="features-subtitle">
            Built for enterprises that need speed, trust, and complete traceability.
          </p>
        </div>

        <div className="features-carousel">
          <div className="features-track">
            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="folder.png" className="feature-icon" alt="lock" />
                <span className="feature-pill">Ledger Core</span>
              </div>
              <h3>Immutable Chain Records</h3>
              <p>
                Every lifecycle event is cryptographically secured and permanently auditable.
              </p>
              <div className="feature-meta-row">
                <strong>99.99%</strong>
                <span>Data Integrity</span>
              </div>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="qr-code.png" className="feature-icon" alt="verify" />
                <span className="feature-pill">Consumer Trust</span>
              </div>
              <h3>Instant Product Verification</h3>
              <p>
                Scan and validate in seconds with secure QR identity and tamper checks.
              </p>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="track.png" className="feature-icon" alt="tracking" />
                <span className="feature-pill">Live Visibility</span>
              </div>
              <h3>End-to-End Traceability</h3>
              <p>
                Track each unit from manufacturing, shipping, verification, and final sale.
              </p>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="fake.png" className="feature-icon" alt="security" />
                <span className="feature-pill">Fraud Shield</span>
              </div>
              <h3>Anti-Counterfeit Defense</h3>
              <p>
                Eliminate fake products by matching secure chain history against real-time scans.
              </p>
              <div className="feature-risk-chip">Risk Monitoring Enabled</div>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="folder.png" className="feature-icon" alt="lock" />
                <span className="feature-pill">Ledger Core</span>
              </div>
              <h3>Immutable Chain Records</h3>
              <p>
                Every lifecycle event is cryptographically secured and permanently auditable.
              </p>
              <div className="feature-meta-row">
                <strong>99.99%</strong>
                <span>Data Integrity</span>
              </div>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="qr-code.png" className="feature-icon" alt="verify" />
                <span className="feature-pill">Consumer Trust</span>
              </div>
              <h3>Instant Product Verification</h3>
              <p>
                Scan and validate in seconds with secure QR identity and tamper checks.
              </p>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="track.png" className="feature-icon" alt="tracking" />
                <span className="feature-pill">Live Visibility</span>
              </div>
              <h3>End-to-End Traceability</h3>
              <p>
                Track each unit from manufacturing, shipping, verification, and final sale.
              </p>
            </article>

            <article className="feature-card feature-card-uniform">
              <div className="feature-top-row">
                <img src="fake.png" className="feature-icon" alt="security" />
                <span className="feature-pill">Fraud Shield</span>
              </div>
              <h3>Anti-Counterfeit Defense</h3>
              <p>
                Eliminate fake products by matching secure chain history against real-time scans.
              </p>
              <div className="feature-risk-chip">Risk Monitoring Enabled</div>
            </article>
          </div>
        </div>
      </section>

                {/* ================= CONTACT ================= */}
      <section id="contact" className="contact-v2-section contact-v2-premium">
        <div className="contact-v2-shell">
          <div className="contact-v2-left contact-v2-panel contact-v2-from-left in-view">
            <p className="contact-v2-kicker">CONNECT WITH TRUSTCHAIN</p>
            <h2>Let&apos;s Secure Your Product Journey</h2>
            <p className="contact-v2-desc">
              Talk to our team about onboarding, anti-counterfeit workflows, and enterprise traceability.
              We help brands launch blockchain-backed verification fast.
            </p>

            <div className="contact-v2-highlights">
              <span>24x7 Support</span>
              <span>Enterprise Onboarding</span>
              <span>Audit Assistance</span>
            </div>

            <div className="contact-v2-cards">
              <div className="contact-v2-card">
                <span><Mail size={15} /></span>
                <div>
                  <h4>Email</h4>
                  <p>support@trustchain.com</p>
                </div>
              </div>
              <div className="contact-v2-card">
                <span><Phone size={15} /></span>
                <div>
                  <h4>Phone</h4>
                  <p>+91 9876543210</p>
                </div>
              </div>
              <div className="contact-v2-card">
                <span><MapPin size={15} /></span>
                <div>
                  <h4>Office</h4>
                  <p>123 Blockchain Street, Tech City</p>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-v2-right contact-v2-panel contact-v2-from-right in-view">
            <form className="contact-v2-form">
              <div className="contact-v2-input">
                <User size={16} />
                <input type="text" placeholder="Your Name" required />
              </div>
              <div className="contact-v2-input">
                <Mail size={16} />
                <input type="email" placeholder="Work Email" required />
              </div>
              <div className="contact-v2-input contact-v2-textarea">
                <MessageSquare size={16} />
                <textarea placeholder="Tell us what you need..." rows="5" required />
              </div>
              <button type="submit">Send Message</button>
              <div className="contact-v2-social-row">
                <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <img src="/instagram.png" alt="Instagram" />
                </a>
                <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" aria-label="WhatsApp">
                  <img src="/social.png" alt="Social" />
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <img src="/linkedin.png" alt="LinkedIn" />
                </a>
              </div>
            </form>
          </div>
        </div>
      </section>



                  {/* ================= FOOTER ================= */}
      <footer className="footer">
  <div className="footer-simple-wrap">
    <div className="footer-simple-brand">
      <img src="/bc1.png" alt="TrustChain" className="footer-simple-logo" />
      <div>
        <h3>TrustChain</h3>
        <p>Blockchain Product Security Platform</p>
      </div>
    </div>

    <p className="footer-simple-copy">© 2026 TrustChain. All rights reserved.</p>
  </div>
</footer>

    </div>
  );
};

export default Home;


