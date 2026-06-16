import bcrypt from 'bcrypt';
import prisma from '../../config/db.js';
import AppError from '../../utils/AppError.js';
import { sendEmail } from '../../config/mail.js';
import { generateAccessToken, generateRefreshToken, generateOTP, hashToken } from '../../utils/tokens.js';

class AuthService {
  // ==========================================
  // 1. REGISTER USER (Auto-Login Enabled)
  // ==========================================
  static async register({ name, email, password, phoneNumber, ipAddress, userAgent, deviceId }) {
    const normalizedEmail = email.toLowerCase();
    
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (existingUser) {
      throw new AppError('Email is already registered. Please log in.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const rawRefreshToken = generateRefreshToken();
    const hashedRefreshToken = hashToken(rawRefreshToken);

    // We use a transaction to guarantee User, Verification, and Session are created together
    const { newUser, accessToken } = await prisma.$transaction(async (tx) => {
      // 1. Create the User
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          phoneNumber: phoneNumber || null, // Optional, defaults to null if not provided
          accounts: {
            create: {
              providerId: 'credentials',
              accountId: normalizedEmail,
              password: hashedPassword,
            },
          },
        },
      });

      // 2. Create the Email Verification OTP
      await tx.verification.create({
        data: {
          identifier: normalizedEmail,
          value: hashedOtp,
          expiresAt: otpExpiresAt,
        },
      });

      // 3. Auto-Login: Generate Access Token & Session
      const accessTkn = generateAccessToken(user.id, user.role);
      
      await tx.session.create({
        data: {
          id: hashedRefreshToken,
          userId: user.id,
          ipAddress,
          userAgent,
          deviceId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Days session
        },
      });

      return { newUser: user, accessToken: accessTkn };
    });

    // Fire-and-forget email dispatch
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Verify your Gaprio account</h2>
        <p>Hi ${name}, welcome to Gaprio! You are logged in, but please use the verification code below to fully activate your account:</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #777;">This code expires in 15 minutes.</p>
      </div>
    `;

    sendEmail({
      to: normalizedEmail,
      subject: 'Your Gaprio Verification Code',
      html: emailHtml,
    }).catch(err => console.error("🚨 Registration Email Failed:", err.message));

    // Return the user data AND the tokens so the frontend can log them in immediately
    return {
      user: { 
        id: newUser.id, 
        name: newUser.name, 
        email: newUser.email,
        role: newUser.role
      },
      accessToken,
      refreshToken: rawRefreshToken,
      message: 'Registration successful. You are now logged in. Please check your email for the verification code.',
    };
  }

  // ==========================================
  // 2. VERIFY EMAIL OTP
  // ==========================================
  static async verifyEmail({ email, otp }) {
    const normalizedEmail = email.toLowerCase();
    
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) throw new AppError('User not found.', 404);
    if (user.emailVerified) throw new AppError('Email is already verified.', 400);

    const verificationRecord = await prisma.verification.findFirst({
      where: { identifier: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationRecord) throw new AppError('No verification code found. Please request a new one.', 400);
    if (verificationRecord.expiresAt < new Date()) throw new AppError('OTP has expired. Please request a new one.', 400);

    const isValidOTP = await bcrypt.compare(otp, verificationRecord.value);
    if (!isValidOTP) throw new AppError('Invalid OTP.', 400);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: { emailVerified: true },
      }),
      prisma.verification.delete({ where: { id: verificationRecord.id } }),
    ]);

    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to Gaprio</h2>
        <p>Hi ${user.name}, your email has been successfully verified.</p>
        <p>You now have full access to all platform features.</p>
      </div>
    `;

    sendEmail({
      to: normalizedEmail,
      subject: 'Welcome to Gaprio!',
      html: welcomeHtml,
    }).catch(err => console.error("🚨 Welcome Email Failed:", err.message));

