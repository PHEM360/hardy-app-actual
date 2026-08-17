import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountTypeLabel } from "@/lib/financeAccounts";

export function AccountTypeFields({
  types,
  value,
  onChange,
  customValue,
  onCustomChange,
}: {
  types: string[];
  value: string;
  onChange: (value: string) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
}) {
  const isOther = value === "Other";
  const options = types.includes(value) || value === "Other" ? types : [value, ...types];

  return (
    <div className="space-y-2">
      <Label>Type</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((t) => (
            <SelectItem key={t} value={t}>{accountTypeLabel(t)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          autoFocus
          placeholder="e.g. Premium Bonds"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          className="h-11 rounded-xl"
        />
      )}
    </div>
  );
}
