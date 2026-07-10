import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FieldProps {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

export function Field({ label, value, onChange, type = "text", placeholder, required = true }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">
        {label}
        {required
          ? <span className="text-destructive ml-1">*</span>
          : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
        }
      </Label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary/50 border-border"
        required={required}
      />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minH?: string;
  required?: boolean;
}

export function TextAreaField({ label, value, onChange, placeholder, minH = "100px", required = true }: TextAreaFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">
        {label}
        {required
          ? <span className="text-destructive ml-1">*</span>
          : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
        }
      </Label>
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary/50 border-border"
        style={{ minHeight: minH }}
        required={required}
      />
    </div>
  );
}

interface YesNoFieldProps {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  id: string;
  required?: boolean;
}

export function YesNoField({ label, value, onChange, id, required = true }: YesNoFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">
        {label}
        {required
          ? <span className="text-destructive ml-1">*</span>
          : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
        }
      </Label>
      <RadioGroup value={value || ""} onValueChange={onChange} className="flex gap-6" required={required}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sim" id={`${id}-yes`} />
          <Label htmlFor={`${id}-yes`} className="text-foreground">Sim</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="nao" id={`${id}-no`} />
          <Label htmlFor={`${id}-no`} className="text-foreground">Não</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-primary border-b border-border pb-2 mt-4">
      {children}
    </h3>
  );
}
