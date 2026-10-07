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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">من</span>
      <Input type="date" className="w-40 num" value={from} onChange={(e) => onChange(e.target.value, to)} />
      <span className="text-sm text-muted-foreground">إلى</span>
      <Input type="date" className="w-40 num" value={to} onChange={(e) => onChange(from, e.target.value)} />
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
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-3 text-2xl">{value}</p>
      {sub && <p className="num mt-1 text-[11px] text-gold">{sub}</p>}
    </div>
  );
}
