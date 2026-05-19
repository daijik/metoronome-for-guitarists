import { type TimeSignature, useMetronome } from "../hooks/useMetronome";
import "./Metronome.css";

const TIME_SIGNATURES: TimeSignature[] = ["2/4", "3/4", "4/4", "6/8"];

const BEATS_PER_MEASURE: Record<TimeSignature, number> = {
  "2/4": 2,
  "3/4": 3,
  "4/4": 4,
  "6/8": 6,
};

const PRESET_MINUTES = [1, 3, 5, 10, 15, 30];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Metronome() {
  const {
    isPlaying,
    bpm,
    timeSignature,
    currentBeat,
    duration,
    timeLeft,
    toggle,
    setBpm,
    setTimeSignature,
    setDuration,
  } = useMetronome();

  const totalBeats = BEATS_PER_MEASURE[timeSignature];
  const progress = duration > 0 ? timeLeft / duration : 1;

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
        <button className="bpm-btn" onClick={() => setBpm(bpm - 1)} aria-label="BPM を下げる">
          −
        </button>
        <div className="bpm-value">
          <input
            type="number"
            className="bpm-number-input"
            value={bpm}
            min={30}
            max={240}
            onChange={handleBpmNumber}
            aria-label="BPM"
          />
          <span className="bpm-label">BPM</span>
        </div>
        <button className="bpm-btn" onClick={() => setBpm(bpm + 1)} aria-label="BPM を上げる">
          ＋
        </button>
      </div>

      {/* BPM slider */}
      <input
        type="range"
        className="bpm-slider"
        min={30}
        max={240}
        value={bpm}
        onChange={handleBpmInput}
        aria-label="BPM スライダー"
      />
      <div className="bpm-range-labels">
        <span>30</span>
        <span>240</span>
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
