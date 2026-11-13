import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { jsonValue } from './business.service.js';

@Injectable()
export class JsonInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data: unknown) => jsonValue(data)));
  }
}
