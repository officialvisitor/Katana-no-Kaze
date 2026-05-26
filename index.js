const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== CONFIG =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

let messageId = null;

async function fetchStats() {
  const gameRes = await axios.get(
    `https://games.roblox.com/v1/games?universeIds=${UNIVERSE_ID}`
  );

  const game = gameRes.data.data[0];

  const voteRes = await axios.get(
    `https://games.roblox.com/v1/games/votes?universeIds=${UNIVERSE_ID}`
  );

  const votes = voteRes.data.data[0];

  return {
    players: game.playing,
    visits: game.visits,
    likes: votes.upVotes,
    dislikes: votes.downVotes
  };
}

function buildEmbed(stats) {
  return new EmbedBuilder()
    .setTitle("📊 Live Game Stats")
    .setColor(0x00ffcc)
    .addFields(
      { name: "👥 Players", value: `${stats.players}`, inline: true },
      { name: "👀 Visits", value: `${stats.visits}`, inline: true },
      { name: "⭐ Likes", value: `${stats.likes}`, inline: true },
      { name: "❌ Dislikes", value: `${stats.dislikes}`, inline: true }
    )
    .setFooter({ text: "Live Roblox Stats • updates every 60s" })
    .setTimestamp();
}

async function updateEmbed() {
  try {
    const stats = await fetchStats();

    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = buildEmbed(stats);

    // First run → send message
    if (!messageId) {
      const msg = await channel.send({ embeds: [embed] });
      messageId = msg.id;
    } else {
      // Update existing message
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
    }

    console.log("Updated embed");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateEmbed();
  setInterval(updateEmbed, 60000); // 60 seconds
});

client.login(DISCORD_TOKEN);