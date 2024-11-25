export const Conditions: { [k: string]: ConditionData } = {
	brn: {
		name: "brn",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.id === "flameorb") {
				this.add("-status", target, "brn", "[from] item: Flame Orb");
			} else if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"brn",
					"[from] ability: " + sourceEffect.name,
					"[of] " + source
				);
			} else {
				this.add("-status", target, "brn");
			}
		},
		// Damage reduction is handled directly in the sim/battle.js damage function
		onResidualOrder: 10,
		onResidual(pokemon) {
			this.damage(pokemon.baseMaxhp / 16);
		},
	},
	frz: {
		name: "frz",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.id === "frostorb") {
				this.add("-status", target, "frz", "[from] item: Frost Orb");
			} else if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"frz",
					`[from] ability: ${sourceEffect.name} [of] ${source}`
				);
			} else if (sourceEffect && sourceEffect.effectType === "Move") {
				this.add(
					"-status",
					target,
					"frz",
					"[from] move: " + sourceEffect.name
				);
			}
		},
		onModifySpA(spa, source, target, move) {
			if (move.id === "facade") return;
			if (source.hasAbility("determination")) return;
			return this.modify(spa, 0.5);
		},
		onResidualOrder: 10,
		onResidual(pokemon) {
			this.damage(pokemon.baseMaxhp / 16);
		},
	},
	/**
	 * Bleed is a new status condition added in elite redux v2.0.
	 * As of this release, it has the following battle effects:
	 * - Lose 1/16 max hp every turn
	 * - Prevent ALL healing effects (moves, items, abilities, etc) on the bleeding pokemon
	 * - Negate any stat boosts on the bleeding pokemon
	 * - Rock and ghost type pokemon are immune to bleed
	 *
	 * Bleed can be cured by using a healing move such as roost, recover etc.
	 * The healing move's effect will be negated, but the bleed will be cured.
	 * NOTE That currently, non-self targeted healing moves cure the target's bleed if applicable.
	 * It's not clear that this is an intended mechanic in e.g. doubles, etc.
	 *
	 * ======================= Developer notes =======================
	 * Adding new status conditions involve the following pieces:
	 * - data/conditions.ts < --- [you are here], where the main business logic of how the condition behaves in battle takes place.
	 * - data/abilities.ts:line 8598, where the voodoo power ability is defined which adds this status condition when hit (30% chance).
	 * - data/typechart.ts, this controls the type chart and what weaknessess, immunities etc are active for each pokemon type.
	 * - data/mods/gen8eliteredux/pokedex.ts, contains the pokedex definitions for all elite redux formats. Use this for testing to give pokemon new abilities prior to them being implemented fully.
	 * - data/text/default.ts, where status text messages are defined.
	 * - frontend/src/battle-animations.ts:updateStatBar():line 2727, where the status bar is rendered/updated on the client during battle.
	 * - frontend/style/client.css:line 2070, where the status bar indicators are styled with colors in css.
	 */
	bld: {
		name: "bld",
		effectType: "Status",
		/**
		 * This is called when the status starts and is responsible for populating status activation messages on screen.
		 * It handles the status being activated by either an ability or a move secondary effect.
		 * The target is the pokemon being statused, the source is the pokemon that caused the status.
		 * Source effect will the ability or move that caused the status.
		 */
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"bld",
					`[from] ability: ${sourceEffect.name}`,
					` [of] ${source}`
				);
			} else if (sourceEffect && sourceEffect.effectType === "Move") {
				this.add(
					"-status",
					target,
					"bld",
					"[from] move: " + sourceEffect.name
				);
			}
		},
		/**
		 * This is called right before a pokemon uses a given move.
		 * We use this to check if a status healing move is being used on a bleeding pokemon.
		 * If so, we block the heal but cure the bleed.
		 * NOTE: This should cover non-self healing moves i.e. enemy or partner healing moves used on the bleeding pokemon
		 */
		// onBeforeMove(source, target, move) {
		// 	if (move.flags['heal'] && move.category === "Status") {
		// 		/// Outright block status healing moves.
		// 		this.add('cant', target, 'status: bleed', move);
		// 		target.cureStatus();
		// 		return false;
		// 	}
		// },
		/**
		 * This is called right before a pokemon is healed by any source.
		 * In this case, we just prevent the healing.
		 * In most cases, you want to provide a message by using this.add("cant", ...)
		 * But since this is from a status effect and blocks secondary effects from items, moves like giga drain, etc...
		 * The expected behavior is more nuanced.
		 * It's possible that some conditional messages may be desired here, but more work is needed to iron out all those details.
		 */
		onTryHeal(amount, target, source, effect) {
			if (effect.effectType === "Condition" && effect.id === "wish") {
				this.add("-message", `${target.name}'s wish cured it's bleed!`);
				target.cureStatus(true);
			}

			if (effect.effectType === "Move") {
				const move = effect as Move;

				if (move.basePower < 0) target.cureStatus();
				if (move.category === "Status") target.cureStatus();
			}

			return false;
		},
		/**
		 * This should negate the boosts of this pokemon while bleed is inflicted.
		 */
		onModifyBoost(boosts, pokemon) {
			for (const b in boosts) {
				if (boosts[b] > 0) {
					boosts[b] = 0;
				}
			}
		},
		/**
		 * This is (believed) to be used as an order in which status/item/weather residual effects resolve at the end of the battle.
		 * In this case, bleed was made to have the same residual order value as bleed/freeze/etc.
		 */
		onResidualOrder: 10,
		/**
		 * This is called to compute any residual (turn over turn) effects on the statused target.
		 * Bleed simply causes 1/16 base hp chip damage every turn.
		 */
		onResidual(pokemon) {
			this.damage(pokemon.baseMaxhp / 16);
		},
	},
	par: {
		name: "par",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"par",
					"[from] ability: " + sourceEffect.name,
					"[of] " + source
				);
			} else {
				this.add("-status", target, "par");
			}
		},
		onModifySpe(spe, pokemon) {
			// Paralysis occurs after all other Speed modifiers, so evaluate all modifiers up to this point first
			spe = this.finalModify(spe);
			if (!pokemon.hasAbility("quickfeet")) {
				spe = Math.floor((spe * 50) / 100);
			}
			return spe;
		},
		onBeforeMovePriority: 1,
		onBeforeMove(pokemon) {
			if (this.randomChance(1, 4)) {
				this.add("cant", pokemon, "par");
				return false;
			}
		},
	},
	slp: {
		name: "slp",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"slp",
					"[from] ability: " + sourceEffect.name,
					"[of] " + source
				);
			} else if (sourceEffect && sourceEffect.effectType === "Move") {
				this.add(
					"-status",
					target,
					"slp",
					"[from] move: " + sourceEffect.name
				);
			} else {
				this.add("-status", target, "slp");
			}
			// 1-3 turns
			this.effectState.startTime = this.random(2, 5);
			this.effectState.time = this.effectState.startTime;

			if (target.removeVolatile("nightmare")) {
				this.add("-end", target, "Nightmare", "[silent]");
			}
		},
		onBeforeMovePriority: 10,
		onBeforeMove(pokemon, target, move) {
			if (pokemon.hasAbility("earlybird")) {
				pokemon.statusState.time--;
			}
			pokemon.statusState.time--;
			if (pokemon.statusState.time <= 0) {
				pokemon.cureStatus();
				return;
			}
			this.add("cant", pokemon, "slp");
			if (move.sleepUsable) {
				return;
			}
			return false;
		},
	},
	psn: {
		name: "psn",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"psn",
					"[from] ability: " + sourceEffect.name,
					"[of] " + source
				);
			} else {
				this.add("-status", target, "psn");
			}
		},
		onResidualOrder: 9,
		onResidual(pokemon) {
			this.damage(pokemon.baseMaxhp / 8);
		},
	},
	tox: {
		name: "tox",
		effectType: "Status",
		onStart(target, source, sourceEffect) {
			this.effectState.stage = 0;
			if (sourceEffect && sourceEffect.id === "toxicorb") {
				this.add("-status", target, "tox", "[from] item: Toxic Orb");
			} else if (sourceEffect && sourceEffect.effectType === "Ability") {
				this.add(
					"-status",
					target,
					"tox",
					"[from] ability: " + sourceEffect.name,
					"[of] " + source
				);
			} else {
				this.add("-status", target, "tox");
			}
		},
		onSwitchIn() {
			this.effectState.stage = 0;
		},
		onResidualOrder: 9,
		onResidual(pokemon) {
			if (this.effectState.stage < 15) {
				this.effectState.stage++;
			}
			this.damage(
				this.clampIntRange(pokemon.baseMaxhp / 16, 1) *
					this.effectState.stage
			);
		},
	},
	confusion: {
		name: "confusion",
		// this is a volatile status
		onStart(target, source, sourceEffect) {
			if (sourceEffect?.id === "lockedmove") {
				this.add("-start", target, "confusion", "[fatigue]");
			} else {
				this.add("-start", target, "confusion");
			}
			const min = sourceEffect?.id === "axekick" ? 3 : 2;
			this.effectState.time = this.random(min, 6);
		},
		onEnd(target) {
			this.add("-end", target, "confusion");
		},
		onBeforeMovePriority: 3,
		onBeforeMove(pokemon) {
			pokemon.volatiles["confusion"].time--;
			if (!pokemon.volatiles["confusion"].time) {
				pokemon.removeVolatile("confusion");
				return;
			}
			this.add("-activate", pokemon, "confusion");
			if (!this.randomChance(33, 100)) {
				return;
			}
			this.activeTarget = pokemon;
			const damage = this.actions.getConfusionDamage(pokemon, 40);
			if (typeof damage !== "number") { throw new Error("Confusion damage not dealt"); }
			const activeMove = {
				id: this.toID("confused"),
				effectType: "Move",
				type: "???",
			};
			this.damage(damage, pokemon, pokemon, activeMove as ActiveMove);
			return false;
		},
	},
	flinch: {
		name: "flinch",
		duration: 1,
		onBeforeMovePriority: 8,
		onBeforeMove(pokemon) {
			this.add("cant", pokemon, "flinch");
			this.runEvent("Flinch", pokemon);
			return false;
		},
	},
	trapped: {
		name: "trapped",
		noCopy: true,
		onTrapPokemon(pokemon) {
			pokemon.tryTrap();
		},
		onStart(target) {
			this.add("-activate", target, "trapped");
		},
	},
	trapper: {
		name: "trapper",
		noCopy: true,
	},
	partiallytrapped: {
		name: "partiallytrapped",
		duration: 5,
		durationCallback(target, source) {
			if (source?.hasItem("gripclaw")) return 8;
			if (source?.hasAbility("grappler")) return 8;
			return this.random(5, 7);
		},
		onStart(pokemon, source) {
			this.add(
				"-activate",
				pokemon,
				"move: " + this.effectState.sourceEffect,
				"[of] " + source
			);
			this.effectState.boundDivisor =
				source.hasItem("bindingband") || source.hasAbility("grappler") ?
					6 :
					8;
		},
		onResidualOrder: 13,
		onResidual(pokemon) {
			const source = this.effectState.source;
			// G-Max Centiferno and G-Max Sandblast continue even after the user leaves the field
			const gmaxEffect = ["gmaxcentiferno", "gmaxsandblast"].includes(
				this.effectState.sourceEffect.id
			);
			if (
				source &&
				(!source.isActive || source.hp <= 0 || !source.activeTurns) &&
				!gmaxEffect
			) {
				delete pokemon.volatiles["partiallytrapped"];
				this.add(
					"-end",
					pokemon,
					this.effectState.sourceEffect,
					"[partiallytrapped]",
					"[silent]"
				);
				return;
			}
			this.damage(pokemon.baseMaxhp / this.effectState.boundDivisor);
		},
		onEnd(pokemon) {
			this.add(
				"-end",
				pokemon,
				this.effectState.sourceEffect,
				"[partiallytrapped]"
			);
		},
		onTrapPokemon(pokemon) {
			const gmaxEffect = ["gmaxcentiferno", "gmaxsandblast"].includes(
				this.effectState.sourceEffect.id
			);
			if (this.effectState.source?.isActive || gmaxEffect) pokemon.tryTrap();
		},
	},
	lockedmove: {
		// Outrage, Thrash, Petal Dance...
		name: "lockedmove",
		duration: 2,
		onResidual(target) {
			if (target.status === "slp") {
				// don't lock, and bypass confusion for calming
				delete target.volatiles["lockedmove"];
			}
			this.effectState.trueDuration--;
		},
		onStart(target, source, effect) {
			this.effectState.trueDuration = this.random(2, 4);
			this.effectState.move = effect.id;
		},
		onRestart() {
			if (this.effectState.trueDuration >= 2) {
				this.effectState.duration = 2;
			}
		},
		onEnd(target) {
			if (this.effectState.trueDuration > 1) return;
			target.addVolatile("confusion");
		},
		onLockMove(pokemon) {
			if (pokemon.volatiles["dynamax"]) return;
			return this.effectState.move;
		},
	},
	twoturnmove: {
		// Skull Bash, SolarBeam, Sky Drop...
		name: "twoturnmove",
		duration: 2,
		onStart(attacker, defender, effect) {
			// ("attacker" is the Pokemon using the two turn move and the Pokemon this condition is being applied to)
			this.effectState.move = effect.id;
			attacker.addVolatile(effect.id);
			// lastMoveTargetLoc is the location of the originally targeted slot before any redirection
			// note that this is not updated for moves called by other moves
			// i.e. if Dig is called by Metronome, lastMoveTargetLoc will still be the user's location
			let moveTargetLoc: number = attacker.lastMoveTargetLoc!;
			if (
				effect.sourceEffect &&
				this.dex.moves.get(effect.id).target !== "self"
			) {
				// this move was called by another move such as Metronome
				// and needs a random target to be determined this turn
				// it will already have one by now if there is any valid target
				// but if there isn't one we need to choose a random slot now
				if (defender.fainted) {
					defender = this.sample(attacker.foes(true));
				}
				moveTargetLoc = attacker.getLocOf(defender);
			}
			attacker.volatiles[effect.id].targetLoc = moveTargetLoc;
			this.attrLastMove("[still]");
			// Run side-effects normally associated with hitting (e.g., Protean, Libero)
			this.runEvent("PrepareHit", attacker, defender, effect);
		},
		onEnd(target) {
			target.removeVolatile(this.effectState.move);
		},
		onLockMove() {
			return this.effectState.move;
		},
		onMoveAborted(pokemon) {
			pokemon.removeVolatile("twoturnmove");
		},
	},
	choicelock: {
		name: "choicelock",
		noCopy: true,
		onStart(pokemon) {
			if (pokemon.usedExtraMove) return false;
			if (!this.activeMove) throw new Error("Battle.activeMove is null");
			if (
				!this.activeMove.id ||
				this.activeMove.hasBounced ||
				this.activeMove.sourceEffect === "snatch"
			) { return false; }
			this.effectState.move = this.activeMove.id;
		},
		onBeforeMove(pokemon, target, move) {
			if (!pokemon.getItem().isChoice) {
				pokemon.removeVolatile("choicelock");
				return;
			}
			if (pokemon.usedExtraMove) return;
			if (
				!pokemon.ignoringItem() &&
				!pokemon.volatiles["dynamax"] &&
				move.id !== this.effectState.move &&
				move.id !== "struggle"
			) {
				// Fails unless the Choice item is being ignored, and no PP is lost
				this.addMove("move", pokemon, move.name);
				this.attrLastMove("[still]");
				this.debug("Disabled by Choice item lock");
				this.add("-fail", pokemon);
				return false;
			}
		},
		onDisableMove(pokemon) {
			if (
				!pokemon.getItem().isChoice ||
				!pokemon.hasMove(this.effectState.move)
			) {
				pokemon.removeVolatile("choicelock");
				return;
			}
			if (pokemon.ignoringItem() || pokemon.volatiles["dynamax"]) {
				return;
			}
			for (const moveSlot of pokemon.moveSlots) {
				if (moveSlot.id !== this.effectState.move) {
					pokemon.disableMove(
						moveSlot.id,
						false,
						this.effectState.sourceEffect
					);
				}
			}
		},
	},
	mustrecharge: {
		name: "mustrecharge",
		duration: 2,
		onBeforeMovePriority: 11,
		onBeforeMove(pokemon) {
			this.add("cant", pokemon, "recharge");
			pokemon.removeVolatile("mustrecharge");
			pokemon.removeVolatile("truant");
			return null;
		},
		onStart(pokemon) {
			this.add("-mustrecharge", pokemon);
		},
		onLockMove: "recharge",
	},
	futuremove: {
		// this is a slot condition
		name: "futuremove",
		duration: 3,
		onResidualOrder: 3,
		onEnd(target) {
			const data = this.effectState;
			// time's up; time to hit! :D
			const move = this.dex.moves.get(data.move);
			if (target.fainted || target === data.source) {
				this.hint(
					`${move.name} did not hit because the target is ${
						target.fainted ? "fainted" : "the user"
					}.`
				);
				return;
			}

			this.add("-end", target, "move: " + move.name);
			target.removeVolatile("Protect");
			target.removeVolatile("Endure");

			if (data.source.hasAbility("infiltrator") && this.gen >= 6) {
				data.moveData.infiltrates = true;
			}
			if (data.source.hasAbility("normalize") && this.gen >= 6) {
				data.moveData.type = "Normal";
			}
			if (data.source.hasAbility("adaptability") && this.gen >= 6) {
				data.moveData.stab = 2;
			}
			const hitMove = new this.dex.Move(data.moveData) as ActiveMove;

			this.actions.trySpreadMoveHit([target], data.source, hitMove, true);
			if (
				data.source.isActive &&
				data.source.hasItem("lifeorb") &&
				this.gen >= 5
			) {
				this.singleEvent(
					"AfterMoveSecondarySelf",
					data.source.getItem(),
					data.source.itemState,
					data.source,
					target,
					data.source.getItem()
				);
			}
			this.activeMove = null;

			this.checkWin();
		},
	},
	healreplacement: {
		// this is a slot condition
		name: "healreplacement",
		onStart(target, source, sourceEffect) {
			this.effectState.sourceEffect = sourceEffect;
			this.add("-activate", source, "healreplacement");
		},
		onSwitchInPriority: 1,
		onSwitchIn(target) {
			if (!target.fainted) {
				target.heal(target.maxhp);
				this.add(
					"-heal",
					target,
					target.getHealth,
					"[from] move: " + this.effectState.sourceEffect,
					"[zeffect]"
				);
				target.side.removeSlotCondition(target, "healreplacement");
			}
		},
	},
	stall: {
		// Protect, Detect, Endure counter
		name: "stall",
		duration: 2,
		counterMax: 729,
		onStart() {
			this.effectState.counter = 3;
		},
		onStallMove(pokemon) {
			// this.effectState.counter should never be undefined here.
			// However, just in case, use 1 if it is undefined.
			const counter = this.effectState.counter || 1;
			this.debug("Success chance: " + Math.round(100 / counter) + "%");
			const success = this.randomChance(1, counter);
			if (!success) delete pokemon.volatiles["stall"];
			return success;
		},
		onRestart() {
			if (
				this.effectState.counter < (this.effect as Condition).counterMax!
			) {
				this.effectState.counter *= 3;
			}
			this.effectState.duration = 2;
		},
	},
	gem: {
		name: "gem",
		duration: 1,
		affectsFainted: true,
		onBasePowerPriority: 14,
		onBasePower(basePower, user, target, move) {
			this.debug("Gem Boost");
			return this.chainModify([5325, 4096]);
		},
	},

	// weather is implemented here since it's so important to the game

	raindance: {
		name: "RainDance",
		effectType: "Weather",
		duration: 5,
		durationCallback(source, pokemon, effect) {
			if (effect && effect?.effectType === "Ability") {
				if (source.hasItem("damprock")) return 12;
				return 8;
			}
			if (source.hasItem("damprock")) return 8;
			return 5;
		},
		onWeatherModifyDamage(damage, attacker, defender, move) {
			if (defender.hasItem("utilityumbrella")) return;
			if (move.type === "Water") {
				if (
					this.effectState.effectSource &&
					this.effectState.effectSource === "Ability"
				) { return this.chainModify(1.2); }
				this.debug("rain water boost");
				return this.chainModify(1.5);
			}
			if (move.type === "Fire") {
				this.debug("rain fire suppress");
				return this.chainModify(0.5);
			}
		},
		onFieldStart(field, source, effect) {
			if (effect?.effectType === "Ability") {
				this.effectState.effectSource = "Ability";
				this.add(
					"-weather",
					"RainDance",
					"[from] ability: " + effect.name,
					"[of] " + source
				);
			} else {
				this.add("-weather", "RainDance");
			}
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "RainDance", "[upkeep]");
			this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	primordialsea: {
		name: "PrimordialSea",
		effectType: "Weather",
		duration: 0,
		onTryMovePriority: 1,
		onTryMove(attacker, defender, move) {
			if (move.type === "Fire" && move.category !== "Status") {
				this.debug("Primordial Sea fire suppress");
				this.add("-fail", attacker, move, "[from] Primordial Sea");
				this.attrLastMove("[still]");
				return null;
			}
		},
		onWeatherModifyDamage(damage, attacker, defender, move) {
			if (defender.hasItem("utilityumbrella")) return;
			if (move.type === "Water") {
				this.debug("Rain water boost");
				return this.chainModify(1.5);
			}
		},
		onFieldStart(field, source, effect) {
			this.add(
				"-weather",
				"PrimordialSea",
				"[from] ability: " + effect.name,
				"[of] " + source
			);
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "PrimordialSea", "[upkeep]");
			this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	sunnyday: {
		name: "SunnyDay",
		effectType: "Weather",
		duration: 5,
		durationCallback(source, pokemon, effect) {
			if (effect && effect?.effectType === "Ability") {
				if (source.hasItem("damprock")) return 12;
				return 8;
			}
			if (source.hasItem("damprock")) return 8;
			return 5;
		},
		onWeatherModifyDamage(damage, attacker, defender, move) {
			if (move.id === "hydrosteam" && !attacker.hasItem("utilityumbrella")) {
				this.debug("Sunny Day Hydro Steam boost");
				return this.chainModify(1.5);
			}
			if (defender.hasItem("utilityumbrella")) return;
			if (move.type === "Fire") {
				if (
					this.effectState.effectSource &&
					this.effectState.effectSource === "Ability"
				) { return this.chainModify(1.2); }
				this.debug("Sunny Day fire boost");
				return this.chainModify(1.5);
			}
			if (move.type === "Water") {
				this.debug("Sunny Day water suppress");
				return this.chainModify(0.5);
			}
		},
		onFieldStart(battle, source, effect) {
			if (effect?.effectType === "Ability") {
				this.effectState.effectSource = "Ability";
				this.add(
					"-weather",
					"SunnyDay",
					"[from] ability: " + effect.name,
					"[of] " + source
				);
			} else {
				this.add("-weather", "SunnyDay");
			}
		},
		onImmunity(type, pokemon) {
			if (pokemon.hasItem("utilityumbrella")) return;
			if (type === "frz") return false;
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "SunnyDay", "[upkeep]");
			this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	desolateland: {
		name: "DesolateLand",
		effectType: "Weather",
		duration: 0,
		onTryMovePriority: 1,
		onTryMove(attacker, defender, move) {
			if (move.type === "Water" && move.category !== "Status") {
				this.debug("Desolate Land water suppress");
				this.add("-fail", attacker, move, "[from] Desolate Land");
				this.attrLastMove("[still]");
				return null;
			}
		},
		onWeatherModifyDamage(damage, attacker, defender, move) {
			if (defender.hasItem("utilityumbrella")) return;
			if (move.type === "Fire") {
				this.debug("Sunny Day fire boost");
				return this.chainModify(1.5);
			}
		},
		onFieldStart(field, source, effect) {
			this.add(
				"-weather",
				"DesolateLand",
				"[from] ability: " + effect.name,
				"[of] " + source
			);
		},
		onImmunity(type, pokemon) {
			if (pokemon.hasItem("utilityumbrella")) return;
			if (type === "frz") return false;
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "DesolateLand", "[upkeep]");
			this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	sandstorm: {
		name: "Sandstorm",
		effectType: "Weather",
		duration: 5,
		durationCallback(source, pokemon, effect) {
			if (effect && effect?.effectType === "Ability") {
				if (source.hasItem("damprock")) return 12;
				return 8;
			}
			if (source.hasItem("damprock")) return 8;
			return 5;
		},
		// This should be applied directly to the stat before any of the other modifiers are chained
		// So we give it increased priority.
		onModifySpDPriority: 10,
		onModifySpD(spd, pokemon) {
			if (pokemon.hasType("Rock") && this.field.isWeather("sandstorm")) {
				if (
					this.effectState.effectSource &&
					this.effectState.effectSource === "Ability"
				) { return this.modify(spd, 1.2); }
				return this.modify(spd, 1.5);
			}
		},
		onFieldStart(field, source, effect) {
			if (effect?.effectType === "Ability") {
				this.effectState.effectSource = "Ability";
				this.add(
					"-weather",
					"Sandstorm",
					"[from] ability: " + effect.name,
					"[of] " + source
				);
			} else {
				this.add("-weather", "Sandstorm");
			}
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "Sandstorm", "[upkeep]");
			if (this.field.isWeather("sandstorm")) this.eachEvent("Weather");
		},
		onWeather(target) {
			this.damage(target.baseMaxhp / 16);
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	hail: {
		name: "Hail",
		effectType: "Weather",
		duration: 5,
		durationCallback(source, pokemon, effect) {
			if (effect && effect?.effectType === "Ability") {
				if (source.hasItem("icyrock")) return 12;
				return 8;
			}
			if (source.hasItem("icyrock")) return 8;
			return 5;
		},
		onFieldStart(field, source, effect) {
			if (effect?.effectType === "Ability") {
				this.effectState.effectSource = "Ability";
				this.add(
					"-weather",
					"Hail",
					"[from] ability: " + effect.name,
					"[of] " + source
				);
			} else {
				this.add("-weather", "Hail");
			}
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "Hail", "[upkeep]");
			if (this.field.isWeather("hail")) this.eachEvent("Weather");
		},
		onWeather(target) {
			this.damage(target.baseMaxhp / 16);
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	snow: {
		name: "Snow",
		effectType: "Weather",
		duration: 5,
		durationCallback(source, effect) {
			if (source?.hasItem("icyrock")) {
				return 8;
			}
			return 5;
		},
		onModifyDefPriority: 10,
		onModifyDef(def, pokemon) {
			if (pokemon.hasType("Ice") && this.field.isWeather("snow")) {
				return this.modify(def, 1.5);
			}
		},
		onFieldStart(field, source, effect) {
			if (effect?.effectType === "Ability") {
				if (this.gen === 8) {
					if (source?.hasItem("icyrock")) {
						this.effectState.duration = 12;
					}
					this.effectState.duration = 8;
				}
				this.add(
					"-weather",
					"Snow",
					"[from] ability: " + effect.name,
					"[of] " + source
				);
			} else {
				this.add("-weather", "Snow");
			}
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "Snow", "[upkeep]");
			if (this.field.isWeather("snow")) this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},
	deltastream: {
		name: "DeltaStream",
		effectType: "Weather",
		duration: 0,
		onEffectivenessPriority: -1,
		onEffectiveness(typeMod, target, type, move) {
			if (
				move &&
				move.effectType === "Move" &&
				move.category !== "Status" &&
				type === "Flying" &&
				typeMod > 0
			) {
				this.add("-fieldactivate", "Delta Stream");
				return 0;
			}
		},
		onFieldStart(field, source, effect) {
			this.add(
				"-weather",
				"DeltaStream",
				"[from] ability: " + effect.name,
				"[of] " + source
			);
		},
		onFieldResidualOrder: 1,
		onFieldResidual() {
			this.add("-weather", "DeltaStream", "[upkeep]");
			this.eachEvent("Weather");
		},
		onFieldEnd() {
			this.add("-weather", "none");
		},
	},

	dynamax: {
		name: "Dynamax",
		noCopy: true,
		onStart(pokemon) {
			this.effectState.turns = 0;
			pokemon.removeVolatile("minimize");
			pokemon.removeVolatile("substitute");
			if (pokemon.volatiles["torment"]) {
				delete pokemon.volatiles["torment"];
				this.add("-end", pokemon, "Torment", "[silent]");
			}
			if (
				["cramorantgulping", "cramorantgorging"].includes(
					pokemon.species.id
				) &&
				!pokemon.transformed
			) {
				pokemon.formeChange("cramorant");
			}
			this.add(
				"-start",
				pokemon,
				"Dynamax",
				pokemon.gigantamax ? "Gmax" : ""
			);
			if (pokemon.baseSpecies.name === "Shedinja") return;

			// Changes based on dynamax level, 2 is max (at LVL 10)
			const ratio = 1.5 + pokemon.dynamaxLevel * 0.05;

			pokemon.maxhp = Math.floor(pokemon.maxhp * ratio);
			pokemon.hp = Math.floor(pokemon.hp * ratio);
			this.add("-heal", pokemon, pokemon.getHealth, "[silent]");
		},
		onTryAddVolatile(status, pokemon) {
			if (status.id === "flinch") return null;
		},
		onBeforeSwitchOutPriority: -1,
		onBeforeSwitchOut(pokemon) {
			pokemon.removeVolatile("dynamax");
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (
				move.id === "behemothbash" ||
				move.id === "behemothblade" ||
				move.id === "dynamaxcannon"
			) {
				return this.chainModify(2);
			}
		},
		onDragOutPriority: 2,
		onDragOut(pokemon) {
			this.add("-block", pokemon, "Dynamax");
			return null;
		},
		onResidualPriority: -100,
		onResidual() {
			this.effectState.turns++;
		},
		onEnd(pokemon) {
			this.add("-end", pokemon, "Dynamax");
			if (pokemon.baseSpecies.name === "Shedinja") return;
			pokemon.hp = pokemon.getUndynamaxedHP();
			pokemon.maxhp = pokemon.baseMaxhp;
			this.add("-heal", pokemon, pokemon.getHealth, "[silent]");
		},
	},

	// Commander needs two conditions so they are implemented here
	// Dondozo
	commanded: {
		name: "Commanded",
		noCopy: true,
		onStart(pokemon) {
			this.boost({atk: 2, spa: 2, spe: 2, def: 2, spd: 2}, pokemon);
		},
		onDragOutPriority: 2,
		onDragOut() {
			return false;
		},
		// Prevents Shed Shell allowing a swap
		onTrapPokemonPriority: -11,
		onTrapPokemon(pokemon) {
			pokemon.trapped = true;
		},
	},
	// Tatsugiri
	commanding: {
		name: "Commanding",
		noCopy: true,
		onDragOutPriority: 2,
		onDragOut() {
			return false;
		},
		// Prevents Shed Shell allowing a swap
		onTrapPokemonPriority: -11,
		onTrapPokemon(pokemon) {
			pokemon.trapped = true;
		},
		// Override No Guard
		onInvulnerabilityPriority: 2,
		onInvulnerability(target, source, move) {
			return false;
		},
		onBeforeTurn(pokemon) {
			this.queue.cancelAction(pokemon);
		},
	},

	// Arceus and Silvally's actual typing is implemented here.
	// Their true typing for all their formes is Normal, and it's only
	// Multitype and RKS System, respectively, that changes their type,
	// but their formes are specified to be their corresponding type
	// in the Pokedex, so that needs to be overridden.
	// This is mainly relevant for Hackmons Cup and Balanced Hackmons.
	arceus: {
		name: "Arceus",
		onTypePriority: 1,
		onType(types, pokemon) {
			if (
				pokemon.transformed ||
				(pokemon.ability !== "multitype" && this.gen >= 8)
			) { return types; }
			let type: string | undefined = "Normal";
			if (pokemon.ability === "multitype") {
				type = pokemon.getItem().onPlate;
				if (!type) {
					type = "Normal";
				}
			}
			return [type];
		},
	},
	silvally: {
		name: "Silvally",
		onTypePriority: 1,
		onType(types, pokemon) {
			if (
				pokemon.transformed ||
				(pokemon.ability !== "rkssystem" && this.gen >= 8)
			) { return types; }
			let type: string | undefined = "Normal";
			if (pokemon.ability === "rkssystem") {
				type = pokemon.getItem().onMemory;
				if (!type) {
					type = "Normal";
				}
			}
			return [type];
		},
	},
	rolloutstorage: {
		name: "rolloutstorage",
		duration: 2,
		onBasePower(relayVar, source, target, move) {
			let bp = Math.max(1, move.basePower);
			bp *= Math.pow(2, source.volatiles["rolloutstorage"].contactHitCount);
			if (source.volatiles["defensecurl"]) {
				bp *= 2;
			}
			source.removeVolatile("rolloutstorage");
			return bp;
		},
	},
	/**
	 * New volatile condition that prevents forms of healing.
	 * Currently used by permanence.
	 * NOTE: Healing berries cannot be prevented from being eaten here,
	 * so we have to modify the battle event loop and check for healing berry and status condition there.
	 * See sim/battle.ts:821 and sim/pokemon.ts:995.
	 */
	healingblocked: {
		onBeforeMove(source: Pokemon, target: Pokemon, effect: ActiveMove) {
			// if (target === this.effectState.target) return;
			// if (target.allies().includes(this.effectState.target)) return;
			if (!effect.flags["heal"]) return;
			// / Remove heal fraction since soft-boiled doesn't seem to respect the chainModifier.
			if (effect.heal) effect.heal = undefined;
			if (!target) {
				console.debug("FATAL: can't get target!");
				target = this.effectState.target;
			}

			if (effect.category === "Status") {
				this.add(
					"cant",
					target,
					"ability: Permanence",
					effect,
					"[of] " + this.effectState.source
				);
				return false;
			}
			return this.chainModify(0);
		},
		onTryHeal(damage, target, source, effect) {
			if (!effect) {
				/**
				 * onTryHeal has two different callbacks for diff cases.
				 * When a berry is healing the pokemon,
				 * we *only* get one argument, the pokemon eating the berry.
				 */
				effect = (damage as unknown as Pokemon).getItem();
			}

			let move = effect;

			// Don't need to do this here because it will only activate on the right pokemon.
			// if (target && target === this.effectState.target) return;
			// else if (target && target?.allies().includes(this.effectState.target))
			// 	return;
			if (!target) {
				console.debug("FATAL: can't get target!");
				target = this.effectState.target;
			}

			if (effect && effect.id === "drain") {
				move = Dex.moves.get(target.moveThisTurn as string) as Effect;
			}

			// / Refer to frontend/src/battle-text-parser.ts to understand how the client will format this message.
			// / As well as what arguments you can pass to it.
			this.add(
				"cant",
				target,
				"ability: Permanence",
				move,
				"[of] " + this.effectState.source
			);
			return this.chainModify(0);
		},
	},
};
