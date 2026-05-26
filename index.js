const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ENV VARIABLES (Railway) =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

// Stores the live message
let messageId = null;

// Fetch Roblox stats
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
    name: game.name,
    placeId: game.rootPlaceId,
    universeId: game.universeId,
    icon: game.iconImageAssetId,
    players: game.playing || 0,
    visits: game.visits || 0,
    likes: votes.upVotes || 0,
    dislikes: votes.downVotes || 0
  };
}

// Build dashboard embed
function buildEmbed(stats) {
  const likeRatio =
    stats.likes + stats.dislikes > 0
      ? ((stats.likes / (stats.likes + stats.dislikes)) * 100).toFixed(1)
      : "0.0";

  const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

  const thumbnailUrl = stats.icon
    ? `https://www.roblox.com/asset-thumbnail/image?assetId=${stats.icon}&width=512&height=512&format=png`
    : null;

  return new EmbedBuilder()
    .setTitle("📊 Roblox Game Dashboard")
    .setDescription(`**[${stats.name}](${gameUrl})**`)
    .setURL(gameUrl)
    .setColor(0x00bfff)
    .setThumbnail(thumbnailUrl)
    .addFields(
      { name: "👥 Players", value: `\`\`\`${stats.players}\`\`\``, inline: true },
      { name: "👀 Visits", value: `\`\`\`${stats.visits.toLocaleString()}\`\`\``, inline: true },
      { name: "⭐ Likes", value: `\`\`\`${stats.likes.toLocaleString()}\`\`\``, inline: true },
      { name: "❌ Dislikes", value: `\`\`\`${stats.dislikes.toLocaleString()}\`\`\``, inline: true },
      { name: "📈 Like Ratio", value: `\`\`\`${likeRatio}%\`\`\``, inline: true }
    )
    .setFooter({ text: "Live Roblox Analytics Dashboard" })
    .setTimestamp();
}

// Update or create embed message
async function updateEmbed() {
  try {
    const stats = await fetchStats();

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.log("Channel not found");

    const embed = buildEmbed(stats);

    // First run → create message
    if (!messageId) {
      const msg = await channel.send({ embeds: [embed] });
      messageId = msg.id;
      console.log("Created dashboard embed");
    } else {
      // Update existing message
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [embed] });
      console.log("Updated dashboard embed");
    }

  } catch (err) {
    console.log("Update error:", err.message);
  }
}

// Bot ready
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateEmbed();
  setInterval(updateEmbed, 60000); // 60s refresh
});

// Login
client.login(DISCORD_TOKEN);