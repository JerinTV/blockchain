import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../back-button.css";

export default function BackButton({ to, label = "Back" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
      return;
    }
    navigate(-1);
  };

  return (
    <button className="app-back-btn" onClick={handleBack} aria-label={label}>
      <ArrowLeft size={16} />
      <span>{label}</span>
    </button>
  );
}
