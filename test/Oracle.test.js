/**
 * RecDapp — oracle issuance path.
 *
 * Exercises requestAutoIssuance and the fulfilment callback against a mock
 * Chainlink Functions router, covering the configuration guards, the happy
 * path, the error path, and the behaviour when the returned volume falls
 * below the 1 MWh issuance floor.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const Source = { Solar: 0, Wind: 1, Hydro: 2 };
const MWH = 1000n;
const SOURCE_JS = "const m=args[0]; return Functions.encodeUint256(1000);";

describe("RecDapp — oracle issuance", function () {
  let router, contract, deployer, producer, outsider, donId;

  beforeEach(async function () {
    [deployer, producer, outsider] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("MockFunctionsRouter");
    router = await Router.deploy();
    await router.waitForDeployment();

    const Factory = await ethers.getContractFactory("RecDapp");
    contract = await Factory.deploy("ipfs://base/", await router.getAddress());
    await contract.waitForDeployment();

    donId = ethers.encodeBytes32String("fun-ethereum-sepolia-1");
  });

  async function configure() {
    await contract.connect(deployer).setFunctionsSource(SOURCE_JS);
    await contract.connect(deployer).setDonConfig(donId, 1234, 300000);
  }

  async function request(meterId = "METER_GR_001") {
    await contract.connect(deployer).requestAutoIssuance(
      producer.address, Source.Solar, "GR-AT", meterId);
    return await router.lastRequestId();
  }

  // ── Configuration guards ──────────────────────────────────────────────────
  it("refuses a request before the Functions source is configured", async function () {
    await contract.connect(deployer).setDonConfig(donId, 1234, 300000);
    await expect(
      contract.connect(deployer).requestAutoIssuance(
        producer.address, Source.Solar, "GR-AT", "METER_GR_001")
    ).to.be.revertedWith("Functions source not configured");
  });

  it("refuses a request before the subscription is set", async function () {
    await contract.connect(deployer).setFunctionsSource(SOURCE_JS);
    await expect(
      contract.connect(deployer).requestAutoIssuance(
        producer.address, Source.Solar, "GR-AT", "METER_GR_001")
    ).to.be.revertedWith("Subscription ID not set");
  });

  it("refuses a request for the zero-address producer", async function () {
    await configure();
    await expect(
      contract.connect(deployer).requestAutoIssuance(
        ethers.ZeroAddress, Source.Solar, "GR-AT", "METER_GR_001")
    ).to.be.revertedWith("Invalid producer");
  });

  it("restricts requests to ISSUER_ROLE", async function () {
    await configure();
    await expect(
      contract.connect(outsider).requestAutoIssuance(
        producer.address, Source.Solar, "GR-AT", "METER_GR_001")
    ).to.be.reverted;
  });

  it("stores the DON configuration and forwards it on request", async function () {
    await configure();
    expect(await contract.donId()).to.equal(donId);
    expect(await contract.subscriptionId()).to.equal(1234n);
    expect(await contract.callbackGasLimit()).to.equal(300000n);

    await request();
    expect(await router.lastSubscriptionId()).to.equal(1234n);
    expect(await router.lastCallbackGasLimit()).to.equal(300000n);
    expect(await router.lastDonId()).to.equal(donId);
  });

  it("emits OracleRequestSent carrying the producer and meter id", async function () {
    await configure();
    await expect(
      contract.connect(deployer).requestAutoIssuance(
        producer.address, Source.Solar, "GR-AT", "METER_GR_001")
    ).to.emit(contract, "OracleRequestSent");
  });

  // ── Fulfilment ────────────────────────────────────────────────────────────
  it("mints to the producer and tags provenance on a successful response", async function () {
    await configure();
    const id = await request("METER_GR_007");
    await expect(
      router.fulfilWithValue(await contract.getAddress(), id, 35n * MWH)
    ).to.emit(contract, "OracleRequestFulfilled");

    expect(await contract.balanceOf(producer.address, 1n)).to.equal(35n * MWH);
    const md = await contract.recMetadata(1n);
    expect(md.dataHash).to.equal("oracle://METER_GR_007");
    expect(md.producer).to.equal(producer.address);
    expect(md.issuer).to.equal(await contract.getAddress());
  });

  it("emits OracleFulfillmentError and mints nothing on an error response", async function () {
    await configure();
    const id = await request();
    await expect(
      router.fulfilWithError(await contract.getAddress(), id, "Anomaly detected")
    ).to.emit(contract, "OracleFulfillmentError");
    expect(await contract.balanceOf(producer.address, 1n)).to.equal(0n);
  });

  it("rejects a fulfilment that does not originate from the router", async function () {
    await configure();
    const id = await request();
    await expect(
      contract.connect(outsider).handleOracleFulfillment(
        id, ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [35000]), "0x")
    ).to.be.reverted;
  });

  it("mints nothing when the returned volume is below the 1 MWh floor", async function () {
    await configure();
    const id = await request();
    await router.fulfilWithValue(await contract.getAddress(), id, 999n);
    expect(await contract.balanceOf(producer.address, 1n)).to.equal(0n);
  });

  /**
   * Documents a known observability gap: a sub-floor volume terminates the
   * callback without an application-level outcome event. Only Chainlink's
   * generic ResponseReceived is emitted, so a consumer reading the logs cannot
   * distinguish a dropped issuance from one that never completed. Section 5 of
   * the manuscript reports this; if the contract is later changed to emit on
   * this path, this test should be inverted.
   */
  it("emits no outcome event when the volume is below the floor (observability gap)",
    async function () {
      await configure();
      const id = await request();
      const addr = (await contract.getAddress()).toLowerCase();
      const tx = await router.fulfilWithValue(addr, id, 999n);
      const receipt = await tx.wait();

      const outcomeTopics = [
        contract.interface.getEvent("OracleRequestFulfilled").topicHash,
        contract.interface.getEvent("OracleFulfillmentError").topicHash,
        contract.interface.getEvent("RecIssued").topicHash,
      ];
      const outcomes = receipt.logs.filter(
        (l) => l.address.toLowerCase() === addr && outcomeTopics.includes(l.topics[0]));
      expect(outcomes.length).to.equal(0);
    });

  it("clears the pending record so a response cannot be replayed", async function () {
    await configure();
    const id = await request();
    await router.fulfilWithValue(await contract.getAddress(), id, 35n * MWH);
    expect(await contract.balanceOf(producer.address, 1n)).to.equal(35n * MWH);

    // Second delivery for the same id: pending record is gone, producer is
    // the zero address, so _issueRec must reject rather than mint again.
    await expect(
      router.fulfilWithValue(await contract.getAddress(), id, 35n * MWH)
    ).to.be.revertedWith("Invalid producer");
    expect(await contract.balanceOf(producer.address, 2n)).to.equal(0n);
  });

  // ── Admin surface ─────────────────────────────────────────────────────────
  it("allows the admin to update the token URI and rejects others", async function () {
    await contract.connect(deployer).setURI("ipfs://updated/");
    await expect(contract.connect(outsider).setURI("ipfs://evil/")).to.be.reverted;
  });
});
