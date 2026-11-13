import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsString()
  @IsNotEmpty()
  HOST = '127.0.0.1';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false, require_protocol: true })
  FRONTEND_ORIGIN = 'http://127.0.0.1:5173';

  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  API_DOCS_ENABLED = false;

  @IsUrl({ protocols: ['postgresql', 'postgres'], require_tld: false, require_protocol: true })
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  AUTH_JWT_SECRET?: string;
}

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, input);
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Configuration invalide : ${errors.map((error) => error.property).join(', ')}.`,
    );
  }
  if (/^(GENERER_|CHANGE_ME)/.test(environment.AUTH_JWT_SECRET ?? ''))
    throw new Error('AUTH_JWT_SECRET doit être généré ; une valeur d’exemple est interdite.');
  if (environment.NODE_ENV === 'production' && environment.API_DOCS_ENABLED) {
    throw new Error('Swagger doit être désactivé en production.');
  }
  if (
    environment.NODE_ENV === 'production' &&
    !environment.FRONTEND_ORIGIN.startsWith('https://')
  ) {
    throw new Error('FRONTEND_ORIGIN doit utiliser HTTPS en production.');
  }
  if (environment.NODE_ENV === 'production' && !environment.AUTH_JWT_SECRET)
    throw new Error('AUTH_JWT_SECRET est obligatoire en production.');
  return environment;
}
