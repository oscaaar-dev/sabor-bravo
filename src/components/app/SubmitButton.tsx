"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}

/** Botón de envío que se desactiva mientras la acción está en curso (evita dobles envíos). */
export function SubmitButton({ children, pendingText = "Enviando…", className = "btn-brutal btn-coral" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
