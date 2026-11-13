import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  readonly prisma: PrismaClient;

  constructor(config: ConfigService<Environment, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 5000,
      // Annulation côté serveur : ne pas laisser un timeout client désynchroniser le protocole
      // pendant une transaction ou un lot de semaines de collecte.
      statement_timeout: 10000,
      lock_timeout: 5000,
      max: 5,
    });
    this.prisma = new PrismaClient({ adapter: new PrismaPg(this.pool), log: [] });
    this.pool.on('error', () =>
      this.logger.warn('Une connexion PostgreSQL inactive a été interrompue.'),
    );
  }

  async isReady(): Promise<boolean> {
    try {
      const probe = { text: 'SELECT 1', query_timeout: 2000 };
      await this.pool.query(probe);
      return true;
    } catch {
      this.logger.warn('Le contrôle de disponibilité PostgreSQL a échoué.');
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
    await this.pool.end();
  }
}
