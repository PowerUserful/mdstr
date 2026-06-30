## Table `regions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `name` | `text` | Primary |
| `display_name` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `color_scheme` | `jsonb` |  Nullable |

## Table `rooms`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  |
| `region` | `text` |  Nullable |
| `region_name` | `text` |  Nullable |
| `height` | `int4` |  |
| `image_url` | `text` |  Nullable |
| `structure_id` | `uuid` |  Nullable |

## Table `characters`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `name` | `text` |  Unique |
| `current_room` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `description` | `text` |  Nullable |

## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  Nullable |
| `description` | `text` |  Nullable |
| `current_room` | `uuid` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `handle` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `membership_tier` | `text` |  Nullable |
| `is_admin` | `bool` |  Nullable |

## Table `npcs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `current_room` | `uuid` |  Nullable |
| `dialogue_tree` | `jsonb` |  Nullable |
| `faction` | `text` |  Nullable |
| `behavior_type` | `text` |  Nullable |
| `created_at` | `timestamp` |  Nullable |
| `alias` | `text` |  Nullable |
| `greeting_behavior` | `text` |  Nullable |
| `portrait_url` | `text` |  Nullable |

## Table `exits`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `from_room` | `uuid` |  Nullable |
| `to_room` | `uuid` |  Nullable |
| `verb` | `text` |  |

## Table `commands`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `character_id` | `uuid` |  Nullable |
| `room_id` | `uuid` |  Nullable |
| `raw` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `processed_at` | `timestamptz` |  Nullable |
| `conversation_history` | `jsonb` |  Nullable |
| `user_id` | `uuid` |  Nullable |

## Table `room_messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `room_id` | `uuid` |  Nullable |
| `character_id` | `uuid` |  Nullable |
| `kind` | `text` |  |
| `body` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `character_name` | `text` |  Nullable |
| `target_character_id` | `uuid` |  Nullable |
| `region` | `text` |  Nullable |
| `region_name` | `text` |  Nullable |

## Table `region_chats`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `region` | `text` |  |
| `room_id` | `uuid` |  Nullable |
| `character_id` | `uuid` |  Nullable |
| `character_name` | `text` |  |
| `body` | `text` |  |
| `kind` | `text` |  |
| `created_at` | `timestamptz` |  |
| `region_name` | `text` |  Nullable |

## Table `structures`

Core table for enterable entities in MudStar. 
Ships are mobile structures with internal rooms. 
Stations and outposts are static structures with internal rooms (hangars, docks, shops, etc.).
A room can belong to either a region (via region_name) or a structure (via structure_id).

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `type` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `owner_id` | `uuid` |  Nullable |
| `current_location_room_id` | `uuid` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

