// js/modules/shopSystem.js — 商店系统逻辑层（Phase 18）
// 每日商店 + 黑市：纯数据/逻辑，严禁 DOM 操作
// 负责刷新商品、折扣计算、黑市假货判定、购买校验

import { ITEMS, getItem } from '../data/items.js';
import { CURSED_TOOLS, getCursedTool } from '../data/cursed_tools.js';

// ================================================================
//  常量配置
// ================================================================

// 每日商店：每个自然日刷新 4 样商品，每样限购 1 件
const DAILY_SHOP_SLOTS = 4;
const DAILY_SHOP_SEED_BASE = 100;
const DISCOUNT_OPTIONS = [0, 0.10, 0.20, 0.25, 0.30, 0.40];  // 可能的折扣档位（0 = 不打折）

// 每日商店的普通咒具池（只有 Tier 1-2、无主动效果的工具）
const DAILY_TOOL_POOL = [
  "normalCursedBlade", "ironBracers", "cursedRing", "woodenTalisman",
  "reinforcedBlade", "dragonScaleBracer", "jadePendant", "combatGloves", "spiritCharm",
  "cursedDagger", "ironFan", "shadowCloak", "focusBand"
];

// 黑市：每周刷新，需要 hakari 人情 >= 10 解锁
const BLACK_MARKET_SLOTS = 4;
const BLACK_MARKET_FAKE_CHANCE = 0.15;  // 15% 概率假货
const BLACK_MARKET_SEED_BASE = 200;

// 黑市咒具池（包含特级咒具、高级咒具）
const BLACK_MARKET_TOOL_POOL = [
  // 特级
  "playfulCloud", "blackRope", "soulLiberationBlade", "invertedSpearOfHeaven", "rottenLifeBlade",
  // Tier 3 无主动效果的咒具
  "dragonBoneBlade", "cursedEnergyGauntlet", "splitSoulKatana", "cursedWardingBeads",
  // 也可能刷出 Tier 2（但数量少）
  "reinforcedBlade", "jadePendant"
];

// ================================================================
//  商店数据类
// ================================================================

class ShopSlot {
  constructor(id, name, price, basePrice, type, config = {}) {
    this.id = id;            // item ID 或 tool ID
    this.name = name;        // 显示名称
    this.price = price;      // 实际售价（含折扣）
    this.basePrice = basePrice;  // 原价
    this.type = type;        // "item" | "tool"
    this.discount = config.discount || 0;  // 折扣率
    this.purchased = false;  // 是否已被购买
    this.isFake = config.isFake || false;  // 黑市假货
  }
}

export class ShopSystem {
  constructor() {
    // 商店状态（需持久化到存档）
    this._dailyShop = {
      lastRefreshDay: 0,      // 上次刷新的游戏日（gameDay）
      slots: []               // ShopSlot[]
    };
    this._blackMarket = {
      lastRefreshWeek: 0,     // 上次刷新的周数（Math.floor(gameDay / 7)）
      slots: []               // ShopSlot[]
    };
  }

  /**
   * 从存档恢复商店状态
   */
  restoreFromSave(saveData) {
    if (!saveData) return;
    if (saveData._shopDaily) {
      this._dailyShop.lastRefreshDay = saveData._shopDaily.lastRefreshDay || 0;
      this._dailyShop.slots = (saveData._shopDaily.slots || []).map(s =>
        new ShopSlot(s.id, s.name, s.price, s.basePrice, s.type, { discount: s.discount || 0, isFake: s.isFake || false })
      );
      // 恢复 purchased 状态
      (saveData._shopDaily.slots || []).forEach((s, i) => {
        if (this._dailyShop.slots[i]) this._dailyShop.slots[i].purchased = s.purchased || false;
      });
    }
    if (saveData._shopBlackMarket) {
      this._blackMarket.lastRefreshWeek = saveData._shopBlackMarket.lastRefreshWeek || 0;
      this._blackMarket.slots = (saveData._shopBlackMarket.slots || []).map(s =>
        new ShopSlot(s.id, s.name, s.price, s.basePrice, s.type, { discount: s.discount || 0, isFake: s.isFake || false })
      );
      (saveData._shopBlackMarket.slots || []).forEach((s, i) => {
        if (this._blackMarket.slots[i]) this._blackMarket.slots[i].purchased = s.purchased || false;
      });
    }
  }

