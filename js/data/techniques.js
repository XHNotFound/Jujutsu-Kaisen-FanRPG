// js/data/techniques.js — 术式配置（严禁修改结构）

export const TECHNIQUES = [
  {
    id: "cursedEnergyBoost",
    name: "咒力强化术",
    description: "纯粹地以咒力强化身心。朴实但实用，没有明显短板。",
    flavorText: "最基础的术式，但运用得当也能跻身强者之列。",
    requirements: {}, // 空对象 = 无条件可选
    isDefault: true
  },
  {
    id: "limitless",
    name: "无下限术式",
    description: "操控空间，远近皆无敌。包含\"苍\"、\"赫\"、\"茈\"等派生。",
    flavorText: "最强术式，但对操控者要求极高。",
    requirements: { cursedEnergyControl: 28, talent: 28 },
    isDefault: false
  },
  {
    id: "tenShadows",
    name: "十种影法术",
    description: "以影子为媒介召唤十种式神。从玉犬到魔虚罗，潜力无限。",
    flavorText: "禅院家相传的术式，调伏仪式是使用者终身的课题。",
    requirements: { cursedEnergy: 24, cursedEnergyControl: 22 },
    isDefault: false
  },
  {
    id: "bloodManipulation",
    name: "赤血操术",
    description: "操控自身血液进行攻击、防御与强化。血之操纵者。",
    flavorText: "血即是武器，也是枷锁。每一次使用都在燃烧自身的生命力。",
    requirements: { constitution: 24, cursedEnergyEfficiency: 22 },
    isDefault: false
  },
  {
    id: "boogieWoogie",
    name: "不义游戏",
    description: "拍手即可交换目标位置。战术性极强，出其不意。",
    flavorText: "\"不义游戏 改\"——东堂葵的招牌术式，以最少的咒力达成最大的效果。",
    requirements: { cursedEnergyEfficiency: 20, martialArts: 20 },
    isDefault: false
  },
  {
    id: "strawDoll",
    name: "傀儡操术",
    description: "以咒力操控人偶进行远程攻击。可附加大范围诅咒。",
    flavorText: "通过媒介进行远程咒术操作，适合不善于近身战的咒术师。",
    requirements: { cursedEnergyControl: 22, talent: 20 },
    isDefault: false
  },
  {
    id: "overtime",
    name: "十划咒法",
    description: "以7:3的比例强制制造弱点并进行精准打击。七海家的传承术式。",
    flavorText: "\"工作时间到了。\"——七海建人的咒法，以最少的咒力代价换取最大的输出。",
    requirements: { martialArts: 22, cursedEnergyEfficiency: 22 },
    isDefault: false
  },
  {
    id: "curseManipulation",
    name: "咒灵操术",
    description: "吞噬并操控咒灵，将其化为自身的力量。",
    flavorText: "夏油杰的术式——掌握此术式者，即掌握了诅咒本身。",
    requirements: { cursedEnergy: 26, cursedEnergyControl: 24 },
    isDefault: false
  },
  {
    id: "pureMartial",
    name: "纯体术流",
    description: "完全放弃咒术，以压倒性的肉体能力进行战斗。",
    flavorText: "筋力。速度。反射。以纯粹的肉体极限超越一切。",
    requirements: { martialArts: 26, constitution: 26 },
    isDefault: false
  }
];
