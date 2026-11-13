import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ApiResponse, DashboardView } from '@suivi/contracts';
import { api } from '../../services/api';
import { useAuthStore, useAuthScope } from '../../stores/auth';
import { PageHeader, QueryState } from '../../components/BusinessUi';
import { dateTime, fcfa } from '../../hooks/business';
import { objectiveStatus } from '../objectives/status';

export function DashboardPage() {
  const scope = useAuthScope();
  const user = useAuthStore((s) => s.user)!;
  const admin = user.role === 'SUPER_ADMIN';
  const [params] = useSearchParams();
  const objectiveId = params.get('objectiveId');
  const query = useQuery({
    queryKey: ['/dashboard', scope, objectiveId],
    queryFn: async () =>
      (
        await api.get<ApiResponse<DashboardView>>('/dashboard', {
          params: objectiveId ? { objectiveId } : {},
        })
      ).data.data,
    refetchInterval: 60000,
  });
  const data = query.data;
  const maximum =
    data?.departments.reduce(
      (max, d) => (BigInt(d.totalAmount) > max ? BigInt(d.totalAmount) : max),
      1n,
    ) ?? 1n;
  const chart =
    data?.departments.map((d) => ({
      ...d,
      ratio: Number((BigInt(d.totalAmount) * 10000n) / maximum) / 100,
    })) ?? [];
  return (
    <>
      <PageHeader
        title={admin ? 'Vue d’ensemble' : 'Mon département'}
        subtitle={
          'Bonjour ' + user.firstName + '. Voici les contributions confirmées par le serveur.'
        }
      >
        <button
          className="secondary-button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Actualiser
        </button>
      </PageHeader>
      <QueryState pending={query.isPending} error={query.error} empty={false} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              [admin ? 'Départements' : 'Département', data.counts.departments],
              ['Responsables actifs', data.counts.managers],
              ['Membres actifs', data.counts.activeMembers],
              ['Membres archivés', data.counts.archivedMembers],
            ].map(([label, value]) => (
              <article className="panel" key={label}>
                <p className="text-xs text-stone-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
              </article>
            ))}
          </div>
          {!data.objective || !data.progress ? (
            <section className="panel mt-6">
              <h2 className="font-semibold">Aucune campagne courante</h2>
              <p className="mt-2 text-sm text-stone-500">
                {admin
                  ? 'Créez une campagne et définissez son objectif pour commencer la collecte.'
                  : 'Le Super Administrateur doit ouvrir une campagne pour démarrer la collecte.'}
              </p>
              <Link className="primary-button mt-5" to="/objectifs">
                {admin ? 'Gérer les campagnes' : 'Consulter les campagnes'}
              </Link>
            </section>
          ) : (
            <>
              <section className="mt-6 rounded-2xl bg-[#123e38] p-6 text-white sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs tracking-widest text-emerald-100">
                      OBJECTIF GLOBAL · {objectiveStatus[data.objective.status].toUpperCase()}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold">{data.objective.name}</h2>
                    <p className="mt-2 text-sm text-emerald-100/80">
                      {data.objective.startsOn.slice(0, 10)} → {data.objective.endsOn.slice(0, 10)}{' '}
                      · {data.objective.timezone}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-semibold">
                      {data.progress.percentage.replace('.', ',')} %
                    </p>
                    <p className="mt-1 text-xs text-emerald-100">de l’objectif global</p>
                  </div>
                </div>
                <div
                  className="mt-7 h-3 overflow-hidden rounded-full bg-white/15"
                  role="progressbar"
                  aria-label="Progression de l’objectif global"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Number(data.progress.percentage))}
                  aria-valuetext={data.progress.percentage + ' %'}
                >
                  <div
                    className="h-full rounded-full bg-[#dcebbb]"
                    style={{ width: Math.min(100, Number(data.progress.percentage)) + '%' }}
                  />
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-3">
                  {[
                    ['Encaissé global', data.progress.totalAmount],
                    ['Objectif global', data.progress.targetAmount],
                    ['Reste à atteindre', data.progress.remainingAmount],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-emerald-100/80">{label}</p>
                      <p className="mt-1 text-lg font-semibold">{fcfa(value!)}</p>
                    </div>
                  ))}
                </div>
                {BigInt(data.progress.exceededAmount) > 0n && (
                  <p className="mt-5 rounded-lg bg-white/10 p-3 text-sm">
                    Objectif dépassé de {fcfa(data.progress.exceededAmount)}.
                  </p>
                )}
              </section>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <article className="panel">
                  <p className="text-xs text-stone-500">
                    {admin
                      ? 'Collecte de la campagne'
                      : 'Total de mon département · campagne sélectionnée'}
                  </p>
                  <p className="mt-3 text-2xl font-semibold">{fcfa(data.departmentTotal)}</p>
                </article>
                <article className="panel">
                  <p className="text-xs text-stone-500">
                    {admin
                      ? 'Collecte de la semaine courante'
                      : 'Mon département · semaine courante'}
                  </p>
                  <p className="mt-3 text-2xl font-semibold">{fcfa(data.weekTotal)}</p>
                </article>
              </div>
              <section className="panel mt-6">
                <h2 className="font-semibold">
                  {admin ? 'Contributions par département' : 'Contribution de mon département'}
                </h2>
                <p className="mt-2 text-xs text-stone-500">
                  Les barres comparent les départements au montant le plus élevé. Les montants
                  exacts figurent dans le tableau.
                </p>
                <div
                  className="mt-5 h-64 min-w-0"
                  role="img"
                  aria-label="Graphique comparatif des contributions"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ left: 0, right: 20, bottom: 20 }}>
                      <CartesianGrid vertical={false} stroke="#e9eee7" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [String(value) + ' %', 'Part du maximum']} />
                      <Bar
                        dataKey="ratio"
                        fill="#49745b"
                        radius={[5, 5, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Département</th>
                        <th>Total de la campagne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.departments.map((d) => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td className="font-medium">{fcfa(d.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <section className="panel min-w-0">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-semibold">Derniers encaissements</h2>
                    <Link className="text-xs underline" to="/encaissements">
                      Tout voir
                    </Link>
                  </div>
                  {!data.recentPayments.length && (
                    <p className="text-sm text-stone-500">Aucun encaissement.</p>
                  )}
                  <ul className="space-y-4">
                    {data.recentPayments.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{p.memberLabel}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {dateTime(p.collectedAt)} ·{' '}
                            {p.status === 'CANCELLED' ? 'Annulé' : p.method}
                          </p>
                        </div>
                        <span className="font-semibold">{fcfa(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="panel min-w-0">
                  <h2 className="mb-5 font-semibold">Principales contributions individuelles</h2>
                  {!data.members.length && (
                    <p className="text-sm text-stone-500">Aucune contribution validée.</p>
                  )}
                  <ol className="space-y-4">
                    {data.members.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-3 text-sm"
                      >
                        <span>{m.name}</span>
                        <span className="font-semibold">{fcfa(m.totalAmount)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
