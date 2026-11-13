import { useState } from 'react';
import type { DepartmentView } from '@suivi/contracts';
import { api } from '../../services/api';
import { Editor, ListTools, Modal, PageHeader, QueryState } from '../../components/BusinessUi';
import { statusOptions, useInvalidate, useList } from '../../hooks/business';

export function DepartmentsPage() {
  const list = useList<DepartmentView>('/departments');
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<DepartmentView | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const row = editing && editing !== 'new' ? editing : null;
  return (
    <>
      <PageHeader
        title="Départements"
        subtitle="L’organisation et ses responsables, avec tout l’historique conservé."
      >
        <button className="primary-button" onClick={() => setEditing('new')}>
          Ajouter un département
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
                  <th>Département</th>
                  <th>Responsable actif</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">
                      {d.name}
                      <p className="mt-1 text-xs font-normal text-stone-500">{d.description}</p>
                    </td>
                    <td>
                      {d.manager ? d.manager.firstName + ' ' + d.manager.lastName : 'Non affecté'}
                    </td>
                    <td>{d.status === 'ACTIVE' ? 'Actif' : 'Désactivé'}</td>
                    <td>
                      <button className="secondary-button" onClick={() => setEditing(d)}>
                        Modifier
                      </button>
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
          title={row ? 'Modifier le département' : 'Nouveau département'}
          onClose={() => setEditing(null)}
        >
          <Editor
            fields={[
              { name: 'name', label: 'Nom', required: true, maxLength: 120 },
              { name: 'description', label: 'Description', type: 'textarea' },
              {
                name: 'status',
                label: 'Statut',
                type: 'select',
                required: true,
                options: statusOptions,
              },
            ]}
            initial={
              row
                ? { name: row.name, description: row.description ?? '', status: row.status }
                : undefined
            }
            onSave={async (values) => {
              if (row)
                await api.patch('/departments/' + row.id, { ...values, version: row.version });
              else await api.post('/departments', values);
              await invalidate();
              setEditing(null);
              setMessage('Département enregistré.');
            }}
          />
        </Modal>
      )}
    </>
  );
}
