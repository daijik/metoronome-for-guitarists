const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const SHARP_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// 7弦ギターの Low B（約 62Hz）から 1 弦 24 フレット（約 1319Hz）までをカバー
const MIN_FREQUENCY = 60;
const MAX_FREQUENCY = 1400;
const MIN_RMS = 0.005;
const YIN_THRESHOLD = 0.15;

// 標準チューニングの開放弦の MIDI ノート番号。6弦 → 1弦の順
const STANDARD_STRING_MIDIS = [40, 45, 50, 55, 59, 64];

export interface TuningString {
  number: number;
  label: string;
  midi: number;
}

export interface Tuning {
  id: string;
  label: string;
  /** 開放弦。6弦 → 1弦の順。空ならどの半音にも合わせられるクロマチックモード */
  strings: TuningString[];
}

function getNoteParts(midi: number, useFlats: boolean): { note: string; octave: number } {
  const names = useFlats ? FLAT_NOTE_NAMES : SHARP_NOTE_NAMES;
  return { note: names[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 };
}

function getNoteLabel(midi: number, useFlats: boolean): string {
  const { note, octave } = getNoteParts(midi, useFlats);
  return `${note}${octave}`;
}

function createStrings(offset: number, useFlats: boolean): TuningString[] {
  return STANDARD_STRING_MIDIS.map((standardMidi, i) => {
    const midi = standardMidi + offset;
    return { number: 6 - i, label: getNoteLabel(midi, useFlats), midi };
  });
}

export const STANDARD_TUNING: Tuning = { id: "standard", label: "標準", strings: createStrings(0, false) };

export const TUNINGS: Tuning[] = [
  STANDARD_TUNING,
  { id: "half-step-down", label: "半音下げ", strings: createStrings(-1, true) },
  { id: "chromatic", label: "クロマチック", strings: [] },
];

export interface PitchInfo {
  frequency: number;
  /** 最も近い音名（例: "A", "C#"） */
  note: string;
  octave: number;
  /** 合わせる音の表記（例: "E♭2"） */
  targetLabel: string;
  /** 合わせる音とのズレ（セント）。半音以上離れていると ±50 を超える */
  cents: number;
  /** 合わせる弦の Tuning.strings 上のインデックス。クロマチックモードでは null */
  stringIndex: number | null;
}

function frequencyToMidi(frequency: number): number {
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
}

export function analyzePitch(frequency: number, tuning: Tuning): PitchInfo {
  const exactMidi = frequencyToMidi(frequency);
  const nearestMidi = Math.round(exactMidi);
  // 半音下げのときは弦の表記に合わせてフラットで表示する
  const useFlats = tuning.strings.some((s) => s.label.includes("♭"));

  let stringIndex: number | null = null;
  tuning.strings.forEach((s, i) => {
    if (stringIndex === null || Math.abs(exactMidi - s.midi) < Math.abs(exactMidi - tuning.strings[stringIndex].midi)) {
      stringIndex = i;
    }
  });

  const targetString = stringIndex === null ? null : tuning.strings[stringIndex];
  const targetMidi = targetString ? targetString.midi : nearestMidi;

  return {
    frequency,
    ...getNoteParts(nearestMidi, useFlats),
    targetLabel: targetString ? targetString.label : getNoteLabel(nearestMidi, useFlats),
    cents: (exactMidi - targetMidi) * 100,
    stringIndex,
  };
}

/** YIN 法で基本周波数を検出する。音が小さい、または周期性がなければ null */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  let energy = 0;
  for (let i = 0; i < buffer.length; i++) energy += buffer[i] * buffer[i];
  if (Math.sqrt(energy / buffer.length) < MIN_RMS) return null;

  const tauMin = Math.floor(sampleRate / MAX_FREQUENCY);
  const tauMax = Math.ceil(sampleRate / MIN_FREQUENCY);
  const windowSize = buffer.length - tauMax;
  if (windowSize <= 0) return null;

  // 累積平均正規化差分関数
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const diff = buffer[i] - buffer[i + tau];
      sum += diff * diff;
    }
    runningSum += sum;
    cmnd[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1;
  }

  for (let tau = tauMin; tau < tauMax; tau++) {
    if (cmnd[tau] >= YIN_THRESHOLD) continue;
    while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;

    // 放物線補間でサンプル間の谷の位置を推定
    const prev = cmnd[tau - 1];
    const curr = cmnd[tau];
    const next = cmnd[tau + 1];
    const denominator = prev - 2 * curr + next;
    const offset = denominator !== 0 ? (prev - next) / (2 * denominator) : 0;
    return sampleRate / (tau + offset);
  }
  return null;
}
