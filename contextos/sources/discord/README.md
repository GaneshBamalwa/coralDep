# Discord Source for Coral

[![Coral](https://img.shields.io/badge/Coral-SQL_Runtime-FF4F00.svg?style=for-the-badge)](#)
[![Discord API](https://img.shields.io/badge/Discord_API-v10-5865F2.svg?style=for-the-badge&logo=discord)](#)

A production-ready custom source specification that connects Coral to Discord's REST API v10 via a Bot Token. This integration exposes guilds, channels, messages, and guild members as queryable SQL tables.

This custom source enables Meridian and the broader Coral community to run real-time SQL queries over Discord data with zero setup friction.

---

## Contributors and Open Source Dedication

This is an open-source contribution to the Coral community, designed, tested, and built by:
*   **Ganesh Bamalwa**
*   **Siddhant Shivam**
*   **Vishal Kumar**

We hope this source empowers developers to build sophisticated conversational intelligence tools.

---

## Setup Guide

### 1. Create a Discord Bot in the Developer Portal

1.  Navigate to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **New Application** and provide a professional name (e.g., `Meridian Bot`).
3.  Select **Bot** from the left-hand sidebar menu, then click **Add Bot** and confirm.
4.  Locate the **Token** section and click **Reset Token**. Copy this token immediately and store it securely. This will serve as your `DISCORD_BOT_TOKEN`.
5.  Under **Privileged Gateway Intents**, enable the following:
    *   **Message Content Intent** (Required to read the text content of messages in servers).
    *   **Server Members Intent** (Required to retrieve the member list for the `guild_members` table).
6.  Click **Save Changes**.

### 2. Generate an OAuth2 Invite Link

To authorize the bot in your Discord server:

1.  In the Discord Developer Portal, navigate to the **OAuth2 -> URL Generator** tab.
2.  Under **Scopes**, select **bot**.
3.  Under **Bot Permissions**, select the following permissions (the combined bitmask is `66560`):
    *   **Read Messages / View Channels**
    *   **Read Message History**
4.  Copy the generated **Invite URL** provided at the bottom of the page.
5.  Navigate to this URL in your browser, select a server where you have management privileges, and click **Authorize**.

---

## Installation

Ensure the [Coral CLI](https://coral.so/docs) is installed and configured on your system. Register the custom source specification file by executing:

```bash
coral source add --file ./discord.yaml
```

When prompted, input your Discord Bot Token:
```bash
# Paste your bot token when prompted
```

Alternatively, you can provide the token non-interactively via your environment variables:
```bash
export DISCORD_BOT_TOKEN="your_bot_token"
coral source add --file ./discord.yaml
```

---

## Available Tables

| Table Name | Required Filters | Description |
| :--- | :--- | :--- |
| **`discord.guilds`** | *None* | Retrieves all Discord guilds (servers) where the bot is a member. |
| **`discord.channels`** | `guild_id` | Retrieves all channels (text, voice, category, announcement, etc.) within a specified guild. |
| **`discord.messages`** | `channel_id` | Retrieves recent messages in a specific channel. Supports an optional `limit` parameter. |
| **`discord.guild_members`** | `guild_id` | Retrieves the full list of members within a specified guild. |

---

## Example Queries

### Step 1: Find your Guild (Server) ID
Retrieve the ID and basic statistics for all servers your bot has joined:
```sql
SELECT id, name, approximate_member_count FROM discord.guilds LIMIT 5;
```

### Step 2: Retrieve Channels
List channels in a specific server. **Note:** Discord returns all types of channels (text, voice, category). It is highly recommended to filter by `type = 0` to query text channels exclusively:
```sql
-- 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
SELECT id, name, topic FROM discord.channels 
WHERE guild_id = 'YOUR_GUILD_ID' AND type = 0 
LIMIT 10;
```

### Step 3: Query Recent Messages
Fetch recent messages from a text channel. You can optionally supply a `limit` filter to override the default count:
```sql
SELECT author__username, content, timestamp 
FROM discord.messages 
WHERE channel_id = 'YOUR_CHANNEL_ID' AND limit = 25;
```

### Step 4: Retrieve Server Members
Retrieve the list of users in a guild. This query will return an empty result set or error if the **Server Members Intent** is not enabled in the developer portal:
```sql
SELECT user__username, nick, joined_at 
FROM discord.guild_members 
WHERE guild_id = 'YOUR_GUILD_ID' 
LIMIT 10;
```

---

## Known Limitations

1.  **Approximate Member Count**: The `approximate_member_count` field is normally returned as `null` by Discord's `/users/@me/guilds` endpoint unless explicitly requested. This specification automatically appends `?with_counts=true` to the request query parameters to ensure this field populates correctly.
2.  **Server Members Intent**: The `guild_members` table requires your bot to have the **Server Members Intent** enabled under the **Bot** tab of your Discord Application. Without this, the table will return a `401 Unauthorized` response or an empty result set.
3.  **Read Message History**: The bot must have **Read Message History** permissions in the target channel to query the `discord.messages` table.
4.  **Pagination**: Discord's REST API caps messages at a maximum of 100 per request. This specification retrieves up to the specified `limit` in a single request and does not currently implement cursor-based pagination.
5.  **Token Refresh**: Bot tokens are static and do not expire automatically. If you rotate your token via the **Reset Token** function in the Discord Developer Portal, you must re-add the source: `coral source add --file ./discord.yaml`.
