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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== ENV VARIABLES =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const JOINS_CHANNEL_ID = process.env.JOINS_CHANNEL_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

// ===== FILE STORAGE =====
const DATA_FILE = "./milestones.json";

// ===== MESSAGE IDS =====
let dashboardMessageId = null;

// ===== MILESTONES =====
const milestonesList = [
  1000,
  5000,
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  1000000
];

// ===== LOAD DATA =====
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      reached: [],
      history: [
        "Development started - Nov 20, 2025"
      ],
      milestoneMessageId: null
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));

    return initial;
  }

  return JSON.parse(fs.readFileSync(DATA_FILE));
}

// ===== SAVE DATA =====
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

// ===== PROGRESS BAR =====
function makeProgressBar(current, goal) {
  const size = 10;
  const percent = Math.min(current / goal, 1);

  const filled = Math.round(size * percent);
  const empty = size - filled;

  return `${"█".repeat(filled)}${"░".repeat(empty)} ${Math.round(percent * 100)}%`;
}

// ===== GET NEXT MILESTONE =====
function getNextMilestone(visits) {
  for (const milestone of milestonesList) {
    if (visits < milestone) {
      return milestone;
    }
  }

  return null;
}

// ===== CHECK MILESTONES =====
async function checkMilestones(stats) {
  const data = loadData();

  for (const milestone of milestonesList) {
    if (
      stats.visits >= milestone &&
      !data.reached.includes(milestone)
    ) {
      data.reached.push(milestone);

      const date = new Date().toLocaleString();

      data.history.push(
        `${milestone.toLocaleString()} visits - ${date}`
      );

      saveData(data);

      // ===== OWNER PING =====
      try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);

        if (logChannel) {
          await logChannel.send(
            `<@&${OWNER_ROLE_ID}> 🎉 ${stats.name} reached ${milestone.toLocaleString()} visits!`
          );
        }
      } catch (err) {
        console.log("Milestone ping error:", err.message);
      }

      return true;
    }
  }

  return false;
}

// ===== BUILD MILESTONE MESSAGE =====
function buildMilestoneMessage(stats) {
  const data = loadData();

  const nextMilestone = getNextMilestone(stats.visits);

  let progressSection = "";

  if (nextMilestone) {
    progressSection =
`\n\nNEXT MILESTONE 📈

${makeProgressBar(stats.visits, nextMilestone)}

${stats.visits.toLocaleString()} / ${nextMilestone.toLocaleString()}`;
  }

  return `MILESTONES 🎉

${data.history.join("\n")}${progressSection}`;
}

// ===== DASHBOARD EMBED =====
function buildEmbed(stats) {
  const likeRatio =
    stats.likes + stats.dislikes > 0
      ? ((stats.likes / (stats.likes + stats.dislikes)) * 100).toFixed(1)
      : "0.0";

  return new EmbedBuilder()
    .setTitle("📊 Roblox Game Dashboard")
    .setDescription(`<:KnK:1509812496406675618> ${stats.name}`)
    .setColor(0x00bfff)

    .setThumbnail(
      stats.icon
        ? `https://www.roblox.com/asset-thumbnail/image?assetId=${stats.icon}&width=512&height=512&format=png`
        : null
    )

    .addFields(
      {
        name: "👥 Players",
        value: `\`\`\`${stats.players}\`\`\``,
        inline: true
      },
      {
        name: "👀 Visits",
        value: `\`\`\`${stats.visits.toLocaleString()}\`\`\``,
        inline: true
      },
      {
        name: "⭐ Likes",
        value: `\`\`\`${stats.likes.toLocaleString()}\`\`\``,
        inline: true
      },
      {
        name: "❌ Dislikes",
        value: `\`\`\`${stats.dislikes.toLocaleString()}\`\`\``,
        inline: true
      },
      {
        name: "📈 Like Ratio",
        value: `\`\`\`${likeRatio}%\`\`\``,
        inline: true
      }
    )

    .setFooter({
      text: "Live Roblox Analytics Dashboard"
    })

    .setTimestamp();
}

// ===== UPDATE EVERYTHING =====
async function update() {
  try {
    const stats = await fetchStats();

    // ===== CLEAN BOT STATUS =====
    client.user.setPresence({
      activities: [
        {
          name: "Roblox Dashboard",
          type: 0
        }
      ],
      status: "online"
    });

    // ===== CHECK MILESTONES =====
    await checkMilestones(stats);

    // ===== DASHBOARD CHANNEL =====
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.log("Dashboard channel not found");
      return;
    }

    const embed = buildEmbed(stats);

    const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Open Game")
        .setStyle(ButtonStyle.Link)
        .setURL(gameUrl)
    );

    // ===== CREATE / UPDATE DASHBOARD =====
    if (!dashboardMessageId) {
      const msg = await channel.send({
        embeds: [embed],
        components: [row]
      });

      dashboardMessageId = msg.id;

      console.log("Created dashboard");
    } else {
      const msg = await channel.messages.fetch(
        dashboardMessageId
      );

      await msg.edit({
        embeds: [embed],
        components: [row]
      });

      console.log("Updated dashboard");
    }

    // ===== MILESTONE MESSAGE =====
    const logChannel = await client.channels.fetch(
      LOG_CHANNEL_ID
    );

    if (!logChannel) return;

    const data = loadData();

    const text = buildMilestoneMessage(stats);

    if (!data.milestoneMessageId) {
      const msg = await logChannel.send(text);

      data.milestoneMessageId = msg.id;

      saveData(data);
    } else {
      try {
        const msg = await logChannel.messages.fetch(
          data.milestoneMessageId
        );

        await msg.edit(text);
      } catch {
        const msg = await logChannel.send(text);

        data.milestoneMessageId = msg.id;

        saveData(data);
      }
    }

  } catch (err) {
    console.log("Update error:", err.message);
  }
}

// ===== JOIN MESSAGES =====
client.on("guildMemberAdd", async (member) => {
  try {
    const joinsChannel = await client.channels.fetch(
      JOINS_CHANNEL_ID
    );

    if (!joinsChannel) return;

    joinsChannel.send(
`🌸 Welcome ${member} to **Katana no Kaze**!

You are member #${member.guild.memberCount}

Enjoy your stay ⚔️`
    );

  } catch (err) {
    console.log("Join message error:", err.message);
  }
});

// ===== READY =====
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  update();

  // Update every 60 seconds
  setInterval(update, 60000);
});

// ===== LOGIN =====
client.login(DISCORD_TOKEN);