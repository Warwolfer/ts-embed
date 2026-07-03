// Character stat calculations for TerraSphere Build Editor

const CharacterCalculations = {
  // Constants
  ARMOR_MULTIPLIERS: {
    light: 20,
    medium: 25,
    heavy: 30,
  },

  RANK_BONUSES: {
    0: 0, // E rank
    1: 10, // D rank
    2: 15, // C rank
    3: 25, // B rank
    4: 30, // A rank
    5: 40, // S rank
  },

  getRankBonus(rank) {
    return this.RANK_BONUSES[parseInt(rank) || 0] || 0;
  },

  BASE_HP: 100,
  BASE_MOVEMENT: 2,
  SAVE_MULTIPLIER: 5,
  EXPERTISE_MULTIPLIER: 5,

  // Calculate total HP
  calculateHP(state, masteryList, actionList) {
    const { armorType, armorRank, chosenActions } = state;

    let totalHP = this.BASE_HP;

    // Armor bonus
    if (armorType && this.ARMOR_MULTIPLIERS[armorType]) {
      const armorMultiplier = this.ARMOR_MULTIPLIERS[armorType];
      totalHP += parseInt(armorRank) * armorMultiplier;
    }

    // Action bonuses from actions.js
    for (const actionName of chosenActions) {
      const action = actionList.find((a) => a.lookup === actionName);
      if (action && action.bonuses && action.bonuses.hp) {
        if (
          action.bonuses.hp === "rank-based" &&
          actionName === "sturdy"
        ) {
          // Sturdy passive: 25 base + 5 per MR (D:+30, C:+35, B:+40, A:+45, S:+50), max +50
          // Use the highest effective defense rank (accounts for downcast when
          // defense is only a secondary role on the mastery).
          const sturdyMasteryRank = this.getHighestDefenseRank(
            state,
            masteryList,
          );
          const baseSturdy = 25;
          const sturdyBonus = Math.min(50, baseSturdy + 5 * sturdyMasteryRank);
          totalHP += sturdyBonus;
        } else if (
          action.bonuses.hp === "rank-based" &&
          actionName === "focus-defense"
        ) {
          // Defense Focus passive: +15 HP at D, +20 at B, +25 at S
          const praxisRank = this.getMasteryRankByLookup(state, "praxis");
          if (praxisRank >= 1) totalHP += 15; // D rank: +15
          if (praxisRank >= 3) totalHP += 5; // B rank: +5 additional (total +20)
          if (praxisRank >= 5) totalHP += 5; // S rank: +5 additional (total +25)
        } else if (
          action.bonuses.hp === "rank-based" &&
          actionName === "focus-movement"
        ) {
          // Speed Focus passive: +15 HP at D, +20 at B, +25 at S
          const praxisRank = this.getMasteryRankByLookup(state, "praxis");
          if (praxisRank >= 1) totalHP += 15; // D rank: +15
          if (praxisRank >= 3) totalHP += 5; // B rank: +5 additional (total +20)
          if (praxisRank >= 5) totalHP += 5; // S rank: +5 additional (total +25)
        } else if (typeof action.bonuses.hp === "number") {
          totalHP += action.bonuses.hp;
        }
      }
    }

    return totalHP;
  },

  // Calculate save bonuses
  calculateSaves(state, masteryList, actionList = []) {
    const {
      chosenMasteries,
      chosenMasteriesRanks,
      chosenActions = [],
      accessoryType,
      accessoryRank,
    } = state;
    const saves = { fortitude: 0, reflex: 0, will: 0 };

    // Mastery save bonuses only
    for (let i = 0; i < chosenMasteries.length; i++) {
      const mastery = masteryList.find((m) => m.lookup === chosenMasteries[i]);
      if (mastery && mastery.save) {
        const bonus = this.getRankBonus(chosenMasteriesRanks[i]);
        saves[mastery.save] += bonus;
      }
    }

    // Accessory save bonuses (+10 per rank)
    if (accessoryType && accessoryRank !== undefined) {
      const accessoryBonus = (accessoryRank + 1) * 10; // E=10, D=20, C=30, B=40, A=50, S=60

      switch (accessoryType) {
        case "combat":
          saves.fortitude += accessoryBonus;
          break;
        case "utility":
          saves.reflex += accessoryBonus;
          break;
        case "magic":
          saves.will += accessoryBonus;
          break;
      }
    }

    // Action bonuses for Defense Focus
    if (chosenActions.includes("focus-defense")) {
      // Defense Focus: +5 to all saves at D, +10 at B, +15 at S
      const praxisRank = this.getMasteryRankByLookup(state, "praxis");
      let saveBonus = 0;
      if (praxisRank >= 1) saveBonus = 5; // D rank: +5
      if (praxisRank >= 3) saveBonus = 10; // B rank: +10
      if (praxisRank >= 5) saveBonus = 15; // S rank: +15

      saves.fortitude += saveBonus;
      saves.reflex += saveBonus;
      saves.will += saveBonus;
    }

    return saves;
  },

  // Calculate movement
  calculateMovement(state, chosenActions, actionList) {
    let movement = this.BASE_MOVEMENT;

    // Action bonuses from actions.js
    for (const actionName of chosenActions) {
      const action = actionList.find((a) => a.lookup === actionName);
      if (action && action.bonuses && action.bonuses.movement) {
        if (
          action.bonuses.movement === "rank-based" &&
          actionName === "swift"
        ) {
          // Swift passive: +1 movement at D rank, +2 at S rank
          // Use the highest effective offense rank (accounts for downcast).
          const swiftMasteryRank = this.getHighestOffenseRank(state);
          if (swiftMasteryRank >= 1) movement += 1; // D rank: +1 movement
          if (swiftMasteryRank >= 5) movement += 1; // S rank: +1 additional (total +2)
        } else if (
          action.bonuses.movement === "rank-based" &&
          actionName === "acceleration"
        ) {
          // Acceleration passive: +2 movement at D rank, +3 at B rank, +4 at S rank
          const accelerationRank = this.getMasteryRankByLookup(state, "dynamism");
          if (accelerationRank >= 1) movement += 2; // D rank: +2 movement
          if (accelerationRank >= 3) movement += 1; // B rank: +1 additional (total +3)
          if (accelerationRank >= 5) movement += 1; // S rank: +1 additional (total +4)
        } else if (
          action.bonuses.movement === "rank-based" &&
          actionName === "focus-movement"
        ) {
          // Speed Focus passive: +1 movement at D rank, +2 at S rank
          const praxisRank = this.getMasteryRankByLookup(state, "praxis");
          if (praxisRank >= 1) movement += 1; // D rank: +1 movement
          if (praxisRank >= 5) movement += 1; // S rank: +1 additional (total +2)
        } else if (typeof action.bonuses.movement === "number") {
          movement += action.bonuses.movement;
        }
      }
    }

    return movement;
  },

  // Calculate range
  calculateRange(state, chosenActions, actionList) {
    let range = 1; // Default range is now 1

    // Action bonuses from actions.js
    for (const actionName of chosenActions) {
      const action = actionList.find((a) => a.lookup === actionName);
      if (action && action.bonuses && action.bonuses.range) {
        if (typeof action.bonuses.range === "number") {
          range += action.bonuses.range;
        }
      }
    }

    return range;
  },

  // Get a specific mastery's rank by its lookup id
  getMasteryRankByLookup(state, masteryLookup) {
    const { chosenMasteries, chosenMasteriesRanks } = state;
    const index = chosenMasteries.indexOf(masteryLookup);
    if (index === -1) return 0;
    return parseInt(chosenMasteriesRanks[index]) || 0;
  },

  // Get the highest effective mastery rank for a given role, accounting for
  // downcasting (a mastery used outside its primary role loses 1 rank).
  // Used by passive actions like Sturdy/Lethal/Blessed/Swift whose bonus
  // scales with the best mastery rank in their role category.
  getHighestRankForRole(state, masteryList, role) {
    const { chosenMasteries, chosenMasteriesRanks } = state;
    const list = masteryList || window.masteries || window.masterylist;
    if (!list || !chosenMasteries) return 0;

    let highest = 0;
    for (let i = 0; i < chosenMasteries.length; i++) {
      const mastery = list.find((m) => m.lookup === chosenMasteries[i]);
      if (!mastery) continue;
      const rawRank = parseInt(chosenMasteriesRanks[i]) || 0;
      let effectiveRank = -1;
      if (mastery.primaryRole === role) {
        effectiveRank = rawRank;
      } else if (mastery.secondaryRole === role) {
        effectiveRank = Math.max(0, rawRank - 1);
      }
      if (effectiveRank > highest) highest = effectiveRank;
    }
    return highest;
  },

  getHighestDefenseRank(state, masteryList) {
    return this.getHighestRankForRole(state, masteryList, "defense");
  },

  getHighestOffenseRank(state, masteryList) {
    return this.getHighestRankForRole(state, masteryList, "offense");
  },

  getHighestSupportRank(state, masteryList) {
    return this.getHighestRankForRole(state, masteryList, "support");
  },

  // Get complete character stats
  getCompleteStats(state, masteryList, actionList) {
    return {
      hp: this.calculateHP(state, masteryList, actionList),
      saves: this.calculateSaves(state, masteryList, actionList),
      movement: this.calculateMovement(state, state.chosenActions, actionList),
      range: this.calculateRange(state, state.chosenActions, actionList),
    };
  },

  // Validate mastery selection
  validateMasterySelection(masteries) {
    if (masteries.length > 6) {
      return {
        valid: false,
        error: "You may only select 6 masteries at maximum.",
      };
    }

    // Additional compatibility checks can be added here if needed

    return { valid: true };
  },

  // rank distribution validation: cumulative caps
  // - Max 2 slots at S or above (so 2×S max)
  // - Max 4 slots at A or above (so 2×S + 2×A max = 4 total)
  // - Unlimited slots at B or below
  validateMasteryRanks(ranks) {
    if (!ranks || ranks.length === 0) return { valid: true };

    const rankCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
    ranks.forEach((rank) => {
      const r = parseInt(rank) || 0;
      if (rankCounts.hasOwnProperty(r)) rankCounts[r]++;
    });

    const rankNames = { 5: "S", 4: "A", 3: "B", 2: "C", 1: "D", 0: "E" };

    // Check cumulative caps
    const sRanks = rankCounts[5];
    const aOrAbove = rankCounts[5] + rankCounts[4];
    const bOrAbove = rankCounts[5] + rankCounts[4] + rankCounts[3];

    // Max 2 S ranks
    if (sRanks > 2) {
      return {
        valid: false,
        message: `Too many S ranks: ${sRanks}/2 allowed. Only 2 slots can be S rank.`,
      };
    }

    // Max 4 ranks at A or above (S + A)
    if (aOrAbove > 4) {
      return {
        valid: false,
        message: `Too many A+ ranks: ${aOrAbove}/4 allowed. Max 4 slots can be A rank or higher (includes S ranks).`,
      };
    }

    // Max 6 ranks at B or above (unlimited, but checking max slots)
    if (bOrAbove > 6) {
      return {
        valid: false,
        message: `Too many ranks: ${bOrAbove}/6 allowed. Maximum 6 masteries/expertise.`,
      };
    }

    return { valid: true };
  },
};

// Make available globally
window.CharacterCalculations = CharacterCalculations;
