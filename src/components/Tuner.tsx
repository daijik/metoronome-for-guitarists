import { useTuner } from "../hooks/useTuner";
import { TUNINGS } from "../lib/pitch";
import "./Tuner.css";

// この範囲（セント）に収まっていればチューニングが合っていると見なす
const IN_TUNE_CENTS = 5;
const METER_RANGE_CENTS = 50;

export function Tuner() {
  const { isListening, pitch, tuning, error, toggle, setTuning } = useTuner();

  const isInTune = pitch !== null && Math.abs(pitch.cents) <= IN_TUNE_CENTS;

  function getStatus(): string {
    if (!isListening) return "Start を押すとマイクで音を拾います";
    if (pitch === null) return "弦を鳴らしてください";
    if (isInTune) return "OK";
    return `${pitch.targetLabel} より${pitch.cents < 0 ? "低い" : "高い"}`;
  }

  // 半音以上ズレているときは針を端で止める
  const needleCents = pitch ? Math.max(-METER_RANGE_CENTS, Math.min(METER_RANGE_CENTS, pitch.cents)) : 0;

  return (
    <div className="tuner">
      <h1 className="tuner-title">Tuner</h1>

      {/* Tuning */}
      <div className="tuner-tunings">
        {TUNINGS.map((t) => (
          <button
            key={t.id}
            className={`tuner-tuning-btn ${tuning.id === t.id ? "tuner-tuning-btn--active" : ""}`}
            aria-pressed={tuning.id === t.id}
            onClick={() => setTuning(t)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Detected note */}
      <div className={`tuner-note ${isInTune ? "tuner-note--in-tune" : ""}`}>
        {pitch ? pitch.note : "−"}
        {pitch && <span className="tuner-octave">{pitch.octave}</span>}
      </div>
      <div className="tuner-frequency">{pitch ? `${pitch.frequency.toFixed(1)} Hz` : "− Hz"}</div>

      {/* Cents meter */}
      <div className="tuner-meter">
        <div className="tuner-meter-track">
          <div className="tuner-meter-center" />
          {pitch && (
            <div
              className={`tuner-meter-needle ${isInTune ? "tuner-meter-needle--in-tune" : ""}`}
              style={{ left: `${50 + needleCents}%` }}
            />
          )}
        </div>
        <div className="tuner-meter-labels">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
      </div>
      <div className={`tuner-status ${isInTune ? "tuner-status--in-tune" : ""}`}>{getStatus()}</div>

      {/* Strings */}
      {tuning.strings.length > 0 && (
        <div className="tuner-strings">
          {tuning.strings.map((s, i) => (
            <div
              key={s.number}
              className={[
                "tuner-string",
                pitch?.stringIndex === i ? "tuner-string--active" : "",
                pitch?.stringIndex === i && isInTune ? "tuner-string--in-tune" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="tuner-string-label">{s.label}</span>
              <span className="tuner-string-number">{s.number}弦</span>
            </div>
          ))}
        </div>
      )}

      {/* Start/Stop */}
      <button className={`tuner-btn ${isListening ? "tuner-btn--stop" : "tuner-btn--start"}`} onClick={toggle}>
        {isListening ? "Stop" : "Start"}
      </button>

      {error && (
        <p className="tuner-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
