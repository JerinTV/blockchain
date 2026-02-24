import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../role.css";
import BackButton from "../components/BackButton";
import { Fingerprint, Building2, Factory, ShieldUser } from "lucide-react";

const roles = [
  {
    key: "user",
    title: "User",
    caption: "Verify products and track authenticity.",
    icon: Fingerprint
  },
  {
    key: "retailer",
    title: "Retailer",
    caption: "Validate shipments and confirm sales.",
    icon: Building2
  },
  {
    key: "manufacturer",
    title: "Manufacturer",
    caption: "Register batches on-chain securely.",
    icon: Factory
  },
  {
    key: "admin",
    title: "Admin",
    caption: "Manage audits and platform operations.",
    icon: ShieldUser
  }
];

export default function RoleSelect() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const chooseRole = (role) => {
    navigate(`/login/${role}`);
  };

  return (
    <div className="role-page">
      <BackButton to="/" />

      <main className="role-frame">
        <header className="role-head">
          <p className="role-kicker">TrustChain</p>
          <h1 className="role-title">Select Your Role</h1>
          <p className="role-subtitle">Choose the console for your workflow.</p>
        </header>

        <section className="role-stage">
          <div className="role-grid role-grid-row">
            {roles.map((role, idx) => (
              <article
                key={role.key}
                className={`role-card role-card-${role.key}`}
                style={{ "--delay": `${idx * 90}ms` }}
              >
                <div className="role-card-top" />

                <div className="role-icon-wrap">
                  <role.icon size={34} strokeWidth={2.1} className="role-icon" aria-hidden="true" />
                </div>

                <h3>{role.title}</h3>
                <p className="role-caption">{role.caption}</p>

                <button className="btn-role" onClick={() => chooseRole(role.key)}>
                  Continue
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
