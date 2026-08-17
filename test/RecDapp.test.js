/**
 * RecDapp — functional test suite.
 *
 * Covers the security properties asserted in the manuscript: role gating,
 * reentrancy protection, expiry enforcement, retirement accounting, escrow
 * integrity, and the oracle issuance floor.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const Source = { Solar: 0, Wind: 1, Hydro: 2 };
const MWH = 1000n;                       // 1 MWh = 1000 kWh token units
const DAY = 24 * 60 * 60;

describe("RecDapp", function () {
  let contract, deployer, issuer, producer, buyer, outsider, ISSUER_ROLE, ADMIN_ROLE;

  beforeEach(async function () {
    [deployer, issuer, producer, buyer, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RecDapp");
    // Functions router is not exercised by these tests; any address will do.
    contract = await Factory.deploy("ipfs://base/", deployer.address);
    await contract.waitForDeployment();
    ISSUER_ROLE = await contract.ISSUER_ROLE();
    ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
  });

  async function issue(kwh = 35n * MWH) {
    await contract.connect(deployer).issueRec(
      producer.address, Source.Solar, kwh, "GR-AT", "ipfs://cid");
    return 1n; // first token id
  }

  // ── Access control ────────────────────────────────────────────────────────
  describe("access control", function () {
    it("grants both roles to the deployer at construction", async function () {
      expect(await contract.hasRole(ISSUER_ROLE, deployer.address)).to.equal(true);
      expect(await contract.hasRole(ADMIN_ROLE, deployer.address)).to.equal(true);
    });

    it("rejects issuance from an account without ISSUER_ROLE", async function () {
      await expect(
        contract.connect(outsider).issueRec(
          producer.address, Source.Solar, MWH, "GR-AT", "ipfs://cid")
      ).to.be.reverted;
    });

    it("permits issuance after the role is delegated, and revokes cleanly", async function () {
      await contract.connect(deployer).grantRole(ISSUER_ROLE, issuer.address);
      await expect(
        contract.connect(issuer).issueRec(
          producer.address, Source.Wind, MWH, "GR-MA", "ipfs://cid")
      ).to.emit(contract, "RecIssued");

      await contract.connect(deployer).revokeRole(ISSUER_ROLE, issuer.address);
      await expect(
        contract.connect(issuer).issueRec(
          producer.address, Source.Wind, MWH, "GR-MA", "ipfs://cid")
      ).to.be.reverted;
    });

    it("rejects oracle configuration from a non-admin", async function () {
      await expect(
        contract.connect(outsider).setDonConfig(ethers.ZeroHash, 1, 300000)
      ).to.be.reverted;
      await expect(
        contract.connect(outsider).setFunctionsSource("return 1;")
      ).to.be.reverted;
    });
  });

  // ── Issuance floor and metadata ───────────────────────────────────────────
  describe("issuance", function () {
    it("enforces the 1 MWh minimum", async function () {
      await expect(
        contract.connect(deployer).issueRec(
          producer.address, Source.Solar, 999n, "GR-AT", "ipfs://cid")
      ).to.be.revertedWith("Minimum 1 MWh (1 000 kWh)");
    });

    it("mints one token unit per kWh to the producer", async function () {
      const id = await issue(35n * MWH);
      expect(await contract.balanceOf(producer.address, id)).to.equal(35n * MWH);
    });

    it("rejects the zero address as producer", async function () {
      await expect(
        contract.connect(deployer).issueRec(
          ethers.ZeroAddress, Source.Solar, MWH, "GR-AT", "ipfs://cid")
      ).to.be.revertedWith("Invalid producer");
    });

    it("sets expiry 365 days after issuance", async function () {
      const id = await issue();
      const md = await contract.recMetadata(id);
      expect(md.expiresAt - md.issuedAt).to.equal(365n * BigInt(DAY));
    });
  });

  // ── Retirement accounting ─────────────────────────────────────────────────
  describe("retirement", function () {
    it("burns units and accumulates the retired total", async function () {
      const id = await issue(10n * MWH);
      await contract.connect(producer).retireRec(id, 3n * MWH);
      expect(await contract.balanceOf(producer.address, id)).to.equal(7n * MWH);
      expect(await contract.totalRetiredKwh(id)).to.equal(3n * MWH);
      expect(await contract.retiredBy(producer.address, id)).to.equal(3n * MWH);
      expect(await contract.remainingKwh(id)).to.equal(7n * MWH);
    });

    it("sets fullyRetired only when the whole batch is retired", async function () {
      const id = await issue(2n * MWH);
      await contract.connect(producer).retireRec(id, 1n * MWH);
      expect((await contract.recMetadata(id)).fullyRetired).to.equal(false);
      await contract.connect(producer).retireRec(id, 1n * MWH);
      expect((await contract.recMetadata(id)).fullyRetired).to.equal(true);
    });

    it("rejects retirement beyond the holder's balance", async function () {
      const id = await issue(1n * MWH);
      await expect(
        contract.connect(producer).retireRec(id, 2n * MWH)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("rejects further retirement once the batch is fully retired", async function () {
      const id = await issue(1n * MWH);
      await contract.connect(producer).retireRec(id, 1n * MWH);
      await expect(
        contract.connect(producer).retireRec(id, 1n)
      ).to.be.revertedWith("Batch fully retired");
    });

    it("rejects retirement of a non-existent token", async function () {
      await expect(
        contract.connect(producer).retireRec(999n, 1n)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  // ── Expiry ────────────────────────────────────────────────────────────────
  describe("expiry", function () {
    it("marks a certificate invalid after 365 days", async function () {
      const id = await issue();
      expect((await contract.verifyRec(id)).valid).to.equal(true);
      await ethers.provider.send("evm_increaseTime", [366 * DAY]);
      await ethers.provider.send("evm_mine", []);
      expect((await contract.verifyRec(id)).valid).to.equal(false);
    });

    it("blocks retirement and listing after expiry", async function () {
      const id = await issue();
      await ethers.provider.send("evm_increaseTime", [366 * DAY]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        contract.connect(producer).retireRec(id, MWH)
      ).to.be.revertedWith("Certificate expired");
      await expect(
        contract.connect(producer).listRec(id, MWH, 1n)
      ).to.be.revertedWith("Certificate expired");
    });
  });

  // ── Marketplace ───────────────────────────────────────────────────────────
  describe("marketplace", function () {
    const PRICE = 1_000_000_000n;   // wei per kWh unit

    async function listed(amount = 10n * MWH) {
      const id = await issue(35n * MWH);
      await contract.connect(producer).setApprovalForAll(await contract.getAddress(), true);
      await contract.connect(producer).listRec(id, amount, PRICE);
      return { id, listingId: 0n, amount };
    }

    it("escrows the listed units into the contract", async function () {
      const { id, amount } = await listed();
      expect(await contract.balanceOf(await contract.getAddress(), id)).to.equal(amount);
      expect(await contract.balanceOf(producer.address, id)).to.equal(35n * MWH - amount);
    });

    it("rejects a purchase whose payment does not match the price exactly", async function () {
      const { listingId } = await listed();
      await expect(
        contract.connect(buyer).buyRec(listingId, MWH, { value: PRICE * MWH - 1n })
      ).to.be.revertedWith("Incorrect payment");
    });

    it("transfers units to the buyer and ETH to the seller", async function () {
      const { id, listingId } = await listed();
      const before = await ethers.provider.getBalance(producer.address);
      await contract.connect(buyer).buyRec(listingId, 4n * MWH, { value: PRICE * 4n * MWH });
      expect(await contract.balanceOf(buyer.address, id)).to.equal(4n * MWH);
      expect(await ethers.provider.getBalance(producer.address) - before)
        .to.equal(PRICE * 4n * MWH);
    });

    it("deactivates the listing once fully filled", async function () {
      const { listingId, amount } = await listed();
      await contract.connect(buyer).buyRec(listingId, amount, { value: PRICE * amount });
      expect((await contract.listings(listingId)).active).to.equal(false);
      await expect(
        contract.connect(buyer).buyRec(listingId, 1n, { value: PRICE })
      ).to.be.revertedWith("Listing not active");
    });

    it("rejects an over-sized purchase", async function () {
      const { listingId, amount } = await listed();
      await expect(
        contract.connect(buyer).buyRec(listingId, amount + 1n, { value: PRICE * (amount + 1n) })
      ).to.be.revertedWith("Invalid amount");
    });

    it("returns escrow to the seller on cancellation, and only to the seller", async function () {
      const { id, listingId, amount } = await listed();
      await expect(
        contract.connect(outsider).cancelListing(listingId)
      ).to.be.revertedWith("Not the seller");
      await contract.connect(producer).cancelListing(listingId);
      expect(await contract.balanceOf(producer.address, id)).to.equal(35n * MWH);
      expect(await contract.balanceOf(await contract.getAddress(), id)).to.equal(0n);
    });

    it("blocks a reentrant buyRec through the ERC-1155 receiver hook", async function () {
      const { listingId } = await listed();
      const Attacker = await ethers.getContractFactory("ReentrantBuyer");
      const attacker = await Attacker.deploy(await contract.getAddress(), listingId, PRICE);
      await attacker.waitForDeployment();
      // The hook re-enters buyRec; ReentrancyGuard must make the outer call revert.
      await expect(
        attacker.attack(MWH, { value: PRICE * MWH * 2n })
      ).to.be.reverted;
    });
  });

  // ── Public verification ───────────────────────────────────────────────────
  describe("verifyRec", function () {
    it("returns false for an unknown token and true for a live one", async function () {
      expect((await contract.verifyRec(4242n)).valid).to.equal(false);
      const id = await issue();
      const [valid, md] = await contract.verifyRec(id);
      expect(valid).to.equal(true);
      expect(md.producer).to.equal(producer.address);
      expect(md.kwh).to.equal(35n * MWH);
    });

    it("is callable by an account holding no tokens and no role", async function () {
      const id = await issue();
      expect((await contract.connect(outsider).verifyRec(id)).valid).to.equal(true);
    });
  });
});
