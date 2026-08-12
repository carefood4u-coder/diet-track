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
      dateOfBirth: new Date('1997-03-15T00:00:00.000Z'),
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
        meals: [
          { name: 'Breakfast', time: '08:00', description: 'Oats with banana and almonds' },
          { name: 'Lunch', time: '13:00', description: 'Grilled chicken salad with olive oil dressing' },
          { name: 'Dinner', time: '19:00', description: 'Baked salmon with steamed broccoli' },
          { name: 'Snacks', time: '16:00', description: 'Greek yogurt + a handful of walnuts' },
        ],
        notes: 'Drink at least 2.5L of water today.',
      },
      {
        meals: [
          { name: 'Breakfast', time: '08:00', description: 'Veggie omelette + whole wheat toast' },
          { name: 'Lunch', time: '13:00', description: 'Quinoa bowl with chickpeas and roasted vegetables' },
          { name: 'Dinner', time: '19:00', description: 'Stir-fried tofu with brown rice' },
          { name: 'Snacks', time: '16:00', description: 'Apple + peanut butter' },
        ],
        notes: '',
      },
      {
        meals: [
          {
            name: 'Breakfast',
            time: '08:00',
            description: 'Smoothie: spinach, banana, protein powder, almond milk',
          },
          { name: 'Lunch', time: '13:00', description: 'Turkey wrap with whole wheat tortilla' },
          { name: 'Dinner', time: '19:00', description: 'Lean beef stir fry with mixed vegetables' },
          { name: 'Snacks', time: '16:00', description: 'Carrot sticks + hummus' },
        ],
        notes: 'Leg day - extra protein.',
      },
      {
        meals: [
          { name: 'Breakfast', time: '08:00', description: 'Greek yogurt with berries and granola' },
          { name: 'Lunch', time: '13:00', description: 'Lentil soup with a side salad' },
          { name: 'Dinner', time: '19:00', description: 'Grilled fish tacos (corn tortillas)' },
          { name: 'Snacks', time: '16:00', description: 'Mixed nuts' },
        ],
        notes: '',
      },
      {
        meals: [
          { name: 'Breakfast', time: '08:00', description: 'Whole grain pancakes with a little honey' },
          { name: 'Lunch', time: '13:00', description: 'Chicken and vegetable stir fry' },
          { name: 'Dinner', time: '19:00', description: 'Vegetable curry with basmati rice' },
          { name: 'Snacks', time: '16:00', description: 'Protein shake' },
        ],
        notes: 'Rest day.',
      },
    ];

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const filled = sampleMeals[i];
      return {
        date: dateForMonthDay(month, dayNum),
        notes: filled ? filled.notes || null : null,
        meals: filled ? { create: filled.meals } : undefined,
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
