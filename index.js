const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ENV VARIABLES (Railway) =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

let messageId = null;

// ===== FETCH ROBLOX DATA =====
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
    icon: game.iconImageAssetId,
    players: game.playing || 0,
    visits: game.visits || 0,
    likes: votes.upVotes || 0,
    dislikes: votes.downVotes || 0
  };
}

// ===== BUILD DASHBOARD EMBED =====
function buildEmbed(stats) {
  const likeRatio =
    stats.likes + stats.dislikes > 0
      ? ((stats.likes / (stats.likes + stats.dislikes)) * 100).toFixed(1)
      : "0.0";

  return new EmbedBuilder()
    .setTitle("📊 Roblox Game Dashboard")
    .setDescription(`🎮 ${stats.name}`)
    .setColor(0x00bfff)
    .setThumbnail(
      stats.icon
        ? `https://www.roblox.com/asset-thumbnail/image?assetId=${stats.icon}&width=512&height=512&format=png`
        : null
    )
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

// ===== UPDATE EMBED =====
async function updateEmbed() {
  try {
    const stats = await fetchStats();

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return console.log("Channel not found");

    const embed = buildEmbed(stats);

    const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Open Game")
        .setStyle(ButtonStyle.Link)
        .setURL(gameUrl)
    );

    if (!messageId) {
      const msg = await channel.send({
        embeds: [embed],
        components: [row]
      });
      messageId = msg.id;
      console.log("Created dashboard embed");
    } else {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({
        embeds: [embed],
        components: [row]
      });
      console.log("Updated dashboard embed");
    }

  } catch (err) {
    console.log("Update error:", err.message);
  }
}

// ===== BOT READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateEmbed();
  setInterval(updateEmbed, 60000);
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);