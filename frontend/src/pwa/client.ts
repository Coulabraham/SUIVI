import { create } from 'zustand';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const usePwaStore = create<{
  registered: boolean;
  offlineReady: boolean;
  updateAvailable: boolean;
  installed: boolean;
  installAvailable: boolean;
  error: string;
}>(() => ({
  registered: false,
  offlineReady: false,
  updateAvailable: false,
  installed: false,
  installAvailable: false,
  error: '',
}));
let prompt: InstallPrompt | null = null;
let update: ((reload?: boolean) => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let started = false;
let reloadRequested = false;
let reloadStarted = false;
let reloadOnly = false;
function reloadOnce() {
  if (reloadRequested && !reloadStarted) {
    reloadStarted = true;
    window.location.reload();
  }
}
function requireReload() {
  if (reloadStarted) return;
  if (reloadRequested) reloadOnce();
  else {
    reloadOnly = true;
    usePwaStore.setState({ updateAvailable: true });
  }
}

/** Le worker peut déjà attendre, ou avoir été installé depuis un autre onglet.
 * Sa détection ne dépend pas seulement des événements relayés par le SDK. */
export function observeUpdates(
  value: ServiceWorkerRegistration,
  hasController = () => !!navigator.serviceWorker.controller,
) {
  if (value.waiting) usePwaStore.setState({ updateAvailable: true, error: '' });
  const observe = () => {
    const worker = value.installing;
    if (!worker) return;
    let completed = worker.state === 'installed' || worker.state === 'activated';
    const changed = () => {
      if (worker.state === 'installed' || worker.state === 'activated') completed = true;
      if (worker.state === 'installed' && hasController())
        usePwaStore.setState({ updateAvailable: true, error: '' });
      if (worker.state === 'redundant' && !completed)
        usePwaStore.setState({
          error:
            'La préparation des fichiers de l’application a échoué. Gardez une connexion puis réessayez après rechargement.',
        });
    };
    worker.addEventListener('statechange', changed);
    changed();
  };
  value.addEventListener('updatefound', observe);
  observe();
}

export async function startPwa() {
  if (started) return;
  started = true;
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  usePwaStore.setState({ installed });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    usePwaStore.setState({ installAvailable: true });
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    usePwaStore.setState({ installed: true, installAvailable: false });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let previousController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const current = navigator.serviceWorker.controller;
    if (previousController && current !== previousController) requireReload();
    previousController = current;
  });
  try {
    // Import dynamique pour ne pas enregistrer de worker dans le serveur de développement.
    const { registerSW } = await import('virtual:pwa-register');
    update = registerSW({
      immediate: true,
      // Le SDK ne décide jamais de recharger un autre onglet à notre place.
      onNeedReload: requireReload,
      onOfflineReady: () => usePwaStore.setState({ offlineReady: true, error: '' }),
      onNeedRefresh: () => usePwaStore.setState({ updateAvailable: true, error: '' }),
      onRegisteredSW: (_url, value) => {
        registration = value;
        usePwaStore.setState({ registered: !!value });
        if (value)
          void navigator.serviceWorker.ready.then(() =>
            usePwaStore.setState({ offlineReady: true }),
          );
        if (value) observeUpdates(value);
      },
      onRegisterError: () =>
        usePwaStore.setState({
          error: 'Le chargement de l’application pour une réouverture sans réseau a échoué.',
        }),
    });
  } catch {
    usePwaStore.setState({ error: 'L’installation locale n’a pas pu être initialisée.' });
  }
}
export async function installApp() {
  if (!prompt) return;
  const current = prompt;
  prompt = null;
  usePwaStore.setState({ installAvailable: false, error: '' });
  try {
    await current.prompt();
    await current.userChoice;
  } catch {
    usePwaStore.setState({
      error: 'La demande d’installation n’a pas abouti. Réessayez depuis le menu du navigateur.',
    });
  }
}
export async function checkForUpdate() {
  if (!registration)
    throw new Error(
      'La version installable est disponible après un build et sur une connexion sécurisée.',
    );
  await registration.update();
}
export async function applyUpdate() {
  if (document.querySelector('dialog[open]'))
    throw new Error(
      'Terminez ou fermez le formulaire ouvert avant de mettre à jour l’application.',
    );
  if (!usePwaStore.getState().updateAvailable) throw new Error('Aucune mise à jour n’est prête.');
  if (reloadOnly) {
    reloadRequested = true;
    reloadOnce();
    return;
  }
  if (!update || !registration?.waiting)
    throw new Error(
      'La nouvelle version n’est plus en attente. Recherchez à nouveau une mise à jour.',
    );
  const activate = update;
  const previous = navigator.serviceWorker.controller;
  reloadRequested = true;
  await new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (navigator.serviceWorker.controller && navigator.serviceWorker.controller !== previous) {
        navigator.serviceWorker.removeEventListener('controllerchange', changed);
        window.clearTimeout(timer);
        reloadOnce();
        resolve();
      }
    };
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      reloadRequested = false;
      reject(
        new Error(
          'La mise à jour n’a pas été confirmée. Vos saisies sont conservées ; réessayez après les avoir enregistrées.',
        ),
      );
    }, 15000);
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    void activate(true).catch((error: unknown) => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      window.clearTimeout(timer);
      reloadRequested = false;
      reject(error);
    });
  });
}
