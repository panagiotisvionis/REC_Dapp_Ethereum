const fs=require('fs');const {ethers}=require('hardhat');const H=require('../test/helpers/cre-report');
async function main(){
 const [admin,forwarder,producer]=await ethers.getSigners();
 const router=await(await ethers.getContractFactory('MockFunctionsRouter')).deploy();
 const registry=await(await ethers.getContractFactory('RecDappWorkflowRegistry')).deploy('ipfs://base/',await router.getAddress());
 const consumer=await(await ethers.getContractFactory('RecDappCRE')).deploy(await registry.getAddress(),forwarder.address);
 await consumer.setWorkflow(H.workflowId,H.workflowName,admin.address);
 await registry.grantRole(await registry.WORKFLOW_ROLE(),await consumer.getAddress());
 for(const id of ['A','B','C'])await consumer.bindMeter(id,producer.address,0,'GR-AT');
 const now=(await ethers.provider.getBlock('latest')).timestamp;
 const samples={manual:[],workflow_one_meter:[],workflow_three_meters:[]};
 for(let i=0;i<15;i++){
  let tx=await registry.issueRec(producer.address,0,1000,'GR-AT','ipfs://evidence');samples.manual.push(Number((await tx.wait()).gasUsed));
  let end=now-(32-2*i)*3600;
  tx=await consumer.connect(forwarder).onReport(H.metadata(admin.address),H.report([H.reading('A',1000n,end)]));samples.workflow_one_meter.push(Number((await tx.wait()).gasUsed));
  tx=await consumer.connect(forwarder).onReport(H.metadata(admin.address),H.report(['A','B','C'].map(id=>H.reading(id,1000n,end+1800,end))));samples.workflow_three_meters.push(Number((await tx.wait()).gasUsed));
 }
 const output={compiler:'0.8.28',optimizer_runs:200,evm:'cancun',n:15,scope:'Local EVM execution gas; excludes oracle service, workflow execution, data availability and report transport fees',samples};
 fs.writeFileSync('evaluation_journal/results/gas_v2.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
