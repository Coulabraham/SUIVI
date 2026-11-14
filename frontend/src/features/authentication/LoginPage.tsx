import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  AuthPortal,
  AuthResult,
  LoginInput,
  RegisterAdminInput,
  RegistrationStatus,
} from '@suivi/contracts';
import { api, deviceFor, errorMessage } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { useConnectivityStore } from '../../stores/connectivity';
import { readDeviceLabel } from '../../pwa/storage';
import { Honeypot } from './Honeypot';

const trap = z
  .string()
  .max(0, 'Le formulaire n’est pas valide. Actualisez la page puis réessayez.');
const loginSchema = z.object({
  login: z.string().trim().min(1, 'Saisissez votre identifiant.').max(100),
  password: z.string().min(1, 'Saisissez votre secret de connexion.').max(256),
  website: trap,
});
const registrationSchema = z
  .object({
    email: z
      .email('Saisissez une adresse e-mail valide.')
      .max(100)
      .transform((v) => v.trim()),
    firstName: z.string().trim().min(1, 'Saisissez votre prénom.').max(100),
    lastName: z.string().trim().min(1, 'Saisissez votre nom.').max(100),
    password: z
      .string()
      .min(12, 'Utilisez au moins 12 caractères.')
      .max(256)
      .regex(/\S/, 'Choisissez un mot de passe non vide.'),
    confirmation: z.string(),
    website: trap,
  })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Les mots de passe ne correspondent pas.',
  });

function Errors({ errors, serverError }: { errors: FieldErrors; serverError: string }) {
  const messages = Object.values(errors).flatMap((error) =>
    typeof error?.message === 'string' ? [error.message] : [],
  );
  if (!messages.length && !serverError) return null;
  return (
    <div role="alert" className="error-box">
      {[...messages, ...(serverError ? [serverError] : [])].map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  );
}
function useOpenSession() {
  const accept = useAuthStore((s) => s.accept);
  const client = useQueryClient();
  const navigate = useNavigate();
  return (result: AuthResult) => {
    client.clear();
    accept(result);
    navigate(result.user.mustChangePassword ? '/profil' : '/tableau-de-bord', { replace: true });
  };
}
function SignInForm({ portal }: { portal: AuthPortal }) {
  const manager = portal === 'MANAGER';
  const online = useConnectivityStore((s) => s.online);
  const complete = useOpenSession();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { website: '', login: '', password: '' },
  });
  return (
    <form
      className="form-grid mt-6"
      onSubmit={form.handleSubmit(async (values) => {
        setError('');
        try {
          const input: LoginInput = {
            ...values,
            portal,
            deviceId: deviceFor(values.login),
            deviceLabel: await readDeviceLabel(),
          };
          const response = await api.post<ApiResponse<AuthResult>>('/auth/login', input);
          complete(response.data.data);
        } catch (error) {
          setError(errorMessage(error));
        }
      })}
    >
      <Honeypot field={form.register('website')} />
      <label>
        {manager ? 'Identifiant' : 'Adresse e-mail ou identifiant'}
        <input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!form.formState.errors.login}
          {...form.register('login')}
        />
      </label>
      <label>
        {manager ? 'Code de connexion' : 'Mot de passe'}
        <input
          type="password"
          autoComplete="current-password"
          aria-invalid={!!form.formState.errors.password}
          {...form.register('password')}
        />
      </label>
      <Errors errors={form.formState.errors} serverError={error} />
      <button
        className="primary-button justify-center"
        disabled={form.formState.isSubmitting || !online}
      >
        {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="text-xs leading-6 text-stone-500">
        {manager
          ? 'Utilisez l’identifiant et le code remis par votre administrateur. Au premier accès, vous choisirez votre propre mot de passe.'
          : 'Retrouvez votre organisation avec les accès de votre compte administrateur.'}
      </p>
    </form>
  );
}
function RegistrationForm() {
  const online = useConnectivityStore((s) => s.online);
  const complete = useOpenSession();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      website: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmation: '',
    },
  });
  return (
    <form
      className="form-grid mt-6"
      onSubmit={form.handleSubmit(async (values) => {
        setError('');
        try {
          const input: RegisterAdminInput = {
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            password: values.password,
            website: values.website,
            deviceId: deviceFor(values.email),
            deviceLabel: await readDeviceLabel(),
          };
          const response = await api.post<ApiResponse<AuthResult>>('/auth/register-admin', input);
          complete(response.data.data);
        } catch (error) {
          setError(errorMessage(error));
        }
      })}
    >
      <Honeypot field={form.register('website')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          Prénom
          <input autoComplete="given-name" {...form.register('firstName')} />
        </label>
        <label>
          Nom
          <input autoComplete="family-name" {...form.register('lastName')} />
        </label>
      </div>
      <label>
        Adresse e-mail
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          {...form.register('email')}
        />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          autoComplete="new-password"
          aria-label="Mot de passe"
          aria-describedby="registration-password-hint"
          {...form.register('password')}
        />
        <span id="registration-password-hint" className="text-xs font-normal text-stone-500">
          Au moins 12 caractères. Une phrase longue est recommandée.
        </span>
      </label>
      <label>
        Confirmer le mot de passe
        <input type="password" autoComplete="new-password" {...form.register('confirmation')} />
      </label>
      <Errors errors={form.formState.errors} serverError={error} />
      <button
        className="primary-button justify-center"
        disabled={form.formState.isSubmitting || !online}
      >
        {form.formState.isSubmitting ? 'Création du compte…' : 'Créer mon compte administrateur'}
      </button>
    </form>
  );
}
function AdminAccess() {
  const online = useConnectivityStore((s) => s.online);
  const status = useQuery({
    queryKey: ['auth', 'registration-status'],
    enabled: online,
    queryFn: async () =>
      (await api.get<ApiResponse<RegistrationStatus>>('/auth/registration-status')).data.data,
    retry: false,
    staleTime: 0,
  });
  if (status.isError)
    return (
      <div className="mt-6">
        <p role="alert" className="error-box">
          {errorMessage(status.error)}
        </p>
        <button
          className="secondary-button mt-4"
          onClick={() => void status.refetch()}
          disabled={status.isFetching}
        >
          Réessayer
        </button>
      </div>
    );
  if (!status.data)
    return (
      <p role="status" className="mt-6 text-sm text-stone-600">
        {online
          ? 'Vérification de votre espace…'
          : 'Reconnectez-vous pour vérifier les accès administrateur.'}
      </p>
    );
  return (
    <>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {status.data.registrationOpen
          ? 'Bienvenue. Créez le premier compte administrateur de votre organisation.'
          : 'Votre organisation est déjà initialisée. Connectez-vous à votre compte.'}
      </p>
      {status.data.registrationOpen ? <RegistrationForm /> : <SignInForm portal="SUPER_ADMIN" />}
    </>
  );
}

