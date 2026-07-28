// js/data/items.js — 道具数据配置（Phase 13）
// 定义基础消耗道具的配置和效果
// 严禁包含任何 DOM 操作或 UI 逻辑

/**
 * 道具数据结构:
 * {
 *   id: string,
 *   name: string,
 *   category: "restore" | "cleanse" | "misc",
 *   price: number,
 *   description: string,
 *   effect: {
 *     type: "restore_stamina" | "restore_hp" | "restore_mp" | "clear_residual" | "clear_cooldown",
 *     amount?: number,  // 恢复量
 *     pct?: number      // 恢复百分比
 *   },
 *   usableInBattle: boolean
 * }
 */

export const ITEMS = {
  // ================================================================
  //  恢复类道具
  // ================================================================
  rationPill: {
    id: "rationPill",
    name: "兵粮丸",
    category: "restore",
    price: 50,
    description: "咒术师特制的便携口粮，可快速恢复30点体力。",
    effect: { type: "restore_stamina", amount: 30 },
    usableInBattle: false
  },

  cursedCandy: {
    id: "cursedCandy",
    name: "咒力糖果",
    category: "restore",
    price: 60,
    description: "注入微量咒力的糖果，食用后可恢复25点咒力(MP)。",
    effect: { type: "restore_mp", amount: 25 },
    usableInBattle: false
  },

  healingTalisman: {
    id: "healingTalisman",
    name: "治疗符咒",
    category: "restore",
    price: 80,
    description: "刻有反转术式符文的纸符，可恢复20%最大生命值。",
    effect: { type: "restore_hp", pct: 0.20 },
    usableInBattle: false
  },

  // ================================================================
  //  净化类道具
  // ================================================================
  pureSalt: {
    id: "pureSalt",
    name: "清净盐",
    category: "cleanse",
    price: 100,
    description: "纯洁之盐，撒在身上可以清除所有咒力残秽。",
    effect: { type: "clear_residual" },
    usableInBattle: false
  },

  omamori: {
    id: "omamori",
    name: "御守",
    category: "cleanse",
    price: 150,
    description: "神社加持过的护身符，可清除所有咒力残秽并获得少量体力恢复。",
    effect: { type: "clear_residual", bonus: { stamina: 15 } },
    usableInBattle: false
  },

  // ================================================================
  //  战斗道具（基础）
  // ================================================================
  smokeBomb: {
    id: "smokeBomb",
    name: "烟雾弹",
    category: "misc",
    price: 40,
    description: "投掷后产生浓烟，战斗中使用可立即脱离战斗（必定成功）。",
    effect: { type: "flee_guaranteed" },
    usableInBattle: true
  },

  adrenalineShot: {
    id: "adrenalineShot",
    name: "肾上腺素注射剂",
    category: "restore",
    price: 120,
    description: "战斗中紧急使用，可立即恢复60点HP。",
    effect: { type: "restore_hp", amount: 60 },
    usableInBattle: true
  },

  // ================================================================
  //  Phase 18: 钱袋系道具（"保险"机制 — 重伤减半金币的对冲手段）
  //  不会出现在每日商店中；只在常驻商店售卖
  // ================================================================
  lightCoinPouch: {
    id: "lightCoinPouch",
    name: "轻巧钱袋",
    category: "misc",
    price: 100,
    description: "打开后获得60金币。像魂一样——这是重伤丢钱时最后的保险。",
    effect: { type: "gain_money", amount: 60 },
    usableInBattle: false
  },

  heavyCoinPouch: {
    id: "heavyCoinPouch",
    name: "沉重钱袋",
    category: "misc",
    price: 500,
    description: "打开后获得400金币。沉甸甸的——金币在里面叮当作响。",
    effect: { type: "gain_money", amount: 400 },
    usableInBattle: false
  },

  overflowingCoinPouch: {
    id: "overflowingCoinPouch",
    name: "满溢钱袋",
    category: "misc",
    price: 1000,
    description: "打开后获得900金币。里面的金光几乎要溢出来了。",
    effect: { type: "gain_money", amount: 900 },
    usableInBattle: false
  }
};

/**
 * 获取道具完整配置
 * @param {string} itemId
 * @returns {object|null}
 */
export function getItem(itemId) {
  return ITEMS[itemId] || null;
}

/**
 * 检查道具是否可用于战斗
 * @param {string} itemId
 * @returns {boolean}
 */
export function isBattleUsable(itemId) {
  const item = ITEMS[itemId];
  return item ? item.usableInBattle : false;
}
