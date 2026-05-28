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
    // HEADER (acts like a dashboard title bar)
    .setTitle("📊 Roblox Analytics Dashboard")
    .setDescription(
      [
        `> <:KnK:1509436931988258866> **${stats.name}**`,
        `> Live game performance tracking`,
      ].join("\n")
    )
    .setColor(0x00bfff)

    // GAME ICON (like a site logo)
    .setThumbnail(
      stats.icon
        ? `https://www.roblox.com/asset-thumbnail/image?assetId=${stats.icon}&width=512&height=512&format=png`
        : null
    )

    // STATS SECTION (grouped like a panel)
    .addFields(
      {
        name: "👥 Players Online",
        value: `\`\`\`${stats.players}\`\`\``,
        inline: true,
      },
      {
        name: "👀 Total Visits",
        value: `\`\`\`${stats.visits.toLocaleString()}\`\`\``,
        inline: true,
      },
      {
        name: "━━━━━━━━━━━━",
        value: "\u200b",
        inline: false,
      },
      {
        name: "⭐ Likes",
        value: `\`\`\`${stats.likes.toLocaleString()}\`\`\``,
        inline: true,
      },
      {
        name: "❌ Dislikes",
        value: `\`\`\`${stats.dislikes.toLocaleString()}\`\`\``,
        inline: true,
      },
      {
        name: "📈 Like Ratio",
        value: `\`\`\`${likeRatio}%\`\`\``,
        inline: true,
      }
    )

    // FOOTER (feels like system status bar)
    .setFooter({
      text: "Live Roblox Analytics • updates every 60s",
    })
    .setTimestamp();
}

// ===== UPDATE EMBED =====
async function updateEmbed() {
  try {
    const stats = await fetchStats();

    // Dynamic bot status
    client.user.setPresence({
      activities: [
        {
          name: `${stats.players} players in ${stats.name}`,
          type: 3 // Watching
        }
      ],
      status: "online"
    });

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.log("Channel not found");
      return;
    }

    const embed = buildEmbed(stats);

    const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

    // Open Game button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Open Game")
        .setStyle(ButtonStyle.Link)
        .setURL(gameUrl)
    );

    // Create or update embed
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

  // Refresh every 60 seconds
  setInterval(updateEmbed, 60000);
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);