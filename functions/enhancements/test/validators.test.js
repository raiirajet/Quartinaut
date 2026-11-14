'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {safeId,text,validMoney,own,cantonAllowed,safeTags,boundedPhoto,terminalStatus}=require('../validators');
test('safe identifiers and descriptions',()=>{assert.equal(safeId('hub_abcdef'),'hub_abcdef');assert.throws(()=>safeId('../user'));assert.throws(()=>text('ab',5,100,'Titel'));});
test('financial validation rejects NaN and negative CHF',()=>{assert.equal(validMoney(5.25),5.25);for(const x of [-1,'hi',Infinity,1.111])assert.throws(()=>validMoney(x));});
test('ownership and regional gate',()=>{assert.ok(own('u1',{ownerUid:'u1'},'ownerUid'));assert.equal(own('u2',{ownerUid:'u1'},'ownerUid'),false);assert.ok(cantonAllowed('u1',{cantonCode:'SG'},{cantonCode:'SG'}));assert.equal(cantonAllowed('u1',{cantonCode:'SG'},{cantonCode:'ZH'}),false);});
test('radar tags limits',()=>{assert.deepEqual(safeTags(['Market','Market']),['Market']);assert.throws(()=>safeTags(new Array(11).fill('market')));});
test('photos cannot be HTML, PNG, oversized or malformed data',()=>{assert.throws(()=>boundedPhoto('javascript:alert(1)'));assert.throws(()=>boundedPhoto(Buffer.alloc(100,8).toString('base64')));});
test('only completed transactions are terminal',()=>{assert.ok(terminalStatus('returned'));assert.equal(terminalStatus('accepted'),false);});
