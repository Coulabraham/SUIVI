import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ObjectiveView } from '@suivi/contracts';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import {
  Editor,
  ListTools,
  Modal,
  PageHeader,
  QueryState,
  type Field,
} from '../../components/BusinessUi';
import { fcfa, useInvalidate, useList } from '../../hooks/business';
import { objectiveStatus } from './status';

export function ObjectivesPage() {
  const admin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN');
  const list = useList<ObjectiveView>('/objectives');
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<ObjectiveView | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const row = editing && editing !== 'new' ? editing : null;
  const fields: Field[] = [
    { name: 'name', label: 'Nom de la campagne', required: true, maxLength: 160 },
    {
      name: 'targetAmount',
      label: 'Objectif global entier (FCFA)',
      required: true,
      maxLength: 19,
      hint: 'Cet objectif s’applique une seule fois à toute l’organisation.',
    },
    ...(row
      ? [
          {
            name: 'status',
            label: 'Statut',
            type: 'select' as const,
            required: true,
            options: Object.entries(objectiveStatus)
              .filter(([key]) => key !== 'PLANNED' || row.status === 'PLANNED')
              .map(([value, label]) => ({ value, label })),
          },
          {
            name: 'reason',
            label: 'Justification',
            type: 'textarea' as const,
            required: true,
            maxLength: 1000,
          },
        ]
      : [
          { name: 'startsOn', label: 'Date de début', type: 'date' as const, required: true },
          {
            name: 'endsOn',
            label: 'Date de fin',
            type: 'date' as const,
            required: true,
            hint: 'Une période de 12 mois est envisagée ; saisissez les dates réelles.',
          },
          {
            name: 'timezone',
            label: 'Fuseau IANA de l’organisation',
            required: true,
            maxLength: 80,
            hint: 'Exemple : Africa/Abidjan. Confirmez le fuseau réellement utilisé.',
          },
          {
            name: 'calendar',
            label: 'Convention des semaines',
            type: 'select' as const,
            required: true,
            options: [
              { value: 'SUNDAY_SATURDAY', label: 'Dimanche à samedi — je confirme ce calendrier' },
            ],
            hint: 'Les périodes partielles de début et de fin sont conservées.',
          },
          {
            name: 'status',
            label: 'Statut initial',
            type: 'select' as const,
            required: true,
            options: [
              { value: 'PLANNED', label: 'Planifiée' },
              { value: 'ACTIVE', label: 'Active' },
            ],
          },
        ]),
  ];
  return (
    <>
      <PageHeader
        title="Objectifs et campagnes"
        subtitle="Un objectif global unique pour l’organisation ; l’historique est conservé à la clôture."
      >
        {admin && (
          <button className="primary-button" onClick={() => setEditing('new')}>
            Créer une campagne
          </button>
        )}
      </PageHeader>
      {message && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
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
        <div className="grid gap-5 md:grid-cols-2">
          {list.data?.items.map((o) => (
            <article key={o.id} className="rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{o.name}</h2>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs">
                  {objectiveStatus[o.status]}
                </span>
              </div>
              <p className="mt-5 text-2xl font-semibold text-emerald-900">{fcfa(o.targetAmount)}</p>
              <p className="mt-2 text-sm text-stone-500">
                Du {o.startsOn.slice(0, 10)} au {o.endsOn.slice(0, 10)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {o.weeks.length} semaines · {o.timezone}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="secondary-button" to={'/tableau-de-bord?objectiveId=' + o.id}>
                  Consulter le bilan
                </Link>
                {admin && o.status !== 'CLOSED' && (
                  <button className="secondary-button" onClick={() => setEditing(o)}>
                    Modifier / clôturer
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {editing && (
        <Modal
          title={row ? 'Modifier la campagne' : 'Nouvelle campagne'}
          onClose={() => setEditing(null)}
        >
          {row && (
            <p className="notice mb-5">
              Les dates et le calendrier des semaines restent attachés à cette campagne. La clôture
              bloque les encaissements et conserve les données.
            </p>
          )}
          <Editor
            fields={fields}
            initial={
              row
                ? { name: row.name, targetAmount: row.targetAmount, status: row.status }
                : undefined
            }
            submitLabel={row ? 'Confirmer les modifications' : 'Créer la campagne et ses semaines'}
            onSave={async (values) => {
              if (row) {
                const { status, ...data } = values;
                await api.patch('/objectives/' + row.id, {
                  ...data,
                  ...(status === 'PLANNED' ? {} : { status }),
                  version: row.version,
                });
              } else await api.post('/objectives', values);
              await invalidate();
              setEditing(null);
              setMessage('Campagne enregistrée.');
            }}
          />
        </Modal>
      )}
    </>
  );
}
