import { Plus, Trash2, Phone, MapPin, Stethoscope, ListPlus, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { genFieldId, type DogTagProfile } from "@/hooks/useDogTags";

export function DogTagProfilePanel({
  profile,
  onChange,
  petName,
}: {
  profile: DogTagProfile;
  onChange: (patch: Partial<DogTagProfile>) => void;
  petName: string;
}) {
  const addPhone = () =>
    onChange({ phones: [...profile.phones, { id: genFieldId(), label: "", number: "" }] });
  const updatePhone = (id: string, patch: Partial<DogTagProfile["phones"][number]>) =>
    onChange({ phones: profile.phones.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePhone = (id: string) => onChange({ phones: profile.phones.filter((p) => p.id !== id) });

  const addCustomField = () =>
    onChange({ customFields: [...profile.customFields, { id: genFieldId(), label: "", value: "" }] });
  const updateCustomField = (id: string, patch: Partial<DogTagProfile["customFields"][number]>) =>
    onChange({ customFields: profile.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeCustomField = (id: string) => onChange({ customFields: profile.customFields.filter((f) => f.id !== id) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Message</Label>
        <Textarea
          value={profile.message}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder={`${petName} appears to be lost. Please get in touch using the details below.`}
          className="rounded-lg resize-none text-xs"
          rows={3}
        />
      </div>

      {/* Phone numbers */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Phone numbers</span>
        </div>
        {profile.phones.map((phone) => (
          <div key={phone.id} className="flex items-center gap-1.5">
            <Input
              value={phone.label}
              onChange={(e) => updatePhone(phone.id, { label: e.target.value })}
              placeholder="Label (e.g. Chris)"
              className="h-9 rounded-lg text-xs flex-1"
            />
            <Input
              value={phone.number}
              onChange={(e) => updatePhone(phone.id, { number: e.target.value })}
              placeholder="Phone number"
              type="tel"
              className="h-9 rounded-lg text-xs flex-1"
            />
            <button onClick={() => removePhone(phone.id)} className="p-1.5 text-muted-foreground hover:text-destructive flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addPhone} className="w-full h-8 rounded-lg text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add phone number
        </Button>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Home address</Label>
        <Textarea
          value={profile.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Optional — shown on the scan page"
          className="rounded-lg resize-none text-xs"
          rows={2}
        />
      </div>

      {/* Vet details */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Vet practice</span>
        </div>
        <Input value={profile.vetName} onChange={(e) => onChange({ vetName: e.target.value })} placeholder="Practice name" className="h-9 rounded-lg text-xs" />
        <Input value={profile.vetPhone} onChange={(e) => onChange({ vetPhone: e.target.value })} placeholder="Phone number" type="tel" className="h-9 rounded-lg text-xs" />
        <Input value={profile.vetAddress} onChange={(e) => onChange({ vetAddress: e.target.value })} placeholder="Address (optional)" className="h-9 rounded-lg text-xs" />
      </div>

      {/* Custom fields */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ListPlus className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium">Anything else</span>
        </div>
        {profile.customFields.map((field) => (
          <div key={field.id} className="flex items-center gap-1.5">
            <Input
              value={field.label}
              onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
              placeholder="Label (e.g. Microchip)"
              className="h-9 rounded-lg text-xs flex-1"
            />
            <Input
              value={field.value}
              onChange={(e) => updateCustomField(field.id, { value: e.target.value })}
              placeholder="Value"
              className="h-9 rounded-lg text-xs flex-1"
            />
            <button onClick={() => removeCustomField(field.id)} className="p-1.5 text-muted-foreground hover:text-destructive flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addCustomField} className="w-full h-8 rounded-lg text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add field
        </Button>
      </div>

      {/* External link */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5 text-primary" /> External link (optional)</Label>
        <Input
          value={profile.externalUrl}
          onChange={(e) => onChange({ externalUrl: e.target.value })}
          placeholder="e.g. a Facebook post or fundraiser"
          type="url"
          className="h-9 rounded-lg text-xs"
        />
      </div>

      {/* Location */}
      <div className="rounded-xl border border-border p-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium">Send location when scanned</span>
          </div>
          <Switch checked={profile.sendLocation} onCheckedChange={(v) => onChange({ sendLocation: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          If the person who scans this allows location access, you'll get an automatic email with a map link.
        </p>
      </div>
    </div>
  );
}
