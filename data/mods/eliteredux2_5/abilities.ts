import {AbilityEnum} from "../../proto/AbilityEnum_pb.js";
import {abilityToId, readAbilities} from "./data.js";

type MutableModdedAbilityData = {
	-readonly [key in keyof ModdedAbilityData]?: ModdedAbilityData[key];
};

export const Abilities: { [k: string]: ModdedAbilityData } = Object.fromEntries(
	readAbilities().ability.map((it) => {
		const ability = abilityBehaviors[it.id] || {};
		ability.name = it.name;
		ability.desc = it.description;
		return [abilityToId(it.id), ability as ModdedAbilityData];
	})
);

const abilityBehaviors: { [key in AbilityEnum]?: MutableModdedAbilityData } =
	{};
