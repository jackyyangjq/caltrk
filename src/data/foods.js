/* ── 食物库（权威副本在 OneDrive calorie-tracker/food_library.json，
      此处为构建时内嵌的只读副本。条目只增不删，id 一经发布不改）──── */
export var FOOD_LIBRARY = [
  { id: "oats-dry", name: "燕麦片（干）", per_100g: { kcal: 375, protein: 11.0, fat: 8.0, carb: 60.0 },
    portions: [{ label: "1 小袋", grams: 27 }, { label: "1 碗（干）", grams: 40 }], default_portion: "1 小袋", confidence: "low" },
  { id: "whole-milk", name: "全脂牛奶", per_100g: { kcal: 66, protein: 3.5, fat: 3.7, carb: 4.7 },
    portions: [{ label: "1 杯 250ml", grams: 250 }, { label: "1 小盒 200ml", grams: 200 }], default_portion: "1 杯 250ml", confidence: "high" },
  { id: "egg-boiled", name: "鸡蛋（水煮）", per_100g: { kcal: 155, protein: 12.6, fat: 10.6, carb: 1.1 },
    portions: [{ label: "1 个", grams: 50 }, { label: "2 个", grams: 100 }], default_portion: "1 个", confidence: "low" },
  { id: "wholemeal-bread", name: "全麦面包", per_100g: { kcal: 247, protein: 11.0, fat: 3.0, carb: 41.0 },
    portions: [{ label: "1 片", grams: 36 }, { label: "2 片", grams: 72 }], default_portion: "1 片", confidence: "low" },
  { id: "white-bread", name: "白面包", per_100g: { kcal: 265, protein: 9.0, fat: 3.2, carb: 49.0 },
    portions: [{ label: "1 片", grams: 38 }, { label: "2 片", grams: 76 }], default_portion: "1 片", confidence: "low" },
  { id: "yogurt-whole", name: "全脂原味酸奶", per_100g: { kcal: 61, protein: 3.5, fat: 3.3, carb: 4.7 },
    portions: [{ label: "1 小杯 125g", grams: 125 }, { label: "1 大杯 170g", grams: 170 }], default_portion: "1 小杯 125g", confidence: "low" },
  { id: "granola", name: "M&S 蜂蜜燕麦脆 granola（1kg 袋）", per_100g: { kcal: 406, protein: 11.2, fat: 8.7, carb: 67.5 },
    portions: [{ label: "1 份（标签）45g", grams: 45 }, { label: "小把约 25g", grams: 25 }], default_portion: "1 份（标签）45g", confidence: "high" },
  { id: "banana", name: "香蕉（去皮）", per_100g: { kcal: 89, protein: 1.1, fat: 0.3, carb: 22.8 },
    portions: [{ label: "1 根（中）", grams: 118 }, { label: "1 根（大）", grams: 136 }], default_portion: "1 根（中）", confidence: "low" },
  { id: "apple", name: "苹果（去核）", per_100g: { kcal: 52, protein: 0.3, fat: 0.2, carb: 13.8 },
    portions: [{ label: "1 个（中）", grams: 180 }], default_portion: "1 个（中）", confidence: "low" },
  { id: "rice-cooked", name: "米饭（熟）", per_100g: { kcal: 116, protein: 2.6, fat: 0.3, carb: 25.9 },
    portions: [{ label: "1 碗 150g", grams: 150 }, { label: "半碗", grams: 75 }, { label: "大碗 200g", grams: 200 }], default_portion: "1 碗 150g", confidence: "low" },
  { id: "pasta-cooked", name: "意面（熟）", per_100g: { kcal: 158, protein: 5.8, fat: 0.9, carb: 31.0 },
    portions: [{ label: "1 份 180g", grams: 180 }, { label: "大份 250g", grams: 250 }], default_portion: "1 份 180g", confidence: "low" },
  { id: "potato-boiled", name: "土豆（煮）", per_100g: { kcal: 87, protein: 1.9, fat: 0.1, carb: 20.0 },
    portions: [{ label: "1 个（中）", grams: 170 }], default_portion: "1 个（中）", confidence: "low" },
  { id: "chicken-breast", name: "鸡胸肉（熟）", per_100g: { kcal: 165, protein: 31.0, fat: 3.6, carb: 0 },
    portions: [{ label: "1 块 150g", grams: 150 }, { label: "小块 100g", grams: 100 }, { label: "大份 220g", grams: 220 }], default_portion: "1 块 150g", confidence: "low" },
  { id: "beef-lean-cooked", name: "瘦牛肉（熟）", per_100g: { kcal: 250, protein: 26.0, fat: 15.0, carb: 0 },
    portions: [{ label: "1 份 150g", grams: 150 }], default_portion: "1 份 150g", confidence: "low" },
  { id: "salmon-cooked", name: "三文鱼（熟）", per_100g: { kcal: 208, protein: 20.0, fat: 13.0, carb: 0 },
    portions: [{ label: "1 块 125g", grams: 125 }], default_portion: "1 块 125g", confidence: "low" },
  { id: "broccoli-cooked", name: "西兰花（熟）", per_100g: { kcal: 35, protein: 2.4, fat: 0.4, carb: 7.2 },
    portions: [{ label: "1 份 150g", grams: 150 }, { label: "大份 200g", grams: 200 }], default_portion: "1 份 150g", confidence: "low" },
  { id: "olive-oil", name: "橄榄油（炒菜用油）", per_100g: { kcal: 884, protein: 0, fat: 100.0, carb: 0 },
    portions: [{ label: "一餐用油 10g", grams: 10 }, { label: "1 勺 14g", grams: 14 }], default_portion: "一餐用油 10g", confidence: "low" },
  { id: "peanut-butter", name: "花生酱", per_100g: { kcal: 588, protein: 25.0, fat: 50.0, carb: 20.0 },
    portions: [{ label: "1 勺 15g", grams: 15 }, { label: "2 勺 30g", grams: 30 }], default_portion: "1 勺 15g", confidence: "low" },
  { id: "latte-whole", name: "拿铁（全脂，中杯）", per_100g: { kcal: 56, protein: 2.9, fat: 3.0, carb: 4.5 },
    portions: [{ label: "中杯 350ml", grams: 350 }], default_portion: "中杯 350ml", confidence: "low" },
  { id: "cola", name: "可乐", per_100g: { kcal: 42, protein: 0, fat: 0, carb: 10.6 },
    portions: [{ label: "1 罐 330ml", grams: 330 }], default_portion: "1 罐 330ml", confidence: "low" },
  { id: "crisps", name: "薯片（小包）", per_100g: { kcal: 530, protein: 6.0, fat: 31.0, carb: 53.0 },
    portions: [{ label: "1 小包 25g", grams: 25 }], default_portion: "1 小包 25g", confidence: "low" },
  { id: "ms-prawn-salad", name: "M&S 鲜虾沙拉（玛丽玫瑰酱）", per_100g: { kcal: 93, protein: 4.5, fat: 3.5, carb: 10.9 },
    portions: [{ label: "半盒", grams: 200 }, { label: "整盒", grams: 400 }], default_portion: "半盒", confidence: "high" },
  { id: "ms-chicken-chipotle-sub", name: "M&S 鸡肉辣椒蛋黄酱三明治", per_100g: { kcal: 224, protein: 9.1, fat: 8.0, carb: 28.1 },
    portions: [{ label: "整包", grams: 192 }, { label: "半包", grams: 96 }], default_portion: "整包", confidence: "high" },
  { id: "tesco-strawberry-granola-yogurt-pot", name: "Tesco 草莓燕麦希腊酸奶杯", per_100g: { kcal: 146, protein: 3.7, fat: 8.9, carb: 12.4 },
    portions: [{ label: "半杯", grams: 90 }, { label: "整杯", grams: 180 }], default_portion: "整杯", confidence: "high" },
  { id: "tesco-chicken-salad-lemon-pepper-mayo", name: "Tesco 鸡肉沙拉三明治（柠檬胡椒蛋黄酱）", per_100g: { kcal: 201, protein: 12.2, fat: 6.1, carb: 23.2 },
    portions: [{ label: "整份", grams: 202 }], default_portion: "整份", confidence: "high" },
  { id: "ms-dukkah-chicken-bowl", name: "M&S Dukkah 香料烤鸡藜麦碗", per_100g: { kcal: 122, protein: 7.6, fat: 6.2, carb: 7.6 },
    portions: [{ label: "整盒", grams: 305 }], default_portion: "整盒", confidence: "high" },
  { id: "ms-pasta-bowl-chicken-caesar", name: "M&S 鸡肉凯撒意面碗", per_100g: { kcal: 169, protein: 7.0, fat: 8.0, carb: 17.0 },
    portions: [{ label: "整份", grams: 280 }], default_portion: "整份", confidence: "high" },
  { id: "tesco-beef-quarter-pounder", name: "Tesco 英国牛肉厚汉堡饼（4 只装）", per_100g: { kcal: 302, protein: 18.9, fat: 22.8, carb: 4.8 },
    portions: [{ label: "1 个（生重）", grams: 97 }, { label: "整包 4 个（生重）", grams: 388 }], default_portion: "1 个（生重）", confidence: "high" },
  { id: "tesco-finest-smoked-haddock-fishcake", name: "Tesco Finest 烟熏黑线鳕鱼饼（芝士夹心）", per_100g: { kcal: 201, protein: 10.2, fat: 9.9, carb: 17.8 },
    portions: [{ label: "1 个", grams: 136 }, { label: "整包 2 个", grams: 271 }], default_portion: "1 个", confidence: "high" },
  { id: "tesco-red-seedless-grapes", name: "Tesco 红提（无籽红葡萄，盒装）", per_100g: { kcal: 67, protein: 0.6, fat: 0.2, carb: 16.0 },
    portions: [{ label: "整盒 500g", grams: 500 }, { label: "半盒", grams: 250 }, { label: "一小把约 100g", grams: 100 }], default_portion: "半盒", confidence: "low" },
  /* 以下 4 条由 2026-09-06 周报从「我的食物」转正：首周各用过 2 次以上，
     每 100 克数值都是标签实读且通过算术交叉验证。原个人食物条目见 UF_SAME_AS。 */
  { id: "on-whey-strawberry", name: "Optimum Nutrition 草莓乳清蛋白粉", per_100g: { kcal: 378, protein: 79.0, fat: 4.2, carb: 5.5 },
    portions: [{ label: "1 勺 30g", grams: 30 }, { label: "2 勺 60g", grams: 60 }], default_portion: "1 勺 30g", confidence: "high" },
  { id: "grahams-cottage-cheese", name: "Graham's 乡村奶酪（天然）", per_100g: { kcal: 104, protein: 12.0, fat: 4.5, carb: 3.6 },
    portions: [{ label: "一小勺约 10g", grams: 10 }, { label: "整盒 300g", grams: 300 }], default_portion: "一小勺约 10g", confidence: "high" },
  { id: "grahams-jersey-whole-milk", name: "Graham's Jersey 全脂牛奶（比普通全脂高）", per_100g: { kcal: 74, protein: 3.6, fat: 4.8, carb: 4.4 },
    portions: [{ label: "100 g", grams: 100 }, { label: "1 杯 250ml", grams: 250 }, { label: "整瓶 1L", grams: 1000 }], default_portion: "100 g", confidence: "high" },
  { id: "tesco-plums-suntrail", name: "Tesco 李子（Suntrail Farms 熟成，1kg 袋）", per_100g: { kcal: 42, protein: 0.6, fat: 0.1, carb: 8.8 },
    portions: [{ label: "1 个约 75g", grams: 75 }, { label: "2 个约 150g", grams: 150 }, { label: "整包 1kg", grams: 1000 }], default_portion: "1 个约 75g", confidence: "high" },
  /* 以下 5 条由 2026-09-20 周报从「我的食物」转正：三周内各用过 5 次以上，
     每 100 克为标签实读且通过算术交叉验证。份量按他实际记过的克数重设，
     原来那种「整瓶 340g」的默认份量不好用。原个人条目见 UF_SAME_AS。 */
  { id: "tesco-multiseed-bread", name: "Tesco 多种籽面包", per_100g: { kcal: 261, protein: 9.7, fat: 4.5, carb: 43.3 },
    portions: [{ label: "一片 50g", grams: 50 }, { label: "两片 100g", grams: 100 }, { label: "整包 800g", grams: 800 }], default_portion: "一片 50g", confidence: "high" },
  { id: "rosedene-gala-apple", name: "Rosedene Farms 佳乐苹果", per_100g: { kcal: 56, protein: 0.6, fat: 0.5, carb: 11.6 },
    portions: [{ label: "100 g", grams: 100 }, { label: "1 个约 130g", grams: 130 }], default_portion: "100 g", confidence: "high" },
  { id: "ms-super-seed-peanut-butter", name: "M&S 超级种子花生酱", per_100g: { kcal: 611, protein: 26.3, fat: 51.3, carb: 5.5 },
    portions: [{ label: "1 勺 20g", grams: 20 }, { label: "薄薄一层 15g", grams: 15 }, { label: "整瓶 340g", grams: 340 }], default_portion: "1 勺 20g", confidence: "high" },
  { id: "creamfields-quark", name: "Creamfields 低脂干酪（高蛋白）", per_100g: { kcal: 56, protein: 8.9, fat: 0.9, carb: 3.1 },
    portions: [{ label: "25 g", grams: 25 }, { label: "半份 50g", grams: 50 }, { label: "整包 300g", grams: 300 }], default_portion: "25 g", confidence: "high" },
  { id: "tesco-wensleydale-apricot", name: "Tesco Wensleydale 奶酪（带杏干）", per_100g: { kcal: 357, protein: 16.8, fat: 24.7, carb: 14.9 },
    portions: [{ label: "15 g", grams: 15 }, { label: "25 g", grams: 25 }, { label: "整包 200g", grams: 200 }], default_portion: "15 g", confidence: "high" },
  /* 以下 9 条由 2026-09-27 周报加入：前 7 条是 AI 估过、但官网查得到标签的超市/连锁店食品，
     按官网数值收录；后 2 条是自己做的、文字估算记过两次以上的，按常见值收录（confidence: low）。
     对应的旧流水已由 LOG_FIX 改对并挂到这些条目上。 */
  { id: "tesco-all-butter-croissant", name: "Tesco 黄油可颂（All Butter Croissant）", per_100g: { kcal: 421, protein: 7.9, fat: 25.2, carb: 39.0 },
    portions: [{ label: "1 个 67g", grams: 67 }, { label: "2 个 134g", grams: 134 }], default_portion: "1 个 67g", confidence: "high",
    note: "Tesco 官网标签：每 100 克 421 千卡、脂肪 25.2、碳水 39.0；每个 67 克 282 千卡、蛋白 5.3。" },
  { id: "tesco-maple-pecan-plait", name: "Tesco 枫糖胡桃卷（Maple & Pecan Plait）", per_100g: { kcal: 453, protein: 5.4, fat: 29.4, carb: 40.6 },
    portions: [{ label: "1 个 81g", grams: 81 }, { label: "2 个 162g", grams: 162 }], default_portion: "1 个 81g", confidence: "high",
    note: "Tesco 官网标签：每 100 克 453 千卡，每个 81 克 367 千卡。" },
  { id: "tesco-chocolate-twist", name: "Tesco 黄油巧克力扭扭酥（Chocolate Twist）", per_100g: { kcal: 382, protein: 6.6, fat: 18.8, carb: 45.2 },
    portions: [{ label: "1 个约 76g", grams: 76 }], default_portion: "1 个约 76g", confidence: "high",
    note: "Tesco 官网 All Butter Chocolate Twist：每 100 克 382 千卡、脂肪 18.8、碳水 45.2，每个 290 千卡；蛋白按能量倒推。" },
  { id: "tesco-finest-olive-ciabatta", name: "Tesco finest 橄榄恰巴塔", per_100g: { kcal: 243, protein: 8.1, fat: 5.7, carb: 37.8 },
    portions: [{ label: "一块 85g", grams: 85 }, { label: "整条 270g", grams: 270 }], default_portion: "一块 85g", confidence: "high",
    note: "Tesco 官网与 Open Food Facts：每 100 克 243 千卡、蛋白 8.1、脂肪 5.7、碳水 37.8、纤维 4.2。" },
  { id: "ms-udon-noodles", name: "M&S 乌冬面（即食，275g 装）", per_100g: { kcal: 155, protein: 4.4, fat: 1.4, carb: 30.4 },
    portions: [{ label: "半包 138g", grams: 138 }, { label: "整包 275g", grams: 275 }], default_portion: "整包 275g", confidence: "high",
    note: "M&S 标签（Ocado、Open Food Facts）：每 100 克 155 千卡、蛋白 4.4、脂肪 1.4、碳水 30.4。" },
  { id: "waitrose-beef-short-ribs", name: "Waitrose 英国牛肋排（带骨生重）", per_100g: { kcal: 253, protein: 19.0, fat: 19.8, carb: 0 },
    portions: [{ label: "1/4 盒 135g", grams: 135 }, { label: "3/4 盒 405g", grams: 405 }, { label: "整盒约 540g", grams: 540 }], default_portion: "1/4 盒 135g", confidence: "high",
    note: "Waitrose 官网：每盒一般约 540 克，每 100 克 253 千卡、蛋白 19、脂肪 19.8。按买来的带骨生重记；炖汤连汤喝，脂肪算全部吃进去。" },
  { id: "popeyes-chicken-cruncher", name: "Popeyes Chicken Cruncher 小鸡肉汉堡", per_100g: { kcal: 244, protein: 14.5, fat: 9.4, carb: 24.8 },
    portions: [{ label: "1 个", grams: 110 }, { label: "2 个", grams: 220 }], default_portion: "1 个", confidence: "high",
    note: "Popeyes 英国官网：每个 268 千卡、蛋白 16、脂肪 10.3、碳水 27.3。官网不给克数，按每个约 110 克折算，按「个」记就准。" },
  { id: "home-roast-chicken-thigh", name: "烤鸡腿肉（去骨，少油腌制）", per_100g: { kcal: 209, protein: 26.0, fat: 10.9, carb: 0 },
    portions: [{ label: "一份 185g", grams: 185 }, { label: "一大份 320g", grams: 320 }], default_portion: "一份 185g", confidence: "low",
    note: "自己做的，由文字估算整理进来（9/20、9/21 各记过一次），数值是常见值估算。" },
  { id: "home-boiled-sweetcorn", name: "煮玉米", per_100g: { kcal: 96, protein: 3.4, fat: 1.5, carb: 21.0 },
    portions: [{ label: "一根约 230g", grams: 230 }], default_portion: "一根约 230g", confidence: "low",
    note: "由文字估算整理进来（9/21、9/23 各记过一次），按煮熟甜玉米的常见值。" },
  /* 2026-09-27 第二批：同样是 AI 估过、Tesco 官网查得到的烘焙点心 */
  { id: "tesco-cheese-twist", name: "Tesco 芝士扭扭酥（Cheese Twist）", per_100g: { kcal: 415, protein: 12.5, fat: 23.6, carb: 36.8 },
    portions: [{ label: "1 个 80g", grams: 80 }], default_portion: "1 个 80g", confidence: "high",
    note: "Tesco 官网：每 100 克 415 千卡、脂肪 23.6、碳水 36.8，每个 332 千卡；蛋白按每个约 10 克折算。" },
  { id: "tesco-pain-au-chocolat", name: "Tesco 黄油巧克力可颂（Pain au Chocolat）", per_100g: { kcal: 430, protein: 7.8, fat: 24.6, carb: 42.9 },
    portions: [{ label: "1 个 76g", grams: 76 }, { label: "2 个 152g", grams: 152 }], default_portion: "1 个 76g", confidence: "high",
    note: "Tesco 官网 All Butter Pain au Chocolat：每 100 克 430 千卡、脂肪 24.6，每个 327 千卡；蛋白 7.8、碳水 42.9 是 9/29 你拍的包装标签读数（10/4 周报更新）。" },
  /* 2026-10-04 周报从「我的食物」转正：一周用了 5 次，每 100 克与整包都是标签实读、双模型复核一致 */
  { id: "boots-steak-onion-sandwich", name: "Boots 牛排香醋洋葱三明治", per_100g: { kcal: 207, protein: 12.0, fat: 5.2, carb: 27.0 },
    portions: [{ label: "整包 195g", grams: 195 }, { label: "半个 98g", grams: 98 }], default_portion: "整包 195g", confidence: "high",
    note: "Boots 包装标签：每 100 克 207 千卡、蛋白 12、脂肪 5.2、碳水 27；整包 404 千卡。" },
  { id: "tesco-melon-kiwi-strawberry", name: "Tesco 甜瓜猕猴桃草莓水果杯（250g）", per_100g: { kcal: 38, protein: 0.6, fat: 0.4, carb: 7.2 },
    portions: [{ label: "整盒 250g", grams: 250 }, { label: "半盒 125g", grams: 125 }], default_portion: "整盒 250g", confidence: "high",
    note: "Tesco 官网营养表：每 100 克 38 千卡；标签份量半盒 125g = 47 千卡，整盒约 95 千卡。" }
];

