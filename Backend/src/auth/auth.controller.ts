import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { frontendUrls } from '../config/env';
import { AuthService } from './auth.service';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { buildGithubAuthorizeUrl } from './strategies/github.strategy';
import type { OAuthProfile } from './strategies/google.strategy';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Password guessing is the one thing worth being slow/strict about; the
  // global limit is per-IP anyway, which is exactly what a botnet bypasses.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * Stateless JWTs, so "logout" is the client dropping them — the endpoint
   * exists so the UI has one thing to call and so adding a denylist later is
   * a server change, not a client release.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (client discards tokens)' })
  logout() {
    return;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password while logged in (invalidates older sessions)' })
  changePassword(@CurrentUser() user: { userId: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password using a valid token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.completeOAuthSignIn(res, req.user as OAuthProfile);
  }

  // ─── GitHub OAuth ──────────────────────────────────────────────────────────

  @Get('github')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubAuth() {
    // Passport redirects to GitHub — no body needed
  }

  @Get('github/link-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get a GitHub OAuth URL that connects GitHub to the CURRENT logged-in account — ' +
      'used by "Connect GitHub" in Settings, instead of the plain sign-in route.',
  })
  getGithubLinkUrl(@CurrentUser() user: { userId: string }) {
    // The state token is what lets the callback attach this GitHub account to
    // the logged-in user by id, rather than by matching emails.
    return { url: buildGithubAuthorizeUrl(this.authService.createLinkState(user.userId)) };
  }

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state?: string,
  ) {
    // The guard already redirected (and ended the response) if the provider
    // rejected the attempt.
    if (res.headersSent) return;

    const profile = req.user as OAuthProfile;

    // If `state` decodes to a valid link token, an already-logged-in user
    // clicked "Connect GitHub" — attach this GitHub account to THEIR user (by
    // userId, not by email match) rather than running normal sign-in
    // resolution, which could otherwise create/log into an unrelated account
    // if the GitHub email differs from the one they're already using.
    const linkUserId = this.authService.verifyLinkState(state);
    if (linkUserId) {
      try {
        await this.authService.linkOAuthAccount(linkUserId, profile);
        return res.redirect(`${frontendUrls[0]}/settings?github=linked`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to link GitHub account';
        return res.redirect(`${frontendUrls[0]}/settings?github=error&message=${encodeURIComponent(message)}`);
      }
    }

    return this.completeOAuthSignIn(res, profile);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Finishes a provider sign-in.
   *
   * Tokens travel in the URL *fragment* (`#accessToken=…`), not the query
   * string: fragments are never sent to a server, never appear in access logs
   * and never leak through a `Referer` header, while still being readable by
   * the SPA at `/auth/callback`. The callback page wipes them from history as
   * soon as it has read them.
   */
  private async completeOAuthSignIn(res: Response, profile: OAuthProfile) {
    if (res.headersSent) return;

    const tokens = await this.authService.findOrCreateOAuthUser(profile);
    const fragment = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    res.redirect(`${frontendUrls[0]}/auth/callback#${fragment.toString()}`);
  }
}
