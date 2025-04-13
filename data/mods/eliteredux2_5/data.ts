import { create, fromBinary, Message } from '@bufbuild/protobuf';
import { GenMessage } from '@bufbuild/protobuf/codegenv1';
import { execSync } from 'child_process';
import { platform } from 'os';
import { Move, MoveList, MoveListSchema } from '../../../proto/MoveList_pb.js';
import { AbilityList, AbilityListSchema, Ability } from '../../../proto/AbilityList_pb.js';
import { SpeciesList, SpeciesListSchema } from '../../../proto/SpeciesList_pb.js';
import { Item, ItemList, ItemListSchema } from '../../../proto/ItemList_pb.js';
import { readdirSync } from 'fs';
import { SpeciesEnum } from '../../../proto/SpeciesEnum_pb.js';
import { Species } from "../../../proto/SpeciesList_pb.js";
import { AbilityEnum } from '../../../proto/AbilityEnum_pb.js';
import { ItemEnum } from '../../../proto/ItemEnum_pb.js';
import { MoveEnum } from '../../../proto/MoveEnum_pb.js';

function protocLocation() {
	switch (platform()) {
		case 'linux': return "./protoc-linux"
		case 'win32': return "protoc.exe"
		case 'darwin': return "./protoc-osx"
		default:
			console.error(`No proto compiler available for platform ${platform()}`)
			throw "No proto compiler available for platform"
	}
}

const ER_CONFIG_PATH = "er-config-2.5"

export function readTextproto<T extends Message>(schema: GenMessage<T>, textprotoFile?: string): T {
	const protoName = schema.name

	const textprotoName = textprotoFile || `${protoName}.textproto`

	const command = `${protocLocation()} \
	  --encode=er.${protoName} \
	  --proto_path=./er-config \
	  --experimental_allow_proto3_optional \
	  ./er-config/${protoName}.proto \
	  < ./${ER_CONFIG_PATH}/${textprotoName}`

	console.log(command)
	const ret = execSync(command)

	return fromBinary(schema, ret)
}

let moveList: MoveList | undefined = undefined
export function readMoves(): MoveList {
	moveList = moveList || readTextproto(MoveListSchema)
	return moveList
}

let moveMap: {[key in MoveEnum]?: Move} | undefined
export function moveForId(move: MoveEnum): Move {
	moveMap = moveMap || Object.fromEntries(readMoves().moves.map(it => [it.id, it]))
	return moveMap[move]!!
}

let abilityList: AbilityList | undefined = undefined
export function readAbilities(): AbilityList {
	abilityList = abilityList || readTextproto(AbilityListSchema)
	return abilityList
}

let abilityMap: {[key in AbilityEnum]?: Ability} | undefined
export function abilityForId(ability: AbilityEnum): Ability {
	abilityMap = abilityMap || Object.fromEntries(readAbilities().ability.map(it => [it.id, it]))
	return abilityMap[ability]!!
}

let speciesList: SpeciesList | undefined = undefined
export function readSpecies(): SpeciesList {
	speciesList = speciesList || readTextproto(SpeciesListSchema)
	return speciesList
}

let speciesMap: {[key in SpeciesEnum]?: Species} | undefined
export function speciesForId(species: SpeciesEnum): Species {
	speciesMap = speciesMap || Object.fromEntries(readSpecies().species.map(it => [it.id, it]))
	return speciesMap[species]!!
}

let reverseEvoMap: {[key in SpeciesEnum]?: SpeciesEnum[]}  | undefined
export function reverseEvosForId(species: SpeciesEnum): SpeciesEnum[] {
	if (!reverseEvoMap) {
		reverseEvoMap = readSpecies().species.reduce((arr: {[key in SpeciesEnum]?: SpeciesEnum[]}, it: Species) => {
			for (const evo of it.evo) {
				arr[evo.to] = arr[evo.to] || []
				if (!arr[evo.to]?.includes(it.id)) arr[evo.to]?.push(it.id)
			}
		return arr
		}, {})
	}
	return reverseEvoMap[species] || []
}

let itemList: ItemList | undefined = undefined
export function readItems(): ItemList {
	if (!itemList) {
		itemList = create(ItemListSchema)
		for (const file of readdirSync(`./${ER_CONFIG_PATH}/items/`)) {
			if (!file.endsWith(".textproto")) continue
			itemList.item.push(...readTextproto(ItemListSchema, `items/${file}`).item)
		}
	}
	return itemList
}

let itemMap: {[key in ItemEnum]?: Item} | undefined
export function itemForId(item: ItemEnum): Item {
	itemMap = itemMap || Object.fromEntries(readItems().item.map(it => [it.id, it]))
	return itemMap[item]!!
}
