"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "recording" | "transcribing";

// Browser SpeechRecognition types (not in all TS libs)
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getMicrophonePermissionError(): string | null {
  if (typeof navigator === "undefined") {
    return "Microphone is not available in this environment.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Microphone access requires HTTPS (or localhost) in this browser.";
    }
    return "This browser does not support microphone access.";
  }
  return null;
}

function getMicrophoneRequestErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone permission was denied.";
    }
    if (error.name === "NotFoundError") {
      return "No microphone input device was found.";
    }
    if (error.name === "NotReadableError") {
      return "Microphone is in use by another app or blocked by the system.";
    }
  }
  return "Could not access the microphone.";
}

export type UseVoiceInputOptions = {
  /** If true, voice is simulated (disabled). Default false. */
  simulate?: boolean;
};

export type UseVoiceInputReturn = {
  /** Current voice state: idle | recording | transcribing */
  state: VoiceState;
  /** Latest final transcript text accumulated from voice */
  transcript: string;
  /** Live interim transcript while speaking (updates in real-time) */
  interimTranscript: string;
  /** User-facing message about voice status (error, info) */
  message: string;
  /** Toggle voice recording on/off. */
  toggle: () => Promise<void>;
  /** Clear the status message */
  clearMessage: () => void;
  /** Whether the browser supports speech recognition (set after mount) */
  isSupported: boolean;
  /** Whether speech recognition is unavailable (set after mount) */
  isUnavailable: boolean;
  /** Whether support has been detected yet (false during SSR/first render) */
  supportDetected: boolean;
};

/**
 * Shared hook for browser-based voice dictation.
 *
 * Ported from mobile usePrototypeVoice pattern, adapted for web/Next client components.
 *
 * - Uses the Web Speech API (SpeechRecognition) for transcription.
 * - Provides live interim transcript while speaking.
 * - Falls back to restrained error messages if unavailable.
 * - Does NOT fake recording or mock transcripts.
 * - Hydration-safe: isSupported/isUnavailable are only set after client mount.
 */
export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { simulate = false } = options;
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [supportDetected, setSupportDetected] = useState(false);

  const timerRef = useRef<number | undefined>(undefined);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pendingTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const fallbackStreamRef = useRef<MediaStream | null>(null);

  // Detect support only after client mount (hydration-safe)
  useEffect(() => {
    setIsSupported(getSpeechRecognitionCtor() !== null);
    setSupportDetected(true);
  }, []);

  const isUnavailable = supportDetected && !isSupported;

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      fallbackStreamRef.current?.getTracks().forEach((track) => track.stop());
      fallbackStreamRef.current = null;
    };
  }, []);

  const clearMessage = useCallback(() => setMessage(""), []);

  const finishTranscription = useCallback(() => {
    setState("transcribing");
    setInterimTranscript("");
    timerRef.current = window.setTimeout(() => {
      const pending = pendingTranscriptRef.current.trim();
      if (pending) {
        setTranscript((previous) =>
          previous.trim() ? `${previous.trim()} ${pending}` : pending
        );
        setMessage("Voice text added to the input.");
      } else {
        setMessage("No speech was captured. Try again.");
      }
      setState("idle");
    }, 280);
  }, []);

  const beginRecordingWithSpeechRecognition = useCallback((): boolean => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      return false;
    }

    pendingTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    try {
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalTextChunk = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result?.[0]?.transcript?.trim();
          if (!chunk) continue;
          if (result.isFinal) {
            finalTextChunk += `${chunk} `;
          } else {
            interimText += `${chunk} `;
          }
        }
        if (finalTextChunk) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalTextChunk}`.trim();
        }
        const combined = `${finalTranscriptRef.current} ${interimText}`.trim();
        pendingTranscriptRef.current = combined;
        // Update interim transcript live for waveform display
        setInterimTranscript(combined);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errorCode = event.error;
        const nextMessage =
          errorCode === "not-allowed" || errorCode === "service-not-allowed"
            ? "Microphone permission was denied."
            : errorCode === "audio-capture"
              ? "No microphone input device was found."
              : "Speech transcription failed. Please try again.";
        setMessage(nextMessage);
        setInterimTranscript("");
        setState("idle");
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setMessage("Could not start speech transcription.");
      setInterimTranscript("");
      setState("idle");
      return false;
    }

    setState("recording");
    return true;
  }, []);

  const toggle = useCallback(async () => {
    clearMessage();
    window.clearTimeout(timerRef.current);

    if (state === "recording") {
      const hadRecognition = Boolean(recognitionRef.current);
      fallbackStreamRef.current?.getTracks().forEach((track) => track.stop());
      fallbackStreamRef.current = null;
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;

      if (pendingTranscriptRef.current.trim()) {
        finishTranscription();
      } else if (hadRecognition) {
        setInterimTranscript("");
        setState("idle");
        setMessage("No speech was captured. Try again.");
      } else {
        setInterimTranscript("");
        setState("idle");
        setMessage("Voice captured, but transcription is unavailable in this browser.");
      }
      return;
    }

    if (simulate) {
      setMessage("Simulated voice capture is disabled.");
      return;
    }

    pendingTranscriptRef.current = "";
    finalTranscriptRef.current = "";
    setInterimTranscript("");

    const supportError = getMicrophonePermissionError();
    if (supportError) {
      setMessage(supportError);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const startedWithRecognition = beginRecordingWithSpeechRecognition();
      if (startedWithRecognition) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      fallbackStreamRef.current = stream;
      setState("recording");
      setMessage("Recording started. Transcription is unavailable in this browser.");
    } catch (error) {
      const errorMessage = getMicrophoneRequestErrorMessage(error);
      setMessage(errorMessage);
      setInterimTranscript("");
      setState("idle");
    }
  }, [state, simulate, clearMessage, finishTranscription, beginRecordingWithSpeechRecognition]);

  return {
    state,
    transcript,
    interimTranscript,
    message,
    toggle,
    clearMessage,
    isSupported,
    isUnavailable,
    supportDetected,
  };
}
