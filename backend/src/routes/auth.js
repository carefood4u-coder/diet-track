const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { sendEmail } = require('../utils/mailer');
const { generateOtp, hashOtp, compareOtp } = require('../utils/otp');

const router = express.Router();

const OTP_TTL_MINUTES = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password { email }
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always respond the same way to avoid leaking which emails exist.
    const genericResponse = {
      message: 'If an account exists for that email, an OTP has been sent.',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetOtp.create({
      data: { userId: user.id, otpHash, expiresAt },
    });

    const result = await sendEmail({
      to: user.email,
      subject: 'DietTrack password reset code',
      text: `Your DietTrack password reset code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your DietTrack password reset code is <b>${otp}</b>.</p><p>It expires in ${OTP_TTL_MINUTES} minutes.</p>`,
    });

    if (result.status === 'SKIPPED') {
      // No SMTP configured - still let the demo flow work by echoing the OTP
      // back in the API response (dev/test convenience only).
      return res.json({ ...genericResponse, devOtp: otp });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    return res.status(500).json({ error: 'Could not process request' });
  }
});

// POST /api/auth/reset-password { email, otp, newPassword }
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'email, otp and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const candidates = await prisma.passwordResetOtp.findMany({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    let matched = null;
    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await compareOtp(otp, candidate.otpHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.passwordResetOtp.update({ where: { id: matched.id }, data: { used: true } }),
    ]);

    return res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    return res.status(500).json({ error: 'Could not reset password' });
  }
});

module.exports = router;
