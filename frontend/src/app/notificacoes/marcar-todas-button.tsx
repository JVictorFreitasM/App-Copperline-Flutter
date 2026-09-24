"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SecondaryButton } from "@/components/design/button";
import { marcarTodasComoLidas } from "./actions";

export function MarcarTodasButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <SecondaryButton
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await marcarTodasComoLidas();
          router.refresh();
        });
      }}
    >
      {pending ? "Marcando..." : "Marcar todas como lidas"}
    </SecondaryButton>
  );
}
