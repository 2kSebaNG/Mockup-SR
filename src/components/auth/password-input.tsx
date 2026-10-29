import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/** A password field with an eye to show what was typed, for every place that asks for one. */
export function PasswordInput({ className, disabled, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`password-input${className ? ` ${className}` : ""}`}>
      <Input {...props} disabled={disabled} type={visible ? "text" : "password"} />
      <button type="button" className="password-toggle" disabled={disabled} aria-pressed={visible} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
