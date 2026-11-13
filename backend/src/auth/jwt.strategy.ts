import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: auth.jwtSecret,
      algorithms: ['HS256'],
      issuer: 'suivi',
      audience: 'suivi-web',
      ignoreExpiration: false,
    });
  }
  validate(payload: { sub: string; sid: string }) {
    return this.auth.validateSession(payload.sub, payload.sid);
  }
}
