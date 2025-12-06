// scripts/evy_reminders.js — напоминания Evy (ESM + Supabase)
import 'dotenv/config';
import pkg from 'pg';
import { Telegraf } from 'telegraf';

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const telegram = new Telegraf(process.env.TELEGRAM_BOT_TOKEN).telegram;

async function sendRemindersForOffset(offsetDays) {
    const res = await pool.query(
        `
            select u.telegram_id, e.expires_at, e.mode
            from evy_access e
                     join users u on u.id = e.user_id
            where e.expires_at::date = (current_date + $1::int)
              and e.mode <> 'none'
        `,
        [offsetDays]
    );

    for (const row of res.rows) {
        const chatId = row.telegram_id;
        const days = offsetDays;
        let text = '';

        if (days === 3) {
            text =
                'Напоминание: через 3 дня закончится доступ к Evy.\n' +
                'Если хочешь продолжить путь — можно продлить программу или перейти в более глубокий формат.';
        } else if (days === 2) {
            text =
                'Осталось 2 дня доступа ко мне.\n' +
                'Сейчас хороший момент, чтобы решить — хочешь ли ты продолжить наше путешествие.';
        } else if (days === 1) {
            text =
                'Завтра закончится твой текущий доступ к Evy.\n' +
                'Если хочешь, я могу быть рядом ещё — просто открой раздел «💸 Тарифы» и выбери продолжение.';
        }

        try {
            await telegram.sendMessage(chatId, text);
        } catch (err) {
            console.error('Ошибка отправки напоминания:', chatId, err.message);
        }
    }
}

async function run() {
    await sendRemindersForOffset(3);
    await sendRemindersForOffset(2);
    await sendRemindersForOffset(1);

    console.log('Напоминания отправлены.');
    process.exit(0);
}

run().catch((err) => {
    console.error('Ошибка в скрипте напоминаний:', err);
    process.exit(1);
});
