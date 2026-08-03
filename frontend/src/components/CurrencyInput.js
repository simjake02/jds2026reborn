import { Input } from "@/components/ui/input";

export function CurrencyInput({ value, onChange, ...props }) {
  const display =
    value === "" || value === null || value === undefined || isNaN(Number(value))
      ? ""
      : "Rp " + Number(value).toLocaleString("id-ID");
  const handle = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    onChange(digits === "" ? "" : Number(digits));
  };
  return <Input inputMode="numeric" value={display} onChange={handle} placeholder="Rp 0" {...props} />;
}
