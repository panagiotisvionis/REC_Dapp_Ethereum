const {expect}=require('chai');
const {ethers}=require('hardhat');
const H=require('./helpers/cre-report');
describe('CRE report authentication',function(){
 let cre,registry,admin,forwarder,producer,outsider,end;
 beforeEach(async function(){
  [admin,forwarder,producer,outsider]=await ethers.getSigners();
  registry=await(await ethers.getContractFactory('MockRecIssuer')).deploy();
  cre=await(await ethers.getContractFactory('RecDappCRE')).deploy(await registry.getAddress(),forwarder.address);
  await cre.setWorkflow(H.workflowId,H.workflowName,admin.address);
  await cre.bindMeter('M',producer.address,0,'GR-AT');
  end=(await ethers.provider.getBlock('latest')).timestamp-10;
 });
 const payload=(end)=>H.report([H.reading('M',2000n,end)]);
 it('accepts production 64-byte metadata and supports IReceiver',async function(){
  await expect(cre.connect(forwarder).onReport(H.metadata(admin.address),payload(end))).to.emit(cre,'IssuanceAccepted');
  expect(await cre.supportsInterface(ethers.id('onReport(bytes,bytes)').slice(0,10))).to.equal(true);
  expect(await registry.lastProducer()).to.equal(producer.address);
 });
 it('also accepts packed 62-byte tooling metadata',async function(){
  await cre.connect(forwarder).onReport(H.metadata(admin.address,H.workflowId,H.workflowName,false),payload(end));
  expect(await registry.callCount()).to.equal(1);
 });
 it('rejects an unconfigured workflow',async function(){
  const c=await(await ethers.getContractFactory('RecDappCRE')).deploy(await registry.getAddress(),forwarder.address);
  await expect(c.connect(forwarder).onReport(H.metadata(admin.address),payload(end))).to.be.revertedWithCustomError(c,'UnauthorisedWorkflow');
 });
 it('rejects a caller other than the configured forwarder',async function(){
  await expect(cre.connect(outsider).onReport(H.metadata(admin.address),payload(end))).to.be.revertedWithCustomError(cre,'UnauthorisedForwarder');
 });
 it('rejects a forged owner, workflow name, or version ID from the allowed forwarder',async function(){
  for(const m of [H.metadata(outsider.address),H.metadata(admin.address,ethers.id('other')),H.metadata(admin.address,H.workflowId,'0x11223344556677889900')])
   await expect(cre.connect(forwarder).onReport(m,payload(end))).to.be.revertedWithCustomError(cre,'UnauthorisedWorkflow');
 });
 it('rejects malformed metadata',async function(){
  await expect(cre.connect(forwarder).onReport('0x',payload(end))).to.be.revertedWithCustomError(cre,'InvalidMetadata');
 });
 it('rejects an identical payload replay even when trailing reportId changes',async function(){
  await cre.connect(forwarder).onReport(H.metadata(admin.address),payload(end));
  const m=H.metadata(admin.address).slice(0,-4)+'0002';
  await expect(cre.connect(forwarder).onReport(m,payload(end))).to.be.revertedWithCustomError(cre,'ReportAlreadyConsumed');
  expect(await registry.callCount()).to.equal(1);
 });
 it('emits per-meter rejection for disabled meters and sub-floor quantities',async function(){
  await cre.connect(forwarder).onReport(H.metadata(admin.address),H.report([H.reading('X',2000n,end),H.reading('M',999n,end)]));
  expect(await registry.callCount()).to.equal(0);
 });
 it('rejects future, reversed and stale production intervals',async function(){
  for(const r of [H.reading('M',2000n,end+10000),H.reading('M',2000n,end,end+1),H.reading('M',2000n,end-8*86400)]){
   await expect(cre.connect(forwarder).onReport(H.metadata(admin.address),H.report([r]))).to.emit(cre,'IssuanceRejected');
  }
  expect(await registry.callCount()).to.equal(0);
 });
 it('limits administration and validates identities and meter bindings',async function(){
  await expect(cre.connect(outsider).setForwarder(outsider.address)).to.be.reverted;
  await expect(cre.setForwarder(ethers.ZeroAddress)).to.be.revertedWith('Zero address');
  await expect(cre.setWorkflow(ethers.ZeroHash,H.workflowName,admin.address)).to.be.reverted;
  await expect(cre.bindMeter('M',ethers.ZeroAddress,0,'GR')).to.be.reverted;
  await expect(cre.bindMeter('M',producer.address,6,'GR')).to.be.reverted;
 });
 it('rejects the old forwarder after rotation',async function(){
  await cre.setForwarder(outsider.address);
  await expect(cre.connect(forwarder).onReport(H.metadata(admin.address),payload(end))).to.be.revertedWithCustomError(cre,'UnauthorisedForwarder');
  await cre.connect(outsider).onReport(H.metadata(admin.address),payload(end));
 });
});
