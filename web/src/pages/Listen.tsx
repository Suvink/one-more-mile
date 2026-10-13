import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createDevice, type Call, type Device } from '../lib/voice';

type Status = 'idle' | 'connecting' | 'playing' | 'done' | 'error';

export default function Listen() {
  const { bib } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function play() {
    if (!bib) {
      setError('This link is missing a bib number.');
      setStatus('error');
      return;
    }
    setError(null);
    setStatus('connecting');
    try {
      const device = await createDevice();
      deviceRef.current = device;
      const call = await device.connect({ params: { flow: 'listen', bib, token } });
      callRef.current = call;
      call.on('accept', () => setStatus('playing'));
      call.on('disconnect', () => {
        setStatus('done');
        device.destroy();
      });
      call.on('error', (e) => {
        setError(e?.message || 'Playback failed.');
        setStatus('error');
        device.destroy();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start playback.');
      setStatus('error');
    }
  }

  function stop() {
    callRef.current?.disconnect();
  }

  const playing = status === 'playing';
  const connecting = status === 'connecting';

  if (!bib || !token) {
    return (
      <main className="page centered">
        <div className="card">
          <p className="eyebrow">One More Mile</p>
          <h1>Invalid link</h1>
          <p className="lede">
            This messages link isn’t valid. Please open the private link your organizer sent you.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page centered">
      <div className="listen-hero">
        <p className="eyebrow">One More Mile</p>
        <h1>Your messages</h1>
        <p className="lede">
          {status === 'idle' && 'Tap play to hear everyone cheering you on.'}
          {connecting && 'Connecting…'}
          {playing && 'Playing your messages — turn it up.'}
          {status === 'done' && 'That’s all for now. Tap to listen again.'}
          {status === 'error' && 'Something went wrong.'}
        </p>

        <button
          className={`play-btn ${playing ? 'is-playing' : ''}`}
          onClick={() => (playing ? stop() : play())}
          disabled={connecting}
          aria-label={playing ? 'Stop' : 'Play all messages'}
        >
          {playing ? (
            <span className="play-pause" aria-hidden>
              <i />
              <i />
            </span>
          ) : connecting ? (
            <span className="play-load" aria-hidden>
              •••
            </span>
          ) : (
            <span className="play-tri" aria-hidden />
          )}
        </button>

        {playing && (
          <button className="btn btn-ghost btn-small" onClick={stop}>
            Stop
          </button>
        )}

        {error && <p className="error-inline">{error}</p>}

        <p className="fine-print">Plays over a secure browser connection.</p>
      </div>
    </main>
  );
}
