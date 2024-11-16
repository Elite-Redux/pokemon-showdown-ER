import {MoveTarget} from "../sim/dex-moves";
import {toID} from "../sim/dex-data";
import {Condition} from "../sim/dex-conditions";
import {Side} from "../sim/side";
import {Pokemon} from "../sim/pokemon.js";
/*

Ratings and how they work:

-1: Detrimental
	  An ability that severely harms the user.
	ex. Defeatist, Slow Start

 0: Useless
	  An ability with no overall benefit in a singles battle.
	ex. Color Change, Plus

 1: Ineffective
	  An ability that has minimal effect or is only useful in niche situations.
	ex. Light Metal, Suction Cups

 2: Useful
	  An ability that can be generally useful.
	ex. Flame Body, Overcoat

 3: Effective
	  An ability with a strong effect on the user or foe.
	ex. Chlorophyll, Sturdy

 4: Very useful
	  One of the more popular abilities. It requires minimal support to be effective.
	ex. Adaptability, Magic Bounce

 5: Essential
	  The sort of ability that defines metagames.
	ex. Imposter, Shadow Tag

*/

function doesMoveCharge(pokemon: Pokemon, move: ActiveMove) {
	if (!move.flags["charge"]) return false;
	if (pokemon.hasAbility("accelerate")) return false;
	if (move.name === "solarbeam" || move.name === "solarblade") {
		return ["sunnyday", "desolateland"].includes(pokemon.effectiveWeather()) ||
			pokemon.hasAbility("solarflare") ||
			pokemon.hasAbility("chloroplast") ||
			pokemon.hasAbility("bigleaves");
	}
	if (move.name === "electroshot") return ['raindance', 'primordialsea'].includes(pokemon.effectiveWeather());
	return true;
}

function isParentalBondBanned(move: ActiveMove, source: Pokemon): boolean {
	if (move.category === "Status") return true;
	if (move.multihit) return true;
	if (move.flags["noparentalbond"]) return true;
	if (doesMoveCharge(source, move)) return true;
	if (move.flags["futuremove"]) return true;
	if (move.spreadHit) return true;
	if (move.isZ) return true;
	if (move.isMax) return true;
	return false;
}

