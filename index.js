require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let blockNewUsers = false;

bot
	.getMe()
	.then(info => {
		botInfo = info;
	})
	.catch(err => {});

async function checkBotAdmin(chatId) {
	try {
		const botMember = await bot.getChatMember(chatId, botInfo.id);
		if (!['administrator', 'creator'].includes(botMember.status)) {
			await bot.sendMessage(
				chatId,
				'⚠️ Iltimos, botga admin ruxsatlarini bering! Aks holda, bu buyruq ishlamaydi.'
			);
			return false;
		}
		return true;
	} catch (error) {
		await bot.sendMessage(
			chatId,
			'⚠ Xatolik yuz berdi! Botga adminlik berilganligini tekshiring.'
		);
		return false;
	}
}

async function getAdminIds(chatId) {
	try {
		const admins = await bot.getChatAdministrators(chatId);
		return admins.map(admin => admin.user.id);
	} catch (error) {
		return [];
	}
}

async function banUser(chatId, userId, username) {
	try {
		await bot.banChatMember(chatId, userId);
		await bot.sendMessage(
			chatId,
			`🚫 @${username || userId} guruhdan chiqarildi!`
		);
	} catch (err) {
		await bot.sendMessage(
			chatId,
			`❌ @${username || userId} ni ban qilib bo‘lmadi! Xatolik: ${err.message}`
		);
	}
}

let clearInProgress = false;
let banningActive = false;

bot.onText(/clear_users/, async msg => {
	const chatId = msg.chat.id;

	if (!['supergroup', 'group'].includes(msg.chat.type)) {
		return bot.sendMessage(chatId, 'Bu buyruq faqat guruh ichida ishlaydi!');
	}

	// Bot adminligini tekshiramiz
	if (!(await checkBotAdmin(chatId))) {
		return bot.sendMessage(chatId, '⛔ Bot bu guruhda admin emas!');
	}

	try {
		const adminIds = await getAdminIds(chatId);
		if (!adminIds.includes(msg.from.id)) {
			return bot.sendMessage(
				chatId,
				'Faqat adminlar bu buyruqni ishlata oladi!'
			);
		}

		clearInProgress = true;
		banningActive = true;

		const options = {
			reply_markup: {
				inline_keyboard: [
					[
						{ text: 'OK', callback_data: 'confirm_clear' },
						{ text: 'Bekor qilish', callback_data: 'cancel_clear' },
					],
				],
			},
		};

		await bot.sendMessage(
			chatId,
			'Foydalanuvchilarni chiqarishni tasdiqlaysizmi?',
			options
		);
	} catch (error) {
		bot.sendMessage(
			chatId,
			'⚠ Xatolik yuz berdi! Botga admin ruxsatlari berilganligini tekshiring.'
		);
	}
});

bot.on('callback_query', async query => {
	const chatId = query.message.chat.id;
	const data = query.data;
	const adminIds = await getAdminIds(chatId);

	if (!adminIds.includes(query.from.id)) {
		return bot.answerCallbackQuery(query.id, { text: 'Sizda ruxsat yo‘q!' });
	}

	if (data === 'confirm_clear') {
		let bannedUsers = [];
		banningActive = true;

		const messageListener = async msg => {
			const userId = msg.from.id;
			if (!adminIds.includes(userId) && banningActive) {
				try {
					await bot.banChatMember(chatId, userId);
					bannedUsers.push(userId);
					await bot.sendMessage(
						chatId,
						`🚫 @${msg.from.username || userId} guruhdan chiqarildi!`
					);
					await new Promise(resolve => setTimeout(resolve, 1000));
				} catch (err) {}
			}
		};

		bot.on('message', messageListener);

		setTimeout(() => {
			bot.sendMessage(
				chatId,
				`✅ ${bannedUsers.length} ta foydalanuvchi guruhdan chiqarildi!`
			);
			banningActive = false;
			bot.removeListener('message', messageListener);
		}, 10000);
	} else if (data === 'cancel_clear') {
		bot.sendMessage(chatId, 'Foydalanuvchilarni chiqarish bekor qilindi.');
		banningActive = false;
	}

	bot.answerCallbackQuery(query.id);
});

bot.onText(/\/cancel_clear/, async msg => {
	const chatId = msg.chat.id;

	if (!clearInProgress) {
		return bot.sendMessage(
			chatId,
			'Hozirda hech qanday operatsiya amalga oshirilmayapti.'
		);
	}

	clearInProgress = false;
	banningActive = false;
	bot.sendMessage(chatId, 'Foydalanuvchilarni chiqarish bekor qilindi.');
});

bot.on('new_chat_members', async msg => {
	const chatId = msg.chat.id;
	const newMembers = msg.new_chat_members;
	const adminIds = await getAdminIds(chatId);

	for (const member of newMembers) {
		if (blockNewUsers && !adminIds.includes(member.id)) {
			await banUser(chatId, member.id, member.username);
		}
	}
});

bot.onText(/\/remove_new_users/, async msg => {
	const chatId = msg.chat.id;
	const adminIds = await getAdminIds(chatId);
	// Bot adminligini tekshiramiz
	if (!(await checkBotAdmin(chatId))) {
		return bot.sendMessage(chatId, '⛔ Bot bu guruhda admin emas!');
	}
	if (!adminIds.includes(msg.from.id)) {
		return bot.sendMessage(
			chatId,
			'⛔ Faqat adminlar bu buyruqni ishlata oladi!'
		);
	}

	blockNewUsers = true;
	bot.sendMessage(
		chatId,
		'🚫 Endi yangi foydalanuvchilar guruhga kira olmaydi!'
	);
});

