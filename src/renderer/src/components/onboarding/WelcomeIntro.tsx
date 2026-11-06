import React from 'react';

interface Props { onStart: () => void; onSkip: () => void; }

export const WelcomeIntro: React.FC<Props> = ({ onStart, onSkip }) => (
  <main className="onboarding-shell">
    <section className="welcome-card">
      <div className="welcome-mark display">E</div>
      <p className="eyebrow">EXEECUTIVE</p>
      <h1>Il tuo spazio per decidere meglio.</h1>
      <p>Calendario, attività, finanze e note. Tutto in un unico posto, con dati locali e controlli chiari.</p>
      <div className="welcome-preview" aria-label="Funzioni principali">
        <span><b>01</b> Agenda senza caos</span><span><b>02</b> Numeri sempre leggibili</span><span><b>03</b> Dati sotto controllo</span>
      </div>
      <div className="welcome-actions">
        <button className="primary-btn" onClick={onStart}>Inizia tutorial</button>
        <button className="ghost-btn" onClick={onSkip}>Salta tutorial</button>
      </div>
    </section>
  </main>
);
