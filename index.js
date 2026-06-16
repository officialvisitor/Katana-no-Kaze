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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================================================
// ENV VARIABLES
// =====================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DASHBOARD_MESSAGE_ID = process.env.DASHBOARD_MESSAGE_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const JOINS_CHANNEL_ID = process.env.JOINS_CHANNEL_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID;
const MOD_LOGS_CHANNEL_ID = process.env.MOD_LOGS_CHANNEL_ID;
const UNIVERSE_ID = process.env.UNIVERSE_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// =====================================================
// FILE STORAGE
// =====================================================

const DATA_FILE = "./milestones.json";
const PLAYERS_FILE = "./players.json";

// =====================================================
// BLOCKED WORDS
// =====================================================

const BLOCKED_WORDS = [
  "nigger",
  "nigga",
  "tranny",
  "trannies",
  "trannie",
  "tranni",
  "gook"
];

// =====================================================
// MILESTONES
// =====================================================

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

// =====================================================
// LOAD DATA
// =====================================================

function loadData() {

  if (!fs.existsSync(DATA_FILE)) {

    const initial = {
      reached: [],
      history: [
        "Development started - Nov 20, 2025"
      ],
      milestoneMessageId: null
    };

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(initial, null, 2)
    );

    return initial;
  }

  return JSON.parse(
    fs.readFileSync(DATA_FILE)
  );
}

// =====================================================
// SAVE DATA
// =====================================================

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

// =====================================================
// LOAD PLAYERS
// =====================================================

function loadPlayers() {

  if (!fs.existsSync(PLAYERS_FILE)) {

    fs.writeFileSync(
      PLAYERS_FILE,
      JSON.stringify({}, null, 2)
    );

    return {};
  }

  return JSON.parse(
    fs.readFileSync(PLAYERS_FILE)
  );
}

// =====================================================
// SAVE PLAYERS
// =====================================================

function savePlayers(players) {
  fs.writeFileSync(
    PLAYERS_FILE,
    JSON.stringify(players, null, 2)
  );
}

// =====================================================
// UPDATE PLAYER + GET RANK
// =====================================================

function updateAndGetRank(username, kills) {

  // Owner is always #0
  if (username.toLowerCase() === "officialvisitor") {
    return "#0 🩸 The Silent Assassin";
  }

  const players = loadPlayers();

  // Save/update this player's kills
  players[username.toLowerCase()] = {
    username: username,
    kills: kills
  };

  savePlayers(players);

  // Sort all players by kills descending
  const sorted = Object.values(players)
    .sort((a, b) => b.kills - a.kills);

  // Find this player's position (1-based)
  const position = sorted.findIndex(
    p => p.username.toLowerCase() === username.toLowerCase()
  ) + 1;

  return `#${position}`;
}

// =====================================================
// FETCH ROBLOX GAME DATA
// =====================================================

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

// =====================================================
// PLAYER KILLS
// =====================================================

async function getPlayerKills(username) {

  try {

    // ===== USERNAME -> USER ID =====

    const userRes = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      {
        usernames: [username],
        excludeBannedUsers: false
      }
    );

    const user = userRes.data.data[0];

    if (!user) return null;

    const userId = user.id;

    // ===== DATASTORE =====

    const dataStoreName = "PlayerKillData_v1";
    const entryKey = String(userId);

    // ===== OPEN CLOUD URL =====

    const url =
`https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${encodeURIComponent(dataStoreName)}&entryKey=${encodeURIComponent(entryKey)}`;

    const response = await axios.get(url, {
      headers: {
        "x-api-key": ROBLOX_API_KEY
      }
    });

    const kills = response.data;

    return {
      username: user.name,
      kills: kills || 0
    };

  } catch (error) {

    if (error.response?.status === 404) {
      return {
        username,
        kills: 0
      };
    }

    console.log("Roblox API Error:", error.message);
    return null;
  }
}

// =====================================================
// PROGRESS BAR
// =====================================================

function makeProgressBar(current, goal) {

  const size = 10;
  const percent = Math.min(current / goal, 1);
  const filled = Math.round(size * percent);
  const empty = size - filled;

  return `${"█".repeat(filled)}${"░".repeat(empty)} ${Math.round(percent * 100)}%`;
}

// =====================================================
// NEXT MILESTONE
// =====================================================

function getNextMilestone(visits) {

  for (const milestone of milestonesList) {
    if (visits < milestone) {
      return milestone;
    }
  }

  return null;
}

