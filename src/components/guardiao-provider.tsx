import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGuardianAppearances, useSettings } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { maisRaro, podeAparecer, type GuardiaoAnimado } from "@/lib/guardiao-animacao";
import { GuardiaoOverlay } from "@/components/guardiao-overlay";

type Ctx = { disparar: (...ids: GuardiaoAnimado[]) => void };

const GuardiaoCtx = createContext<Ctx>({ disparar: () => {} });

export function useGuardiaoAnimado() {
  return useContext(GuardiaoCtx);
}

/** Monta o overlay uma única vez e aplica as regras de raridade antes de exibir. */
export function GuardiaoProvider({ children }: { children: ReactNode }) {
  const hoje = todayISO();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: historico = [] } = useGuardianAppearances();
  const [atual, setAtual] = useState<GuardiaoAnimado | null>(null);
  const ocupado = useRef(false);

  const disparar = useCallback(
    (...ids: GuardiaoAnimado[]) => {
      if (ocupado.current || atual) return;
      const escolhido = maisRaro(ids.filter((id) => podeAparecer(id, historico, hoje)));
      if (!escolhido) return;
      ocupado.current = true;
      setAtual(escolhido);
      void (async () => {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        await supabase
          .from("guardian_appearances")
          .upsert(
            { user_id: data.user.id, guardiao: escolhido, shown_on: hoje },
            { onConflict: "user_id,guardiao,shown_on" },
          );
        qc.invalidateQueries({ queryKey: ["guardian-appearances"] });
      })();
    },
    [atual, historico, hoje, qc],
  );

  return (
    <GuardiaoCtx.Provider value={{ disparar }}>
      {children}
      {atual && (
        <GuardiaoOverlay
          id={atual}
          comSom={settings?.guardian_sounds_enabled ?? true}
          onFim={() => {
            setAtual(null);
            ocupado.current = false;
          }}
        />
      )}
    </GuardiaoCtx.Provider>
  );
}
