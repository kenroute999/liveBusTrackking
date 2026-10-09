import { useState } from "react";

interface Props {
  onSearchPnr: (pnr: string) => void;
  onSearchMobile: (mobile: string) => void;
  busy?: boolean;
}

// A trip can be opened by the PNR printed on the ticket, or by the mobile number the
// ticket was booked with. The mobile is only sent to look the booking up; it is never
// shown back, stored in the URL, or included in the tracking response.
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
      if (!/^KR[A-Z0-9]{6}$/.test(value)) {
        setError("Please enter valid details.");
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
          Mobile
        </button>
      </div>

      <form onSubmit={submit} className="search-form">
        {mode === "PNR" ? (
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.toUpperCase())}
            placeholder="Enter your PNR"
            autoCapitalize="characters"
            maxLength={8}
            aria-label="PNR"
          />
        ) : (
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Enter mobile number"
            inputMode="numeric"
            maxLength={10}
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
