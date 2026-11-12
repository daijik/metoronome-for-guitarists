import {
  type TimeSignature,
  getTempoUpPlan,
  getTempoUpStage,
  useMetronome,
} from "../hooks/useMetronome";
import "./Metronome.css";

const TIME_SIGNATURES: TimeSignature[] = ["2/4", "3/4", "4/4", "6/8"];

const BEATS_PER_MEASURE: Record<TimeSignature, number> = {
  "2/4": 2,
  "3/4": 3,
  "4/4": 4,
  "6/8": 6,
};

const PRESET_MINUTES = [1, 3, 5, 10, 15, 30];
const STEP_PRESETS = [1, 2, 5, 10];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatShortTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Metronome() {
  const {
    isPlaying,
    bpm,
    timeSignature,
    currentBeat,
    duration,
    timeLeft,
    tempoUpEnabled,
    targetBpm,
    tempoStep,
    currentBpm,
    toggle,
    setBpm,
    setTimeSignature,
    setDuration,
    setTempoUpEnabled,
    setTargetBpm,
    setTempoStep,
  } = useMetronome();

  const totalBeats = BEATS_PER_MEASURE[timeSignature];
  const progress = duration > 0 ? timeLeft / duration : 1;

  // テンポアップ
  const rampRunning = isPlaying && tempoUpEnabled;
  const bpmLocked = rampRunning;
  const displayBpm = rampRunning ? currentBpm : bpm;
  const plan = getTempoUpPlan(duration, bpm, targetBpm, tempoStep);
  const elapsed = duration - timeLeft;
  const stage = getTempoUpStage(elapsed, plan);
  const nextStepIn = (stage + 1) * plan.segmentSeconds - elapsed;
  const tempoUpInvalid = tempoUpEnabled && plan.steps === 0;

  function handleTargetBpm(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setTargetBpm(v);
  }

  function handleBpmInput(e: React.ChangeEvent<HTMLInputElement>) {
    setBpm(Number(e.target.value));
  }

  function handleBpmNumber(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setBpm(v);
  }

  function handleDurationMinutes(e: React.ChangeEvent<HTMLInputElement>) {
    const mins = parseInt(e.target.value, 10);
    if (!isNaN(mins) && mins >= 0) setDuration(mins * 60);
  }

  return (
    <div className="metronome">
      <h1 className="metronome-title">Metronome</h1>

      {/* Beat indicators */}
      <div className="beat-indicators">
        {Array.from({ length: totalBeats }, (_, i) => (
          <div
            key={i}
            className={[
              "beat-dot",
              i === 0 ? "beat-dot--accent" : "",
              currentBeat === i ? "beat-dot--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>

      {/* Timer display */}
      <div className="timer-section">
        <div className={`timer-display ${isPlaying && timeLeft <= 10 ? "timer-display--urgent" : ""}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="timer-progress-bar">
          <div className="timer-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="timer-controls">
          <span className="timer-label">練習時間</span>
          <div className="timer-presets">
            {PRESET_MINUTES.map((min) => (
              <button
                key={min}
                className={`preset-btn ${duration === min * 60 ? "preset-btn--active" : ""}`}
                onClick={() => setDuration(min * 60)}
                disabled={isPlaying}
              >
                {min}m
              </button>
            ))}
          </div>
          <div className="timer-custom">
            <input
              type="number"
              className="timer-number-input"
              value={Math.floor(duration / 60)}
              min={1}
              max={180}
              onChange={handleDurationMinutes}
              disabled={isPlaying}
              aria-label="練習時間（分）"
            />
            <span className="timer-unit">分</span>
          </div>
        </div>
      </div>

      {/* BPM display */}
      <div className="bpm-display">
        <button
          className="bpm-btn"
          onClick={() => setBpm(bpm - 1)}
          disabled={bpmLocked}
          aria-label="BPM を下げる"
        >
          −
        </button>
        <div className="bpm-value">
          <input
            type="number"
            className="bpm-number-input"
            value={displayBpm}
            min={30}
            max={240}
            onChange={handleBpmNumber}
            disabled={bpmLocked}
            aria-label="BPM"
          />
          <span className="bpm-label">{tempoUpEnabled ? "ベース BPM" : "BPM"}</span>
        </div>
        <button
          className="bpm-btn"
          onClick={() => setBpm(bpm + 1)}
          disabled={bpmLocked}
          aria-label="BPM を上げる"
        >
          ＋
        </button>
      </div>

      {/* BPM slider */}
      <input
        type="range"
        className="bpm-slider"
        min={30}
        max={240}
        value={displayBpm}
        onChange={handleBpmInput}
        disabled={bpmLocked}
        aria-label="BPM スライダー"
      />
      <div className="bpm-range-labels">
        <span>30</span>
        <span>240</span>
      </div>

      {/* Tempo up */}
      <div className={`tempo-up ${tempoUpEnabled ? "tempo-up--on" : ""}`}>
        <label className="tempo-up-switch">
          <input
            type="checkbox"
            role="switch"
            checked={tempoUpEnabled}
            onChange={(e) => setTempoUpEnabled(e.target.checked)}
            disabled={isPlaying}
          />
          <span className="tempo-up-switch-track" aria-hidden="true" />
          <span className="tempo-up-switch-label">テンポアップ</span>
        </label>

        {tempoUpEnabled && (
          <div className="tempo-up-body">
            <div className="tempo-up-row">
              <span className="tempo-up-field-label">目標 BPM</span>
              <input
                type="number"
                className="timer-number-input tempo-up-target-input"
                value={targetBpm}
                min={30}
                max={240}
                onChange={handleTargetBpm}
                disabled={isPlaying}
                aria-label="目標 BPM"
              />
            </div>
            <div className="tempo-up-row">
              <span className="tempo-up-field-label">上げ幅</span>
              <div className="timer-presets">
                {STEP_PRESETS.map((st) => (
                  <button
                    key={st}
                    className={`preset-btn ${tempoStep === st ? "preset-btn--active" : ""}`}
                    onClick={() => setTempoStep(st)}
                    disabled={isPlaying}
                  >
                    +{st}
                  </button>
                ))}
              </div>
            </div>

            {tempoUpInvalid ? (
              <p className="tempo-up-info tempo-up-info--warn">
                目標 BPM をベース BPM（{bpm}）より大きくしてください
              </p>
            ) : rampRunning ? (
              <p className="tempo-up-info">
                {bpm} → {targetBpm} BPM ・ 段階 {stage}/{plan.steps}
                {stage < plan.steps && <> ・ 次のアップまで {formatShortTime(nextStepIn)}</>}
              </p>
            ) : (
              <p className="tempo-up-info">
                {bpm} → {targetBpm} BPM を {plan.steps} 回に分けて +{tempoStep} ずつ
                （{formatShortTime(plan.segmentSeconds)} ごと）
              </p>
            )}
          </div>
        )}
      </div>

      {/* Start/Stop */}
      <button
        className={`play-btn ${isPlaying ? "play-btn--stop" : "play-btn--start"}`}
        onClick={toggle}
      >
        {isPlaying ? "Stop" : "Start"}
      </button>

      {/* Time signature */}
      <div className="time-sig-section">
        <span className="time-sig-label">拍子</span>
        <div className="time-sig-buttons">
          {TIME_SIGNATURES.map((ts) => (
            <button
              key={ts}
              className={`time-sig-btn ${timeSignature === ts ? "time-sig-btn--active" : ""}`}
              onClick={() => setTimeSignature(ts)}
            >
              {ts}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
