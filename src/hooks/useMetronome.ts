import { useCallback, useEffect, useRef, useState } from "react";

export type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8";

const BEATS_PER_MEASURE: Record<TimeSignature, number> = {
  "2/4": 2,
  "3/4": 3,
  "4/4": 4,
  "6/8": 6,
};

const LOOKAHEAD = 0.1;
const SCHEDULE_INTERVAL = 25;

function scheduleClick(ctx: AudioContext, time: number, isAccent: boolean): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = isAccent ? 1000 : 800;
  gain.gain.setValueAtTime(isAccent ? 0.8 : 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.start(time);
  osc.stop(time + 0.05);
}

export interface MetronomeState {
  isPlaying: boolean;
  bpm: number;
  timeSignature: TimeSignature;
  currentBeat: number;
  /** 設定された練習時間（秒）。0 = タイマーなし */
  duration: number;
  /** 残り時間（秒）。再生中のみカウントダウン */
  timeLeft: number;
}

export interface MetronomeControls {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  /** 練習時間を秒で設定 */
  setDuration: (seconds: number) => void;
}

export function useMetronome(): MetronomeState & MetronomeControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(120);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>("4/4");
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [duration, setDurationState] = useState(600); // デフォルト10分
  const [timeLeft, setTimeLeft] = useState(600);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextBeatTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bpmRef = useRef(bpm);
  const timeSignatureRef = useRef(timeSignature);
  const durationRef = useRef(duration);
  // stop を ref で持つことで timer のクロージャ内から最新版を呼べる
  const stopRef = useRef<() => void>(() => {});

  bpmRef.current = bpm;
  timeSignatureRef.current = timeSignature;
  durationRef.current = duration;

  const schedule = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const totalBeats = BEATS_PER_MEASURE[timeSignatureRef.current];
    while (nextBeatTimeRef.current < ctx.currentTime + LOOKAHEAD) {
      const beat = beatIndexRef.current % totalBeats;
      scheduleClick(ctx, nextBeatTimeRef.current, beat === 0);
      const delay = (nextBeatTimeRef.current - ctx.currentTime) * 1000;
      const scheduledBeat = beat;
      setTimeout(() => setCurrentBeat(scheduledBeat), Math.max(0, delay));
      nextBeatTimeRef.current += 60 / bpmRef.current;
      beatIndexRef.current += 1;
    }
  }, []);

  const stopMetronome = useCallback(() => {
    if (metronomeIntervalRef.current !== null) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(-1);
    // タイマーを設定値に戻す
    setTimeLeft(durationRef.current);
  }, []);

  stopRef.current = stopMetronome;

  const start = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    beatIndexRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;

    // タイマーを設定値から開始
    setTimeLeft(durationRef.current);

    schedule();
    metronomeIntervalRef.current = setInterval(schedule, SCHEDULE_INTERVAL);

    // 1秒ごとにカウントダウン
    let remaining = durationRef.current;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        stopRef.current();
      }
    }, 1000);

    setIsPlaying(true);
  }, [schedule]);

  const toggle = useCallback(() => {
    if (isPlaying) stopMetronome();
    else start();
  }, [isPlaying, start, stopMetronome]);

  const setBpm = useCallback((value: number) => {
    setBpmState(Math.min(240, Math.max(30, value)));
  }, []);

  const setTimeSignature = useCallback((ts: TimeSignature) => {
    setTimeSignatureState(ts);
    beatIndexRef.current = 0;
  }, []);

  const setDuration = useCallback((seconds: number) => {
    const clamped = Math.max(0, seconds);
    setDurationState(clamped);
    setTimeLeft(clamped);
  }, []);

  useEffect(() => {
    return () => {
      if (metronomeIntervalRef.current !== null) clearInterval(metronomeIntervalRef.current);
      if (timerIntervalRef.current !== null) clearInterval(timerIntervalRef.current);
      ctxRef.current?.close();
    };
  }, []);

  return {
    isPlaying,
    bpm,
    timeSignature,
    currentBeat,
    duration,
    timeLeft,
    start,
    stop: stopMetronome,
    toggle,
    setBpm,
    setTimeSignature,
    setDuration,
  };
}
