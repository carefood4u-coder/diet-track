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

// GET /api/admin/users - list clients with latest weight.
// Archived clients are hidden unless ?includeArchived=true.
router.get('/users', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const users = await prisma.user.findMany({
      where: includeArchived ? {} : { archivedAt: null },
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

// POST /api/admin/users - create a client or trainer account
router.post('/users', async (req, res) => {
  try {
    const { name, email, mobile, heightCm, dateOfBirth, password, role } = req.body || {};
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
        dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null,
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

// PUT /api/admin/users/:id/profile { name, email, mobile, heightCm, dateOfBirth }
// Admin-only profile edit. Unlike the client's own PUT /users/me, this can
// change the email address - clients cannot change their own email.
router.put('/users/:id/profile', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, mobile, heightCm, dateOfBirth } = req.body || {};

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase().trim();
    if (mobile !== undefined) data.mobile = mobile;
    if (heightCm !== undefined) data.heightCm = heightCm === null || heightCm === '' ? null : Number(heightCm);
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(`${dateOfBirth}T00:00:00.000Z`) : null;

    const user = await prisma.user.update({ where: { id }, data });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    console.error('[admin/users/:id/profile PUT]', err);
    return res.status(500).json({ error: 'Could not update profile' });
  }
});

// PUT /api/admin/users/:id/archive { archived: boolean }
// Soft-delete: archived clients are hidden from the default list but their
// data (weight logs, diet plans, send logs) is kept.
router.put('/users/:id/archive', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { archived } = req.body || {};
    const user = await prisma.user.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id/archive PUT]', err);
    return res.status(500).json({ error: 'Could not update archive status' });
  }
});

// DELETE /api/admin/users/:id - permanently deletes the account and all
// related data (weight logs, diet plans, send logs cascade via the schema).
router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'User deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id DELETE]', err);
    return res.status(500).json({ error: 'Could not delete user' });
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


const ROUTINE_FIELDS = [
  'bloodGroup',
  'wakeUpTime',
  'breakfastTime',
  'lunchTime',
  'eveningTeaTime',
  'dinnerTime',
  'sleepTime',
];

// PUT /api/admin/users/:id/routine { bloodGroup, wakeUpTime, breakfastTime, lunchTime, eveningTeaTime, dinnerTime, sleepTime }
router.put('/users/:id/routine', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = {};
    ROUTINE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field] || null;
    });

    const user = await prisma.user.update({ where: { id }, data });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id/routine]', err);
    return res.status(500).json({ error: 'Could not update daily routine' });
  }
});

// PUT /api/admin/users/:id/subscription { subscriptionStartsAt, subscriptionEndsAt }
// Each is "YYYY-MM-DD" or null to clear that side.
router.put('/users/:id/subscription', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { subscriptionStartsAt, subscriptionEndsAt } = req.body || {};

    const user = await prisma.user.update({
      where: { id },
      data: {
        subscriptionStartsAt: subscriptionStartsAt ? new Date(`${subscriptionStartsAt}T00:00:00.000Z`) : null,
        subscriptionEndsAt: subscriptionEndsAt ? new Date(`${subscriptionEndsAt}T00:00:00.000Z`) : null,
      },
    });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('[admin/users/:id/subscription]', err);
    return res.status(500).json({ error: 'Could not update subscription' });
  }
});

function mealCreateData(meals) {
  return (Array.isArray(meals) ? meals : []).map((m) => ({
    name: m.name || '',
    time: m.time || '00:00',
    description: m.description || '',
  }));
}

// POST /api/admin/diet-plans { userId, month, days? }
// Creates a DietPlan for the month. If `days` array is supplied (each with
// an optional `meals` array), uses those entries; otherwise generates one
// empty DietPlanDay (no meals yet) per calendar day.
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
        notes: d.notes || null,
        meals: { create: mealCreateData(d.meals) },
      }));
    } else {
      const total = daysInMonth(month);
      dayRecords = Array.from({ length: total }, (_, i) => ({
        date: dateForMonthDay(month, i + 1),
        notes: null,
      }));
    }

    const plan = await prisma.dietPlan.create({
      data: {
        userId: Number(userId),
        month,
        days: { create: dayRecords },
      },
      include: { days: { include: { meals: { orderBy: { time: 'asc' } } }, orderBy: { date: 'asc' } } },
    });

    return res.status(201).json(plan);
  } catch (err) {
    console.error('[admin/diet-plans POST]', err);
    return res.status(500).json({ error: 'Could not create diet plan' });
  }
});

// PUT /api/admin/diet-plans/:id/days/bulk-fill { fromDate, toDate, meals, notes }
// Replaces the meals (and optionally notes) for every day in the plan
// between fromDate and toDate (inclusive) with the given meal list.
// Registered before the /:dayId route below so "bulk-fill" isn't swallowed as a dayId.
router.put('/diet-plans/:id/days/bulk-fill', async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const { fromDate, toDate, meals, notes } = req.body || {};

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate (YYYY-MM-DD) are required' });
    }

    const days = await prisma.dietPlanDay.findMany({
      where: {
        dietPlanId: planId,
        date: { gte: new Date(`${fromDate}T00:00:00.000Z`), lte: new Date(`${toDate}T00:00:00.000Z`) },
      },
      select: { id: true },
    });
    const dayIds = days.map((d) => d.id);

    const ops = [prisma.meal.deleteMany({ where: { dietPlanDayId: { in: dayIds } } })];
    const newMeals = mealCreateData(meals);
    if (newMeals.length > 0) {
      ops.push(
        prisma.meal.createMany({
          data: dayIds.flatMap((dayId) => newMeals.map((m) => ({ ...m, dietPlanDayId: dayId }))),
        }),
      );
    }
    if (notes !== undefined) {
      ops.push(prisma.dietPlanDay.updateMany({ where: { id: { in: dayIds } }, data: { notes } }));
    }
    await prisma.$transaction(ops);

    return res.json({ updatedCount: dayIds.length });
  } catch (err) {
    console.error('[admin/diet-plans/:id/days/bulk-fill]', err);
    return res.status(500).json({ error: 'Could not bulk-fill diet plan days' });
  }
});

// PUT /api/admin/diet-plans/:id/days/:dayId { meals, notes }
// Replaces this day's full meal list with the given array.
router.put('/diet-plans/:id/days/:dayId', async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const dayId = Number(req.params.dayId);
    const { meals, notes } = req.body || {};

    const day = await prisma.dietPlanDay.findUnique({ where: { id: dayId } });
    if (!day || day.dietPlanId !== planId) {
      return res.status(404).json({ error: 'Diet plan day not found' });
    }

    await prisma.$transaction([
      prisma.meal.deleteMany({ where: { dietPlanDayId: dayId } }),
      prisma.meal.createMany({ data: mealCreateData(meals).map((m) => ({ ...m, dietPlanDayId: dayId })) }),
      prisma.dietPlanDay.update({ where: { id: dayId }, data: notes !== undefined ? { notes } : {} }),
    ]);

    const updated = await prisma.dietPlanDay.findUnique({
      where: { id: dayId },
      include: { meals: { orderBy: { time: 'asc' } } },
    });
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
      include: { days: { include: { meals: { orderBy: { time: 'asc' } } }, orderBy: { date: 'asc' } } },
    });

    if (!plan) return res.json({ plan: null, days: [] });
    return res.json(plan);
  } catch (err) {
    console.error('[admin/diet-plans/:userId GET]', err);
    return res.status(500).json({ error: 'Could not load diet plan' });
  }
});

module.exports = router;