/* ── 个人食物的就地修正（2026-09-12 起没有「已停用」一栏了）──────
   手机 localStorage 里的原条目一律不动，这里只改页面显示出来的样子。
   已经记进流水的条目也不受影响：流水里的营养值是当时写死的，不回查食物库。

   UF_SAME_AS：和某个正式条目其实是同一样东西（同一罐蛋白粉扫了两遍之类）。
     食物库和搜索里只留正式那一条，历史常用度并到它身上；旧流水仍查得到来源。
   UF_FIX：名字或数值有错的，在这里改对，条目照常留在食物库里能用。
     why 会显示在「选份量」面板底部，方便对着标签复核。 */
export var UF_SAME_AS = {
  "uf-mtizzqpo": "on-whey-strawberry",          /* 草莓乳清蛋白粉：标签实读那次 */
  "uf-mtizxzcd": "on-whey-strawberry",          /* 同一罐的第一次识别，数值是估的 */
  "uf-mtkfdrx5": "grahams-cottage-cheese",
  "uf-mtojka7b": "grahams-jersey-whole-milk",
  "uf-mtojgob8": "tesco-plums-suntrail",
  "uf-mtldygj5": "tesco-beef-quarter-pounder",
  /* 2026-09-20 周报新增 */
  "uf-mtwo4ipo": "tesco-multiseed-bread",
  "uf-mtojkoti": "rosedene-gala-apple",
  "uf-mtwo43hx": "ms-super-seed-peanut-butter",
  "uf-mtyn6bi0": "creamfields-quark",
  "uf-mtojhgy9": "tesco-wensleydale-apricot",
  "uf-mtwo3mo8": "whole-milk",              /* 扫出来和库里「全脂牛奶」四个数一模一样 */
  "uf-mtszgo1x": "uf-mu79dwwl",             /* 汤达人扫了三遍，留 9/18 那条（多一个「面饼」份量） */
  "uf-mu03zusd": "uf-mu79dwwl",
  "uf-mtojjb9f": "uf-mu044y37",             /* 提卡鸡肉扫了两遍，留重扫那条（数值更准） */
  /* 2026-09-27 周报新增 */
  "uf-mui6ei83": "uf-mucs1s7j",             /* 「宝宝李子番茄」和「小李子番茄」是同一样东西 */
  "uf-mui6q82u": "whole-milk",              /* Co-op 全脂牛奶：四个数和库里「全脂牛奶」一样 */
  /* 2026-10-04 周报新增 */
  "uf-mumeelle": "tesco-pain-au-chocolat",  /* 9/29 拍成分表时照片没传上去，存成了全 0 的空条目；复核模型读到的就是这款 */
  "uf-mumef1am": "tesco-pain-au-chocolat",  /* 同上，第二次 */
  "uf-mumehqr31u8": "tesco-pain-au-chocolat", /* 文字估算建的同一款，数值和库里一样 */
  "uf-mumxjm4x": "uf-mumxk7bc",             /* 巴沙鱼柳扫了两遍，留按生重算、用过的那条 */
  "uf-mutyvlbt": "rosedene-gala-apple",     /* 扫码的 Tesco Gala 苹果，四个数和库里那条一样 */
  "uf-mutyynq5wx8": "tesco-plums-suntrail", /* 文字估算的「李子」，库里已有 Tesco 李子 */
  "uf-mupagmsc": "boots-steak-onion-sandwich"
};
export var UF_FIX = {
  "uf-mtizeexx": { name: "Grissini 意式细面包棒",
    why: "入库时名字里留着提示词模板的「品牌+」，已改；每 100 克的四个数没动。" },
  "uf-mtojl53j": { name: "Tesco 鸡肉提卡烤串（Firepit）",
    why: "入库时名字被截断成「(Chicken Tikka Si」，已改；每 100 克的四个数没动。" },
  "uf-mtojhvad": { name: "Tesco 甜玉米棒（4 根装）",
    per_100g: { kcal: 107, protein: 3.7, fat: 2.5, carb: 16.1 },
    portions: [{ label: "1 根约 89g", grams: 89 }, { label: "整包 4 根 350g", grams: 350 }],
    default_portion: "1 根约 89g",
    why: "2026-09-20 查了 Tesco 官网与 Nutracheck、FatSecret、Open Food Facts 四个来源，" +
         "一致是每 100 克 107 千卡、蛋白 3.7、脂肪 2.5、碳水 16.1、纤维 2.9。" +
         "原来存的蛋白 2.5、脂肪 0.6 是把标签整列看串了一行——2.5 是脂肪那行、0.6 是饱和脂肪那行。" +
         "热量和碳水本来就是对的。包装也改了：原来写整包 270 克，实际是 4 根共 350 克、每根约 89 克。" },
  "uf-mtojjb9f": { name: "Eastman's 提卡鸡肉切片",
    portions: [{ label: "整包 240 g", grams: 240 }, { label: "1 份约 60 g", grams: 60 }],
    default_portion: "整包 240 g",
    note: "AI 识别：能量和营养成分均为标签实读值。",   /* 原注记末尾那条整包警告已在下面解释清楚，不再重复显示 */
    why: "每 100 克四个数自己对得上（碳蛋脂算 123，标签写 124），数值可用。当初报警的是整包那栏：" +
         "标签上的 74 kcal 是每份约 60 克、不是整包，已把这个份量补成选项。" },
  /* 2026-09-20 周报：这两条的标签上蛋白质和碳水那两行没识别出来，被当成 0 存进去了。
     热量是标签实读的、可信，所以热量不动；蛋白和碳水按同类产品的典型比例补上，
     属于估算值，why 里说清楚了。 */
  "uf-mu03wur3": { name: "Tesco finest 鳕鱼欧芹鱼饼（2 个装 290g）",
    per_100g: { kcal: 182, protein: 10.8, fat: 7.1, carb: 18.4 },
    portions: [{ label: "1 个约 137g", grams: 137 }, { label: "整包 2 个 290g", grams: 290 }],
    default_portion: "1 个约 137g",
    why: "2026-09-20 对着 Tesco 官网这款（Finest 2 Cod & Parsley Fishcakes 290g）核过：" +
         "每 100 克 182 千卡、碳水 18.4、纤维 1.1，和你扫到的热量 182、脂肪 7.1 一致。" +
         "蛋白当时没识别出来、存成了 0，按能量倒推是 10.8（Open Food Facts 上一版配方的比例也对得上）。" +
         "名字里的「香菜」其实是 parsley 欧芹，一并改了。" },
  "uf-mu5y0f76": { name: "Tesco 大蒜香草基辅鸡（2 个装 270g）",
    per_100g: { kcal: 281, protein: 11.2, fat: 20.8, carb: 10.8 },
    portions: [{ label: "1 个 135g", grams: 135 }, { label: "整包 2 个 270g", grams: 270 }],
    default_portion: "1 个 135g",
    why: "2026-09-20 对着 Tesco 官网这款（2 Garlic and Herb Chicken Kievs 270g）核过：" +
         "每 100 克 281 千卡、脂肪 20.8、碳水 10.8、蛋白 11.2、纤维 1.8。" +
         "你原来扫到的 303 千卡和脂肪 27 都偏高——那个 27 其实是「每个 135 克」那一列的 28.2，" +
         "不是每 100 克。蛋白和碳水当时没识别出来、存成了 0，害得 9/17 那天少算了 30 克蛋白。" }
};

/* 常吃组合（在代码里定义，改配比找分析端）：一键把几样一起记 */
export var COMBOS = [
  { id: "combo-breakfast", name: "我的早餐", items: [["yogurt-whole", 200], ["whole-milk", 200], ["granola", 90]] }
];
