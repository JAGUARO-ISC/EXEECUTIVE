import React, { useEffect, useState } from 'react';
import { useTutorialStore } from '../../stores/tutorial';
import { useUi, type Page } from '../../stores/ui';

const steps: readonly [string, string, string, Page][] = [
  ['Dashboard', 'Qui trovi il riepilogo della giornata e i numeri principali.', '[data-tour="dashboard"]', 'dashboard'],
  ['Navigazione', 'Usa questa barra per cambiare sezione.', '[data-tour="calendar"]', 'dashboard'],
  ['Nuovo', 'Aggiungi appuntamenti, attività, movimenti e note.', '[data-tour="quick-add"]', 'dashboard'],
  ['Calendario', 'Organizza riunioni, promemoria e link.', '[data-tour="calendar"]', 'calendar'],
  ['Finanze', 'Controlla entrate, uscite e andamento.', '[data-tour="finance"]', 'finance'],
  ['Impostazioni', 'Gestisci lingua, valuta, backup e profilo.', '[data-tour="settings"]', 'settings'],
  ['Notifiche', 'Prova il test notifiche per verificare i promemoria.', '[data-tour="notifications"]', 'settings'],
];

type Spotlight = { top: number; left: number; width: number; height: number } | null;

export const ProductTour: React.FC = () => {
  const { step, next, back, skip } = useTutorialStore();
  const [title, body, selector, page] = steps[Math.min(step, steps.length - 1)];
  const [spotlight, setSpotlight] = useState<Spotlight>(null);
  const setPage = useUi((state) => state.setPage);

  useEffect(() => {
    setPage(page);
  }, [page, setPage]);

  useEffect(() => {
    const update = () => {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return setSpotlight(null);
      const rect = target.getBoundingClientRect();
      setSpotlight({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [selector, step]);

  return (
    <div className="tour-overlay" role="dialog" aria-label="Tutorial EXEECUTIVE">
      {spotlight && <div className="tour-spotlight" style={spotlight} aria-hidden="true" />}
      <div className="tour-connector" aria-hidden="true" />
      <div className="tour-card">
        <span className="tour-step">{step + 1} / {steps.length}</span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="tour-actions">
          <button className="ghost-btn" onClick={skip}>Salta tutorial</button>
          <span>
            <button className="ghost-btn" onClick={back} disabled={step === 0}>Indietro</button>
            <button className="primary-btn" onClick={next}>{step === steps.length - 1 ? 'Fine' : 'Avanti'}</button>
          </span>
        </div>
      </div>
    </div>
  );
};
