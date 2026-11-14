/** Liste fermée : une URL d'API ou d'export ne doit jamais recevoir le shell HTML. */
const shellPaths = new Set([
  '/',
  '/presentation',
  '/connexion',
  '/profil',
  '/tableau-de-bord',
  '/departements',
  '/responsables',
  '/membres',
  '/encaissements',
  '/objectifs',
  '/notifications',
  '/audit',
  '/diagnostic',
  '/installation',
]);
export function isPrivatePath(pathname: string) {
  return /^\/(?:api|auth|reports|exports)(?:\/|$)/i.test(pathname);
}
export function isShellNavigation(pathname: string) {
  return !isPrivatePath(pathname) && shellPaths.has(pathname);
}
