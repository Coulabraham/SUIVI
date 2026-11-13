import { auditValues } from '../src/events/sanitize.js';
import { eventPolicies } from '../src/events/event-policy.js';
describe('Protection des événements', () => {
  it('retire les secrets imbriqués et conserve les montants exacts et les versions métier', () => {
    expect(
      auditValues({
        amount: 9007199254740993n,
        credentialVersion: 2,
        passwordHash: 'secret',
        nested: [{ accessToken: 'secret', name: 'Public' }],
        authorization: 'secret',
      }),
    ).toEqual({ amount: '9007199254740993', credentialVersion: 2, nested: [{ name: 'Public' }] });
  });
  it('ne transforme ni les consultations ni les connexions ordinaires en alertes', () => {
    expect(eventPolicies.LOGIN_SUCCEEDED).toBeUndefined();
    expect(eventPolicies.SESSION_REVOKED).toBeUndefined();
    expect(eventPolicies.MEMBER_VIEWED).toBeUndefined();
    expect(eventPolicies.UNUSUAL_LOGIN?.type).toBe('SECURITY');
  });
});
