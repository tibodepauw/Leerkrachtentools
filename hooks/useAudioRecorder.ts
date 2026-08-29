"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizeAudioMediaType,
  pickRecorderMimeType,
} from "@/lib/ai/audioMediaType";

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setDuration((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    setDuration(0);
    setAudio(null);

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const rawType = recorder.mimeType || mimeType || "audio/webm";
      const normalizedType = normalizeAudioMediaType(rawType) ?? "audio/webm";
      setAudio(new Blob(chunksRef.current, { type: normalizedType }));
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function reset() {
    setAudio(null);
    setDuration(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  return { recording, duration, audio, start, stop, reset };
}