    return { message: 'Email verified successfully.' };
  }

  // ==========================================
  // 3. LOGIN
  // ==========================================
  static async login({ email, password, ipAddress, userAgent, deviceId }) {
    const normalizedEmail = email.toLowerCase();
    
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { where: { providerId: 'credentials' } } },
    });

    if (!user || user.accounts.length === 0) throw new AppError('Invalid email or password.', 401);
    if (user.isBanned) throw new AppError('Your account has been suspended.', 403);
    
    // NOTE: If they log out without verifying their email, they will be blocked from logging back in here.
    if (!user.emailVerified) throw new AppError('Please verify your email before logging in.', 403);

    const account = user.accounts[0];
    const isPasswordCorrect = await bcrypt.compare(password, account.password);
    if (!isPasswordCorrect) throw new AppError('Invalid email or password.', 401);

    const accessToken = generateAccessToken(user.id, user.role);
    const rawRefreshToken = generateRefreshToken();
    const hashedRefreshToken = hashToken(rawRefreshToken);

    await prisma.session.create({
      data: {
        id: hashedRefreshToken,
        userId: user.id,
        ipAddress,
        userAgent,
        deviceId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Days
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  // ==========================================
  // 4. REFRESH SESSION
  // ==========================================
  static async refreshSession({ refreshToken, ipAddress, userAgent, deviceId }) {
    if (!refreshToken) throw new AppError('Refresh token is required.', 401);

    const hashedToken = hashToken(refreshToken);
    
    const session = await prisma.session.findUnique({
      where: { id: hashedToken },
      include: { user: true },
    });

    if (!session) throw new AppError('Invalid or expired session. Please log in again.', 401);
    
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: hashedToken } });
      throw new AppError('Session expired. Please log in again.', 401);
    }
    
    if (session.user.isBanned) throw new AppError('Account suspended.', 403);

    const newAccessToken = generateAccessToken(session.user.id, session.user.role);
    const newRawRefreshToken = generateRefreshToken();
    const newHashedRefreshToken = hashToken(newRawRefreshToken);

    await prisma.$transaction([
      prisma.session.delete({ where: { id: hashedToken } }),
      prisma.session.create({
        data: {
          id: newHashedRefreshToken,
          userId: session.user.id,
          ipAddress,
          userAgent,
          deviceId: deviceId || session.deviceId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  // ==========================================
  // 5. LOGOUT
  // ==========================================
  static async logout({ refreshToken }) {
    if (!refreshToken) return;
    const hashedToken = hashToken(refreshToken);
    await prisma.session.deleteMany({ where: { id: hashedToken } });
  }

  // ==========================================
  // 6. FORGOT PASSWORD
  // ==========================================
  static async forgotPassword({ email }) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) return { message: 'If that email exists, an OTP has been sent.' };

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction([
      prisma.verification.deleteMany({ where: { identifier: normalizedEmail } }),
      prisma.verification.create({
        data: {
          identifier: normalizedEmail,
          value: await bcrypt.hash(otp, 10),
          expiresAt,
        },
      })
    ]);

    const resetHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Gaprio Password Reset</h2>
        <p>Hi ${user.name}, use the code below to reset your password:</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #777;">This code expires in 15 minutes.</p>
      </div>
    `;

    sendEmail({
      to: normalizedEmail,
      subject: 'Reset Your Gaprio Password',
      html: resetHtml,
    }).catch(err => console.error("🚨 Forgot Password Email Failed:", err.message));

    return { message: 'If that email exists, an OTP has been sent.' };
  }

  // ==========================================
  // 7. RESET PASSWORD
  // ==========================================
  static async resetPassword({ email, otp, newPassword }) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { where: { providerId: 'credentials' } } },
    });

    if (!user || user.accounts.length === 0) throw new AppError('Invalid request.', 400);

    const verificationRecord = await prisma.verification.findFirst({
      where: { identifier: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationRecord) throw new AppError('No verification code found.', 400);
    if (verificationRecord.expiresAt < new Date()) throw new AppError('OTP has expired.', 400);

    const isValidOTP = await bcrypt.compare(otp, verificationRecord.value);
    if (!isValidOTP) throw new AppError('Invalid OTP.', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.account.update({
        where: { id: user.accounts[0].id },
        data: { password: hashedPassword },
      }),
      prisma.verification.delete({ where: { id: verificationRecord.id } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    const notifyHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Security Update</h2>
        <p>Hi ${user.name}, your Gaprio password was recently changed. All active sessions have been logged out for your security.</p>
      </div>
    `;

    sendEmail({
      to: normalizedEmail,
      subject: 'Your Gaprio Password Was Changed',
      html: notifyHtml,
    }).catch(err => console.error("🚨 Reset Password Notify Email Failed:", err.message));

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // ==========================================
  // 8. RESEND VERIFICATION OTP
  // ==========================================
  static async resendVerification({ email }) {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) throw new AppError('User not found.', 404);
    if (user.emailVerified) throw new AppError('Email is already verified.', 400);

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction([
      prisma.verification.deleteMany({ where: { identifier: normalizedEmail } }),
      prisma.verification.create({
        data: {
          identifier: normalizedEmail,
          value: await bcrypt.hash(otp, 10),
          expiresAt,
        },
      })
    ]);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>New Verification Code</h2>
        <p>Hi ${user.name}, here is your new Gaprio verification code:</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
          ${otp}
        </div>
      </div>
    `;

    sendEmail({
      to: normalizedEmail,
      subject: 'Your New Gaprio Verification Code',
      html: emailHtml,
    }).catch(err => console.error("🚨 Resend OTP Email Failed:", err.message));

    return { message: 'A new verification code has been sent to your email.' };
  }
}

export default AuthService;