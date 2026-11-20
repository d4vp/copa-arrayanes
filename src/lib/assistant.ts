"use client";

import { localParse, type AssistantRequest, type AssistantResult, type Candidate } from "@shared/asistente";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBackend } from "./data/store";
import type { Snapshot } from "./data/backend";
import { appError, AppError, toAppError } from "./errors";

/** Partidos que el asistente puede llenar, con equipos y plantillas activas. */
export function buildCandidates(d: Snapshot, matchIds: string[]): Candidate[] {
  const team = (id: string) => {
    const t = d.teams.find((x) => x.id === id)!;
    return {
      id: t.id, name: t.name, short_name: t.short_name,
      players: d.players.filter((p) => p.team_id === id && p.active).map((p) => ({ id: p.id, name: p.full_name, number: p.number })),
    };
  };
  return matchIds
    .map((id) => d.matches.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.home_team_id && m.away_team_id))
    .map((m) => {
      const home = team(m.home_team_id!), away = team(m.away_team_id!);
      return { match_id: m.id, label: `${home.name} vs ${away.name}`, knockout: !["liga", "grupo"].includes(m.stage), home, away };
    });
}

/**
 * Llama al asistente. Si la IA no está configurada y hay texto,
 * usa el lector gratuito local para no dejar al usuario sin opción.
 */
export async function runAssistant(req: AssistantRequest): Promise<AssistantResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine && req.images?.length) {
    throw appError("sin_conexion", "Leer fotos necesita internet. Sin señal puedes dictar o registrar a mano.");
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return localParse(req.text ?? "", req.candidates);
  try {
    return await getBackend().assistant(req);
  } catch (err) {
    const e = toAppError(err);
    if ((e.code === "no_configurado" || e.kind === "sin_conexion") && req.text?.trim()) return localParse(req.text, req.candidates);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Dictado por voz (Web Speech API: gratis en Chrome/Android, necesita internet)
// ---------------------------------------------------------------------------

interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  return C ? new C() : null;
}

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "Permite el uso del micrófono en el navegador para dictar.",
  "service-not-allowed": "Permite el uso del micrófono en el navegador para dictar.",
  network: "El dictado por voz necesita internet. Puedes escribir el resultado.",
  "audio-capture": "No se encontró micrófono.",
};

/** Hook de dictado: agrega lo reconocido al texto. Android corta tras silencios, así que se reinicia solo. */
export function useDictation(onText: (chunk: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<AppError | null>(null);
  const rec = useRef<SpeechRec | null>(null);
  const want = useRef(false);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => { setSupported(getRecognition() !== null); return () => { want.current = false; rec.current?.stop(); }; }, []);

  const start = useCallback(() => {
    const r = getRecognition();
    if (!r) return;
    setError(null);
    r.lang = "es-CO"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else partial += res[0].transcript;
      }
      setInterim(partial);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      want.current = false;
      setError(appError("validacion", SPEECH_ERRORS[e.error] ?? "No se pudo usar el dictado. Puedes escribir el resultado."));
    };
    r.onend = () => {
      setInterim("");
      if (want.current) { try { r.start(); } catch { want.current = false; setListening(false); } }
      else setListening(false);
    };
    rec.current = r;
    want.current = true;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, []);

  const stop = useCallback(() => { want.current = false; rec.current?.stop(); setListening(false); }, []);

  return { supported, listening, interim, error, start, stop };
}

/** Foto de planilla: 1600 px JPEG mantiene legible la letra a mano sin pesar demasiado (~300 KB). */
export async function photoToDataUrl(file: File): Promise<string> {
  const { compressImage } = await import("./image");
  const blob = await compressImage(file, 1600, 0.82, "image/jpeg");
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(appError("validacion", "No se pudo leer la foto."));
    fr.readAsDataURL(blob);
  });
}