  /**
   * 序列化商店状态用于存档
   */
  toSaveData() {
    return {
      _shopDaily: {
        lastRefreshDay: this._dailyShop.lastRefreshDay,
        slots: this._dailyShop.slots.map(s => ({ id: s.id, name: s.name, price: s.price, basePrice: s.basePrice, type: s.type, discount: s.discount, purchased: s.purchased }))
      },
      _shopBlackMarket: {
        lastRefreshWeek: this._blackMarket.lastRefreshWeek,
        slots: this._blackMarket.slots.map(s => ({ id: s.id, name: s.name, price: s.price, basePrice: s.basePrice, type: s.type, discount: s.discount, purchased: s.purchased, isFake: s.isFake }))
      }
    };
  }

  /**
   * 伪随机数生成器（seeded PRNG）
   */
  _seededRandom(seed) {
    let s = seed | 0;
    s = (s + 0x9E3779B9) | 0;
    s = Math.imul(s ^ (s >>> 16), 0x85EBCA6B);
    s = Math.imul(s ^ (s >>> 13), 0xC2A2EA15);
    s = s ^ (s >>> 16);
    return (s >>> 0) / 4294967296;
  }

  /**
   * 刷新每日商店
   * @param {number} gameDay — 当前游戏天数
   * @returns {ShopSlot[]}
   */
  refreshDailyShop(gameDay) {
    if (this._dailyShop.lastRefreshDay >= gameDay && this._dailyShop.slots.length > 0) {
      return this._dailyShop.slots;
    }

    const seed = DAILY_SHOP_SEED_BASE + gameDay;
    const slots = [];
    const usedIds = new Set();

    for (let i = 0; i < DAILY_SHOP_SLOTS; i++) {
      // 70% 概率道具，30% 概率咒具
      const isTool = this._seededRandom(seed + i * 13 + 1) < 0.30;
      let slot;

      if (isTool) {
        const pool = DAILY_TOOL_POOL;
        let toolId = pool[Math.floor(this._seededRandom(seed + i * 17 + 3) * pool.length)];
        // 避免重复
        let attempts = 0;
        while (usedIds.has(toolId) && attempts < 20) {
          toolId = pool[Math.floor(this._seededRandom(seed + i * 17 + 3 + attempts) * pool.length)];
          attempts++;
        }
        usedIds.add(toolId);
        const tool = getCursedTool(toolId);
        if (!tool) continue;
        const dIdx = Math.floor(this._seededRandom(seed + i * 23 + 7) * DISCOUNT_OPTIONS.length);
        const discount = DISCOUNT_OPTIONS[dIdx];
        const price = Math.max(1, Math.round(tool.price * (1 - discount)));
        slot = new ShopSlot(toolId, tool.name, price, tool.price, "tool", { discount });
      } else {
        const itemKeys = Object.keys(ITEMS).filter(k => ITEMS[k].category !== 'misc' || k === 'smokeBomb');
        let itemId = itemKeys[Math.floor(this._seededRandom(seed + i * 19 + 5) * itemKeys.length)];
        let attempts = 0;
        while (usedIds.has(itemId) && attempts < 20) {
          itemId = itemKeys[Math.floor(this._seededRandom(seed + i * 19 + 5 + attempts) * itemKeys.length)];
          attempts++;
        }
        usedIds.add(itemId);
        const item = getItem(itemId);
        if (!item) continue;
        const dIdx = Math.floor(this._seededRandom(seed + i * 31 + 11) * DISCOUNT_OPTIONS.length);
        const discount = DISCOUNT_OPTIONS[dIdx];
        const price = Math.max(1, Math.round(item.price * (1 - discount)));
        slot = new ShopSlot(itemId, item.name, price, item.price, "item", { discount });
      }
      slots.push(slot);
    }

    this._dailyShop.lastRefreshDay = gameDay;
    this._dailyShop.slots = slots;
    return slots;
  }

