import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'devvault-access-secret-change-in-production';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'devvault-refresh-secret-change-in-production';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly accessExpiresIn: any = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly refreshExpiresIn: any = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const emailExists = await this.usersService.findByEmail(dto.email);
    if (emailExists) throw new ConflictException('Email already registered');

    const usernameExists = await this.usersService.findByUsername(dto.username);
    if (usernameExists) throw new ConflictException('Username already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload: TokenPayload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    role: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl ?? undefined,
      bio: user.bio ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
