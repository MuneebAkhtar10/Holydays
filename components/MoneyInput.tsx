"use client";

import { convertToPkr, inputFromPkr } from "@/lib/currency";
import { useSerai } from "@/lib/store";
import { FieldHint } from "@/components/FieldHint";

export function MoneyInput({
  label,
  pkr,
  onPkr,
  required,
  placeholder,
  compact,
  hint,
}: {
  label: string;
  pkr: string | number;
  onPkr: (nextPkr: string) => void;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
  hint?: string;
}) {
  const { currency } = useSerai();
  const blank = pkr === "" || pkr == null;
  const display = blank ? "" : inputFromPkr(Number(pkr) || 0, currency);
  return (
    <label className={compact ? "block" : "paper-label"}>
      {compact ? (
        <span className="flex items-center justify-between gap-2">
          <span className="form-label">
            {label}
            {hint ? <FieldHint text={hint} /> : null}
          </span>
          <span className="text-xs font-medium text-ink/45">{currency}</span>
        </span>
      ) : (
        <>
          {label} ({currency})
        </>
      )}
      <input
        className={`paper-field ${compact ? "mt-1.5" : ""}`}
        type="number"
        min={0}
        step={currency === "PKR" ? 1 : 0.01}
        value={display}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onPkr("");
            return;
          }
          onPkr(String(convertToPkr(Number(raw) || 0, currency)));
        }}
      />
    </label>
  );
}
