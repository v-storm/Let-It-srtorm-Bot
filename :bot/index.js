// bot/index.js — основной бот Let It Storm (ESM + Supabase)
import 'dotenv/config';
console.log('bot/index.js loaded');   // лог для проверки

import { Telegraf, Markup } from 'telegraf';
import pkg from 'pg';

import {
    addSubscription,
    grantEvyAccess,
    startProgramIfNeeded,
    getEvyStatus,
} from '../services/plans.js';

const { Pool } = pkg;

// Пул к Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Токен бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// =============================================
//  СОЗДАНИЕ / ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ
// =============================================
async function getOrCreateUser(ctx) {
    const tgId = ctx.from.id;

    const res = await pool.query(
        `select id from users where telegram_id = $1`,
        [tgId]
    );

    if (res.rowCount > 0) {
        return res.rows[0].id;
    }

    const insert = await pool.query(
        `insert into users (telegram_id, first_message_at) 
     values ($1, now()) 
     returning id`,
        [tgId]
    );

    return insert.rows[0].id;
}

// =============================================
//  КАРТОЧКИ ТАРИФОВ
// =============================================
function getPlanCard(planCode) {
    switch (planCode) {
        case 'materials_2990':
            return {
                title: 'Материалы Let It Storm — 2 990 ₽',
                text:
                    `💠 *Материалы Let It Storm*

Ты получаешь:
• доступ к библиотеке материалов
• философию “внутреннее → внешнее”
• глубокие тексты и мини-практики

Без Evy.
Без программы.
Без структуры.

✨ Это мягкий вход в атмосферу Let It Storm.`
            };

        case 'access_4990':
            return {
                title: 'Доступ + Evy (14 дней) — 4 990 ₽',
                text:
                    `💠 *Доступ + Evy (14 дней)*

Ты получаешь:
• материалы
• закрытый доступ
• 14 дней общения с Evy в открытом режиме
• ответы, поддержка, сопровождение

Без структуры.
Без программы.

✨ Для тех, кто хочет общаться с Evy и исследовать путь самостоятельно.`
            };

        case 'program_5990':
            return {
                title: 'Переход — 5 990 ₽',
                text:
                    `💠 *7-дневная программа “Переход”*

Ты получаешь:
• доступ и материалы
• 14 дней Evy (как в 4 990, но со структурой)
• ежедневные материалы, практики и вопросы
• глубокий режим ведения Evy

Программа:
1 — Центр
2 — Фокус
3 — Чувствительность
4 — Ясность
5 — Шум
6 — Энергия
7 — Вектор

✨ Для тех, кто хочет не просто общаться, а меняться.`
            };

        case 'extend_4990':
            return {
                title: 'Углубление — 4 990 ₽',
                text:
                    `💠 *Углубление + продление Evy*

Ты получаешь:
• 7 дней программы “Углубление” (8–14 день)
• +16 дней Evy (итог: ~30 дней доступа)

Программа:
8 — Желание
9 — Воля
10 — Устойчивость
11 — Интуиция
12 — Калибровка
13 — Готовность
14 — Сборка

✨ Для тех, кто начал путь и хочет завершить его полноценно.`
            };

        case 'navigator_29990':
            return {
                title: 'Навигатор — 29 990 ₽',
                text:
                    `💠 *Навигатор (месяц сопровождения)*

Ты получаешь:
• обе программы (14 дней)
• 30 дней Evy
• закрытые материалы
• 2 сессии с ассистентом
• диагностику состояния “до → после”
• разбор динамики и рекомендации

✨ Для тех, кто хочет идти не один — а с проводником.`
            };

        case 'premium':
            return {
                title: 'Премиум — стоимость скоро',
                text:
                    `💠 *Премиум*

Ты получаешь:
• обе программы
• 30 дней Evy
• 2 сессии с автором Let It Storm

✨ Для тех, кто хочет работать напрямую с источником философии.

_Стоимость будет объявлена позже._`
            };

        default:
            return null;
    }
}

