import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/entities/person.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getJwtExpiresIn, getJwtSecret } from './auth.config';
import { GoogleTokenService } from './google-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person]),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: {
        expiresIn: getJwtExpiresIn() as `${number}d`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleTokenService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
