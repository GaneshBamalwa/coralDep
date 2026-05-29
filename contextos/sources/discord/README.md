# Discord Source for Coral

This custom source connects Coral to Discord's REST API v10 via a Bot Token, exposing guilds, channels, messages, and mentions as queryable SQL tables.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Coral CLI ≥ 0.5 | `coral --version` |
| Discord Bot Token | Created in the [Discord Developer Portal](https://discord.com/developers/applications) |
| Bot added to your server | With the permissions listed below |

---

## Required Bot Permissions

When inviting your bot to a server (guild), grant the following permissions:

| Permission | Why |
|---|---|
| **View Channels** | Required to list channels via `/guilds/{id}/channels` |
| **Read Message History** | Required to fetch messages via `/channels/{id}/messages` |
| **Read Messages / Send Messages** | Base permission needed for channel access |
| **Message Content Intent** | Required to read message content via API |

**Recommended OAuth2 Scopes**: `bot`, `applications.commands`

You can generate an invite URL from the OAuth2 → URL Generator page in the Developer Portal. Select the scopes and permissions above.

---

## Setup

### 1. Create a Discord Application & Bot

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application**, give it a name (e.g. `ContextOS`)
3. Go to **Bot** → **Add Bot**
4. Copy the **Token** — this is your `DISCORD_BOT_TOKEN`
5. Under **Privileged Gateway Intents**, enable **Message Content Intent** if you want to read full message text in servers

### 2. Install the Source

Copy this directory into your Coral workspace sources folder:

```bash
# Linux / macOS
cp -r sources/discord/ ~/.coral/workspaces/default/sources/discord/

# Windows (PowerShell)
Copy-Item -Recurse sources\discord\ "$env:USERPROFILE\.coral\workspaces\default\sources\discord\"
```

Then register it with Coral:

```bash
coral source add --file sources/discord/manifest.yaml
```

### 3. Set Environment Variables

Add to your `.env` file (or export in your shell):

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here   # optional default guild
```

To find your Guild ID: In Discord, enable **Developer Mode** (Settings → Advanced), then right-click your server icon → **Copy Server ID**.

### 4. Verify the Source

```bash
coral source list
coral sql "SELECT id, name, member_count FROM discord.guilds LIMIT 5"
```

---

## Example Queries

### List all guilds the bot is in
```sql
SELECT id, name, member_count, description
FROM discord.guilds;
```

### List text channels in your server
```sql
SELECT id, name, topic, position
FROM discord.channels
WHERE guild_id = '123456789012345678'
  AND type = 0  -- 0 = GUILD_TEXT
ORDER BY position;
```

### Fetch the 20 most recent messages in a channel
```sql
SELECT author_username, content, timestamp
FROM discord.channel_messages(channel_id => '987654321098765432', limit => 20)
ORDER BY timestamp DESC;
```

### Find messages that mention someone
```sql
SELECT author_username, content, timestamp
FROM discord.mentions
WHERE channel_id = '987654321098765432'
ORDER BY timestamp DESC
LIMIT 10;
```

### Search for a keyword across the whole guild
```sql
SELECT author_username, channel_id, content, timestamp
FROM discord.search_guild_messages(
  guild_id => '123456789012345678',
  query => 'deployment'
)
ORDER BY timestamp DESC;
```

### Count messages per author in a channel today
```sql
SELECT author_username, COUNT(*) AS message_count
FROM discord.channel_messages(channel_id => '987654321098765432', limit => 100)
WHERE date(timestamp) = current_date
GROUP BY author_username
ORDER BY message_count DESC;
```

---

## Schema Reference

### `discord.guilds`
| Column | Type | Description |
|---|---|---|
| id | string | Guild snowflake ID |
| name | string | Server name |
| icon | string | Icon hash (nullable) |
| owner | boolean | True if user is owner |
| permissions | string | Permissions string |
| approximate_member_count | integer | Approximate member count (nullable) |

### `discord.channels`
| Column | Type | Description |
|---|---|---|
| id | string | Channel snowflake ID |
| guild_id | string | Parent guild ID |
| name | string | Channel name |
| type | integer | Channel type (0=text, 2=voice, 4=category…) |
| topic | string | Channel topic (nullable) |
| position | integer | Sort position |
| nsfw | boolean | Whether the channel is NSFW |

### `discord.messages`
| Column | Type | Description |
|---|---|---|
| id | string | Message snowflake ID |
| channel_id | string | Parent channel ID |
| content | string | Message text content |
| timestamp | timestamp | When the message was sent (ISO-8601) |
| edited_timestamp | timestamp | When the message was edited (ISO-8601) |
| author__id | string | Author's user ID |
| author__username | string | Author's username |
| author__discriminator | string | Author's discriminator |
| mention_everyone | boolean | True if mentions everyone |
| pinned | boolean | True if pinned |

### `discord.guild_members`
| Column | Type | Description |
|---|---|---|
| user__id | string | Member's user ID |
| user__username | string | Member's username |
| nick | string | Member's nickname |
| joined_at | timestamp | When member joined |
| roles | json | Array of role IDs |

### `discord.mentions`
Filtered view of `discord.messages` where `has_mentions = true`. Same columns.

### `discord.channel_messages(channel_id, limit?)`
Table function. Same columns as `discord.messages`.

### `discord.search_messages(guild_id, content, limit?)`
Table function. Same columns as `discord.messages`.

---

## Notes & Limitations

- Discord rate limits the Messages API to **50 requests/second** per bot token. Coral's HTTP source will respect `Retry-After` headers automatically.
- The `has_mentions` column is **computed** client-side by checking whether the `mentions` array in the API response is non-empty. It does not distinguish self-mentions from other mentions.
- `discord.messages` requires a `channel_id` variable — it cannot be scanned without specifying a channel. Use `discord.channel_messages()` as the preferred table function.
- The `search_messages` function uses Discord's native search endpoint if available; otherwise it falls back to local content filtering over recently fetched messages.
- Message content may be empty for system messages, embeds-only messages, or if the **Message Content Intent** is not enabled for bots in large servers.
