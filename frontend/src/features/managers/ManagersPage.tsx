import { useState } from 'react';
import type { ApiResponse, ManagerView } from '@suivi/contracts';
import { api } from '../../services/api';
import {
  Editor,
  ListTools,
  Modal,
  PageHeader,
  QueryState,
  type Field,
} from '../../components/BusinessUi';
import { statusOptions, useInvalidate, useList, dateTime } from '../../hooks/business';
import { useDepartmentOptions } from '../departments/options';

interface InitialAccess {
  user: { login: string };
  initialPassword: string;
  expiresAt: string;
}
export function ManagersPage() {
  const list = useList<ManagerView>('/managers');
  const departments = useDepartmentOptions();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<ManagerView | 'new' | null>(null);
  const [reset, setReset] = useState<ManagerView | null>(null);
  const [access, setAccess] = useState<InitialAccess | null>(null);
  const [message, setMessage] = useState('');
  const row = editing && editing !== 'new' ? editing : null;
  const fields: Field[] = [
    {
      name: 'login',
      label: 'Identifiant unique',
      required: true,
      maxLength: 100,
      hint: 'Nom d’utilisateur ou téléphone : utilisez la convention choisie par votre organisation.',
    },
    { name: 'firstName', label: 'Prénom', required: true, maxLength: 100 },
    { name: 'lastName', label: 'Nom', required: true, maxLength: 100 },
    { name: 'phone', label: 'Contact', maxLength: 32 },
    {
      name: 'departmentId',
      label: 'Département',
      type: 'select',
      required: true,
      options: (departments.data ?? []).map((d) => ({
        value: d.id,
        label: d.name + (d.status === 'INACTIVE' ? ' (désactivé)' : ''),
      })),
    },
    { name: 'status', label: 'Statut', type: 'select', required: true, options: statusOptions },
    ...(row
      ? [
          {
            name: 'reason',
            label: 'Justification du changement',
            type: 'textarea' as const,
            required: true,
            maxLength: 1000,
          },
        ]
      : [
          {
            name: 'initialValidityHours',
            label: 'Validité du mot de passe initial (heures)',
            type: 'number' as const,
            required: true,
            min: '1',
            max: '168',
            hint: 'Choisissez de 1 à 168 heures ; le secret sera affiché une seule fois.',
          },
        ]),
  ];
  return (
    <>
      <PageHeader
        title="Responsables"
        subtitle="Un responsable actif par département. Les changements d’accès révoquent les sessions."
      >
        <button className="primary-button" onClick={() => setEditing('new')}>
          Ajouter un responsable
        </button>
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
        {!!list.data?.items.length && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Département</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">
                      {m.firstName} {m.lastName}
                      <p className="mt-1 text-xs font-normal text-stone-500">{m.login}</p>
                    </td>
                    <td>{m.departmentName}</td>
                    <td>{m.status === 'ACTIVE' ? 'Actif' : 'Désactivé'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button className="secondary-button" onClick={() => setEditing(m)}>
                          Modifier
                        </button>
                        <button className="secondary-button" onClick={() => setReset(m)}>
                          Réinitialiser les accès
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal
          title={row ? 'Modifier le responsable' : 'Nouveau responsable'}
          onClose={() => setEditing(null)}
        >
          <QueryState pending={departments.isPending} error={departments.error} empty={false} />
          {departments.data && (
            <Editor
              fields={fields}
              initial={
                row
                  ? {
                      login: row.login,
                      firstName: row.firstName,
                      lastName: row.lastName,
                      phone: row.phone ?? '',
                      departmentId: row.departmentId ?? '',
                      status: row.status,
                    }
                  : undefined
              }
              onSave={async (values) => {
                if (row) {
                  await api.patch('/managers/' + row.id, { ...values, version: row.version });
                  setMessage('Responsable mis à jour ; ses sessions ont été révoquées.');
                } else {
                  const response = await api.post<ApiResponse<InitialAccess>>('/managers', {
                    ...values,
                    initialValidityHours: Number(values.initialValidityHours),
                  });
                  setAccess(response.data.data);
                }
                setEditing(null);
                await invalidate();
              }}
            />
          )}
        </Modal>
      )}
      {reset && (
        <Modal title="Réinitialiser les accès" onClose={() => setReset(null)}>
          <p className="notice mb-5">
            Les sessions de {reset.firstName} {reset.lastName} seront révoquées et un nouveau mot de
            passe initial sera généré.
          </p>
          <Editor
            fields={[
              {
                name: 'initialValidityHours',
                label: 'Validité du nouveau secret (heures)',
                type: 'number',
                required: true,
                min: '1',
                max: '168',
              },
              {
                name: 'reason',
                label: 'Justification',
                type: 'textarea',
                required: true,
                maxLength: 1000,
              },
            ]}
            submitLabel="Confirmer la réinitialisation"
            onSave={async (values) => {
              const response = await api.post<ApiResponse<InitialAccess>>(
                '/managers/' + reset.id + '/reset-password',
                {
                  ...values,
                  initialValidityHours: Number(values.initialValidityHours),
                  version: reset.version,
                },
              );
              setReset(null);
              setAccess(response.data.data);
              await invalidate();
            }}
          />
        </Modal>
      )}
      {access && (
        <Modal title="Accès initial — affichage unique" onClose={() => setAccess(null)}>
          <p className="mb-4 text-sm">
            Remettez ce secret directement au responsable, après vérification de son identité, ou
            par un canal privé approuvé par votre organisation.
          </p>
          <dl className="space-y-3 rounded-xl bg-stone-50 p-4 text-sm">
            <div>
              <dt className="text-stone-500">Identifiant</dt>
              <dd className="font-semibold break-all">{access.user.login}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Mot de passe initial</dt>
              <dd className="mt-1 select-all font-mono text-lg break-all">
                {access.initialPassword}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Expire le</dt>
              <dd>{dateTime(access.expiresAt)}</dd>
            </div>
          </dl>
          <p className="notice mt-4">
            Ce mot de passe ne pourra pas être réaffiché après fermeture. Son changement est
            obligatoire à la première connexion.
          </p>
          <button className="primary-button mt-5 w-full" onClick={() => setAccess(null)}>
            J’ai remis les accès, fermer
          </button>
        </Modal>
      )}
    </>
  );
}
