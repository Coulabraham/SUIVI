import { useState } from 'react';
import { Modal } from '../components/BusinessUi';
import { applyUpdate, usePwaStore } from './client';
export function PwaUpdateNotice() {
  const available = usePwaStore((state) => state.updateAvailable);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!available) return null;
  return (
    <>
      <aside className="notice mb-5" aria-label="Mise à jour disponible">
        <p>Une nouvelle version de SUIVI est prête. Terminez vos saisies avant de l’appliquer.</p>
        <button
          className="secondary-button mt-3"
          disabled={pending}
          onClick={() => {
            setError('');
            setConfirm(true);
          }}
        >
          Mettre à jour SUIVI
        </button>
        {error && (
          <p role="alert" className="mt-3">
            {error}
          </p>
        )}
      </aside>
      {confirm && (
        <Modal title="Mettre à jour l’application" onClose={() => setConfirm(false)}>
          <p className="text-sm leading-6">
            L’application va se recharger. Enregistrez ou annulez les formulaires en cours dans vos
            onglets avant de continuer. Les données déjà enregistrées sur l’appareil seront
            conservées.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="secondary-button" onClick={() => setConfirm(false)}>
              Plus tard
            </button>
            <button
              className="primary-button"
              disabled={pending}
              onClick={async () => {
                // Fermer notre propre confirmation avant de rechercher d'autres formulaires ouverts.
                setConfirm(false);
                setPending(true);
                try {
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                  await applyUpdate();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'La mise à jour n’a pas pu être appliquée.',
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              Recharger et appliquer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
