import {AbilityEnum} from "../../proto/AbilityEnum_pb.js";
import {MoveEnum} from "../../proto/MoveEnum_pb.js";
import {SpeciesEnum} from "../../proto/SpeciesEnum_pb.js";
import {
	BodyColor,
	EggGroup,
	Species,
	Species_MegaEvolution_MegaType,
	Species_PrimalEvolution_PrimalType,
	Species_RandomizeBanned,
	Species_Region,
	Species_SpeciesDexInfo,
	Species_SpeciesDexInfoSchema,
} from "../../proto/SpeciesList_pb.js";
import {Type} from "../../proto/Types_pb.js";
import {SpeciesAbility} from "../../../sim/dex-species.js";
import {
	readSpecies,
	speciesForId,
	abilityForId,
	itemForId,
	moveForId,
	reverseEvosForId,
} from "./data.js";
import {create} from "@bufbuild/protobuf";

const formMap: { [key in SpeciesEnum]?: SpeciesEnum[] } =
	readSpecies().species.reduce(
		(arr: { [key in SpeciesEnum]?: SpeciesEnum[] }, species) => {
			if (species.baseSpeciesInfo.case === "formOf") {
				arr[species.baseSpeciesInfo.value] =
					arr[species.baseSpeciesInfo.value] || [];
				arr[species.baseSpeciesInfo.value]?.push(species.id);
			}
			return arr;
		},
		{}
	);

function baseSpecies(species: Species): Species {
	if (species.baseSpeciesInfo.case === "formOf") {
		return baseSpecies(speciesForId(species.baseSpeciesInfo.value));
	}
	if (!species.baseSpeciesInfo.value) {
		return speciesForId(SpeciesEnum.SPECIES_NONE);
	}
	return species;
}

function speciesInfo(species: Species): Species_SpeciesDexInfo {
	const base = baseSpecies(species);
	if (base.baseSpeciesInfo.case === "dex") return base.baseSpeciesInfo.value;
	return create(Species_SpeciesDexInfoSchema);
}

const MEGA_SUFFIX: { [key in Species_MegaEvolution_MegaType]?: string } = {
	[Species_MegaEvolution_MegaType.MEGA_A]: " A",
	[Species_MegaEvolution_MegaType.MEGA_B]: " B",
	[Species_MegaEvolution_MegaType.MEGA_C]: " C",
	[Species_MegaEvolution_MegaType.MEGA_X]: " X",
	[Species_MegaEvolution_MegaType.MEGA_Y]: " Y",
	[Species_MegaEvolution_MegaType.MEGA_Z]: " Z",
};

const PRIMAL_SUFFIX: { [key in Species_PrimalEvolution_PrimalType]: string } = {
	[Species_PrimalEvolution_PrimalType.PRIMAL]: "-Primal",
	[Species_PrimalEvolution_PrimalType.ORIGIN]: "-Origin",
	[Species_PrimalEvolution_PrimalType.CROWNED]: "-Crowned",
	[Species_PrimalEvolution_PrimalType.ULTRA]: "-Ultra",
};

function Xtox(str: string, prefix?: string) {
	if (prefix && str.startsWith(prefix)) str = str.slice(prefix.length);
	return str
		.split("_")
		.map((it) => it[0].toUpperCase + it.slice(1).toLowerCase())
		.join("");
}

function displayName(species: Species): string {
	if (species.baseSpeciesInfo.case === "dex") {
		return species.baseSpeciesInfo.value.name;
	}

	if (species.longName) {
		if (!species.longName.startsWith(speciesInfo(species).name)) {
			return `${speciesInfo(species).name} ${species.longName}`;
		} else {
			return species.longName;
		}
	}

	if (species.mega.length) {
		return `${displayName(speciesForId(species.mega[0].from))} Mega${
			MEGA_SUFFIX[species.mega[0].type] || ""
		}`;
	}

	if (species.primal.length) {
		const prevDisplayName =
			species.primal.length === 1 ?
				displayName(speciesForId(species.primal[0].from)) :
				speciesInfo(species).name;
		return `${prevDisplayName} ${
			PRIMAL_SUFFIX[species.primal[0].type] || ""
		}`;
	}

	if (!species.formShiftOf && !species.battleForm && species.regionPrefix) {
		return `${speciesInfo(species).name} ${Xtox(
			Species_Region[species.regionPrefix],
			"REGION_"
		)}`;
	}

	return Xtox(SpeciesEnum[species.id], "SPECIES_");
}

