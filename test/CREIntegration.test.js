const {expect}=require('chai');
const {ethers}=require('hardhat');
const H=require('./helpers/cre-report');
describe('Workflow issuance invariants',function(){
 let registry,consumer,router,admin,forwarder,producer,outsider,end;
 beforeEach(async function(){
  [admin,forwarder,producer,outsider]=await ethers.getSigners();
  router=await(await ethers.getContractFactory('MockFunctionsRouter')).deploy();
  registry=await(await ethers.getContractFactory('RecDappWorkflowRegistry')).deploy('ipfs://base/',await router.getAddress());
  consumer=await(await ethers.getContractFactory('RecDappCRE')).deploy(await registry.getAddress(),forwarder.address);
  await registry.grantRole(await registry.WORKFLOW_ROLE(),await consumer.getAddress());
  await consumer.setWorkflow(H.workflowId,H.workflowName,admin.address);
  await consumer.bindMeter('M',producer.address,0,'GR-AT');
  end=(await ethers.provider.getBlock('latest')).timestamp-10;
 });
 async function issue(kwh=2000n,start,endValue){
  return consumer.connect(forwarder).onReport(H.metadata(admin.address),H.report([H.reading('M',kwh,endValue??end,start??end-3600)]));
 }
 it('links minted balances to a stored interval and decision receipt',async function(){
  await issue();
  expect(await registry.balanceOf(producer.address,1)).to.equal(2000);
  const r=await registry.issuanceReceipt(1);
  expect(r.evidenceHash).to.equal(H.evidenceHash);expect(r.policyHash).to.equal(H.policyHash);
  expect(r.start).to.equal(end-3600);expect(r.end).to.equal(end);
  expect(await registry.issuedByWorkflow(1)).to.equal(true);
 });
 it('blocks a second issuance for the same interval even when quantity is changed',async function(){
  await issue();
  await expect(issue(3000n)).to.be.revertedWith('Interval already issued');
  expect(await registry.remainingKwh(1)).to.equal(2000);
 });
 it('blocks overlaps and permits the next adjacent completed interval',async function(){
  await issue();
  await expect(issue(3000n,end-1800,end+1)).to.be.revertedWith('Overlapping or out-of-order interval');
  const now=(await ethers.provider.getBlock('latest')).timestamp;
  await issue(3000n,end,now);
  expect(await registry.balanceOf(producer.address,2)).to.equal(3000);
 });
 it('preserves interval uniqueness when the consumer or workflow version changes',async function(){
  await issue();
  const replacement=await(await ethers.getContractFactory('RecDappCRE')).deploy(await registry.getAddress(),forwarder.address);
  await replacement.setWorkflow(ethers.id('v3'),H.workflowName,admin.address);
  await replacement.bindMeter('M',producer.address,0,'GR-AT');
  await registry.grantRole(await registry.WORKFLOW_ROLE(),await replacement.getAddress());
  await expect(replacement.connect(forwarder).onReport(H.metadata(admin.address,ethers.id('v3')),H.report([H.reading('M',4000n,end)]))).to.be.revertedWith('Interval already issued');
 });
 it('forbids the manual issuer role from calling workflow issuance',async function(){
  await expect(registry.issueFromWorkflow(H.batch(producer.address,{start:end-3600,end}))).to.be.revertedWithCustomError(registry,'AccessControlUnauthorizedAccount');
 });
 it('rolls back consumed keys when minting fails and allows a valid retry',async function(){
  await registry.revokeRole(await registry.WORKFLOW_ROLE(),await consumer.getAddress());
  await expect(issue()).to.be.reverted;
  await registry.grantRole(await registry.WORKFLOW_ROLE(),await consumer.getAddress());
  await issue();expect(await registry.balanceOf(producer.address,1)).to.equal(2000);
 });
 it('requires evidence and valid intervals at the registry boundary',async function(){
  await registry.grantRole(await registry.WORKFLOW_ROLE(),admin.address);
  await expect(registry.issueFromWorkflow(H.batch(producer.address,{start:end-3600,end,evidenceHash:ethers.ZeroHash}))).to.be.revertedWith('Missing evidence');
  await expect(registry.issueFromWorkflow(H.batch(producer.address,{start:end,end:end-1}))).to.be.revertedWith('Invalid interval');
  // The receiver rejects ERC-1155 tokens after interval consumption was set.
  // Both the interval key and progress must roll back so the same interval
  // can subsequently be minted to a valid recipient.
  await expect(registry.issueFromWorkflow(H.batch(await router.getAddress(),{start:end-3600,end}))).to.be.revertedWithCustomError(registry,'ERC1155InvalidReceiver');
  await registry.issueFromWorkflow(H.batch(producer.address,{start:end-3600,end}));
  expect(await registry.balanceOf(producer.address,1)).to.equal(2000);
 });
 it('keeps manual certificates separate from workflow receipts',async function(){
  await registry.issueRec(producer.address,0,2000,'GR-AT','cre://M');
  expect(await registry.issuedByWorkflow(1)).to.equal(false);
  expect((await registry.issuanceReceipt(1)).evidenceHash).to.equal(ethers.ZeroHash);
 });
 it('blocks purchases and direct circulation after expiry, while allowing escrow recovery',async function(){
  await issue(4000n);
  await registry.connect(producer).listRec(1,2000,1);
  await ethers.provider.send('evm_increaseTime',[366*86400]);await ethers.provider.send('evm_mine',[]);
  await expect(registry.connect(outsider).buyRec(0,1000,{value:1000})).to.be.revertedWith('Certificate expired');
  await expect(registry.connect(producer).safeTransferFrom(producer.address,outsider.address,1,1000,'0x')).to.be.revertedWith('Certificate expired');
  await registry.connect(producer).cancelListing(0);
  expect(await registry.balanceOf(producer.address,1)).to.equal(4000);
 });
});
