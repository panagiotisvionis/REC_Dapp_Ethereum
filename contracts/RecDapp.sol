// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FunctionsClient}  from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * RecDapp v3 — Renewable Energy Certificate Platform with IoT Oracle
 *
 * Token model  : 1 token unit = 1 kWh
 * Industry std : 1 MWh = 1 REC = 1 000 kWh (minimum issuance)
 *
 * Issuance modes:
 *   A) Manual  — ISSUER_ROLE calls issueRec() directly (e.g. regulatory body)
 *   B) Oracle  — ISSUER_ROLE calls requestAutoIssuance(); Chainlink Functions
 *               fetches IoT meter data, runs anomaly detection off-chain,
 *               then fulfillRequest() auto-issues the REC if data is valid.
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — manages roles, oracle config, contract URI
 *   ISSUER_ROLE        — certified bodies / IoT oracle triggers
 */
contract RecDapp is ERC1155, ERC1155Holder, AccessControl, ReentrancyGuard, FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    enum EnergySource { Solar, Wind, Hydro, Biomass, Geothermal, Other }

    struct RecMetadata {
        address      issuer;
        address      producer;
        EnergySource source;
        uint256      kwh;
        string       location;   // ISO 3166-2, e.g. "GR-AT"
        uint256      issuedAt;
        uint256      expiresAt;  // 1 year from issuance (industry standard)
        bool         fullyRetired;
        string       dataHash;   // IPFS CID or oracle://meterId
    }

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 amount;       // kWh units in escrow
        uint256 pricePerKwh;  // wei per kWh unit
        bool    active;
    }

    // ── Oracle state ─────────────────────────────────────────────────────────

    struct PendingIssuance {
        address      producer;
        EnergySource source;
        string       location;
        string       meterId;
    }

    bytes32 public donId;
    uint64  public subscriptionId;
    uint32  public callbackGasLimit = 300_000;
    string  public functionsSource;  // JS source set by admin, runs in Chainlink DON

    mapping(bytes32 => PendingIssuance) private _pendingIssuances;

    // ── Core state ───────────────────────────────────────────────────────────

    uint256 private _nextTokenId = 1;
    uint256 public  listingCount;

    mapping(uint256 => RecMetadata) public recMetadata;
    mapping(uint256 => Listing)     public listings;
    mapping(uint256 => uint256)     public totalRetiredKwh;
    mapping(address => mapping(uint256 => uint256)) public retiredBy;

    // ── Events ───────────────────────────────────────────────────────────────

    event RecIssued(
        uint256 indexed tokenId,
        address indexed producer,
        EnergySource    source,
        uint256         kwh,
        string          location,
        uint256         expiresAt
    );
    event RecRetired(uint256 indexed tokenId, address indexed retiredBy, uint256 amount);
    event RecListed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 amount, uint256 pricePerKwh);
    event RecSold(uint256 indexed listingId, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPaid);
    event ListingCancelled(uint256 indexed listingId);

    event OracleRequestSent(bytes32 indexed requestId, address indexed producer, string meterId);
    event OracleRequestFulfilled(bytes32 indexed requestId, uint256 indexed tokenId, uint256 kwh);
    event OracleFulfillmentError(bytes32 indexed requestId, bytes err);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        string  memory uri_,
        address functionsRouter
    )
        ERC1155(uri_)
        FunctionsClient(functionsRouter)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    // ── Manual issuance ──────────────────────────────────────────────────────

    /**
     * Issue a REC batch manually. Only ISSUER_ROLE.
     */
    function issueRec(
        address         producer,
        EnergySource    source,
        uint256         kwh,
        string calldata location,
        string calldata dataHash
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        return _issueRec(msg.sender, producer, source, kwh, location, dataHash);
    }

    // ── Oracle issuance ──────────────────────────────────────────────────────

    /**
     * Trigger automated REC issuance via Chainlink Functions.
     * Chainlink DON will:
     *   1. Fetch meter reading from the IoT API
     *   2. Run statistical anomaly detection (3-sigma rule)
     *   3. Return verified kWh to fulfillRequest()
     */
    function requestAutoIssuance(
        address         producer,
        EnergySource    source,
        string calldata location,
        string calldata meterId
    ) external onlyRole(ISSUER_ROLE) returns (bytes32 requestId) {
        require(producer != address(0),          "Invalid producer");
        require(bytes(functionsSource).length > 0, "Functions source not configured");
        require(subscriptionId != 0,             "Subscription ID not set");

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(functionsSource);

        string[] memory fArgs = new string[](1);
        fArgs[0] = meterId;
        req.setArgs(fArgs);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);

        _pendingIssuances[requestId] = PendingIssuance({
            producer: producer,
            source:   source,
            location: location,
            meterId:  meterId
        });

        emit OracleRequestSent(requestId, producer, meterId);
    }

    /**
     * Called automatically by Chainlink when off-chain computation completes.
     * response = abi-encoded uint256 kWh value verified by the oracle.
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes   memory response,
        bytes   memory err
    ) internal override {
        PendingIssuance memory p = _pendingIssuances[requestId];
        delete _pendingIssuances[requestId];

        if (err.length > 0) {
            emit OracleFulfillmentError(requestId, err);
            return;
        }

        uint256 kwh = abi.decode(response, (uint256));

        if (kwh >= 1000) {
            string memory dataHash = string.concat("oracle://", p.meterId);
            uint256 tokenId = _issueRec(address(this), p.producer, p.source, kwh, p.location, dataHash);
            emit OracleRequestFulfilled(requestId, tokenId, kwh);
        }
    }

    // ── Retirement ───────────────────────────────────────────────────────────

    function retireRec(uint256 tokenId, uint256 amount) external {
        require(recMetadata[tokenId].producer != address(0), "Token does not exist");
        require(!recMetadata[tokenId].fullyRetired,          "Batch fully retired");
        require(block.timestamp <= recMetadata[tokenId].expiresAt, "Certificate expired");
        require(balanceOf(msg.sender, tokenId) >= amount,    "Insufficient balance");

        _burn(msg.sender, tokenId, amount);

        totalRetiredKwh[tokenId]       += amount;
        retiredBy[msg.sender][tokenId] += amount;

        if (totalRetiredKwh[tokenId] >= recMetadata[tokenId].kwh) {
            recMetadata[tokenId].fullyRetired = true;
        }

        emit RecRetired(tokenId, msg.sender, amount);
    }

    // ── Marketplace ──────────────────────────────────────────────────────────

    function listRec(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerKwh
    ) external returns (uint256 listingId) {
        require(recMetadata[tokenId].producer != address(0), "Token does not exist");
        require(!recMetadata[tokenId].fullyRetired,          "Batch fully retired");
        require(block.timestamp <= recMetadata[tokenId].expiresAt, "Certificate expired");
        require(balanceOf(msg.sender, tokenId) >= amount,    "Insufficient balance");
        require(amount > 0 && pricePerKwh > 0,               "Invalid amount or price");

        safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        listingId = listingCount++;
        listings[listingId] = Listing({
            seller:      msg.sender,
            tokenId:     tokenId,
            amount:      amount,
            pricePerKwh: pricePerKwh,
            active:      true
        });

        emit RecListed(listingId, tokenId, msg.sender, amount, pricePerKwh);
    }

    function buyRec(uint256 listingId, uint256 amount) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active,                             "Listing not active");
        require(amount > 0 && amount <= listing.amount,    "Invalid amount");
        require(msg.value == amount * listing.pricePerKwh, "Incorrect payment");

        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        uint256 tokenId = listing.tokenId;
        address seller  = listing.seller;

        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        (bool ok, ) = payable(seller).call{value: msg.value}("");
        require(ok, "ETH transfer to seller failed");

        emit RecSold(listingId, tokenId, msg.sender, amount, msg.value);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.active,               "Already inactive");

        uint256 amount  = listing.amount;
        uint256 tokenId = listing.tokenId;
        listing.active  = false;
        listing.amount  = 0;

        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        emit ListingCancelled(listingId);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function verifyRec(uint256 tokenId)
        external view
        returns (bool valid, RecMetadata memory metadata)
    {
        metadata = recMetadata[tokenId];
        valid = metadata.producer != address(0)
             && !metadata.fullyRetired
             && block.timestamp <= metadata.expiresAt;
    }

    function remainingKwh(uint256 tokenId) external view returns (uint256) {
        return recMetadata[tokenId].kwh - totalRetiredKwh[tokenId];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setFunctionsSource(string calldata source) external onlyRole(DEFAULT_ADMIN_ROLE) {
        functionsSource = source;
    }

    function setDonConfig(
        bytes32 _donId,
        uint64  _subscriptionId,
        uint32  _callbackGasLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        donId             = _donId;
        subscriptionId    = _subscriptionId;
        callbackGasLimit  = _callbackGasLimit;
    }

    function setURI(string memory newUri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newUri);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _issueRec(
        address      issuer,
        address      producer,
        EnergySource source,
        uint256      kwh,
        string memory location,
        string memory dataHash
    ) internal returns (uint256 tokenId) {
        require(producer != address(0), "Invalid producer");
        require(kwh >= 1000,            "Minimum 1 MWh (1 000 kWh)");

        tokenId = _nextTokenId++;
        uint256 expiry = block.timestamp + 365 days;

        recMetadata[tokenId] = RecMetadata({
            issuer:       issuer,
            producer:     producer,
            source:       source,
            kwh:          kwh,
            location:     location,
            issuedAt:     block.timestamp,
            expiresAt:    expiry,
            fullyRetired: false,
            dataHash:     dataHash
        });

        _mint(producer, tokenId, kwh, "");

        emit RecIssued(tokenId, producer, source, kwh, location, expiry);
    }

    // ── Interface support ─────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public view
        override(ERC1155, ERC1155Holder, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