export const Pokedex: { [k: string]: SpeciesData } = Object.fromEntries(
	readSpecies()
		.species.filter(
			(it) => it.randomizerBanned !== Species_RandomizeBanned.SPECIES_HIDDEN
		)
		.map<[string, SpeciesData]>((it) => {
		const dex = speciesInfo(it);
		const showdownSpecies: {
			-readonly [key in keyof SpeciesData]?: SpeciesData[key];
		} = {
			name: displayName(it),
			num: it.id,
			types: [it.type, it.type2]
				.filter((type) => type !== Type.NONE)
				.map((type) => Xtox(Type[type])),
			abilities: {0: abilityForId(it.ability[0]).name},
			baseStats: {
				hp: it.hp,
				atk: it.atk,
				def: it.def,
				spa: it.spatk,
				spd: it.spdef,
				spe: it.spe,
			},
			eggGroups: [dex.eggGroup, dex.eggGroup2].map((egg) =>
				Xtox(EggGroup[egg], "EGG_GROUP_")),
			weightkg: dex.weight,
			heightm: dex.height,
			color: Xtox(
				BodyColor[dex.bodyColor || BodyColor.RED],
				"BODY_COLOR_"
			),
			evoLevel: it.evo[0]?.level || 0,
			evos: it.evo
				.filter((evo) => SpeciesEnum[evo.to])
				.map((evo) => displayName(speciesForId(evo.to))),
		};

		function addAbility(
			ability: AbilityEnum | undefined,
			idx: keyof SpeciesAbility
		) {
			if (ability) {
				showdownSpecies.abilities![idx] = abilityForId(ability).name;
			}
		}
		addAbility(it.ability[1], 1);
		addAbility(it.ability[2], "H");
		addAbility(it.innate[0], "I1");
		addAbility(it.innate[1], "I2");
		addAbility(it.innate[2], "I3");

		if (it.baseSpeciesInfo.case === "formOf") {
			showdownSpecies.baseSpecies = displayName(
				speciesForId(it.baseSpeciesInfo.value)
			);
		} else {
			const otherForms = formMap[it.id];
			if (otherForms?.length) {
				showdownSpecies.otherFormes = otherForms.map((other) =>
					displayName(speciesForId(other)));
				showdownSpecies.formeOrder = [
					showdownSpecies.name!,
					...showdownSpecies.otherFormes,
				];
			}
		}

		if (it.mega.length) {
			const mega = it.mega[0];
			if (mega.evoUsing.case === "item") {
				showdownSpecies.requiredItem = itemForId(
					mega.evoUsing.value
				).name;
			} else {
				showdownSpecies.requiredMove = moveForId(
					mega.evoUsing.value as MoveEnum
				).name;
			}
		} else if (it.primal.length) {
			showdownSpecies.requiredItem = itemForId(it.primal[0].item).name;
		}

		const prevos = reverseEvosForId(it.id);
		if (prevos.length) {
			showdownSpecies.prevo = displayName(speciesForId(prevos[0]));
		}

		if (it.gender.case === "percentFemale") {
			showdownSpecies.genderRatio = {
				M: 1 - it.gender.value / 100,
				F: it.gender.value / 100,
			};
			if (it.gender.value === 0) showdownSpecies.gender = "M";
			else if (it.gender.value === 100) showdownSpecies.gender = "F";
		} else {
			showdownSpecies.gender = "N";
		}

		return [
			SpeciesEnum[it.id].split("_").join("").toLowerCase(),
			showdownSpecies as SpeciesData,
		];
	})
);
