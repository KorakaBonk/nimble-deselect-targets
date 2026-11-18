# Nimble: Deselect Targets

A small Foundry VTT module for the [Nimble](https://github.com/Nimble-Co/FoundryVTT-Nimble) game system that clears targets automatically so stale targets don't carry over into the next action.

## Features

Each option is a world setting (Game Settings → Configure Settings → Nimble: Deselect Targets) that the GM can toggle.

| Setting | Default | What it does |
| --- | --- | --- |
| Clear all targets when combat starts | On | Clears every player's targets when the encounter begins. |
| Clear all targets when combat ends | On | Clears every player's targets when a started encounter is ended. |
| Clear targets at the start of a turn | On | Clears the targets of the player(s) who own the combatant whose turn begins. |
| Clear targets at the end of a turn | On | Clears the targets of the player(s) who own the combatant whose turn ends. |
| Clear targets after an attack or spell | Off | Clears the targets of the user who posted an attack or spell card. |

On the turn of a combatant that no player owns (an NPC or monster), the GM's targets are cleared instead.

An "attack or spell card" is any Nimble spell card, a minion group attack card, or a weapon, feature or reaction card whose activation deals damage or calls for a saving throw. Cards that only heal or show information don't clear targets.

## How it works

Targets are client-side in Foundry, so only a user's own client can clear them. Combat and chat message changes are synced to every connected client, so each client watches those changes and clears its own user's targets when a rule applies. No socket relay or online GM is needed.

## Installation

In Foundry, go to Add-on Modules → Install Module and paste this manifest URL:

```
https://github.com/KorakaBonk/nimble-deselect-targets/releases/latest/download/module.json
```

## Compatibility

- Foundry VTT v13 and v14
- Nimble game system

## Releasing

Create a GitHub release with a tag like `v1.0.0`. The release workflow sets that version in `module.json`, builds `module.zip`, and attaches both to the release.
