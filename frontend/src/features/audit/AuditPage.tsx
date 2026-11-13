import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  auditActionLabels,
  type ApiResponse,
  type AuditDetails,
  type AuditView,
} from '@suivi/contracts';
import { api } from '../../services/api';
import { useAuthScope } from '../../stores/auth';
import { useDepartmentOptions } from '../departments/options';
import { dateTime, useList } from '../../hooks/business';
import { ListTools, Modal, PageHeader, QueryState } from '../../components/BusinessUi';

const outcomeLabels = { SUCCESS: 'Réussite', DENIED: 'Refus', FAILURE: 'Échec' };
function AuditDetail({ id }: { id: string }) {
  const scope = useAuthScope();
  const query = useQuery({
    queryKey: ['/audit', scope, id],
    queryFn: async () => (await api.get<ApiResponse<AuditDetails>>('/audit/' + id)).data.data,
  });
  return (
    <>
      <QueryState pending={query.isPending} error={query.error} empty={false} />
      {query.data && (
        <>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Action', auditActionLabels[query.data.action] ?? query.data.action],
              ['Résultat', outcomeLabels[query.data.outcome]],
              ['Utilisateur', query.data.actorName ?? 'Non identifié'],
              [
                'Rôle au moment de l’action',
                query.data.actorRole === 'SUPER_ADMIN'
                  ? 'Super Administrateur'
                  : query.data.actorRole === 'MANAGER'
                    ? 'Responsable'
                    : 'Non identifié',
              ],
              ['Département', query.data.departmentName ?? 'Organisation / sécurité'],
              ['Appareil', query.data.deviceLabel ?? 'Non disponible'],
              ['Date', dateTime(query.data.occurredAt)],
              ['Entité', query.data.entityType],
              ['Identifiant de l’entité', query.data.entityId ?? 'Non applicable'],
              ['Référence de la requête', query.data.requestId],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="mt-1 break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Anciennes valeurs</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-stone-50 p-4 text-xs whitespace-pre-wrap break-all">
                {query.data.beforeValue === null
                  ? 'Aucune valeur antérieure enregistrée.'
                  : JSON.stringify(query.data.beforeValue, null, 2)}
              </pre>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Nouvelles valeurs</h3>
              <pre className="max-h-80 overflow-auto rounded-lg bg-stone-50 p-4 text-xs whitespace-pre-wrap break-all">
                {query.data.afterValue === null
                  ? 'Aucune nouvelle valeur enregistrée.'
                  : JSON.stringify(query.data.afterValue, null, 2)}
              </pre>
            </section>
          </div>
        </>
      )}
    </>
  );
}
export function AuditPage() {
  const [filters, setFilters] = useState({
    action: '',
    outcome: '',
    departmentId: '',
    from: '',
    to: '',
  });
  const [details, setDetails] = useState<string | null>(null);
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const list = useList<AuditView>('/audit', params);
  const departments = useDepartmentOptions();
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    list.setPage(1);
  };
  return (
    <>
      <PageHeader
        title="Journal d’audit"
        subtitle="Lecture seule · Les événements sensibles sont conservés sans modification ni suppression."
      >
        <button
          className="secondary-button"
          disabled={list.isFetching}
          onClick={() => void list.refetch()}
        >
          Actualiser
        </button>
      </PageHeader>
      <section className="panel">
        <div className="form-grid sm:grid-cols-2 lg:grid-cols-3">
          <label htmlFor="audit-action">
            Action
            <select
              id="audit-action"
              value={filters.action}
              onChange={(e) => change('action', e.target.value)}
            >
              <option value="">Toutes les actions</option>
              {Object.entries(auditActionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="audit-outcome">
            Résultat
            <select
              id="audit-outcome"
              value={filters.outcome}
              onChange={(e) => change('outcome', e.target.value)}
            >
              <option value="">Tous les résultats</option>
              {Object.entries(outcomeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="audit-department">
            Département
            <select
              id="audit-department"
              value={filters.departmentId}
              onChange={(e) => change('departmentId', e.target.value)}
            >
              <option value="">Tous les départements</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Du (heure de votre appareil)
            <input
              type="datetime-local"
              onChange={(e) =>
                change('from', e.target.value ? new Date(e.target.value).toISOString() : '')
              }
            />
          </label>
          <label>
            Au (heure de votre appareil)
            <input
              type="datetime-local"
              onChange={(e) =>
                change('to', e.target.value ? new Date(e.target.value).toISOString() : '')
              }
            />
          </label>
        </div>
        {departments.error && (
          <QueryState pending={false} error={departments.error} empty={false} />
        )}
        <ListTools
          search={list.search}
          onSearch={list.setSearch}
          page={list.page}
          total={list.data?.total ?? 0}
          onPage={list.setPage}
        />
        <QueryState pending={list.isPending} error={list.error} empty={!list.data?.items.length} />
        {!!list.data?.items.length && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action / entité</th>
                  <th>Utilisateur</th>
                  <th>Département</th>
                  <th>Résultat</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{dateTime(row.occurredAt)}</td>
                    <td className="font-medium">
                      {auditActionLabels[row.action] ?? row.action}
                      <p className="mt-1 text-xs font-normal text-stone-500">{row.entityType}</p>
                    </td>
                    <td>
                      {row.actorName ?? 'Non identifié'}
                      <p className="mt-1 text-xs text-stone-500">
                        {row.actorRole === 'SUPER_ADMIN'
                          ? 'Super Administrateur'
                          : row.actorRole === 'MANAGER'
                            ? 'Responsable'
                            : '—'}
                      </p>
                    </td>
                    <td>{row.departmentName ?? 'Organisation / sécurité'}</td>
                    <td>{outcomeLabels[row.outcome]}</td>
                    <td>
                      <button className="secondary-button" onClick={() => setDetails(row.id)}>
                        Consulter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {details && (
        <Modal title="Détail de l’événement d’audit" onClose={() => setDetails(null)}>
          <AuditDetail id={details} />
        </Modal>
      )}
    </>
  );
}
