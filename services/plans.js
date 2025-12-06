// services/plans.js — логика тарифов, доступа к Evy и программы (ESM + Supabase)
import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // важно для Supabase
});

const addDays = (date, days) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// 🔹 1. Записываем покупку тарифа
export async function addSubscription(userId, planCode, price) {
    await pool.query(
        `
            insert into user_subscriptions (user_id, plan_code, price, started_at)
            values ($1, $2, $3, now())
        `,
        [userId, planCode, price]
    );
}

// 🔹 2. Выдаём / продлеваем доступ Evy
export async function grantEvyAccess(userId, planCode) {
    const now = new Date();

    const res = await pool.query(
        `select mode, expires_at from evy_access where user_id = $1`,
        [userId]
    );
    const current = res.rows[0];
    let mode = current?.mode || 'none';
    let expiresAt = current?.expires_at ? new Date(current.expires_at) : null;

    switch (planCode) {
        case 'access_4990': {
            mode = 'open';
            if (!expiresAt || expiresAt < now) {
                expiresAt = addDays(now, 14);
            }
            break;
        }

        case 'program_5990': {
            mode = 'deep';
            if (!expiresAt || expiresAt < now) {
                expiresAt = addDays(now, 14);
            }
            break;
        }

        case 'extend_4990': {
            mode = 'deep';
            if (!expiresAt || expiresAt < now) {
                expiresAt = addDays(now, 30);
            } else {
                expiresAt = addDays(expiresAt, 16);
            }
            break;
        }

        case 'navigator_29990': {
            mode = 'navigator';
            expiresAt = addDays(now, 30);
            break;
        }

        default:
            // materials_2990, premium — Evy не меняют
            break;
    }

    if (mode === 'none') return;

    await pool.query(
        `
            insert into evy_access (user_id, mode, expires_at, updated_at)
            values ($1, $2, $3, now())
                on conflict (user_id)
      do update set mode = $2, expires_at = $3, updated_at = now()
        `,
        [userId, mode, expiresAt]
    );
}

// 🔹 3. Запуск программы (7+7)
export async function startProgramIfNeeded(userId, planCode) {
    if (planCode === 'program_5990') {
        await pool.query(
            `
                insert into program_progress (user_id, current_day, started_at, last_step_at)
                values ($1, 1, now(), now())
                    on conflict (user_id)
        do update set current_day = 1, started_at = now(), last_step_at = now()
            `,
            [userId]
        );
    } else if (planCode === 'extend_4990') {
        await pool.query(
            `
                insert into program_progress (user_id, current_day, started_at, last_step_at)
                values ($1, 8, now(), now())
                    on conflict (user_id)
        do update set current_day = 8, last_step_at = now()
            `,
            [userId]
        );
    } else if (planCode === 'navigator_29990') {
        await pool.query(
            `
                insert into program_progress (user_id, current_day, started_at, last_step_at)
                values ($1, 1, now(), now())
                    on conflict (user_id)
        do update set current_day = 1, started_at = now(), last_step_at = now()
            `,
            [userId]
        );
    }
}

// 🔹 4. Статус Evy + программы
export async function getEvyStatus(userId) {
    const now = new Date();

    const res = await pool.query(
        `
            select
                e.mode,
                e.expires_at,
                p.current_day,
                p.started_at,
                p.completed_at
            from evy_access e
                     left join program_progress p on p.user_id = e.user_id
            where e.user_id = $1
        `,
        [userId]
    );

    if (res.rowCount === 0) {
        return {
            mode: 'none',
            expiresAt: null,
            daysLeft: null,
            currentDay: 0,
            programPhase: 'не начата',
        };
    }

    const row = res.rows[0];
    const mode = row.mode || 'none';
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;

    let daysLeft = null;
    if (expiresAt) {
        const diffMs = expiresAt.getTime() - now.getTime();
        daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    const currentDay = row.current_day || 0;
    let programPhase = 'не начата';

    if (currentDay >= 1 && currentDay <= 7) {
        programPhase = `“Переход”, день ${currentDay}`;
    } else if (currentDay >= 8 && currentDay <= 14) {
        programPhase = `“Углубление”, день ${currentDay}`;
    } else if (currentDay > 14) {
        programPhase = 'завершена';
    }

    return {
        mode,
        expiresAt,
        daysLeft,
        currentDay,
        programPhase,
    };
}
