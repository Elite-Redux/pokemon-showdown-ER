import {MoveEffect} from "../../proto/MoveEffect_pb.js";
import {Type} from "../../proto/Types_pb.js";
import {
	itemToId,
	readItems,
	readSpecies,
	speciesForId,
	speciesToId,
	Xtox,
} from "./data.js";
import {HoldEffect, Item, Pocket} from "../../proto/ItemList_pb.js";
import {ItemEnum} from "../../proto/ItemEnum_pb.js";
import {SpeciesEnum} from "../../proto/SpeciesEnum_pb.js";
import {displayName} from "./pokedex.js";

export interface ErNaturalGift {
	power: number;
	type: string;
	effect: MoveEffect;
}

export const NaturalGiftTable: { [k: string]: ErNaturalGift } =
	Object.fromEntries(
		readItems()
			.item.filter((it) => it.naturalGift)
			.map((it) => [
				itemToId(it.id),
				{
					power: it.naturalGift!.power,
					type: Xtox(Type[it.naturalGift!.type], "TYPE_"),
					effect: it.naturalGift!.effect,
				},
			])
	);

function isObtainable(item: Item): boolean {
	return (
		item.grouping === Pocket.BERRIES || item.megaStoneHint.case !== undefined
	);
}

type MutableModdedItemData = {
	-readonly [key in keyof (ModdedItemData & {
		name: string,
	})]?: (ModdedItemData & { name: string })[key];
};

export const Items: { [k: string]: ModdedItemData } = Object.fromEntries(
	readItems().item.map<[Item, ModdedItemData]>((it) => {
		const handler = commonHoldEffects[it.holdEffect];

		const item = handler ? handler(it) : {};
		item.name = it.name;
		item.isNonstandard = isObtainable(it) ? null : "Unobtainable";

		return [it, item as ModdedItemData];
	})
);

const megaStoneList: { [key in ItemEnum]?: SpeciesEnum } = Object.fromEntries(
	readSpecies()
		.species.map<[ItemEnum | undefined, SpeciesEnum]>((it) => [
		it.mega[0]?.evoUsing?.case === "item" ?
			it.mega[0].evoUsing.value :
			it.primal[0]?.item,
		it.id,
	])
		.filter((it) => it[0])
);

const commonHoldEffects: {
	[key in HoldEffect]?: (item: Item) => MutableModdedItemData;
} = {
	[HoldEffect.MEGA_STONE]: (item) => {
		const megaSpeciesId = megaStoneList[item.id];
		if (!megaSpeciesId) return {};
		const megaSpecies = speciesForId(megaSpeciesId);
		const megas = megaSpecies.mega
			.filter(
				(it) => it.evoUsing.case === "item" && it.evoUsing.value === item.id
			)
			.map((it) => displayName(speciesForId(it.from)));
		const data: MutableModdedItemData = {
			megaStone: displayName(megaSpecies),
			itemUser: megas,
			onTakeItem: () => false,
		};
		if (megas.length > 1) {
			data.multiMegaEvolves = megas;
		} else {
			data.megaEvolves = megas[0];
		}
		return data;
	},
	[HoldEffect.PRIMAL_ORB]: (item) => {
		const primalSpeciesId = megaStoneList[item.id];
		if (!primalSpeciesId) return {};
		const primalSpecies = speciesForId(primalSpeciesId);
		const primalSpeciesName = displayName(primalSpecies);

		const primalFrom = primalSpecies.primal.map((it) =>
			displayName(speciesForId(it.from)));
		return {
			onSwitchIn(pokemon) {
				if (pokemon.isActive && primalFrom.includes(pokemon.name)) {
					this.queue.insertChoice({
						choice: "runPrimal",
						pokemon: pokemon,
					});
				}
			},
			onPrimal(pokemon) {
				pokemon.formeChange(primalSpeciesName, this.effect);
			},
			onTakeItem: () => false,
			itemUser: primalFrom,
		};
	},
	[HoldEffect.TYPE_POWER]: (item) => {
		const type = Xtox(Type[item.holdEffectType], "TYPE_");
		return {
			onModifyDamage(basePower, user, target, move) {
				if (move && move.type === type) {
					return this.chainModify(1 + item.holdEffectStrength / 100);
				}
			},
		};
	},
	[HoldEffect.PLATE]: (item) => {
		const type = Xtox(Type[item.holdEffectType], "TYPE_");
		const data: MutableModdedItemData = {
			onModifyDamage(basePower, user, target, move) {
				if (move && move.type === type) {
					return this.chainModify(1 + item.holdEffectStrength / 100);
				}
			},
			onBasePower() {},
			onPlate: type,
			onTakeItem(unused, pokemon) {
				return pokemon.baseSpecies.name !== "Arceus";
			},
		};
		if (item.holdEffectType !== Type.NORMAL) {
			data.forcedForme = displayName(
				speciesForId(
					SpeciesEnum[
						`SPECIES_ARCEUS_${Type[item.holdEffectType].replace(
							"TYPE_",
							""
						)}` as keyof typeof SpeciesEnum
					]
				)
			);
		}
		return data;
	},
	[HoldEffect.MEMORY]: (item) => {
		const type = Xtox(Type[item.holdEffectType], "TYPE_");
		const data: MutableModdedItemData = {
			onMemory: type,
			onTakeItem(unused, pokemon) {
				return pokemon.baseSpecies.name !== "Silvally";
			},
		};
		if (item.holdEffectType !== Type.NORMAL) {
			data.forcedForme = displayName(
				speciesForId(
					SpeciesEnum[
						`SPECIES_SILVALLY_${Type[item.holdEffectType].replace(
							"TYPE_",
							""
						)}` as keyof typeof SpeciesEnum
					]
				)
			);
		}
		return data;
	},
	[HoldEffect.DRIVE]: (item) => {
		const type = Xtox(Type[item.holdEffectType], "TYPE_");
		return {
			onMemory: type,
			onTakeItem(unused, pokemon) {
				return pokemon.baseSpecies.name !== "Genesect";
			},
			forcedForme: displayName(
				speciesForId(
					SpeciesEnum[
						`SPECIES_GENESECT_${ItemEnum[item.id].replace(
							"ITEM_",
							""
						)}` as keyof typeof SpeciesEnum
					]
				)
			),
		};
	},
	[HoldEffect.CUSTOM]: (item) => customHoldEffects[item.id] || {},
};

const customHoldEffects: {
	[key in ItemEnum]?: (item: Item) => MutableModdedItemData;
} = {
	[ItemEnum.ITEM_SWIRLY_GLASSES]: () => ({
		onModifyMove(move) {
			if (move.category === "Physical") {
				move.category = "Special";
			} else if (move.category === "Special") {
				move.category = "Physical";
			}
		},
	}),
	[ItemEnum.ITEM_WISE_GLASSES]: (item) => ({
		onModifyDamage(basePower, user, target, move) {
			if (move && move.category === "Special") {
				return this.chainModify(1 + item.holdEffectStrength / 100);
			}
		},
		name: "",
	}),
	[ItemEnum.ITEM_MUSCLE_BAND]: (item) => ({
		onModifyDamage(basePower, user, target, move) {
			if (move && move.category === "Physical") {
				return this.chainModify(1 + item.holdEffectStrength / 100);
			}
		},
		name: "",
	}),
};
