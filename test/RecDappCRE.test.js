/**
 * RecDappCRE — report-receiver contract for the revised CRE issuance path.
 *
 * Covers the forwarder guard, meter binding, report decoding, the issuance
 * floor, and the rejection events that close the observability gap left by the
 * Functions callback.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const Source = { Solar: 0, Wind: 1, Hydro: 2 };
const MWH = 1000n;

describe("RecDappCRE", function () {
  let cre, registry, admin, forwarder, producer, outsider;

  beforeEach(async function () {
    [admin, forwarder, producer, outsider] = await ethers.getSigners();
    const Reg = await ethers.getContractFactory("MockRecIssuer");
    registry = await Reg.deploy();
    await registry.waitForDeployment();

    const F = await ethers.getContractFactory("RecDappCRE");
    cre = await F.deploy(await registry.getAddress(), forwarder.address);
    await cre.waitForDeployment();
  });

  function report(ids, kwh) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["string[]", "uint256[]"], [ids, kwh]);
  }

  async function bind(id = "METER_GR_001") {
    await cre.connect(admin).bindMeter(id, producer.address, Source.Solar, "GR-AT");
    return id;
  }

  // ── Forwarder guard ───────────────────────────────────────────────────────
  it("accepts reports only from the configured forwarder", async function () {
    const id = await bind();
    await expect(
      cre.connect(outsider).onReport("0x", report([id], [35n * MWH]))
    ).to.be.revertedWithCustomError(cre, "UnauthorisedForwarder");
    await expect(
      cre.connect(forwarder).onReport("0x", report([id], [35n * MWH]))
    ).to.emit(cre, "IssuanceAccepted");
  });

  it("lets the admin rotate the forwarder, and rejects the old one", async function () {
    const id = await bind();
    await cre.connect(admin).setForwarder(outsider.address);
    await expect(
      cre.connect(forwarder).onReport("0x", report([id], [35n * MWH]))
    ).to.be.revertedWithCustomError(cre, "UnauthorisedForwarder");
    await expect(
      cre.connect(outsider).onReport("0x", report([id], [35n * MWH]))
    ).to.emit(cre, "IssuanceAccepted");
  });

  it("restricts administration to ADMIN_ROLE", async function () {
    await expect(cre.connect(outsider).setForwarder(outsider.address)).to.be.reverted;
    await expect(
      cre.connect(outsider).bindMeter("M", producer.address, Source.Solar, "GR-AT")
    ).to.be.reverted;
  });

  // ── Meter binding ─────────────────────────────────────────────────────────
  it("mints to the bound producer with the bound attributes", async function () {
    const id = await bind("METER_GR_007");
    await cre.connect(forwarder).onReport("0x", report([id], [35n * MWH]));
    expect(await registry.lastProducer()).to.equal(producer.address);
    expect(await registry.lastKwh()).to.equal(35n * MWH);
    expect(await registry.lastLocation()).to.equal("GR-AT");
    expect(await registry.lastProvenance()).to.equal("cre://METER_GR_007");
  });

  it("rejects an unbound meter rather than minting", async function () {
    await expect(
      cre.connect(forwarder).onReport("0x", report(["UNKNOWN"], [35n * MWH]))
    ).to.emit(cre, "IssuanceRejected").withArgs("UNKNOWN", 35n * MWH, "meter not bound");
    expect(await registry.callCount()).to.equal(0n);
  });

  it("stops honouring a meter once unbound", async function () {
    const id = await bind();
    await cre.connect(admin).unbindMeter(id);
    await expect(
      cre.connect(forwarder).onReport("0x", report([id], [35n * MWH]))
    ).to.emit(cre, "IssuanceRejected");
    expect(await registry.callCount()).to.equal(0n);
  });

  it("refuses to bind the zero address as producer", async function () {
    await expect(
      cre.connect(admin).bindMeter("M", ethers.ZeroAddress, Source.Solar, "GR-AT")
    ).to.be.revertedWith("Invalid producer");
  });

  // ── Issuance floor and observability ──────────────────────────────────────
  it("emits a rejection event below the 1 MWh floor, closing the Functions gap",
    async function () {
      const id = await bind();
      await expect(
        cre.connect(forwarder).onReport("0x", report([id], [999n]))
      ).to.emit(cre, "IssuanceRejected").withArgs(id, 999n, "below 1 MWh floor");
      expect(await registry.callCount()).to.equal(0n);
    });

  // ── Batch reports ─────────────────────────────────────────────────────────
  it("processes a multi-meter report and reports each outcome separately",
    async function () {
      const a = await bind("M_A");
      await cre.connect(admin).bindMeter("M_B", producer.address, Source.Wind, "GR-MA");
      const tx = await cre.connect(forwarder).onReport(
        "0x", report([a, "M_B", "M_C"], [35n * MWH, 500n, 2n * MWH]));
      const rc = await tx.wait();
      const accepted = rc.logs.filter(
        (l) => l.topics[0] === cre.interface.getEvent("IssuanceAccepted").topicHash);
      const rejected = rc.logs.filter(
        (l) => l.topics[0] === cre.interface.getEvent("IssuanceRejected").topicHash);
      expect(accepted.length).to.equal(1);   // M_A
      expect(rejected.length).to.equal(2);   // M_B sub-floor, M_C unbound
      expect(await registry.callCount()).to.equal(1n);
    });

  it("rejects a report whose arrays do not match in length", async function () {
    const id = await bind();
    const bad = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string[]", "uint256[]"], [[id, "M_B"], [35n * MWH]]);
    await expect(
      cre.connect(forwarder).onReport("0x", bad)
    ).to.be.revertedWithCustomError(cre, "LengthMismatch");
  });

  it("mints nothing for an empty report", async function () {
    await cre.connect(forwarder).onReport("0x", report([], []));
    expect(await registry.callCount()).to.equal(0n);
  });
});