export function LoginPage() {
  const { user, ready, passwordUpdated } = useAuthStore();
  const online = useConnectivityStore((s) => s.online);
  const [params, setParams] = useSearchParams();
  const portal =
    params.get('espace') === 'admin'
      ? 'SUPER_ADMIN'
      : params.get('espace') === 'responsable'
        ? 'MANAGER'
        : null;
  if (!ready) return <p role="status">Vérification de la session…</p>;
  if (user)
    return <Navigate to={user.mustChangePassword ? '/profil' : '/tableau-de-bord'} replace />;
  const choose = (value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set('espace', value);
    else next.delete('espace');
    setParams(next);
  };
  return (
    <div className="auth-layout">
      <section className="auth-introduction">
        <p className="eyebrow">CHAQUE CONTRIBUTION COMPTE</p>
        <h2>
          Ensemble,
          <br />
          faisons avancer
          <br />
          <em>nos projets.</em>
        </h2>
        <p className="mt-6 max-w-sm text-base leading-8 text-stone-600">
          Un espace commun pour suivre les cotisations, accompagner vos membres et voir votre
          objectif prendre forme.
        </p>
        <div className="auth-promise">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Un suivi clair</strong>
            <p>Vos membres, vos encaissements et votre progression au même endroit.</p>
          </div>
        </div>
        <div className="auth-promise">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Des accès personnels</strong>
            <p>Un compte individuel et une seule session active à la fois.</p>
          </div>
        </div>
        <p className="mt-10 text-xs tracking-wide text-stone-500">
          COTISATIONS EN FCFA · COLLECTE HEBDOMADAIRE
        </p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">VOTRE ESPACE SÉCURISÉ</p>
        <h1 id="auth-title" className="auth-title">
          {portal === 'SUPER_ADMIN'
            ? 'Espace administrateur'
            : portal === 'MANAGER'
              ? 'Espace responsable'
              : 'Bienvenue dans SUIVI'}
        </h1>
        {(passwordUpdated || params.has('mot-de-passe-modifie')) && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.
          </p>
        )}
        {!online && (
          <p role="status" className="notice mt-4">
            Une connexion au serveur est nécessaire pour vous authentifier. Les données de votre
            département restent protégées.
          </p>
        )}
        {!portal ? (
          <>
            <p className="mt-3 text-sm leading-6 text-stone-500">
              Choisissez votre espace pour commencer.
            </p>
            <div className="mt-7 grid gap-4">
              <button
                type="button"
                className="role-choice"
                aria-label="Administrateur"
                onClick={() => choose('admin')}
              >
                <span className="role-monogram" aria-hidden="true">
                  A
                </span>
                <span>
                  <strong>Administrateur</strong>
                  <span>Créer votre compte ou piloter votre organisation.</span>
                </span>
                <span className="role-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
              <button
                type="button"
                className="role-choice"
                aria-label="Responsable"
                onClick={() => choose('responsable')}
              >
                <span className="role-monogram" aria-hidden="true">
                  R
                </span>
                <span>
                  <strong>Responsable</strong>
                  <span>Accéder au suivi de votre département.</span>
                </span>
                <span className="role-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-emerald-800 underline underline-offset-4"
              onClick={() => choose(null)}
            >
              ← Changer d’espace
            </button>
            {portal === 'SUPER_ADMIN' ? (
              <AdminAccess />
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-stone-600">
                  Connectez-vous avec les accès remis par votre administrateur.
                </p>
                <SignInForm portal="MANAGER" />
              </>
            )}
          </>
        )}
        <p className="mt-6 border-t border-stone-100 pt-5 text-xs leading-6 text-stone-500">
          Une nouvelle connexion ferme la session précédente sur vos autres appareils.
        </p>
        <Link
          className="mt-3 inline-block text-xs text-stone-500 underline underline-offset-4"
          to="/diagnostic"
        >
          Besoin d’aide pour vous connecter ?
        </Link>
      </section>
    </div>
  );
}
