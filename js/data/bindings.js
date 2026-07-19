// js/data/bindings.js — 天与咒缚配置（严禁修改结构）

export const BINDINGS = [
  {
    id: "none",
    name: "不选择天与咒缚",
    description: "以平凡之躯前行。没有额外的代价，也没有额外的力量。",
    costs: {},
    bonuses: {},
    flavorText: ""
  },
  {
    id: "geel",
    name: "甚尔之缚",
    description: "完全丧失咒力，换取超凡的体术和体质。",
    costs: { cursedEnergy: -99, cursedEnergyControl: -99, cursedEnergyEfficiency: -99 },
    bonuses: { constitution: 5, martialArts: 6, talent: 2 },
    flavorText: "天与暴君 — 甚尔。咒力为零的绝对肉体。"
  },
  {
    id: "mechamaru",
    name: "机械丸之缚",
    description: "以残破之躯换取广阔的咒力感知范围与操控精度。",
    costs: { constitution: -8, martialArts: -4 },
    bonuses: { cursedEnergy: 4, cursedEnergyControl: 5, cursedEnergyEfficiency: 3 },
    flavorText: "以天为代价，换取超越肉体极限的咒术天赋。"
  }
];
