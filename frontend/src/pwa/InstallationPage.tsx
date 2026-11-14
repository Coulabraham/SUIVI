import { useEffect, useState } from 'react';
import { checkForUpdate, installApp, usePwaStore } from './client';
import { inspectLocalStorage, requestPersistentStorage, saveDeviceLabel } from './storage';

const capacity = (value: number | null) =>
  value === null
    ? 'Non indiqué par le navigateur'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1024 / 1024) +
      ' Mo';
export function InstallationPage() {
  const pwa = usePwaStore();
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof inspectLocalStorage>> | null>(
    null,
  );
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = async () => {
    const next = await inspectLocalStorage();
    setStorage(next);
    setLabel(next.label);
  };
  useEffect(() => {
    let mounted = true;
    void inspectLocalStorage()
      .then((next) => {
        if (mounted) {
          setStorage(next);
          setLabel(next.label);
        }
      })
      .catch(() => {
        if (mounted)
          setError(
            'Le stockage local est indisponible. Vérifiez les réglages ou le mode privé de votre navigateur.',
          );
      });
    return () => {
      mounted = false;
    };
  }, []);
  const action = async (run: () => Promise<void>) => {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’action a échoué.');
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <p className="eyebrow">SUR CET APPAREIL</p>
      <h1 className="page-title mt-2">Installer SUIVI</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
        Retrouvez SUIVI depuis l’écran d’accueil et vérifiez la disponibilité de son stockage local.
      </p>
      {(error || pwa.error) && (
        <p role="alert" className="error-box mt-5">
          {error || pwa.error}
        </p>
      )}
      {message && (
        <p role="status" className="notice mt-5">
          {message}
        </p>
      )}
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="text-lg font-semibold">Application</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-stone-500">Installation</dt>
              <dd className="mt-1">
                {pwa.installed ? 'Application installée' : 'Ouverte dans le navigateur'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Réouverture sans réseau</dt>
              <dd className="mt-1">
                {pwa.offlineReady
                  ? 'Fichiers de l’application disponibles sur cet appareil'
                  : import.meta.env.DEV
                    ? 'À vérifier avec la version compilée'
                    : 'Préparation ou vérification en cours'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Nouvelle version</dt>
              <dd className="mt-1">
                {pwa.updateAvailable ? 'Une mise à jour est prête' : 'Aucune mise à jour signalée'}
              </dd>
            </div>
          </dl>
          {pwa.installAvailable && !pwa.installed && (
            <button className="primary-button mt-5" onClick={() => void installApp()}>
              Installer sur cet appareil
            </button>
          )}
          {!pwa.installed && !pwa.installAvailable && (
            <p className="mt-5 text-sm leading-6 text-stone-500">
              Si votre navigateur le propose, ouvrez son menu puis choisissez « Installer
              l’application » ou « Ajouter à l’écran d’accueil ». Sur iPhone ou iPad, cette commande
              se trouve dans le menu de partage. L’installation peut ne pas être proposée dans un
              navigateur intégré.
            </p>
          )}
          {pwa.registered && (
            <button
              className="secondary-button mt-5"
              disabled={pending}
              onClick={() =>
                void action(async () => {
                  await checkForUpdate();
                  setMessage('La recherche de mise à jour est terminée.');
                })
              }
            >
              Rechercher une mise à jour
            </button>
          )}
        </section>
        <section className="panel">
          <h2 className="text-lg font-semibold">Stockage de cet appareil</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-stone-500">Base locale</dt>
              <dd className="mt-1">
                {storage ? 'Disponible' : error ? 'Indisponible' : 'Vérification…'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Espace utilisé par SUIVI</dt>
              <dd className="mt-1">{capacity(storage?.usage ?? null)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Capacité indiquée</dt>
              <dd className="mt-1">{capacity(storage?.quota ?? null)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Protection contre l’effacement automatique</dt>
              <dd className="mt-1">
                {storage?.persistent === true
                  ? 'Accordée par le navigateur'
                  : storage?.persistent === false
                    ? 'Non accordée'
                    : 'Non indiquée par le navigateur'}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-6 text-stone-500">
            Le stockage local peut être effacé par le navigateur ou par l’utilisateur. Sa protection
            réduit le risque d’effacement automatique ; elle ne remplace pas une sauvegarde.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => void action(refresh)}
            >
              Vérifier le stockage
            </button>
            {storage &&
              storage.persistent !== true &&
              typeof navigator.storage?.persist === 'function' && (
                <button
                  className="secondary-button"
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      const accepted = await requestPersistentStorage();
                      await refresh();
                      setMessage(
                        accepted
                          ? 'Le navigateur a accordé la protection du stockage.'
                          : 'Le navigateur n’a pas accordé la protection. Les données locales peuvent encore être effacées automatiquement.',
                      );
                    })
                  }
                >
                  Demander la protection du stockage
                </button>
              )}
          </div>
        </section>
      </div>
      {storage && (
        <section className="panel mt-6 max-w-2xl">
          <h2 className="text-lg font-semibold">Nom de cet appareil</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Ce nom sera associé à vos prochaines connexions, pour reconnaître l’appareil dans le
            suivi des accès. Évitez d’y inscrire des informations personnelles.
          </p>
          <form
            className="form-grid mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await saveDeviceLabel(label);
                setMessage('Le nom de l’appareil est enregistré localement.');
              });
            }}
          >
            <label>
              Nom de l’appareil
              <input
                required
                maxLength={80}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <button className="primary-button w-fit" disabled={pending}>
              Enregistrer le nom
            </button>
          </form>
        </section>
      )}
      <p className="notice mt-6">
        L’ouverture de l’application sans réseau est disponible après sa préparation. L’accès hors
        connexion aux données des membres et aux encaissements n’est pas encore activé ; une
        opération n’est validée qu’après confirmation du serveur.
      </p>
    </>
  );
}