export const Abilities: { [abilityid: string]: AbilityData } = {
	noability: {
		isNonstandard: "Past",
		name: "No Ability",
		rating: 0.1,
		num: 0,
	},
	adaptability: {
		onModifyMove(move) {
			move.stab = 2;
		},
		name: "Adaptability",
		rating: 4,
		num: 91,
	},
	aerilate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Flying";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Aerilate",
		rating: 4,
		num: 184,
	},
	superconductor: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Steel" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Electric";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Superconductor",
		rating: 4,
		num: 600,
		gen: 8,
	},
	aftermath: {
		name: "Aftermath",
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (
				!target.hp &&
				this.checkMoveMakesContact(move, source, target, true)
			) {
				this.damage(source.baseMaxhp / 4, source, target);
			}
		},
		rating: 2,
		num: 106,
	},
	airlock: {
		onSwitchIn(pokemon) {
			this.effectState.switchingIn = true;
		},
		onStart(pokemon) {
			// Air Lock does not activate when Skill Swapped or when Neutralizing Gas leaves the field
			if (this.effectState.switchingIn) {
				this.add("-ability", pokemon, "Air Lock");
				this.effectState.switchingIn = false;
			}
			this.eachEvent("WeatherChange", this.effect);
		},
		onEnd(pokemon) {
			this.eachEvent("WeatherChange", this.effect);
		},
		suppressWeather: true,
		name: "Air Lock",
		rating: 1.5,
		num: 76,
	},
	analytic: {
		onModifyDamage(basePower, pokemon) {
			let boosted = true;
			for (const target of this.getAllActive()) {
				if (target === pokemon) continue;
				if (this.queue.willMove(target)) {
					boosted = false;
					break;
				}
			}
			if (boosted) {
				this.debug("Analytic boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Analytic",
		rating: 2.5,
		num: 148,
	},
	angerpoint: {
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (target === source) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({atk: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({atk: 1}, target, target);
			}
		},
		name: "Anger Point",
		rating: 1,
		num: 83,
	},
	angershell: {
		onDamage(damage, target, source, effect) {
			if (
				effect.effectType === "Move" &&
				!effect.multihit &&
				!effect.negateSecondary &&
				!(effect.hasSheerForce && source.hasAbility("sheerforce"))
			) {
				this.effectState.checkedAngerShell = false;
			} else {
				this.effectState.checkedAngerShell = true;
			}
		},
		onTryEatItem(item) {
			const healingItems = [
				"aguavberry",
				"enigmaberry",
				"figyberry",
				"iapapaberry",
				"magoberry",
				"sitrusberry",
				"wikiberry",
				"oranberry",
				"berryjuice",
			];
			if (healingItems.includes(item.id)) {
				return this.effectState.checkedAngerShell;
			}
			return true;
		},
		onAfterMoveSecondary(target, source, move) {
			this.effectState.checkedAngerShell = true;
			if (!source || source === target || !target.hp || !move.totalDamage) { return; }
			const lastAttackedBy = target.getLastAttackedBy();
			if (!lastAttackedBy) return;
			const damage = move.multihit ?
				move.totalDamage :
				lastAttackedBy.damage;
			if (
				target.hp <= target.maxhp / 2 &&
				target.hp + damage > target.maxhp / 2
			) {
				this.boost(
					{atk: 1, spa: 1, spe: 1, def: -1, spd: -1},
					target,
					target
				);
			}
		},
		name: "Anger Shell",
		rating: 3,
		num: 271,
	},
	anticipation: {
		onStart(pokemon) {
			for (const target of pokemon.foes()) {
				for (const moveSlot of target.moveSlots) {
					const move = this.dex.moves.get(moveSlot.move);
					if (move.category === "Status") continue;
					const moveType =
						move.id === "hiddenpower" ? target.hpType : move.type;
					if (
						(this.dex.getImmunity(moveType, pokemon) &&
							this.dex.getEffectiveness(moveType, pokemon) > 0) ||
						move.ohko
					) {
						this.add("-ability", pokemon, "Anticipation");
						return;
					}
				}
			}
		},
		onAccuracyPriority: -100,
		onAccuracy(accuracy, target, source, move) {
			if (accuracy === true) return;
			if (source.permanentAbilityState["anticipation"]) return;
			if (target.runEffectiveness(move) > 0) {
				move.accuracy = 0;
				source.permanentAbilityState["anticipation"] = true;
			}
		},
		name: "Anticipation",
		rating: 0.5,
		num: 107,
	},
	arenatrap: {
		onFoeTrapPokemon(pokemon) {
			if (!pokemon.isAdjacent(this.effectState.target)) return;
			if (pokemon.isGrounded()) {
				pokemon.tryTrap(true);
			}
		},
		onFoeMaybeTrapPokemon(pokemon, source) {
			if (!source) source = this.effectState.target;
			if (!source || !pokemon.isAdjacent(source)) return;
			if (pokemon.isGrounded(!pokemon.knownType)) {
				// Negate immunity if the type is unknown
				pokemon.maybeTrapped = true;
			}
		},
		name: "Arena Trap",
		rating: 5,
		num: 71,
	},
	armortail: {
		onFoeTryMove(target, source, move) {
			const targetAllExceptions = [
				"perishsong",
				"flowershield",
				"rototiller",
			];
			if (
				move.target === "foeSide" ||
				(move.target === "all" && !targetAllExceptions.includes(move.id))
			) {
				return;
			}

			const armorTailHolder = this.effectState.target;
			if (
				(source.isAlly(armorTailHolder) || move.target === "all") &&
				move.priority > 0.1
			) {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					armorTailHolder,
					"ability: Armor Tail",
					move,
					"[of] " + target
				);
				return false;
			}
		},
		isBreakable: true,
		name: "Armor Tail",
		rating: 2.5,
		num: 296,
	},
	aromaveil: {
		onAllyTryAddVolatile(status, target, source, effect) {
			if (
				[
					"attract",
					"disable",
					"encore",
					"healblock",
					"taunt",
					"torment",
				].includes(status.id)
			) {
				if (effect.effectType === "Move") {
					const effectHolder = this.effectState.target;
					this.add(
						"-block",
						target,
						"ability: Aroma Veil",
						"[of] " + effectHolder
					);
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Aroma Veil",
		rating: 2,
		num: 165,
	},
	/**
	 * Seems correct according to elite redux dex.
	 */
	asoneglastrier: {
		onPreStart(pokemon) {
			this.add("-ability", pokemon, "As One");
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onEnd() {
			this.effectState.unnerved = false;
		},
		onFoeTryEatItem() {
			return !this.effectState.unnerved;
		},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost(
					{atk: length},
					source,
					source,
					this.dex.abilities.get("chillingneigh")
				);
			}
		},
		isPermanent: true,
		name: "As One (Glastrier)",
		rating: 3.5,
		num: 266,
	},
	/**
	 * Seems correct according to elite redux dex.
	 */
	asonespectrier: {
		onPreStart(pokemon) {
			this.add("-ability", pokemon, "As One");
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onEnd() {
			this.effectState.unnerved = false;
		},
		onFoeTryEatItem() {
			return !this.effectState.unnerved;
		},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost(
					{spa: length},
					source,
					source,
					this.dex.abilities.get("grimneigh")
				);
			}
		},
		isPermanent: true,
		name: "As One (Spectrier)",
		rating: 3.5,
		num: 267,
	},
	aurabreak: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Aura Break");
		},
		onAnyTryPrimaryHit(target, source, move) {
			if (target === source || move.category === "Status") return;
			move.hasAuraBreak = true;
		},
		isBreakable: true,
		name: "Aura Break",
		rating: 1,
		num: 188,
	},
	baddreams: {
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (!pokemon.hp) return;
			for (const target of pokemon.foes()) {
				if (target.status === "slp" || target.hasAbility("comatose")) {
					this.damage(target.baseMaxhp / 8, target, pokemon);
				}
			}
		},
		name: "Bad Dreams",
		rating: 1.5,
		num: 123,
	},
	ballfetch: {
		name: "Ball Fetch",
		rating: 0,
		num: 237,
	},
	battery: {
		onAllyModifyDamage(basePower, attacker, defender, move) {
			if (
				attacker !== this.effectState.target &&
				move.category === "Special"
			) {
				this.debug("Battery boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Battery",
		rating: 0,
		num: 217,
	},
	battlearmor: {
		onSourceModifyDamage(damage, source, target, move) {
			this.debug('Battle Armor weaken');
			return this.chainModify(0.8);
		},
		onCriticalHit: false,
		isBreakable: true,
		name: "Battle Armor",
		rating: 1,
		num: 4,
	},
	battlebond: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect?.effectType !== "Move") return;
			if (source.abilityState.battleBondTriggered) return;
			if (
				source.species.id === "greninjabond" &&
				source.hp &&
				!source.transformed &&
				source.side.foePokemonLeft()
			) {
				this.boost({atk: 1, spa: 1, spe: 1}, source, source, this.effect);
				this.add("-activate", source, "ability: Battle Bond");
				source.abilityState.battleBondTriggered = true;
			}
		},
		isPermanent: true,
		name: "Battle Bond",
		rating: 3.5,
		num: 210,
	},
	beadsofruin: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Beads of Ruin");
		},
		onAnyModifySpD(spd, target, source, move) {
			const abilityHolder = this.effectState.target;
			if (!abilityHolder) return;
			if (target.hasAbility("beadsofruin")) return;
			if (!move.ruinedSpD?.hasAbility("beadsofruin")) { move.ruinedSpD = abilityHolder; }
			if (move.ruinedSpD !== abilityHolder) return;
			this.debug("Beads of Ruin SpD drop");
			return this.chainModify(0.75);
		},
		name: "Beads of Ruin",
		rating: 4.5,
		num: 284,
	},
	beastboost: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				const bestStat = source.getBestStat(true, true);
				this.boost({[bestStat]: length}, source);
			}
		},
		name: "Beast Boost",
		rating: 3.5,
		num: 224,
	},
	berserk: {
		onDamage(damage, target, source, effect) {
			if (
				effect.effectType === "Move" &&
				!effect.multihit &&
				!effect.negateSecondary &&
				!(effect.hasSheerForce && source.hasAbility("sheerforce"))
			) {
				this.effectState.checkedBerserk = false;
			} else {
				this.effectState.checkedBerserk = true;
			}
		},
		onTryEatItem(item) {
			const healingItems = [
				"aguavberry",
				"enigmaberry",
				"figyberry",
				"iapapaberry",
				"magoberry",
				"sitrusberry",
				"wikiberry",
				"oranberry",
				"berryjuice",
			];
			if (healingItems.includes(item.id)) {
				return this.effectState.checkedBerserk;
			}
			return true;
		},
		onAfterMoveSecondary(target, source, move) {
			this.effectState.checkedBerserk = true;
			if (!source || source === target || !target.hp || !move.totalDamage) { return; }
			const lastAttackedBy = target.getLastAttackedBy();
			if (!lastAttackedBy) return;
			const damage = move.multihit ?
				move.totalDamage :
				lastAttackedBy.damage;
			if (
				target.hp <= target.maxhp / 2 &&
				target.hp + damage > target.maxhp / 2
			) {
				this.boost({spa: 1}, target, target);
			}
		},
		name: "Berserk",
		rating: 2,
		num: 201,
	},
	bigpecks: {
		onTryBoost(boost, target, source, effect) {
			if (source && target === source) return;
			if (boost.def && boost.def < 0) {
				delete boost.def;
				if (
					!(effect as ActiveMove).secondaries &&
					effect.id !== "octolock"
				) {
					this.add(
						"-fail",
						target,
						"unboost",
						"Defense",
						"[from] ability: Big Pecks",
						"[of] " + target
					);
				}
			}
		},
		isBreakable: true,
		name: "Big Pecks",
		rating: 0.5,
		num: 145,
	},
	blaze: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Fire" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Blaze boost");
				return this.chainModify(1.5);
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, attacker, defender, move) {
			if (move.type === "Fire" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Blaze boost");
				return this.chainModify(1.5);
			}
		},
		name: "Blaze",
		rating: 2,
		num: 66,
	},
	bulletproof: {
		onTryHit(pokemon, target, move) {
			if (move.flags["bullet"]) {
				this.add("-immune", pokemon, "[from] ability: Bulletproof");
				return null;
			}
		},
		isBreakable: true,
		name: "Bulletproof",
		rating: 3,
		num: 171,
	},
	cheekpouch: {
		onEatItem(item, pokemon) {
			this.heal(pokemon.baseMaxhp / 3);
		},
		name: "Cheek Pouch",
		rating: 2,
		num: 167,
	},
	/**
	 * Looks correct according to elite redux dex
	 */
	chillingneigh: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({atk: length}, source);
			}
		},
		name: "Chilling Neigh",
		rating: 3,
		num: 264,
	},
	chlorophyll: {
		onModifySpe(spe, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(2);
			}
		},
		name: "Chlorophyll",
		rating: 3,
		num: 34,
	},
	clearbody: {
		onTryBoost(boost, target, source, effect) {
			let showMsg = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					delete boost[i];
					showMsg = true;
				}
			}
			if (
				showMsg &&
				!(effect as ActiveMove).secondaries &&
				effect.id !== "octolock"
			) {
				this.add(
					"-fail",
					target,
					"unboost",
					"[from] ability: Clear Body",
					"[of] " + target
				);
			}
		},
		isBreakable: true,
		name: "Clear Body",
		rating: 2,
		num: 29,
	},
	cloudnine: {
		onSwitchIn(pokemon) {
			this.effectState.switchingIn = true;
		},
		onStart(pokemon) {
			// Cloud Nine does not activate when Skill Swapped or when Neutralizing Gas leaves the field
			if (this.effectState.switchingIn) {
				this.add("-ability", pokemon, "Cloud Nine");
				this.effectState.switchingIn = false;
			}
			this.eachEvent("WeatherChange", this.effect);
		},
		onEnd(pokemon) {
			this.eachEvent("WeatherChange", this.effect);
		},
		suppressWeather: true,
		name: "Cloud Nine",
		rating: 1.5,
		num: 13,
	},
	colorchange: {
		onAfterMoveSecondary(target, source, move) {
			if (!target.hp) return;
			const type = move.type;
			if (
				target.isActive &&
				move.effectType === "Move" &&
				move.category !== "Status" &&
				type !== "???" &&
				!target.hasType(type)
			) {
				if (!target.setType(type)) return false;
				this.add(
					"-start",
					target,
					"typechange",
					type,
					"[from] ability: Color Change"
				);

				if (target.side.active.length === 2 && target.position === 1) {
					// Curse Glitch
					const action = this.queue.willMove(target);
					if (action && action.move.id === "curse") {
						action.targetLoc = -1;
					}
				}
			}
		},
		name: "Color Change",
		rating: 0,
		num: 16,
	},
	comatose: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Comatose");
		},
		onSetStatus(status, target, source, effect) {
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Comatose");
			}
			return false;
		},
		// Permanent sleep "status" implemented in the relevant sleep-checking effects
		isPermanent: true,
		name: "Comatose",
		rating: 4,
		num: 213,
	},
	commander: {
		onUpdate(pokemon) {
			const ally = pokemon.allies()[0];
			if (
				!ally ||
				pokemon.baseSpecies.baseSpecies !== "Tatsugiri" ||
				ally.baseSpecies.baseSpecies !== "Dondozo"
			) {
				// Handle any edge cases
				if (pokemon.getVolatile("commanding")) { pokemon.removeVolatile("commanding"); }
				return;
			}

			if (!pokemon.getVolatile("commanding")) {
				// If Dondozo already was commanded this fails
				if (ally.getVolatile("commanded")) return;
				// Cancel all actions this turn for pokemon if applicable
				this.queue.cancelAction(pokemon);
				// Add volatiles to both pokemon
				this.add(
					"-activate",
					pokemon,
					"ability: Commander",
					"[of] " + ally
				);
				pokemon.addVolatile("commanding");
				ally.addVolatile("commanded", pokemon);
				// Continued in conditions.ts in the volatiles
			} else {
				if (!ally.fainted) return;
				pokemon.removeVolatile("commanding");
			}
		},
		isPermanent: true,
		name: "Commander",
		rating: 0,
		num: 279,
	},
	competitive: {
		onAfterEachBoost(boost, target, source, effect) {
			if (!source || target.isAlly(source)) {
				if (effect.id === "stickyweb") {
					this.hint(
						"Court Change Sticky Web counts as lowering your own Speed, and Competitive only affects stats lowered by foes.",
						true,
						source.side
					);
				}
				return;
			}
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered) {
				this.boost({spa: 2}, target, target, null, false, true);
			}
		},
		name: "Competitive",
		rating: 2.5,
		num: 172,
	},
	compoundeyes: {
		onSourceModifyAccuracyPriority: -1,
		onSourceModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			this.debug("compoundeyes - enhancing accuracy");
			return this.chainModify([5325, 4096]);
		},
		name: "Compound Eyes",
		rating: 3,
		num: 14,
	},
	contrary: {
		onChangeBoost(boost, target, source, effect) {
			if (effect && effect.id === "zpower") return;
			let i: BoostID;
			for (i in boost) {
				boost[i]! *= -1;
			}
		},
		isBreakable: true,
		name: "Contrary",
		rating: 4.5,
		num: 126,
	},
	corrosion: {
		// Implemented in sim/pokemon.js:Pokemon#setStatus
		name: "Corrosion",
		rating: 2.5,
		num: 212,
	},
	costar: {
		onStart(pokemon) {
			const ally = pokemon.allies()[0];
			if (!ally) return;

			let i: BoostID;
			for (i in ally.boosts) {
				pokemon.boosts[i] = ally.boosts[i];
			}
			const volatilesToCopy = ["focusenergy", "gmaxchistrike", "laserfocus"];
			for (const volatile of volatilesToCopy) {
				if (ally.volatiles[volatile]) {
					pokemon.addVolatile(volatile);
					if (volatile === "gmaxchistrike") {
						pokemon.volatiles[volatile].layers =
							ally.volatiles[volatile].layers;
					}
				} else {
					pokemon.removeVolatile(volatile);
				}
			}
			this.add("-copyboost", pokemon, ally, "[from] ability: Costar");
		},
		name: "Costar",
		rating: 0,
		num: 294,
	},
	cottondown: {
		onDamagingHit(damage, target, source, move) {
			let activated = false;
			for (const pokemon of this.getAllActive()) {
				if (pokemon === target || pokemon.fainted) continue;
				if (!activated) {
					this.add("-ability", target, "Cotton Down");
					activated = true;
				}
				this.boost({spe: -1}, pokemon, target, null, true);
			}
		},
		name: "Cotton Down",
		rating: 2,
		num: 238,
	},
	cudchew: {
		onEatItem(item, pokemon) {
			if (item.isBerry && pokemon.addVolatile("cudchew")) {
				pokemon.volatiles["cudchew"].berry = item;
			}
		},
		onEnd(pokemon) {
			delete pokemon.volatiles["cudchew"];
		},
		condition: {
			noCopy: true,
			duration: 2,
			onRestart() {
				this.effectState.duration = 2;
			},
			onResidualOrder: 28,
			onResidualSubOrder: 2,
			onEnd(pokemon) {
				if (pokemon.hp) {
					const item = this.effectState.berry;
					this.add("-activate", pokemon, "ability: Cud Chew");
					this.add("-enditem", pokemon, item.name, "[eat]");
					if (this.singleEvent("Eat", item, null, pokemon, null, null)) {
						this.runEvent("EatItem", pokemon, null, null, item);
					}
					if (item.onEat) pokemon.ateBerry = true;
				}
			},
		},
		name: "Cud Chew",
		rating: 2,
		num: 291,
	},
	/**
	 * Seems to be implemented properly based on the elite redux dex.
	 */
	curiousmedicine: {
		onStart(pokemon) {
			for (const ally of pokemon.adjacentAllies()) {
				ally.clearBoosts();
				this.add(
					"-clearboost",
					ally,
					"[from] ability: Curious Medicine",
					"[of] " + pokemon
				);
			}
		},
		name: "Curious Medicine",
		rating: 0,
		num: 261,
	},
	cursedbody: {
		onDamagingHit(damage, target, source, move) {
			if (source.volatiles["disable"]) return;
			if (
				!move.isMax &&
				!move.flags["futuremove"] &&
				move.id !== "struggle"
			) {
				if (this.randomChance(3, 10)) {
					source.addVolatile("disable", this.effectState.target);
				}
			}
		},
		name: "Cursed Body",
		rating: 2,
		num: 130,
	},
	cutecharm: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.addVolatile("attract", this.effectState.target);
				}
			}
		},
		name: "Cute Charm",
		rating: 0.5,
		num: 56,
	},
	damp: {
		onAnyTryMove(target, source, effect) {
			if (
				[
					"explosion",
					"mindblown",
					"mistyexplosion",
					"selfdestruct",
				].includes(effect.id)
			) {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					this.effectState.target,
					"ability: Damp",
					effect,
					"[of] " + target
				);
				return false;
			}
		},
		onAnyDamage(damage, target, source, effect) {
			if (effect && effect.name === "Aftermath") {
				return false;
			}
		},
		isBreakable: true,
		name: "Damp",
		rating: 0.5,
		num: 6,
	},
	dancer: {
		name: "Dancer",
		// implemented in runMove in scripts.js
		rating: 1.5,
		num: 216,
	},
	darkaura: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Dark Aura");
		},
		onAnyModifyDamage(basePower, source, target, move) {
			if (
				target === source ||
				move.category === "Status" ||
				move.type !== "Dark"
			) { return; }
			if (!move.auraBooster?.hasAbility("Dark Aura")) { move.auraBooster = this.effectState.target; }
			if (move.auraBooster !== this.effectState.target) return;
			return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
		},
		name: "Dark Aura",
		rating: 3,
		num: 186,
	},
	dauntlessshield: {
		onStart(pokemon) {
			if (this.effectState.shieldBoost) return;
			this.effectState.shieldBoost = true;
			this.boost({def: 1}, pokemon);
		},
		name: "Dauntless Shield",
		rating: 3.5,
		num: 235,
	},
	dazzling: {
		onFoeTryMove(target, source, move) {
			const targetAllExceptions = [
				"perishsong",
				"flowershield",
				"rototiller",
			];
			if (
				move.target === "foeSide" ||
				(move.target === "all" && !targetAllExceptions.includes(move.id))
			) {
				return;
			}

			const dazzlingHolder = this.effectState.target;
			if (
				(source.isAlly(dazzlingHolder) || move.target === "all") &&
				move.priority > 0.1
			) {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					dazzlingHolder,
					"ability: Dazzling",
					move,
					"[of] " + target
				);
				return false;
			}
		},
		isBreakable: true,
		name: "Dazzling",
		rating: 2.5,
		num: 219,
	},
	defeatist: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				return this.chainModify(0.5);
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, pokemon) {
			if (pokemon.hp <= pokemon.maxhp / 2) {
				return this.chainModify(0.5);
			}
		},
		name: "Defeatist",
		rating: -1,
		num: 129,
	},
	defiant: {
		onAfterEachBoost(boost, target, source, effect) {
			if (!source || target.isAlly(source)) {
				if (effect.id === "stickyweb") {
					this.hint(
						"Court Change Sticky Web counts as lowering your own Speed, and Defiant only affects stats lowered by foes.",
						true,
						source.side
					);
				}
				return;
			}
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered) {
				this.boost({atk: 2}, target, target, null, false, true);
			}
		},
		name: "Defiant",
		rating: 3,
		num: 128,
	},
	deltastream: {
		onStart(source) {
			this.field.setWeather("deltastream");
		},
		onAnySetWeather(target, source, weather) {
			const strongWeathers = [
				"desolateland",
				"primordialsea",
				"deltastream",
			];
			if (
				this.field.getWeather().id === "deltastream" &&
				!strongWeathers.includes(weather.id)
			) { return false; }
		},
		onEnd(pokemon) {
			if (this.field.weatherState.source !== pokemon) return;
			for (const target of this.getAllActive()) {
				if (target === pokemon) continue;
				if (target.hasAbility("deltastream")) {
					this.field.weatherState.source = target;
					return;
				}
			}
			this.field.clearWeather();
		},
		name: "Delta Stream",
		rating: 4,
		num: 191,
	},
	desolateland: {
		onStart(source) {
			this.field.setWeather("desolateland");
		},
		onAnySetWeather(target, source, weather) {
			const strongWeathers = [
				"desolateland",
				"primordialsea",
				"deltastream",
			];
			if (
				this.field.getWeather().id === "desolateland" &&
				!strongWeathers.includes(weather.id)
			) { return false; }
		},
		onEnd(pokemon) {
			if (this.field.weatherState.source !== pokemon) return;
			for (const target of this.getAllActive()) {
				if (target === pokemon) continue;
				if (target.hasAbility("desolateland")) {
					this.field.weatherState.source = target;
					return;
				}
			}
			this.field.clearWeather();
		},
		name: "Desolate Land",
		rating: 4.5,
		num: 190,
	},
	disguise: {
		onDamagePriority: 1,
		onDamage(damage, target, source, effect) {
			if (
				effect &&
				effect.effectType === "Move" &&
				["mimikyu", "mimikyutotem"].includes(target.species.id) &&
				!target.transformed
			) {
				this.add("-activate", target, "ability: Disguise");
				this.effectState.busted = true;
				return 0;
			}
		},
		onCriticalHit(target, source, move) {
			if (!target) return;
			if (
				!["mimikyu", "mimikyutotem"].includes(target.species.id) ||
				target.transformed
			) {
				return;
			}
			const hitSub =
				target.volatiles["substitute"] &&
				!move.flags["bypasssub"] &&
				!(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move.type)) return;
			return false;
		},
		onEffectiveness(typeMod, target, type, move) {
			if (!target || move.category === "Status") return;
			if (
				!["mimikyu", "mimikyutotem"].includes(target.species.id) ||
				target.transformed
			) {
				return;
			}

			const hitSub =
				target.volatiles["substitute"] &&
				!move.flags["bypasssub"] &&
				!(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move.type)) return;
			return 0;
		},
		onUpdate(pokemon) {
			if (
				["mimikyu", "mimikyutotem"].includes(pokemon.species.id) &&
				this.effectState.busted
			) {
				const speciesid =
					pokemon.species.id === "mimikyutotem" ?
						"Mimikyu-Busted-Totem" :
						"Mimikyu-Busted";
				pokemon.formeChange(speciesid, this.effect, true);
				this.damage(
					pokemon.baseMaxhp / 8,
					pokemon,
					pokemon,
					this.dex.species.get(speciesid)
				);
			}
		},
		isBreakable: true,
		isPermanent: true,
		name: "Disguise",
		rating: 3.5,
		num: 209,
	},
	download: {
		onStart(pokemon) {
			let totaldef = 0;
			let totalspd = 0;
			for (const target of pokemon.foes()) {
				totaldef += target.getStat("def", false, true);
				totalspd += target.getStat("spd", false, true);
			}
			if (totaldef && totaldef >= totalspd) {
				this.boost({spa: 1});
			} else if (totalspd) {
				this.boost({atk: 1});
			}
		},
		name: "Download",
		rating: 3.5,
		num: 88,
	},
	/**
	 * Looks correct according to elite redux dex
	 */
	dragonsmaw: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Dragon") {
				this.debug("Dragon's Maw boost");
				return this.chainModify(1.5);
			}
		},
		name: "Dragon's Maw",
		rating: 3.5,
		num: 263,
	},
	drizzle: {
		onStart(source) {
			for (const action of this.queue) {
				if (
					action.choice === "runPrimal" &&
					action.pokemon === source &&
					source.species.id === "kyogre"
				) { return; }
				if (action.choice !== "runSwitch" && action.choice !== "runPrimal") { break; }
			}
			this.field.setWeather("raindance");
		},
		name: "Drizzle",
		rating: 4,
		num: 2,
	},
	drought: {
		onStart(source) {
			for (const action of this.queue) {
				if (
					action.choice === "runPrimal" &&
					action.pokemon === source &&
					source.species.id === "groudon"
				) { return; }
				if (action.choice !== "runSwitch" && action.choice !== "runPrimal") { break; }
			}
			this.field.setWeather("sunnyday");
		},
		name: "Drought",
		rating: 4,
		num: 70,
	},
	dryskin: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Water") {
				if (!this.heal(target.baseMaxhp / 4)) {
					this.add("-immune", target, "[from] ability: Dry Skin");
				}
				return null;
			}
		},
		onSourceModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Fire") {
				return this.chainModify(1.25);
			}
		},
		onWeather(target, source, effect) {
			if (target.hasItem("utilityumbrella")) return;
			if (effect.id === "raindance" || effect.id === "primordialsea") {
				this.heal(target.baseMaxhp / 8);
			} else if (effect.id === "sunnyday" || effect.id === "desolateland") {
				this.damage(target.baseMaxhp / 8, target, target);
			}
		},
		isBreakable: true,
		name: "Dry Skin",
		rating: 3,
		num: 87,
	},
	earlybird: {
		name: "Early Bird",
		// Implemented in statuses.js
		rating: 1.5,
		num: 48,
	},
	eartheater: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Ground") {
				if (!this.heal(target.baseMaxhp / 4)) {
					this.add("-immune", target, "[from] ability: Earth Eater");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Earth Eater",
		rating: 3.5,
		num: 297,
	},
	effectspore: {
		onDamagingHit(damage, target, source, move) {
			if (
				this.checkMoveMakesContact(move, source, target) &&
				!source.status &&
				source.runStatusImmunity("powder")
			) {
				const r = this.random(100);
				if (r < 11) {
					source.setStatus("slp", target);
				} else if (r < 21) {
					source.setStatus("par", target);
				} else if (r < 30) {
					source.setStatus("psn", target);
				}
			}
		},
		name: "Effect Spore",
		rating: 2,
		num: 27,
	},
	/**
	 * Updating this to "Electro Surge" to match elite redux ability name.
	 */
	electrosurge: {
		onStart(source) {
			this.field.setTerrain("electricterrain");
		},
		name: "Electro Surge",
		rating: 4,
		num: 226,
	},
	electromorphosis: {
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			target.addVolatile("charge");
		},
		name: "Electromorphosis",
		rating: 2.5,
		num: 280,
	},
	emergencyexit: {
		onEmergencyExit(target) {
			if (
				!this.canSwitch(target.side) ||
				target.forceSwitchFlag ||
				target.switchFlag
			) { return; }
			for (const side of this.sides) {
				for (const active of side.active) {
					active.switchFlag = false;
				}
			}
			target.switchFlag = true;
			this.add("-activate", target, "ability: Emergency Exit");
		},
		name: "Emergency Exit",
		rating: 1,
		num: 194,
	},
	fairyaura: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Fairy Aura");
		},
		onAnyModifyDamage(basePower, source, target, move) {
			if (
				target === source ||
				move.category === "Status" ||
				move.type !== "Fairy"
			) { return; }
			if (!move.auraBooster?.hasAbility("Fairy Aura")) { move.auraBooster = this.effectState.target; }
			if (move.auraBooster !== this.effectState.target) return;
			return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
		},
		name: "Fairy Aura",
		rating: 3,
		num: 187,
	},
	filter: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) {
				this.debug("Filter neutralize");
				return this.chainModify(0.65);
			}
		},
		isBreakable: true,
		name: "Filter",
		rating: 3,
		num: 111,
	},
	flamebody: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.trySetStatus("brn", target);
				}
			}
		},
		name: "Flame Body",
		rating: 2,
		num: 49,
	},
	flareboost: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (attacker.status === "brn" && move.category === "Special") {
				return this.chainModify(1.5);
			}
		},
		name: "Flare Boost",
		rating: 2,
		num: 138,
	},
	flashfire: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Fire") {
				move.accuracy = true;
				if (!target.addVolatile("flashfire")) {
					this.add("-immune", target, "[from] ability: Flash Fire");
				}
				return null;
			}
		},
		onEnd(pokemon) {
			pokemon.removeVolatile("flashfire");
		},
		condition: {
			noCopy: true, // doesn't get copied by Baton Pass
			onStart(target) {
				this.add("-start", target, "ability: Flash Fire");
			},
			onModifyAtkPriority: 5,
			onModifyAtk(atk, attacker, defender, move) {
				if (move.type === "Fire" && attacker.hasAbility("flashfire")) {
					this.debug("Flash Fire boost");
					return this.chainModify(1.5);
				}
			},
			onModifySpAPriority: 5,
			onModifySpA(atk, attacker, defender, move) {
				if (move.type === "Fire" && attacker.hasAbility("flashfire")) {
					this.debug("Flash Fire boost");
					return this.chainModify(1.5);
				}
			},
			onEnd(target) {
				this.add("-end", target, "ability: Flash Fire", "[silent]");
			},
		},
		isBreakable: true,
		name: "Flash Fire",
		rating: 3.5,
		num: 18,
	},
	flowergift: {
		onStart(pokemon) {
			this.singleEvent(
				"WeatherChange",
				this.effect,
				this.effectState,
				pokemon
			);
		},
		onWeatherChange(pokemon) {
			if (
				!pokemon.isActive ||
				pokemon.baseSpecies.baseSpecies !== "Cherrim" ||
				pokemon.transformed
			) { return; }
			if (!pokemon.hp) return;
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				if (pokemon.species.id !== "cherrimsunshine") {
					pokemon.formeChange(
						"Cherrim-Sunshine",
						this.effect,
						false,
						"[msg]"
					);
				}
			} else {
				if (pokemon.species.id === "cherrimsunshine") {
					pokemon.formeChange("Cherrim", this.effect, false, "[msg]");
				}
			}
		},
		onAllyModifyAtkPriority: 3,
		onAllyModifyAtk(atk, pokemon) {
			if (this.effectState.target.baseSpecies.baseSpecies !== "Cherrim") { return; }
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(1.5);
			}
		},
		onAllyModifySpDPriority: 4,
		onAllyModifySpD(spd, pokemon) {
			if (this.effectState.target.baseSpecies.baseSpecies !== "Cherrim") { return; }
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(1.5);
			}
		},
		isBreakable: true,
		name: "Flower Gift",
		rating: 1,
		num: 122,
	},
	flowerveil: {
		onAllyTryBoost(boost, target, source, effect) {
			if ((source && target === source) || !target.hasType("Grass")) return;
			let showMsg = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					delete boost[i];
					showMsg = true;
				}
			}
			if (showMsg && !(effect as ActiveMove).secondaries) {
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Flower Veil",
					"[of] " + effectHolder
				);
			}
		},
		onAllySetStatus(status, target, source, effect) {
			if (
				target.hasType("Grass") &&
				source &&
				target !== source &&
				effect &&
				effect.id !== "yawn"
			) {
				this.debug("interrupting setStatus with Flower Veil");
				if (
					effect.name === "Synchronize" ||
					(effect.effectType === "Move" && !effect.secondaries)
				) {
					const effectHolder = this.effectState.target;
					this.add(
						"-block",
						target,
						"ability: Flower Veil",
						"[of] " + effectHolder
					);
				}
				return null;
			}
		},
		onAllyTryAddVolatile(status, target) {
			if (target.hasType("Grass") && status.id === "yawn") {
				this.debug("Flower Veil blocking yawn");
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Flower Veil",
					"[of] " + effectHolder
				);
				return null;
			}
		},
		isBreakable: true,
		name: "Flower Veil",
		rating: 0,
		num: 166,
	},
	fluffy: {
		onSourceModifyDamage(damage, source, target, move) {
			let mod = 1;
			if (move.type === "Fire") mod *= 2;
			if (move.flags["contact"]) mod /= 2;
			return this.chainModify(mod);
		},
		isBreakable: true,
		name: "Fluffy",
		rating: 3.5,
		num: 218,
	},
	forecast: {
		onStart(pokemon) {
			this.singleEvent(
				"WeatherChange",
				this.effect,
				this.effectState,
				pokemon
			);
		},
		onWeatherChange(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Castform" ||
				pokemon.transformed
			) { return; }
			let forme = null;
			switch (pokemon.effectiveWeather()) {
			case "sunnyday":
			case "desolateland":
				if (pokemon.species.id !== "castformsunny") { forme = "Castform-Sunny"; }
				break;
			case "raindance":
			case "primordialsea":
				if (pokemon.species.id !== "castformrainy") { forme = "Castform-Rainy"; }
				break;
			case "hail":
			case "snow":
				if (pokemon.species.id !== "castformsnowy") { forme = "Castform-Snowy"; }
				break;
			default:
				if (pokemon.species.id !== "castform") forme = "Castform";
				break;
			}
			if (pokemon.isActive && forme) {
				pokemon.formeChange(forme, this.effect, false, "[msg]");
			}
		},
		name: "Forecast",
		rating: 2,
		num: 59,
	},
	forewarn: {
		onStart(pokemon) {
			const move: Move = {
				...Dex.moves.get("futuresight"),
				basePower: 50,
			};

			const target = pokemon.foes()[0];
			this.actions.useMove(move, pokemon, target);
			pokemon.activeMoveActions = 0;
		},
		name: "Forewarn",
		rating: 0.5,
		num: 108,
	},
	friendguard: {
		name: "Friend Guard",
		onAnyModifyDamage(damage, source, target, move) {
			if (
				target !== this.effectState.target &&
				target.isAlly(this.effectState.target)
			) {
				this.debug("Friend Guard weaken");
				return this.chainModify(0.75);
			}
		},
		isBreakable: true,
		rating: 0,
		num: 132,
	},
	frisk: {
		onStart(pokemon) {
			for (const target of pokemon.foes()) {
				if (target.item) {
					this.add(
						"-item",
						target,
						target.getItem().name,
						"[from] ability: Frisk",
						"[of] " + pokemon,
						"[identify]"
					);

					const tempEmbargo: Condition|null = Dex.conditions.get('embargo');
					tempEmbargo.duration = 2;
					target.addVolatile(tempEmbargo);
				}
			}
		},
		name: "Frisk",
		rating: 1.5,
		num: 119,
	},
	fullmetalbody: {
		onTryBoost(boost, target, source, effect) {
			let showMsg = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					delete boost[i];
					showMsg = true;
				}
			}
			if (
				showMsg &&
				!(effect as ActiveMove).secondaries &&
				effect.id !== "octolock"
			) {
				this.add(
					"-fail",
					target,
					"unboost",
					"[from] ability: Full Metal Body",
					"[of] " + target
				);
			}
		},
		name: "Full Metal Body",
		rating: 2,
		num: 230,
	},
	furcoat: {
		onModifyDefPriority: 6,
		onModifyDef(def) {
			return this.chainModify(2);
		},
		isBreakable: true,
		name: "Fur Coat",
		rating: 4,
		num: 169,
	},
	galewings: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Flying" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
		name: "Gale Wings",
		rating: 1.5,
		num: 177,
	},
	galvanize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Electric";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Galvanize",
		rating: 4,
		num: 206,
	},
	gluttony: {
		name: "Gluttony",
		rating: 1.5,
		num: 82,
		onStart(pokemon) {
			pokemon.abilityState.gluttony = true;
		},
		onDamage(item, pokemon) {
			pokemon.abilityState.gluttony = true;
		},
	},
	goodasgold: {
		onTryHit(target, source, move) {
			if (move.category === "Status" && target !== source) {
				this.add("-immune", target, "[from] ability: Good as Gold");
				return null;
			}
		},
		isBreakable: true,
		name: "Good as Gold",
		rating: 5,
		num: 283,
	},
	gooey: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.add("-ability", target, "Gooey");
				this.boost({spe: -1}, source, target, null, true);
			}
		},
		name: "Gooey",
		rating: 2,
		num: 183,
	},
	gorillatactics: {
		onStart(pokemon) {
			pokemon.abilityState.choiceLock = "";
		},
		onBeforeMove(pokemon, target, move) {
			if (move.isZOrMaxPowered || move.id === "struggle") return;
			if (
				pokemon.abilityState.choiceLock &&
				pokemon.abilityState.choiceLock !== move.id
			) {
				// Fails unless ability is being ignored (these events will not run), no PP lost.
				this.addMove("move", pokemon, move.name);
				this.attrLastMove("[still]");
				this.debug("Disabled by Gorilla Tactics");
				this.add("-fail", pokemon);
				return false;
			}
		},
		onModifyMove(move, pokemon) {
			if (
				pokemon.abilityState.choiceLock ||
				move.isZOrMaxPowered ||
				move.id === "struggle"
			) { return; }
			pokemon.abilityState.choiceLock = move.id;
		},
		onModifyAtkPriority: 1,
		onModifyAtk(atk, pokemon) {
			if (pokemon.volatiles["dynamax"]) return;
			// PLACEHOLDER
			this.debug("Gorilla Tactics Atk Boost");
			return this.chainModify(1.5);
		},
		onDisableMove(pokemon) {
			if (!pokemon.abilityState.choiceLock) return;
			if (pokemon.volatiles["dynamax"]) return;
			for (const moveSlot of pokemon.moveSlots) {
				if (moveSlot.id !== pokemon.abilityState.choiceLock) {
					pokemon.disableMove(
						moveSlot.id,
						false,
						this.effectState.sourceEffect
					);
				}
			}
		},
		onEnd(pokemon) {
			pokemon.abilityState.choiceLock = "";
		},
		name: "Gorilla Tactics",
		rating: 4.5,
		num: 255,
	},
	grasspelt: {
		onModifyDefPriority: 6,
		onModifyDef(pokemon) {
			if (this.field.isTerrain("grassyterrain")) { return this.chainModify(1.5); }
		},
		isBreakable: true,
		name: "Grass Pelt",
		rating: 0.5,
		num: 179,
	},
	grassysurge: {
		onStart(source) {
			this.field.setTerrain("grassyterrain");
		},
		name: "Grassy Surge",
		rating: 4,
		num: 229,
	},
	grimneigh: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({spa: length}, source);
			}
		},
		name: "Grim Neigh",
		rating: 3,
		num: 265,
	},
	guarddog: {
		onDragOutPriority: 1,
		onDragOut(pokemon) {
			this.add("-activate", pokemon, "ability: Guard Dog");
			return null;
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.boost({atk: 1}, target, target, null, false, true);
			}
		},
		name: "Guard Dog",
		rating: 2,
		num: 275,
	},
	gulpmissile: {
		onDamagingHit(damage, target, source, move) {
			if (
				!source.hp ||
				!source.isActive ||
				target.transformed ||
				target.isSemiInvulnerable()
			) { return; }
			if (
				["cramorantgulping", "cramorantgorging"].includes(target.species.id)
			) {
				this.damage(source.baseMaxhp / 4, source, target);
				if (target.species.id === "cramorantgulping") {
					this.boost({def: -1}, source, target, null, true);
				} else {
					source.trySetStatus("par", target, move);
				}
				target.formeChange("cramorant", move);
			}
		},
		// The Dive part of this mechanic is implemented in Dive's `onTryMove` in moves.ts
		onSourceTryPrimaryHit(target, source, effect) {
			if (
				effect &&
				effect.id === "surf" &&
				source.hasAbility("gulpmissile") &&
				source.species.name === "Cramorant" &&
				!source.transformed
			) {
				const forme =
					source.hp <= source.maxhp / 2 ?
						"cramorantgorging" :
						"cramorantgulping";
				source.formeChange(forme, effect);
			}
		},
		isPermanent: true,
		name: "Gulp Missile",
		rating: 2.5,
		num: 241,
	},
	guts: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (pokemon.status) {
				return this.chainModify(1.5);
			}
		},
		name: "Guts",
		rating: 3.5,
		num: 62,
	},
	hadronengine: {
		onStart(pokemon) {
			if (
				!this.field.setTerrain("electricterrain") &&
				this.field.isTerrain("electricterrain")
			) {
				this.add("-activate", pokemon, "ability: Hadron Engine");
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, attacker, defender, move) {
			if (this.field.isTerrain("electricterrain")) {
				this.debug("Hadron Engine boost");
				return this.chainModify([5461, 4096]);
			}
		},
		isPermanent: true,
		name: "Hadron Engine",
		rating: 4.5,
		num: 289,
	},
	harvest: {
		name: "Harvest",
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (
				this.field.isWeather(["sunnyday", "desolateland"]) ||
				this.randomChance(1, 2)
			) {
				if (
					pokemon.hp &&
					!pokemon.item &&
					this.dex.items.get(pokemon.lastItem).isBerry
				) {
					pokemon.setItem(pokemon.lastItem);
					pokemon.lastItem = "";
					this.add(
						"-item",
						pokemon,
						pokemon.getItem(),
						"[from] ability: Harvest"
					);
				}
			}
		},
		rating: 2.5,
		num: 139,
	},
	healer: {
		name: "Healer",
		onResidualOrder: 5,
		onResidualSubOrder: 3,
		onResidual(pokemon) {
			for (const allyActive of pokemon.adjacentAllies()) {
				if (allyActive.status && this.randomChance(3, 10)) {
					this.add("-activate", pokemon, "ability: Healer");
					allyActive.cureStatus();
				}
			}
		},
		rating: 0,
		num: 131,
	},
	heatproof: {
		onSourceModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Fire") {
				return this.chainModify(0.5);
			}
		},
		onDamage(damage, target, source, effect) {
			if (effect && effect.id === "brn") {
				return damage / 2;
			}
		},
		isBreakable: true,
		name: "Heatproof",
		rating: 2,
		num: 85,
	},
	heavymetal: {
		onModifyWeightPriority: 1,
		onModifyWeight(weighthg) {
			return weighthg * 2;
		},
		isBreakable: true,
		name: "Heavy Metal",
		rating: 0,
		num: 134,
	},
	honeygather: {
		name: "Honey Gather",
		rating: 0,
		num: 118,
	},
	hugepower: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(2);
		},
		name: "Huge Power",
		rating: 5,
		num: 37,
	},
	hungerswitch: {
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (pokemon.species.baseSpecies !== "Morpeko" || pokemon.transformed) { return; }
			const targetForme =
				pokemon.species.name === "Morpeko" ? "Morpeko-Hangry" : "Morpeko";
			pokemon.formeChange(targetForme);
		},
		name: "Hunger Switch",
		rating: 1,
		num: 258,
	},
	hustle: {
		// This should be applied directly to the stat as opposed to chaining with the others
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.modify(atk, 1.4);
		},
		onSourceModifyAccuracyPriority: -1,
		onSourceModifyAccuracy(accuracy, target, source, move) {
			if (move.category === "Physical" && typeof accuracy === "number") {
				return this.chainModify(0.9);
			}
		},
		name: "Hustle",
		rating: 3.5,
		num: 55,
	},
	hydration: {
		onResidualOrder: 5,
		onResidualSubOrder: 3,
		onResidual(pokemon) {
			if (
				pokemon.status &&
				["raindance", "primordialsea"].includes(pokemon.effectiveWeather())
			) {
				this.debug("hydration");
				this.add("-activate", pokemon, "ability: Hydration");
				pokemon.cureStatus();
			}
		},
		name: "Hydration",
		rating: 1.5,
		num: 93,
	},
	hypercutter: {
		onTryBoost(boost, target, source, effect) {
			if (source && target === source) return;
			if (boost.atk && boost.atk < 0) {
				delete boost.atk;
				if (!(effect as ActiveMove).secondaries) {
					this.add(
						"-fail",
						target,
						"unboost",
						"Attack",
						"[from] ability: Hyper Cutter",
						"[of] " + target
					);
				}
			}
		},
		isBreakable: true,
		name: "Hyper Cutter",
		rating: 1.5,
		num: 52,
	},
	icebody: {
		onWeather(target, source, effect) {
			if (effect.id === "hail" || effect.id === "snow") {
				this.heal(target.baseMaxhp / 16);
			}
		},
		onImmunity(type, pokemon) {
			if (type === "hail") return false;
		},
		name: "Ice Body",
		rating: 1,
		num: 115,
	},
	iceface: {
		onStart(pokemon) {
			if (
				this.field.isWeather(["hail", "snow"]) &&
				pokemon.species.id === "eiscuenoice" &&
				!pokemon.transformed
			) {
				this.add("-activate", pokemon, "ability: Ice Face");
				this.effectState.busted = false;
				pokemon.formeChange("Eiscue", this.effect, true);
			}
		},
		onDamagePriority: 1,
		onDamage(damage, target, source, effect) {
			if (
				effect &&
				effect.effectType === "Move" &&
				effect.category === "Physical" &&
				target.species.id === "eiscue" &&
				!target.transformed
			) {
				this.add("-activate", target, "ability: Ice Face");
				this.effectState.busted = true;
				return 0;
			}
		},
		onCriticalHit(target, type, move) {
			if (!target) return;
			if (
				move.category !== "Physical" ||
				target.species.id !== "eiscue" ||
				target.transformed
			) { return; }
			if (
				target.volatiles["substitute"] &&
				!(move.flags["bypasssub"] || move.infiltrates)
			) { return; }
			if (!target.runImmunity(move.type)) return;
			return false;
		},
		onEffectiveness(typeMod, target, type, move) {
			if (!target) return;
			if (
				move.category !== "Physical" ||
				target.species.id !== "eiscue" ||
				target.transformed
			) { return; }

			const hitSub =
				target.volatiles["substitute"] &&
				!move.flags["bypasssub"] &&
				!(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move.type)) return;
			return 0;
		},
		onUpdate(pokemon) {
			if (pokemon.species.id === "eiscue" && this.effectState.busted) {
				pokemon.formeChange("Eiscue-Noice", this.effect, true);
			}
		},
		onWeatherChange(pokemon, source, sourceEffect) {
			// snow/hail resuming because Cloud Nine/Air Lock ended does not trigger Ice Face
			if ((sourceEffect as Ability)?.suppressWeather) return;
			if (!pokemon.hp) return;
			if (
				this.field.isWeather(["hail", "snow"]) &&
				pokemon.species.id === "eiscuenoice" &&
				!pokemon.transformed
			) {
				this.add("-activate", pokemon, "ability: Ice Face");
				this.effectState.busted = false;
				pokemon.formeChange("Eiscue", this.effect, true);
			}
		},
		isBreakable: true,
		isPermanent: true,
		name: "Ice Face",
		rating: 3,
		num: 248,
	},
	icescales: {
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === "Special") {
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Ice Scales",
		rating: 4,
		num: 246,
	},
	illuminate: {
		name: "Illuminate",
		shortDesc: "Grants a 1.2x accuracy boost.",
		onSourceModifyAccuracyPriority: -1,
		onSourceModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			this.debug("compoundeyes - enhancing accuracy");
			return this.chainModify(1.2);
		},
	},
	illusion: {
		onBeforeSwitchIn(pokemon) {
			pokemon.illusion = null;
			// yes, you can Illusion an active pokemon but only if it's to your right
			for (
				let i = pokemon.side.pokemon.length - 1;
				i > pokemon.position;
				i--
			) {
				const possibleTarget = pokemon.side.pokemon[i];
				if (!possibleTarget.fainted) {
					pokemon.illusion = possibleTarget;
					break;
				}
			}
		},
		onDamagingHit(damage, target, source, move) {
			if (target.illusion) {
				this.singleEvent(
					"End",
					this.dex.abilities.get("Illusion"),
					target.abilityState,
					target,
					source,
					move
				);
			}
		},
		onEnd(pokemon) {
			if (pokemon.illusion) {
				this.debug("illusion cleared");
				pokemon.illusion = null;
				const details =
					pokemon.species.name +
					(pokemon.level === 100 ? "" : ", L" + pokemon.level) +
					(pokemon.gender === "" ? "" : ", " + pokemon.gender) +
					(pokemon.set.shiny ? ", shiny" : "");
				this.add("replace", pokemon, details);
				this.add("-end", pokemon, "Illusion");
			}
		},
		onFaint(pokemon) {
			pokemon.illusion = null;
		},
		name: "Illusion",
		rating: 4.5,
		num: 149,
	},
	immunity: {
		onUpdate(pokemon) {
			if (pokemon.status === "psn" || pokemon.status === "tox") {
				this.add("-activate", pokemon, "ability: Immunity");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "psn" && status.id !== "tox") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Immunity");
			}
			return false;
		},
		isBreakable: true,
		name: "Immunity",
		rating: 2,
		num: 17,
	},
	imposter: {
		onSwitchIn(pokemon) {
			this.effectState.switchingIn = true;
		},
		onStart(pokemon) {
			// Imposter does not activate when Skill Swapped or when Neutralizing Gas leaves the field
			if (!this.effectState.switchingIn) return;
			// copies across in doubles/triples
			// (also copies across in multibattle and diagonally in free-for-all,
			// but side.foe already takes care of those)
			const target =
				pokemon.side.foe.active[
					pokemon.side.foe.active.length - 1 - pokemon.position
				];
			if (target) {
				pokemon.transformInto(target, this.dex.abilities.get("imposter"));
			}
			this.effectState.switchingIn = false;
		},
		name: "Imposter",
		rating: 5,
		num: 150,
	},
	infiltrator: {
		onModifyMove(move) {
			move.infiltrates = true;
		},
		name: "Infiltrator",
		rating: 2.5,
		num: 151,
	},
	innardsout: {
		name: "Innards Out",
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) {
				this.damage(target.getUndynamaxedHP(damage), source, target);
			}
		},
		rating: 4,
		num: 215,
	},
	innerfocus: {
		onTryAddVolatile(status, pokemon) {
			if (status.id === "flinch") return null;
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Inner Focus",
					"[of] " + target
				);
			}
		},
		isBreakable: true,
		name: "Inner Focus",
		rating: 1,
		num: 39,
	},
	insomnia: {
		onUpdate(pokemon) {
			if (pokemon.status === "slp") {
				this.add("-activate", pokemon, "ability: Insomnia");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "slp") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Insomnia");
			}
			return false;
		},
		isBreakable: true,
		name: "Insomnia",
		rating: 1.5,
		num: 15,
	},
	intimidate: {
		onStart(pokemon) {
			let activated = false;
			for (const target of pokemon.adjacentFoes()) {
				if (!activated) {
					this.add("-ability", pokemon, "Intimidate", "boost");
					activated = true;
				}
				if (target.volatiles["substitute"]) {
					this.add("-immune", target);
				} else {
					this.boost({atk: -1}, target, pokemon, null, true);
				}
			}
		},
		name: "Intimidate",
		rating: 3.5,
		num: 22,
	},
	intrepidsword: {
		onStart(pokemon) {
			if (this.effectState.swordBoost) return;
			this.effectState.swordBoost = true;
			this.boost({atk: 1}, pokemon);
		},
		name: "Intrepid Sword",
		rating: 4,
		num: 234,
	},
	ironbarbs: {
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.damage(source.baseMaxhp / 8, source, target);
			}
		},
		name: "Iron Barbs",
		rating: 2.5,
		num: 160,
	},
	ironfist: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["punch"]) {
				this.debug("Iron Fist boost");
				return this.chainModify(1.3);
			}
		},
		name: "Iron Fist",
		rating: 3,
		num: 89,
	},
	justified: {
		onDamagingHit(damage, target, source, move) {
			if (move.type === "Dark") {
				this.boost({atk: 1});
			}
		},
		name: "Justified",
		rating: 2.5,
		num: 154,
	},
	keeneye: {
		onTryBoost(boost, target, source, effect) {
			if (source && target === source) return;
			if (boost.accuracy && boost.accuracy < 0) {
				delete boost.accuracy;
				if (!(effect as ActiveMove).secondaries) {
					this.add(
						"-fail",
						target,
						"unboost",
						"accuracy",
						"[from] ability: Keen Eye",
						"[of] " + target
					);
				}
			}
		},
		onModifyMove(move) {
			move.ignoreEvasion = true;
			move.accuracy = typeof move.accuracy === 'number' ? move.accuracy * 1.2 : move.accuracy;
		},
		isBreakable: true,
		name: "Keen Eye",
		rating: 0.5,
		num: 51,
	},
	klutz: {
		// Item suppression implemented in Pokemon.ignoringItem() within sim/pokemon.js
		onStart(pokemon) {
			this.singleEvent("End", pokemon.getItem(), pokemon.itemState, pokemon);
		},
		name: "Klutz",
		rating: -1,
		num: 103,
	},
	leafguard: {
		onSetStatus(status, target, source, effect) {
			if (["sunnyday", "desolateland"].includes(target.effectiveWeather())) {
				if ((effect as Move)?.status) {
					this.add("-immune", target, "[from] ability: Leaf Guard");
				}
				return false;
			}
		},
		onTryAddVolatile(status, target) {
			if (
				status.id === "yawn" &&
				["sunnyday", "desolateland"].includes(target.effectiveWeather())
			) {
				this.add("-immune", target, "[from] ability: Leaf Guard");
				return null;
			}
		},
		isBreakable: true,
		name: "Leaf Guard",
		rating: 0.5,
		num: 102,
	},
	levitate: {
		// airborneness implemented in sim/pokemon.js:Pokemon#isGrounded
		isBreakable: true,
		name: "Levitate",
		rating: 3.5,
		num: 26,
	},
	libero: {
		onPrepareHit(source, target, move) {
			if (this.effectState.libero) return;
			if (
				move.hasBounced ||
				move.flags["futuremove"] ||
				move.sourceEffect === "snatch"
			) { return; }
			const type = move.type;
			if (type && type !== "???" && source.getTypes().join() !== type) {
				if (!source.setType(type)) return;
				this.effectState.libero = true;
				this.add(
					"-start",
					source,
					"typechange",
					type,
					"[from] ability: Libero"
				);
			}
		},
		onSwitchIn() {
			delete this.effectState.libero;
		},
		name: "Libero",
		rating: 4,
		num: 236,
	},
	lightmetal: {
		onModifyWeight(weighthg) {
			return this.trunc(weighthg / 2);
		},
		onModifySpe(spe, pokemon) {
			this.chainModify(1.3);
		},
		isBreakable: true,
		name: "Light Metal",
		rating: 1,
		num: 135,
	},
	lightningrod: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Electric") {
				if (!this.boost({spa: 1})) {
					this.add("-immune", target, "[from] ability: Lightning Rod");
				}
				return null;
			}
		},
		onAnyRedirectTarget(target, source, source2, move) {
			if (move.type !== "Electric" || move.flags["pledgecombo"]) return;
			const redirectTarget = ["randomNormal", "adjacentFoe"].includes(
				move.target
			) ?
				"normal" :
				move.target;
			if (
				this.validTarget(this.effectState.target, source, redirectTarget)
			) {
				if (move.smartTarget) move.smartTarget = false;
				if (this.effectState.target !== target) {
					this.add(
						"-activate",
						this.effectState.target,
						"ability: Lightning Rod"
					);
				}
				return this.effectState.target;
			}
		},
		isBreakable: true,
		name: "Lightning Rod",
		rating: 3,
		num: 31,
	},
	limber: {
		onUpdate(pokemon) {
			if (pokemon.status === "par") {
				this.add("-activate", pokemon, "ability: Limber");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "par") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Limber");
			}
			return false;
		},
		isBreakable: true,
		name: "Limber",
		rating: 2,
		num: 7,
	},
	lingeringaroma: {
		onDamagingHit(damage, target, source, move) {
			const sourceAbility = source.getAbility();
			if (
				sourceAbility.isPermanent ||
				sourceAbility.id === "lingeringaroma"
			) {
				return;
			}
			if (
				this.checkMoveMakesContact(
					move,
					source,
					target,
					!source.isAlly(target)
				)
			) {
				const oldAbility = source.setAbility("lingeringaroma", target);
				if (oldAbility) {
					this.add(
						"-activate",
						target,
						"ability: Lingering Aroma",
						this.dex.abilities.get(oldAbility).name,
						"[of] " + source
					);
				}
			}
		},
		name: "Lingering Aroma",
		rating: 2,
		num: 268,
	},
	liquidooze: {
		onSourceTryHeal(damage, target, source, effect) {
			this.debug(
				"Heal is occurring: " +
					target +
					" <- " +
					source +
					" :: " +
					effect.id
			);
			const canOoze = ["drain", "leechseed", "strengthsap"];
			if (canOoze.includes(effect.id)) {
				this.damage(damage);
				return 0;
			}
		},
		name: "Liquid Ooze",
		rating: 2.5,
		num: 64,
	},
	liquidvoice: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			if (move.flags["sound"] && !pokemon.volatiles["dynamax"]) {
				// hardcode
				move.type = "Water";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"]) {
				return this.chainModify(1.2);
			}
		},
		name: "Liquid Voice",
		rating: 1.5,
		num: 204,
	},
	longreach: {
		onModifyMove(move) {
			if (move.flags["contact"]) delete move.flags["contact"];
			else if (move.category === 'Physical') this.chainModify(1.2);
		},
		name: "Long Reach",
		rating: 1,
		num: 203,
	},
	magicbounce: {
		name: "Magic Bounce",
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (
				target === source ||
				move.hasBounced ||
				!move.flags["reflectable"]
			) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.actions.useMove(newMove, target, source);
			return null;
		},
		onAllyTryHitSide(target, source, move) {
			if (
				target.isAlly(source) ||
				move.hasBounced ||
				!move.flags["reflectable"]
			) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.actions.useMove(newMove, this.effectState.target, source);
			return null;
		},
		condition: {
			duration: 1,
		},
		isBreakable: true,
		rating: 4,
		num: 156,
	},
	magicguard: {
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== "Move") {
				if (effect.effectType === "Ability") { this.add("-activate", source, "ability: " + effect.name); }
				return false;
			}
		},
		name: "Magic Guard",
		rating: 4,
		num: 98,
	},
	magician: {
		onAfterMoveSecondarySelf(source, target, move) {
			if (!move || !target || source.switchFlag === true) return;
			if (target !== source && move.category !== "Status") {
				if (source.item || source.volatiles["gem"] || move.id === "fling") { return; }
				const yourItem = target.takeItem(source);
				if (!yourItem) return;
				if (!source.setItem(yourItem)) {
					target.item = yourItem.id; // bypass setItem so we don't break choicelock or anything
					return;
				}
				this.add(
					"-item",
					source,
					yourItem,
					"[from] ability: Magician",
					"[of] " + target
				);
			}
		},
		name: "Magician",
		rating: 1,
		num: 170,
	},
	magmaarmor: {
		onUpdate(pokemon) {
			if (pokemon.status === "frz") {
				this.add("-activate", pokemon, "ability: Magma Armor");
				pokemon.cureStatus();
			}
		},
		onImmunity(type, pokemon) {
			if (type === "frz") return false;
		},
		isBreakable: true,
		name: "Magma Armor",
		rating: 0.5,
		num: 40,
	},
	magnetpull: {
		onFoeTrapPokemon(pokemon) {
			if (
				pokemon.hasType("Steel") &&
				pokemon.isAdjacent(this.effectState.target)
			) {
				pokemon.tryTrap(true);
			}
		},
		onFoeMaybeTrapPokemon(pokemon, source) {
			if (!source) source = this.effectState.target;
			if (!source || !pokemon.isAdjacent(source)) return;
			if (!pokemon.knownType || pokemon.hasType("Steel")) {
				pokemon.maybeTrapped = true;
			}
		},
		name: "Magnet Pull",
		rating: 4,
		num: 42,
	},
	marvelscale: {
		onModifyDefPriority: 6,
		onModifyDef(def, pokemon) {
			if (pokemon.status) {
				return this.chainModify(1.5);
			}
		},
		isBreakable: true,
		name: "Marvel Scale",
		rating: 2.5,
		num: 63,
	},
	megalauncher: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["pulse"]) {
				return this.chainModify(1.5);
			}
		},
		name: "Mega Launcher",
		rating: 3,
		num: 178,
	},
	merciless: {
		onModifyCritRatio(critRatio, source, target) {
			if (target && ["psn", "tox"].includes(target.status)) return 5;
		},
		name: "Merciless",
		rating: 1.5,
		num: 196,
	},
	mimicry: {
		onStart(pokemon) {
			this.singleEvent(
				"TerrainChange",
				this.effect,
				this.effectState,
				pokemon
			);
		},
		onTerrainChange(pokemon) {
			let types;
			switch (this.field.terrain) {
			case "electricterrain":
				types = ["Electric"];
				break;
			case "grassyterrain":
				types = ["Grass"];
				break;
			case "mistyterrain":
				types = ["Fairy"];
				break;
			case "psychicterrain":
				types = ["Psychic"];
				break;
			default:
				types = pokemon.baseSpecies.types;
			}
			const oldTypes = pokemon.getTypes();
			if (oldTypes.join() === types.join() || !pokemon.setType(types)) { return; }
			if (this.field.terrain || pokemon.transformed) {
				this.add(
					"-start",
					pokemon,
					"typechange",
					types.join("/"),
					"[from] ability: Mimicry"
				);
				if (!this.field.terrain) {
					this.hint(
						"Transform Mimicry changes you to your original un-transformed types."
					);
				}
			} else {
				this.add("-activate", pokemon, "ability: Mimicry");
				this.add("-end", pokemon, "typechange", "[silent]");
			}
		},
		name: "Mimicry",
		rating: 0,
		num: 250,
	},
	minus: {
		onModifySpAPriority: 5,
		onModifySpA(spa, pokemon) {
			for (const allyActive of pokemon.allies()) {
				if (allyActive.hasAbility(["minus", "plus"])) {
					return this.chainModify(1.5);
				}
			}
		},
		name: "Minus",
		rating: 0,
		num: 58,
	},
	mirrorarmor: {
		onTryBoost(boost, target, source, effect) {
			// Don't bounce self stat changes, or boosts that have already bounced
			if (
				!source ||
				target === source ||
				!boost ||
				effect.name === "Mirror Armor"
			) { return; }
			let b: BoostID;
			for (b in boost) {
				if (boost[b]! < 0) {
					if (target.boosts[b] === -6) continue;
					const negativeBoost: SparseBoostsTable = {};
					negativeBoost[b] = boost[b];
					delete boost[b];
					if (source.hp) {
						this.add("-ability", target, "Mirror Armor");
						this.boost(negativeBoost, source, target, null, true);
					}
				}
			}
		},
		isBreakable: true,
		name: "Mirror Armor",
		rating: 2,
		num: 240,
	},
	mistysurge: {
		onStart(source) {
			this.field.setTerrain("mistyterrain");
		},
		name: "Misty Surge",
		rating: 3.5,
		num: 228,
	},
	moldbreaker: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Mold Breaker");
		},
		onModifyMove(move) {
			move.ignoreAbility = true;
		},
		name: "Mold Breaker",
		rating: 3,
		num: 104,
	},
	moody: {
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			let stats: BoostID[] = [];
			const boost: SparseBoostsTable = {};
			let statPlus: BoostID;
			for (statPlus in pokemon.boosts) {
				if (statPlus === "accuracy" || statPlus === "evasion") continue;
				if (pokemon.boosts[statPlus] < 6) {
					stats.push(statPlus);
				}
			}
			let randomStat: BoostID | undefined = stats.length ?
				this.sample(stats) :
				undefined;
			if (randomStat) boost[randomStat] = 2;

			stats = [];
			let statMinus: BoostID;
			for (statMinus in pokemon.boosts) {
				if (statMinus === "accuracy" || statMinus === "evasion") continue;
				if (pokemon.boosts[statMinus] > -6 && statMinus !== randomStat) {
					stats.push(statMinus);
				}
			}
			randomStat = stats.length ? this.sample(stats) : undefined;
			if (randomStat) boost[randomStat] = -1;

			this.boost(boost, pokemon, pokemon);
		},
		name: "Moody",
		rating: 5,
		num: 141,
	},
	motordrive: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Electric") {
				if (!this.boost({spe: 1})) {
					this.add("-immune", target, "[from] ability: Motor Drive");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Motor Drive",
		rating: 3,
		num: 78,
	},
	moxie: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({atk: length}, source);
			}
		},
		name: "Moxie",
		rating: 3,
		num: 153,
	},
	multiscale: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.hp >= target.maxhp) {
				this.debug("Multiscale weaken");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Multiscale",
		rating: 3.5,
		num: 136,
	},
	multitype: {
		// Multitype's type-changing itself is implemented in statuses.js
		isPermanent: true,
		name: "Multitype",
		rating: 4,
		num: 121,
	},
	mummy: {
		name: "Mummy",
		onDamagingHit(damage, target, source, move) {
			const sourceAbility = source.getAbility();
			if (sourceAbility.isPermanent || sourceAbility.id === "mummy") {
				return;
			}
			if (
				this.checkMoveMakesContact(
					move,
					source,
					target,
					!source.isAlly(target)
				)
			) {
				const oldAbility = source.setAbility("mummy", target);
				if (oldAbility) {
					this.add(
						"-activate",
						target,
						"ability: Mummy",
						this.dex.abilities.get(oldAbility).name,
						"[of] " + source
					);
				}
			}
		},
		rating: 2,
		num: 152,
	},
	myceliummight: {
		onFractionalPriorityPriority: -1,
		onFractionalPriority(priority, pokemon, target, move) {
			if (move.category === "Status") {
				return -0.1;
			}
		},
		onModifyMove(move) {
			if (move.category === "Status") {
				move.ignoreAbility = true;
			}
		},
		name: "Mycelium Might",
		rating: 2,
		num: 298,
	},
	naturalcure: {
		onCheckShow(pokemon) {
			// This is complicated
			// For the most part, in-game, it's obvious whether or not Natural Cure activated,
			// since you can see how many of your opponent's pokemon are statused.
			// The only ambiguous situation happens in Doubles/Triples, where multiple pokemon
			// that could have Natural Cure switch out, but only some of them get cured.
			if (pokemon.side.active.length === 1) return;
			if (pokemon.showCure === true || pokemon.showCure === false) return;

			const cureList = [];
			let noCureCount = 0;
			for (const curPoke of pokemon.side.active) {
				// pokemon not statused
				if (!curPoke?.status) {
					// this.add('-message', "" + curPoke + " skipped: not statused or doesn't exist");
					continue;
				}
				if (curPoke.showCure) {
					// this.add('-message', "" + curPoke + " skipped: Natural Cure already known");
					continue;
				}
				const species = curPoke.species;
				// pokemon can't get Natural Cure
				if (!Object.values(species.abilities).includes("Natural Cure")) {
					// this.add('-message', "" + curPoke + " skipped: no Natural Cure");
					continue;
				}
				// pokemon's ability is known to be Natural Cure
				if (!species.abilities["1"] && !species.abilities["H"]) {
					// this.add('-message', "" + curPoke + " skipped: only one ability");
					continue;
				}
				// pokemon isn't switching this turn
				if (curPoke !== pokemon && !this.queue.willSwitch(curPoke)) {
					// this.add('-message', "" + curPoke + " skipped: not switching");
					continue;
				}

				if (curPoke.hasAbility("naturalcure")) {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (and is)");
					cureList.push(curPoke);
				} else {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (but isn't)");
					noCureCount++;
				}
			}

			if (!cureList.length || !noCureCount) {
				// It's possible to know what pokemon were cured
				for (const pkmn of cureList) {
					pkmn.showCure = true;
				}
			} else {
				// It's not possible to know what pokemon were cured

				// Unlike a -hint, this is real information that battlers need, so we use a -message
				this.add(
					"-message",
					"(" +
						cureList.length +
						" of " +
						pokemon.side.name +
						"'s pokemon " +
						(cureList.length === 1 ? "was" : "were") +
						" cured by Natural Cure.)"
				);

				for (const pkmn of cureList) {
					pkmn.showCure = false;
				}
			}
		},
		onSwitchOut(pokemon) {
			if (!pokemon.status) return;

			// if pokemon.showCure is undefined, it was skipped because its ability
			// is known
			if (pokemon.showCure === undefined) pokemon.showCure = true;

			if (pokemon.showCure) {
				this.add(
					"-curestatus",
					pokemon,
					pokemon.status,
					"[from] ability: Natural Cure"
				);
			}
			pokemon.clearStatus();

			// only reset .showCure if it's false
			// (once you know a Pokemon has Natural Cure, its cures are always known)
			if (!pokemon.showCure) pokemon.showCure = undefined;
		},
		name: "Natural Cure",
		rating: 2.5,
		num: 30,
	},
	neuroforce: {
		onModifyDamage(damage, source, target, move) {
			if (move && target.getMoveHitData(move).typeMod > 0) {
				return this.chainModify([5120, 4096]);
			}
		},
		name: "Neuroforce",
		rating: 2.5,
		num: 233,
	},
	neutralizinggas: {
		// Ability suppression implemented in sim/pokemon.ts:Pokemon#ignoringAbility
		onPreStart(pokemon) {
			if (pokemon.transformed) return;
			this.add("-ability", pokemon, "Neutralizing Gas");
			pokemon.abilityState.ending = false;
			const strongWeathers = [
				"desolateland",
				"primordialsea",
				"deltastream",
			];
			for (const target of this.getAllActive()) {
				if (target.hasItem("Ability Shield")) {
					this.add("-block", target, "item: Ability Shield");
					continue;
				}
				if (target.illusion) {
					this.singleEvent(
						"End",
						this.dex.abilities.get("Illusion"),
						target.abilityState,
						target,
						pokemon,
						"neutralizinggas"
					);
				}
				if (target.volatiles["slowstart"]) {
					delete target.volatiles["slowstart"];
					this.add("-end", target, "Slow Start", "[silent]");
				}
				if (strongWeathers.includes(target.getAbility().id)) {
					this.singleEvent(
						"End",
						this.dex.abilities.get(target.getAbility().id),
						target.abilityState,
						target,
						pokemon,
						"neutralizinggas"
					);
				}
			}
		},
		onEnd(source) {
			if (source.transformed) return;
			for (const pokemon of this.getAllActive()) {
				if (pokemon !== source && pokemon.hasAbility("Neutralizing Gas")) {
					return;
				}
			}
			this.add("-end", source, "ability: Neutralizing Gas");

			// FIXME this happens before the pokemon switches out, should be the opposite order.
			// Not an easy fix since we cant use a supported event. Would need some kind of special event that
			// gathers events to run after the switch and then runs them when the ability is no longer accessible.
			// (If you're tackling this, do note extreme weathers have the same issue)

			// Mark this pokemon's ability as ending so Pokemon#ignoringAbility skips it
			if (source.abilityState.ending) return;
			source.abilityState.ending = true;
			const sortedActive = this.getAllActive();
			this.speedSort(sortedActive);
			for (const pokemon of sortedActive) {
				if (pokemon !== source) {
					if (pokemon.getAbility().isPermanent) continue; // does not interact with e.g Ice Face, Zen Mode

					// Will be suppressed by Pokemon#ignoringAbility if needed
					this.singleEvent(
						"Start",
						pokemon.getAbility(),
						pokemon.abilityState,
						pokemon
					);
					if (pokemon.ability === "gluttony") {
						pokemon.abilityState.gluttony = false;
					}
				}
			}
		},
		name: "Neutralizing Gas",
		rating: 4,
		num: 256,
	},
	noguard: {
		onAnyInvulnerabilityPriority: 1,
		onAnyInvulnerability(target, source, move) {
			if (
				move &&
				(source === this.effectState.target ||
					target === this.effectState.target)
			) { return 0; }
		},
		onAnyAccuracy(accuracy, target, source, move) {
			if (
				move &&
				(source === this.effectState.target ||
					target === this.effectState.target)
			) {
				return true;
			}
			return accuracy;
		},
		name: "No Guard",
		rating: 4,
		num: 99,
	},
	normalize: {
		onModifyTypePriority: 1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"hiddenpower",
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"struggle",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				!(move.isZ && move.category !== "Status") &&
				!noModifyType.includes(move.id) &&
				// TODO: Figure out actual interaction
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Normal";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		onModifyMove(move) {
			const baseEffectiveness = move.onEffectiveness;
			move.onEffectiveness = (effectiveness, target, type, usedMove) => {
				const otherResult = baseEffectiveness?.apply(this, [effectiveness, target, type, usedMove]);
				if (otherResult === 1) return otherResult;
				if (effectiveness < 0) effectiveness = 0;
				return effectiveness;
			};
		},
		name: "Normalize",
		rating: 0,
		num: 96,
	},
	oblivious: {
		onUpdate(pokemon) {
			if (pokemon.volatiles["attract"]) {
				this.add("-activate", pokemon, "ability: Oblivious");
				pokemon.removeVolatile("attract");
				this.add(
					"-end",
					pokemon,
					"move: Attract",
					"[from] ability: Oblivious"
				);
			}
			if (pokemon.volatiles["taunt"]) {
				this.add("-activate", pokemon, "ability: Oblivious");
				pokemon.removeVolatile("taunt");
				// Taunt's volatile already sends the -end message when removed
			}
		},
		onImmunity(type, pokemon) {
			if (type === "attract") return false;
		},
		onTryHit(pokemon, target, move) {
			if (
				move.id === "attract" ||
				move.id === "captivate" ||
				move.id === "taunt"
			) {
				this.add("-immune", pokemon, "[from] ability: Oblivious");
				return null;
			}
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Oblivious",
					"[of] " + target
				);
			}
		},
		isBreakable: true,
		name: "Oblivious",
		rating: 1.5,
		num: 12,
	},
	opportunist: {
		onFractionalPriority(priority, source, target, move) {
			if (
				(move.category === "Status" &&
					source.hasAbility("myceliummight")) ||
				!target
			) { return; } // Just in case this happens
			if (target.hp && target.hp <= target.maxhp / 2) {
				this.add("-activate", source, "ability: Expert Hunter");
				return 0.1;
			}
		},
		name: "Opportunist",
		rating: 3,
		num: 290,
	},
	orichalcumpulse: {
		onStart(pokemon) {
			if (this.field.setWeather("sunnyday")) {
				this.add("-activate", pokemon, "Orichalcum Pulse", "[source]");
			} else if (this.field.isWeather("sunnyday")) {
				this.add("-activate", pokemon, "ability: Orichalcum Pulse");
			}
		},
		onModifyAtkPriority: 5,
		onModifyAtk(atk, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				this.debug("Orichalcum boost");
				return this.chainModify([5461, 4096]);
			}
		},
		isPermanent: true,
		name: "Orichalcum Pulse",
		rating: 4.5,
		num: 288,
	},
	overcoat: {
		onImmunity(type, pokemon) {
			if (type === "sandstorm" || type === "hail" || type === "powder") { return false; }
		},
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (
				move.flags["powder"] &&
				target !== source &&
				this.dex.getImmunity("powder", target)
			) {
				this.add("-immune", target, "[from] ability: Overcoat");
				return null;
			}
		},
		isBreakable: true,
		name: "Overcoat",
		rating: 2,
		num: 142,
	},
	overgrow: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Grass" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Overgrow boost");
				return this.chainModify(1.5);
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, attacker, defender, move) {
			if (move.type === "Grass" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Overgrow boost");
				return this.chainModify(1.5);
			}
		},
		name: "Overgrow",
		rating: 2,
		num: 65,
	},
	owntempo: {
		onUpdate(pokemon) {
			if (pokemon.volatiles["confusion"]) {
				this.add("-activate", pokemon, "ability: Own Tempo");
				pokemon.removeVolatile("confusion");
			}
		},
		onTryAddVolatile(status, pokemon) {
			if (status.id === "confusion") return null;
		},
		onHit(target, source, move) {
			if (move?.volatileStatus === "confusion") {
				this.add(
					"-immune",
					target,
					"confusion",
					"[from] ability: Own Tempo"
				);
			}
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Own Tempo",
					"[of] " + target
				);
			}
		},
		isBreakable: true,
		name: "Own Tempo",
		rating: 1.5,
		num: 20,
	},
	parentalbond: {
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			move.multihit = 2;
			move.multihitType = "parentalbond";
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "parentalbond") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Parental Bond",
		rating: 4.5,
		num: 185,
	},
	pastelveil: {
		onStart(pokemon) {
			for (const ally of pokemon.alliesAndSelf()) {
				if (["psn", "tox"].includes(ally.status)) {
					this.add("-activate", pokemon, "ability: Pastel Veil");
					ally.cureStatus();
				}
			}
		},
		onUpdate(pokemon) {
			if (["psn", "tox"].includes(pokemon.status)) {
				this.add("-activate", pokemon, "ability: Pastel Veil");
				pokemon.cureStatus();
			}
		},
		onAllySwitchIn(pokemon) {
			if (["psn", "tox"].includes(pokemon.status)) {
				this.add(
					"-activate",
					this.effectState.target,
					"ability: Pastel Veil"
				);
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (!["psn", "tox"].includes(status.id)) return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Pastel Veil");
			}
			return false;
		},
		onAllySetStatus(status, target, source, effect) {
			if (!["psn", "tox"].includes(status.id)) return;
			if ((effect as Move)?.status) {
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Pastel Veil",
					"[of] " + effectHolder
				);
			}
			return false;
		},
		isBreakable: true,
		name: "Pastel Veil",
		rating: 2,
		num: 257,
	},
	perishbody: {
		onDamagingHit(damage, target, source, move) {
			if (!this.checkMoveMakesContact(move, source, target)) return;

			let announced = false;
			for (const pokemon of [target, source]) {
				if (pokemon.volatiles["perishsong"]) continue;
				if (!announced) {
					this.add("-ability", target, "Perish Body");
					announced = true;
				}
				pokemon.addVolatile("perishsong");
			}
		},
		name: "Perish Body",
		rating: 1,
		num: 253,
	},
	pickpocket: {
		onAfterMoveSecondary(target, source, move) {
			if (source && source !== target && move?.flags["contact"]) {
				if (
					target.item ||
					target.switchFlag ||
					target.forceSwitchFlag ||
					source.switchFlag === true
				) {
					return;
				}
				const yourItem = source.takeItem(target);
				if (!yourItem) {
					return;
				}
				if (!target.setItem(yourItem)) {
					source.item = yourItem.id;
					return;
				}
				this.add(
					"-enditem",
					source,
					yourItem,
					"[silent]",
					"[from] ability: Pickpocket",
					"[of] " + source
				);
				this.add(
					"-item",
					target,
					yourItem,
					"[from] ability: Pickpocket",
					"[of] " + source
				);
			}
		},
		name: "Pickpocket",
		rating: 1,
		num: 124,
	},
	pickup: {
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (pokemon.item) return;
			const pickupTargets = this.getAllActive().filter(
				(target) =>
					target.lastItem &&
					target.usedItemThisTurn &&
					pokemon.isAdjacent(target)
			);
			if (!pickupTargets.length) return;
			const randomTarget = this.sample(pickupTargets);
			const item = randomTarget.lastItem;
			randomTarget.lastItem = "";
			this.add(
				"-item",
				pokemon,
				this.dex.items.get(item),
				"[from] ability: Pickup"
			);
			pokemon.setItem(item);
		},
		name: "Pickup",
		rating: 0.5,
		num: 53,
	},
	pixilate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Fairy";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Pixilate",
		rating: 4,
		num: 182,
	},
	plus: {
		onModifySpAPriority: 5,
		onModifySpA(spa, pokemon) {
			for (const allyActive of pokemon.allies()) {
				if (allyActive.hasAbility(["minus", "plus"])) {
					return this.chainModify(1.5);
				}
			}
		},
		name: "Plus",
		rating: 0,
		num: 57,
	},
	poisonheal: {
		onDamagePriority: 1,
		onDamage(damage, target, source, effect) {
			if (effect.id === "psn" || effect.id === "tox") {
				this.heal(target.baseMaxhp / 8);
				return false;
			}
		},
		name: "Poison Heal",
		rating: 4,
		num: 90,
	},
	poisonpoint: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.trySetStatus("psn", target);
				}
			}
		},
		onModifyMove(move) {
			if (!move?.flags["contact"] || move.target === "self") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 30,
				status: "psn",
				ability: this.dex.abilities.get("poisonpoint"),
			});
		},
		name: "Poison Point",
		rating: 1.5,
		num: 38,
	},
	poisontouch: {
		// upokecenter says this is implemented as an added secondary effect
		onModifyMove(move) {
			if (!move?.flags["contact"] || move.target === "self") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 30,
				status: "psn",
				ability: this.dex.abilities.get("poisontouch"),
			});
		},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.trySetStatus("psn", target);
				}
			}
		},
		name: "Poison Touch",
		rating: 2,
		num: 143,
	},
	powerconstruct: {
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Zygarde" ||
				pokemon.transformed ||
				!pokemon.hp
			) { return; }
			if (
				pokemon.species.id === "zygardecomplete" ||
				pokemon.hp > pokemon.maxhp / 2
			) { return; }
			this.add("-activate", pokemon, "ability: Power Construct");
			pokemon.formeChange("Zygarde-Complete", this.effect, true);
			pokemon.baseMaxhp = Math.floor(
				(Math.floor(
					2 * pokemon.species.baseStats["hp"] +
						pokemon.set.ivs["hp"] +
						Math.floor(pokemon.set.evs["hp"] / 4) +
						100
				) *
					pokemon.level) /
					100 +
					10
			);
			const newMaxHP = pokemon.volatiles["dynamax"] ?
				2 * pokemon.baseMaxhp :
				pokemon.baseMaxhp;
			pokemon.hp = newMaxHP - (pokemon.maxhp - pokemon.hp);
			pokemon.maxhp = newMaxHP;
			this.add("-heal", pokemon, pokemon.getHealth, "[silent]");
		},
		isPermanent: true,
		name: "Power Construct",
		rating: 5,
		num: 211,
	},
	powerofalchemy: {
		onStart(pokemon) {
			for (const foe of pokemon.foes()) {
				if (foe.item === 'bignugget' || !foe.item) continue;
				const taken = foe.takeItem(pokemon);
				if (!taken) continue;
				if (taken.id === 'blacksludge') {
					foe.setItem('bignugget');
				} else {
					foe.setItem('blacksludge');
				}
				this.add(
					"-item",
					foe,
					foe.getItem(),
					"[from] ability: Power of Alchemy"
				);
				return;
			}
		},
		name: "Power of Alchemy",
		rating: 0,
		num: 223,
	},
	powerspot: {
		onAllyModifyDamage(basePower, attacker, defender, move) {
			if (attacker !== this.effectState.target) {
				this.debug("Power Spot boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Power Spot",
		rating: 0,
		num: 249,
	},
	prankster: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.category === "Status") {
				move.pranksterBoosted = true;
				return priority + 1;
			}
		},
		name: "Prankster",
		rating: 4,
		num: 158,
	},
	pressure: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Pressure");
			this.add('-clearallboost');

			for (const active of this.getAllActive()) {
				for (const boostName in active.boosts) {
					if (active === pokemon) {
						active.boosts[boostName as BoostID] = Math.max(0, active.boosts[boostName as BoostID]);
					} else {
						active.boosts[boostName as BoostID] = Math.min(0, active.boosts[boostName as BoostID]);
					}
				}
				active.clearBoosts();
			}
		},
		name: "Pressure",
		rating: 2.5,
		num: 46,
	},
	primordialsea: {
		onStart(source) {
			this.field.setWeather("primordialsea");
		},
		onAnySetWeather(target, source, weather) {
			const strongWeathers = [
				"desolateland",
				"primordialsea",
				"deltastream",
			];
			if (
				this.field.getWeather().id === "primordialsea" &&
				!strongWeathers.includes(weather.id)
			) { return false; }
		},
		onEnd(pokemon) {
			if (this.field.weatherState.source !== pokemon) return;
			for (const target of this.getAllActive()) {
				if (target === pokemon) continue;
				if (target.hasAbility("primordialsea")) {
					this.field.weatherState.source = target;
					return;
				}
			}
			this.field.clearWeather();
		},
		name: "Primordial Sea",
		rating: 4.5,
		num: 189,
	},
	prismarmor: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) {
				this.debug("Prism Armor neutralize");
				return this.chainModify(0.65);
			}
		},
		name: "Prism Armor",
		rating: 3,
		num: 232,
	},
	propellertail: {
		onModifyMovePriority: 1,
		onModifyMove(move) {
			// most of the implementation is in Battle#getTarget
			move.tracksTarget = move.target !== "scripted";
		},
		name: "Propeller Tail",
		rating: 0,
		num: 239,
	},
	protean: {
		onPrepareHit(source, target, move) {
			if (this.effectState.protean) return;
			if (
				move.hasBounced ||
				move.flags["futuremove"] ||
				move.sourceEffect === "snatch"
			) { return; }
			const type = move.type;
			if (type && type !== "???" && source.getTypes().join() !== type) {
				if (!source.setType(type)) return;
				this.effectState.protean = true;
				this.add(
					"-start",
					source,
					"typechange",
					type,
					"[from] ability: Protean"
				);
			}
		},
		onSwitchIn(pokemon) {
			delete this.effectState.protean;
		},
		name: "Protean",
		rating: 4,
		num: 168,
	},
	protosynthesis: {
		onStart(pokemon) {
			this.singleEvent(
				"WeatherChange",
				this.effect,
				this.effectState,
				pokemon
			);
		},
		onWeatherChange(pokemon) {
			if (pokemon.transformed) return;
			// Protosynthesis is not affected by Utility Umbrella
			if (this.field.isWeather("sunnyday")) {
				pokemon.addVolatile("protosynthesis");
			} else if (!pokemon.volatiles["protosynthesis"]?.fromBooster) {
				pokemon.removeVolatile("protosynthesis");
			}
		},
		onEnd(pokemon) {
			delete pokemon.volatiles["protosynthesis"];
			this.add("-end", pokemon, "Protosynthesis", "[silent]");
		},
		condition: {
			noCopy: true,
			onStart(pokemon, source, effect) {
				if (effect?.id === "boosterenergy") {
					this.effectState.fromBooster = true;
					this.add(
						"-activate",
						pokemon,
						"ability: Protosynthesis",
						"[fromitem]"
					);
				} else {
					this.add("-activate", pokemon, "ability: Protosynthesis");
				}
				this.effectState.bestStat = pokemon.getBestStat(false, true);
				this.add(
					"-start",
					pokemon,
					"protosynthesis" + this.effectState.bestStat
				);
			},
			onModifyAtkPriority: 5,
			onModifyAtk(atk, source, target, move) {
				if (this.effectState.bestStat !== "atk") return;
				this.debug("Protosynthesis atk boost");
				return this.chainModify([5325, 4096]);
			},
			onModifyDefPriority: 6,
			onModifyDef(def, target, source, move) {
				if (this.effectState.bestStat !== "def") return;
				this.debug("Protosynthesis def boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpAPriority: 5,
			onModifySpA(relayVar, source, target, move) {
				if (this.effectState.bestStat !== "spa") return;
				this.debug("Protosynthesis spa boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpDPriority: 6,
			onModifySpD(relayVar, target, source, move) {
				if (this.effectState.bestStat !== "spd") return;
				this.debug("Protosynthesis spd boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpe(spe, pokemon) {
				if (this.effectState.bestStat !== "spe") return;
				this.debug("Protosynthesis spe boost");
				return this.chainModify(1.5);
			},
			onEnd(pokemon) {
				this.add("-end", pokemon, "Protosynthesis");
			},
		},
		isPermanent: true,
		name: "Protosynthesis",
		rating: 3,
		num: 281,
	},
	psychicsurge: {
		onStart(source) {
			this.field.setTerrain("psychicterrain");
		},
		name: "Psychic Surge",
		rating: 4,
		num: 227,
	},
	punkrock: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"]) {
				this.debug("Punk Rock boost");
				return this.chainModify([5325, 4096]);
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.flags["sound"]) {
				this.debug("Punk Rock weaken");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Punk Rock",
		rating: 3.5,
		num: 244,
	},
	purepower: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(2);
		},
		name: "Pure Power",
		rating: 5,
		num: 74,
	},
	purifyingsalt: {
		onSetStatus(status, target, source, effect) {
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Purifying Salt");
			}
			return false;
		},
		onTryAddVolatile(status, target) {
			if (status.id === "yawn") {
				this.add("-immune", target, "[from] ability: Purifying Salt");
				return null;
			}
		},
		onSourceModifyAtkPriority: 6,
		onSourceModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Ghost") {
				this.debug("Purifying Salt weaken");
				return this.chainModify(0.5);
			}
		},
		onSourceModifySpAPriority: 5,
		onSourceModifySpA(spa, attacker, defender, move) {
			if (move.type === "Ghost") {
				this.debug("Purifying Salt weaken");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Purifying Salt",
		rating: 4,
		num: 272,
	},
	quarkdrive: {
		onStart(pokemon) {
			this.singleEvent(
				"TerrainChange",
				this.effect,
				this.effectState,
				pokemon
			);
		},
		onTerrainChange(pokemon) {
			if (pokemon.transformed) return;
			if (this.field.isTerrain("electricterrain")) {
				pokemon.addVolatile("quarkdrive");
			} else if (!pokemon.volatiles["quarkdrive"]?.fromBooster) {
				pokemon.removeVolatile("quarkdrive");
			}
		},
		onEnd(pokemon) {
			delete pokemon.volatiles["quarkdrive"];
			this.add("-end", pokemon, "Quark Drive", "[silent]");
		},
		condition: {
			noCopy: true,
			onStart(pokemon, source, effect) {
				if (effect?.id === "boosterenergy") {
					this.effectState.fromBooster = true;
					this.add(
						"-activate",
						pokemon,
						"ability: Quark Drive",
						"[fromitem]"
					);
				} else {
					this.add("-activate", pokemon, "ability: Quark Drive");
				}
				this.effectState.bestStat = pokemon.getBestStat(false, true);
				this.add(
					"-start",
					pokemon,
					"quarkdrive" + this.effectState.bestStat
				);
			},
			onModifyAtkPriority: 5,
			onModifyAtk(atk, source, target, move) {
				if (this.effectState.bestStat !== "atk") return;
				this.debug("Quark Drive atk boost");
				return this.chainModify([5325, 4096]);
			},
			onModifyDefPriority: 6,
			onModifyDef(def, target, source, move) {
				if (this.effectState.bestStat !== "def") return;
				this.debug("Quark Drive def boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpAPriority: 5,
			onModifySpA(relayVar, source, target, move) {
				if (this.effectState.bestStat !== "spa") return;
				this.debug("Quark Drive spa boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpDPriority: 6,
			onModifySpD(relayVar, target, source, move) {
				if (this.effectState.bestStat !== "spd") return;
				this.debug("Quark Drive spd boost");
				return this.chainModify([5325, 4096]);
			},
			onModifySpe(spe, pokemon) {
				if (this.effectState.bestStat !== "spe") return;
				this.debug("Quark Drive spe boost");
				return this.chainModify(1.5);
			},
			onEnd(pokemon) {
				this.add("-end", pokemon, "Quark Drive");
			},
		},
		isPermanent: true,
		name: "Quark Drive",
		rating: 3,
		num: 282,
	},
	queenlymajesty: {
		onFoeTryMove(target, source, move) {
			const targetAllExceptions = [
				"perishsong",
				"flowershield",
				"rototiller",
			];
			if (
				move.target === "foeSide" ||
				(move.target === "all" && !targetAllExceptions.includes(move.id))
			) {
				return;
			}

			const dazzlingHolder = this.effectState.target;
			if (
				(source.isAlly(dazzlingHolder) || move.target === "all") &&
				move.priority > 0.1
			) {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					dazzlingHolder,
					"ability: Queenly Majesty",
					move,
					"[of] " + target
				);
				return false;
			}
		},
		isBreakable: true,
		name: "Queenly Majesty",
		rating: 2.5,
		num: 214,
	},
	quickdraw: {
		onFractionalPriorityPriority: -1,
		onFractionalPriority(priority, pokemon, target, move) {
			if (move.category !== "Status" && this.randomChance(3, 10)) {
				this.add("-activate", pokemon, "ability: Quick Draw");
				return 0.1;
			}
		},
		name: "Quick Draw",
		rating: 2.5,
		num: 259,
	},
	quickfeet: {
		onModifySpe(spe, pokemon) {
			if (pokemon.status) {
				return this.chainModify(1.5);
			}
		},
		name: "Quick Feet",
		rating: 2.5,
		num: 95,
	},
	raindish: {
		onWeather(target, source, effect) {
			if (target.hasItem("utilityumbrella")) return;
			if (effect.id === "raindance" || effect.id === "primordialsea") {
				this.heal(target.baseMaxhp / 16);
			}
		},
		name: "Rain Dish",
		rating: 1.5,
		num: 44,
	},
	rattled: {
		onDamagingHit(damage, target, source, move) {
			if (["Dark", "Bug", "Ghost"].includes(move.type)) {
				this.boost({spe: 1});
			}
		},
		onFlinch(pokemon) {
			this.boost({spe: 1});
		},
		name: "Rattled",
		rating: 1,
		num: 155,
	},
	receiver: {
		onAllyFaint(target) {
			if (!this.effectState.target.hp) return;
			const ability = target.getAbility();
			const additionalBannedAbilities = [
				"noability",
				"flowergift",
				"forecast",
				"hungerswitch",
				"illusion",
				"imposter",
				"neutralizinggas",
				"powerofalchemy",
				"receiver",
				"trace",
				"wonderguard",
			];
			if (
				target.getAbility().isPermanent ||
				additionalBannedAbilities.includes(target.ability)
			) { return; }
			if (this.effectState.target.setAbility(ability)) {
				this.add(
					"-ability",
					this.effectState.target,
					ability,
					"[from] ability: Receiver",
					"[of] " + target
				);
			}
		},
		name: "Receiver",
		rating: 0,
		num: 222,
	},
	reckless: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.recoil || move.hasCrashDamage) {
				this.debug("Reckless boost");
				return this.chainModify([4915, 4096]);
			}
		},
		name: "Reckless",
		rating: 3,
		num: 120,
	},
	refrigerate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Ice";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Refrigerate",
		rating: 4,
		num: 174,
	},
	regenerator: {
		onSwitchOut(pokemon) {
			if (pokemon.status === "bld") return;
			if (pokemon.foes().some(it => it.hasAbility("permanence"))) return;
			pokemon.heal(pokemon.baseMaxhp / 3);
		},
		name: "Regenerator",
		rating: 4.5,
		num: 144,
	},
	ripen: {
		onTryHeal(damage, target, source, effect) {
			if (!effect) return;
			if (effect.name === "Berry Juice" || effect.name === "Leftovers") {
				this.add("-activate", target, "ability: Ripen");
			}
			if ((effect as Item).isBerry) return this.chainModify(2);
		},
		onChangeBoost(boost, target, source, effect) {
			if (effect && (effect as Item).isBerry) {
				let b: BoostID;
				for (b in boost) {
					boost[b]! *= 2;
				}
			}
		},
		onSourceModifyDamagePriority: -1,
		onSourceModifyDamage(damage, source, target, move) {
			if (target.abilityState.berryWeaken) {
				target.abilityState.berryWeaken = false;
				return this.chainModify(0.5);
			}
		},
		onTryEatItemPriority: -1,
		onTryEatItem(item, pokemon) {
			this.add("-activate", pokemon, "ability: Ripen");
		},
		onEatItem(item, pokemon) {
			const weakenBerries = [
				"Babiri Berry",
				"Charti Berry",
				"Chilan Berry",
				"Chople Berry",
				"Coba Berry",
				"Colbur Berry",
				"Haban Berry",
				"Kasib Berry",
				"Kebia Berry",
				"Occa Berry",
				"Passho Berry",
				"Payapa Berry",
				"Rindo Berry",
				"Roseli Berry",
				"Shuca Berry",
				"Tanga Berry",
				"Wacan Berry",
				"Yache Berry",
			];
			// Record if the pokemon ate a berry to resist the attack
			pokemon.abilityState.berryWeaken = weakenBerries.includes(item.name);
		},
		name: "Ripen",
		rating: 2,
		num: 247,
	},
	rivalry: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (attacker.gender && defender.gender) {
				if (attacker.gender === defender.gender) {
					this.debug("Rivalry boost");
					return this.chainModify(1.25);
				} else {
					this.debug("Rivalry weaken");
					return this.chainModify(0.75);
				}
			}
		},
		name: "Rivalry",
		rating: 0,
		num: 79,
	},
	rkssystem: {
		// RKS System's type-changing itself is implemented in statuses.js
		onPrepareHit(source, target, move) {
			if (
				move.hasBounced ||
				move.flags["futuremove"] ||
				move.sourceEffect === "snatch"
			) { return; }
			const type = move.type;
			if (type && type !== "???" && source.getTypes().join() !== type) {
				if (!source.setType(type)) return;
				this.add(
					"-start",
					source,
					"typechange",
					type,
					"[from] ability: RKS System"
				);
			}
		},
		onModifyMove(move) {
			move.stab = 2;
		},
		isPermanent: true,
		name: "RKS System",
		rating: 4,
		num: 225,
	},
	rockhead: {
		// Steel beam/Mind blown modifiers in respective moves
		onDamage(damage, target, source, effect) {
			if (effect.id === "recoil") {
				if (!this.activeMove) throw new Error("Battle.activeMove is null");
				if (this.activeMove.id !== "struggle") return null;
			}
		},
		name: "Rock Head",
		rating: 3,
		num: 69,
	},
	rockypayload: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Rock") {
				this.debug("Rocky Payload boost");
				return this.chainModify(1.5);
			}
		},
		name: "Rocky Payload",
		rating: 3.5,
		num: 276,
	},
	roughskin: {
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.damage(source.baseMaxhp / 8, source, target);
			}
		},
		name: "Rough Skin",
		rating: 2.5,
		num: 24,
	},
	runaway: {
		name: "Run Away",
		rating: 0,
		num: 50,
	},
	sandforce: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (this.field.isWeather("sandstorm")) {
				if (
					move.type === "Rock" ||
					move.type === "Ground" ||
					move.type === "Steel"
				) {
					this.debug("Sand Force boost");
					return this.chainModify([5325, 4096]);
				}
			}
		},
		onImmunity(type, pokemon) {
			if (type === "sandstorm") return false;
		},
		name: "Sand Force",
		rating: 2,
		num: 159,
	},
	sandrush: {
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather("sandstorm")) {
				return this.chainModify(2);
			}
		},
		onImmunity(type, pokemon) {
			if (type === "sandstorm") return false;
		},
		name: "Sand Rush",
		rating: 3,
		num: 146,
	},
	sandspit: {
		onDamagingHit(damage, target, source, move) {
			this.field.setWeather("sandstorm");
		},
		name: "Sand Spit",
		rating: 1,
		num: 245,
	},
	sandstream: {
		onStart(source) {
			this.field.setWeather("sandstorm");
		},
		name: "Sand Stream",
		rating: 4,
		num: 45,
	},
	sandveil: {
		onImmunity(type, pokemon) {
			if (type === "sandstorm") return false;
		},
		onModifyAccuracyPriority: -1,
		onModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			if (this.field.isWeather("sandstorm")) {
				this.debug("Sand Veil - decreasing accuracy");
				return this.chainModify([3277, 4096]);
			}
		},
		isBreakable: true,
		name: "Sand Veil",
		rating: 1.5,
		num: 8,
	},
	sapsipper: {
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Grass") {
				if (!this.boost({atk: 1}) && !this.boost({spa: 1})) {
					this.add("-immune", target, "[from] ability: Sap Sipper");
				}
				return null;
			}
		},
		onAllyTryHitSide(target, source, move) {
			if (source === this.effectState.target || !target.isAlly(source)) { return; }
			if (move.type === "Grass") {
				if (
					this.effectState.target.getStat("atk", false, true) >
					this.effectState.target.getStat("spa", false, true)
				) {
					this.boost({atk: 1}, this.effectState.target);
				} else {
					this.boost({spa: 1}, this.effectState.target);
				}
			}
		},
		isBreakable: true,
		name: "Sap Sipper",
		rating: 3,
		num: 157,
	},
	schooling: {
		onStart(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Wishiwashi" ||
				pokemon.level < 20 ||
				pokemon.transformed
			) { return; }
			if (pokemon.hp > pokemon.maxhp / 4) {
				if (pokemon.species.id === "wishiwashi") {
					pokemon.formeChange("Wishiwashi-School");
				}
			} else {
				if (pokemon.species.id === "wishiwashischool") {
					pokemon.formeChange("Wishiwashi");
				}
			}
		},
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Wishiwashi" ||
				pokemon.level < 20 ||
				pokemon.transformed ||
				!pokemon.hp
			) { return; }
			if (pokemon.hp > pokemon.maxhp / 4) {
				if (pokemon.species.id === "wishiwashi") {
					pokemon.formeChange("Wishiwashi-School");
				}
			} else {
				if (pokemon.species.id === "wishiwashischool") {
					pokemon.formeChange("Wishiwashi");
				}
			}
		},
		isPermanent: true,
		name: "Schooling",
		rating: 3,
		num: 208,
	},
	scrappy: {
		onModifyMovePriority: -5,
		onModifyMove(move) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity["Fighting"] = true;
				move.ignoreImmunity["Normal"] = true;
			}
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Scrappy",
					"[of] " + target
				);
			}
		},
		name: "Scrappy",
		rating: 3,
		num: 113,
	},
	screencleaner: {
		onStart(pokemon) {
			let activated = false;
			for (const sideCondition of ["reflect", "lightscreen", "auroraveil", "smokescreen"]) {
				for (const side of [
					pokemon.side,
					...pokemon.side.foeSidesWithConditions(),
				]) {
					if (side.getSideCondition(sideCondition)) {
						if (!activated) {
							this.add("-activate", pokemon, "ability: Screen Cleaner");
							activated = true;
						}
						side.removeSideCondition(sideCondition);
					}
				}
			}
		},
		name: "Screen Cleaner",
		rating: 2,
		num: 251,
	},
	seedsower: {
		onDamagingHit(damage, target, source, move) {
			this.field.setTerrain("grassyterrain");
		},
		name: "Seed Sower",
		rating: 2.5,
		num: 269,
	},
	serenegrace: {
		onModifyMovePriority: -2,
		onModifyMove(move) {
			if (move.secondaries) {
				this.debug("doubling secondary chance");
				for (const secondary of move.secondaries) {
					if (secondary.chance) secondary.chance *= 2;
				}
			}
			if (move.self?.chance) move.self.chance *= 2;
		},
		name: "Serene Grace",
		rating: 3.5,
		num: 32,
	},
	shadowshield: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.hp >= target.maxhp) {
				this.debug("Shadow Shield weaken");
				return this.chainModify(0.5);
			}
		},
		name: "Shadow Shield",
		rating: 3.5,
		num: 231,
	},
	shadowtag: {
		onFoeTrapPokemon(pokemon) {
			if (
				!pokemon.hasAbility("shadowtag") &&
				pokemon.isAdjacent(this.effectState.target)
			) {
				pokemon.tryTrap(true);
			}
		},
		onFoeMaybeTrapPokemon(pokemon, source) {
			if (!source) source = this.effectState.target;
			if (!source || !pokemon.isAdjacent(source)) return;
			if (!pokemon.hasAbility("shadowtag")) {
				pokemon.maybeTrapped = true;
			}
		},
		name: "Shadow Tag",
		rating: 5,
		num: 23,
	},
	sharpness: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				this.debug("Shapness boost");
				return this.chainModify(1.5);
			}
		},
		name: "Sharpness",
		rating: 3.5,
		num: 292,
	},
	shedskin: {
		onResidualOrder: 5,
		onResidualSubOrder: 3,
		onResidual(pokemon) {
			if (pokemon.hp && pokemon.status && this.randomChance(33, 100)) {
				this.debug("shed skin");
				this.add("-activate", pokemon, "ability: Shed Skin");
				pokemon.cureStatus();
			}
		},
		name: "Shed Skin",
		rating: 3,
		num: 61,
	},
	sheerforce: {
		onModifyMove(move, pokemon) {
			if (move.secondaries) {
				delete move.secondaries;
				// Technically not a secondary effect, but it is negated
				delete move.self;
				if (move.id === "clangoroussoulblaze") delete move.selfBoost;
				// Actual negation of `AfterMoveSecondary` effects implemented in scripts.js
				move.hasSheerForce = true;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.hasSheerForce) return this.chainModify([5325, 4096]);
		},
		name: "Sheer Force",
		rating: 3.5,
		num: 125,
	},
	shellarmor: {
		onCriticalHit: false,
		isBreakable: true,
		name: "Shell Armor",
		rating: 1,
		num: 75,
	},
	shielddust: {
		onModifySecondaries(secondaries) {
			this.debug("Shield Dust prevent secondary");
			return secondaries.filter(
				(effect) => !!(effect.self || effect.dustproof)
			);
		},
		isBreakable: true,
		name: "Shield Dust",
		rating: 2,
		num: 19,
	},
	shieldsdown: {
		onStart(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Minior" ||
				pokemon.transformed
			) { return; }
			if (pokemon.hp > pokemon.maxhp / 2) {
				if (pokemon.species.forme !== "Meteor") {
					pokemon.formeChange("Minior-Meteor");
				}
			} else {
				if (pokemon.species.forme === "Meteor") {
					pokemon.formeChange(pokemon.set.species);
				}
			}
		},
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Minior" ||
				pokemon.transformed ||
				!pokemon.hp
			) { return; }
			if (pokemon.hp > pokemon.maxhp / 2) {
				if (pokemon.species.forme !== "Meteor") {
					pokemon.formeChange("Minior-Meteor");
				}
			} else {
				if (pokemon.species.forme === "Meteor") {
					pokemon.formeChange(pokemon.set.species);
				}
			}
		},
		onSetStatus(status, target, source, effect) {
			if (target.species.id !== "miniormeteor" || target.transformed) return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Shields Down");
			}
			return false;
		},
		onTryAddVolatile(status, target) {
			if (target.species.id !== "miniormeteor" || target.transformed) return;
			if (status.id !== "yawn") return;
			this.add("-immune", target, "[from] ability: Shields Down");
			return null;
		},
		isPermanent: true,
		name: "Shields Down",
		rating: 3,
		num: 197,
	},
	simple: {
		onChangeBoost(boost, target, source, effect) {
			if (effect && effect.id === "zpower") return;
			let i: BoostID;
			for (i in boost) {
				boost[i]! *= 2;
			}
		},
		isBreakable: true,
		name: "Simple",
		rating: 4,
		num: 86,
	},
	skilllink: {
		onModifyMove(move) {
			if (
				move.multihit &&
				Array.isArray(move.multihit) &&
				move.multihit.length
			) {
				move.multihit = move.multihit[1];
			}
			if (move.multiaccuracy) {
				delete move.multiaccuracy;
			}
		},
		name: "Skill Link",
		rating: 3,
		num: 92,
	},
	slowstart: {
		onStart(pokemon) {
			pokemon.addVolatile("slowstart");
		},
		onEnd(pokemon) {
			delete pokemon.volatiles["slowstart"];
			this.add("-end", pokemon, "Slow Start", "[silent]");
		},
		condition: {
			duration: 5,
			onResidualOrder: 28,
			onResidualSubOrder: 2,
			onStart(target) {
				this.add("-start", target, "ability: Slow Start");
			},
			onModifyAtkPriority: 5,
			onModifyAtk(atk, pokemon) {
				return this.chainModify(0.5);
			},
			onModifySpe(spe, pokemon) {
				return this.chainModify(0.5);
			},
			onEnd(target) {
				this.add("-end", target, "Slow Start");
			},
		},
		name: "Slow Start",
		rating: -1,
		num: 112,
	},
	slushrush: {
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather(["hail", "snow"])) {
				return this.chainModify(2);
			}
		},
		name: "Slush Rush",
		rating: 3,
		num: 202,
	},
	sniper: {
		onModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).crit) {
				this.debug("Sniper boost");
				return this.chainModify(1.5);
			}
		},
		name: "Sniper",
		rating: 2,
		num: 97,
	},
	snowcloak: {
		onImmunity(type, pokemon) {
			if (type === "hail") return false;
		},
		onModifyAccuracyPriority: -1,
		onModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			if (this.field.isWeather(["hail", "snow"])) {
				this.debug("Snow Cloak - decreasing accuracy");
				return this.chainModify([3277, 4096]);
			}
		},
		isBreakable: true,
		name: "Snow Cloak",
		rating: 1.5,
		num: 81,
	},
	snowwarning: {
		onStart(source) {
			this.field.setWeather("snow");
		},
		name: "Snow Warning",
		rating: 4,
		num: 117,
	},
	solarpower: {
		onModifySpAPriority: 5,
		onModifySpA(spa, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(1.5);
			}
		},
		onWeather(target, source, effect) {
			if (target.hasItem("utilityumbrella")) return;
			if (effect.id === "sunnyday" || effect.id === "desolateland") {
				this.damage(target.baseMaxhp / 8, target, target);
			}
		},
		name: "Solar Power",
		rating: 2,
		num: 94,
	},
	solidrock: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) {
				this.debug("Solid Rock neutralize");
				return this.chainModify(0.65);
			}
		},
		isBreakable: true,
		name: "Solid Rock",
		rating: 3,
		num: 116,
	},
	/**
	 * Doesn't seem to be any changes to soul-heart since 1.6, so looks good.
	 */
	soulheart: {
		onAnyFaintPriority: 1,
		onAnyFaint() {
			this.boost({spa: 1}, this.effectState.target);
		},
		name: "Soul-Heart",
		rating: 3.5,
		num: 220,
	},
	soundproof: {
		onTryHit(target, source, move) {
			if (target !== source && move.flags["sound"]) {
				this.add("-immune", target, "[from] ability: Soundproof");
				return null;
			}
		},
		onAllyTryHitSide(target, source, move) {
			if (move.flags["sound"]) {
				this.add(
					"-immune",
					this.effectState.target,
					"[from] ability: Soundproof"
				);
			}
		},
		isBreakable: true,
		name: "Soundproof",
		rating: 2,
		num: 43,
	},
	speedboost: {
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (pokemon.activeTurns) {
				this.boost({spe: 1});
			}
		},
		name: "Speed Boost",
		rating: 4.5,
		num: 3,
	},
	stakeout: {
		onModifyDamage(atk, attacker, defender) {
			if (!defender.activeTurns) {
				this.debug("Stakeout boost");
				return this.chainModify(2);
			}
		},
		name: "Stakeout",
		rating: 4.5,
		num: 198,
	},
	stall: {
		onFractionalPriority: -0.1,
		name: "Stall",
		rating: -1,
		num: 100,
	},
	stalwart: {
		onModifyMovePriority: 1,
		onModifyMove(move) {
			// most of the implementation is in Battle#getTarget
			move.tracksTarget = move.target !== "scripted";
		},
		name: "Stalwart",
		rating: 0,
		num: 242,
	},
	stamina: {
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (target === source) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({def: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({def: 1}, target, target);
			}
		},
		name: "Stamina",
		rating: 3.5,
		num: 192,
	},
	stancechange: {
		onModifyMovePriority: 1,
		onModifyMove(move, attacker, defender) {
			if (
				(attacker.species.baseSpecies !== "Aegislash" &&
					attacker.species.baseSpecies !== "Aegislash-Redux") ||
				attacker.transformed
			) { return; }
			if (move.category === "Status" && move.id !== "kingsshield") return;
			let targetForme =
				move.id === "kingsshield" ? "Aegislash" : "Aegislash-Blade";

			if (attacker.species.baseSpecies === "Aegislash-Redux") {
				if (move.category === "Special") {
					targetForme = "Aegislash-Redux";
				} else {
					if (move.category === "Status") {
						return;
					}
					targetForme = "Aegislash-Blade-Redux";
				}
			}
			if (attacker.species.name !== targetForme) { attacker.formeChange(targetForme); }
		},
		isPermanent: true,
		name: "Stance Change",
		rating: 4,
		num: 176,
	},
	static: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.trySetStatus("par", target);
				}
			}
		},
		name: "Static",
		rating: 2,
		num: 9,
	},
	steadfast: {
		onFlinch(pokemon) {
			this.boost({spe: 1});
		},
		name: "Steadfast",
		rating: 1,
		num: 80,
	},
	steamengine: {
		onDamagingHit(damage, target, source, move) {
			if (["Water", "Fire"].includes(move.type)) {
				this.boost({spe: 6});
			}
		},
		name: "Steam Engine",
		rating: 2,
		num: 243,
	},
	steelworker: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Steel") {
				this.debug("Steelworker boost");
				return this.chainModify(1.3);
			}
		},
		name: "Steelworker",
		rating: 3.5,
		num: 200,
	},
	steelyspirit: {
		onAllyModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Steel") {
				this.debug("Steely Spirit boost");
				return this.chainModify(1.3);
			}
		},
		name: "Steely Spirit",
		rating: 3.5,
		num: 252,
	},
	stench: {
		onModifyMovePriority: -1,
		onModifyMove(move) {
			if (move.category !== "Status") {
				this.debug("Adding Stench flinch");
				if (!move.secondaries) move.secondaries = [];
				for (const secondary of move.secondaries) {
					if (secondary.volatileStatus === "flinch") return;
				}
				move.secondaries.push({
					chance: 10,
					volatileStatus: "flinch",
					ability: this.dex.abilities.get("stench"),
				});
			}
		},
		name: "Stench",
		rating: 0.5,
		num: 1,
	},
	stickyhold: {
		onTakeItem(item, pokemon, source) {
			if (!pokemon.hp || pokemon.item === "stickybarb") return;
			if (
				(source && source !== pokemon) ||
				this.activeMove?.id === "knockoff"
			) {
				this.add("-activate", pokemon, "ability: Sticky Hold");
				return false;
			}
		},
		isBreakable: true,
		name: "Sticky Hold",
		rating: 1.5,
		num: 60,
	},
	stormdrain: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Water") {
				if (target.getStat("atk") > target.getStat("spa")) {
					if (!this.boost({atk: 1})) {
						this.add("-immune", target, "[from] ability: Storm Drain");
					}
				} else {
					if (!this.boost({spa: 1})) {
						this.add("-immune", target, "[from] ability: Storm Drain");
					}
				}
				return null;
			}
		},
		onAnyRedirectTarget(target, source, source2, move) {
			if (move.type !== "Water" || move.flags["pledgecombo"]) return;
			const redirectTarget = ["randomNormal", "adjacentFoe"].includes(
				move.target
			) ?
				"normal" :
				move.target;
			if (
				this.validTarget(this.effectState.target, source, redirectTarget)
			) {
				if (move.smartTarget) move.smartTarget = false;
				if (this.effectState.target !== target) {
					this.add(
						"-activate",
						this.effectState.target,
						"ability: Storm Drain"
					);
				}
				return this.effectState.target;
			}
		},
		isBreakable: true,
		name: "Storm Drain",
		rating: 3,
		num: 114,
	},
	strongjaw: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["bite"]) {
				return this.chainModify(1.5);
			}
		},
		name: "Strong Jaw",
		rating: 3.5,
		num: 173,
	},
	sturdy: {
		onTryHit(pokemon, target, move) {
			if (move.ohko) {
				this.add("-immune", pokemon, "[from] ability: Sturdy");
				return null;
			}
		},
		onDamagePriority: -30,
		onDamage(damage, target, source, effect) {
			if (
				target.hp === target.maxhp &&
				damage >= target.hp &&
				effect &&
				effect.effectType === "Move"
			) {
				this.add("-ability", target, "Sturdy");
				return target.hp - 1;
			}
		},
		isBreakable: true,
		name: "Sturdy",
		rating: 3,
		num: 5,
	},
	suctioncups: {
		onDragOutPriority: 1,
		onDragOut(pokemon) {
			this.add("-activate", pokemon, "ability: Suction Cups");
			return null;
		},
		isBreakable: true,
		name: "Suction Cups",
		rating: 1,
		num: 21,
	},
	superluck: {
		onModifyCritRatio(critRatio) {
			return critRatio + 1;
		},
		name: "Super Luck",
		rating: 1.5,
		num: 105,
	},
	supremeoverlord: {
		onStart(pokemon) {
			if (pokemon.side.totalFainted) {
				this.add("-activate", pokemon, "ability: Supreme Overlord");
				const fallen = Math.min(pokemon.side.totalFainted, 5);
				this.add("-start", pokemon, `fallen${fallen}`, "[silent]");
				this.effectState.fallen = fallen;
			}
		},
		onEnd(pokemon) {
			this.add(
				"-end",
				pokemon,
				`fallen${this.effectState.fallen}`,
				"[silent]"
			);
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (this.effectState.fallen) {
				const powMod = [4096, 4506, 4915, 5325, 5734, 6144];
				this.debug(
					`Supreme Overlord boost: ${powMod[this.effectState.fallen]}/4096`
				);
				return this.chainModify([powMod[this.effectState.fallen], 4096]);
			}
		},
		name: "Supreme Overlord",
		rating: 4,
		num: 293,
	},
	surgesurfer: {
		onModifySpe(spe) {
			if (this.field.isTerrain("electricterrain")) {
				return this.chainModify(2);
			}
		},
		name: "Surge Surfer",
		rating: 3,
		num: 207,
	},
	swarm: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Bug" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Swarm boost");
				return this.chainModify(1.5);
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, attacker, defender, move) {
			if (move.type === "Bug" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Swarm boost");
				return this.chainModify(1.5);
			}
		},
		name: "Swarm",
		rating: 2,
		num: 68,
	},
	sweetveil: {
		name: "Sweet Veil",
		onAllySetStatus(status, target, source, effect) {
			if (status.id === "slp") {
				this.debug("Sweet Veil interrupts sleep");
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Sweet Veil",
					"[of] " + effectHolder
				);
				return null;
			}
		},
		onAllyTryAddVolatile(status, target) {
			if (status.id === "yawn") {
				this.debug("Sweet Veil blocking yawn");
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Sweet Veil",
					"[of] " + effectHolder
				);
				return null;
			}
		},
		isBreakable: true,
		rating: 2,
		num: 175,
	},
	swiftswim: {
		onModifySpe(spe, pokemon) {
			if (
				["raindance", "primordialsea"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(2);
			}
		},
		name: "Swift Swim",
		rating: 3,
		num: 33,
	},
	symbiosis: {
		onAllyAfterUseItem(item, pokemon) {
			if (pokemon.switchFlag) return;
			const source = this.effectState.target;
			const myItem = source.takeItem();
			if (!myItem) return;
			if (
				!this.singleEvent(
					"TakeItem",
					myItem,
					source.itemState,
					pokemon,
					source,
					this.effect,
					myItem
				) ||
				!pokemon.setItem(myItem)
			) {
				source.item = myItem.id;
				return;
			}
			this.add(
				"-activate",
				source,
				"ability: Symbiosis",
				myItem,
				"[of] " + pokemon
			);
		},
		name: "Symbiosis",
		rating: 0,
		num: 180,
	},
	synchronize: {
		onAfterSetStatus(status, target, source, effect) {
			if (!source || source === target) return;
			if (effect && effect.id === "toxicspikes") return;
			if (status.id === "slp" || status.id === "frz") return;
			this.add("-activate", target, "ability: Synchronize");
			// Hack to make status-prevention abilities think Synchronize is a status move
			// and show messages when activating against it.
			source.trySetStatus(status, target, {
				status: status.id,
				id: "synchronize",
			} as Effect);
		},
		name: "Synchronize",
		rating: 2,
		num: 28,
	},
	swordofruin: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Sword of Ruin");
		},
		onAnyModifyDef(def, target, source, move) {
			const abilityHolder = this.effectState.target;
			if (target.hasAbility("swordofruin")) return;
			if (!move.ruinedDef?.hasAbility("swordofruin")) { move.ruinedDef = abilityHolder; }
			if (move.ruinedDef !== abilityHolder) return;
			this.debug("Sword of Ruin Def drop");
			return this.chainModify(0.75);
		},
		name: "Sword of Ruin",
		rating: 4.5,
		num: 285,
	},
	tabletsofruin: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Tablets of Ruin");
		},
		onAnyModifyAtk(atk, source, target, move) {
			if (!move) return;

			const abilityHolder = this.effectState.target;
			console.log(abilityHolder);

			if (source.hasAbility("tabletsofruin")) return;
			if (!move.ruinedAtk?.hasAbility("tabletsofruin")) { move.ruinedAtk = abilityHolder; }
			if (move.ruinedAtk !== abilityHolder) return;
			this.debug("Tablets of Ruin Atk drop");
			return this.chainModify(0.75);
		},
		name: "Tablets of Ruin",
		rating: 4.5,
		num: 284,
	},
	tangledfeet: {
		onModifyAccuracyPriority: -1,
		onModifyAccuracy(accuracy, target) {
			if (typeof accuracy !== "number") return;
			if (target?.volatiles["confusion"]) {
				this.debug("Tangled Feet - decreasing accuracy");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Tangled Feet",
		rating: 1,
		num: 77,
	},
	tanglinghair: {
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.add("-ability", target, "Tangling Hair");
				this.boost({spe: -1}, source, target, null, true);
			}
		},
		name: "Tangling Hair",
		rating: 2,
		num: 221,
	},
	technician: {
		onModifyDamage(basePower, attacker, defender, move) {
			const basePowerAfterMultiplier = this.modify(
				basePower,
				this.event.modifier
			);
			this.debug("Base Power: " + basePowerAfterMultiplier);
			if (basePowerAfterMultiplier <= 60) {
				this.debug("Technician boost");
				return this.chainModify(1.5);
			}
		},
		name: "Technician",
		rating: 3.5,
		num: 101,
	},
	telepathy: {
		onTryHit(target, source, move) {
			if (
				target !== source &&
				target.isAlly(source) &&
				move.category !== "Status"
			) {
				this.add("-activate", target, "ability: Telepathy");
				return null;
			}
		},
		isBreakable: true,
		name: "Telepathy",
		rating: 0,
		num: 140,
	},
	teravolt: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Teravolt");
		},
		onModifyMove(move) {
			move.ignoreAbility = true;
		},
		name: "Teravolt",
		rating: 3,
		num: 164,
	},
	thermalexchange: {
		onDamagingHit(damage, target, source, move) {
			if (move.type === "Fire") {
				this.boost({atk: 1});
			}
		},
		onUpdate(pokemon) {
			if (pokemon.status === "brn") {
				this.add("-activate", pokemon, "ability: Thermal Exchange");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "brn") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Thermal Exchange");
			}
			return false;
		},
		name: "Thermal Exchange",
		rating: 2.5,
		num: 270,
	},
	thickfat: {
		onSourceModifyAtkPriority: 6,
		onSourceModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Ice" || move.type === "Fire") {
				this.debug("Thick Fat weaken");
				return this.chainModify(0.5);
			}
		},
		onSourceModifySpAPriority: 5,
		onSourceModifySpA(atk, attacker, defender, move) {
			if (move.type === "Ice" || move.type === "Fire") {
				this.debug("Thick Fat weaken");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Thick Fat",
		rating: 3.5,
		num: 47,
	},
	tintedlens: {
		onModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod < 0) {
				this.debug("Tinted Lens boost");
				return this.chainModify(2);
			}
		},
		name: "Tinted Lens",
		rating: 4,
		num: 110,
	},
	torrent: {
		onModifyAtkPriority: 5,
		onModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Water" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Torrent boost");
				return this.chainModify(1.5);
			}
		},
		onModifySpAPriority: 5,
		onModifySpA(atk, attacker, defender, move) {
			if (move.type === "Water" && attacker.hp <= attacker.maxhp / 3) {
				this.debug("Torrent boost");
				return this.chainModify(1.5);
			}
		},
		name: "Torrent",
		rating: 2,
		num: 67,
	},
	toughclaws: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["contact"]) {
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Tough Claws",
		rating: 3.5,
		num: 181,
	},
	toxicboost: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (
				(attacker.status === "psn" || attacker.status === "tox") &&
				move.category === "Physical"
			) {
				return this.chainModify(1.5);
			}
		},
		name: "Toxic Boost",
		rating: 3,
		num: 137,
	},
	toxicdebris: {
		onDamagingHit(damage, target, source, move) {
			const side = target.side.foe;
			const toxicSpikes = side.sideConditions["toxicspikes"];
			if (!move.flags["contact"]) return;
			if (toxicSpikes && toxicSpikes.layers >= 2) return;
			this.add("-activate", target, "ability: Toxic Debris");
			side.addSideCondition("toxicspikes", target);
		},
		name: "Toxic Debris",
		rating: 3.5,
		num: 295,
	},
	trace: {
		onStart(pokemon) {
			// n.b. only affects Hackmons
			// interaction with No Ability is complicated: https://www.smogon.com/forums/threads/pokemon-sun-moon-battle-mechanics-research.3586701/page-76#post-7790209
			if (
				pokemon
					.adjacentFoes()
					.some((foeActive) => foeActive.ability === "noability")
			) {
				this.effectState.gaveUp = true;
			}
			// interaction with Ability Shield is similar to No Ability
			if (pokemon.hasItem("Ability Shield")) {
				this.add("-block", pokemon, "item: Ability Shield");
				this.effectState.gaveUp = true;
			}
		},
		onUpdate(pokemon) {
			if (!pokemon.isStarted || this.effectState.gaveUp) return;

			const additionalBannedAbilities = [
				// Zen Mode included here for compatability with Gen 5-6
				"noability",
				"flowergift",
				"forecast",
				"hungerswitch",
				"illusion",
				"imposter",
				"neutralizinggas",
				"powerofalchemy",
				"receiver",
				"trace",
				"zenmode",
			];
			const possibleTargets = pokemon
				.adjacentFoes()
				.filter(
					(target) =>
						!target.getAbility().isPermanent &&
						!additionalBannedAbilities.includes(target.ability)
				);
			if (!possibleTargets.length) return;

			const target = this.sample(possibleTargets);
			const ability = target.getAbility();
			if (pokemon.setAbility(ability)) {
				this.add(
					"-ability",
					pokemon,
					ability,
					"[from] ability: Trace",
					"[of] " + target
				);
			}
		},
		name: "Trace",
		rating: 2.5,
		num: 36,
	},
	transistor: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Electric") {
				this.debug("Transistor boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Transistor",
		rating: 3.5,
		num: 262,
	},
	triage: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.flags["heal"]) return priority + 3;
		},
		name: "Triage",
		rating: 3.5,
		num: 205,
	},
	truant: {
		onStart(pokemon) {
			pokemon.removeVolatile("truant");
			if (
				pokemon.activeTurns &&
				(pokemon.moveThisTurnResult !== undefined ||
					!this.queue.willMove(pokemon))
			) {
				pokemon.addVolatile("truant");
			}
		},
		onBeforeMovePriority: 9,
		onBeforeMove(pokemon) {
			if (pokemon.removeVolatile("truant")) {
				this.add("cant", pokemon, "ability: Truant");
				return false;
			}
			pokemon.addVolatile("truant");
		},
		condition: {},
		name: "Truant",
		rating: -1,
		num: 54,
	},
	turboblaze: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Turboblaze");
		},
		onModifyMove(move) {
			move.ignoreAbility = true;
		},
		name: "Turboblaze",
		rating: 3,
		num: 163,
	},
	unaware: {
		name: "Unaware",
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectState.target;
			if (unawareUser === pokemon) return;
			if (
				unawareUser === this.activePokemon &&
				pokemon === this.activeTarget
			) {
				boosts["def"] = 0;
				boosts["spd"] = 0;
				boosts["evasion"] = 0;
			}
			if (
				pokemon === this.activePokemon &&
				unawareUser === this.activeTarget
			) {
				boosts["atk"] = 0;
				boosts["def"] = 0;
				boosts["spa"] = 0;
				boosts["accuracy"] = 0;
			}
		},
		isBreakable: true,
		rating: 4,
		num: 109,
	},
	unburden: {
		onAfterUseItem(item, pokemon) {
			if (pokemon !== this.effectState.target) return;
			pokemon.addVolatile("unburden");
		},
		onTakeItem(item, pokemon) {
			pokemon.addVolatile("unburden");
		},
		onEnd(pokemon) {
			pokemon.removeVolatile("unburden");
		},
		condition: {
			onModifySpe(spe, pokemon) {
				if (!pokemon.item && !pokemon.ignoringAbility()) {
					return this.chainModify(2);
				}
			},
		},
		name: "Unburden",
		rating: 3.5,
		num: 84,
	},
	unnerve: {
		onPreStart(pokemon) {
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onStart(pokemon) {
			if (this.effectState.unnerved) return;
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onEnd() {
			this.effectState.unnerved = false;
		},
		onFoeTryEatItem() {
			return !this.effectState.unnerved;
		},
		name: "Unnerve",
		rating: 1,
		num: 127,
	},
	unseenfist: {
		onModifyMove(move) {
			if (move.flags["contact"]) delete move.flags["protect"];
		},
		name: "Unseen Fist",
		rating: 2,
		num: 260,
	},
	vesselofruin: {
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Vessel of Ruin");
		},
		onAnyModifySpA(spa, source, target, move) {
			if (!move) return;
			const abilityHolder = this.effectState.target;
			if (!abilityHolder) return;
			if (source.hasAbility("vesselofruin")) return;
			if (!move.ruinedSpA?.hasAbility("vesselofruin")) { move.ruinedSpA = abilityHolder; }
			if (move.ruinedSpA !== abilityHolder) return;
			this.debug("Vessel of Ruin SpA drop");
			return this.chainModify(0.75);
		},
		name: "Vessel of Ruin",
		rating: 4.5,
		num: 284,
	},
	victorystar: {
		onAnyModifyAccuracyPriority: -1,
		onAnyModifyAccuracy(accuracy, target, source) {
			if (
				source.isAlly(this.effectState.target) &&
				typeof accuracy === "number"
			) {
				return this.chainModify([4506, 4096]);
			}
		},
		name: "Victory Star",
		rating: 2,
		num: 162,
	},
	vitalspirit: {
		onUpdate(pokemon) {
			if (pokemon.status === "slp") {
				this.add("-activate", pokemon, "ability: Vital Spirit");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "slp") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Vital Spirit");
			}
			return false;
		},
		onAfterMove(source, target, move) {
			if (move.type !== 'Fighting') return;
			if (source.getStatus()) { this.add("-activate", source, "ability: Vital Spirit"); }
			source.cureStatus();
		},
		isBreakable: true,
		name: "Vital Spirit",
		rating: 1.5,
		num: 72,
	},
	voltabsorb: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Electric") {
				if (!this.heal(target.baseMaxhp / 4)) {
					this.add("-immune", target, "[from] ability: Volt Absorb");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Volt Absorb",
		rating: 3.5,
		num: 10,
	},
	/**
	 * Looks like wandering spirit is already implemented correctly according to the dex.
	 */
	wanderingspirit: {
		onDamagingHit(damage, target, source, move) {
			const additionalBannedAbilities = [
				"hungerswitch",
				"illusion",
				"neutralizinggas",
				"wonderguard",
			];
			if (
				source.getAbility().isPermanent ||
				additionalBannedAbilities.includes(source.ability) ||
				target.volatiles["dynamax"]
			) {
				return;
			}

			if (this.checkMoveMakesContact(move, source, target)) {
				const targetCanBeSet = this.runEvent(
					"SetAbility",
					target,
					source,
					this.effect,
					source.ability
				);
				if (!targetCanBeSet) return targetCanBeSet;
				const sourceAbility = source.setAbility("wanderingspirit", target);
				if (!sourceAbility) return;
				if (target.isAlly(source)) {
					this.add(
						"-activate",
						target,
						"Skill Swap",
						"",
						"",
						"[of] " + source
					);
				} else {
					this.add(
						"-activate",
						target,
						"ability: Wandering Spirit",
						this.dex.abilities.get(sourceAbility).name,
						"Wandering Spirit",
						"[of] " + source
					);
				}
				target.setAbility(sourceAbility);
			}
		},
		name: "Wandering Spirit",
		rating: 2.5,
		num: 254,
	},
	waterabsorb: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Water") {
				if (!this.heal(target.baseMaxhp / 4)) {
					this.add("-immune", target, "[from] ability: Water Absorb");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Water Absorb",
		rating: 3.5,
		num: 11,
	},
	waterbubble: {
		onSourceModifyAtkPriority: 5,
		onSourceModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Fire") {
				return this.chainModify(0.5);
			}
		},
		onSourceModifySpAPriority: 5,
		onSourceModifySpA(atk, attacker, defender, move) {
			if (move.type === "Fire") {
				return this.chainModify(0.5);
			}
		},
		onModifyAtk(atk, attacker, defender, move) {
			if (move.type === "Water") {
				return this.chainModify(2);
			}
		},
		onModifySpA(atk, attacker, defender, move) {
			if (move.type === "Water") {
				return this.chainModify(2);
			}
		},
		onUpdate(pokemon) {
			if (pokemon.status === "brn") {
				this.add("-activate", pokemon, "ability: Water Bubble");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "brn") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Water Bubble");
			}
			return false;
		},
		isBreakable: true,
		name: "Water Bubble",
		rating: 4.5,
		num: 199,
	},
	watercompaction: {
		onDamagingHit(damage, target, source, move) {
			if (move.type === "Water") {
				this.boost({def: 2});
			}
		},
		name: "Water Compaction",
		rating: 1.5,
		num: 195,
	},
	waterveil: {
		onUpdate(pokemon) {
			if (pokemon.status === "brn") {
				this.add("-activate", pokemon, "ability: Water Veil");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "brn") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Water Veil");
			}
			return false;
		},
		isBreakable: true,
		name: "Water Veil",
		rating: 2,
		num: 41,
	},
	weakarmor: {
		onDamagingHit(damage, target, source, move) {
			if (move.category === "Physical") {
				this.boost({def: -1, spe: 2}, target, target);
			}
		},
		name: "Weak Armor",
		rating: 1,
		num: 133,
	},
	wellbakedbody: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Fire") {
				this.add("-ability", target, "Well Baked Body");
				this.boost({def: 2});
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Well Baked Body",
		rating: 3.5,
		num: 273,
	},
	whitesmoke: {
		onStart(source) {
			if (!source.side.sideConditions['smokescreen']) {
				this.add("-activate", source, "ability: White Smoke");
				source.side.addSideCondition(
					"smokescreen",
					source,
					this.dex.abilities.get("whitesmoke")
				);
			}
		},
		isBreakable: true,
		name: "White Smoke",
		rating: 2,
		num: 73,
	},
	wimpout: {
		onEmergencyExit(target) {
			if (
				!this.canSwitch(target.side) ||
				target.forceSwitchFlag ||
				target.switchFlag
			) { return; }
			for (const side of this.sides) {
				for (const active of side.active) {
					active.switchFlag = false;
				}
			}
			target.switchFlag = true;
			this.add("-activate", target, "ability: Wimp Out");
		},
		name: "Wimp Out",
		rating: 1,
		num: 193,
	},
	windpower: {
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (move.flags["wind"]) {
				target.addVolatile("charge");
			}
		},
		onAllySideConditionStart(target, source, sideCondition) {
			const pokemon = this.effectState.target;
			if (sideCondition.id === "tailwind") {
				pokemon.addVolatile("charge");
			}
		},
		name: "Wind Power",
		rating: 1,
		num: 277,
	},
	windrider: {
		onStart(pokemon) {
			if (pokemon.getVolatile("windriderstarted")) return;
			if (pokemon.side.sideConditions["tailwind"]) {
				if (pokemon.getStat("atk", false, true) >	pokemon.getStat("spa", false, true)) {
					this.boost({atk: 1}, pokemon);
				} else {
					this.boost({spa: 1}, pokemon);
				}
			}
		},
		onTryHit(target, source, move) {
			if (target !== source && move.flags["wind"]) {
				if (!this.boost({atk: 1}, target, target)) {
					this.add("-immune", target, "[from] ability: Wind Rider");
				}
				return null;
			}
		},
		onAllySideConditionStart(target, source, sideCondition) {
			const pokemon = this.effectState.target;
			if (sideCondition.id === "tailwind") {
				if (pokemon.getStat("atk", false, true) >	pokemon.getStat("spa", false, true)) {
					this.boost({atk: 1}, pokemon);
				} else {
					this.boost({spa: 1}, pokemon);
				}
				pokemon.addVolatile("windriderstarted");
			}
		},
		name: "Wind Rider",
		rating: 3.5,
		// We do not want Brambleghast to get Infiltrator in Randbats
		num: 274,
	},
	wonderguard: {
		onTryHit(target, source, move) {
			if (
				target === source ||
				move.category === "Status" ||
				move.type === "???" ||
				move.id === "struggle"
			) { return; }
			if (move.id === "skydrop" && !source.volatiles["skydrop"]) return;
			this.debug("Wonder Guard immunity: " + move.id);
			if (target.runEffectiveness(move) <= 0) {
				if (move.smartTarget) {
					move.smartTarget = false;
				} else {
					this.add("-immune", target, "[from] ability: Wonder Guard");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Wonder Guard",
		rating: 5,
		num: 25,
	},
	wonderskin: {
		onModifyAccuracyPriority: 10,
		onModifyAccuracy(accuracy, target, source, move) {
			if (move.category === "Status" && typeof accuracy === "number") {
				this.debug("Wonder Skin - setting accuracy to 50");
				return 50;
			}
		},
		isBreakable: true,
		name: "Wonder Skin",
		rating: 2,
		num: 147,
	},
	zenmode: {
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Darmanitan" ||
				pokemon.transformed
			) {
				return;
			}
			if (
				pokemon.hp <= pokemon.maxhp / 2 &&
				!["Zen", "Galar-Zen"].includes(pokemon.species.forme)
			) {
				pokemon.addVolatile("zenmode");
			} else if (
				pokemon.hp > pokemon.maxhp / 2 &&
				["Zen", "Galar-Zen"].includes(pokemon.species.forme)
			) {
				pokemon.addVolatile("zenmode"); // in case of base Darmanitan-Zen
				pokemon.removeVolatile("zenmode");
			}
		},
		onEnd(pokemon) {
			if (!pokemon.volatiles["zenmode"] || !pokemon.hp) return;
			pokemon.transformed = false;
			delete pokemon.volatiles["zenmode"];
			if (
				pokemon.species.baseSpecies === "Darmanitan" &&
				pokemon.species.battleOnly
			) {
				pokemon.formeChange(
					pokemon.species.battleOnly as string,
					this.effect,
					false,
					"[silent]"
				);
			}
		},
		condition: {
			onStart(pokemon) {
				if (!pokemon.species.name.includes("Galar")) {
					if (pokemon.species.id !== "darmanitanzen") { pokemon.formeChange("Darmanitan-Zen"); }
				} else {
					if (pokemon.species.id !== "darmanitangalarzen") { pokemon.formeChange("Darmanitan-Galar-Zen"); }
				}
			},
			onEnd(pokemon) {
				if (["Zen", "Galar-Zen"].includes(pokemon.species.forme)) {
					pokemon.formeChange(pokemon.species.battleOnly as string);
				}
			},
		},
		isPermanent: true,
		name: "Zen Mode",
		rating: 0,
		num: 161,
	},
	zerotohero: {
		onSwitchOut(pokemon) {
			if (
				pokemon.baseSpecies.baseSpecies !== "Palafin" ||
				pokemon.transformed
			) { return; }
			if (pokemon.species.forme !== "Hero") {
				pokemon.formeChange("Palafin-Hero", this.effect, true);
			}
		},
		onSwitchIn() {
			this.effectState.switchingIn = true;
		},
		onStart(pokemon) {
			if (!this.effectState.switchingIn) return;
			this.effectState.switchingIn = false;
			if (
				pokemon.baseSpecies.baseSpecies !== "Palafin" ||
				pokemon.transformed
			) { return; }
			if (
				!this.effectState.heroMessageDisplayed &&
				pokemon.species.forme === "Hero"
			) {
				this.add("-activate", pokemon, "ability: Zero to Hero");
				this.effectState.heroMessageDisplayed = true;
			}
		},
		isPermanent: true,
		name: "Zero to Hero",
		rating: 5,
		num: 278,
	},
	// Inclement Emerald Abilities
	chloroplast: {
		name: "Chloroplast",
		// implemented in the corresponding move(s)
		rating: 3,
		num: 298,
		gen: 8,
	},
	whiteout: {
		onModifyDamage(spa, pokemon, target, move) {
			if (
				["hail", "snow"].includes(pokemon.effectiveWeather()) &&
				move.type === "Ice"
			) {
				return this.chainModify(1.5);
			}
		},
		name: "Whiteout",
		rating: 3,
		num: 299,
		gen: 8,
	},
	pyromancy: {
		onModifyMovePriority: -2,
		onModifyMove(move) {
			if (move.secondaries) {
				this.debug("quintupling burn chance");
				for (const secondary of move.secondaries) {
					if (secondary.status?.includes("brn") && secondary.chance && !secondary.ability) { secondary.chance *= 5; }
				}
			}
		},
		name: "Pyromancy",
		rating: 3.5,
		num: 300,
		gen: 8,
	},
	keenedge: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Keen Edge",
		rating: 3.5,
		num: 301,
		gen: 8,
	},
	prismscales: {
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === "Special") {
				return this.chainModify(0.7);
			}
		},
		name: "Prism Scales",
		rating: 4,
		num: 302,
		gen: 8,
	},
	powerfists: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["punch"]) {
				this.debug("Powerfists power boost");
				return this.chainModify([5325, 4096]);
			}
		},
		onModifyMove(move) {
			if (move.flags["punch"]) {
				move.overrideDefensiveStat = "spd";
			}
		},
		name: "Power Fists",
		rating: 3.5,
		num: 303,
		gen: 8,
	},
	sandsong: {
		onModifyTypePriority: -2,
		onModifyType(move, pokemon) {
			if (move.flags["sound"] && move.type === "Normal" && !pokemon.volatiles["dynamax"]) {
				// hardcode
				move.type = "Ground";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"] && move.typeChangerBoosted) {
				return this.chainModify(1.2);
			}
		},
		name: "Sand Song",
		rating: 1.5,
		num: 306,
		gen: 8,
	},
	rampage: {
		onAfterMove(source, target, move) {
			if (target && target.hp <= 0) {
				if (source.volatiles["mustrecharge"]) {
					source.removeVolatile("mustrecharge");
				}
			}
		},
		name: "Rampage",
		rating: 2,
		num: 307,
		gen: 8,
	},
	vengeance: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Ghost") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Vengeance boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Lite Vengeance boost");
					return this.chainModify(1.2);
				}
			}
		},
		name: "Vengeance",
		rating: 2,
		num: 308,
		gen: 8,
	},
	blitzboxer: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move.flags["punch"] && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
		name: "Blitz Boxer",
		rating: 4,
		num: 309,
		gen: 8,
	},

	// Elite Redux Abilities
	antarcticbird: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Ice" || move.type === "Flying") {
				this.debug("Antarctic Bird boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Antarctic Bird",
		rating: 3,
		num: 310,
		gen: 8,
	},
	immolate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Fire";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Immolate",
		rating: 4,
		num: 311,
		gen: 8,
	},
	crystallize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Rock" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Ice";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Crystallize",
		rating: 4,
		num: 312,
		gen: 8,
	},
	electrocytes: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Electric") {
				this.debug("Electrocytes boost");
				return this.chainModify(1.25);
			}
		},
		name: "Electrocytes",
		rating: 3,
		num: 313,
		gen: 8,
	},
	aerodynamics: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Flying") {
				if (!this.boost({spe: 1})) {
					this.add("-immune", target, "[from] ability: Aerodynamics");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Aerodynamics",
		rating: 3,
		num: 312,
		gen: 8,
	},
	christmasspirit: {
		onSourceModifyDamage(spa, pokemon) {
			if (["hail", "snow"].includes(pokemon.effectiveWeather())) {
				return this.chainModify(2);
			}
		},
		isBreakable: true,
		name: "Christmas Spirit",
		rating: 4,
		num: 314,
		gen: 8,
	},
	exploitweakness: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (defender.status) {
				return this.chainModify(1.25);
			}
		},
		name: "Exploit Weakness",
		rating: 2,
		num: 315,
		gen: 8,
	},
	groundshock: {
		onModifyMovePriority: -5,
		onModifyMove(move) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity["Electric"] = true;
			}
			const baseEffectiveness = move.onEffectiveness;
			move.onEffectiveness = (effectiveness, target, type, usedMove) => {
				if (usedMove.type === 'Electric' && type === 'Ground') return -1;
				return baseEffectiveness?.apply(this, [effectiveness, target, type, usedMove]);
			};
		},
		name: "Ground Shock",
		rating: 3,
		num: 315,
		gen: 8,
	},
	ancientidol: {
		onModifyMove(move) {
			if (move.category === "Physical") {
				move.overrideOffensiveStat = "def";
			}
			if (move.category === "Special") {
				move.overrideOffensiveStat = "spd";
			}
		},
		name: "Ancient Idol",
		rating: 3,
		num: 316,
		gen: 8,
	},
	mysticpower: {
		onModifyMove(move) {
			move.forceSTAB = true;
		},
		name: "Mystic Power",
		rating: 4.5,
		num: 317,
		gen: 8,
	},
	perfectionist: {
		onModifyMovePriority: -5,
		onModifyCritRatio(critRatio, source, target, move) {
			if (move.category === "Status") return;
			if (move.basePower <= 50) return critRatio + 1;
		},
		onModifyPriority(priority, pokemon, target, move) {
			if (move.category === "Status") return;
			if (move.basePower <= 25) return priority + 1;
		},
		name: "Perfectionist",
		rating: 3.5,
		num: 318,
		gen: 8,
	},
	growingtooth: {
		onAfterMove(attacker, defender, move) {
			if (move.flags["bite"]) {
				this.boost({atk: 1}, attacker);
			}
		},
		name: "Growing Tooth",
		rating: 4,
		num: 319,
		gen: 8,
	},
	inflatable: {
		onTryHit(target, source, move) {
			if (
				target !== source &&
				(move.type === "Flying" || move.type === "Fire")
			) {
				if (!this.boost({def: 1, spd: 1})) {
					this.add("-immune", target, "[from] ability: Inflatable");
					return null;
				}
			}
		},
		isBreakable: true,
		name: "Inflatable",
		rating: 3,
		num: 320,
		gen: 8,
	},
	auroraborealis: {
		onModifyMove(move) {
			if (move.type === "Ice") {
				move.forceSTAB = true;
			}
		},
		name: "Aurora Borealis",
		rating: 3,
		num: 321,
		gen: 8,
	},
	avenger: {
		onModifyDamage(atk, attacker, defender, move) {
			if (attacker.side.faintedLastTurn) {
				this.debug("Avenger boost");
				return this.chainModify(1.5);
			}
		},
		name: "Avenger",
		rating: 3,
		num: 322,
		gen: 8,
	},
	/**
	 * Looks correct according to elite redux dex.
	 */
	letsroll: {
		onStart(pokemon) {
			this.boost({def: 1}, pokemon);
		},
		name: "Lets Roll",
		rating: 3.5,
		num: 323,
		gen: 8,
	},
	aquatic: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Water")) {
				if (!pokemon.addType("Water")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Water",
					"[from] ability: Aquatic"
				);
			}
		},
		name: "Aquatic",
		rating: 3.5,
		num: 324,
		gen: 8,
	},
	loudbang: {
		onModifyMove(move, attacker, defender) {
			if (move.category !== "Status" && move.flags["sound"]) {
				if (!move.secondaries) move.secondaries = [];
				move.secondaries.push({
					chance: 50,
					volatileStatus: "confusion",
					ability: this.dex.abilities.get("loudbang"),
				});
			}
		},
		name: "Loud Bang",
		rating: 2,
		num: 325,
		gen: 8,
	},
	leadcoat: {
		onModifySpe(def, pokemon) {
			this.chainModify(0.9);
		},
		onSourceModifyDamage(spe, pokemon, target, move) {
			if (move.category === 'Physical') this.chainModify(0.6);
		},
		name: "Lead Coat",
		rating: 3.5,
		num: 326,
		gen: 8,
	},
	coilup: {
		onStart(pokemon) {
			this.effectState.coiled = true;
			this.add("-activate", pokemon, "Coil Up");
			// console.log(`On Start: EffectState: ${this.effectState.coiled}`);
		},
		onModifyPriority(priority, source, target, move) {
			if (!this.effectState.coiled) return;
			if (this.effectState.coiled && move.flags["bite"]) {
				return priority + 1;
			}
		},
		onAfterMove(attacker, defender, move) {
			if (!this.effectState.coiled) return;
			if (this.effectState.coiled && move.flags["bite"]) {
				this.effectState.coiled = false;
			}
		},
		name: "Coil Up",
		rating: 3.5,
		num: 327,
		gen: 8,
	},
	amphibious: {
		onModifyMove(move) {
			if (move.type === "Water") {
				move.forceSTAB = true;
			}
		},
		name: "Amphibious",
		rating: 3,
		num: 328,
		gen: 8,
	},
	grounded: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Ground")) {
				if (!pokemon.addType("Ground")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Ground",
					"[from] ability: Grounded"
				);
			}
		},
		name: "Grounded",
		rating: 3.5,
		num: 329,
		gen: 8,
	},
	earthbound: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Ground") {
				this.debug("Earthbound boost");
				return this.chainModify(1.25);
			}
		},
		name: "Earthbound",
		rating: 3,
		num: 330,
		gen: 8,
	},
	fightingspirit: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Fighting";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Fighting Spirit",
		rating: 4,
		num: 331,
		gen: 8,
	},
	felineprowess: {
		onModifySpAPriority: 5,
		onModifySpA(spa) {
			return this.chainModify(2);
		},
		name: "Feline Prowess",
		rating: 5,
		num: 332,
		gen: 8,
	},
	fossilized: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Rock") {
				this.debug("Fossilized boost");
				return this.chainModify(1.2);
			}
		},
		onSourceModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Rock") {
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Fossilized",
		rating: 3,
		num: 333,
		gen: 8,
	},
	magicaldust: {
		onDamagingHit(damage, target, source, move) {
			if (!source.types.includes("Psychic")) {
				if (!source.addType("Psychic")) return;
				this.add(
					"-start",
					source,
					"typeadd",
					"Psychic",
					"[from] ability: Magical Dust"
				);
			}
		},
		name: "Magical Dust",
		rating: 3,
		num: 334,
		gen: 8,
	},
	dreamcatcher: {
		onModifyDamage(bp, source, target, move) {
			for (const foe of source.foes()) {
				if (foe.status === "slp") {
					return this.chainModify(2);
				}
			}
			for (const ally of source.alliesAndSelf()) {
				if (ally.status === "slp") {
					return this.chainModify(2);
				}
			}
		},
		name: "Dreamcatcher",
		rating: 3,
		num: 335,
	},
	nocturnal: {
		onSourceModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Dark" || move.type === "Fairy") {
				return this.chainModify(0.75);
			}
		},
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Dark") {
				return this.chainModify(1.25);
			}
		},
		isBreakable: true,
		name: "Nocturnal",
		rating: 4,
		num: 336,
		gen: 8,
	},
	selfsufficient: {
		onResidualOrder: 29,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			this.heal(pokemon.baseMaxhp / 16);
		},
		name: "Self Sufficient",
		rating: 4,
		num: 337,
		gen: 8,
	},
	tectonize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Ground";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Tectonize",
		rating: 4,
		num: 338,
		gen: 8,
	},
	iceage: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Ice")) {
				if (!pokemon.addType("Ice")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Ice",
					"[from] ability: Ice Age"
				);
			}
		},
		name: "Ice Age",
		rating: 3.5,
		num: 339,
		gen: 8,
	},
	halfdrake: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Dragon")) {
				if (!pokemon.addType("Dragon")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Dragon",
					"[from] ability: Half Drake"
				);
			}
		},
		name: "Half Drake",
		rating: 3.5,
		num: 340,
		gen: 8,
	},
	liquified: {
		onSourceModifyDamage(damage, source, target, move) {
			let mod = 1;
			if (move.type === "Water") mod *= 2;
			if (move.flags["contact"]) mod /= 2;
			return this.chainModify(mod);
		},
		isBreakable: true,
		name: "Liquified",
		rating: 3.5,
		num: 341,
		gen: 8,
	},
	dragonfly: {
		// airborneness implemented in sim/pokemon.js:Pokemon#isGrounded
		onStart(pokemon) {
			if (!pokemon.types.includes("Dragon")) {
				if (!pokemon.addType("Dragon")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Dragon",
					"[from] ability: Dragonfly"
				);
			}
		},
		isBreakable: true,
		name: "Dragonfly",
		rating: 3.5,
		num: 342,
		gen: 8,
	},
	dragonslayer: {
		onModifyDamage(damage, source, target, move) {
			if (target.getTypes().includes("Dragon")) {
				return this.chainModify(1.5);
			}
		},
		name: "Dragonslayer",
		rating: 2.5,
		num: 343,
		gen: 8,
	},
	hydrate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Water";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Hydrate",
		rating: 4,
		num: 344,
		gen: 8,
	},
	metallic: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Steel")) {
				if (!pokemon.addType("Steel")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Steel",
					"[from] ability: Metallic"
				);
			}
		},
		name: "Metallic",
		rating: 3.5,
		num: 345,
		gen: 8,
	},
	permafrost: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) {
				this.debug("Permafrost neutralize");
				return this.chainModify(0.65);
			}
		},
		isBreakable: true,
		name: "Permafrost",
		rating: 3,
		num: 346,
		gen: 8,
	},
	primalarmor: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).typeMod > 0) {
				this.debug("Primal Armor neutralize");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Primal Armor",
		rating: 4,
		num: 347,
		gen: 8,
	},
	ragingboxer: {
		// Uses parentalBond as base.
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			if (move.flags["punch"]) {
				move.multihit = 2;
				move.multihitType = "boxer";
			}
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "boxer") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Raging Boxer",
		rating: 4.5,
		num: 348,
		gen: 8,
	},
	airblower: {
		onStart(source) {
			// duration handled in data/moves.js:tailind
			const tailwind = source.side.sideConditions["tailwind"];
			if (!tailwind) {
				this.add("-activate", source, "ability: Air Blower");
				source.side.addSideCondition(
					"tailwind",
					source,
					source.getAbility()
				);
			}
		},
		name: "Air Blower",
		rating: 5,
		num: 349,
		gen: 8,
	},
	juggernaut: {
		onModifyAtkPriority: 11,
		onModifyMove(move) {
			if (move.flags["contact"]) move.secondaryOffensiveStats = [["def", 0.2]];
		},
		onUpdate(pokemon) {
			if (pokemon.status === "par") {
				this.add("-activate", pokemon, "ability: Juggernaut");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "par") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Juggernaut");
			}
			return false;
		},
		name: "Juggernaut",
		rating: 3.5,
		num: 350,
		gen: 8,
	},
	shortcircuit: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Electric") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Short Circuit boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Full Short Circuit boost");
					return this.chainModify(1.2);
				}
			}
		},
		name: "Short Circuit",
		rating: 3,
		num: 351,
		gen: 8,
	},
	majesticbird: {
		onModifySpA(atk, attacker, defender, move) {
			return this.chainModify(1.5);
		},
		name: "Majestic Bird",
		rating: 4.5,
		num: 352,
		gen: 8,
	},
	phantom: {
		onStart(pokemon) {
			if (!pokemon.types.includes("Ghost")) {
				if (!pokemon.addType("Ghost")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Ghost",
					"[from] ability: Phantom"
				);
			}
		},
		name: "Phantom",
		rating: 3.5,
		num: 353,
		gen: 8,
	},
	intoxicate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Poison";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Intoxicate",
		rating: 4,
		num: 354,
		gen: 8,
	},
	impenetrable: {
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== "Move") {
				if (effect.effectType === "Ability") { this.add("-activate", source, "ability: " + effect.name); }
				return false;
			}
		},
		name: "Impenetrable",
		rating: 4,
		num: 355,
		gen: 8,
	},
	hypnotist: {
		onModifyMovePriority: -10,
		onModifyMove(move, pokemon, target) {
			if (move.id === "hypnosis") {
				move.accuracy = 90;
			}
		},
		name: "Hypnotist",
		rating: 4,
		num: 356,
		gen: 8,
	},
	overwhelm: {
		onModifyMovePriority: -5,
		onModifyMove(move, attacker, defender) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity["Dragon"] = true;
			}
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Overwhelm",
					"[of] " + target
				);
			}
			if (effect.name === "Scare" && boost.spa) {
				delete boost.spa;
				this.add(
					"-fail",
					target,
					"unboost",
					"Special Attack",
					"[from] ability: Overwhelm",
					"[of] " + target
				);
			}
		},
		name: "Overwhelm",
		rating: 4,
		num: 357,
		gen: 8,
	},
	scare: {
		onStart(pokemon) {
			let activated = false;
			for (const target of pokemon.adjacentFoes()) {
				if (!activated) {
					this.add("-ability", pokemon, "Scare", "boost");
					activated = true;
				}
				if (target.volatiles["substitute"]) {
					this.add("-immune", target);
				} else {
					this.boost({spa: -1}, target, pokemon, null, true);
				}
			}
		},
		name: "Scare",
		rating: 3.5,
		num: 358,
		gen: 8,
	},
	majesticmoth: {
		onStart(pokemon) {
			const bestStat = pokemon.getBestStat(true, true);
			this.boost({[bestStat]: 1}, pokemon);
		},
		name: "Majestic Moth",
		rating: 4.5,
		num: 359,
		gen: 8,
	},
	souleater: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Soul Eater");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		name: "Soul Eater",
		rating: 3,
		num: 360,
		gen: 8,
	},
	soullinker: {
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (target.hp > 0) this.damage(damage, source, target);
		},
		onFoeDamagingHit(damage, target, source, move) {
			if (target.hp > 0) this.damage(damage, source, target);
		},
		name: "Soul Linker",
		rating: 4,
		num: 360,
		gen: 8,
	},
	sweetdreams: {
		onResidualOrder: 30,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.status === "slp" || pokemon.hasAbility("comatose")) {
				this.heal(pokemon.baseMaxhp / 16);
			}
		},
		name: "Sweet Dreams",
		rating: 2,
		num: 361,
		gen: 8,
	},
	badluck: {
		onFoeModifyMove(move, pokemon) {
			move.willCrit = false;

			// apparently bad luck lowers accuracy of moevs with no accuracy. fun stuff.
			if (typeof move.accuracy === "number") move.accuracy -= 5;
			if (move.accuracy === true) move.accuracy = 95;
		},
		// Low damage roll implementation is in battle-actions.ts
		name: "Bad Luck",
		rating: 2,
		num: 362,
		gen: 8,
	},
	hauntedspirit: {
		onDamagingHitOrder: 2,
		onDamagingHit(damage, target, source, move) {
			if (!target.hp && !source.getVolatile("curse")) {
				this.add("-activate", target, "Haunted Spirit");
				source.addVolatile("curse");
			}
		},
		name: "Haunted Spirit",
		rating: 3,
		num: 363,
		gen: 8,
	},
	electricburst: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Electric") {
				this.debug("Electric Burst boost");
				return this.chainModify([5529, 4096]); // ~35% boost
			}
		},

		onAfterMoveSecondaryPriority: -1,
		onAfterMoveSecondarySelf(source, target, move) {
			if (
				source &&
				source !== target &&
				move &&
				move.type === "Electric" &&
				!source.forceSwitchFlag &&
				move.totalDamage
			) {
				const ebRecoilDamage = this.clampIntRange(
					Math.round(move.totalDamage * 0.1),
					1
				);
				this.add("-activate", source, "Electric Burst");
				this.damage(ebRecoilDamage, source, source, "recoil");
			}
		},
		name: "Electric Burst",
		rating: 3,
		num: 364,
		gen: 8,
	},
	rawwood: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Grass") {
				this.debug("Raw Wood boost");
				return this.chainModify(1.2);
			}
		},
		onSourceModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Grass") {
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Raw Wood",
		rating: 3,
		num: 365,
		gen: 8,
	},
	solenoglyphs: {
		onModifyMove(move, attacker, defender) {
			if (move.category !== "Status" && move.flags["bite"]) {
				if (!move.secondaries) move.secondaries = [];
				move.secondaries.push({
					chance: 50,
					status: "tox",
					ability: this.dex.abilities.get("solenoglyphs"),
				});
			}
		},
		name: "Solenoglyphs",
		rating: 3.5,
		num: 366,
		gen: 8,
	},
	spiderlair: {
		onStart(source) {
			// duration handled in data/moves.js:stickyweb
			const hasWebs = source.side.foe.sideConditions["stickyweb"];
			if (!hasWebs) {
				// I don't think Spider Lair checks for Magic Bounce, so I get away with addSideCondition here (maybe???)
				this.add("-activate", source, "ability: Spider Lair");
				source.side.foe.addSideCondition(
					"stickyweb",
					source,
					source.getAbility()
				);
			}
		},
		name: "Spider Lair",
		rating: 4.5,
		num: 900,
		gen: 8,
	},
	fatalprecision: {
		onBeforeMove(source, target, move) {
			// uses onBeforeMove to account for switch-ins
			if (target) {
				if (target.runEffectiveness(move) > 0) {
					this.debug("Fatal Precision accuracy boost");
					move.accuracy = true;
				}
			}
		},
		onModifyDamage(damage, source, target, move) {
			if (target.runEffectiveness(move) > 0) {
				this.debug("Fatal Precision damage boost");
				return this.chainModify(1.2);
			}
		},
		name: "Fatal Precision",
		rating: 3,
		num: 368,
		gen: 8,
	},
	fortknox: {
		onAfterEachBoost(boost, target, source, effect) {
			if (!source || target.isAlly(source)) {
				if (effect.id === "stickyweb") {
					this.hint(
						"Court Change Sticky Web counts as lowering your own Speed, and Fort Knox only affects stats lowered by foes.",
						true,
						source.side
					);
				}
				return;
			}
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered) {
				this.boost({def: 3}, target, target, null, false, true);
			}
		},
		name: "Fort Knox",
		rating: 3,
		num: 369,
		gen: 8,
	},
	seaweed: {
		onModifyDamage(damage, source, target, move) {
			if (move.type === "Grass" && target.hasType("Fire")) {
				this.debug("Seaweed boost");
				return this.chainModify(2);
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.type === "Fire" && source.hasType("Grass")) {
				this.debug("Seaweed neutralize");
				return this.chainModify(0.5);
			}
		},
		isBreakable: true,
		name: "Seaweed",
		rating: 3,
		num: 370,
		gen: 8,
	},
	psychicmind: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Psychic") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Psychic Mind boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Psychic Mind boost");
					return this.chainModify(1.2);
				}
			}
		},
		name: "Psychic Mind",
		rating: 3.5,
		num: 371,
		gen: 8,
	},
	poisonabsorb: {
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Poison") {
				if (!this.heal(target.baseMaxhp / 4)) {
					this.add("-immune", target, "[from] ability: Poison Absorb");
				}
				return null;
			}
		},
		isBreakable: true,
		name: "Poison Absorb",
		rating: 3.5,
		num: 372,
		gen: 8,
	},
	scavenger: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Scavenger");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		name: "Scavenger",
		rating: 3,
		num: 360,
		gen: 8,
	},
	/**
	 * Trick room needs to only last 3 turns from this ability.
	 */
	twistdimension: {
		onStart(source) {
			if (this.field.getPseudoWeather("trickroom")) return;
			this.add("-activate", source, "ability: Twist. Dimension");
			// / Only activate trick room if it doesn't already exist, to prevent reverting an active one.
			this.field.addPseudoWeather("trickroom", source, source.getAbility());
		},
		name: "Twist. Dimension",
		rating: 5,
		num: 361,
		gen: 8,
	},
	multiheaded: {
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			const twoHeaded = [
				"doduo",
				"weezing",
				"girafarig",
				"mawile",
				"zweilous",
				"doublade",
				"binacle",
				"vanilluxe",
				"zweilous",
				"scovillain",
				"mawileredux",
				"zweilousredux",
				"doduoredux",
				"weezinggalar",
				"klink",
				"doubladeredux",
			];
			const threeHeaded = [
				"dugtrio",
				"dugtrioalola",
				"magneton",
				"dodrio",
				"exeggute",
				"exeggutor",
				"exeggutoralola",
				"mawilemega",
				"combee",
				"magnezone",
				"barbaracle",
				"hydreigon",
				"wugtrio",
				"dodrioredux",
				"hydreigonredux",
				"ironjugulis",
				"sandyshocks",
				"mawilemegaredux",
				"shucklemega",
				"magnezonemega",
				"barbaracle",
				"klinklang",
				"probopass",
				"klang",
				"hydrapple",
			];
			if (twoHeaded.includes(source.species.id)) {
				move.multihit = 2;
				move.multihitType = "parentalbond";
			}
			if (threeHeaded.includes(source.species.id)) {
				move.multihit = 3;
				move.multihitType = "headed";
			}
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "headed" && move.multihitType !== "parentalbond") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Multi Headed",
		rating: 4.5,
		num: 362,
		gen: 8,
	},
	northwind: {
		onStart(source) {
			// duration handled in data/moves.js:tailind
			const veil = source.side.sideConditions["auroraveil"];
			if (!veil) {
				this.add("-activate", source, "ability: North Wind");
				source.side.addSideCondition(
					"auroraveil",
					source,
					this.dex.abilities.get("northwind")
				);
			}
		},
		name: "North Wind",
		rating: 5,
		num: 363,
		gen: 8,
	},
	overcharge: {
		onModifyMove(move) {
			const baseEffectiveness = move.onEffectiveness;
			move.onEffectiveness = (effectiveness, target, type, usedMove) => {
				if (usedMove.type === 'Electric' && type === 'Electric') return 1;
				return baseEffectiveness?.apply(this, [effectiveness, target, type, usedMove]);
			};
		},
		// Electric type paralysis implemented in sim/pokemon.js:setStatus
		name: "Overcharge",
		rating: 3,
		num: 364,
		gen: 8,
	},
	violentrush: {
		onStart(pkmn) {
			pkmn.addVolatile("violentrush");
		},
		condition: {
			duration: 1,
			countFullRounds: true,
			onModifyAtk(atk, source, target, move) {
				return this.chainModify(1.2);
			},
			onModifySpe(spe, source) {
				return this.chainModify(1.5);
			},
		},
		name: "Violent Rush",
		rating: 3.5,
		num: 365,
		gen: 8,
	},
	flamingsoul: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Fire" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
		name: "Flaming Soul",
		rating: 1.5,
		num: 366,
		gen: 8,
	},
	sagepower: {
		onStart(pokemon) {
			pokemon.abilityState.choiceLock = "";
		},
		onBeforeMove(pokemon, target, move) {
			if (move.isZOrMaxPowered || move.id === "struggle") return;
			if (
				pokemon.abilityState.choiceLock &&
				pokemon.abilityState.choiceLock !== move.id
			) {
				// Fails unless ability is being ignored (these events will not run), no PP lost.
				this.addMove("move", pokemon, move.name);
				this.attrLastMove("[still]");
				this.debug("Disabled by Sage Power");
				this.add("-fail", pokemon);
				return false;
			}
		},
		onModifyMove(move, pokemon) {
			if (
				pokemon.abilityState.choiceLock ||
				move.isZOrMaxPowered ||
				move.id === "struggle"
			) { return; }
			pokemon.abilityState.choiceLock = move.id;
		},
		onModifyDamage(spa, pokemon, target, move) {
			if (pokemon.volatiles["dynamax"]) return;
			// PLACEHOLDER
			if (move.category !== 'Special') return;
			this.debug("Sage Power Atk Boost");
			return this.chainModify(1.5);
		},
		onDisableMove(pokemon) {
			if (!pokemon.abilityState.choiceLock) return;
			if (pokemon.volatiles["dynamax"]) return;
			for (const moveSlot of pokemon.moveSlots) {
				if (moveSlot.id !== pokemon.abilityState.choiceLock) {
					pokemon.disableMove(
						moveSlot.id,
						false,
						this.effectState.sourceEffect
					);
				}
			}
		},
		onEnd(pokemon) {
			pokemon.abilityState.choiceLock = "";
		},
		name: "Sage Power",
		rating: 4.5,
		num: 368,
		gen: 8,
	},
	bonezone: {
		onModifyMove(move) {
			if (move.flags["bone"]) {
				move.ignoreImmunity = true;
			}
		},
		onModifyDamage(damage, source, target, move) {
			if (move.flags["bone"] && target.getMoveHitData(move).typeMod < 0) {
				this.debug("Bone Zone boost");
				return this.chainModify(2);
			}
		},
		name: "Bone Zone",
		rating: 4,
		num: 368,
		gen: 8,
	},
	weathercontrol: {
		onTryHit(target, source, move) {
			if (target !== source && move.flags["weather"]) {
				this.add("-immune", target, "[from] ability: Weather Control");
				return null;
			}
		},
		name: "Weather Control",
		rating: 3,
		num: 369,
		gen: 8,
	},
	speedforce: {
		onModifyMove(move) {
			if (move.flags["contact"]) move.secondaryOffensiveStats = [["spe", 0.2]];
		},
		name: "Speed Force",
		rating: 4,
		num: 370,
		gen: 8,
	},
	seaguardian: {
		onStart(pokemon) {
			if (
				["raindance", "primordialsea"].includes(pokemon.effectiveWeather())
			) {
				const bestStat = pokemon.getBestStat(true, true);
				this.boost({[bestStat]: 1}, pokemon);
			}
		},
		name: "Sea Guardian",
		rating: 3.5,
		num: 371,
		gen: 8,
	},
	moltendown: {
		onFoeEffectiveness(typeMod, target, type, move) {
			if (type === "Rock" && move.type === "Fire") {
				return 1;
			}
		},
		name: "Molten Down",
		rating: 3,
		num: 372,
		gen: 8,
	},
	hyperaggressive: {
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			move.multihit = 2;
			move.multihitType = "parentalbond";
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "parentalbond") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Hyper Aggressive",
		rating: 4.5,
		num: 373,
		gen: 8,
	},
	flock: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Flying") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Flock Circuit boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Flock Circuit boost");
					return this.chainModify(1.2);
				}
			}
		},
		name: "Flock",
		rating: 3,
		num: 374,
		gen: 8,
	},
	fieldexplorer: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["field"]) {
				this.debug("Field Explorer boost");
				return this.chainModify(1.5);
			}
		},
		name: "Field Explorer",
		rating: 3,
		num: 375,
		gen: 8,
	},
	striker: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["kick"]) {
				this.debug("Striker boost");
				return this.chainModify(1.3);
			}
		},
		name: "Striker",
		rating: 3,
		num: 376,
		gen: 8,
	},
	frozensoul: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Ice" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
		name: "Frozen Soul",
		rating: 1.5,
		num: 377,
		gen: 8,
	},
	predator: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Predator");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		name: "Predator",
		rating: 3,
		num: 378,
		gen: 8,
	},
	looter: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Looter");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		name: "Looter",
		rating: 3,
		num: 379,
		gen: 8,
	},
	powercore: {
		onModifyMove(move) {
			if (move.category === 'Physical') move.secondaryOffensiveStats = [['def', 0.2]];
			else if (move.category === 'Special') move.secondaryOffensiveStats = [['spd', 0.2]];
		},
		name: "Power Core",
		rating: 3.5,
		num: 380,
		gen: 8,
	},
	sightingsystem: {
		onModifyMove(move) {
			move.accuracy = true;
		},
		onModifyPriority(priority, source, target, move) {
			if (typeof move.accuracy !== "boolean" && move.accuracy <= 80) {
				return priority - 3;
			}
		},
		name: "Sighting System",
		rating: 3,
		num: 381,
		gen: 8,
	},
	// badcompany: {
	//
	// },
	giantwings: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["wind"]) {
				this.debug("Giant Wings boost");
				return this.chainModify(1.25);
			}
		},
		name: "Giant Wings",
		rating: 3,
		num: 384,
		gen: 8,
	},

	grippincer: {
		onAfterMoveSecondarySelf(source, target, move) {
			if (!move || !target || source.switchFlag === true) return;
			if (
				target !== source &&
				move.flags["contact"] &&
				this.randomChance(5, 10)
			) {
				target.addVolatile(
					"partiallytrapped",
					source,
					this.dex.abilities.getByID("grippincer" as ID)
				);
			}
		},
		onModifyMove(move, pokemon, target) {
			if (target?.volatiles["partiallytrapped"]) {
				move.ignoreEvasion = true;
				move.ignoreDefensive = true;
			}
		},
		name: "Grip Pincer",
		rating: 4,
		num: 386,
		gen: 8,
	},
	bigleaves: {
		// Chlorophyll
		onModifySpe(spe, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(1.5);
			}
		},
		// Harvest
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (
				this.field.isWeather(["sunnyday", "desolateland"]) ||
				this.randomChance(1, 2)
			) {
				if (
					pokemon.hp &&
					!pokemon.item &&
					this.dex.items.get(pokemon.lastItem).isBerry
				) {
					pokemon.setItem(pokemon.lastItem);
					pokemon.lastItem = "";
					this.add(
						"-item",
						pokemon,
						pokemon.getItem(),
						"[from] ability: Big Leaves"
					);
				}
			}
		},
		// Solar Power
		onModifySpAPriority: 5,
		onModifySpA(spa, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather()) &&
					pokemon.getStat("spa", false, true) > pokemon.getStat("atk", false, true)
			) {
				return this.chainModify(1.5);
			}
		},
		onModifyAtkPriority: 5,
		onModifyAtk(spa, pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather()) &&
					pokemon.getStat("atk", false, true) >= pokemon.getStat("spa", false, true)
			) {
				return this.chainModify(1.5);
			}
		},
		// Leaf Guard
		onSetStatus(status, target, source, effect) {
			if (["sunnyday", "desolateland"].includes(target.effectiveWeather())) {
				if ((effect as Move)?.status) {
					this.add("-immune", target, "[from] ability: Big Leaves");
				}
				return false;
			}
		},
		name: "Big Leaves",
		rating: 4,
		num: 387,
		gen: 8,
	},
	precisefist: {
		onModifyMove(move) {
			if (move.flags["punch"]) {
				if (move.secondaries) {
					this.debug("doubling secondary chance");
					for (const secondary of move.secondaries) {
						if (secondary.chance) secondary.chance *= 2;
					}
				}
				if (move.secondary) {
					this.debug("doubling secondary chance");
					// TODO: Fixed an invalid reference bug here.
					// if (secondary.chance) secondary.chance *= 2;
					if (move.secondary.chance) move.secondary.chance *= 2;
				}
				if (move.self?.chance) move.self.chance *= 2;
			}
		},
		onModifyCritRatio(critRatio, source, target, move) {
			if (move.flags["punch"]) return critRatio + 1;
		},
		name: "Precise Fist",
		rating: 2.5,
		num: 388,
		gen: 8,
	},
	deadeye: {
		onModifyMove(move, pokemon, target) {
			if (!target) return;
			if (pokemon === target) return;

			move.accuracy = true;
			if (move.flags['arrow'] && move.category !== 'Status') {
				if (target.getStat('def') > target.getStat('spd')) move.category = 'Special';
				else move.category = 'Physical';
			}
		},
		name: "Deadeye",
		rating: 3.5,
		num: 389,
		gen: 8,
	},
	artillery: {
		onModifyMove(move) {
			if (move.flags["pulse"]) {
				move.accuracy = true;
				if (move.target === "normal" || move.target === "any") { move.target = "allAdjacentFoes"; }
			}
		},
		name: "Artillery",
		rating: 1.5,
		num: 390,
		gen: 8,
	},
	amplifier: {
		onModifyMove(move) {
			if (
				move.flags["sound"] &&
				(move.target === "normal" || move.target === "any")
			) {
				move.target = "allAdjacentFoes";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"]) {
				this.debug("Amplifier boost");
				return this.chainModify(1.3);
			}
		},
		name: "Amplifier",
		rating: 3.5,
		num: 391,
		gen: 8,
	},
	icedew: {
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (target !== source && move.type === "Ice") {
				if (target.getStat("atk") > target.getStat("spa")) {
					if (!this.boost({atk: 1})) {
						this.add("-immune", target, "[from] ability: Ice Dew");
					}
				} else {
					if (!this.boost({spa: 1})) {
						this.add("-immune", target, "[from] ability: Ice Dew");
					}
				}
				return null;
			}
		},
		onAllyTryHitSide(target, source, move) {
			if (source === this.effectState.target || !target.isAlly(source)) { return; }
			if (move.type === "Ice") {
				if (target.getStat("atk") > target.getStat("spa")) { this.boost({atk: 1}, this.effectState.target); } else { this.boost({spa: 1}, this.effectState.target); }
			}
		},
		isBreakable: true,
		name: "Ice Dew",
		rating: 3,
		num: 392,
		gen: 8,
	},
	sunworship: {
		onStart(pokemon) {
			if (
				["sunnyday", "desolateland"].includes(pokemon.effectiveWeather())
			) {
				const bestStat = pokemon.getBestStat(true, true);
				this.boost({[bestStat]: 1}, pokemon);
			}
		},
		name: "Sun Worship",
		rating: 3,
		num: 393,
		gen: 8,
	},
	pollinate: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Bug";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Pollinate",
		rating: 4,
		num: 394,
		gen: 8,
	},
	solarflare: {
		onModifyMove(move) {
			if (move.type === "Fire") {
				move.forceSTAB = true;
			}
		},
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Fire";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Solar Flare",
		rating: 4,
		num: 395,
		gen: 8,
	},
	lunareclipse: {
		onModifyMove(move) {
			if (move.type === "Dark" || move.type === "Fairy") {
				move.forceSTAB = true;
			}
			if (move.id === "hypnosis" && typeof move.accuracy === "number") {
				move.accuracy += 50;
			}
		},
		name: "Lunar Eclipse",
		rating: 4,
		num: 395,
		gen: 8,
	},
	// Elite Redux's Opportunist renamed to 'Expert Hunter' to avoid name confict with gen 9's Opportunist
	experthunter: {
		onFractionalPriority(priority, source, target, move) {
			if (
				(move.category === "Status" &&
					source.hasAbility("myceliummight")) ||
				!target
			) { return; } // Just in case this happens
			if (target.hp && target.hp <= target.maxhp / 2) {
				this.add("-activate", source, "ability: Expert Hunter");
				return 0.1;
			}
		},
		name: "Expert Hunter",
		rating: 4.5,
		num: 396,
		gen: 8,
	},
	mightyhorn: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["horn"]) {
				this.debug("Mighty Horn boost");
				return this.chainModify([5325, 4096]);
			}
		},
		name: "Mighty Horn",
		rating: 3,
		num: 397,
		gen: 8,
	},
	hardenedsheath: {
		onModifyMove(move) {
			if (!move?.flags["horn"]) return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 100,
				self: {
					boosts: {atk: 1},
				},
				ability: this.dex.abilities.get("hardenedsheath"),
			});
		},
		name: "Hardened Sheath",
		rating: 3,
		num: 398,
		gen: 8,
	},
	arcticfur: {
		onSourceModifyDamage(atk, attacker, defender, move) {
			return this.chainModify(0.65);
		},
		isBreakable: true,
		name: "Arctic Fur",
		rating: 3,
		num: 399,
		gen: 8,
	},
	coldrebound: {
		onDamagingHit(damage, target, source, move) {
			if (
				!(target.hp > 0) ||
				!move.flags["contact"] ||
				move.flags["counter"]
			) { return; }
			const counterMove = Dex.moves.get("icywind");
			this.add("-activate", target, "Cold Rebound");
			this.effectState.counter = true;
			this.actions.runAdditionalMove(counterMove, target, source);
		},
		onModifyMove(move) {
			if (this.effectState.counter) {
				move.flags["counter"] = 1;
				this.effectState.counter = false;
			}
		},
		isBreakable: true,
		name: "Cold Rebound",
		rating: 3,
		num: 400,
		gen: 8,
	},
	ironbarrage: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["pulse"]) {
				return this.chainModify(1.5);
			}
		},
		onModifyMove(move) {
			move.accuracy = true;
		},
		onModifyPriority(priority, source, target, move) {
			if (typeof move.accuracy !== "boolean" && move.accuracy <= 75) {
				return priority - 3;
			}
		},
		name: "Iron Barrage",
		rating: 3,
		num: 401,
		gen: 8,
	},
	steelbarrel: {
		onDamage(damage, target, source, effect) {
			// Steel beam/Mind blown modifiers in respective moves
			if (effect.id === "recoil") {
				if (!this.activeMove) throw new Error("Battle.activeMove is null");
				if (this.activeMove.id !== "struggle") return null;
			}
		},
		name: "Steel Barrel",
		rating: 3,
		num: 402,
		gen: 8,
	},
	pyroshells: {
		onAfterMove(source, target, move) {
			if (!move.flags["pulse"]) return;
			if (!move.succeeded) return;
			const moveMutations = {
				basePower: 50,
				selfdestruct: undefined,
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("outburst"),
				source,
				target,
				moveMutations
			);
		},

		name: "Pyro Shells",
		rating: 3,
		num: 403,
		gen: 8,
	},
	volcanorage: {
		onAfterMove(source, target, move) {
			if (!(move.type === "Fire")) { return; }
			if (!move.succeeded) return;
			const moveMutations = {
				basePower: 50,
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("eruption"),
				source,
				target,
				moveMutations
			);
		},
		name: "Volcano Rage",
		rating: 3,
		num: 404,
		gen: 8,
	},
	thundercall: {
		onAfterMove(source, target, move) {
			if (move.type !== "Electric") { return; }
			if (!move.succeeded) return;

			const moveMutations = {
				basePower: 120 * 0.2,
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("smite"),
				source,
				target,
				moveMutations
			);
		},
		name: "Thunder Call",
		rating: 3,
		num: 405,
		gen: 8,
	},
	marineapex: {
		onModifyMove(move) {
			move.infiltrates = true;
		},
		onModifyDamage(damage, source, target, move) {
			if (target.hasType("Water")) {
				this.debug("Marine Apex boost");
				return this.chainModify(1.5);
			}
		},

		name: "Marine Apex",
		rating: 3,
		num: 406,
		gen: 8,
	},
	discipline: {
		onAfterMove(source, target, move) {
			if (source.volatiles["lockedmove"]) {
				source.removeVolatile("lockedmove");
			}
		},
		onUpdate(pokemon) {
			if (pokemon.volatiles["confusion"]) {
				this.add("-activate", pokemon, "ability: Discipline");
				pokemon.removeVolatile("confusion");
			}
		},
		onTryAddVolatile(status, pokemon) {
			if (status.id === "confusion") return null;
		},
		onHit(target, source, move) {
			if (move?.volatileStatus === "confusion") {
				this.add(
					"-immune",
					target,
					"confusion",
					"[from] ability: Discipline"
				);
			}
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Discipline",
					"[of] " + target
				);
			}
		},

		name: "Discipline",
		rating: 3,
		num: 407,
		gen: 8,
	},
	lowblow: {
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("feintattack"),
				pokemon,
				target,
				{
					self: {},
					onDamagePriority: -20,
					onDamage: (damage: number, moveTarget: Pokemon) => {
						if (damage >= moveTarget.hp) return moveTarget.hp - 1;
					},
				},
			);
			pokemon.activeMoveActions = 0;
		},
		name: "Low Blow",
		rating: 3,
		num: 408,
		gen: 8,
	},
	nosferatu: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["contact"]) {
				return this.chainModify([4915, 4096]);
			}
		},
		onModifyMove(move) {
			if (move.flags["contact"]) {
				move.drain = [1, 3];
			}
		},
		name: "Nosferatu",
		rating: 3,
		num: 409,
		gen: 8,
	},
	spectralize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Ghost";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Spectralize",
		rating: 3,
		num: 410,
		gen: 8,
	},
	spectralshroud: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Ghost";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		onModifyMove(move) {
			if (move.target === "self" || move.category === "Status") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 30,
				status: "tox",
				ability: this.dex.abilities.get("spectralshroud"),
			});
		},
		name: "Spectral Shroud",
		rating: 3,
		num: 411,
		gen: 8,
	},
	lethargy: {
		onStart(pokemon) {
			pokemon.addVolatile("lethargy");
		},
		onEnd(pokemon) {
			delete pokemon.volatiles["lethargy"];
			this.add("-end", pokemon, "Lethargy", "[silent]");
		},
		condition: {
			onResidualOrder: 28,
			onResidualSubOrder: 2,
			onStart(target) {
				this.add("-start", target, "ability: Lethargy");
			},
			onModifyDamage(atk, pokemon) {
				const modifier = -0.2 * pokemon.activeTurns - 1 + 1;
				console.log(`attack modifier: ${modifier}`);
				return this.chainModify(modifier >= 0.2 ? modifier : 0.2);
			},
			onEnd(target) {
				this.add("-end", target, "Lethargy");
			},
		},
		name: "Lethargy",
		rating: -1,
		num: 412,
		gen: 8,
	},
	fungalinfection: {
		onAfterMove(source, target, move) {
			if (target.hasType('Grass')) return;
			if (target.hp > 0 && target !== source && move.category !== "Status") {
				if (!target.volatiles["leechseed"]) {
					this.add("-activate", source, "ability: Fungal Infection");
					target.addVolatile("leechseed", this.effectState.target);
				}
			}
		},
		name: "Fungal Infection",
		rating: 3,
		num: 413,
		gen: 8,
	},
	parry: {
		onDamagingHit(damage, defender, attacker, move) {
			if (attacker.hp <= 0) { return; }
			if (!move.flags["contact"]) { return; }

			const moveMutations = {
				flags: {...Dex.moves.get("machpunch").flags, counter: 1},
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("machpunch"),
				defender,
				attacker,
				moveMutations
			);
		},
		onSourceModifyDamage(damage, source, target, move) {
			return this.chainModify(0.8);
		},
		isBreakable: true,
		name: "Parry",
		rating: 3,
		num: 414,
		gen: 8,
	},
	roundhouse: {
		onModifyMove(move, pokemon, target) {
			if (!move.flags["kick"]) return;

			move.accuracy = true;

			if (!target) return;

			const def = target.calculateStat("def", target.boosts["def"], 1, target, pokemon, move, 0);
			const spd = target.calculateStat("spd", target.boosts["spd"], 1, target, pokemon, move, 0);

			if (def > spd) {
				move.overrideDefensiveStat = "spd";
			} else {
				move.overrideDefensiveStat = "def";
			}
		},
		name: "Roundhouse",
		rating: 3,
		num: 414,
		gen: 8,
	},
	mineralize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Rock";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Mineralize",
		rating: 4,
		num: 415,
		gen: 8,
	},
	scrapyard: {
		onDamagingHit(damage, target, source, move) {
			const side = target.side.foe;
			const spikes = side.sideConditions["spikes"];
			if (!move.flags["contact"]) return;
			if (spikes && spikes.layers >= 3) return;
			this.add("-activate", target, "ability: Scrapyard");
			side.addSideCondition("spikes", target);
		},
		name: "Scrapyard",
		rating: 3.5,
		num: 416,
		gen: 8,
	},
	loosequills: {
		onDamagingHit(damage, target, source, move) {
			const side = target.side.foe;
			const spikes = side.sideConditions["spikes"];
			if (!move.flags["contact"]) return;
			if (spikes && spikes.layers >= 3) return;
			this.add("-activate", target, "ability: Loose Quills");
			side.addSideCondition("spikes", target);
		},
		name: "Loose Quills",
		rating: 3.5,
		num: 417,
		gen: 8,
	},
	looserocks: {
		onDamagingHit(damage, target, source, move) {
			const side = target.side.foe;
			if (!move.flags["contact"]) return;
			const stealthrock = side.sideConditions["stealthrock"];
			if (stealthrock) return;
			this.add("-activate", target, "ability: Loose Rocks");
			side.addSideCondition("stealthrock", target);
		},
		name: "Loose Rocks",
		rating: 3.5,
		num: 418,
		gen: 8,
	},
	spinningtop: {
		onFoeDamagingHit(damage, target, pokemon, move) {
			if (!move.hasSheerForce && move.hit > 0 && move.type === "Fighting") {
				this.boost({spe: 1}, pokemon);
				if (pokemon.hp && pokemon.removeVolatile("leechseed")) {
					this.add(
						"-end",
						pokemon,
						"Leech Seed",
						"[from] ability: Spinning Top",
						"[of] " + pokemon
					);
				}
				const sideConditions = [
					"spikes",
					"toxicspikes",
					"stealthrock",
					"stickyweb",
					"gmaxsteelsurge",
				];
				for (const condition of sideConditions) {
					if (pokemon.hp && pokemon.side.removeSideCondition(condition)) {
						this.add(
							"-sideend",
							pokemon.side,
							this.dex.conditions.get(condition).name,
							"[from] ability: Spinning Top",
							"[of] " + pokemon
						);
					}
				}
				if (pokemon.hp && pokemon.volatiles["partiallytrapped"]) {
					pokemon.removeVolatile("partiallytrapped");
				}
			}
		},
		onAfterSubDamage(damage, target, pokemon, move) {
			if (!move.hasSheerForce && move.type === "Fighting") {
				this.add("-activate", target, "ability: Spinning Top");
				this.boost({spe: 1}, pokemon);
				if (pokemon.hp && pokemon.removeVolatile("leechseed")) {
					this.add(
						"-end",
						pokemon,
						"Leech Seed",
						"[from] move: Rapid Spin",
						"[of] " + pokemon
					);
				}
				const sideConditions = [
					"spikes",
					"toxicspikes",
					"stealthrock",
					"stickyweb",
					"gmaxsteelsurge",
				];
				for (const condition of sideConditions) {
					if (pokemon.hp && pokemon.side.removeSideCondition(condition)) {
						this.add(
							"-sideend",
							pokemon.side,
							this.dex.conditions.get(condition).name,
							"[from] ability: Spinning Top",
							"[of] " + pokemon
						);
					}
				}
				if (pokemon.hp && pokemon.volatiles["partiallytrapped"]) {
					pokemon.removeVolatile("partiallytrapped");
				}
			}
		},
		name: "Spinning Top",
		rating: 3.5,
		num: 419,
		gen: 8,
	},
	atomicburst: {
		onFoeAfterBoost(boost, target, source, effect) {
			let willBurst = false;
			const pokemon = this.effectState.target;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! > 0) {
					willBurst = true;
				}
			}

			if (!willBurst) return;

			const moveMutations = {
				basePower: 150 / 3,
				self: {},
			};

			this.actions.runAdditionalMove(
				Dex.moves.get("hyperbeam"),
				pokemon,
				source,
				moveMutations
			);
		},
		name: "Atomic Burst",
		rating: 3.5,
		num: 420,
		gen: 8,
	},
	retributionblow: {
		onFoeAfterBoost(boost, target, source, effect) {
			let willBlow = false;
			const pokemon = this.effectState.target;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! > 0) {
					willBlow = true;
				}
			}
			if (!willBlow) return;

			const moveMutations = {
				self: {},
			};

			this.actions.runAdditionalMove(
				Dex.moves.get("hyperbeam"),
				pokemon,
				source,
				moveMutations
			);
		},
		name: "Retribution Blow",
		rating: 3.5,
		num: 421,
		gen: 8,
	},
	draconize: {
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Dragon";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		name: "Draconize",
		rating: 4,
		num: 422,
		gen: 8,
	},
	fearmonger: {
		onStart(pokemon) {
			let activated = false;
			for (const target of pokemon.adjacentFoes()) {
				if (!activated) {
					this.add("-ability", pokemon, "Fearmonger", "boost");
					activated = true;
				}
				if (target.volatiles["substitute"]) {
					this.add("-immune", target);
				} else {
					this.boost({spa: -1, atk: -1}, target, pokemon, null, true);
				}
			}
		},
		onModifyMove(move) {
			if (!move?.flags["contact"] || move.target === "self") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 10,
				status: "par",
				ability: this.dex.abilities.get("fearmonger"),
			});
		},
		name: "Fearmonger",
		rating: 4,
		num: 423,
		gen: 8,
	},
	// / Seems correctly implemented per v2.1 elite redux.
	kingswrath: {
		onAllyAfterEachBoost(boost, target, source, abilitySource) {
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered && abilitySource instanceof Pokemon) {
				this.boost({atk: 1, def: 1}, abilitySource, abilitySource, null, false, true);
			}
		},
		name: "King's Wrath",
		rating: 4,
		num: 424,
		gen: 8,
	},
	// / Seems correctly implemented per v2.1 elite redux.
	queensmourning: {
		onAllyAfterEachBoost(boost, target, source, abilitySource) {
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered && abilitySource instanceof Pokemon) {
				this.boost({spa: 1, spd: 1}, abilitySource, abilitySource, null, false, true);
			}
		},
		name: "Queens's Mourning",
		rating: 4,
		num: 425,
		gen: 8,
	},
	toxicspill: {
		onResidual(pokemon) {
			if (!pokemon.hp) return;
			for (const target of [...pokemon.foes(), ...pokemon.alliesAndSelf()]) {
				if (!target.hasType("Poison")) {
					this.damage(target.baseMaxhp / 8, target, pokemon);
				}
			}
		},
		name: "Toxic Spill",
		rating: 3,
		num: 426,
		gen: 8,
	},
	desertcloak: {
		onAllySetStatus(status, target, source, effect) {
			if (["sandstorm"].includes(target.effectiveWeather())) {
				if ((effect as Move)?.status) {
					this.add("-immune", target, "[from] ability: Desert Cloak");
				}
				return false;
			}
		},
		onAllyTryAddVolatile(status, target) {
			if (
				status.id === "yawn" &&
				["sunnyday", "desolateland"].includes(target.effectiveWeather())
			) {
				this.add("-immune", target, "[from] ability: Desert Cloak");
				return null;
			}
		},
		name: "Desert Cloak",
		rating: 3,
		num: 427,
		gen: 8,
	},
	prettyprincess: {
		onModifyDamage(damage, source, target) {
			let willBoost = false;
			let i: BoostID;
			for (i in target.boosts) {
				if (target.boosts[i] && target.boosts[i] < 0) {
					willBoost = true;
				}
			}
			if (willBoost) {
				return this.chainModify(1.5);
			}
		},
		name: "Pretty Princess",
		rating: 3,
		num: 428,
		gen: 8,
	},
	selfrepair: {
		onResidualOrder: 29,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			this.heal(pokemon.baseMaxhp / 16);
		},
		onCheckShow(pokemon) {
			// This is complicated
			// For the most part, in-game, it's obvious whether or not Natural Cure activated,
			// since you can see how many of your opponent's pokemon are statused.
			// The only ambiguous situation happens in Doubles/Triples, where multiple pokemon
			// that could have Natural Cure switch out, but only some of them get cured.
			if (pokemon.side.active.length === 1) return;
			if (pokemon.showCure === true || pokemon.showCure === false) return;

			const cureList = [];
			let noCureCount = 0;
			for (const curPoke of pokemon.side.active) {
				// pokemon not statused
				if (!curPoke?.status) {
					// this.add('-message', "" + curPoke + " skipped: not statused or doesn't exist");
					continue;
				}
				if (curPoke.showCure) {
					// this.add('-message', "" + curPoke + " skipped: Natural Cure already known");
					continue;
				}
				const species = curPoke.species;
				// pokemon can't get Natural Cure
				if (!Object.values(species.abilities).includes("Self Repair")) {
					// this.add('-message', "" + curPoke + " skipped: no Natural Cure");
					continue;
				}
				// TODO: Currently, this and Natural Cure do not check for innates
				// pokemon's ability is known to be Natural Cure
				if (!species.abilities["1"] && !species.abilities["H"]) {
					// this.add('-message', "" + curPoke + " skipped: only one ability");
					continue;
				}
				// pokemon isn't switching this turn
				if (curPoke !== pokemon && !this.queue.willSwitch(curPoke)) {
					// this.add('-message', "" + curPoke + " skipped: not switching");
					continue;
				}

				if (curPoke.hasAbility("Self Repair")) {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (and is)");
					cureList.push(curPoke);
				} else {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (but isn't)");
					noCureCount++;
				}
			}

			if (!cureList.length || !noCureCount) {
				// It's possible to know what pokemon were cured
				for (const pkmn of cureList) {
					pkmn.showCure = true;
				}
			} else {
				// It's not possible to know what pokemon were cured

				// Unlike a -hint, this is real information that battlers need, so we use a -message
				this.add(
					"-message",
					"(" +
						cureList.length +
						" of " +
						pokemon.side.name +
						"'s pokemon " +
						(cureList.length === 1 ? "was" : "were") +
						" cured by Self Repair.)"
				);

				for (const pkmn of cureList) {
					pkmn.showCure = false;
				}
			}
		},
		onSwitchOut(pokemon) {
			if (!pokemon.status) return;

			// if pokemon.showCure is undefined, it was skipped because its ability
			// is known
			if (pokemon.showCure === undefined) pokemon.showCure = true;

			if (pokemon.showCure) {
				this.add(
					"-curestatus",
					pokemon,
					pokemon.status,
					"[from] ability: Natural Cure"
				);
			}
			pokemon.clearStatus();

			// only reset .showCure if it's false
			// (once you know a Pokemon has Natural Cure, its cures are always known)
			if (!pokemon.showCure) pokemon.showCure = undefined;
		},
		name: "Self Repair",
		rating: 4,
		num: 429,
		gen: 8,
	},
	hellblaze: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Fire") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Blaze boost");
					return this.chainModify(1.8);
				} else {
					this.debug("Lite Blaze boost");
					return this.chainModify(1.3);
				}
			}
		},
		name: "Hellblaze",
		rating: 4,
		num: 430,
		gen: 8,
	},
	riptide: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Water") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Riptide boost");
					return this.chainModify(1.8);
				} else {
					this.debug("Lite Riptide boost");
					return this.chainModify(1.3);
				}
			}
		},
		name: "Riptide",
		rating: 4,
		num: 431,
		gen: 8,
	},
	forestrage: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Grass") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Forest Rage boost");
					return this.chainModify(1.8);
				} else {
					this.debug("Lite Riptide boost");
					return this.chainModify(1.3);
				}
			}
		},
		name: "Forest Rage",
		rating: 4,
		num: 432,
		gen: 8,
	},
	primalmaw: {
		// Uses parentalBond as base.
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			if (move.flags["bite"]) {
				move.multihit = 2;
				move.multihitType = "maw";
			}
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "maw") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Primal Maw",
		rating: 3,
		num: 433,
		gen: 8,
	},
	sweepingedge: {
		onModifyMove(move) {
			if (move.flags["slicing"]) {
				move.accuracy = true;
				if (move.target === "normal" || move.target === "any") { move.target = "allAdjacentFoes"; }
			}
		},
		name: "Sweeping Edge",
		rating: 3,
		num: 434,
		gen: 8,
	},
	// TODO: Test Clueless
	clueless: {
		onStart(pokemon) {
			this.add("-ability", pokemon, "Clueless");
			this.eachEvent("WeatherChange", this.effect);
		},
		onEnd(pokemon) {
			this.eachEvent("WeatherChange", this.effect);
		},

		// Room suppressions implemented in getActionSpeed(), getDefenseStat(), ignoringItem(),
		suppressRoom: true,
		suppressTerrain: true,
		suppressWeather: true,
		name: "Clueless",
		rating: 3,
		num: 435,
		gen: 8,
	},
	hydrocircuit: {
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Electric") {
				return this.chainModify(1.5);
			}
		},
		onModifyMove(move) {
			if (move.type === "Water") {
				move.drain = [1, 4];
			}
		},
		name: "Hydro Circuit",
		rating: 3,
		num: 436,
		gen: 8,
	},
	giftedmind: {
		onTryHit(target, source, move) {
			const psychicWeaknesses = ["Dark", "Ghost", "Bug"];
			if (target !== source && psychicWeaknesses.includes(move.type)) {
				this.add("-immune", target, "[from] ability: Gifted Mind");
				return null;
			}
		},
		onModifyMove(move) {
			if (move.category === "Status") {
				move.accuracy = true;
			}
		},
		name: "Gifted Mind",
		rating: 3,
		num: 437,
		gen: 8,
	},
	equinox: {
		onModifyMove(move, attacker, defender) {
			if (!defender) return;

			const spa = attacker.calculateStat("spa", attacker.boosts["spa"], 1, attacker, defender, move, 0);
			const atk = attacker.calculateStat("atk", attacker.boosts["atk"], 1, attacker, defender, move, 0);
			if (spa > atk) move.overrideOffensiveStat = "spa";
			else if (atk > spa) move.overrideOffensiveStat = "atk";
		},
		name: "Equinox",
		rating: 3,
		num: 438,
		gen: 8,
	},
	absorbant: {
		onAfterMove(source, target, move) {
			if (target.hp > 0 && target !== source && move.drain) {
				if (target.hasType('Grass')) return;
				if (!target.volatiles["leechseed"]) {
					this.add("-activate", source, "ability: Absorbant");
					target.addVolatile("leechseed", this.effectState.target);
				}
			}
		},
		onModifyMove(move, target, source) {
			if (move.drain) {
				const numerator = move.drain[0] * 1.5;
				const denominator = move.drain[1];
				move.drain = [numerator, denominator];
			}
		},
		name: "Absorbant",
		rating: 3,
		num: 439,
		gen: 8,
	},
	cheatingdeath: {
		onStart(pokemon) {
			if (pokemon.activeTurns === 0 && !this.effectState.beginCD) {
				this.effectState.beginCD = true;
				this.effectState.hitsLeft = 2;
			}
		},
		onDamage(damage, mon, source, effect) {
			if (mon === source) return;
			if (damage <= 0) return;
			if (effect.effectType !== "Move") return;
			mon.permanentAbilityState["cheatingdeath"] = mon.permanentAbilityState["cheatingdeath"] || 0;
			if (mon.permanentAbilityState["cheatingdeath"] >= 2) return;
			mon.permanentAbilityState["cheatingdeath"]++;
			this.add("-activate", mon, "ability: Cheating Death");
			return 0;
		},
		name: "Cheating Death",
		rating: 3,
		num: 440,
		gen: 8,
	},
	cheaptactics: {
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("scratch"),
				pokemon,
				target,
				{
					self: {},
					onDamagePriority: -20,
					onDamage: (damage: number, moveTarget: Pokemon) => {
						if (damage >= moveTarget.hp) return moveTarget.hp - 1;
					},
				},
			);
		},
		name: "Cheap Tactics",
		rating: 3,
		num: 441,
		gen: 8,
	},
	coward: {
		onStart(pokemon) {
			if (pokemon.coward) return;
			pokemon.coward = true;
			this.actions.useMove(Dex.moves.get("protect"), pokemon);
		},
		name: "Coward",
		rating: 3,
		num: 442,
		gen: 8,
	},
	voltrush: {
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Electric" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
		name: "Volt Rush",
		rating: 3,
		num: 443,
		gen: 8,
	},
	duneterror: {
		onSourceModifyDamage(damage, source, target, move) {
			if (target.effectiveWeather() === "sandstorm") {
				this.chainModify(0.65);
			}
		},
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Ground") {
				this.debug("Dune Terror boost");
				return this.chainModify(1.2);
			}
		},
		name: "Dune Terror",
		rating: 3,
		num: 444,
		gen: 8,
	},
	infernalrage: {
		onModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Fire") {
				this.debug("Infernal Rage boost");
				return this.chainModify([5529, 4096]); // ~35% boost
			}
		},
		onAfterMoveSecondaryPriority: -1,
		onAfterMoveSecondarySelf(source, target, move) {
			if (
				source &&
				source !== target &&
				move &&
				move.type === "Fire" &&
				!source.forceSwitchFlag &&
				move.totalDamage
			) {
				const ebRecoilDamage = this.clampIntRange(
					Math.round(move.totalDamage * 0.05),
					1
				);
				this.add("-activate", source, "Infernal Rage");
				this.damage(ebRecoilDamage, source, source, "recoil");
			}
		},
		name: "Infernal Rage",
		rating: 3,
		num: 445,
		gen: 8,
	},
	radiance: {
		onSourceModifyAccuracyPriority: -1,
		onSourceModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			this.debug("radiance - enhancing accuracy");
			return this.chainModify(1.2);
		},
		onAnyTryMove(source, target, move) {
			if (move.type === "Dark") {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					this.effectState.target,
					"ability: Radiance",
					move,
					"[of] " + target
				);
				return false;
			}
		},
		name: "Radiance",
		rating: 3,
		num: 446,
		gen: 8,
	},
	atlas: {
		onStart(source) {
			if (!this.field.getPseudoWeather("gravity")) {
				this.add("-activate", source, "ability: Atlas");
				this.field.addPseudoWeather("gravity", source, source.getAbility());
			}
		},
		onFractionalPriority: -0.1,
		name: "Atlas",
		rating: 3,
		num: 447,
		gen: 8,
	},
	elementalcharge: {
		onModifyMove(move) {
			let status;
			switch (move.type) {
			case "Fire":
				status = "brn";
				break;
			case "Electric":
				status = "par";
				break;
			case "Ice":
				status = "frz";
				break;
			default:
			}
			if (status) {
				if (!move.secondaries) {
					move.secondaries = [];
				}
				move.secondaries.push({
					chance: 20,
					status: status,
					ability: this.dex.abilities.get("elementalcharge"),
				});
			}
		},
		name: "Elemental Charge",
		rating: 3,
		num: 448,
		gen: 8,
	},
	dualwield: {
		// Uses parentalBond as base.
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			if (move.flags["pulse"] || move.flags['slicing']) {
				move.multihit = 2;
				move.multihitType = "dual";
			}
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "dual") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
		name: "Dual Wield",
		rating: 3,
		num: 449,
		gen: 8,
	},
	ambush: {
		onStart(pkmn) {
			pkmn.addVolatile("ambush");
		},
		condition: {
			duration: 1,
			countFullRounds: true,
			onModifyMove(move, attacker, defender) {
				move.willCrit = true;
			},
		},
		name: "Ambush",
		rating: 3,
		num: 450,
		gen: 8,
	},
	jawsofcarnage: {
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Jaws of Carnage");
				source.heal(source.baseMaxhp / 2);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		name: "Jaws of Carnage",
		rating: 3,
		num: 451,
		gen: 8,
	},
	// Not updated since 1.6 -- looks complete
	angelswrath: {
		// oh boy, here we go
		onModifyMove(modifyMove, modifyPokemon, modifyTarget) {
			if (!modifyMove.secondaries) {
				modifyMove.secondaries = [];
			}
			switch (modifyMove.name) {
			case "Tackle":
				modifyMove.basePower = 100;
				modifyMove.secondaries.push({
					chance: 100,
					volatileStatus: "disable",
					onHit(target, source, move) {
						if (source.isActive) {
							target.addVolatile("encore", source, move);
							target.addVolatile("disable", source, move);
						}
					},
					ability: this.dex.abilities.get("angelswrath"),
				});
				break;

			case "Electroweb":
				modifyMove.basePower = 155;
				modifyMove.accuracy = true;
				modifyMove.secondaries.push({
					chance: 100,
					onHit(target, source, move) {
						if (source.isActive) {
							target.addVolatile(
								"trapped",
								target,
								this.dex.abilities.get("angelswrath"),
								"trapper"
							);
							this.boost({spe: -12}, target);
						}
					},
					ability: this.dex.abilities.get("angelswrath"),
				});
				break;

			case "Bug Bite":
				modifyMove.basePower = 140;
				modifyMove.drain = [1, 1];
				modifyMove.onAfterHit = (target, source) => {
					if (source.hp) {
						const item = target.takeItem();
						if (item) {
							this.add(
								"-enditem",
								target,
								item.name,
								"[from] ability: Angel's Wrath",
								"[of] " + source
							);
						}
					}
				};
				break;

			case "Poison Sting":
				modifyMove.basePower = 120;
				modifyMove.secondaries.push({
					chance: 100,
					status: "tox",
					ability: this.dex.abilities.get("angelswrath"),
				});
				modifyMove.onEffectiveness = (typeMod, target, type) => {
					if (type === "Steel") return 1;
				};
				if (!modifyMove.ignoreImmunity) modifyMove.ignoreImmunity = {};
				if (modifyMove.ignoreImmunity !== true) {
					modifyMove.ignoreImmunity["Poison"] = true;
				}
				break;

			case "String Shot":
				modifyMove.onAfterMove = (source, target, move) => {
					if (move.hit >= 1) {
						const sideConditions = [
							"spikes",
							"toxicspikes",
							"stealthrock",
							"stickyweb",
							"gmaxsteelsurge",
						];
						this.add("-activate", source, "ability: Angel's Wrath");
						for (const condition of sideConditions) {
							source.side.foe.addSideCondition(condition);
						}
					}
				};
				break;
			case "Harden":
				modifyMove.onAfterMove = (source, target, move) => {
					this.add("-activate", source, "ability: Angel's Wrath");
					this.boost(
						{
							atk: 1,
							spa: 1,
							spd: 1,
							def: 1,
							spe: 1,
							accuracy: 1,
							evasion: 1,
						},
						source
					);
				};
				break;
			case "Iron Defense":
				modifyMove.priority = 4;
				modifyMove.onAfterMove = (source, target, move) => {
					// Executes special Angel's Shield
					this.add("-activate", target, "ability: Angel's Wrath");
					this.actions.useMove(Dex.moves.get("angelsshield"), source);
				};
			}
		},
		onModifyPriority(priority, source, target, move) {
			// Special Case to ensure Iron Defense has Protect Priority
			if (move.name === "Iron Defense") {
				return priority + 4;
			}
		},
		name: "Angel's Wrath",
		rating: 3,
		num: 452,
		gen: 8,
	},

	prismaticfur: {
		onModifyDefPriority: 6,
		onSourceModifyDamage(damage, source, target, move) {
			return this.chainModify(0.5);
		},
		// Protean
		onPrepareHit(source, target, move) {
			if (
				move.hasBounced ||
				move.flags["futuremove"] ||
				move.sourceEffect === "snatch"
			) { return; }
			const type = move.type;
			if (type && type !== "???" && source.getTypes().join() !== type) {
				if (!source.setType(type)) return;
				this.add(
					"-start",
					source,
					"typechange",
					type,
					"[from] ability: Prismatic Fur"
				);
			}
		},
		// Color Change
		onFoePrepareHit(source, target, move) {
			let bestType;
			let bestTypeMod = 0;
			let typeMod;
			for (const type of this.dex.types.all()) {
				if (!this.dex.getImmunity(move.type, type.id)) {
					// breaks, as immunity is strongest resistance possible
					bestType = type.name;
					break;
				}
				typeMod = this.dex.getEffectiveness(move.type, type.name);
				if (typeMod < bestTypeMod) {
					bestType = type.name;
					bestTypeMod = typeMod;
				}
			}
			if (
				source !== target &&
				bestType &&
				!target.getTypes().includes(bestType)
			) {
				if (!target.setType(bestType)) return;
				this.add(
					"-start",
					target,
					"typechange",
					bestType,
					"[from] ability: Prismatic Fur"
				);
			}
		},
		name: "Prismatic Fur",
		rating: 5,
		num: 453,
		gen: 8,
	},
	faehunter: {
		onModifyDamage(damage, source, target, move) {
			if (target.hasType("Fairy")) {
				this.debug("Fae Hunter boost");
				return this.chainModify(1.5);
			}
		},
		name: "Fae Hunter",
		rating: 3,
		num: 454,
		gen: 8,
	},
	gravitywell: {
		onStart(source) {
			if (!this.field.getPseudoWeather("gravity")) {
				this.add("-activate", source, "ability: Gravity Well");
				this.field.addPseudoWeather("gravity", source, source.getAbility());
			}
		},
		name: "Gravity Well",
		rating: 3,
		num: 454,
		gen: 8,
	},
	shockingjaws: {
		name: "Shocking Jaws",
		rating: 3,
		num: 455,
		gen: 8,
		onModifyMove(move, mon, target) {
			if (!move?.flags["bite"]) return;
			if (move.secondaries) move.secondaries = [];
			move.secondaries?.push({
				chance: 50,
				status: "par",
				ability: this.dex.abilities.get("shockingjaws"),
			});
		},
	},
	cryomancy: {
		name: "Cryomancy",
		rating: 3,
		num: 456,
		gen: 8,
		onModifyMovePriority: -2,
		onModifyMove(move) {
			if (!move.secondaries) return;
			for (const secondary of move.secondaries) {
				if (secondary.status?.includes("frz") && secondary.chance && !secondary.ability) { secondary.chance *= 5; }
			}
		},
	},
	phantompain: {
		name: "Phantom Pain",
		rating: 3,
		num: 457,
		gen: 8,
		onModifyMovePriority: -5,
		onModifyMove(move) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (
				move.ignoreImmunity !== true &&
				!Object.keys(move.ignoreImmunity).includes("Ghost")
			) {
				move.ignoreImmunity["Ghost"] = true;
			}
		},
	},
	purgatory: {
		name: "Purgatory",
		rating: 3,
		num: 458,
		gen: 8,
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Ghost") {
				if (attacker.hp <= attacker.maxhp / 3) {
					return this.chainModify(1.8);
				} else {
					return this.chainModify(1.3);
				}
			}
		},
	},
	emanate: {
		name: "Emanate",
		rating: 3,
		num: 459,
		gen: 8,
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Psychic";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
	},
	monkeybusiness: {
		name: "Monkey Business",
		rating: 3,
		num: 460,
		gen: 8,
		onStart(pokemon) {
			this.debug("Monkey switches in");
			let targetLoc = 4;
			pokemon.side.foes().forEach((a) => {
				if (pokemon.getLocOf(a) < targetLoc) { targetLoc = pokemon.getLocOf(a); }
			});
			if (targetLoc < 4 && targetLoc > 0) {
				this.boost({atk: -1, def: -1}, pokemon.side.foes()[targetLoc], pokemon, null, true);
				this.add("-ability", pokemon, "Monkey Business", "boost");
			}
		},
	},

	// CAP
	mountaineer: {
		onDamage(damage, target, source, effect) {
			if (effect && effect.id === "stealthrock") {
				return false;
			}
		},
		onTryHit(target, source, move) {
			if (move.type === "Rock" && !target.activeTurns) {
				this.add("-immune", target, "[from] ability: Mountaineer");
				return null;
			}
		},
		isNonstandard: "CAP",
		isBreakable: true,
		name: "Mountaineer",
		rating: 3,
		num: -2,
	},
	rebound: {
		isNonstandard: "CAP",
		name: "Rebound",
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (this.effectState.target.activeTurns) return;

			if (
				target === source ||
				move.hasBounced ||
				!move.flags["reflectable"]
			) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			this.actions.useMove(newMove, target, source);
			return null;
		},
		onAllyTryHitSide(target, source, move) {
			if (this.effectState.target.activeTurns) return;

			if (
				target.isAlly(source) ||
				move.hasBounced ||
				!move.flags["reflectable"]
			) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			this.actions.useMove(newMove, this.effectState.target, source);
			return null;
		},
		condition: {
			duration: 1,
		},
		isBreakable: true,
		rating: 3,
		num: -3,
	},
	persistent: {
		isNonstandard: "CAP",
		name: "Persistent",
		// implemented in the corresponding move
		rating: 3,
		num: -4,
	},
	evaporate: {
		onTryHit(target, source, move) {
			if (!move.type.toLowerCase().includes("water")) return;
			this.add("-immune", target, "[from] ability: Evaporate");
			this.add("-activate", target, "move: Mist");
			target.side.addSideCondition("mist");
			return null;
		},
		name: "Evaporate",
		shortDesc: "Takes no damage and sets Mist if hit by water.",
	},
	lumberjack: {
		name: "Lumberjack",
		shortDesc: "1.5x damage to Grass types.",
		onModifyDamage(atk, attacker, defender, move) {
			if (!defender.types.find((type) => type.toLowerCase().includes("grass"))) { return; }
			this.debug("lumberjack boost");
			return this.chainModify(1.5);
		},
	},
	furnace: {
		name: "Furnace",
		shortDesc: "User gains +2 speed when hit by rocks",
		onDamagingHit(damage, target, source, move) {
			if (!damage || !move.type.toLowerCase().includes("rock")) return;
			this.boost(
				{spe: 2},
				target,
				target,
				this.dex.abilities.get("furnace")
			);
		},
	},
	ragingmoth: {
		name: "Raging Moth",
		shortDesc: "Fire moves hit twice, both hits at 75% power.",
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			move.multihit = 2;
			move.multihitType = "ragingmoth";
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "ragingmoth") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
	},
	adrenalinerush: {
		name: "Adrenaline Rush",
		shortDesc: "KOs raise speed by +1.",
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost(
					{spe: 1},
					source,
					source,
					this.dex.abilities.get("adrenalinerush")
				);
			}
		},
	},
	cryoproficiency: {
		name: "Cryo Proficiency",
		shortDesc: "Triggers hail when hit. 30% chance to frostbite on contact.",
		onDamagingHit(damage, target, source, move) {
			if (this.randomChance(3, 10)) {
				source.trySetStatus("frz", target, target.getAbility());
			}

			this.field.setWeather("hail");
		},
	},
	/**
	 * New voodoo power ability which sets the bleed condition with a 30% chance on hit by special attack.
	 */
	voodoopower: {
		name: "Voodoo Power",
		shortDesc: "30% chance to bleed when hit by special attacks.",
		/**
		 * This is called right after the pokemon with this ability is hit by a damaging move.
		 * In this case, the target is the pokemon with the ability, and the source is the user that damaged us.
		 * Hence, we add the bleed status to the source if the conditions are right.
		 * Here, we check the logic for applying bleed with the right input conditions.
		 */
		onDamagingHit(damage, target, source, move) {
			/**
			 * Handle type immunities to bleed (rock and ghost as of v2.1).
			 * Weirdly, this function call returns true if the type is NOT immune, despite it's name.
			 */
			if (!this.dex.getImmunity("bld", source)) return;
			if (move.category !== "Special") return;
			/**
			 * This check prevents additional ability activation messages and failure messages
			 * from trying to activate bleed on a pokemon who is already bleeding.
			 */
			if (source.status === "bld") return;
			/**
			 * This ability has a 30% chance to activate, here we short circuit if that random chance fails.
			 */
			if (!this.randomChance(3, 10)) return;
			/**
			 * Popup an ability activation message before we bleed the move's source,
			 * which indicates why the user bleed.
			 */
			this.add("-activate", target, "ability: Voodoo Power");
			/**
			 * Add the actual status to the target. In theory even though we're using "try" setStatus,
			 * our checks should guarantee success.
			 * There are several other variations of adding statuses to pokemon from abilities,
			 * but this was the only one that gave good success with not random poorly formatted status messages
			 * popping up in the battle log as a result.
			 */
			source.trySetStatus(
				"bleed",
				target,
				this.dex.abilities.get("voodoopower")
			);
		},
	},
	spikearmor: {
		name: "Spike Armor",
		shortDesc: "30% chance to bleed on contact.",
		onDamagingHit(damage, target, source, move) {
			if (!this.dex.getImmunity("bld", source)) return;
			if (!move.flags["contact"]) return;
			if (!this.randomChance(3, 10)) return;
			if (source.status === "bld") return;
			this.add("-activate", target, "ability: Spike Armor");
			source.trySetStatus(
				"bld",
				target,
				this.dex.abilities.get("spikearmor")
			);
		},
	},
	fairytale: {
		name: "Fairy Tale",
		shortDesc: "Adds Fairy type to itself.",
		onStart(pokemon) {
			if (!pokemon.types.includes("Fairy")) {
				if (!pokemon.addType("Fairy")) return;
				this.add(
					"-start",
					pokemon,
					"typeadd",
					"Fairy",
					"[from] ability: Fairy Tale"
				);
			}
		},
	},
	kunoichisblade: {
		name: "Kunoichi's Blade",
		shortDesc:
			"Boost weaker moves and increases the frequency of multi-hit moves.",
		// / Technician
		onModifyDamage(basePower, attacker, defender, move) {
			const basePowerAfterMultiplier = this.modify(
				basePower,
				this.event.modifier
			);
			this.debug("Base Power: " + basePowerAfterMultiplier);
			if (basePowerAfterMultiplier <= 60) {
				this.debug("Technician boost");
				return this.chainModify(1.5);
			}
		},
		// / Skill Link
		onModifyMove(move) {
			if (
				move.multihit &&
				Array.isArray(move.multihit) &&
				move.multihit.length
			) {
				move.multihit = move.multihit[1];
			}
			if (move.multiaccuracy) {
				delete move.multiaccuracy;
			}
		},
	},
	combatspecialist: {
		name: "Combat Specialist",
		shortDesc: "Boost the power of punching and kicking moves by 1.3x.",
		// / Iron Fist
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["punch"]) {
				this.debug("Iron Fist boost");
				return this.chainModify(1.3);
			}
			if (move.flags["kick"]) {
				this.debug("Striker boost");
				return this.chainModify(1.3);
			}
		},
	},
	// / This is just copied from flower veil which seemed to behave the same.
	junglesguard: {
		name: "Jungle's Guard",
		shortDesc:
			"Grass-types on user side: immune to status/stat drops from enemy.",
		onAllyTryBoost(boost, target, source, effect) {
			if ((source && target === source) || !target.hasType("Grass")) return;
			let showMsg = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					delete boost[i];
					showMsg = true;
				}
			}
			if (showMsg && !(effect as ActiveMove).secondaries) {
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Jungle's Guard",
					"[of] " + effectHolder
				);
			}
		},
		onAllySetStatus(status, target, source, effect) {
			if (
				target.hasType("Grass") &&
				source &&
				target !== source &&
				effect &&
				effect.id !== "yawn"
			) {
				this.debug("interrupting setStatus with Jungle Guard");
				if (
					effect.name === "Synchronize" ||
					(effect.effectType === "Move" && !effect.secondaries)
				) {
					const effectHolder = this.effectState.target;
					this.add(
						"-block",
						target,
						"ability: Jungle's Guard",
						"[of] " + effectHolder
					);
				}
				return null;
			}
		},
		onAllyTryAddVolatile(status, target) {
			if (target.hasType("Grass") && status.id === "yawn") {
				this.debug("Jungles Guard blocking yawn");
				const effectHolder = this.effectState.target;
				this.add(
					"-block",
					target,
					"ability: Jungle's Guard",
					"[of] " + effectHolder
				);
				return null;
			}
		},
	},
	huntershorn: {
		name: "Hunter's Horn",
		shortDesc: "Boost horn moves and heals 1/4 hp when defeating an enemy.",
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Hunter's Horn");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
		// / TODO: What should the modifier for hunter's horn be?
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["horn"]) {
				this.debug("Hunter's horn boost");
				return this.chainModify(1.3);
			}
		},
	},
	pixiepower: {
		name: "Pixie Power",
		shortDesc: "Boosts Fairy moves by 33% and 1.2x accuracy.",
		// / Display pixie power activation message.
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Pixie Power");
		},
		// / Fairy Aura boost.
		onAnyModifyDamage(basePower, source, target, move) {
			if (
				target === source ||
				move.category === "Status" ||
				move.type !== "Fairy"
			) { return; }
			if (!move.auraBooster?.hasAbility("Pixie Power")) { move.auraBooster = this.effectState.target; }
			if (move.auraBooster !== this.effectState.target) return;
			// / TODO: Should aura break cancel this?
			return this.chainModify([move.hasAuraBreak ? 3072 : 5448, 4096]);
		},
		// / Modified Compound Eyes boost.
		onAnyModifyAccuracyPriority: -1,
		onAnyModifyAccuracy(accuracy, target, source, move) {
			if (typeof accuracy !== "number") return;
			// / TODO: Does the accuracy boost only apply to fairy type moves?
			if (move.type !== "Fairy") return;
			this.debug("pixiepower - enhancing accuracy");
			return this.chainModify(1.2);
		},
	},
	plasmalamp: {
		name: "Plasma Lamp",
		shortDesc:
			"Boost accuracy & power of Fire and Electric type moves by 1.2x.",
		onStart(pokemon) {
			if (this.suppressingAbility(pokemon)) return;
			this.add("-ability", pokemon, "Plasma Lamp");
		},
		// / Plasma Lamp boost.
		onSourceModifyDamage(atk, attacker, defender, move) {
			if (move.type === "Electric" || move.type === "Fire") {
				this.debug("Plasma Lamp boost");
				return this.chainModify(1.2);
			}
		},
		// / Modified Compound Eyes boost.
		onSourceModifyAccuracy(accuracy, target, source, move) {
			if (typeof accuracy !== "number") return;
			if (move.type !== "Fire" && move.type !== "Electric") return;
			this.debug("plasma lamp - enhancing accuracy");
			return this.chainModify(1.2);
		},
	},
	magmaeater: {
		name: "Magma Eater",
		shortDesc: "Combines Predator & Molten Down.",
		// / Molten Down
		onFoeEffectiveness(typeMod, target, type, move) {
			if (type === "Rock" && move.type === "Fire") {
				return 1;
			}
		},
		// / Predator
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.add("-activate", source, "Predator");
				source.heal(source.baseMaxhp / 4);
				this.add("-heal", source, source.getHealth, "[silent]");
			}
		},
	},
	superhotgoo: {
		name: "Super Hot Goo",
		shortDesc: "Inflicts burn and lower the speed on contact.",
		// / Gooey.
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.add("-ability", target, "Gooey");
				this.boost({spe: -1}, source, target, null, true);
			}

			if (this.checkMoveMakesContact(move, source, target)) {
				// TODO: Is this a random chance like flame body or guaranteed?
				// if (this.randomChance(3, 10)) {
				source.trySetStatus("brn", target);
				// }
			}
		},
	},
	nika: {
		name: "Nika",
		shortDesc: "Iron fist + Water moves function normally under sun.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["punch"]) {
				this.debug("Iron Fist boost");
				this.chainModify(1.3);
			}

			if (move.type === "Water" && this.field.weather === "sunnyday") {
				this.debug("water sun boost offset");
				this.chainModify(1.5);
			}
		},
	},
	mindcrush: {
		name: "Mind Crush",
		shortDesc: "Biting moves use SpAtk and deal 50% more damage.",
		onModifyMove(move) {
			if (move.flags["bite"]) {
				move.overrideOffensiveStat = "spa";
			}
		},
		onModifyDamage(bp, source, target, move) {
			if (move.flags["bite"]) {
				this.chainModify(1.5);
			}
		},
	},
	vengefulspirit: {
		name: "Vengeful Spirit",
		shortDesc: "Haunted Spirit + Vengeance.",
		// Haunted Spirit
		onDamagingHitOrder: 2,
		onDamagingHit(damage, target, source, move) {
			if (!target.hp && !source.getVolatile("curse")) {
				this.add("-activate", target, "Haunted Spirit");
				source.addVolatile("curse");
			}
		},
		// Vengeance
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Ghost") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Full Vengeance boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Lite Vengeance boost");
					return this.chainModify(1.2);
				}
			}
		},
	},
	// TODO: test this shit because it definitely doesn't work
	tacticalretreat: {
		name: "Tactical Retreat",
		shortDesc: "Flees when stats are lowered.",
		onAfterEachBoost(boost, target, source, effect) {
			if (target.permanentAbilityState['tacticalretreat']) return;
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered) {
				if (
					!this.canSwitch(target.side) ||
					target.forceSwitchFlag ||
					target.switchFlag
				) { return; }
				for (const side of this.sides) {
					for (const active of side.active) {
						active.switchFlag = false;
					}
				}
				target.permanentAbilityState['tacticalretreat'] = true;
				target.switchFlag = true;
				this.add("-activate", target, "ability: Tactical Retreat");
			}
		},
	},
	tidalrush: {
		name: "Tidal Rush",
		shortDesc: "Water moves get +1 priority. Requires full HP.",
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Water" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
	},
	guilttrip: {
		name: "Guilt Trip",
		shortDesc: "Sharply lowers attacker's Attack and SpAtk when fainting.",
		onDamagingHitOrder: 2,
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) {
				this.add("-ability", target, "Guilt Trip");
				this.boost({spa: -2}, source, target, null, true);
				this.boost({atk: -2}, source, target, null, true);
			}
		},
	},
	stygianrush: {
		name: "Stygian Rush",
		shortDesc: "Dark moves get +1 priority. Requires full HP.",
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Dark" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
	},
	readiedaction: {
		name: "Readied Action",
		shortDesc: "Doubles attack on first turn.",
		onStart(pkmn) {
			pkmn.addVolatile("readiedaction");
		},
		condition: {
			duration: 1,
			countFullRounds: true,
			onModifyAtk(atk, source, target, move) {
				return this.chainModify(2.0);
			},
		},
	},
	subdue: {
		name: "Subdue",
		shortDesc: "Doubles the power of stat dropping moves.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.secondaries) {
				for (const secondary of move.secondaries) {
					if (secondary.boosts) {
						let i: BoostID;
						for (i in secondary.boosts) {
							if (secondary.boosts[i] && secondary.boosts[i]! < 0) {
								return this.chainModify(2.0);
							}
						}
					}
				}
			}
			if (move.secondary) {
				if (move.secondary.boosts) {
					let i: BoostID;
					for (i in move.secondary.boosts) {
						if (
							move.secondary.boosts[i] &&
							move.secondary.boosts[i]! < 0
						) {
							return this.chainModify(2.0);
						}
					}
				}
			}
		},
	},
	crownedsword: {
		name: "Crowned Sword",
		shortDesc: "Combines Intrepid Sword & Anger Point",
		onStart(pokemon) {
			if (this.effectState.swordBoost) return;
			this.effectState.swordBoost = true;
			this.boost({atk: 1}, pokemon);
		},
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (target === source) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({atk: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({atk: 1}, target, target);
			}
		},
	},
	crownedshield: {
		name: "Crowned Shield",
		shortDesc: "Combines Dauntless Shield & Stamina",
		onStart(pokemon) {
			if (this.effectState.shieldBoost) return;
			this.effectState.shieldBoost = true;
			this.boost({def: 1}, pokemon);
		},
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (target === source) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({def: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({def: 1}, target, target);
			}
		},
	},
	crownedking: {
		name: "Crowned King",
		shortDesc: "Combines Unnerve & Grim Neigh & Chilling Neigh",
		onPreStart(pokemon) {
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onStart(pokemon) {
			if (this.effectState.unnerved) return;
			this.add("-ability", pokemon, "Unnerve");
			this.effectState.unnerved = true;
		},
		onEnd() {
			this.effectState.unnerved = false;
		},
		onFoeTryEatItem() {
			return !this.effectState.unnerved;
		},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({spa: length}, source);
				this.boost({atk: length}, source);
			}
		},
	},

	berserkDNA: {
		name: "Berserk DNA",
		shortDesc: "Sharply ups highest attacking stat but confuses on entry.",
		onStart(pokemon) {
			if (pokemon.getStat("atk") > pokemon.getStat("spa")) {
				this.boost({atk: 2}, pokemon);
			} else {
				this.boost({spa: 2}, pokemon);
			}
			pokemon.trySetStatus("confusion");
		},
	},

	claptrap: {
		name: "Clap Trap",
		shortDesc: "Counters contact with 50BP Snap Trap.",
		onDamagingHit(damage, target, source, move) {
			if (!this.checkMoveMakesContact(move, source, target)) {
				const moveMutations = {
					basePower: 100 / 2,
					self: {},
				};

				this.actions.runAdditionalMove(
					Dex.moves.get("snaptrap"),
					target,
					source,
					moveMutations
				);
			}
		},
	},
	permanence: {
		name: "Permanence",
		shortDesc: "Foes can't heal in any way.",
		onStart(source) {
			for (const foe of source.foes()) {
				foe.addVolatile(
					"healingblocked",
					this.effectState.target,
					Dex.abilities.get("permanence"),
					"healingblocked"
				);
			}
		},
		onFoeSwitchIn(foe) {
			foe.addVolatile(
				"healingblocked",
				this.effectState.target,
				Dex.abilities.get("permanence"),
				"healingblocked"
			);
		},
		onEnd(source) {
			for (const foe of source.foes()) {
				foe.removeVolatile("healingblocked");
			}
		},
	},
	hubris: {
		name: "Hubris",
		shortDesc: "KOs raise SpA by +1.",
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({spa: length}, source);
			}
		},
	},
	cosmicdaze: {
		name: "Cosmic Daze",
		shortDesc: "2x damage vs confused. Enemies take 2x confusion damage.",
		onFoeModifyDamage(damage, source, target, move) {
			if (move.name === "confused") {
				return this.chainModify(2);
			}
		},
		onModifyDamage(damage, source, target, move) {
			if (target.status === "confusion") {
				return this.chainModify(2);
			}
		},
	},

	mindseye: {
		name: "Mind's Eye",
		shortDesc: "Hits Ghost-type Pokémon. Accuracy can't be lowered.",
		onModifyMove(move) {
			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity["Fighting"] = true;
				move.ignoreImmunity["Normal"] = true;
			}
		},
	},

	bloodprice: {
		name: "Blood Price",
		shortDesc: "Does 30% more damage but lose 10% HP when attacking.",
		onModifyDamage(damage, source, target, move) {
			return this.chainModify(1.3);
		},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				this.damage(source.baseMaxhp / 10, source, source);
			}
		},
	},
	egoist: {
		name: "Egoist",
		shortDesc: "Raises its own stats when foes raise theirs.",
		onFoeAfterBoost(boost, target, source, effect) {
			this.boost(boost, this.effectState.target);
		},
	},
	terminalvelocity: {
		name: "Terminal Velocity",
		shortDesc: "Special moves use 20% of its Speed stat additionally.",
		onModifyMove(move) {
			if (!move.flags["contact"]) move.secondaryOffensiveStats = [["spe", 0.2]];
		},
	},
	monsterhunter: {
		name: "Monster Hunter",
		shortDesc: "Deals 1.5x damage to Dark-types.",
		onModifyDamage(damage, source, target, move) {
			if (target.hasType("Dark")) {
				return this.chainModify(1.5);
			}
		},
	},
	flamingjaws: {
		name: "Flaming Jaws",
		shortDesc: "Biting moves have 50% chance to burn the target.",
		onModifyMove(move, mon, target) {
			if (!move?.flags["bite"]) return;
			if (move.secondaries) move.secondaries = [];
			move.secondaries?.push({
				chance: 50,
				status: "brn",
			});
		},
	},
	bassboosted: {
		name: "Bass Boosted",
		shortDesc: "Combines Amplifier & Punk Rock.",
		onModifyMove(move) {
			if (
				move.flags["sound"] &&
				(move.target === "normal" || move.target === "any")
			) {
				move.target = "allAdjacentFoes";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"]) {
				this.debug("Amplifier boost");
				this.chainModify(1.3);
				this.debug("Punk Rock boost");
				return this.chainModify([5325, 4096]);
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.flags["sound"]) {
				this.debug("Punk Rock weaken");
				return this.chainModify(0.5);
			}
		},
	},
	earlygrave: {
		name: "Early Grave",
		shortDesc:
			"At full HP, gives +1 priority to this Pokémon's Ghost-type moves.",
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.type === "Ghost" && pokemon.hp === pokemon.maxhp) { return priority + 1; }
		},
	},
	phantomthief: {
		name: "Phantom Thief",
		shortDesc: "Uses 40BP Spectral Thief on switch-in.",
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("feintattack"),
				pokemon,
				target,
				{
					basePower: 40,
					self: {},
					onDamagePriority: -20,
					onDamage: (damage: number, moveTarget: Pokemon) => {
						if (damage >= moveTarget.hp) return moveTarget.hp - 1;
					},
				},
			);
		},
	},
	devourer: {
		name: "Devourer",
		shortDesc: "Combines Strong Jaw & Primal Maw.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["bite"]) {
				return this.chainModify(1.5);
			}
		},
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }
			if (move.flags["bite"]) {
				move.multihit = 2;
				move.multihitType = "maw";
			}
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "maw") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.volatileStatus !== "flinch" || effect.ability || effect.kingsrock);
			return secondaries;
		},
	},
	fortitude: {
		name: "Fortitude",
		shortDesc: "Boosts SpDef +1 when hit. Maxes SpDef on crit.",
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({spd: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({spd: 1}, target, target);
			}
		},
	},
	spiteful: {
		name: "Spiteful",
		shortDesc: "Reduces attacker's PP on contact.",
		onDamagingHit(damage, target, source, move) {
			if (move.flags["contact"]) {
				if (source.lastMove) {
					if (source.lastMove.pp > 0) {
						source.lastMove.pp = Math.max(source.lastMove.pp - 5, 0);
					}
				}
			}
		},
	},
	twostep: {
		name: "Two Step",
		shortDesc: "Triggers 50BP Revelation Dance after using a Dance move.",
		onAfterMove(source, target, move) {
			if (!move.flags["dance"]) return;
			if (!move.succeeded) return;
			const moveMutations = {
				basePower: 50,
			};
			if (target === source) {
				const foe = source.side.randomFoe();
				if (!foe) return;
				target = foe;
			}
			this.actions.runAdditionalMove(
				Dex.moves.get("revelationdance"),
				source,
				target,
				moveMutations
			);
		},
	},
	impulse: {
		name: "Impulse",
		shortDesc: "Non-contact moves use the Speed stat for damage.",
		onModifyMove(move) {
			if (!move.flags["contact"]) {
				move.overrideOffensiveStat = "spe";
			}
		},
	},
	saltcircle: {
		name: "Salt Circle",
		shortDesc: "Prevents opposing pokemon from fleeing on entry.",
		onStart(pokemon) {
			for (const target of pokemon.side.foe.active) {
				target.tryTrap(true);
			}
		},
	},
	airborne: {
		name: "Airborne",
		shortDesc: "Boosts own & ally's Flying-type moves by 1.3x.",
		onAllyModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Flying") {
				this.debug("Airborne boost");
				return this.chainModify(1.3);
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Flying") {
				this.debug("Airborne boost");
				return this.chainModify(1.3);
			}
		},
	},
	showdownmode: {
		name: "Showdown Mode",
		shortDesc: "Combines Ambush & Violent Rush.",
		onStart(pkmn) {
			pkmn.addVolatile("showdownmode");
		},
		condition: {
			duration: 1,
			countFullRounds: true,
			onModifyMove(move, attacker, defender) {
				move.willCrit = true;
			},
			onModifyAtk(atk, source, target, move) {
				return this.chainModify(1.2);
			},
			onModifySpe(spe, source) {
				return this.chainModify(1.5);
			},
		},
	},
	webspinner: {
		name: "Web Spinner",
		shortDesc: "Uses String Shot on switch-in.",
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("stringshot"),
				pokemon,
				target,
				{self: {}},
			);
		},
	},
	banshee: {
		name: "Banshee",
		shortDesc: "Normal-type sound moves become Ghost- type moves and get a 1.2x boost.",
		onModifyType(move, pokemon) {
			if (move.flags["sound"] && move.type === "Normal" && !pokemon.volatiles["dynamax"]) {
				// hardcode
				move.type = "Ghost";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["sound"] && move.typeChangerBoosted) {
				return this.chainModify(1.2);
			}
		},
	},
	chromecoat: {
		name: "Chrome Coat",
		shortDesc:
			"Reduces special damage taken by 40%, but decreases Speed by 10%.",
		onModifyDamage(damage, source, target, move) {
			if (move.category === "Special") {
				return this.chainModify(0.6);
			}
		},
		onModifySpe(spe, pokemon) {
			return this.chainModify(0.9);
		},
	},
	monstermash: {
		name: "Monster Mash",
		shortDesc: "Casts Trick-or-Treat on entry.",
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("trickortreat"),
				pokemon,
				target,
				{self: {}},
			);
		},
	},
	powderburst: {
		name: "Powder Burst",
		shortDesc: "Casts Powder on entry.",
		onStart(pokemon) {
			pokemon.activeMoveActions = 0;
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("powder"),
				pokemon,
				target,
				{self: {}},
			);
		},
	},
	ponypower: {
		name: "Pony Power",
		shortDesc: "Combines Keen Edge & Mystic Blades.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				return this.chainModify(1.3 * 1.3);
			}
		},
		onModifyMove(move) {
			if (move.flags["slicing"]) {
				move.overrideDefensiveStat = 'spd';
				move.overrideOffensiveStat = 'spa';
			}
		},
	},
	combustion: {
		name: "Combustion",
		shortDesc: "Boosts the power of Fire-type moves by 1.5x.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Fire") {
				this.debug("Combustion boost");
				return this.chainModify(1.5);
			}
		},
	},
	telekinetic: {
		name: "Telekinetic",
		shortDesc: "Casts Telekinesis on entry.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("telekinesis"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	fighter: {
		name: "Fighter",
		shortDesc: "Boosts Fight.-type moves by 1.2x, or 1.5x when below 1/3 HP.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Fighting") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Fighter boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Fighter boost");
					return this.chainModify(1.2);
				}
			}
		},
	},
	purelove: {
		name: "Pure Love",
		shortDesc: "Infatuates on contact. Heal 25% damage vs infatuated.",
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				source.addVolatile("attract", target);
			}
		},
		onAfterMoveSecondarySelf(source, target, move) {
			if (source.status === "attract") {
				this.heal(source.baseMaxhp / 4, source, source);
			}
		},
	},
	fertilize: {
		name: "Fertilize",
		shortDesc:
			"Normal-type moves become Grass- type moves and get a 1.1x boost.",
		onModifyMove(move) {
			if (move.type === "Normal") {
				move.type = "Grass";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Grass") {
				this.debug("Fertilize boost");
				return this.chainModify(1.1);
			}
		},
	},
	determination: {
		name: "Determination",
		shortDesc: "Ups Special Attack by 50% if suffering.",
		onModifyDamage(atk, pokemon, target, move) {
			if (pokemon.status && move.category === 'Special') {
				return this.chainModify(1.5);
			}
		},
	},
	mysticblades: {
		name: "Mystic Blades",
		shortDesc: "Keen edge moves become special and deal 30% more damage.",
		onModifyMove(move) {
			if (move.flags["slicing"]) {
				move.overrideDefensiveStat = "spd";
				move.overrideOffensiveStat = "spa";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				this.debug("Mystic Blades boost");
				return this.chainModify(1.3);
			}
		},
	},
	changeofheart: {
		name: "Change of Heart",
		shortDesc: "Uses Heart Swap on switch-in.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("heartswap"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	hightide: {
		name: "High Tide",
		shortDesc: "Triggers 50 BP Surf after using a Water-type move.",
		onAfterMove(source, target, move) {
			if (move.type !== "Water") { return; }
			if (!move.succeeded) return;
			const moveMutations = {
				basePower: 50,
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("surf"),
				source,
				target,
				moveMutations
			);
		},
	},
	seaborne: {
		name: "Seaborne",
		shortDesc: "Combines Drizzle & Swift Swim.",
		onStart(source) {
			for (const action of this.queue) {
				if (
					action.choice === "runPrimal" &&
					action.pokemon === source &&
					source.species.id === "kyogre"
				) { return; }
				if (action.choice !== "runSwitch" && action.choice !== "runPrimal") { break; }
			}
			this.field.setWeather("raindance");
		},
		onModifySpe(spe, pokemon) {
			if (
				["raindance", "primordialsea"].includes(pokemon.effectiveWeather())
			) {
				return this.chainModify(1.5);
			}
		},
	},
	purifyingwaters: {
		name: "Purifying Waters",
		shortDesc: "Combines Hydration & Water Veil.",
		onResidualOrder: 5,
		onResidualSubOrder: 3,
		onResidual(pokemon) {
			if (
				pokemon.status &&
				["raindance", "primordialsea"].includes(pokemon.effectiveWeather())
			) {
				this.debug("hydration");
				this.add("-activate", pokemon, "ability: Hydration");
				pokemon.cureStatus();
			}
		},
		onUpdate(pokemon) {
			if (pokemon.status === "brn") {
				this.add("-activate", pokemon, "ability: Water Veil");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (status.id !== "brn") return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Water Veil");
			}
			return false;
		},
		isBreakable: true,
	},
	heavenasunder: {
		name: "Heaven Asunder",
		shortDesc: "Spacial Rend always crits. Ups crit level by +1.",
		onModifyCritRatio(critRatio, source, target, move) {
			if (move?.name === "spacialrend") {
				return critRatio + 12;
			} else {
				return critRatio + 1;
			}
		},
	},
	refridgerate: {
		name: "Refridgerate",
		shortDesc:
			"Normal-type moves become Ice- type moves and get a 1.1x boost.",
		onModifyMove(move) {
			if (move.type === "Normal") {
				move.type = "Ice";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Ice") {
				this.debug("Refridgerate boost");
				return this.chainModify(1.1);
			}
		},
	},
	refridgerator: {
		name: "Refridgerator",
		shortDesc: "Combines Refrigerate & Illuminate.",
		onSourceModifyAccuracyPriority: -1,
		onSourceModifyAccuracy(accuracy) {
			if (typeof accuracy !== "number") return;
			this.debug("compoundeyes - enhancing accuracy");
			return this.chainModify(1.2);
		},
		onModifyMove(move) {
			if (move.type === "Normal") {
				move.type = "Ice";
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Ice") {
				this.debug("Refridgerate boost");
				return this.chainModify(1.1);
			}
		},
	},
	suppress: {
		name: "Suppress",
		shortDesc: "Casts Torment on entry",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("torment"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	yukionna: {
		name: "Yuki Onna",
		shortDesc: "Scare + Intimidate. 10% chance to infatuate on hit.",
		onStart(pokemon) {
			let activated = false;
			for (const target of pokemon.adjacentFoes()) {
				if (!activated) {
					this.add("-ability", pokemon, "Yuki Onna", "boost");
					activated = true;
				}
				if (target.volatiles["substitute"]) {
					this.add("-immune", target);
				} else {
					this.boost({spa: -1, atk: -1}, target, pokemon, null, true);
				}
			}
		},
		onModifyMove(move) {
			if (!move?.flags["contact"] || move.target === "self") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 10,
				status: "attract",
				ability: this.dex.abilities.get("yukionna"),
			});
		},
	},
	doombringer: {
		name: "Doombringer",
		shortDesc: "Uses Doom Desire on switch-in.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("doomdesire"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	arcaneforce: {
		name: "Arcane Force",
		shortDesc: "All moves gain STAB. Ups “supereffective” by 10%.",
		onModifyMove(move) {
			move.forceSTAB = true;
		},
		onModifyDamage(damage, source, target, move) {
			if (target.runEffectiveness(move) > 0) this.chainModify(1.1);
		},
	},
	freezingpoint: {
		name: "Freezing Point",
		shortDesc: "30% chance to get frostbitten on contact.",
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.trySetStatus("frz", target);
				}
			}
		},
		onModifyMove(move) {
			if (!move?.flags["contact"] || move.target === "self") return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 30,
				status: "frz",
				ability: this.dex.abilities.get("freezinpoint"),
			});
		},
	},
	peacefulslumber: {
		name: "Peaceful Slumber",
		shortDesc: "Combines Sweet Dreams & Self Sufficient.",
		onResidualOrder: 30,
		onResidualSubOrder: 4,
		onResidual(pokemon) {
			if (pokemon.status === "slp" || pokemon.hasAbility("comatose")) {
				this.heal(pokemon.baseMaxhp / 16);
			}
			this.heal(pokemon.baseMaxhp / 16);
		},
	},
	enlightened: {
		name: "Enlightened",
		shortDesc: "Combines Emanate & Inner Focus.",
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			const noModifyType = [
				"judgment",
				"multiattack",
				"naturalgift",
				"revelationdance",
				"technoblast",
				"terrainpulse",
				"weatherball",
			];
			if (
				move.type === "Normal" &&
				!noModifyType.includes(move.id) &&
				!(move.isZ && move.category !== "Status") &&
				!(move.name === "Tera Blast" && pokemon.terastallized)
			) {
				move.type = "Psychic";
				move.typeChangerBoosted = this.effect;
			}
		},
		onModifyDamage(basePower, pokemon, target, move) {
			if (move.typeChangerBoosted === this.effect) { return this.chainModify(1.1); }
		},
		onTryAddVolatile(status, pokemon) {
			if (status.id === "flinch") return null;
		},
		onTryBoost(boost, target, source, effect) {
			if (effect.name === "Intimidate" && boost.atk) {
				delete boost.atk;
				this.add(
					"-fail",
					target,
					"unboost",
					"Attack",
					"[from] ability: Inner Focus",
					"[of] " + target
				);
			}
		},
	},
	tippingpoint: {
		name: "Tipping Point",
		shortDesc: "Getting hit raises Sp. Atk. Critical hits maximize Sp. Atk.",
		onDamagingHit(damage, target, source, move) {
			if (!target.hp) return;
			if (target === source) return;
			if (move?.effectType === "Move" && target.getMoveHitData(move).crit) {
				this.boost({spa: 12}, target, target);
			} else if (move?.effectType === "Move") {
				this.boost({spa: 1}, target, target);
			}
		},
	},
	superstrain: {
		name: "Super Strain",
		shortDesc: "KOs lower Attack by +1. Take 25% recoil damage.",
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({atk: -1}, source);
			}
		},
		onModifyDamage(damage, source, target, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				this.damage(source.baseMaxhp / 4, source, source);
			}
		},
	},
	primandproper: {
		name: "Prim and Proper",
		shortDesc: "Combines Wonder Skin & Cute Charm.",
		onModifyAccuracyPriority: 10,
		onModifyAccuracy(accuracy, target, source, move) {
			if (move.category === "Status" && typeof accuracy === "number") {
				this.debug("Wonder Skin - setting accuracy to 50");
				return 50;
			}
		},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(3, 10)) {
					source.addVolatile("attract", this.effectState.target);
				}
			}
		},
		isBreakable: true,
	},
	soothingaroma: {
		name: "Soothing Aroma",
		shortDesc: "Cures party status on entry.",
		onStart(pokemon) {
			for (const ally of pokemon.side.pokemon) {
				if (ally !== pokemon) {
					ally.cureStatus();
				}
			}
		},
	},
	naturalrecovery: {
		name: "Natural Recovery",
		shortDesc: "Combines Natural Cure & Regenerator.",
		onCheckShow(pokemon) {
			// This is complicated
			// For the most part, in-game, it's obvious whether or not Natural Cure activated,
			// since you can see how many of your opponent's pokemon are statused.
			// The only ambiguous situation happens in Doubles/Triples, where multiple pokemon
			// that could have Natural Cure switch out, but only some of them get cured.
			if (pokemon.side.active.length === 1) return;
			if (pokemon.showCure === true || pokemon.showCure === false) return;

			const cureList = [];
			let noCureCount = 0;
			for (const curPoke of pokemon.side.active) {
				// pokemon not statused
				if (!curPoke?.status) {
					// this.add('-message', "" + curPoke + " skipped: not statused or doesn't exist");
					continue;
				}
				if (curPoke.showCure) {
					// this.add('-message', "" + curPoke + " skipped: Natural Cure already known");
					continue;
				}
				const species = curPoke.species;
				// pokemon can't get Natural Cure
				if (!Object.values(species.abilities).includes("Natural Cure")) {
					// this.add('-message', "" + curPoke + " skipped: no Natural Cure");
					continue;
				}
				// pokemon's ability is known to be Natural Cure
				if (!species.abilities["1"] && !species.abilities["H"]) {
					// this.add('-message', "" + curPoke + " skipped: only one ability");
					continue;
				}
				// pokemon isn't switching this turn
				if (curPoke !== pokemon && !this.queue.willSwitch(curPoke)) {
					// this.add('-message', "" + curPoke + " skipped: not switching");
					continue;
				}

				if (curPoke.hasAbility("naturalcure")) {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (and is)");
					cureList.push(curPoke);
				} else {
					// this.add('-message', "" + curPoke + " confirmed: could be Natural Cure (but isn't)");
					noCureCount++;
				}
			}

			if (!cureList.length || !noCureCount) {
				// It's possible to know what pokemon were cured
				for (const pkmn of cureList) {
					pkmn.showCure = true;
				}
			} else {
				// It's not possible to know what pokemon were cured

				// Unlike a -hint, this is real information that battlers need, so we use a -message
				this.add(
					"-message",
					"(" +
						cureList.length +
						" of " +
						pokemon.side.name +
						"'s pokemon " +
						(cureList.length === 1 ? "was" : "were") +
						" cured by Natural Cure.)"
				);

				for (const pkmn of cureList) {
					pkmn.showCure = false;
				}
			}
		},
		onSwitchOut(pokemon) {
			if (!pokemon.foes().some(it => it.hasAbility("permanence"))) {
				pokemon.heal(pokemon.baseMaxhp / 3);
			}
			if (!pokemon.status) return;

			// if pokemon.showCure is undefined, it was skipped because its ability
			// is known
			if (pokemon.showCure === undefined) pokemon.showCure = true;

			if (pokemon.showCure) {
				this.add(
					"-curestatus",
					pokemon,
					pokemon.status,
					"[from] ability: Natural Cure"
				);
			}
			pokemon.clearStatus();

			// only reset .showCure if it's false
			// (once you know a Pokemon has Natural Cure, its cures are always known)
			if (!pokemon.showCure) pokemon.showCure = undefined;
		},
	},
	sandguard: {
		name: "Sand Guard",
		shortDesc:
			"Blocks priority and reduces special damage taken by 1/2 in sand.",
		onFoeTryMove(target, source, move) {
			if (!this.field.isWeather("sandstorm")) return;
			const targetAllExceptions = [
				"perishsong",
				"flowershield",
				"rototiller",
			];
			if (
				move.target === "foeSide" ||
				(move.target === "all" && !targetAllExceptions.includes(move.id))
			) {
				return;
			}

			const dazzlingHolder = this.effectState.target;
			if (
				(source.isAlly(dazzlingHolder) || move.target === "all") &&
				move.priority > 0.1
			) {
				this.attrLastMove("[still]");
				this.add(
					"cant",
					dazzlingHolder,
					"ability: Sand Guard",
					move,
					"[of] " + target
				);
				return false;
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (this.field.isWeather("sandstorm") && move.category === "Special") {
				return this.chainModify(0.5);
			}
		},
	},
	trickster: {
		name: "Trickster",
		shortDesc: "Uses Disable on switch-in.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("disable"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	berserkerrage: {
		name: "Berserker Rage",
		shortDesc: "Combines Berserk & Rampage.",
		onDamage(damage, target, source, effect) {
			if (
				effect.effectType === "Move" &&
				!effect.multihit &&
				!effect.negateSecondary &&
				!(effect.hasSheerForce && source.hasAbility("sheerforce"))
			) {
				this.effectState.checkedBerserk = false;
			} else {
				this.effectState.checkedBerserk = true;
			}
		},
		onTryEatItem(item) {
			const healingItems = [
				"aguavberry",
				"enigmaberry",
				"figyberry",
				"iapapaberry",
				"magoberry",
				"sitrusberry",
				"wikiberry",
				"oranberry",
				"berryjuice",
			];
			if (healingItems.includes(item.id)) {
				return this.effectState.checkedBerserk;
			}
			return true;
		},
		onAfterMoveSecondary(target, source, move) {
			this.effectState.checkedBerserk = true;
			if (!source || source === target || !target.hp || !move.totalDamage) { return; }
			const lastAttackedBy = target.getLastAttackedBy();
			if (!lastAttackedBy) return;
			const damage = move.multihit ?
				move.totalDamage :
				lastAttackedBy.damage;
			if (
				target.hp <= target.maxhp / 2 &&
				target.hp + damage > target.maxhp / 2
			) {
				this.boost({spa: 1}, target, target);
			}
		},
		onAfterMove(source, target, move) {
			if (target && target.hp <= 0) {
				if (source.volatiles["mustrecharge"]) {
					source.removeVolatile("mustrecharge");
				}
			}
		},
	},
	dustcloud: {
		name: "Dust Cloud",
		shortDesc: "Attacks with Sand Attack on switch-in.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("sandattack"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	moonspirit: {
		name: "Moon Spirit",
		shortDesc: "Fairy & Dark gains STAB. Moonlight recovers 75% HP.",
		onModifyMove(move) {
			if (move.type === "Fairy" || move.type === "Dark") {
				move.forceSTAB = true;
			}
		},
		// Moonlight effectiveness implemented in moves file
	},
	generator: {
		name: "Generator",
		shortDesc: "Charges up on entry.",
		onSwitchIn(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("charge"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	itchydefense: {
		name: "Itchy Defense",
		shortDesc: "Causes infestation when hit by a contact move.",
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				source.addVolatile("infestation", target);
			}
		},
	},
	frostburn: {
		name: "Frost Burn",
		shortDesc: "Triggers 40BP Ice Beam after using a Fire-type move.",
		onAfterMove(source, target, move) {
			if (move.type !== "Fire") { return; }
			if (!move.succeeded) return;
			const moveMutations = {
				basePower: 40,
			};
			this.actions.runAdditionalMove(
				Dex.moves.get("icebeam"),
				source,
				target,
				moveMutations
			);
		},
	},
	accelerate: {
		name: "Accelerate",
		shortDesc: "Moves that need a charge turn are now used instantly.",
		onChargeMove(pokemon, target, move) {
			this.add("-activate", pokemon, "ability: Accelerate");
			return false;
		},
	},
	inverseroom: {
		name: "Inverse Room",
		shortDesc: "Sets up the Inverse field condition for 3 turns upon entry.",
		onStart(source) {
			this.field.addPseudoWeather("inverseroom", source);
		},
	},
	superslammer: {
		name: "Super Slammer",
		shortDesc: "Boosts the power of hammer and slamming moves by 1.3x.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["hammer"] || move.flags["slam"]) {
				this.debug("Super Slammer boost");
				return this.chainModify(1.3);
			}
		},
	},
	coldplasma: {
		name: "Cold Plasma",
		shortDesc: "Electric type moves now inflict burn instead of paralysis.",
		onModifyMove(move, source, target) {
			if (move.type !== "Electric") return;
			if (
				move.secondary &&
				move.secondary.status &&
				move.secondary.status === "par"
			) {
				// Replace individual paralyze effect chances with brn.
				move.secondary.status = "brn";
			}
			if (move.secondaries) {
				for (const secondary of move.secondaries) {
					// Ignore any secondaries that aren't paralysis chance.
					if (!secondary.status || secondary.status !== "par") return;
					// Replace the paralysis with burn.
					secondary.status = "brn";
				}
			}
		},
	},
	archer: {
		name: "Archer",
		shortDesc: "Boosts the power of arrow moves by 1.3x.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["arrow"]) {
				this.debug("Archer boost");
				return this.chainModify(1.3);
			}
		},
	},
	rockhardwill: {
		name: "Rockhard Will",
		shortDesc: "Boosts Rock-type moves by 1.2x, or 1.5x when under 1/3 HP.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.type === "Rock") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Rockhard Will boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Rockhard Will boost");
					return this.chainModify(1.2);
				}
			}
		},
	},
	demolitionist: {
		name: "Demolitionist",
		shortDesc:
			"Readied Action + Ignores Protect + screens break on readied turn",
		onModifyAtk(atk, source, target, move) {
			if (source.activeMoveActions === 0) {
				return this.chainModify(2.0);
			}
		},
		// Ignores Protect
		onModifyMove(move) {
			if (move.flags["contact"]) delete move.flags["protect"];
		},
		// Foe screens break
		onStart(pokemon) {
			if (pokemon.side.foe.active[0].side.sideConditions["reflect"]) {
				pokemon.side.foe.active[0].side.removeSideCondition("reflect");
			}
			if (pokemon.side.foe.active[0].side.sideConditions["lightscreen"]) {
				pokemon.side.foe.active[0].side.removeSideCondition("lightscreen");
			}
			if (pokemon.side.foe.active[0].side.sideConditions["auroraveil"]) {
				pokemon.side.foe.active[0].side.removeSideCondition("auroraveil");
			}
		},
	},
	flamingmaw: {
		name: "Flaming Maw",
		shortDesc: "Strong Jaw + Flaming Jaws",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["bite"]) {
				return this.chainModify(1.5);
			}
		},
		onModifyMove(move, mon, target) {
			if (!move?.flags["bite"]) return;
			if (move.secondaries) move.secondaries = [];
			move.secondaries?.push({
				chance: 50,
				status: "brn",
			});
		},
	},
	balloonbomb: {
		name: "Balloon Bomb",
		shortDesc: "Aftermath + Inflatable",
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (
				!target.hp &&
				this.checkMoveMakesContact(move, source, target, true)
			) {
				this.damage(source.baseMaxhp / 4, source, target);
			}
		},
		onTryHit(target, source, move) {
			if (
				target !== source &&
				(move.type === "Flying" || move.type === "Fire")
			) {
				if (!this.boost({def: 1, spd: 1})) {
					this.add("-immune", target, "[from] ability: Inflatable");
					return null;
				}
			}
		},
		isBreakable: true,
	},
	appleenlightenment: {
		name: "Apple Enlightenment",
		shortDesc: "Fur coat + Magic Guard.",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === "Physical") {
				return this.chainModify(0.5);
			}
		},
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== "Move") {
				if (effect.effectType === "Ability") { this.add("-activate", source, "ability: " + effect.name); }
				return false;
			}
		},
		isBreakable: true,
	},
	rejection: {
		name: "Rejection",
		shortDesc: "Applies Quash on switch-in.",
		onStart(pokemon) {
			const target = pokemon.oppositeFoe();
			if (!target) return;
			this.actions.runAdditionalMove(
				Dex.moves.get("quash"),
				pokemon,
				target,
				{self: {}},
			);
			pokemon.activeMoveActions = 0;
		},
	},
	entrance: {
		name: "Entrance",
		shortDesc: "Confusion also inflicts infatuation.",
	},
	poisonpuppeteer: {
		name: "Poison Puppeteer",
		shortDesc: "Poison also inflicts confusion.",
		onSourceAfterSetStatus(status, target, source, effect) {
			if (target === source) return;
			if (status.id === "psn" || status.id === "tox") {
				target.addVolatile("confusion");
			}
		},
	},
	toxicchain: {
		name: "Toxic Chain",
		shortDesc: "Moves have a 30% chance to badly poison the foe.",
		onModifyMove(move, mon, target) {
			if (mon === target) return;
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 30,
				status: "tox",
				ability: this.dex.abilities.get("toxicchain"),
			});
		},
	},
	aftershock: {
		name: "Aftershock",
		shortDesc: "Triggers Magnitude 4-7 after using a damaging move.",
		onAfterMove(source, target, move) {
			if (!move || move.category === "Status") return;
			if (move.damage === 0) return;
			if (!move.succeeded) return;
			this.add("-activate", source, "ability: Aftershock");
			const aftershock = Dex.moves.get("magnitude") as ActiveMove;

			// / Magnitude 4-7 is 0->65.
			// / Defined in moves.ts onModifyMove.
			const i = this.random(65);

			if (i < 5) {
				aftershock.magnitude = 4;
				aftershock.basePower = 10;
			} else if (i < 15) {
				aftershock.magnitude = 5;
				aftershock.basePower = 30;
			} else if (i < 35) {
				aftershock.magnitude = 6;
				aftershock.basePower = 50;
			} else if (i < 65) {
				aftershock.magnitude = 7;
				aftershock.basePower = 70;
			}

			this.actions.runAdditionalMove(aftershock, source, target);
		},
	},
	retriever: {
		name: "Retriever",
		shortDesc: "Retrieves item on switch-out",

		onSwitchOut(pokemon) {
			// TODO: Should retriever support knocked off items?
			if (!pokemon.hasAbility("Retriever")) return;
			if (!pokemon.lastItem) return;
			pokemon.setItem(pokemon.lastItem);
			pokemon.lastItem = "";

			this.add(
				"-item",
				pokemon,
				pokemon.getItem(),
				"[from] ability: Retriever"
			);
		},
	},
	// / No business logic required here.
	// / Check the partiallytrapped condition in conditions.ts.
	grappler: {
		name: "Grappler",
		shortDesc: "Trapping moves last 6 turns. Trapping deals 1/6 HP.",
	},
	parroting: {
		name: "Parroting",
		shortDesc: "Copies sound moves used by others. Immune to sound.",
		onTryHit(target, source, move) {
			if (move.flags['sound']) {
				this.add('-immune', target, '[from] ability: Parroting');
				return null;
			}
		},
		onAnyAfterMove(source, target, move) {
			// / Don't activate on ourself.
			if (source === this.effectState.target) return;
			if (!move.flags.sound) return;
			this.add("-activate", this.effectState.target, "ability: Parroting");
			this.actions.useMove(move, this.effectState.target, target);
		},
	},
	terashell: {
		name: "Tera Shell",
		shortDesc: "All hits will be not very effective while at full HP.",
		onEffectiveness(typeMod, target, type, move) {
			if (target) {
				if (target.hp >= target.maxhp) {
					if (typeMod >= 0) return -1;
				}
			}
		},
	},
	aerialist: {
		name: "Aerialist",
		shortDesc: "Combines Levitate & Flock.",
		// Levitate defined in sim/pokemon.ts
		onModifyDamage(atk, attacker, defender, move) {
			if (move && move.type === "Flying") {
				if (attacker.hp <= attacker.maxhp / 3) {
					this.debug("Flock Circuit boost");
					return this.chainModify(1.5);
				} else {
					this.debug("Flock Circuit boost");
					return this.chainModify(1.2);
				}
			}
		},
	},
	contempt: {
		name: "Contempt",
		shortDesc:
			"Ignores opposing stat changes. Boosts Attack when stat lowered.",
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectState.target;
			if (unawareUser === pokemon) return;
			if (
				unawareUser === this.activePokemon &&
				pokemon === this.activeTarget
			) {
				boosts["def"] = 0;
				boosts["spd"] = 0;
				boosts["evasion"] = 0;
			}
			if (
				pokemon === this.activePokemon &&
				unawareUser === this.activeTarget
			) {
				boosts["atk"] = 0;
				boosts["def"] = 0;
				boosts["spa"] = 0;
				boosts["accuracy"] = 0;
			}
		},
		onAfterEachBoost(boost, target, source, effect) {
			if (!source || target.isAlly(source)) {
				if (effect.id === "stickyweb") {
					this.hint(
						"Court Change Sticky Web counts as lowering your own Speed, and Contempt only affects stats lowered by foes.",
						true,
						source.side
					);
				}
				return;
			}
			let statsLowered = false;
			let i: BoostID;
			for (i in boost) {
				if (boost[i]! < 0) {
					statsLowered = true;
				}
			}
			if (statsLowered) {
				this.boost({atk: 1}, target, target, null, false, true);
			}
		},
		isBreakable: true,
	},
	desertspirit: {
		name: "Desert Spirit",
		shortDesc: "Summons sand on entry. Ground moves hit airborne in sand.",
		onStart(source) {
			this.field.setWeather("sandstorm");
		},
		// This isn't in-line with things like magnetic rise and gravity yet, so prob should do that later.
		onModifyMove(move, source, target) {
			if (!target) return;
			if (!this.field.isWeather("sandstorm") || move.type !== "Ground") return;

			if (!move.ignoreImmunity) move.ignoreImmunity = {};
			if (move.ignoreImmunity !== true) {
				move.ignoreImmunity["Ground"] = true;
			}

			if (target.hasAbility('levitate') || target.hasAbility('dragonfly')) move.ignoreAbility = true;
		},
	},
	flourish: {
		name: "Flourish",
		shortDesc: "Boosts Grass moves by 50% in grassy terrain.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (this.field.isTerrain("grassyterrain") && move.type === "Grass") {
				this.debug("Flourish boost");
				return this.chainModify(1.5);
			}
		},
	},
	lawnmower: {
		name: "Lawnmower",
		shortDesc: "Removes terrain on switch-in. Stat up if terrain removed.",
		onStart(source) {
			if (this.field.terrain) {
				this.field.clearTerrain();
				this.boost({atk: 1, spa: 1, def: 1, spd: 1, spe: 1}, source);
			}
		},
	},
	mythicalarrows: {
		name: "Mythical Arrows",
		shortDesc: "Arrow moves become special and deal 30% more damage.",
		onModifyMove(move) {
			if (move.flags["arrow"]) {
				move.overrideOffensiveStat = 'spa';
				move.overrideDefensiveStat = 'spd';
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["arrow"]) {
				this.debug("Mythical Arrows boost");
				return this.chainModify(1.3);
			}
		},
	},
	brawlingwyvern: {
		name: "Brawling Wyvern",
		shortDesc: "Dragon type moves become punching moves.",
		onModifyMovePriority: 10,
		onModifyMove(move) {
			if (move.type === "Dragon") {
				move.flags["punch"] = 1;
			}
		},
	},
	deadpower: {
		name: "Dead Power",
		shortDesc: "1.5x Attack boost. 20% chance to curse on contact moves.",
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(1.5);
		},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target)) {
				if (this.randomChance(2, 10)) {
					source.trySetStatus("curse", target);
				}
			}
		},
	},
	malicious: {
		name: "Malicious",
		shortDesc: "Lowers the foe's highest Attack and Defense stat.",
		onStart(pokemon) {
			// grab all foes
			const foes = pokemon.side.foes();
			// grab the highest attack and defense stat
			for (const foe of foes) {
				if (foe.getStat("atk", false, true) > foe.getStat("spa", false, true)) {
					this.boost({atk: -1}, foe, pokemon);
				} else {
					this.boost({spa: -1}, foe, pokemon);
				}
				if (foe.getStat("def", false, true) > foe.getStat("spd", false, true)) {
					this.boost({def: -1}, foe, pokemon);
				} else {
					this.boost({spd: -1}, foe, pokemon);
				}
			}
		},
	},
	ole: {
		name: "Ole!",
		shortDesc: "20% chance to evade physical moves.",
		onTryHit(target, source, move) {
			if (move.category === "Physical") {
				if (this.randomChance(2, 10)) {
					this.add("-miss", target);
					return null;
				}
			}
		},
	},
	radiojam: {
		name: "Radio Jam",
		shortDesc: "Sound-based moves inflict disable.",
		onDamagingHit(damage, target, source, move) {
			if (move.flags["sound"]) {
				target.addVolatile("disable", source);
			}
		},
	},
	noisecancel: {
		name: "Noise Cancel",
		shortDesc: "Protects the party from sound-based moves.",
		// Protect ally
		onTryHitSide(target, source, move) {
			if (move.flags["sound"]) {
				this.add("-immune", target, "[from] ability: Noise Cancel");
				return null;
			}
		},
	},
	hauntingfrenzy: {
		name: "Haunting Frenzy",
		shortDesc: "20% chance to flinch the opponent. +1 speed on kill.",
		onModifyMove(move) {
			if (!move.secondaries) {
				move.secondaries = [];
			}
			move.secondaries.push({
				chance: 20,
				volatileStatus: "flinch",
				ability: this.dex.abilities.get("hauntingfrenzy"),
			});
		},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === "Move") {
				this.boost({spe: 1}, source);
			}
		},
	},
	moltenblades: {
		name: "Molten Blades",
		shortDesc: "Keen Edge + Keen Edge moves have a 20% chance to burn.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				return this.chainModify([5325, 4096]);
			}
		},
		onModifyMove(move) {
			if (move.flags["slicing"]) {
				if (!move.secondaries) {
					move.secondaries = [];
				}
				move.secondaries.push({
					chance: 20,
					status: "brn",
					ability: this.dex.abilities.get("moltenblades"),
				});
			}
		},
	},
	minioncontrol: {
		name: "Minion Control",
		shortDesc: "Moves hit an extra time for each healthy party member.",
		onPrepareHit(source, target, move) {
			if (isParentalBondBanned(move, source)) { return; }

			let allyCount = 0;
			for (const ally of source.side.pokemon) {
				if (ally !== source) {
					if (ally.hp > 0) {
						allyCount++;
					}
				}
			}
			move.multihit = allyCount;
			move.multihitType = "minion";
		},
		onSourceModifySecondaries(secondaries, target, source, move) {
			console.log(move.hit, move.secondaries);
			if (move.multihitType !== "minion") return;
			if (!secondaries) return;
			if (move.hit <= 1) return;
			secondaries = secondaries.filter((effect) => effect.ability || effect.kingsrock);
			return secondaries;
		},
	},
	celestialblessing: {
		name: "Celestial Blessing",
		shortDesc: "Recovers 1/12 of its health each turn under Misty Terrain.",
		onResidualOrder: 5,
		onResidualSubOrder: 1,
		onResidual(pokemon) {
			if (this.field.isTerrain("mistyterrain")) {
				this.heal(pokemon.baseMaxhp / 12);
			}
		},
	},
	blademaster: {
		name: "Blade Master",
		shortDesc: "Combines Sweeping Edge & Keen Edge.",
		onModifyMove(move) {
			if (move.flags["slicing"]) {
				move.accuracy = true;
				if (move.target === "normal" || move.target === "any") { move.target = "allAdjacentFoes"; }
			}
		},
		onModifyDamage(basePower, attacker, defender, move) {
			if (move.flags["slicing"]) {
				return this.chainModify([5325, 4096]);
			}
		},
	},
	catastrophe: {
		name: "Catastrophe",
		shortDesc: "Sun boosts Water. Rain boosts Fire.",
		onModifyDamage(basePower, attacker, defender, move) {
			if (this.field.isWeather("sunnyday") && move.type === "Water") {
				this.debug("Catastrophe boost");
				return this.chainModify(2);
			}
			if (this.field.isWeather("raindance") && move.type === "Fire") {
				this.debug("Catastrophe boost");
				return this.chainModify(2);
			}
		},
	},
	ironserpent: {
		name: "Iron Serpent",
		shortDesc: "Ups “supereffective” by 33%.",
		onModifyDamage(damage, source, target, move) {
			if (target.runEffectiveness(move) > 0) {
				return this.chainModify(1.33);
			}
		},
	},
	wingedking: {
		name: "Winged King",
		shortDesc: "Ups “supereffective” by 33%.",
		onModifyDamage(damage, source, target, move) {
			if (target.runEffectiveness(move) > 0) {
				return this.chainModify(1.33);
			}
		},
	},
	sunbasking: {
		name: "Sun Basking",
		shortDesc: "Immune to status conditions if sun is active.",
		onUpdate(pokemon) {
			if (pokemon.status) {
				this.add("-activate", pokemon, "ability: Sun Basking");
				pokemon.cureStatus();
			}
		},
		onSetStatus(status, target, source, effect) {
			if (!status) return;
			if ((effect as Move)?.status) {
				this.add("-immune", target, "[from] ability: Sun Basking");
			}
			return false;
		},
	},
	gallantry: {
		name: "Gallantry",
		shortDesc: "Gets no damage for first hit",
		onDamage(damage, mon, source, effect) {
			if (mon === source) return;
			if (damage <= 0) return;
			if (effect.effectType !== "Move") return;
			mon.permanentAbilityState["gallantry"] = mon.permanentAbilityState["gallantry"] || 0;
			if (mon.permanentAbilityState["gallantry"] >= 1) return;
			mon.permanentAbilityState["gallantry"]++;
			this.add("-activate", mon, "ability: Gallantry");
			return 0;
		},
	},
	thickskin: {
		name: "Thick Skin",
		shortDesc: "Takes 25% less damage from Super-effective moves.",
		onSourceModifyDamage(damage, source, target, move) {
			if (target.runEffectiveness(move) > 0) {
				return this.chainModify(0.75);
			}
		},
	},
	sharingiscaring: {
		name: "Sharing is Caring",
		shortDesc: "Stat changes are shared between all battlers.",
		onAnyAfterBoost(boost, target, source, effect) {
			const sharingiscaring = this.dex.abilities.get("sharingiscaring");

			if (effect.id === sharingiscaring.id) return;
			// temporary fix to stop crashing
			try {
				if (target !== this.effectState.target) {
					console.debug("boosting", this.effectState.target.name, "due to", target.name, "sharing is caring from", `${source.name}'s`, effect.name);
					this.boost(boost, this.effectState.target, this.effectState.target, sharingiscaring, false, true);
				}

				for (const pokemon of target.foes()) {
					if (pokemon !== target && pokemon !== this.effectState.target) {
						console.debug("boosting", pokemon.name, "due to", target.name, "sharing is caring from", `${source.name}'s`, effect.name);
						this.boost(boost, pokemon, this.effectState.target, sharingiscaring, false, true);
					}
				}
				for (const pokemon of target.allies()) {
					if (pokemon !== target && pokemon !== this.effectState.target) {
						console.debug("boosting", pokemon.name, "due to", target.name, "sharing is caring from", `${source.name}'s`, effect.name);
						this.boost(boost, pokemon, this.effectState.target, sharingiscaring, false, true);
					}
				}
			} catch (e) {
				console.error(e);
				this.add("-fail", target, "ability: Sharing is Caring. BUG: Please report this.");
			}
		},
	},
	sharpedges: {
		name: "Sharp Edges",
		shortDesc: "1/6 HP damage when touched.",
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target, true)) {
				this.damage(source.baseMaxhp / 6, source, target);
			}
		},
	},
	rapidresponse: {
		name: "Rapid Response",
		shortDesc: "Boosts Speed by 50% + SpAtk by 20% on first turn.",
		onStart(pkmn) {
			pkmn.addVolatile("rapidresponse");
		},
		condition: {
			duration: 1,
			countFullRounds: true,
			onModifySpA(atk, source, target, move) {
				return this.chainModify(1.2);
			},
			onModifySpe(spe, source) {
				return this.chainModify(1.5);
			},
		},
	},
	watchyourstep: {
		name: "Watch Your Step",
		shortDesc: "Spreads two layers of Spikes on switch-in.",
		onStart(pokemon) {
			const side = pokemon.side.foe;
			const spikes = side.sideConditions["spikes"];
			if (!spikes || spikes.layers < 3) {
				this.add("-activate", pokemon, "ability: Watch your Step");
				side.addSideCondition("spikes", pokemon);
			}
			if (!spikes || spikes.layers < 3) {
				this.add("-activate", pokemon, "ability: Watch your Step");
				side.addSideCondition("spikes", pokemon);
			}
		},
	},
	firescales: {
		name: "Fire Scales",
		shortDesc:
			"Halves damage taken by Special moves. Does NOT double Sp.Def.",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === "Special") {
				return this.chainModify(0.5);
			}
		},
	},
	illwill: {
		name: "Ill Will",
		shortDesc: "Deletes the PP of the move that faints this Pokemon.",
		onFaint(target, source, effect) {
			if (effect.effectType === "Move") {
				this.add("-ability", target, "Ill Will");
				this.add(
					"-message",
					target.name + " deleted the PP of " + effect.name + "!"
				);
				target.side.foe.active[0].moveSlots.forEach((slot) => {
					if (slot.id === effect.id) {
						slot.pp = 0;
					}
				});
			}
		},
	},
	momentum: {
		name: "Momentum",
		shortDesc: "Contact moves use the Speed stat for damage calculation.",
		onModifyMove(move) {
			if (move.flags["contact"]) {
				move.overrideOffensiveStat = "spe";
			}
		},
	},
	wishmaker: {
		name: "Wishmaker",
		shortDesc: "Uses Wish on switch-in, three uses per battle",
		onStart(pokemon) {
			const counter = (pokemon.permanentAbilityState['wishmaker'] as number || 0) + 1;
			if (counter >= 3) return;
			pokemon.permanentAbilityState['wishmaker'] = counter;

			this.actions.useMove(Dex.moves.get("wish"), pokemon);
			pokemon.activeMoveActions = 0;
		},
	},
};
