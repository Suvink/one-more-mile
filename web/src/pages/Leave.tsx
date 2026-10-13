import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lookupRunner, createDevice, type Call, type Device, type Runner } from '../lib/voice';

type Status = 'idle' | 'connecting' | 'recording' | 'saving' | 'sent' | 'error';

export default function Leave() {
  const { bib: bibParam } = useParams();
  const navigate = useNavigate();

  const [bib, setBib] = useState(bibParam ?? '');
  const [runner, setRunner] = useState<Runner | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [fromName, setFromName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  // Debounced bib -> name lookup.
  useEffect(() => {
    const value = bib.trim();
    setRunner(null);
    setLookupError(null);
    if (!value) return;

    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await lookupRunner(value);
        if (!cancelled) setRunner(r);
      } catch (e) {
        if (!cancelled) setLookupError(e instanceof Error ? e.message : 'Could not check that bib.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bib]);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function startRecording() {
    if (!runner) return;
    setError(null);
    setStatus('connecting');
    try {
      const device = await createDevice();
      deviceRef.current = device;
      const call = await device.connect({
        params: { flow: 'record', bib: runner.bib, from: fromName.trim() },
      });
      callRef.current = call;
      call.on('accept', () => setStatus('recording'));
      call.on('disconnect', () => {
        setStatus('sent');
        device.destroy();
      });
      call.on('error', (e) => {
        setError(e?.message || 'Call failed.');
        setStatus('error');
        device.destroy();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
      setStatus('error');
    }
  }

  function stopAndSend() {
    // '#' ends the <Record>; Twilio then saves it via /record/save and hangs up.
    setStatus('saving');
    callRef.current?.sendDigits('#');
  }

  if (status === 'sent') {
    return (
      <main className="page centered">
        <div className="card success">
          <div className="big-check">✓</div>
          <h1>Message sent</h1>
          <p className="lede">{runner?.name} will hear from you. Thanks for cheering them on.</p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 22 }}
            onClick={() => {
              setFromName('');
              setStatus('idle');
            }}
          >
            Leave another
          </button>
        </div>
      </main>
    );
  }

  const recording = status === 'recording';
  const busy = status === 'connecting' || status === 'saving';

  return (
    <main className="page">
      <button className="link-back" onClick={() => navigate('/')} disabled={recording || busy}>
        ← Back
      </button>
      <p className="eyebrow">One More Mile</p>
      <h1>Leave a message</h1>

      <label className="field">
        <span>Runner's bib number</span>
        <input
          className="bib-input"
          inputMode="numeric"
          placeholder="0000"
          value={bib}
          disabled={recording || busy}
          onChange={(e) => setBib(e.target.value)}
        />
      </label>

      {checking && <p className="hint">Checking…</p>}
      {lookupError && <p className="error-inline">{lookupError}</p>}
      {runner && (
        <div className="confirm">
          <span className="lbl tnum">Bib {runner.bib}</span>
          <span className="who">{runner.name}</span>
        </div>
      )}

      {runner && (
        <>
          <label className="field">
            <span>Your name</span>
            <input
              placeholder="So they know who it's from"
              value={fromName}
              disabled={recording || busy}
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>

          {error && <p className="error-inline">{error}</p>}

          {status === 'idle' || status === 'error' ? (
            <button
              className="btn btn-primary btn-block"
              disabled={!fromName.trim()}
              onClick={startRecording}
            >
              Start recording
            </button>
          ) : recording ? (
            <div className="recording-live">
              <div className="rec-dot pulse" aria-hidden />
              <span>Recording — speak now</span>
              <button className="btn btn-stop btn-small" onClick={stopAndSend}>
                Stop &amp; send
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled>
              {status === 'connecting' ? 'Connecting…' : 'Saving…'}
            </button>
          )}

          <p className="fine-print">
            Your message records over a secure browser connection.
          </p>
        </>
      )}
    </main>
  );
}
