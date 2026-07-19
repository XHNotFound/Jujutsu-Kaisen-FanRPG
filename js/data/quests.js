// js/data/quests.js — 任务数据配置（Phase 5 新增）
// 定义升职考核、NPC 任务、主线任务框架

export const QUESTS = {
  // ===== 升职考核 =====
  promotions: [
    {
      id: "promo_grade4",
      name: "四级咒术师考核",
      description: "咒术高专的基础考核。证明你具备成为正式咒术师的实力。",
      requirements: {
        attributes: { cursedEnergy: 16, martialArts: 16 }
      },
      cost: { ap: 30 },
      reward: {
        money: 100,
        skillPoints: 2,
        newRank: "四级"
      },
      storyText: "「考核内容：祓除指定区域内的一级以下咒灵。准备好了吗？」"
    },
    {
      id: "promo_grade3",
      name: "三级咒术师考核",
      description: "晋升三级咒术师的考核，需要更强的综合实力。",
      requirements: {
        attributes: { cursedEnergy: 20, martialArts: 20, cursedEnergyControl: 20 }
      },
      cost: { ap: 30 },
      reward: {
        money: 200,
        skillPoints: 3,
        newRank: "三级"
      },
      storyText: "「这次的目标是特级咒胎。虽然危险，但以你的实力应该没问题。」"
    },
    {
      id: "promo_grade2",
      name: "二级咒术师考核",
      description: "晋升二级的考核，只有真正的强者才能通过。",
      requirements: {
        attributes: { cursedEnergy: 28, martialArts: 28, cursedEnergyControl: 26 }
      },
      cost: { ap: 30 },
      reward: {
        money: 400,
        skillPoints: 5,
        newRank: "二级"
      },
      storyText: "「你面对的将是真正的特级咒灵。活着回来。」"
    },
    {
      id: "promo_grade1",
      name: "一级咒术师考核",
      description: "晋升一级的考核。这是通向特级之路的最后一道关卡。",
      requirements: {
        attributes: { cursedEnergy: 36, martialArts: 36, cursedEnergyControl: 34, talent: 32 }
      },
      cost: { ap: 30 },
      reward: {
        money: 800,
        skillPoints: 8,
        newRank: "一级"
      },
      storyText: "「一级咒术师——那是能够独自处理特级灾害的存在。让我看看你的觉悟。」"
    }
  ],

  // ===== NPC 任务（跑腿/收集） =====
  npcTasks: [
    {
      id: "npc_errand_1",
      name: "诅咒残秽调查",
      description: "前往废弃大楼调查诅咒残秽的源头。",
      cost: { ap: 20 },
      reward: {
        money: 30,
        relationship: 2,
        storyText: "你在废弃大楼中发现了几只低级咒灵，轻松祓除了它们。"
      }
    },
    {
      id: "npc_errand_2",
      name: "护送任务",
      description: "护送辅助监督前往指定地点布置结界。",
      cost: { ap: 20 },
      reward: {
        money: 25,
        relationship: 2,
        storyText: "一路上没有遇到太大的麻烦，辅助监督对你的效率表示赞赏。"
      }
    },
    {
      id: "npc_errand_3",
      name: "咒物回收",
      description: "回收被诅咒的咒物，注意不要被其蛊惑。",
      cost: { ap: 20 },
      reward: {
        money: 50,
        relationship: 2,
        storyText: "咒物已被安全封印。你在接触咒物的过程中感受到了一丝微弱的灵感。",
        inspirationGained: true
      }
    }
  ],

  // ===== 主线任务框架 =====
  mainStory: [
    {
      id: "main_ch1",
      name: "第一章：咒术高专",
      description: "踏入咒术高专的大门，你的故事从这里开始。",
      cost: { ap: 10 },
      storyText: "东京都立咒术高等专门学校——培养咒术师的最高学府。\n「欢迎来到咒术高专。从今天起，你就是一名咒术师了。」\n夜蛾正道校长的声音在校舍中回荡。你将与五条悟、夏油杰等最强的咒术师们并肩作战。",
      unlockChapter: 2
    },
    {
      id: "main_ch2",
      name: "第二章：姐妹校交流会",
      description: "东京校与京都校的年度交流会即将开始。",
      cost: { ap: 10 },
      storyText: "「今年的交流会，可不会像去年那样简单了。」\n五条悟罕见地露出了认真的表情。\n京都校的东堂葵、禅院真依等强者已蓄势待发。这是检验你修行成果的最好舞台。",
      requiresChapter: 2
    },
    {
      id: "main_ch3",
      name: "第三章：涉谷事变",
      description: "涉谷——这座城市即将成为咒术史上最惨烈的战场。",
      cost: { ap: 10 },
      storyText: "「涉谷…涉谷…」\n地铁站内回荡着诡异的回音。\n特级咒灵们布下了天罗地网，涉谷的百万民众成为了人质。\n这是改变咒术界格局的一战。",
      requiresChapter: 3
    }
  ]
};
