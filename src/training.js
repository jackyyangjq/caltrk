import { viewDate } from "./state.js";
import { DB, K, persist } from "./store.js";

/* ── 今日训练（2026-09-01 加）──────────────────────────────
   预设时长/消耗 = 2026-02-24 起 Apple Watch 各类型实测的中位数。
   估算只作记录参考，不参与摄入额度计算——基准消耗(tdee)按含平时
   训练的日均消耗校准，再加会重复计。 */
export var TRAINING_PRESETS = [
  { type: "strength", label: "力量训练", min: 100, rate: 5.5 },
  { type: "incline",  label: "爬坡快走", min: 35,  rate: 4.9 },
  { type: "stairs",   label: "爬楼梯",   min: 50,  rate: 12.1 }
];
export function presetOf(type) {
  for (var i = 0; i < TRAINING_PRESETS.length; i++) if (TRAINING_PRESETS[i].type === type) return TRAINING_PRESETS[i];
  return null;
}
export function trainingOn(date) {
  for (var i = 0; i < DB.training.length; i++) if (DB.training[i].date === date) return DB.training[i];
  return null;
}
export function trainingOfView() { return trainingOn(viewDate); }   /* 在看哪天就改哪天的训练 */
export function trainingMin(rec, type) {
  if (rec && rec.mins && rec.mins[type] > 0) return rec.mins[type];
  var p = presetOf(type);
  return p ? p.min : 30;
}
export function trainingKcal(rec, type) {
  var p = presetOf(type);
  return p ? Math.round(trainingMin(rec, type) * p.rate) : 0;
}
export function toggleTraining(type) {
  var rec = trainingOfView();
  if (!rec) { rec = { date: viewDate, types: [], mins: {} }; DB.training.push(rec); }
  if (!rec.mins) rec.mins = {};
  var i = rec.types.indexOf(type);
  if (i >= 0) { rec.types.splice(i, 1); }
  else { rec.types.push(type); if (!(rec.mins[type] > 0)) rec.mins[type] = presetOf(type).min; }
  persist(K.training, DB.training);
}
export function setTrainingMin(type, m) {
  var rec = trainingOfView();
  if (!rec) return;
  if (!rec.mins) rec.mins = {};
  rec.mins[type] = m;
  persist(K.training, DB.training);
}
