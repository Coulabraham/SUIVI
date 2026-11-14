import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { Honeypot } from './Honeypot';
export { LoginPage } from './LoginPage';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Saisissez le mot de passe actuel.'),
    newPassword: z.string().min(12, 'Utilisez au moins 12 caractères.').max(256),
    confirmation: z.string(),
    website: z
      .string()
      .max(0, 'Le formulaire n’est pas valide. Actualisez la page puis réessayez.'),
  })
  .refine((v) => v.newPassword === v.confirmation, {
    path: ['confirmation'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const afterPasswordChange = useAuthStore((s) => s.afterPasswordChange);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { website: '' },
  });
  if (!ready) return <p role="status">Vérification de la session…</p>;
  if (!user) return <Navigate to="/connexion" replace />;
  return (
    <section className="panel max-w-xl">
      <p className="eyebrow">VOTRE COMPTE</p>
      <h1 className="page-title mt-2">
        {user.mustChangePassword ? 'Choisir votre mot de passe' : 'Mon profil'}
      </h1>
      <p className="mt-3 text-sm">
        {user.firstName} {user.lastName} · {user.login}
      </p>
      {user.mustChangePassword && (
        <p role="status" className="notice mt-4">
          Changez votre mot de passe initial pour accéder à votre espace.
        </p>
      )}
      <form
        className="form-grid mt-6"
        onSubmit={form.handleSubmit(async (values) => {
          setError('');
          try {
            await api.post('/auth/change-password', {
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              website: values.website,
            });
            afterPasswordChange();
            client.clear();
            navigate(
              '/connexion?espace=' +
                (user.role === 'SUPER_ADMIN' ? 'admin' : 'responsable') +
                '&mot-de-passe-modifie=1',
            );
          } catch (e) {
            setError(errorMessage(e));
          }
        })}
      >
        <Honeypot field={form.register('website')} />
        <label>
          Mot de passe actuel
          <input
            type="password"
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            type="password"
            autoComplete="new-password"
            aria-label="Nouveau mot de passe"
            aria-describedby="suivi-password-hint"
            {...form.register('newPassword')}
          />
          <span id="suivi-password-hint" className="text-xs text-stone-500">
            12 à 256 caractères. Une phrase longue est recommandée.
          </span>
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <input type="password" autoComplete="new-password" {...form.register('confirmation')} />
        </label>
        {Object.entries(form.formState.errors).map(([name, value]) => (
          <p className="field-error" role="alert" key={name}>
            {value.message}
          </p>
        ))}
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <button className="primary-button justify-center" disabled={form.formState.isSubmitting}>
          Changer le mot de passe et me reconnecter
        </button>
      </form>
    </section>
  );
}