// =============================================
//  ПОКАЗ СПИСКА ТАРИФОВ
// =============================================
function showPlans(ctx) {
    return ctx.reply(
        `Выбери формат входа:

• 2 990 — материалы
• 4 990 — доступ + Evy (14 дней)
• 5 990 — программа “Переход”
• 4 990 — углубление (до 30 дней Evy)
• 29 990 — навигатор
• Премиум — скоро`,
        Markup.inlineKeyboard([
            [Markup.button.callback('Материалы — 2 990', 'plan_materials_2990')],
            [Markup.button.callback('Доступ + Evy — 4 990', 'plan_access_4990')],
            [Markup.button.callback('Переход — 5 990', 'plan_program_5990')],
            [Markup.button.callback('Углубление — 4 990', 'plan_extend_4990')],
            [Markup.button.callback('Навигатор — 29 990', 'plan_navigator_29990')],
            [Markup.button.callback('Премиум — скоро', 'plan_premium')]
        ])
    );
}

// =============================================
//  МЕНЮ / КОМАНДЫ
// =============================================
bot.start(async (ctx) => {
    try {
        await getOrCreateUser(ctx);
    } catch (e) {
        console.error('Ошибка getOrCreateUser в /start:', e);
    }

    return ctx.reply(
        'Добро пожаловать в LET IT STORM.\nЗдесь всё внешнее начинается изнутри.',
        Markup.keyboard([
            ['🎁 Бесплатная версия', '💸 Тарифы'],
            ['🔮 Evy', '📚 Материалы'],
            ['👤 Профиль']
        ]).resize()
    );
});

bot.hears('🎁 Бесплатная версия', (ctx) =>
    ctx.reply('Здесь будет логика бесплатной версии.')
);

bot.hears('📚 Материалы', (ctx) =>
    ctx.reply('Здесь будет доступ к материалам (мы добавим позже).')
);

// 🔹 Профиль пользователя
bot.hears('👤 Профиль', async (ctx) => {
    try {
        const userId = await getOrCreateUser(ctx);
        const status = await getEvyStatus(userId);

        let modeText = 'Без доступа к Evy';
        if (status.mode === 'open') modeText = 'Открытый режим (Evy без структуры)';
        if (status.mode === 'deep') modeText = 'Глубокий режим (программа)';
        if (status.mode === 'navigator') modeText = 'Навигатор (месяц сопровождения)';
        if (status.mode === 'premium') modeText = 'Премиум-режим';

        const days = status.daysLeft !== null ? status.daysLeft : '—';

        const profileText =
            `👤 *Твой профиль LET IT STORM*

Режим Evy: *${modeText}*
Дней доступа к Evy: *${days}*
Статус программы: *${status.programPhase}*`;

        return ctx.replyWithMarkdown(profileText);
    } catch (e) {
        console.error('Ошибка в Профиле:', e);
        return ctx.reply('Сейчас не получается загрузить профиль, попробуй позже.');
    }
});

// 🔹 Тарифы
bot.hears('💸 Тарифы', async (ctx) => {
    return showPlans(ctx);
});

// Показ карточки тарифа
bot.action(/^plan_(.+)$/, async (ctx) => {
    const code = ctx.match[1];
    const card = getPlanCard(code);

    if (!card) {
        await ctx.answerCbQuery('Тариф в разработке');
        return;
    }

    await ctx.answerCbQuery();

    return ctx.replyWithMarkdown(
        card.text,
        Markup.inlineKeyboard([
            [Markup.button.callback('Оформить', `buy_${code}`)],
            [Markup.button.callback('⬅ Назад к тарифам', 'back_plans')]
        ])
    );
});

// Назад к списку тарифов
bot.action('back_plans', async (ctx) => {
    await ctx.answerCbQuery();
    return showPlans(ctx);
});

