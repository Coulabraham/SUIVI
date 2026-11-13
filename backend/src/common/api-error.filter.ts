import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@suivi/contracts';
import { databaseErrorCodes } from './database-errors.js';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId: string }>();
    const response = context.getResponse<Response>();
    const codes = databaseErrorCodes(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : codes.some((code) =>
              [
                'P2002',
                'P2003',
                'P2004',
                'P2025',
                'P2034',
                '23505',
                '23503',
                '23514',
                '40001',
                '40P01',
              ].includes(code),
            )
          ? 409
          : codes.some((code) =>
                [
                  'P1001',
                  'P1002',
                  'P1017',
                  'P2024',
                  'P2028',
                  '57014',
                  '55P03',
                  'PG_QUERY_TIMEOUT',
                ].includes(code),
              )
            ? 503
            : 500;
    const descriptions: Record<number, [string, string]> = {
      400: ['VALIDATION_ERROR', 'La requête contient des données invalides.'],
      401: ['UNAUTHENTICATED', 'Une authentification valide est nécessaire.'],
      403: ['FORBIDDEN', 'Vous ne disposez pas des autorisations nécessaires.'],
      404: ['NOT_FOUND', 'La ressource demandée est introuvable.'],
      409: ['CONFLICT', 'Cette opération nécessite la résolution d’un conflit.'],
      429: ['TOO_MANY_ATTEMPTS', 'Trop de tentatives. Réessayez plus tard.'],
      503: ['DATABASE_UNAVAILABLE', 'La connexion à la base de données est indisponible.'],
    };
    const [code, message] = descriptions[status] ?? [
      'INTERNAL_ERROR',
      'Une erreur interne est survenue.',
    ];
    if (status >= 500 && status !== 503) {
      const frames =
        exception instanceof Error
          ? exception.stack
              ?.split('\n')
              .filter((line) => /^\s+at /.test(line))
              .slice(0, 6)
              .join('\n')
          : '';
      this.logger.error(
        `Erreur interne : ${request.requestId} ; ${exception instanceof Error ? exception.name : 'UnknownError'} ; codes=${codes.filter((c) => /^[A-Za-z0-9_]{1,20}$/.test(c)).join(',')}\n${frames ?? ''}`,
      );
    }
    const detail = exception instanceof HttpException ? exception.getResponse() : null;
    const explicit =
      detail &&
      typeof detail === 'object' &&
      'code' in detail &&
      'message' in detail &&
      typeof detail.code === 'string' &&
      typeof detail.message === 'string'
        ? detail
        : null;
    const body: ApiErrorResponse = {
      error: {
        code: explicit ? String(explicit.code) : code,
        message: explicit ? String(explicit.message) : message,
        requestId: request.requestId,
      },
    };
    response.status(status).json(body);
  }
}
