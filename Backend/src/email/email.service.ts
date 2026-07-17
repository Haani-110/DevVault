import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from = process.env.FROM_EMAIL ?? 'noreply@devvault.app';
  private readonly configured: boolean;

  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    if (key) {
      sgMail.setApiKey(key);
      this.configured = true;
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — emails will be logged only');
      this.configured = false;
    }
  }

  async sendPasswordReset(opts: {
    to: string;
    username: string;
    resetUrl: string;
  }) {
    const { to, username, resetUrl } = opts;
    const html = this.buildResetEmail({ username, resetUrl, to });

    if (!this.configured) {
      this.logger.log(`[DEV] Password reset email for ${to}:\n  ${resetUrl}`);
      return;
    }

    try {
      await sgMail.send({
        to,
        from: { email: this.from, name: 'DevVault' },
        subject: 'Reset your DevVault password',
        html,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.logger.error('Failed to send password reset email', err);
      throw err;
    }
  }

  private buildResetEmail(opts: {
    username: string;
    resetUrl: string;
    to: string;
  }) {
    const { username, resetUrl } = opts;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your DevVault password</title>
</head>
<body style="margin:0;padding:0;background:#0f1420;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1420;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#141a2a;border-radius:16px;padding:14px 20px;border:1px solid #262e42;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <!-- Vault icon SVG inline -->
                          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="32" height="32" rx="8" fill="#1d2438"/>
                            <circle cx="16" cy="16" r="9" stroke="#E8A33D" stroke-width="2"/>
                            <circle cx="16" cy="16" r="4" stroke="#E8A33D" stroke-width="1.5"/>
                            <line x1="16" y1="7" x2="16" y2="9" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="16" y1="23" x2="16" y2="25" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="25" y1="16" x2="23" y2="16" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="9" y1="16" x2="7" y2="16" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="22.5" y1="9.5" x2="21.1" y2="10.9" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="10.9" y1="21.1" x2="9.5" y2="22.5" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="22.5" y1="22.5" x2="21.1" y2="21.1" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="10.9" y1="10.9" x2="9.5" y2="9.5" stroke="#E8A33D" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </td>
                        <td>
                          <span style="font-size:18px;font-weight:700;color:#e6e9f0;letter-spacing:-0.3px;">
                            Dev<span style="color:#E8A33D;">Vault</span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#141a2a;border:1px solid #262e42;border-radius:16px;padding:40px 40px 36px;">

              <!-- Title -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e6e9f0;letter-spacing:-0.3px;">
                Reset your password
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#8890a4;line-height:1.6;">
                Hi <strong style="color:#e6e9f0;">${username}</strong>, we received a request to reset the password for your DevVault account.
              </p>

              <!-- Divider -->
              <div style="height:1px;background:#262e42;margin-bottom:28px;"></div>

              <p style="margin:0 0 20px;font-size:14px;color:#8890a4;line-height:1.6;">
                Click the button below to choose a new password. This link is valid for <strong style="color:#e6e9f0;">1 hour</strong> and can only be used once.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#E8A33D;border-radius:8px;">
                    <a href="${resetUrl}" target="_blank"
                       style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#0f1420;text-decoration:none;letter-spacing:-0.1px;">
                      Reset password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin:0 0 8px;font-size:12px;color:#5a6278;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#E8A33D;word-break:break-all;">
                <a href="${resetUrl}" style="color:#E8A33D;text-decoration:none;">${resetUrl}</a>
              </p>

              <!-- Divider -->
              <div style="height:1px;background:#262e42;margin-bottom:24px;"></div>

              <!-- Security note -->
              <table cellpadding="0" cellspacing="0" style="background:#1d2438;border-radius:8px;border:1px solid #262e42;padding:0;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:12px;color:#5a6278;line-height:1.7;">
                      🔒 <strong style="color:#8890a4;">Didn't request this?</strong> If you didn't ask to reset your password, you can safely ignore this email. Your account is secure and your password will not change.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#5a6278;line-height:1.7;">
                This email was sent by <strong style="color:#8890a4;">DevVault</strong> · Developer Productivity Platform<br/>
                You're receiving this because a password reset was requested for your account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