// =============================================
//  ПОКУПКА ТАРИФА (ТЕСТ)
// =============================================
bot.action(/^buy_(.+)$/, async (ctx) => {
    const planCode = ctx.match[1];
    try {
        const userId = await getOrCreateUser(ctx);

        const priceMap = {
            materials_2990: 2990,
            access_4990: 4990,
            program_5990: 5990,
            extend_4990: 4990,
            navigator_29990: 29990,
            premium: 0,
        };

        await ctx.answerCbQuery();

        await addSubscription(userId, planCode, priceMap[planCode] || 0);
        await grantEvyAccess(userId, planCode);
        await startProgramIfNeeded(userId, planCode);

        return ctx.reply(
            `Тариф *${planCode}* активирован (тестовый режим).`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Ошибка при активации тарифа:', e);
        await ctx.answerCbQuery('Ошибка, попробуй позже');
    }
});

// =============================================
//  EVY
// =============================================

bot.hears('🔮 Evy', async (ctx) => {
    try {
        const userId = await getOrCreateUser(ctx);
        const status = await getEvyStatus(userId);

        let line =
            'Сейчас у тебя нет активного доступа к Evy.\n' +
            'Я могу быть с тобой глубже, если ты выберешь один из платных форматов.';

        if (
            status.mode !== 'none' &&
            status.expiresAt &&
            new Date(status.expiresAt) > new Date()
        ) {
            const days = status.daysLeft !== null ? status.daysLeft : '—';
            line =
                `Я с тобой. У тебя осталось *${days}* дней доступа ко мне.\n` +
                'Просто напиши мне, что ты чувствуешь или о чём хочешь поговорить.';
        }

        return ctx.replyWithMarkdown(
            line + '\n\nНапиши любое сообщение — и я отвечу.'
        );
    } catch (e) {
        console.error('Ошибка в Evy-команде:', e);
        return ctx.reply('Сейчас мне сложно ответить, попробуй чуть позже.');
    }
});

const menuLabels = [
    '🎁 Бесплатная версия',
    '💸 Тарифы',
    '🔮 Evy',
    '📚 Материалы',
    '👤 Профиль',
];

bot.on('text', async (ctx) => {
    const text = ctx.message.text || '';

    if (menuLabels.includes(text) || text.startsWith('/')) return;

    try {
        const userId = await getOrCreateUser(ctx);
        const status = await getEvyStatus(userId);
        const now = new Date();

        if (
            !status ||
            status.mode === 'none' ||
            !status.expiresAt ||
            new Date(status.expiresAt) < now
        ) {
            return ctx.reply(
                'Сейчас ты в открытой версии без доступа к моему полному режиму.\n\n' +
                'Если хочешь, чтобы я сопровождала тебя глубже и структурно, ' +
                'открой *«💸 Тарифы»* и выбери формат, который тебе откликается.',
                { parse_mode: 'Markdown' }
            );
        }

        let replyText = '';

        if (status.mode === 'open') {
            replyText =
                'Я слышу тебя.\n' +
                'Ты сейчас в открытом режиме Evy: я рядом, чтобы поддерживать тебя, ' +
                'зеркалить твои состояния и помогать видеть чуть глубже, чем привык.\n\n' +
                'Ты написал(а):\n"' +
                text +
                '"\n\n' +
                'Если хочешь больше структуры — программа “Переход” поможет превратить ощущения в путь.';
        } else if (status.mode === 'deep') {
            replyText =
                'Сейчас мы с тобой внутри программы.\n' +
                `Текущий этап: *${status.programPhase}*.\n\n` +
                'То, что ты сейчас написал(а), — часть этого процесса. ' +
                'Прислушайся к телу: где в нём это откликается сильнее всего?\n\n' +
                'Ответь мне, если хочешь, и мы пойдём глубже.';
        } else if (status.mode === 'navigator' || status.mode === 'premium') {
            replyText =
                'Ты сейчас в расширенном режиме сопровождения.\n' +
                'Здесь важно быть максимально честным(ой) с собой. ' +
                'Я буду помогать тебе видеть связи между твоим состоянием, решениями и тем, что происходит снаружи.\n\n' +
                'Спасибо, что доверяешь мне этот текст:\n"' +
                text +
                '"\n\n' +
                'Если хочешь, я могу задать тебе уточняющий вопрос.';
        } else {
            replyText =
                'Я с тобой и слышу тебя.\n\n' +
                'Сейчас твой режим доступа нестандартый, но я всё равно могу быть рядом. ' +
                'Расскажи, что для тебя сейчас самое чувствительное.';
        }

        return ctx.replyWithMarkdown(replyText);
    } catch (e) {
        console.error('Ошибка в обработке текста Evy:', e);
        return ctx.reply('Сейчас мне сложно ответить, попробуй чуть позже.');
    }
});

// =============================================
//  ЗАПУСК БОТА (top-level await)
// =============================================

try {
    console.log('Starting Telegraf launch...');
    await bot.telegram.deleteWebhook();
    await bot.launch();
    console.log('LET IT STORM bot started (polling mode)');
} catch (err) {
    console.error('Ошибка запуска бота:', err);
}