  /**
   * 刷新黑市
   * @param {number} gameWeek — 当前游戏周数 (Math.floor(gameDay / 7))
   * @param {object} characterState — 用于判断 hakari 人情
   * @returns {{ slots: ShopSlot[], unlocked: boolean }}
   */
  refreshBlackMarket(gameWeek, characterState) {
    const rel = characterState.relationships || {};
    const hakariRel = rel["hakari"] || 0;
    const blackMarketUnlocked = characterState._unlocks?.black_market || false;

    if (!blackMarketUnlocked || hakariRel < 10) {
      return { slots: [], unlocked: false };
    }

    if (this._blackMarket.lastRefreshWeek >= gameWeek && this._blackMarket.slots.length > 0) {
      return { slots: this._blackMarket.slots, unlocked: true };
    }

    const seed = BLACK_MARKET_SEED_BASE + gameWeek;
    const slots = [];
    const usedIds = new Set();

    for (let i = 0; i < BLACK_MARKET_SLOTS; i++) {
      const pool = BLACK_MARKET_TOOL_POOL;
      let toolId = pool[Math.floor(this._seededRandom(seed + i * 11 + 2) * pool.length)];
      let attempts = 0;
      while (usedIds.has(toolId) && attempts < 20) {
        toolId = pool[Math.floor(this._seededRandom(seed + i * 11 + 2 + attempts) * pool.length)];
        attempts++;
      }
      usedIds.add(toolId);
      const tool = getCursedTool(toolId);
      if (!tool) continue;

      // 黑市：价格1.2~2.0倍，有15%概率为假货（价格走低）
      const priceMultiplier = 1.2 + this._seededRandom(seed + i * 29 + 13) * 0.8;
      const isFake = this._seededRandom(seed + i * 37 + 17) < BLACK_MARKET_FAKE_CHANCE;
      const price = isFake
        ? Math.round(tool.price * 0.8)   // 假货较便宜（诱饵）
        : Math.round(tool.price * priceMultiplier);

      const slot = new ShopSlot(toolId, tool.name, price, tool.price, "tool", {
        discount: 0,
        isFake
      });
      slots.push(slot);
    }

    this._blackMarket.lastRefreshWeek = gameWeek;
    this._blackMarket.slots = slots;
    return { slots, unlocked: true };
  }

  /**
   * 在每日商店购买（每样限购 1 件）
   */
  buyDailyShopSlot(slotIndex, characterState) {
    const slots = this._dailyShop.slots;
    if (slotIndex < 0 || slotIndex >= slots.length) {
      return { success: false, log: "无效的商品槽位。", updatePayload: null };
    }
    const slot = slots[slotIndex];
    if (slot.purchased) {
      return { success: false, log: "该商品已售罄。（每日每样限购1件）", updatePayload: null };
    }
    const money = characterState.money || 0;
    if (money < slot.price) {
      return { success: false, log: `金钱不足！需要 ${slot.price} 金币，当前 ${money} 金币。`, updatePayload: null };
    }

    slot.purchased = true;
    const payload = { money: -slot.price };
    const discountText = slot.discount > 0 ? `（${Math.round(slot.discount * 100)}% 折扣！原价 ${slot.basePrice} 金币）` : '';

    if (slot.type === "item") {
      payload.inventory = { [slot.id]: 1 };
      return { success: true, log: `购买了「${slot.name}」，花费 ${slot.price} 金币。${discountText}`, updatePayload: payload };
    } else {
      // Phase 18 fix: 使用 ownedCursedTools_add 写入，由 SaveManager 统一管理拥有列表
      payload.ownedCursedTools_add = slot.id;
      return { success: true, log: `购买了「${slot.name}」，花费 ${slot.price} 金币。${discountText}`, updatePayload: payload };
    }
  }

  /**
   * 在黑市购买
   * @returns {{ success, log, updatePayload, isFake? }}
   */
  buyBlackMarketSlot(slotIndex, characterState) {
    const slots = this._blackMarket.slots;
    if (slotIndex < 0 || slotIndex >= slots.length) {
      return { success: false, log: "无效的商品槽位。", updatePayload: null };
    }
    const slot = slots[slotIndex];
    if (slot.purchased) {
      return { success: false, log: "该商品已售罄。（本周已被人抢先买入）", updatePayload: null };
    }
    const money = characterState.money || 0;
    if (money < slot.price) {
      return { success: false, log: `金钱不足！需要 ${slot.price} 金币，当前 ${money} 金币。`, updatePayload: null };
    }

    slot.purchased = true;

    if (slot.isFake) {
      // 假货：扣钱但不给东西
      return {
        success: true,
        log: `你付了 ${slot.price} 金币买下了「${slot.name}」……但打开箱子发现是个空壳！财去货空！`,
        updatePayload: { money: -slot.price },
        isFake: true
      };
    }

    const payload = { money: -slot.price };
    // Phase 18 fix: 使用 ownedCursedTools_add 写入
    payload.ownedCursedTools_add = slot.id;
    return { success: true, log: `在黑市购得「${slot.name}」，花费 ${slot.price} 金币。好货不便宜！`, updatePayload: payload };
  }

  /**
   * 获取每日商店当前商品列表
   */
  getDailyShopSlots() {
    return this._dailyShop.slots;
  }

  /**
   * 获取黑市当前商品列表
   */
  getBlackMarketSlots() {
    return this._blackMarket.slots;
  }

  /**
   * 检查黑市是否已解锁
   */
  isBlackMarketUnlocked(characterState) {
    const rel = characterState.relationships || {};
    const hakariRel = rel["hakari"] || 0;
    const unlocked = characterState._unlocks?.black_market || false;
    return unlocked && hakariRel >= 10;
  }
}