// =====================================================
// CHECK MILESTONES
// =====================================================

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

      try {

        const logChannel =
          await client.channels.fetch(LOG_CHANNEL_ID);

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

// =====================================================
// BUILD MILESTONE MESSAGE
// =====================================================

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

// =====================================================
// DASHBOARD EMBED
// =====================================================

function buildEmbed(stats) {

  const likeRatio =
    stats.likes + stats.dislikes > 0
      ? ((stats.likes / (stats.likes + stats.dislikes)) * 100).toFixed(1)
      : "0.0";

  return new EmbedBuilder()

    .setTitle("📊 Roblox Game Dashboard")

    .setDescription(
      `<:KnK:1509812496406675618> ${stats.name}`
    )

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

    .setFooter({ text: "Live Roblox Analytics Dashboard" })

    .setTimestamp();
}

// =====================================================
// UPDATE DASHBOARD + MILESTONES
// =====================================================

async function update() {

  try {

    const stats = await fetchStats();

    // ===== BOT STATUS =====

    client.user.setPresence({
      activities: [{ name: "Roblox Dashboard", type: 0 }],
      status: "online"
    });

    // ===== CHECK MILESTONES =====

    await checkMilestones(stats);

    // ===== CHANNEL =====

    const channel =
      await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.log("Dashboard channel not found");
      return;
    }

    const embed = buildEmbed(stats);
    const gameUrl = `https://www.roblox.com/games/${stats.placeId}`;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Open Game")
          .setStyle(ButtonStyle.Link)
          .setURL(gameUrl)
      );

    // =================================================
    // EDIT EXISTING DASHBOARD MESSAGE
    // =================================================

    try {

      const msg =
        await channel.messages.fetch(DASHBOARD_MESSAGE_ID);

      await msg.edit({
        embeds: [embed],
        components: [row]
      });

      console.log("Updated dashboard");

    } catch (err) {
      console.log("Dashboard message not found:", err.message);
    }

    // =================================================
    // MILESTONE MESSAGE
    // =================================================

    const logChannel =
      await client.channels.fetch(LOG_CHANNEL_ID);

    if (!logChannel) return;

    const data = loadData();
    const text = buildMilestoneMessage(stats);

    if (!data.milestoneMessageId) {

      const msg = await logChannel.send(text);
      data.milestoneMessageId = msg.id;
      saveData(data);

    } else {

      try {

        const msg =
          await logChannel.messages.fetch(data.milestoneMessageId);

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

// =====================================================
// JOIN MESSAGE + AUTO ROLE
// =====================================================

client.on("guildMemberAdd", async (member) => {

  try {

    // ===== AUTO ROLE =====

    const role =
      member.guild.roles.cache.get(AUTO_ROLE_ID);

    if (role) {
      await member.roles.add(role);
    }

    // ===== JOIN MESSAGE =====

    const joinsChannel =
      await client.channels.fetch(JOINS_CHANNEL_ID);

    if (!joinsChannel) return;

    joinsChannel.send(
`🌸 Welcome ${member} to **Katana no Kaze**!

You are member #${member.guild.memberCount}

Enjoy your stay ⚔️`
    );

  } catch (err) {
    console.log("Join message/autorole error:", err.message);
  }

});

// =====================================================
// AUTOMOD
// =====================================================

client.on("messageCreate", async (message) => {

  // Ignore bots
  if (message.author.bot) return;

  // Ignore DMs
  if (!message.guild) return;

  const content = message.content.toLowerCase();

  // ===== BLOCKED WORD CHECK =====

  const foundWord = BLOCKED_WORDS.find(word => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(content);
  });

  if (!foundWord) return;

  try {

    await message.delete();

    const logChannel =
      await client.channels.fetch(MOD_LOGS_CHANNEL_ID);

    if (logChannel) {
      await logChannel.send(
`🛡️ AutoMod Removed Message

👤 User: ${message.author.tag}
📍 Channel: ${message.channel}
🚫 Triggered Word: ||${foundWord}||

💬 Message:
${message.content}`
      );
    }

  } catch (err) {
    console.log("AutoMod error:", err.message);
  }

});

// =====================================================
// !STATS COMMAND
// =====================================================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (!message.content.startsWith("!stats")) return;

  const args = message.content.split(" ");
  const username = args[1];

  if (!username) {
    return message.reply("Please provide a Roblox username!");
  }

  try {

    await message.channel.sendTyping();

    const stats = await getPlayerKills(username);

    if (!stats) {
      return message.reply("Could not retrieve stats.");
    }

    // Save player and get their live rank
    const rank = updateAndGetRank(stats.username, stats.kills);

    message.reply(
`<:KnK:1509812496406675618> PLAYER STATS
👤 Username:
${stats.username}
⚔️ Total Kills:
${stats.kills.toLocaleString()}
🏆 Rank:
${rank}`
    );

  } catch (err) {
    console.log("Stats command error:", err.message);
    message.reply("Something went wrong.");
  }

});

// =====================================================
// READY
// =====================================================

client.once("ready", () => {

  console.log(`Logged in as ${client.user.tag}`);

  update();

  // Update every 60 seconds
  setInterval(update, 60000);

});

// =====================================================
// LOGIN
// =====================================================

client.login(DISCORD_TOKEN);