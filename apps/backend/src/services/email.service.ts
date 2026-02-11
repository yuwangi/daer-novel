import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendMail(to: string, subject: string, text: string, html?: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USERNAME,
        to,
        subject,
        text,
        html,
      });
      logger.info(`Message sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, url: string) {
    logger.info(`Sending verification email to ${email}`);
    const subject = '验证您的邮箱 - Daer Novel';
    const text = `欢迎使用 Daer Novel！请点击以下链接验证您的邮箱：\n\n${url}\n\n如果这不是您操作的，请忽略此邮件。`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">验证您的邮箱</h2>
        <p>欢迎使用 <strong>Daer Novel</strong>！</p>
        <p>请点击下面的按钮验证您的邮箱地址：</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">立即验证</a>
        </div>
        <p style="color: #666; font-size: 14px;">或者复制以下链接到浏览器中打开：</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${url}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">如果这不是您本人操作，请忽略此邮件。</p>
      </div>
    `;

    return this.sendMail(email, subject, text, html);
  }

  async sendPasswordResetEmail(email: string, url: string) {
    logger.info(`Sending password reset email to ${email}`);
    const subject = '重置您的密码 - Daer Novel';
    const text = `您收到此邮件是因为您（或其他人）请求重置您的账户密码。\n\n请点击以下链接重置密码：\n\n${url}\n\n如果这不是您操作的，请忽略此邮件。`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">重置您的密码</h2>
        <p>您收到此邮件是因为您请求重置您的账户密码。</p>
        <p>请点击下面的按钮重置密码：</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">重置密码</a>
        </div>
        <p style="color: #666; font-size: 14px;">或者复制以下链接到浏览器中打开：</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${url}</p>
        <div style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 14px;">
          <strong>注意：</strong> 此链接将在 1 小时后失效。
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">如果这不是您本人操作，请忽略此邮件，您的密码将不会改变。</p>
      </div>
    `;

    return this.sendMail(email, subject, text, html);
  }
}

export const emailService = new EmailService();
