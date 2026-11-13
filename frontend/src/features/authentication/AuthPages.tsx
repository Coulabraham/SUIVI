import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResult, ApiResponse } from '@suivi/contracts';
import { api, deviceFor, errorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Saisissez votre identifiant.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Saisissez le mot de passe actuel.'),
    newPassword: z.string().min(12, 'Utilisez au moins 12 caractères.').max(256),
    confirmation: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmation, {
    path: ['confirmation'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [params] = useSearchParams();
  const passwordUpdated = useAuthStore((s) => s.passwordUpdated);
  const accept = useAuthStore((s) => s.accept);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  if (!ready) return <p role="status">Vérification de la session…</p>;
  if (user)
    return <Navigate to={user.mustChangePassword ? '/profil' : '/tableau-de-bord'} replace />;
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-6 sm:p-9">
      <p className="eyebrow">VOTRE ESPACE SÉCURISÉ</p>
      <h1 className="page-title mt-2">Connexion à SUIVI</h1>
      <p className="mt-3 text-sm text-stone-500">
        Utilisez les accès remis par votre administrateur.
      </p>
      {(passwordUpdated || params.has('mot-de-passe-modifie')) && (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.
        </p>
      )}
      <form
        className="form-grid mt-7"
        onSubmit={form.handleSubmit(async (values) => {
          setError('');
          try {
            const r = await api.post<ApiResponse<AuthResult>>('/auth/login', {
              ...values,
              deviceId: deviceFor(values.login),
              deviceLabel: 'Navigateur SUIVI',
            });
            client.clear();
            accept(r.data.data);
            navigate(r.data.data.user.mustChangePassword ? '/profil' : '/tableau-de-bord');
          } catch (e) {
            setError(errorMessage(e));
          }
        })}
      >
        <label>
          Identifiant
          <input autoComplete="username" {...form.register('login')} />
          {form.formState.errors.login && (
            <span className="field-error">{form.formState.errors.login.message}</span>
          )}
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password && (
            <span className="field-error">{form.formState.errors.password.message}</span>
          )}
        </label>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <button className="primary-button justify-center" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p className="mt-5 text-xs leading-5 text-stone-500">
        Premier accès : le changement du mot de passe initial est obligatoire. En cas d’oubli,
        demandez une réinitialisation au Super Administrateur.
      </p>
      <Link className="mt-5 inline-block text-sm underline" to="/diagnostic">
        Vérifier les services
      </Link>
    </section>
  );
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const afterPasswordChange = useAuthStore((s) => s.afterPasswordChange);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
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
            });
            afterPasswordChange();
            client.clear();
            navigate('/connexion?mot-de-passe-modifie=1');
          } catch (e) {
            setError(errorMessage(e));
          }
        })}
      >
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
