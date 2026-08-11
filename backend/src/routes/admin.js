const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { authRequired, adminOnly } = require('../middleware/auth');
const { daysInMonth, dateForMonthDay } = require('../utils/dates');

const router = express.Router();

router.use(authRequired, adminOnly);

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function randomPassword() {
  return Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);
}

// GET /api/admin/users - list all clients with latest weight
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        weightLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
      },
    });

    const result = users.map((u) => {
      const { passwordHash, weightLogs, ...rest } = u;
      return {
        ...rest,
        latestWeightKg: weightLogs[0]?.weightKg ?? null,
        latestWeightAt: weightLogs[0]?.loggedAt ?? null,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('[admin/users GET]', err);
    return res.status(500).json({ error: 'Could not load users' });
  }
});

// POST /api/admin/users - create a client account
router.post('/users', async (req, res) => {
  try {
    const { name, email, mobile, heightCm, age, password, role } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const plainPassword = password || randomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        mobile: mobile || null,
        heightCm: heightCm !== undefined ? Number(heightCm) : null,
        age: age !== undefined ? Number(age) : null,
        passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      },
    });

    return res.status(201).json({
      user: publicUser(user),
      // Only returned once at creation time so the trainer can share it.
      tempPassword: password ? undefined : plainPassword,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    console.error('[admin/users POST]', err);
    return res.status(500).json({ error: 'Could not create user' });
  }
});

// GET /api/admin/users/:id - detail incl. weight history + diet plan summaries
router.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        weightLogs: { orderBy: { loggedAt: 'asc' } },
        dietPlans: { orderBy: { month: 'desc' }, select: { id: true, month: true, createdAt: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...rest } = user;
    return res.json(rest);
  } catch (err) {
    console.error('[admin/users/:id GET]', err);
    return res.status(500).json({ error: 'Could not load user' });
  }
});

// POST /api/admin/users/:id/reset-password { newPassword }
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({ where: { id }, data: { passwordHash } });

    return res.json({ message: `Password reset for ${user.email}` });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id/reset-password]', err);
    return res.status(500).json({ error: 'Could not reset password' });
  }
});

// PUT /api/admin/users/:id/notify-settings { notifyTime, notifyEmail, notifyWhatsapp }
router.put('/users/:id/notify-settings', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { notifyTime, notifyEmail, notifyWhatsapp } = req.body || {};

    if (notifyTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(notifyTime)) {
      return res.status(400).json({ error: 'notifyTime must be in HH:mm format' });
    }

    const data = {};
    if (notifyTime !== undefined) data.notifyTime = notifyTime;
    if (notifyEmail !== undefined) data.notifyEmail = Boolean(notifyEmail);
    if (notifyWhatsapp !== undefined) data.notifyWhatsapp = Boolean(notifyWhatsapp);

    const user = await prisma.user.update({ where: { id }, data });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id/notify-settings]', err);
    return res.status(500).json({ error: 'Could not update notify settings' });
  }
});

// POST /api/admin/diet-plans { userId, month, days? }
// Creates a DietPlan for the month. If `days` array is supplied, uses those
// entries; otherwise generates one empty DietPlanDay per calendar day.
router.post('/diet-plans', async (req, res) => {
  try {
    const { userId, month, days } = req.body || {};
    if (!userId || !month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'userId and month (YYYY-MM) are required' });
    }

    const existing = await prisma.dietPlan.findUnique({
      where: { userId_month: { userId: Number(userId), month } },
    });
    if (existing) {
      return res.status(409).json({ error: 'A diet plan for this user and month already exists' });
    }

    let dayRecords;
    if (Array.isArray(days) && days.length > 0) {
      dayRecords = days.map((d) => ({
        date: new Date(d.date),
        breakfast: d.breakfast || '',
        lunch: d.lunch || '',
        dinner: d.dinner || '',
        snacks: d.snacks || '',
        notes: d.notes || null,
      }));
    } else {
      const total = daysInMonth(month);
      dayRecords = Array.from({ length: total }, (_, i) => ({
        date: dateForMonthDay(month, i + 1),
        breakfast: '',
        lunch: '',
        dinner: '',
        snacks: '',
        notes: null,
      }));
    }

    const plan = await prisma.dietPlan.create({
      data: {
        userId: Number(userId),
        month,
        days: { create: dayRecords },
      },
      include: { days: { orderBy: { date: 'asc' } } },
    });

    return res.status(201).json(plan);
  } catch (err) {
    console.error('[admin/diet-plans POST]', err);
    return res.status(500).json({ error: 'Could not create diet plan' });
  }
});

// PUT /api/admin/diet-plans/:id/days/:dayId
router.put('/diet-plans/:id/days/:dayId', async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const dayId = Number(req.params.dayId);
    const { breakfast, lunch, dinner, snacks, notes } = req.body || {};

    const day = await prisma.dietPlanDay.findUnique({ where: { id: dayId } });
    if (!day || day.dietPlanId !== planId) {
      return res.status(404).json({ error: 'Diet plan day not found' });
    }

    const data = {};
    if (breakfast !== undefined) data.breakfast = breakfast;
    if (lunch !== undefined) data.lunch = lunch;
    if (dinner !== undefined) data.dinner = dinner;
    if (snacks !== undefined) data.snacks = snacks;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.dietPlanDay.update({ where: { id: dayId }, data });
    return res.json(updated);
  } catch (err) {
    console.error('[admin/diet-plans/:id/days/:dayId]', err);
    return res.status(500).json({ error: 'Could not update diet plan day' });
  }
});

// GET /api/admin/diet-plans/:userId?month=YYYY-MM
router.get('/diet-plans/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param (YYYY-MM) is required' });

    const plan = await prisma.dietPlan.findUnique({
      where: { userId_month: { userId, month } },
      include: { days: { orderBy: { date: 'asc' } } },
    });

    if (!plan) return res.json({ plan: null, days: [] });
    return res.json(plan);
  } catch (err) {
    console.error('[admin/diet-plans/:userId GET]', err);
    return res.status(500).json({ error: 'Could not load diet plan' });
  }
});

module.exports = router;
