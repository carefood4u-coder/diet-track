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

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatPlanHtml(day) {
  const dateLabel = day.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const rows = day.meals
    .map(
      (m, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding:10px 12px; border:1px solid #e5e7eb; white-space:nowrap; color:#374151;">${escapeHtml(m.time)}</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb; font-weight:600; color:#111827;">${escapeHtml(m.name)}</td>
          <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#374151;">${escapeHtml(m.description) || '-'}</td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color:#1f2937;">
      <h2 style="color:#16a34a; margin:0 0 4px;">Your Diet Plan</h2>
      <p style="color:#6b7280; margin:0 0 16px; font-size:14px;">${escapeHtml(dateLabel)}</p>
      <table style="width:100%; border-collapse: collapse; font-size:14px;">
        <thead>
          <tr style="background:#16a34a; color:#ffffff; text-align:left;">
            <th style="padding:10px 12px; border:1px solid #16a34a;">Time</th>
            <th style="padding:10px 12px; border:1px solid #16a34a;">Meal</th>
            <th style="padding:10px 12px; border:1px solid #16a34a;">What to eat</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        day.notes
          ? `<p style="margin-top:16px; font-size:14px;"><strong>Notes:</strong> ${escapeHtml(day.notes)}</p>`
          : ''
      }
      <p style="color:#9ca3af; font-size:12px; margin-top:24px;">Sent by DietTrack</p>
    </div>`;
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
      if (!user.subscriptionStartsAt || user.subscriptionStartsAt > today) {
        continue; // not yet purchased / hasn't started yet
      }
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
          html: formatPlanHtml(day),
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
