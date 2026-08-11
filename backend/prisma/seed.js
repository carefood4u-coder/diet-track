const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function dateForMonthDay(monthStr, day) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log('Seeding DietTrack database...');

  const adminPasswordHash = await bcrypt.hash('Trainer123!', 10);
  const clientPasswordHash = await bcrypt.hash('Client123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'carefood4u@gmail.com' },
    update: {},
    create: {
      role: 'ADMIN',
      name: 'Diet Care',
      email: 'carefood4u@gmail.com',
      passwordHash: adminPasswordHash,
      mobile: '+10000000000',
      notifyTime: '08:00',
      notifyEmail: true,
      notifyWhatsapp: false,
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'demo.client@example.com' },
    update: {},
    create: {
      role: 'USER',
      name: 'Demo Client',
      email: 'demo.client@example.com',
      passwordHash: clientPasswordHash,
      mobile: '+15551234567',
      heightCm: 172.5,
      age: 29,
      notifyTime: '08:00',
      notifyEmail: true,
      notifyWhatsapp: false,
    },
  });

  // Sample weight history for the demo client (last ~5 weeks, gently trending down).
  const existingWeightLogs = await prisma.weightLog.count({ where: { userId: client.id } });
  if (existingWeightLogs === 0) {
    const weights = [82.4, 81.9, 81.3, 80.8, 80.2, 79.9];
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    await prisma.weightLog.createMany({
      data: weights.map((weightKg, idx) => ({
        userId: client.id,
        weightKg,
        loggedAt: new Date(now - (weights.length - 1 - idx) * weekMs),
      })),
    });
    console.log(`  Seeded ${weights.length} weight log entries for demo client`);
  }

  // Sample diet plan for the current month, with the first few days filled in.
  const month = currentMonthStr();
  const existingPlan = await prisma.dietPlan.findUnique({
    where: { userId_month: { userId: client.id, month } },
  });

  if (!existingPlan) {
    const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

    const sampleMeals = [
      {
        breakfast: 'Oats with banana and almonds',
        lunch: 'Grilled chicken salad with olive oil dressing',
        dinner: 'Baked salmon with steamed broccoli',
        snacks: 'Greek yogurt + a handful of walnuts',
        notes: 'Drink at least 2.5L of water today.',
      },
      {
        breakfast: 'Veggie omelette + whole wheat toast',
        lunch: 'Quinoa bowl with chickpeas and roasted vegetables',
        dinner: 'Stir-fried tofu with brown rice',
        snacks: 'Apple + peanut butter',
        notes: '',
      },
      {
        breakfast: 'Smoothie: spinach, banana, protein powder, almond milk',
        lunch: 'Turkey wrap with whole wheat tortilla',
        dinner: 'Lean beef stir fry with mixed vegetables',
        snacks: 'Carrot sticks + hummus',
        notes: 'Leg day - extra protein.',
      },
      {
        breakfast: 'Greek yogurt with berries and granola',
        lunch: 'Lentil soup with a side salad',
        dinner: 'Grilled fish tacos (corn tortillas)',
        snacks: 'Mixed nuts',
        notes: '',
      },
      {
        breakfast: 'Whole grain pancakes with a little honey',
        lunch: 'Chicken and vegetable stir fry',
        dinner: 'Vegetable curry with basmati rice',
        snacks: 'Protein shake',
        notes: 'Rest day.',
      },
    ];

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const filled = sampleMeals[i];
      return {
        date: dateForMonthDay(month, dayNum),
        breakfast: filled ? filled.breakfast : '',
        lunch: filled ? filled.lunch : '',
        dinner: filled ? filled.dinner : '',
        snacks: filled ? filled.snacks : '',
        notes: filled ? filled.notes || null : null,
      };
    });

    await prisma.dietPlan.create({
      data: {
        userId: client.id,
        month,
        days: { create: days },
      },
    });
    console.log(`  Seeded diet plan for ${month} (${days.length} days, first ${sampleMeals.length} pre-filled)`);
  }

  console.log('Seed complete.');
  console.log('  Admin login:  carefood4u@gmail.com / Trainer123!');
  console.log('  Client login: demo.client@example.com / Client123!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
