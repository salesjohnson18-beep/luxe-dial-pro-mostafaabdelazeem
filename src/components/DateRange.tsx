import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { monthStart, today } from "@/lib/metrics";

export function DateRange({
  from,
  to,
  onChange,
  presets = true,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  presets?: boolean;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2">من
      <Input type="date" className="num min-w-0 w-full sm:w-40" value={from} onChange={(e) => onChange(e.target.value, to)} /></label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2">إلى
      <Input type="date" className="num min-w-0 w-full sm:w-40" value={to} onChange={(e) => onChange(from, e.target.value)} /></label>
      {presets && (
        <>
          <Button variant="outline" size="sm" onClick={() => onChange(today(), today())}>يومي</Button>
          <Button variant="outline" size="sm" onClick={() => onChange(monthStart(), today())}>شهري</Button>
        </>
      )}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-3 break-all text-xl sm:text-2xl">{value}</p>
      {sub && <p className="num mt-1 text-[11px] text-gold">{sub}</p>}
    </div>
  );
}
