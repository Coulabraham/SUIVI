import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  ApiResponse,
  DashboardView,
  MemberView,
  PageResult,
  PaymentView,
} from '@suivi/contracts';
import { api, errorMessage } from '../../services/api';
import { useAuthStore, useAuthScope } from '../../stores/auth';
import {
  Editor,
  ListTools,
  Modal,
  PageHeader,
  QueryState,
  type Field,
} from '../../components/BusinessUi';
import { dateTime, fcfa, useInvalidate, useList } from '../../hooks/business';

interface PaymentDraft {
  memberId: string;
  collectionWeekId: string;
  amount: string;
  method: string;
  reference: string;
  collectedAt: string;
  idempotencyKey: string;
  memberLabel: string;
  weekLabel: string;
}
interface PaymentDetails extends PaymentView {
  revisions: {
    id: string;
    kind: string;
    reason: string;
    previousAmount: string;
    newAmount: string;
    previousMethod: string;
    newMethod: string;
    createdAt: string;
  }[];
}

function PaymentEntry({ onPrepared }: { onPrepared: (draft: PaymentDraft) => void }) {
  const scope = useAuthScope();
  const [search, setSearch] = useState('');
  const dashboard = useQuery({
    queryKey: ['/dashboard', scope, 'entry'],
    queryFn: async () => (await api.get<ApiResponse<DashboardView>>('/dashboard')).data.data,
  });
  const members = useQuery({
    queryKey: ['/members', scope, 'entry', search],
    queryFn: async () =>
      (
        await api.get<ApiResponse<PageResult<MemberView>>>('/members', {
          params: { q: search, pageSize: 100 },
        })
      ).data.data.items.filter((m) => m.status === 'ACTIVE'),
  });
  const objective = dashboard.data?.objective;
  if (dashboard.isPending || members.isPending || dashboard.error || members.error)
    return (
      <QueryState
        pending={dashboard.isPending || members.isPending}
        error={dashboard.error ?? members.error}
        empty={false}
      />
    );
  if (!objective || objective.status !== 'ACTIVE')
    return (
      <p className="notice">
        Aucune campagne active. Demandez au Super Administrateur de créer ou de réactiver la
        campagne avant l’encaissement.
      </p>
    );
  const now = new Date();
  const fields: Field[] = [
    {
      name: 'memberId',
      label: 'Membre',
      type: 'select',
      required: true,
      options: (members.data ?? []).map((m) => ({
        value: m.id,
        label: m.memberNumber + ' · ' + m.firstName + ' ' + m.lastName,
      })),
    },
    {
      name: 'amount',
      label: 'Montant entier (FCFA)',
      type: 'text',
      required: true,
      maxLength: 19,
      hint: 'Saisissez uniquement des chiffres, sans espaces ni décimales.',
    },
    {
      name: 'collectedAt',
      label: 'Date et heure de l’encaissement',
      type: 'datetime-local',
      required: true,
    },
    {
      name: 'collectionWeekId',
      label: 'Semaine de collecte',
      type: 'select',
      required: true,
      options: objective.weeks
        .filter((w) => w.status === 'OPEN')
        .map((w) => ({
          value: w.id,
          label:
            'Semaine ' +
            w.number +
            ' · ' +
            w.startsOn.slice(0, 10) +
            ' au ' +
            w.endsOn.slice(0, 10),
        })),
    },
    {
      name: 'method',
      label: 'Mode de paiement',
      required: true,
      maxLength: 40,
      hint: 'Saisissez le mode réellement utilisé, selon les règles de votre organisation.',
    },
    { name: 'reference', label: 'Référence du reçu ou de l’opération', maxLength: 120 },
  ];
  return (
    <>
      <p className="mb-4 text-sm font-medium">
        Campagne : {objective.name} · Fuseau : {objective.timezone}
      </p>
      <label className="mb-5 block text-sm">
        Rechercher le membre
        <input
          className="search-input mt-2"
          type="search"
          placeholder="Nom ou numéro de membre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="mt-1 block text-xs text-stone-500">
          Jusqu’à 100 résultats ; affinez la recherche si nécessaire.
        </span>
      </label>
      <Editor
        fields={fields}
        initial={{
          collectedAt: new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, -1),
        }}
        submitLabel="Vérifier avant enregistrement"
        onSave={async (values) => {
          if (
            !/^[1-9]\d{0,18}$/.test(values.amount ?? '') ||
            BigInt(values.amount!) > 9223372036854775807n
          )
            throw new Error('Saisissez un montant entier positif compatible avec BIGINT.');
          const member = members.data?.find((m) => m.id === values.memberId);
          const week = objective.weeks.find((w) => w.id === values.collectionWeekId);
          if (!member || !week) throw new Error('Sélectionnez un membre et une semaine valides.');
          onPrepared({
            memberId: member.id,
            collectionWeekId: week.id,
            amount: values.amount!,
            method: values.method!,
            reference: values.reference ?? '',
            collectedAt: new Date(values.collectedAt!).toISOString(),
            idempotencyKey: crypto.randomUUID(),
            memberLabel: member.firstName + ' ' + member.lastName,
            weekLabel: 'Semaine ' + week.number,
          });
        }}
      />
    </>
  );
}

