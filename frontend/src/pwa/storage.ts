const database = async () =>
  (await import('../features/synchronization/local-database')).localDatabase;

export async function readDeviceLabel() {
  try {
    const localDatabase = await database();
    return (await localDatabase.settings.get('deviceLabel'))?.value ?? 'Navigateur SUIVI';
  } catch {
    return 'Navigateur SUIVI';
  } // Cette préférence facultative ne doit pas empêcher une connexion en ligne.
}
export async function saveDeviceLabel(value: string) {
  const label = value.trim();
  if (!label || label.length > 80)
    throw new Error('Le nom de cet appareil doit contenir de 1 à 80 caractères.');
  await (await database()).settings.put({ key: 'deviceLabel', value: label });
}
export async function inspectLocalStorage() {
  const localDatabase = await database();
  await localDatabase.open();
  const [estimate, persistent, label] = await Promise.all([
    navigator.storage?.estimate?.(),
    navigator.storage?.persisted?.(),
    readDeviceLabel(),
  ]);
  return {
    label,
    persistent: persistent ?? null,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
  };
}
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist)
    throw new Error('Ce navigateur ne propose pas la protection du stockage local.');
  const accepted = await navigator.storage.persist();
  await (
    await database()
  ).settings.put({
    key: 'persistenceRequestedAt',
    value: new Date().toISOString(),
  });
  return accepted;
}
