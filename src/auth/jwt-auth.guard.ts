import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const validation = await this.authService.validateToken(token);

    if (!validation.valid || !validation.userId) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach user info to request for use in controllers
    request.user = {
      userId: validation.userId,
      email: '', // Email would be decoded from JWT if needed
    };

    return true;
  }
}