function PaymentHistory({ id }: { id: string }) {
  const scope = useAuthScope();
  const query = useQuery({
    queryKey: ['/payments', scope, id],
    queryFn: async () => (await api.get<ApiResponse<PaymentDetails>>('/payments/' + id)).data.data,
  });
  return (
    <>
      <QueryState pending={query.isPending} error={query.error} empty={false} />
      {query.data && (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-stone-500">Membre au moment de l’encaissement</dt>
              <dd>{query.data.memberLabel}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Montant actuel</dt>
              <dd className="font-semibold">{fcfa(query.data.amount)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Montant initial conservé</dt>
              <dd>{fcfa(query.data.originalAmount)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Statut</dt>
              <dd>{query.data.status === 'VALIDATED' ? 'Validé' : 'Annulé'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Encaisseur</dt>
              <dd>{query.data.collectedBy}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Date serveur</dt>
              <dd>{dateTime(query.data.receivedAt)}</dd>
            </div>
          </dl>
          <h3 className="mt-7 mb-3 font-semibold">Corrections et annulations</h3>
          {!query.data.revisions.length && (
            <p className="text-sm text-stone-500">Aucune révision.</p>
          )}
          <ol className="space-y-3">
            {query.data.revisions.map((r) => (
              <li key={r.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                <p className="font-medium">
                  {r.kind === 'CANCELLATION' ? 'Annulation' : 'Correction'} ·{' '}
                  {dateTime(r.createdAt)}
                </p>
                <p className="mt-1">
                  {fcfa(r.previousAmount)} → {fcfa(r.newAmount)} · {r.previousMethod} →{' '}
                  {r.newMethod}
                </p>
                <p className="mt-2 text-stone-600">{r.reason}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

export function PaymentsPage() {
  const user = useAuthStore((s) => s.user)!;
  const admin = user.role === 'SUPER_ADMIN';
  const [params, setParams] = useSearchParams();
  const memberId = params.get('memberId');
  const list = useList<PaymentView>('/payments', memberId ? { memberId } : undefined);
  const invalidate = useInvalidate();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState<{ payment: PaymentView; cancel: boolean } | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <PageHeader
        title="Encaissements"
        subtitle="Chaque versement est indépendant. Les montants affichés tiennent compte des révisions."
      >
        {!admin && (
          <button className="primary-button" onClick={() => setCreating(true)}>
            Enregistrer un encaissement
          </button>
        )}
      </PageHeader>
      {message && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {memberId && (
        <p className="notice mb-4">
          Historique filtré sur un membre.{' '}
          <button className="underline" onClick={() => setParams({})}>
            Voir tous les encaissements
          </button>
        </p>
      )}
      <section className="panel">
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
                  <th>Membre / département</th>
                  <th>Montant</th>
                  <th>Date / mode</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">
                      {p.memberLabel}
                      <p className="mt-1 text-xs font-normal text-stone-500">{p.departmentName}</p>
                    </td>
                    <td className="whitespace-nowrap font-semibold">{fcfa(p.amount)}</td>
                    <td>
                      {dateTime(p.collectedAt)}
                      <p className="mt-1 text-xs text-stone-500">
                        {p.method} {p.reference ? '· ' + p.reference : ''}
                      </p>
                    </td>
                    <td>{p.status === 'VALIDATED' ? 'Validé' : 'Annulé'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="secondary-button" onClick={() => setDetails(p.id)}>
                          Détails
                        </button>
                        {admin && p.status === 'VALIDATED' && (
                          <>
                            <button
                              className="secondary-button"
                              onClick={() => setRevision({ payment: p, cancel: false })}
                            >
                              Corriger
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => setRevision({ payment: p, cancel: true })}
                            >
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && (
        <Modal title="Nouvel encaissement" onClose={() => setCreating(false)}>
          <PaymentEntry
            onPrepared={(value) => {
              setDraft(value);
              setCreating(false);
              setError('');
            }}
          />
        </Modal>
      )}
      {draft && (
        <Modal
          title="Confirmer l’encaissement"
          onClose={() => {
            if (!sending) setDraft(null);
          }}
        >
          <dl className="space-y-3 rounded-xl bg-stone-50 p-5 text-sm">
            <div>
              <dt className="text-stone-500">Membre</dt>
              <dd>{draft.memberLabel}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Montant</dt>
              <dd className="text-2xl font-semibold text-emerald-900">{fcfa(draft.amount)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Date / semaine</dt>
              <dd>
                {dateTime(draft.collectedAt)} · {draft.weekLabel}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Mode / référence</dt>
              <dd>
                {draft.method} · {draft.reference || 'Sans référence'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-stone-500">
            Le paiement sera validé uniquement après confirmation du serveur. En cas d’échec, une
            nouvelle tentative conserve la même clé pour éviter un doublon.
          </p>
          {error && (
            <p role="alert" className="error-box mt-4">
              {error}
            </p>
          )}
          <button
            className="primary-button mt-5 w-full"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              setError('');
              try {
                const response = await api.post<ApiResponse<PaymentView>>('/payments', {
                  memberId: draft.memberId,
                  collectionWeekId: draft.collectionWeekId,
                  amount: draft.amount,
                  method: draft.method,
                  reference: draft.reference,
                  collectedAt: draft.collectedAt,
                  idempotencyKey: draft.idempotencyKey,
                });
                setDraft(null);
                await invalidate();
                const confirmed = response.data.data;
                setMessage(
                  confirmed.status === 'CANCELLED'
                    ? 'Cette opération correspond à un encaissement déjà annulé. Aucun nouveau paiement n’a été créé.'
                    : confirmed.amount !== draft.amount || confirmed.method !== draft.method
                      ? 'L’encaissement existe déjà avec une révision. Consultez son détail pour vérifier le montant et le mode actuels.'
                      : 'Encaissement validé par le serveur.',
                );
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? 'Enregistrement…' : 'Confirmer et enregistrer ' + fcfa(draft.amount)}
          </button>
        </Modal>
      )}
      {details && (
        <Modal title="Détails de l’encaissement" onClose={() => setDetails(null)}>
          <PaymentHistory id={details} />
        </Modal>
      )}
      {revision && (
        <Modal
          title={revision.cancel ? 'Annuler cet encaissement' : 'Corriger cet encaissement'}
          onClose={() => setRevision(null)}
        >
          <p className="notice mb-5">
            {revision.payment.memberLabel} · {fcfa(revision.payment.amount)}. L’original sera
            conservé et une révision auditée sera ajoutée.
          </p>
          <Editor
            fields={[
              ...(!revision.cancel
                ? [
                    {
                      name: 'amount',
                      label: 'Montant corrigé entier (FCFA)',
                      required: true,
                      maxLength: 19,
                    },
                    {
                      name: 'method',
                      label: 'Mode de paiement corrigé',
                      required: true,
                      maxLength: 40,
                    },
                  ]
                : []),
              {
                name: 'reason',
                label: 'Justification obligatoire',
                type: 'textarea',
                required: true,
                maxLength: 1000,
              },
            ]}
            initial={
              revision.cancel
                ? undefined
                : { amount: revision.payment.amount, method: revision.payment.method }
            }
            submitLabel={revision.cancel ? 'Confirmer l’annulation' : 'Confirmer la correction'}
            onSave={async (values) => {
              await api.post(
                '/payments/' +
                  revision.payment.id +
                  (revision.cancel ? '/cancellations' : '/revisions'),
                { ...values, version: revision.payment.version },
              );
              setRevision(null);
              await invalidate();
              setMessage('Révision validée par le serveur et journalisée.');
            }}
          />
        </Modal>
      )}
    </>
  );
}
