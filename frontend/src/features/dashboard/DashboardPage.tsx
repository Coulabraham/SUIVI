import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { ApiResponse, DashboardView, NotificationView, PageResult } from '@suivi/contracts';
import { api, errorMessage } from '../../services/api';
import { useAuthStore, useAuthScope } from '../../stores/auth';
import { PageHeader, QueryState } from '../../components/BusinessUi';
import { Icon, type IconName } from '../../components/Icon';
import { dateTime, fcfa } from '../../hooks/business';
import { objectiveStatus } from '../objectives/status';
import { ContributionChart, ProgressRing, WeeklyChart } from './visuals';

function NotificationsPreview() {
  const scope = useAuthScope();
  const query = useQuery({
    queryKey: ['/notifications', scope, 'dashboard-preview'],
    queryFn: async () =>
      (
        await api.get<ApiResponse<PageResult<NotificationView>>>('/notifications', {
          params: { pageSize: 3 },
        })
      ).data.data,
    refetchInterval: 30000,
  });
  return (
    <section className="panel dashboard-notifications">
      <div className="section-heading">
        <h2>Notifications récentes</h2>
        <Link to="/notifications">Tout voir</Link>
      </div>
      {query.isPending && (
        <p role="status" className="dashboard-empty">
          Chargement des notifications…
        </p>
      )}
      {query.isError && (
        <>
          <p role="alert" className="error-box">
            {errorMessage(query.error)}
          </p>
          <button
            type="button"
            className="secondary-button mt-3"
            onClick={() => void query.refetch()}
          >
            Réessayer
          </button>
        </>
      )}
      {query.data && !query.data.items.length && (
        <p className="dashboard-empty">Vous êtes à jour. Aucune notification.</p>
      )}
      <ul className="notification-preview">
        {query.data?.items.map((row) => (
          <li key={row.id}>
            <span
              className={`preview-notification-icon ${row.type === 'WARNING' || row.type === 'ERROR' ? 'warning' : ''}`}
            >
              <Icon name={row.type === 'SECURITY' ? 'shield' : 'bell'} />
            </span>
            <div>
              <strong>{row.title}</strong>
              <span>{dateTime(row.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
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
  const cards: { label: string; value: number | string; icon: IconName; emphasis?: boolean }[] =
    data
      ? admin
        ? [
            { label: 'Départements', value: data.counts.departments, icon: 'building' },
            { label: 'Responsables actifs', value: data.counts.managers, icon: 'shield' },
            { label: 'Membres actifs', value: data.counts.activeMembers, icon: 'users' },
            { label: 'Membres archivés', value: data.counts.archivedMembers, icon: 'audit' },
          ]
        : [
            {
              label: 'Membres actifs',
              value: data.counts.activeMembers,
              icon: 'users',
              emphasis: true,
            },
            { label: 'Total encaissé', value: fcfa(data.departmentTotal), icon: 'chart' },
            { label: 'Encaissements cette semaine', value: fcfa(data.weekTotal), icon: 'wallet' },
          ]
      : [];
  return (
    <div className={`dashboard ${admin ? 'dashboard-admin' : 'dashboard-manager'}`}>
      <PageHeader
        title={admin ? 'Tableau de bord général' : 'Mon département'}
        subtitle={
          admin
            ? 'Bonjour ' + user.firstName + '. Retrouvez les résultats de votre organisation.'
            : (data?.departments[0]?.name ?? 'Votre département') + ' · Bonjour ' + user.firstName
        }
      >
        <button
          className="secondary-button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <Icon name="refresh" className="h-4 w-4" />
          Actualiser
        </button>
      </PageHeader>
      <QueryState pending={query.isPending} error={query.error} empty={false} />
      {data && (
        <>
          <div className="dashboard-stats">
            {cards.map((card) => (
              <article
                key={card.label}
                className={`stat-card ${card.emphasis ? 'stat-card-emphasis' : ''}`}
              >
                <span className="stat-icon">
                  <Icon name={card.icon} />
                </span>
                <div>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                </div>
              </article>
            ))}
          </div>
          {!data.objective || !data.progress ? (
            <section className="panel mt-5">
              <h2>Aucune campagne courante</h2>
              <p className="mt-3 text-sm text-slate-500">
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
              <section className="panel objective-summary">
                <div className="objective-heading">
                  <Icon name="target" />
                  <span>
                    {data.objective.name}{' '}
                    <small>
                      {objectiveStatus[data.objective.status]} ·{' '}
                      {data.objective.startsOn.slice(0, 10)} → {data.objective.endsOn.slice(0, 10)}
                    </small>
                  </span>
                  <Link to="/objectifs">
                    Voir la campagne
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                </div>
                <div className="objective-content">
                  <div className="objective-financials">
                    <div className="objective-target">
                      <span>Objectif financier global</span>
                      <strong>{fcfa(data.progress.targetAmount)}</strong>
                      <div
                        className="goal-track"
                        role="progressbar"
                        aria-label="Progression de l’objectif global"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Number(data.progress.percentage))}
                        aria-valuetext={data.progress.percentage + ' %'}
                      >
                        <span
                          style={{ width: Math.min(100, Number(data.progress.percentage)) + '%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <span>Total encaissé global</span>
                      <strong>{fcfa(data.progress.totalAmount)}</strong>
                    </div>
                    <div>
                      <span>Reste à atteindre</span>
                      <strong>{fcfa(data.progress.remainingAmount)}</strong>
                    </div>
                  </div>
                  <ProgressRing percentage={data.progress.percentage} />
                </div>
                {BigInt(data.progress.exceededAmount) > 0n && (
                  <p className="goal-exceeded">
                    <Icon name="check" className="h-4 w-4" />
                    Objectif dépassé de {fcfa(data.progress.exceededAmount)}.
                  </p>
                )}
              </section>
              <div className="dashboard-visuals">
                <WeeklyChart data={data} admin={admin} />
                <ContributionChart data={data} admin={admin} />
                <NotificationsPreview />
              </div>
              <div className="dashboard-details">
                <section className="panel min-w-0">
                  <div className="section-heading">
                    <h2>Derniers encaissements</h2>
                    <Link to="/encaissements">Tout voir</Link>
                  </div>
                  {!data.recentPayments.length && (
                    <p className="dashboard-empty">Aucun encaissement pour cette campagne.</p>
                  )}
                  <ul className="recent-payments">
                    {data.recentPayments.map((p) => (
                      <li key={p.id}>
                        <span className="payment-avatar">
                          <Icon name="wallet" />
                        </span>
                        <div>
                          <strong>{p.memberLabel}</strong>
                          <span>
                            {dateTime(p.collectedAt)} ·{' '}
                            {p.status === 'CANCELLED' ? 'Annulé' : p.method}
                          </span>
                        </div>
                        <strong>{fcfa(p.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="panel min-w-0">
                  <div className="section-heading">
                    <h2>
                      {admin
                        ? 'Contributions départementales'
                        : 'Principales contributions individuelles'}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{admin ? 'Département' : 'Membre'}</th>
                          <th>Total de la campagne</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(admin ? data.departments : data.members).map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td className="font-semibold whitespace-nowrap">
                              {fcfa(row.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!(admin ? data.departments : data.members).length && (
                    <p className="dashboard-empty">Aucune contribution validée.</p>
                  )}
                </section>
              </div>
            </>
          )}
          <p className="dashboard-data-note">
            <Icon name="shield" />
            Données confirmées par le serveur ·{' '}
            {admin ? 'Vue globale de l’organisation' : 'Détails limités à votre département'}
          </p>
        </>
      )}
    </div>
  );
}
