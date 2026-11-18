/**
 * Nimble: Deselect Targets
 *
 * Targets in Foundry are client-side state: only a user's own client can change
 * that user's targets. Combat and chat message documents, however, are synced
 * to every connected client, and their create/update/delete hooks fire on all of
 * them. So instead of relaying "clear your targets" over a socket, every client
 * watches those hooks and decides for itself whether its own user's targets
 * should be cleared. This needs no GM to be online and has no message ordering
 * issues.
 */

const MODULE_ID = 'nimble-deselect-targets';

const SETTINGS = {
	combatStart: { key: 'clearOnCombatStart', label: 'CombatStart', default: true },
	combatEnd: { key: 'clearOnCombatEnd', label: 'CombatEnd', default: true },
	turnStart: { key: 'clearOnTurnStart', label: 'TurnStart', default: true },
	turnEnd: { key: 'clearOnTurnEnd', label: 'TurnEnd', default: true },
	afterAttack: { key: 'clearAfterAttack', label: 'AfterAttack', default: false },
};

/** Nimble chat card types that come from using an item (weapon, feature, spell, reaction). */
const ITEM_CARD_TYPES = new Set(['feature', 'object', 'reaction', 'spell']);

/**
 * How long to wait after an attack card is created before clearing targets, so
 * that any of Nimble's own handlers for the new card that still read the
 * user's current targets get to run first.
 */
const AFTER_ATTACK_DELAY_MS = 250;

function isEnabled(setting) {
	return game.settings.get(MODULE_ID, setting.key) === true;
}

function registerSettings() {
	for (const setting of Object.values(SETTINGS)) {
		game.settings.register(MODULE_ID, setting.key, {
			name: `NIMBLE_DESELECT_TARGETS.Settings.${setting.label}.Name`,
			hint: `NIMBLE_DESELECT_TARGETS.Settings.${setting.label}.Hint`,
			scope: 'world',
			config: true,
			type: Boolean,
			default: setting.default,
		});
	}
}

/** Clears this client's user's targets and tells the other clients. */
function clearOwnTargets() {
	const user = game.user;
	if (!user?.targets?.size) return;
	for (const token of Array.from(user.targets)) {
		token.setTarget(false, { user, releaseOthers: false, groupSelection: true });
	}
	// groupSelection skips the per-token broadcast; send one update for all of them.
	user.broadcastActivity({ targets: [] });
}

/**
 * Whether the combatant's turn belongs to this client's user: a player who
 * owns the combatant, or the GM when no player owns it.
 */
function isOwnTurn(combatant) {
	if (!combatant) return false;
	const actor = combatant.actor;
	const playerOwned = actor?.hasPlayerOwner ?? false;
	if (game.user.isGM) return !playerOwned;
	return combatant.isOwner === true;
}

// --- Combat --------------------------------------------------------------

/** The last known round and combatant of each combat, keyed by combat id. */
const turnStates = new Map();

function turnStateOf(combat) {
	return { round: combat.round ?? 0, combatantId: combat.combatant?.id ?? null };
}

function recordTurnState(combat) {
	if (combat?.id) turnStates.set(combat.id, turnStateOf(combat));
}

function onUpdateCombat(combat, changes) {
	if (!('round' in changes) && !('turn' in changes)) return;
	const prior = turnStates.get(combat.id) ?? combat.previous ?? { round: 0, combatantId: null };
	const next = turnStateOf(combat);
	recordTurnState(combat);

	const priorRound = prior.round ?? 0;
	const priorCombatantId = prior.combatantId ?? null;
	const started = priorRound === 0 && next.round > 0;
	const turnChanged = priorRound !== next.round || priorCombatantId !== next.combatantId;

	if (started && isEnabled(SETTINGS.combatStart)) {
		clearOwnTargets();
		return;
	}
	if (!turnChanged || next.round === 0) return;

	const endingTurn = started ? null : combat.combatants.get(priorCombatantId);
	if (isEnabled(SETTINGS.turnEnd) && isOwnTurn(endingTurn)) {
		clearOwnTargets();
		return;
	}
	if (isEnabled(SETTINGS.turnStart) && isOwnTurn(combat.combatant)) {
		clearOwnTargets();
	}
}

function onDeleteCombat(combat) {
	turnStates.delete(combat.id);
	// A combat that was never started has no end to react to.
	if ((combat.round ?? 0) === 0) return;
	if (isEnabled(SETTINGS.combatEnd)) clearOwnTargets();
}

// --- Attack and spell cards ----------------------------------------------

/**
 * Whether a Nimble activation effect tree contains a damage roll or a saving
 * throw anywhere in it (including nested on-hit / on-failed-save branches).
 */
function hasAttackEffect(value, depth = 0) {
	if (!value || typeof value !== 'object' || depth > 25) return false;
	if (Array.isArray(value)) return value.some((each) => hasAttackEffect(each, depth + 1));
	if (value.type === 'damage' || value.type === 'savingThrow') return true;
	return Object.values(value).some((each) => hasAttackEffect(each, depth + 1));
}

/**
 * Whether a chat message is a Nimble attack or spell card: any spell card, a
 * minion group attack, or a weapon/feature/reaction card whose activation deals
 * damage or calls for a saving throw.
 */
function isAttackOrSpellCard(message) {
	const type = message.type;
	if (type === 'spell' || type === 'minionGroupAttack') return true;
	if (!ITEM_CARD_TYPES.has(type)) return false;
	return hasAttackEffect(message.system?.activation?.effects);
}

function onCreateChatMessage(message) {
	if (!isEnabled(SETTINGS.afterAttack)) return;
	const authorId = message.author?.id ?? message._source?.author;
	if (authorId !== game.user.id) return;
	if (!isAttackOrSpellCard(message)) return;
	setTimeout(clearOwnTargets, AFTER_ATTACK_DELAY_MS);
}

// --- Registration --------------------------------------------------------

Hooks.once('init', () => {
	registerSettings();
});

Hooks.once('ready', () => {
	for (const combat of game.combats ?? []) recordTurnState(combat);
	Hooks.on('createCombat', recordTurnState);
	Hooks.on('updateCombat', onUpdateCombat);
	Hooks.on('deleteCombat', onDeleteCombat);
	Hooks.on('createChatMessage', onCreateChatMessage);
});
