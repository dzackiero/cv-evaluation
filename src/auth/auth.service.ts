import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/request/register.dto';
import { LoginDto } from './dto/request/login.dto';
import { RefreshTokenDto } from './dto/request/refresh-token.dto';
import { JwtPayload } from './dto/jwt-payload.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(request: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: request.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHashed = await bcrypt.hash(request.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: request.name,
        email: request.email,
        password: passwordHashed,
      },
    });

    return this.generateAuthResponse(user.id, user.email, user.name);
  }

  async login(request: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: request.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(request.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateAuthResponse(user.id, user.email, user.name);
  }

  async refreshToken(request: RefreshTokenDto) {
    try {
      const payload = this.jwt.verify<JwtPayload>(request.refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateAuthResponse(user.id, user.email, user.name);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private generateAuthResponse(id: string, email: string, name: string) {
    const accessTokenExpiresIn = 3600;
    const refreshTokenExpiresIn = 3600 * 7;

    const accessToken = this.jwt.sign(
      { sub: id, email, type: 'access' },
      { expiresIn: accessTokenExpiresIn },
    );

    const refreshToken = this.jwt.sign(
      { sub: id, type: 'refresh' },
      { expiresIn: refreshTokenExpiresIn },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenExpiresIn,
      user: {
        id,
        email,
        name,
      },
    };
  }
}
