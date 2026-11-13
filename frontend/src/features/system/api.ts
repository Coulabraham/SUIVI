import axios from 'axios';
import { z } from 'zod';
import type { ApiResponse, ServiceHealth } from '@suivi/contracts';
import { api } from '../../services/api';

const responseSchema = z.object({
  data: z.object({
    service: z.literal('SUIVI'),
    status: z.literal('ok'),
    checkedAt: z.iso.datetime(),
  }),
});

async function check(endpoint: string): Promise<ApiResponse<ServiceHealth>> {
  try {
    const response = await api.get<unknown>(endpoint);
    return responseSchema.parse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 503) {
      throw new Error('La base de données est indisponible. Vérifiez que PostgreSQL est démarré.', {
        cause: error,
      });
    }
    if (error instanceof z.ZodError)
      throw new Error('La réponse du serveur ne respecte pas le contrat attendu.', {
        cause: error,
      });
    throw new Error('Le serveur est injoignable. Vérifiez la connexion et le démarrage de l’API.', {
      cause: error,
    });
  }
}

export const getLiveness = () => check('/health/live');
export const getReadiness = () => check('/health/ready');
