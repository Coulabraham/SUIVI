import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationView } from '@suivi/contracts';
import { api, errorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { dateTime, useList } from '../../hooks/business';
import { ListTools, Modal, PageHeader, QueryState } from '../../components/BusinessUi';
import { useUnread } from './useUnread';

const typeLabels = {
  INFORMATION: 'Information',
  WARNING: 'Avertissement',
  ERROR: 'Erreur',
  SECURITY: 'Sécurité',
};
function target(row: NotificationView, admin: boolean, userId: string | undefined) {
  if (row.entityType === 'Payment' || row.entityType === 'PaymentRevision') return '/encaissements';
  if (row.entityType === 'Member') return '/membres';
  if (row.entityType === 'Objective') return '/objectifs';
  if (row.entityType === 'User')
    return admin && row.entityId !== userId ? '/responsables' : '/profil';
  if (row.entityType === 'Session') return admin ? '/audit' : '/profil';
  if (row.entityType === 'Department' && admin) return '/departements';
  return null;
}
export function NotificationsPage() {
  const admin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN');
  const userId = useAuthStore((s) => s.user?.id);
  const client = useQueryClient();
  const [readState, setReadState] = useState('ALL');
  const [type, setType] = useState('');
  const list = useList<NotificationView>(
    '/notifications',
    {
      readState,
      ...(type ? { type } : {}),
    },
    30000,
  );
  const unread = useUnread();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [message, setMessage] = useState('');
  async function mark(id?: string) {
    setPending(true);
    setError('');
    try {
      await api.patch(id ? '/notifications/' + id + '/read' : '/notifications/read-all', {
        read: true,
      });
      await client.invalidateQueries({ queryKey: ['/notifications'] });
      setConfirmAll(false);
      setMessage(
        id
          ? 'Notification marquée comme lue.'
          : 'Toutes les notifications de votre périmètre sont marquées comme lues.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Les événements importants de votre périmètre, conservés dans votre boîte personnelle."
      >
        <div className="flex flex-wrap gap-2">
          <button
            className="secondary-button"
            disabled={list.isFetching}
            onClick={() => {
              void list.refetch();
              void unread.refetch();
            }}
          >
            Actualiser
          </button>
          <button
            className="primary-button"
            disabled={pending || !unread.data}
            onClick={() => setConfirmAll(true)}
          >
            Tout marquer comme lu
          </button>
        </div>
      </PageHeader>
      {message && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-box mb-4">
          {error}
        </p>
      )}
      {unread.error ? (
        <p role="alert" className="error-box mb-4">
          {errorMessage(unread.error)}
        </p>
      ) : (
        <p className="mb-4 text-sm text-stone-500">
          {unread.data === undefined
            ? 'Vérification des notifications non lues…'
            : unread.data +
              ' notification' +
              (unread.data > 1 ? 's' : '') +
              ' non lue' +
              (unread.data > 1 ? 's' : '')}
        </p>
      )}
      <section className="panel">
        <div className="form-grid sm:grid-cols-2">
          <label>
            État de lecture
            <select
              value={readState}
              onChange={(e) => {
                setReadState(e.target.value);
                list.setPage(1);
              }}
            >
              <option value="ALL">Toutes</option>
              <option value="UNREAD">Non lues</option>
              <option value="READ">Lues</option>
            </select>
          </label>
          <label>
            Type de notification
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                list.setPage(1);
              }}
            >
              <option value="">Tous les types</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ListTools
          search={list.search}
          onSearch={list.setSearch}
          page={list.page}
          total={list.data?.total ?? 0}
          onPage={list.setPage}
        />
        <QueryState pending={list.isPending} error={list.error} empty={!list.data?.items.length} />
        <div className="space-y-4">
          {list.data?.items.map((row) => (
            <article
              key={row.id}
              className={
                'rounded-xl border p-5 ' +
                (row.readAt ? 'border-stone-200' : 'border-emerald-200 bg-emerald-50/40')
              }
            >
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="font-semibold text-emerald-900">
                  {typeLabels[row.type]} · {row.readAt ? 'Lue' : 'Non lue'}
                </span>
                <time dateTime={row.createdAt} className="text-stone-500">
                  {dateTime(row.createdAt)}
                </time>
              </div>
              <h2 className="mt-3 font-semibold">{row.title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{row.message}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {target(row, !!admin, userId) && (
                  <Link className="secondary-button" to={target(row, !!admin, userId)!}>
                    Consulter l’espace concerné
                  </Link>
                )}
                {!row.readAt && (
                  <button
                    className="secondary-button"
                    disabled={pending}
                    aria-label={'Marquer comme lue : ' + row.title}
                    onClick={() => void mark(row.id)}
                  >
                    Marquer comme lue
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {confirmAll && (
        <Modal
          title="Marquer les notifications comme lues"
          onClose={() => {
            if (!pending) setConfirmAll(false);
          }}
        >
          <p className="text-sm leading-6">
            Toutes les notifications non lues de votre périmètre seront marquées comme lues, y
            compris celles des autres pages. Elles resteront consultables.
          </p>
          {error && (
            <p role="alert" className="error-box mt-4">
              {error}
            </p>
          )}
          <button
            className="primary-button mt-5 w-full"
            disabled={pending}
            onClick={() => void mark()}
          >
            Confirmer la lecture de toutes les notifications
          </button>
        </Modal>
      )}
    </>
  );
}
