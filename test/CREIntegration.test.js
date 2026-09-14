/**
 * Revised issuance path, contracts wired together: RecDappCRE (report consumer)
 * minting into RecDappWorkflowRegistry (RecDapp plus the restricted
 * issueFromWorkflow entry point).
 *
 * The CRE forwarder is represented by a test account and reports are encoded
 * exactly as cre/screening/main.ts encodes them (string[] meterIds,
 * uint256[] kWh). Delivery through a live DON is not exercised here.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { resolveProvenance } = require("../server/lib/provenance");

const Source = { Solar: 0, Wind: 1, Hydro: 2 };
const MWH = 1000n;

describe("CRE integration — consumer and workflow registry", function () {
  let registry, consumer, router, admin, forwarder, producer, outsider;

  const report = (ids, kwh) =>
    ethers.AbiCoder.defaultAbiCoder().encode(["string[]", "uint256[]"], [ids, kwh]);

  beforeEach(async function () {
    [admin, forwarder, producer, outsider] = await ethers.getSigners();
    router = await (await ethers.getContractFactory("MockFunctionsRouter")).deploy();
    registry = await (await ethers.getContractFactory("RecDappWorkflowRegistry"))
      .deploy("ipfs://base/", await router.getAddress());
    consumer = await (await ethers.getContractFactory("RecDappCRE"))
      .deploy(await registry.getAddress(), forwarder.address);
    await registry.connect(admin).grantRole(await registry.WORKFLOW_ROLE(), await consumer.getAddress());
    await consumer.connect(admin).bindMeter("METER_GR_001", producer.address, Source.Solar, "GR-AT");
  });

  it("mints a screened reading into the registry, with the consumer as issuer", async function () {
    await expect(consumer.connect(forwarder).onReport("0x", report(["METER_GR_001"], [35n * MWH])))
      .to.emit(consumer, "IssuanceAccepted").withArgs("METER_GR_001", 1n, 35n * MWH)
      .and.to.emit(registry, "WorkflowIssuance");
    expect(await registry.balanceOf(producer.address, 1n)).to.equal(35n * MWH);
    const m = await registry.recMetadata(1n);
    expect(m.issuer).to.equal(await consumer.getAddress());
    expect(m.dataHash).to.equal("cre://METER_GR_001");
    expect(await registry.issuedByWorkflow(1n)).to.equal(true);
  });

  it("applies the consumer's floor and binding checks before reaching the registry", async function () {
    await consumer.connect(admin).bindMeter("METER_GR_002", producer.address, Source.Wind, "GR-MA");
    await consumer.connect(forwarder).onReport("0x",
      report(["METER_GR_001", "METER_GR_002", "UNBOUND"], [35n * MWH, 500n, 2n * MWH]));
    expect(await registry.balanceOf(producer.address, 1n)).to.equal(35n * MWH);
    expect(await registry.issuedByWorkflow(2n)).to.equal(false);   // nothing else minted
  });

  it("reverts the report when the consumer does not hold WORKFLOW_ROLE", async function () {
    await registry.connect(admin).revokeRole(await registry.WORKFLOW_ROLE(), await consumer.getAddress());
    await expect(consumer.connect(forwarder).onReport("0x", report(["METER_GR_001"], [35n * MWH])))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("does not let an ISSUER_ROLE account call the workflow entry point", async function () {
    await expect(registry.connect(admin).issueFromWorkflow(producer.address, Source.Solar, 35n * MWH, "GR-AT", "cre://X"))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("enforces the registry's own floor and source range on the workflow path", async function () {
    await registry.connect(admin).grantRole(await registry.WORKFLOW_ROLE(), outsider.address);
    await expect(registry.connect(outsider).issueFromWorkflow(producer.address, Source.Solar, 999n, "GR-AT", "cre://X"))
      .to.be.revertedWith("Minimum 1 MWh (1 000 kWh)");
    await expect(registry.connect(outsider).issueFromWorkflow(producer.address, 9, 35n * MWH, "GR-AT", "cre://X"))
      .to.be.revertedWith("Invalid source");
  });

  it("keeps the three issuance paths distinguishable by issuer, not by reference", async function () {
    const reg = await registry.getAddress();
    // CRE path
    await consumer.connect(forwarder).onReport("0x", report(["METER_GR_001"], [35n * MWH]));
    // Functions path, inherited unchanged
    await registry.connect(admin).setFunctionsSource("return Functions.encodeUint256(2000);");
    await registry.connect(admin).setDonConfig(ethers.encodeBytes32String("don"), 1, 300000);
    await registry.connect(admin).requestAutoIssuance(producer.address, Source.Wind, "GR-MA", "METER_GR_009");
    await router.fulfilWithValue(reg, await router.lastRequestId(), 2n * MWH);
    // Manual path with a reference that imitates the oracle
    await registry.connect(admin).issueRec(producer.address, Source.Hydro, 3n * MWH, "GR-EP", "oracle://METER_GR_009");

    const classify = async (id) => resolveProvenance(await registry.recMetadata(id),
      { registryAddress: reg, issuedByWorkflow: await registry.issuedByWorkflow(id) });
    expect((await classify(1n)).path).to.equal("workflow");
    expect((await classify(2n)).path).to.equal("functions");
    const spoof = await classify(3n);
    expect(spoof.path).to.equal("manual");
    expect(spoof.referenceClaimsOracle).to.equal(true);
  });

  it("accepts only the configured forwarder end to end", async function () {
    await expect(consumer.connect(outsider).onReport("0x", report(["METER_GR_001"], [35n * MWH])))
      .to.be.revertedWithCustomError(consumer, "UnauthorisedForwarder");
    expect(await registry.balanceOf(producer.address, 1n)).to.equal(0n);
  });
});