bot.onText(/\/allow_new_users/, async msg => {
	const chatId = msg.chat.id;
	const adminIds = await getAdminIds(chatId);
	// Bot adminligini tekshiramiz
	if (!(await checkBotAdmin(chatId))) {
		return bot.sendMessage(chatId, '⛔ Bot bu guruhda admin emas!');
	}
	if (!adminIds.includes(msg.from.id)) {
		return bot.sendMessage(
			chatId,
			'⛔ Faqat adminlar bu buyruqni ishlata oladi!'
		);
	}

	blockNewUsers = false;
	bot.sendMessage(chatId, '✅ Endi yangi foydalanuvchilar guruhga kira oladi!');
});

/// mute

// ✅ **Foydalanuvchini vaqtincha yozishdan cheklash**

bot.onText(/\/mute ?(\d+)?/, async (msg, match) => {
	const chatId = msg.chat.id;
	const duration = match[1] ? parseInt(match[1]) : 0; // Agar vaqt kiritilmasa, cheksiz mute
	// Bot adminligini tekshiramiz
	if (!(await checkBotAdmin(chatId))) {
		return bot.sendMessage(chatId, '⛔ Bot bu guruhda admin emas!');
	}
	const reply = msg.reply_to_message;

	if (!reply) {
		return bot.sendMessage(
			chatId,
			'⛔ Foydalanuvchini mute qilish uchun xabariga reply qiling!'
		);
	}

	const userId = reply.from.id;
	const senderId = msg.from.id;

	// **Adminlikni tekshirish**
	const senderMember = await bot.getChatMember(chatId, senderId);
	if (!['administrator', 'creator'].includes(senderMember.status)) {
		return bot.sendMessage(
			chatId,
			'⛔ Faqat adminlar bu buyruqni ishlata oladi!'
		);
	}

	// 🛑 **Bot o‘zini mute qilishdan himoya**
	if (userId === bot.id) {
		return bot.sendMessage(chatId, '⚠️ Bot o‘zini mute qila olmaydi!');
	}

	try {
		let untilDate = duration > 0 ? Math.floor(Date.now() / 1000) + duration : 0;

		await bot.restrictChatMember(chatId, userId, {
			can_send_messages: false,
			can_send_media_messages: false,
			can_send_other_messages: false,
			until_date: untilDate || undefined, // Vaqt belgilansa, vaqtli mute bo‘ladi
		});

		let message =
			duration > 0
				? `🔇 <a href="tg://user?id=${userId}">Foydalanuvchi</a> ${duration} soniyaga mute qilindi!`
				: `🔇 <a href="tg://user?id=${userId}">Foydalanuvchi</a> cheksiz mute qilindi!`;

		bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

		// ⏳ **Agar vaqtli mute bo‘lsa, vaqt tugaganda avtomatik unmute**
		if (duration > 0) {
			setTimeout(async () => {
				try {
					await bot.restrictChatMember(chatId, userId, {
						can_send_messages: true,
						can_send_media_messages: true,
						can_send_other_messages: true,
					});
					bot.sendMessage(
						chatId,
						`✅ <a href="tg://user?id=${userId}">Foydalanuvchi</a> endi yozishi mumkin!`,
						{ parse_mode: 'HTML' }
					);
				} catch (err) {
					bot.sendMessage(chatId, `⚠ Unmute qilishda xatolik: ${err.message}`);
				}
			}, duration * 1000);
		}
	} catch (err) {
		bot.sendMessage(chatId, `⚠️ Mute qilishda xatolik: ${err.message}`);
	}
});

bot.onText(/\/unmute/, async msg => {
	const chatId = msg.chat.id;
	const reply = msg.reply_to_message;
	// Bot adminligini tekshiramiz
	if (!(await checkBotAdmin(chatId))) {
		return bot.sendMessage(chatId, '⛔ Bot bu guruhda admin emas!');
	}
	if (!reply) {
		return bot.sendMessage(
			chatId,
			'⛔ Foydalanuvchining cheklovini olish uchun xabariga reply qiling!'
		);
	}

	const userId = reply.from.id;
	const senderId = msg.from.id;

	// **Adminlikni tekshirish**
	const senderMember = await bot.getChatMember(chatId, senderId);
	if (!['administrator', 'creator'].includes(senderMember.status)) {
		return bot.sendMessage(
			chatId,
			'⛔ Faqat adminlar bu buyruqni ishlata oladi!'
		);
	}

	// 🛑 **Botni o‘zini unmute qilishdan himoya**
	if (userId === bot.id) {
		return bot.sendMessage(chatId, '⚠️ Botning o‘zini unmute qilib bo‘lmaydi!');
	}

	try {
		await bot.restrictChatMember(chatId, userId, {
			can_send_messages: true,
			can_send_media_messages: true,
			can_send_other_messages: true,
		});

		bot.sendMessage(
			chatId,
			`✅ <a href="tg://user?id=${userId}">Foydalanuvchi</a> endi yozishi mumkin!`,
			{ parse_mode: 'HTML' }
		);
	} catch (err) {
		bot.sendMessage(
			chatId,
			`⚠ Cheklovni olib tashlab bo‘lmadi: ${err.message}`
		);
	}
});
