import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { MemberView } from '@suivi/contracts';
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
import { useInvalidate, useList, fcfa } from '../../hooks/business';
import { useDepartmentOptions } from '../departments/options';

export function MembersPage() {
  const user = useAuthStore((s) => s.user)!;
  const admin = user.role === 'SUPER_ADMIN';
  const [params] = useSearchParams();
  const list = useList<MemberView>('/members', undefined, 0, params.get('q') ?? '');
  const departments = useDepartmentOptions(admin);
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<MemberView | 'new' | null>(null);
  const [status, setStatus] = useState<MemberView | null>(null);
  const [transfer, setTransfer] = useState<MemberView | null>(null);
  const [message, setMessage] = useState('');
  const row = editing && editing !== 'new' ? editing : null;
  const fields: Field[] = [
    ...(row
      ? []
      : [
          { name: 'memberNumber', label: 'Numéro de membre unique', required: true, maxLength: 80 },
        ]),
    { name: 'firstName', label: 'Prénom', required: true, maxLength: 100 },
    { name: 'lastName', label: 'Nom', required: true, maxLength: 100 },
    { name: 'contact', label: 'Contact', maxLength: 64 },
    { name: 'neighborhood', label: 'Quartier', maxLength: 150 },
    ...(!row && admin
      ? [
          {
            name: 'departmentId',
            label: 'Département',
            type: 'select' as const,
            required: true,
            options: (departments.data ?? [])
              .filter((d) => d.status === 'ACTIVE')
              .map((d) => ({ value: d.id, label: d.name })),
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title="Membres"
        subtitle={
          admin
            ? 'Tous les membres, leurs affectations et leurs contributions.'
            : 'Les membres de votre département et leurs contributions.'
        }
      >
        <button className="primary-button" onClick={() => setEditing('new')}>
          Ajouter un membre
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
                  <th>Membre</th>
                  {admin && <th>Département</th>}
                  <th>Contact / quartier</th>
                  <th>Total versé</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">
                      {m.firstName} {m.lastName}
                      <p className="mt-1 text-xs font-normal text-stone-500">{m.memberNumber}</p>
                    </td>
                    {admin && <td>{m.departmentName}</td>}
                    <td>
                      {m.contact || '—'}
                      <p className="mt-1 text-xs text-stone-500">{m.neighborhood}</p>
                    </td>
                    <td className="whitespace-nowrap font-medium">{fcfa(m.totalAmount)}</td>
                    <td>{m.status === 'ACTIVE' ? 'Actif' : 'Archivé'}</td>
                    <td>
                      <div className="flex min-w-40 flex-wrap gap-2">
                        <button className="secondary-button" onClick={() => setEditing(m)}>
                          Modifier
                        </button>
                        <Link className="secondary-button" to={'/encaissements?memberId=' + m.id}>
                          Historique
                        </Link>
                        {(m.status === 'ACTIVE' || admin) && (
                          <button className="secondary-button" onClick={() => setStatus(m)}>
                            {m.status === 'ACTIVE' ? 'Archiver' : 'Réactiver'}
                          </button>
                        )}
                        {admin && (
                          <button className="secondary-button" onClick={() => setTransfer(m)}>
                            Transférer
                          </button>
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
      {!admin && (
        <p className="mt-4 text-xs text-stone-500">
          La réactivation d’un membre archivé est actuellement réservée au Super Administrateur, en
          attente de validation des droits des responsables.
        </p>
      )}
      {editing && (
        <Modal
          title={row ? 'Modifier le membre' : 'Nouveau membre'}
          onClose={() => setEditing(null)}
        >
          {!row && admin && (
            <QueryState pending={departments.isPending} error={departments.error} empty={false} />
          )}
          <Editor
            fields={fields}
            initial={
              row
                ? {
                    firstName: row.firstName,
                    lastName: row.lastName,
                    contact: row.contact ?? '',
                    neighborhood: row.neighborhood ?? '',
                  }
                : undefined
            }
            onSave={async (values) => {
              if (row) await api.patch('/members/' + row.id, { ...values, version: row.version });
              else
                await api.post('/members', {
                  ...values,
                  departmentId: admin ? values.departmentId : user.departmentId,
                });
              await invalidate();
              setEditing(null);
              setMessage('Membre enregistré.');
            }}
          />
        </Modal>
      )}
      {status && (
        <Modal
          title={status.status === 'ACTIVE' ? 'Archiver le membre' : 'Réactiver le membre'}
          onClose={() => setStatus(null)}
        >
          <p className="mb-5 text-sm">
            {status.firstName} {status.lastName} · L’historique des paiements sera conservé.
          </p>
          <Editor
            fields={[
              {
                name: 'reason',
                label: 'Justification',
                type: 'textarea',
                required: true,
                maxLength: 1000,
              },
            ]}
            submitLabel={
              status.status === 'ACTIVE' ? 'Confirmer l’archivage' : 'Confirmer la réactivation'
            }
            onSave={async (values) => {
              await api.patch(
                '/members/' + status.id + (status.status === 'ACTIVE' ? '/archive' : '/reactivate'),
                { ...values, version: status.version },
              );
              setStatus(null);
              await invalidate();
              setMessage('Statut du membre mis à jour.');
            }}
          />
        </Modal>
      )}
      {transfer && (
        <Modal title="Transférer le membre" onClose={() => setTransfer(null)}>
          <QueryState pending={departments.isPending} error={departments.error} empty={false} />
          <p className="notice mb-5">
            Les anciens encaissements resteront rattachés au département qui les a reçus.
          </p>
          <Editor
            fields={[
              {
                name: 'departmentId',
                label: 'Nouveau département',
                type: 'select',
                required: true,
                options: (departments.data ?? [])
                  .filter((d) => d.id !== transfer.departmentId && d.status === 'ACTIVE')
                  .map((d) => ({ value: d.id, label: d.name })),
              },
              {
                name: 'reason',
                label: 'Justification du transfert',
                type: 'textarea',
                required: true,
                maxLength: 1000,
              },
            ]}
            submitLabel="Confirmer le transfert"
            onSave={async (values) => {
              await api.post('/members/' + transfer.id + '/transfer', {
                ...values,
                version: transfer.version,
              });
              setTransfer(null);
              await invalidate();
              setMessage('Membre transféré.');
            }}
          />
        </Modal>
      )}
    </>
  );
}
