// js/data/attributes.js — 属性与评定阈值配置（严禁修改结构）

export const ATTRIBUTES = {
  cursedEnergy: { name: "咒力总量", base: 10 },
  cursedEnergyControl: { name: "咒力操控", base: 10 },
  cursedEnergyEfficiency: { name: "咒力效率", base: 10 },
  constitution: { name: "体质", base: 10 },
  martialArts: { name: "体术水平", base: 10 },
  talent: { name: "天赋", base: 10 }
};

export const RANK_THRESHOLDS = [
  { name: "不入流", min: 0 },
  { name: "四级", min: 16 },
  { name: "准三级", min: 20 },
  { name: "三级", min: 24 },
  { name: "准二级", min: 28 },
  { name: "二级", min: 32 },
  { name: "准一级", min: 36 },
  { name: "一级", min: 40 },
  { name: "准特级", min: 48 },
  { name: "特级", min: 56 },
  { name: "现代最强", min: 64 }
];
