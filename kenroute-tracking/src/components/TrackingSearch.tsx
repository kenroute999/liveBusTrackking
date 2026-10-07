import { useState } from "react";

interface Props {
  onSearchPnr: (pnr: string) => void;
  onSearchMobile: (mobile: string) => void;
  busy?: boolean;
}

const PNR_ALPHABET = /^[A-Z0-9]+$/;

export function TrackingSearch({ onSearchPnr, onSearchMobile, busy }: Props) {
  const [mode, setMode] = useState<"PNR" | "MOBILE">("PNR");
  const [pnr, setPnr] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "PNR") {
      const value = pnr.trim().toUpperCase();
      if (!/^KR[A-Z0-9]{6}$/.test(value) || !PNR_ALPHABET.test(value)) {
        setError("Enter a valid PNR like KR123456");
        return;
      }
      onSearchPnr(value);
    } else {
      const digits = mobile.replace(/\D/g, "");
      const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
      if (!/^[6-9]\d{9}$/.test(ten)) {
        setError("Enter a valid Indian mobile number");
        return;
      }
      onSearchMobile(ten);
    }
  };

  return (
    <div className="search-card">
      <div className="mode-switch">
        <button type="button" className={mode === "PNR" ? "active" : ""} onClick={() => setMode("PNR")}>
          PNR
        </button>
        <button type="button" className={mode === "MOBILE" ? "active" : ""} onClick={() => setMode("MOBILE")}>
          MOBILE
        </button>
      </div>

      <form onSubmit={submit} className="search-form">
        {mode === "PNR" ? (
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            placeholder="KR123456"
            autoCapitalize="characters"
            aria-label="PNR"
          />
        ) : (
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="9876543210"
            inputMode="numeric"
            aria-label="Mobile number"
          />
        )}
        <button type="submit" disabled={busy} className="primary">
          {busy ? "Searching…" : "Track Bus"}
        </button>
      </form>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
