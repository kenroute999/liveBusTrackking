import { useState } from "react";

interface Props {
  onSearchPnr: (pnr: string) => void;
  busy?: boolean;
}

// Only the PNR opens a trip: a mobile number is known to too many people to be the key
// to where someone is travelling.
export function TrackingSearch({ onSearchPnr, busy }: Props) {
  const [pnr, setPnr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = pnr.trim().toUpperCase();
    if (!/^KR[A-Z0-9]{6}$/.test(value)) {
      setError("Please enter valid details.");
      return;
    }
    onSearchPnr(value);
  };

  return (
    <div className="search-card">
      <form onSubmit={submit} className="search-form">
        <input
          value={pnr}
          onChange={(e) => setPnr(e.target.value.toUpperCase())}
          placeholder="KRAB12CD"
          autoCapitalize="characters"
          maxLength={8}
          aria-label="PNR"
        />
        <button type="submit" disabled={busy} className="primary">
          {busy ? "Searching…" : "Track Bus"}
        </button>
      </form>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
