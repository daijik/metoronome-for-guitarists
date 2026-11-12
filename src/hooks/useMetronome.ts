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
  osc.frequency.value = isAccent ? 1400 : 800;
  gain.gain.setValueAtTime(isAccent ? 1.0 : 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.08 : 0.05));
  osc.start(time);
  osc.stop(time + (isAccent ? 0.08 : 0.05));
}

const MIN_BPM = 30;
const MAX_BPM = 240;

function clampBpm(value: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value));
}

export interface TempoUpPlan {
  /** テンポアップの回数（0 = 変化なし） */
  steps: number;
  /** 1段階あたりの長さ（秒） */
  segmentSeconds: number;
}

/**
 * 練習時間を (steps + 1) 区間に等分し、区間ごとに stepBpm ずつ上げる。
 * 最後の区間は目標 BPM で鳴らす。
 */
export function getTempoUpPlan(
  duration: number,
  baseBpm: number,
  targetBpm: number,
  stepBpm: number,
): TempoUpPlan {
  if (duration <= 0 || stepBpm <= 0 || targetBpm <= baseBpm) {
    return { steps: 0, segmentSeconds: duration };
  }
  const steps = Math.ceil((targetBpm - baseBpm) / stepBpm);
  return { steps, segmentSeconds: duration / (steps + 1) };
}

/** 経過秒数に対応する段階（0 = ベース BPM） */
export function getTempoUpStage(elapsed: number, plan: TempoUpPlan): number {
  if (plan.steps === 0 || plan.segmentSeconds <= 0) return 0;
  return Math.min(plan.steps, Math.floor(elapsed / plan.segmentSeconds));
}

function bpmForStage(stage: number, baseBpm: number, targetBpm: number, stepBpm: number): number {
  return Math.min(targetBpm, baseBpm + stage * stepBpm);
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
  /** テンポアップ機能の ON/OFF */
  tempoUpEnabled: boolean;
  /** テンポアップの目標 BPM */
  targetBpm: number;
  /** 1段階あたりの BPM 上昇幅 */
  tempoStep: number;
  /** 実際に鳴っている BPM（テンポアップ中は段階的に変化） */
  currentBpm: number;
}

export interface MetronomeControls {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  /** 練習時間を秒で設定 */
  setDuration: (seconds: number) => void;
  setTempoUpEnabled: (enabled: boolean) => void;
  setTargetBpm: (bpm: number) => void;
  setTempoStep: (step: number) => void;
}

export function useMetronome(): MetronomeState & MetronomeControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(120);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>("4/4");
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [duration, setDurationState] = useState(600); // デフォルト10分
  const [timeLeft, setTimeLeft] = useState(600);
  const [tempoUpEnabled, setTempoUpEnabledState] = useState(false);
  const [targetBpm, setTargetBpmState] = useState(160);
  const [tempoStep, setTempoStepState] = useState(5);
  const [rampBpm, setRampBpm] = useState(120);
  const [rampActive, setRampActive] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextBeatTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bpmRef = useRef(bpm);
  const timeSignatureRef = useRef(timeSignature);
  const durationRef = useRef(duration);
  const tempoUpEnabledRef = useRef(tempoUpEnabled);
  const targetBpmRef = useRef(targetBpm);
  const tempoStepRef = useRef(tempoStep);
  /** 再生開始時にテンポアップが ON だったか（再生中は切り替え不可） */
  const rampActiveRef = useRef(false);
  /** テンポアップ中に実際に鳴らす BPM */
  const rampBpmRef = useRef(bpm);
  // stop を ref で持つことで timer のクロージャ内から最新版を呼べる
  const stopRef = useRef<() => void>(() => {});

  // スケジューラ・タイマーのクロージャから最新値を読めるよう ref に同期
  useEffect(() => {
    bpmRef.current = bpm;
    timeSignatureRef.current = timeSignature;
    durationRef.current = duration;
    tempoUpEnabledRef.current = tempoUpEnabled;
    targetBpmRef.current = targetBpm;
    tempoStepRef.current = tempoStep;
  }, [bpm, timeSignature, duration, tempoUpEnabled, targetBpm, tempoStep]);

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
      const playingBpm = rampActiveRef.current ? rampBpmRef.current : bpmRef.current;
      nextBeatTimeRef.current += 60 / playingBpm;
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
    rampActiveRef.current = false;
    setRampActive(false);
    setIsPlaying(false);
    setCurrentBeat(-1);
    // タイマーを設定値に戻す
    setTimeLeft(durationRef.current);
  }, []);

  useEffect(() => {
    stopRef.current = stopMetronome;
  }, [stopMetronome]);

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

    // テンポアップ: ベース BPM から開始
    const baseBpm = bpmRef.current;
    const rampTarget = targetBpmRef.current;
    const rampStep = tempoStepRef.current;
    const plan = getTempoUpPlan(durationRef.current, baseBpm, rampTarget, rampStep);
    rampActiveRef.current = tempoUpEnabledRef.current;
    setRampActive(tempoUpEnabledRef.current);
    rampBpmRef.current = baseBpm;
    setRampBpm(baseBpm);

    schedule();
    metronomeIntervalRef.current = setInterval(schedule, SCHEDULE_INTERVAL);

    // 1秒ごとにカウントダウン
    let remaining = durationRef.current;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (rampActiveRef.current) {
        const stage = getTempoUpStage(durationRef.current - remaining, plan);
        const next = bpmForStage(stage, baseBpm, rampTarget, rampStep);
        if (next !== rampBpmRef.current) {
          rampBpmRef.current = next;
          setRampBpm(next);
        }
      }
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
    setBpmState(clampBpm(value));
  }, []);

  const setTempoUpEnabled = useCallback((enabled: boolean) => {
    setTempoUpEnabledState(enabled);
  }, []);

  const setTargetBpm = useCallback((value: number) => {
    setTargetBpmState(clampBpm(value));
  }, []);

  const setTempoStep = useCallback((value: number) => {
    setTempoStepState(Math.min(50, Math.max(1, value)));
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
    tempoUpEnabled,
    targetBpm,
    tempoStep,
    currentBpm: rampActive ? rampBpm : bpm,
    start,
    stop: stopMetronome,
    toggle,
    setBpm,
    setTimeSignature,
    setDuration,
    setTempoUpEnabled,
    setTargetBpm,
    setTempoStep,
  };
}
