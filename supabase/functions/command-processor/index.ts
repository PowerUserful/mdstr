
/**
 * MudStar Hybrid Command Processor (Modified from Arkyv default)
 *
 * Key Design Principles (per user requirements):
 * 1. Base engine validation ALWAYS runs first (deterministic, no AI cost/latency).
 * 2. Only commands in AI_COMMAND_WHITELIST ever call Grok.
 * 3. No fallback to AI for unrecognized or ambiguous commands.
 * 4. `discover` is the first (and initially only) AI-assisted command.
 *
 * This replaces most of the default logic in Arkyv's command-processor/index.ts
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";
import { createChatCompletion, getModel } from "./aiProvider.ts";

// ============================================
// CONFIGURATION
// ============================================

const FUNCTION_TIMEOUT = 8000;

// AI Command Whitelist - ONLY these commands will ever call Grok
const AI_COMMAND_WHITELIST = [
  "discover",
  // Future candidates (commented until ready):
  // "investigate",
  // "negotiate",
] as const;

type AICommand = typeof AI_COMMAND_WHITELIST[number];

// Environment variables
const supabaseUrl = Deno.env.get("EDGE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("EDGE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Handle direct commands (e.g. __GREET) - keep Arkyv's direct path for now
    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch (_) {}

    if (requestBody?.command) {
      return await executeDirectCommand(supabase, requestBody.command);
    }

    return await processCommandQueue(supabase);
  } catch (error) {
    console.error("Command processor error:", error);
    return new Response(`error: ${error.message}`, { status: 500 });
  }
});

// ============================================
// CORE PROCESSING LOGIC
// ============================================

async function processCommandQueue(supabase: any) {
  const { data: cmds, error } = await supabase
    .from("commands")
    .select("id, raw, character_id, room_id, conversation_history, user_id, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) {
    console.error("Error fetching commands:", error);
    return new Response("error fetching commands", { status: 500 });
  }

  if (!cmds?.length) {
    return new Response("ok");
  }

  for (const cmd of cmds) {
    try {
      await processSingleCommand(supabase, cmd);
    } catch (err) {
      console.error(`Failed to process command ${cmd.id}:`, err);
      // Mark as processed even on error to avoid infinite retry loops
      await markCommandProcessed(supabase, cmd.id);
    }
  }

  return new Response("ok");
}

async function processSingleCommand(supabase: any, cmd: any) {
  const raw = cmd.raw.trim().toLowerCase();
  console.log(`Processing command: "${raw}" for character ${cmd.character_id} in room ${cmd.room_id}`);

  // ============================================
  // STAGE 1: BASE ENGINE VALIDATION (Deterministic - No AI)
  // ============================================
  const validationResult = await validateCommandDeterministic(supabase, cmd, raw);

  if (!validationResult.valid) {
    // Invalid command - respond deterministically, no AI involved
    await insertRoomMessage(supabase, cmd.room_id, "error", validationResult.errorMessage || "You can't do that here.");
    await markCommandProcessed(supabase, cmd.id);
    return;
  }

  // ============================================
  // STAGE 2: AI WHITELIST CHECK
  // ============================================
  const isAICommand = AI_COMMAND_WHITELIST.includes(raw as AICommand);

  if (isAICommand) {
    // Route to Grok with structured output
    await handleAICommand(supabase, cmd, raw as AICommand);
  } else {
    // Normal deterministic handling
    await handleDeterministicCommand(supabase, cmd, raw);
  }

  await markCommandProcessed(supabase, cmd.id);
}

// ============================================
// STAGE 1: DETERMINISTIC VALIDATION
// ============================================

async function validateCommandDeterministic(supabase: any, cmd: any, raw: string) {
  // TODO: Expand this significantly for MudStar
  // Examples of checks you should implement:
  // - Movement: Does an exit exist in that direction from current room (or structure)?
  // - dock/undock: Is the player in a ship? Is there a station in the current room?
  // - discover: Is the current room marked as "edge of known space" or has a discoverable flag?
  // - trade: Is there a trading terminal/NPC in this room?
  // - attack: Is there a valid target in range?

  // Placeholder implementation - accept most commands for now
  // You will replace this with real checks against rooms, exits, structures, characters, etc.

  if (raw === "discover") {
    // Example: Only allow discover from certain rooms
    const { data: room } = await supabase
      .from("rooms")
      .select("id, region, structure_id")
      .eq("id", cmd.room_id)
      .single();

    // For now, allow discover everywhere as a starting point.
    // Later you can add: if (!room.allow_discover) return { valid: false, errorMessage: "There is nothing new to discover here." };
  }

  return { valid: true };
}

// ============================================
// STAGE 2: AI COMMAND HANDLING (Only for Whitelisted Commands)
// ============================================

async function handleAICommand(supabase: any, cmd: any, commandName: AICommand) {
  console.log(`Routing to AI: ${commandName}`);

  if (commandName === "discover") {
    await handleDiscoverCommand(supabase, cmd);
  }
  // Add more AI commands here as you expand the whitelist
}

// ============================================
// DISCOVER COMMAND IMPLEMENTATION
// ============================================

async function handleDiscoverCommand(supabase: any, cmd: any) {
  // 1. Build rich context for Grok
  const context = await buildDiscoverContext(supabase, cmd);

  // 2. Call Grok with structured output request
  const systemPrompt = `You are the world generator for MudStar, a hard sci-fi space MUD.
Your job is to generate a new location when a player uses the "discover" command.

Rules:
- Return ONLY valid JSON matching the exact schema below.
- Keep descriptions grounded, concise, and hard sci-fi (no flowery language).
- The new room must logically connect to the current location.
- Do not invent technology that breaks hard sci-fi tone.

JSON Schema:
{
  "new_room": {
    "name": string,
    "description": string,
    "region": string,           // usually same as current region
    "height": number,           // optional, default 0
    "exits": [                  // connections back to existing rooms
      {
        "verb": string,         // e.g. "north", "dock", "through the debris field"
        "to_room_id": string    // must be the current room's id
      }
    ]
  }
}`;

  const userPrompt = `Current location context:
${JSON.stringify(context, null, 2)}

The player typed: "discover"

Generate a new interesting location the player can now access.`;

  try {
    const aiResponse = await createChatCompletion({
      model: getModel("smart"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" } // Request JSON mode
    });

    const parsed = JSON.parse(aiResponse.choices[0].message.content);

    // 3. Validate and safely insert new room + exits
    await applyDiscoverResult(supabase, cmd, parsed);

  } catch (error) {
    console.error("Discover AI generation failed:", error);
    await insertRoomMessage(supabase, cmd.room_id, "error", "Your scanners detect nothing unusual in this area.");
  }
}

async function buildDiscoverContext(supabase: any, cmd: any) {
  // Gather relevant context without sending the entire conversation history
  const { data: currentRoom } = await supabase
    .from("rooms")
    .select("id, name, description, region, region_name, structure_id")
    .eq("id", cmd.room_id)
    .single();

  const { data: exits } = await supabase
    .from("exits")
    .select("verb, to_room")
    .eq("from_room", cmd.room_id);

  return {
    current_room: currentRoom,
    available_exits: exits,
    character_id: cmd.character_id,
    // Add more context as needed (nearby structures, recent events, etc.)
  };
}

async function applyDiscoverResult(supabase: any, cmd: any, parsed: any) {
  const newRoomData = parsed.new_room;

  if (!newRoomData?.name || !newRoomData?.description) {
    throw new Error("Invalid discover result from AI");
  }

  // Insert new room
  const { data: newRoom, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name: newRoomData.name,
      description: newRoomData.description,
      region: newRoomData.region || null,
      region_name: newRoomData.region_name || null,
      height: newRoomData.height ?? 0,
      structure_id: cmd.structure_id || null, // if inside a structure
    })
    .select("id")
    .single();

  if (roomError) throw roomError;

  // Create bidirectional exits
  for (const exit of newRoomData.exits || []) {
    // Outbound exit
    await supabase.from("exits").insert({
      from_room: cmd.room_id,
      to_room: newRoom.id,
      verb: exit.verb,
    });

    // Return exit (simple reverse)
    await supabase.from("exits").insert({
      from_room: newRoom.id,
      to_room: cmd.room_id,
      verb: "back", // or make this smarter later
    });
  }

  // Notify player
  await insertRoomMessage(
    supabase,
    cmd.room_id,
    "system",
    `You discover a new location: ${newRoomData.name}\n\n${newRoomData.description}`
  );
}

// ============================================
// DETERMINISTIC COMMAND HANDLER (Stub)
// ============================================

async function handleDeterministicCommand(supabase: any, cmd: any, raw: string) {
  // TODO: Implement real handlers for:
  // - look, who, say, whisper, talk <npc>
  // - movement (north, south, dock, etc.) using exits table
  // - dock / undock (using structures)
  // - scan, trade, attack, cargo, etc.

  // Placeholder for now
  if (raw === "look") {
    const { data: room } = await supabase
      .from("rooms")
      .select("name, description")
      .eq("id", cmd.room_id)
      .single();

    await insertRoomMessage(
      supabase,
      cmd.room_id,
      "system",
      `You are in ${room?.name || "unknown location"}.\n${room?.description || "No description available."}`
    );
  } else {
    // Unknown command that passed validation
    await insertRoomMessage(
      supabase,
      cmd.room_id,
      "error",
      `Command "${raw}" is not yet implemented in deterministic mode.`
    );
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function markCommandProcessed(supabase: any, commandId: number) {
  await supabase
    .from("commands")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", commandId);
}

async function insertRoomMessage(supabase: any, roomId: string, kind: string, body: string) {
  await supabase.from("room_messages").insert({
    room_id: roomId,
    kind,
    body,
    created_at: new Date().toISOString(),
  });
}

async function executeDirectCommand(supabase: any, commandData: any) {
  // Keep Arkyv's direct command path for NPC greetings etc.
  console.log("Direct command received:", commandData.raw);
  return new Response("processed");
}