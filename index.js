require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/clear_users/, async msg => {
	const chatId = msg.chat.id;

	if (!['supergroup', 'group'].includes(msg.chat.type)) {
		return bot.sendMessage(chatId, 'Bu buyruq faqat guruh ichida ishlaydi!');
	}

	try {
		const admins = await bot.getChatAdministrators(chatId);
		const isAdmin = admins.some(admin => admin.user.id === msg.from.id);
		const adminIds = admins.map(admin => admin.user.id);

		if (!isAdmin) {
			return bot.sendMessage(
				chatId,
				'Faqat adminlar bu buyruqni ishlata oladi!'
			);
		}

		let bannedUsers = [];

		bot.on('message', async msg => {
			const userId = msg.from.id;

			if (!adminIds.includes(userId)) {
				try {
					await bot.banChatMember(chatId, userId);
					bannedUsers.push(userId);

					await bot.sendMessage(
						chatId,
						`🚫 @${msg.from.username || userId} guruhdan chiqarildi!`
					);

					// API cheklovlarini hisobga olish uchun 1 soniya kutish
					await new Promise(resolve => setTimeout(resolve, 1000));
				} catch (err) {
					console.warn(`❌ ${userId}-userni chiqarib bo‘lmadi.`, err.message);
				}
			}
		});

		setTimeout(() => {
			bot.sendMessage(
				chatId,
				`✅ ${bannedUsers.length} ta foydalanuvchi guruhdan chiqarildi!`
			);
		}, 10000);
	} catch (error) {
		console.error('Xatolik:', error);
		bot.sendMessage(
			chatId,
			'⚠ Xatolik yuz berdi! Botga admin ruxsatlari berilganligini tekshiring.'
		);
	}
});

bot.on('new_chat_members', async msg => {
	const chatId = msg.chat.id;
	const newMembers = msg.new_chat_members;

	try {
		const admins = await bot.getChatAdministrators(chatId);
		const adminIds = admins.map(admin => admin.user.id);

		for (const member of newMembers) {
			if (!adminIds.includes(member.id)) {
				try {
					await bot.banChatMember(chatId, member.id);
					await bot.sendMessage(
						chatId,
						`🚫 @${member.username || member.id} guruhdan chiqarildi!`
					);
				} catch (err) {
					console.warn(
						`❌ ${member.id}-userni chiqarib bo‘lmadi.`,
						err.message
					);
				}
			}
		}
	} catch (error) {
		console.error('Xatolik:', error);
	}
});

console.log('Bot ishga tushdi...');
