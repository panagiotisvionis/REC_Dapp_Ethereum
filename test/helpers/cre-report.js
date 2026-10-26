const { ethers } = require('hardhat');
const workflowId=ethers.id('recchain-research-workflow-v2');
const workflowName='0x'+ethers.sha256(ethers.toUtf8Bytes('recchain-screening')).slice(2,22);
const evidenceHash=ethers.id('reading + ordered history');
const policyHash=ethers.id('EWMA 0.5; calibrated threshold; rule-v2');
const tuple='tuple(string meterId,uint64 start,uint64 end,uint256 kwh,bytes32 evidenceHash,bytes32 policyHash)[]';
const metadata=(owner,id=workflowId,name=workflowName,pad=true)=>ethers.solidityPacked(
 pad?['bytes32','bytes10','address','bytes2']:['bytes32','bytes10','address'],pad?[id,name,owner,'0x0001']:[id,name,owner]);
const report=(rows)=>ethers.AbiCoder.defaultAbiCoder().encode([tuple],[rows]);
const reading=(meterId,kwh,end,start=end-3600)=>({meterId,kwh,start,end,evidenceHash,policyHash});
const batch=(producer,overrides={})=>({producer,source:0,kwh:2000n,location:'GR-AT',meterId:'M',start:1,end:3601,evidenceHash,policyHash,...overrides});
module.exports={workflowId,workflowName,evidenceHash,policyHash,metadata,report,reading,batch};
