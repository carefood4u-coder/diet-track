const cron = require('node-cron');
const prisma = require('../config/prisma');
const { sendEmail } = require('../utils/mailer');
const { sendWhatsapp } = require('../utils/whatsapp');
const { todayUtcMidnight, currentLocalHHmm } = require('../utils/dates');

function formatPlanText(day) {
  return [
    `Today's diet plan (${day.date.toISOString().slice(0, 10)}):`,
    ...day.meals.map((m) => `${m.time} ${m.name}: ${m.description || '-'}`),
    day.notes ? `Notes: ${day.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Runs once per minute. For every user whose notifyTime matches the current
 * server-local HH:mm and who has a diet plan day for today, delivers it via
 * whichever channels they've enabled and records a SendLog per attempt.
 * All send failures / missing-credential cases are caught so this job can
 * never crash the process.
 */
async function runNotificationTick() {
  const hhmm = currentLocalHHmm();

  try {
    const users = await prisma.user.findMany({
      where: {
        notifyTime: hhmm,
        OR: [{ notifyEmail: true }, { notifyWhatsapp: true }],
      },
    });

    if (users.length === 0) return;

    const today = todayUtcMidnight();

    for (const user of users) {
      if (user.subscriptionEndsAt && user.subscriptionEndsAt < today) {
        continue; // subscription expired, no notifications until it's renewed
      }

      // eslint-disable-next-line no-await-in-loop
      const day = await prisma.dietPlanDay.findFirst({
        where: { date: today, dietPlan: { userId: user.id } },
        include: { meals: { orderBy: { time: 'asc' } } },
      });

      if (!day || day.meals.length === 0) continue; // nothing scheduled for today for this user

      const planText = formatPlanText(day);

      if (user.notifyEmail) {
        // eslint-disable-next-line no-await-in-loop
        const result = await sendEmail({
          to: user.email,
          subject: "Your DietTrack plan for today",
          text: planText,
          html: `<pre style="font-family:inherit">${planText}</pre>`,
        });
        // eslint-disable-next-line no-await-in-loop
        await prisma.sendLog.create({
          data: { userId: user.id, dietPlanDayId: day.id, channel: 'EMAIL', status: result.status },
        });
      }

      if (user.notifyWhatsapp) {
        if (!user.mobile) {
          console.log(`[WhatsApp not configured, skipping] user ${user.id} has no mobile number`);
          // eslint-disable-next-line no-await-in-loop
          await prisma.sendLog.create({
            data: { userId: user.id, dietPlanDayId: day.id, channel: 'WHATSAPP', status: 'SKIPPED' },
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const result = await sendWhatsapp({ to: user.mobile, body: planText });
          // eslint-disable-next-line no-await-in-loop
          await prisma.sendLog.create({
            data: { userId: user.id, dietPlanDayId: day.id, channel: 'WHATSAPP', status: result.status },
          });
        }
      }
    }
  } catch (err) {
    // Never let a scheduler tick crash the process.
    console.error('[scheduler] tick failed:', err.message);
  }
}

function startScheduler() {
  // Runs every minute.
  cron.schedule('* * * * *', () => {
    runNotificationTick();
  });
  console.log('[scheduler] Diet plan notification scheduler started (runs every minute)');
}

module.exports = { startScheduler, runNotificationTick };
