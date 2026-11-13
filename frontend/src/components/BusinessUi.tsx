import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { errorMessage } from '../services/api';

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea';
  required?: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: string;
  max?: string;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-2xl border border-stone-200 bg-white p-6 text-stone-800 shadow-xl backdrop:bg-stone-950/45"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        <button
          type="button"
          className="secondary-button"
          aria-label="Fermer la fenêtre"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Editor({
  fields,
  initial,
  onSave,
  submitLabel = 'Enregistrer',
}: {
  fields: Field[];
  initial?: Record<string, string> | undefined;
  onSave: (values: Record<string, string>) => Promise<void>;
  submitLabel?: string;
}) {
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.required
          ? z
              .string()
              .trim()
              .min(1, 'Ce champ est obligatoire.')
              .max(f.maxLength ?? 2000)
          : z
              .string()
              .trim()
              .max(f.maxLength ?? 2000),
      ]),
    ),
  );
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? ''])),
  });
  const [error, setError] = useState('');
  return (
    <form
      className="form-grid"
      onSubmit={form.handleSubmit(async (values) => {
        setError('');
        try {
          await onSave(values);
        } catch (e) {
          setError(errorMessage(e));
        }
      })}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.required ? ' *' : ''}
          {f.type === 'select' ? (
            <select required={f.required} {...form.register(f.name)}>
              <option value="">Sélectionner…</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              rows={3}
              required={f.required}
              maxLength={f.maxLength ?? 2000}
              {...form.register(f.name)}
            />
          ) : (
            <input
              type={f.type ?? 'text'}
              required={f.required}
              maxLength={f.maxLength ?? 2000}
              min={f.min}
              max={f.max}
              step={f.type === 'number' ? '1' : f.type === 'datetime-local' ? '0.001' : undefined}
              {...form.register(f.name)}
            />
          )}
          {f.hint && <span className="text-xs font-normal text-stone-500">{f.hint}</span>}
          {form.formState.errors[f.name] && (
            <span className="field-error">{form.formState.errors[f.name]?.message}</span>
          )}
        </label>
      ))}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  );
}

export function ListTools({
  search,
  onSearch,
  page,
  total,
  onPage,
}: {
  search: string;
  onSearch: (value: string) => void;
  page: number;
  total: number;
  onPage: (value: number) => void;
}) {
  return (
    <div className="my-5 flex flex-wrap items-center justify-between gap-3">
      <label className="w-full sm:max-w-xs">
        <span className="sr-only">Rechercher</span>
        <input
          className="search-input"
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span>
          {total} résultat{total > 1 ? 's' : ''} · Page {page}
        </span>
        <button
          className="secondary-button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Page précédente"
        >
          ←
        </button>
        <button
          className="secondary-button"
          disabled={page * 20 >= total}
          onClick={() => onPage(page + 1)}
          aria-label="Page suivante"
        >
          →
        </button>
      </div>
    </div>
  );
}
export function QueryState({
  pending,
  error,
  empty,
}: {
  pending: boolean;
  error: unknown;
  empty: boolean;
}) {
  return pending ? (
    <p role="status" className="py-6 text-sm text-stone-500">
      Chargement…
    </p>
  ) : error ? (
    <p role="alert" className="error-box">
      {errorMessage(error)}
    </p>
  ) : empty ? (
    <p className="py-8 text-center text-sm text-stone-500">Aucun résultat pour le moment.</p>
  ) : null;
}
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">GESTION DES CONTRIBUTIONS</p>
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
