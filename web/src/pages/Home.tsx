import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Home() {
  const [bib, setBib] = useState('');
  const navigate = useNavigate();

  return (
    <main className="page centered">
      <p className="eyebrow">One More Mile</p>
      <h1>Cheer them on.</h1>
      <p className="lede">
        Leave a voice message for someone running today. Enter their bib number to start.
      </p>

      <form
        className="home-cta"
        onSubmit={(e) => {
          e.preventDefault();
          if (bib.trim()) navigate(`/leave/${encodeURIComponent(bib.trim())}`);
        }}
      >
        <input
          className="bib-input"
          inputMode="numeric"
          autoFocus
          placeholder="0000"
          value={bib}
          onChange={(e) => setBib(e.target.value)}
          aria-label="Runner's bib number"
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={!bib.trim()}>
          Continue
        </button>
      </form>

      <p className="fine-print">
        Running today? Open the private link your organizer sent to hear your messages.
      </p>
    </main>
  );
}
