const express = require('express');
const prisma = require('../config/prisma');
const { authRequired } = require('../middleware/auth');
const { todayUtcMidnight } = require('../utils/dates');

const router = express.Router();

router.use(authRequired);

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /api/users/me
router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(publicUser(user));
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

// PUT /api/users/me { name, email, mobile, heightCm, age, bloodGroup, wakeUpTime, breakfastTime, lunchTime, eveningTeaTime, dinnerTime, sleepTime }
router.put('/me', async (req, res) => {
  try {
    const { name, email, mobile, heightCm, age } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase().trim();
    if (mobile !== undefined) data.mobile = mobile;
    if (heightCm !== undefined) data.heightCm = heightCm === null ? null : Number(heightCm);
    if (age !== undefined) data.age = age === null ? null : Number(age);
    ROUTINE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) data[field] = req.body[field] || null;
    });

    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    return res.json(publicUser(user));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    console.error('[users/me PUT]', err);
    return res.status(500).json({ error: 'Could not update profile' });
  }
});

// POST /api/users/me/weight { weightKg, loggedAt? }
router.post('/me/weight', async (req, res) => {
  try {
    const { weightKg, loggedAt } = req.body || {};
    if (weightKg === undefined || weightKg === null || Number.isNaN(Number(weightKg))) {
      return res.status(400).json({ error: 'weightKg is required and must be a number' });
    }
    const entry = await prisma.weightLog.create({
      data: {
        userId: req.user.id,
        weightKg: Number(weightKg),
        loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      },
    });
    return res.status(201).json(entry);
  } catch (err) {
    console.error('[users/me/weight POST]', err);
    return res.status(500).json({ error: 'Could not log weight' });
  }
});

// GET /api/users/me/weight-history
router.get('/me/weight-history', async (req, res) => {
  const logs = await prisma.weightLog.findMany({
    where: { userId: req.user.id },
    orderBy: { loggedAt: 'asc' },
  });
  return res.json(logs);
});

// GET /api/users/me/diet-plan/today
router.get('/me/diet-plan/today', async (req, res) => {
  try {
    const today = todayUtcMidnight();
    const day = await prisma.dietPlanDay.findFirst({
      where: { date: today, dietPlan: { userId: req.user.id } },
      include: { dietPlan: true, meals: { orderBy: { time: 'asc' } } },
    });
    if (!day) {
      return res.json({ day: null, message: 'No diet plan set for today' });
    }
    return res.json({ day });
  } catch (err) {
    console.error('[users/me/diet-plan/today]', err);
    return res.status(500).json({ error: 'Could not load today\'s plan' });
  }
});

// GET /api/users/me/diet-plan?month=YYYY-MM
router.get('/me/diet-plan', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param (YYYY-MM) is required' });

    const plan = await prisma.dietPlan.findUnique({
      where: { userId_month: { userId: req.user.id, month } },
      include: { days: { include: { meals: { orderBy: { time: 'asc' } } }, orderBy: { date: 'asc' } } },
    });

    if (!plan) return res.json({ plan: null, days: [] });
    return res.json(plan);
  } catch (err) {
    console.error('[users/me/diet-plan GET]', err);
    return res.status(500).json({ error: 'Could not load diet plan' });
  }
});

module.exports = router;
