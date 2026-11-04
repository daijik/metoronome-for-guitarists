import { useCallback, useEffect, useRef, useState } from "react";
import { analyzePitch, detectPitch, type PitchInfo, STANDARD_TUNING, type Tuning } from "../lib/pitch";

// 48kHz で約 85ms。Low E の周期（約 12ms）を十分に含む長さ
const FFT_SIZE = 4096;
const DETECT_INTERVAL = 50;
const HISTORY_SIZE = 5;
// 音が途切れてから表示を消すまでの時間（ms）
const HOLD_TIME = 500;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "マイクの使用が許可されていません。ブラウザの設定を確認してください。";
    if (error.name === "NotFoundError") return "マイクが見つかりません。";
  }
  return "マイクを開始できませんでした。";
}

export interface TunerState {
  isListening: boolean;
  /** 検出中の音程。音が鳴っていなければ null */
  pitch: PitchInfo | null;
  tuning: Tuning;
  error: string | null;
}

export interface TunerControls {
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
  setTuning: (tuning: Tuning) => void;
}

export function useTuner(): TunerState & TunerControls {
  const [isListening, setIsListening] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [tuning, setTuning] = useState<Tuning>(STANDARD_TUNING);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // マイク許可待ちの間に stop された場合に、古い start の続きを捨てるための ID
  const sessionRef = useRef(0);

  const release = useCallback(() => {
    sessionRef.current += 1;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setIsListening(false);
    setFrequency(null);
  }, [release]);

  const start = useCallback(async () => {
    release();
    const session = sessionRef.current;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("この環境ではマイクを使用できません。HTTPS のページで開いてください。");
      return;
    }

    // ジェスチャー直後に作ることで、iOS Safari でも suspended のままにならない
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();
    setIsListening(true);

    let stream: MediaStream;
    try {
      // ブラウザの音声処理は楽器の音を削ってしまうので無効にする
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      if (session !== sessionRef.current) return;
      stop();
      setError(getErrorMessage(e));
      return;
    }
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    // destination には繋がない（マイク音をスピーカーから出さない）
    ctx.createMediaStreamSource(stream).connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const history: number[] = [];
    let lastDetectedAt = 0;

    intervalRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const detected = detectPitch(buffer, ctx.sampleRate);
      const now = performance.now();

      if (detected !== null) {
        history.push(detected);
        if (history.length > HISTORY_SIZE) history.shift();
        lastDetectedAt = now;
        setFrequency(median(history));
      } else if (now - lastDetectedAt > HOLD_TIME) {
        history.length = 0;
        setFrequency(null);
      }
    }, DETECT_INTERVAL);
  }, [release, stop]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => release, [release]);

  const pitch = frequency === null ? null : analyzePitch(frequency, tuning);

  return { isListening, pitch, tuning, error, start, stop, toggle, setTuning };
}
