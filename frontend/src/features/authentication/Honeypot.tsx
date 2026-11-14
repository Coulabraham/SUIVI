import type { UseFormRegisterReturn } from 'react-hook-form';

/** Hors du parcours clavier et des lecteurs d'écran ; la même règle est vérifiée par l'API. */
export function Honeypot({ field }: { field: UseFormRegisterReturn<'website'> }) {
  return (
    <div className="form-trap" aria-hidden="true">
      <label>
        Site internet — laisser vide
        <input
          {...field}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        />
      </label>
    </div>
  );
}
