import type { NotificationType } from '../generated/prisma/enums.js';

export interface EventPolicy {
  type: NotificationType;
  title: string;
  message: string;
  personal?: boolean;
}
export const eventPolicies: Record<string, EventPolicy> = {
  PAYMENT_CREATED: {
    type: 'INFORMATION',
    title: 'Nouvel encaissement',
    message:
      'Un encaissement a été enregistré. Consultez l’historique pour vérifier les détails autorisés.',
  },
  PAYMENT_CORRECTED: {
    type: 'WARNING',
    title: 'Encaissement corrigé',
    message: 'Une correction justifiée a été ajoutée à un encaissement.',
  },
  PAYMENT_CANCELLED: {
    type: 'WARNING',
    title: 'Encaissement annulé',
    message: 'Un encaissement a été annulé avec justification ; son historique est conservé.',
  },
  MEMBER_CREATED: {
    type: 'INFORMATION',
    title: 'Membre ajouté',
    message: 'Un membre a été inscrit dans un département.',
  },
  MEMBER_UPDATED: {
    type: 'INFORMATION',
    title: 'Informations d’un membre modifiées',
    message: 'Les informations d’un membre ont été mises à jour.',
  },
  MEMBER_ARCHIVED: {
    type: 'WARNING',
    title: 'Membre archivé',
    message: 'Un membre a été archivé ; ses anciens paiements sont conservés.',
  },
  MEMBER_REACTIVATED: {
    type: 'INFORMATION',
    title: 'Membre réactivé',
    message: 'Un membre a été réactivé pour la collecte.',
  },
  MEMBER_TRANSFERRED: {
    type: 'WARNING',
    title: 'Affectation d’un membre modifiée',
    message:
      'L’affectation départementale d’un membre a changé. Les anciens paiements restent dans leur département d’origine.',
  },
  MANAGER_CREATED: {
    type: 'INFORMATION',
    title: 'Responsable créé',
    message: 'Un compte de responsable a été créé et affecté.',
  },
  MANAGER_UPDATED: {
    type: 'WARNING',
    title: 'Accès d’un responsable modifiés',
    message:
      'Les informations ou l’affectation d’un responsable ont été modifiées ; ses sessions ont été révoquées.',
    personal: true,
  },
  ACCESS_RESET: {
    type: 'SECURITY',
    title: 'Accès réinitialisés',
    message:
      'Les accès d’un responsable ont été réinitialisés. Le nouveau secret doit être remis par un canal privé vérifié.',
    personal: true,
  },
  PASSWORD_CHANGED: {
    type: 'SECURITY',
    title: 'Mot de passe modifié',
    message: 'Un mot de passe a été modifié et les sessions antérieures ont été révoquées.',
    personal: true,
  },
  DEPARTMENT_CREATED: {
    type: 'INFORMATION',
    title: 'Département créé',
    message: 'Un département a été ajouté à l’organisation.',
  },
  DEPARTMENT_UPDATED: {
    type: 'WARNING',
    title: 'Département modifié',
    message: 'Les informations ou le statut d’un département ont changé.',
  },
  OBJECTIVE_CREATED: {
    type: 'INFORMATION',
    title: 'Campagne créée',
    message: 'Une campagne et son calendrier de collecte ont été créés.',
  },
  OBJECTIVE_UPDATED: {
    type: 'WARNING',
    title: 'Campagne modifiée',
    message: 'L’objectif ou le statut d’une campagne a été modifié avec justification.',
  },
  UNUSUAL_LOGIN: {
    type: 'SECURITY',
    title: 'Connexion depuis un nouvel appareil',
    message:
      'Un compte disposant déjà d’un appareil a été utilisé depuis un nouvel appareil. Vérifiez cette connexion.',
    personal: true,
  },
  REFRESH_REUSE_DETECTED: {
    type: 'SECURITY',
    title: 'Session révoquée par sécurité',
    message:
      'Un ancien jeton de renouvellement a été réutilisé. La session concernée a été révoquée.',
    personal: true,
  },
  SYNC_FAILED: {
    type: 'ERROR',
    title: 'Échec de synchronisation',
    message: 'Une opération de synchronisation a échoué et nécessite une vérification.',
    personal: true,
  },
};
