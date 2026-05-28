const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const axios = require("axios");
const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ENV =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ===== FILE STORAGE =====
const MILESTONE_FILE = "./milestones.json";

// ===== MESSAGE IDS =====
let dashboardMessageId = null;
let milestoneMessageId = null;

// ===== MILESTONES SETUP =====
const milestonesList = [
  { value: 0, label: "Development started - Nov 20, 2025" },
  { value: 1000, label: "1,000 visits" },
  { value: 5000, label: "5,000 visits" },
  { value: 10000, label: "10,000 visits" },
  { value: 25000, label: "25,000 visits" },
  { value: 50000, label: "50,000 visits" },
  { value: 100000, label: "100,000 visits" },
  { value: 250000, label: "250,000 visits" },
  { value: 500000, label: "500,000 visits" },
  { value: 1000000, label: "1,000,000 visits" }
];

// ===== LOAD / SAVE MILESTONES =====
function loadMilestones() {
  if (!fs.existsSync(MILESTONE_FILE)) {
    const initial = {
      reached: [0],
      history: [
        "Development started - Nov 20, 2025"
      ]
    };
    fs.writeFileSync(MILESTONE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  return JSON.parse(fs.readFileSync(MILESTONE_FILE));
}

function saveMilestones(data) {
  fs.writeFileSync(MILESTONE_FILE, JSON.stringify(data, null, 2));
}

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

// ===== DASHBOARD EMBED =====
function buildEmbed(stats) {
  const likeRatio =
    stats.likes + stats.dislikes > 0
      ? ((stats.likes / (stats.likes + stats.dislikes)) * 100).toFixed(1)
      : "0.0";

  return new EmbedBuilder()
    .setTitle("📊 Roblox Game Dashboard")
    .setDescription(`<:KnK:1509436931988258866> ${stats.name}`)
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

// ===== MILESTONE TEXT BUILDER =====
function buildMilestoneText(data) {
  return [
    "MILESTONES 🎉",
    "",
    ...data.history
  ].join("\n");
}

// ===== CHECK MILESTONES =====
function checkMilestones(stats, data) {
  for (const m of milestonesList) {
    if (stats.visits >= m.value && !data.reached.includes(m.value)) {
      data.reached.push(m.value);

      const date = new Date().toLocaleString();

      const label =
        m.value === 0
          ? m.label
          : `${m.label} - ${date}`;

      data.history.push(label);

      return true;
    }
  }
  return false;
}

// ===== UPDATE =====
async function update() {
  try {
    const stats = await fetchStats();
    const data = loadMilestones();

    const changed = checkMilestones(stats, data);
    if (changed) saveMilestones(data);

    const channel = await client.channels.fetch(CHANNEL_ID);

    // ===== DASHBOARD =====
    const embed = buildEmbed(stats);

    const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Open Game")
        .setStyle(ButtonStyle.Link)
        .setURL(gameUrl)
    );

    if (!dashboardMessageId) {
      const msg = await channel.send({
        embeds: [embed],
        components: [row]
      });
      dashboardMessageId = msg.id;
    } else {
      const msg = await channel.messages.fetch(dashboardMessageId);
      await msg.edit({
        embeds: [embed],
        components: [row]
      });
    }

    // ===== MILESTONE MESSAGE =====
    let milestoneChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (milestoneChannel) {
      const text = buildMilestoneText(data);

      if (!milestoneMessageId) {
        const msg = await milestoneChannel.send(text);
        milestoneMessageId = msg.id;
        data.messageId = msg.id;
        saveMilestones(data);
      } else {
        try {
          const msg = await milestoneChannel.messages.fetch(
            data.messageId || milestoneMessageId
          );
          await msg.edit(text);
        } catch {
          const msg = await milestoneChannel.send(text);
          milestoneMessageId = msg.id;
          data.messageId = msg.id;
          saveMilestones(data);
        }
      }
    }

  } catch (err) {
    console.log("Error:", err.message);
  }
}

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  update();
  setInterval(update, 60000);
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);