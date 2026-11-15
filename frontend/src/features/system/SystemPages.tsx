import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { getLiveness, getReadiness } from './api';
import { useConnectivityStore } from '../../stores/connectivity';

function useServices() {
  const api = useQuery({
    queryKey: ['health', 'live'],
    queryFn: getLiveness,
    refetchInterval: 30000,
  });
  const database = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: getReadiness,
    refetchInterval: 30000,
  });
  return { api, database };
}

function StatusCard({
  title,
  description,
  state,
  icon,
}: {
  title: string;
  description: string;
  state: 'checking' | 'available' | 'unavailable';
  icon: 'pulse' | 'database' | 'network';
}) {
  const label = { checking: 'Vérification…', available: 'Disponible', unavailable: 'Indisponible' }[
    state
  ];
  return (
    <article className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_3px_12px_#20352a04]">
      <div className="mb-7 flex items-center justify-between">
        <span className="rounded-xl bg-stone-100 p-3 text-stone-600">
          <Icon name={icon} />
        </span>
        <span
          className={`h-2 w-2 rounded-full ${state === 'available' ? 'bg-emerald-500' : state === 'checking' ? 'bg-amber-400' : 'bg-rose-500'}`}
        />
      </div>
      <h2 className="text-sm font-medium text-stone-500">{title}</h2>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{label}</p>
      <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
    </article>
  );
}

export function OverviewPage() {
  const { api, database } = useServices();
  const online = useConnectivityStore((state) => state.online);
  const state = (query: { isPending: boolean; isError: boolean }) =>
    query.isPending
      ? ('checking' as const)
      : query.isError
        ? ('unavailable' as const)
        : ('available' as const);
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">ESPACE DE TRAVAIL</p>
          <h1 className="page-title">Bienvenue dans SUIVI</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Le point de départ d’un suivi clair et fiable de vos encaissements.
          </p>
        </div>
        <span className="rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600">
          Environnement de développement
        </span>
      </div>
      <section className="relative mb-7 overflow-hidden rounded-[1.4rem] bg-[#073673] px-7 py-9 text-white sm:px-10 sm:py-11">
        <div className="pointer-events-none absolute -right-12 -top-20 h-80 w-80 rounded-full border-[45px] border-white/5" />
        <div className="pointer-events-none absolute right-28 top-28 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative max-w-xl">
          <p className="mb-4 text-xs font-semibold tracking-[.19em] text-emerald-200/80">
            UNE BASE SOLIDE, UNE VISION COMMUNE
          </p>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Chaque contribution compte.
            <br />
            Chaque étape aussi.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-emerald-50/75">
            Retrouvez vos membres, vos encaissements et la progression de votre campagne. Chaque
            responsable dispose d’un espace limité à son département.
          </p>
          <Link
            to="/connexion"
            className="mt-7 mr-3 inline-flex items-center gap-3 rounded-lg bg-[#e1eeff] px-5 py-3 text-sm font-semibold text-[#073674] transition hover:bg-white"
          >
            Accéder à mon espace <Icon name="arrow" />
          </Link>
          <Link
            to="/diagnostic"
            className="mt-7 inline-flex items-center gap-3 rounded-lg bg-[#e1eeff] px-5 py-3 text-sm font-semibold text-[#073674] transition hover:bg-white"
          >
            Consulter le diagnostic <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3" aria-live="polite">
        <StatusCard
          title="API SUIVI"
          state={state(api)}
          description="Disponibilité du serveur NestJS."
          icon="pulse"
        />
        <StatusCard
          title="Base de données"
          state={state(database)}
          description="Connexion au serveur PostgreSQL."
          icon="database"
        />
        <StatusCard
          title="Connexion réseau"
          state={online ? 'available' : 'unavailable'}
          description={
            online
              ? 'Le navigateur signale une connexion réseau.'
              : 'Le navigateur signale une perte de connexion.'
          }
          icon="network"
        />
      </div>
      {(api.error || database.error) && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          {api.error?.message ?? database.error?.message}
        </p>
      )}
      <section className="mt-8 rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Un suivi organisé</h2>
          <span className="text-xs text-stone-500">Développement progressif</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            [
              '01',
              'Données et sécurité',
              'Comptes, membres et accès contrôlés par département.',
              'Disponible en ligne',
            ],
            [
              '02',
              'Gestion des encaissements',
              'Versements, historique, corrections et objectif global.',
              'Disponible en ligne',
            ],
            [
              '03',
              'Travail hors connexion',
              'Installation et préparation locale ; accès métier hors connexion en cours de développement.',
              'Installation disponible',
            ],
          ].map(([number, title, description, status]) => (
            <div key={number} className="border-l-2 border-[#dce5d3] pl-4">
              <span className="text-xs font-semibold text-[#4883c7]">
                {number} · {status}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-stone-800">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function DiagnosticPage() {
  const { api, database } = useServices();
  const checking = api.isFetching || database.isFetching;
  return (
    <>
      <p className="eyebrow">SERVICES TECHNIQUES</p>
      <h1 className="page-title">Diagnostic de l’installation</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
        Ces contrôles interrogent les services réels. La disponibilité de l’API et celle de
        PostgreSQL sont vérifiées séparément.
      </p>
      <button
        onClick={() => {
          void Promise.all([api.refetch(), database.refetch()]);
        }}
        disabled={checking}
        className="primary-button my-7"
      >
        <Icon name="refresh" className={checking ? 'animate-spin' : ''} />
        {checking ? 'Vérification en cours…' : 'Vérifier les services'}
      </button>
      <div
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
        aria-live="polite"
      >
        {[
          { title: 'Serveur API', path: '/api/v1/health/live', query: api },
          { title: 'Connexion PostgreSQL', path: '/api/v1/health/ready', query: database },
        ].map(({ title, path, query }) => (
          <section key={path} className="border-b border-stone-100 p-6 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-stone-900">{title}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${query.isError ? 'bg-rose-50 text-rose-800' : query.isPending ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-800'}`}
              >
                {query.isError
                  ? 'Indisponible'
                  : query.isPending
                    ? 'Vérification…'
                    : 'Opérationnel'}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs text-stone-500">GET {path}</p>
            {query.data && (
              <p className="mt-3 text-sm text-stone-500">
                Dernière réponse :{' '}
                {new Intl.DateTimeFormat('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                }).format(new Date(query.data.data.checkedAt))}
              </p>
            )}
            {query.error && (
              <p role="alert" className="mt-3 text-sm leading-6 text-rose-800">
                {query.error.message}
              </p>
            )}
          </section>
        ))}
      </div>
      <a
        href="/api/v1/docs"
        target="_blank"
        rel="noreferrer"
        className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#146ac9] underline-offset-4 hover:underline"
      >
        Ouvrir la documentation Swagger <Icon name="arrow" />
      </a>
      <p className="mt-7 max-w-2xl text-sm leading-7 text-stone-500">
        Le mode PWA, l’authentification et les fonctionnalités métier seront ajoutés aux phases
        suivantes. Aucun encaissement n’est encore saisi depuis cette version.
      </p>
    </>
  );
}
