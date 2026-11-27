import test from "node:test";
import assert from "node:assert/strict";
import {aiStep, deal, draw, discard, frozen, pickBase, preview, put, red, threshold, compulsory} from "../public/canasta-engine.js";
function table(hand, pile=[], stock=[9]) {
  const g=deal();
  Object.assign(g,{turn:0,phase:"draw",hands:[hand,[],[],[]],teams:[{melds:{},reds:[]},{melds:{},reds:[]}],pile,stock,priorRanks:[],startSizes:{},previouslyPlayed:false});
  return g;
}
test("Deux trois rouges successifs sont remplacés et la main est reclassée",()=>{
  const g=table([12,8],[],[4,15,28]);
  draw(g); assert.deepEqual(g.teams[0].reds,[28,15]); assert.deepEqual(g.hands[0],[4,8,12]);
  const end=table([12],[],[15]); draw(end); assert.equal(end.phase,"end"); assert.equal(end.result[0].reds,-100);
});
test("Pile gelée même après recouvrement et même avec une pose existante",()=>{
  for(const lock of [104,1]) {
    const g=table([25,53,4,5],[lock,12]); g.teams[0].melds[12]=[38,51,64];
    assert.ok(frozen(g)); assert.equal(pickBase(g),null);
    g.hands[0].push(77); put(g,pickBase(g),true); assert.ok(g.hands[0].includes(lock)); assert.equal(g.teams[0].melds[12].length,6);
  }
});
test("Ouverture combinée avec le sommet, sans les points enfouis ni remplacement du trois enfoui",()=>{
  const g=table([12,25,11,24,1,4,5],[15,104,38]);
  assert.throws(()=>put(g,pickBase(g),true),/30 points sur 50/);
  put(g,{...pickBase(g),11:[11,24,1]},true);
  assert.deepEqual(g.teams[0].reds,[15]); assert.deepEqual(g.stock,[9]); assert.ok(g.hands[0].includes(104));
  assert.deepEqual([-5,0,1500,3000].map(threshold),[15,50,90,120]);
});
test("Pile libre, prise obligatoire et blocage par le sommet",()=>{
  const g=table([12,1,4,5],[38]); g.teams[0].melds[4]=[17,30,43];
  assert.deepEqual(pickBase(g),{12:[12,1,38]});
  for(const c of [2,41,104,1]) {g.pile=[c];assert.equal(pickBase(g),null);}
  g.pile=[4];g.stock=[];assert.ok(compulsory(g));assert.throws(()=>draw(g));
  g.hands[0]=[5];assert.equal(pickBase(g),null);draw(g);assert.equal(g.phase,"end");
});
test("Sortie cachée sous le seuil, canasta naturelle et 3 noirs",()=>{
  const aces=[0,13,26,39,52,65,78], fours=[3,16,29,42,55,68,81], blacks=[2,41,54];
  const g=table([...fours,...blacks,5]); g.phase="play";g.scores[0]=3000;
  put(g,{3:fours,2:blacks});discard(g,5);
  assert.deepEqual(g.result[0],{laid:50,held:0,reds:0,bonuses:500,exit:200,total:750});
  const early=table([...aces.slice(0,4),...blacks,5,6]);early.phase="play";
  assert.throws(()=>preview(early,{2:blacks}),/uniquement pour sortir/);
  assert.throws(()=>preview(early,{0:[...aces.slice(0,4),...blacks]}));
});
test("Des parties complètes conservent les 108 cartes et atteignent le score final",()=>{
  for(let n=0;n<20;n++){
    let g=deal();
    for(let round=0;round<100;round++) {
      assert.ok(g.hands.every(h=>h.length===11 && !h.some(red)));
      let actions=0;
      while(g.phase!=="end") {
        assert.ok(actions++<800);
        aiStep(g);
        const all=[...g.stock,...g.pile,...g.hands.flat(),...g.teams.flatMap(t=>[...t.reds,...Object.values(t.melds).flat()])];
        assert.equal(all.length,108);assert.equal(new Set(all).size,108);
      }
      if(g.over) break;
      g=deal(g);
    }
    assert.ok(g.over);
  }
});
