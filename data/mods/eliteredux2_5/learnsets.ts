import { MoveEnum } from "../../proto/MoveEnum_pb.js";
import { TutorType } from "../../proto/MoveList_pb.js";
import { SpeciesEnum } from "../../proto/SpeciesEnum_pb.js";
import {
	Species,
	Species_Learnset_UniversalTutors,
	Species_LearnsetSchema,
} from "../../proto/SpeciesList_pb.js";
import {
	readMoves,
	readSpecies,
	reverseEvosForId,
	speciesForId,
	speciesToId,
} from "./data.js";
import { create } from "@bufbuild/protobuf";

function getLearnsetMon(species: Species): Species {
	if (species.id === SpeciesEnum.SPECIES_NONE) return species;
	if (species.learnsetOrRef.case === "learnset") return species;
	if (species.learnsetOrRef.value)
		return getLearnsetMon(speciesForId(species.learnsetOrRef.value));
	if (species.formShiftOf)
		return getLearnsetMon(speciesForId(species.formShiftOf));
	if (species.mega.length)
		return getLearnsetMon(speciesForId(species.mega[0].from));
	if (species.primal.length)
		return getLearnsetMon(speciesForId(species.primal[0].from));
	if (!species.learnsetOrRef.value) return species;
	return getLearnsetMon(speciesForId(species.learnsetOrRef.value));
}

const UNIVERSAL_TUTORS = readMoves()
	.moves.filter((it) => it.tutor === TutorType.TUTOR_UNIVERSAL_STATUS)
	.map((it) => it.id);
const UNIVERSAL_ATTACKS = readMoves()
	.moves.filter((it) => it.tutor === TutorType.TUTOR_UNIVERSAL_ATTACK)
	.map((it) => it.id);
const UNIVERSAL_GENDERED = readMoves()
	.moves.filter((it) => it.tutor === TutorType.TUTOR_UNIVERSAL_STATUS_GENDERED)
	.map((it) => it.id);

type LearnsetMap = { [key in MoveEnum]?: number | true };

function getLearnset(species: Species): LearnsetMap {
	const learnsetMon = getLearnsetMon(species);
	const learnset =
		learnsetMon.learnsetOrRef.case === "learnset"
			? learnsetMon.learnsetOrRef.value
			: create(Species_LearnsetSchema);
	const learnsetMap: LearnsetMap = {};
	for (const levelupGroup of learnset.level) {
		for (const move of levelupGroup.move) {
			addMove(move, levelupGroup.level, learnsetMap);
		}
	}
	for (const tutor of learnset.tutor) {
		addMove(tutor, true, learnsetMap);
	}
	for (const tutor of UNIVERSAL_TUTORS) {
		addMove(tutor, true, learnsetMap);
	}
	if (learnsetMon.gender.case !== "genderless") {
		for (const tutor of UNIVERSAL_GENDERED) {
			addMove(tutor, true, learnsetMap);
		}
	}
	if (
		learnset.universalTutors !== Species_Learnset_UniversalTutors.NO_ATTACKS
	) {
		for (const tutor of UNIVERSAL_ATTACKS) {
			addMove(tutor, true, learnsetMap);
		}
	}
	return learnsetMap;
}

function addMove(
	move: MoveEnum,
	condition: number | true,
	moveset: LearnsetMap
) {
	if (condition === true) moveset[move] = true;
	else if (moveset[move] === true) return;
	else if (!moveset[move]) moveset[move] = condition;
	else moveset[move] = Math.min(moveset[move], condition);
}

function buildFullLearnset(species: Species): LearnsetMap {
	const learnset = getLearnset(species);

	if (species.id === SpeciesEnum.SPECIES_EEVEE) {
		for (const evo of species.evo) {
			for (const entry of Object.entries(
				getLearnset(speciesForId(evo.to))
			)) {
				addMove(+entry[0], entry[1], learnset);
			}
		}
	} else {
		for (const prevo of reverseEvosForId(species.id)) {
			for (const entry of Object.entries(getLearnset(speciesForId(prevo)))) {
				addMove(+entry[0], entry[1], learnset);
			}
		}
	}

	return learnset;
}

export const Learnsets: { [k: string]: ModdedLearnsetData } =
	Object.fromEntries(
		readSpecies()
			.species.map<[SpeciesEnum, LearnsetMap]>((it) => [
				it.id,
				buildFullLearnset(it),
			])
			.map((it) => [speciesToId(it[0]),
				{
					learnset: Object.fromEntries(
						Object.entries(it[1]).map((entry) => [
							MoveEnum[+entry[0]]
								.replace("MOVE_", "")
								.split("_")
								.join("")
								.toLowerCase(),
							[entry[1] === true ? "7T" : `7${entry[1]}`],
						])
					),
				},
			])
	);
